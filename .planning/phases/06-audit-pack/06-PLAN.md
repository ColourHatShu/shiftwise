# Phase 6 Plan: Audit Pack & Compliance Reports

**Estimate:** 14 hours (5 slices)

## Slices

### 1. Audit Pack Service (3h)
- backend/src/lib/audit-pack-service.js
  - generateAuditPack(workerId) → ZIP file
  - generateComplianceReport(agencyId) → PDF
  - generateSnapshot(agencyId) → JSON snapshot
  - bulkExport(workerIds) → nested ZIP

### 2. API Endpoints (2h)
- POST /api/agency/audit-pack/{workerId}
- POST /api/agency/audit-pack/bulk
- POST /api/agency/compliance-report
- GET /api/agency/compliance-snapshot

### 3. Frontend UI (3h)
- Audit pack modal in dashboard
- Export report button
- CQC checklist view
- Custom thresholds settings page

### 4. Custom Thresholds + Cron (3h)
- Add thresholds to Agency model
- Extend cronService to apply custom thresholds
- Snapshot scheduling (daily/weekly)

### 5. Testing (3h)
- Audit pack generation tests
- Report PDF rendering tests
- Custom thresholds verification
- 33+ test cases, >80% coverage

---

5 commits. All 10 SPEC requirements met.
