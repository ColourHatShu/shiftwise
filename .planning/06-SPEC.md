# Phase 6 SPEC: Audit Pack & Compliance Reports

**Goal:** One-click CQC-ready audit packs (all docs + audit trail for one worker) + agency compliance scorecard.

---

## Requirements

### R-AP-01: Audit Pack Generator
- Single worker selected → generate ZIP: all docs (PDFs) + audit log (CSV) + compliance summary
- One-click download, <10s generation
- Acceptance: [ ] ZIP contains all docs, audit log, summary, [ ] downloads as `audit-pack-{worker-name}-{date}.zip`

### R-AP-02: Compliance Report (Agency-Wide)
- PDF report: agency name, date, all workers + compliance scores, summary stats
- Exportable as PDF
- Acceptance: [ ] Report generated <5s, [ ] includes all workers + scores, [ ] contains summary stats

### R-AP-03: Audit Trail (Worker-Specific)
- CSV export of all actions for one worker (uploads, approvals, rejections)
- Includes timestamp, action type, actor
- Acceptance: [ ] CSV includes timestamp, action, actor, [ ] sortable by date

### R-AP-04: Compliance Snapshot (Static View)
- Freeze compliance state at a point in time for audit purposes
- Snapshot includes: worker list, scores, document statuses, as-of date
- Acceptance: [ ] Snapshot captures point-in-time state, [ ] immutable (cannot edit), [ ] timestamped

### R-AP-05: CQC Readiness Checklist
- Show coordinator what's needed for CQC inspection: all workers compliant?, all docs not expired?
- Red/yellow/green status
- Acceptance: [ ] Shows all required checks, [ ] color-coded, [ ] clear action items

### R-AP-06: Custom Compliance Thresholds (Agency-Level)
- Agency owner can set custom thresholds (e.g., "DBS must be <3 years old")
- Overrides default 30-day warning
- Acceptance: [ ] Threshold configurable per document type, [ ] applied to scores and alerts

### R-AP-07: Bulk Audit Pack Export
- Export audit packs for multiple workers at once (e.g., top 10 non-compliant)
- Generates single ZIP with subdirectories per worker
- Acceptance: [ ] Bulk download works for 10+ workers, [ ] ZIP structure clear (subdirs)

### R-AP-08: Audit Pack Scheduling
- Coordinator can schedule audit packs to auto-generate daily/weekly (for trending)
- Stored in S3/R2 for 90 days
- Acceptance: [ ] Schedule configurable, [ ] auto-generation works, [ ] retrieval from storage

### R-AP-09: Performance: Report Generation
- PDF report generation <5s for 200 workers
- ZIP generation <10s
- Acceptance: [ ] PDF <5s, [ ] ZIP <10s, [ ] no timeouts

### R-AP-10: Error Handling & Recovery
- Failed report generation retries with clear error messages
- Partial failures handled gracefully (e.g., 1 doc corrupted, rest OK)
- Acceptance: [ ] Errors shown with context, [ ] retries work, [ ] partial success indicated

---

## Boundaries

**In Scope:**
- Single-worker audit pack (ZIP with docs + audit log)
- Agency compliance report (PDF)
- CQC readiness checklist
- Custom thresholds per agency
- Bulk export (multiple workers)
- Auto-scheduling (daily/weekly)
- Error handling

**Out of Scope (Phase 7+):**
- Real-time compliance trending / historical analytics
- Custom report templates per agency
- API for external integrations
- Print styling customization

---

## Acceptance Criteria

- [ ] All 10 requirements satisfied
- [ ] Audit pack ZIP generated <10s, contains all docs + audit log
- [ ] PDF report generated <5s, includes all workers + scores
- [ ] CQC checklist shows readiness status (red/yellow/green)
- [ ] Custom thresholds apply to scoring + alerts
- [ ] Bulk export works for 10+ workers
- [ ] Auto-scheduling functional (daily/weekly)
- [ ] Error handling graceful (partial success OK)

---

Ambiguity: 0.19 → GATE PASSED

*SPEC locked. Ready for planning.*
