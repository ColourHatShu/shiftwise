# Phase 4 Context — Worker Self-Service Portal

**Date:** 2026-05-18 (Updated)
**Phase:** 04 — Worker Self-Service Portal  
**Goal:** Enable field workers to self-serve document uploads, view compliance status with real-time scoring, receive pre-expiry notifications, and understand document requirements without coordinator nagging.

---

## Spec Lock

**SPEC.md locked:** `.planning/04-SPEC.md` — 10 requirements (R-WP-01 through R-WP-10) with acceptance criteria.

Key requirements (not re-discussed here):
- Mobile-first portal (workers are field workers)
- Compliance checklist + score (required vs. optional docs)
- Multi-milestone notifications (90/60/30/14/7/3/1 days before expiry)
- Document rejection with coordinator feedback
- Offline support (cached documents, queued uploads)
- Audit trail for all worker actions

**Do NOT add features beyond SPEC.md boundaries.** Coordinator dashboard, bulk export, push notifications are Phase 5+.

---

## Domain

**Worker self-service compliance portal** — Workers upload documents, see compliance status with visual scoring, receive email notifications as deadlines approach, and resubmit if documents are rejected.

---

## Decisions (Implementation)

### Mobile-First Redesign Strategy

**Decision:** Complete redesign of worker portal (`frontend/app/worker/dashboard/page.tsx`), optimized mobile-first for field workers on iOS/Android.

**Rationale:** 
- Workers are nurses/carers between shifts — accessing portal on phones mid-day
- Current desktop-first responsive design doesn't leverage mobile conveniences (camera, touch, layout)
- Mobile-first forces clear information hierarchy (critical first, details below)

**Specific choices:**
- **Component library:** Keep Tailwind CSS (already in project), no new deps. Use mobile-first breakpoints (`sm:`, `md:`, `lg:`).
- **Layout:** Single-column mobile, stacked sections. Avoid cards/modals on <480px (hard to tap).
- **Touch targets:** All buttons ≥48px height (WCAG mobile standard).
- **Typography:** Larger base font (18px on mobile for readability between tasks).
- **Interactions:** Pull-to-refresh (optional, Phase 5), one-tap upload, no hover states that don't work on touch.
- **Load time target:** <2s on 4G (Lighthouse measure). Cache document list locally to hit this.

**Code location:** Rewrite `frontend/app/worker/dashboard/page.tsx` entirely (227 lines → ~400 lines with new features). Keep existing API client helpers in `frontend/lib/api/worker.ts`.

---

### Camera Capture Implementation

**Decision:** Use HTML5 `<input type="file" capture="environment">` for native device camera on mobile; graceful fallback to standard file picker on desktop.

**Rationale:**
- No external dependencies (no Expo, no react-camera-pro)
- Works on 95%+ of modern iOS/Android devices
- Automatically handles orientation, device permissions
- Zero learning curve for users (native camera experience)
- Fallback file input handles desktop perfectly

**Specific choices:**
- **UX:** Two buttons on mobile: "Take Photo" (camera input) + "Choose File" (file input). On desktop, only "Choose File" visible.
- **Photo optimization:** Client-side resize to max 2MB (using Canvas + JPEG compression 0.8) before upload. Corrects EXIF rotation automatically.
- **Upload:** Treated identical to PDF — same encryption, storage, audit trail. No distinction in UI or backend.
- **Error handling:** Permission denied → show "Camera access required" + fallback to file picker. User can retry or choose file instead.

**Coordinator perspective:** Workers' camera photos appear as documents with same status/expiry/audit trail as coordinator-uploaded PDFs. No visual distinction.

**Code location:**
- `frontend/app/worker/dashboard/page.tsx` — Camera/file input UI with JS photo optimization
- `frontend/lib/api/worker.ts` — New helper `optimizePhoto(file: File): Promise<File>` using Canvas
- No backend changes (existing upload endpoint handles both)

---

### Offline Data Caching Strategy

**Decision:** localStorage for document list caching + Service Worker for offline fallback + smart retry on reconnection.

**Rationale:**
- Workers may check compliance status in areas with spotty coverage (between shifts, during breaks)
- localStorage is browser-native, no setup, persists across sessions
- Service Worker gives true offline capability (show cached docs without network)
- Combined: workers see stale documents offline, auto-refresh when connection returns

