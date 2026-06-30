# AuntEdna NSF Phase II Integration Draft

Working draft for the Phase II Project Description. This is written for the "Technical Objectives, Approach and Work Plan" section, with language the grant writer can shorten. It intentionally frames the work as AuntEdna Phase II R&D and implementation work. PulseCheck is described as a committed integration partner and external system. Pre-existing PulseCheck software, data models, and product development are not presented as NSF-funded work.

## Integration and Service Excellence Layer

Phase I established the core feasibility of MANAS and FREEda Mind as a proactive mental health support system for student-athletes and patients. The Phase I work showed that the system could collect daily self-report data, administer or route clinically validated forms, support AI-assisted check-ins, surface trend information to clinicians, and begin to reduce the gap between what a student or patient experiences day to day and what a provider can see during a scheduled visit. Phase I also identified the next technical barrier: the system cannot scale across universities, athletic departments, clinics, and partner care networks unless the data exchange between systems is reliable, privacy-preserving, and operationally usable.

The Phase II integration work will address that barrier. AuntEdna will build the integration and service excellence layer needed for MANAS/FREEda Mind to exchange the right information with partner software systems, beginning with PulseCheck as a committed integration partner. PulseCheck is a non-clinical athlete readiness, performance, and support workflow platform. AuntEdna is the clinical workflow and care coordination system. The Phase II technical problem is to make those two systems communicate in a way that is fast enough for real support workflows, specific enough for clinical intake, limited enough to protect sensitive information, and flexible enough to work across different university and clinic operating models.

This work is a continuation of Phase I, not a separate product build. In Phase I, the team proved the value of collecting frequent student-athlete inputs, translating those inputs into useful signals, and giving clinicians a more organized view of risk and need. Phase II extends that work by developing the system-to-system architecture required to move from a promising prototype to a deployable service. The integration layer will support the same core aim from Phase I: earlier identification of distress, better routing to the right human support, and less administrative burden on the people responsible for care.

The integration layer will not treat either platform as a broad data dump for the other. The design principle is "minimum necessary exchange." AuntEdna will receive focused handoff packets when a student-athlete or patient needs clinical follow-up. Those packets may include identity-matching information, routing context, consent status, escalation tier, a concise concern summary, and relevant trend context. They will not include unrestricted conversation history, broad roster exports, full performance histories, unrelated analytics, or clinical notes from the other system. AuntEdna will remain the source of truth for clinical intake, triage, clinician assignment, care coordination, clinical notes, and protected care documentation. The partner system will remain the source of truth for non-clinical athlete readiness, performance, engagement, and product workflow data.

Just as important, the reverse flow from AuntEdna back to a partner system will be limited to operational status metadata. For example, AuntEdna may return that a handoff was accepted, a clinician or provider lane was assigned, additional triage is needed, an appointment was booked, a crisis pathway was invoked, or the case was resolved. That return flow is needed so partner dashboards, support workflows, and in-app safety states stay current. It is not intended to move clinical notes, diagnosis, treatment details, therapy content, or protected care documentation into the partner platform.

This distinction is central to the Phase II technical scope. The goal is not simply to "connect two softwares." The goal is to engineer a repeatable, auditable, role-aware integration model that can support universities and clinics without creating new privacy risk or new manual burden. AuntEdna will build and validate the service layer, API contracts, status webhooks, routing logic, implementation workflows, and operational support processes required to make the system usable in real environments.

## Phase II Technical Objective: Partner Integration and Service Excellence Layer

The objective of this Phase II work is to develop and validate a secure integration and service excellence layer that allows MANAS/FREEda Mind to coordinate with partner software systems used by universities, athletics programs, clinics, and clinical support partners. The layer will include:

1. A secure API surface for creating and updating clinical handoff records from partner systems.
2. A minimum-necessary case packet format that gives clinicians enough context to act without over-sharing sensitive or unrelated data.
3. Signed webhook events that return limited operational status to partner systems without returning clinical substance.
4. A routing and profile-linking model that connects organizations, teams, athletes, students, patients, clinicians, provider pools, and implementation contacts.
5. A service excellence workflow that helps universities and clinics launch, monitor, troubleshoot, and improve the integration over time.
6. A measurement and validation plan that evaluates whether the integration reduces handoff delay, reduces manual coordination work, improves visibility into open cases, and supports safe scale across multiple deployments.

This work will be performed by AuntEdna as part of the Phase II project. PulseCheck will participate as a committed partner by making its existing partner-system interface available for integration testing, workflow validation, and pilot feedback. Work that has already been developed by PulseCheck or funded outside this NSF award will not be charged to NSF as AuntEdna Phase II work. The NSF-funded work described here is AuntEdna's integration layer, service workflow, technical validation, and deployment-readiness work needed to make MANAS/FREEda Mind interoperable with committed partner systems.

## Technical Approach

The Phase II approach will begin with a shared data-boundary model. AuntEdna will define which system owns each category of data, what is allowed to cross the integration boundary, and what must remain in the originating system. For the initial PulseCheck integration, the boundary will be organized around three principles:

First, the partner system creates the non-clinical signal and handoff request. In the PulseCheck example, the partner system may identify a support or safety concern based on athlete-facing check-ins, readiness state, conversation context, or configured escalation conditions. PulseCheck owns that non-clinical detection and the creation of its own escalation event.

Second, AuntEdna receives only the focused handoff information needed for clinical intake or care coordination. AuntEdna will create its own clinical case record and will become the source of truth for clinical workflow after receipt. If additional information is needed, AuntEdna will request it through a defined triage flow rather than relying on broad access to the partner system.

Third, the partner system receives only coarse operational status in return. That status is needed to keep dashboards and safety workflows aligned, but it will not expose clinical details. This protects the clinical boundary while still allowing the overall service to feel coordinated to the university, clinic, clinician, coach, staff member, student-athlete, or patient.

The first technical component will be the handoff API. AuntEdna will build endpoints that allow a partner system to submit a clinical handoff, upsert the student or patient identity needed for routing, check the health of the integration, retrieve coarse case status, and resolve operational questions. The main handoff endpoint will accept a versioned JSON payload. The payload will include a stable partner-system identifier, the handoff or escalation identifier, timestamps, routing context, consent or lawful-basis state, escalation tier, concise summary, and limited current-state context when that context is needed for triage. The endpoint will be idempotent so retrying a failed request does not create duplicate cases.

The second technical component will be the webhook and status mirror. AuntEdna will publish signed events when the operational state changes. These events may include handoff accepted, triage requested, clinician assigned, appointment booked, crisis pathway invoked, case resolved, check-in scheduled, check-in completed, or watch-list state updated. The receiving system will use those events to update only a limited operational mirror. Each event will carry a unique event identifier, timestamp, case identifier, and status category so the systems can reconcile records without sharing clinical notes.

The third technical component will be routing and clinician-profile linkage. Universities and clinics do not all operate the same way. Some will have an on-campus counseling center, some will use an external provider network, some will have sports medicine staff involved, and some will need different routing rules by team, sport, cohort, or student. AuntEdna will build the configuration objects and workflow needed to support this variability: organization profile, implementation contact, team or clinic unit, default clinician or provider pool, athlete or patient override, and fallback queue. This routing model will make the integration practical in the real institutional environments identified during Phase I.

The fourth technical component will be the service excellence layer. The integration will not be successful if it only works in a test environment. AuntEdna will build the operating layer needed to support universities and clinics as they come online. This will include implementation checklists, configuration review, test cases, credential and endpoint validation, launch readiness reviews, incident tracking, handoff failure remediation, monthly operational reporting, and quarterly review of integration performance. The service excellence layer will also define who owns each step: AuntEdna engineering, AuntEdna clinical operations, the university or clinic point of contact, and the committed partner's technical or product contact.

The fifth technical component will be observability and measurement. AuntEdna will record the timestamps required to understand whether the integration is working: handoff created, handoff received, case accepted, triage requested, clinician assigned, first follow-up initiated, status event delivered, failed event retried, and manual fallback invoked. These logs will support debugging, quality improvement, and Phase II validation. They will also allow the team to measure whether the integration shortens the time between a concerning signal and a care-coordination action.

## Phase II Work Plan

Task 1: Lock the integration data boundary and system-of-record model.

