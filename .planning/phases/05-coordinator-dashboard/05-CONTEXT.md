# Phase 5 Context — Coordinator Compliance Dashboard

**Goal:** Agency-wide compliance visibility with all-workers list, filtering, active alerts, and export.

---

## Decisions

**Architecture:**
- Single coordinator dashboard at `/app/dashboard/compliance` (extend existing Phase 3 dashboard)
- Compliance scores from backend API (source of truth, not frontend calculation)
- Redis caching: 60s TTL on worker compliance list (performance optimization)
- CSV/PDF export: server-side generation (no client-side limits)

**Frontend:**
- Tailwind CSS, reuse Phase 4 components (badges, status indicators)
- Filters: inline in header (not sidebar, to save space)
- Workers list: paginated (20/page), sortable columns
- Mobile: tablet-optimized (iPad), mobile secondary

**Backend:**
- New endpoint: `GET /api/agency/compliance/workers` (returns list with scores, aggregated counts)
- New endpoint: `POST /api/agency/compliance/export` (CSV/PDF generation)
- Reuse cron job to update compliance scores (Phase 4 foundation)
- Audit log endpoint from Phase 3 (read-only)

**Database:**
- No new tables (leverage existing ComplianceDocument, ExpiryAlert, AuditLog)
- Materialized view or aggregation query for performance
- Index on `(agencyId, status)` for fast filtering

**Compliance Score:**
- Calculated server-side: `(completed_required / total_required) * 100`
- Endpoint returns scores + color codes (red/yellow/green)
- Same formula as Phase 4 worker portal (testable equivalence)

---

## Code Context

**Reusable:**
- Phase 3 dashboard structure (`frontend/app/dashboard/`)
- Audit log endpoint from Phase 3 (`GET /api/audit-log`)
- Compliance calculation logic from Phase 4 helpers
- Existing worker routes and auth middleware

**New Files:**
- `frontend/app/dashboard/compliance/page.tsx` — Main dashboard
- `backend/src/routes/compliance.js` — Workers list + export endpoints
- `frontend/lib/compliance-dashboard.ts` — Helper functions
- `backend/src/lib/compliance-service.js` — Score calculation, export generation

---

*CONTEXT locked. Ready for planning.*
