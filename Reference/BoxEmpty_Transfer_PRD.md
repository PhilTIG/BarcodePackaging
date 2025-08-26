
# Box Empty/Transfer System - Product Requirements Document

## Executive Summary

This PRD defines the comprehensive Box Empty/Transfer system that provides instant automatic actions: Empty Box removes current customer and automatically assigns next unallocated customer, Transfer Box moves customer to their designated CSV group and automatically assigns next unallocated customer. When no unallocated customers exist, boxes display "Empty" status as grey boxes with full history access. The system eliminates all manual workflows and provides seamless automatic operations with no confirmation dialogs.

## Business Objectives

- **Efficient Box Reuse**: Automatically reallocate emptied boxes to maximize box utilization
- **Group Management**: Enable transfer of completed boxes to group views for organized processing
- **Quality Control**: Provide history tracking for all box contents and transfers
- **Worker Flexibility**: Support "Put Aside" functionality for items requiring special handling
- **Seamless Operations**: Background processing with minimal workflow disruption

## User Personas

### Primary Users
- **Managers**: Full control over box limits, group transfers, and system configuration
- **Supervisors**: Box emptying, transfer operations, and worker oversight
- **Workers**: Basic box emptying (with permission) and put aside item handling

## Current System Analysis

### Existing Architecture
- **Box System**: Uses `boxRequirements` table with customer-to-box mapping
- **Group Support**: Already has `groupName` field in box requirements  
- **Worker Permissions**: Has `checkBoxEnabled` preference system for granular permissions
- **WebSocket**: Real-time updates for scanning operations
- **History Tracking**: Existing scan events and session management infrastructure

### Integration Points
- **Box Details Modal**: Add Empty/Transfer buttons for completed boxes
- **Manager Dashboard**: Add box limit configuration and monitoring
- **Worker Scanner**: Add put aside item notifications and handling
- **Group Views**: Display transferred boxes with full content history

## Detailed Requirements

### 1. Box Empty Functionality

#### 1.1 Empty Button Availability
- **Trigger**: Appears when box is 100% complete AND customer has no groupName from CSV
- **Permissions**: Controlled by `canEmptyAndTransfer` user preference
- **Context**: Available in Box Details Modal for completed boxes
- **Behavior**: Instant automatic empty operation with no confirmation dialogs
- **Exclusivity**: Never shown simultaneously with Transfer button

#### 1.2 Automatic Box Reallocation
- **Trigger**: When box is emptied and job has `boxNumber: NULL` customers (unallocated due to box limit)
- **Process**: Automatically assign next unallocated customer to that specific box number
- **Selection**: First unallocated customer (FIFO order from original CSV sequence)
- **Database Update**: Change `boxNumber` from `NULL` to the emptied box number for all products of that customer
- **Transition**: If unallocated customers exist: seamless assignment to new customer. If no unallocated customers: box shows "Empty" status
- **Notification**: Detailed notification format: "Box 5: Customer A emptied | Customer C assigned" or "Box 5: Customer A emptied | No customers available - Box Empty"
- **Worker Impact**: Workers skip NULL boxes and recalculate their sequence dynamically
- **Box Number Retention**: Emptied/transferred boxes retain their box number for history tracking

#### 1.3 Box History System
- **Scope**: Show all previous contents for the specific box number across the job
- **Access**: Available in Box Details Modal below main content
- **Detail Level**: Transfer summaries with timestamps and worker information
- **Clickable Details**: Expandable to show specific scan-by-scan history

### 2. Transfer to Group Functionality

#### 2.1 Transfer Button Logic
- **Availability**: When customer has groupName from CSV AND box is 100% complete
- **Action**: Instant automatic transfer to customer's existing CSV group (no manual selection)
- **API Logic**: Auto-detect customer's groupName from database, no targetGroup parameter required
- **Exclusivity**: Never shown simultaneously with Empty button
- **No Manual Selection**: Group assignment is automatic based on existing CSV data

#### 2.2 Group View Integration
- **Display**: Show transferred boxes with original box numbers preserved
- **Permanence**: Transferred boxes remain permanently in group view
- **Updates**: Static after transfer (no real-time scanning updates)
- **History**: Maintain complete transfer chain for audit purposes
- **Organization**: Group boxes by transfer date and original assignment
- **Archival**: All group/transfer data archived with job, purged when job is purged

### 3. Put Aside System

#### 3.1 Put Aside Logic Flow (CLARIFIED)
- **Trigger**: Individual scanned items that couldn't find a suitable box
- **Decision Logic**: 
  - IF unallocated customers (boxNumber=NULL) require this item → Create "Put Aside" entry
  - IF unallocated customers do NOT require this item → Send to "Extra Items" list
- **Storage**: Integrate with existing scan events table structure
- **Naming**: "Put Aside - <CustomName>" format for identification

#### 3.2 Put Aside Queue Management
- **Display**: List next to Extra Items icon with similar UI pattern
- **Status Indicator**: Red cross (no box) / Green tick (box available)
- **Worker Notification**: "Check Put Aside" message on worker screen
- **Item Details**: Show product name and availability status

#### 3.3 Put Aside Item Allocation
- **Process**: When put aside item scanned, allocate following worker's allocation pattern rules
- **Priority**: Put aside items are prioritized and taken from list first during allocation
- **Worker Instruction**: Manager directs worker to scan put aside items
- **Removal**: Auto-remove from put aside list once allocated
- **System Integration**: Use existing worker-based box allocation logic

### 4. Manager Configuration

#### 4.1 Box Limit Setting (FOUNDATION FEATURE)
- **Location**: Optional field in job creation/CSV upload form ("Max Boxes: [50]" or "No Limit")
- **Default**: "No Limit" - system creates boxes for all customers as before
- **Function**: Hard limit that stops creation of new boxes for customers beyond the limit
- **Processing Flow**: Build full customerToBoxMap, then modify boxRequirements creation to set `boxNumber: null` for excess customers
- **Warning Threshold**: Show warning if limit is less than 80% of total unique customers (e.g., 40 boxes for 50 customers)
- **Warning Timing**: After CSV is uploaded and we know total unique customers
- **Storage**: `box_limit INTEGER DEFAULT NULL` in jobs table
- **Unallocated Storage**: Customers beyond limit stored as `boxNumber: NULL` in `box_requirements`

#### 4.2 Manager Dashboard Integration
- **Location**: When manager clicks on a job with unallocated customers, show in job management area
- **Unallocated Customers Section**: New section showing customers with `boxNumber: NULL`
- **Customer Details**: Display each unallocated customer with their required products
- **Product Preview**: Similar to Box Details screen, showing BarCode, Product Name, Qty
- **Auto-Assignment Status**: Show when customers get automatically assigned to emptied boxes
- **Put Aside Count**: Show total count of items with available boxes (green tick)
- **Transfer Tracking**: Monitor group transfers and box reallocation
- **Worker Performance**: Track empty/transfer operations per worker
- **System Health**: Monitor automatic reallocation success rates

### 5. Concurrency Control

#### 5.1 Optimistic Locking Strategy
- **Method**: First-wins approach for concurrent operations
- **Scope**: Box emptying, transferring, and put aside allocation operations
- **Implementation**: Version-based conflict detection and resolution
- **User Experience**: Clear error messages when operations conflict

### 6. Worker Interface Enhancements

#### 6.1 Permission System
- **Granularity**: Combined "Empty/Transfer" permission (single toggle)
- **Scope**: No restrictions based on worker involvement in box
- **Job Status**: Available for any active or completed job
- **Role-based**: Managers and Supervisors have automatic access

#### 6.2 Worker Allocation Pattern Adaptation
- **Dynamic Recalculation**: Workers skip NULL boxes and recalculate their sequence dynamically
- **Real-time Updates**: When boxes get assigned from NULL to real customers, worker patterns adapt
- **Box Availability**: Workers see newly available boxes immediately in their allocation sequence

#### 6.3 Put Aside Notifications
- **Display**: Count of items with available boxes on worker screen
- **Interaction**: Click for details modal showing available items
- **Action**: Standard scanning process - direct worker to appropriate box
- **Updates**: Real-time updates as boxes become available

## Technical Implementation

### Database Schema Changes

#### New Tables
```sql
-- Box History Tracking
CREATE TABLE box_history (
  id UUID PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id),
  box_number INTEGER NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  action_type ENUM('empty', 'transfer', 'reallocate') NOT NULL,
  performed_by UUID NOT NULL REFERENCES users(id),
  transferred_to_group VARCHAR(255), -- NULL for empty/reallocate
  created_at TIMESTAMP DEFAULT NOW()
);

-- Put Aside Items
CREATE TABLE put_aside_items (
  id UUID PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id),
  bar_code VARCHAR(255) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  custom_name VARCHAR(255), -- "Put Aside - <CustomName>"
  box_available BOOLEAN DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  allocated_at TIMESTAMP, -- When item was allocated to a box
  allocated_to_box INTEGER -- Box number when allocated
);
```

#### Table Modifications
```sql
-- Add box limit to jobs
ALTER TABLE jobs ADD COLUMN box_limit INTEGER DEFAULT NULL;

-- Add box status tracking (CRITICAL: separate from isComplete)
ALTER TABLE box_requirements ADD COLUMN box_status VARCHAR(20) DEFAULT 'active';
-- Values: 'active', 'emptied', 'transferred_to_group'

-- Add empty/transfer permission (already exists as canEmptyAndTransfer)
-- ALTER TABLE user_preferences ADD COLUMN can_empty_and_transfer BOOLEAN DEFAULT FALSE;

-- Enhanced scan events for put aside
ALTER TABLE scan_events ADD COLUMN put_aside_item_id UUID REFERENCES put_aside_items(id);

-- Add version column for optimistic locking
ALTER TABLE box_requirements ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE put_aside_items ADD COLUMN version INTEGER DEFAULT 1;
```

### API Endpoints

#### Box Operations
- `POST /api/jobs/{jobId}/boxes/{boxNumber}/empty` - Empty a completed box (no reason parameter)
- `POST /api/jobs/{jobId}/boxes/{boxNumber}/transfer` - Transfer box to group (auto-detect groupName, no targetGroup parameter)
- `GET /api/jobs/{jobId}/boxes/{boxNumber}/history` - Get box history with customer timeline

#### Put Aside Management
- `POST /api/jobs/{jobId}/put-aside` - Create put aside item
- `GET /api/jobs/{jobId}/put-aside` - List put aside items
- `POST /api/jobs/{jobId}/put-aside/{itemId}/allocate` - Allocate item to box

#### Configuration
- `PUT /api/jobs/{jobId}/box-limit` - Set job box limit
- `GET /api/jobs/{jobId}/groups` - Get available groups for transfer

### WebSocket Events
```typescript
type BoxTransferEvents = 
  | { type: 'BOX_EMPTIED', data: { boxNumber: number, newCustomer?: string }}
  | { type: 'BOX_TRANSFERRED', data: { boxNumber: number, groupName: string }}
  | { type: 'PUT_ASIDE_UPDATED', data: { jobId: string, availableCount: number }}
  | { type: 'BOX_REALLOCATED', data: { boxNumber: number, oldCustomer: string, newCustomer: string }};
```

## User Experience Flows

### Manager Workflow
1. **Job Setup**: Upload CSV → Set Box Limit → Enable automatic reallocation
2. **Monitoring**: View put aside count → Monitor transfers → Review box history
3. **Group Management**: Review transferred boxes → Quality control checks

### Worker/Supervisor Workflow  
1. **Box Completion**: Scan final item → Box shows 100% complete
2. **Box Actions**: Click Box Details → See Empty OR Transfer button (never both)
3. **Empty Action**: Click Empty → Instant automatic reallocation → Detailed notification
4. **Transfer Action**: Click Transfer → Instant automatic transfer to CSV group → Detailed notification
5. **Empty Box Display**: Grey box with black circle, white number, "Empty" text, clickable for history

### Put Aside Item Lifecycle
1. **Creation**: Item needs box → No suitable box → "Put Aside" scan
2. **Waiting**: Item in queue → Red cross indicator → Waiting for box
3. **Available**: Box becomes free → Green tick indicator → Worker notification
4. **Allocation**: Worker scans item → Auto-allocate to box → Remove from queue

## Implementation Task List

### FOUNDATION PHASE: Box Limit Implementation (Week 1-2)

#### Database Schema Updates
- [ ] Add `box_limit INTEGER DEFAULT NULL` to jobs table
- [ ] Add `box_status VARCHAR(20) DEFAULT 'active'` to box_requirements table
- [ ] Test schema changes with existing data