AuntEdna will define the allowed data categories, prohibited data categories, system-of-record ownership, role-based access rules, and permitted uses for the integration. This task will produce the data architecture for the partner bridge, including the specific rules for what may be sent from a partner system to AuntEdna and what may be returned from AuntEdna to the partner system. The work will include input from clinical, technical, and operations stakeholders so the boundary is usable and not merely theoretical.

Deliverables: data-boundary specification, system-of-record matrix, minimum-necessary payload rules, role-based access map, and implementation review checklist.

Success criteria: all required data fields for the initial handoff can be identified and justified; prohibited fields are explicitly excluded; clinical notes and protected care documentation do not return to the partner system by default; and the specification can be applied to at least two deployment models, such as a university athletics program and an outpatient clinic.

Task 2: Build the AuntEdna partner handoff API and case packet schema.

AuntEdna will build the secure API endpoints required for partner systems to create handoffs, upsert student or patient identity, attach routing context, record consent state, and retrieve coarse operational status. The handoff schema will be versioned, idempotent, and designed for reliable retry. This task will also include input validation, authentication, transport security, logging, and structured error handling.

Deliverables: API endpoint implementation, versioned case packet schema, authentication and key-rotation approach, idempotency rules, error response format, and developer-facing integration notes.

Success criteria: the API can accept a complete handoff packet from the committed partner test environment; duplicate submissions are safely handled; failed requests return actionable errors; required fields are validated; and integration logs capture the timestamps needed for operational review.

Task 3: Build signed operational status webhooks and reconciliation logic.

AuntEdna will build the outbound webhook system that sends limited status updates back to partner systems. The webhooks will use signing, unique event identifiers, retry logic, and delivery logs. The return payload will be limited to operational metadata such as case accepted, clinician assigned, triage requested, appointment booked, crisis pathway invoked, or case resolved. No clinical notes, diagnosis, therapy content, or treatment documentation will be included in the webhook payload.

Deliverables: signed webhook event system, event vocabulary, retry and timeout rules, delivery log, reconciliation procedure, and failure-handling playbook.

Success criteria: partner systems can receive and process AuntEdna status events; failed delivery is retried according to the agreed policy; duplicate events are ignored safely; and the receiving system can update dashboard state without receiving clinical detail.

Task 4: Develop routing, clinician-profile linkage, and deployment configuration.

AuntEdna will build the configuration layer that supports different university and clinic structures. The model will allow a deployment to define organization-level defaults, team or clinic-unit routing, clinician profiles, provider pools, athlete or patient overrides, and fallback queues. This task is important because the same technical product must fit different institutional workflows without requiring custom code for every customer.

Deliverables: routing configuration model, clinician or provider profile linkage, fallback routing rules, admin workflow for configuration review, and launch checklist for each deployment.

Success criteria: the system can route handoffs by organization, team or unit, default clinician or provider pool, and individual override; missing or stale routing data is detected; and no handoff is silently dropped when a route is unavailable.

Task 5: Build the service excellence layer for university and clinic implementation.

AuntEdna will build the operating layer that helps customers adopt the integration safely. This includes a deployment checklist, test cases, staff roles, escalation contacts, launch-readiness review, operational dashboard, incident tracking, and reporting cadence. This work is necessary because the technical handoff only creates value if universities and clinics can trust it, monitor it, and know who is responsible when a workflow needs attention.

Deliverables: service excellence playbook, launch-readiness checklist, role and responsibility matrix, support escalation path, operational dashboard requirements, monthly report template, and quarterly review structure.

Success criteria: each pilot site can be configured, tested, launched, and monitored using the same core process; technical incidents and failed handoffs have a documented response path; and the implementation process identifies customer-specific operational requirements before launch rather than after a failure.

Task 6: Validate the integration in staged and pilot environments.

AuntEdna will validate the integration first in a controlled staging environment and then in limited pilot settings with committed partners. Validation will focus on functional reliability, data minimization, handoff speed, routing accuracy, status synchronization, failure recovery, and usability for university or clinic staff. The team will review both quantitative performance data and qualitative operational feedback.

Deliverables: validation protocol, test results, pilot readiness report, issue log, risk mitigation updates, and final integration performance summary.

Success criteria: the system completes end-to-end handoffs from partner signal to AuntEdna case creation and back to partner operational status; status updates remain limited to approved operational metadata; handoff failures trigger retry or manual fallback; and pilot users can understand the workflow without needing to log into unrelated systems or exchange information manually outside the approved process.

