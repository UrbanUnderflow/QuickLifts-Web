import React from 'react';
import { AlertTriangle, BarChart3, BrainCircuit, Database, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const DESIGN_GOAL_ROWS = [
  ['Remember athlete-specific response patterns', 'The system should learn which protocol families, variants, and response families tend to help, do nothing, or backfire for a specific athlete.'],
  ['Stay subordinate to current state', 'Responsiveness memory should shape bounded choice within the current state posture, not overrule a strong present-moment state signal.'],
  ['Track confidence, not just preference', 'Nora needs both “this athlete tends to respond to X” and “how sure are we that this is true?”'],
  ['Use live evidence, not lore', 'The profile should be updated by assignment events, snapshot deltas, athlete response, and downstream execution changes rather than manual intuition alone.'],
  ['Decay stale beliefs', 'Older response patterns should weaken over time unless they are re-confirmed.'],
  ['Remain explainable', 'Coaches and operators should be able to see why a responsiveness preference exists rather than treating it as hidden personalization magic.'],
];

const OBJECT_ROWS = [
  ['Responsiveness profile root', 'One per athlete', 'Holds the current learned protocol-response posture for the athlete.'],
  ['Family response summary', 'One per protocol family', 'Tracks overall effect direction, consistency, confidence, and freshness for that family.'],
  ['Variant response summary', 'Optional per published runtime variant', 'Used when a specific variant behaves differently enough from the broader family to matter in planning.'],
  ['Evidence rollup', 'Recent and historical windows', 'Aggregates protocol completions, state deltas, downstream sim impact, and negative-response signals.'],
  ['Explanation trace', 'Human-readable support', 'Stores the notes or evidence labels that explain why the current responsiveness belief exists.'],
];

const SIGNAL_ROWS = [
  ['Protocol completed', 'Completion is necessary evidence, but not sufficient by itself.'],
  ['Immediate athlete response', 'Post-protocol self-report or Nora-captured correction can indicate whether the athlete felt a real shift.'],
  ['Snapshot delta', 'Next snapshot movement in the intended direction is stronger evidence than completion alone.'],
  ['Downstream execution quality', 'A follow-on sim, trial, or rep becoming more useful is key evidence that the protocol actually helped.'],
  ['Negative-response signal', 'Higher agitation, resistance, poor completion, or worse downstream execution should count against responsiveness.'],
  ['Coach review or override', 'Coach interpretation can annotate the profile, but should not silently replace runtime evidence without provenance.'],
];

const FIELD_ROWS = [
  ['`athleteId`', 'Profile owner'],
  ['`familyResponses`', 'Map of protocol-family responsiveness summaries'],
  ['`variantResponses`', 'Optional map of runtime-variant responsiveness summaries'],
  ['`lastUpdatedAt`', 'Latest profile refresh time'],
  ['`sourceEventIds`', 'Traceable evidence inputs used in the current rollup'],
  ['`staleAt`', 'When the profile should be treated as degraded unless refreshed'],
];

const FAMILY_RESPONSE_ROWS = [
  ['`responseDirection`', '`positive`, `neutral`, `negative`, or `mixed`'],
  ['`confidence`', 'How sure the system is that the athlete really responds this way'],
  ['`freshness`', 'Whether the belief is current, degraded, or needs refresh'],
  ['`sampleSize`', 'How many meaningful evidence windows support the belief'],
  ['`stateFit`', 'Which state signatures or context windows this response seems to hold in'],
  ['`supportingEvidence`', 'Short explanation labels the coach or planner can inspect'],
  ['`lastConfirmedAt`', 'Most recent meaningful reconfirmation'],
];

const CONFIDENCE_MATRIX_ROWS = [
  ['High state confidence + high responsiveness confidence', 'Prefer the best-fit responsive protocol when multiple valid candidates fit the current state.'],
  ['High state confidence + low responsiveness confidence', 'Trust the current state first; responsiveness can break ties but should not dominate.'],
  ['Low state confidence + high responsiveness confidence', 'Use responsiveness to bias toward lower-cost, previously effective options, but avoid aggressive routing leaps.'],
  ['Low state confidence + low responsiveness confidence', 'Do not personalize aggressively; prefer conservative default protocol logic or request a clarifying signal.'],
  ['Strong negative responsiveness signal', 'Down-rank that family or variant unless the current state makes alternatives clearly worse or unsafe.'],
];

const DECAY_ROWS = [
  ['Recent repeated success', 'Maintain or strengthen confidence when the same family keeps helping under similar state signatures.'],
  ['Long gap without reconfirmation', 'Decay confidence so old responsiveness beliefs do not persist forever.'],
  ['Conflicting recent evidence', 'Shift to mixed or degraded posture until the system sees more evidence.'],
  ['Context mismatch', 'Do not generalize strongly from one window, such as post-competition recovery, into a different window like pre-performance priming.'],
];

const WORKFLOW_STEPS = [
  {
    title: 'Collect protocol evidence',
    body: 'Observe completion, athlete response, snapshot deltas, and downstream execution impact after protocol use.',
    owner: 'Execution + state refresh',
  },
  {
    title: 'Normalize into responsiveness evidence',
    body: 'Translate raw events into family- and variant-level evidence entries with effect direction and confidence contribution.',
    owner: 'Responsiveness updater',
  },
  {
    title: 'Refresh the athlete profile',
    body: 'Recompute family and variant responsiveness summaries, including confidence and freshness posture.',
    owner: 'Protocol responsiveness service',
  },
  {
    title: 'Feed the planner',
    body: 'Expose the current responsiveness profile to Nora so it can shape candidate ranking within the current state and policy rails.',
    owner: 'Assignment planner',
  },
  {
    title: 'Explain the preference',
    body: 'Let coach tools and review surfaces show why the system prefers or avoids certain protocol families for the athlete.',
    owner: 'Coach review + ops',
  },
];

const DEFER_ROWS = [
  ['Protocol sequencing and bundles', 'Not part of this v1 profile spec. Responsiveness is defined for single families and runtime variants first.'],
  ['Cross-athlete recommendation transfer', 'Do not infer that one athlete should receive the same protocol because another athlete responded well.'],
  ['Hard coach preference overrides as learned truth', 'Coach actions may annotate the profile, but should not silently become learned responsiveness without runtime evidence.'],
];

const PulseCheckProtocolResponsivenessProfileSpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Runtime"
        title="Protocol Responsiveness Profile Spec"
        version="Version 0.1 | March 17, 2026"
        summary="Personalization-layer artifact for how PulseCheck should learn athlete-specific protocol response patterns. This page defines the canonical responsiveness profile, the evidence signals that update it, how confidence and decay should work, and how Nora should weigh responsiveness against the current state snapshot when selecting among bounded protocol candidates."
        highlights={[
          {
            title: 'State First, Personalization Second',
            body: 'Responsiveness should refine bounded protocol choice within the current state posture, not override a strong current-state read.',
          },
          {
            title: 'Confidence Intersection Is Explicit',
            body: 'Nora needs clear rules for how state confidence and responsiveness confidence interact before preferring one protocol family over another.',
          },
          {
            title: 'Evidence Must Be Live',
            body: 'Completion, snapshot delta, and downstream execution impact matter more than static assumptions about what “usually works.”',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Personalization artifact for athlete-specific protocol learning. It defines how response patterns should be stored, refreshed, decayed, and consumed by Nora when multiple bounded protocols fit the current state."
        sourceOfTruth="This document is authoritative for the structure and planner-use rules of the athlete protocol responsiveness profile. It complements the Protocol Governance Spec, Protocol Registry, and Nora Assignment Rules."
        masterReference="Use State Signal Layer for current state confidence, Protocol Governance Spec for intervention ontology, and this page for how protocol-response memory should intersect with current-state planning."
        relatedDocs={[
          'Protocol Governance Spec',
          'Protocol Authoring Workflow',
          'Protocol Registry',
          'State Signal Layer',
          'Nora Assignment Rules',
        ]}
      />

      <SectionBlock icon={BrainCircuit} title="Design Goals">
        <DataTable columns={['Goal', 'Meaning']} rows={DESIGN_GOAL_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Canonical Object Model">
        <DataTable columns={['Object', 'Scope', 'Meaning']} rows={OBJECT_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Why Family First"
            accent="blue"
            body="The system should usually learn at the family level first because that generalizes better than variant-level overfitting. Variant-level response should only become important when real evidence says the specific runtime expression matters."
          />
          <InfoCard
            title="Why This Is Not Preference Only"
            accent="green"
            body="A favorite protocol and an effective protocol are not always the same. The profile should track observed response quality, not just voluntary preference or completion count."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={SlidersHorizontal} title="Evidence Signals">
        <DataTable columns={['Signal', 'Why It Matters']} rows={SIGNAL_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Field Requirements">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Profile Root Fields"
            accent="blue"
            body={<DataTable columns={['Field', 'Purpose']} rows={FIELD_ROWS} />}
          />
          <InfoCard
            title="Family Summary Fields"
            accent="amber"
            body={<DataTable columns={['Field', 'Purpose']} rows={FAMILY_RESPONSE_ROWS} />}
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Confidence Interaction Rules">
        <DataTable columns={['Scenario', 'Required Nora Behavior']} rows={CONFIDENCE_MATRIX_ROWS} />
        <InfoCard
          title="Key Planning Rule"
          accent="red"
          body="Responsiveness confidence should never let Nora overrule a strong contradictory current-state signal. It is a ranking input inside the valid state-fit set, not a license to ignore the latest snapshot."
        />
      </SectionBlock>

      <SectionBlock icon={BarChart3} title="Decay and Refresh">
        <DataTable columns={['Condition', 'Required Profile Behavior']} rows={DECAY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={BrainCircuit} title="End-to-End Responsiveness Flow">
        <StepRail steps={WORKFLOW_STEPS} />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Explicit v2 Deferrals">
        <DataTable columns={['Deferred Scope', 'Reason']} rows={DEFER_ROWS} />
        <InfoCard
          title="Bundle Deferral"
          accent="amber"
          body={
            <BulletList
              items={[
                'Protocol sequencing and bundles are intentionally deferred to v2.',
                'This v1 spec is only about learning responsiveness for single families and runtime variants.',
                'Once single-protocol learning is stable, bundle logic can build on top of it instead of being guessed up front.',
              ]}
            />
          }
        />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckProtocolResponsivenessProfileSpecTab;
