# Warehouse Sorting Barcode Scanner System - Product Requirements Document (PRD) v2.0

## Executive Summary

This PRD defines the enhanced warehouse sorting application based on POC analysis and user requirements. The system will provide a comprehensive, real-time, multi-user barcode scanning solution with mobile-first design, intelligent barcode processing, and advanced performance analytics.

## Core Requirements & Features

### 1. Mobile-First Scanning Interface

#### 1.1 Responsive Design with Mobile Toggle
- **"Single Box" Mode Toggle**: Switch that forces mobile mode regardless of screen size
- **Full-Screen Target Display**: Shows single box information where scanned item should be placed
  - Massive box number display (180px font)
  - Customer name (36px font)
  - Product name (24px font)
  - Progress counter with visual feedback
- **Mobile Preference Storage**: Per-user preference persistence in database
- **Auto-Detection**: Responsive design with manual override capability

#### 1.2 High-Density Box Display
- **Threshold Behavior**: When boxes > 60, show only box number and completion percentage
- **Worker Color Integration**: Scanned boxes show full worker color with contrasting text
- **Persistent Highlighting**: Color remains until next scan occurs
- **Real-time Synchronization**: All supervisors/managers see live updates

### 2. Real-time Multi-Worker Coordination

#### 2.1 Live Data Synchronization
- **No Local Data**: All operations must be real-time or not execute
- **WebSocket Architecture**: Real-time updates across all connected clients
- **Concurrent Session Management**: Multiple workers on same job with conflict resolution

#### 2.2 Smart Worker Allocation Algorithm
- **Duplicate Barcode Handling**: Same product allocated to different customers/boxes
- **Worker Distribution Logic**:
  - **2 Workers**: One ascending boxes, one descending boxes
  - **3+ Workers**: Evenly distribute from middle (ascending/descending from center)
  - **Single Worker**: FIFO ascending order
- **Caching Strategy**: Cache barcode-to-customer mappings for performance

### 3. Advanced Session Management

#### 3.1 Undo System
- **Individual Scan Undo**: Undo single scans only (no batch undo)
- **Worker Isolation**: Each worker's undo affects only their scans
- **Real-time Updates**: Managers/supervisors see live undo effects
- **Performance Impact**: Undo operations tracked in performance metrics

#### 3.2 Session Export/Import
- **JSON Export**: Complete session state export capability
- **Technology**: Best-practice session state management
- **Data Integrity**: Checksum validation for imported sessions

### 4. Visual Feedback & Animation System

#### 4.1 Performance-Adaptive Animations
- **Dynamic Control**: Animations disabled when box count too high (manager setting)
- **Real-time State Sync**: Fastest, most accurate synchronization method
- **High-Throughput Support**: System handles 4 scans every 10-20 seconds
- **Mobile Optimization**: Based on POC mobile interface patterns

#### 4.2 Visual Hierarchy
- **Scan Feedback**: Immediate visual confirmation
- **Box State Changes**: Clear completion and progress indicators
- **Worker Color Coding**: Persistent color assignment per worker

### 5. Performance Analytics & Gamification

#### 5.1 Real-time Performance Calculation
- **Live Metrics**: Real-time calculation frequency
- **Rolling Windows**: Performance scoring using rolling averages
- **Job Type Benchmarks**: Different benchmarks per job type environment

#### 5.2 Gamification System
- **Session Completion**: Emoticon feedback based on performance levels
- **Encouraging Messages**: Supportive feedback for lower performance
- **Daily Recognition**: Top worker gets fireworks animation and congratulations
- **Performance Levels**: Multiple achievement tiers

### 6. Enhanced Job Management

#### 6.1 Job Lifecycle Management
- **Delete Non-Started Jobs**: Manager capability to remove pending jobs
- **Archive Completed Jobs**: Separate archive area with search functionality
- **Job Status Tracking**: Enhanced status management

#### 6.2 Job Types System
- **Global Job Types**: Manager-configurable job type definitions
- **Custom Benchmarks**: Job type-specific items per hour targets
- **Field Requirements**: Job type can enforce required fields (e.g., Group field)
- **Settings Integration**: Job types managed in global settings area

## Technical Architecture

### Database Schema Enhancements

#### New Tables Required:
```sql
-- Job Types
CREATE TABLE job_types (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  benchmark_items_per_hour INTEGER DEFAULT 71,
  require_group_field BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Worker Box Assignments (for multi-worker coordination)
CREATE TABLE worker_box_assignments (
  id UUID PRIMARY KEY,
  job_id UUID REFERENCES jobs(id),
  worker_id UUID REFERENCES users(id),
  box_number INTEGER,
  assignment_type ENUM('ascending', 'descending', 'middle_up', 'middle_down'),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Session Snapshots (for undo/export)
CREATE TABLE session_snapshots (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES scan_sessions(id),
  snapshot_data JSONB NOT NULL,
  snapshot_type ENUM('auto', 'manual', 'pre_undo'),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Job Archives
CREATE TABLE job_archives (
  id UUID PRIMARY KEY,
  original_job_id UUID,
  job_data JSONB NOT NULL,
  archived_by UUID REFERENCES users(id),
  archived_at TIMESTAMP DEFAULT NOW()
);
```

#### Enhanced Existing Tables:
```sql
-- Add job_type_id to jobs table
ALTER TABLE jobs ADD COLUMN job_type_id UUID REFERENCES job_types(id);

-- Add mobile preferences to user_preferences
ALTER TABLE user_preferences ADD COLUMN mobile_mode_preference BOOLEAN DEFAULT false;
ALTER TABLE user_preferences ADD COLUMN single_box_mode BOOLEAN DEFAULT false;

-- Add worker assignment info to scan_events
ALTER TABLE scan_events ADD COLUMN worker_assignment_type TEXT;
ALTER TABLE scan_events ADD COLUMN target_box_number INTEGER;
```

### Real-time Communication Architecture

#### WebSocket Event Types:
```typescript
type WebSocketEvent = 
  | { type: 'SCAN_PROCESSED', data: { 
      workerId: string, 
      boxNumber: number, 
      workerColor: string,
      animation: boolean 
    }}
  | { type: 'BOX_COMPLETED', data: { boxNumber: number, workerId: string }}
  | { type: 'WORKER_UNDO', data: { 
      workerId: string, 
      affectedBoxes: number[],
      sessionState: SessionSnapshot 
    }}
  | { type: 'MOBILE_STATE_UPDATE', data: {
      workerId: string,
      targetBox: number,
      customerName: string,
      productName: string
    }}
  | { type: 'PERFORMANCE_UPDATE', data: PerformanceMetrics }
  | { type: 'JOB_ARCHIVED', data: { jobId: string }}
  | { type: 'DAILY_TOP_WORKER', data: { workerId: string, performance: number }};
```

### Multi-Worker Coordination Logic

#### Box Assignment Algorithm:
```typescript
class WorkerBoxAssignment {
  static assignWorkerToBoxes(workers: Worker[], totalBoxes: number): WorkerAssignment[] {
    if (workers.length === 1) {
      return [{ workerId: workers[0].id, type: 'ascending', range: [1, totalBoxes] }];
    }
    
    if (workers.length === 2) {
      return [
        { workerId: workers[0].id, type: 'ascending', range: [1, totalBoxes] },
        { workerId: workers[1].id, type: 'descending', range: [totalBoxes, 1] }
      ];
    }
    
    // 3+ workers: distribute from middle
    const middle = Math.ceil(totalBoxes / 2);
    const assignments: WorkerAssignment[] = [];
    
    for (let i = 0; i < workers.length; i++) {
      const isEven = i % 2 === 0;
      assignments.push({
        workerId: workers[i].id,
        type: isEven ? 'middle_up' : 'middle_down',
        range: calculateMiddleRange(middle, i, totalBoxes)
      });
    }
    
    return assignments;
  }
}
```

### Performance Analytics Engine

