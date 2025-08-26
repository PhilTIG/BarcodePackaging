
# Box Empty/Transfer System - Product Requirements Document

## Executive Summary

This document outlines the implementation of Box Empty and Transfer functionality for completed (100%) boxes in the warehouse scanning system. The system will support two modes: **Empty** (when no groups exist) and **Transfer** (when groups are defined), with automatic box reallocation and comprehensive history tracking.

## Core Functionality Overview

### 1. Box Empty/Transfer Modes
- **Empty Mode**: When CSV has no Group data - boxes are simply emptied and reallocated
- **Transfer Mode**: When CSV has Group data - box contents are transferred to group view

### 2. Automatic Box Reallocation
- When box is emptied/transferred, system automatically assigns next unallocated customer
- No intermediate "empty" status - seamless transition to new customer assignment
- Reallocation based on CSV order (first appearance principle)

### 3. Box Limit Concept
- Job-level setting during CSV upload
- Controls maximum number of concurrent boxes in use
- Triggers automatic reallocation when limit reached

## Technical Architecture Analysis

### Current System Compatibility
✅ **Existing Infrastructure Ready:**
- `boxRequirements` table supports `groupName` field
- `jobs` table can accommodate `boxLimit` field  
- `userPreferences` table supports worker permissions
- WebSocket system handles real-time updates
- Box history can leverage existing scan events structure

### Required Database Changes
```sql
-- Add box limit to jobs table
ALTER TABLE jobs ADD COLUMN boxLimit integer;

-- Create box history tracking table
CREATE TABLE box_transfers (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  jobId varchar NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  boxNumber integer NOT NULL,
  previousCustomerName text NOT NULL,
  newCustomerName text,
  transferType text NOT NULL, -- 'empty', 'transfer_to_group'
  groupName text,
  transferredBy varchar NOT NULL REFERENCES users(id),
  transferredAt timestamp DEFAULT now(),
  boxContentsSnapshot jsonb -- Complete box state at transfer
);

-- Create put aside items tracking
CREATE TABLE put_aside_items (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  jobId varchar NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  barCode text NOT NULL,
  productName text NOT NULL,
  customerName text NOT NULL,
  putAsideBy varchar NOT NULL REFERENCES users(id),
  putAsideAt timestamp DEFAULT now(),
  isBoxAvailable boolean DEFAULT false,
  assignedToBox integer,
  resolvedAt timestamp
);
```

## Detailed Feature Specifications

### Feature 1: Box Action Interface

**Box Details Modal Enhancement:**
- Add "Empty" button when no groups exist in job
- Add "Transfer" button when groups exist in job
- Button visibility based on:
  - Box completion status (100%)
  - User permissions (`canEmptyBoxes` OR manager/supervisor role)
  - Job active status (not paused)

**Action Confirmation:**
- Confirmation dialog showing box contents summary
- Transfer destination (group name) display
- Warning about irreversible action

### Feature 2: Automatic Box Reallocation Logic

**Reallocation Algorithm:**
```typescript
function reallocateBox(jobId: string, boxNumber: number): string | null {
  // Get all customers in CSV order
  const csvCustomers = getJobCustomersInOrder(jobId);
  
  // Get currently allocated customers
  const allocatedCustomers = getCurrentlyAllocatedCustomers(jobId);
  
  // Find first unallocated customer
  const nextCustomer = csvCustomers.find(customer => 
    !allocatedCustomers.includes(customer)
  );
  
  if (nextCustomer) {
    // Update box requirements for new customer
    updateBoxRequirementsForCustomer(jobId, boxNumber, nextCustomer);
    return nextCustomer;
  }
  
  return null; // No more customers to allocate
}
```

### Feature 3: Put Aside System

**"Put Aside" Scan Event:**
- New scan event type: `put_aside`
- Creates entry in `put_aside_items` table
- Special handling for items without current box allocation

**Put Aside Queue Interface:**
- New icon next to Extra Items in manager dashboard
- Real-time box availability indicator (Green ✓ / Red ✗)
- "Check Put Aside" notification system for workers
- Integration with single box view

