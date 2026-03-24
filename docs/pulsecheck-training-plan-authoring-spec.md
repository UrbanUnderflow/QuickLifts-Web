# PulseCheck Training Plan Authoring Spec

Status: Draft v1.0  
Date: March 2026  
Owners: PulseCheck Product, Nora Runtime, iOS, Web

Defines how Nora authors longer-horizon mental training blocks so `TrainingPlan` becomes a real programming artifact rather than a daily-task wrapper.

## 1. Purpose

This spec defines the missing long-term programming layer in Pulse Check.

It answers:

- When should Nora author a true training plan?
- What kinds of plans can Nora author?
- How should a plan be structured?
- How does a plan feed daily task materialization without being rewritten every day?

This spec exists because the runtime can currently answer:

- What should this athlete do next?

But it does not yet reliably answer:

- What is this athlete working on over the next 1 to 2 weeks?

## 2. Relationship to the Alignment Spec

The existing Daily Task + Training Plan Alignment Spec defines:

- canonical `DailyTask`, `TrainingPlan`, and `PlanStep` objects
- lifecycle rules
- surface ownership
- empty-state behavior
- override and event contracts

This spec defines the layer above that:

- how a `TrainingPlan` gets authored in the first place
- how authored plans are sequenced
- how Nora decides plan type, goal, length, and steps

Short version:

- `DailyTask` is the execution truth
- `TrainingPlan` is the programming truth
- this spec defines how the programming truth is created

## 3. Current Gap

Today, Nora mainly has a next-step recommendation engine, not a true plan-authoring engine.

Current behavior:

- `ProgramPrescription` chooses the next recommended sim or protocol context
- daily runtime can materialize a same-day task from that recommendation
- plan persistence exists, but plan creation is still too opportunistic

This creates a predictable product gap:

- Home can feel coherent because it only needs today's task
- Mental Training can feel hollow because it needs authored over-time structure

## 4. Core Runtime Separation

These three layers must remain distinct.

### 4.1 `ProgramPrescription`

`ProgramPrescription` is Nora's next-step recommendation layer.

It answers:

- given the latest profile and state, what is the best next rep candidate?

It is:

- useful for same-day routing
- useful for fallback when no plan exists yet
- not athlete-facing plan truth

### 4.2 `TrainingPlan`

`TrainingPlan` is Nora's authored multi-session or multi-day block.

It answers:

- what is the athlete working on over time?
- what is the current block trying to develop?
- what step comes next in the block?

It is:

- persisted
- athlete-facing
- the primary source for `Active Plans`

### 4.3 `DailyTask`

`DailyTask` is the execution artifact for one date.

It answers:

- what is today's rep?
- what state is it in?
- what happened when it was completed?

It is:

- materialized from the active plan's next step when a plan exists
- overridden by same-day state when needed
- never a substitute for authored long-term programming

## 5. Product Principles

- One primary active plan at a time in v1.
- The daily runtime should consume the plan, not improvise a new plan every day.
- Same-day state can override today's step, but should not silently rewrite the plan's history.
- Mental Training must remain coherent even when no authored plan exists yet.
- `ProgramPrescription` may still exist for fallback and override logic, but it must not be treated as the athlete's active plan.

## 6. Authoring Triggers

Nora should author a `TrainingPlan` only at explicit runtime moments.

### 6.1 Primary Triggers

| Trigger | Behavior |
| --- | --- |
| Baseline complete | Nora authors the athlete's first real plan unless confidence is too low for block-level programming. |
| Early exploratory sessions complete | If Nora needs 1 to 3 exploratory reps before committing, author the first plan after that short calibration window. |
| Plan completion | When the active primary plan completes, Nora authors the next primary plan from the updated profile. |
| Significant profile change | If the athlete's bottleneck or readiness pattern changes materially, Nora may supersede the active plan and author a new one. |
| Coach or pilot programming | Staff may author, constrain, or replace the primary plan directly when required for pilot operations. |

### 6.1.1 Exploratory Window Default

When Nora does not yet have enough confidence to author the first real block:

- default exploratory window: `2` reps
- maximum exploratory window in v1: `3` reps

If confidence is still too low after the maximum exploratory window, Nora should author a short starter block rather than leaving the athlete in indefinite recommendation-only mode.

### 6.2 Non-Triggers

These should not author a new plan by default:

- normal same-day daily-task materialization
- a one-off daily override
- a single missed day
- a single paused or deferred session

Those events affect execution, not block authorship.

