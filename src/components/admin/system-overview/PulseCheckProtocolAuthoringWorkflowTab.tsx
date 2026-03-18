import React from 'react';
import { BookOpen, CheckSquare, ClipboardList, GitBranch, ShieldCheck, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const WORKFLOW_STEPS = [
  {
    title: 'Nominate or Discover the Protocol',
    body: 'Capture the intervention idea with source references, mechanism claim, target bottleneck, and the closest existing family or protocol it might overlap with.',
    owner: 'Research / product / coach',
  },
  {
    title: 'Shape the Family',
    body: 'Decide whether the idea belongs to an existing protocol family or requires a new family because the mechanism, use window, and expected state shift are genuinely different.',
    owner: 'Protocol governance review',
  },
  {
    title: 'Author the Variant',
    body: 'Define delivery mode, dose, script/prompts, target windows, trigger tags, avoid windows, and expected state-shift hypothesis.',
    owner: 'Protocol author',
  },
  {
    title: 'Bind a Runtime Record',
    body: 'Create the bounded assignable runtime record that points at the underlying exercise/content asset and carries publish posture, class, response family, and planner metadata.',
    owner: 'Registry editor',
  },
  {
    title: 'Review and Publish',
    body: 'Run the variant through evidence, misuse-risk, wording, and inventory-overlap review before making it eligible for Nora planning.',
    owner: 'Governance approver',
  },
  {
    title: 'Monitor and Revise',
    body: 'Track completion, snapshot deltas, downstream execution impact, and athlete responsiveness. Adjust, restrict, supersede, or archive as evidence accumulates.',
    owner: 'Operations / product / research',
  },
];

const WORKSPACE_ROWS = [
  ['Family Canvas', 'Mechanism, intended state shift, use windows, contraindications, and overlap analysis against current inventory.'],
  ['Variant Draft', 'Delivery mode, prompts or script, duration, trigger tags, context tags, source exercise binding, and draft athlete-facing rationale.'],
  ['Runtime Policy', 'Publish state, planner eligibility, assignment constraints, review notes, and whether the record is active, restricted, or archived.'],
  ['Evidence + Research', 'Source references, expected effect, early feedback, runtime outcome notes, and future review prompts.'],
  ['History', 'Revision log, who changed what, when it changed, and what publish posture or runtime behavior shifted.'],
];

const REQUIRED_FIELD_ROWS = [
  ['Identity', '`id`, label, family, variant name, and source exercise or underlying content asset.'],
  ['Mechanism', 'Protocol class, response family, delivery mode, target bottleneck, and expected state-shift hypothesis.'],
  ['Dose', 'Duration, cadence, and any timing or context rules that materially affect success.'],
  ['Planner metadata', 'Trigger tags, preferred context tags, avoid windows, and assignment eligibility posture.'],
  ['Governance metadata', 'Draft/published/archived status, reviewer notes, evidence summary, and revision provenance.'],
];

const CHANGE_ROWS = [
  ['Copy-only refinement', 'Athlete-facing wording changes without changing mechanism, dose, or planner behavior.'],
  ['Dose tweak', 'Duration or cadence changes inside an existing variant family; requires review because it can affect effectiveness.'],
  ['Trigger-policy tweak', 'Change to tags, windows, or assignment eligibility; requires planner/governance review.'],
  ['New variant', 'Same family, but a meaningfully different delivery, prompting style, or use-window expression.'],
  ['New family', 'New mechanism or state-shift lane that should not be forced into an existing family.'],
  ['Archive / restrict', 'Remove or narrow runtime eligibility because evidence, overlap, or misuse risk changed.'],
];

const HISTORY_ROWS = [
  ['Revision granularity', 'Every meaningful authoring or policy change should create a new revision, not silently overwrite the last approved state.'],
  ['Publish lineage', 'The system should preserve which revision was published, which revision superseded it, and why.'],
  ['Runtime traceability', 'Assignments should be able to point back to the protocol runtime revision they were generated from.'],
  ['Review notes', 'Approval or restriction decisions should store the reviewer rationale, not just the resulting status.'],
];

const DEFER_ROWS = [
  ['Bundle authoring', 'Out of scope for v1. The initial workflow should author single families, variants, and runtime records only.'],
  ['Sequence governance', 'Do not add protocol stacks or multi-step sequences until single-protocol review and responsiveness learning are stable.'],
  ['Cross-protocol optimization', 'Ranking among bundles or adaptive stacks belongs to a later planning layer, not the first authoring workspace.'],
];

const REVIEW_CHECKLIST = [
  'Is the protocol mechanism genuinely clear and different enough from nearby options?',
  'Is the use window explicit enough that Nora can avoid assigning it in the wrong context?',
  'Does the runtime record point at a real deliverable content asset or exercise, not a theoretical idea?',
  'Would a coach understand why this protocol exists and when it should be preferred over a nearby sibling?',
  'If the protocol backfires or does nothing, do we know what signal would tell us that?',
  'Is the athlete-facing wording performance-oriented rather than vague wellness language or diagnostic language?',
];

const PulseCheckProtocolAuthoringWorkflowTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Runtime"
        title="Protocol Authoring Workflow"
        version="Version 0.1 | March 17, 2026"
        summary="Design artifact for the operational workspace that should create, revise, review, publish, and retire PulseCheck protocols. This page defines the authoring flow, required workspace surfaces, change classes, publish controls, and revision model we should build before calling protocol governance mature."
        highlights={[
          {
            title: 'Authoring Is Not Just CRUD',
            body: 'The workflow needs family logic, review state, evidence notes, and runtime-policy awareness, not just field editing.',
          },
          {
            title: 'Publish Controls Matter',
            body: 'A protocol should not become assignable simply because it exists in a registry document; publish posture and review history need to be first-class.',
          },
          {
            title: 'History Must Be Real',
            body: 'We should preserve revision lineage so runtime behavior can always be traced back to a reviewed protocol definition.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Operational design artifact for the protocol authoring workspace. It defines the flow and data surface the admin UI should support so protocol governance becomes real rather than ad hoc field editing."
        sourceOfTruth="This document is authoritative for the intended authoring workflow, publish controls, and revision expectations for protocol records. It complements the Protocol Governance Spec and the live Protocol Registry tab."
        masterReference="Build this beside the Protocol Registry and Variant Registry, but keep the workspace protocol-specific rather than inheriting sim-build UI assumptions by default."
        relatedDocs={[
          'Protocol Governance Spec',
          'Protocol Responsiveness Profile Spec',
          'Protocol Registry',
          'Variant Registry',
        ]}
      />

      <SectionBlock icon={Workflow} title="Target Workflow">
        <StepRail steps={WORKFLOW_STEPS} />
      </SectionBlock>

      <SectionBlock icon={BookOpen} title="Workspace Surface Design">
        <DataTable columns={['Workspace Area', 'What It Should Hold']} rows={WORKSPACE_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Why A Family Canvas Matters"
            accent="blue"
            body="If we skip the family layer and only edit runtime records, we will keep rediscovering the same overlap and taxonomy problems later. The authoring flow should force the family question early."
          />
          <InfoCard
            title="Why Runtime Policy Needs Its Own Panel"
            accent="green"
            body="A good protocol definition can still be dangerous or noisy if its assignability windows are wrong. Runtime policy needs to be editable and reviewable as its own concern."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ClipboardList} title="Required Fields">
        <DataTable columns={['Field Group', 'What Must Be Captured']} rows={REQUIRED_FIELD_ROWS} />
      </SectionBlock>

      <SectionBlock icon={GitBranch} title="Change Classes">
        <DataTable columns={['Change Type', 'Meaning']} rows={CHANGE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Publish Review">
        <InfoCard
          title="Minimum Publish Checklist"
          accent="amber"
          body={<BulletList items={REVIEW_CHECKLIST} />}
        />
      </SectionBlock>

      <SectionBlock icon={CheckSquare} title="Revision and History Model">
        <DataTable columns={['History Rule', 'Why It Exists']} rows={HISTORY_ROWS} />
        <InfoCard
          title="Current Runtime Gap"
          accent="red"
          body="We now have assignment lineage and a protocol registry, but not yet protocol revision history with publish lineage. The future authoring workflow should close that gap before the protocol system is treated as fully mature."
        />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Explicit v2 Deferrals">
        <DataTable columns={['Deferred Scope', 'Reason']} rows={DEFER_ROWS} />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckProtocolAuthoringWorkflowTab;
