# Warehouse Scanner Implementation Task List v3.0

## Overview
Complete task breakdown for implementing POC-compliant multi-worker warehouse scanning system with proper box allocation and worker coordination.

---

## Phase 1: Critical Database Schema Fixes (Week 1-2)

### 1.1 Fix POC Box Assignment Logic
- [ ] **Task 1.1.1**: Update CSV processing in `server/routes.ts` to assign customers to boxes by first appearance order
  - Current: `Math.floor(index / 8) + 1` (incorrect)
  - Required: Track customer first appearance and assign sequential box numbers
  - Files: `server/routes.ts` (line 323)

- [ ] **Task 1.1.2**: Create database migration script to fix existing incorrect box assignments
  - Recalculate box numbers for all existing jobs based on customer first appearance
  - Backup existing data before migration
  - Files: New migration script, `server/storage.ts`

- [ ] **Task 1.1.3**: Test box assignment with POC CSV data
  - Verify customers get boxes 1, 2, 3... in order of first CSV appearance
  - Test with sample CSV: "Charlie, Alice, Charlie, Bob" should assign Charlie=1, Alice=2, Bob=3
  - Files: Test files, validation scripts

### 1.2 Add Missing Schema Fields
- [ ] **Task 1.2.1**: Add worker tracking fields to products table
  ```sql
  ALTER TABLE products ADD COLUMN lastWorkerUserId varchar REFERENCES users(id);
  ALTER TABLE products ADD COLUMN lastWorkerColor text;
  ```
  - Files: `shared/schema.ts`, migration script

- [ ] **Task 1.2.2**: Add worker color tracking to scan_events table
  ```sql
  ALTER TABLE scan_events ADD COLUMN workerColor text;
  ```
  - Files: `shared/schema.ts`, migration script

- [ ] **Task 1.2.3**: Update storage interface for new fields
  - Add methods to track last worker per box
  - Update scan processing to record worker colors
  - Files: `server/storage.ts`, interface definitions

### 1.3 Multi-Worker Assignment System
- [ ] **Task 1.3.1**: Implement worker allocation pattern algorithm
  - Worker 1: Ascending (1, 2, 3, 4...)
  - Worker 2: Descending (100, 99, 98, 97...)
  - Worker 3: Middle up (50, 51, 52, 53...)
  - Worker 4: Middle down (49, 48, 47, 46...)
  - Files: New utility file `lib/worker-allocation.ts`

- [ ] **Task 1.3.2**: Update scan processing to follow worker patterns
  - When worker scans item, find next available quantity following their pattern
  - Prevent workers from scanning out of their assigned pattern
  - Files: `server/storage.ts`, scan processing logic

- [ ] **Task 1.3.3**: Create worker assignment management interface
  - Manager can assign workers to jobs with colors
  - Automatic pattern assignment (1st=ascending, 2nd=descending, etc.)
  - Files: `client/src/pages/manager-dashboard.tsx`, assignment UI

---

## Phase 2: Box Highlighting System (Week 3)

### 2.1 POC-Style Single Box Highlighting
- [x] **Task 2.1.1**: Track last scanned box globally (not per worker)
  - Add `lastScannedBoxNumber` state management
  - Ensure only ONE box highlighted at a time across all workers
  - Files: `client/src/pages/worker-scanner.tsx`, state management

- [x] **Task 2.1.2**: Implement GREEN highlighting for just-scanned box
  - Green background and border for most recently scanned box
  - Green persists until next scan by any worker
  - Files: `client/src/components/customer-box-grid.tsx`

- [x] **Task 2.1.3**: Remove blue "active" highlighting logic
  - Remove `isActive` concept from box highlighting
  - Remove blue highlighting for multiple boxes
  - Files: `client/src/components/customer-box-grid.tsx`

### 2.2 Worker Color System
- [x] **Task 2.2.1**: Track last worker to scan into each box
  - Update products table when worker scans item
  - Store worker color and user ID per box
  - Files: Database update logic, `server/storage.ts`

- [x] **Task 2.2.2**: Display worker color for boxes with items
  - Show worker's assigned color if box has items (not empty)
  - Worker color has lower priority than green/grey-red
  - Files: `client/src/components/customer-box-grid.tsx`

