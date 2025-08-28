# Job Archive System - Product Requirements Document (PRD)

## 1. Executive Summary

The Job Archive System provides comprehensive lifecycle management for warehouse jobs, enabling managers to archive completed jobs while preserving essential data, worker performance metrics, and providing restoration capabilities. This system enhances operational efficiency by organizing completed work while maintaining audit trails and performance analytics.

## 2. System Overview

### 2.1 Core Functionality
- **Job Archiving**: Manual archiving of completed jobs by managers
- **Data Preservation**: Complete job snapshot storage for restoration
- **Worker Analytics**: Comprehensive worker performance tracking per archive
- **Restoration**: Ability to unarchive jobs back to active status
- **Data Management**: Purge detailed data while retaining summaries
- **Archive Management**: Complete archive deletion with safety controls

### 2.2 User Roles
- **Managers**: Full archive management access (create, view, restore, purge, delete)
- **Supervisors**: View-only access to archives and analytics
- **Workers**: No direct archive access

## 3. Feature Specifications

### 3.1 Database Architecture

#### 3.1.1 Core Tables ✅ COMPLETED
```sql
-- Job Archives Table
job_archives (
  id: varchar PRIMARY KEY,
  original_job_id: varchar NOT NULL,
  job_name: varchar NOT NULL,
  total_items: integer NOT NULL,
  total_boxes: integer NOT NULL,
  manager_name: varchar NOT NULL,
  manager_id: varchar NOT NULL,
  total_extras_found: integer DEFAULT 0,
  total_items_checked: integer DEFAULT 0,
  total_correct_checks: integer DEFAULT 0,
  overall_check_accuracy: decimal(5,2) DEFAULT 0.00,
  archived_by: varchar NOT NULL,
  archived_at: timestamp DEFAULT now(),
  is_purged: boolean DEFAULT false,
  job_data_snapshot: jsonb
)

-- Archive Worker Statistics Table
archive_worker_stats (
  id: varchar PRIMARY KEY,
  archive_id: varchar NOT NULL,
  worker_id: varchar NOT NULL,
  worker_name: varchar NOT NULL,
  total_scans: integer DEFAULT 0,
  total_session_time: integer DEFAULT 0,
  items_checked: integer DEFAULT 0,
  correct_checks: integer DEFAULT 0,
  check_accuracy: decimal(5,2) DEFAULT 0.00,
  extras_found: integer DEFAULT 0,
  errors_caused: integer DEFAULT 0,
  created_at: timestamp DEFAULT now()
)
```

**Status**: ✅ Database schema implemented and deployed

#### 3.1.2 Job Status Management ❌ PENDING
- Jobs table needs modification to track archived status
- Implement `is_archived` boolean field or use archive relationship lookup
- Update job filtering logic to exclude archived jobs from active views

### 3.2 Backend API Endpoints

#### 3.2.1 Archive Management APIs ✅ COMPLETED
- `GET /api/archives` - List all job archives with worker stats
- `GET /api/archives/:id` - Get specific archive with details
- `POST /api/jobs/:jobId/archive` - Archive a job manually
- `POST /api/archives/:id/unarchive` - Restore job to active status
- `DELETE /api/archives/:id/purge` - Remove detailed data, keep summary
- `DELETE /api/archives/:id` - Permanently delete archive

**Status**: ✅ All endpoints implemented and functional

#### 3.2.2 Job Filtering APIs ❌ PENDING
- Modify `GET /api/jobs` to exclude archived jobs
- Implement `GET /api/jobs/active` for explicit active job fetching
- Update job queries to handle archive status filtering

### 3.3 Storage Layer

#### 3.3.1 Archive Storage Methods ✅ COMPLETED
- `archiveJob(jobId, archivedBy)` - Complete archiving process
- `getJobArchives()` - Retrieve all archives
- `getJobArchiveById(id)` - Get specific archive
- `unarchiveJob(archiveId)` - Restore from archive
- `purgeJobData(archiveId)` - Remove detailed data
- `deleteJobArchive(id)` - Permanent deletion
- `createArchiveWorkerStats()` - Store worker performance
- `getArchiveWorkerStatsByArchiveId()` - Retrieve worker stats

**Status**: ✅ Core methods implemented with some bugs to fix

#### 3.3.2 Job Filtering Methods ❌ PENDING
- `getActiveJobs()` - Fetch non-archived jobs only
- Update `getAllJobs()` to include archive status
- Implement archive status checking utilities

### 3.4 Frontend Components

#### 3.4.1 Archive Management UI ✅ COMPLETED
- **Archives Page** (`/archives`): Complete archive listing and management
- **Archive Cards**: Display archive summaries with key metrics
- **Worker Statistics**: Performance data per archive
- **Action Buttons**: Unarchive, Purge Data, Delete Archive
- **Responsive Design**: Tablet and desktop optimized

**Status**: ✅ Full archive page implemented and functional

#### 3.4.2 Manager Dashboard Integration ❌ PENDING
- **Archive Navigation Button**: Next to "Active Jobs" title
- **Header Archive Link**: Quick access from main navigation
- **Job Status Updates**: Remove archived jobs from active view
- **Archive Button**: Per-job archiving controls

#### 3.4.3 Status Display Updates ❌ PENDING
- Update job cards to show archived status
- Modify job progress indicators
- Remove archived jobs from active listings
- Add visual indicators for archive status

### 3.5 Data Collection and Analytics

#### 3.5.1 Worker Performance Metrics ❌ PARTIALLY IMPLEMENTED
Data sources for archive worker statistics:
- **Scan Sessions**: Total scanning time, session counts
- **Scan Events**: Total scans, successful scans, error rates
- **CheckCount Results**: Items checked, accuracy rates, discrepancies found
- **Job Assignments**: Worker role and assignment data

**Current Issues**:
- Worker stats not being saved to database (0 records found)
- Schema mismatches between code and database
- Calculation errors in worker statistics aggregation

#### 3.5.2 Job Summary Data ✅ COMPLETED
- Total items and boxes processed
- CheckCount statistics and accuracy
- Manager and creation information
- Complete job data snapshot for restoration

## 4. Technical Implementation

### 4.1 Archiving Process Flow

#### 4.1.1 Manual Archive Trigger ✅ COMPLETED
1. Manager clicks "Archive" button on completed job
2. System validates job completion status
3. Archive confirmation dialog appears
4. System processes archiving request

#### 4.1.2 Data Collection Process ❌ NEEDS FIXES
1. ✅ Gather job metadata (name, totals, manager info)
2. ❌ Calculate worker statistics from scan sessions/events
3. ❌ Aggregate CheckCount performance data
4. ✅ Create complete job data snapshot
5. ❌ Save worker statistics to archive_worker_stats table
6. ✅ Create job_archives record
7. ❌ Mark original job as archived

#### 4.1.3 Job Filtering Updates ❌ PENDING
1. Update `getAllJobs()` to exclude archived jobs
2. Implement `getActiveJobs()` method
3. Modify frontend job queries to use active jobs only
4. Update real-time job status handling

### 4.2 Archive Management Features

#### 4.2.1 Restoration Process ✅ COMPLETED
- **Unarchive**: Restore complete job from snapshot
- **Data Integrity**: Maintain original job IDs and relationships
- **Status Updates**: Return job to active status
- **Cache Invalidation**: Update frontend job listings

#### 4.2.2 Data Lifecycle Management ✅ COMPLETED
- **Purge Data**: Remove detailed snapshots, keep summaries
- **Delete Archive**: Permanent removal with cascade deletes
- **Safety Controls**: Confirmation dialogs for destructive actions

### 4.3 User Interface Design

#### 4.3.1 Navigation Structure ❌ PENDING
```
Manager Dashboard
├── Active Jobs (with Archive button next to title)
├── Header Navigation (with Archive link)
└── Job Cards (remove archived jobs)

Archive Page (/archives)
├── Archive List (cards with summaries)
├── Worker Statistics (per archive)
└── Management Actions (Unarchive, Purge, Delete)
```

#### 4.3.2 Status Indicators ❌ PENDING
- **Active Jobs**: Show only non-archived jobs
- **Job Cards**: Remove "Scanning Active" for archived jobs
- **Archive Status**: Visual indicators for archive states
- **Real-time Updates**: WebSocket updates for status changes

## 5. Current Implementation Status