## Two-Year Schedule and Milestones

Months 1-3: Finalize the data-boundary model, system-of-record matrix, case packet fields, webhook vocabulary, and routing assumptions with the committed partner and initial university or clinic stakeholders.

Months 4-6: Build the first version of the AuntEdna handoff API, authentication, case packet validation, error handling, and logging. Begin partner-system integration testing with synthetic cases.

Months 7-9: Build signed status webhooks, delivery logging, idempotency handling, and reconciliation procedures. Test retry behavior, duplicate event handling, and failed-delivery recovery.

Months 10-12: Build the routing and clinician-profile linkage layer, including organization defaults, team or clinic-unit routing, provider-pool assignment, individual override, and fallback queue handling.

Months 13-15: Build the service excellence workflow for launch readiness, customer configuration review, implementation checklist, incident handling, and monthly operational reporting.

Months 16-18: Run end-to-end staging validation with the committed partner. Validate handoff creation, AuntEdna case creation, status return, routing accuracy, and failure recovery.

Months 19-21: Run limited pilot validation with one or more university or clinic environments, subject to customer approval and applicable compliance requirements. Collect operational feedback, timing data, issue logs, and customer workflow observations.

Months 22-24: Refine the integration layer based on pilot findings, complete the Phase II performance summary, document remaining commercialization requirements, and prepare the integration package for broader deployment.

## Technical Risks and Mitigation

Risk 1: Over-sharing data between systems.

The integration could fail commercially or ethically if either system receives more sensitive information than it needs. AuntEdna will mitigate this by using a minimum-necessary payload, excluding prohibited fields by default, limiting reverse webhooks to operational metadata, and documenting system-of-record boundaries before pilot launch.

Risk 2: Routing rules vary by university or clinic.

Universities and clinics differ in staffing, mandated reporting workflows, counseling center structure, athletic department involvement, and after-hours coverage. AuntEdna will mitigate this by building routing as a configurable layer rather than hard-coding a single workflow. Each deployment will include a configuration review and fallback route.

Risk 3: Status synchronization fails or creates confusion.

If AuntEdna and the partner system show different states, staff may not know whether a case has been accepted, assigned, or resolved. AuntEdna will mitigate this with signed webhooks, event identifiers, retry logic, shared correlation IDs, reconciliation reports, and a manual fallback procedure for high-priority failures.

Risk 4: The integration increases, rather than reduces, staff burden.

If the service layer creates too many alerts or unclear responsibilities, adoption will suffer. AuntEdna will mitigate this by validating the workflow with staff users, creating a role and responsibility matrix, measuring failed handoffs and response times, and using monthly operational reviews to refine the process.

Risk 5: The project scope becomes confused with partner-funded or pre-existing software work.

The Phase II scope is AuntEdna's integration layer, service excellence workflow, validation, and deployment-readiness work. Partner software that already exists, including PulseCheck's non-clinical athlete workflow platform and any work funded outside NSF, will not be charged to this NSF project. The integration will use committed partner systems to test and validate interoperability, but NSF funds will support only the AuntEdna work required to make MANAS/FREEda Mind interoperable and scalable.

## Expected Outcomes

By the end of Phase II, AuntEdna expects to have a deployable integration and service excellence layer that can support university and clinic implementations without relying on ad hoc manual coordination. The expected technical outcome is a secure, repeatable bridge between MANAS/FREEda Mind and partner systems, beginning with PulseCheck, that supports focused case handoffs, limited operational status return, routing configuration, implementation support, incident response, and performance measurement.

The expected operational outcome is that universities and clinics can move from scattered tools and manual follow-up toward a coordinated workflow where concerning signals are routed to the right care pathway more quickly, staff can see whether a handoff is open or resolved, and clinical detail remains in the clinical system where it belongs. This will make the Phase I innovation more scalable and commercially viable while preserving the privacy and safety expectations required in mental health settings.

The expected broader impact is improved access to timely, culturally responsive support for student-athletes and patients who may otherwise fall through gaps between daily lived experience and scheduled clinical care. The integration work will help AuntEdna serve HBCUs, athletics departments, counseling centers, and clinics with a model that is technically rigorous, operationally realistic, and ready for broader commercial deployment after Phase II.