- [x] **Task 2.2.3**: Handle color priority system
  - Priority: GREEN (just-scanned) > Grey-Red (complete) > Worker Color > Grey (empty)
  - Ensure proper color cascading logic
  - Files: `client/src/components/customer-box-grid.tsx`

### 2.3 Completed Box Styling
- [x] **Task 2.3.1**: Grey-red background for 100% complete boxes
  - Update completed box styling to grey-red instead of green
  - Ensure good contrast for readability
  - Files: `client/src/components/customer-box-grid.tsx`

- [x] **Task 2.3.2**: White text and white lock icon for completed boxes
  - Change lock icon color to white for visibility
  - Update text color to white for contrast
  - Files: `client/src/components/customer-box-grid.tsx`

- [x] **Task 2.3.3**: Remove green highlighting for completed boxes
  - Completed boxes should never show green highlighting
  - Grey-red takes priority over just-scanned green
  - Files: Box highlighting logic

---

## Phase 3: Multi-Worker Coordination (Week 4-5)

### 3.1 Worker Assignment Interface
- [x] **Task 3.1.1**: Manager interface for worker-job assignment
  - Assign up to 4 workers per job
  - Each worker gets assigned color and allocation pattern
  - Visual interface showing worker assignments
  - Files: `client/src/pages/manager-dashboard.tsx`

- [x] **Task 3.1.2**: Automatic allocation pattern assignment
  - 1st worker: Ascending pattern
  - 2nd worker: Descending pattern
  - 3rd worker: Middle up pattern
  - 4th worker: Middle down pattern
  - Files: Assignment logic, `server/storage.ts`

- [x] **Task 3.1.3**: Display worker allocation pattern in UI
  - Show each worker their assigned pattern (ascending/descending/etc.)
  - Display current box or next box in pattern
  - Files: `client/src/pages/worker-scanner.tsx`, UI components

### 3.2 Real-Time Worker Coordination
- [ ] **Task 3.2.1**: WebSocket updates for multi-worker scanning
  - Broadcast scan events to all workers on same job
  - Update box highlighting across all worker sessions
  - Files: WebSocket handling, `server/websocket.ts`

- [ ] **Task 3.2.2**: Prevent conflicts when multiple workers scan simultaneously
  - Handle race conditions for same barcode/customer
  - Ensure proper allocation to correct worker pattern
  - Files: Scan processing logic, conflict resolution

- [ ] **Task 3.2.3**: Show real-time worker activity in supervisor view
  - Display which worker is scanning which box
  - Show worker performance and current activity
  - Files: `client/src/pages/supervisor-view.tsx`

### 3.3 Worker Pattern Enforcement
- [ ] **Task 3.3.1**: Validate worker scans follow their assigned pattern
  - Check if scanned item should go to worker's next box in pattern
  - Display errors if worker tries to scan out-of-pattern item
  - Files: Validation logic, error handling

- [ ] **Task 3.3.2**: Handle "no available boxes" for worker pattern
  - When worker reaches end of their allocation pattern
  - Graceful handling and appropriate error messages
  - Files: Pattern algorithm, error handling

- [ ] **Task 3.3.3**: Worker pattern switching and reassignment
  - Allow managers to reassign worker patterns mid-job
  - Handle worker removal/addition during active job
  - Files: Assignment management, job coordination

---

## Phase 4: Mobile Interface Enhancements (Week 6)

### 4.1 Single Box Mode Updates
- [ ] **Task 4.1.1**: Update mobile interface for worker allocation patterns
  - Show worker's next assigned box based on their pattern
  - Mobile interface follows worker-specific allocation order
  - Files: `client/src/components/mobile-scanner-interface.tsx`

- [ ] **Task 4.1.2**: Worker switching between assigned boxes
  - Mobile navigation to move between worker's assigned boxes
  - Respect allocation pattern when switching
  - Files: Mobile navigation, pattern integration

- [ ] **Task 4.1.3**: Mobile worker identification
  - Clear display of worker's assigned color and pattern
  - Visual indicators for worker's current position in allocation
  - Files: Mobile UI components, worker identification

