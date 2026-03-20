import React from 'react';
import { ArrowLeftRight, Brain, ClipboardList, Database, MessageSquareQuote, Route, ShieldCheck, Smartphone, TestTube2 } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const DESIGN_GOAL_ROWS = [
  ['One explicit athlete signal', 'A readiness tap is not just decorative UI. It is a structured self-report event with source time, athlete id, and source surface.'],
  ['AI-enriched state, not just normalized state', 'The signal layer should preserve raw evidence, then let AI verify contradictions, enrich the snapshot, and explain likely drivers before assignment planning.'],
  ['One authoritative snapshot family', 'Nora, escalation, coach tools, and athlete surfaces all consume the same current-state snapshot and provenance instead of inventing separate interpretations.'],
  ['One daily execution artifact', 'After check-in, the orchestrator writes one Nora daily assignment that Today, Nora chat, and Mental Training all reference by id.'],
  ['Bounded assignment choice', 'Nora should decide from the system’s registered simulations and protocols, not invent freeform tasks at runtime.'],
  ['Bidirectional state updates', 'Chat, rep starts, completions, and coach overrides can all refresh the state snapshot rather than living as disconnected events.'],
  ['Short-horizon posture memory', 'Recent assignment outcomes, especially a fresh Tier 0 defer, should bias today’s routing so Nora does not repeat low-information defers by default.'],
];

const CONTRACT_ROWS = [
  ['pulsecheck-check-ins', 'Athlete surface or Nora prompt submitter', 'Explicit self-report event', 'athleteId, sourceDate, readinessLabel, readinessScore, optional followUpReason, sourceSurface, submittedAt'],
  ['state-snapshots', 'Signal layer + AI enrichment step', 'Authoritative runtime state', 'rawSignalSummary, stateDimensions, overallReadiness, confidence, enrichedInterpretation, sourcesUsed, sourceEventIds, freshnessState, recommendedRouting, executionLink'],
  ['assignment-candidate-sets', 'Candidate assembler', 'Bounded pool of valid protocol / sim / trial options', 'athleteId, sourceDate, candidateIds, candidateType, constraintReasons, generatedAt'],
  ['pulsecheck-daily-assignments', 'AI planner + policy gate', 'Execution truth for the date', 'sourceCheckInId, sourceStateSnapshotId, sourceCandidateSetId, actionType, status, rationale, readinessBand, readinessScore, createdAt'],
  ['pulsecheck-assignment-events', 'Athlete surfaces and coach actions', 'Lifecycle audit + refresh inputs', 'assignmentId, eventType, actorType, eventAt, metadata'],
  ['conversation-derived-signal-events', 'Nora chat runtime', 'Structured chat-derived state updates only when meaningful', 'conversationId, messageId, inferredDelta, confidence, eventAt, supersedesSnapshotId'],
];

const FLOW_STEPS = [
  {
    title: 'Capture Explicit Check-In',
    body: 'iOS or web Today view submits a structured check-in event instead of writing raw UI state directly into local-only response logic.',
    owner: 'Athlete surface',
  },
  {
    title: 'Build Raw Snapshot',
    body: 'The State Signal Layer reads the new self-report plus fresh context, performance, biometrics, recent conversation signals, and short-horizon assignment history, then writes one raw shared state snapshot with provenance.',
    owner: 'State snapshot builder',
  },
  {
    title: 'AI Enriches The Snapshot',
    body: 'An AI interpretation step verifies contradictions, enriches state dimensions, explains likely drivers, and returns confidence-aware routing posture without bypassing policy rails.',
    owner: 'AI signal interpreter',
  },
  {
    title: 'Assemble The Candidate Set',
    body: 'The runtime gathers the bounded eligible inventory of simulations, protocols, and trials that are actually valid for this athlete, date, and program state.',
    owner: 'Candidate assembler',
  },
  {
    title: 'AI Plans The Next Action',
    body: 'The planner consumes the enriched snapshot, escalation posture, coach constraints, current-day execution state, and bounded candidate set to recommend the next action.',
    owner: 'AI assignment planner',
  },
  {
    title: 'Policy Gate Materializes One Daily Task',
    body: 'A deterministic validator checks the planner output against safety, eligibility, coach freeze rules, and object contracts before writing or refreshing the daily assignment.',
    owner: 'Assignment Orchestrator',
  },
  {
    title: 'Explain the Result',
    body: 'The athlete surface and Nora chat render the same assignment and rationale, so the user sees why the day changed without Nora inventing a second version.',
    owner: 'Athlete surfaces + Nora chat',
  },
  {
    title: 'Feed Outcomes Back In',
    body: 'Viewed, started, completed, deferred, and overridden states become new runtime signals that can refresh the snapshot and tomorrow’s routing posture.',
    owner: 'Execution surfaces',
  },
];

const DECISION_FLOW_COLUMNS = [
  {
    title: 'Signal Intake',
    accentClass: 'border-cyan-500/20 bg-cyan-500/[0.06]',
    labelClass: 'text-cyan-200',
    nodes: [
      {
        eyebrow: 'Athlete action',
        title: 'Tap readiness + optional follow-up',
        body: 'Submit one explicit check-in with source surface, time, readiness score, and structured reason when confidence needs it.',
      },
      {
        eyebrow: 'Persisted object',
        title: '`pulsecheck-check-ins` is written',
        body: 'The tap becomes a durable runtime event instead of a local-only UI state or canned Nora reaction trigger.',
      },
    ],
  },
  {
    title: 'State Interpretation',
    accentClass: 'border-blue-500/20 bg-blue-500/[0.06]',
    labelClass: 'text-blue-200',
    nodes: [
      {
        eyebrow: 'Snapshot builder',
        title: 'Raw snapshot pulls fresh context',
        body: 'Combine the new self-report with recent performance, context, biometrics, and meaningful conversation-derived signals.',
      },
      {
        eyebrow: 'AI enrichment',
        title: 'Derive readiness, confidence, routing, protocol class',
        body: 'The signal layer verifies contradictions, enriches the four state dimensions, then returns overallReadiness, confidence, recommendedRouting, and recommendedProtocolClass.',
      },
    ],
  },
  {
    title: 'Bounded Planning',
    accentClass: 'border-violet-500/20 bg-violet-500/[0.06]',
    labelClass: 'text-violet-200',
    nodes: [
      {
        eyebrow: 'Inventory assembly',
        title: 'Build candidate set from active program + protocols',
        body: 'The planner only sees valid sim and protocol options that match athlete state, program position, and current-day constraints.',
      },
      {
        eyebrow: 'Planner decision',
        title: 'Choose one bounded candidate',
        body: 'AI can rank within the bounded pool, but it cannot invent work outside the registered inventory.',
      },
    ],
  },
  {
    title: 'Execution Truth',
    accentClass: 'border-emerald-500/20 bg-emerald-500/[0.06]',
    labelClass: 'text-emerald-200',
    nodes: [
      {
        eyebrow: 'Policy gate',
        title: 'Validate freezes, safety, and mutability',
        body: 'Coach overrides, started-task locks, safety rails, and eligibility checks determine whether the assignment can be refreshed or must stay frozen.',
      },
      {
        eyebrow: 'Shared artifact',
        title: 'Write one `pulsecheck-daily-assignments` record',
        body: 'Today, Nora chat, and Training all render from the same assignment id, rationale, and status instead of parallel truths.',
      },
    ],
  },
];

const DECISION_BRANCH_ROWS = [
  {
    trigger: 'Confidence is low or signals conflict',
    systemBehavior: 'Reduce routing aggressiveness, optionally ask a lightweight follow-up, and keep the assignment reversible until evidence improves.',
  },
  {
    trigger: 'The task is already started or coach-frozen',
    systemBehavior: 'Store the new signal and refresh the snapshot, but do not silently rewrite execution truth for the same date.',
  },
  {
    trigger: 'A meaningful chat correction lands before start',
    systemBehavior: 'Refresh the snapshot, rerun the bounded planner, and rematerialize the mutable daily assignment with revision lineage.',
  },
];

const DECISION_FEEDBACK_LOOP = [
  'Viewed, started, completed, deferred, overridden, and corrected-in-chat events all feed back into snapshot refresh logic.',
  'The next Nora message and the next surface render should read the refreshed assignment and snapshot ids, not old UI copy.',
  'If Box Breathing appears after check-in, it should now be because the runtime assignment actually resolved to that exercise.',
];

const IOS_ROWS = [
  ['Tap readiness chip', 'Create `pulsecheck-check-ins` event and call orchestrator submit endpoint', 'Do not open chat automatically; return updated snapshot + assignment payload'],
  ['Low / Drained response', 'Optionally ask one lightweight structured follow-up when confidence or routing needs it', 'Examples: mentally tired, emotionally heavy, scattered, poor sleep, pressure'],
  ['Solid / Locked In response', 'Optionally ask a targeting follow-up when useful', 'Examples: sharp rep, pressure rep, assessment, normal work'],
  ['Check-in success state', 'Show assignment-aware Nora copy instead of canned per-emoji copy', 'Copy should explain the routing result in performance language'],
  ['Open chat after check-in', 'Pass assignment id + snapshot id into Nora launch context', 'Nora opens aware of today’s task and rationale'],
];

const CHAT_ROWS = [
  ['Chat opens right after check-in', 'Nora starts from the assignment artifact and latest snapshot, not a generic greeting.'],
  ['Athlete contradicts the tap', 'Nora can submit a structured correction signal and request a snapshot refresh before pushing a high-cost task.'],
  ['Athlete clarifies why they are low', 'That clarification updates dimensions and confidence rather than staying buried in transcript text only.'],
  ['Athlete completes or skips a task', 'Nora reads the latest assignment event and explains the change in plain language.'],
  ['No fresh explicit signal exists', 'Nora should ask a short check-in before making a non-trivial routing move.'],
];

const IDEMPOTENCY_ROWS = [
  ['Same athlete + same date + no started task yet', 'Refresh the existing daily assignment in place and supersede the prior snapshot if needed.'],
  ['Same athlete + same date + task already started', 'Do not rewrite the active task automatically; append the new signal and mark it for next routing opportunity.'],
  ['Coach override or defer exists for the date', 'Coach action freezes the assignment unless a higher-priority safety rule suppresses it.'],
  ['Stale snapshot before red-state routing', 'Require refresh or lightweight confirmation before assigning a heavier recovery or defer path.'],
  ['Conflicting fresh signals', 'Persist a degraded snapshot and reduce routing aggressiveness until the athlete confirms.'],
];

const API_ROWS = [
  ['`submitPulseCheckCheckIn`', 'Athlete surface submits explicit readiness + optional structured follow-up', 'Returns `checkIn`, `stateSnapshot`, `dailyAssignment`, and `presentation` copy payload'],
  ['`enrichPulseCheckStateSnapshot`', 'AI interpreter verifies and enriches the raw snapshot when meaningful new evidence arrives', 'Returns enriched snapshot, confidence posture, and traceable interpretation payload'],
  ['`planPulseCheckAssignment`', 'AI planner chooses from the bounded candidate set after safety and coach constraints are applied', 'Returns structured decision JSON, candidate id, rationale, confidence, and support flags'],
  ['`refreshPulseCheckStateSnapshot`', 'Nora chat or execution events trigger a snapshot rebuild when meaningfully new evidence arrives', 'Returns latest valid snapshot and whether assignment refresh is allowed'],
  ['`recordPulseCheckAssignmentEvent`', 'Today, chat, Training, or coach tools record viewed / started / completed / deferred / overridden events', 'Returns updated assignment status and any follow-up message contract'],
];

