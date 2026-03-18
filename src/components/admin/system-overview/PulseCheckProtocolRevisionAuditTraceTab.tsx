import React from 'react';
import { FileStack, Fingerprint, GitBranch, History, ShieldCheck, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const PROVENANCE_ROWS = [
  ['Protocol object identity', '`protocolId`, `familyId`, `variantId`, `variantVersion`, and the published runtime label used at decision time.'],
  ['Revision lineage', 'Immutable published runtime revision id or publish lineage token, not just the current mutable record id.'],
  ['Decision context', '`sourceStateSnapshotId`, `sourceCandidateSetId`, planner confidence, decision source, and ranked candidate trace.'],
  ['Execution lineage', 'Daily assignment lineage id, revision number, and supersession metadata when same-day re-plans occur.'],
  ['Evidence linkage', 'Assignment event ids and responsiveness source-event ids that later update protocol evidence.'],
];

const FLOW_STEPS = [
  {
    title: 'Author and review the protocol object',
    body: 'Family, variant, and runtime record are shaped, reviewed, and published into launch inventory.',
    owner: 'Registry + governance',
  },
  {
    title: 'Assemble the bounded candidate set',
    body: 'Candidate set stores which protocol runtime objects were eligible for the snapshot.',
    owner: 'Planner input layer',
  },
  {
    title: 'Persist planner decision',
    body: 'Assignment stores which candidate won, what the planner saw, and how confident it was.',
    owner: 'Assignment materialization',
  },
  {
    title: 'Record execution events',
    body: 'Viewed, started, completed, deferred, and overridden events extend the trace instead of replacing it.',
    owner: 'Execution truth layer',
  },
  {
    title: 'Roll evidence forward',
    body: 'Evidence and responsiveness services can point back to the exact assignment/event chain that informed them.',
    owner: 'Evidence + responsiveness layer',
  },
];

const ACCEPTANCE_ROWS = [
  ['Audit question', 'Required answer path'],
  ['Which exact protocol runtime did Nora assign?', 'Read the stored runtime identity and published revision from the assignment trace.'],
  ['What other protocol candidates were available?', 'Read the bounded candidate set and planner audit.'],
  ['Why did the chosen protocol beat a nearby sibling?', 'Read policy fit, responsiveness posture, and planner rationale from the persisted trace.'],
  ['Did later evidence come from this exact assignment or a different revision?', 'Follow assignment/event provenance into responsiveness and evidence rollups.'],
];

const GAP_ROWS = [
  ['Mutable-object ambiguity', 'If assignments only point at the latest runtime record id, launch review cannot reconstruct the exact published state that produced the decision.'],
  ['Publish lineage missing', 'Without a published revision token, governance cannot tell which reviewed definition was live at assignment time.'],
  ['Evidence trace drift', 'If evidence rollups cannot trace back to assignment/event lineage, trust in the dashboard erodes quickly.'],
];

const PulseCheckProtocolRevisionAuditTraceTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Runtime"
        title="Protocol Revision & Audit Trace"
        version="Version 0.1 | March 18, 2026"
        summary="Auditability artifact for how protocol authorship, publish lineage, planner decisions, and assignment execution should connect into one traceable chain. This page defines the provenance required to explain exactly which protocol object Nora assigned and why."
        highlights={[
          {
            title: 'Assignments Need More Than A Label',
            body: 'Launch review needs to know which exact published protocol state produced the assignment, not just the protocol name.',
          },
          {
            title: 'Planner And Governance Must Meet',
            body: 'The assignment trace should connect registry publication history with candidate-set and planner-decision truth.',
          },
          {
            title: 'Evidence Depends On Traceability',
            body: 'If later evidence cannot be tied back to the right runtime revision, protocol governance becomes guesswork.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Audit-trace artifact for protocol assignment provenance. It defines the fields and lifecycle links required to reconstruct why a live protocol decision happened."
        sourceOfTruth="This document is authoritative for protocol decision provenance, publish-lineage expectations, and the minimum trace fields needed for launch-grade auditability."
        masterReference="Use Protocol Authoring Workflow for revision intent, Protocol Launch Readiness for release gating, and this page for the exact trace chain that should exist in runtime records."
        relatedDocs={[
          'Protocol Authoring Workflow',
          'Protocol Registry',
          'Protocol Evidence Dashboard',
          'Protocol Launch Readiness',
        ]}
      />

      <SectionBlock icon={Fingerprint} title="Required Provenance Fields">
        <DataTable columns={['Trace Domain', 'What Must Be Stored']} rows={PROVENANCE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="End-To-End Trace Flow">
        <StepRail steps={FLOW_STEPS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Audit Questions The System Must Answer">
        <DataTable columns={ACCEPTANCE_ROWS[0] as string[]} rows={ACCEPTANCE_ROWS.slice(1)} />
      </SectionBlock>

      <SectionBlock icon={History} title="Why This Matters">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Launch Review Need"
            accent="blue"
            body="If a protocol decision is challenged after launch, the team should be able to reconstruct the exact inventory state, candidate set, planner output, and assignment events that produced it."
          />
          <InfoCard
            title="Governance Need"
            accent="green"
            body="Protocol publication history only becomes trustworthy when assignments and evidence rollups can point back to the reviewed published object that was actually live."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={GitBranch} title="Current Failure Modes To Eliminate">
        <DataTable columns={['Gap', 'Risk']} rows={GAP_ROWS} />
      </SectionBlock>

      <SectionBlock icon={FileStack} title="Launch Principle">
        <InfoCard
          title="Auditability Standard"
          accent="red"
          body={
            <BulletList
              items={[
                'A launch reviewer should never have to infer which protocol version was live.',
                'Evidence and responsiveness should point back to concrete assignments and events, not only to current aggregate state.',
                'Same-day re-plans should preserve lineage rather than overwriting the prior truth silently.',
              ]}
            />
          }
        />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckProtocolRevisionAuditTraceTab;
