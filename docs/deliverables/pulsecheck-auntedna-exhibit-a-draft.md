# EXHIBIT A
# DATA ARCHITECTURE, HANDOFF, AND SYSTEM BOUNDARIES

This Exhibit A forms part of the Strategic Partnership and Integration Agreement (the "Agreement") by and between AuntEdna.ai, Inc. ("AuntEdna") and Pulse Intelligence Labs, Inc. ("Pulse Intelligence Labs"). Capitalized terms used but not defined in this Exhibit A have the meanings given in the Agreement.

## A.1 Purpose

This Exhibit A defines the data architecture, system boundaries, handoff rules, permitted data flows, access controls, and operational data-governance requirements applicable to the integration between PulseCheck and AuntEdna.

This Exhibit A is intended to preserve the core architectural boundary contemplated by the Agreement:

1. PulseCheck is the non-clinical athlete performance, readiness, and support workflow system.
2. AuntEdna is the clinical workflow and clinical documentation system.
3. Only the minimum necessary data required for escalation routing, operational coordination, and expressly permitted feedback may move between systems.

## A.2 System of Record by Data Category

Unless otherwise expressly stated in this Exhibit A or a later signed writing of the Parties, the following system-of-record allocations shall apply:

| Data Category | Description | System of Record | Owner / Controller | May Be Shared? | Shared With | Permitted Purpose | Storage Restriction |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Athlete identity and account profile | Athlete account identifier, display name, email, username, sport, goals, date of birth, emergency contact, and related account metadata maintained in PulseCheck | PulseCheck | Pulse Intelligence Labs | Yes, in part | AuntEdna | Identity matching, intake initiation, and safety response for transmitted escalations, but only to the extent reasonably necessary for the specific handoff | PulseCheck remains source of truth for non-clinical account data; only the minimum necessary identity and contact fields may be transmitted |
| Team, organization, and routing configuration | Team membership, organization affiliation, coach linkage, team default clinician-route metadata, athlete routing overrides, and related non-clinical routing configuration | PulseCheck | Pulse Intelligence Labs | Yes, in part | AuntEdna | Routing escalations to the correct clinical destination | AuntEdna may store only the routing metadata required to receive and process the escalation |
| Athlete-facing non-clinical check-in and readiness data | Daily check-ins, self-report, readiness signals, support flags, fatigue indicators, engagement signals, state snapshots, and related non-clinical support data | PulseCheck | Pulse Intelligence Labs | Yes, in part | AuntEdna | Provide minimum necessary context for an escalation handoff | Only the minimum necessary subset may be transmitted in an escalation payload or summary |
| Performance and training data | Cognitive performance scores, protocol assignments, simulation outputs, profile trends, pillar scores, modifier summaries, adherence signals, and related non-clinical training data | PulseCheck | Pulse Intelligence Labs | Yes, in part | AuntEdna | Contextual support for an escalation handoff where operationally necessary | AuntEdna shall not use this data for unrelated analytics, model training outside partnership scope, or competing-product development |
| Escalation conditions and non-clinical routing logic | Detection logic, thresholding, flagging criteria, category mappings, assignment logic, consent prompts, and escalation-generation logic in PulseCheck | PulseCheck | Pulse Intelligence Labs | No, except descriptive operational documentation as needed | AuntEdna | Operational understanding of handoff triggers only | AuntEdna shall not obtain, copy, or control PulseCheck source logic or product logic |
| PulseCheck escalation records and audit metadata | Escalation tier, category, trigger message reference, classification reason, coach-notified status, consent status, handoff status, and non-clinical operational timestamps created in PulseCheck | PulseCheck | Pulse Intelligence Labs | Yes, in part | AuntEdna | Intake, triage routing, handoff reconciliation, and operational reporting | PulseCheck remains source of truth for PulseCheck-side event creation, consent capture, and handoff initiation metadata |
| Coach notification metadata | Coach identifier, notification timestamps, support queue status, and privacy-safe staff visibility metadata | PulseCheck | Pulse Intelligence Labs | Yes, in limited form | AuntEdna | Operational coordination where needed for a transmitted escalation | No clinical content may be pushed into coach-facing views through this data category |
| AuntEdna clinician-profile and routing records | AuntEdna clinician profiles, provider-pool identities, assignment destinations, and clinician-side routing records | AuntEdna | AuntEdna | Yes, in limited form | PulseCheck | Display-safe routing labels, linkage validation, and operational handoff status | PulseCheck may store only a local mirror of routing metadata, labels, linkage ids, and sync timestamps |
| Clinical intake, triage, and support records | Intake answers, clinical notes, triage determinations, appointment records, care pathway actions, clinician communications, crisis-pathway actions, case files, and related clinical workflow records | AuntEdna | AuntEdna | No, except limited operational status metadata expressly permitted below | PulseCheck | Not applicable except for limited operational status coordination | PulseCheck shall not be the system of record and shall not store clinical notes, diagnostic interpretation, or protected care documentation |
| PHI, mental-health records, EHR, billing, and CPT data | Protected health information, clinical records, mental-health records, EHR entries, insurance or billing records, CPT coding, and regulated clinical documentation | AuntEdna | AuntEdna | No, except as separately required by law or authorized in a separate signed writing | PulseCheck | Not applicable | No PHI shall enter PulseCheck or any Pulse Intelligence Labs system unless separately authorized in writing |
| PulseCheck-side operational mirror of clinical handoff state | AuntEdna external ids, handoff accepted / assigned / resolved status, appointment-booked indicator, crisis-pathway invoked indicator, and similar operational state labels that do not disclose clinical substance | PulseCheck mirror of AuntEdna-origin status | Pulse Intelligence Labs for mirror object; AuntEdna for underlying clinical state | Yes | PulseCheck | Operational dashboards, retry logic, incident reconciliation, and suppression of inappropriate athlete workflows | Mirror limited to operational status only; no clinical notes, care documentation, diagnosis, or treatment details |
| De-identified aggregate outcome signals | Aggregate escalation counts, resolution rates, speed-to-care metrics, response-time summaries, and generalized outcome categories that are de-identified and not reasonably linkable to a specific individual | AuntEdna | AuntEdna | Yes | PulseCheck | Improvement of PulseCheck detection, routing, support systems, analytics, and quarterly reporting under the Agreement | Must be de-identified and aggregated; no individual-level clinical data may be included |