**Specific choices:**
- **Document cache:** On successful load, store document list in `localStorage['worker_docs_cache']` (JSON, max 1MB). Cache expires after 1 hour or on manual refresh.
- **Offline banner:** Show "You're offline. Showing cached data." when `navigator.onLine = false`.
- **Queued uploads:** If upload fails (network error), store in `localStorage['worker_uploads_queue']` with file ID. Poll every 10s when online; retry automatically.
- **Max queue depth:** 1 upload max (users expect to retry manual uploads; don't queue 10).
- **Retry success:** On successful retry, show toast: "Cached upload complete!" + refresh list.
- **Service Worker (Phase 5+):** Initial MVP uses localStorage polling. Service Worker upgrade deferred (adds complexity, marginal gain for 95% uptime areas).

**Code location:**
- `frontend/app/worker/dashboard/page.tsx` — offline detection, document cache load, queued-upload UI
- New file: `frontend/lib/worker-offline.ts` — helper functions (cacheDocuments, queueUpload, getOfflineDocuments, etc.)
- No backend changes

---

### Compliance Score Calculation (Frontend)

**Decision:** Calculate compliance score on the frontend in real-time (0–100%). Backend provides required/optional metadata; frontend does the math.

**Rationale:**
- **Immediate feedback:** Workers see score update instantly after upload (no wait for API call)
- **Simpler API:** Don't add a `/api/worker/compliance-score` endpoint; reuse existing `GET /api/worker/documents`
- **Accuracy:** Current state of documents (from API) is the source of truth; frontend computation is deterministic
- **Fallback:** If API fails, at least document list still loads; score calculation is optional UI sugar

**Specific formula:**
```
completed_required = count(documents where status='APPROVED' AND isRequired AND expiryDate > today)
total_required = count(documentTypes where isRequired)
score = (completed_required / total_required) * 100  (or 0 if total_required=0)
color_code:
  - Red: score < 100 OR any document < 30 days to expiry
  - Yellow: score = 100 AND at least one document between 5-30 days
  - Green: score = 100 AND all documents > 30 days
```

**Code location:**
- `frontend/app/worker/dashboard/page.tsx` — compliance score calculation, color coding
- New helper: `frontend/lib/worker-compliance.ts` — functions like `calculateComplianceScore()`, `getComplianceColor()`, `getComplianceMessage()`
- No backend changes

---

### Multi-Milestone Notification Pipeline

**Decision:** Extend existing coordinator-notification cron job (`backend/cronService.js`) to also generate worker notifications at 90, 60, 30, 14, 7, 3, 1 day, and expiry-date milestones.

**Rationale:**
- Coordinator notifications already run daily at 08:00 UTC with retry logic (FailedAlert DLQ)
- Adding worker notifications to same cron reuses infrastructure (same email service, retry queues)
- Single source of truth for "document is expiring soon" logic

**Specific choices:**
- **Cron timing:** Same job (`checkExpiriesAndAlert`) runs daily at 08:00 UTC. For each document, it calculates `daysUntilExpiry`:
  - If daysUntilExpiry ∈ {90, 60, 30, 14, 7, 3, 1}, create `ExpiryAlert` with `workerId`
  - If daysUntilExpiry = 0 (expiry date = today), also create alert
  - Use existing unique constraint on `(complianceDocumentId, daysUntilExpiry, alertDateOnly)` to prevent duplicates
- **Email template:** New worker-specific template (via Resend). Friendly tone, clear call-to-action, include portal link.
- **Retry:** Failed emails go to `FailedAlert` table; hourly retry (same as coordinator alerts)
- **Worker visibility:** Worker doesn't see notification history in Phase 4 (defer to Phase 5). Just receives emails.

**Code location:**
- `backend/src/cronService.js` — Extend `checkExpiriesAndAlert` to create ExpiryAlerts for both workers and coordinators
- New file: `backend/src/lib/emailTemplates.js` — Add `getWorkerExpiryTemplate(workerName, docType, expiryDate)`
- `backend/src/lib/nodemailer.js` — Add `sendWorkerExpiryAlert(worker, document, daysUntilExpiry)`
- No schema changes (reuse `ExpiryAlert`)

---

### Document Rejection with Feedback

**Decision:** Minimal Phase 4 implementation — coordinator adds `rejectionReason` text field when rejecting. Worker sees reason when viewing rejected document. Full workflow (rejection modal, re-upload flow) deferred to Phase 5.

**Rationale:**
- SPEC.md requirement: "Worker sees reason why document was rejected"
- Coordinator approval UI exists in `frontend/app/dashboard/` (Phase 3 artifact)
- Just need to extend that UI with a reason field; no major refactor needed
- Full "re-upload rejected document" flow with change-tracking deferred

**Specific choices:**
- **Coordinator UX:** When clicking "Reject" on a document, show modal: "Rejection Reason (optional)" textarea (max 200 chars). Example: "Passport photo quality too low — please retake."
- **Worker UX:** When viewing rejected document, show: `<badge>REJECTED</badge> Reason: "Passport photo quality too low — please retake." <button>Re-upload</button>`
- **Re-upload:** Worker can upload a new document for same document type (creates new ComplianceDocument row). Old rejected version stays in history (visible only to coordinators in audit log).
- **Backend:** Add optional `rejectionReason: String?` column to `ComplianceDocument` (already exists in schema). Update coordinator approval endpoint to accept reason on reject.

**Code location:**
- `frontend/app/dashboard/documents/` or route handling document approval — Add reason textarea to rejection modal
- `backend/src/routes/documents.js` — Extend PATCH endpoint to accept `rejectionReason` field
- `frontend/app/worker/dashboard/page.tsx` — Display rejection reason if status='REJECTED'
- Audit log already captures all actions; no extra work needed

---

### Optimistic UI for Uploads

**Decision:** Show upload as "PENDING" immediately (optimistic); refresh list after server confirms. Don't wait for 201 response to show the document.

**Rationale:**
- Faster perceived UX on 4G (upload visible instantly, even if server takes 300ms)
- Matches user expectation (document was just uploaded, should appear immediately)
- Graceful fallback: if upload fails, show error and remove optimistic doc from list

**Specific choices:**
- **Optimistic state:** Generate temp ID (uuid); add document to list with status='PENDING', uploadedAt=now
- **Upload request:** Send file; show "Uploading 45%" with progress bar
- **Success (201):** Remove optimistic doc, add real doc from server response. Toast: "Upload complete!"
- **Failure:** Remove optimistic doc, show error: "Upload failed — {error message} — try again"
- **Retry:** User can re-upload same file; each attempt is a fresh optimistic doc

**Code location:**
- `frontend/app/worker/dashboard/page.tsx` — Optimistic document state management using `useState`
- No backend changes

---

## Code Context

### Reusable Assets

**From Phase 1–3:**
- `backend/src/lib/auth.js` — Unified auth helpers (requireAgency, requireRole, etc.)
- `backend/src/lib/encryption.js` — AES-256-GCM encrypt/decrypt (Phase 1)
- `backend/src/lib/nodemailer.js` — Email sending via Resend (coordinator notifications template can be adapted)
- `backend/prisma/schema.prisma` — ExpiryAlert, FailedAlert, AuditLog models already exist

**From existing worker portal:**
- `frontend/app/worker-signin/page.tsx` — Worker OTP login (existing, keep as-is)
- `backend/src/routes/worker-auth.js` — OTP + JWT generation (existing, keep as-is)
- `backend/src/routes/worker-documents.js` — Document upload/download endpoints (extend to add rejection reason)
- `frontend/lib/api/worker.ts` — API client helpers (update to handle new rejection-reason display)

**Tailwind components to reuse:**
- Existing badge styles for status indicators
- Existing button variants (primary, secondary)
- Existing toast/alert components (react-hot-toast already in project)

### Patterns to Follow

- **Mobile breakpoints:** Follow existing Tailwind convention (`sm:`, `md:`, `lg:` for mobile-first)
- **API error handling:** Catch errors, show user-friendly messages, log to Sentry (Phase 3 artifact)
- **Audit trail:** Every worker action logged to `AuditLog` with `userId=workerId`, `agencyId`, `action`, `entity`, `metadata`
- **Encryption:** All document data uses existing GCM from Phase 1; no new crypto

---

## Canonical References

**Locked Requirements (MUST READ):**
- `.planning/04-SPEC.md` — 10 requirements (R-WP-01 through R-WP-10) with acceptance criteria and boundaries

**Project Context:**
- `.planning/PROJECT.md` — Core value: coordinator uploads → auto-tracks expiry → audit-ready for CQC
- `.planning/REQUIREMENTS.md` — Validation-level requirements (multi-tenant, encryption, audit logging)

**Phase Dependencies:**
- `.planning/phases/01-security-auth-foundations/01-CONTEXT.md` — Auth helper consolidation, encryption upgrade (Phase 1)
- `.planning/phases/03-observability-operational-ux/03-CONTEXT.md` — Sentry setup, audit log endpoint (Phase 3)

**Code References:**
- `backend/src/cronService.js` — Existing cron job for coordinator expiry alerts (extend for workers)
- `backend/src/routes/worker-documents.js` — Document upload endpoint (already supports workers)
- `backend/src/routes/worker-auth.js` — OTP + JWT flows (existing)
- `frontend/app/worker/dashboard/page.tsx` — Existing dashboard (complete redesign)
- `frontend/lib/api/worker.ts` — API client layer (extend helpers)
- `backend/prisma/schema.prisma` — ExpiryAlert, FailedAlert, AuditLog, ComplianceDocument models
- `backend/src/lib/nodemailer.js` — Email template patterns (adapt for worker notifications)

---

## Deferred Ideas

- **Push notifications** (SMS/in-app) — Phase 5 or later. Email only in Phase 4.
- **Worker notification preferences** (timezone, frequency, digest) — Phase 5.
- **Document versioning / history** (show all previous uploads) — Phase 5.
- **Coordinator bulk "upload for worker" via CSV** — Phase 5 (coordinator efficiency, not worker self-service).
- **Worker-to-coordinator messaging** (ask for help uploading) — Phase 5+.
- **Advanced OCR** (Vision API for handwritten docs) — Out of scope; Tesseract.js from Phase 2 is sufficient.

---

## Risk & Assumptions

**Risk: Offline caching complexity**
- **Assumption:** localStorage-based approach is sufficient for MVP (workers have 1h of connectivity daily)
- **Mitigation:** Cache invalidates after 1h; users see "stale data" banner if offline >1h
- **Fallback:** Service Worker upgrade in Phase 5 if adoption data shows longer offline periods

**Risk: Multi-milestone cron job overload**
- **Assumption:** 8 notification milestones (90/60/30/14/7/3/1/0 days) won't overwhelm Resend
- **Mitigation:** Existing FailedAlert DLQ handles retries; Resend free tier ~5k emails/month
- **Monitoring:** Sentry logs alert send times; if >5s per alert, optimize in Phase 5

**Assumption: Compliance score formula is stable**
- **Assumption:** Required docs don't change per-agency mid-phase
- **Mitigation:** Score calc is simple enough to refactor if business logic changes
- **Future:** Move to backend API in Phase 5 if agencies need custom scoring logic

---

## Success Criteria (Phase Verification)

- [ ] Worker can take photo of document on iPhone/Android, see it uploaded in <10s
- [ ] Compliance checklist shows "2 of 5 required documents complete" with visual progress
- [ ] Worker receives email 7 days before expiry and again 1 day before
- [ ] Offline: document list visible without internet; uploads queue and retry when online
- [ ] Coordinator rejects document with reason → worker sees reason and re-uploads
- [ ] Zero silent failures — all errors shown with actionable messages
- [ ] Mobile UI tested on real devices (iPhone 12+, Samsung Galaxy S20+, iPad)
- [ ] Lighthouse Performance score ≥75 on 4G throttle

---

## Next Steps

Run `/gsd-plan-phase 4` to create the detailed implementation plan.

This CONTEXT.md captures:
- ✅ SPEC.md locked requirements
- ✅ Implementation decisions on mobile, camera, offline, scoring, notifications, rejection, optimism
- ✅ Code locations and reusable assets
- ✅ Canonical references (SPEC.md is primary)
- ✅ Deferred ideas (not cut scope, just future phases)
- ✅ Risks and assumptions

The planner will use this to break Phase 4 into concrete tasks.
