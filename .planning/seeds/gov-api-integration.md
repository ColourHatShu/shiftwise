---
title: Government API Integration for Document Verification
slug: gov-api-integration
planted_date: 2026-05-21
trigger_condition: ShiftWise reaches 500+ active workers OR coordinators report manual document verification as bottleneck
status: dormant
priority: medium
---

# Government API Integration for Document Verification

## Idea

Integrate with UK government APIs to verify compliance documents in real-time:
- **DBS checks** via DBS Update Service (£13-26/check)
- **Right to Work** via UKVI Employer Checking Service (limited free API)
- **Passport** via third-party services like Experian (£2-5/check)
- **NI number** via HMRC (restricted, requires tax business account)

## Benefits

- **Fraud prevention:** Verify documents against official registries
- **Automation:** Reduce manual coordinator review time
- **Live expiry:** Poll government sources for real-time status (e.g., DBS Update Service shows expiry instantly)
- **Compliance confidence:** Stronger audit trail for CQC inspections

## Constraints & Tradeoffs

| Document | Free? | Complexity | Notes |
|----------|-------|-----------|-------|
| DBS | ❌ No | High | DBS owns registry, charges per check |
| Right to Work | ⚠️ Limited | Medium | Free for eligible employers, restricted API access |
| Passport | ❌ No | High | No government API; requires third-party service |
| NI number | ❌ No | High | HMRC API restricted; requires tax business status |

**Cost at scale:** 100 workers × £13-26 DBS = £1,300-2,600. Only justifiable with high turnover or fraud risk.

## Why Deferred (MVP Decision)

1. **Current system sufficient:** ShiftWise already handles expiry tracking (OCR + manual review), fraud detection (coordinator inspection), and audit trail
2. **Low fraud incidence:** In practice, coordinators manually reviewing documents catch most issues
3. **Cost per check:** At <500 workers, per-check fees outweigh time savings
4. **Complexity:** UKVI and HMRC APIs require business registration, ongoing support costs, error handling for API failures

## Trigger Conditions

Revisit this seed when:
1. **Scale:** 500+ active workers (cost-benefit improves)
2. **Pain:** Coordinators report manual review as critical bottleneck (>2 hours/day)
3. **Fraud incidents:** Multiple fraudulent documents detected (risk justifies API investment)
4. **UK regulation:** Government introduces mandatory real-time verification requirement

## Implementation Path (if triggered)

**Phase 0 (Spike):** Evaluate API accessibility, cost models, error handling
**Phase N:** Implement in priority order:
1. DBS Update Service (most critical for care work)
2. Right to Work / UKVI (legal requirement for all staff)
3. Passport / NI verification (lower priority, higher complexity)

## Related

- `.planning/notes/structural-validation-vs-government-apis.md` — Decision rationale
- Phase 8 CONTEXT: Compliance snapshot approach (immutable audit trail, current system)
