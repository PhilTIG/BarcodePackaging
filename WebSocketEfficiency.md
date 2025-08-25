
# WebSocket Efficiency Optimization Plan

## Overview
This plan addresses the identified WebSocket efficiency issues in the Worker Scanner system to improve performance, reduce unnecessary network traffic, and optimize real-time updates.

## Identified Issues
1. **Query Invalidation Storm**: Every scan triggers 3+ API calls via broad query invalidations
2. **Double Data Fetching**: Both mutation response AND WebSocket events trigger the same data fetches
3. **Heavy Component Re-renders**: Entire CustomerBoxGrid updates on every scan
4. **Artificial Delays**: 100ms setTimeout workarounds in mobile mode
5. **Real-time Polling Conflicts**: 10-second polling + WebSocket updates create race conditions
6. **Performance Stats Over-polling**: 5-second intervals for job performance data

## Optimization Tasks

### Phase 1: Core WebSocket Optimizations
- [ ] **Task 1.1**: Replace broad query invalidations with targeted WebSocket data updates
- [ ] **Task 1.2**: Eliminate double data fetching by removing mutation-triggered invalidations
- [ ] **Task 1.3**: Implement direct WebSocket data updates instead of query invalidations
- [ ] **Task 1.4**: Reduce mobile mode artificial delay from 100ms to 50ms
- [ ] **Task 1.5**: Remove 10-second polling fallback mechanism (WebSocket-only updates)

### Phase 2: Component Re-render Optimization
- [ ] **Task 2.1**: Implement React.memo for CustomerBoxGrid with custom comparison functions
- [ ] **Task 2.2**: Implement React.memo for individual box components
- [ ] **Task 2.3**: Optimize box highlighting state management to prevent full grid re-renders
- [ ] **Task 2.4**: Implement selective component updates based on actual data changes

### Phase 3: Performance Stats Optimization
- [ ] **Task 3.1**: Convert 5-second job performance polling to WebSocket-based updates
- [ ] **Task 3.2**: Implement real-time performance stats via WebSocket messages
- [ ] **Task 3.3**: Remove performance polling intervals entirely
- [ ] **Task 3.4**: Optimize performance data structure for minimal WebSocket message size

### Phase 4: WebSocket Message Optimization
- [ ] **Task 4.1**: Implement message batching for multiple rapid scans
- [ ] **Task 4.2**: Optimize WebSocket message payloads to reduce size
- [ ] **Task 4.3**: Implement delta updates instead of full data refreshes
- [ ] **Task 4.4**: Add WebSocket message compression for large data

### Phase 5: State Management Optimization
- [ ] **Task 5.1**: Implement optimistic UI updates for immediate user feedback
- [ ] **Task 5.2**: Reduce React Query cache invalidations by 80%+
- [ ] **Task 5.3**: Implement smart data caching with WebSocket-driven updates
- [ ] **Task 5.4**: Optimize component state management to prevent unnecessary renders

### Phase 6: Testing and Validation
- [ ] **Task 6.1**: Performance testing with multiple concurrent workers
- [ ] **Task 6.2**: Network traffic measurement and optimization validation
- [ ] **Task 6.3**: UI responsiveness testing under high load
- [ ] **Task 6.4**: WebSocket connection stability testing

## Success Metrics
- [ ] Reduce API calls per scan from 3+ to 0 (WebSocket-only updates)
- [ ] Eliminate artificial delays (50ms max for critical operations)
- [ ] Reduce component re-renders by 70%+
- [ ] Achieve sub-100ms real-time update latency
- [ ] Remove all polling intervals in favor of WebSocket updates
- [ ] Maintain 100% data consistency across all connected clients

## Implementation Priority
1. **High Priority**: Tasks 1.1-1.5, 2.1-2.2, 3.1-3.3
2. **Medium Priority**: Tasks 2.3-2.4, 4.1-4.2, 5.1-5.2
3. **Low Priority**: Tasks 4.3-4.4, 5.3-5.4, 6.1-6.4
