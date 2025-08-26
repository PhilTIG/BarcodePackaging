# Warehouse Sorting Barcode Scanner App

## Overview

This application streamlines the sorting of purchased goods with various customer destinations within a warehouse environment. It offers role-based interfaces for managers, supervisors, and warehouse workers, facilitating CSV data uploads, job progress tracking, and barcode scanning. The system prioritizes real-time collaboration, performance monitoring, and efficient sorting workflows with visual feedback. The business vision is to enhance warehouse operational efficiency, reduce sorting errors, and provide a clear overview of the sorting process, catering to the growing e-commerce and logistics sectors.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The client is a React-based Single Page Application (SPA) utilizing TypeScript. It employs a component-based approach with Wouter for routing, React Query for server state management, and Shadcn/ui (built on Radix UI and Tailwind CSS) for UI components. Form handling is managed by React Hook Form with Zod for validation. WebSocket integration provides real-time updates. The application supports multiple color themes via CSS custom properties. Key UI/UX decisions include a responsive design adapting to various screen sizes, a "Single Box" mode for mobile scanning with full-screen displays, and a box grid system that adjusts columns based on user preferences and screen size. Visual feedback includes box highlighting based on scan status, worker colors, and completion.

### Backend Architecture

The backend is a RESTful API built with Express.js and TypeScript. It includes an API layer for HTTP requests, a WebSocket server for real-time communication, and Multer for CSV file uploads with streaming parsing. Authentication is session-based, using bcrypt for password hashing. A custom storage interface separates business logic from data persistence. Core architectural decisions include a focus on multi-worker allocation algorithms (ascending, descending, middle up/down patterns) and a modernized `box_requirements` system for precise customer-to-box allocation. **Legacy Cleanup All 4 Phases Completed (August 2025)**: Eliminated dual scanning approach, worker assignment redundancy, and unused database artifacts. System now operates purely on box requirements with job_assignments as the single source of truth for worker management, with a clean, optimized database schema.

### Data Storage Solutions

PostgreSQL serves as the primary database, managed by Drizzle ORM for type-safe queries and schema management. Neon serverless PostgreSQL provides scalable cloud hosting. The relational schema includes tables for users, jobs, products, scan sessions, scan events, job assignments, job types, worker box assignments, session snapshots, job archives, and **NEW CheckCount tables** (check_sessions, check_events, check_results) for quality assurance functionality.

### Authentication and Authorization

The system implements role-based access control using a staff ID and PIN-based login system. Server-side session management uses a PostgreSQL session store. Client-side route protection and API security are enforced based on user roles (manager, supervisor, worker). Managers can control job activation (Start/Pause Scanning) which influences worker access.

### Performance and Real-time Features

The application incorporates sophisticated performance tracking, including a scoring algorithm based on scans per hour. Real-time analytics dashboards are updated via WebSockets. Scan sessions are persistent with pause/resume functionality. Job completion is monitored with visual indicators, including precise box completion logic requiring 100% fulfillment of all items for a customer destination.

**Worker Box Highlighting System**: Real-time WebSocket-based box highlighting for managers/supervisors shows which boxes workers are actively scanning. Features include 50% transparent worker color backgrounds, worker staffId display under quantities, and persistent color circles indicating the last worker to scan each box.

**Product Calculation Fix (January 2025)**: Corrected critical calculation error where `totalProducts` was counting CSV rows instead of summing quantities. Fixed calculation logic to properly sum all `Qty` values from CSV data, ensuring accurate product counts for job management and progress tracking.

**CheckCount Implementation (August 2025)**: 
- **Phase 1 Complete**: Database foundation, API infrastructure, and core storage interface
- **Phase 2 Complete**: Full-screen CheckCount interface functional with barcode scanning, session management, and progress tracking
- **Phase 3 Complete**: Intelligent item allocation logic - items found above original scan but within required_qty are allocated to box instead of Extra Items
- **WebSocket Integration Complete**: Real-time `check_count_update` messages broadcast to all monitoring interfaces
- **Database**: check_sessions, check_events, check_results tables with proper indexing and allocation tracking
- **API**: 12 CheckCount endpoints with role-based permissions and intelligent allocation logic
- **UI**: CheckCount page at `/check-count/:jobId/:boxNumber` with dual progress bars, enhanced visual feedback showing "Recovered Items" vs "Extra Items", and detailed correction dialogs
- **Allocation Logic**: Only items beyond required_qty become Extra Items; items within limits increase box count and update scanned_qty
- **Permissions**: Workers require manager-enabled `checkBoxEnabled`, managers/supervisors always have access
- **Visual Feedback**: Color-coded progress bars and badges distinguish between recovered items (blue), excess items (orange), and shortages (red)
- **Box Status Indicators**: Green check/red cross icons under box numbers showing CheckCount verification status (separate from completion lock icons)

**Barcode Scientific Notation Fix (August 2025)**:
- **Critical Issue Resolved**: Fixed barcode scanning failures caused by scientific notation storage (e.g., "9.32579E+12" instead of "9325790000000")
- **Root Cause**: CSV imports from Excel/spreadsheets converted large 13+ digit barcodes to scientific notation format
- **Solution Implementation**: Triple-layer fix with runtime normalization, database correction, and future prevention
- **Database Correction**: Updated 167 existing scientific notation barcodes to full numeric format across products and box_requirements tables
- **Runtime Conversion**: Added `normalizeBarcodeFormat()` utility with dual-format matching in `findNextTargetBox()` and `updateBoxRequirementScannedQty()`
- **CSV Import Prevention**: Integrated barcode normalization during CSV upload to prevent future scientific notation imports
- **Compatibility**: System now handles both original and normalized barcode formats for maximum scanning reliability

**QA Reporting Dashboard (August 2025)**: 
- **Business Requirement**: Comprehensive quality assurance analytics system extending CheckCount functionality
- **Architecture**: Main dashboard QA summary panel + dedicated QA dashboard with job-specific routing
- **Data Sources**: CheckCount sessions, events, results tables + extra items from scanEvents
- **Key Features**: Verification rates, accuracy scores, worker QA performance, discrepancy analysis, extra items tracking
- **Scope**: Active jobs only, 7-day activity window, real-time WebSocket updates, tablet-optimized design
- **Implementation Plan**: 4-phase rollout (Backend → Main Dashboard → Dedicated Dashboard → Advanced Features)

**Box Empty/Transfer System (August 2025 - Implementation Pending)**:
- **Core Business Logic**: CSV structure determines system behavior automatically with no user choices
- **CSV Group Detection**: System checks for literal "Group" column in uploaded CSV to determine mode
- **Transfer Mode**: When CSV contains "Group" column, completed boxes are transferred to predetermined groups
- **Empty Mode**: When CSV has no "Group" column, completed boxes are emptied for reuse
- **1:1 CustomName-Group Mapping**: Each unique CustomName maps to exactly one group name (no conflicts)
- **Box Completion Logic**: When box reaches 100% completion, all scanned items belong to same CustomName
- **Automatic Target Detection**: System automatically determines target group based on CustomName in completed box
- **User Interface**: Simple confirmation dialog showing "Transfer this box to [GroupName]" or "Empty this box"
- **Box Limit Feature**: New job creation parameter for maximum active boxes with automatic queuing
- **Automatic Reallocation**: When box is emptied/transferred, next queued CustomName automatically allocated
- **Box Number Persistence**: Boxes keep same number but reset contents for new CustomName allocation
- **History Tracking**: Complete job history of all emptied/transferred boxes displayed in box details
- **Real-time Updates**: WebSocket events for all box operations across connected interfaces
- **Organizational Purpose**: Purely for tracking/reporting, no impact on scanning behavior
- **Algorithm Integration**: New allocations follow existing worker allocation patterns (ascending, descending, middle up/down)

**Box Empty/Transfer Implementation Task List:**

**Phase 1: Database and Core Logic**
1. Update database schema to track box operations and history
2. Add box limit field to job creation/management
3. Implement CSV group column detection during upload
4. Create storage methods for box empty/transfer operations
5. Add automatic CustomName-to-Group mapping logic

**Phase 2: Box Limit and Queuing System**
6. Implement box limit enforcement during job creation
7. Create CustomName queuing system for when box limit reached
8. Add automatic box reallocation logic when boxes become available
9. Integrate with existing worker allocation algorithms (ascending, descending, middle up/down)

**Phase 3: Box Completion and Action Logic**
10. Detect when box reaches 100% completion
11. Determine CustomName in completed box from scanned items
12. Implement automatic action determination (Transfer vs Empty based on CSV Group column)
13. Add automatic target group detection for Transfer mode

**Phase 4: User Interface**
14. Create simple confirmation dialog for box operations
15. Display "Transfer this box to [GroupName]" or "Empty this box" messaging
16. Add box operation buttons to completed boxes (managers/supervisors only)
17. Implement one-click confirmation with no user input fields

**Phase 5: History and Tracking**
18. Create history tracking system for all box operations
19. Add history display section at bottom of box details screen
20. Show "Emptied" or "Transferred out" sections based on job mode
21. Display format: CustomName and destination information for entire job

**Phase 6: Real-time Updates and Integration**
22. Implement WebSocket events for box empty/transfer operations
23. Broadcast updates to all connected interfaces
24. Ensure box number persistence with content reset
25. Test integration with existing scanning and allocation systems

**Critical Requirements:**
- No user choices or inputs - fully automated based on CSV structure
- Each CustomName maps to exactly one group (1:1 relationship)
- Box keeps same number but resets contents for new allocation
- Purely organizational tracking - no impact on scanning behavior
- Real-time updates across all interfaces
- Integration with existing worker allocation patterns

### Mobile and Hardware Support

The design is optimized for warehouse environments, featuring responsive layouts for tablets and mobile devices. It supports both camera-based and hardware HID barcode scanners. The UI is touch-friendly with large targets.

## External Dependencies

- **Database Services**: Neon PostgreSQL, Drizzle ORM
- **UI and Styling**: Radix UI, Tailwind CSS, Shadcn/ui
- **Development and Build Tools**: Vite, TypeScript, ESBuild
- **Authentication and Security**: bcryptjs, connect-pg-simple
- **File Processing**: Multer, csv-parser
- **Real-time Communication**: WebSocket (ws), React Query