# Pilot Dashboard Core Metrics Implementation Plan

## Goal

Extend the existing PulseCheck pilot dashboard from engine-health reporting into pilot outcome reporting, using pilot-scoped denominators and app-native event capture.

This plan is grounded in the current system:

- Pilot roster and enrollment truth already exists in `pulsecheck-pilot-enrollments` and `pulsecheck-team-memberships`.
- Daily readiness and routing already exist through `mental-check-ins`, `state-snapshots`, `pulsecheck-daily-assignments`, and `pulsecheck-assignment-events`.
- Mental performance baseline and sim data already exist through `athlete-mental-progress` and `sim-sessions`.
- Escalation records already exist through `escalation-records`.

## Recommended Approach

Use a three-layer model:

1. Raw operational truth
   - Keep using the canonical collections that already power PulseCheck.
   - Add only the missing raw records for pilot surveys and care-timing milestones.

2. Pilot metric events
   - Write append-only pilot-scoped events for key milestones that are expensive or ambiguous to reconstruct later.
   - Example: pilot enrollment activated, baseline completed, trust survey submitted, NPS submitted, clinician handoff initiated, clinician handoff completed.

3. Pilot metric rollups
   - Compute pilot-level daily and current summary documents for the dashboard.
   - The dashboard should mostly read rollups, not scan every raw collection on page load.

## Collections

### 1. New: `pulsecheck-pilot-metric-events`

Append-only event stream for pilot-scoped business metrics.

Suggested shape:

```ts
{
  id: string;
  pilotId: string;
  organizationId: string;
  teamId: string;
  cohortId?: string | null;
  athleteId?: string | null;
  actorUserId?: string | null;
  actorRole?: 'athlete' | 'coach' | 'clinician' | 'system' | 'admin';
  eventType:
    | 'pilot_enrollment_activated'
    | 'pilot_enrollment_withdrawn'
    | 'baseline_completed'
    | 'daily_checkin_completed'
    | 'daily_assignment_completed'
    | 'escalation_created'
    | 'coach_notified'
    | 'care_handoff_initiated'
    | 'care_handoff_completed'
    | 'nps_submitted'
    | 'trust_submitted';
  sourceCollection?: string | null;
  sourceDocumentId?: string | null;
  sourceDate?: string | null;
  metricPayload?: Record<string, unknown>;
  createdAt: Timestamp;
}
```

### 2. New: `pulsecheck-pilot-survey-responses`

Purpose-built survey storage for pilot NPS and trust instead of trying to infer those from chat text.

Suggested shape:

```ts
{
  id: string;
  pilotId: string;
  organizationId: string;
  teamId: string;
  cohortId?: string | null;
  respondentUserId: string;
  respondentRole: 'athlete' | 'coach' | 'clinician';
  surveyKind: 'nps' | 'trust';
  score: number; // 0-10
  comment?: string;
  source: 'ios' | 'android' | 'web-admin';
  submittedAt: Timestamp;
}
```

### 3. New: `pulsecheck-pilot-metric-rollups`

Dashboard-facing aggregate documents.

Recommended layout:

- `pulsecheck-pilot-metric-rollups/{pilotId}`
  - `summary.current`
  - `summary.last7d`
  - `summary.last30d`
  - `daily/{yyyy-mm-dd}`

`summary.current` should hold the latest pilot card values and trend deltas.

## Core Metric Definitions

### Enrollment

Use these states separately:

- Invited: athlete has invite link issued
- Consented: required product consents complete
- Activated: pilot enrollment status is `active`
- Baseline complete: `athleteOnboarding.baselinePathStatus === 'complete'`
- Withdrawn: pilot enrollment status is `withdrawn`

Locked reporting definition:

- Enrollment complete: the athlete has finished onboarding, accepted all required consents, and completed the initial baseline test.

Primary dashboard number:

- `enrollment complete / invited`

Secondary numbers:

- invited count
- consent completion rate
- activated rate
- baseline completion rate
- enrollment complete count
- withdrawal count

### Adherence

Do not use one vague adherence number. Use a defined primary plus supporting cuts.

Recommended primary adherence metric:

- `athlete-days with completed check-in and completed assigned task / expected athlete-days`

Locked reporting definition:

- An expected active athlete-day is a day where the athlete has an active pilot enrollment, is not withdrawn, and is not in a manual pause, escalation hold, or no-task rest day.
- A day counts as adherent only when both of these are true by the end of the athlete's local day:
  - the daily check-in is completed
  - the assigned protocol, sim, or mixed sequence for that day is completed

Locked denominator edge rules:

- The day boundary is athlete-local, not team-local.
- Athlete-local timezone should resolve in this order:
  - explicit athlete timezone on the membership or profile, if available
  - otherwise the most recent trustworthy app-reported timezone
  - otherwise the pilot team's default timezone
- If an athlete becomes active after the local-day rollover cutoff for that day, counting begins on the next athlete-local day.
- If an athlete is activated before the local-day rollover cutoff and receives a task for that day, that day can count as an expected athlete-day.
- If an athlete is reactivated after withdrawal or pause, denominator counting resumes on the next eligible athlete-local day unless a same-day assignment is explicitly reissued.
- If no assignment is issued for an otherwise active athlete-day because the athlete is intentionally on a no-task rest day, that day is excluded from the adherence denominator.
- If the athlete is on escalation hold, that day is excluded from adherence denominator calculations until normal programming resumes.

Supporting metrics:

- daily check-in rate
- daily assignment completion rate
- full-day adherence rate
- 7-day active athlete rate
- baseline completion within 7 days of activation

Source collections:

- `mental-check-ins`
- `pulsecheck-daily-assignments`
- `pulsecheck-assignment-events`

### Mental Performance Improvement Over Pilot Period

Recommended primary definition:

- average pillar composite delta from pilot baseline to current or endpoint

Locked reporting definition:

- Baseline = the athlete's first valid baseline profile inside the pilot
- Current = the athlete's latest valid profile inside the pilot window
- Athlete improvement = average delta across the three pillar scores:
  - focus
  - composure
  - decision
- Pilot improvement = average athlete improvement across athletes who have both a valid pilot baseline and a valid current profile

Locked profile snapshot contract:

- Do not infer pilot baseline and current values ad hoc at dashboard render time.
- Persist a pilot-scoped mental performance snapshot per athlete for these states:
  - baseline
  - current_latest_valid
  - endpoint, when the pilot or athlete reaches the configured endpoint milestone
- The pilot baseline snapshot should be the first valid baseline-profile capture linked to that pilot enrollment.
- The current snapshot should be the latest valid profile capture inside the pilot window that passes freshness and validity rules.
- The endpoint snapshot should be a frozen milestone snapshot, not just "latest available at the end."
- Rollups should read these persisted pilot-scoped snapshots rather than recomputing historical baseline/current joins on every dashboard load.

Recommended `pilotMentalPerformanceSnapshot` schema:

```ts
{
  id: string;
  pilotId: string;
  organizationId: string;
  teamId: string;
  cohortId?: string | null;
  athleteId: string;
  pilotEnrollmentId: string;
  snapshotKind: 'baseline' | 'current_latest_valid' | 'endpoint';
  sourceProfileSnapshotKey?: string | null;
  sourceProfileVersion?: string | null;
  pillarScores: {
    focus: number | null;
    composure: number | null;
    decision: number | null;
  };
  pillarComposite: number | null;
  strongestSkills?: string[];
  weakestSkills?: string[];
  validityStatus: 'valid' | 'degraded' | 'excluded';
  freshnessStatus: 'fresh' | 'stale';
  capturedAt: number;
  updatedAt: number;
}
```

Locked freshness rule for `current_latest_valid`:

- V1 default freshness window: the current snapshot must come from a valid profile capture within the last 14 days of the reporting date.
- If no valid profile capture exists within that 14-day window:
  - the athlete is excluded from current mental-performance delta rollups for that reporting frame
  - the most recent snapshot may still be retained for drill-down context, but must not be treated as current for the headline metric

Locked endpoint ownership rule:

- V1 default: endpoint is frozen by the pilot end date or the athlete's pilot completion event, whichever happens first.
- If the pilot workflow later adds a formal configured milestone trigger, that trigger may replace this default only when implemented explicitly in the pilot configuration layer.
- Manual admin freeze may exist as an override, but should not be the default endpoint mechanism.

Supporting cuts:

- focus delta
- composure delta
- decision delta
- percentage of athletes with positive delta
- percentage of athletes with 5+ point improvement

Current usable source data:

- baseline probe metrics in `athlete-mental-progress`
- raw sim session metrics in `sim-sessions`
- taxonomy/profile recompute path in `athleteProgressService.syncTaxonomyProfile`
- pillar score structure in the taxonomy profile and profile snapshot runtime

Implementation note:

- Do not use raw sim metrics directly as the dashboard headline metric.
- Do not use MPR alone as the pilot success metric.
- Do not use `taxonomyProfile.overallScore` as the headline pilot success metric because it mixes in modifier scores like readiness, which can move for day-state reasons rather than true training improvement.
- Use the skill and pillar layer as the primary pilot success signal.
- Create a derived `pilotMentalPerformanceSnapshot` per athlete for the pilot window so the dashboard reads a stable score instead of recomputing from raw sessions at render time.
- Even if mental performance delta is not part of the first headline dashboard card set, compute and store it in Phase 1 so Phase 2 does not require redesigning the rollup model.

### Number of Escalations

Track:

- total escalations
- tier 1 count
- tier 2 count
- tier 3 count
- open vs resolved vs declined
- escalations per 100 active athletes

Source collection:

- `escalation-records`

### Speed To Care

Recommended definitions:

- Tier 1 coach response speed: `coachNotifiedAt - createdAt`
- Tier 2 consent speed: `consentTimestamp - createdAt`
- Tier 2/3 handoff initiation speed: `handoffInitiatedAt - createdAt`
- Tier 2/3 care completion speed: `handoffCompletedAt - createdAt`

Locked primary SLA:

- Primary speed-to-care metric = median minutes from escalation creation to handoff initiated

Locked rationale:

- This is stronger than coach notification alone.
- It is more operationally controllable than completed clinician response.
- It best reflects whether the care system actually started moving.

Current gap:

- `escalation-records` does not yet persist full care timing milestones consistently enough for this metric.

Required additions on escalation records:

```ts
{
  coachNotifiedAt?: number;
  handoffInitiatedAt?: number;
  handoffAcceptedAt?: number;
  handoffCompletedAt?: number;
  firstClinicianResponseAt?: number;
  resolvedAt?: number;
}
```

Locked lifecycle distinction:

- `handoffInitiatedAt` = PulseCheck created and dispatched the handoff into the care path
- `handoffAcceptedAt` = receiving clinical system or clinician accepted the handoff
- `firstClinicianResponseAt` = first real clinician response or first confirmed clinician contact
- `handoffCompletedAt` = handoff workflow completed from the PulseCheck system perspective
- `resolvedAt` = escalation record fully closed

Primary dashboard number:

- median minutes to handoff initiated

Supporting numbers:

- median minutes from escalation creation to coach notified
- median minutes from escalation creation to consent accepted
- p75 minutes to handoff initiated
- median minutes to first clinician response
- median minutes to care completed
- percent meeting SLA by tier

Recommended operating targets:

- Tier 1 coach notify: under 15 minutes
- Tier 2 handoff initiated: under 15 minutes
- Tier 3 handoff initiated: under 5 minutes

### Athlete NPS / Coach NPS / Clinician NPS

Collect directly as structured responses.

Question:

- "How likely are you to recommend PulseCheck for this pilot?" `0-10`

Calculation:

- `% promoters (9-10) - % detractors (0-6)`

Store role-specific results separately. Do not blend them into one NPS.

### Athlete Trust / Coach Trust / Clinician Trust

Collect directly as structured responses.

Question:

- "How much do you trust PulseCheck's guidance in this pilot?" `0-10`

Optional secondary question:

- "Why did you choose that score?"

Trust should remain a separate metric from NPS. NPS is recommendation intent. Trust is confidence in guidance and system behavior.

Locked survey response rules:

- Athlete trust and athlete NPS allow multiple responses per pilot over time.
- Headline rollups should use the most recent valid response per respondent within the reporting window, while trend charts can use all time-windowed responses.
- Trust and NPS responses should remain pilot-scoped first and cohort-scoped second. Cohort slicing is a filter, not a separate survey system.
- Headline role-based NPS or trust should display only when the minimum response threshold is met. Recommended minimum threshold for headline display: 5 responses.
- UI rule for low response counts: show `Not enough responses yet` rather than hiding the metric entirely.

## Trust Measurement Model

Use a hybrid trust model:

- Keep one simple role-specific trust headline metric for dashboard reporting.
- Add a short trust battery underneath it for diagnostic interpretation.
- Use external trust frameworks as item-design ingredients, not as replacements for the PulseCheck pilot trust model.

### Headline trust KPI

Primary athlete trust question:

- "How much do you trust PulseCheck's guidance in this pilot?" `0-10`

Primary dashboard calculation:

- athlete trust headline = average of each athlete's most recent valid trust response in the reporting window

Supporting dashboard reads:

- median trust score
- response count
- response rate
- low-trust share (`0-6`)
- high-trust share (`9-10`)

Implementation rule:

- Behavioral signals like adherence, recommendation follow-through, or app opens should not replace the direct trust score.
- Those are trust-adjacent explanatory signals, not the trust metric itself.

### Trust battery

Add a short diagnostic trust battery for athletes.

Recommended default battery:

1. Credibility
   - "PulseCheck gives guidance that feels informed and believable."
2. Reliability
   - "PulseCheck is consistent in the quality and timing of its guidance."
3. Psychological safety / vulnerability
   - "I feel safe being honest with PulseCheck about how I am actually doing."
4. Low self-orientation / athlete interest
   - "PulseCheck feels like it is working in my best interest, not just pushing me through the system."
5. Practical usefulness
   - "The guidance feels actionable in real life."

Recommended answer format:

- `0-10` per item for consistency with the headline trust score

Recommended derived score:

- trust battery diagnostic average = mean of completed battery items

Battery use rules:

- The battery is diagnostic and interpretive.
- The single-item trust score remains the headline dashboard KPI.
- Battery item scores should be available in drill-down views, trend views, and comment analysis, not only in raw exports.

Locked battery completion rules:

- Partial completion is allowed.
- The diagnostic battery average should use completed items only.
- Dashboard battery averages should exclude fully empty batteries.
- Any battery item average shown in the dashboard should display only when the minimum response threshold is met.
- If a response has the single-item trust score but no battery items, it still counts toward the headline trust KPI and does not count toward battery averages.

### External frameworks to borrow from

Use these as design ingredients:

- Trust Equation
  - use as the primary structure for:
    - credibility
    - reliability
    - intimacy or honesty safety
    - self-orientation
- Psychological safety / vulnerability literature
  - use for the honesty / disclosure safety item
- NCAA or student-athlete survey language
  - use to make the wording athlete-native and credible
- Propensity to Trust (PTT)
  - optional onboarding covariate only
  - do not use as the dashboard trust KPI

Named provenance for trust-measurement ingredients:

- Trust Equation
  - Source frame: David Maister, Charles Green, and Robert Galford, *The Trusted Advisor*
  - Borrowed concepts:
    - credibility
    - reliability
    - intimacy
    - self-orientation
- Psychological safety / vulnerability
  - Source frame: Amy Edmondson's psychological safety research
  - Borrowed concept:
    - feeling safe being honest, admitting difficulty, and sharing real state without fear
- Propensity to Trust (PTT)
  - Source frame: Mayer, Davis, and Schoorman's organizational trust model
  - Borrowed concept:
    - baseline trust disposition belongs as a covariate, not as trust in PulseCheck itself
- Student-athlete wording and survey posture
  - Source frame: NCAA student-athlete well-being survey language and athlete-support framing
  - Borrowed use:
    - athlete-native wording, tone, and response framing

Implementation rule:

- The PulseCheck trust model should explicitly name these frameworks in internal spec and implementation notes as ingredient sources.
- The product should not claim to administer any one of these frameworks as a full validated instrument unless it actually does so without modification.

Do not:

- replace the PulseCheck trust model with a generic academic instrument wholesale
- treat team-climate psychological safety as identical to product trust
- treat general trust disposition as identical to trust in PulseCheck

### Optional baseline trait covariate

An optional one-time onboarding covariate may be collected:

- short propensity-to-trust screen at onboarding

Use rule:

- Use only for analysis and interpretation.
- Do not expose as a headline pilot metric.
- Do not combine directly into the headline athlete trust score.

### Trust monitoring views

Recommended athlete trust monitoring cuts:

- current athlete trust score
- week-over-week trust trend
- low-trust share
- trust by cohort
- trust by recommendation type
- trust by escalation exposure
- trust comment themes

Recommended alert posture:

- average trust below `7.5`
- more than `20%` of respondents scoring `0-6`
- trust dropping by more than `1.0` point week-over-week
- one cohort materially below another cohort

### Behavioral companion signals

Track these alongside trust, but never collapse them into the trust score itself:

- recommendation follow-through
- repeat engagement
- assignment completion
- check-in completion
- trust comment themes

Use case:

- these signals help explain why trust is rising or falling
- they should not be treated as the trust metric itself

## App Instrumentation

### iOS events we already have

Already usable:

- baseline completion in `BaselineAssessmentView`
- daily check-in submission through `CloudFunctionsService.submitPulseCheckCheckIn`
- daily assignment lifecycle through `recordPulseCheckAssignmentEvent`
- sim session capture through `MentalTrainingService.recordSimSession`

### iOS instrumentation to add

### 1. Emit pilot metric events when these actions happen

- pilot enrollment becomes active
- baseline completed
- daily check-in completed
- daily assignment completed
- NPS submitted
- trust submitted

Implementation recommendation:

- Add a small `PilotMetricsService` in iOS that writes through a new authenticated function, for example `/.netlify/functions/record-pilot-metric-event`.

### 2. Add in-app pilot survey prompts

Recommended prompts:

- athlete trust: after 3-5 completed sessions and again at pilot midpoint
- athlete NPS: midpoint and end of pilot
- coach trust and coach NPS: admin dashboard or staff web link
- clinician trust and clinician NPS: clinician handoff follow-up link or admin/staff workflow

Do not ask every role inside the athlete app. Athlete prompts belong in-app. Coach and clinician prompts can be web-admin first if that gets shipped faster.

### 3. Add survey throttling

Rules:

- never ask more than once per 14 days per survey kind
- suppress during active escalation state
- suppress before baseline is complete

Locked prompt contract:

- Minimum completed sessions before athlete trust or NPS appears: 3 completed assigned sessions after enrollment complete
- Suppress athlete survey prompts during active escalation state
- Suppress athlete survey prompts before enrollment complete
- Suppress repeat prompts for 14 days after the last response of the same survey kind
- If the product later adds low-score suppression logic, it should be explicit and consistent across pilots rather than ad hoc per pilot

Recommended trust prompt cadence:

- first trust prompt after 3 completed assigned sessions post-enrollment
- midpoint trust prompt
- endpoint trust prompt

Recommended trust collection payload:

```ts
{
  surveyKind: 'trust';
  score: number; // 0-10 single-item trust score
  battery?: {
    credibility?: number;
    reliability?: number;
    honestySafety?: number;
    athleteInterest?: number;
    practicalUsefulness?: number;
  };
  comment?: string;
}
```

## Dashboard Data Model Changes

Extend the pilot dashboard types with a new outcome block instead of mixing outcome metrics into the existing engine-health block.

Suggested addition:

```ts
interface PilotDashboardOutcomeMetrics {
  enrollmentRate: number;
  consentCompletionRate: number;
  baselineCompletionRate: number;
  adherenceRate: number;
  dailyCheckInRate: number;
  assignmentCompletionRate: number;
  mentalPerformanceDelta: number;
  escalationsTotal: number;
  escalationsTier1: number;
  escalationsTier2: number;
  escalationsTier3: number;
  medianMinutesToCare: number | null;
  athleteNps: number | null;
  coachNps: number | null;
  clinicianNps: number | null;
  athleteTrust: number | null;
  coachTrust: number | null;
  clinicianTrust: number | null;
}
```

