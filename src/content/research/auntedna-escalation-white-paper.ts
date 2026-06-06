export const AUNTEDNA_ESCALATION_WHITE_PAPER_SLUG =
  'ai-supported-escalation-human-clinical-handoff-and-return-to-training-pathways';

export const AUNTEDNA_ESCALATION_WHITE_PAPER_METADATA = {
  title: 'AI-Supported Escalation, Human Clinical Handoff, and Return-to-Training Pathways',
  subtitle:
    'A joint PulseCheck and AuntEdna.ai white paper on responsible escalation design, structured referral pathways, clinical safety loops, and the boundary between AI support and licensed care.',
  excerpt:
    'A white paper on how athlete-facing AI can identify concern signals, pause inappropriate training, and route athletes into licensed human care without claiming to diagnose, treat, or replace clinical judgment.',
  author: 'PulseCheck x AuntEdna.ai',
  authorTitle: 'Joint clinical safety and athlete support research collaboration',
  category: 'Clinical Safety',
  readTime: '29 min read',
  contentType: 'white-paper' as const,
  featured: false,
  visibility: 'unlisted' as const,
  listed: false,
  passwordProtected: true,
  status: 'published' as const,
  createdAt: '2026-06-05T00:00:00.000Z',
  updatedAt: '2026-06-05T00:00:00.000Z',
  publishedAt: '2026-06-05T00:00:00.000Z',
  featuredImage: '/auntedna-mark.png',
};

export const AUNTEDNA_ESCALATION_WHITE_PAPER_CONTENT = `
:::abstract
Athlete-facing performance platforms increasingly operate near sensitive mental health signals. Athletes may disclose distress directly, show repeated low-readiness patterns, stop eating consistently, sleep poorly, withdraw from teammates, miss sessions, or deteriorate across performance and recovery markers before an obvious emergency occurs. A responsible system cannot treat those signals as ordinary engagement data, and it cannot respond by asking the athlete to keep training through a safety concern.

This white paper proposes an AI-supported escalation architecture jointly framed by PulseCheck and AuntEdna.ai. PulseCheck remains the non-clinical performance, state, and routing layer. AuntEdna.ai remains the clinical source of truth when a case moves into care. The core thesis is that AI should not automate clinical judgment. It should help detect, structure, document, and route concern signals earlier, while licensed clinicians own assessment, care decisions, emergency disposition, clearance, and continued monitoring.

The paper describes the boundary between low readiness, support need, elevated clinical concern, and emergency risk; a clinical safety loop that pauses PulseCheck curriculum during high-risk events; a structured escalation pathway that defines warning signs, first notification, role involvement, timing, documentation, and return criteria; and a pilot evidence plan that uses observational reporting frameworks such as STROBE after deployment. The goal is not to prove that the product is clinically validated before evidence exists. The goal is to define a responsible care bridge, then measure whether it improves speed to human touch, referral quality, athlete trust, and safe return to training.
:::

# 1. Introduction: Athlete AI Needs an Escalation Architecture

Mental performance systems are moving from static education into interactive, data-aware software. Athletes can check in daily, ask questions, complete state-regulation protocols, run pressure simulations, and receive adaptive assignments. This creates a powerful opportunity: a system can notice patterns that are easy to miss in the noise of a season.

It also creates a responsibility. A product that sees signs of distress cannot behave as if every athlete state is a training problem. Some states call for a shorter session. Some call for coach awareness. Some call for clinical review. Some call for immediate emergency procedures. A responsible product must know when to stop training and start routing.

PulseCheck and AuntEdna.ai approach this as an AI-to-human pathway. PulseCheck can help identify concern signals, preserve context, suppress inappropriate curriculum, and route the athlete into a defined care lane. AuntEdna.ai can receive the handoff, run the clinical workflow, involve licensed clinicians, coordinate follow-up, and send limited operational status back to PulseCheck. The athlete should not experience this as abandonment by the product. They should experience it as continuity: when the system detects that training is no longer the right response, it becomes quieter and moves the athlete toward human care.

This paper is written for athletics departments, sports medicine teams, mental health partners, clinical leaders, university stakeholders, and responsible AI reviewers. It explains what the system should do when athlete-facing AI detects concern, what it should not do, and how the partners can validate the model over time.

# 2. The Boundary Problem

The first design challenge is conceptual. Not every bad day is a crisis, and not every crisis begins with an explicit statement of danger. Athlete support systems need a vocabulary that can separate ordinary performance-state variation from support need, clinical concern, and emergency risk.

PulseCheck uses four broad operating states:

- Low readiness: the athlete may be tired, stressed, sore, distracted, or under-recovered, but there is no safety concern. The right response may be a lighter session, a recovery protocol, or deferment.
- Support visibility: the athlete shows repeated red-state patterns, persistent deterioration, or concerning non-emergency context. The right response is human follow-up, lower intensity, and observation, not automatic clinical escalation.
- Elevated clinical concern: the athlete communicates distress or shows patterns that may justify consent-based handoff to clinical support. The right response is a structured referral pathway.
- Emergency or high-risk escalation: explicit safety language, imminent danger, severe disorientation, credible violence risk, inability to stay safe, or deployment-defined emergency conditions appear. The right response is immediate safety mode and the applicable emergency pathway.

This separation matters because collapsing everything into one severity score creates poor behavior. If the system treats every low-readiness day as clinical risk, it will overburden clinicians and erode athlete trust. If it treats every pattern as ordinary training context, it may miss the window where human care should enter. The system needs both sensitivity and restraint.

The boundary also protects coaches and support staff. Coaches may see signs, ask supportive questions, and route concern. They should not be asked to diagnose, treat, or independently assess clinical risk. In some deployments, coaches or staff may also be mandated reporters when certain safety, abuse, or safeguarding concerns arise. The white paper therefore treats education and role clarity as part of the safety architecture, not as optional rollout material. [cite:1,2,3]

# 3. The PulseCheck and AuntEdna.ai Model

PulseCheck and AuntEdna.ai occupy different parts of the pathway.

PulseCheck is the athlete-facing performance and state-routing layer. It reads check-ins, conversation signals, protocol activity, simulation outcomes, roster context, coach constraints, and wearable or recovery data when available. It can classify concern signals against a bounded policy, create an escalation record, suppress normal programming, and transmit a minimum-necessary handoff packet.

AuntEdna.ai is the clinical pathway partner. Once a handoff is accepted into AuntEdna.ai, clinical workflow state, intake, clinician assignment, care actions, crisis pathway decisions, clearance, and continued monitoring belong on the AuntEdna.ai side. PulseCheck may mirror limited operational status, but it should not become a shadow clinical record system.

This division keeps the product honest. AI can help with detection, summarization, routing support, contradiction checks, and audit preparation. AI should not be framed as a clinician. It should not diagnose. It should not determine whether an athlete is safe. It should not clear a person back into training after an emergency. Those are human clinical decisions.

The design goal is a care bridge. PulseCheck can notice and route. AuntEdna.ai can assess and care. The athlete remains at the center.

# 4. The Clinical Safety Loop

The clinical safety loop is the clearest expression of the partnership model. When concern crosses a defined boundary, PulseCheck stops behaving like a training product and becomes a routing surface.

| Stage | What Happens | Owner |
|---|---|---|
| 1. Safety block activated | PulseCheck suspends normal curriculum, Sims, Trials, high-pressure assignments, and performance-facing prompts while the safety state is active. | PulseCheck |
| 2. Minimum-necessary handoff | PulseCheck sends a focused case packet with identity, routing, tier/category, triggering summary, consent state when applicable, and freshness-aware context. | PulseCheck to AuntEdna.ai |
| 3. Clinical intake and assignment | AuntEdna.ai creates or updates the clinical case, assigns the clinician or care lane, and determines the appropriate next step. | AuntEdna.ai |
| 4. Licensed clinician-led care | The athlete works with a licensed clinician or approved clinical pathway. AI may support summarization or routing, but not clinical judgment. | AuntEdna.ai clinician |
| 5. Emergency alleviated | When the clinician determines the acute risk has reduced, AuntEdna.ai sends limited clearance or status metadata to PulseCheck. | AuntEdna.ai |
| 6. Return to PulseCheck | PulseCheck removes the curriculum block only after receiving the allowed clearance state, then returns the athlete through a gentle path. | PulseCheck with AuntEdna.ai clearance |
| 7. Continued monitoring pathway | AuntEdna.ai may keep the athlete in a continued clinical monitoring status after the acute event resolves. | AuntEdna.ai with limited PulseCheck mirror |
| 8. Closure or ongoing support | The case may close, remain monitored, or move into ongoing care outside the PulseCheck training pathway. | AuntEdna.ai |

The return path matters. An athlete should not move from an emergency block directly into high-pressure training. The first PulseCheck action after clearance should be conservative: a check-in, low-intensity protocol, recovery-oriented pathway, or reduced challenge. The system can rebuild normal curriculum after the operational status supports it.

# 5. Structured Escalation Pathways and Notification Rules

Early detection is only credible when the next step is structured. The paper should answer the questions clinicians and institutions will ask: who is notified first, what warning signs trigger escalation, when behavioral health, psychiatry, social work, security, or emergency services enter, how quickly the response should happen, and what documentation is required.

The pathway should be a matrix, not a vague alert policy. The matrix below is a proposed white paper version. Deployment-specific protocols, state laws, school policies, coverage hours, and licensed clinical judgment must refine it before pilot use.

| Scenario or Warning Sign | First Notification | Role Involvement | Response Timing | Required Documentation | PulseCheck Curriculum Effect |
|---|---|---|---|---|---|
| Persistent low readiness, repeated red state, or concerning decline without acute safety language. | Coach or named support role first; AuntEdna.ai only if support pathway or policy requires. | Support visibility; behavioral health consult if concern persists. | Same day or next school day depending pilot policy. | State snapshot, trend summary, support flag, staff follow-up, and rationale for not activating emergency pathway. | Reduce intensity, pause high-pressure assignments, and continue monitoring. |
| Athlete asks for help, discloses distress, or shows functional decline without immediate danger. | Athlete-facing consent path plus AuntEdna.ai intake route; coach/support notified according to consent and policy. | Behavioral health first; social work if practical needs drive risk. | Same day when feasible; otherwise next clinical coverage window. | Concern summary, consent state, triggering excerpt or observation, referral route, and handoff status. | Pause pressure exposure and use support or defer training until the route is settled. |
| Self-harm language, hopelessness, or suicidal ideation without clear plan, intent, or immediate means. | AuntEdna.ai behavioral health lane; coach/support notified according to safety policy. | Behavioral health clinician; psychiatry if risk assessment suggests higher acuity, medication concern, or severe symptoms. | Urgent same-day review where coverage allows. | Exact concern excerpt, risk flags, protective context if known, classifier tier, notification attempts, receipt, and mitigation plan. | Activate safety hold or block based on policy; avoid normal curriculum until reviewed. |
| Suicidal ideation with plan, intent, means, recent attempt, inability to stay safe, threats of violence, or severe disorientation. | Emergency pathway immediately; AuntEdna.ai clinical lead and local emergency/campus protocol as defined by deployment. | Behavioral health crisis response, psychiatry, emergency services; security only for immediate physical safety, location support, or violence-risk logistics. | Immediate or within minutes; do not wait for routine workflow. | Timestamps, triggering evidence, who was notified, failed attempts, emergency route used, block activation, and limited operational status returned. | Full curriculum block until AuntEdna.ai or the defined emergency pathway clears the operational hold. |
| Psychosis, mania, severe intoxication or withdrawal concern, major medication concern, or rapidly escalating impairment. | AuntEdna.ai urgent clinical route; emergency pathway if immediate safety risk exists. | Psychiatry or emergency behavioral health; medical emergency route when physical health risk is suspected. | Urgent same-day or immediate depending severity. | Observed warning signs, source, timing, athlete location if permitted and needed, handoff recipient, and clinical-route status. | Safety hold or block; no high-pressure training until clinician review. |
| Housing, food, family, academic, transportation, abuse, neglect, exploitation, or safeguarding concern drives the risk picture. | Coach/support or AuntEdna.ai route depending consent and risk level. | Social work, campus support, mandated reporting pathway, or behavioral health if distress is clinically significant. | Within 24-48 hours for non-acute needs; immediate if abuse, neglect, exploitation, or safety risk is suspected. | Support need, consent or reporting basis, route chosen, referral destination, and follow-up owner. | Adjust training load and keep support visibility active until the barrier is addressed or routed. |
| Clinician determines acute risk has reduced and athlete may return to PulseCheck. | AuntEdna.ai sends limited clearance or status update to PulseCheck. | Licensed clinician owns clearance; coach/support sees only role-appropriate operational status. | Only after clinician clearance or defined resolution event. | Clearance status, timestamp, permitted return conditions, and monitoring status without clinical notes by default. | Remove block gradually: check-in, recovery protocol, lower-intensity programming, then normal curriculum when appropriate. |
| Athlete remains clinically stable but needs continued monitoring after emergency or elevated concern. | AuntEdna.ai monitoring status mirrored to PulseCheck in limited operational form. | Behavioral health, social work, psychiatry, or care coordination depending clinician judgment. | Cadence set by AuntEdna.ai or deployment protocol. | Monitoring status, next review cadence if shareable, curriculum limits, and status-change events. | Keep conservative programming and suppress high-pressure assignments where policy requires. |

Security should be described narrowly. Security or emergency services should not be the default mental health response. They enter when there is imminent physical danger, violence risk, a missing-athlete or location-support need, weapons concern, or a deployment-specific emergency protocol that requires them.

Documentation should also be narrow. Required documentation is an event record, not a broad data export: trigger, tier/category, source, timestamp, notification order, consent or safety basis, handoff recipient, delivery and receipt status, curriculum block state, clearance status, and monitoring state. Clinical notes, diagnosis, treatment detail, and protected care documentation remain AuntEdna.ai-side records by default.

Joint Commission suicide-prevention resources emphasize validated screening, assessment after positive screens, documentation of risk level and mitigation plans, written policies, staff training, reassessment, monitoring, follow-up, and ongoing review. [cite:4] SAMHSA's crisis-care guidance emphasizes a coordinated system with someone to contact, someone to respond, and a safe place for help. [cite:5] Zero Suicide similarly frames safer systems around identify, engage, treat, transition, and improve. [cite:6] The proposed pathway translates those concepts into an athlete-support product boundary.

# 6. Education, Alignment, and Referral Readiness

AuntEdna.ai clinical feedback adds a central operational theme: early identification only works when the human layer is trained, aligned, and ready to refer. The system is not just an algorithmic classifier. It is a shared protocol across athlete, product, coach or support staff, and licensed clinical care.

This aligns with integrated-care logic. WHO describes mental health care in general health-care settings as requiring collaborative and multidisciplinary partnerships and training for professionals who may identify and refer people with mental health complaints. [cite:7] WHO's mhGAP Intervention Guide is specifically designed for mental, neurological, and substance use disorders in non-specialized health settings. [cite:8] In athletics, the parallel is clear: coaches, athletic trainers, team staff, and performance professionals may be close enough to notice changes, but that proximity does not make them clinicians.

The paper should therefore treat education as a safety control:

- Athletes should know what PulseCheck is, what it is not, what kinds of safety exceptions may exist, and how to seek human support.
- Coaches and support staff should know the difference between low readiness, support visibility, elevated concern, and emergency escalation.
- Staff should know when to make a referral rather than attempt informal counseling or independent risk assessment.
- Mandated reporting obligations should be named in deployment-specific training and documentation, especially for abuse, neglect, exploitation, imminent danger, or safeguarding concerns.
- AuntEdna.ai clinicians should have enough context to receive a useful handoff without receiving irrelevant product history.
- Product and clinical teams should have a feedback loop to correct unclear summaries, over-routing, under-routing, and confusing athlete experiences.

The National Athletic Trainers' Association and partner organizations have previously emphasized education, early recognition, effective mental health referral, and risk planning for student-athletes with psychological concerns. [cite:2,3] That history matters. PulseCheck is not inventing the need for recognition and referral. It is proposing a product architecture that can support those pathways with better signal capture, documentation, and handoff discipline.

# 7. Pattern Escalation: Beyond Clear Emergencies

The most obvious emergency signals are not the only signals that matter. A system should also consider patterns that develop before crisis. Examples include eating less, sleeping much more or much less, sudden withdrawal, missed sessions, unusual irritability, loss of interest, escalating hopeless language, sharp recovery decline, or a repeated gap between what the athlete reports and how they perform.

NIMH and SAMHSA both list changes in eating, sleeping, withdrawal, agitation, hopelessness, substance use, and new or increased warning signs as reasons to seek help quickly, especially when behavior is new or escalating. [cite:9,10] PulseCheck should not convert those signs into a diagnosis. It can, however, treat them as pattern signals that deserve structured review.

The working hypothesis for pilot research is that some athletes may show a pattern window before a clear crisis event. The notes from clinical collaborators suggest a possible 30-day observation window, including patterns such as not eating or repeated deterioration before an acute escalation. The paper should present that as a research question, not a proven rule.

PulseCheck should test 7-day, 14-day, and 30-day windows:

- Do state, eating, sleep, recovery, adherence, conversation, and performance signals change before an escalation?
- Are in-season and out-of-season patterns different?
- Are elite, non-elite, starting, reserve, injured, or non-travel roster roles affected differently?
- Do athletes with no escalation events still cluster in risk-adjacent states?
- Which athletes benefit most from low-intensity support before clinical escalation is needed?
- Which signals create too many false positives to be useful?

This matters because the non-escalated cohort is not boring. Athletes who never develop a crisis can still teach the system what stability looks like, what support patterns resolve without clinical handoff, and who benefits from mental performance tools without requiring safety escalation. The comparison between escalated, monitored, support-only, and no-escalation cohorts is how the product can learn whether it is helping the right people at the right time.

# 8. In-Season, Out-of-Season, and Roster Context

Athlete mental health does not exist outside the sports calendar. In-season stressors may include travel, competition pressure, selection anxiety, injuries, fatigue, public evaluation, and reduced schedule flexibility. Out-of-season stressors may include loss of structure, identity disruption, isolation, body-composition pressure, uncertain role status, academic or financial pressure, and less daily contact with support staff.

The paper should not assume that one period is always more dangerous. Studies on seasonality in student-athletes and elite athletes are still developing, and findings may vary by sport, sex, year, injury status, role, and performance level. [cite:11,12,13] The useful claim is narrower: a responsible escalation study should stratify by season status and roster context rather than treating all athlete days as identical.

PulseCheck can support this by treating roster and calendar context as explanatory context, not as a clinical label. A repeated red-state pattern during championship week may mean something different from the same pattern during an isolated off-season training block. A reserve athlete who stops attending team activities may need a different support pathway than a starter whose state deteriorates after injury. A highly successful athlete with no overt issues may still carry risk that is hidden by performance output.

For pilot evaluation, the paper should recommend cohort comparisons:

- In-season versus out-of-season.
- Pre-season, competition, post-season, off-season, and return-from-break windows.
- Injured versus non-injured athletes.
- Starting, reserve, developmental, and non-travel roster roles where appropriate and ethically permissible.
- Athletes with emergency escalation, elevated handoff, support-only visibility, and no escalation events.
- Athletes who appear high-performing but show deteriorating internal state.

The purpose is not to sort athletes into fixed labels. The purpose is to learn which groups benefit from which support pathway and whether the product is identifying hidden need, preventing worsening patterns, or merely documenting obvious crises.

# 9. AI-to-Human Touch

The phrase AI-to-human touch captures the governing principle. AI can help with scale, pattern recognition, summarization, and routing. It cannot replace the moral and clinical authority of a human care relationship.

In this model, AI may:

- Detect explicit safety language or repeated deterioration patterns.
- Compare current state against recent baseline.
- Summarize the minimum necessary context for a handoff.
- Flag confidence, missing context, and contradictory signals.
- Recommend a pathway category inside policy rails.
- Suppress normal curriculum when a safety hold is active.
- Preserve an audit trail for later review.

AI may not:

- Diagnose a mental health condition.
- Provide therapy or clinical treatment.
- Decide that an athlete is safe after an emergency.
- Override a clinician, institutional policy, or emergency protocol.
- Invent new safety pathways outside approved policy.
- Send broad transcript, health, or training exports when a focused case packet is sufficient.

FDA clinical decision support guidance reinforces the importance of enabling clinicians to independently review the basis for software recommendations in contexts where clinical decision support is used. [cite:14] The ONC HTI-1 final rule similarly reflects the broader movement toward transparency for algorithmic and predictive decision support. [cite:15] Even when PulseCheck is not framed as a clinical decision support product, the design lesson is useful: high-stakes AI should make its basis reviewable, not opaque.

# 10. Data Exchange and System-of-Record Boundaries

The handoff should be a focused case packet, not a data export.

PulseCheck should transmit only what is necessary for the active escalation: athlete identity and contact fields when authorized or required, team and routing context, tier and category, concern summary, triggering excerpt when necessary, consent or safety basis, state snapshot summary, freshness, sources used, and correlation IDs.

AuntEdna.ai should own clinical intake, triage, clinician assignment, care actions, emergency disposition, clinical notes, treatment detail, diagnosis, billing, and protected care documentation. PulseCheck should store only limited operational status: accepted, assigned, in care, clearance granted, monitoring active, resolved, failed, retrying, or closed, depending on the final partner-approved vocabulary.

| Data Category | PulseCheck Position | AuntEdna.ai Position |
|---|---|---|
| Athlete account and team context | Source of truth for non-clinical product identity and routing metadata. | Receives only what is necessary for handoff and intake. |
| Conversation and training history | Stays in PulseCheck except for focused excerpts or summaries needed for the specific case. | Should not receive broad history by default. |
| State snapshot | Sends a concise summary with freshness and source provenance. | Uses context for intake, without treating PulseCheck as a clinical record. |
| Clinical intake and notes | Does not mirror by default. | Source of truth. |
| Care actions and clearance | Mirrors limited operational status only. | Source of truth for clinical status and clearance. |
| Aggregate outcomes | May receive de-identified, aggregated pilot outcomes where permitted. | Can provide aggregate feedback for system improvement. |

The privacy principle is simple: the higher the concern, the more important the route becomes, but the payload still stays minimum necessary.

# 11. Ethics and Governance

Responsible escalation is not only a technical architecture. It is a governance posture.

WHO's 2024 guidance on large multi-modal models in health emphasizes that generative AI can create new opportunities and risks in health care, scientific research, public health, and drug development. [cite:16] NIST's AI Risk Management Framework provides a broader governance structure for mapping, measuring, managing, and governing AI risk. [cite:17] The American Psychiatric Association's app evaluation model emphasizes safety, privacy, evidence, usability, and data integration when clinicians and patients evaluate mental health apps. [cite:18]

For PulseCheck and AuntEdna.ai, the ethics requirements include:

- Transparency: athletes should know when AI may help detect, summarize, and route concern.
- Consent: consent-based handoff should be explicit where policy allows; emergency exceptions should be clearly disclosed.
- Human oversight: clinical authority stays with licensed clinicians and approved emergency pathways.
- Minimum necessary data: escalation does not justify broad product export.
- Auditability: every handoff, block, status change, notification, and clearance should be reviewable.
- Bias and error monitoring: partners should review false positives, false negatives, subgroup differences, sport-context bias, and clinician feedback.
- Consumer voice: athlete/patient feedback should shape protocol language, disclosures, and experience design.
- Post-launch monitoring: safety review continues after deployment.

The product must also avoid a subtle ethical failure: making athletes feel punished for disclosure. If asking for help leads to opaque surveillance, roster consequences, or loss of autonomy, athletes may stop telling the truth. The escalation pathway must be clear, respectful, and proportionate.

# 12. STROBE and Post-Pilot Evidence

STROBE should be positioned carefully. It is not a quality-care standard for escalation pathways. It is a reporting guideline for observational studies. The STROBE Statement provides checklist items that should be included when reporting observational research, including cohort, case-control, and cross-sectional studies. [cite:19,20]

That makes STROBE relevant after a pilot, not as proof that the pathway is clinically valid on day one. If PulseCheck and AuntEdna.ai later publish pilot outcomes, STROBE can help structure transparent reporting of study design, participants, variables, data sources, bias, statistical methods, results, limitations, and interpretation.

This is especially important because early pilot evidence will likely be observational. The partners may study escalation events, time to handoff, time to first human touch, response timing, clinician feedback, athlete trust, and cohort differences without randomizing athletes into safety and non-safety conditions. STROBE helps make that kind of evidence more transparent.

The paper should separate three evidence levels:

- Design validity: the architecture aligns with integrated care, crisis care, AI governance, and recognition/referral principles.
- Operational validity: the system reliably routes, blocks, documents, and mirrors status as designed.
- Outcome validity: pilot data shows that the pathway improves detection, time to human touch, referral quality, trust, or safe return compared with baseline practice.

The first can be argued in this paper. The second and third must be measured.

# 13. Validation and Pilot Learning Plan

The pilot should evaluate more than whether escalation records are created. It should ask whether the pathway is useful, safe, trusted, and clinically meaningful.

| Domain | Example Measures | Why It Matters |
|---|---|---|
| Detection quality | Sensitivity to explicit safety language, review of missed or ambiguous cases, clinician audit of concern summaries. | Determines whether the system finds the right cases without pretending to diagnose. |
| Pattern detection | 7-day, 14-day, and 30-day shifts in eating, sleep, readiness, recovery, conversation, adherence, and performance. | Tests whether concern patterns emerge before obvious escalation. |
| False positive burden | Non-urgent cases routed into review, staff workload, athlete frustration, clinician usefulness ratings. | Prevents the system from overwhelming care teams. |
| Speed to handoff | Time from escalation creation to AuntEdna.ai receipt and acknowledgment. | Measures whether the bridge works operationally. |
| Speed to human touch | Time from case receipt to intake, outreach, appointment, emergency pathway, or clinician action. | Measures whether early detection becomes human support. |
| Curriculum safety | Time from escalation to block activation, inappropriate assignment suppression, return path after clearance. | Confirms that PulseCheck stops training when it should. |
| Athlete trust | Consent understanding, disclosure comfort, perceived support, perceived stigma, willingness to use the system again. | Safety pathways fail if athletes stop being honest. |
| Clinician usefulness | Summary quality, missing context, over-sharing, route appropriateness, documentation burden. | Ensures the case packet helps clinicians rather than creating noise. |
| Cohort learning | In-season versus out-of-season, roster role, injury status, performance tier, support-only, escalation, and no-escalation cohorts. | Tests which athletes benefit most and where hidden need appears. |
| Return safety | Clearance timing, monitoring status, low-intensity return path, recurrence or re-escalation after return. | Prevents premature return to pressure. |

The study should include athletes with no escalation events. That cohort helps define stability and gives the partners a comparison group for season status, roster role, performance tier, and mental performance benefit. It can also answer a product question: are tools helping only athletes already in crisis, or are they improving state regulation and support for athletes who never escalate?

The pilot should also include clinician review loops. AuntEdna.ai clinicians should be able to mark a summary as useful, insufficient, too broad, too narrow, or misleading. PulseCheck should treat that feedback as product evidence.

# 14. What the Paper Should Not Claim

This white paper should be explicit about its limits.

PulseCheck and AuntEdna.ai should not claim that:

- AI diagnoses mental health conditions.
- AI provides therapy.
- AI replaces licensed clinicians.
- AI determines emergency status without human or policy review.
- AI clears an athlete to return after an emergency.
- The escalation model is clinically validated before pilot data exists.
- A 30-day pattern window is proven for all athletes or all crises.
- Coach or staff visibility is equivalent to clinical care.

The stronger claim is more defensible: a responsibly governed AI-supported product can detect and structure concern signals, stop inappropriate training, route athletes into human care, and produce the evidence needed to validate the pathway over time.

# 15. Conclusion

The future of athlete support is not AI instead of clinicians. It is a structured bridge between early signal detection and human care.

PulseCheck can see performance state, training context, conversation signals, and repeated patterns that may otherwise remain fragmented. AuntEdna.ai can provide the licensed clinical pathway when concern moves beyond performance support. The value of the partnership is not that AI becomes clinical. The value is that AI helps the system know when to stop training and start caring.

If the model works, the outcome is practical: earlier recognition, clearer referral, less ambiguity for coaches, better documentation, faster human touch, safer curriculum blocks, clinician-controlled return, and continued monitoring when needed. If the model does not work, the evidence plan should show where it fails.

That is the right standard for responsible AI in athlete mental health: build the pathway, bound the claims, measure the outcomes, and keep clinical authority human.

:::references
[1] National Collegiate Athletic Association. (2024). Mental Health Best Practices: Understanding and Supporting Student-Athlete Mental Health, Second Edition. NCAA.
[2] Neal, T. L., Diamond, A. B., Goldman, S., Klossner, D., Morse, E. D., Pajak, D. E., Putukian, M., Quandt, E. F., Sullivan, J. P., Wallack, C., & Welzant, V. (2013). Inter-association recommendations for developing a plan to recognize and refer student-athletes with psychological concerns at the collegiate level: An executive summary of a consensus statement. Journal of Athletic Training, 48(5), 716-720.
[3] National Athletic Trainers' Association. (2013). NATA releases consensus statement for developing a plan to recognize and refer student athletes with psychological concerns at the collegiate level.
[4] The Joint Commission. (2026). Resources for suicide risk reduction.
[5] Substance Abuse and Mental Health Services Administration. (2025). National Behavioral Health Crisis Care Guidance.
[6] Education Development Center. (n.d.). Zero Suicide framework.
[7] World Health Organization Regional Office for Europe. (n.d.). Taking care of mental health in general health care.
[8] World Health Organization. (2016). mhGAP intervention guide for mental, neurological and substance use disorders in non-specialized health settings, version 2.0.
[9] National Institute of Mental Health. (2025). Warning Signs of Suicide.
[10] Substance Abuse and Mental Health Services Administration. (2024). Warning Signs of Suicide.
[11] Reardon, C. L., Hainline, B., Aron, C. M., Baron, D., Baum, A. L., Bindra, A., Budgett, R., Campriani, N., Castaldelli-Maia, J. M., Currie, A., Derevensky, J. L., Glick, I. D., Gorczynski, P., Gouttebarge, V., Grandner, M. A., Han, D. H., McDuff, D., Mountjoy, M., Polat, A., Purcell, R., Putukian, M., Rice, S., Sills, A., Stull, T., Swartz, L., Zhu, L. J., & Engebretsen, L. (2019). Mental health in elite athletes: International Olympic Committee consensus statement. British Journal of Sports Medicine, 53(11), 667-699.
[12] Gulliver, A., Griffiths, K. M., Mackinnon, A., Batterham, P. J., & Stanimirovic, R. (2015). The mental health of Australian elite athletes. Journal of Science and Medicine in Sport, 18(3), 255-261.
[13] Donohue, B., Gavrilova, Y., Galante, M., Gavrilova, E., Loughran, T., Scott, J., Chow, G., Plant, C. P., & Allen, D. N. (2018). Controlled evaluation of an optimization approach to mental health and sport performance. Journal of Clinical Sport Psychology, 12(2), 234-267.
[14] U.S. Food and Drug Administration. (2022). Clinical Decision Support Software: Guidance for Industry and Food and Drug Administration Staff.
[15] Office of the National Coordinator for Health Information Technology. (2024). Health Data, Technology, and Interoperability: Certification Program Updates, Algorithm Transparency, and Information Sharing Final Rule.
[16] World Health Organization. (2024). Ethics and governance of artificial intelligence for health: Guidance on large multi-modal models.
[17] National Institute of Standards and Technology. (2023). Artificial Intelligence Risk Management Framework (AI RMF 1.0). NIST AI 100-1.
[18] American Psychiatric Association. (n.d.). The App Evaluation Model.
[19] von Elm, E., Altman, D. G., Egger, M., Pocock, S. J., Gotzsche, P. C., & Vandenbroucke, J. P. (2007). The Strengthening the Reporting of Observational Studies in Epidemiology (STROBE) statement: Guidelines for reporting observational studies. PLoS Medicine, 4(10), e296.
[20] STROBE Initiative. (n.d.). STROBE Statement: Checklist of items that should be included in reports of observational studies.
:::
`;
