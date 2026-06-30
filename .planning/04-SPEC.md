# Phase 4 SPEC: Worker Self-Service Portal

**Phase Goal:** Enable healthcare workers to independently upload compliance documents, view their compliance status with real-time expiry tracking, receive proactive pre-expiry notifications, and see a clear checklist of required vs. optional documents. Reduce coordinator time chasing workers for documents while maintaining hybrid upload capability for workers who cannot self-serve.

**Success Outcome:** Workers self-serve document uploads; coordinators spend zero time chasing for missing docs. Workers receive notifications before expiry, can see which docs are required, and understand their compliance status at a glance.

---

## Requirements

### R-WP-01: Mobile-First Worker Portal (frontend)

**Current State:** Worker dashboard exists at `/app/worker/dashboard` with basic upload + document list. Styled for desktop; responsive but not optimized for mobile.

**Target State:** Complete redesign optimized for field workers (nurses, carers) accessing from phones between shifts. Supports both portrait and landscape. Handles touch interactions naturally. Load time <2s on 4G.

**Acceptance Criteria:**
- [ ] Portal loads in <2 seconds on 4G connection (measure with Lighthouse)
- [ ] Single-handed operation possible: all inputs/buttons reachable on mobile screen without pinch/scroll
- [ ] Touch targets are ≥48px (meeting WCAG mobile standards)
- [ ] Tested and confirmed working on: iPhone 12+, Samsung Galaxy S20+, iPad (tablet)
- [ ] No horizontal scrolling required; vertical scroll only on mobile

**Notes:** This is a complete redesign of the existing page component.

---

### R-WP-02: Camera Capture for Document Upload

**Current State:** File input accepts PDF and image files only. Workers must have pre-prepared documents on their phone or desktop.

**Target State:** Mobile-aware camera button that lets workers photograph physical documents directly (DBS card, passport, certificate, etc.). Backend converts camera photos to optimized PDFs.

**Acceptance Criteria:**
- [ ] On mobile, a "Take Photo" button appears alongside "Choose File"
- [ ] Clicking "Take Photo" opens device camera via HTML5 `<input type="file" capture="environment">`
- [ ] Captured image is automatically optimized (rotation corrected, resized to 2MB max) before upload
- [ ] Uploaded camera photos are indistinguishable from PDFs in the portal (same encryption, storage, audit trail)
- [ ] Falls back gracefully to file picker on desktop (no "Take Photo" button)
- [ ] Works offline: photo is cached locally if upload fails, and retried when connection returns

**Notes:** Uses native device camera, no third-party library required initially (HTML5 `capture` attribute).

---

### R-WP-03: Compliance Checklist with Score

**Current State:** Document list shows uploaded documents. No indication of what's required vs. optional. No progress indicator.

**Target State:** Display required vs. optional document types (from `DocumentType.isRequired`). Show a checklist with progress bar: "3 of 5 required documents complete". Color-code status (red = missing required, yellow = required but expiring, green = all required docs valid).

**Acceptance Criteria:**
- [ ] Checklist displays all document types configured for the agency
- [ ] Each document marked as "Required" or "Optional" based on `DocumentType.isRequired`
- [ ] Progress bar shows: "{completed} of {required} documents complete"
- [ ] Checklist is color-coded:
  - Red: at least one required document is missing or expired
  - Yellow: all required documents present but at least one is expiring (< 30 days)
  - Green: all required documents present and valid (> 30 days)
- [ ] Compliance score (0–100) displayed prominently:
  - 100% = all required docs present and valid
  - Calculation: `(completed_required / total_required) * 100`
- [ ] Worker can see which documents are overdue (red status badge)

