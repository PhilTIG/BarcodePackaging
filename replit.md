# Warehouse Sorting Barcode Scanner App

## Overview

This is a comprehensive warehouse sorting application designed to streamline the sorting process of purchased goods with different customer destinations. The app provides role-based interfaces for managers, supervisors, and warehouse workers to upload CSV data, track job progress, and perform barcode scanning operations. The system emphasizes real-time collaboration, performance tracking, and efficient sorting workflows with visual feedback and progress monitoring.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The client is built as a Single Page Application (SPA) using React with TypeScript. The architecture follows a component-based approach with:

- **React Router**: Uses Wouter for lightweight client-side routing with role-based page access
- **State Management**: React Query (TanStack Query) handles server state, caching, and data synchronization
- **UI Framework**: Shadcn/ui components built on Radix UI primitives with Tailwind CSS for styling
- **Form Handling**: React Hook Form with Zod schema validation for type-safe form management
- **Real-time Updates**: WebSocket integration for live progress tracking and collaborative features

The app supports multiple color themes (blue, green, orange, teal, red, dark) with CSS custom properties for consistent theming across components.

### Backend Architecture

The server follows a RESTful API design using Express.js with TypeScript:

- **API Layer**: Express routes handle HTTP requests with middleware for logging, authentication, and error handling
- **WebSocket Server**: Real-time communication for collaborative features and live updates
- **File Processing**: Multer for CSV file uploads with streaming CSV parsing
- **Authentication**: Session-based authentication with bcrypt for password hashing
- **Database Abstraction**: Custom storage interface provides a clean separation between business logic and data persistence

### Data Storage Solutions

The application uses PostgreSQL as the primary database with Drizzle ORM:

- **ORM**: Drizzle provides type-safe database queries and schema management
- **Database Provider**: Neon serverless PostgreSQL for scalable cloud hosting
- **Schema Design**: Relational design with tables for users, jobs, products, scan sessions, scan events, and job assignments
- **Migrations**: Drizzle Kit handles database schema migrations and version control

Key entities include role-based users (manager/supervisor/worker), CSV-based jobs with product inventories, customer box assignments, and detailed scan session tracking for performance analytics.

### Authentication and Authorization

The system implements role-based access control:

- **Authentication**: Staff ID and PIN-based login system suitable for warehouse environments
- **Session Management**: Server-side session storage with PostgreSQL session store
- **Role-based Routing**: Client-side route protection based on user roles (manager, supervisor, worker)
- **API Security**: Middleware validates user sessions and role permissions for protected endpoints

### Performance and Real-time Features

The application includes sophisticated performance tracking:

- **Scoring Algorithm**: Industry-standard performance metrics based on scans per hour (71 items/hour target)
- **Real-time Analytics**: Live performance dashboards with WebSocket updates
- **Session Management**: Persistent scan sessions with pause/resume functionality
- **Progress Tracking**: Real-time job completion monitoring with visual progress indicators

### Mobile and Hardware Support

Designed for warehouse environments with mobile-first considerations:

- **Responsive Design**: Adaptive layouts that work on tablets and mobile devices
- **Barcode Scanning**: Dual support for camera-based scanning and hardware HID scanners
- **Touch-friendly UI**: Large touch targets and mobile-optimized interactions
- **Offline Considerations**: Client-side caching and error handling for unstable network conditions

## External Dependencies

### Database Services
- **Neon PostgreSQL**: Serverless PostgreSQL hosting with connection pooling
- **Drizzle ORM**: Type-safe database toolkit with schema management

### UI and Styling
- **Radix UI**: Accessible component primitives for complex UI interactions
- **Tailwind CSS**: Utility-first CSS framework with custom design system
- **Shadcn/ui**: Pre-built component library with consistent design patterns

### Development and Build Tools
- **Vite**: Fast development server and build tool with HMR support
- **TypeScript**: Type safety across the entire stack
- **ESBuild**: Fast JavaScript bundling for production builds

### Authentication and Security
- **bcryptjs**: Password hashing for secure authentication
- **connect-pg-simple**: PostgreSQL session store for server-side sessions

### File Processing
- **Multer**: Multipart form data handling for CSV file uploads
- **csv-parser**: Streaming CSV parsing for large inventory files

### Real-time Communication
- **WebSocket (ws)**: Real-time bidirectional communication for live updates
- **React Query**: Optimistic updates and cache invalidation for responsive UI

### Development Environment
- **Replit Integration**: Development environment integration with runtime error overlays and cartographer mapping