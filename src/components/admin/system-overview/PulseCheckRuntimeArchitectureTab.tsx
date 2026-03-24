import React from 'react';
import { Activity, AlertTriangle, ArrowRightLeft, Clock3, Cpu, GitBranch, ShieldAlert, Users, FileText, Radar, ClipboardCheck, TimerReset, Flag, Bot, TestTube2, Waypoints, ShieldCheck, Layers, BookOpen } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';
import ArtifactPageLibrary, { ArtifactPageEntry } from './ArtifactPageLibrary';
import PulseCheckStateSignalLayerTab from './PulseCheckStateSignalLayerTab';
import PulseCheckCheckInSignalLayerIntegrationSpecTab from './PulseCheckCheckInSignalLayerIntegrationSpecTab';
import PulseCheckDailyTaskTrainingPlanAlignmentSpecTab from './PulseCheckDailyTaskTrainingPlanAlignmentSpecTab';
import PulseCheckTrainingPlanAuthoringSpecTab from './PulseCheckTrainingPlanAuthoringSpecTab';
import PulseCheckStateSnapshotFreshnessPolicyTab from './PulseCheckStateSnapshotFreshnessPolicyTab';
import PulseCheckPerformanceStateFlagDefinitionsTab from './PulseCheckPerformanceStateFlagDefinitionsTab';
import PulseCheckNoraAssignmentRulesTab from './PulseCheckNoraAssignmentRulesTab';
import PulseCheckNoraQaEdgeCaseScenarioMatrixTab from './PulseCheckNoraQaEdgeCaseScenarioMatrixTab';
import PulseCheckStateEscalationOrchestrationTab from './PulseCheckStateEscalationOrchestrationTab';
import PulseCheckEscalationIntegrationSpecTab from './PulseCheckEscalationIntegrationSpecTab';

const SOURCE_OF_TRUTH = [
  ['1. Hard safety policy', 'Admin escalation conditions and explicit safety language govern clinical action.', 'Safety always wins, even over a strong state-based training idea.'],
  ['2. Current state and readiness', 'State Signal Layer defines the current snapshot, freshness, confidence, and routing vocabulary.', 'Use the latest valid data first; stale goal/context never outranks it.'],
  ['3. Training need and lane boundaries', 'State & Escalation Orchestration and Nora Assignment Rules govern whether the athlete should regulate, prime, recover, train, assess, or defer.', 'Use when deciding the next usable performance action from the current state.'],
  ['4. Goal / context', 'Athlete goal, season timing, competition timing, and broader program intent.', 'Secondary guidance only; it can shape framing, not outrank the data-driven decision.'],
  ['5. Execution truth', 'Signal Layer v1 Assignment Orchestrator writes one Nora daily assignment after check-in and profile sync, then exposes it for athlete surfaces, chat, and coach review.', 'Use this as the task source instead of copy-only next-step hints.'],
  ['6. Safety integration', 'Escalation Integration Spec governs the bridge into classify-escalation and write-back.', 'Use for payload shape and runtime field updates.'],
];

const RUNTIME_LAYERS = [
  {
    title: 'Perception Layer',
    accent: 'blue' as const,
    body: 'Collect self-report, context, recent performance, sentiment, and biometrics. Emit a shared state snapshot with confidence, readiness, and flags.',
  },
  {
    title: 'Performance Lane',
    accent: 'green' as const,
    body: 'Nora decides whether the athlete needs a Protocol, Sim, Trial, mixed sequence, or defer path based on state-fit and training need. Athlete goal and broader context can shape the explanation, but they never outrank the current state that drives the routing decision. Signal Layer v1 then materializes the athlete-facing daily assignment from that decision and opens the coach intervention window.',
  },
  {
    title: 'Support Lane',
    accent: 'amber' as const,
    body: 'Persistent-red and repeated instability create staff visibility, lighter programming, and human follow-up without forcing clinical escalation.',
  },
  {
    title: 'Safety Lane',
    accent: 'red' as const,
    body: 'Escalation classifies risk, triggers coach or clinical response, and suppresses normal training flow at Tier 2 or Tier 3.',
  },
];

