# ShiftWise — Milestone 1 Requirements

**Milestone:** No-cost hardening + free OCR swap
**Constraint:** Zero paid services, zero paid certifications, zero card-required signups (Sentry free tier excepted — no card required).

## v1 Requirements

### Secrets (SEC)
- [ ] **SEC-01:** `.env.example` contains only placeholder values; the currently committed Clerk dev keys are rotated in the Clerk dashboard and replaced with placeholders in the repo.

### Authorization (AUTH)
- [ ] **AUTH-01:** A `requireRole(roles[])` middleware exists in `backend/src/lib/auth.js` that rejects callers whose `User.role` is not in the allowed set with HTTP 403.
- [ ] **AUTH-02:** Destructive endpoints — worker delete, worker deactivate, document delete, agency update — require `OWNER` or `ADMIN`. `VIEWER` and `STAFF` get 403.
- [ ] **AUTH-03:** All four existing auth helpers (`requireAgency`, `verifyClerkToken`, `getAgencyId`, `getAgencyUser`) are consolidated into a single canonical `lib/auth.js` and the four duplicates are removed. Every protected route uses the new helper.

### File Access (FILE)
- [ ] **FILE-01:** The public `app.use('/uploads', express.static(...))` route is removed from `server.js`.
- [ ] **FILE-02:** A `GET /api/documents/:id/download` endpoint exists that (a) requires a valid Clerk JWT, (b) verifies the document's `agencyId` matches the caller's, (c) decrypts and streams the file with an appropriate `Content-Disposition` header.
- [ ] **FILE-03:** The frontend uses the new download endpoint instead of constructing raw `/uploads/<filename>` URLs.

### Encryption (ENC)
- [ ] **ENC-01:** `ComplianceDocument` has a new `encryptionAlgorithm` column (default `aes-256-cbc` for existing rows, `aes-256-gcm` for new uploads) and the Prisma migration is committed.
- [ ] **ENC-02:** New uploads are encrypted with AES-256-GCM. The IV (12 bytes) and auth tag (16 bytes) are stored prepended to the ciphertext in a documented layout.
- [ ] **ENC-03:** The decrypt path reads `encryptionAlgorithm` from the document row and routes to the correct decryption routine; existing CBC-encrypted files continue to be readable without manual migration.
- [ ] **ENC-04:** GCM decryption failures (tampering detection) return a 500 with a sanitized error and log a structured warning to Sentry. The original file path is not exposed in the response.

### Alerts (ALRT)
- [ ] **ALRT-01:** A Prisma migration adds a unique index `@@unique([complianceDocumentId, daysUntilExpiry, alertDateOnly])` on `ExpiryAlert` where `alertDateOnly` is a date-truncated value. (Implementation may use a generated column or a normalized `alertDate` set to UTC midnight.)
- [ ] **ALRT-02:** The cron service's existing `duplicateAlert` query is removed in favour of relying on the unique constraint plus a try/catch on the `prisma.expiryAlert.create` call, so concurrent cron runs cannot double-send.

### Observability (OBS)
- [ ] **OBS-01:** Sentry (free tier, no card) is wired into the Express backend via `@sentry/node` with request handler + error handler middleware.
- [ ] **OBS-02:** Sentry is wired into the Next.js frontend via `@sentry/nextjs` with client and server config.
- [ ] **OBS-03:** Sentry DSNs are read from env vars (`SENTRY_DSN_BACKEND`, `NEXT_PUBLIC_SENTRY_DSN`) and documented in `.env.example` as optional with placeholders.
- [ ] **OBS-04:** Sentry is silent (no-op) when DSN is empty so local dev doesn't require Sentry signup.

### Audit Log (AUDIT)
- [ ] **AUDIT-01:** `GET /api/audit-log` returns paginated, agency-scoped audit log entries, filterable by `action`, `entity`, `userId`, and `dateFrom`/`dateTo`. Requires `OWNER` or `ADMIN`.
- [ ] **AUDIT-02:** A new `/dashboard/audit-log` page renders the log as a searchable, paginated table with action, entity, actor, timestamp, and a metadata-detail popover.

