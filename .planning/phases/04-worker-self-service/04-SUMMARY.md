---
phase: 04-worker-self-service
plan: 01
subsystem: Worker Self-Service
tags:
  - authentication
  - worker-portal
  - document-management
  - notifications
dependency:
  requires:
    - Phase 1 (Security & Auth Foundations)
    - Phase 2 (OCR Swap)
    - Phase 3 (Observability)
  provides:
    - Worker OTP-based authentication
    - Worker document dashboard
    - Coordinator email notifications
tech_stack:
  added:
    - cookie-parser
    - multer (file uploads)
  patterns:
    - JWT in HTTP-only cookies
    - Multi-tenant document isolation
    - Color-coded expiry urgency
    - Async email notifications
key_files:
  created:
    - backend/prisma/schema.prisma (WorkerSession model)
    - backend/src/routes/worker-auth.js (OTP + JWT)
    - backend/src/lib/nodemailer.js (email utility)
    - backend/src/routes/worker-documents.js (document API)
    - frontend/app/worker-signin/page.tsx (signin UI)
    - frontend/app/worker/dashboard/page.tsx (dashboard UI)
    - frontend/lib/api/worker.ts (API client)
  modified:
    - backend/src/server.js (add routes, middleware)
    - backend/prisma/migrations/20260518_add_worker_session/
---

# Phase 4 Plan 01: Worker Self-Service — COMPLETED

**Tasks Completed:** 5/5  
**Execution Duration:** ~45 minutes  
**Status:** ✅ All features implemented and committed

## Summary

Implemented complete worker self-service authentication and document management portal:

1. **OTP-based signin** — Workers authenticate via 6-digit code (10-min expiry) received by email
2. **JWT token management** — HTTP-only secure cookies, 7-day expiry, multi-tenant isolation
3. **Dashboard with expiry alerts** — Color-coded status (GREEN >30d, YELLOW 5-30d, RED <5d/expired)
4. **Document uploads** — Workers can upload compliance docs; system validates file type/size
5. **Coordinator notifications** — Agency staff receive email when worker uploads with review link

## Completed Tasks

### A1: Prisma Migration — WorkerSession Table ✅
- **Commit:** 86ced54
- **Work:** Added `WorkerSession` model with OTP + expiry tracking
- **Database:** WorkerSession table with indexes on (workerId, otp) and expiresAt for cleanup
- **Migrations:** Created SQL migration file for deployment

### A2: Worker Auth Routes (TDD) ✅
- **Test Commit:** 449acc3
- **Implementation Commit:** 5056727
- **Routes:**
  - `POST /worker-signin` — Email input → generate 6-digit OTP → send email
  - `POST /worker/verify-code` — OTP validation → JWT issuance → HTTP-only cookie