#### CSV Processing Modifications  
- [ ] Update job creation form with optional "Box Limit" field
- [ ] Add warning when limit < 80% of unique customers
- [ ] Modify box assignment logic: build full customerToBoxMap, then set boxNumber=NULL for excess
- [ ] Test CSV processing with various limits

#### Storage Layer
- [ ] Add storage methods for retrieving unallocated customers (boxNumber=NULL)
- [ ] Add methods for box limit validation and warnings
- [ ] Update existing storage methods to handle NULL box numbers

#### Manager Dashboard Integration
- [ ] Create unallocated customers section in job management area
- [ ] Display customer details with required products
- [ ] Add real-time updates for unallocated customer status

#### Worker Allocation Updates
- [ ] Update worker patterns to skip NULL boxes dynamically
- [ ] Test allocation patterns with mixed NULL and assigned boxes
- [ ] Ensure workers can still follow their sequences effectively

This foundation enables the complete Empty/Transfer system in subsequent phases.

### FUTURE PHASE 2: Empty/Transfer API Development (Post-Foundation)
- [ ] Implement box empty endpoint with automatic reallocation
- [ ] Implement box transfer endpoint with group integration
- [ ] Create box history retrieval endpoint
- [ ] Implement put aside item creation and management
- [ ] Add box limit configuration endpoints
- [ ] Create group listing endpoint for transfers
- [ ] Add automatic box allocation algorithm with customerName priority queue
- [ ] Implement optimistic locking with version control
- [ ] Add conflict detection and resolution for concurrent operations
- [ ] Implement put aside priority allocation in worker allocation logic
- [ ] Implement WebSocket events for real-time updates
- [ ] Add permission checking middleware
- [ ] Create comprehensive error handling

### FUTURE PHASE 3: Empty/Transfer UI Components (Post-Foundation)
- [ ] Add Empty/Transfer buttons to Box Details Modal
- [ ] Create box history display component
- [ ] Implement put aside items modal component
- [ ] Add put aside notification component for workers
- [ ] Create box limit configuration in manager dashboard
- [ ] Add put aside count display for managers
- [ ] Implement group selection modal for transfers
- [ ] Add confirmation dialogs for empty/transfer actions
- [ ] Create loading states and success notifications
- [ ] Implement responsive design for mobile users

### FUTURE PHASE 4: Complete Dashboard Integration (Post-Foundation)
- [ ] Add box limit setting during CSV upload
- [ ] Create put aside monitoring panel
- [ ] Implement transfer tracking dashboard
- [ ] Add box reallocation status indicators
- [ ] Create group view with transferred boxes
- [ ] Add worker performance tracking for empty/transfer
- [ ] Implement real-time dashboard updates
- [ ] Add export functionality for transfer reports
- [ ] Create system health monitoring
- [ ] Add configuration management interface

### FUTURE PHASE 5: Complete Worker Interface (Post-Foundation)
- [ ] Add put aside item notifications to worker screen
- [ ] Implement clickable put aside details
- [ ] Create availability status indicators (red/green)
- [ ] Add empty/transfer permission controls
- [ ] Implement success/error feedback for actions
- [ ] Add mobile-optimized put aside interface
- [ ] Create worker guidance for put aside items
- [ ] Add confirmation prompts for destructive actions
- [ ] Implement offline handling for put aside operations
- [ ] Add accessibility features for action buttons

### FUTURE PHASE 6: Real-time System Integration (Post-Foundation)
- [ ] Implement WebSocket events for box operations
- [ ] Add real-time put aside count updates
- [ ] Create live transfer notifications
- [ ] Implement automatic reallocation notifications
- [ ] Add real-time group view updates
- [ ] Create worker notification system
- [ ] Implement conflict resolution for concurrent operations
- [ ] Add system performance monitoring
- [ ] Create real-time error handling
- [ ] Add connection recovery mechanisms