Keep this separate from:

- `metrics` for operational counts
- `coverage` for engine coverage

That separation will make the dashboard easier to read and safer to evolve.

Recommended future extension:

```ts
interface PilotDashboardOutcomeSurveyDenominators {
  eligibleAthleteRespondents: number;
  eligibleCoachRespondents: number;
  eligibleClinicianRespondents: number;
  athleteResponseCount: number;
  coachResponseCount: number;
  clinicianResponseCount: number;
  minimumDisplayThresholdMet: boolean;
}
```

Recommended trust-specific extension:

```ts
interface PilotDashboardTrustDiagnostics {
  athleteTrustMedian: number | null;
  athleteTrustLowShare: number | null;
  athleteTrustHighShare: number | null;
  athleteTrustTrendDelta: number | null;
  athleteTrustBatteryAverages: {
    credibility: number | null;
    reliability: number | null;
    honestySafety: number | null;
    athleteInterest: number | null;
    practicalUsefulness: number | null;
  };
}
```

## Hypothesis Integration

Do not leave the new outcome metrics isolated from the existing pilot hypothesis system.

Several current hypotheses already depend on these outcome measures, especially:

- H3: recommendations based on body-state-specific patterns outperform generic recommendations
- H5: coaches find body-state-aware insights more actionable than profile-only summaries
- H6: athletes who follow body-state-specific protocol recommendations show better downstream performance

Recommended addition:

- Extend rollups so they can be queried by the hypothesis layer, not just rendered as dashboard cards.

Suggested comparative slices:

- adherence when a body-state-specific recommendation was issued vs when a generic recommendation was issued
- mental performance delta after recommended protocol followed vs skipped
- trust and NPS segmented by athlete subgroup, cohort, and recommendation type
- escalation rate segmented by recommendation type, adherence band, and cohort

Implementation note:

- Add comparison-friendly rollup fields rather than forcing hypothesis evaluation to rescan raw collections every time.
- This is what turns the pilot dashboard into a learning system instead of only an operational reporting surface.

## Rollup Job

Use a scheduled rollup function plus event-driven incremental updates.

Recommended pattern:

1. Event-driven updates
   - When a new check-in, assignment event, survey response, or escalation milestone lands, update the relevant pilot daily rollup.

2. Nightly repair job
   - Rebuild the last 30 days for active pilots to correct drift and late-arriving data.

This avoids slow admin reads while still protecting correctness.

Locked rollup behavior:

- Rollups must be idempotent.
- Replaying the same event must not duplicate counts.
- Late-arriving events must repair the correct athlete-day or pilot-day window instead of incrementing a second time.
- Nightly repair is the correction path for drift and late-arriving truth, not a separate truth model.
- The rollup document is a read model only. Canonical truth remains in the source collections and pilot metric event stream.

Suggested implementation pattern:

- Use deterministic rollup keys per pilot and per day.
- Store source event ids or deterministic aggregation fingerprints where needed to prevent duplicate application.
- Prefer overwrite or recompute semantics for daily rollups over blind increment semantics when correctness is at stake.

## Rollout Order

### Phase 1

- Add `pulsecheck-pilot-survey-responses`
- Add `pulsecheck-pilot-metric-events`
- Add missing escalation timing fields
- Build daily/current rollups
- Add dashboard cards for enrollment, adherence, escalations, speed to care

### Phase 2

- Add athlete trust and athlete NPS in the app
- Add web-admin survey collection for coach and clinician trust/NPS
- Add dashboard charts and trend views

### Phase 3

- Add mental performance delta rollup and cohort comparison views
- Add alerting for low adherence, rising escalations, and care SLA misses

## Important Product Decisions

Before implementation, lock these definitions:

1. Enrollment is already defined for reporting: the athlete has finished onboarding, accepted all required consents, and completed the initial baseline test.
2. Adherence is defined as the percentage of expected active athlete-days where both the daily check-in and the assigned action were completed.
3. Mental performance improvement is defined as average pillar composite delta from valid pilot baseline to valid current profile, with focus, composure, and decision deltas as supporting cuts.
4. The primary speed-to-care SLA is median minutes from escalation creation to handoff initiated.
5. Athlete-day denominator behavior is athlete-local and excludes pause, escalation-hold, and no-task rest days.
6. Pilot mental performance baseline and current values come from persisted pilot-scoped snapshots, not ad hoc live recompute joins.
7. Survey headline metrics require explicit role-based denominator rules and minimum response thresholds.
8. Rollups are idempotent read models and nightly repair is the correction path.

## Remaining Role-Based Denominator Rules

These should be treated as explicit implementation requirements, not informal assumptions.

### Coach respondents

- Eligible coach respondent = a coach or relevant team staff member who is assigned to, or operationally supports, the pilot within the reporting window.
- Recommended default roles to include:
  - `coach`
  - `team-admin`
  - `performance-staff`
  - `support-staff`
- Headline coach trust and coach NPS should display only when the minimum response threshold is met.

### Clinician respondents

- Eligible clinician respondent = a clinician associated with the pilot who actually participated in the pilot care pathway, ideally by receiving at least one relevant handoff or clinical interaction in the reporting window.
- Do not inflate clinician denominators with provisioned but never-engaged clinicians.
- Headline clinician trust and clinician NPS should display only when the minimum response threshold is met.

## Implementation Ownership Defaults

These are implementation defaults to prevent duplicate writers and ambiguous ownership during build-out.

### Event ownership map

Lock one canonical writer per pilot metric event type.

Recommended ownership:

- `baseline_completed`
  - canonical writer: the backend path that finalizes baseline completion or the one server-side write path immediately attached to baseline completion
  - client may trigger the action, but should not independently write a second canonical metric event
- `daily_checkin_completed`
  - canonical writer: `submit-pulsecheck-checkin`
- `daily_assignment_completed`
  - canonical writer: `record-pulsecheck-assignment-event` when assignment event type becomes `completed`
- `escalation_created`
  - canonical writer: escalation backend
- `coach_notified`
  - canonical writer: escalation backend
- `care_handoff_initiated`
  - canonical writer: escalation backend
- `care_handoff_completed`
  - canonical writer: escalation backend
- `nps_submitted`
  - canonical writer: survey submission endpoint
- `trust_submitted`
  - canonical writer: survey submission endpoint

Implementation rule:

- UI surfaces may initiate flows.
- Backend endpoints or functions should own canonical pilot metric event creation whenever possible.
- If a client emits an optimistic local event for UX reasons, it must not become a second source of truth.

### Snapshot generation ownership

Recommended ownership:

- `pilotMentalPerformanceSnapshot: baseline`
  - writer: backend path immediately associated with successful enrollment-complete baseline capture
- `pilotMentalPerformanceSnapshot: current_latest_valid`
  - writer: backend snapshot updater or rollup job
- `pilotMentalPerformanceSnapshot: endpoint`
  - writer: backend freeze path triggered by pilot end date or athlete completion event

Implementation rule:

- The dashboard must never generate or persist pilot mental-performance snapshots on read.
- Snapshot generation belongs to backend jobs, functions, or explicit server-side lifecycle hooks.

### Low-response UI behavior

Carry the same minimum-sample rule across all role-based trust and NPS cards.

Recommended display rule:

- If role-based response count is below the minimum threshold:
  - keep the card visible
  - show `Not enough responses yet`
  - suppress the headline numeric KPI for that card

Apply this consistently to:

- athlete trust
- athlete NPS
- coach trust
- coach NPS
- clinician trust
- clinician NPS

## Recommendation

Ship the first dashboard version with:

- enrollment
- adherence
- escalations
- speed to care
- athlete trust
- athlete NPS

Then add coach and clinician survey metrics as soon as the web-admin collection flow is in place.

That gets the pilot dashboard outcome-aware quickly without blocking on every stakeholder workflow at once.
