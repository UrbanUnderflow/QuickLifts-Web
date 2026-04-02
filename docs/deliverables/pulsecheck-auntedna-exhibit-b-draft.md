# EXHIBIT B
# PERFORMANCE STANDARDS, SERVICE LEVELS, AND OPERATING CADENCE

This Exhibit B forms part of the Strategic Partnership and Integration Agreement (the "Agreement") by and between AuntEdna.ai, Inc. ("AuntEdna") and Pulse Intelligence Labs, Inc. ("Pulse Intelligence Labs"). Capitalized terms used but not defined in this Exhibit B have the meanings given in the Agreement.

## B.1 Purpose

This Exhibit B defines the performance standards referenced in Section 7.3 of the Agreement, including clinical response standards, platform and integration standards, joint operating standards, reporting cadence, and the remediation process that applies if either Party materially underperforms.

This Exhibit B is intended to be operationally usable. Accordingly, the standards below are designed to align with the actual PulseCheck escalation model, including: (a) non-clinical monitor-only events; (b) consent-based clinical escalation events; (c) mandatory critical-safety escalation events; and (d) technical or operational incidents affecting Joint Services.

This Exhibit B shall be interpreted consistently with the data-boundary, minimum-necessary, and limited reverse operational-status flow principles set forth in Exhibit A. Nothing in this Exhibit B is intended to expand the categories of data that may be shared between the Parties beyond what is permitted by the Agreement and Exhibit A.

## B.2 Severity Levels

For purposes of this Exhibit B, the Parties shall use the following tier and incident framework:

| Tier / Incident Class | Event Type | Description | Primary Owner |
| --- | --- | --- | --- |
| Tier 3 | Critical Clinical Safety Event | A mandatory clinical escalation classified by PulseCheck as Tier 3, including self-harm, suicidal ideation, imminent safety risk, abuse disclosure, severe psychological distress, rapid deterioration, or any comparable critical-safety event. Normal programming is suspended and clinical routing begins immediately. | AuntEdna after receipt; Pulse Intelligence Labs for detection and transmission before receipt |
| Tier 2 | Elevated Clinical Care Escalation | A consent-based clinical escalation classified by PulseCheck as Tier 2. PulseCheck pauses normal programming and initiates the clinical handoff path after athlete consent or other lawful authorization to proceed. | AuntEdna after receipt; Pulse Intelligence Labs for detection, consent capture, and transmission before receipt |
| Tier 1 | Coach Review / Support Event | A non-clinical support event classified by PulseCheck as Tier 1 or an equivalent support-visibility flag. This level is intended for coach or staff visibility, monitoring, and non-clinical follow-up, and does not require AuntEdna intake unless separately escalated. | Pulse Intelligence Labs |
| Technical or Operational Incident | Technical or Operational Incident | A system outage, material degradation, data-delivery issue, failed escalation handoff, failed webhook, routing problem, dashboard unavailability, or other operational issue affecting Joint Services. | Party owning the affected function |

For clarity:

1. References to `Tier 1`, `Tier 2`, and `Tier 3` in this Exhibit B are intended to track PulseCheck's native escalation classifications.
2. AuntEdna clinical response standards apply only after AuntEdna receives a transmitted clinical handoff from PulseCheck.
3. A Tier 2 event remains outside AuntEdna clinical timing metrics while athlete consent is pending or if the athlete declines consent, unless otherwise required by law or separately agreed in writing.
4. Tier 1 events are part of the Joint Services support model but are not AuntEdna clinical SLA events unless escalated to Tier 2 or Tier 3.
5. Any status information flowing from AuntEdna back into PulseCheck under this Exhibit B is limited to the operational status metadata permitted by Exhibit A and may be used only for the PulseCheck-side operational mirror of clinical handoff state, operational dashboards, workflow suppression, retry logic, and related non-clinical coordination.

## B.3 AuntEdna Clinical Response Standards

Unless otherwise agreed in a customer statement of work or written operational playbook, AuntEdna shall meet the following response standards for Joint Services escalations properly transmitted by PulseCheck.

### B.3.1 Tier 3 Clinical Safety Events

| Metric | Standard | Measurement |
| --- | --- | --- |
| Operational receipt acknowledgment | Within 30 minutes, 24x7 | Measured from successful receipt of the PulseCheck handoff payload by AuntEdna to acknowledgment or acceptance into AuntEdna's intake or coordination workflow |
| Intake, assignment, or next-step disposition initiation | Within 1 hour during Clinical Coverage Hours; if received outside Clinical Coverage Hours, by 9:00 a.m. local time on the next calendar day unless an earlier emergency-pathway action has already been initiated under the applicable operational playbook | Measured from successful receipt to intake opening, assignment, routing confirmation, crisis-pathway determination, or equivalent documented next-step disposition |
| First clinician follow-up or care-coordination step | Within 12 hours after receipt | Measured from successful receipt to first documented clinician follow-up, care-coordination action, outreach attempt, or equivalent documented clinical action |
| Limited operational status metadata to the PulseCheck-side operational mirror | Promptly after assignment, routing confirmation, or emergency-pathway invocation, and in all cases during the same Clinical Coverage Hours period if available, or otherwise at the start of the next Clinical Coverage Hours period | Any status shared back to PulseCheck must be limited to the operational status metadata permitted by Exhibit A for the PulseCheck-side operational mirror of clinical handoff state and shall not include PHI except as separately authorized in writing |

The Parties acknowledge that Tier 3 events may require use of customer-specific emergency procedures, campus emergency contacts, emergency services, a crisis hotline, or other designated urgent-support resources identified in the applicable customer operational playbook. AuntEdna's obligations under this Section relate to receipt, acknowledgment, intake, triage, care coordination, and clinician follow-up after handoff, and do not by themselves constitute a representation that AuntEdna is acting as a 24x7 emergency dispatch provider, crisis hotline, or substitute for emergency services unless the Parties expressly agree otherwise in writing.

The Parties acknowledge that 24/7 emergency and after-hours coverage protocols may require additional operational infrastructure. The Parties will work together in good faith to define the applicable coverage model in the relevant statement of work, operational playbook, or deployment protocol for each customer deployment.

### B.3.2 Tier 2 Clinical Care Escalations

| Metric | Standard | Measurement |
| --- | --- | --- |
| Receipt acknowledgment | Within 1 hour during Clinical Coverage Hours; otherwise by 10:00 a.m. local time on the next calendar day | Measured from successful receipt of the PulseCheck handoff payload by AuntEdna |
| Intake initiation | Within 4 Clinical Coverage Hours after receipt; if received outside Clinical Coverage Hours, within the first 4 Clinical Coverage Hours of the next coverage period | Measured from successful receipt to intake opening, assignment, or equivalent case activation |
| First clinician outreach or intake follow-up | Within 1 business day after receipt | Measured from successful receipt to first documented clinician outreach, triage request, or equivalent care-path movement |
| Limited operational status metadata to the PulseCheck-side operational mirror | Same business day as intake initiation | Any status shared back to PulseCheck must remain limited to the operational status metadata permitted by Exhibit A and may not include clinical notes, diagnosis, treatment details, or protected care documentation |

### B.3.3 Clinical Coverage Hours

For purposes of this Exhibit B, "Clinical Coverage Hours" means the coverage window identified by AuntEdna in writing to Pulse Intelligence Labs and updated from time to time by written notice. Unless and until the Parties designate a different schedule in writing, Clinical Coverage Hours shall mean 8:00 a.m. to 8:00 p.m. in the applicable customer's local time, Monday through Sunday.

### B.3.4 Exclusions

The following shall not count as AuntEdna clinical SLA failures:

1. Tier 2 events for which athlete consent is pending or declined.
2. Delays caused by incorrect routing metadata or failed transmission attributable to Pulse Intelligence Labs.
3. Delays caused by force majeure events under the Agreement or by customer-side unavailability after outreach has been timely initiated.

## B.4 Pulse Intelligence Labs Platform and Integration Standards

Pulse Intelligence Labs shall meet the following platform and integration standards for Joint Services:

| Metric | Standard | Measurement |
| --- | --- | --- |
| PulseCheck monthly availability for Joint Services workflows | 99.5% monthly uptime | Measured monthly, excluding Scheduled Maintenance and force majeure downtime |
| Tier 3 handoff transmission to AuntEdna | Within 5 minutes of escalation creation | Measured from PulseCheck escalation-record creation for a Tier 3 event to successful transmission or documented manual fallback handoff |
| Tier 2 handoff transmission to AuntEdna | Within 5 minutes after athlete consent or other lawful authorization is captured | Measured from consent capture to successful transmission or documented manual fallback handoff |
| Tier 1 coach notification | Within 15 minutes of event creation | Measured from PulseCheck escalation-record creation to coach notification timestamp |
| Failed Tier 3 handoff remediation | Within 15 minutes of detected failure | Measured from detection of failed transmission to successful re-transmission or documented manual fallback handoff |
| Failed Tier 2 handoff remediation | Within 4 business hours of detected failure | Measured from detection of failed transmission to successful re-transmission or documented manual fallback handoff |
| Critical technical incident acknowledgment to AuntEdna | Within 30 minutes, 24x7 | Measured from internal confirmation of a material technical or operational incident affecting Joint Services |
| Critical technical incident status updates | At least every 4 hours until service restoration | Operational updates only |

