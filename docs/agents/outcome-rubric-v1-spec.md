# Outcome Rubric v1 Spec

Status: Frozen v1.0  
Date: April 2026  
Frozen On: April 4, 2026  
Owners: Mission Control, Nora Runtime, Web, PulseCommand

Defines the canonical outcome model for the autonomous mission system so agents optimize for meaningful business movement rather than internal activity.

This version is frozen for implementation. Any semantic change after this point requires a new versioned spec update and change log entry.

## 1. Purpose

This spec defines:

- what counts as a meaningful outcome
- how outcomes are classified, scored, and verified
- how outcomes map to tasks, deliverables, and mission progress
- how planner and runner logic should prioritize outcomes over activity
- how long-loop commercial outcomes are tracked after artifact completion

This spec exists because the current runtime can verify that work happened, but it still needs a stricter model for verifying that the work moved the business.

## 2. Core Principles

- An outcome is not effort. It is a verified state change outside the agent's narration.
- An artifact is not automatically an outcome. Code shipped and business value moved are related but distinct.
- Terminal outcomes, enabling outcomes, and learning outcomes must not be scored as if they are equivalent.
- Every execute task must point to an explicit outcome target.
- No execute task can count without a proof packet, guardrails, and an observation window.
- Outcome scoring must include downside, not just upside.
- Negative learning can be a valid win if it cheaply prevents wasted spend, bad pipeline, or low-quality revenue.

## 3. Non-Goals

This spec does not:

- replace the existing task contract in `agent-tasks`
- define every external system integration in full
- decide mission strategy by itself
- eliminate human review for high-risk external actions

## 4. Terms

### 4.1 Artifact

A concrete thing produced by execution, such as a file change, API behavior, Firestore change, campaign launch, calendar invite, or CRM update.

### 4.2 Deliverable

A recorded artifact in `agent-deliverables` that has passed artifact-level verification.

### 4.3 Outcome

A business-relevant state change linked to one or more deliverables and verified against a source of truth.

### 4.4 Proof Packet

The minimum structured evidence required for an execute task or outcome claim. It specifies the source of truth, success event, qualifier, observation window, expiry rule, owner, guardrails, and expected business effect.

### 4.5 Observation Window

The period during which the system waits to confirm, reject, or reverse an outcome.

### 4.6 Guardrail

A hard business, legal, brand, margin, or operational constraint. If a guardrail fails, the outcome cannot receive full credit.

### 4.7 Attribution

The degree to which an agent caused or supported the outcome.

### 4.8 Outcome Policy Pack

An explicit set of machine-readable mission, domain, benchmark, and scoring rules that replace ambiguous terms like `ICP-fit`, `acceptable margin`, or `approved benchmark`.

### 4.9 Outcome Graph

A parent-child and dependency structure that links enabling, learning, invalidation, and constraint outcomes to the terminal outcomes they support, block, or de-risk.

### 4.10 Canonical Vocabulary

The runtime must use one vocabulary everywhere.

- use `terminal`, not generic "business result"
- use `enabling`, not "operational leverage outcome"
- use `learning`, not "decision outcome"
- use `invalidation`, not "negative learning win"
- use `constraint`, not generic "quality outcome"
- use `pipeline`, not "sales outcome"
- use `system-operations`, not "ops improvement"

Deprecated labels may appear in historical docs, but planner, runner, Firestore, UI, and review logic must use the canonical labels above.

## 5. Outcome Classes

Every outcome must belong to exactly one class.

### 5.1 Terminal Outcome

External value moved.

Examples:

- qualified meeting with a Head of Partnerships is accepted on the calendar
- proposal reaches a decision-maker and a next meeting is booked
- payment or contract activates
- at-risk customer renews
- launched campaign clears its benchmark window

### 5.2 Enabling Outcome

A live capability now exists and is capable of producing terminal outcomes.

Examples:

- campaign is launched with tracking, stop-loss, and spend caps
- CRM follow-up automation is live
- partner referral flow is live
- onboarding fix ships and is measurable

### 5.3 Learning Outcome

Uncertainty was reduced enough to change the next action.

Examples:

- ICP selected after a defined test
- channel selected after a benchmark comparison
- pricing hypothesis validated enough to unlock outbound or paid launch

### 5.4 Invalidation Outcome

A bad path was disproved cheaply and intentionally stopped.

Examples:

- low-quality channel killed after failing the benchmark window
- bad ICP ruled out
- weak offer rejected before further spend

### 5.5 Constraint Outcome

Reliability, trust, compliance, or service quality materially improved.

Examples:

- hallucination rate drops below threshold
- human escalation rate drops
- SLA compliance improves
- safety or policy breach rate declines

Constraint outcomes count as primary outcomes only when the mission is explicitly operational-quality focused. Otherwise they are required gates on other outcomes.

## 6. Outcome Domains

Every outcome must belong to exactly one primary domain.

- `revenue`
- `pipeline`
- `partnerships`
- `distribution`
- `activation`
- `retention`
- `credibility`
- `system-operations`
- `data`
- `service-quality`

## 7. Outcome Lifecycle

Artifact verification and outcome confirmation are separate.

### 7.1 Deliverable Lifecycle

- `work`
- `verified-auto`
- `verified-human`
- `needs-review`
- `rejected`

### 7.2 Outcome Lifecycle

- `planned`: outcome record created but no work has landed
- `executing`: linked task is running
- `artifact-verified`: required enabling artifact exists
- `observing`: waiting through the observation window
- `confirmed`: outcome passed all gates and survived the observation window
- `canceled`: outcome was intentionally stopped before conclusion
- `superseded`: outcome was replaced by a newer outcome or strategy path
- `failed`: outcome missed the success event or violated a hard gate
- `reversed`: outcome was initially valid but no longer counts
- `expired`: window elapsed without enough evidence
- `waived`: operator explicitly accepted an exception

### 7.3 Key Rule

Artifact verification can advance mission execution. Outcome confirmation advances business scorekeeping.

This avoids forcing every mission to wait weeks for long-loop revenue outcomes while still preventing the system from claiming that a launched asset is the same thing as a commercial result.

## 8. Required Proof Packet

Every execute task and every outcome record must include a proof packet that is machine-evaluable. Free text is allowed only in `notes`, `summary`, and human review comments. Pass/fail logic must use typed fields, query refs, predicates, and policy refs.

### 8.1 Structured Proof Types

```ts
type OutcomeSourceOfTruth =
  | 'calendar'
  | 'crm'
  | 'billing'
  | 'analytics'
  | 'ad-platform'
  | 'firestore'
  | 'support-system'
  | 'email-platform'
  | 'repo'
  | 'other';

type OutcomeObservationWindow =
  | 'immediate'
  | '72h'
  | '14d'
  | '30d'
  | 'renewal-cycle'
  | 'custom';

type OutcomeComparator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'in'
  | 'not-in'
  | 'exists'
  | 'not-exists'
  | 'matches'
  | 'changed-by'
  | 'stays-true-for-window';

type OutcomeAggregation =
  | 'latest'
  | 'count'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'ratio'
  | 'distinct-count';

type OutcomeObservedValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | Record<string, unknown>;

interface OutcomePolicyRefs {
  missionPolicyId: string;
  domainPolicyId: string;
  scoreCalibrationPackId: string;
  benchmarkPolicyIds: string[];
  riskPolicyId: string;
  qualityPolicyId: string;
  icpPolicyId?: string;
  revenuePolicyId?: string;
  servicePolicyId?: string;
}

interface VersionedPolicyResource {
  id: string;
  version: string;
}

interface OutcomeIdentityContract {
  externalEventKeyTemplate: string;
  dedupeKeyTemplate: string;
  canonicalAccountIdTemplate?: string;
  canonicalContactIdTemplate?: string;
  canonicalObjectIdTemplates?: string[];
  allowSupersession: boolean;
}

interface OutcomeSourceQuery {
  id: string;
  sourceOfTruth: OutcomeSourceOfTruth;
  locationType: 'doc' | 'collection' | 'event-stream' | 'api-endpoint' | 'report';
  collection?: string;
  path?: string;
  endpoint?: string;
  objectType?: string;
  objectIdTemplate?: string;
  filters?: OutcomeFilter[];
  aggregationWindow?: OutcomeObservationWindow;
  notes?: string;
}

interface OutcomeFilter {
  field: string;
  comparator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in' | 'not-in' | 'matches';
  value: string | number | boolean | string[];
}

interface OutcomeMetricRef {
  id: string;
  sourceQueryId: string;
  fieldPath: string;
  aggregation: OutcomeAggregation;
  unit?: 'count' | 'usd' | 'pct' | 'days' | 'boolean' | 'string';
  lookbackWindow?: OutcomeObservationWindow;
  lookbackWindowDays?: number;
}

interface OutcomePredicate {
  id: string;
  label: string;
  metricRefId: string;
  comparator: OutcomeComparator;
  expectedValue: string | number | boolean | string[];
  minSampleSize?: number;
  confidenceFloor?: number;
  benchmarkId?: string;
  requiredForPass: boolean;
}

interface OutcomeEvidenceRequirement {
  id: string;
  sourceQueryId: string;
  minimumRecords?: number;
  snapshotRequired: boolean;
  freshnessWindowHours?: number;
}

interface OutcomeCompileCheck {
  id: string;
  kind: 'resolve-query' | 'resolve-policy' | 'resolve-benchmark' | 'resolve-metric' | 'schema-sample' | 'timezone-check' | 'stale-data-check' | 'api-health-check';
  required: boolean;
}

interface OutcomeCompileResult {
  status: 'pending' | 'compiled' | 'dry-run-passed' | 'dry-run-failed';
  compiledAt?: string;
  dryRunAt?: string;
  compiledProofPacketHash?: string;
  errors?: string[];
}

interface OutcomeGuardrail {
  id: string;
  label: string;
  type: 'spend' | 'brand' | 'compliance' | 'margin' | 'deliverability' | 'quality' | 'safety' | 'custom';
  metricRefId?: string;
  comparator?: OutcomeComparator;
  failureValue?: string | number | boolean | string[];
  failureBenchmarkId?: string;
  stopLossAction: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface OutcomeProofPacket {
  policyRefs: OutcomePolicyRefs;
  identity: OutcomeIdentityContract;
  sourceQueries: OutcomeSourceQuery[];
  metricRefs: OutcomeMetricRef[];
  qualificationCriteria: OutcomePredicate[];
  successCriteria: OutcomePredicate[];
  failureCriteria?: OutcomePredicate[];
  expiryCriteria: OutcomePredicate[];
  businessEffectCriteria: OutcomePredicate[];
  observationWindow: OutcomeObservationWindow;
  observationWindowDays?: number;
  evaluationCadence: 'instant' | 'hourly' | 'daily' | 'manual';
  ownerReviewer: string;
  attributionExpected: 'directly-caused' | 'materially-assisted' | 'influenced' | 'prepared';
  primaryMetricRefId: string;
  secondaryMetricRefIds?: string[];
  evidenceRequirements: OutcomeEvidenceRequirement[];
  compileChecks: OutcomeCompileCheck[];
  compileResult?: OutcomeCompileResult;
  guardrails: OutcomeGuardrail[];
  notes?: string;
}
```

Canonical proof rule:

- `proofPacket.policyRefs` is canonical
- top-level `policyRefs` on tasks and outcomes is a denormalized query cache and must exactly match `proofPacket.policyRefs`

### 8.2 Structured Example

```ts
const partnershipMeetingProof: OutcomeProofPacket = {
  policyRefs: {
    missionPolicyId: 'mission-policy-growth-v1',
    domainPolicyId: 'domain-policy-partnerships-v1',
    scoreCalibrationPackId: 'score-pack-partnerships-terminal-v1',
    benchmarkPolicyIds: ['benchmarks-partnerships-v1'],
    riskPolicyId: 'risk-policy-commercial-v1',
    qualityPolicyId: 'quality-policy-partnerships-v1',
    icpPolicyId: 'icp-policy-head-of-partnerships-v1',
  },
  sourceQueries: [
    {
      id: 'calendar-event',
      sourceOfTruth: 'calendar',
      locationType: 'report',
      objectType: 'calendar-event',
      filters: [
        { field: 'organizerEmail', comparator: 'eq', value: 'tre@fitwithpulse.ai' },
      ],
    },
  ],
  metricRefs: [
    {
      id: 'event-status',
      sourceQueryId: 'calendar-event',
      fieldPath: 'attendeeStatus',
      aggregation: 'latest',
      unit: 'string',
    },
    {
      id: 'partner-role',
      sourceQueryId: 'calendar-event',
      fieldPath: 'partnerRole',
      aggregation: 'latest',
      unit: 'string',
    },
  ],
  qualificationCriteria: [
    {
      id: 'qualified-role',
      label: 'Partner stakeholder must match approved ICP role',
      metricRefId: 'partner-role',
      comparator: 'in',
      expectedValue: ['Head of Partnerships', 'VP Partnerships', 'Founder', 'GM'],
      requiredForPass: true,
    },
  ],
  successCriteria: [
    {
      id: 'accepted-event',
      label: 'Meeting accepted',
      metricRefId: 'event-status',
      comparator: 'eq',
      expectedValue: 'accepted',
      requiredForPass: true,
    },
  ],
  expiryCriteria: [
    {
      id: 'meeting-canceled',
      label: 'Canceled meetings stop counting',
      metricRefId: 'event-status',
      comparator: 'eq',
      expectedValue: 'canceled',
      requiredForPass: true,
    },
  ],
  businessEffectCriteria: [],
  observationWindow: 'immediate',
  evaluationCadence: 'instant',
  ownerReviewer: 'nora',
  attributionExpected: 'directly-caused',
  primaryMetricRefId: 'event-status',
  evidenceRequirements: [
    { id: 'calendar-snapshot', sourceQueryId: 'calendar-event', minimumRecords: 1, snapshotRequired: true },
  ],
  guardrails: [],
};
```

### 8.3 Mission and Domain Policy Objects

Ambiguous qualifiers must resolve through policy objects, not human interpretation.

```ts
interface MissionOutcomePolicy {
  id: string;
  version: string;
  plannerMinimumCreditedScore: number;
  plannerMinimumNetScore: number;
  executeGateMode: 'credited-and-net' | 'credited-only' | 'net-only';
  maxLearningInvalidationWipPct: number;
  allowWaivedCredit: boolean;
  maxWaivedCreditPct: number;
  allowNegativeNetScore: boolean;
  clampCreditedScoreAtZero: boolean;
  hardFailureNetHandling: 'zero' | 'force-debt';
  hardFailureDebtFloor: number;
  domainPolicyIds: Record<string, string>;
  benchmarkPolicyIds: Record<string, string>;
  scoreCalibrationPackIds: Record<string, string>;
  riskPolicyId: string;
  qualityPolicyId: string;
}

interface DomainOutcomePolicy {
  id: string;
  version: string;
  domain: string;
  requiredQualifiers: string[];
  minimumSampleSizes: Record<string, number>;
  approvedBenchmarks: string[];
  qualityThresholds: Record<string, number | string | boolean>;
  blockedPatterns: string[];
}

interface BenchmarkPolicy extends VersionedPolicyResource {}
interface RiskPolicy extends VersionedPolicyResource {}
interface QualityPolicy extends VersionedPolicyResource {}
```

Examples:

- `ICP-fit` must resolve to `icpPolicyId`
- `acceptable margin` must resolve to `revenuePolicyId`
- `approved range` must resolve to a benchmark or risk policy
- `high churn risk` must resolve to a policy threshold

### 8.4 Execute Gate

If any required policy ref, source query, metric ref, predicate, or evidence requirement is missing, the task must move to `needs-spec` and cannot enter the execute queue.

### 8.5 Proof Compile and Dry-Run

Before execute admission, every proof packet must:

1. resolve all policy refs and benchmark ids
2. bind any query or identity templates
3. resolve all metric refs against a live or sampled schema
4. validate timezone and observation-window semantics
5. verify freshness and availability of the source queries
6. produce a `compileResult.status = 'dry-run-passed'`

Proof packets that are structurally valid but fail dry-run must not enter execute.

Compile invalidation rule:

- any change to `proofPacket`
- any resolved policy version change
- any identity template change
- any metric or predicate change

must invalidate `compileResult`, clear `proofCompileStatus`, and require a new dry-run before execute.

## 9. Quality Gates

Every outcome class and domain must define quality thresholds beyond completion.

### 9.1 Pipeline

A meeting only counts if:

- the invite is accepted
- the contact is ICP-fit
- there is a confirmed decision-maker or qualified champion
- the meeting has a defined agenda and business ask
- the booking did not violate outreach guardrails

### 9.2 Revenue

Revenue only counts if:

- billing or contract is active
- customer quality meets the fit threshold
- gross margin clears the minimum floor
- expected payback is within the approved range
- the customer is not flagged as high churn risk or bad-fit revenue

### 9.3 Partnerships

A partner outcome only counts if:

- both sides have named owners
- the next step is in writing
- a dated milestone exists
- the outcome increases distribution, revenue, or strategic leverage

### 9.4 Distribution

A campaign or channel outcome only counts if:

- tracking is live
- spend caps exist
- stop-loss rules exist
- benchmark thresholds are defined before launch
- the launch survives the minimum signal window

### 9.5 Activation

Activation only counts if:

- the target user reaches the defined "aha" event
- the event is instrumented in analytics
- the user fits the target cohort

### 9.6 Retention

Retention only counts if:

- the renewal, save, or reactivation appears in the system of record
- the account remains valid through the required window
- the save did not require an unacceptable discount or concession

### 9.7 Credibility

Proof assets only count if:

- rights are secured
- the asset is reusable in real sales or marketing flows
- the claim is specific enough to improve conversion or trust

### 9.8 Data

Data outcomes only count if:

- the schema, pipeline, or record change is written to the source of truth
- completeness, freshness, and accuracy thresholds from policy are met
- sample or backfill validation passes
- at least one downstream consumer or decision flow reflects the intended change

### 9.9 System Operations

System-operations outcomes only count if:

- the config or service change is live in the system of record
- telemetry shows the intended health, latency, or failure-rate effect
- rollback or recovery path exists
- blast radius stays within the approved policy range

### 9.10 Service Quality

Operational-quality outcomes only count if:

- the metric is instrumented
- the improvement survives the observation window
- no safety or compliance guardrail is breached while improving the metric

### 9.11 Learning and Invalidation

Learning and invalidation only count if:

- the hypothesis was stated before the test
- the threshold was explicit
- the test was intentionally cheap
- the result changed the next action

## 10. Scoring Model

The score is used for prioritization, audit, and mission reporting.

### 10.1 Score Dimensions

Each dimension is scored independently.

- `impact`: `0-25`
- `evidenceStrength`: `0-20`
- `causalConfidence`: `0-15`
- `timeToSignal`: `0-10`
- `strategicLeverage`: `0-10`
- `valueQuality`: `0-10`
- `riskPenalty`: `0 to -25`

### 10.2 Dimension Guidance

#### Impact

- `20-25`: direct high-value commercial or retention movement
- `12-19`: strong enabling change tied to an active commercial objective
- `6-11`: useful but secondary leverage
- `0-5`: weak or mostly internal movement

#### Evidence Strength

- `18-20`: durable source of truth plus qualifier plus review-ready evidence
- `12-17`: primary source present but incomplete or single-threaded
- `6-11`: shallow evidence
- `0-5`: mostly narration or screenshots without durable proof

#### Causal Confidence

- `12-15`: direct and defensible link to the outcome
- `8-11`: materially contributes but not sole driver
- `4-7`: weak or indirect causal link
- `0-3`: mostly preparatory

#### Time To Signal

- `10`: immediate
- `8`: 72 hours
- `5`: 14 days
- `3`: 30 days
- `1`: longer than 30 days or unclear

#### Strategic Leverage

- `8-10`: reusable system, channel, or playbook unlock
- `4-7`: moderate reuse
- `0-3`: one-off

#### Value Quality

- `8-10`: high-quality fit, strong margin, low downside, high expansion/retention potential
- `4-7`: acceptable but not premium quality
- `0-3`: low-quality value that should not be amplified

#### Risk Penalty

- `0`: no meaningful downside risk
- `-5 to -10`: manageable downside or weak guardrail posture
- `-11 to -20`: serious reputation, margin, compliance, or quality concern
- `-25`: hard failure or unacceptable downside

### 10.3 Class Multipliers

- `terminal`: `1.0`
- `enabling`: `0.75`
- `learning`: `0.6`
- `invalidation`: `0.6`
- `constraint`: `1.0` if mission-critical, otherwise `0.5`

### 10.4 Class-Specific Interpretation

The same dimension may mean different things by outcome class.

- `valueQuality` for `terminal` and `enabling`: fit, margin, retention quality, expansion potential
- `valueQuality` for `learning` and `invalidation`: cheapness of the test, clarity of the decision, downside avoided, speed of reallocation
- `valueQuality` for `constraint`: durability of trust, compliance, reliability, and risk reduction
- `impact` for `constraint`: business risk removed, not revenue generated

### 10.5 Score Calibration Packs

Scores must be assigned through per-domain, per-class calibration packs rather than freehand judgment.

```ts
interface OutcomeScoreCalibrationPack {
  id: string;
  version: string;
  outcomeClass: 'terminal' | 'enabling' | 'learning' | 'invalidation' | 'constraint';
  outcomeDomain: string;
  dimensionAnchors: Record<string, ScoreAnchor[]>;
  exampleOutcomes: ScoreExample[];
}

interface ScoreAnchor {
  bandMin: number;
  bandMax: number;
  definition: string;
  examples: string[];
}

interface ScoreExample {
  title: string;
  dimensionScores: Record<string, number>;
  rationale: string;
}
```

The planner and reviewers must resolve `impact`, `evidenceStrength`, `causalConfidence`, `timeToSignal`, `strategicLeverage`, and `valueQuality` through the referenced calibration pack.

### 10.6 Attribution Multipliers

- `directly-caused`: `1.0`
- `materially-assisted`: `0.7`
- `influenced`: `0.4`
- `prepared`: `0.2`

### 10.7 Final Formula

```ts
rawScore =
  impact +
  evidenceStrength +
  causalConfidence +
  timeToSignal +
  strategicLeverage +
  valueQuality +
  riskPenalty;

finalOutcomeScore =
  rawScore *
  classMultiplier *
  attributionMultiplier;
```

## 11. Governance and Score Semantics

### 11.1 Hard Failure Gates

An outcome receives `0` credited score and must not count as confirmed business movement if any of the following are true:

- no independent source of truth
- no qualifier
- no observation window
- `evidenceStrength < 12`
- `valueQuality < 6`
- hard guardrail failure
- evidence later reverses within the observation window

### 11.2 Negative Score Handling

Negative scores are allowed in the net mission model.

```ts
if (hardFailure) {
  prePolicyNetOutcomeScore = missionPolicy.hardFailureNetHandling === 'force-debt'
    ? Math.min(finalOutcomeScore, -Math.max(missionPolicy.hardFailureDebtFloor, 1))
    : Math.min(finalOutcomeScore, 0);
} else {
  prePolicyNetOutcomeScore = finalOutcomeScore;
}

netOutcomeScore = missionPolicy.allowNegativeNetScore
  ? prePolicyNetOutcomeScore
  : Math.max(prePolicyNetOutcomeScore, 0);

creditedOutcomeScore = missionPolicy.clampCreditedScoreAtZero
  ? Math.max(netOutcomeScore, 0)
  : netOutcomeScore;

businessDebtScore = missionPolicy.allowNegativeNetScore
  ? Math.abs(Math.min(netOutcomeScore, 0))
  : 0;
```

Rules:

- default "wins" reporting uses `creditedOutcomeScore`
- mission economics use `netOutcomeScore`
- downside is surfaced as `businessDebtScore`
- hard failures must force `netOutcomeScore <= 0`
- `businessDebtScore` is always computed from the post-gate `netOutcomeScore`
- `allowNegativeNetScore = false` clamps negative net score to zero and disables debt posting for that mission
- `clampCreditedScoreAtZero = true` is the recommended default for operator-facing win totals

### 11.3 Waiver Semantics

Waived outcomes must live in an exception bucket by default.

```ts
interface OutcomeWaiver {
  waivedBy: string;
  waivedAt: Timestamp;
  reason: string;
  creditGranted: boolean;
  creditCapPct?: number;
}
```

```ts
waiverCreditPct =
  Math.min(
    outcomeWaiver.creditCapPct ?? 100,
    missionPolicy.maxWaivedCreditPct
  );

waivedCreditedOutcomeScore =
  outcomeWaiver.creditGranted
    ? creditedOutcomeScore * (waiverCreditPct / 100)
    : 0;

waivedNetOutcomeScore = netOutcomeScore;
waivedBusinessDebtScore = businessDebtScore;
```

Rules:

- `waived` outcomes do not count toward `confirmedOutcomeCount` by default
- `waived` outcomes do not contribute to normal credited score totals unless `creditGranted = true`
- credited waivers must be reported in a separate exception bucket
- mission policy controls whether waived credit is allowed at all
- waivers can partially restore credited score, but do not improve `netOutcomeScore`
- `creditCapPct` is capped by `maxWaivedCreditPct`

## 12. Firestore Data Model

### 12.1 `agent-tasks`

Add these fields:

```ts
interface AgentTaskOutcomeFields {
  outcomeId: string;
  parentOutcomeId?: string;
  supersedesOutcomeId?: string;
  outcomeClass: 'terminal' | 'enabling' | 'learning' | 'invalidation' | 'constraint';
  outcomeDomain: 'revenue' | 'pipeline' | 'partnerships' | 'distribution' | 'activation' | 'retention' | 'credibility' | 'system-operations' | 'data' | 'service-quality';
  outcomeRole: 'primary' | 'supporting';
  proofPacket: OutcomeProofPacket;
  policyRefs: OutcomePolicyRefs;
  expectedAttribution: 'directly-caused' | 'materially-assisted' | 'influenced' | 'prepared';
  expectedOutcomeScore: number;
  expectedImpactScore: number;
  expectedCreditedScore: number;
  expectedNetScore: number;
  proofCompileStatus: 'pending' | 'compiled' | 'dry-run-passed' | 'dry-run-failed';
  proofCompileErrors?: string[];
  expectedSignalWindow: 'immediate' | '72h' | '14d' | '30d' | 'renewal-cycle' | 'custom';
  outcomeStatus: 'planned' | 'executing' | 'artifact-verified' | 'observing' | 'confirmed' | 'canceled' | 'superseded' | 'failed' | 'reversed' | 'expired' | 'waived';
}
```

Rules:

- every execute task must have `outcomeId`
- execute tasks without a complete proof packet go to `needs-spec`
- at most one primary terminal outcome should be active per agent unless explicitly waived
- non-terminal execute tasks should reference `parentOutcomeId` unless mission policy explicitly allows a root-level exception

### 12.2 `agent-deliverables`

Add these fields:

```ts
interface DeliverableOutcomeFields {
  outcomeId: string;
  parentOutcomeId?: string;
  artifactVerifiedAt?: Timestamp;
  outcomeStatus?: string;
  outcomeObservationStartedAt?: Timestamp;
  outcomeConfirmedAt?: Timestamp;
  creditedOutcomeScore?: number;
  netOutcomeScore?: number;
}
```

Rules:

- a deliverable may be artifact-verified before the outcome is confirmed
- deliverables must link back to the owning outcome when they are execute work

### 12.3 `agent-outcomes`

Create a new top-level collection as the canonical business-outcome ledger.

```ts
interface AgentOutcome {
  id: string;
  missionId: string;
  objectiveId: string;
  title: string;
  summary: string;
  outcomeClass: 'terminal' | 'enabling' | 'learning' | 'invalidation' | 'constraint';
  outcomeDomain: 'revenue' | 'pipeline' | 'partnerships' | 'distribution' | 'activation' | 'retention' | 'credibility' | 'system-operations' | 'data' | 'service-quality';
  status: 'planned' | 'executing' | 'artifact-verified' | 'observing' | 'confirmed' | 'canceled' | 'superseded' | 'failed' | 'reversed' | 'expired' | 'waived';
  proofPacket: OutcomeProofPacket;
  policyRefs: OutcomePolicyRefs;
  resolvedPolicySnapshot: ResolvedOutcomePolicySnapshot;
  scoredWithVersion: string;
  rescoreRunId?: string;
  proofCompileStatus: 'pending' | 'compiled' | 'dry-run-passed' | 'dry-run-failed';
  proofCompileErrors?: string[];
  parentOutcomeId?: string;
  childOutcomeIds: string[];
  blockedByOutcomeIds: string[];
  dependencyEdges: OutcomeDependencyEdge[];
  rollupMode: 'all-required-children' | 'any-child' | 'weighted';
  rollupThresholdPct?: number;
  allowRollupOnlyConfirmation?: boolean;
  externalEventKey?: string;
  dedupeKey?: string;
  canonicalAccountId?: string;
  canonicalContactId?: string;
  canonicalObjectIds?: string[];
  supersedesOutcomeId?: string;
  attributionActual?: 'directly-caused' | 'materially-assisted' | 'influenced' | 'prepared';
  contributorLedger: OutcomeContributor[];
  score: {
    impact: number;
    evidenceStrength: number;
    causalConfidence: number;
    timeToSignal: number;
    strategicLeverage: number;
    valueQuality: number;
    riskPenalty: number;
    rawScore: number;
    classMultiplier: number;
    attributionMultiplier: number;
    finalOutcomeScore: number;
    creditedOutcomeScore: number;
    netOutcomeScore: number;
    businessDebtScore: number;
  };
  primaryTaskIds: string[];
  supportingTaskIds: string[];
  deliverableIds: string[];
  sourceEvidence: OutcomeEvidence[];
  guardrailStatus: 'clear' | 'warning' | 'failed';
  waiver?: OutcomeWaiver;
  confirmedAt?: Timestamp;
  reversedAt?: Timestamp;
  expiresAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface OutcomeDependencyEdge {
  fromOutcomeId: string;
  toOutcomeId: string;
  dependencyType: 'enables' | 'blocks' | 'de-risks' | 'invalidates' | 'measures';
  required: boolean;
}

interface OutcomeContributor {
  contributorId: string;
  contributorType: 'agent' | 'human' | 'system' | 'external';
  role: 'planner' | 'executor' | 'reviewer' | 'closer' | 'approver' | 'observer';
  attribution: 'directly-caused' | 'materially-assisted' | 'influenced' | 'prepared';
  shareWeight: number;
  evidenceRefs: string[];
}

interface ResolvedOutcomePolicySnapshot {
  missionPolicyVersion: string;
  domainPolicyVersion: string;
  scoreCalibrationPackVersion: string;
  benchmarkPolicyVersions: Record<string, string>;
  riskPolicyVersion: string;
  qualityPolicyVersion: string;
  frozenAt: Timestamp;
}

interface OutcomeEvidence {
  id: string;
  sourceType: string;
  sourceRef: string;
  observedValue: OutcomeObservedValue;
  observedAt: Timestamp;
  qualifies: boolean;
  notes?: string;
}
```

Rules:

- `terminal` outcomes may be graph roots
- `enabling`, `learning`, `invalidation`, and `constraint` outcomes should attach to a parent unless mission policy allows a root
- graph must be a DAG; cycles are invalid
- `weighted` rollups must normalize required child weights to `1.0`
- reversal of a required child auto-reverses the parent unless a waiver exists
- parent outcomes may only confirm from rolled-up child evidence when `allowRollupOnlyConfirmation = true`
- `shareWeight` values in `contributorLedger` must sum to `1.0`; unattributed value must be assigned to an `external` contributor entry
- all terminal and externally observed outcomes must resolve `externalEventKey`, `dedupeKey`, and canonical entity ids before confirmation
- `supersedesOutcomeId` must be used instead of duplicating a confirmed commercial event under a new outcome id
- the same commercial event must not be represented by multiple full-credit outcomes
- parent rollups must use the declared `rollupMode`

Canonical graph rule:

- `dependencyEdges` is canonical
- `parentOutcomeId`, `childOutcomeIds`, and `blockedByOutcomeIds` are derived read-optimized caches and must be regenerated from `dependencyEdges` on write

Snapshot semantics:

- tasks may carry policy refs for planning and preview
- outcomes must persist `resolvedPolicySnapshot` and `scoredWithVersion` at evaluation time
- later policy changes must not retroactively alter historical qualification or scoring unless a deliberate `rescoreRunId` is written

### 12.4 `mission-runs/{missionId}`

Extend the mission run audit with:

- `plannedOutcomeCount`
- `observingOutcomeCount`
- `confirmedOutcomeCount`
- `reversedOutcomeCount`
- `guardrailFailureCount`
- `terminalOutcomeScore`
- `enablingOutcomeScore`
- `learningOutcomeScore`
- `invalidationOutcomeScore`
- `constraintOutcomeScore`
- `creditedOutcomeScore`
- `netOutcomeScore`
- `businessDebtScore`
- `waivedOutcomeCount`
- `waivedCreditedScore`
- `canceledOutcomeCount`
- `supersededOutcomeCount`
- `dedupedOutcomeCount`

Accounting rule:

- `mission-runs/{missionId}` top-level totals are materialized views
- all score and count changes must be posted as append-only delta events in `mission-runs/{missionId}/events`
- materialized totals may be recomputed from the event journal but must not silently overwrite history

## 13. Planner Requirements

The planner is responsible for outcome selection, not just task generation.

### 13.1 Outcome-First Planning Rule

The planner must generate outcomes first, then derive tasks.

Required order:

1. define target outcome
2. define proof packet
3. define quality gates
4. define expected score
5. place the outcome in the outcome graph
6. define tasks required to reach the outcome

### 13.2 Execute Eligibility

A task may enter execute only if:

- it is linked to an outcome record
- the proof packet is complete
- `proofCompileStatus = 'dry-run-passed'`
- all policy refs resolve
- the outcome class and domain are explicit
- the success and expiry criteria are machine-evaluable
- guardrails are explicit
- the expected score clears mission policy according to `executeGateMode`
- the task sits in a valid outcome graph position

Execute gate policy:

- `credited-and-net`: both `expectedCreditedScore >= plannerMinimumCreditedScore` and `expectedNetScore >= plannerMinimumNetScore`
- `credited-only`: only the credited threshold must pass
- `net-only`: only the net threshold must pass

### 13.3 Planner Prioritization

Default planner sort:

1. higher `expectedCreditedScore`
2. higher `expectedNetScore`
3. stronger evidence design
4. shorter `timeToSignal`
5. lower downside risk
6. higher strategic leverage

### 13.4 Outcome Graph Rules

- every enabling outcome must point to a parent terminal or mission-critical constraint outcome
- learning and invalidation outcomes must point to the terminal or enabling outcome they change
- planner must not create orphan outcomes unless mission policy explicitly allows them
- graph edges must encode `enables`, `blocks`, `de-risks`, `invalidates`, or `measures`
- parent outcomes must declare `rollupMode`

### 13.5 Domain Loophole Rule

`data` and `system-operations` outcomes are only execute-valid if they include a measurable downstream effect, not just an internal change.

### 13.6 WIP Rules

- no more than `20%` of execute WIP may be learning or invalidation work unless the mission mode explicitly allows it
- every enabling outcome must be attached to a named terminal outcome or objective
- constraint work can preempt commercial work only on guardrail failure or mission-critical quality breaches
- waived-credit outcomes count against the mission exception budget

### 13.7 Refusal Rules

The planner must refuse or downgrade any execute task that:

- has no proof packet
- defines only an internal artifact with no business linkage
- has unclear attribution
- relies on unresolved implied policy language
- has unacceptable risk for the expected upside
- should really be explore work

## 14. Runner Requirements

### 14.1 Artifact Verification

The runner continues to verify artifacts through acceptance checks.

On pass:

- task may move to `done`
- deliverable may move to `verified-auto` or `verified-human`
- linked outcome moves to `artifact-verified` or `observing`

On fail:

- task moves to `needs-review`
- outcome moves to `failed` or remains `executing`
- corrective work may be created

### 14.2 Deterministic Outcome Evaluation

The runner or supervisor must evaluate:

- source queries
- metric refs
- qualification predicates
- success predicates
- failure predicates
- expiry predicates
- business effect predicates
- guardrail predicates

Free-text notes cannot decide pass/fail.

Predicate truth table:

- `qualificationCriteria`: gates whether the outcome is eligible to count at all
- `successCriteria`: gates whether the core outcome event occurred
- `failureCriteria`: forces `failed` if triggered
- `expiryCriteria`: forces `expired` or `reversed` depending on prior state
- `businessEffectCriteria`: for `terminal` outcomes, at least one required business-effect predicate must pass before `confirmed`; for `enabling`, `constraint`, `learning`, and `invalidation`, business-effect predicates feed score and follow-on planning unless mission policy marks them as required-for-confirmation
- `guardrails`: can zero credited score or force failure regardless of other predicates

If a source is stale, unreachable, late-arriving, or timezone-ambiguous:

- outcome must remain `observing` or move to `expired`
- the system must not infer a pass from missing data
- the failure must be recorded in `proofCompileErrors` or evaluation logs

### 14.3 Outcome Observation

If the proof packet requires a delayed observation window:

- runner starts observation on artifact verification
- outcome remains `observing`
- mission reporting shows it as provisional
- outcome only becomes `confirmed` when the success event survives the window

### 14.4 Outcome Failure and Reversal

If the success event fails to appear, reverses, or violates guardrails:

- outcome moves to `failed` or `reversed`
- score is recomputed
- mission audit records the reversal
- planner may create corrective or replacement work

### 14.5 Attribution and Credit Posting

When an outcome changes state:

- `contributorLedger` must be resolved
- `creditedOutcomeScore`, `netOutcomeScore`, and `businessDebtScore` must be written
- duplicate credit for the same commercial event must be blocked

Posting formula:

```ts
postedContributorCreditedScore =
  outcome.score.creditedOutcomeScore * contributor.shareWeight;

postedContributorNetScore =
  outcome.score.netOutcomeScore * contributor.shareWeight;

postedContributorBusinessDebtScore =
  outcome.score.businessDebtScore * contributor.shareWeight;
```

Rules:

- contributor posting uses `shareWeight`; it does not apply an extra multiplier on top of the already-attributed outcome score
- contributor `attribution` labels are validation constraints on ledger composition, not a second scoring pass
- if value belongs partly to outside actors, the residual must be assigned to a synthetic `external` contributor entry rather than left implicit

## 15. Review Requirements

### 15.1 Auto Review

Required for:

- primary-source checks
- scoring math
- observation-window transitions
- guardrail evaluation

### 15.2 Human Review

Required for:

- high-risk outreach
- compliance-sensitive language
- large spend activation
- partner or contract commitments
- any waived hard gate

### 15.3 Override Behavior

Human review may:

- confirm
- reject
- waive with reason
- reduce attribution
- reduce score
- mark as reversed later
- convert a superficially positive outcome into debt if quality or risk was misread

