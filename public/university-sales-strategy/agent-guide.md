# University Pilot Sales: Agent Operating Guide

Status: PROPOSED operating guide. Current live saved runbook not verified.
Source: repository default university sales runbook and inspected PipeLists implementation.
This document describes a workflow; it grants no tool access or permission to send messages, update accounts, schedule meetings or make commitments.

## Product identity
Use Athletic Mind as the school-facing product name. Describe mental performance and mental care as equal parts of one product. Omit the underlying company names from school-facing materials. Preserve clinical responsibilities, consent boundaries and evidence requirements when describing either part.

## Current buyer resources and commercial baseline

Resource register updated October 18, 2026. Use these named references for new university opportunities. The founder owns commercial approval and the version shared with each buyer; record the resource URL or filename and date in the opportunity notes.

| Sales moment | Current resource | Sharing |
| --- | --- | --- |
| Initial outreach and discovery | [University buyer guide](https://theathleticmind.ai/universities) | public |
| Discovery, budget conversations and custom scope of work | [University pricing](https://theathleticmind.ai/university-pricing) | public |
| Sponsor and internal university sharing | [University overview PDF](https://theathleticmind.ai/universities/downloads/athleticmind-university-overview.pdf) | public |
| Pilot planning, success measures and purchasing decision date | [Pilot blueprint PDF](https://theathleticmind.ai/universities/downloads/athleticmind-pilot-blueprint.pdf) | public |
| Detailed product and commercial diligence | Institutional FAQ: `TheAthleticMind-Institutional-QA-2026-10-18.pdf`. Founder-provided copy. | Founder provides the appropriate reviewed copy; the full document contains investor material and historical account information. |
| Institutional privacy, security and data-flow diligence | Data governance package: `The_Athletic_Mind_Data_Governance_Summary_2026.pdf`. Founder-provided copy. | Founder provides the latest reviewed package and institution-specific supporting agreements; confirm currency before sharing. |

Standard new pilot: **$7,500 for 12 weeks, up to 50 athletes**. Smaller cohorts or different requirements belong in a written custom scope of work. Preserve existing signed agreements, including UMES's existing pilot; the standard offer does not amend those terms.

Standard annual pricing: **$25,000 program fee + $250 per contracted athlete, with a $50,000 annual minimum**. At 500 athletes, the standard annual price is $150,000. Multi-year discounts are quoted in the written proposal. Confirm the applicable internal approval before quoting a discount, changing the minimum or combining credits and discounts. The public pricing page is the current baseline for new proposals; an executed institution-specific agreement governs that account.

Use the blueprint to record the cohort, success measures, review dates and purchasing decision date. The final review records paid continuation, expansion, a bounded extension or closeout. Illustrative proof remains labeled illustrative; absent measures stay “not yet collected.”

Keep investor material, private commercial policy and institution-specific agreements in controlled sharing channels. The governance summary is a reference for diligence, not proof of current deployment or the university's signed terms. The founder confirms current supporting evidence before sharing it.

## Approved email channel
Use the founder-approved business Gmail inbox for all email in this university pilot sales workflow, including introductions and follow-ups. This channel decision is approved; sending scope and agent access still require verification.
Do not use the Brevo integration attached to PipeLists, its Send Email controls, or its email-sequence send/resume actions for this workflow. Do not fall back to Brevo if Gmail is unavailable. Keep the item blocked and notify the owner.
Use PipeLists for account research, stages, owners, activity logs and next actions. Before the first Gmail touch, check for existing Brevo outreach to the same contact. If any sequence is active, block new outreach until an authorized owner pauses it and verifies that future sends have stopped.
Before every Gmail send, verify the approved sender account, recipient, latest thread, stop requests, scheduled follow-ups and prior sends. Pause generic follow-ups on a reply; stop outreach on an opt-out or delivery failure. Verify cancellation of any queued sends. If reply access or suppression cannot be verified, keep work in draft mode.
Record verified Gmail sends in PipeLists activity logs with recipient, time, subject, available message/thread reference, outcome and next action/date. Read replies in Gmail and log their substance in PipeLists. Do not assume automatic Gmail sync or treat Brevo delivery/open/click fields as Gmail evidence. A confirmed send does not prove delivery or inbox placement.
If a send outcome is uncertain, reconcile Gmail Sent and the thread before retrying. Track substantive replies and meetings as primary sales signals.

## Inbound university inquiries

Tremaine Grant owns inbound university inquiries. Review the receiving inbox each business day and record a next action and date for each genuine inquiry.

- The website pilot form submits through `/api/demo-request`. Its internal transactional Brevo notification is addressed to `hello@fitwithpulse.ai`, which is visible in the connected Gmail inbox. Custom-pricing links and the form's email fallback open a draft to `tre@fitwithpulse.ai`.
- Website notifications do not automatically create University Pilots records. Before manual intake, check for an existing organization and contact, then create or update the appropriate opportunity through the authorized PipeLists workflow.
- Record the source page, available email message/thread reference, stated need, owner, next action and due date. Keep pilot value separate from potential annual value. Assign a stage only after a person validates the inquiry and its evidence.
- Exclude clearly labeled tests from forecasts and outreach. An endpoint success response alone does not establish inbox delivery or a saved CRM record; verify those separately.
- The Gmail-only rule governs buyer outreach. An internal website notification is a transactional intake message; it does not authorize Brevo sales campaigns or change the approved outbound channel.

## Activation gate
1. Read the authorized live PipeLists University pipeline and saved runbook. Record its version/date. Reconcile differences with this snapshot; escalate material conflicts rather than silently overriding either source.
2. Confirm authenticated identity, target environment, exact list, roles and authorized actions. Do not borrow credentials, bypass owner restrictions or write directly to underlying data stores to evade the application.
3. Confirm target segment, exclusions, geography, pilot capacity, commercial objective, approved messages/assets, sender, outreach volume, working hours/timezone and budget rules with the founder. These are not set by this page.
4. Confirm reply access, suppression controls, scheduling behavior and how stopping an active sequence is verified. An email tracking event is not a human reply.
5. Begin in research-and-draft mode until explicit authorization permits further actions. Verify a small approved batch before unattended execution. No flawless execution or autonomous deployment is implied.

## Each operating cycle
- Refresh current records; review replies, stop requests, active sequence state, overdue next actions and buyer commitments before new outreach.
- Deduplicate by organization, verified contact and existing linked records. Preserve saved custom stages and user edits.
- Select accounts using approved priorities. Proposed order: buyer commitments and replies, due follow-ups, qualified new accounts, then trigger-based nurture.
- For each account, identify owner, evidence-supported stage, next action and due date. Unknown values stay unknown and produce a task.
- Prepare or perform only authorized actions. Before a send, verify recipient, scope of approval, suppression, relevant approved content, live sequence state and absence of an equivalent completed touch.
- Record actual outcome, source, time, actor and next step. Re-open or refresh the saved record to verify persistence. Do not move stage without evidence.
- On an uncertain send result, reconcile the existing attempt and provider state before retrying. On version conflict, re-read and preserve newer changes. Never retry blindly.
- End with a concise brief: completed actions, replies, meetings confirmed, changes in stage with evidence, blocked items, approvals needed and next due actions. Distinguish researched, drafted, approved, attempted, sent and delivered.

## Outreach timing and implementation
Runbook sequence: research before Day 1; email Day 1; human call Day 4; proof email Day 8; close-loop email Day 12; trigger-based nurture from Day 21.
Execute email touches through Gmail only. Track each due touch and the separate Day 4 human call in PipeLists next actions and activity logs. Confirm calendar-day or business-day timing, working hours and actual send dates. Delays shift later dates; replan rather than compressing missed touches.
Gmail follow-up scheduling and reply detection are unverified. Before unattended sending, verify read/reply access, suppression and cancellation controls through the authorized integration. Until then, prepare drafts and have a named owner review each touch. PipeLists Brevo sequences must remain inactive for these contacts.

## Reply handling
- Interested | Pause generic sequence; record the stated need and route to founder for discovery. Offer only confirmed availability with authorization. | Engaged; scheduled only after agreement.
- Referral / wrong person | Record referral evidence, verify the new person and suppression status; prepare a relevant introduction. | Keep the account stage evidence-based; new contact is not automatically engaged.
- Not now | Record the requested timing and reason. Pause the sequence and schedule an authorized revisit. | Paused with restart condition and date.
- Objection / existing provider | Record the objection accurately. Prepare a response grounded in approved product facts and the current workflow. | Founder handles pricing, clinical, compliance and contractual questions.
- No response | Continue only the approved remaining touches. After the sequence, move to trigger-based nurture. | Do not advance based on delivery, opens or clicks.
- Stop / unsubscribe | Stop further outreach immediately through the authorized suppression workflow; verify sequence is paused and alert the owner. | Record do-not-contact status. If access fails, escalate urgently; do not send.
- Bounce / delivery error | Stop the sequence; verify the address and delivery state before any retry. | Report blocked delivery; never invent a replacement address.
- Ambiguous send / save failure | Re-read the record and provider state. Reconcile whether the action completed before retrying. | Unknown outcome stays unresolved; prevent duplicate sends or updates.

## Canonical stage evidence
- Identified | University fit and credible need hypothesis, with a source and verification date. | Research owner records contacts, missing evidence and next action. | Outreach Queued only when fit, two stakeholders and draft preparation are complete.
- Outreach Queued | Named owner, two verified stakeholders, relevant message and approved resource. | Prepare Gmail sender, recipient, follow-up plan, call task and authorization record. | First Email Sent only after a verified send result; a draft stays queued.
- First Email Sent | Verified Day 1 Gmail send, logged with recipient, time and message/thread reference. | Read replies before the next touch. Record the completed action in the contact activity log, verify the saved log, then move the card and set the next action/date. | A substantive reply moves directly to Engaged or the appropriate outcome. Stop requests suppress outreach. Advance to another touchpoint only after that action is verified; log any skipped touch explicitly.
- Call Attempted | Human-confirmed Day 4 call attempt, logged with time, caller and actual outcome. | Read replies before the next touch. Record the completed action in the contact activity log, verify the saved log, then move the card and set the next action/date. | A substantive reply moves directly to Engaged or the appropriate outcome. Stop requests suppress outreach. Advance to another touchpoint only after that action is verified; log any skipped touch explicitly.
- Follow-Up Email Sent | Verified Day 8 Gmail follow-up in the existing thread, logged with send evidence. | Read replies before the next touch. Record the completed action in the contact activity log, verify the saved log, then move the card and set the next action/date. | A substantive reply moves directly to Engaged or the appropriate outcome. Stop requests suppress outreach. Advance to another touchpoint only after that action is verified; log any skipped touch explicitly.
- Final Outreach Email Sent | Verified Day 12 final outreach email in Gmail, logged with send evidence. | Read replies before the next touch. Record the completed action in the contact activity log, verify the saved log, then move the card and set the next action/date. | A substantive reply moves directly to Engaged or the appropriate outcome. Stop requests suppress outreach. Advance to another touchpoint only after that action is verified; log any skipped touch explicitly.
- Engaged | Relevant human reply or conversation; record interest, objection or referral. | Pause generic follow-ups. Qualify priority, workflow, timing and buying group. | Meeting Scheduled requires an agreed time and attendees; a proposed time is insufficient.
- Meeting Scheduled | Confirmed meeting, participants and purpose. | Prepare discovery and persona-specific demonstration. Log findings and technical questions after the meeting. | Proposal Sent requires completed discovery/validation evidence, approved terms and confirmed proposal delivery.
- Proposal Sent | Approved scope, cohort, responsibilities, support path, price and dates sent to the buyer. | Track questions, procurement/security path and the agreed review date. | Negotiating requires actual buyer discussion of terms or changes; silence is not negotiation.
- Negotiating | Documented buyer requests and unresolved commercial or procurement issues. | Prepare responses; founder owns pricing, commitments and exceptions. | Pilot Agreed requires documented mutual agreement on scope, price and responsibilities.
- Pilot Agreed | Mutual agreement and a defined contracting path. | Coordinate contract review and launch preparation; record unresolved conditions. | Contract Signed requires the executed agreement, not verbal approval.
- Contract Signed | Verified executed agreement with scope, value and term. | Record pilot value separately from post-pilot annual value. Assign implementation owner. | Pilot Active requires completed launch tasks and first valid reporting week. A free pilot contract is not paid conversion.
- Pilot Active | Launch complete, confirmed cohort and valid reporting inputs. | Weekly scorecard; coach/coordinator working review every two weeks; midpoint buyer review. | Pilot Complete requires end-of-pilot review and recorded outcome. Track paid conversion, renewal and expansion separately.
- Pilot Complete | Documented results, limitations, buyer decision and follow-through owner. | Hand off paid delivery, a bounded extension, expansion or agreed closure. | No automatic revenue claim. Link the commercial outcome and its actual signed value.
- Closed Lost / Paused | Recorded reason and explicit distinction between lost and paused. | For paused accounts, keep a restart condition and date. For stop requests, suppress outreach. | Reopen only with documented new evidence and appropriate authorization.

## Touchpoint logging and migration
After each verified Gmail send or human-confirmed call, create a contact activity log, verify it saved, then move the card to the completed touchpoint and set its next action/date. Dates alone never advance a card. If logging fails after a send, reconcile and repair the log without sending again. A reply can leave the sequence at any point. Record skipped calls explicitly; a later email stage does not prove the call occurred.
Existing cold-email-sent cards retain their ID and history under First Email Sent. Review their logs before assigning later touchpoints. After Final Outreach Email Sent, retain that stage until an actual response, explicit pause/closure or approved nurture action.

## Record fields
- Account identity | Title, Organization, Source URL | Check for existing organization/contact records before adding a lead.
- Execution | Owner, Priority, Next Step, Next Action Required Date | One concrete action with a person and date. Do not infer an owner from a name mentioned in notes.
- Contacts and authority | Contact Emails, Contact Phone, LinkedIn URL, Decision Maker | Verify role and source. Record champion and other stakeholders in structured notes when no dedicated field exists.
- Evidence and history | Notes, attachments, activity logs | Record date, actor, observed result, source and next step. Separate facts, hypotheses and proposed actions.
- Commercial plan | Amount, ACV, Expected Close Date, Contract Term | Label pilot value and post-pilot annual value separately. Stage probability is not observed conversion evidence.
- Pilot plan | Pilot Scope, Athlete Count, Pilot Start, Pilot End, Expansion Path | Add success plan, review dates, support contacts and handoff owner.
- Outcome | Loss Reason, notes and linked commercial evidence | Differentiate paid conversion, renewal, expansion, extension, paused and closed lost.

## Escalation and commercial boundaries
Bring the founder in for interest requiring discovery, pricing/discounts, contractual commitments, security/privacy exceptions, clinical/compliance claims, uncertain evidence, access failures and material conflicts in saved records. Provide account, observed evidence, decision needed, recommended next step and due date.
Never claim a paid deal, partnership, clinical effect or screening compliance without supporting evidence. Use approved aggregate and commercial information in PipeLists; athlete responses, private conversations and clinical details remain in authorized operational systems.

## Cadence and measurement
Proposed internal sales rhythm: Monday priorities and capacity; authorized execution blocks and reply review during the week; Friday pipeline and learning review. Exact hours and volumes require confirmation.
Pilot delivery rhythm from the current planning discussion: launch check after week one, weekly scorecard, working reviews every two weeks with coach/coordinator, buyer at kickoff/midpoint/decision. The default source runbook says weekly champion meetings; reconcile the saved version before treating the new cadence as its official replacement.
Measure qualified accounts, verified sends, substantive replies, meetings held, stage aging, next-action coverage, signed pilot value and paid conversions. Define period and denominators before calculation. Pilot completion is not conversion, opens are not interest, and forecasts are not revenue.

## Pilot handoff
Before launch confirm executive sponsor, champion, Athletic Mind owner, technical owner and escalation contact. Document scope, price, dates, cohort, consent boundaries, measurement sources/targets/owners, midpoint review and commercial decision date. Continue through the Pilot Renewal Strategy page. A founder-approved result is paid continuation, expansion, bounded extension or closure with a recorded reason.

## Definition of a completed agent run
Every attempted action is reconciled or explicitly blocked; every active worked account has an owner and next action/date; every stage change has evidence; no messages or commitments exceed authorization; the founder receives a reviewable summary.
