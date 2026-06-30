<!-- GSD:project-start source:PROJECT.md -->
## Project

**ShiftWise**

A multi-tenant SaaS compliance management platform for **UK healthcare staffing agencies**. Each agency manages its own workers (carers, nurses, support staff) and tracks the compliance documents required to legally place them on shift — DBS checks, Right to Work, training certificates, immunisation records, passports, NI cards, references, CVs.

Core promise: **be audit-ready at all times**. Catch expiring documents before they lapse so a CQC inspector never finds a non-compliant worker on duty.

**Core Value:** **One thing that must work:** a coordinator at a UK healthcare staffing agency uploads a worker's compliance documents, the system automatically tracks expiry dates, emails the coordinator before anything lapses, and every action is auditable for CQC inspection.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

## Sentry Setup (Error Monitoring)

**Phase 3 Implementation:** Sentry free tier is integrated on both backend and frontend for error observability.

**Setup Steps:**
1. Sign up for free tier at https://sentry.io/signup/ (no card required)
2. Create a backend project (Node.js)
3. Create a frontend project (Next.js)
4. Copy the DSN from each project
5. Add to `.env`:
   - `SENTRY_DSN_BACKEND=<backend-dsn>`
   - `NEXT_PUBLIC_SENTRY_DSN=<frontend-dsn>`

**Local Development:**
- Leave DSN empty in `.env` for local dev (Sentry disabled automatically)
- No signup required locally

**Integration Points:**
- Backend: `backend/src/server.js` initializes Sentry with request/error handlers
- Frontend: `frontend/app/providers/sentry-initializer.tsx` initializes client-side Sentry
- Errors logged from:
  - GCM decryption failures (document download)
  - Cron service (daily expiry check, failed alert retry)
  - All unhandled exceptions via global error handler
  - All errors include structured tags: userId, agencyId, documentId, context

**Error Logging Pattern:**
```javascript
Sentry.captureException(error, {
    tags: { userId: req.user?.id, agencyId: req.agencyId, context: 'operation-name' },
    extra: { metadata: 'details' }
});
```

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
