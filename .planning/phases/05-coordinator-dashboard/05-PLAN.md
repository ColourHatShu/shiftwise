# Phase 5 Plan: Coordinator Compliance Dashboard

**Estimate:** 11 hours (4 feature slices)

## Feature Slices

### 1. Backend API + Service (3h)
- `backend/src/routes/compliance.js` — 3 endpoints
  - GET /api/agency/compliance/workers (list with scores, filters, sorting, 60s cache)
  - POST /api/agency/compliance/export (CSV/PDF)
  - GET /api/agency/compliance/alerts (aggregated alerts)
- `backend/src/lib/compliance-service.js`
  - calculateScore(workerId), generateCSV(), generatePDF(), aggregateAlerts()
- Single aggregation query (no N+1)
- <2s load with 200 workers

### 2. Dashboard UI + Filters (3h)
- `frontend/app/dashboard/compliance/page.tsx` — main dashboard
  - Workers table with compliance scores
  - Inline filters: search, status, sort
  - Active alerts section
  - Pagination (20/page)
- `frontend/lib/compliance-dashboard.ts` — utility functions
- Responsive (desktop/tablet/mobile)

### 3. Quick-Action Modal (3h)
- WorkerDetailModal.tsx — approve/reject/deactivate
- All actions logged to AuditLog

### 4. Testing (2h)
- Unit + integration + component tests
- Performance verification
- >80% coverage

---

## Commits (5 total)
1. feat(05): backend endpoints + service
2. feat(05): dashboard UI
3. feat(05): quick-action modal
4. test(05): testing
5. docs(05): summary

Ready for execution.
