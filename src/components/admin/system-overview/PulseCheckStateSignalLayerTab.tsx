import React from 'react';
import { Activity, BarChart3, Brain, Gauge, Layers3, Radar, Route, ShieldCheck } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const SIGNAL_ROWS = [
  ['Self-report', 'Direct athlete description of current state.', 'Anxious, scattered, flat, frustrated, mentally tired, locked in', 'Phase 1'],
  ['Conversation sentiment', 'Emotional tone inferred from athlete language.', 'Rising frustration, nervous tone, low-confidence language', 'Phase 2'],
  ['Biometrics', 'Physiological context when available.', 'Heart rate, HRV, sleep, breathing rate', 'Phase 2'],
  ['Performance', 'Behavioral evidence that state may be degrading the rep.', 'False starts, volatility, acute dip, widening variance', 'Phase 1'],
  ['Context', 'Situational information that changes what good routing looks like.', 'Pre-game, post-trial, travel, high-stakes week', 'Phase 1'],
];

const DIMENSIONS = [
  {
    title: 'Activation',
    accent: 'red' as const,
    body: 'Is the athlete overactivated, underactivated, or in a workable range? Elevated, calm, and flat sit on this dimension.',
  },
  {
    title: 'Focus Readiness',
    accent: 'blue' as const,
    body: 'Is attention scattered or ready to narrow on the next rep? This is about whether the athlete can lock onto the task now.',
  },
  {
    title: 'Emotional Load',
    accent: 'amber' as const,
    body: 'Is frustration, anxiety, or emotional spillover likely to interfere with the next rep?',
  },
  {
    title: 'Cognitive Fatigue',
    accent: 'green' as const,
    body: 'Is the athlete cognitively fresh enough to benefit from training or assessment?',
  },
];

const PIPELINE = [
  {
    title: 'Collect Available Inputs',
    body: 'Use self-report, conversation sentiment, biometrics, performance, and context whenever they are available.',
  },
  {
    title: 'Normalize into Comparable Signals',
    body: 'Convert each source into a common state-signal format that can be weighted and compared consistently.',
  },
  {
    title: 'Weight by Recency and Confidence',
    body: 'Strong, recent signals count more; sparse, stale, or contradictory signals reduce confidence.',
  },
  {
    title: 'Estimate the Four Dimensions',
    body: 'Infer current Activation, Focus Readiness, Emotional Load, and Cognitive Fatigue without drifting into diagnosis.',
  },
  {
    title: 'Derive Readiness and Routing Hints',
    body: 'Create the Green / Yellow / Red readiness output, confidence band, protocol class hint, and routing recommendation.',
  },
  {
    title: 'Persist a Shared State Snapshot',
    body: 'Store one authoritative state snapshot so Nora, coach tools, and escalation all consume the same runtime context, then let the execution layer materialize the daily task from it.',
  },
];

const PATTERN_ROWS = [
  ['Acute instability', 'Sudden widening variance versus rolling baseline', 'Elevated state or poor readiness today'],
  ['False-start spike', 'Unusually high premature responses', 'Overactivation, impatience, or instability'],
  ['Early degradation onset', 'Performance breakdown starts earlier than normal', 'Cognitive fatigue or low readiness'],
  ['Cross-family dip', 'Multiple families are off on the same day', 'State issue more than a family-specific skill weakness'],
  ['Modifier sensitivity spike', 'Atypical drop under evaluative threat or pressure modifiers', 'Emotional load or pressure sensitivity today'],
];

const SNAPSHOT_ROWS = [
  ['stateDimensions', 'Activation, Focus Readiness, Emotional Load, Cognitive Fatigue'],
  ['overallReadiness', 'Derived Green / Yellow / Red output used for routing'],
  ['confidence', 'High / Medium / Low confidence in the current estimate'],
  ['sourcesUsed', 'Signals that informed the snapshot'],
  ['contextTags', 'Pre-game, post-trial, travel, injury phase, high-stakes week'],
  ['performanceFlags', 'False-start spike, acute instability, early degradation onset'],
  ['persistentRed', 'Repeated red-state pattern requiring staff-support visibility'],
  ['recommendedProtocolClass', 'Regulation, Priming, Recovery, or none'],
  ['recommendedRouting', 'Protocol only, Sim only, Trial only, Protocol -> Sim, Sim -> Protocol, Defer / alternate path'],
  ['executionLink', 'Reference to the daily assignment artifact the coach and athlete now act from'],
];

