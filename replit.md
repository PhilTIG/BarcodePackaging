# Warehouse Sorting Barcode Scanner App

## Overview

This application streamlines the sorting of purchased goods for various customer destinations within a warehouse. It offers role-based interfaces for managers, supervisors, and workers, enabling CSV data uploads, job progress tracking, and barcode scanning. The system prioritizes real-time collaboration, performance monitoring, and efficient sorting workflows with visual feedback. Its business vision is to optimize warehouse logistics, reduce sorting errors, and enhance operational efficiency for businesses handling high volumes of varied customer orders.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The client is a React (TypeScript) SPA using a component-based approach. It employs Wouter for routing, React Query for server state management and caching, Shadcn/ui (built on Radix UI and Tailwind CSS) for UI components, and React Hook Form with Zod for form handling. WebSocket integration enables real-time updates. The app supports multiple color themes via CSS custom properties. A "Single Box" mode provides a mobile-first scanning interface with real-time feedback, auto box allocation, and error handling, including visual cues for worker colors and box completion. The customer box grid is responsive, adapting to screen size and user-defined preferences for columns.

### Backend Architecture

The server uses Express.js (TypeScript) with a RESTful API design. It includes a WebSocket server for real-time communication, Multer for CSV uploads, and bcrypt for password hashing. A custom storage interface separates business logic from data persistence.

### Data Storage Solutions

PostgreSQL is the primary database, managed with Drizzle ORM for type-safe queries and schema management. Neon provides serverless cloud hosting. The relational schema includes tables for users, jobs, products, scan sessions, events, and job assignments, supporting role-based access and detailed performance tracking. Key features include tracking last worker per box, storing allocation patterns, and supporting job activation states.

### Authentication and Authorization

Role-based access control is implemented via a staff ID and PIN login system, server-side session management (PostgreSQL store), and client-side route protection. Middleware validates user sessions and roles for API security.

### Performance and Real-time Features

The application tracks performance with a scoring algorithm (scans per hour), offering real-time dashboards via WebSockets. It supports persistent scan sessions with pause/resume functionality and provides real-time job completion monitoring with visual indicators, including precise box completion logic based on 100% fulfillment.

### Mobile and Hardware Support

Designed for warehouse environments, the app features responsive layouts for tablets and mobile devices. It supports camera-based and hardware HID barcode scanning, provides touch-friendly UI, and considers offline use with client-side caching.

## External Dependencies

### Database Services
- **Neon PostgreSQL**: Serverless PostgreSQL hosting.
- **Drizzle ORM**: Type-safe database toolkit.

### UI and Styling
- **Radix UI**: Accessible component primitives.
- **Tailwind CSS**: Utility-first CSS framework.
- **Shadcn/ui**: Pre-built component library.

### Development and Build Tools
- **Vite**: Development server and build tool.
- **TypeScript**: Type safety across the stack.

### Authentication and Security
- **bcryptjs**: Password hashing.
- **connect-pg-simple**: PostgreSQL session store.

### File Processing
- **Multer**: Multipart form data handling.
- **csv-parser**: Streaming CSV parsing.

### Real-time Communication
- **WebSocket (ws)**: Real-time bidirectional communication.
- **React Query**: Optimistic updates and cache invalidation.