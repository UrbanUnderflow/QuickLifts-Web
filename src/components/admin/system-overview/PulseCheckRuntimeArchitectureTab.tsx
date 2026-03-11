import React from 'react';
import { Activity, AlertTriangle, ArrowRightLeft, Clock3, Cpu, GitBranch, ShieldAlert, Users } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const SOURCE_OF_TRUTH = [
  ['Hard safety policy', 'Admin escalation conditions and explicit safety language govern clinical action.', 'Safety response always wins over a benign state or training goal.'],
  ['Lane orchestration', 'State & Escalation Orchestration governs lane boundaries and override behavior.', 'Use when performance, support, and safety logic intersect.'],
  ['Shared perception', 'State Signal Layer defines the state snapshot schema and routing vocabulary.', 'Downstream systems consume one shared state view.'],
  ['Performance routing', 'Nora Assignment Rules govern Protocol, Sim, Trial, and defer decisions.', 'Applies only after safety and lane boundaries are resolved.'],
  ['Safety integration', 'Escalation Integration Spec governs the bridge into classify-escalation and write-back.', 'Use for payload shape and runtime field updates.'],
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
    body: 'Nora decides whether the athlete needs a Protocol, Sim, Trial, mixed sequence, or defer path based on state-fit and program intent.',
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
    body: 'Nora applies safety overrides first, then decides whether performance should continue as Protocol, Sim, Trial, mixed sequence, or defer.',
    owner: 'Nora Assignment Rules',
  },
  {
    title: 'Session Execution',
    body: 'The runtime executes the assigned protocol, sim, trial, or alternate path with the appropriate difficulty, modifier, and framing.',
    owner: 'Runtime / App',
  },
  {
    title: 'Outcome Update',
    body: 'Performance results, state changes, support flags, and escalation outcomes are written back for the next decision cycle.',
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
  ['Stale escalation behavior', 'If the latest snapshot is stale, classify-escalation may read it as context but cannot increase confidence because of it.'],
];

const PulseCheckRuntimeArchitectureTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Runtime"
        title="Runtime Architecture"
        version="Version 1.0 | March 10, 2026"
        summary="Top-level operating model for the perception-to-action stack. This artifact explains how the State Signal Layer, Nora Assignment Rules, State & Escalation Orchestration, and the Escalation Integration Spec work together without collapsing performance and safety into one system."
        highlights={[
          {
            title: 'Shared Perception, Separate Lanes',
            body: 'One state snapshot feeds the runtime, but performance, support, and safety each keep their own job and override rules.',
          },
          {
            title: 'Explicit Source-of-Truth Order',
            body: 'Hard safety policy outranks orchestration, which outranks schema, which outranks performance routing, which outranks implementation details.',
          },
          {
            title: 'Pilot-Ready Operations Layer',
            body: 'Freshness windows, persistent-red behavior, implementation phases, and QA edge cases are all defined in one artifact.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Master operating-model artifact for the perception-to-action runtime stack. Use this page to understand how the detailed runtime docs fit together, where each one governs, and how implementation sequencing should work across product, engineering, and operations."
        sourceOfTruth="This document is authoritative for system-level ordering, runtime sequencing, and cross-document precedence. It does not replace the detailed runtime artifacts inside their own scopes."
        masterReference="Use this page first when a reader needs the top-level map, conflict-resolution order, or phased rollout plan. Then drill into the governing document for the specific layer."
        relatedDocs={[
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

export default PulseCheckRuntimeArchitectureTab;