## A.3 Escalation Event Payload

### A.3.1 Minimum Necessary Payload Rule

PulseCheck may transmit to AuntEdna only the minimum necessary operational and contextual data required to:

1. identify the athlete;
2. identify the triggering escalation event;
3. route the escalation to the proper AuntEdna destination;
4. give AuntEdna enough non-clinical context to initiate intake or triage; and
5. allow AuntEdna to request additional intake through its own workflow without requiring PulseCheck to store clinical records.

PulseCheck shall not treat the escalation payload as a license to transmit the athlete's entire account history, full conversation history, raw session logs, or broad non-clinical dataset exports.

### A.3.2 Approved Escalation Payload Elements

Subject to the minimum-necessary rule above, the permitted escalation payload may include the following fields or their operational equivalents:

| Payload Element | Meaning | Required / Optional |
| --- | --- | --- |
| `pulseUserId` or equivalent unique athlete reference | PulseCheck athlete identifier | Required |
| `pulseConversationId` or equivalent conversation reference | PulseCheck conversation identifier relevant to the escalation | Required |
| `escalationRecordId` | PulseCheck escalation record identifier | Required |
| Athlete display-safe identity fields | Name, username, email, sport, goals, and similar identity-match fields reasonably required for intake routing | Required as reasonably necessary |
| Team or organization context | Team, organization, cohort, or routing context needed to place the athlete in the correct support lane | Optional, but permitted |
| Date of birth and emergency contact | Additional identity and emergency context where reasonably necessary for safety response, identity verification, or applicable customer requirements | Permitted only where reasonably necessary |
| Escalation tier | PulseCheck escalation tier or equivalent severity level | Required |
| Escalation category | PulseCheck escalation category | Required |
| Triggering-content excerpt or concise triggering-content summary | The specific triggering content excerpt, or a concise summary of the triggering content, reasonably necessary to explain the basis for the escalation | Required, subject to minimum necessity |
| Classification reason | PulseCheck's non-clinical reason for classification | Required |
| Conversation summary | A concise summary prepared for handoff | Permitted and recommended |
| Relevant non-clinical notes or context summary | Limited non-clinical context relevant to intake, such as support notes or similar operational summaries | Optional, but permitted if minimum necessary |
| Escalation timestamp | Time of handoff event creation | Required |
| PulseCheck callback or reconciliation reference | Secure callback or lookup reference for operational reconciliation | Optional, but permitted |

### A.3.3 Prohibited Payload Elements

Unless separately authorized in a signed writing of both Parties, the escalation payload shall not include:

1. full account exports;
2. bulk historical conversation transcripts beyond what is reasonably necessary for the specific handoff;
3. broad performance-history dumps;
4. PHI already generated or maintained inside AuntEdna;
5. clinical notes, diagnostic impressions, or treatment plans;
6. broad roster datasets unrelated to the escalated athlete; or
7. any data category that would cause PulseCheck to become a repository for AuntEdna clinical records or cause AuntEdna to become a repository for unrelated PulseCheck product data.

## A.4 Permitted Data Flows

### A.4.1 Primary Flow

The core permitted integration flow shall be as follows:

1. The athlete interacts with PulseCheck through non-clinical athlete-facing workflows.
2. PulseCheck evaluates athlete state, message content, history, and configured escalation conditions within PulseCheck's own non-clinical logic.
3. If the applicable criteria are met, PulseCheck creates an escalation event and stores the PulseCheck-side escalation record.
4. If the escalation is a consent-based event, PulseCheck captures or records the athlete's consent state before clinical handoff, unless law or policy requires otherwise.
5. PulseCheck transmits the approved escalation payload to AuntEdna.
6. AuntEdna receives the payload, creates or updates its own clinical-side record, and conducts intake, triage, clinician assignment, crisis handling, scheduling, or other clinical workflow steps inside AuntEdna.

### A.4.2 Limited Reverse Operational Flow

Notwithstanding the Parties' intent to preserve a one-way clinical escalation boundary, AuntEdna may provide limited operational status metadata back to PulseCheck where necessary for Joint Services operations. That reverse flow is strictly limited to non-clinical status data such as:

1. escalation accepted or created;
2. clinician assigned;
3. additional triage requested;
4. appointment booked;
5. crisis pathway invoked;
6. case resolved or moved to ongoing care; and
7. similar operational state changes.

Any reverse flow under this Section A.4.2 shall:

1. remain limited to operational status metadata;
2. exclude clinical notes, diagnosis, treatment detail, therapy content, or protected care documentation; and
3. be used only to support PulseCheck operational views, retry logic, workflow suppression, and privacy-safe staff visibility.

### A.4.3 De-Identified Feedback Flow

AuntEdna may provide de-identified aggregate outcome signals to Pulse Intelligence Labs on a quarterly basis or other mutually agreed cadence, including aggregate response times, aggregate resolution rates, and generalized outcome categories, solely as permitted by Section 5.4 of the Agreement and this Exhibit A.

## A.5 Access Controls

Each Party shall apply role-based, minimum-necessary access principles to all data shared or mirrored under this Exhibit A.

### A.5.1 Pulse Intelligence Labs Access Rules

Pulse Intelligence Labs personnel may access:

1. PulseCheck athlete-account, performance, readiness, support, and non-clinical escalation records as necessary for product operations, support, analytics, security, and permitted reporting;
2. limited AuntEdna-origin operational handoff status mirrored into PulseCheck;
3. display-safe routing metadata and linkage records needed to maintain the integration; and
4. de-identified aggregate outcome signals provided by AuntEdna.

Pulse Intelligence Labs personnel shall not access:

1. AuntEdna clinical notes;
2. PHI or EHR records maintained by AuntEdna;
3. diagnostic interpretation, treatment documentation, or billing records; or
4. any AuntEdna data beyond the minimum operational mirror expressly permitted in this Exhibit A.

### A.5.2 AuntEdna Access Rules

AuntEdna personnel may access:

1. transmitted escalation payload data;
2. routing context reasonably necessary to receive and process the escalation;
3. limited PulseCheck operational metadata relevant to an active escalated case; and
4. other PulseCheck data only as expressly permitted by this Exhibit A or another signed writing.

AuntEdna personnel shall not access:

1. unrelated PulseCheck customer or athlete datasets;
2. PulseCheck product logic, scoring models, or thresholding logic except at a descriptive operational level;
3. broad performance histories not needed for the active escalation; or
4. any Pulse Intelligence Labs confidential information outside the scope of the integration.

### A.5.3 Role-Scoped Visibility Principles

Without limiting the general minimum-necessary access requirements above, the Parties acknowledge the following role-scoped visibility principles for PulseCheck:

1. athletes may access only their own data and support-route summaries;
2. coaches may access roster readiness, performance, and privacy-safe support or safety visibility only to the extent role-authorized;
3. coach-facing views shall not expose raw clinical detail, clinical interpretation, or AuntEdna clinical records;
4. support staff, performance staff, admins, and clinicians shall have differentiated visibility according to role and minimum-necessary principles;
5. administrative control over teams or pilots does not automatically grant access to sensitive escalation content; and
6. clinician-linked access must be explicit and role-scoped, not ad hoc.

## A.6 Permitted Uses and Restrictions

### A.6.1 Permitted Uses by Pulse Intelligence Labs

Pulse Intelligence Labs may use PulseCheck data and integration-shared data only to:

1. operate, maintain, secure, and support PulseCheck;
2. generate and route non-clinical escalation events;
3. maintain customer-facing and staff-facing operational workflows;
4. improve PulseCheck's detection, routing, support, and product operations;
5. perform privacy-compliant analytics, measurement, and reporting under the Agreement; and
6. use de-identified aggregate outcome signals provided by AuntEdna solely to improve PulseCheck systems and related reporting.

### A.6.2 Permitted Uses by AuntEdna

AuntEdna may use integration-received data only to:

1. perform intake, triage, clinical support, clinician assignment, crisis handling, scheduling, care coordination, compliance, and related clinical operations under the Agreement;
2. maintain operational linkage and handoff reconciliation between systems; and
3. generate de-identified aggregate outcome signals permitted by the Agreement.

### A.6.3 Prohibited Uses by Both Parties

Absent prior written consent of the other Party, neither Party may use shared data to:

1. train models outside the scope of the partnership;
2. sell, license, disclose, or monetize the other Party's data to third parties;
3. develop a competing product using the other Party's shared data;
4. perform unrelated marketing or audience-building activities;
5. create a broad shadow database of the other Party's core operational system; or
6. circumvent the data-boundary principles established by the Agreement and this Exhibit A.

## A.7 Retention, Deletion, and Return

### A.7.1 Retention

Each Party may retain integration-transmitted data only for as long as reasonably necessary to:

1. perform its obligations under the Agreement;
2. satisfy legal, compliance, audit, security, or dispute-resolution obligations; and
3. maintain necessary operational logs, backups, and incident records.

Unless a longer period is required by law, regulation, litigation hold, or documented security obligations:

1. Pulse Intelligence Labs shall retain AuntEdna-origin operational mirror data only for as long as reasonably necessary for Joint Services operations, reporting, incident review, and audit;
2. AuntEdna shall retain PulseCheck-transmitted escalation payload data in accordance with AuntEdna's legal and clinical record-retention obligations; and
3. de-identified aggregate outcome signals may be retained as long as they remain de-identified and are used only for permitted purposes.

Each Party shall maintain, and make available upon reasonable request, a written retention schedule or written retention policy covering the integration-shared data categories it receives under this Exhibit A.

