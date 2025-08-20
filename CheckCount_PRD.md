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
- **Layout**: Dedicated page route `/check-count/:jobId/:boxNumber` with barcode scanner at top
- **Product Grid**: Same as box modal but with dual progress bars
- **Progress Bars**: 
  - Original progress bar (existing scanned vs required)
  - Check progress bar (check scanned progress: `min(checkScannedQty, requiredQty) / requiredQty`)
  - Color coding: Green when match, Blue for recovered items, Orange for extra items, Red for shortages
- **Completion Actions**: "Scan Complete" button with intelligent discrepancy handling

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
2. System creates new check session and navigates to dedicated CheckCount page
3. Full-screen interface opens with scanner active at `/check-count/:jobId/:boxNumber`
4. User scans items, system tracks against required quantities with intelligent allocation
5. Real-time progress bars show check progress with smart allocation logic
6. Handle discrepancies with enhanced allocation: items within required_qty go to box, excess becomes extras
7. "Scan Complete" triggers intelligent discrepancy resolution with correction dialogs
8. System logs all activities with timestamps and broadcasts real-time updates via WebSocket

#### Visual Feedback System:
- **Green Tick**: Check quantity matches required exactly
- **Red Cross**: Discrepancies found (shortage/excess)
- **Blue Badge**: "Recovered Items" - items found within required quantity during CheckCount
- **Orange Badge**: "Extra Items" - items scanned beyond required quantity
- **Progress Bars**: Dual progress showing original vs intelligent check allocation

#### Box Visual Indicators:
- **Keep Lock Icons**: Maintain existing lock icons for 100% completion status
- **Add Check Status**: Additional check status indicators under box numbers
- **Green Check Tick**: Successfully verified boxes (no discrepancies OR corrections applied)
- **Red Cross**: Boxes with discrepancies that were rejected (not corrected)
- **No Check Icon**: Unchecked boxes (normal lock behavior preserved)

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
- [x] Broadcast `check_count_update` events to all monitoring interfaces
- [x] Real-time updates for check session progress and corrections
- [x] Live dashboard updates with job progress invalidation

#### Error Handling:
- [x] Validate check permissions before allowing access (role-based + checkBoxEnabled)
- [x] Handle scanner failures gracefully with manual input fallback
- [x] Prevent data corruption with intelligent allocation logic preserving original records

#### Enhanced Features (Implemented):
- **Intelligent Allocation Logic**: Items within required_qty allocate to box, only excess becomes extras
- **Visual Feedback Enhancement**: Blue for recovered items, orange for extras, color-coded progress bars
- **Real-time WebSocket Updates**: All monitoring interfaces receive instant CheckCount corrections
- **Extra Items Integration**: Reuses existing scan events infrastructure with isExtraItem tracking

## Implementation Timeline

### Phase 1: Database Foundation ✅ COMPLETE
- [x] Database schema design and implementation (check_sessions, check_events, check_results)
- [x] Storage interface methods (12 new CheckCount methods)
- [x] API endpoints with role-based permissions (10 new endpoints)
- [x] User preferences extension (checkBoxEnabled field)

### Phase 2: UI Components Implementation

#### Sub-Task 2.1: Visual Icon System
- [x] Keep existing lock icons for completion status AND add separate check status indicators
- [x] Update box grid visual states to show CheckCount status under box numbers
- [x] Ensure proper icon rendering across all themes (green check/red cross indicators)

#### Sub-Task 2.2: Box Modal CheckCount Button ✅ COMPLETE
- [x] Add "Check Count" button to box-details-modal.tsx
- [x] Style button with user's theme color background
- [x] Implement click handler to launch full-screen CheckCount interface
- [x] Add permission checking (only show if checkBoxEnabled or manager/supervisor)

#### Sub-Task 2.3: Full-Screen CheckCount Interface ✅ COMPLETE
- [x] Create dedicated CheckCount page at `/check-count/:jobId/:boxNumber` (enhanced from modal approach)
- [x] Implement barcode scanner integration (camera + HID support)
- [x] Add manual barcode input field as fallback
- [x] Create CheckCount session management (start/pause/complete)

#### Sub-Task 2.4: Dual Progress Bar System ✅ COMPLETE
- [x] Extend product containers with second "Check Count" progress bar
- [x] Implement intelligent percentage calculation: `min(checkScannedQty, requiredQty) / requiredQty`
- [x] Enhanced color coding: Blue for recovered items, Orange for extras, Green for matches, Red for shortages
- [x] Add status icons when product container CheckCount shows discrepancies or matches

#### Sub-Task 2.5: Error Handling & Corrections ✅ COMPLETE
- [x] Implement intelligent overage detection with enhanced allocation logic
- [x] Add "Scan Complete" button with comprehensive discrepancy handling
- [x] Create correction dialog with detailed discrepancy analysis and correction options
- [x] Update box quantities based on intelligent CheckCount corrections with real-time WebSocket updates

#### Sub-Task 2.6: Manager Controls ✅ COMPLETE
- [x] Add checkBoxEnabled toggle to user management screens
- [x] Implement worker permission management UI
- [?] Add bulk permission controls for multiple workers

#### Sub-Task 2.7: Supervisor Access & Reporting
- [x] Extend supervisor role permissions for CheckCount functionality
- [x] Add CheckCount reports to supervisor dashboard (via existing job progress views)
- [?] Implement dedicated QA analytics views for supervisors

#### Sub-Task 2.8: Integration & Testing ✅ COMPLETE
- [x] WebSocket integration for real-time CheckCount updates (`check_count_update` messages)
- [x] Mobile responsiveness testing
- [x] End-to-end workflow testing
- [x] Performance optimization with React Query caching and intelligent allocation

### Phase 3: Advanced Features (Future)
- [?] Dedicated QA Dashboard enhancements (beyond existing job progress views)
- [?] Advanced reporting and analytics (CheckCount-specific reports)
- [x] Performance optimizations (completed with intelligent allocation and WebSocket updates)
- [?] User training materials

## Success Criteria

### Functional Requirements:
- [x] Managers/supervisors can always perform checks
- [x] Workers can check when enabled by manager via checkBoxEnabled preference
- [x] Full-screen check interface with intelligent dual progress bars
- [x] Enhanced discrepancy detection with smart allocation logic
- [x] Comprehensive QA reporting via existing job progress endpoints
- [x] No disruption to existing workflows (additive-only approach)

### Technical Requirements:
- [x] Zero breaking changes to current system
- [x] Real-time updates via WebSocket (`check_count_update` messages)
- [x] Proper error handling and validation with correction dialogs
- [x] Performance maintained under load with React Query optimization
- [x] Mobile-responsive design with dedicated CheckCount page

### Business Requirements:
- [x] Improved quality assurance capabilities with intelligent item allocation
- [x] Detailed audit trail for compliance (check_sessions, check_events, check_results tables)
- [x] Manager control over worker permissions (checkBoxEnabled in user management)
- [x] Integration with existing role-based access control system

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