All overrides must be written to the outcome record and mission audit trail.

## 16. Mission Progress Rules

Mission progress must track two separate layers:

- `verified artifact progress`
- `confirmed outcome progress`

### 16.1 Short-Loop Health

Used for runtime supervision:

- verified deliverables produced
- time since last verified artifact
- correction rate
- queue inflation

### 16.2 Business Movement

Used for mission success:

- confirmed outcome count
- cumulative outcome score
- terminal outcome score
- score by domain
- reversal rate
- credited outcome score
- net outcome score
- business debt score
- waived outcome count

### 16.3 Rollup Rules

- executive reporting uses `creditedOutcomeScore`
- mission economics use `netOutcomeScore`
- downside uses `businessDebtScore`
- waived outcomes are excluded from normal totals unless mission policy explicitly grants credit
- parent outcomes must roll up through `rollupMode`

### 16.4 Auto-Pause

The existing no-artifact stall pause remains.

Add a second business-stall alert:

- warn if no outcome has entered `observing` within the business-signal SLA for the mission
- warn if too much execute time is spent on low-score enabling work
- auto-pause only if guardrails fail repeatedly or score collapses below the mission floor

## 17. Domain Templates

These templates are human-readable shorthands. At runtime they must compile into policy refs, source queries, metric refs, and predicates.

### 17.1 Partnerships Meeting

- class: `terminal`
- domain: `partnerships`
- source of truth: `calendar`
- success event: `accepted meeting with named partner stakeholder`
- qualifier: `ICP-fit org and VP/Head/Founder or qualified champion`
- observation window: `immediate`
- expiry rule: `meeting canceled or no-show without reschedule`

### 17.2 Paid Campaign Launch

- class: `enabling`
- domain: `distribution`
- source of truth: `ad-platform`
- success event: `campaign live with spend, creative, audience, and tracking active`
- qualifier: `tracking verified, caps set, stop-loss rule set`
- observation window: `72h`
- expiry rule: `paused due to benchmark failure or tracking fault`

### 17.3 Proposal Sent

- class: `terminal`
- domain: `pipeline`
- source of truth: `crm`
- success event: `proposal delivered to buyer thread and next-step date logged`
- qualifier: `decision-maker or confirmed champion present`
- observation window: `14d`
- expiry rule: `deal marked unqualified or proposal ignored past threshold`

### 17.4 Revenue Activation

- class: `terminal`
- domain: `revenue`
- source of truth: `billing`
- success event: `first payment or active contract`
- qualifier: `meets fit, margin, and retention-quality thresholds`
- observation window: `30d`
- expiry rule: `refund, cancellation, failed onboarding, or low-quality exception`

### 17.5 Channel Invalidation

- class: `invalidation`
- domain: `distribution`
- source of truth: `ad-platform` or `analytics`
- success event: `channel fails pre-declared benchmark inside spend cap`
- qualifier: `cheap test completed under cap`
- observation window: `72h`
- expiry rule: `benchmark was poorly defined or evidence corrupted`

## 18. UI and Surface Requirements

### 18.1 Mission Control

Add:

- outcome count by class
- score by domain
- credited vs net outcome score
- business debt score
- observing vs confirmed outcomes
- guardrail warnings
- reversal count
- waived exception count
- top active terminal outcomes

### 18.2 Shared Deliverables

Add:

- linked outcome id
- outcome status
- expected observation window
- proof packet summary
- credited vs net score tags when present

### 18.3 PulseCommand

Expose:

- current terminal outcomes
- observing outcomes
- confirmed outcomes
- risk warnings
- mission score by domain
- credited vs net mission score
- business debt and waiver buckets

## 19. Rollout Plan

### Phase 1

- add outcome classes, domains, proof packet schema, policy objects, and new Firestore fields
- create `agent-outcomes`
- add proof compile/dry-run and deterministic external-event identity
- planner requires proof packets for execute work

### Phase 2

- link deliverables and tasks to outcomes
- add score calculation, credited vs net accounting, and mission reporting
- add outcome observation states

### Phase 3

- add domain-specific integrations for calendar, CRM, billing, analytics, ad platforms, data pipelines, and system telemetry
- add reversal detection
- add calibration packs and policy resolution tooling
- add UI surfaces

### Phase 4

- use outcome score as the default mission planner objective
- add operator-configurable score floors, domain priorities, and waiver policy

## 20. Acceptance Criteria

This spec is implemented when:

- every execute task links to a named outcome
- no execute task can enter the queue without a proof packet
- no execute task can enter the queue without a proof dry-run pass
- no execute task can enter the queue with unresolved policy language
- deliverables and outcomes have separate but linked state machines
- mission reporting distinguishes artifact verification from business confirmation
- terminal, enabling, learning, and invalidation outcomes are scored differently
- risk penalties can zero out otherwise attractive outcomes
- outcome graphs encode parent-child and dependency relationships
- external commercial events resolve deterministic identity and dedupe keys
- multi-touch attribution is recorded without double-counting wins
- waived and negative-score outcomes are reported explicitly
- long-loop outcomes can be confirmed, expired, or reversed after task completion
- Mission Control can show confirmed business movement instead of only task activity

## 21. Default Policy

Until overridden by mission policy:

- minimum execute proof completeness: `100%`
- minimum `evidenceStrength`: `12`
- minimum `valueQuality`: `6`
- `executeGateMode = 'credited-and-net'`
- max execute WIP for learning/invalidation: `20%`
- `allowWaivedCredit = false`
- `allowNegativeNetScore = true`
- `clampCreditedScoreAtZero = true`
- `hardFailureNetHandling = 'force-debt'`
- `hardFailureDebtFloor = 5`
- primary planning objective: maximize confirmed terminal outcome score subject to guardrails
