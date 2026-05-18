---
phase: 04-worker-self-service
plan: 01
type: execute
wave: 1
requires: Phase 1,2,3
files_modified:
  - backend/src/routes/worker-auth.ts
  - backend/src/routes/worker-documents.ts
  - backend/src/lib/workerAuth.ts
  - backend/prisma/schema.prisma
  - backend/prisma/migrations/
  - frontend/app/worker-signin/page.tsx
  - frontend/app/worker/dashboard/page.tsx
  - frontend/lib/api/worker.ts
requirements:
  - SELF-01
  - SELF-02
  - SELF-03
  - SELF-04
---

# Phase 4 Plan — Worker Self-Service

**Tasks:** 5  
**Duration (est.):** 1-2 hours

## Tasks

1. **A1** (auto): Prisma migration — add WorkerSession table (otp, expiresAt, workerId, agencyId)
2. **A2** (TDD): Implement worker auth routes — `/worker-signin` (email input), `/worker/verify-code` (OTP validation, JWT issuance)
3. **A3** (auto): Frontend signin UI — email input, OTP input, submit
4. **A4** (TDD): Worker dashboard — GET /worker/documents, display list + expiry alerts, upload form
5. **A5** (auto): Coordinator notification — email when worker uploads with review link

## Success Criteria

✓ Worker can signin with email + OTP, receive JWT in HTTP-only cookie  
✓ Worker dashboard shows their docs, color-coded by expiry urgency  
✓ Worker can upload docs; system adds to review queue  
✓ Coordinator receives email notification with worker name + doc type