### 6.3 V1 Operating Definition of Significant Profile Change

`Significant profile change` is the threshold that allows Nora to supersede the active primary plan and author a new one.

V1 should treat the following as qualifying signals:

- the athlete's primary bottleneck changes to a different weakest skill and remains there across recent refreshes
- repeated state-driven overrides in the current block suggest the plan goal no longer fits the athlete's state reality
- persistent Red or unstable readiness patterns make the current plan type inappropriate
- recent results show a large enough shift that the current plan goal is no longer the best development target
- a coach or pilot explicitly declares that the current block is no longer valid

V1 does not need a scientific threshold yet, but it must use one shared runtime interpretation instead of letting each caller define supersession independently.

## 7. Plan Eligibility and Guardrails

### 7.1 Primary Plan Rule

V1 should allow exactly one primary active plan per athlete.

This means:

- at most one `TrainingPlan` with `isPrimary = true` and `status = active`
- optional secondary coach work may coexist later, but it is not the primary Nora plan

### 7.2 No-Plan States

Two valid product states exist before or between authored plans:

- `no_plan_yet`: the athlete has completed onboarding or early reps, but Nora has not authored the first block
- `between_programs`: the prior plan completed or was superseded and the next block is not authored yet

These are render states, not `TrainingPlan.status` values.

### 7.3 Override Guardrail

A same-day override should:

- replace the `DailyTask`
- mark the planned `PlanStep` as `overridden` or `deferred`
- preserve the authored plan as programming history

A same-day override should not:

- silently complete the original step
- create a brand-new plan just because today's state changed

## 8. Inputs to Plan Authoring

The authoring engine should consume the following runtime inputs:

- latest `taxonomyProfile`
- baseline assessment and probe history
- recent completed `DailyTask` results
- recent protocol and sim outcomes
- readiness and stability trends across recent state snapshots
- active or prior plan outcomes
- coach or pilot constraints
- inventory availability

### 8.1 Minimum Useful Inputs for v1

V1 can ship with a smaller required set:

- weakest skill
- weakest modifier or state bottleneck
- last 3 to 5 completed daily tasks
- whether baseline is complete
- whether an active primary plan already exists

## 9. V1 Plan Types

V1 should strongly default to three athlete-facing plan types.

### 9.1 `sim_focused`

Use when:

- the athlete is stable enough to train skill directly
- the main bottleneck is a trainable performance skill
- the athlete does not need a regulation-first block

Typical shape:

- `progressMode = sessions`
- `targetCount = 3 to 5`
- difficulty or pressure increases across steps

Example:

- `Steady Focus Build`
- Endurance Lock -> Endurance Lock extended -> Noise Gate crossover -> Endurance Lock fatigue -> reassessment

### 9.2 `protocol_focused`

Use when:

- state instability is the bottleneck
- regulation, priming, or recovery must stabilize the athlete before harder skill work

Typical shape:

- `progressMode = days`
- `targetCount = 5 to 7`
- steps are protocols or writing/reflection hybrids

Example:

- `Reset Your Floor`
- regulation protocol -> recovery reflection -> priming protocol -> regulation repeat -> reassessment

### 9.3 `mixed`

Use when:

- state and skill both matter
- the athlete needs protocol-to-sim sequencing
- Nora wants each rep to prime and then challenge execution

Typical shape:

- `progressMode = sessions`
- `targetCount = 4 to 6`
- at least one step uses `actionType = protocol_then_sim`

Example:

- `Calm Into Focus`
- regulation protocol -> Endurance Lock -> recovery reflection -> Noise Gate -> reassessment

### 9.4 `assessment`

`assessment` remains valid in the schema, but should be reserved for:

- baseline blocks
- reassessment blocks
- short diagnostic calibration sequences

It should not be the default steady-state programming mode.

## 10. V1 Authoring Archetypes

V1 should use a small authored archetype set rather than free-form plan generation.

Recommended initial archetypes:

| Archetype | Plan Type | Use Case |
| --- | --- | --- |
| `steady_focus_build` | `sim_focused` | Weakest skill is sustained or selective attention and the athlete is stable enough to push reps. |
| `reset_under_pressure` | `sim_focused` | Weakest skill is reset, attentional shifting, or error recovery under compounding disruption. |
| `regulation_first_stabilization` | `protocol_focused` | State volatility is the main blocker and readiness is fragile. |
| `protocol_to_skill_bridge` | `mixed` | The athlete needs a short regulation or recovery phase before skill reps will transfer. |
| `reassessment_bridge` | `assessment` or `mixed` | Nora needs to confirm whether a prior bottleneck has changed enough to start a new block. |

These archetypes should be authored from templates, not generated from scratch.

## 11. Recommended Stored Metadata

The current `TrainingPlan` and `PlanStep` schema is close, but the authoring engine should persist a few more fields for traceability.

### 11.1 `TrainingPlan` Additions

Recommended optional fields:

| Field | Type | Purpose |
| --- | --- | --- |
| `authoringTrigger` | enum | `baseline_complete` \| `exploratory_window_complete` \| `plan_completion` \| `profile_change` \| `coach_manual` |
| `authoringArchetype` | string | Template or archetype key, for example `steady_focus_build`. |
| `targetSkills` | string[] | Skills the block is trying to move. |
| `targetStateGoal` | string or null | State-oriented goal when applicable, for example `restore regulation floor`. |
| `progressionShape` | string | High-level progression intent, for example `build`, `stabilize`, `bridge`, `reassess`. |
| `completionRule` | string | Human-readable completion rule, for example `complete 5 sessions` or `complete 7 daily reps`. |
| `authoringConfidence` | string | `low` \| `medium` \| `high`, to distinguish starter blocks from confident full blocks. |
| `currentStepIndex` | integer or null | The authored step the athlete is currently on inside the block. |
| `lastCompletedStepIndex` | integer or null | The most recently completed authored step. |
| `sourceProfileSnapshotId` | string or null | The profile snapshot or profile revision Nora used when authoring the block. |
| `sourceProgramPrescriptionId` | string or null | The recommendation-layer context used at authoring time, when relevant. |
| `authoringRulesVersion` | string | The ruleset version used by the authoring engine. |
| `archetypeVersion` | string | The specific template or archetype version used to author the block. |

`nextDueStepIndex` should be treated as a required operational pointer in runtime, not a best-effort convenience field. The runtime should not have to reconstruct the active step from scratch on every surface read.

### 11.2 `PlanStep` Additions

Recommended optional fields:

| Field | Type | Purpose |
| --- | --- | --- |
| `stepGoal` | string | What this step is trying to accomplish. |
| `plannedSimSpecId` | string or null | Strongly typed sim reference when the step is sim-based. |
| `plannedProtocolId` | string or null | Strongly typed protocol reference when the step is protocol-based. |
| `sequencePhaseLabels` | string[] or null | Labels for internal phases when `actionType = protocol_then_sim`. |
| `difficultyLabel` | string or null | Athlete-facing progression marker such as `standard`, `extended`, or `reassessment`. |

## 12. Step Authoring Rules

### 12.1 All Steps Are Authored Up Front

When Nora creates a plan, it should author the full initial step sequence at creation time.

This means:

- the plan is a real block, not just a container for completed days
- `nextDueStepIndex` points into an authored sequence
- later overrides update the sequence status, but do not erase the original authored intent

### 12.2 Progression Rules

V1 progression should stay simple:

- start with the clearest bottleneck rep
- repeat once if the athlete needs stable acquisition
- increase difficulty, duration, or pressure only after one successful exposure
- end with either a reassessment or a transfer-oriented step

### 12.3 Composite Steps

If a plan step is `protocol_then_sim`:

- author it as one `PlanStep`
- materialize it as one `DailyTask`
- show internal phase progress inside the task
- only mark the step complete when the full chain completes

### 12.4 Step Completion Counting

`completedCount` should increment by `1` only when an authored step is fully completed.

This means:

- one completed `protocol_then_sim` composite step increments `completedCount` by `1`
- one completed protocol day in a day-based plan increments `completedCount` by `1`
- a partially completed composite task does not increment `completedCount`
- a superseded or overridden step does not increment `completedCount`
- `lastCompletedStepIndex` should only move when the authored step completes successfully

## 13. Authoring Logic v1

The authoring engine should follow a bounded deterministic flow.

### 13.1 Step 1: Identify the Primary Development Need

Read:

- weakest skill
- readiness or stability trend
- recent result pattern

Then decide whether the athlete mainly needs:

- direct skill work
- regulation-first work
- a bridge between the two

### 13.2 Step 2: Choose Plan Type

Use this decision rule:

- choose `protocol_focused` when state instability is the main limiter
- choose `mixed` when state and skill both matter
- choose `sim_focused` when the athlete is trainable and the bottleneck is mostly executional

### 13.3 Step 3: Choose Plan Length

Recommended v1 defaults:

- `sim_focused`: 5 sessions
- `protocol_focused`: 5 to 7 days
- `mixed`: 4 to 6 sessions
- `assessment`: 2 to 3 sessions

### 13.4 Step 4: Choose Archetype

Pick the smallest matching archetype from the template library.

Do not generate a novel plan shape unless inventory coverage or pilot constraints require it.

If the ideal archetype cannot be authored because required sim or protocol inventory is unavailable:

- fall back to the nearest valid archetype
- preserve the same high-level plan goal if possible
- record the fallback reason in plan authoring metadata or logs
- prefer a simpler valid block over silently failing authorship

### 13.5 Step 5: Author Steps

For each step:

- assign `actionType`
- assign exercise or protocol reference
- assign step label
- assign intended duration
- assign step goal
- assign difficulty label if needed

### 13.6 Step 6: Save the Plan

On save:

- set `status = active`
- set `isPrimary = true`
- set `completedCount = 0`
- set `nextDueStepIndex` to the first incomplete step
- set `currentStepIndex` to the first incomplete step
- set `lastCompletedStepIndex = null`
- persist the source profile or state reference used for authorship

## 14. Daily Materialization Contract

Daily runtime should consume authored plans using this order:

1. Load the active primary `TrainingPlan`
2. Resolve the next due authored `PlanStep`
3. Materialize today's `DailyTask` from that step
4. Apply same-day override logic only if state materially changes the routing decision

### 14.1 When a Plan Exists

If an active primary plan exists:

- today's default task should come from the next due step
- `ProgramPrescription` may inform safety, readiness, or override logic
- `ProgramPrescription` should not replace plan authorship as the first source of truth

### 14.2 When No Plan Exists

If no active plan exists:

- daily runtime may still materialize a `DailyTask` from `ProgramPrescription`
- Home should remain coherent
- Mental Training should show `Today` and `Recent Results`
- `Active Plans` should render `no plan yet` or `between programs`

### 14.3 Same-Day Override

If state requires a different task than the authored step:

- mark the authored step `overridden`
- preserve the plan
- materialize an override `DailyTask`
- do not author a fresh plan unless the profile change is large enough to trigger plan supersession

## 15. Plan Lifecycle

### 15.1 `active`

Plan is currently guiding daily task materialization.

### 15.2 `paused`

Use when:

- coach pauses the block
- pilot ops require a hold
- the athlete is intentionally in a non-training window

When a plan resumes:

- preserve the same `nextDueStepIndex` and `currentStepIndex` by default
- continue the authored block from the same next due step
- only supersede or re-author the plan if a higher-priority supersession trigger fires

Pause and resume should be treated as cadence events, not silent plan rewrites.

### 15.3 `completed`

A plan becomes `completed` when:

- its authored completion rule is met
- the final required step is completed
- or Nora explicitly closes the block

When a plan completes:

- `completedCount` reflects the final count
- `latestResultSummary` reflects the most recent step outcome
- `lastCompletedStepIndex` reflects the final completed authored step
- Nora should evaluate whether to author the next primary plan

### 15.4 `superseded`

A plan becomes `superseded` when:

- a significant profile change makes the block obsolete
- a coach or pilot replaces it
- Nora intentionally rewrites the athlete's longer-horizon path

Supersession should preserve history, not overwrite the prior plan in place.

### 15.5 Coach-Authored Primary Plan Replacement

When a coach or pilot staff member replaces the primary Nora-authored plan:

- the coach-authored plan becomes the new primary plan immediately
- the prior Nora-authored primary plan is preserved in history as `superseded`
- Nora authorship may resume after the coach-authored primary plan completes or is superseded

Coach intervention should not delete or overwrite Nora-authored plan history.

## 16. Mental Training Behavior Before and After Authoring

### 16.1 Before First Authored Plan

Mental Training should still show:

- `Today` from the current or completed `DailyTask`
- `Active Plans` with a `Nora is building your first program` state
- `Recent Results` from completed daily tasks

### 16.2 During an Active Plan

Mental Training should show:

- plan title
- plan goal
- current step
- progress count
- latest result
- next due label

### 16.3 Between Plans

Mental Training should show:

- recent results
- prior plan context if useful
- a `between programs` state in `Active Plans`

It should not collapse into a whole-tab empty state unless there is no `DailyTask`, no `TrainingPlan`, and no recent result history.

## 17. Implementation Decisions to Lock

These are build-shaping defaults that should be treated as operational decisions in v1.

### 17.1 Plan Step Pointers