const IMPLEMENTATION_STATUS_ROWS = [
  ['Check-in submission', 'Live', 'Web Today and iOS Nora daily check-in both submit through the shared authenticated backend contract.'],
  ['Assignment lifecycle events', 'Live', 'Web viewed / started / completed / deferred / overridden flows and iOS Nora CTA + chat exercise execution now use the shared assignment-event contract.'],
  ['AI-enriched snapshot interpretation', 'Live with fallback', 'The shared check-in path now writes a raw snapshot, then runs an AI enrichment pass that can refine confidence, routing posture, and candidate hints. If AI is unavailable, the deterministic fallback interpretation remains authoritative.'],
  ['Bounded assignment candidate-set builder', 'Live', 'The shared check-in path now materializes a canonical candidate-set object before planning so Nora can only choose from valid bounded options.'],
  ['AI planner over sims + protocols', 'Live with guardrails', 'The shared check-in path now runs an AI planner over the bounded candidate set and validates the result deterministically before writing the assignment.'],
  ['Protocol registry + published inventory', 'Live, still expanding', 'Protocols now live in a sibling Firestore-backed registry that seeds a broader published inventory across breathing, focus, mindset, confidence, and visualization. The planner reads published protocol records instead of an inline array, but the authoring surface still needs to mature.'],
  ['Snapshot refresh from execution events', 'Live, heuristic refresh', 'Started / completed / deferred / overridden assignment events now refresh the current-day snapshot automatically in the shared backend path.'],
  ['Chat-derived correction signals', 'Live with AI + fallback', 'The Nora chat runtime now detects meaningful state corrections, writes `conversation-derived-signal-events`, refreshes the shared snapshot, and gives Nora the refreshed state before she responds.'],
  ['Pre-start assignment re-materialization from chat', 'Live with guardrails', 'If a meaningful chat correction lands before today’s task is started, Nora now re-runs the shared bounded planner and policy gate so the mutable daily assignment can catch up to the refreshed snapshot.'],
  ['Assignment revision lineage', 'Live', 'When Nora materially rematerializes a same-day task, the current assignment now advances its revision and archives the prior mutable version into immutable revision history for coach review.'],
  ['Coach review surface for assignment changes', 'Live', 'Coach assignment cards now expose the current snapshot posture, latest chat-derived correction delta, planner notes, assignment-event timeline, and explicit coach before/after execution-truth diffs for override or defer actions.'],
];

const PHASE_ROWS = [
  ['Phase 1', 'Replace iOS raw readiness write with orchestrated check-in submission and assignment-aware response copy.', 'No more canned one-line Nora reaction as the source of truth.'],
  ['Phase 2', 'Make Nora chat launch from `assignmentId` + `stateSnapshotId` and allow chat-derived correction signals.', 'Shipped. Chat is now state-aware without forcing users into chat.'],
  ['Phase 3', 'Ship the shared assignment-event contract across Today, Nora chat, Mental Training, coach tools, and iOS execution surfaces.', 'This keeps execution truth unified before the AI planner is introduced.'],
  ['Phase 4', 'Add the AI signal interpreter so raw snapshots become enriched snapshots with traceable rationale, contradiction handling, and confidence-aware interpretation.', 'Shipped in the shared check-in path with deterministic fallback when AI is unavailable.'],
  ['Phase 5', 'Build the bounded candidate-set assembler and the AI assignment planner, then run the planner output through deterministic policy validation.', 'Shipped in the shared check-in path. Nora now plans from the bounded inventory instead of only following hard-coded routing.'],
  ['Phase 6', 'Expand the protocol object model and registry beyond the initial breathing set so protocol planning becomes broader than breathing-only state work.', 'Shipped as an initial sibling protocol registry with a broader published inventory. Continued authoring and governance depth are still needed, but the planner is no longer sourcing protocols from a hard-coded breathing-only list.'],
  ['Phase 7', 'Connect assignment and chat events into snapshot refresh and add coach review surfaces for snapshot deltas and planner rationale.', 'Shipped for the core coach assignment surface. Staff now have review visibility into snapshot posture, chat corrections, planner notes, assignment-event history, assignment revision lineage, and coach execution-truth diffs on Nora daily tasks.'],
];