const FLOW_STEPS = [
  {
    title: 'Athlete Entry Gate',
    body: 'Before standard performance assignment begins, PulseCheck should confirm the athlete has cleared the required task gate: consent is complete, the in-app baseline is complete, and any optional Vision Pro session remains explicitly non-blocking. Shared gate resolution accepts either web baselineAssessment or native baselineProbe, then synchronizes membership task state.',
    owner: 'Onboarding shell / workspace',
  },
  {
    title: 'Signal Intake',
    body: 'The Check-In and state builder collect structured self-report, context windows, recent performance, sentiment, and biometrics when available.',
    owner: 'Check-In / State Builder',
  },
  {
    title: 'State Inference',
    body: 'The State Signal Layer estimates Activation, Focus Readiness, Emotional Load, and Cognitive Fatigue, then derives readiness and confidence.',
    owner: 'State Signal Layer',
  },
  {
    title: 'Safety Check',
    body: 'The escalation classifier evaluates explicit safety language and admin conditions using the latest valid state snapshot as context only.',
    owner: 'Escalation Classifier',
  },
  {
    title: 'Routing Decision',
    body: 'Nora applies safety overrides first, then resolves current state/readiness, then training need, and only then uses athlete goal and broader context as a secondary bias when deciding whether performance should continue as Protocol, Sim, Trial, mixed sequence, or defer.',
    owner: 'Nora Assignment Rules',
  },
  {
    title: 'Assignment Materialization',
    body: 'After the routing decision resolves, the Assignment Orchestrator writes one Nora daily assignment for that athlete and date, preserves idempotency for repeat same-day check-ins, triggers coach notification, preserves coach override state for that day, and gives athlete surfaces plus Nora chat one shared execution artifact. The coach notification center becomes the durable read/archive layer for that follow-up.',
    owner: 'Assignment Orchestrator',
  },
  {
    title: 'Session Execution',
    body: 'Today view and Nora chat can launch the same Nora task into the runtime. Launch moves the task into started state, the runtime executes the assigned protocol, sim, trial, or alternate path with the appropriate difficulty, modifier, and framing, and completion closes the loop on that same task.',
    owner: 'Runtime / App',
  },
  {
    title: 'Outcome Update',
    body: 'Performance results, state changes, support flags, and escalation outcomes are written back for the next decision cycle. Completion also writes an athlete-readable session summary, a coach-readable next-program update, and an optional Nora follow-up moment so the loop does not end as a silent database change. That update also feeds the coach notification center so the coach can see what changed and open the right surface immediately.',
    owner: 'Runtime + Escalation Handler',
  },
];

const FRESHNESS_ROWS = [
  ['Explicit self-report', 'Immediate / latest entry wins', 'Strong explicit athlete input should override weak inference.'],
  ['Recent performance', 'About 4 hours', 'Use for acute readiness and instability, not long-term skill interpretation.'],
  ['Context', 'About 24 hours', 'Practice, game timing, injury phase, travel, and trial windows decay more slowly.'],
  ['Conversation sentiment', 'Same-day default', 'Useful support signal, never the sole trigger for a safety action.'],
  ['Biometrics', 'Use source freshness', 'Best used as confidence enrichment when data is near real-time.'],
];

const QA_EDGE_CASES = [
  'Athlete self-reports "locked in" while recent performance flags show acute instability.',
  'A Trial is scheduled but readiness is Red at the exact assignment moment.',
  'Coach or staff locks a specific assignment while the safety lane says pause or defer.',
  'Tier 1 escalation appears alongside Green readiness and stable performance.',
  'Persistent red appears for several sessions without explicit safety language.',
  'State inference is low-confidence or conflicting across self-report, sentiment, and performance.',
  'Snapshot is stale at assignment time or sentiment / biometric channels are missing.',
  'Protocol responsiveness remains low across repeated Reset-first interventions.',
];

const FAMILY_FLAG_ROWS = [
  ['Reset', 'False-start spike or unstable re-engagement after disruption', 'Flag when current-session false starts are at least 2x rolling baseline or at least 20% of rounds.'],
  ['Noise Gate', 'Distractor-cost spike under normal distractor load', 'Flag when distractor-cost latency rises 20%+ above baseline or accuracy drops 10+ points versus rolling norm.'],
  ['Brake Point', 'Stop-failure spike or unusual prepotent-response leakage', 'Flag when commission errors are at least 1.75x baseline or no-go accuracy falls below 85% in a valid session.'],
  ['Signal Window', 'Correct-read drop or decoy-error spike', 'Flag when correct-read accuracy drops 12+ points from baseline or decoy errors rise 1.5x above norm.'],
  ['Sequence Shift', 'Old-rule intrusion or delayed post-switch stabilization', 'Flag when perseveration errors are at least 1.75x baseline or post-switch latency rises 25%+ versus norm.'],
  ['Endurance Lock', 'Early degradation onset', 'Flag when meaningful decline starts in the first 40% of the session or 25% earlier than the athlete baseline onset point.'],
];

const PILOT_DEFAULT_ROWS = [
  ['Persistent red activation', 'Support flag turns on after 3 consecutive red snapshots or 4 red snapshots within the 7 most recent state-bearing sessions.'],
  ['Support-flag clear rule', 'Clear after 2 consecutive non-red snapshots and no active Tier 1-3 escalation state.'],
  ['Stale assignment behavior', 'If the latest snapshot is stale, Nora should request a brief check-in before non-trivial Protocol, Sim, or Trial assignment.'],
  ['Daily auto-assignment behavior', 'Signal Layer v1 writes one Nora daily assignment per athlete per date. Repeat check-ins may update an unstarted assignment, but should not overwrite started, completed, or coach-overridden work.'],
  ['Daily task lifecycle behavior', 'Athlete surfaces should move the same Nora task through viewed, started, and completed states rather than spawning disconnected next-step affordances.'],
  ['Coach intervention behavior', 'New Nora daily assignments notify the coach immediately. Coach defer and override decisions become the source of truth for the rest of that date unless safety policy says otherwise.'],
  ['Coach follow-up behavior', 'Coach notifications should accumulate into one readable follow-up queue with unread count, read state, archive state, and direct links into assignment review or athlete follow-up surfaces.'],
  ['Stale escalation behavior', 'If the latest snapshot is stale, classify-escalation may read it as context but cannot increase confidence because of it.'],
  ['Pre-training unlock behavior', 'Standard coach or Nora sim assignment should stay locked until consent and the in-app baseline are complete. Optional Vision Pro sessions do not block unlock unless the rollout explicitly says otherwise. Shared completion truth can come from web baselineAssessment or native baselineProbe.'],
];

