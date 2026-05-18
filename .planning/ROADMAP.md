# ShiftWise — Milestone 1 Roadmap

**Milestone:** No-cost hardening + free OCR swap
**Granularity:** Coarse — 3 phases
**Mode:** Vertical MVP per phase
**Total requirements:** 29 across SEC, AUTH, FILE, ENC, ALRT, OBS, AUDIT, UX, OCR

---

### Phase 1: Security & Auth Foundations
**Goal:** Eliminate the biggest current security gaps with zero new services. By end of phase: no committed secrets, RBAC enforced, encrypted-file access is auth-gated, encryption upgraded to authenticated cipher, auth helpers consolidated, alert dedup is race-safe.
**Mode:** mvp
**UI hint:** no
**Requirements:** SEC-01, AUTH-01, AUTH-02, AUTH-03, FILE-01, FILE-02, FILE-03, ENC-01, ENC-02, ENC-03, ENC-04, ALRT-01, ALRT-02
**Success Criteria:**
1. `.env.example` contains no real secrets and the previously-committed Clerk dev keys are rotated in the Clerk dashboard.
2. A `VIEWER`-role user attempting to delete a worker via the API receives HTTP 403; the same call from an `OWNER`/`ADMIN` succeeds.
3. Hitting `/uploads/<filename>` directly returns 404; the same file is retrievable only through `GET /api/documents/:id/download` with a valid token for the owning agency.
4. Uploading a new document encrypts with AES-256-GCM and stores `encryptionAlgorithm: 'aes-256-gcm'`; downloading an old CBC-encrypted document still decrypts and streams correctly.
5. Only one `lib/auth.js` helper exists in `backend/src/lib/`; routes import from it and the four legacy helpers are deleted.
6. Two concurrent invocations of `checkExpiriesAndAlert` on the same document/day produce exactly one `ExpiryAlert` row (verified by a unique-constraint violation handled gracefully).

---

### Phase 2: OCR Swap (llava → Tesseract.js)
**Goal:** Replace the unreliable llava-based AI scan with a free, deterministic Tesseract.js + regex pipeline that runs in-process. By end of phase: uploads return instantly, document expiry dates are auto-extracted from clean printed UK documents, no external AI service is required, the frontend's existing analysis-result UI continues to work unchanged.
**Mode:** mvp
**UI hint:** yes (small — Scanning... state on upload)
**Requirements:** OCR-01, OCR-02, OCR-03, OCR-04, OCR-05, OCR-06, OCR-07
**Success Criteria:**
1. Uploading any allowed document returns HTTP 201 in under 500 ms regardless of file size up to the 10 MB limit (no synchronous OCR wait).
2. A test passport image yields an `analysisResult` with the `expiryDate` field populated (from MRZ parse) within 30 s of upload, written back to the document row.
3. The `analysisResult` JSON keeps the existing shape — frontend renders without any frontend changes beyond a `Scanning...` placeholder.
4. `fullName` and `documentNumber` do not appear anywhere in the stored `analysisResult` JSON (verified by reading rows from Prisma Studio).
5. `package.json` no longer lists `pdf-to-img`; `backend/src/routes/documents.js` no longer references Ollama; the `OLLAMA_*` env vars are removed from `.env.example`.
6. Tesseract.js extraction works fully offline — disconnecting from the internet does not break document scanning.

---

### Phase 3: Observability & Operational UX
**Goal:** Make the running system inspectable in production and easier to use day-to-day. By end of phase: production errors land in Sentry, an audit-log viewer surfaces every action taken in the system, coordinators can find workers by name or status without scrolling.
**Mode:** mvp
**UI hint:** yes
**Requirements:** OBS-01, OBS-02, OBS-03, OBS-04, AUDIT-01, AUDIT-02, UX-01, UX-02, UX-03
**Success Criteria:**
1. Throwing a manual error in any Express route surfaces a captured event in the Sentry dashboard (free-tier project).
2. Throwing a manual error in any client component surfaces a captured event in the Sentry dashboard (same project, with proper source maps).
3. With `SENTRY_DSN_BACKEND` unset and `NEXT_PUBLIC_SENTRY_DSN` unset, both apps start and run without error or Sentry initialization noise.
4. `/dashboard/audit-log` lists the last 50 actions for the current agency, paginates, filters by action and entity, and a non-OWNER/ADMIN user gets a 403 on the underlying API.
5. Typing `john` into the worker search input filters the worker list to only workers whose first name, last name, email, or job title contains `john` (case-insensitive). Switching the status dropdown to `INACTIVE` shows only inactive workers.