### FUTURE PHASE 7: History and Audit System (Post-Foundation)
- [ ] Implement comprehensive box history tracking
- [ ] Create audit trail for all empty/transfer operations
- [ ] Add worker attribution for all actions
- [ ] Implement timestamp tracking with timezone support
- [ ] Create history export functionality
- [ ] Add search and filter capabilities for history
- [ ] Implement data retention policies
- [ ] Create backup and recovery procedures
- [ ] Add compliance reporting features
- [ ] Implement data anonymization for sensitive information
- [ ] Create permanent group view storage architecture
- [ ] Implement group/transfer data archival with job archival
- [ ] Add group/transfer data purging when jobs are purged

### FUTURE PHASE 8: Complete System Testing (Post-Foundation)
- [ ] Unit tests for box allocation algorithms
- [ ] Integration tests for empty/transfer workflows
- [ ] API endpoint testing with various scenarios
- [ ] WebSocket communication testing
- [ ] Permission system testing
- [ ] Performance testing with high box counts
- [ ] Mobile interface testing on various devices
- [ ] Concurrent user testing
- [ ] Optimistic locking conflict resolution testing
- [ ] Race condition testing for box allocation
- [ ] Error handling and edge case testing
- [ ] User acceptance testing with warehouse workers

### FUTURE PHASE 9: Documentation and Training (Post-Foundation)
- [ ] Create user documentation for empty/transfer features
- [ ] Write technical documentation for API endpoints
- [ ] Create training materials for workers
- [ ] Document configuration procedures for managers
- [ ] Create troubleshooting guides
- [ ] Write system administration documentation
- [ ] Create video tutorials for complex workflows
- [ ] Document security and permission requirements
- [ ] Create backup and recovery procedures
- [ ] Write performance optimization guidelines

### FUTURE PHASE 10: Full System Deployment (Post-Foundation)
- [ ] Set up production database migrations
- [ ] Configure monitoring and alerting systems
- [ ] Implement feature flags for gradual rollout
- [ ] Create deployment scripts and procedures
- [ ] Set up performance monitoring dashboards
- [ ] Configure backup and disaster recovery
- [ ] Implement security scanning and compliance checks
- [ ] Create rollback procedures for emergency situations
- [ ] Set up user feedback collection systems
- [ ] Monitor system performance and user adoption

## Success Metrics

### Operational Efficiency
- **Box Reallocation Speed**: < 5 seconds for automatic reassignment
- **Transfer Processing**: < 2 seconds for group transfers
- **Put Aside Resolution**: Average time from creation to allocation
- **System Uptime**: 99.9% availability during working hours

### User Experience
- **Worker Satisfaction**: Survey scores for empty/transfer ease of use
- **Error Reduction**: Decrease in misplaced items and allocation errors
- **Training Time**: Reduction in time needed to train new workers
- **Mobile Usage**: Adoption rate of mobile interface for operations

### Business Impact
- **Box Utilization**: Improvement in box reuse efficiency
- **Warehouse Productivity**: Overall scanning speed and accuracy
- **Quality Control**: Reduction in quality issues through better tracking
- **Operational Cost**: Savings from improved efficiency and reduced errors

## Risk Assessment and Mitigation

### Technical Risks
- **Database Performance**: Risk of slow queries with large box history
  - *Mitigation*: Proper indexing and archival strategies
- **WebSocket Reliability**: Connection issues affecting real-time updates
  - *Mitigation*: Fallback polling and connection recovery
- **Concurrent Operations**: Race conditions in box allocation
  - *Mitigation*: Database locks and atomic operations

### User Experience Risks
- **Complex Workflows**: Risk of confusing workers with new processes
  - *Mitigation*: Gradual rollout and comprehensive training
- **Permission Confusion**: Workers unsure of their access levels
  - *Mitigation*: Clear UI indicators and role-based guidance
- **Mobile Performance**: Slow performance on warehouse devices
  - *Mitigation*: Performance testing and optimization

### Business Risks
- **Operational Disruption**: New system interfering with existing workflows
  - *Mitigation*: Feature flags and rollback capabilities
- **Data Loss**: Risk of losing historical tracking information
  - *Mitigation*: Comprehensive backup and audit procedures
- **Adoption Resistance**: Workers preferring old manual processes
  - *Mitigation*: Change management and clear benefit communication

This PRD provides a comprehensive roadmap for implementing the Box Empty/Transfer system while ensuring seamless integration with existing warehouse operations and maintaining high standards for reliability and user experience.
