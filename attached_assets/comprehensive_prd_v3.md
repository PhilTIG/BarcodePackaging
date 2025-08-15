# Warehouse Sorting Barcode Scanner App - Product Requirements Document v3.0

## Executive Summary

This document outlines the complete requirements for implementing a POC-compliant warehouse sorting barcode scanner application with multi-worker coordination, real-time scanning, and advanced session management. The system must exactly match the original HTML POC logic for box allocation and scanning behavior.

## Critical System Requirements

### 1. POC-Compliant Box Assignment Logic

**Current Issue**: The system incorrectly assigns box numbers using `Math.floor(index / 8) + 1` which groups products by index.

**Required Logic (POC-Compliant)**:
- Customers are assigned to boxes 1-100 based on **first appearance order** in the uploaded CSV file
- One box per customer (multiple products can belong to the same customer/box)
- Box numbers are determined by the order customers first appear in the CSV, not alphabetical sorting

**Example**:
```
CSV Row 1: Barcode=11, Product=Shirt, Customer=Charlie -> Box 1 (Charlie's first appearance)
CSV Row 2: Barcode=22, Product=Hat, Customer=Alice -> Box 2 (Alice's first appearance)  
CSV Row 3: Barcode=33, Product=Pants, Customer=Charlie -> Box 1 (Charlie already assigned)
CSV Row 4: Barcode=44, Product=Shoes, Customer=Bob -> Box 3 (Bob's first appearance)
```

### 2. Multi-Worker Box Allocation System

**Worker Assignment Patterns** (Max 4 workers per job):
- **Worker 1**: Ascending order (boxes 1, 2, 3, 4...)
- **Worker 2**: Descending order (boxes 100, 99, 98, 97...)
- **Worker 3**: Middle up (boxes 50, 51, 52, 53...)
- **Worker 4**: Middle down (boxes 49, 48, 47, 46...)

**Scanning Logic**:
When a worker scans an item, the system finds the next available quantity for that barcode following the worker's assigned direction pattern.

### 3. Box Highlighting System

**Color Priority (Highest to Lowest)**:
1. **GREEN**: Box that just received a scan (stays until next scan by any worker)
2. **Grey-Red with Lock**: 100% completed boxes (white text/icon)
3. **Worker Color**: Box contains items from that worker (based on last worker to scan into box)
4. **Grey**: Empty/no items

**Removed Elements**:
- No "Scanning" or "Pending" red-framed badges
- No "active" or "inactive" box concepts

### 4. Database Schema Requirements

**Missing Fields in Current Schema**:
```sql
-- Add to products table
ALTER TABLE products ADD COLUMN lastWorkerUserId varchar REFERENCES users(id);
ALTER TABLE products ADD COLUMN lastWorkerColor text;

-- Add to scan_events table  
ALTER TABLE scan_events ADD COLUMN workerColor text;
```

**Worker Assignment Logic**:
- `workerBoxAssignments` table tracks each worker's allocation pattern
- Products track the last worker who scanned into each box for color highlighting

## Implementation Tasks

### Phase 1: Database Schema Fixes (Priority: Critical)
1. **Fix Box Assignment Logic**
   - [ ] Update CSV processing to assign customers to boxes by first appearance order
   - [ ] Add database migration to fix existing incorrect box assignments
   - [ ] Test with POC CSV data to ensure boxes 1-100 assignment

2. **Add Missing Schema Fields**
   - [ ] Add `lastWorkerUserId` and `lastWorkerColor` to products table
   - [ ] Add `workerColor` to scan_events table
   - [ ] Update storage interface for new fields

3. **Multi-Worker Assignment System**
   - [ ] Implement worker allocation patterns (ascending/descending/middle)
   - [ ] Create algorithm to determine next available box for each worker
   - [ ] Update scan processing to follow worker-specific allocation order

### Phase 2: Box Highlighting System (Priority: High)
4. **POC-Style Single Box Highlighting**
   - [ ] Track last scanned box globally (not per worker)
   - [ ] Implement GREEN highlighting for just-scanned box
   - [ ] Remove blue "active" highlighting logic

5. **Worker Color System**
   - [ ] Track last worker to scan into each box
   - [ ] Display worker color for boxes with items
   - [ ] Handle color priority: Green > Grey-Red > Worker Color > Grey

