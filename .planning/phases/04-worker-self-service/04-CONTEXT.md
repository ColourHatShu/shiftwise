# Phase 4 Context — Worker Self-Service Portal

**Phase:** 04 — Worker Self-Service Portal  
**Goal:** Allow workers to view compliance status and upload documents directly, reducing coordinator burden.

## Decisions (Locked)

1. **Worker Signin:** Email-based OTP (one-time code) sent via Resend. No Clerk (workers not Clerk users). Code valid for 10 minutes.
2. **JWT Issuance:** Temporary JWT in HTTP-only cookie (7-day expiry), refreshable on demand.
3. **Dashboard Access:** Read-only view of own documents, expiries (color-coded), and alerts. No edit/delete.
4. **Document Upload:** Same endpoint as coordinator, routed to worker's agency. Auto-creates ComplianceDocument with worker metadata.
5. **Notifications:** Email to coordinator when worker uploads. Link to review modal.
6. **No New Auth:** Reuse existing middleware (requireAgency detects worker context via JWT claims).

## Code Changes

**Backend:**
- `backend/src/routes/worker-auth.ts` (new) — `/worker-signin` + `/worker/verify-code` + `/worker/refresh-token`
- `backend/src/routes/worker-documents.ts` (new) — `/worker/documents` (GET, POST)
- `backend/src/lib/workerAuth.ts` (new) — Helper functions for OTP generation, JWT signing
- `backend/prisma/schema.prisma` — Add WorkerSession table (otp, expiresAt, workerId, agencyId)

**Frontend:**
- `frontend/app/worker-signin/page.tsx` (new) — Email input + OTP input
- `frontend/app/worker/dashboard/page.tsx` (new) — Document list + expiry alerts + upload widget
- `frontend/lib/api/worker.ts` (new) — API helpers (signin, verify, refresh, upload)

**Schema:**
- WorkerSession: id, workerId, agencyId, otp, verifiedAt, expiresAt, createdAt