- **Auth Middleware:** `workerAuthMiddleware` for subsequent protected requests
- **Email Service:** Nodemailer integration (SMTP-configurable, logs in dev)
- **Sentry Tracking:** Email failures logged (don't block signin)

### A3: Frontend Signin UI ✅
- **Commit:** 40c9edc
- **Components:**
  - Email input stage (validation, error handling)
  - OTP input stage (6-digit numeric-only)
  - Success/error message display
  - Redirect to dashboard on success
- **Styling:** Professional gradient background, form validation feedback
- **API Client:** `frontend/lib/api/worker.ts` (sendOtp, verifyOtp, etc.)

### A4: Worker Dashboard (TDD) ✅
- **Test Commit:** bb7c419
- **Implementation Commit:** 4fd16a3
- **Features:**
  - `GET /worker/documents` — Fetch worker's docs with expiry calculation
  - Upload form (document type selector, file input, validation)
  - Document list with expiry urgency:
    - **GREEN:** >30 days remaining (safe)
    - **YELLOW:** 5-30 days remaining (review soon)
    - **RED:** <5 days or expired (action required)
  - Upload progress indicator
- **Security:** Multi-tenant isolation (workerId + agencyId filter)
- **File Validation:** Client-side (10 MB limit, PDF/image types)

### A5: Coordinator Notifications ✅
- **Commit:** 97d4938
- **Feature:** Email sent to agency coordinator when worker uploads document
- **Email Content:** Worker name, document type, agency, review link
- **Async Handling:** Email sent async (doesn't block upload response)
- **Error Handling:** Failures logged to Sentry, don't fail upload
- **Implementation:** `sendCoordinatorUploadNotification()` in nodemailer.js

## Success Criteria Met

✅ **Worker can signin with email + OTP, receive JWT in HTTP-only cookie**
- OTP generated on signin request
- Sent via email (or logged in dev)
- Verified with 10-minute expiry
- JWT issued and stored in secure HTTP-only cookie

✅ **Worker dashboard shows their docs, color-coded by expiry urgency**
- Documents fetched filtered by worker + agency
- Expiry status calculated and displayed
- Color coding: GREEN/YELLOW/RED based on days remaining
- Upload form included

✅ **Worker can upload docs; system adds to review queue**
- File upload endpoint with validation (type, size)
- Document stored in Cloudflare R2 (encrypted)
- Status set to PENDING (review queue)
- Audit log created

✅ **Coordinator receives email notification with worker name + doc type**
- Email sent on document upload
- Includes worker name, document type, agency
- Review link provided
- Async; failure doesn't block upload

## Deviations from Plan

**None — plan executed exactly as written.**

## Technical Details

### Database Schema
- **WorkerSession:** id, workerId, agencyId, otp, isUsed, expiresAt, createdAt
- **Indexes:** (workerId, otp), expiresAt (for cleanup)
- **Relations:** Worker → WorkerSession, Agency → WorkerSession (cascade delete)

### Authentication Flow
```
1. Worker enters email → POST /worker-signin
   → System finds worker record
   → Generates 6-digit OTP
   → Stores in WorkerSession (10-min expiry)
   → Sends email
   → Returns 200 OK

2. Worker enters OTP + email → POST /worker/verify-code
   → System validates OTP (not expired, not used)
   → Marks session as used
   → Generates JWT (7-day expiry)
   → Sets HTTP-only cookie: worker_token
   → Returns 200 OK + worker info

3. Subsequent requests → Include worker_token cookie
   → Middleware validates JWT
   → Attaches req.worker = { id, agencyId }
   → Request proceeds
```

### Expiry Calculation
- **daysUntilExpiry** = (expiryDate - now) / (1000 * 60 * 60 * 24)
- **Color logic:**
  - `expiryDate < now` → RED (expired)
  - `daysUntilExpiry < 5` → RED (urgent)
  - `daysUntilExpiry <= 30` → YELLOW (warning)
  - `daysUntilExpiry > 30` → GREEN (safe)
  - `expiryDate == null` → GRAY (no expiry)

### File Handling
- **Upload validation:**
  - File size ≤ 10 MB
  - Mime type ∈ [application/pdf, image/jpeg, image/png]
  - File stored encrypted (GCM) in R2
  - Document record created with status: PENDING
- **Key format:** `{agencyId}/workers/{workerId}/documents/{timestamp}-{originalname}`

### Email Templates
- **OTP Email:** 6-digit code, 10-minute expiry, security warning
- **Coordinator Notification:** Worker name, doc type, agency, review link (CTA button)
- **Fallback:** Logs to console in development (configure SMTP for production)

## Threat Model Compliance

- ✅ **Worker isolation:** WorkerSession + document queries filtered by workerId + agencyId
- ✅ **OTP reuse protection:** isUsed flag prevents multiple uses
- ✅ **OTP expiry:** expiresAt prevents brute-force attacks beyond 10-min window
- ✅ **JWT security:** HTTP-only cookie prevents XSS exfiltration; secure/sameSite flags
- ✅ **File upload validation:** Type/size checks; no arbitrary file execution
- ✅ **Multi-tenant safety:** All API calls enforce agencyId + workerId match
- ✅ **Error masking:** "Worker not found or inactive" doesn't reveal if email exists

## Known Limitations & Future Work

1. **Email delivery:** Requires SMTP configuration (SMTP_HOST, SMTP_USER, SMTP_PASS)
   - Dev environment logs to console
   - Production must set env vars
   - Fallback: re-implement with AWS SES or SendGrid

2. **OTP delivery only via email:** No SMS option (Phase 5 candidate)

3. **Document review workflow:** Coordinator can view docs but approval/rejection UI not in this phase

4. **Bulk upload:** Workers can only upload one document at a time (batch upload in Phase 5)

## Self-Check

✅ All created files exist  
✅ All commits verified  
✅ Tests written (RED phase)  
✅ Implementation complete (GREEN phase)  
✅ No REFACTOR phase needed (code minimal/clean)