6. **Completed Box Styling**
   - [ ] Grey-red background for 100% complete boxes
   - [ ] White text and white lock icon
   - [ ] Remove green highlighting for completed boxes

### Phase 3: Multi-Worker Coordination (Priority: High)
7. **Worker Assignment Interface**
   - [ ] Manager interface to assign workers to jobs with colors
   - [ ] Automatic assignment of allocation patterns (1st=ascending, 2nd=descending, etc.)
   - [ ] Display worker allocation pattern in UI

8. **Real-Time Worker Coordination**
   - [ ] WebSocket updates for multi-worker scanning
   - [ ] Prevent conflicts when multiple workers scan simultaneously
   - [ ] Show real-time worker activity in supervisor view

### Phase 4: Mobile Interface Enhancements (Priority: Medium)
9. **Single Box Mode Updates**
   - [ ] Update mobile interface to follow worker allocation pattern
   - [ ] Show worker's next assigned box based on their pattern
   - [ ] Handle worker switching between assigned boxes

10. **Error Handling for Multi-Worker**
    - [ ] Handle "no available boxes" for worker's allocation pattern
    - [ ] Display appropriate errors when worker scans out-of-pattern
    - [ ] Graceful handling of worker reassignment

### Phase 5: Performance and Testing (Priority: Medium)
11. **Performance Optimization**
    - [ ] Optimize box calculation queries for large jobs
    - [ ] Cache worker allocation patterns
    - [ ] Implement efficient real-time updates

12. **Testing and Validation**
    - [ ] Test with 4 workers on same job
    - [ ] Validate POC-compliance with original HTML behavior
    - [ ] Load testing with large CSV files (1000+ products)

## Technical Architecture Updates

### Database Schema Changes
```typescript
// Updated products table
export const products = pgTable("products", {
  // ... existing fields
  lastWorkerUserId: varchar("last_worker_user_id").references(() => users.id),
  lastWorkerColor: text("last_worker_color"),
});

// Updated scan_events table  
export const scanEvents = pgTable("scan_events", {
  // ... existing fields
  workerColor: text("worker_color"),
});
```

### Worker Allocation Algorithm
```typescript
interface WorkerAllocationPattern {
  workerId: string;
  pattern: 'ascending' | 'descending' | 'middle_up' | 'middle_down';
  currentBoxIndex: number;
  assignedColor: string;
}

function getNextBoxForWorker(
  workerId: string, 
  availableBoxes: number[], 
  pattern: WorkerAllocationPattern
): number | null {
  // Implementation based on worker's allocation pattern
}
```

### Box Highlighting Logic
```typescript
interface BoxHighlighting {
  boxNumber: number;
  priority: 'green_just_scanned' | 'grey_red_complete' | 'worker_color' | 'grey_empty';
  color?: string; // Worker color if applicable
  lastScannedBy?: string; // Worker ID
}
```

## Success Criteria

1. **POC Compliance**: Box assignment exactly matches original HTML POC behavior
2. **Multi-Worker Support**: 4 workers can simultaneously work on same job with different allocation patterns
3. **Real-Time Updates**: All workers see immediate updates when others scan
4. **Color Consistency**: Box colors accurately reflect last worker activity and completion status
5. **Performance**: System handles 1000+ product jobs with 4 workers without lag
6. **Error Handling**: Graceful handling of edge cases and worker conflicts

## Migration Strategy

### Data Migration Required
- Existing jobs will need box number recalculation based on POC logic
- Products table will need new worker tracking fields populated
- Manager will need to reassign workers to jobs after schema update

### Rollout Plan
1. Deploy schema changes to development environment
2. Test with existing jobs to ensure data integrity
3. Implement new multi-worker logic progressively
4. Deploy to production with data migration script
5. Retrain managers on new worker assignment features

## Risks and Mitigation

### High Risk Items
- **Data Loss**: Box number changes may affect ongoing jobs
- **Performance**: Multi-worker real-time updates may cause delays
- **Complexity**: 4-worker allocation patterns increase system complexity

### Mitigation Strategies
- Comprehensive testing with production-like data
- Gradual rollout with ability to rollback
- Performance monitoring and optimization
- Clear documentation and training materials

---

**Document Version**: 3.0  
**Last Updated**: January 15, 2025  
**Next Review**: Upon Phase 1 completion