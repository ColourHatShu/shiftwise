# ShiftWise

## What This Is

A multi-tenant SaaS compliance management platform for **UK healthcare staffing agencies**. Each agency manages its own workers (carers, nurses, support staff) and tracks the compliance documents required to legally place them on shift — DBS checks, Right to Work, training certificates, immunisation records, passports, NI cards, references, CVs.

Core promise: **be audit-ready at all times**. Catch expiring documents before they lapse so a CQC inspector never finds a non-compliant worker on duty.

## Context

- **Stage:** Brownfield. Existing Next.js 14 + Express + Postgres codebase, ~12 commits on `master`, single developer.
- **Status:** Functional MVP. Auth, agency onboarding, worker CRUD, document upload + AI scan, expiry alerts, PDF reports, settings — all working.
- **Constraint:** Solo developer with **zero current budget**. No paid tools, no paid APIs, no paid certifications in this milestone.
- **Tech stack** (already chosen, not changing):
  - Frontend: Next.js 14 App Router, React 18, Tailwind, Clerk, lucide-react, react-hot-toast
  - Backend: Express 4, Prisma 5, Postgres 15 (Docker), Multer, Helmet, express-rate-limit, Joi
  - AI: currently Ollama + llava (to be replaced this milestone)
  - Email: Resend (free tier)
  - Storage: local disk now, Cloudflare R2 SDK wired but unused
  - Encryption: AES-256-CBC at rest (to be upgraded to GCM this milestone)

## Core Value

**One thing that must work:** a coordinator at a UK healthcare staffing agency uploads a worker's compliance documents, the system automatically tracks expiry dates, emails the coordinator before anything lapses, and every action is auditable for CQC inspection.

## Requirements

### Validated

- Multi-tenant agency isolation (every query scoped by agencyId) — existing
- Clerk-based authentication with JWT verification — existing
- Agency onboarding flow with auto-seeded 8 standard document types — existing
- Worker CRUD (add, list, edit, deactivate, reactivate, delete) — existing
- Document upload with AES-256-CBC encryption at rest — existing (CBC to be upgraded)
- Document approval/rejection workflow with optimistic locking — existing
- Daily cron expiry sweep at 08:00 with HTML email alerts via Resend — existing
- Dead-letter queue for failed alert emails with hourly retry — existing
- AuditLog of all actions, written transactionally — existing
- Dashboard stats, compliance reports, PDF report generation — existing
- Rate limiting (general 100/15min, sensitive routes 20/15min) — existing
- Helmet plus CORS pinned to frontend origin — existing
- AI document scan (currently llava — being replaced) — existing

### Active

This milestone is a **no-cost hardening + free-OCR swap**. All items must require zero paid services.

- [ ] Sanitize `.env.example` (placeholder values) and rotate the committed Clerk dev keys
- [ ] Add `requireRole(['OWNER','ADMIN'])` middleware and enforce it on destructive endpoints
- [ ] Replace public `app.use('/uploads', express.static(...))` with a signed/auth-gated download handler that verifies agency ownership
- [ ] Upgrade encryption from AES-256-CBC to AES-256-GCM with a `keyVersion` column on `ComplianceDocument` for backwards-compat decryption
- [ ] Unify the four duplicated auth helpers (`requireAgency`, `verifyClerkToken`, `getAgencyId`, `getAgencyUser`) into a single `lib/auth.js`
- [ ] Add a unique index on `(complianceDocumentId, daysUntilExpiry, DATE(alertDate))` to harden expiry-alert deduplication
- [ ] Wire **Sentry free tier** on backend and frontend for error monitoring
- [ ] Add `/api/audit-log` endpoint (paginated, agency-scoped, filterable by action/entity) plus a minimal dashboard UI view
- [ ] Add server-side search/filter on the worker list page (name, jobTitle, status)
- [ ] Make AI scan non-blocking on upload (`setImmediate`) so the user gets an instant 201
- [ ] Replace the llava AI scan pipeline with **Tesseract.js + regex/structured extractors** (free, deterministic, runs in-process)

### Out of Scope (this milestone)

- Cyber Essentials / Cyber Essentials Plus certification — costs money
- NHS DSPT self-assessment — free but a multi-week paperwork project, not technical
- Claude vision / AWS Textract / Google Document AI — paid APIs
- Twilio SMS escalation — paid
- AWS KMS / Cloudflare Secrets — paid
- ICO registration — paid
- Cloudflare R2 migration off local disk — needs R2 account
- Worker self-service portal — separate milestone
- Audit pack ZIP generator — separate milestone
- Shift management / rota functionality — separate milestone (or brand pivot)
- Mandatory training matrix expansion (BLS, safeguarding L1/L2/L3, etc.) — separate milestone
- NMC PIN auto-verification, gov.uk RTW share code checks, DBS update service — separate milestone
- Brand decision (keep "ShiftWise" or rebrand) — product/business decision, not technical

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Stay on existing Next.js + Express + Postgres + Prisma stack | Working MVP; rewrite is not justified | Locked |
| First milestone is hardening, not features | Several genuine security gaps; cheapest possible buy-down of risk before adding more code | Pending validation this milestone |
| Tesseract.js + regex over hosted OCR for v1 | Zero cost, runs locally, deterministic on structured UK docs | Pending validation this milestone |
| Sentry free tier acceptable, no other paid SaaS | 5k errors/month covers solo MVP comfortably | Locked |
| Defer R2 migration | Local disk OK for solo dev; R2 migration tied to first real customer | Locked for now |
| Defer brand/product decision (shifts vs compliance-only) | Out of scope of a hardening milestone | Deferred |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? Move to Out of Scope with reason.
2. Requirements validated? Move to Validated with phase reference.
3. New requirements emerged? Add to Active.
4. Decisions to log? Add to Key Decisions.
5. "What This Is" still accurate? Update if drifted.

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections.
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state.

---
*Last updated: 2026-05-18 after initialization*