const FRESHNESS_ROWS = [
  ['Explicit self-report', 'Immediate / latest entry wins', 'Strong explicit athlete input overrides weak inference.'],
  ['Recent performance', '4 hours', 'Valid for acute readiness and instability, not long-term skill interpretation.'],
  ['Context tags', '24 hours', 'Practice, travel, injury phase, game timing, and trial windows decay more slowly.'],
  ['Conversation sentiment', 'Same-day default', 'Supportive signal only; decay after new conversation events.'],
  ['Biometrics', 'Source freshness', 'Use near-real-time where available as confidence enrichment, not required input.'],
];

const THRESHOLD_GOVERNANCE = [
  ['Operating standard, not truth', 'Family-level state-flag thresholds are pilot defaults and may be recalibrated after sufficient valid athlete-session volume.'],
  ['Baseline-aware before cohort-aware', 'Default interpretation uses the athlete rolling baseline first before considering cohort drift.'],
  ['Human review for threshold changes', 'Threshold updates should be versioned, evidence-backed, and approved rather than silently altered in production.'],
];

const PulseCheckStateSignalLayerTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Runtime"
        title="State Signal Layer"
        version="Version 1.3 | March 16, 2026"
        summary="Foundation-layer artifact for the shared perception model. This page defines the canonical state dimensions, signal categories, confidence logic, freshness defaults, and the persisted snapshot that all downstream runtime systems should consume before daily assignment materialization."
        highlights={[
          {
            title: 'One Canonical State Model',
            body: 'Activation, Focus Readiness, Emotional Load, and Cognitive Fatigue are fixed. Overall Readiness is derived, not a fifth peer dimension.',
          },
          {
            title: 'Confidence-Governed Routing',
            body: 'Low-confidence or conflicting signals should trigger a lighter, more reversible decision rather than brittle assignment behavior.',
          },
          {
            title: 'One Snapshot, Shared Execution Context',
            body: 'The same state snapshot now feeds Nora routing, coach review, and the daily assignment artifact rather than separate copy-only hints.',
          },
          {
            title: 'Performance-Relevant, Not Diagnostic',
            body: 'The layer estimates operational state to help routing. It does not infer psychiatric conditions or replace clinical policy.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Foundation-layer artifact for the shared perception model. This page defines the runtime state schema, signal categories, confidence logic, freshness defaults, and routing vocabulary that downstream systems consume."
        sourceOfTruth="This document is authoritative for the four canonical state dimensions, signal categories, state snapshot fields, confidence logic, and locked routing enum."
        masterReference="Use Runtime Architecture first for system ordering. Use this page whenever another artifact summarizes the state model and you need the canonical schema or interpretation rules."
        relatedDocs={[
          'Runtime Architecture v1.0',
          'State Snapshot Freshness & Decay Policy v1.0',
          'Performance-State Flag Definitions v1.0',
          'State & Escalation Orchestration v1.2',
          'Nora Assignment Rules v1.1',
          'Escalation Integration Spec v1.1',
        ]}
      />

      <SectionBlock icon={Brain} title="Design Rules">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Operating Rules"
            body={
              <BulletList
                items={[
                  'State Signal informs routing; it does not itself diagnose or escalate.',
                  'Use multiple signals whenever possible and avoid assigning from one weak cue.',
                  'Prefer structured inputs first and free-form interpretation second.',
                  'Keep decisions explainable to staff and athletes.',
                  'Keep Protocols thin; the layer triggers them but does not create a second simulation taxonomy.',
                ]}
              />
            }
          />
          <InfoCard
            title="Routing Boundary"
            accent="blue"
            body="This layer exists to estimate whether the athlete should regulate, prime, recover, train, assess, or defer. It should not become a hidden severity score or a covert safety classifier."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Radar} title="Signal Categories">
        <DataTable columns={['Signal', 'What It Contributes', 'Examples', 'Priority']} rows={SIGNAL_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Layers3} title="Canonical State Dimensions">
        <CardGrid columns="md:grid-cols-2 xl:grid-cols-4">
          {DIMENSIONS.map((dimension) => (
            <InfoCard key={dimension.title} title={dimension.title} body={dimension.body} accent={dimension.accent} />
          ))}
        </CardGrid>
        <InfoCard
          title="Derived Output: Overall Readiness"
          accent="purple"
          body="Readiness is the routing summary built from the four dimensions. It should never hide why the athlete is Yellow or Red because different underlying patterns call for different actions."
        />
      </SectionBlock>

      <SectionBlock icon={Activity} title="State Inference Pipeline">
        <StepRail steps={PIPELINE} />
      </SectionBlock>

      <SectionBlock icon={Route} title="Routing Outputs and Confidence">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Locked Routing Enum"
            accent="green"
            body={
              <BulletList
                items={[
                  'Protocol only',
                  'Sim only',
                  'Trial only',
                  'Protocol -> Sim',
                  'Sim -> Protocol',
                  'Defer / alternate path',
                ]}
              />
            }
          />
          <InfoCard
            title="Confidence Logic"
            accent="amber"
            body={
              <BulletList
                items={[
                  'High confidence: multiple aligned signals or strong explicit self-report with support.',
                  'Medium confidence: one strong signal plus one weaker supporting signal.',
                  'Low confidence: sparse, stale, or contradictory information.',
                  'Low confidence should bias toward a brief check-in or conservative assignment.',
                ]}
              />
            }
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Gauge} title="Green / Yellow / Red Interpretation">
        <DataTable
          columns={['Band', 'State Pattern', 'Default Nora Action']}
          rows={[
            ['Green', 'Stable, ready, and fit for useful work.', 'Go straight to Sim or Trial'],
            ['Yellow', 'Mild anxiety, scatter, flatness, or instability that may reduce rep quality.', 'Short Protocol first, then Sim'],
            ['Red', 'High activation, emotional spillover, strong fatigue, or poor readiness for a useful rep.', 'Regulate / recover first, or defer Sim / Trial'],
          ]}
        />
      </SectionBlock>

      <SectionBlock icon={BarChart3} title="Performance-State Pattern Library">
        <DataTable columns={['Pattern', 'What It Looks Like', 'Likely Interpretation']} rows={PATTERN_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Gauge} title="Freshness Defaults Shared Across the Runtime">
        <DataTable columns={['Signal Type', 'Default Freshness Window', 'Interpretation Rule']} rows={FRESHNESS_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="State Snapshot Contract and Boundaries">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard title="Persisted Snapshot Fields" body={<DataTable columns={['Field', 'Purpose']} rows={SNAPSHOT_ROWS} />} />
          <InfoCard
            title="Safety Boundaries"
            accent="red"
            body={
              <BulletList
                items={[
                  'Do not infer mental-health conditions from sentiment or biometrics.',
                  'Do not route the athlete away from all training on a single weak signal.',
                  'Do not expose raw private conversation content to coaches when summaries are enough.',
                  'Keep clinical escalation rules separate from this state-routing layer.',
                ]}
              />
            }
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Threshold Governance">
        <CardGrid columns="md:grid-cols-3">
          {THRESHOLD_GOVERNANCE.map(([title, body]) => (
            <InfoCard key={title} title={title} body={body} accent="blue" />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={BarChart3} title="Detailed Companion Artifacts">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard title="Snapshot Freshness & Decay Policy" body="Expands the freshness defaults here into a complete shared-recency and degraded-snapshot policy for Nora and escalation." />
          <InfoCard title="Performance-State Flag Definitions" body="Expands the pattern library here into explicit family-level definitions for turning acute sim behavior into state evidence." />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckStateSignalLayerTab;