const RuntimeArchitectureOverviewDoc: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Runtime"
        title="Runtime Architecture"
        version="Version 1.3 | March 16, 2026"
        summary="Top-level operating model for the perception-to-action stack. This artifact explains how the athlete entry gate, State Signal Layer, Nora Assignment Rules, the Signal Layer v1 Assignment Orchestrator, coach intervention, State & Escalation Orchestration, and the Escalation Integration Spec work together without collapsing onboarding, performance, and safety into one system."
        highlights={[
          {
            title: 'Shared Perception, Separate Lanes',
            body: 'One state snapshot feeds the runtime, but performance, support, and safety each keep their own job and override rules.',
          },
          {
            title: 'Explicit Source-of-Truth Order',
            body: 'Safety outranks current state and readiness, current state outranks training need, and training need outranks goal/context. Goal/context can shape framing, but it never outranks the data.',
          },
          {
            title: 'Pilot-Ready Operations Layer',
            body: 'Freshness windows, persistent-red behavior, implementation phases, and QA edge cases are all defined in one artifact.',
          },
          {
            title: 'Entry Gate Before Runtime',
            body: 'Required onboarding tasks clear before standard training assignment begins, while optional Vision Pro transfer remains a separate lane.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Master operating-model artifact for the perception-to-action runtime stack. Use this page to understand how the detailed runtime docs fit together, where each one governs, and how implementation sequencing should work across product, engineering, and operations."
        sourceOfTruth="This document is authoritative for system-level ordering, runtime sequencing, and cross-document precedence. It does not replace the detailed runtime artifacts inside their own scopes."
        masterReference="Use this page first when a reader needs the top-level map, conflict-resolution order, or phased rollout plan. Then drill into the governing document for the specific layer."
        relatedDocs={[
          'Profile Architecture v1.3',
          'Profile Snapshot & Export Spec v1.0',
          'State Signal Layer v1.2',
          'State Snapshot Freshness & Decay Policy v1.0',
          'Performance-State Flag Definitions v1.0',
          'Nora Assignment Rules v1.1',
          'Nora QA / Edge-Case Scenario Matrix v1.0',
          'State & Escalation Orchestration v1.2',
          'Escalation Integration Spec v1.1',
        ]}
      />

      <SectionBlock icon={GitBranch} title="Source-of-Truth Order">
        <DataTable columns={['Layer', 'Authority', 'How to Use It']} rows={SOURCE_OF_TRUTH} />
      </SectionBlock>

      <SectionBlock icon={Cpu} title="System Layers">
        <CardGrid columns="md:grid-cols-2 xl:grid-cols-4">
          {RUNTIME_LAYERS.map((layer) => (
            <InfoCard key={layer.title} title={layer.title} body={layer.body} accent={layer.accent} />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Activity} title="End-to-End Runtime Flow">
        <StepRail steps={FLOW_STEPS} />
      </SectionBlock>

      <SectionBlock icon={ArrowRightLeft} title="Override Hierarchy">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="What Overrides First"
            accent="red"
            body={
              <BulletList
                items={[
                  'Tier 2 and Tier 3 escalation outcomes suppress normal training assignment.',
                  'Admin-defined hard safety conditions outrank a benign, stale, or low-confidence state snapshot.',
                  'Current state and readiness outrank longer-lived goal context when the two point in different directions.',
                  'Training need can shape the task only after safety and current state say the athlete is fit to train.',
                  'Persistent red changes support visibility and programming aggressiveness even when it does not trigger clinical escalation.',
                  'Coach locks can narrow options, but they still must respect safety overrides.',
                ]}
              />
            }
          />
          <InfoCard
            title="Why This Matters"
            accent="blue"
            body="The runtime should never let a polished training recommendation hide a safety obligation. The system decides whether the athlete is safe to train before it decides how to train."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Clock3} title="Snapshot Freshness and Decay Policy">
        <DataTable columns={['Signal Type', 'Recommended Window', 'Notes']} rows={FRESHNESS_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Users} title="Persistent-Red Support Pathway">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard title="Trigger" accent="amber" body="Flag persistent red after 3 consecutive red snapshots or 4 red snapshots within the latest 7 state-bearing sessions." />
          <InfoCard title="Primary Response" accent="green" body="Raise staff visibility, reduce programming aggressiveness, increase check-in attention, and recommend human follow-up." />
          <InfoCard title="Boundary" accent="red" body="If persistent red combines with explicit safety language or elevated-risk conditions, the safety lane takes over immediately." />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Pilot Defaults Locked for Initial Rollout">
        <DataTable columns={['Policy', 'Operating Default']} rows={PILOT_DEFAULT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={GitBranch} title="Family-Level Performance-State Flags">
        <DataTable columns={['Family', 'State Signal Pattern', 'Pilot Operating Threshold']} rows={FAMILY_FLAG_ROWS} />
      </SectionBlock>

      <SectionBlock icon={GitBranch} title="Detailed Companion Artifacts">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard title="Snapshot Freshness & Decay Policy" body="Holds the full shared recency, validity, and degraded-snapshot rules that this page summarizes at the runtime level." />
          <InfoCard title="Performance-State Flag Definitions" body="Holds the family-level interpretation rules for acute sim telemetry that this page summarizes as pilot operating thresholds." />
          <InfoCard title="Nora QA / Edge-Case Scenario Matrix" body="Turns the runtime edge-case list into a concrete pre-pilot testing artifact with expected behaviors and owners." />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ShieldAlert} title="Edge-Case QA Coverage">
        <CardGrid columns="md:grid-cols-2 xl:grid-cols-3">
          {QA_EDGE_CASES.map((item) => (
            <InfoCard key={item} title="QA Scenario" body={item} />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Implementation Roadmap">
        <DataTable
          columns={['Phase', 'Scope', 'Primary Documents']}
          rows={[
            ['Phase 1', 'Persist state snapshots from self-report, context, and recent performance. Let Nora route with them.', 'State Signal Layer, Nora Assignment Rules'],
            ['Phase 2', 'Pass snapshots into escalation as structured context only and surface readiness to staff.', 'State Signal Layer, Escalation Integration Spec, Orchestration'],
            ['Phase 3', 'Enable persistent-red support flags and reduced programming aggressiveness.', 'Orchestration, Nora Assignment Rules, Dashboards'],
            ['Phase 4', 'Add conversation sentiment and biometrics to strengthen confidence and interpretation.', 'State Signal Layer, Escalation Integration Spec, Analytics'],
            ['Phase 5', 'Tune freshness, thresholds, and routing rules from pilot learnings.', 'All runtime artifacts'],
          ]}
        />
      </SectionBlock>
    </div>
  );
};

const RUNTIME_STACK_PAGES: ArtifactPageEntry[] = [
  {
    id: 'runtime-overview',
    label: 'Runtime Overview',
    subtitle: 'Top-level map for perception, routing, execution, and escalation.',
    icon: FileText,
    accent: '#c084fc',
    render: () => <RuntimeArchitectureOverviewDoc />,
  },
  {
    id: 'state-signal-layer',
    label: 'State Signal Layer',
    subtitle: 'Operational state inference, confidence, freshness, and outputs.',
    icon: Radar,
    accent: '#38bdf8',
    render: () => <PulseCheckStateSignalLayerTab />,
  },
  {
    id: 'checkin-integration',
    label: 'Check-In Integration Spec',
    subtitle: 'Contract between readiness check-in, snapshots, bounded candidates, and Nora.',
    icon: ClipboardCheck,
    accent: '#22c55e',
    render: () => <PulseCheckCheckInSignalLayerIntegrationSpecTab />,
  },
  {
    id: 'daily-task-training-plan-alignment',
    label: 'Daily Task + Training Plan Alignment',
    subtitle: 'Surface-coherence contract for DailyTask, TrainingPlan, lifecycle, and event truth.',
    icon: Layers,
    accent: '#8b5cf6',
    render: () => <PulseCheckDailyTaskTrainingPlanAlignmentSpecTab />,
  },
  {
    id: 'training-plan-authoring',
    label: 'Training Plan Authoring Spec',
    subtitle: 'How Nora authors longer-horizon blocks, archetypes, and step sequences.',
    icon: BookOpen,
    accent: '#38bdf8',
    render: () => <PulseCheckTrainingPlanAuthoringSpecTab />,
  },
  {
    id: 'freshness-policy',
    label: 'Snapshot Freshness Policy',
    subtitle: 'Recency, validity, and decay rules for runtime snapshot use.',
    icon: TimerReset,
    accent: '#f59e0b',
    render: () => <PulseCheckStateSnapshotFreshnessPolicyTab />,
  },
  {
    id: 'performance-flags',
    label: 'Performance-State Flags',
    subtitle: 'Family-level definitions for translating acute sim behavior into state evidence.',
    icon: Flag,
    accent: '#14b8a6',
    render: () => <PulseCheckPerformanceStateFlagDefinitionsTab />,
  },
  {
    id: 'assignment-rules',
    label: 'Nora Assignment Rules',
    subtitle: 'Decision rules for Protocol, Sim, Trial, defer, and safety-aware assignment.',
    icon: Bot,
    accent: '#ef4444',
    render: () => <PulseCheckNoraAssignmentRulesTab />,
  },
  {
    id: 'qa-matrix',
    label: 'Nora QA Matrix',
    subtitle: 'Conflict, override, and edge-case testing for runtime behavior.',
    icon: TestTube2,
    accent: '#eab308',
    render: () => <PulseCheckNoraQaEdgeCaseScenarioMatrixTab />,
  },
  {
    id: 'state-escalation-orchestration',
    label: 'State & Escalation Orchestration',
    subtitle: 'Shared perception with separate performance, support, and safety lanes.',
    icon: Waypoints,
    accent: '#06b6d4',
    render: () => <PulseCheckStateEscalationOrchestrationTab />,
  },
  {
    id: 'escalation-integration',
    label: 'Escalation Integration Spec',
    subtitle: 'Execution-layer bridge between state snapshots and escalation workflow.',
    icon: ShieldCheck,
    accent: '#fb7185',
    render: () => <PulseCheckEscalationIntegrationSpecTab />,
  },
];

const PulseCheckRuntimeArchitectureTab: React.FC = () => {
  return (
    <ArtifactPageLibrary
      eyebrow="Pulse Check · Runtime Stack"
      title="Runtime Stack Library"
      summary="Operating parent artifact with internal pages for state logic, check-in contracts, assignment policy, escalation routing, freshness posture, and QA coverage."
      entries={RUNTIME_STACK_PAGES}
    />
  );
};

export default PulseCheckRuntimeArchitectureTab;
