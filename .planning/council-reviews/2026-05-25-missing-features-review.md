---
title: Council Review — Missing Core Features & Facilities
date: 2026-05-25
review_type: agent-council
status: complete
members: 4
topic: Production-readiness gap analysis for UK healthcare staffing compliance platform
---

# Council Review: ShiftWise Missing Core Features

**Question posed:** After 8 completed phases, what core features or facilities are we missing for a production-ready UK healthcare staffing compliance platform?

**Council convened (4 specialists, parallel):**
1. UK Healthcare Compliance Expert (regulatory)
2. UK Healthcare Staffing Operations Expert (business workflows)
3. Product/UX Expert (mobile-first, adoption, retention)
4. SaaS Technical Architecture Expert (production readiness)

---

## 1. Compliance Expert — Top 10 Regulatory Gaps

### CRITICAL (launch-blockers)
1. **NMC/GMC/HCPC Live Registration Verification** — CQC Reg 19 requires *ongoing* PIN checks, not point-in-time. A nurse struck off mid-placement = regulatory breach.
2. **DBS Update Service Continuous Monitoring** — Static DBS certificate is worthless; barred list additions happen daily. Need scheduled status checks via Update Service subscription.
3. **Data Retention & Right to Erasure Workflows** — UK GDPR Art. 17. Immutable audit logs conflict with erasure rights. Need cryptographic shredding (delete AES key) for "right to be forgotten."
4. **Right to Work Share Code Verification** — Since 2022, non-British/Irish workers MUST use Home Office share code. Passport scan alone = statutory excuse INVALID. Civil penalty up to £60,000/worker.

### HIGH
5. **NHS Employment Check Standards** — 6 standards (Identity, RTW, Registration, Employment history with 3yr continuous gaps explained, Criminal Record, Occupational Health). Required for NHS Workforce Alliance / CCS RM6277 framework.
6. **Multi-Regulator Support** — Scotland (PVG via Disclosure Scotland), Wales (CIW), NI (AccessNI). PVG ≠ DBS — blocks cross-border agencies.
7. **Data Breach Notification Workflow** — 72-hour ICO notification window. Need breach register, DPIA templates, DPO contact, ICO draft generator.

### MEDIUM-HIGH
8. **Professional Indemnity & Insurance Tracking** — NMC Code 12.1, Employer's Liability £5m statutory minimum. Insurance docs with expiry tracking.
9. **Safeguarding Incident & Whistleblowing Module** — Statutory DBS referral duty (SVGA s.35). Freedom to Speak Up channel.
10. **Working Time Regulations & Fatigue Controls** — 48-hour weekly cap, 11-hour daily rest, opt-out tracking. Pre-assignment WTR validation.

**Bottom line:** Items 1, 2, 3, 7 are launch-blockers. Without them, agencies using ShiftWise will FAIL CQC well-led inspection and risk ICO/Home Office penalties. *"The platform has strong foundations but treats compliance documents as static artefacts rather than live, continuously-verified states."*

---

## 2. Operations Expert — Top 10 Business Workflow Gaps

### CRITICAL (revenue blockers)
1. **Timesheets & Time Tracking** — No clock-in/out with geo-verification. Without verified hours, cannot invoice clients or pay workers. Entire agency currently runs on paper/WhatsApp.
2. **Invoicing to Care Homes** — No invoicing engine, no VAT, no statement runs. Agency can't bill = no cash in.
3. **Payroll Processing** — No PAYE/NI, holiday pay accrual (12.07%), auto-enrolment pension (NEST), or BACS export. Unpaid workers leave within one cycle.

### HIGH
4. **Client/Care Home Management + Rate Cards** — No CRM for care homes, no per-role/per-shift-type rates (weekday/weekend/night/bank holiday). Currently kept in spreadsheets → margin leakage.
5. **Recurring Shifts** — 70%+ of shifts are recurring blocks ("every Mon/Wed/Fri night"). Currently one-off only → coordinators re-key thousands of shifts weekly.
6. **SMS Communications** — ~30% of shifts filled last-minute (sickness/walkouts). Without SMS broadcast, coordinators ring 40 workers at 5am.
7. **Worker Availability Calendar** — Coordinators broadcast blind; no way for workers to declare availability.

### MEDIUM-HIGH
8. **Cancellation & No-Show Management** — Reliability scoring, automatic deprioritisation of repeat no-shows.
9. **Worker Rate & Holiday/Pension Management** — Per-worker rate matrix, PAYE vs umbrella vs Ltd flag, holiday accrual ledger.
10. **Operational Reporting & KPIs** — Fill rate, revenue per home, margin per shift, worker utilization.

**Build vs Integrate strategy:**
- **Build native:** timesheets, recurring shifts, availability, rate cards, cancellations, invoicing engine, dashboards
- **Integrate:** Payroll → BrightPay/Sage, Accounting → Xero, SMS → Twilio, BI → Metabase

**Bottom line:** *"Sequence 1→2→3 first — without those three, ShiftWise is a compliance tool, not an agency operating system."*

---

## 3. Product/UX Expert — Top 10 Adoption/Retention Gaps

### CRITICAL (#1 churn driver)
1. **Push Notifications** — Workers ignore email; shifts get snapped up in minutes. Web Push (VAPID) for PWA immediately; FCM/APNS later for native.

### HIGH
2. **Native Mobile App** — Capacitor wrapping existing code (4-6 weeks). React Native is over-engineering for MVP.
3. **In-App Messaging** — Replaces WhatsApp chaos. Per-shift threads, 1:1 DMs, attachments. Audit trail = GDPR-safe differentiator vs WhatsApp.
4. **Worker Profile Depth** — Skills (dementia, PEG feeding), languages, driver+vehicle, max travel radius, NMC PIN. Drives shift matching.
5. **Search, Filters & "Shifts Near Me"** — Postcode-based distance sort (postcodes.io free API), saved searches with push alerts, map view.
6. **Worker Onboarding Flow** — Gamified checklist ("3 of 7 documents uploaded — 80% to first shift"), in-app tour.
7. **Coordinator Bulk Actions & Power Tools** — Bulk select, broadcast button, customisable dashboards, command palette (Cmd+K).

### MEDIUM-HIGH
8. **Multi-Language Support** — ~30% of UK care workforce non-native English. Tagalog, Romanian, Polish, Hindi, Yoruba, Portuguese first.
9. **Accessibility (WCAG 2.1 AA)** — Must-have before NHS Trust sales (Equality Act 2010).
10. **Trust & Ratings System** — Two-way ratings, badges (reliability %, shifts completed), care home reviews.

**Competitor positioning:**
- **Florence** beats us on: onboarding polish, native apps, shift discovery, brand trust
- **Nourish/Cura** are care-planning tools (different category) — integrate via API rather than compete
- **ShiftWise differentiator:** compliance-first + auditable in-app messaging — neither Florence nor WhatsApp offers this combo

**90-day priority:** Push notifications → Capacitor wrapper → In-app messaging → Profile depth + geo-search

---

## 4. Technical Architecture Expert — Top 10 Production Gaps

### BLOCKING (must fix before production launch)
1. **File Storage Architecture** — Documents on local disk = data loss on restart. Cloudflare R2 (zero egress) or AWS S3 eu-west-2 with SSE, pre-signed URLs, versioning, lifecycle policies.
2. **Database Backups & Migration Strategy** — Managed Postgres with PITR (Neon/Supabase eu-west-2). Daily `pg_dump` to R2 (30-day retention). `prisma migrate deploy` as CI step, not app startup. RPO ≤5min, RTO ≤1hr.
3. **Deployment & CI/CD Pipeline** — Vercel (Next.js) + Railway/Render (Express + Postgres + Redis) in EU. GitHub Actions: lint → typecheck → test → migrate → deploy. Preview deployments per PR. Cost: ~$50-150/mo at launch.
4. **UK/EU Data Residency** — Lock everything to eu-west-2: Postgres, R2, Resend EU region, Sentry EU, Clerk EU. GDPR Article 44 violation blocks every NHS sale.
5. **Rate Limiting & Edge Protection** — Cloudflare (free tier) + `express-rate-limit` + Redis. 5/min on OTP (prevents SMS/email bomb), 100/min per-tenant, 1000/min per-IP. Turnstile CAPTCHA on OTP.

