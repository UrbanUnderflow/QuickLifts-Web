import React from 'react';
import { AlertTriangle, Database, Link2, ShieldCheck, Siren, Waypoints, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock } from './PulseCheckRuntimeDocPrimitives';

const SURFACE_ROWS = [
  ['State snapshot builder', 'Self-report, context, recent performance, sentiment, biometrics', 'state-snapshots collection'],
  ['Nora assignment engine', 'Latest valid state snapshot plus escalation status', 'Protocol / Sim / Trial assignment decisions'],
  ['classify-escalation', 'Message, history, mental notes, escalation conditions, latest state snapshot', 'Tier / category / confidence / shouldEscalate result'],
  ['pulsecheck-escalation handler', 'Escalation result plus existing conversation and user records', 'escalation-records, conversations, notifications, AuntEDNA handoff state'],
  ['Coach dashboard', 'state-snapshots, performance data, escalation-records', 'Separated readiness, performance, and safety views'],
];

const SNAPSHOT_ROWS = [
  ['stateSnapshotId', 'Traceability back to the authoritative snapshot'],
  ['overallReadiness', 'Summarizes Green / Yellow / Red state'],
  ['activation', 'Useful for overactivation and agitation context'],
  ['focusReadiness', 'Useful for scattered vs locked-in context'],
  ['emotionalLoad', 'Useful for frustration, anxiety, and emotional spillover context'],
  ['cognitiveFatigue', 'Useful for depletion and deterioration context'],
  ['confidence', 'Tells the classifier how much to trust the snapshot'],
  ['performanceFlags', 'Provides concrete deterioration patterns from recent sims'],
  ['contextTags', 'Adds situational context such as pre-game or post-trial'],
  ['persistentRed', 'Signals repeated red-state patterns that may justify caution or support visibility'],
  ['sourcesUsed', 'Shows whether the snapshot is based on self-report, performance, biometrics, sentiment, or context'],
];

const WRITEBACK_ROWS = [
  ['conversations', 'escalationTier, escalationStatus, escalationRecordId, isInSafetyMode, lastEscalationAt', 'Lets Nora and the UI see current safety status quickly'],
  ['state-snapshots or linked runtime context', 'latestEscalationTier, latestEscalationStatus, safetyOverride', 'Lets performance routing respect current safety constraints'],
  ['assignment layer / runtime context', 'assignmentSuppressed, staffSupportFlag, reasonCode', 'Prevents inappropriate Sim or Trial assignments during safety events or support conditions'],
  ['coach dashboard context', 'readinessPanel, performancePanel, safetyPanel', 'Keeps staff views separated by meaning instead of collapsing into one score'],
];

const STALE_ROWS = [
  ['Fresh snapshot present', 'Pass the full structured state block into classify-escalation as context.'],
  ['Snapshot stale but still available', 'Mark context as stale and allow it to inform caution, but do not let it increase classifier confidence.'],
  ['No valid snapshot available', 'Proceed with message, history, and policy inputs alone. Do not fabricate state context.'],
  ['Fresh snapshot plus hard safety language', 'Hard safety language still wins immediately; the snapshot remains contextual only.'],
];

const PulseCheckEscalationIntegrationSpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Runtime"
        title="Escalation Integration Spec"
        version="Version 1.1 | March 10, 2026"
        summary="Execution-layer artifact for the concrete bridge between the shared state snapshot and the existing escalation workflow. This page defines how state context is passed into classification and how safety-lane outcomes are written back into runtime objects."
        highlights={[
          {
            title: 'State Adds Context, Not Tiering',
            body: 'The classifier should use the state snapshot to strengthen or weaken confidence, not to replace hard safety language or admin conditions.',
          },
          {
            title: 'One Shared Snapshot Contract',
            body: 'Escalation should consume the latest valid state snapshot rather than recomputing athlete state independently.',
          },
          {
            title: 'Write-Back Is Part of the Spec',
            body: 'Safety outcomes have to be reflected back into conversation, runtime, and coach contexts so downstream systems do not re-query the full escalation record.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Execution-layer safety integration artifact. This page defines the bridge between the shared state snapshot and the existing escalation workflow, including prompt augmentation and runtime write-back."
        sourceOfTruth="This document is authoritative for the integration boundary between state context and the current escalation implementation. It governs payload shape, prompt use, and post-escalation field updates."
        masterReference="Use Runtime Architecture for the system map, then use this page when engineering how state context enters classify-escalation and how safety results flow back to runtime objects."
        relatedDocs={[
          'Runtime Architecture v1.0',
          'State Signal Layer v1.2',
          'State & Escalation Orchestration v1.2',
          'Nora Assignment Rules v1.1',
        ]}
      />

      <SectionBlock icon={Workflow} title="Integration Surfaces">
        <DataTable columns={['System Component', 'Consumes', 'Produces / Updates']} rows={SURFACE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Shared State Snapshot Payload">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard title="Minimum Payload Contract" body={<DataTable columns={['Field', 'Use in Escalation Context']} rows={SNAPSHOT_ROWS} />} />
          <InfoCard
            title="Contract Rule"
            accent="blue"
            body="The escalation system should not recompute athlete state independently. It should consume the latest valid state snapshot produced upstream by the State Signal Layer."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="How classify-escalation Should Use the Snapshot">
        <CardGrid columns="md:grid-cols-2 xl:grid-cols-4">
          <InfoCard title="Hard Safety Language" accent="red" body="Always authoritative. Explicit risk content always wins over a benign or stale state snapshot." />
          <InfoCard title="Admin Conditions" accent="red" body="Remain the hard safety policy source for tiering and category interpretation." />
          <InfoCard title="State Snapshot" accent="green" body="Context layer only. It can strengthen, weaken, or contextualize confidence but does not independently assign a clinical tier." />
          <InfoCard title="Persistent Red" accent="amber" body="Supportive caution signal. It may increase concern and staff visibility, but it should not independently force Tier 2 or Tier 3." />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Link2} title="Prompt Augmentation Pattern">
        <InfoCard
          title="Recommended Prompt Block"
          accent="purple"
          body='Current athlete state: overallReadiness, confidence, four canonical state dimensions, performanceFlags, contextTags, persistentRed, and sourcesUsed. Use this only as context. Hard safety language and admin escalation conditions remain authoritative.'
        />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Stale Snapshot Handling">
        <DataTable columns={['State Context Condition', 'Required Classifier Behavior']} rows={STALE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Waypoints} title="What pulsecheck-escalation Must Write Back">
        <DataTable columns={['Target Object', 'Field(s)', 'Purpose']} rows={WRITEBACK_ROWS} />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Support Visibility Pathway">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard title="Starting Rule" accent="amber" body="Use the shared pilot default: 3 consecutive red snapshots or 4 red snapshots within the latest 7 state-bearing sessions." />
          <InfoCard title="Primary Response" accent="green" body="Increase staff visibility, reduce training aggressiveness, recommend human follow-up, and keep monitoring." />
          <InfoCard title="Escalation Threshold" accent="red" body="If persistent red is accompanied by hard safety language, worsening distress content, or elevated-risk conditions, route through the safety lane instead." />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Siren} title="Implementation Roadmap">
        <DataTable
          columns={['Phase', 'Implementation Goal']}
          rows={[
            ['Phase 1', 'Persist state snapshots from structured self-report, context, and recent performance.'],
            ['Phase 2', 'Pass the latest valid state snapshot into classify-escalation as structured context only.'],
            ['Phase 3', 'Have Nora read both the latest state snapshot and the latest escalation status before assigning anything.'],
            ['Phase 4', 'Add persistent-red support flags and separated coach dashboard panels.'],
            ['Phase 5', 'Increase snapshot confidence with conversation sentiment and biometrics where available.'],
          ]}
        />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Next Tuning Areas After Pilot Data">
        <InfoCard
          title="Implementation Tuning Queue"
          body={
            <BulletList
              items={[
                'Validate the freshness windows against real session cadence and escalation timing.',
                'Tune family-by-family performance-state thresholds from valid athlete-session volume rather than intuition alone.',
                'Confirm whether support visibility should remain global or split by sport/context after pilot review.',
                'Refine how stale, conflicting, or low-confidence state is represented inside the classifier prompt without overstating certainty.',
              ]}
            />
          }
        />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckEscalationIntegrationSpecTab;
