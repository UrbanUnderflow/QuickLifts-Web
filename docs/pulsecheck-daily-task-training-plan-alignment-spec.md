# PulseCheck Daily Task + Training Plan Alignment Spec

Status: Implementation-ready draft v1.0  
Date: March 2026  
Owners: PulseCheck Product, iOS, Web, Nora Runtime

Object model, lifecycle, surface ownership, state machines, field schemas, and event contracts for unified Nora-assigned athlete work across Home, Mental Training, and Nora chat.

## 1. Purpose

This spec defines how Pulse Check presents Nora-assigned work across Home, Mental Training, and Nora chat so the athlete always sees one coherent answer to two questions:

- What am I doing today?
- What am I working on over time?

It resolves the current trust-breaking mismatch where Home can show the real Nora daily task while Mental Training shows stale or legacy assignment content.

### Product Principle

Programs prescribe; sessions deliver.

- The athlete should experience one primary due-today task.
- The daily task is the execution truth.
- The training plan is the programming truth.
- No surface should create a second competing answer about what matters right now.

## 2. Runtime Alignment

### Document Role

Runtime surface-coherence spec. Defines the canonical objects, lifecycle, state machines, field schemas, and event contracts that make Home, Mental Training, and Nora chat share one assignment truth.

### Source-of-Truth Position

Authoritative for `DailyTask` and `TrainingPlan` object definitions, lifecycle rules, surface ownership, empty states, override logic, and the event contract.

Not authoritative for:

- Nora's assignment decision logic
- state inference
- sim or protocol mechanism design

See:

- Nora Assignment Rules v1.1
- State Signal Layer v1.2
- Protocol Taxonomy v2
- Profile Architecture v1.3
- Runtime Architecture v1
- Onboarding Architecture v1

## 3. Canonical Objects

### 3.1 `DailyTask`

The athlete's authoritative execution artifact for a specific date.

It answers:

- What is my rep today?
- What state is it in?
- What happened when I finished?

#### Required Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Unique identifier for this daily task instance. |
| `athleteId` | string | The athlete this task belongs to. |
| `sourceDate` | date | The calendar date this task is for, in the athlete's local timezone. |
| `timezone` | string | The athlete's local timezone at time of materialization, for example `America/New_York`. |
| `status` | enum | Current lifecycle status. See Section 5. |
| `isPrimaryForDate` | boolean | Whether this is the primary due-today task. Exactly one task per athlete per date should be true. |
| `actionType` | enum | `sim` \| `protocol` \| `trial` \| `protocol_then_sim` \| `check_in` |
| `presentationType` | enum | `single_rep` \| `sequence` \| `assessment` |
| `exerciseId` | string or null | Reference to the sim, protocol, or trial to execute. |
| `title` | string | Athlete-facing task name. |
| `subtitle` | string or null | Secondary label, for example family name or plan step label. |
| `athleteFacingRationale` | string | One-sentence reason why Nora assigned this today. |
| `stateSnapshotId` | string or null | The state snapshot Nora used when materializing this task. |
| `materializedAt` | timestamp | When this task was created. |
| `materializedBy` | enum | `nora_runtime` \| `coach_manual` \| `system_scheduled` |

#### Optional Fields

| Field | Type | Description |
| --- | --- | --- |
| `trainingPlanId` | string or null | The plan this task is a step of, if plan-backed. |
| `planStepIndex` | integer or null | Position in the plan sequence. |
| `planStepLabel` | string or null | Athlete-facing step label, for example `Session 2 of 5`. |
| `isPlanOverride` | boolean | `true` if this task replaced a different planned step for today. |
| `overrideReason` | string or null | Why the planned step was replaced, for example `state-based adjustment`. |
| `supersededByDailyTaskId` | string or null | If this task was superseded, the ID of the replacement task. |
| `supersededReason` | string or null | Why this task was superseded. |
| `sessionSummary` | object or null | Populated after completion with metrics and Nora takeaway. |
| `primaryMetric` | object or null | The headline metric shown on the completed card. |
| `secondaryMetrics` | array or null | Up to two additional metrics shown on the completed card. |
| `noraTakeaway` | string or null | One-sentence Nora coaching takeaway after completion. |
| `followUpPrompt` | string or null | Suggested next action or conversation prompt. |
| `startedAt` | timestamp or null | When the athlete started the task. |
| `completedAt` | timestamp or null | When the athlete completed the task. |
| `expiredAt` | timestamp or null | When this task expired without completion. |

