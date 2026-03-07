# Seller Code Manager

## Overview
A web application for managing Facebook group seller codes. Tracks seller information, subscription durations, and automatically manages expiry status. Includes a public application form, admin review system, and Messenger reminder links.

## Architecture
- **Frontend**: React with Vite, TanStack Query, shadcn/ui components, Tailwind CSS
- **Backend**: Express.js REST API
- **Database**: PostgreSQL with Drizzle ORM
- **Routing**: wouter

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
- Facebook Messenger link: opens m.me with pre-filled reminder message per seller (no API needed)
- Messenger Settings panel: configure Facebook Page username through UI
- Settings stored in database (app_settings table)
- Public seller application form at /apply (Bengali UI) with payment instructions (Bkash/Nagad), pricing plans, and fields: name, phone, Facebook link, seller type, duration, payment method, sender number
- Professional Bengali thank you page after submission
- Admin Seller Applications page at /applications — view all applications with seller type, duration, payment method, sender number, approve or reject
- Auto-generated seller code on approval (creates seller record automatically)
- Seller Registration Link section on admin dashboard with copy-to-clipboard

## File Structure
- `shared/schema.ts` - Database schema and Zod validation
- `server/routes.ts` - REST API endpoints, code generation, expiry calculation
- `server/storage.ts` - Database storage layer with Drizzle
- `client/src/pages/seller-code-manager.tsx` - Main admin dashboard
- `client/src/pages/seller-application.tsx` - Public application form (/apply, Bengali)
- `client/src/pages/seller-applications.tsx` - Admin applications review (/applications)
- `client/src/App.tsx` - Router setup (/, /apply, /applications)

## API Endpoints
- GET /api/sellers - List all sellers
- GET /api/sellers/search?q= - Search sellers
- GET /api/sellers/:id - Get seller by ID
- POST /api/sellers - Create seller (auto-generates code)
- PATCH /api/sellers/:id - Update seller
- DELETE /api/sellers/:id - Delete seller
- GET /api/settings/messenger - Get Messenger config status
- POST /api/settings/messenger - Save Facebook Page username
- GET /api/applications - List all applications
- POST /api/applications - Submit seller application
- POST /api/applications/:id/approve - Approve (auto-creates seller with code)
- POST /api/applications/:id/reject - Reject application