---

## Coverage validation

All 29 v1 REQ-IDs from `REQUIREMENTS.md` are mapped to exactly one phase:
- Phase 1: 13 REQs (SEC, AUTH, FILE, ENC, ALRT)
- Phase 2: 7 REQs (OCR)
- Phase 3: 9 REQs (OBS, AUDIT, UX)

## Build order rationale

1. **Phase 1 first** because every other phase depends on the unified `lib/auth.js` helper (the audit-log endpoint, the signed-download endpoint, the role checks) and because security gaps grow more expensive to retrofit the more code is written.
2. **Phase 2 second** because the OCR swap is self-contained and removing a noisy external AI dependency before adding observability means cleaner Sentry signal.
3. **Phase 3 last** because Sentry, audit log, and worker search are observability/UX polish — valuable but non-blocking. Audit-log endpoint also reuses the role middleware from Phase 1.

---

# ShiftWise — Milestone 2 Roadmap

**Milestone:** Compliance Portal (worker self-service + coordinator dashboard)
**Granularity:** Fine — 3-4 phases
**Mode:** Vertical slices per user type
**Total requirements:** TBD (to be locked during spec phase)

---

### Phase 4: Worker Self-Service Portal
**Goal:** Enable workers to upload their own compliance documents via OTP-based magic link auth. By end of phase: workers can log in, upload documents, see their compliance status with expiry colors, and receive pre-expiry notifications without coordinator involvement.
**Mode:** mvp
**UI hint:** yes (worker portal)
**Requirements:** (to be defined in spec phase)
**Success Criteria:** (to be defined in spec phase)

---

### Phase 5: Coordinator Compliance Dashboard
**Goal:** Give coordinators a complete compliance visibility layer. By end of phase: coordinators see all workers with compliance scores, can filter/sort by status, see alerts across the agency, and export compliance reports without manual work.
**Mode:** mvp
**UI hint:** yes (coordinator dashboard)
**Requirements:** (to be defined in spec phase)
**Success Criteria:** (to be defined in spec phase)

---

### Phase 6: Audit Pack & Compliance Reports
**Goal:** Make CQC-inspection prep a one-click operation. By end of phase: coordinators can generate a compliance bundle (all docs + audit trail for a worker) as a ZIP file, run compliance reports by worker/status, and produce an agency-wide compliance scorecard.
**Mode:** mvp
**UI hint:** yes
**Requirements:** (to be defined in spec phase)
**Success Criteria:** (to be defined in spec phase)

---

## Milestone 2 dependencies

- Depends on Phase 1 (auth helpers, role enforcement)
- Depends on Phase 3 (audit log endpoint)
- Assumes Tesseract.js + Resend email setup from Phase 2

---

# ShiftWise — Milestone 3 Roadmap

**Milestone:** Shift Management & Compliance-Aware Assignment  
**Granularity:** 2 phases  
**Mode:** Vertical MVP per phase

---

### Phase 7: Shift Management & Creation
**Goal:** Enable coordinators to post shifts at care facilities. By end of phase: coordinators can create shifts (date, time, location, role, required headcount), specify compliance requirements, and manage shift details. Workers see available shifts matching their qualifications.
**Mode:** mvp
**UI hint:** yes (shifts view)
**Requirements:** (to be defined in spec phase)
**Success Criteria:** (to be defined in spec phase)

---

### Phase 8: Compliance-Based Shift Assignment
**Goal:** Assign workers to shifts only if compliant. By end of phase: coordinators can bulk-assign compliant workers to shifts, system prevents assigning non-compliant workers (missing docs or expired), and workers can view their assigned shifts with confirmation workflow.
**Mode:** mvp
**UI hint:** yes (assignment workflow)
**Requirements:** (to be defined in spec phase)
**Success Criteria:** (to be defined in spec phase)

---

## Build order rationale

Phase 7 (Shift Management) before Phase 8 (Assignments) because assignments depend on shift infrastructure. Both depend on Phases 1-6 (auth, compliance tracking, dashboards).