### 3.2 `TrainingPlan`

The athlete's longer-horizon programming object.

It answers:

- What is Nora building over time?
- Where am I in the sequence?
- What is today's step inside that sequence?

#### Required Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Unique plan identifier. |
| `athleteId` | string | The athlete this plan belongs to. |
| `title` | string | Athlete-facing plan name, for example `Steady Focus Build`. |
| `goal` | string | What this plan is trying to develop. |
| `planType` | enum | `sim_focused` \| `protocol_focused` \| `mixed` \| `assessment` |
| `status` | enum | `active` \| `paused` \| `completed` \| `superseded` |
| `isPrimary` | boolean | Whether this is the athlete's primary active plan. |
| `progressMode` | enum | `days` \| `sessions` \| `open_ended` |
| `targetCount` | integer or null | Total planned sessions or days. `null` for `open_ended`. |
| `completedCount` | integer | Sessions or days completed so far. |
| `steps` | array | Ordered list of plan steps. See Section 3.3. |

#### Optional Fields

| Field | Type | Description |
| --- | --- | --- |
| `assignedBy` | enum | `nora` \| `coach` \| `system` |
| `startDate` | date or null | Plan start date. |
| `endDate` | date or null | Planned end date. |
| `cadence` | string or null | Expected session frequency, for example `3x per week`. |
| `primaryPlanMetric` | string or null | The primary metric tracking plan progress. |
| `latestResultSummary` | string or null | Most recent step result for display. |
| `supersededByPlanId` | string or null | If superseded, the replacement plan ID. |

### 3.3 `PlanStep`

Each step in a `TrainingPlan` has its own status to support progression, overrides, and skipped steps.

| Field | Type | Description |
| --- | --- | --- |
| `stepIndex` | integer | Position in the plan sequence. |
| `stepLabel` | string | Athlete-facing label, for example `Session 3: Noise Gate`. |
| `stepStatus` | enum | `planned` \| `active_today` \| `completed` \| `deferred` \| `overridden` \| `skipped` \| `superseded` |
| `actionType` | enum | `sim` \| `protocol` \| `trial` \| `protocol_then_sim` \| `check_in` |
| `exerciseId` | string | Reference to the sim, protocol, or trial for this step. |
| `linkedDailyTaskId` | string or null | The `DailyTask` that executed this step, once materialized. |
| `overrideReason` | string or null | Why this step was overridden or skipped. |
| `resultSummary` | object or null | Metrics and takeaway from the completed step. |

## 4. DailyTask Materialization Rules

A `DailyTask` does not exist until it is materialized.

These rules define when and how materialization happens.

### 4.1 Materialization Triggers

| Trigger | Behavior |
| --- | --- |
| Athlete opens app (primary) | When the athlete opens the app for the first time on a new calendar day, Nora materializes the `DailyTask` for today using the latest state snapshot, active plan context, and assignment rules. This is the primary materialization path. |
| Morning check-in completes | If the athlete completes a structured check-in before the app-open trigger, materialization should use the check-in state rather than stale prior-day data. |
| Coach manual assignment | A coach can manually assign a `DailyTask` at any time. This supersedes any unmaterialized plan step for the day. |
| State-triggered re-materialization | If Nora receives a fresh state snapshot that significantly changes the routing decision, for example the athlete goes from Green to Red, Nora may supersede the current `DailyTask` with a new one. The original task is marked `superseded` with a reason. |

### 4.2 Materialization Constraints

- One primary task per date: at most one `DailyTask` with `isPrimaryForDate = true` may exist for a given athlete and `sourceDate`. Superseded tasks remain in storage but are no longer primary.
- No pre-materialization: `DailyTask` records should not be created days in advance. They materialize on the day they are due, using same-day state and context.
- Plan steps are candidates, not guarantees: the active plan's next step is the default candidate for today's task, but Nora may replace it based on state. The plan step is marked `overridden`, not silently completed.

## 5. DailyTask Lifecycle State Machine

Every `DailyTask` transitions through a defined set of states.

No transition should happen implicitly.

| Status | Meaning | Allowed Transitions |
| --- | --- | --- |
| `assigned` | Task has been materialized and is due today. Athlete has not started. | `started`, `deferred`, `superseded`, `expired` |
| `started` | Athlete has begun the task. | `completed`, `paused`, `superseded` |
| `paused` | Athlete paused mid-session. Session data is preserved. | `started` (resume), `superseded`, `expired` |
| `completed` | Athlete finished the task. Metrics and takeaway are available. | Terminal |
| `deferred` | Nora or athlete explicitly deferred today's task to a later date or alternate path. | Terminal for this date |
| `superseded` | This task was replaced by a different `DailyTask` for the same date. `supersededByDailyTaskId` and `supersededReason` are populated. | Terminal |
| `expired` | The date passed without the athlete starting or completing the task. | Terminal |

### Expiration Rule

A `DailyTask` expires at 4:00 AM athlete-local time on the following calendar day.

If the athlete started the task before midnight and is still in progress at 4:00 AM, the task remains in `started` status until completion or session timeout. It does not auto-expire mid-session.

## 6. Timezone and Date Boundary Rules

| Rule | Definition |
| --- | --- |
| `sourceDate` is athlete-local | The `sourceDate` on a `DailyTask` uses the athlete's local timezone, recorded in the `timezone` field at materialization time. |
| Timezone is captured once | The timezone is set when the task is materialized and does not change if the athlete travels mid-day. Travel-related timezone shifts affect the next day's materialization, not the current task. |
| Date rollover at 4:00 AM local | A new calendar day begins at 4:00 AM athlete-local for the purpose of `DailyTask` expiration and next-day materialization. This prevents late-night sessions from being split across dates. |
| Cross-midnight sessions | If an athlete starts a task before midnight and completes it after midnight, but before 4:00 AM, the task remains associated with the `sourceDate` it was materialized for. It does not become the next day's task. |
| Travel handling | If the athlete's device timezone changes between days, the next materialization uses the new timezone. No retroactive re-dating of prior tasks. |

## 7. Multiple Task Coexistence Rules

The core rule is one primary `DailyTask` per athlete per date.

However, secondary items may coexist under strict rules.

| Scenario | Allowed? | Display Rule |
| --- | --- | --- |
| Protocol -> Sim chain | Yes | Represent as one composite `DailyTask` with `actionType = protocol_then_sim`. Show as a single card with two phases, not two separate tasks. |
| Coach-added item alongside Nora task | Yes | Represent as a secondary task with `isPrimaryForDate = false`. Show in Mental Training under Active Plans with a `Coach assigned` badge. It does not replace the primary Nora task on Home. |
| Optional follow-up after completion | Yes | Represent as a follow-up suggestion, not a second primary task. Show it in the completed card or Nora chat, not as a new Home card. |
| Two simultaneous Nora primary tasks | No | Never allow this. Nora must resolve to one primary task per date. |

## 8. Surface Ownership

### 8.1 Home

Home is the `DailyTask` surface.

It answers:

- What is my rep today?
- Why did Nora give me this?
- Did I already do it?
- What should I do next?

| Card State | What to Show | CTA |
| --- | --- | --- |
| `assigned` | Rep title, rationale, duration, difficulty, plan linkage | `Start today's rep` |
| `started` | Rep title, progress label, plan linkage | `Resume today's rep` |
| `completed` | Completion state, rep title, primary metric, Nora takeaway, plan progress | `Review result` or `Talk to Nora` |
| `deferred` | Why the rep is not set and what Nora needs | `Check in with Nora` |
| `superseded` | The new current task, not the original | `Start today's rep` |
| `no_task_yet` | Recent baseline context and Nora message | `Talk to Nora` |
| `between_programs` | Recent progress anchor and next-plan message | `Review recent progress` or `Talk to Nora` |

### 8.2 Mental Training

Mental Training is the `TrainingPlan` surface with a mirrored `DailyTask` section at the top.

- Section 1 `Today`: mirrors Home's `DailyTask` using the same `DailyTask.id`, same status, same CTA, and same launch target.
- Section 2 `Active Plans`: shows Nora-assigned multi-session plans with title, goal, current step, progress mode and count, latest result, and next due label. The primary plan is visually prominent. Coach-assigned items show a badge.
- Section 3 `Recent Results`: shows completed reps with title, date, primary metric, Nora takeaway, and plan linkage.

#### Recent Results Inclusion Rules

- Show the most recent 10 completed `DailyTask` records.
- Include sims, protocols, and trials. All task types qualify.
- Overridden steps that were never started do not appear because they were never executed.
- Aborted or invalid sessions appear with a `not completed` indicator rather than being silently hidden.
- Sort by `completedAt` descending.

### 8.3 Nora Chat

Nora chat opens aware of:

- the active `DailyTask.id`
- the current `TrainingPlan.id`
- the latest state snapshot
- the current lifecycle status

Nora chat must not invent a separate assignment truth.

## 9. Override and Adjustment Rules

When a plan-backed task is adjusted because of same-day state:

- the new `DailyTask` becomes execution truth
- Home and Mental Training show the new task, not the original
- the plan remains visible
- the Active Plans section explains that today's step was adjusted
- the original plan step is marked `overridden`, not silently completed
- plan progress does not count the original step as done
- the athlete can understand what changed, why it changed, and whether the broader plan is still active

Optional support line:

- `Today's plan was adjusted based on how you're showing up today.`

## 10. Empty State Spec

An athlete is in empty state when there is no active `TrainingPlan` and no active or due-today `DailyTask`.

Home and Mental Training must not fall back to stale legacy content.

### 10.1 Scenarios

- new athlete finished onboarding and baseline but has not received the first plan yet
- athlete completed a plan and Nora has not assigned the next block
- coach paused programming

### 10.2 Required Behavior

- Show the most recent baseline results or most recent plan results, whichever is more recent.
- Show a plain-language Nora message that feels intentional.
- Provide a clear next action, such as `Talk to Nora` or `Review recent progress`.

### 10.3 Recommended Copy

- `Nora is building your first program.`
- `Your baseline is in. I'm using it to shape what comes next.`
- `You're between training blocks right now. I'll line up the next one after I read your latest signals.`

## 11. Metrics Contract

Every completed `DailyTask` shown to the athlete should support:

- one primary metric
- up to two secondary metrics
- one short Nora takeaway

| Task Type | Primary Metric Examples | Nora Takeaway Example |
| --- | --- | --- |
| Sim | Stability, accuracy, degradation onset, recovery speed | `Your focus held up better under fatigue today.` |
| Protocol | Completion quality, self-rated shift, reflection depth | `Your breathing pattern was more consistent this time.` |
| Trial | Checkpoint result, transfer framing, Transfer Gap | `Your baseline is locked. This is where we start measuring.` |

If strong metrics do not exist yet, the fallback is:

- completion badge
- duration
- Nora takeaway

The UI should never show raw backend or audit fields.

## 12. Event Contract

The following runtime events must be emitted to support analytics, debugging, trust audits, and downstream consumers.