### A.7.2 Deletion or Return on Termination

Upon termination or expiration of the Agreement, each Party shall, at the other Party's election and except to the extent retention is required by law:

1. return or securely destroy data received from the other Party through the integration;
2. discontinue all further use of such data;
3. remove active access to integration endpoints and credentials; and
4. certify return or destruction in writing within thirty (30) days, consistent with Section 5.6 of the Agreement.

### A.7.3 Backup and Archive Exception

If integration-received data persists in secure backup media or archival systems after the deletion deadline:

1. the receiving Party shall not restore or use that data except as required for backup integrity, disaster recovery, legal retention, or security review;
2. the data shall remain subject to the confidentiality and use restrictions of the Agreement; and
3. the receiving Party shall delete or overwrite such data in the ordinary course of backup rotation when commercially reasonable.

## A.8 Security Standards and Incident Notice

Each Party shall maintain commercially reasonable administrative, technical, and physical safeguards appropriate to the sensitivity of the data it receives or stores under this Exhibit A, including:

1. encryption in transit for integration payloads and status exchanges;
2. role-based access controls;
3. access logging and auditability for sensitive integration operations;
4. credential-management and secret-management controls;
5. secure development and change controls for production integration endpoints; and
6. incident-response procedures reasonably designed to contain, investigate, and remediate security events.

If either Party discovers unauthorized access to or unauthorized disclosure of integration-shared data that materially affects the other Party, the affected Party shall notify the other Party without undue delay and, where practicable, within forty-eight (48) hours after confirming the incident. Such notice shall include, to the extent known at the time:

1. the general nature of the incident;
2. the systems or data categories affected;
3. the remediation steps taken or planned; and
4. any operational actions reasonably requested to mitigate ongoing harm.

## A.9 PHI Handling Rules

The Parties expressly agree as follows:

1. Pulse Intelligence Labs shall not access, receive, store, or process PHI through PulseCheck or any other Pulse Intelligence Labs system unless expressly authorized in a separate signed writing.
2. AuntEdna is the system of record for PHI, clinical documentation, and regulated clinical workflow records.
3. If PHI is inadvertently transmitted to Pulse Intelligence Labs, Pulse Intelligence Labs shall promptly notify AuntEdna, isolate the affected data, refrain from further use except as required for incident response, and cooperate on commercially reasonable remediation steps.
4. Nothing in this Exhibit A authorizes PulseCheck to store AuntEdna clinical notes, diagnostic detail, treatment records, EHR records, or billing records.

## A.10 Change Management Contacts and Approval

No Party may materially alter the integration boundary without the other Party's prior written approval by designated operational leads. The following changes require mutual written approval:

1. addition or removal of payload fields in the escalation handoff;
2. changes to permitted data categories that cross systems;
3. changes to integration endpoints, authentication methods, or webhook contracts;
4. changes to routing rules that materially affect handoff destination or visibility scope;
5. changes to what operational status metadata may flow from AuntEdna back into PulseCheck; and
6. changes to retention, deletion, or access-control posture that materially affect the other Party.

Notwithstanding the foregoing, a Party may implement emergency security changes immediately where reasonably necessary to address an active or imminent security risk, provided that such Party gives the other Party prompt post-change notice and cooperates in good faith on any resulting integration adjustments.

### Change Management Contacts

#### AuntEdna

- Clinical operations lead: [NAME / TITLE / EMAIL / PHONE]
- Technical integration lead: [NAME / TITLE / EMAIL / PHONE]
- Privacy or compliance contact: [NAME / TITLE / EMAIL / PHONE]

#### Pulse Intelligence Labs

- Product or operations lead: [NAME / TITLE / EMAIL / PHONE]
- Technical integration lead: [NAME / TITLE / EMAIL / PHONE]
- Privacy or security contact: [NAME / TITLE / EMAIL / PHONE]

The Parties may update contact details by written notice without requiring a formal amendment to the Agreement, provided that such update does not alter the substantive obligations in this Exhibit A.
