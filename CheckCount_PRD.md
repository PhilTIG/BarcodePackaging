# CheckCount Feature - Product Requirements Document

## Overview
This PRD outlines the implementation of a comprehensive CheckCount system for box verification in the warehouse sorting application. The feature adds quality assurance capabilities allowing users to verify box contents against expected quantities with detailed logging and reporting.

## Current System Analysis

### Database Architecture
- **Users Table**: `id`, `staffId`, `pin`, `role`, `name`, `isActive` - handles manager/supervisor/worker roles
- **UserPreferences Table**: Comprehensive settings including scanner preferences, themes, mobile settings
- **BoxRequirements Table**: Core scanning data - `jobId`, `boxNumber`, `customerName`, `barCode`, `productName`, `requiredQty`, `scannedQty`, `isComplete`, worker tracking
- **ScanEvents Table**: Event logging with `sessionId`, `barCode`, `productName`, `customerName`, `boxNumber`, `eventType`, `isExtraItem`
- **ScanSessions Table**: Session management for workers

### Current Components
- **BoxDetailsModal**: Full-featured modal showing product details, progress bars, worker contributions
- **BarcodeScanner**: Camera-based scanning interface
- **MobileScannerInterface**: Mobile-optimized scanning with full-screen displays
- **CustomerBoxGrid**: Grid view with click handlers for all user types

### Current API Endpoints
- `/api/scan-events` (POST) - Records scan events with WebSocket broadcasting
- `/api/jobs/:id/box-requirements` (GET) - Fetches box requirements
- `/api/users` (GET) - User management with role filtering
- `/api/users/me/preferences` (GET/PUT) - User preference management

## New Requirements

### 1. CheckCount Database Schema

#### New Tables Required:
```sql
-- Check sessions for quality assurance
check_sessions {
  id: varchar (PK)
  jobId: varchar (FK to jobs.id)
  boxNumber: integer
  userId: varchar (FK to users.id) 
  status: text -- 'active', 'completed', 'cancelled'
  startTime: timestamp
  endTime: timestamp
  totalItemsExpected: integer
  totalItemsScanned: integer
  discrepanciesFound: integer
  isComplete: boolean
  createdAt: timestamp
}

-- Individual check events during verification
check_events {
  id: varchar (PK)
  checkSessionId: varchar (FK to check_sessions.id)
  barCode: text
  productName: text
  scannedQty: integer
  expectedQty: integer
  discrepancyType: text -- 'match', 'shortage', 'excess'
  eventType: text -- 'scan', 'manual_adjustment'
  scanTime: timestamp
}

-- Check results and corrections
check_results {
  id: varchar (PK)
  checkSessionId: varchar (FK to check_sessions.id)
  boxRequirementId: varchar (FK to box_requirements.id)
  originalQty: integer
  checkedQty: integer
  adjustedQty: integer
  discrepancyType: text -- 'match', 'shortage', 'excess'
  correctionApplied: boolean
  notes: text
}
```

#### User Preferences Extension:
```sql
-- Add to userPreferences table
checkBoxEnabled: boolean -- Worker permission to perform checks
```

### 2. New API Endpoints Required

#### Check Session Management:
- `POST /api/check-sessions` - Start new check session
- `GET /api/check-sessions/:id` - Get check session details
- `PATCH /api/check-sessions/:id` - Update session status
- `DELETE /api/check-sessions/:id` - Cancel check session

#### Check Events:
- `POST /api/check-events` - Record check scan event
- `GET /api/check-sessions/:id/events` - Get all events for session

#### Check Results & QA Reporting:
- `POST /api/check-results` - Save check results and corrections
- `GET /api/jobs/:id/qa-report` - Comprehensive QA report for job
- `GET /api/jobs/:id/check-sessions` - All check sessions for job

#### User Preferences:
- `PATCH /api/users/:id/preferences` - Update checkBoxEnabled setting

### 3. UI Components Required

#### Enhanced Box Modal:
- **CheckCount Button**: Visible to managers/supervisors always, workers when enabled
- **Conditional Display**: Based on user role and worker settings

#### Full-Screen Check Interface:
- **Layout**: Full-screen modal with barcode scanner at top
- **Product Grid**: Same as box modal but with dual progress bars
- **Progress Bars**: 
  - Original progress bar (existing scanned vs required)
  - Check progress bar (check scanned vs original scanned)
  - Color coding: Green when match, Red when excess, Orange for "Extra" items
- **Completion Actions**: "Scan Complete" button with discrepancy handling

#### Settings Management (Manager Only):
- **User Management Section**: Add "Check Boxes" toggle per worker
- **Permission Controls**: Manager-only access to worker check permissions