**Box Availability Detection:**
```typescript
function updatePutAsideAvailability(jobId: string) {
  const putAsideItems = getPutAsideItems(jobId);
  
  putAsideItems.forEach(item => {
    const availableBox = findAvailableBoxForCustomer(jobId, item.customerName);
    updatePutAsideItem(item.id, { 
      isBoxAvailable: !!availableBox,
      assignedToBox: availableBox?.boxNumber 
    });
  });
}
```

### Feature 4: Group Transfer System

**Group View Enhancement:**
- Maintain original box numbers in group display
- Show multiple transfers per box number over time
- Real-time updates via WebSocket
- Transfer history per group

**Transfer Tracking:**
```typescript
interface BoxTransfer {
  boxNumber: number;
  previousCustomerName: string;
  newCustomerName: string | null;
  transferType: 'empty' | 'transfer_to_group';
  groupName?: string;
  transferredAt: Date;
  boxContentsSnapshot: BoxContents[];
}
```

### Feature 5: Box History System

**History Interface:**
- "View History" section in box details modal
- Shows all previous contents for the box number
- Each history entry displays:
  - Customer name and transfer timestamp
  - Complete contents at time of transfer
  - "Check Count" button for historical verification

**Historical Check Count:**
- Allow scanning historical box contents
- Same CheckCount interface as current boxes
- Results stored separately with historical context

### Feature 6: Box Limit Configuration

**CSV Upload Enhancement:**
- Add "Box Limit" field to job creation form
- Optional setting (default: unlimited)
- Validation: Must be ≤ total unique customers

**Limit Enforcement:**
```typescript
function checkBoxLimit(jobId: string): boolean {
  const job = getJob(jobId);
  if (!job.boxLimit) return true;
  
  const activeBoxes = getActiveBoxCount(jobId);
  return activeBoxes < job.boxLimit;
}
```

### Feature 7: Group Allocation Monitor

**Manager Dashboard Enhancement:**
- "Group Allocation" button in supervisor controls
- Shows percentage: `(Allocated CustomerNames / Total CustomerNames) * 100`
- Real-time updates as transfers occur
- Breakdown by group name

## Implementation Task List

### ✅ Phase 1: Database Foundation
- [ ] **Task 1.1**: Add `boxLimit` field to jobs table
- [ ] **Task 1.2**: Create `box_transfers` table with proper relations
- [ ] **Task 1.3**: Create `put_aside_items` table
- [ ] **Task 1.4**: Add database indexes for performance
- [ ] **Task 1.5**: Create storage interface methods for new tables

### ✅ Phase 2: Core Reallocation Logic
- [ ] **Task 2.1**: Implement automatic box reallocation algorithm
- [ ] **Task 2.2**: Create box transfer service with snapshot capture
- [ ] **Task 2.3**: Add box limit validation and enforcement
- [ ] **Task 2.4**: Implement put aside item tracking
- [ ] **Task 2.5**: Create box availability detection system

### ✅ Phase 3: UI Components - Box Actions
- [ ] **Task 3.1**: Enhance box details modal with Empty/Transfer buttons
- [ ] **Task 3.2**: Create transfer confirmation dialog
- [ ] **Task 3.3**: Add permission checking logic
- [ ] **Task 3.4**: Implement action feedback and error handling
- [ ] **Task 3.5**: Add loading states and optimistic updates

### ✅ Phase 4: UI Components - History System
- [ ] **Task 4.1**: Create box history interface in modal
- [ ] **Task 4.2**: Design historical contents display
- [ ] **Task 4.3**: Implement historical CheckCount functionality
- [ ] **Task 4.4**: Add "Back to Current" navigation
- [ ] **Task 4.5**: Style history timeline with timestamps

### ✅ Phase 5: Put Aside System
- [ ] **Task 5.1**: Create put aside queue icon and interface
- [ ] **Task 5.2**: Implement put aside scan event handling
- [ ] **Task 5.3**: Add worker notification system for put aside items
- [ ] **Task 5.4**: Create box availability indicators
- [ ] **Task 5.5**: Integration with single box view

### ✅ Phase 6: Group Transfer Features
- [ ] **Task 6.1**: Enhance group view to show original box numbers
- [ ] **Task 6.2**: Implement multi-transfer tracking per box
- [ ] **Task 6.3**: Add real-time WebSocket updates for groups
- [ ] **Task 6.4**: Create group allocation percentage monitor
- [ ] **Task 6.5**: Add "Group Allocation" button to manager dashboard

