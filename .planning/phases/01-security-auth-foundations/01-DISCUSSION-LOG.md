# Phase 1 Discussion Log

**Date:** 2026-05-18  
**Participants:** User + Claude (Haiku)  
**Status:** Complete

---

## Summary

Phase 1 scope is very specific (13 requirements, all security/auth hardening). Discussion focused on **implementation choices** that would affect code shape, not on feature scope or additions.

---

## Gray Areas Discussed

### 1. RBAC Enforcement Scope

**Question:** Where should role-based access control enforcement apply?

**Options presented:**
- Destructive endpoints only (delete, reject, approve) — reduces middleware overhead, focuses on write protection
- All protected routes — more defensive but more overhead

**User selected:** Destructive endpoints only

**Rationale:** Read operations are already agency-scoped implicitly. Focusing RBAC on writes keeps the auth layer focused and reduces noise.

**Outcome:** `AUTH-02` constraint: `requireRole(['OWNER','ADMIN'])` on delete/reject/approve/update operations only.

---

### 2. GCM Decryption Error Handling

**Question:** When AES-256-GCM detects tampering, should we return 500 or 404?

**Options presented:**
- HTTP 500: Honest error reporting, helps debugging, auditable in Sentry
- HTTP 404: Opaque (file doesn't exist), safer but harder to debug

**User selected:** HTTP 500

**Rationale:** Honest error reporting is more valuable than obscurity at this scale. Enables audit trails and debugging.

**Outcome:** `ENC-04` constraint: Decryption failures return 500 with structured error logged. Sentry will capture and alert on any pattern.

---

### 3. Auth Helper Consolidation Design

**Question:** How should the consolidated `lib/auth.js` API look?

**Options presented:**
- Pattern A (separate functions): `auth.requireAgency`, `auth.requireRole`, `auth.getUser`
- Pattern B (object namespace): single `auth` object with methods

**User selected:** "Whatever you suggest"

**Claude recommendation:** Pattern A (separate functions). Aligns with Express idiom, minimizes diff, clearer imports.

**Outcome:** Planner will consolidate the four existing helpers into separate, reusable functions. Pattern A recommended in CONTEXT.md for planner reference.

---

### 4. File Download Streaming Strategy

**Question:** For `GET /api/documents/:id/download`, buffer the entire file or stream it?

**Options presented:**
- Streaming: Memory-efficient, handles 10MB files, more complex
- Buffering: Simple, but risky at the 10MB limit

**User selected:** "Whatever you suggest"

**Claude recommendation:** Streaming (Node.js `fs.createReadStream` + `decipher.pipe`). Industry standard, safe for the upload limit, better error handling mid-stream.

**Outcome:** Planner will implement streaming. Pattern documented in CONTEXT.md.

---

## Deferred Ideas Captured

- Key rotation in production → later phase
- Audit log tamper-proofing (hash chains, append-only) → compliance hardening phase
- Worker self-service portal → separate phase
- Brand decision (ShiftWise or rebrand) → product/business discussion, not technical
