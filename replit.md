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
- **Phase 2 In Progress**: Full-screen CheckCount interface functional with barcode scanning, session management, and progress tracking
- **Database**: check_sessions (9 records), check_events (15 records), check_results tables with proper indexing
- **API**: 12 CheckCount endpoints with role-based permissions and worker permission validation
- **UI**: CheckCount page with dual progress bars, real-time state updates, and session lifecycle management
- **Permissions**: Workers require manager-enabled `checkBoxEnabled`, managers/supervisors always have access
- **Remaining**: Visual indicators, discrepancy handling, correction dialogs, and QA dashboard integration

### Mobile and Hardware Support

The design is optimized for warehouse environments, featuring responsive layouts for tablets and mobile devices. It supports both camera-based and hardware HID barcode scanners. The UI is touch-friendly with large targets.

## External Dependencies

- **Database Services**: Neon PostgreSQL, Drizzle ORM
- **UI and Styling**: Radix UI, Tailwind CSS, Shadcn/ui
- **Development and Build Tools**: Vite, TypeScript, ESBuild
- **Authentication and Security**: bcryptjs, connect-pg-simple
- **File Processing**: Multer, csv-parser
- **Real-time Communication**: WebSocket (ws), React Query