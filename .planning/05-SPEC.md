# Phase 5 SPEC: Coordinator Compliance Dashboard

**Goal:** Provide coordinators with complete agency-wide compliance visibility: all workers with live compliance scores, filterable by status/name, active alerts, and one-click compliance export.

---

## Requirements

### R-CD-01: All-Workers Compliance List
**Current:** Worker detail page shows one worker. No agency-wide view.
**Target:** Dashboard lists all workers with live compliance score (0–100%), required docs count, last updated time.
**Acceptance:**
- [ ] Page loads <2s on 4G
- [ ] List shows: worker name, compliance score (color: red/yellow/green), {X}/{Y} required docs, last sync time
- [ ] Pagination: 20 workers per page, page selector
- [ ] No sorting breaks multi-tenant isolation (query always scoped by `agencyId`)

### R-CD-02: Filter & Sort
**Current:** No filtering.
**Target:** Filter by compliance status (red/yellow/green), worker name search, job title, status (active/inactive). Sort by score, name, updated time.
**Acceptance:**
- [ ] Search box filters by first name, last name, email (case-insensitive)
- [ ] Status dropdown: All / Red (non-compliant) / Yellow (expiring soon) / Green (compliant)
- [ ] Sort dropdown: Score (desc) / Name (asc) / Last Updated (desc)
- [ ] Filters persist in URL query params (shareable links)

### R-CD-03: Active Alerts Section
**Current:** Alerts exist in audit log only.
**Target:** Dashboard shows 3–5 most urgent alerts: "X workers have docs expiring in 3 days", "Y docs already expired", "Z workers non-compliant".
**Acceptance:**
- [ ] Section title: "Active Alerts"
- [ ] Alerts: expiring soon (3-7 days), expired (0 days), non-compliant (missing required)
- [ ] Click alert → filtered list (e.g., all workers with red status)
- [ ] Alert counts update when documents are approved/rejected

### R-CD-04: Bulk Export (CSV/PDF)
**Current:** No export.
**Target:** One-click export all worker compliance data as CSV (Excel) or PDF report.
**Acceptance:**
- [ ] "Export as CSV" button → downloads `compliance-report-{date}.csv` with columns: name, email, score, required_docs_completed, last_updated
- [ ] "Export as PDF" button → downloads formatted report with agency name, generated date, all workers + scores
- [ ] Large export (500+ rows) handles gracefully (no timeout, shows progress)

### R-CD-05: Compliance Scoring Consistency
**Current:** Score calculated frontend (Phase 4). Coordinator dashboard needs same logic.
**Target:** Compliance score calculation identical to worker portal: (completed_required / total_required) * 100.
**Acceptance:**
- [ ] Coordinator dashboard scores match worker-portal scores (verified by test)
- [ ] Score updates in real-time when document is approved/rejected (no page refresh needed)
- [ ] Formula: same as R-WP-03 from Phase 4

### R-CD-06: Coordinator Actions from Dashboard
**Current:** Coordinator edits worker detail page.
**Target:** Quick actions from list: view profile (modal), approve/reject document, change worker status (active/inactive).
**Acceptance:**
- [ ] Click worker row → modal with worker profile + pending documents
- [ ] Approve/reject buttons in modal with rejection reason field
- [ ] Bulk action checkbox: select workers → deactivate all (for archived workers)
- [ ] All actions logged to AuditLog with `userId` and `action`

### R-CD-07: Audit Log View (Read-Only)
**Current:** Audit log endpoint exists (Phase 3).
**Target:** Dashboard shows recent agency actions: "User X approved document Y", "Worker Z uploaded DBS", etc.
**Acceptance:**
- [ ] Table: action, entity, who, when
- [ ] Filterable by action type (document.approved, document.rejected, worker.created, etc.)
- [ ] Last 50 actions shown, paginated
- [ ] Read-only (no edit capability)

### R-CD-08: Dashboard Performance
**Current:** N+1 risk on worker list (Phase 3 TODO).
**Target:** Load all workers + compliance scores in one optimized query (no N+1).
**Acceptance:**
- [ ] No N+1: single SQL query with aggregations (completed docs count per worker)
- [ ] Dashboard loads in <2s on 4G even with 200 workers
- [ ] API response caching: 60s (memoized in Redis or in-memory)

### R-CD-09: Mobile Responsiveness (Coordinator Dashboard)
**Current:** Coordinator UI responsive but not mobile-optimized.
**Target:** Dashboard usable on tablets (iPad). Desktop primary. Mobile secondary (squeezed but functional).
**Acceptance:**
- [ ] Desktop ≥1024px: full layout (list + filters side-by-side)
- [ ] Tablet 768–1023px: stacked layout (filters above list)
- [ ] Mobile <768px: full-width list, filters collapsible
- [ ] No horizontal scrolling

### R-CD-10: Error Handling & Validation
**Current:** Basic error messages.
**Target:** Clear error messages for common failures: export timeout, invalid filters, permission denied.
**Acceptance:**
- [ ] Bulk export fails gracefully: show "Export in progress" spinner, retry on timeout
- [ ] Permission denied (non-OWNER/ADMIN) → HTTP 403, show "Access denied"
- [ ] Stale data warning: "Data last updated 5 minutes ago. Click to refresh."

---

## Boundaries

**In Scope:**
- All-workers compliance list with live scores
- Filter/sort by status, name, compliance
- Active alerts (expiring, expired, non-compliant)
- Bulk CSV/PDF export
- Quick-action modal (approve/reject/deactivate)
- Audit log view
- Performance optimization (no N+1)
- Mobile responsiveness (tablet-first, mobile secondary)

**Out of Scope (Phase 6+):**
- Audit pack generator (one-worker bundle for CQC) → Phase 6
- Shift assignment based on compliance → Phase 7
- Custom compliance thresholds per agency → Phase 8
- API for external rota tools → Phase 8
- Compliance history / trend analytics → Phase 7

---

## Constraints

- No new services (use existing Postgres, Redis if available)
- No bulk operations beyond deactivate (Phase 6 adds re-activate, archive)
- Export limited to agency scope (no cross-agency data)
- Mobile: tablet-optimized (iPad), mobile secondary

---

## Acceptance Criteria (Gate)

- [ ] All 10 requirements satisfied
- [ ] Compliance scores match Phase 4 logic (unit test)
- [ ] Dashboard loads <2s with 200 workers (performance test)
- [ ] No N+1 queries (SQL audit)
- [ ] Mobile responsive (tested on tablet + desktop)
- [ ] All coordinator actions logged to AuditLog
- [ ] Export handles 500+ rows gracefully

---

## Ambiguity Report

**Auto-selected defaults (--auto mode):**
- Goal clarity: 0.85 ✓
- Boundary clarity: 0.80 ✓
- Constraint clarity: 0.75 ✓
- Acceptance: 0.82 ✓
- **Ambiguity: 0.18** → GATE PASSED

---

*SPEC.md locked. Ready for discuss-phase.*