### Worker UX (UX)
- [ ] **UX-01:** `GET /api/workers` accepts `?search=<q>` and matches case-insensitively against `firstName`, `lastName`, `email`, and `jobTitle`. Filtering remains agency-scoped and paginated.
- [ ] **UX-02:** `GET /api/workers` accepts `?status=ACTIVE|INACTIVE|SUSPENDED` to filter by `WorkerStatus`.
- [ ] **UX-03:** The worker list page exposes a search input and a status dropdown, both server-driven via debounced query parameters.

### AI Scan (OCR)
- [ ] **OCR-01:** Document upload returns HTTP 201 immediately without waiting for AI extraction. AI extraction is dispatched via `setImmediate` (or a similar deferred call) and updates the document row asynchronously.
- [ ] **OCR-02:** `tesseract.js` replaces `pdf-to-img` + Ollama (`llava`) as the primary text-extraction engine. PDF first-page rendering remains for PDF inputs.
- [ ] **OCR-03:** Structured extractors run on the OCR'd text: a date regex for `expiryDate`/`issueDate`, an MRZ parser for passports, a DBS certificate-number regex, a NI number regex. Each extractor lives in its own module under `backend/src/lib/extractors/`.
- [ ] **OCR-04:** The extracted `analysisResult` JSON written to `ComplianceDocument.analysisResult` keeps the existing shape (`documentType`, `expiryDate`, `issueDate`, `issuingAuthority`, `confidence`, `summary`, `concerns`, `nameMatchesWorker`, `wrongDocumentWarning`) so the frontend renders unchanged.
- [ ] **OCR-05:** PII sanitization is preserved: `fullName` and `documentNumber` are extracted internally for matching but never persisted in `analysisResult`.
- [ ] **OCR-06:** The frontend polls the document status after upload (or uses the existing review-modal flow) and shows a "Scanning..." state until extraction completes or fails.
- [ ] **OCR-07:** Ollama / llava dependencies (`pdf-to-img`, `fetchWithRetry` to Ollama) are removed from `backend/src/routes/documents.js` and `package.json` once the new pipeline is live.

## v2 Requirements (deferred to later milestones)

- Cyber Essentials Plus certification
- NHS DSPT submission
- Hosted OCR / vision (Claude, Textract, Document AI) — paid
- Twilio SMS escalation
- KMS-based key management
- ICO registration
- Cloudflare R2 migration
- Audit pack ZIP generator
- Worker self-service portal
- Mandatory training matrix
- Gov.uk RTW share-code checks, NMC PIN checks, DBS update service
- Shift management / rota functionality
- Brand decision

## Out of Scope (permanent or undecided)

- Anything requiring payment in this milestone — by design
- Multi-language / multi-country — UK-only focus
- iOS native app — PWA is sufficient
- Microservices / Kubernetes — single Node + single Postgres is plenty for current scale

## Traceability

| REQ-ID | Phase |
|--------|-------|
| SEC-01 | Phase 1 |
| AUTH-01 | Phase 1 |
| AUTH-02 | Phase 1 |
| AUTH-03 | Phase 1 |
| FILE-01 | Phase 1 |
| FILE-02 | Phase 1 |
| FILE-03 | Phase 1 |
| ENC-01 | Phase 1 |
| ENC-02 | Phase 1 |
| ENC-03 | Phase 1 |
| ENC-04 | Phase 1 |
| ALRT-01 | Phase 1 |
| ALRT-02 | Phase 1 |
| OCR-01 | Phase 2 |
| OCR-02 | Phase 2 |
| OCR-03 | Phase 2 |
| OCR-04 | Phase 2 |
| OCR-05 | Phase 2 |
| OCR-06 | Phase 2 |
| OCR-07 | Phase 2 |
| OBS-01 | Phase 3 |
| OBS-02 | Phase 3 |
| OBS-03 | Phase 3 |
| OBS-04 | Phase 3 |
| AUDIT-01 | Phase 3 |
| AUDIT-02 | Phase 3 |
| UX-01 | Phase 3 |
| UX-02 | Phase 3 |
| UX-03 | Phase 3 |
