# ShiftWise

**Compliance management for UK healthcare staffing agencies.**

ShiftWise is a multi-tenant SaaS platform that helps care/nursing staffing agencies stay **audit-ready at all times**. Each agency manages its workers (carers, nurses, support staff) and the compliance documents required to legally place them on shift — DBS checks, Right to Work, training certificates, immunisation records, passports, and more.

**The one thing that must always work:** a coordinator uploads a worker's compliance documents, the system tracks expiry dates automatically, emails the coordinator before anything lapses, and every action is auditable for a CQC inspection.

---

## Monorepo layout

```
shiftwise/
├── backend/      Node.js + Express REST API, Prisma ORM (PostgreSQL)
├── frontend/     Next.js 14 (App Router) + Tailwind CSS
└── docs/         Planning & the Autonomous Knight logs
```

## Tech stack

| Area            | Choice |
|-----------------|--------|
| Backend         | Node.js, Express, Prisma ORM |
| Database        | PostgreSQL (Supabase in dev) |
| Frontend        | Next.js 14 App Router, React 18, Tailwind CSS |
| Auth            | Clerk (agency coordinators) · custom JWT + email OTP (worker portal) |
| Email           | Resend / Nodemailer |
| OCR             | Tesseract.js (document scanning) |
| Observability   | Sentry (errors) · pino (structured logs) |
| Tests / CI      | Jest (backend) · Vitest + RTL (frontend) · GitHub Actions |

## Prerequisites

- Node.js 20+
- A PostgreSQL database (a Supabase project works well)

## Getting started

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env        # then fill in the values below
npx prisma generate
npx prisma db push          # sync the schema to your database
npm run dev                 # API on http://localhost:3001

# 2. Frontend (in a second terminal)
cd frontend
npm install
cp .env.example .env.local         # fill in the values below
npm run dev                 # app on http://localhost:3000
```

The frontend proxies `/api/*` to the backend (`NEXT_PUBLIC_API_URL`), so run both together in development.

## Environment variables

**backend/.env**

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | ✅ always | Postgres connection string (pooled) |
| `DIRECT_URL` | for migrations | Direct Postgres connection (Prisma migrate/push) |
| `CLERK_SECRET_KEY` | prod | Coordinator auth (Clerk) |
| `JWT_SECRET` | prod | Worker-portal JWT signing (must be a strong secret) |
| `DOCUMENT_ENCRYPTION_KEY` | ✅ for uploads | Key for AES-256-GCM document encryption at rest |
| `SENTRY_DSN_BACKEND` | optional | Backend error monitoring (leave empty to disable) |
| `RESEND_API_KEY` | optional | Transactional email (alerts, OTP) |
| `CORS_ORIGIN` | optional | Allowed frontend origin (default `http://localhost:3000`) |
| `PORT` | optional | API port (default `3001`) |
| `LOG_LEVEL` | optional | pino level (default `debug` dev / `info` prod) |

The server **fails fast on boot** if critical config is missing (see `backend/src/lib/validate-env.js`).

**frontend/.env.local**

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Backend base URL (e.g. `http://localhost:3001`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `NEXT_PUBLIC_SENTRY_DSN` | Frontend Sentry DSN (optional) |

## Scripts

**Backend** (`cd backend`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the API with nodemon |
| `npm start` | Start the API |
| `npm test` | Full Jest suite (some suites need a live Postgres) |
| `npm run test:ci` | CI suite — mocked/unit + route tests, no DB required |
| `npm run db:push` / `db:migrate` / `db:studio` | Prisma helpers |

**Frontend** (`cd frontend`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Next dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run test` / `test:ci` | Vitest unit + component tests |

## Testing & CI

- **Backend:** Jest. `npm run test:ci` runs the mocked/unit + route suites (no database needed); a few integration suites require a live Postgres and are excluded from CI.
- **Frontend:** Vitest + React Testing Library (unit + component).
- **CI:** `.github/workflows/ci.yml` runs the frontend (lint + build + tests) and backend (`prisma generate` + `test:ci`) on every push/PR to `main`.

## Architecture notes

- **Multi-tenancy:** every record is scoped by `agencyId`; API routes enforce it via `requireAgency`.
- **Two audiences:** coordinators use the Clerk-authenticated dashboard; workers use a separate portal authenticated by email OTP → JWT cookie.
- **Compliance engine:** `computeCompliance` (`backend/src/lib/compliance-assignment.js`) is the single source of truth for a worker's RAG status; document expiry alerts run on a daily cron (`backend/src/services/cronService.js`).
- **Documents:** encrypted at rest (AES-256-GCM), scanned with Tesseract OCR; analysis failures and identity mismatches are audited.
- **Observability:** every request gets a correlation id (`X-Request-Id`) surfaced in structured pino logs and Sentry.

## License

Proprietary — all rights reserved.
