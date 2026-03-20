import React from 'react';
import { Activity, BarChart3, Brain, Gauge, Layers3, Radar, Route, ShieldCheck } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const SIGNAL_ROWS = [
  ['Self-report', 'Direct athlete description of current state.', 'Anxious, scattered, flat, frustrated, mentally tired, locked in', 'Live'],
  ['Conversation sentiment', 'Emotional tone inferred from athlete language.', 'Rising frustration, nervous tone, low-confidence language', 'Live / expanding'],
  ['Biometrics', 'Physiological context when available.', 'Heart rate, HRV, sleep, breathing rate', 'Live / expanding'],
  ['Performance', 'Behavioral evidence that state may be degrading the rep.', 'False starts, volatility, acute dip, widening variance', 'Live'],
  ['Context', 'Situational information that changes what good routing looks like.', 'Pre-game, post-trial, travel, high-stakes week', 'Live'],
  ['Execution events', 'Signals from what the athlete actually did after assignment.', 'Viewed, started, completed, deferred, coach-adjusted', 'Live input + snapshot refresh'],
  ['Coach constraints', 'Hard narrowing rules that the planner must respect.', 'Locked family, defer, manual override, return-to-play restriction', 'When present'],
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
    title: 'Normalize into Canonical Source Records',
    body: 'Convert each source into a common signal format so raw evidence can be compared, audited, replayed, and enriched consistently.',
  },
  {
    title: 'AI Verifies Contradictions and Gaps',
    body: 'An AI interpretation step should inspect the raw evidence, identify conflicts, call out missing context, and decide which signals are likely trustworthy versus noisy.',
  },
  {
    title: 'AI Enriches The State',
    body: 'The model should infer Activation, Focus Readiness, Emotional Load, Cognitive Fatigue, supporting hypotheses, and confidence posture without drifting into diagnosis.',
  },
  {
    title: 'Persist Raw + Enriched Snapshot',
    body: 'Store one authoritative snapshot that preserves both raw signal provenance and the AI-enriched interpretation so downstream systems can explain why the system thinks what it thinks.',
  },
  {
    title: 'Hand The Snapshot To The Assignment Planner',
    body: 'The enriched snapshot becomes the primary decision input for the bounded Nora assignment planner, while deterministic policy gates still enforce safety, eligibility, and coach constraints.',
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
  ['rawSignalSummary', 'Structured summary of the source records considered for this snapshot'],
  ['stateDimensions', 'Activation, Focus Readiness, Emotional Load, Cognitive Fatigue'],
  ['overallReadiness', 'Derived Green / Yellow / Red output used for routing'],
  ['confidence', 'High / Medium / Low confidence in the current estimate'],
  ['enrichedInterpretation', 'AI-authored interpretation of what is most likely driving the current state'],
  ['sourcesUsed', 'Signals that informed the snapshot'],
  ['sourceEventIds', 'Traceable ids for the raw evidence behind the snapshot'],
  ['contextTags', 'Pre-game, post-trial, travel, injury phase, high-stakes week'],
  ['performanceFlags', 'False-start spike, acute instability, early degradation onset'],
  ['persistentRed', 'Repeated red-state pattern requiring staff-support visibility'],
  ['recommendedProtocolClass', 'Regulation, Priming, Recovery, or none'],
  ['recommendedRouting', 'Protocol only, Sim only, Trial only, Protocol -> Sim, Sim -> Protocol, Defer / alternate path'],
  ['candidateClassHints', 'What kind of bounded assignment pool the planner should consider'],
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
  ['AI inside policy rails', 'The model should enrich and interpret the state, but deterministic policy still owns hard constraints, coach locks, and safety boundaries.'],
];

const PulseCheckStateSignalLayerTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Runtime"
        title="State Signal Layer"
        version="Version 1.5 | March 20, 2026"
        summary="Foundation-layer artifact for the shared perception model. This page now defines the raw-signal intake, AI-enriched state interpretation, confidence logic, freshness defaults, and the persisted snapshot that downstream runtime systems should consume before Nora assignment planning. Fresh same-day self-report leads current-state readiness; the longer-term profile can bias interpretation, but it must not override a fresh check-in."
        highlights={[
          {
            title: 'One Canonical State Model',
            body: 'Activation, Focus Readiness, Emotional Load, and Cognitive Fatigue are fixed. Overall Readiness is derived, not a fifth peer dimension.',
          },
          {
            title: 'AI Enrichment, Not Just Scoring',
            body: 'The signal layer should preserve raw evidence, then let AI verify contradictions, infer likely drivers, and enrich the state before assignment planning.',
          },
          {
            title: 'Confidence-Governed Planning',
            body: 'Low-confidence or conflicting signals should trigger a lighter, more reversible decision rather than brittle assignment behavior.',
          },
          {
            title: 'One Snapshot, Shared Execution Context',
            body: 'The same enriched snapshot should feed Nora planning, coach review, and the daily assignment artifact rather than separate copy-only hints.',
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
                  'Fresh same-day self-report leads current-state readiness; the longer-term profile can bias the estimate, but it does not overrule a new check-in.',
                  'Preserve raw source records separately from the AI-enriched interpretation.',
                  'Use AI to verify contradictions and flesh out the state, not to bypass policy or invent unsafe outcomes.',
                  'Keep decisions explainable to staff and athletes with evidence and provenance.',
                  'Keep Protocols thin; the layer triggers them, and the planner chooses only from the bounded protocol/simulation inventory.',
                ]}
              />
            }
          />
          <InfoCard
            title="Routing Boundary"
            accent="blue"
            body="This layer exists to estimate whether the athlete should regulate, prime, recover, train, assess, or defer. It should not become a hidden severity score, a covert safety classifier, or a freeform exercise generator."
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
                  'Contradictions should reduce confidence before the planner takes an aggressive or high-cost path.',
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
            ['Red', 'High activation, emotional spillover, strong fatigue, or poor readiness for a useful rep.', 'Protocol-first by default; defer only when the state is severe enough that a normal rep would be inappropriate'],
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
                  'Do not let AI invent new assignment classes or exercises outside the canonical candidate inventory.',
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