### IMPORTANT (first 90 days)
6. **Background Job Queue** — BullMQ + Redis (Upstash). Queues: ocr, email, compliance-checks, audit-export. Replace cron with BullMQ repeatable jobs.
7. **Multi-Tenant Isolation Hardening** — Postgres Row-Level Security via Prisma middleware. Automated cross-tenant access tests. Defer schema-per-tenant until >500 tenants.
8. **Observability Stack** — Better Stack (logs + uptime, ~$25/mo) + Sentry Performance + PostHog EU. Pino structured logging with agencyId/requestId.
9. **Email Deliverability & Scale** — Resend Pro (~$20/mo, 50k emails). DKIM/SPF/DMARC config. Webhook bounce handler. Separate sending domain `mail.shiftwise.app`.

### NICE (post-PMF)
10. **Public API, Webhooks & Compliance Certifications** — REST API with rotatable keys, outbound webhooks with HMAC. Cyber Essentials Plus first (NHS-recognised), then SOC 2 via Vanta/Drata. Annual pentest (~£8k).

**Cross-cutting:** One-page incident runbook, RTO 1hr / RPO 5min, rehearse a restore from backup before launch — *untested backups don't exist.*

---

## My Synthesis (Claude's Analysis)

### The Single Most Important Insight

**ShiftWise is a compliance platform, not yet an agency operating system.** All 4 experts converged on this from different angles:

| Expert | Same insight, different framing |
|--------|--------------------------------|
| Compliance | "Treats compliance as static documents, not live state" |
| Operations | "Compliance tool, not an agency operating system" |
| Product | "Beats WhatsApp on audit; loses to Florence on UX" |
| Technical | "Strong app code, no production infrastructure" |

We built the *trust layer* of the platform exceptionally well (RBAC, encryption, immutable audit, CQC-ready). But the *business layer* (timesheets→invoicing→payroll) and *operational layer* (push, messaging, recurring shifts) are still missing.

### Cross-Cutting Themes

**Theme 1: Static vs Live**
- Compliance: documents are uploaded once and rot. Need live API verification (DBS Update Service, NMC PIN polling).
- Tech: similar pattern — static cron jobs need to become event-driven queues (BullMQ).

**Theme 2: Speed of Truth**
- Product: email is too slow. Shifts fill in minutes; coordinators need push.
- Operations: SMS broadcast for last-minute fills is critical (~30% of shifts).
- Compliance: ICO breach window is 72 hours; agencies need tooling to hit it.

**Theme 3: Mobile-First Reality**
- Workers are field staff (nurses/carers between shifts).
- Email is the wrong channel; PWA is the wrong app form.
- Capacitor wrapper unlocks App Store + native push at minimal cost.

**Theme 4: Compliance is a Floor, Not a Moat**
- Compliance gets us to CQC pass. Operations (payroll, invoicing) gets us paid. UX (push, messaging, profiles) gets us adopted.
- Florence has better UX; Nourish has care-planning. Our moat must be **compliance-as-revenue-enabler** — i.e., compliance integrated tightly with operations so agencies *can't* run their business elsewhere.

### My Recommended Phased Roadmap (Phases 9-13)

#### **Phase 9: Production Foundations** (BLOCKING)
*Without this, can't deploy. ~2-3 weeks.*
- Cloudflare R2 file storage (replace local disk)
- Managed Postgres (Neon/Supabase eu-west-2) + PITR + backups
- Vercel + Railway deployment + GitHub Actions CI/CD
- UK/EU data residency lock-down
- Rate limiting + Cloudflare + Turnstile on OTP

#### **Phase 10: Regulatory Hardening** (CQC/NHS BLOCKING)
*Without this, fails CQC inspection. ~3-4 weeks.*
- DBS Update Service integration (live monitoring)
- NMC PIN live verification (employer confirmation service)
- Right to Work Share Code workflow
- Data retention policies + GDPR erasure workflow (cryptographic shredding)
- WTR validation in assignment engine