| Event | Payload Requirements |
| --- | --- |
| `daily_task_materialized` | `dailyTaskId`, `athleteId`, `sourceDate`, `actionType`, `materializedBy`, `trainingPlanId` if plan-backed, `stateSnapshotId` |
| `daily_task_started` | `dailyTaskId`, `athleteId`, `startedAt` |
| `daily_task_paused` | `dailyTaskId`, `athleteId`, `pausedAt` |
| `daily_task_resumed` | `dailyTaskId`, `athleteId`, `resumedAt` |
| `daily_task_completed` | `dailyTaskId`, `athleteId`, `completedAt`, `primaryMetric`, `noraTakeaway`, `planStepIndex` if plan-backed |
| `daily_task_deferred` | `dailyTaskId`, `athleteId`, `deferReason`, `deferredAt` |
| `daily_task_superseded` | `dailyTaskId`, `supersededByDailyTaskId`, `supersededReason`, `athleteId` |
| `daily_task_expired` | `dailyTaskId`, `athleteId`, `sourceDate`, `expiredAt` |
| `plan_step_activated` | `trainingPlanId`, `stepIndex`, `linkedDailyTaskId`, `athleteId` |
| `plan_step_completed` | `trainingPlanId`, `stepIndex`, `linkedDailyTaskId`, `resultSummary` |
| `plan_step_overridden` | `trainingPlanId`, `stepIndex`, `overrideReason`, `replacementDailyTaskId` |
| `plan_step_skipped` | `trainingPlanId`, `stepIndex`, `skipReason` |
| `plan_completed` | `trainingPlanId`, `athleteId`, `completedCount`, `targetCount` |
| `empty_state_rendered` | `athleteId`, `emptyStateType` (`no_task_yet` or `between_programs`), `surface` (`home` or `mental_training`) |

Composite-task note:

- `protocol_then_sim` remains one `DailyTask` for surface truth and completion accounting.
- If deeper phase analytics are needed later, add sub-events such as `daily_task_phase_started` and `daily_task_phase_completed` without changing the one-task execution model.

## 13. Copy and Presentation Rules

Use:

- `Today's Rep`
- `Completed Today`
- `Active Plan`
- `Session 2 of 5`
- `Talk to Nora`

Avoid:

- `assignment`
- `curriculum`
- `confidence`
- `source`
- `planner`
- raw status labels
- admin terminology

## 14. Source-of-Truth Priority Order

1. Safety and escalation policy  
   Tier 2 and Tier 3 escalation states override all training assignment.
2. Current state snapshot and freshness  
   Same-day state may cause Nora to override the planned step.
3. DailyTask execution truth for the date  
   The primary `DailyTask` is what every surface shows.
4. Active TrainingPlan context  
   Provides plan progression and longitudinal framing.
5. Legacy assignment data  
   Only when mapped into the new model. Never as a competing primary surface.

## 15. Legacy Migration

| Phase | Scope | Exit Criteria |
| --- | --- | --- |
| Phase 1 | Create unified read model joining `pulsecheck-daily-assignments`, active program data, and mapped legacy assignments. | Home and Mental Training can read from the shared view model. |
| Phase 2 | Update Home and Mental Training to render from the `DailyTask` + `TrainingPlan` view model. | Both surfaces show the same task for the same date. |
| Phase 3 | De-prioritize legacy `mental-exercise-assignments` and `mental-curriculum-assignments` from primary athlete surfaces. | Legacy content no longer drives the main card when Nora-assigned work exists. |
| Phase 4 | Retire legacy primary-card fallbacks. Keep only migration adapters or admin-only visibility. | All live programming flows through the new model. |

## 16. Acceptance Criteria

- Home, Nora chat, and Mental Training all reference the same `DailyTask.id` for the same date.
- The athlete never sees two different answers to what today's rep is.
- Completing a rep changes Home from launch-ready to completed state.
- Mental Training mirrors today's status correctly.
- Plan-backed tasks show plan progress in athlete-facing terms.
- An override is visible and explained, not silent.
- Empty state is intentional and uses live baseline or progress context.
- Legacy content does not appear as the main assigned work unless it is the mapped active plan.
- Superseded tasks are preserved with reason but no longer shown as primary.
- Cross-midnight sessions remain on their original `sourceDate`.
- All lifecycle events from the event contract are emitted correctly.