const VALIDATION_ROWS = [
  ['Athlete taps `Locked In` then tells Nora they barely slept', 'Snapshot confidence drops or dimensions shift before high-load routing proceeds.'],
  ['Athlete tells Nora they feel better after calming down', 'A conversation-derived signal can refresh the snapshot upward before Nora keeps pushing a recovery-only posture.'],
  ['Athlete contradicts the day before starting the task', 'If the assignment is still mutable, the shared planner can refresh the actual daily assignment artifact instead of leaving chat and execution truth out of sync.'],
  ['Athlete taps `Drained` and completes a strong regulation rep', 'Completion event can refresh state and support a lighter sim follow-up when rules allow.'],
  ['The planner wants an option that is not in the candidate set', 'The policy gate rejects it and forces a valid bounded choice instead of materializing invented work.'],
  ['The athlete is Yellow and the protocol lane is still thin', 'The system stays honest about limited protocol inventory and should not pretend it has richer protocol choice than the registry actually supports.'],
  ['Athlete re-checks in before starting today’s task', 'Assignment refreshes in place instead of creating duplicates.'],
  ['Athlete re-checks in after coach override', 'New signal is stored, but the coach-frozen assignment remains execution truth for that date.'],
  ['Chat opens with no fresh self-report and stale performance data', 'Nora asks for a brief current-state check before making a non-trivial assignment move.'],
];

const TASK_ROWS = [
  ['Protocol registry authoring surface', 'Add the full admin editing and publishing workflow so protocols are managed with the same operational rigor as the sim variant registry, not only seeded through code.'],
  ['Protocol inventory expansion', 'Keep growing the published regulation / priming / recovery protocol family beyond the initial cross-category starter set.'],
  ['Candidate-set assembler', 'Build the service that returns the bounded eligible sims, protocols, and trials for a given athlete/date/program state.'],
  ['AI snapshot enrichment contract', 'Define the structured input/output for the AI signal interpreter, including contradiction handling, confidence, and provenance.'],
  ['AI assignment planner contract', 'Define the structured planner response JSON and the validator that enforces candidate-set, safety, and coach-lock compliance.'],
  ['Planner-aware Nora presentation', 'Make the returned assignment rationale and follow-up copy reflect planner reasoning without exposing raw chain-of-thought or private transcript details.'],
];

