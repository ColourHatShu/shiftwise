# Phase 3 Discussion Log

**Date:** 2026-05-18  
**Participants:** Claude (Haiku, Autonomous Mode)  
**Status:** Complete (User asleep; decisions locked in autonomously)

---

## Summary

Phase 3 scope is fixed (9 requirements: OBS-01-04, AUDIT-01-02, UX-01-03). Gray areas autonomously resolved based on zero-cost constraint, existing schema, and operator UX goals.

---

## Gray Areas Discussed (Autonomously)

### 1. Error Observability Solution

**Question:** Self-hosted logging or SaaS?

**Constraints:**
- Zero-cost (no paid services)
- Solo developer (no ops burden)
- MVP error rate (low)

**Decision:** Sentry free tier (5K errors/month, no card required)

**Rationale:** Free tier sufficient for MVP. Sentry handles ingestion, deduplication, alerting without ops overhead. DSN optional (local dev doesn't require signup).

---

### 2. Audit Log Endpoint Design

**Question:** Should audit log be read-only, or allow filtering/deletion?

**Decision:** Read-only, paginated, filterable by action/entity/user/date. Requires OWNER/ADMIN.

**Rationale:** Compliance artifact (immutable). Filtering enables targeted queries (e.g., "all document approvals on 2026-05-18"). No delete (audit trail must be append-only).

---

### 3. Worker Search Scope

**Question:** Client-side (filter after fetch) or server-side (filter in query)?

**Decision:** Server-side. Extend existing `GET /api/workers` endpoint with `?search=<q>` and `?status=<status>`.

**Rationale:** Scales better (existing records, future records). Case-insensitive regex on 4 columns (firstName, lastName, email, jobTitle). No new schema fields.

---

### 4. Sentry Configuration

**Question:** Should local dev require Sentry signup, or be optional?

**Decision:** Optional. DSN from env var; silent (no-op) when DSN is empty.

**Rationale:** Local dev doesn't need error monitoring. Staging/prod set DSN. Reduces friction.

---

## Locked Decisions

- **OBS-01/02/03/04:** Sentry free tier, backend + frontend, no card, silent when DSN empty
- **AUDIT-01/02:** Read-only endpoint + paginated UI, no schema changes, agency-scoped
- **UX-01/02/03:** Worker search on existing columns, status filter, server-side, no schema changes

No conflicting decisions. Phase 3 is purely additive (new endpoints, new UI, new Sentry integration).