#### QA Dashboard:
- **QA Button**: In Active Jobs dashboard and Job Monitor header
- **Detailed Reports**: Check sessions, discrepancies, corrections made
- **Time/User Tracking**: Who performed checks and when

### 4. Business Logic Requirements

#### Check Session Workflow:
1. User clicks "Check Count" button in box modal
2. System creates new check session
3. Full-screen interface opens with scanner active
4. User scans items, system tracks against original quantities
5. Real-time progress bars show check progress vs original
6. Handle discrepancies (shortages, excess items)
7. "Scan Complete" triggers discrepancy resolution
8. System logs all activities with timestamps

#### Visual Feedback System:
- **Green Tick**: Check quantity matches original exactly
- **Red Cross**: Discrepancies found (shortage/excess)
- **Orange "Extra"**: Items scanned beyond 100% of expected
- **Progress Bars**: Dual progress showing original vs check status

#### Box Visual Indicators:
- **Replace Lock Icon**: Use check status instead of completion lock
- **Check Tick**: Successfully verified boxes
- **Check Cross**: Boxes with discrepancies
- **No Icon**: Unchecked boxes

### 5. Permission & Role Management

#### Manager Permissions:
- Always can perform checks
- Manage worker check permissions in settings
- Access full QA reports
- View/edit all check sessions

#### Supervisor Permissions:  
- Always can perform checks
- View QA reports for assigned jobs
- Cannot modify worker permissions

#### Worker Permissions:
- Check permission controlled by manager setting
- Can only check boxes they have access to
- Limited to check operations (no corrections)

### 6. Integration Points

#### Existing System Preservation:
- **No Changes** to current scanning workflow
- **No Changes** to existing database records
- **No Changes** to current box completion logic
- **Additive Only**: All check functionality is supplementary

#### WebSocket Integration:
- Broadcast check events to supervisors/managers
- Real-time updates for check session progress
- Live QA dashboard updates

#### Error Handling:
- Validate check permissions before allowing access
- Handle scanner failures gracefully
- Prevent data corruption of original records

## Implementation Phases

### Phase 1: Database & API Foundation
1. Create new database tables (check_sessions, check_events, check_results)
2. Add checkBoxEnabled to userPreferences 
3. Implement core API endpoints
4. Create storage interface methods

### Phase 2: Basic Check Interface
1. Add "Check Count" button to BoxDetailsModal
2. Create full-screen check interface component
3. Implement barcode scanning for check mode
4. Basic progress tracking and visual feedback

### Phase 3: Discrepancy Management
1. Implement shortage/excess detection
2. Add correction workflow and UI
3. Result logging and session completion
4. Box visual indicator updates

### Phase 4: Settings & Permissions
1. Add worker check permission toggle in settings
2. Implement role-based access controls
3. Manager-only permission management UI

### Phase 5: QA Dashboard & Reporting
1. Add QA buttons to dashboards
2. Create comprehensive QA report interface
3. Session history and analytics
4. Time/user tracking displays

### Phase 6: Testing & Refinement
1. Integration testing with existing workflows
2. Performance optimization
3. Error handling and edge cases
4. User acceptance testing

## Success Criteria

### Functional Requirements:
- ✅ Managers/supervisors can always perform checks
- ✅ Workers can check when enabled by manager
- ✅ Full-screen check interface with dual progress bars
- ✅ Accurate discrepancy detection and logging
- ✅ Comprehensive QA reporting
- ✅ No disruption to existing workflows

### Technical Requirements:
- ✅ Zero breaking changes to current system
- ✅ Real-time updates via WebSocket
- ✅ Proper error handling and validation
- ✅ Performance maintained under load
- ✅ Mobile-responsive design

### Business Requirements:
- ✅ Improved quality assurance capabilities
- ✅ Detailed audit trail for compliance
- ✅ Manager control over worker permissions
- ✅ Integration with existing role-based access

## Risk Mitigation

### Technical Risks:
- **Database Performance**: Index new tables properly
- **UI Complexity**: Incremental development approach
- **Integration Issues**: Comprehensive testing at each phase

### Business Risks:
- **User Training**: Clear UI and documentation
- **Workflow Disruption**: Additive-only approach
- **Data Integrity**: Careful validation and testing

## Dependencies

### External Dependencies:
- Existing barcode scanner components
- Current WebSocket infrastructure
- Database migration capabilities

### Internal Dependencies:
- User authentication system
- Permission management framework
- Box requirement architecture

This PRD provides a comprehensive roadmap for implementing the CheckCount feature while preserving all existing system functionality and ensuring seamless integration with current workflows.