**Notes:** Compliance score is a visual indicator only in Phase 4; not used for shift assignment (that's coordinator dashboard in Phase 5).

---

### R-WP-04: Multi-Milestone Pre-Expiry Notifications

**Current State:** No worker-facing notifications. Coordinators receive expiry alerts via email (daily cron at 08:00).

**Target State:** Workers receive email notifications at multiple milestones before expiry (90, 60, 30, 14, 7, 3, 1 day, and on expiry date). Notifications are personalized, actionable, and include a link to the worker portal.

**Acceptance Criteria:**
- [ ] Notification sent 90 days before expiry (first alert)
- [ ] Notification sent 60 days before expiry
- [ ] Notification sent 30 days before expiry
- [ ] Notification sent 14 days before expiry
- [ ] Notification sent 7 days before expiry
- [ ] Notification sent 3 days before expiry
- [ ] Notification sent 1 day before expiry
- [ ] Notification sent on expiry date (document is now EXPIRED)
- [ ] Each notification includes: document type, expiry date, link to worker portal
- [ ] No duplicate notifications on the same day (unique constraint on date)
- [ ] Failed notifications are queued in `FailedAlert` and retried hourly (reuse existing DLQ logic)
- [ ] Worker can see notification history in the portal (optional: defer to Phase 5 if too much scope)

**Notes:** Uses existing Resend email infrastructure and `ExpiryAlert` model. Trigger: daily cron at 08:00 UTC, same as coordinator alerts.

---

### R-WP-05: Document Rejection with Coordinator Feedback

**Current State:** Coordinators can approve/reject documents, but workers see only status change. No reason provided.

**Target State:** When a coordinator rejects a document, they add a brief reason (e.g., "illegible date on passport," "signature missing"). Worker sees the rejection reason and knows how to resubmit.

**Acceptance Criteria:**
- [ ] Coordinator rejection workflow includes optional `rejectionReason` field (100 char max)
- [ ] When worker views rejected document, reason is displayed (e.g., "Illegible date on passport — please resubmit")
- [ ] Worker can re-upload a new version of the same document type
- [ ] Previous rejected versions are visible in history (optional feature)
- [ ] Rejection reason is logged in `AuditLog` for compliance audit

**Notes:** Leverages existing `ComplianceDocument.rejectionReason` column. Frontend: add reason field to coordinator approval UI (done in coordinator dashboard, Phase 5).

---

### R-WP-06: Dynamic Document Type Dropdown

**Current State:** Document types are hardcoded in the worker portal frontend (hardcoded `<option>` values).

**Target State:** Document type dropdown populated dynamically from the agency's configured `DocumentType` records via API.

**Acceptance Criteria:**
- [ ] `GET /api/worker/document-types` endpoint returns agency's document types (name, id, required, expiryWarningDays)
- [ ] Worker portal fetches document types on load and populates dropdown dynamically
- [ ] If agency has zero document types, form shows placeholder: "No document types configured. Contact your coordinator."
- [ ] Dropdown is sorted: required documents first, then optional

**Notes:** Simple endpoint addition; reuses existing agency scoping logic.

---

### R-WP-07: Session Persistence & Offline Awareness

**Current State:** Worker sessions use JWT in HTTP-only cookie. No offline indicators.

**Target State:** Worker can view cached compliance status when offline (expiry colors, document list). Uploads attempted when offline are queued locally and retried when connection returns.

**Acceptance Criteria:**
- [ ] Offline notification appears: "You're offline. Cached data shown below."
- [ ] Document list (names, statuses, expiry dates) is cached on first load and shown during offline access
- [ ] Attempted uploads while offline are stored in browser `localStorage` and retried automatically when connection returns
- [ ] Retry succeeds without user intervention (polling every 10 seconds)
- [ ] User is notified when offline upload succeeds: "Upload complete!"
- [ ] Max 1 queued upload per session (don't queue 10 uploads; assume user will retry manually if critical)

**Notes:** Uses standard offline PWA patterns (service worker optional; initial implementation can use localStorage + navigator.onLine polling).

---

### R-WP-08: Email Template for Worker Notifications

**Current State:** Worker notifications do not exist.

**Target State:** Professional, clear email template for pre-expiry alerts sent to workers. Should include: document type, expiry date, days remaining, action button ("View Document"), and agency contact info.

**Acceptance Criteria:**
- [ ] Email template is responsive (mobile-friendly)
- [ ] Includes: document type, expiry date, days remaining, call-to-action button to worker portal
- [ ] Subject line is clear: e.g., "[Action Required] Your DBS Check Expires in 7 Days"
- [ ] Unsubscribe link included (via Resend)
- [ ] Template can be customized by agency (agency name, phone, email) in Phase 5

**Notes:** Similar to existing coordinator notification template in `sendExpiryAlert` (Resend); adapt for worker audience.

---

### R-WP-09: Audit Trail for Worker Actions

**Current State:** Coordinator actions (approve, reject, upload) are logged in `AuditLog`. Worker uploads are not explicitly logged.

**Target State:** Every worker action (upload, re-upload, view document) is logged with timestamp, IP, user agent for compliance audit.

**Acceptance Criteria:**
- [ ] Worker upload is logged: `{ action: 'document.uploaded', entity: 'ComplianceDocument', entityId: '{docId}', metadata: { fileName, fileSize }, userId: '{workerId}' }`
- [ ] Worker document view is logged: `{ action: 'document.viewed', entity: 'ComplianceDocument', entityId: '{docId}', userId: '{workerId}' }`
- [ ] IP address and user agent captured for all actions (security audit)
- [ ] Audit log is accessible via existing `/api/audit-log` endpoint (filtered by agency scope)

**Notes:** Reuses existing `AuditLog` infrastructure. Coordinator can audit worker actions via the audit log viewer (Phase 3).

---

### R-WP-10: Error Handling & Validation

**Current State:** Basic form validation (file size, type). Limited error messages.

**Target State:** Clear, actionable error messages for common failure modes.

**Acceptance Criteria:**
- [ ] File too large: "File size must be under 10 MB. Your file is {actualSize} MB."
- [ ] Invalid file type: "Only PDF and image files (JPG, PNG) are allowed."
- [ ] Network timeout: "Upload took too long. Check your connection and try again."
- [ ] Coordinator rejection received: Shows reason and "Re-upload a new version" button
- [ ] Upload fails halfway: Offer retry without losing form state
- [ ] No silent failures: Every error is shown to user with context

**Notes:** Improves existing error handling in worker dashboard page.

---

## Boundaries

### In Scope (Phase 4)
- Worker self-service document upload (PDF, images, camera photos)
- Mobile-first portal UI (responsive, touch-friendly)
- Compliance checklist + compliance score (required vs. optional documents)
- Multi-milestone pre-expiry notifications (90/60/30/14/7/3/1 days + expiry date)
- Document rejection with coordinator feedback
- Worker session persistence + offline caching
- Dynamic document type dropdown
- Audit trail for worker actions
- Email template for notifications

### Out of Scope (Deferred to Phase 5+ or existing)
- **Coordinator upload capability** — Keep existing; don't remove. Hybrid model maintained.
- **Coordinator compliance dashboard** — Phase 5 deliverable (all-workers view, filtering, bulk ops)
- **Bulk document export / compliance reports** — Phase 6
- **Push notifications** — Phase 5 (email only in Phase 4)
- **Worker profile settings** (timezone, language, notification preferences) — Phase 5
- **Document request from coordinator** (coordinator can't send "upload DBS" requests) — Phase 5
- **Advanced OCR** (Phase 2 provides basic Tesseract.js extraction; no vision API here)
- **Multi-language support** — Out of scope for v1 (UK-focused)
- **Document versioning** (show all previous uploads) — Phase 5
- **Worker-to-coordinator messaging** — Phase 5+

---

## Constraints

### Performance
- Upload returns HTTP 201 in < 500 ms (non-blocking; async OCR)
- Portal home loads in < 2 seconds on 4G
- Offline list loads instantly from cache
- Notification send latency: < 5 seconds from cron trigger

### Data & Privacy (UK Regulatory)
- All data encrypted at rest (AES-256-GCM, Phase 1)
- All worker data scoped by `agencyId` (multi-tenant isolation)
- Audit trail immutable (no updates to `AuditLog` records)
- Camera photos are treated as sensitive health-adjacent data; no plaintext storage

### Compatibility
- Works on: iOS 14+, Android 11+, desktop browsers (Chrome, Safari, Firefox)
- No external dependencies beyond what's already in `package.json`
- Graceful degradation on older phones (camera fallback to file picker)

### Scale
- Assume <1000 workers per agency initially
- Assume <10 documents per worker
- Notification spike: < 100 emails/second during daily 08:00 cron

---

## Acceptance Criteria (Go/No-Go)

### Minimum Viable Product
- [ ] Worker can upload document, see it in list with status and expiry color
- [ ] Worker receives pre-expiry email notification at 30-day, 7-day, 1-day milestones
- [ ] Compliance checklist shows "X of Y required documents complete"
- [ ] Compliance score (0–100) displayed and color-coded
- [ ] Mobile UI is usable on iOS and Android (verified by user testing)
- [ ] Camera capture works on mobile (or graceful fallback to file picker)
- [ ] Coordinator rejection shows reason to worker
- [ ] Worker can re-upload rejected document

### Quality Bar
- [ ] No unhandled errors in Sentry (caught in Phase 3)
- [ ] All worker actions logged to `AuditLog`
- [ ] Email notifications sent within 5 seconds of cron trigger
- [ ] Offline caching tested: documents visible without internet
- [ ] Unit tests: 80%+ coverage for notification logic
- [ ] E2E test: worker uploads → gets approval → receives notification

### User Experience Bar
- [ ] First-time user can upload a document without help (usability test)
- [ ] Worker can see which docs are required vs. optional (visual clarity)
- [ ] No more than 2 taps to upload a document on mobile (efficiency)

---

## Ambiguity Report

**Final Ambiguity Score: 0.16** (PASSED GATE ✓)

| Dimension | Score | Status | Notes |
|-----------|-------|--------|-------|
| Goal Clarity | 0.88 | ✓ Excellent | Phase goal is specific: self-serve uploads, checklist, notifications, hybrid capability |
| Boundary Clarity | 0.78 | ✓ Good | Clear what's in (notifications, checklist, mobile) and out (coordinator dashboard, bulk export) |
| Constraint Clarity | 0.75 | ✓ Good | Mobile-first, encryption, performance (< 2s load, < 500ms upload) locked |
| Acceptance Criteria | 0.78 | ✓ Good | Go/no-go criteria defined: checklist, score, mobile UX, notifications, offline |

All dimensions exceed minimum thresholds. Ready for discuss-phase.

---

## Phase Dependencies

- **Blocks:** Phase 5 (Coordinator Dashboard), Phase 6 (Audit Pack)
- **Depends on:** Phase 1 (auth helpers, role enforcement), Phase 2 (Tesseract.js + Resend), Phase 3 (Sentry + AuditLog endpoint)
- **Assumes:** Worker OTP auth already working, document encryption in place

---

## Estimates (Rough, for discussion-phase)

- **Backend APIs:** 3–4 days (notification pipeline, rejection feedback, document-types endpoint)
- **Frontend (mobile design):** 5–6 days (redesign, camera integration, offline caching)
- **Testing:** 2–3 days (E2E, mobile device testing, notification retry logic)
- **Total:** ~2 weeks (solo developer)

---

*SPEC.md locked. Ready for `/gsd-discuss-phase 4` to design HOW to implement.*