#### **Phase 11: Revenue Operations** (BUSINESS CRITICAL)
*Without this, agencies can't run their business. ~4-6 weeks.*
- Timesheets with geo-clock-in/out + coordinator approval
- Client/Care Home CRM + rate cards
- Recurring shifts + shift patterns
- Invoicing engine (with Xero integration)
- Payroll export (BrightPay/Sage CSV)

#### **Phase 12: Adoption & Retention** (GROWTH)
*Without this, churn to Florence. ~3-4 weeks.*
- Web push notifications (VAPID)
- Capacitor mobile app (App Store + Play Store)
- In-app messaging (Django Channels or Stream Chat)
- Worker profile depth (skills taxonomy, languages, vehicle)
- "Shifts near me" with postcode geo-sort

#### **Phase 13: Scale & Trust** (POST-PMF)
*Once we have paying customers. ~ongoing.*
- BullMQ + Redis (event-driven queue)
- Row-Level Security multi-tenant isolation
- Observability (Better Stack + PostHog)
- Public REST API + webhooks
- Cyber Essentials Plus → SOC 2 Type 1

### What I'd Disagree With My Council On

1. **Native app priority** — Product expert says Capacitor in Phase 12. I'd argue **PWA + Web Push first** (Phase 12a) and Capacitor only after we have 100+ active workers asking for it. Capacitor adds Apple Developer account ($99/yr) + App Store review friction + Play Store ($25 one-time).

2. **Multi-regulator support** — Compliance expert ranks this HIGH. I'd defer to Phase 14+ unless we have a confirmed Scottish/Welsh customer. UK market is 85% England-only; supporting 3 extra regulators triples the testing surface for ~15% TAM.

3. **In-app messaging** — Product expert ranks #3. I'd argue **deferred to Phase 13** because it's an attention-sink to build well (real-time, attachments, presence, push). Coordinators can use WhatsApp until we have 50+ paying agencies asking for it.

4. **Payroll integration before invoicing** — Operations expert sequences 1→2→3 as Timesheets→Invoicing→Payroll. I'd swap to **Timesheets→Payroll→Invoicing** because workers leave without pay (existential), but care homes pay on 30-60 day terms (manageable with manual invoices for the first 3 months).

### The Brutal Truth

**ShiftWise has 8 phases of foundation but 0 phases of revenue-generating business workflow.**

The compliance platform we built is genuinely impressive — but a UK healthcare staffing agency can't run their business on it today. They'd still need:
- A timesheet system (paper or another SaaS)
- A payroll system (BrightPay or accountant)
- An invoicing system (Xero or QuickBooks)
- A messaging system (WhatsApp, currently)
- A shift broadcast system (manual phone calls or Florence)

The opportunity: **integrate compliance tightly with these operations** so that *the same shift assignment* automatically produces a timesheet skeleton, an invoice line item, and a payroll record. That's the moat. No competitor does this end-to-end.

### Recommended Single Next Action

**Run `/gsd-new-milestone "Phase 9-13: Production Launch + Revenue Operations"`** to formally add these 5 phases to the roadmap. Don't try to scope them all now — sequence them and let each phase's SPEC define the precise cuts.

If you only do ONE thing next: **Phase 9 (Production Foundations).** Without deployment, none of the other work matters. ShiftWise has been running locally for 8 phases — it needs to ship.

---

## Council Output Summary Table

| Expert | Top 3 Items |
|--------|-------------|
| **Compliance** | NMC live verification · DBS Update Service · GDPR erasure workflow |
| **Operations** | Timesheets · Invoicing · Payroll |
| **Product/UX** | Push notifications · Native app (Capacitor) · In-app messaging |
| **Technical** | File storage (R2/S3) · DB backups + migrations · Deployment + CI/CD |

**Unanimous launch blockers:**
1. File storage + backups (Tech)
2. Live document verification (Compliance)
3. Push notifications (Product)
4. Timesheets (Operations)

These 4 should be in **Phase 9 or Phase 10**, no later.

---

*Council convened: 2026-05-25. 4 experts, parallel execution, ~45 seconds each.*