### ✅ Phase 7: CSV Upload Integration
- [ ] **Task 7.1**: Add box limit field to job creation form
- [ ] **Task 7.2**: Implement validation for box limit setting
- [ ] **Task 7.3**: Update job creation API to handle box limits
- [ ] **Task 7.4**: Add box limit display in job management

### ✅ Phase 8: WebSocket & Real-time Updates
- [ ] **Task 8.1**: Add WebSocket events for box transfers
- [ ] **Task 8.2**: Implement real-time put aside notifications
- [ ] **Task 8.3**: Add group allocation percentage broadcasts
- [ ] **Task 8.4**: Update box highlighting for reallocated boxes
- [ ] **Task 8.5**: Add transfer history real-time updates

### ✅ Phase 9: API Endpoints
- [ ] **Task 9.1**: `POST /api/boxes/:id/empty` - Empty box endpoint
- [ ] **Task 9.2**: `POST /api/boxes/:id/transfer` - Transfer to group endpoint  
- [ ] **Task 9.3**: `GET /api/jobs/:id/box-history/:boxNumber` - Box history
- [ ] **Task 9.4**: `GET /api/jobs/:id/put-aside` - Put aside items
- [ ] **Task 9.5**: `POST /api/put-aside/:id/resolve` - Resolve put aside item
- [ ] **Task 9.6**: `GET /api/jobs/:id/group-allocation` - Group allocation stats

### ✅ Phase 10: Testing & Validation
- [ ] **Task 10.1**: Unit tests for reallocation algorithm
- [ ] **Task 10.2**: Integration tests for transfer workflows
- [ ] **Task 10.3**: WebSocket message validation tests
- [ ] **Task 10.4**: Box limit enforcement testing
- [ ] **Task 10.5**: Historical data consistency validation

## UX Flow Documentation

### Manager Workflow
1. **Job Setup**: Set box limit during CSV upload
2. **Monitor Progress**: Watch group allocation percentage
3. **View Transfers**: Access transfer history and analytics
4. **Handle Put Aside**: Monitor put aside queue and availability

### Worker Workflow  
1. **Complete Box**: Reach 100% on assigned box
2. **Initiate Action**: Click Empty/Transfer button in box details
3. **Confirm Action**: Review contents and confirm transfer
4. **Continue Work**: Automatic assignment to next customer
5. **Handle Put Aside**: Receive notifications for available items

### System Workflow
1. **Box Completion**: System detects 100% completion
2. **Action Trigger**: Worker initiates empty/transfer
3. **Snapshot Capture**: System saves complete box state
4. **Transfer Execution**: Move contents to group or mark empty
5. **Automatic Reallocation**: Assign next customer to box number
6. **Real-time Updates**: Broadcast changes to all clients

## Risk Assessment & Mitigation

### High Risk Areas
1. **Data Consistency**: Box contents during transfer
   - *Mitigation*: Atomic transactions with snapshots
2. **Reallocation Logic**: Customer assignment accuracy  
   - *Mitigation*: Comprehensive unit testing
3. **WebSocket Reliability**: Real-time update delivery
   - *Mitigation*: Fallback polling and retry mechanisms

### Medium Risk Areas
1. **Performance**: Large job transfer operations
   - *Mitigation*: Batch processing and progress indicators
2. **User Experience**: Complex workflows
   - *Mitigation*: Clear feedback and confirmation dialogs

## Success Metrics

### Functional Metrics
- ✅ Box reallocation completes within 2 seconds
- ✅ Transfer history accurately preserved
- ✅ Put aside items correctly tracked
- ✅ Group allocation percentages real-time accurate

### User Experience Metrics  
- ✅ Clear action feedback for all operations
- ✅ Intuitive navigation between current/historical views
- ✅ Responsive interface during transfer operations

## Future Considerations

### Scalability Enhancements
- Batch transfer operations for multiple boxes
- Advanced reallocation strategies (priority-based)
- Historical data archiving for performance

### Feature Extensions
- Transfer between specific groups
- Conditional reallocation rules
- Advanced put aside resolution workflows

---

**Note**: This implementation maintains full compatibility with existing CheckCount, WebSocket, and box requirement systems. All changes are additive and preserve current functionality.