### 4.2 Mobile Multi-Worker Features
- [ ] **Task 4.2.1**: Real-time updates in mobile view
  - Mobile interface receives WebSocket updates from other workers
  - Box highlighting updates immediately when others scan
  - Files: Mobile WebSocket integration

- [ ] **Task 4.2.2**: Mobile error handling for multi-worker scenarios
  - Handle conflicts when multiple workers scan same item
  - Clear error messages for allocation pattern violations
  - Files: Mobile error handling, user feedback

---

## Phase 5: Performance and Testing (Week 7-8)

### 5.1 Performance Optimization
- [ ] **Task 5.1.1**: Optimize box calculation queries for large jobs
  - Efficient queries for 1000+ product jobs
  - Indexing for customer name and box number lookups
  - Files: Database optimization, query tuning

- [ ] **Task 5.1.2**: Cache worker allocation patterns
  - Cache allocation calculations to avoid repeated computation
  - Invalidate cache when worker assignments change
  - Files: Caching layer, performance optimization

- [ ] **Task 5.1.3**: Efficient real-time updates
  - Optimize WebSocket message size and frequency
  - Batch updates where possible to reduce network traffic
  - Files: WebSocket optimization, update batching

### 5.2 Testing and Validation
- [ ] **Task 5.2.1**: Multi-worker testing scenarios
  - Test 4 workers simultaneously on same job
  - Validate allocation patterns work correctly
  - Test conflict resolution and error handling
  - Files: Test scenarios, validation scripts

- [ ] **Task 5.2.2**: POC compliance validation
  - Compare behavior with original HTML POC
  - Verify box assignment matches POC exactly
  - Test scanning flow matches POC behavior
  - Files: Compliance tests, POC comparison

- [ ] **Task 5.2.3**: Load testing with large datasets
  - Test with 1000+ product CSV files
  - Validate performance with 100+ boxes
  - Test multiple concurrent worker sessions
  - Files: Load testing scripts, performance monitoring

### 5.3 Error Handling and Edge Cases
- [ ] **Task 5.3.1**: Handle worker disconnection during scanning
  - Graceful handling when worker loses connection
  - Resume scanning when worker reconnects
  - Files: Connection handling, state recovery

- [ ] **Task 5.3.2**: Database consistency checks
  - Validate box assignments remain consistent
  - Handle data corruption scenarios
  - Files: Data validation, consistency checks

- [ ] **Task 5.3.3**: Manager override capabilities
  - Allow managers to override allocation patterns if needed
  - Manual box assignment for special cases
  - Files: Manager override interface, manual controls

---

## Implementation Dependencies

### Critical Path Items
1. **Phase 1.1** (Box Assignment Fix) → All other phases depend on this
2. **Phase 1.2** (Schema Updates) → Required for worker tracking
3. **Phase 2** (Box Highlighting) → Required for user interface
4. **Phase 3** (Multi-Worker) → Core feature implementation

### Parallel Development Opportunities
- Mobile interface updates can be developed parallel to desktop features
- Performance optimization can happen parallel to feature development
- Testing can begin as soon as Phase 1 is complete

### Risk Mitigation
- **Database Migration Risk**: Test thoroughly with production-like data
- **Performance Risk**: Implement monitoring and rollback capabilities
- **Complexity Risk**: Implement incrementally with feature flags

---

## Success Metrics

### Functional Requirements
- [ ] Box assignment exactly matches POC behavior
- [ ] 4 workers can work simultaneously without conflicts
- [ ] Box highlighting follows priority system correctly
- [ ] Real-time updates work across all worker sessions

### Performance Requirements
- [ ] System handles 1000+ product jobs
- [ ] Real-time updates have <500ms latency
- [ ] No memory leaks with extended multi-worker sessions
- [ ] Database queries complete in <100ms for box calculations

### User Experience Requirements
- [ ] Intuitive worker assignment interface for managers
- [ ] Clear visual feedback for worker allocation patterns
- [ ] Error messages are clear and actionable
- [ ] Mobile interface works seamlessly with multi-worker features

---

**Document Version**: 3.0  
**Last Updated**: January 15, 2025  
**Estimated Completion**: 8 weeks (with parallel development)