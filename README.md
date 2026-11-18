# Local Service Finder

Local Service Finder is a dark-themed local services marketplace built with **Node.js + Express**, **SQLite (`node:sqlite`)**, and **vanilla HTML5, CSS3, and ES6 JavaScript** (no frontend frameworks). It connects customers across Indian metro cities with verified tradespeople across 12 service categories with transparent INR (`₹`) pricing.

---

## Tech Stack

- **Backend**: Node.js 22+, Express 4, TypeScript (`tsx` in dev, `esbuild` bundle for production)
- **Database**: Built-in SQLite (`node:sqlite` `DatabaseSync`) with foreign keys, WAL mode, and idempotent demo seeding
- **Authentication & Security**: `scrypt` salted password hashing, HS256 JWT Bearer tokens, role-based access control (`CUSTOMER`, `PROVIDER`, `ADMIN`), and structured JSON error handling
- **Frontend**: Multi-page semantic HTML5, modular CSS (`base.css`, `layout.css`, `components.css`, `pages.css`), and ES6 vanilla JavaScript `fetch` modules

---

## Folder Structure

```text
server.ts                 Express entry point (REST API + static frontend)
server/
  config.ts               Runtime configuration (port, JWT secret, DB path)
  db.ts                   SQLite schema, indexes, rating & completeness helpers
  seed.ts                 12 categories, 26 Indian providers, bookings, quotes, reviews
  security.ts             scrypt hashing, JWT sign/verify, RBAC middlewares
  validation.ts           Input validators & ApiError class
  routes/
    auth.ts               Register, login, profile, forgot/reset password
    marketplace.ts        Services, multi-filter provider search, provider detail
    customer.ts           Quotes, bookings, status updates, reviews, favorites, messages, notifications
    provider.ts           Provider analytics, service CRUD, availability, quote replies, review replies
    admin.ts              Admin KPIs, provider verification, review moderation, user management
frontend/
  index.html              Landing & discovery page
  search.html             Two-column filter & search results page
  provider.html           Provider profile, INR rate card, availability, reviews & sticky booking box
  booking.html            5-step booking workflow
  login.html              Login, password reset modal & demo account quick-fill
  register.html           Customer & Provider registration
  customer-dashboard.html Customer workspace (Bookings, Quotes, Saved, Reviews, Messages, Notifications, Settings)
  provider-dashboard.html Provider studio (Stats, Action Queue, Services, Availability, Reviews, Messages)
  admin-dashboard.html    Admin moderation console (Overview, Verifications, Reviews, Users)
  css/                    base.css, layout.css, components.css, pages.css
  js/                     api.js, auth.js, ui.js + page-specific ES modules
tests/
  api.test.ts             Unit & integration tests using Node test runner
```

---

## Setup & Run Instructions

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables** (optional — defaults work out of the box):
   Copy `.env.example` to `.env` and adjust `JWT_SECRET` or `SQLITE_DB_PATH` as needed.

3. **Run in development** (port `3000`):
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000`. The SQLite database (`data/local-service-finder.sqlite`) is automatically initialized and seeded on first startup.

4. **Run automated tests**:
   ```bash
   npm test
   ```

5. **Build & start for production**:
   ```bash
   npm run build
   npm start
   ```

---

## Demo User Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Customer** | `ananya.sharma@example.in` | `Customer@123` |
| **Customer 2** | `rohan.mehta@example.in` | `Customer@123` |
| **Provider (Plumbing)** | `rajesh.plumbing@example.in` | `Provider@123` |
| **Provider (Electrical)** | `priya.electrical@example.in` | `Provider@123` |
| **Admin** | `admin@localservicefinder.in` | `Admin@123` |

---

## API Endpoint Reference

- `GET  /api/v1/health` — Server health check
- `POST /api/v1/auth/register` — Register Customer or Provider account
- `POST /api/v1/auth/login` — Authenticate and receive JWT token
- `GET  /api/v1/auth/me` — Current authenticated user profile & unread notification count
- `PATCH /api/v1/auth/profile` — Update user contact & locality details
- `POST /api/v1/auth/forgot-password` & `POST /api/v1/auth/reset-password` — Password reset flow
- `GET  /api/v1/services` — List all 12 service categories with provider counts and active cities
- `GET  /api/v1/providers` — Paginated, sorted, multi-filter provider search (`q`, `category`, `location`, `radiusKm`, `minRating`, `minPrice`, `maxPrice`, `availability`, `verifiedOnly`, `sort`, `page`, `limit`)
- `GET  /api/v1/providers/:id` — Full provider profile, rate card, availability, reviews, similar providers
- `GET  /api/v1/reviews/provider/:providerId` — Visible reviews for a provider
- `POST /api/v1/quote-requests` & `GET /api/v1/quote-requests/customer` — Create & view customer quote requests
- `PATCH /api/v1/quote-requests/:id` — Provider quote response (`QUOTED`, `ACCEPTED`, `DECLINED`)
- `POST /api/v1/bookings` & `GET /api/v1/bookings/customer` — Create & list customer bookings
- `GET  /api/v1/bookings/provider` — List bookings assigned to provider
- `PATCH /api/v1/bookings/:id/status` — Update booking status (`PENDING`, `ACCEPTED`, `REJECTED`, `RESCHEDULED`, `COMPLETED`, `CANCELLED`)
- `POST /api/v1/reviews` & `POST /api/v1/reviews/:reviewId/reply` — Submit verified booking review & provider reply
- `GET / POST / DELETE /api/v1/favorites/:providerId` — Manage saved providers
- `GET / POST /api/v1/messages` — Threaded customer-provider messaging
- `GET / PATCH /api/v1/notifications` — User notifications and read receipts
- `GET  /api/v1/provider/dashboard` — Provider analytics, conversion rate, completeness score, bookings & quotes
- `PUT  /api/v1/provider/profile`, `POST / DELETE /api/v1/provider/services`, `PUT /api/v1/provider/availability` — Provider catalog & schedule management
- `GET  /api/v1/admin/overview`, `PATCH /api/v1/admin/providers/:id/verify`, `PATCH /api/v1/admin/reviews/:id/moderate`, `PATCH /api/v1/admin/users/:id/status` — Admin moderation endpoints

---

## Architecture & Extending

1. **Layered Backend**: `server.ts` mounts Express routers per domain (`auth`, `marketplace`, `customer`, `provider`, `admin`) backed by normalized SQLite tables in `server/db.ts`. Validation (`server/validation.ts`) and RBAC JWT guards (`server/security.ts`) keep routes clean and safe.
2. **Adding New Trades or Cities**: Add entries to `CATEGORIES` or `CITY_COORDS` in `server/seed.ts` / `server/routes/marketplace.ts`.
3. **Swapping SQLite for PostgreSQL**: Isolate SQL queries behind repository helpers or replace `node:sqlite` calls in `server/routes/*` with `pg` parameterized queries while keeping the exact REST API contract intact.