Runtime should persist and maintain:

- `nextDueStepIndex`
- `currentStepIndex`
- `lastCompletedStepIndex`

These pointers should be updated by one shared progression path so surfaces do not compute them differently.

### 17.2 Significant Profile Change Threshold

Use the shared definition in Section 6.3 rather than letting each runtime consumer interpret supersession independently.

### 17.3 Composite Step Counting

For `protocol_then_sim`, one fully completed composite step counts as one completed authored step.

### 17.4 Pause and Resume Behavior

Resuming a paused plan should preserve the same next due step unless a separate supersession trigger fires.

### 17.5 Inventory Fallback

If ideal inventory is unavailable, author the nearest valid archetype and record the fallback reason.

### 17.6 Assessment Loop Guardrail

`assessment` plans should not become the athlete's repeated primary steady-state mode by accident.

V1 default:

- do not allow more than one consecutive primary assessment cycle unless a higher-priority runtime or coach trigger explicitly requires it
- if confidence remains low, prefer a short starter block over repeated reassessment loops

## 18. Authoring Event Contract

Training plan authorship should emit its own event stream for debugging, auditability, and analytics.

Recommended v1 events:

- `training_plan_authored`
- `training_plan_superseded`
- `training_plan_completed`
- `training_plan_paused`
- `training_plan_resumed`
- `training_plan_authoring_failed`
- `training_plan_step_authored`

Recommended minimum event payload:

- `trainingPlanId`
- `athleteId`
- `authoringTrigger`
- `authoringArchetype`
- `planType`
- `sourceStateSnapshotId` if available
- `targetSkills`
- `fallbackReason` when applicable
- `stepIndex` for step-scoped events
- `createdAt`

## 19. Example Plans

### 19.1 Sim-Focused Example

Weakest skill: `sustained_attention`

Plan:

- Title: `Steady Focus Build`
- Goal: `Hold steady focus when the rep starts to drag`
- Plan type: `sim_focused`
- Progress mode: `sessions`
- Target count: `5`

Steps:

1. `Endurance Lock - Standard`
2. `Endurance Lock - Extended`
3. `Noise Gate - Selective Pressure Crossover`
4. `Endurance Lock - Late Fatigue Emphasis`
5. `Reset - Reassessment`

### 19.2 Protocol-Focused Example

Main bottleneck: regulation floor and emotional carryover

Plan:

- Title: `Reset Your Floor`
- Goal: `Stabilize state before pushing harder skill work`
- Plan type: `protocol_focused`
- Progress mode: `days`
- Target count: `5`

Steps:

1. `State Reset Protocol`
2. `Recovery Reflection`
3. `Priming Protocol`
4. `State Reset Protocol`
5. `Readiness Recheck`

### 19.3 Mixed Example

Main bottleneck: state-to-execution bridge

Plan:

- Title: `Calm Into Focus`
- Goal: `Prime regulation, then execute under pressure`
- Plan type: `mixed`
- Progress mode: `sessions`
- Target count: `4`

Steps:

1. `Regulation Protocol -> Endurance Lock`
2. `Recovery Reflection -> Noise Gate`
3. `Priming Protocol -> Reset`
4. `Signal Window - Reassessment`

## 20. Acceptance Criteria

This spec is satisfied when:

- Nora can author a primary `TrainingPlan` independent of same-day daily task materialization
- the authored plan contains a real step sequence, not just a shell
- daily runtime uses the active plan's next step by default
- same-day overrides preserve plan history instead of silently mutating it
- plan-step pointers are persisted and updated coherently
- composite authored steps count as one completion unit only when fully complete
- Mental Training can show meaningful `Active Plans` content for athletes with authored blocks
- athletes with no plan yet still see `Today` and `Recent Results` when those objects exist
- `ProgramPrescription` remains recommendation logic, not athlete-facing plan truth

## 21. Implementation Direction

Recommended next implementation unit:

- add a dedicated `trainingPlanAuthoringService`

Responsibilities:

- inspect current profile and recent results
- choose plan type, archetype, and length
- author full steps
- persist a primary plan
- supersede or complete prior plans when appropriate

Recommended sequencing:

1. Ship the service with a bounded template library
2. Trigger first-plan authoring after baseline or exploratory reps
3. Trigger next-plan authoring on plan completion
4. Add profile-change supersession once the steady-state path is stable

## 22. Key Rule to Preserve

Daily check-in should materialize today's work from the plan.

It should not be the main place where long-term programming is invented.
