# Seller Code Manager

## Overview
A web application for managing Facebook group seller codes. Tracks seller information, subscription durations, and automatically manages expiry status. Includes a public application form, admin review system, and authentication.

## Architecture
- **Frontend**: React with Vite, TanStack Query, shadcn/ui components, Tailwind CSS
- **Backend**: Express.js REST API
- **Database**: PostgreSQL with Drizzle ORM
- **Routing**: wouter
- **Auth**: Session-based with Passport.js (local strategy), scrypt password hashing

## Authentication
- One-time admin setup on first visit (creates single admin account)
- Session-based authentication with Passport.js local strategy
- Password hashing with scrypt (crypto module)
- Recovery phrase for emergency password reset
- All admin pages/API routes require authentication
- `/apply` page remains fully public (no auth required)
- Login page with "Forgot access?" recovery option
- Logout button in dashboard header

## Seller Code Format
Code structure: `DDMM-SSSDD`
- `DDMM` = Join date (day + month)
- `SSS` = Auto-incrementing serial number (stored in app_settings as LAST_SELLER_SERIAL)
- `DD` = Duration code: 15=15 days, 01=1 month, 02=2 months, 06=6 months
- Example: `2601-97501` = Jan 26, serial 975, 1 month duration

## Durations & Expiry
- 15 Days: +15 days
- 1 Month: +30 days
- 2 Months: +60 days
- 6 Months: +180 days

## Key Features
- Dashboard with seller list table and stats cards
- Add/Edit/Delete seller functionality
- Auto-generated seller codes (DDMM-SSSDD format) — no manual code entry
- Auto-calculated expiry dates based on fixed day counts
- Status system: Active (green), Expiring Soon (yellow, 3 days), Expired (red)
- Row highlighting based on status
- Search by name, phone number, or seller code
- Facebook links open in new tab
- Public seller application form at /apply (Bengali UI) with payment instructions (Bkash/Nagad), pricing plans, and fields: name, phone, Facebook link, seller type, duration, payment method, sender number
- Professional Bengali thank you page after submission
- Admin Seller Applications page at /applications — view all applications with seller type, duration, payment method, sender number, approve or reject
- Auto-generated seller code on approval (creates seller record automatically)
- Seller Registration Link section on admin dashboard with copy-to-clipboard

## File Structure
- `shared/schema.ts` - Database schema and Zod validation
- `server/auth.ts` - Password hashing and verification utilities
- `server/routes.ts` - REST API endpoints, code generation, expiry calculation, auth routes
- `server/storage.ts` - Database storage layer with Drizzle
- `server/index.ts` - Express app setup, session config, passport config
- `client/src/pages/seller-code-manager.tsx` - Main admin dashboard
- `client/src/pages/seller-application.tsx` - Public application form (/apply, Bengali)
- `client/src/pages/seller-applications.tsx` - Admin applications review (/applications)
- `client/src/pages/login.tsx` - Login page with recovery option
- `client/src/pages/admin-setup.tsx` - One-time admin account setup
- `client/src/App.tsx` - Router setup with auth gating

## API Endpoints
### Auth (public)
- GET /api/auth/status - Check auth status and setup state
- POST /api/auth/setup - One-time admin account creation
- POST /api/auth/login - Login
- POST /api/auth/logout - Logout
- POST /api/auth/recover - Password recovery via recovery phrase

### Protected (require auth)
- GET /api/sellers - List all sellers
- GET /api/sellers/search?q= - Search sellers
- GET /api/sellers/:id - Get seller by ID
- POST /api/sellers - Create seller (auto-generates code)
- PATCH /api/sellers/:id - Update seller
- DELETE /api/sellers/:id - Delete seller
- GET /api/settings/messenger - Get Messenger config status
- POST /api/settings/messenger - Save Facebook Page username
- GET /api/applications - List all applications
- POST /api/applications/:id/approve - Approve (auto-creates seller with code)
- POST /api/applications/:id/reject - Reject application
- DELETE /api/applications/:id - Delete application

### Public
- POST /api/applications - Submit seller application
