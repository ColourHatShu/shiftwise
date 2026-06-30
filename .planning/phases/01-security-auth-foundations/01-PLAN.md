---
phase: 01-security-auth-foundations
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .env.example
  - backend/.env.example
  - backend/src/lib/auth.js
  - backend/src/lib/encryption.js
  - backend/src/server.js
  - backend/src/routes/workers.js
  - backend/src/routes/agencies.js
  - backend/src/routes/documents.js
  - backend/src/routes/dashboard.js
  - backend/src/routes/reports.js
  - backend/src/routes/alerts.js
  - backend/src/services/cronService.js
  - backend/prisma/schema.prisma
  - backend/prisma/migrations/*/migration.sql
  - frontend/app/dashboard/documents/page.tsx
  - frontend/app/dashboard/workers/[id]/page.tsx
  - frontend/lib/api/documents.ts
autonomous: false
requirements:
  - SEC-01
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - FILE-01
  - FILE-02
  - FILE-03
  - ENC-01
  - ENC-02
  - ENC-03
  - ENC-04
  - ALRT-01
  - ALRT-02

must_haves:
  truths:
    - "Repository contains no real Clerk secret keys; rotated keys in .env.example are placeholders"
    - "A VIEWER/STAFF user calling DELETE /api/workers/:id receives HTTP 403; OWNER/ADMIN succeeds"
    - "GET /uploads/<filename> returns 404; same file is retrievable only via GET /api/documents/:id/download with valid JWT for the owning agency"
    - "New uploads are encrypted with AES-256-GCM and ComplianceDocument.encryptionAlgorithm = 'aes-256-gcm'"
    - "Existing CBC-encrypted documents continue to download and decrypt without manual migration"
    - "GCM decryption failure (tampered file) returns HTTP 500 with sanitized error; no file path leak"
    - "Exactly one canonical lib/auth.js exists; the four legacy helpers in routes/*.js are deleted"
    - "Concurrent checkExpiriesAndAlert runs on the same (documentId, daysUntilExpiry, alertDate) produce exactly one ExpiryAlert row"
  artifacts:
    - path: "backend/src/lib/auth.js"
      provides: "Canonical exports: verifyClerkToken, requireAgency, requireRole, getUser"
      contains: "requireRole"
    - path: "backend/src/lib/encryption.js"
      provides: "encryptFileGCM, decryptFileGCM, decryptFileAuto(buffer, algorithm)"
      contains: "aes-256-gcm"
    - path: "backend/prisma/schema.prisma"
      provides: "ComplianceDocument.encryptionAlgorithm column; ExpiryAlert composite unique index"
      contains: "encryptionAlgorithm"
    - path: "backend/src/routes/documents.js"
      provides: "GET /:id/download streaming endpoint, auth-gated, agency-scoped"
      contains: "/:id/download"
  key_links:
    - from: "backend/src/server.js"
      to: "(removed) app.use('/uploads', express.static(...))"
      via: "deletion"
      pattern: "express\\.static"
    - from: "backend/src/routes/workers.js, agencies.js, documents.js, dashboard.js"
      to: "backend/src/lib/auth.js"
      via: "require('../lib/auth')"
      pattern: "require\\(['\"]\\.\\./lib/auth['\"]\\)"
    - from: "frontend/app/dashboard/documents/page.tsx + workers/[id]/page.tsx"
      to: "GET /api/documents/:id/download"
      via: "authenticated fetch (no raw /uploads URLs)"
      pattern: "/api/documents/.+/download"
    - from: "backend/src/services/cronService.js"
      to: "ExpiryAlert composite unique index"
      via: "try/catch on prisma.expiryAlert.create (P2002)"
      pattern: "P2002"
---

## Phase Goal

**As a** UK healthcare agency operator, **I want to** know that ShiftWise's auth, file access, encryption, and alert dedup are hardened against the current known security gaps, **so that** a CQC inspection or a malicious actor cannot read another agency's documents, escalate privileges, or trigger duplicate alerts.

<objective>
Close all 13 v1 security/auth/file/encryption/alert REQs (SEC-01 through ALRT-02) without adding any new external services. Behavioral surface is unchanged for end users; the system becomes meaningfully harder to attack.

Purpose: every later phase (OCR swap, observability, audit-log UI) imports from the new `lib/auth.js`. Hardening must land before more code is written against the old surface.

Output: a unified `lib/auth.js`, a removed static `/uploads` route replaced by an auth-gated streaming download endpoint, AES-256-GCM upgrade with CBC backward-compat, a race-safe ExpiryAlert dedup, and a sanitized `.env.example`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/phases/01-security-auth-foundations/01-CONTEXT.md

@backend/src/lib/auth.js
@backend/src/lib/encryption.js
@backend/src/server.js
@backend/src/routes/workers.js
@backend/src/routes/agencies.js
@backend/src/routes/documents.js
@backend/src/routes/dashboard.js
@backend/src/services/cronService.js
@backend/prisma/schema.prisma

<interfaces>
Current canonical helper (backend/src/lib/auth.js):
- `requireAgency(req, res, next)` — Express middleware. Verifies Clerk JWT from `Authorization: Bearer`, looks up `User` by `clerkId`, sets `req.user` and `req.agencyId`, calls `next()`. Returns 401 on bad token, 403 if user has no agency, 500 on misconfig.

Duplicated helpers to delete after consolidation:
- `backend/src/routes/workers.js:10-57` — inline `requireAgency` (duplicate of lib version)
- `backend/src/routes/agencies.js:11-31` — `verifyClerkToken(req, res)` returns `clerkUserId` (not middleware; called inside handlers)
- `backend/src/routes/dashboard.js:8-37` — `getAgencyId(req, res)` returns `agencyId`
- `backend/src/routes/documents.js:49-73` — `getAgencyUser(req, res)` returns `{ user, agencyId }`

Encryption module (backend/src/lib/encryption.js):
- Exports: `encryptFile`, `decryptFile`, `encryptAndSaveFile`, `readAndDecryptFile`, `generateEncryptionKey`, `validateEncryptionSetup`, `ALGORITHM`
- Current layout: `[IV(16) | ciphertext]` for CBC.
- New GCM layout (per ENC-02): `[IV(12) | authTag(16) | ciphertext]`.

ComplianceDocument (schema.prisma:124):
- Add `encryptionAlgorithm String @default("aes-256-cbc")`. Existing rows backfill to `aes-256-cbc` (matches current state). New uploads write `aes-256-gcm`.

ExpiryAlert (schema.prisma:161):
- Existing columns: `complianceDocumentId`, `daysUntilExpiry`, `alertDate (DateTime)`.
- Need a normalized day field for the unique constraint. Approach: add `alertDateOnly DateTime @db.Date` (UTC-midnight derived) and `@@unique([complianceDocumentId, daysUntilExpiry, alertDateOnly])`.

Server.js wiring (server.js:43-45):
- Currently: `app.use('/uploads', express.static(uploadsPath))` — public, must be removed (FILE-01).

Cron dedup (cronService.js:166-177):
- `duplicateAlert = prisma.expiryAlert.findFirst(...)` — race-prone; replace with insert + P2002 catch (ALRT-02).
</interfaces>
</context>

---

## Execution Order Overview

Five categories, sequenced to honor dependencies:

| # | Category | Why this order |
|---|----------|----------------|
| A | Secrets (SEC-01) | Independent; do first so rotated keys are in place before any other code change is committed. |
| B | Auth consolidation (AUTH-03 → AUTH-01 → AUTH-02) | `requireRole` and route migrations depend on the consolidated `lib/auth.js`. Must land before file/document endpoints are touched. |
| C | File access (FILE-01/02/03) | Download endpoint depends on `requireAgency` from B and on the encryption module (used in read path). Frontend change depends on backend endpoint. |
| D | Encryption upgrade (ENC-01/02/03/04) | Schema migration first, then encrypt path, then decrypt routing. Touches `documents.js` already modified in C — keep sequential to avoid merge churn. |
| E | Alert dedup (ALRT-01 → ALRT-02) | Schema migration first, then cron logic. Independent of B/C/D; can run after them. |

Dependency edges:
- A → (independent)
- B (AUTH-03) → B (AUTH-01) → B (AUTH-02)
- B → C (FILE-02 needs `requireAgency`)
- C (FILE-02) → C (FILE-03) — frontend wiring depends on backend endpoint
- D (ENC-01 schema) → D (ENC-02 write) → D (ENC-03/04 read)
- D ↔ C: download endpoint must call the new auto-routing decrypt
- E (ALRT-01 schema) → E (ALRT-02 cron rewrite)

---

<tasks>

<!-- ═══════════════════════════════════════════════════════════════════════════
     CATEGORY A — SECRETS
     ═══════════════════════════════════════════════════════════════════════════ -->

<task type="checkpoint:human-action" gate="blocking">
  <name>Task A1: Rotate committed Clerk dev keys in Clerk dashboard</name>
  <what-built>None — this is a human-only action. Claude has no API access to Clerk's "rotate keys" UI; the existing committed keys must be invalidated by the user before any sanitization is meaningful.</what-built>
  <how-to-verify>
    1. Log into Clerk dashboard (the dev/test instance corresponding to the keys currently committed in `backend/.env.example` and `.env.example`).
    2. Navigate to API Keys.
    3. Click "Rotate" (or delete + recreate) for both the Publishable Key and Secret Key.
    4. Copy the NEW keys into your local `backend/.env` and `frontend/.env.local` (not the `.env.example` files — those get placeholders).
    5. Confirm the old keys no longer authenticate by attempting an API call with them (optional but recommended).
  </how-to-verify>
  <resume-signal>Reply "rotated" once the dashboard rotation is complete and your local `.env` files contain the new working keys.</resume-signal>
  <requirements>SEC-01</requirements>
  <effort>small</effort>
  <gotcha>If you skip rotation and only sanitize the example files, the leaked keys remain valid in the git history. Rotation is the load-bearing step.</gotcha>
</task>

<task type="auto">
  <name>Task A2: Sanitize .env.example files to placeholder-only values</name>
  <files>.env.example, backend/.env.example</files>
  <action>Replace every real-looking secret value in both `.env.example` files with placeholder text. For each variable, the value MUST be one of: `your-<var-name>-here`, `changeme`, an obvious dummy (`pk_test_REPLACE_ME`, `sk_test_REPLACE_ME`), or an empty string with a comment. Keys to sanitize at minimum: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `DOCUMENT_ENCRYPTION_KEY`, `DATABASE_URL` (placeholder connection string), `RESEND_API_KEY`, and any other key with a non-empty value. Add a header comment at top: `# This file is checked into git. NEVER put real secrets here. Copy to .env and fill in real values.` Do NOT alter variable names or order — keep diff minimal so the file remains useful as a template.</action>
  <verify>
    <automated>node -e "const fs=require('fs');for(const f of ['.env.example','backend/.env.example']){const c=fs.readFileSync(f,'utf8');if(/sk_test_[A-Za-z0-9]{20,}|sk_live_/.test(c)){console.error('REAL CLERK SECRET STILL PRESENT in '+f);process.exit(1)};if(/^[^#\n]*=[A-Za-z0-9+/=]{40,}/m.test(c.replace(/REPLACE_ME|changeme|your-/g,''))){console.error('Suspicious long value in '+f)}}console.log('ok')"</automated>
  </verify>
  <done>Both `.env.example` files contain only placeholder values. Grep for `sk_test_` / `sk_live_` against real Clerk key patterns returns no matches. Header comment present.</done>
  <requirements>SEC-01</requirements>
  <effort>small</effort>
  <gotcha>Do NOT git-rm the existing keys from history — that's a separate destructive operation requiring force-push. Rotation in Task A1 makes the history-leaked keys harmless. If the user later wants to scrub history, that's a follow-up task with explicit approval.</gotcha>
</task>

<!-- Atomic commit boundary: A1 (human, no commit) + A2 commits as
     "chore(sec-01): sanitize .env.example after rotating Clerk dev keys" -->

<!-- ═══════════════════════════════════════════════════════════════════════════
     CATEGORY B — AUTH HELPER CONSOLIDATION (AUTH-03 then AUTH-01 then AUTH-02)
     ═══════════════════════════════════════════════════════════════════════════ -->

<task type="auto" tdd="true">
  <name>Task B1: Build canonical lib/auth.js with Pattern A exports</name>
  <files>backend/src/lib/auth.js, backend/src/tests/unit/auth.test.js</files>
  <behavior>
    - `verifyClerkToken(req)` resolves to the decoded Clerk JWT payload (`{ sub, ... }`) or throws a tagged error (`UnauthorizedError` with `status: 401`).
    - `getUser(clerkUserId)` returns `{ user, agencyId }` from Prisma or throws `ForbiddenError` (status 403) when user has no agency.
    - `requireAgency(req, res, next)` middleware composes `verifyClerkToken` + `getUser`, sets `req.user` and `req.agencyId`, calls `next()`. Same external behavior as today's helper: 401 on bad token, 403 on no agency, 500 on missing `CLERK_SECRET_KEY`.
    - `requireRole(allowedRoles)` returns Express middleware that asserts `req.user.role` is in `allowedRoles` (case-sensitive against the `UserRole` enum: `OWNER`, `ADMIN`, `STAFF`, `VIEWER`). Returns 403 with `{ error: 'Forbidden: insufficient role' }` on rejection. MUST be used AFTER `requireAgency` (it relies on `req.user`).
    - All four functions are independently importable (Pattern A from CONTEXT.md D-Discretion).
  </behavior>
  <action>Implement the canonical `lib/auth.js` per the `<behavior>` block. Use Pattern A from CONTEXT.md (separate exports, Express-idiomatic). Reuse the existing token-verification flow from current `backend/src/lib/auth.js` lines 7-49 — same `verifyToken` from `@clerk/backend`, same `authorizedParties`, same `clockSkewInMs: 300000`. Add a top-of-file JSDoc block explaining: canonical auth module per AUTH-03, Pattern A chosen for Express middleware idiom, replaces four legacy helpers in routes/*. Export: `{ verifyClerkToken, getUser, requireAgency, requireRole }`. Write unit tests in `backend/src/tests/unit/auth.test.js` that cover: (a) `requireRole(['OWNER'])` rejects a `req.user = { role: 'VIEWER' }` with 403, (b) `requireRole(['OWNER','ADMIN'])` calls `next()` for `role: 'ADMIN'`, (c) `requireRole` returns 401-style behavior when `req.user` is missing (defensive: returns 403 because the contract is requireAgency-first). Do NOT yet modify any route file — that is Task B2.</action>
  <verify>
    <automated>cd backend && npx jest src/tests/unit/auth.test.js --runInBand</automated>
  </verify>
  <done>`backend/src/lib/auth.js` exports `verifyClerkToken`, `getUser`, `requireAgency`, `requireRole`. Unit tests pass. No route file is modified yet.</done>
  <requirements>AUTH-01, AUTH-03</requirements>
  <effort>medium</effort>
  <gotcha>The existing `verifyClerkToken` in `routes/agencies.js:12` is NOT middleware — it's called inside handlers and writes the response on failure. The new canonical `verifyClerkToken(req)` should THROW (not write to res) so it composes cleanly into middleware. Route migration in B2 will adapt callers.</gotcha>
</task>

<task type="auto">
  <name>Task B2: Migrate all routes to canonical lib/auth.js and delete legacy helpers</name>
  <files>backend/src/routes/workers.js, backend/src/routes/agencies.js, backend/src/routes/dashboard.js, backend/src/routes/documents.js, backend/src/routes/alerts.js, backend/src/routes/reports.js</files>
  <action>For each route file, replace the inline auth helper with imports from `../lib/auth`.

Specific migrations:
- `workers.js:10-57` — delete the inline `requireAgency` definition. Add `const { requireAgency } = require('../lib/auth');` at top. All `router.X('/:path', requireAgency, ...)` usages already match the new signature; no handler changes needed.
- `agencies.js:11-31` — delete `verifyClerkToken` definition. The handlers at lines 37, 99, 134, 157 currently call `await verifyClerkToken(req, res)` and branch on a falsy return. Refactor each handler to use `requireAgency` as middleware on the router (preferred) so handlers can just read `req.user`/`req.agencyId`. Where the handler logic must remain inline (e.g., onboarding-time when user has no agency yet), import the new `verifyClerkToken(req)` from `lib/auth` and wrap in try/catch translating thrown errors to the prior 401/403 responses.
- `dashboard.js:8-37` — delete `getAgencyId`. Replace router-level usage with `requireAgency` middleware, then read `req.agencyId`.
- `documents.js:49-73` — delete `getAgencyUser`. Replace all five call sites (lines 253, 372, 418, 461, 502) with `requireAgency` middleware on the router; handlers read `req.user` and `req.agencyId`.
- `alerts.js` — audit for any inline auth helper; if present, replace with `require('../lib/auth')`.
- `reports.js` — already imports `requireAgency` from `../lib/auth` (line 4). Verify behavior is unchanged.

After migration, the only `lib/auth.js` reference in `backend/src/` MUST be `backend/src/lib/auth.js` itself. No route file defines `requireAgency`, `verifyClerkToken`, `getAgencyId`, or `getAgencyUser` as a local function.</action>
  <verify>
    <automated>node -e "const {execSync}=require('child_process');const out=execSync('grep -rn \"const requireAgency = async\\|const verifyClerkToken = async\\|const getAgencyId = async\\|const getAgencyUser = async\" backend/src/routes',{encoding:'utf8'}).trim();if(out){console.error('Legacy helper still defined:\n'+out);process.exit(1)}console.log('ok: no legacy helper definitions in routes/')" && cd backend && npx jest src/tests/integration/security-pipeline.test.js --runInBand</automated>
  </verify>
  <done>All four legacy helpers are deleted. Every protected route imports from `../lib/auth`. The existing security-pipeline integration test passes (baseline auth behavior unchanged). Grep gate shows no remaining inline helper definitions.</done>
  <requirements>AUTH-03</requirements>
  <effort>medium</effort>
  <gotcha>`agencies.js` onboarding handler must still work for a user with `agencyId === null` (they're creating their first agency). Do NOT slap `requireAgency` blanket-style on that router — it returns 403 when agencyId is null. Use the looser `verifyClerkToken` for the onboarding route specifically, and `requireAgency` for the post-onboarding routes.</gotcha>
</task>

<task type="auto" tdd="true">
  <name>Task B3: Enforce requireRole(['OWNER','ADMIN']) on destructive endpoints</name>
  <files>backend/src/routes/workers.js, backend/src/routes/documents.js, backend/src/routes/agencies.js, backend/src/tests/integration/rbac.test.js</files>
  <behavior>
    - `DELETE /api/workers/:id` returns 403 for `VIEWER` and `STAFF`, 2xx for `OWNER` and `ADMIN`.
    - `PATCH /api/workers/:id/deactivate` returns 403 for `VIEWER` and `STAFF`, 2xx for `OWNER` and `ADMIN`.
    - `DELETE /api/documents/:id` returns 403 for `VIEWER` and `STAFF`, 2xx for `OWNER` and `ADMIN`.
    - Document approve/reject endpoints (`PATCH /api/documents/:id/approve`, `/reject`) return 403 for `VIEWER` and `STAFF`.
    - `PATCH /api/agencies/:id` (agency settings update) returns 403 for `VIEWER` and `STAFF`.
    - Read endpoints (list, get) remain accessible to all authenticated agency users (per D-locked: RBAC on destructive endpoints only).
  </behavior>
  <action>Add `requireRole(['OWNER','ADMIN'])` after `requireAgency` on each destructive endpoint in `workers.js` (DELETE /:id, PATCH /:id/deactivate), `documents.js` (DELETE /:id, PATCH /:id/approve, PATCH /:id/reject), and `agencies.js` (PATCH /:id agency-settings update). Do NOT add role checks to any GET/list/read endpoint — locked decision in CONTEXT.md is destructive-only.

Write integration tests in `backend/src/tests/integration/rbac.test.js` using supertest that seed users of each role (`OWNER`, `ADMIN`, `STAFF`, `VIEWER`) within one agency and verify the matrix in `<behavior>`. Use the existing test-DB setup from `security-pipeline.test.js` as a template.</action>
  <verify>
    <automated>cd backend && npx jest src/tests/integration/rbac.test.js --runInBand</automated>
  </verify>
  <done>RBAC integration tests pass. The destructive-endpoint matrix in `<behavior>` is enforced. Read endpoints remain open to all authenticated agency users.</done>
  <requirements>AUTH-01, AUTH-02</requirements>
  <effort>medium</effort>
  <gotcha>Order matters: `requireRole` MUST come AFTER `requireAgency` because it reads `req.user.role`. If you reverse them, you'll get an undefined-read crash returning 500 instead of 403.</gotcha>
</task>

<!-- Atomic commit boundary: B1+B2 commit as
     "refactor(auth-03): consolidate four auth helpers into lib/auth.js"
     B3 commits as
     "feat(auth-01,auth-02): enforce requireRole on destructive endpoints" -->

<!-- ═══════════════════════════════════════════════════════════════════════════
     CATEGORY C — FILE ACCESS (FILE-01, FILE-02, FILE-03)
     ═══════════════════════════════════════════════════════════════════════════ -->

<task type="auto" tdd="true">
  <name>Task C1: Implement auth-gated streaming download endpoint</name>
  <files>backend/src/routes/documents.js, backend/src/tests/integration/file-download.test.js</files>
  <behavior>
    - `GET /api/documents/:id/download` with valid JWT for the owning agency: 200, streams decrypted bytes with `Content-Disposition: attachment; filename="<original-fileName>"` and a sensible `Content-Type` (from stored `mimeType` or `application/octet-stream`).
    - Missing/invalid JWT → 401.
    - Valid JWT but document belongs to a different agency → 404 (do NOT distinguish "not found" from "not yours" — that leaks existence).
    - Document row exists but encrypted file on disk missing → 500 with sanitized error `{ error: 'Document file unavailable' }`.
    - Endpoint MUST work for both `aes-256-cbc` (legacy rows) and `aes-256-gcm` (new rows, post-Task D2) by reading `document.encryptionAlgorithm`. Until Task D3 lands, default to CBC; after D3, route through `decryptFileAuto`.
  </behavior>
  <action>Add `router.get('/:id/download', requireAgency, async (req, res) => { ... })` to `backend/src/routes/documents.js`. Implementation: load the `ComplianceDocument` by id scoped to `req.agencyId` (use `findFirst({ where: { id, agencyId: req.agencyId } })` to return null on cross-agency access instead of throwing). If null → 404. Resolve the on-disk path from `document.fileKey` (or `fileUrl` if that's the local-path field — inspect existing upload path in the same file). Use Node `fs.createReadStream` to stream the encrypted file through a `crypto.createDecipheriv` transform stream, then `.pipe(res)`. Per CONTEXT.md "streaming recommended" decision. Set headers BEFORE piping: `Content-Disposition: attachment; filename="${encodeURIComponent(document.fileName)}"`, `Content-Type: ${document.mimeType || 'application/octet-stream'}`. Attach `'error'` handler on the stream pipeline: on decryption error, if headers not yet sent → 500 with sanitized error; if headers already sent → `res.destroy()` (cannot recover mid-stream). For now, call the CBC path from `lib/encryption.js`; Task D3 will swap this for `decryptFileAuto(document.encryptionAlgorithm)`.

Write integration tests covering the five `<behavior>` cases. Use a CBC-encrypted fixture file created via the existing `encryptFile` helper.</action>
  <verify>
    <automated>cd backend && npx jest src/tests/integration/file-download.test.js --runInBand</automated>
  </verify>
  <done>`GET /api/documents/:id/download` exists, auth-gated, agency-scoped, streams decrypted CBC files. All five behavior cases tested and passing.</done>
  <requirements>FILE-02</requirements>
  <effort>large</effort>
  <gotcha>(1) `decipher.pipe(res)` will throw if the file is truncated or the key is wrong. Always attach the `'error'` listener BEFORE `.pipe()`, otherwise the process can crash. (2) Do NOT use `res.download()` — it expects a plaintext path; we're decrypting in flight. (3) `encodeURIComponent` on `fileName` prevents header-injection via filenames containing CR/LF.</gotcha>
</task>

<task type="auto">
  <name>Task C2: Remove public /uploads static route from server.js</name>
  <files>backend/src/server.js</files>
  <action>Delete lines 43-45 (`app.use('/uploads', express.static(uploadsPath))` and surrounding comment). Also delete the now-unused `const path = require('path')` import at line 6 if no other code in the file uses it (grep first; `path.join(__dirname, ...)` may be referenced elsewhere — leave the import if so).

Add a regression comment immediately above the route mount block:
`// SECURITY: /uploads is intentionally NOT exposed. Files are served via GET /api/documents/:id/download with auth + agency-scope enforcement.`</action>
  <verify>
    <automated>node -e "const c=require('fs').readFileSync('backend/src/server.js','utf8');if(/express\.static\([^)]*uploads/.test(c)){console.error('uploads static route still present');process.exit(1)}if(!/intentionally NOT exposed/.test(c)){console.error('regression comment missing');process.exit(1)}console.log('ok')"</automated>
  </verify>
  <done>`app.use('/uploads', express.static(...))` is gone from `server.js`. Hitting `GET /uploads/<filename>` falls through to the 404 handler. Regression comment in place.</done>
  <requirements>FILE-01</requirements>
  <effort>small</effort>
  <gotcha>Run C1 BEFORE C2 in execution order — if you remove the static route before the download endpoint exists, the frontend breaks immediately for any user trying to view a document.</gotcha>
</task>

<task type="auto">
  <name>Task C3: Wire frontend to /api/documents/:id/download with auth</name>
  <files>frontend/app/dashboard/documents/page.tsx, frontend/app/dashboard/workers/[id]/page.tsx, frontend/lib/api/documents.ts</files>
  <action>Currently `frontend/app/dashboard/documents/page.tsx:238-239` and `frontend/app/dashboard/workers/[id]/page.tsx:617-618` render `<a href={doc.fileUrl} target="_blank">` pointing at raw `/uploads/...` URLs. Replace with an authenticated download flow.

Add (or extend if it exists) `frontend/lib/api/documents.ts` with a `downloadDocument(documentId: string): Promise<void>` function that: (1) uses Clerk's `getToken()` to fetch the JWT, (2) calls `fetch('${API_BASE}/api/documents/${id}/download', { headers: { Authorization: 'Bearer ' + token } })`, (3) reads the response as a Blob, (4) extracts the filename from `Content-Disposition` (server already exposes this via the existing CORS `exposedHeaders` config in `server.js:38`), (5) triggers download via a temporary `<a>` with `URL.createObjectURL(blob)` and revokes the URL after click.

Replace the two `<a href={doc.fileUrl}>` JSX blocks with `<button onClick={() => downloadDocument(doc.id)} className="...">` keeping the same visual styling and lucide icon.

Do NOT remove `fileUrl` from the API response yet — backwards compat for any code path we miss. But the dashboard pages MUST NOT reference it for download links.</action>
  <verify>
    <automated>node -e "const fs=require('fs');for(const f of ['frontend/app/dashboard/documents/page.tsx','frontend/app/dashboard/workers/[id]/page.tsx']){const c=fs.readFileSync(f,'utf8').split('\n').filter(l=>!l.trim().startsWith('//')&&!l.trim().startsWith('*')).join('\n');if(/href=\{doc\??\.fileUrl\}/.test(c)){console.error('raw fileUrl link still present in '+f);process.exit(1)}}console.log('ok')"</automated>
  </verify>
  <done>Both dashboard pages use the new `downloadDocument` helper. No `<a href={doc.fileUrl}>` remains in dashboard download UI. Manual smoke test: clicking download on a document downloads the file with the original filename.</done>
  <requirements>FILE-03</requirements>
  <effort>medium</effort>
  <gotcha>(1) `Content-Disposition` is only readable cross-origin if the backend sets `Access-Control-Expose-Headers: Content-Disposition` — already done in `server.js:38`. (2) Don't forget `URL.revokeObjectURL` after click, or you'll leak object URLs on every download.</gotcha>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task C4: Verify /uploads is dead and download endpoint works end-to-end</name>
  <what-built>Public `/uploads` static route removed (C2). Auth-gated streaming download endpoint added (C1). Frontend rewired to use it (C3).</what-built>
  <how-to-verify>
    1. Start backend and frontend locally.
    2. In a browser tab WITHOUT being logged in, hit `http://localhost:3001/uploads/<any-known-filename>` directly. Expected: 404.
    3. Log into the dashboard as a real Clerk user, navigate to `/dashboard/documents`, click "Download" on a document that was uploaded BEFORE this phase (CBC-encrypted). Expected: file downloads with original filename and opens correctly.
    4. In a different agency's account (or by tampering with the `id` in the URL to point at another agency's document), call `GET /api/documents/<other-agency-doc-id>/download` with your token. Expected: 404 (not 403, not 200).
    5. Without an `Authorization` header, call `GET /api/documents/<your-doc-id>/download`. Expected: 401.
  </how-to-verify>
  <resume-signal>Reply "verified" once steps 1-5 all behave as expected, or describe the failure mode.</resume-signal>
  <requirements>FILE-01, FILE-02, FILE-03</requirements>
  <effort>small</effort>
</task>

<!-- Atomic commit boundary: C1 + C2 + C3 commit together as
     "feat(file-01,file-02,file-03): replace public /uploads with auth-gated streaming download" -->

<!-- ═══════════════════════════════════════════════════════════════════════════
     CATEGORY D — ENCRYPTION UPGRADE (ENC-01, ENC-02, ENC-03, ENC-04)
     ═══════════════════════════════════════════════════════════════════════════ -->

<task type="auto">
  <name>Task D1: Add encryptionAlgorithm column to ComplianceDocument (Prisma migration)</name>
  <files>backend/prisma/schema.prisma, backend/prisma/migrations/[timestamp]_add_encryption_algorithm/migration.sql</files>
  <action>Edit `backend/prisma/schema.prisma:124` (`model ComplianceDocument`). Add field: `encryptionAlgorithm String @default("aes-256-cbc")`. Place it next to `mimeType`/`fileSize` for cohesion.

Run `npx prisma migrate dev --name add_encryption_algorithm` from `backend/`. Verify the generated SQL:
- Adds the column with default `'aes-256-cbc'`.
- Existing rows are backfilled to `'aes-256-cbc'` (correct — they ARE CBC).
- Column is NOT NULL.

Commit BOTH the schema change and the generated `migration.sql` file. Do NOT edit the generated SQL after creation — let Prisma own it.</action>
  <verify>
    <automated>cd backend && npx prisma migrate status && node -e "const fs=require('fs');const s=fs.readFileSync('prisma/schema.prisma','utf8');if(!/encryptionAlgorithm\s+String\s+@default\(\"aes-256-cbc\"\)/.test(s)){console.error('column missing or wrong default');process.exit(1)}console.log('ok')"</automated>
  </verify>
  <done>Schema has `encryptionAlgorithm` column with default `aes-256-cbc`. Migration file committed. `prisma migrate status` reports clean.</done>
  <requirements>ENC-01</requirements>
  <effort>small</effort>
  <gotcha>If the dev DB has data, the migration MUST set the default at the SQL level (Prisma's `@default` does this). Do not use `DEFAULT NULL`-then-backfill — that breaks the NOT NULL constraint.</gotcha>
</task>

<task type="auto" tdd="true">
  <name>Task D2: Add GCM encrypt/decrypt routines and write-path integration</name>
  <files>backend/src/lib/encryption.js, backend/src/routes/documents.js, backend/src/tests/unit/encryption.test.js</files>
  <behavior>
    - `encryptFileGCM(buffer: Buffer) → Buffer` produces layout `[IV(12) | authTag(16) | ciphertext]`.
    - `decryptFileGCM(buffer: Buffer) → Buffer` reads the layout, verifies the auth tag, returns plaintext, or throws a tagged `DecryptionError` with `{ code: 'GCM_AUTH_FAIL' }` on tag mismatch.
    - `decryptFileAuto(buffer: Buffer, algorithm: string) → Buffer` dispatches to `decryptFile` (CBC) or `decryptFileGCM` based on the `algorithm` argument. Throws `Error('Unsupported encryption algorithm: ' + algorithm)` for unknown values.
    - Unit tests: round-trip GCM (encrypt then decrypt yields original), tampered ciphertext fails with GCM_AUTH_FAIL, `decryptFileAuto` routes correctly for both algorithms.
    - Upload path: when a new document is saved, the file is encrypted with `encryptFileGCM` and the row is written with `encryptionAlgorithm: 'aes-256-gcm'`.
  </behavior>
  <action>Extend `backend/src/lib/encryption.js`:
- Add `GCM_ALGORITHM = 'aes-256-gcm'`, `GCM_IV_LENGTH = 12`, `GCM_TAG_LENGTH = 16`.
- Implement `encryptFileGCM(buffer)` using `crypto.createCipheriv('aes-256-gcm', key, iv)`, then `cipher.update`, `cipher.final`, `cipher.getAuthTag()`. Return `Buffer.concat([iv, authTag, ciphertext])`.
- Implement `decryptFileGCM(buffer)`: slice IV (12), authTag (16), ciphertext; `createDecipheriv`; `setAuthTag`; update + final. On `OperationError`/exception, re-throw a tagged error `const e = new Error('GCM auth failure'); e.code = 'GCM_AUTH_FAIL'; throw e;`.
- Implement `decryptFileAuto(buffer, algorithm)` that dispatches on the algorithm string. Export it.

In `backend/src/routes/documents.js`, locate the upload handler (the POST that calls `encryptAndSaveFile` or `encryptFile` today). Replace the CBC encryption call with `encryptFileGCM`, and in the `prisma.complianceDocument.create({ data: ... })` add `encryptionAlgorithm: 'aes-256-gcm'`. Do NOT touch the read path here — that's Task D3.

Write unit tests in `backend/src/tests/unit/encryption.test.js` covering the four `<behavior>` items.</action>
  <verify>
    <automated>cd backend && npx jest src/tests/unit/encryption.test.js --runInBand</automated>
  </verify>
  <done>GCM encrypt/decrypt functions exist with documented layout. New uploads write `aes-256-gcm` to `encryptionAlgorithm`. Unit tests pass including the tamper-detection test.</done>
  <requirements>ENC-02</requirements>
  <effort>medium</effort>
  <gotcha>(1) Standard GCM IV size is 12 bytes (not 16). Using 16 works but is non-standard; stick to 12 per REQ ENC-02. (2) `cipher.getAuthTag()` MUST be called AFTER `cipher.final()`, not before. (3) `decipher.setAuthTag()` MUST be called BEFORE `decipher.update()`.</gotcha>
</task>

<task type="auto" tdd="true">
  <name>Task D3: Route decrypt path through encryptionAlgorithm and handle GCM failures</name>
  <files>backend/src/routes/documents.js, backend/src/tests/integration/encryption-roundtrip.test.js</files>
  <behavior>
    - `GET /api/documents/:id/download` reads `document.encryptionAlgorithm` and calls `decryptFileAuto(buffer, algorithm)`.
    - Existing CBC-encrypted documents (encryptionAlgorithm = 'aes-256-cbc') download successfully (backward compat).
    - New GCM-encrypted documents (encryptionAlgorithm = 'aes-256-gcm') download successfully.
    - A GCM document whose ciphertext has been tampered with on disk returns HTTP 500 with `{ error: 'Document decryption failed' }` (sanitized — no file path, no key hint). A structured `console.error` log is emitted with `{ documentId, agencyId, error: 'GCM_AUTH_FAIL' }` for future Sentry routing (Phase 3 will swap console.error → Sentry; structure must already be Sentry-friendly).
    - The original encrypted file path is NEVER included in the HTTP response body or headers.
  </behavior>
  <action>In `backend/src/routes/documents.js`, modify the `GET /:id/download` handler from Task C1: replace the direct CBC decrypt call with `decryptFileAuto(encryptedBuffer, document.encryptionAlgorithm)`. Because we are streaming (Task C1 decision), refactor as follows: for CBC, keep streaming via `createDecipheriv` pipe; for GCM, the auth tag check requires the full ciphertext, so for GCM documents read the full file with `fs.readFile`, run `decryptFileGCM`, then `res.send(plaintext)`. Document this in a code comment: "GCM requires full-buffer decryption for auth-tag verification; CBC streams. 10MB upload cap keeps GCM buffer-decrypt acceptable."

Wrap the decrypt call in try/catch. On `err.code === 'GCM_AUTH_FAIL'`: emit `console.error('[encryption] GCM auth failure', { documentId: document.id, agencyId: req.agencyId, error: 'GCM_AUTH_FAIL' })` and respond `500 { error: 'Document decryption failed' }`. On any other decryption error: same sanitized 500, log error message but NOT file path. Per CONTEXT.md D-locked: GCM failures return 500 (honest reporting).

Write integration test `encryption-roundtrip.test.js`:
- Upload a fixture, verify it stores as GCM, download it, verify bytes match original.
- Seed a CBC document directly into the DB + filesystem (using the existing CBC encrypt), download via the new endpoint, verify bytes match.
- Take a GCM-encrypted file, flip one byte in the ciphertext on disk, download, verify 500 + sanitized error + no path in response.</action>
  <verify>
    <automated>cd backend && npx jest src/tests/integration/encryption-roundtrip.test.js --runInBand</automated>
  </verify>
  <done>Download endpoint auto-routes by algorithm. CBC backward compat verified. GCM round-trip verified. Tampered GCM returns sanitized 500 with structured log. All three integration tests pass.</done>
  <requirements>ENC-03, ENC-04</requirements>
  <effort>medium</effort>
  <gotcha>The streaming-vs-buffering split between CBC and GCM is a deliberate compromise. If you try to "stream GCM" by piping then checking the auth tag at the end, you cannot un-send bytes already on the wire — a tampered file would deliver corrupted plaintext to the client before failing. Buffering for GCM is the safe choice given the 10MB upload cap.</gotcha>
</task>

<!-- Atomic commit boundary:
     D1 commits as "feat(enc-01): add encryptionAlgorithm column to ComplianceDocument"
     D2 commits as "feat(enc-02): add AES-256-GCM encrypt path for new uploads"
     D3 commits as "feat(enc-03,enc-04): route decrypt by algorithm + sanitize GCM failures" -->

<!-- ═══════════════════════════════════════════════════════════════════════════
     CATEGORY E — ALERT DEDUP (ALRT-01, ALRT-02)
     ═══════════════════════════════════════════════════════════════════════════ -->

<task type="auto">
  <name>Task E1: Add race-safe composite unique index on ExpiryAlert</name>
  <files>backend/prisma/schema.prisma, backend/prisma/migrations/[timestamp]_expiry_alert_dedup_index/migration.sql</files>
  <action>Edit `backend/prisma/schema.prisma:161` (`model ExpiryAlert`). Add a new field `alertDateOnly DateTime @db.Date` and a composite unique index `@@unique([complianceDocumentId, daysUntilExpiry, alertDateOnly])`.

Run `npx prisma migrate dev --name expiry_alert_dedup_index`. In the generated migration SQL, ADD a backfill statement BEFORE the unique index creation, populating `alertDateOnly` for existing rows from `DATE(alertDate AT TIME ZONE 'UTC')`. If duplicates already exist (more than one row sharing the same (complianceDocumentId, daysUntilExpiry, alertDateOnly)), the migration will fail — in that case, ALSO add a pre-dedupe statement that deletes the older duplicates keeping the most recent `createdAt`. Document the dedupe inline as a SQL comment.

The Prisma-generated migration is the source of truth — augment it, don't replace it.</action>
  <verify>
    <automated>cd backend && npx prisma migrate status && node -e "const s=require('fs').readFileSync('prisma/schema.prisma','utf8');if(!/@@unique\(\[complianceDocumentId,\s*daysUntilExpiry,\s*alertDateOnly\]\)/.test(s)){console.error('composite unique missing');process.exit(1)}console.log('ok')"</automated>
  </verify>
  <done>`ExpiryAlert` has `alertDateOnly @db.Date` and the composite `@@unique`. Migration applies cleanly against the dev DB. Existing rows backfilled. Any pre-existing duplicates deduped with the most-recent-wins rule.</done>
  <requirements>ALRT-01</requirements>
  <effort>medium</effort>
  <gotcha>If you skip the pre-dedupe step and the dev DB has duplicate alerts from previous bugs, `prisma migrate dev` will abort halfway with a constraint violation, leaving the schema in an inconsistent state. Always check `SELECT complianceDocumentId, daysUntilExpiry, DATE(alertDate), COUNT(*) FROM expiry_alerts GROUP BY 1,2,3 HAVING COUNT(*) > 1` before running the migration.</gotcha>
</task>

<task type="auto" tdd="true">
  <name>Task E2: Replace duplicateAlert findFirst with constraint-based dedup in cronService</name>
  <files>backend/src/services/cronService.js, backend/src/tests/integration/expiry-alert-dedup.test.js</files>
  <behavior>
    - Two concurrent invocations of `checkExpiriesAndAlert` against the same `(complianceDocumentId, daysUntilExpiry, alertDateOnly)` produce exactly one `ExpiryAlert` row, not two.
    - The losing invocation catches the Prisma `P2002` (unique constraint violation) error, logs it as a benign skip (not an error), and does NOT send a second email.
    - The winning invocation sends exactly one email via `sendExpiryAlert`.
    - The existing `findFirst` pre-check on `duplicateAlert` (cronService.js:166-177) is REMOVED — the constraint is the source of truth.
  </behavior>
  <action>In `backend/src/services/cronService.js`:
- Delete lines ~166-177 (`const duplicateAlert = await prisma.expiryAlert.findFirst(...)` and the `if (duplicateAlert) continue` branch).
- Restructure the alert-creation block: compute `alertDateOnly` as a UTC-midnight `Date`. Attempt `await prisma.expiryAlert.create({ data: { ..., alertDateOnly } })` INSIDE a try/catch.
  - On success: send the email via `sendExpiryAlert`, then mark `isSent: true, sentAt: new Date()` via update.
  - On error where `error.code === 'P2002'`: log `console.log('[cron] alert already exists for', complianceDocumentId, daysUntilExpiry, '— skipping')` and `continue`. Do NOT send the email.
  - On any other error: re-throw / log and continue the outer loop (preserve existing behavior).
- Apply the same pattern to BOTH alert-creation sites (around line 79 and line 194 per the earlier grep).

Write integration test `expiry-alert-dedup.test.js`: seed a document and worker, invoke `checkExpiriesAndAlert` twice concurrently with `Promise.all`, assert exactly one ExpiryAlert row and exactly one `sendExpiryAlert` call (mock the email service).</action>
  <verify>
    <automated>cd backend && npx jest src/tests/integration/expiry-alert-dedup.test.js --runInBand && node -e "const c=require('fs').readFileSync('backend/src/services/cronService.js','utf8');if(/duplicateAlert\s*=\s*await\s+prisma\.expiryAlert\.findFirst/.test(c)){console.error('legacy duplicateAlert findFirst still present');process.exit(1)}if(!/P2002/.test(c)){console.error('P2002 handler missing');process.exit(1)}console.log('ok')"</automated>
  </verify>
  <done>`duplicateAlert` findFirst is gone. P2002 catch + skip is in place at both alert-creation sites. Concurrent-invocation integration test passes with exactly one alert and one email.</done>
  <requirements>ALRT-02</requirements>
  <effort>medium</effort>
  <gotcha>(1) Email send order matters: send the email AFTER the create succeeds, never before. If you send first and the create fails, you've already double-sent. (2) Mock `sendExpiryAlert` in the test — actual Resend calls cost free-tier quota and are flaky in CI. (3) `Promise.all` of two parallel cron invocations is the cleanest reproduction; relying on real concurrent crons is impossible to test deterministically.</gotcha>
</task>

<!-- Atomic commit boundary:
     E1 commits as "feat(alrt-01): add composite unique index on ExpiryAlert"
     E2 commits as "feat(alrt-02): rely on unique constraint for alert dedup, drop findFirst race" -->

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → Express API | Untrusted JWT, untrusted query/body, cross-tenant ID guessing |
| Express → Postgres | Trusted intra-process; injection risk via Prisma is low but parameter binding still required |
| Express → Local disk (uploads/) | Trusted process boundary; tampering with encrypted files on disk is in-scope for GCM auth-tag detection |
| Express → Clerk API | Trusted third-party; JWT signature is the integrity guarantee |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-01 | Information Disclosure | Public `/uploads/*` static route | mitigate | Task C2 removes the route; Task C1 replaces with auth + agency-scope check on every download |
| T-01-02 | Elevation of Privilege | Destructive endpoints accessible to any authenticated user | mitigate | Task B3 adds `requireRole(['OWNER','ADMIN'])` to delete/deactivate/approve/reject/agency-update |
| T-01-03 | Tampering | Files on local disk encrypted with unauthenticated CBC | mitigate | Tasks D2/D3 add GCM with auth-tag verification; CBC retained only for legacy backward-compat |
| T-01-04 | Information Disclosure | GCM decryption error leaks file path or key hint | mitigate | Task D3 returns sanitized 500 with structured log; response body contains no path/key info |
| T-01-05 | Spoofing | Committed Clerk dev keys in git history | mitigate | Task A1 rotates keys in Clerk dashboard (invalidates leaked); A2 sanitizes example files |
| T-01-06 | Repudiation | Duplicate ExpiryAlert rows from race condition obscure "did we actually send?" audit | mitigate | Tasks E1/E2 use DB unique constraint + P2002 catch; exactly-one guarantee |
| T-01-07 | Information Disclosure | Cross-agency document access via guessed IDs | mitigate | Task C1: `findFirst({ where: { id, agencyId } })` returns 404 (not 403) on cross-agency hit, avoiding existence leak |
| T-01-08 | Denial of Service | 10MB GCM buffer-decrypt under load | accept | 10MB cap × current solo-MVP traffic is negligible; revisit if hosting > 100 concurrent downloads |
| T-01-09 | Tampering | Git history still contains old Clerk keys after A2 | accept | Rotation in A1 makes leaked keys harmless; history scrub is a separate destructive operation requiring explicit approval |
| T-01-10 | Information Disclosure | `fileUrl` field still returned by API and could be misused | accept | Frontend rewired in C3; field retained for backward compat. Removal deferred — low risk once `/uploads` is gone since the URL is now unservable |
</threat_model>

<verification>
End-to-phase verification (run after all tasks):

1. **Secrets:** `grep -rE 'sk_(test|live)_[A-Za-z0-9]{20,}' .env.example backend/.env.example` returns no matches.
2. **RBAC:** `cd backend && npx jest src/tests/integration/rbac.test.js` — all role × destructive-endpoint cells pass.
3. **File access:** `curl -i http://localhost:3001/uploads/anything` returns 404. `curl -i -H "Authorization: Bearer <valid>" http://localhost:3001/api/documents/<own-doc-id>/download` returns 200 with file. Same call with another agency's doc id returns 404.
4. **Encryption:** `cd backend && npx jest src/tests/integration/encryption-roundtrip.test.js` — CBC backward compat + GCM round-trip + tamper detection all pass.
5. **Auth consolidation:** `grep -rn "const requireAgency = async\|const verifyClerkToken = async\|const getAgencyId = async\|const getAgencyUser = async" backend/src/routes` returns no matches.
6. **Alert dedup:** `cd backend && npx jest src/tests/integration/expiry-alert-dedup.test.js` — concurrent invocation produces one row + one email.
7. **Prisma:** `cd backend && npx prisma migrate status` reports no pending migrations and a clean diff against schema.
</verification>

<success_criteria>
All 13 requirements in `requirements` frontmatter pass their `<verify>` and `<done>` gates. The six success criteria from `ROADMAP.md` Phase 1 are met:

1. `.env.example` has no real secrets; Clerk keys rotated (A1+A2).
2. VIEWER deleting a worker gets 403; OWNER/ADMIN succeeds (B3).
3. `/uploads/<filename>` returns 404; same file retrievable only via authed download endpoint (C1+C2+C3).
4. New uploads encrypt with AES-256-GCM and tag the row; old CBC documents still download (D1+D2+D3).
5. Only one `lib/auth.js` exists; the four duplicates are gone (B1+B2).
6. Two concurrent cron runs produce exactly one ExpiryAlert (E1+E2).
</success_criteria>

<output>
After completion, create `.planning/phases/01-security-auth-foundations/01-01-SUMMARY.md` documenting: which REQs were validated, the consolidated `lib/auth.js` export surface (for downstream phases to import), the GCM file layout (for any future re-encrypt tooling), and the P2002 dedup pattern (reusable for other write-once constraints).
</output>
