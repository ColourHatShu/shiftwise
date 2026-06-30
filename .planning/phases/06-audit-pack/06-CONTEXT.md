# Phase 6 Context: Audit Pack & Compliance Reports

**Goal:** CQC-ready audit packs + compliance reports for coordinators.

## Decisions

**Architecture:**
- Audit pack: single ZIP (docs + audit log CSV + summary JSON)
- Report generation: server-side with pdfkit (already in project)
- Storage: local filesystem or R2 (reuse existing storage)
- Scheduling: simple cron job (extend Phase 4 cronService.js)
- Custom thresholds: stored in Agency model (new fields)

**Backend:**
- `POST /api/agency/audit-pack/{workerId}` — generate and download audit pack
- `POST /api/agency/audit-pack/bulk` — bulk export for multiple workers
- `POST /api/agency/compliance-report` — generate PDF report
- `GET /api/agency/compliance-snapshot` — point-in-time snapshot
- New service: `backend/src/lib/audit-pack-service.js`

**Frontend:**
- Modal: "Generate Audit Pack" with worker selection, download link
- Dashboard button: "Export Compliance Report", "CQC Checklist"
- Settings page: Custom thresholds per document type

**Database:**
- Agency model: add `complianceThresholds` (JSON), `customThresholdEnabled` (boolean)
- New table: ComplianceSnapshot (agency, workers snapshot, asOfDate, data JSON)

---

Ready for planning.