const PulseCheckCheckInSignalLayerIntegrationSpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Runtime"
        title="Check-In ↔ AI Signal Layer Integration Spec"
        version="Version 2.0 | March 17, 2026"
        summary="Implementation-spec artifact for turning the athlete readiness check-in into an AI-native runtime signal. This page defines how explicit self-report, raw and enriched state snapshots, bounded assignment candidate sets, Nora daily assignments, chat context, and assignment lifecycle events should connect so the athlete sees one coherent system instead of separate UI tricks."
        highlights={[
          {
            title: 'Check-In Becomes A Real Runtime Event',
            body: 'The readiness tap is promoted from local UI state to a structured signal that can drive state estimation and assignment materialization.',
          },
          {
            title: 'AI Enriches The Signal Layer',
            body: 'Raw signals should be verified, fleshed out, and enriched by AI before Nora plans the next action.',
          },
          {
            title: 'Nora Plans Within Bounds',
            body: 'The assignment planner should choose from the registered simulations and protocols the system already knows how to deliver, not invent new work at runtime.',
          },
          {
            title: 'Nora Reads Execution Truth',
            body: 'Chat should open aware of the current assignment and state snapshot rather than inventing a fresh interpretation from scratch.',
          },
          {
            title: 'Execution Feeds State Back',
            body: 'Viewed, started, completed, skipped, and overridden assignment states all become valid downstream signals for the next snapshot refresh.',
          },
          {
            title: 'No Parallel Truths',
            body: 'Athlete surfaces, Nora chat, coach review, and escalation all reference the same snapshot and daily assignment ids.',
          },
        ]}
      />

        <RuntimeAlignmentPanel
        role="Integration-layer implementation artifact for binding athlete check-in UX, AI-enriched State Signal Layer outputs, Nora assignment materialization, and assignment lifecycle events into one runtime contract."
        sourceOfTruth="This document is authoritative for the integration seam between explicit check-in input, shared state snapshots, bounded candidate-set assembly, Nora launch context, and the daily assignment execution artifact. It is not the source of truth for state-schema definitions, escalation policy, or sim-family logic themselves."
        masterReference="Use Runtime Architecture for the top-level system order, State Signal Layer for snapshot schema, Snapshot Freshness Policy for recency rules, and Nora Assignment Rules for planner behavior. Use this page when implementing how those systems hand off data between athlete surfaces and Nora."
        relatedDocs={[
          'Runtime Architecture v1.0',
          'State Signal Layer v1.4',
          'State Snapshot Freshness & Decay Policy v1.0',
          'Nora Assignment Rules v1.3',
          'Escalation Integration Spec v1.1',
        ]}
      />

      <SectionBlock icon={Brain} title="Integration Design Goals">
        <DataTable columns={['Goal', 'Meaning']} rows={DESIGN_GOAL_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Runtime Contract Objects">
        <InfoCard
          title="Canonical Object Rule"
          accent="blue"
          body="The readiness tap, current-state snapshot, and daily Nora task should each have their own durable object. The UI should render from those objects instead of deriving truth from local animation state."
        />
        <DataTable columns={['Object', 'Primary Writer', 'Purpose', 'Minimum Fields']} rows={CONTRACT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ArrowLeftRight} title="End-to-End Runtime Flow">
        <StepRail steps={FLOW_STEPS} />
      </SectionBlock>

      <SectionBlock icon={Route} title="Decision Flow Chart">
        <div className="space-y-4 rounded-3xl border border-zinc-800 bg-[#090f1c] p-5">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
            {DECISION_FLOW_COLUMNS.map((column, columnIndex) => (
              <div key={column.title} className="relative">
                {columnIndex < DECISION_FLOW_COLUMNS.length - 1 ? (
                  <div className="pointer-events-none absolute -right-3 top-10 hidden h-px w-6 bg-zinc-700 xl:block" />
                ) : null}
                <div className={`rounded-2xl border p-4 ${column.accentClass}`}>
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${column.labelClass}`}>{column.title}</p>
                  <div className="mt-4 space-y-3">
                    {column.nodes.map((node, nodeIndex) => (
                      <div key={node.title} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{node.eyebrow}</p>
                        <p className="mt-2 text-sm font-semibold text-white">{node.title}</p>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-300">{node.body}</p>
                        {nodeIndex < column.nodes.length - 1 ? (
                          <div className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                            <span className="h-px flex-1 bg-zinc-700" />
                            Continue
                            <span className="h-px flex-1 bg-zinc-700" />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <CardGrid columns="md:grid-cols-2">
            {DECISION_BRANCH_ROWS.map((row) => (
              <InfoCard
                key={row.trigger}
                title={row.trigger}
                accent="amber"
                body={row.systemBehavior}
              />
            ))}
          </CardGrid>

          <InfoCard
            title="Feedback Loop"
            accent="green"
            body={<BulletList items={DECISION_FEEDBACK_LOOP} />}
          />
        </div>
      </SectionBlock>

      <SectionBlock icon={Smartphone} title="Athlete Surface Behavior">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="What Changes On iOS"
            body={
              <BulletList
                items={[
                  'Replace local-only canned Nora response logic with orchestrated submit-and-render behavior.',
                  'Keep the fast five-option check-in for speed; use lightweight follow-up prompts only when confidence or routing needs them.',
                  'Do not force chat open as a side effect of tapping readiness.',
                  'Render Nora explanation from the returned assignment rationale and presentation payload.',
                ]}
              />
            }
          />
          <InfoCard
            title="What Stays Fast"
            accent="green"
            body="The user still gets a single-tap morning action. The sophistication moves into the runtime contract and returned assignment state, not into a slower or more complicated front-end interaction."
          />
        </CardGrid>
        <DataTable columns={['Surface Moment', 'Required Behavior', 'Implementation Note']} rows={IOS_ROWS} />
      </SectionBlock>

      <SectionBlock icon={MessageSquareQuote} title="Bidirectional Nora Chat Rules">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Nora Should Read First"
            body="When chat launches after check-in, Nora should receive the `assignmentId`, `stateSnapshotId`, freshness state, and assignment rationale so the first message is grounded in runtime truth."
          />
          <InfoCard
            title="Nora Can Refine, Not Fork"
            accent="amber"
            body="If the athlete says something that materially contradicts the check-in, Nora should write a structured correction signal and request a snapshot refresh. Nora should not create a private alternate state model inside transcript text alone."
          />
        </CardGrid>
        <DataTable columns={['Scenario', 'Required Nora Behavior']} rows={CHAT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Route} title="Idempotency, Freshness, and Freeze Rules">
        <DataTable columns={['Scenario', 'Required System Behavior']} rows={IDEMPOTENCY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ClipboardList} title="API / Orchestrator Contract">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Response Contract"
            accent="blue"
            body={
              <BulletList
                items={[
                  'Return the persisted check-in object id so assignments can trace back to explicit athlete input.',
                  'Return the latest raw and enriched snapshot ids plus freshness/confidence fields.',
                  'Return the bounded candidate-set id when assignment planning occurs so the decision is replayable and auditable.',
                  'Return the current daily assignment id and status so Today, Nora chat, and Training can stay aligned.',
                  'Return athlete-facing presentation copy as a rendering convenience, not as the source of truth.',
                ]}
              />
            }
          />
          <InfoCard
            title="Compatibility Rule"
            accent="green"
            body="If legacy iOS or reporting code still expects `athlete-mental-progress/{athleteId}/check-ins`, the orchestrator may mirror writes temporarily, but runtime consumers should migrate to the canonical objects above."
          />
        </CardGrid>
        <DataTable columns={['Operation', 'Purpose', 'Expected Result']} rows={API_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Current Runtime Status">
        <InfoCard
          title="Drift Resolution Rule"
          accent="amber"
          body="This spec remains target-state, but the rows below call out the parts of the contract that are already live versus the parts still staged. If implementation diverges from the target contract, the handbook should say whether that drift is intentional, transitional, or a bug."
        />
        <DataTable columns={['Capability', 'Status', 'Current Reality']} rows={IMPLEMENTATION_STATUS_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ClipboardList} title="Required Build Tasks">
        <InfoCard
          title="Current Gap To Name Explicitly"
          accent="amber"
          body="The planner architecture now has a real bounded breathing-protocol inventory, but the protocol lane is still immature. Protocol expansion remains a first-class build task because the current set is still narrow and breathing-heavy."
        />
        <DataTable columns={['Task', 'What Must Be Delivered']} rows={TASK_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Implementation Phasing">
        <DataTable columns={['Phase', 'Scope', 'Why It Matters']} rows={PHASE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={TestTube2} title="Validation Scenarios">
        <InfoCard
          title="Pilot Acceptance Rule"
          accent="red"
          body="The system is not ready if iOS, web Today, Nora chat, and Mental Training can show different ideas of the athlete’s current task on the same date. Shared ids and shared refresh rules are the pass/fail line."
        />
        <DataTable columns={['Scenario', 'Expected Outcome']} rows={VALIDATION_ROWS} />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckCheckInSignalLayerIntegrationSpecTab;