#### Gamification System:
```typescript
interface PerformanceLevel {
  name: string;
  minScore: number;
  maxScore: number;
  emoticon: string;
  message: string;
  animation?: 'none' | 'celebration' | 'fireworks';
}

const PERFORMANCE_LEVELS: PerformanceLevel[] = [
  { name: 'Excellent', minScore: 90, maxScore: 100, emoticon: '🏆', message: 'Outstanding work!', animation: 'fireworks' },
  { name: 'Great', minScore: 80, maxScore: 89, emoticon: '🌟', message: 'Great job!', animation: 'celebration' },
  { name: 'Good', minScore: 70, maxScore: 79, emoticon: '👍', message: 'Good work!' },
  { name: 'Average', minScore: 60, maxScore: 69, emoticon: '👌', message: 'Keep going!' },
  { name: 'Needs Improvement', minScore: 0, maxScore: 59, emoticon: '💪', message: 'You can do it!' }
];
```

## User Interface Requirements

### Mobile Interface Components

#### 1. Mobile Toggle Component
```typescript
interface MobileToggleProps {
  isMobile: boolean;
  onToggle: (mobile: boolean) => void;
  label: string; // "Single Box"
}
```

#### 2. Full-Screen Mobile Display
```typescript
interface MobileDisplayProps {
  boxNumber: number | null;
  customerName: string;
  productName: string;
  scanCount: string;
  workerColor: string;
  displayState: 'ready' | 'scanning' | 'success' | 'error';
}
```

#### 3. Enhanced Box Grid
```typescript
interface EnhancedBoxGridProps {
  boxes: BoxData[];
  mobileMode: boolean;
  showOnlyNumberAndPercent: boolean; // when > 60 boxes
  activeWorkerColors: Record<string, string>;
  onBoxAnimation: (boxNumber: number, animation: AnimationType) => void;
}
```

### Manager/Supervisor Interfaces

#### 1. Job Type Management
- Create/edit/delete job types
- Set benchmark items per hour
- Configure required fields
- Assign job types to new jobs

#### 2. Global Settings
- Animation performance thresholds
- Default mobile mode settings
- Gamification preferences
- Archive retention policies

#### 3. Archive Management
- Search archived jobs
- Restore archived jobs
- Export archive data
- Bulk archive operations

## Performance Requirements

### Real-time Performance Targets
- **Scan Processing**: < 100ms from barcode to UI update
- **WebSocket Latency**: < 50ms for state synchronization
- **Animation Frame Rate**: 60fps for scanning feedback
- **Concurrent Users**: Support 10+ workers per job
- **Box Grid Rendering**: < 200ms for 100+ boxes

### Scalability Requirements
- **Database Queries**: Optimized for high-frequency scanning operations
- **Memory Usage**: Efficient state management for large sessions
- **Network Bandwidth**: Minimized WebSocket message sizes
- **Mobile Performance**: Optimized for tablet/phone hardware

## Security & Data Integrity

### Session Security
- Worker session isolation
- Atomic barcode processing operations
- Audit trail for all undo operations
- Secure session export/import

### Data Protection
- Real-time backup of active sessions
- Corruption detection and recovery
- Conflict resolution for concurrent operations
- Archive data encryption

## Testing Requirements

### Unit Testing
- Barcode processing logic
- Worker assignment algorithms
- Performance calculation accuracy
- Session state management

### Integration Testing
- Real-time WebSocket communication
- Multi-worker coordination
- Mobile interface responsiveness
- Database transaction integrity

### Performance Testing
- High-frequency scanning simulation
- Concurrent user load testing
- Memory leak detection
- Mobile performance benchmarking

## Deployment & Rollout Strategy

### Phase 1: Foundation (Weeks 1-2)
- Mobile interface implementation
- Basic multi-worker coordination
- Enhanced real-time synchronization

### Phase 2: Advanced Features (Weeks 3-4)
- Undo system implementation
- Performance analytics enhancement
- Job type management

### Phase 3: Gamification & Polish (Weeks 5-6)
- Gamification system
- Advanced animations
- Archive management
- Final performance optimization

## Success Metrics

### User Experience Metrics
- Scan processing speed improvement
- Error rate reduction
- User preference for mobile mode
- Worker satisfaction scores

### Technical Performance Metrics
- System response times
- Concurrent user capacity
- Data accuracy and integrity
- Mobile performance benchmarks

### Business Impact Metrics
- Warehouse productivity improvement
- Training time reduction
- Error correction efficiency
- Overall operational cost savings

This PRD defines a comprehensive enhancement to the warehouse sorting system that addresses all identified gaps from the POC analysis while maintaining production-ready quality and performance standards.