### B.4.1 Scheduled Maintenance

"Scheduled Maintenance" means planned maintenance announced by Pulse Intelligence Labs to AuntEdna at least forty-eight (48) hours in advance and not exceeding four (4) hours in any calendar month, except where emergency security maintenance requires a shorter notice period.

### B.4.2 Availability Formula

Monthly uptime shall be calculated as:

Availability Percentage = ((Total Minutes in Month - Unavailable Minutes) / Total Minutes in Month) x 100

For this purpose, "Unavailable Minutes" excludes Scheduled Maintenance and force majeure downtime, but includes unplanned outages or material degradations affecting the Joint Services workflow, escalation routing path, or required coach/staff visibility surfaces.

## B.5 Joint Sales, Commercial Support, and Operating Responsiveness

Each Party shall support Shared Accounts and Joint Services opportunities in a commercially reasonable and timely manner. Unless otherwise agreed in writing for a specific opportunity, the following standards apply:

| Metric | Standard |
| --- | --- |
| Response to a request for support on a live shared sales opportunity | Within 2 business days |
| Attendance decision for a requested customer or prospect meeting | Within 2 business days of request |
| Proposal input, scope comments, or technical narrative support | Within 3 business days after request |
| First-pass redlines on routine commercial paper | Within 5 business days after receipt |
| Launch-planning kickoff after contract signature for a Joint Services customer | Within 10 business days after signature |

Each Party shall use commercially reasonable efforts to attend mutually agreed customer-facing meetings for Shared Accounts where its participation is material to closing, onboarding, or stabilizing the account.

## B.6 Reporting and Review Cadence

### B.6.1 Bi-Weekly Operational Check-Ins

The Parties shall hold bi-weekly operational check-ins as contemplated by Section 11.1 of the Agreement. At a minimum, those check-ins shall review:

1. Open Tier 3 and Tier 2 cases and their current operational status.
2. Escalation volumes and tier mix.
3. Missed or at-risk SLA items.
4. Failed handoffs, routing issues, or dashboard visibility gaps.
5. Active Shared Accounts, implementations, and launch blockers.

### B.6.2 Monthly Operational Report

Within five (5) business days after the end of each calendar month, Pulse Intelligence Labs shall provide a monthly operational report to AuntEdna, and AuntEdna shall provide the non-clinical operational inputs reasonably required to complete it. The monthly report shall include, to the extent available without disclosure of PHI:

1. Total escalation volume and tier mix.
2. Count of Tier 3 and Tier 2 handoffs transmitted.
3. Median time from escalation creation to handoff initiation for Tier 3 and Tier 2 cases.
4. Time-to-acknowledgment, intake-initiation, and first-response performance for AuntEdna on transmitted Tier 3 and Tier 2 cases.
5. Open escalations by aging bucket.
6. Monthly PulseCheck availability percentage.
7. Count of failed transmissions, manual fallback handoffs, and unresolved technical incidents.
8. Shared pipeline status and material sales-support items, where applicable.

For clarity, the monthly operational report may rely on API logs, webhook logs, operational status metadata, and other contemporaneous system records, but shall not require disclosure of PHI, clinical notes, or other AuntEdna clinical documentation into PulseCheck.

### B.6.3 Quarterly Business Reviews

The Parties shall hold quarterly business reviews as contemplated by Section 11.2 of the Agreement. In addition to the items already listed in the Agreement, each quarterly review shall include:

1. A review of quarterly SLA attainment.
2. Trends in escalation volume, speed to care, and unresolved case aging.
3. Any repeated integration or routing failures.
4. Customer feedback themes relevant to Joint Services.
5. Whether any change to workflow, staffing, or routing configuration is required.

## B.7 Measurement Rules

For purposes of this Exhibit B:

1. A timestamp recorded in the system of record for the applicable workflow shall control.
2. PulseCheck shall be the operational system of record for escalation creation time, consent capture time, coach notification time, and the PulseCheck-side operational mirror of handoff initiation and related operational status on the PulseCheck side.
3. AuntEdna shall be the operational system of record for clinical receipt, assignment, intake progression, clinician response, care completion, and underlying clinical workflow state on the AuntEdna side.
4. Where the Parties maintain mirrored operational records, including the PulseCheck-side operational mirror of AuntEdna-origin operational handoff state, any discrepancy shall be reconciled in good faith using API logs, webhook logs, and other contemporaneous system records, with AuntEdna remaining the source of truth for clinical workflow details, care actions, and clinician-owned outcomes.
5. All response-time measurements shall be recorded in the applicable customer's local time where feasible, or otherwise in Coordinated Universal Time with a clearly stated conversion method.
6. Pulse Intelligence Labs shall not be required to expose PHI, clinical notes, or clinical documentation in order to satisfy reporting under this Exhibit B.
7. "Successful receipt" means a successful API acknowledgment, accepted webhook event, documented case creation in the receiving system, or a documented manual fallback handoff through a designated secure operational channel.
8. "Manual fallback handoff" means a documented secure handoff by phone, secure email, secure portal, or other mutually approved contingency channel used when the standard system-to-system handoff path is unavailable.
9. "Business day" means Monday through Friday, excluding federal holidays observed in the United States, unless a customer-specific statement of work states otherwise.
10. "Operational status metadata" means only the limited non-clinical handoff-state metadata permitted by Exhibit A, such as escalation accepted or created, clinician assigned, additional triage requested, appointment booked, crisis pathway invoked, case resolved, or similar operational state changes, and excludes clinical notes, diagnosis, treatment details, therapy content, and protected care documentation.
11. "PulseCheck-side operational mirror" means the limited PulseCheck-side mirror of AuntEdna-origin operational handoff state expressly permitted by Exhibit A for operational dashboards, retry logic, workflow suppression, and related non-clinical coordination.
12. "Core metrics" means: (a) the AuntEdna metrics in Sections B.3.1 and B.3.2 other than the limited operational-status-metadata metrics; (b) the Pulse Intelligence Labs metrics in Section B.4 other than the incident status-update metric; and (c) the support-response metric in Section B.5 for live shared sales opportunities.

## B.8 Remediation and Cure Process

### B.8.1 Notice and Corrective Action

If either Party misses a material metric in this Exhibit B, the Parties shall review the issue at the next bi-weekly operational check-in or sooner if the issue concerns a Tier 3 event. The underperforming Party shall provide a written corrective action plan within ten (10) business days after written request if:

1. any Tier 3 metric is missed on two (2) or more separate incidents in a calendar quarter;
2. the same core metric is missed in two (2) months within the same calendar quarter; or
3. two (2) or more core metrics are missed in the same calendar quarter.

### B.8.2 Material Performance Failure for Section 7.3

For purposes of Section 7.3 of the Agreement, a Party shall be deemed to have materially failed to meet mutually agreed performance standards for a calendar quarter if any of the following occurs:

1. the Party misses any Tier 3 response metric on two (2) or more separate incidents during that quarter;
2. the Party misses any two (2) core metrics during that quarter and fails to timely implement an agreed corrective action plan; or
3. in the case of Pulse Intelligence Labs, monthly availability falls below the target set forth in Section B.4 in two (2) months during the same quarter.

If a Party materially fails to meet the standards in this Exhibit B for two (2) consecutive quarters, the other Party may exercise the rights set forth in Section 7.3 of the Agreement, including the thirty (30) day cure process and, if not cured, the right to engage alternative providers for the underperforming function on a non-exclusive basis while the Agreement remains in effect.

## B.9 Designated Contacts and Escalation Chain

Each Party shall designate and keep current the following contacts for Joint Services:

### AuntEdna

- Business lead: [NAME / TITLE / EMAIL / PHONE]
- Clinical operations lead: [NAME / TITLE / EMAIL / PHONE]
- Technical integration lead: [NAME / TITLE / EMAIL / PHONE]
- After-hours escalation contact: [NAME / TITLE / EMAIL / PHONE]

### Pulse Intelligence Labs

- Business lead: [NAME / TITLE / EMAIL / PHONE]
- Product or operations lead: [NAME / TITLE / EMAIL / PHONE]
- Technical integration lead: [NAME / TITLE / EMAIL / PHONE]
- After-hours escalation contact: [NAME / TITLE / EMAIL / PHONE]

The Parties may update contact details by written notice without requiring a formal amendment to the Agreement, provided that such update does not alter the substantive obligations in this Exhibit B.
