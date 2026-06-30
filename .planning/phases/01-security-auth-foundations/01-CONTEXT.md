# Phase 1 Context — Security & Auth Foundations

**Date:** 2026-05-18  
**Phase:** 01 — Security & Auth Foundations  
**Goal:** Eliminate biggest security gaps with zero new services. By end of phase: no committed secrets, RBAC enforced, encrypted-file access is auth-gated, encryption upgraded to authenticated cipher, auth helpers consolidated, alert dedup is race-safe.

---

## Domain

This phase delivers **defensive hardening** — removing current security gaps in the authentication layer, file access control, encryption, and alerting dedup logic. The user sees: no behavioral changes (same features work the same way) but the system is harder to break (secrets aren't exposed, roles are enforced, files are access-controlled, encryption is authenticated).

---

## Decisions

### Locked (User Selected)

**RBAC enforcement scope:** Role-based access control applies **destructive endpoints only** (delete worker, delete document, reject document, approve document, update agency settings). Read operations (list, get, view) are already agency-scoped implicitly by queries filtering on `agencyId`. This reduces middleware overhead and keeps the auth layer focused on write protection.

**GCM decryption error handling:** When AES-256-GCM decryption fails (tampering detected or key mismatch), return **HTTP 500** with a structured error logged to Sentry. This is honest error reporting (helps debugging if the encryption key is wrong) and makes tampering detectable in Sentry audit trails.

### Delegated (Planner/Implementer)

**Auth helper consolidation design:** The four existing auth helpers (`requireAgency`, `verifyClerkToken`, `getAgencyId`, `getAgencyUser`) will be consolidated into `lib/auth.js`. Two patterns are viable:

- **Pattern A (recommended):** Export separate functions (`requireAgency`, `requireRole`, `getUser`, `verifyToken`) so routes import exactly what they need. Aligns with Express middleware idioms.
- **Pattern B:** Export a single `auth` object with methods (`auth.requireAgency`, `auth.requireRole`, etc.). Explicit namespace.

**Planner should** pick the pattern that fits cleanest with existing Express middleware in `server.js` and minimize diff size. Document the choice in code comments.

**File download streaming strategy:** The `GET /api/documents/:id/download` endpoint must decrypt and serve the file. Two approaches:

- **Streaming (recommended):** Pipe decrypted bytes to response as a stream. Memory-efficient, handles 10MB files well, more complex (error handling mid-stream).
- **Buffering:** Read entire encrypted file, decrypt in memory, send. Simple, but risky if users hit the 10MB limit.

**Planner should** use streaming (Node.js `fs.createReadStream` + `decipher.pipe`). It's the Node.js idiom and safer for large uploads.

---

## Code Context

### Reusable Assets

**Existing auth middleware pattern** (`backend/src/middleware/`):
- `requireAgency` in `workers.js:10-57` — Clerk JWT validation + agency lookup pattern. Reuse this structure.
- `verifyClerkToken` in `agencies.js:11-31` — Clerk verification with `authorizedParties` config. Reuse.
- `getAgencyId` in `dashboard.js:8-37` — Simpler token verification for stat endpoints.
- `getAgencyUser` in `documents.js:49-73` — User + agency lookup in one function.

All four do the same core work with minor variations. Consolidation will **reduce duplication by ~150 lines**.

**Encryption module** (`backend/src/lib/encryption.js`):
- Already has `encryptFile` / `decryptFile` with AES-256-CBC. CBC will remain as fallback for existing rows.
- GCM will be added as a new function `encryptFileGCM` / `decryptFileGCM`. Schema supports both via `encryptionAlgorithm` column.

**Rate limiting** (`backend/src/middleware/rateLimiter.js`):
- Already splits `aiAnalysisLimiter`, `documentUploadLimiter`, `generalLimiter`. Destructive-endpoint limiter can be added here.

### Patterns to Follow

- All protected routes use `verifyToken` → lookup user → check `agencyId`. Consolidation should preserve this flow.
- Prisma transactions are used for audit-log writes (see `documents.js:536-557`). GCM decryption failures should similarly use transactions if creating error logs.
- Environment variable pattern: `process.env.CLERK_SECRET_KEY` with fallback checks. Encryption key follows same pattern (ENV var, validate on boot).

---

## Canonical References

- `.planning/ROADMAP.md` — Phase 1 goal and success criteria
- `.planning/REQUIREMENTS.md` — 13 specific REQs (SEC-01 through ALRT-02)
- `.planning/PROJECT.md` — Key decisions on stack, constraint (zero-cost), out-of-scope items
- `backend/src/middleware/rateLimiter.js` — Rate limiting patterns and existing limiters
- `backend/src/lib/encryption.js` — AES-256-CBC implementation; read before adding GCM
- `backend/src/routes/workers.js` — `requireAgency` middleware pattern (lines 10-57)
- `backend/src/routes/agencies.js` — `verifyClerkToken` pattern (lines 11-31)
- `backend/src/routes/documents.js` — Transactional audit-log writes with document operations (lines 536-557)

---

## Specifics / Notes

**Sentry not yet wired (Phase 3):** GCM error logging will use `console.error` + structured `metadata` in `AuditLog` for now. Phase 3 adds Sentry. Errors must be structured (error.message, error.stack) so Phase 3 can route them to Sentry.

**Backward-compatibility path:** Existing documents encrypted with AES-256-CBC must continue to decrypt. The `encryptionAlgorithm` column (default `'aes-256-cbc'`) tells the decrypt path which to use. Prisma migration will set all existing rows to CBC.

**Multiple auth helpers means multiple versions of the same logic.** Consolidation risks introducing bugs if not careful — use side-by-side testing (old and new both decode the token, verify results match) before removing the originals.

---

## Deferred Ideas

- Key rotation strategy (how to rotate encryption key in production) — Phase 3 or later, tied to operational runbooks
- Audit log tamper-proofing (append-only, hash chains) — deferred to compliance hardening phase
- Worker self-service portal — separate phase
- Brand decision (ShiftWise vs rebrand) — product/business decision, not technical
