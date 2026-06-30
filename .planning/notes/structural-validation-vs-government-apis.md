---
title: Why We Chose Structural Validation Over Government APIs
date: 2026-05-21
context: Post-exploration decision on document verification strategy
related_phases: Phase 1-8 (current system), Seed (gov-api-integration)
---

# Why ShiftWise Uses Structural Validation (Not Government APIs)

## Decision Summary

**Chosen:** Structural validation + manual coordinator review + OCR expiry extraction  
**Not chosen:** Real-time government API verification (DBS, UKVI, Passport, NI)  
**Reasoning:** Cost + complexity outweigh benefits at current scale

---

## Current System (MVP)

ShiftWise verifies documents via:

1. **Structural validation** (free)
   - Document format checks (PDF, image)
   - File size/type validation
   - No external API calls needed

2. **Manual coordinator review** (human time)
   - Coordinator downloads document
   - Visually inspects for forgery/integrity
   - Approves or rejects with feedback

3. **Expiry tracking** (free, via OCR + Tesseract.js)
   - Phase 2: Tesseract.js extracts text from documents
   - Regex patterns parse dates (UK format)
   - System tracks expiry, sends notifications

4. **Audit trail** (immutable log)
   - Phase 8: Compliance snapshots capture document state at assignment time
   - AuditLog records all actions
   - CQC-audit-ready for inspection

---

## Why Not Government APIs?

| Aspect | Reality | Impact |
|--------|---------|--------|
| **Cost** | £13-26 per DBS check (most critical) | £1,300-2,600 for 100 workers. ROI unclear at <500 workers. |
| **Complexity** | UKVI/HMRC require business registration + ongoing support | 2-3 weeks spike + maintenance burden |
| **Failure modes** | APIs go down, timeout, return errors | Coordinator workflow must fallback to manual (hybrid system) |
| **Fraud incidence** | Low in practice | Manual review catches most issues; API doesn't prevent all fraud types |
| **Privacy** | APIs require data transmission to government | GDPR compliance adds complexity |

---

## Trade-offs We Accept

✅ **Accepted:** Manual coordinator review (2-5 min per worker)  
❌ **Not covered:** Real-time fraud detection (e.g., stolen DBS number)  
✅ **Accepted:** Expiry tracking via OCR (good enough for healthcare context)  
❌ **Not covered:** Live government status changes (rare, but possible)  

**Verdict:** For MVP, the fraud risk is low enough that manual review + audit trail is sufficient.

---

## When to Revisit

Escalate to Phase 9+ when **any** of these conditions are met:

1. **Scale:** 500+ active workers (cost becomes justifiable: £0.03-0.05 per worker per month)
2. **Fraud:** Multiple fraudulent documents detected in audit trail
3. **Pain:** Coordinators report >2 hours/day on manual review
4. **Regulation:** UK introduces mandatory API verification requirement (unlikely before 2027)

---

## Implementation Path (if Triggered)

```
Phase 9+: "Government API Verification"
├─ Spike (1 week): Evaluate DBS/UKVI/Passport APIs, negotiate costs
├─ Slice 1 (4h): DBS Update Service integration + fallback logic
├─ Slice 2 (4h): Right to Work / UKVI integration
├─ Slice 3 (3h): Passport/NI verification (lowest priority, highest complexity)
└─ Slice 4 (3h): Hybrid workflow (API + manual fallback), testing
```

Priority order: **DBS > Right to Work > Passport > NI number**

---

## References

- `.planning/seeds/gov-api-integration.md` — Full exploration, trigger conditions
- Phase 8 CONTEXT: Compliance snapshots (immutable audit approach)
- Phase 1 SUMMARY: RBAC + audit logging infrastructure
- Current system: `backend/src/lib/compliance-service.js`, `backend/src/routes/documents.js`