## 17. Open Questions

- Should completed Home cards emphasize the metric first or Nora's takeaway first?
- How should coach-assigned manual work appear if it is outside Nora's current plan but still valid for the athlete?
- Should plan cadence, for example `3x per week`, enforce rest days, or should Nora decide daily whether to materialize?

## 18. Implementation Decisions Locked For v1

These are not architecture gaps.

They are build-time decisions that are now locked for v1 implementation so runtime, surfaces, and analytics can move from one shared contract.

### 18.1 Materialization Strategy

Locked v1 behavior:

- first app open is the primary materialization path
- same-day check-in may materialize or rematerialize the task if it is still mutable
- coach manual assignment may supersede an unmaterialized or mutable task

Mutable definition for this section:

- a `DailyTask` is mutable for automatic rematerialization only when `status = assigned`
- `started`, `paused`, `completed`, `deferred`, `superseded`, and `expired` are not automatically mutable
- explicit coach or safety policy may still supersede an in-progress task when higher-priority runtime rules require it

Coach-frozen definition for this section:

- `coach-frozen` is not a `DailyTask.status`
- it is a same-date execution lock created by coach override or coach defer behavior that prevents automatic rematerialization unless higher-priority safety policy takes over
- for v1 storage, this execution lock lives on the `DailyTask` record as task-level control metadata rather than on `TrainingPlan`

Future-scale option:

- an overnight job may pre-materialize a provisional `DailyTask`
- first same-day check-in may rematerialize that task if the task has not been started, completed, deferred, or coach-frozen

Invariant:

- there is still exactly one primary `DailyTask` per athlete per date

### 18.2 `protocol_then_sim` Completion Behavior

Locked v1 behavior:

- `protocol_then_sim` is one `DailyTask`
- Home treats it as one due-today rep
- the runtime may show phase progress inside that single task, for example `Phase 1 of 2` and `Phase 2 of 2`
- the Home card should only flip to completed when the full chain is completed

This preserves the one-primary-task rule while still supporting phase-aware execution UI.

### 18.3 `PlanStep.stepStatus` and `DailyTask.status` Mapping

Locked v1 behavior:

- `DailyTask.status` is execution truth
- `PlanStep.stepStatus` is programming truth
- status transitions must flow through one shared mapping layer so the two models cannot drift semantically in code

Practical split:

- `DailyTask.status` owns execution states such as `assigned`, `started`, `paused`, `completed`, `deferred`, `superseded`, and `expired`
- `PlanStep.stepStatus` owns plan-sequence states such as `planned`, `active_today`, `completed`, `overridden`, `skipped`, and `superseded`

Implementation rule:

- once a plan step materializes into a `DailyTask`, execution updates should be written through one authoritative transition path that synchronizes the plan step status intentionally rather than through surface-specific side effects

### 18.4 Active Plan Cardinality

Locked v1 behavior:

- multiple active plans are allowed in the model
- exactly one active plan may be `primary`
- athlete-facing surfaces should visually emphasize the primary plan and treat any others as secondary or supplemental

### 18.5 `paused` / `resumed` Posture

Locked v1 behavior:

- `paused` and `resumed` are reserved extension states and events
- they are not launch-blocking v1 runtime requirements across all execution surfaces
- players that do not support resumable execution in v1 do not need to implement them yet

## 19. Related Documents

- Nora Assignment Rules v1.1
- State Signal Layer v1.2
- Protocol Taxonomy v2
- Profile Architecture v1.3 + Data Model v1.2
- Runtime Architecture v1
- Onboarding Architecture v1
- Sim Specification Standards Addendum v2