### 5.1 Completed Features ✅
- [x] Database schema (job_archives, archive_worker_stats)
- [x] Archive API endpoints (6 endpoints)
- [x] Storage methods for archive management
- [x] Archives page UI with full management interface
- [x] Archive creation and basic workflow
- [x] Unarchive/restore functionality
- [x] Purge and delete operations
- [x] Frontend archive listing and actions

### 5.2 Critical Issues to Fix ❌
- [ ] **Worker statistics not saving** (0 records in database)
- [ ] **Schema mismatches** (7 LSP diagnostics in storage.ts)
- [ ] **Archived jobs still showing in active view**
- [ ] **Missing archive navigation buttons**
- [ ] **Job status display not updated**

### 5.3 Pending Implementation ❌
- [ ] Create `getActiveJobs()` method in storage
- [ ] Update manager dashboard job filtering
- [ ] Add archive navigation buttons (header + dashboard)
- [ ] Fix worker statistics data collection
- [ ] Resolve storage.ts schema mismatches
- [ ] Update job status displays
- [ ] Test complete archiving workflow
- [ ] Add WebSocket updates for archive status

## 6. Questions for Implementation Clarification

### 6.1 Technical Architecture
1. **Job Table Modification**: Should we add `is_archived` boolean field to jobs table, or rely on JOIN with job_archives table for filtering?
2. **Worker Stats Source**: Confirm data sources for worker statistics - scan_sessions table for timing, scan_events for performance metrics?
3. **Archive Status Logic**: When checking if job is archived, use SQL JOIN or add dedicated field?

### 6.2 User Experience
1. **Archive Button Placement**: Confirm both header navigation AND dashboard "Active Jobs" title button?
2. **Archived Job Visibility**: Should archived jobs completely disappear from manager dashboard immediately?
3. **Unarchive Notification**: What level of confirmation/notification for successful unarchive operations?

### 6.3 Data Management
1. **Worker Performance Calculation**: Confirm calculation methods for accuracy rates, session times, and error rates from existing scan data?
2. **Snapshot Content**: Verify complete job data snapshot includes box_requirements, scan_sessions, scan_events, and job_assignments?
3. **Real-time Updates**: Should archive operations trigger WebSocket broadcasts to update other connected managers?

## 7. Implementation Task List

### Phase 1: Critical Fixes ❌
- [ ] Fix storage.ts LSP diagnostics and schema mismatches
- [ ] Debug and fix worker statistics data collection
- [ ] Implement `getActiveJobs()` storage method
- [ ] Update `/api/jobs` endpoint to use active jobs only

### Phase 2: UI Integration ❌
- [ ] Add archive navigation button next to "Active Jobs" title
- [ ] Add archive link to header navigation
- [ ] Update job cards to exclude archived jobs
- [ ] Test archive button functionality

### Phase 3: Status Management ❌
- [ ] Update job status displays throughout application
- [ ] Add WebSocket broadcasts for archive status changes
- [ ] Test unarchive workflow and job restoration
- [ ] Validate complete archiving process end-to-end

### Phase 4: Testing and Validation ❌
- [ ] Test all archive operations with real data
- [ ] Verify worker statistics accuracy
- [ ] Validate data integrity in archive/unarchive cycle
- [ ] Performance testing with multiple archives

## 8. Success Criteria

### 8.1 Functional Requirements
- ✅ Jobs can be manually archived by managers
- ❌ Archived jobs do not appear in active job listings
- ❌ Archive navigation is easily accessible
- ❌ Worker statistics are accurately captured and stored
- ✅ Jobs can be restored from archives with full data integrity
- ✅ Archive data can be purged while retaining summaries
- ✅ Archives can be permanently deleted

### 8.2 Performance Requirements
- Archive operations complete within 5 seconds
- Archive page loads within 2 seconds
- Worker statistics calculations are accurate to existing scan data
- No performance impact on active job operations

### 8.3 User Experience Requirements
- ❌ Clear visual distinction between active and archived jobs
- ❌ Intuitive archive navigation from manager dashboard
- ✅ Comprehensive archive management interface
- ✅ Appropriate confirmations for destructive operations
- ✅ Real-time feedback for all archive operations

---

**Document Version**: 1.0
**Last Updated**: August 21, 2025
**Status**: Implementation In Progress - Critical Fixes Required