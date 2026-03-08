# IIUM Booking System (Cloudflare Workers + React)

Full-stack venue booking system running on Cloudflare Workers with a React frontend.

## Stack
- Frontend: React 18, Vite, React Router, TanStack Query, Tailwind, shadcn/ui
- Backend: Cloudflare Workers, Hono, Durable Objects
- Shared: TypeScript types in `shared/`

## Prerequisites
- Node.js 20+
- npm 10+
- Cloudflare Wrangler CLI (installed via npm script dependency)

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create env values from `.env.example` for frontend and set Worker secrets in Cloudflare/Wrangler.
3. Generate Worker types:
   ```bash
   npm run cf-typegen
   ```

## Run
- Local dev:
  ```bash
  npm run dev
  ```
- Build:
  ```bash
  npm run build
  ```
- Deploy:
  ```bash
  npm run deploy
  ```

## Important Environment Variables
- `VITE_GOOGLE_CLIENT_ID`
- `JWT_SECRET` (required, minimum 32 chars)
- `ADMIN_EMAILS` (comma-separated, backend source of truth for bootstrap admins)
- `CORS_ALLOWED_ORIGINS` (comma-separated allowed origins)
- `RATE_LIMIT_PER_MINUTE` (default `120`)

## Core API Areas
- Auth: `/api/auth/otp/request`, `/api/auth/otp/verify`, `/api/auth/google`
- Booking: `/api/bookings`, `/api/bookings/:id`, `/api/bookings/:id/status`
- Admin:
  - `/api/admin/users`
  - `/api/admin/users/:id/role`
- Settings/upload:
  - `/api/settings`
  - `/api/settings/hero-image`
  - `/api/upload`
  - `/api/images/:id`
