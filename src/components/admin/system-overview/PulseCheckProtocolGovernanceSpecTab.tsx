import React from 'react';
import { AlertTriangle, BookCopy, Compass, GitBranch, ShieldCheck, TestTube2, FileText, Bot, Radar, ClipboardCheck, Shield, LineChart, History, Wrench } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock } from './PulseCheckRuntimeDocPrimitives';
import ArtifactPageLibrary, { ArtifactPageEntry } from './ArtifactPageLibrary';
import PulseCheckProtocolAuthoringWorkflowTab from './PulseCheckProtocolAuthoringWorkflowTab';
import PulseCheckProtocolResponsivenessProfileSpecTab from './PulseCheckProtocolResponsivenessProfileSpecTab';
import PulseCheckProtocolResponsivenessInspectorTab from './PulseCheckProtocolResponsivenessInspectorTab';
import PulseCheckProtocolLaunchReadinessTab from './PulseCheckProtocolLaunchReadinessTab';
import PulseCheckProtocolPlannerPolicyEnforcementTab from './PulseCheckProtocolPlannerPolicyEnforcementTab';
import PulseCheckProtocolPracticeConversationSpecTab from './PulseCheckProtocolPracticeConversationSpecTab';
import PulseCheckProtocolEvidenceDashboardTab from './PulseCheckProtocolEvidenceDashboardTab';
import PulseCheckProtocolRevisionAuditTraceTab from './PulseCheckProtocolRevisionAuditTraceTab';
import PulseCheckProtocolOpsRunbookTab from './PulseCheckProtocolOpsRunbookTab';
import PulseCheckProtocolLaunchQaMatrixTab from './PulseCheckProtocolLaunchQaMatrixTab';

const PRINCIPLE_ROWS = [
  ['Protocols are state interventions, not content cards', 'A protocol exists to change athlete state so a rep, trial, or recovery window becomes more useful.'],
  ['Sibling to sims, not a sim subtype', 'Protocols should be governed with similar rigor to sims, but they do not inherit sim build, package, or trial-spec assumptions.'],
  ['Mechanism before wording', 'A protocol is defined by what it is trying to change and how, not just by nice athlete-facing copy.'],
  ['Bounded runtime inventory only', 'Nora may only assign published active protocols from the registry, never invent ad hoc interventions at runtime.'],
  ['Evidence and safety over novelty', 'Research quality, response signal, and misuse risk matter more than whether a protocol feels creative or popular.'],
  ['Families, variants, and runtime records must stay distinct', 'The intervention family, authored variant, and published runtime object should not collapse into one ambiguous record.'],
];

const OBJECT_ROWS = [
  ['Protocol Family', 'The conceptual intervention lane', 'Defines mechanism, intended state shift, use window, contraindications, and review boundaries.'],
  ['Protocol Variant', 'A designed expression of the family', 'Specifies delivery mode, dose, script pattern, prompts, and authoring notes for one candidate version.'],
  ['Published Runtime Record', 'What Nora can actually assign', 'The bounded registry object with publish status, trigger tags, dose, source exercise, and planning metadata.'],
  ['Protocol Evidence Record', 'Outcome and responsiveness data', 'Captures assignment events, athlete response, snapshot delta, downstream sim impact, and negative-response signals.'],
  ['Protocol Research Note', 'Discovery and rationale layer', 'Documents source literature, mechanism claim, design assumptions, and reasons for inclusion or rejection.'],
  ['Athlete Responsiveness Profile', 'Per-athlete preference/effectiveness memory', 'Tracks which protocol families or response families tend to help, do nothing, or backfire for a given athlete.'],
];

const ENTRY_ROWS = [
  ['Research nomination', 'New literature, expert source, or strong practical precedent suggests a valid intervention worth testing.'],
  ['Coach / operator nomination', 'Staff repeatedly observe a state bottleneck not well served by the current bounded inventory.'],
  ['Runtime gap signal', 'Candidate-set inventory gaps or repeated defers indicate the planner lacks a useful protocol option.'],
  ['Athlete response pattern', 'Existing protocol usage suggests a missing sibling intervention or a need for a more targeted variant.'],
];

const LIFECYCLE_ROWS = [
  ['Nominated', 'Idea captured with mechanism hypothesis, target state shift, source references, and closest existing family comparison.'],
  ['Structured', 'Family and variant shape are defined clearly enough to review against current inventory and misuse risk.'],
  ['Sandbox', 'Variant can be tested internally or in shadow evaluation without becoming a published Nora option.'],
  ['Pilot', 'The candidate can be selectively used to gather bounded evidence under explicit review.'],
  ['Published', 'The runtime record is active and assignable by Nora within policy rails.'],
  ['Restricted', 'The protocol remains known but is narrowed to specific windows, sports, or review-required contexts.'],
  ['Archived', 'The protocol is retired from assignment eligibility, with history preserved.'],
];

const EVIDENCE_ROWS = [
  ['Immediate self-report shift', 'Did the athlete say the state moved in the intended direction after completion?'],
  ['Snapshot delta', 'Did the next state snapshot improve, stabilize, or worsen in the expected dimensions?'],
  ['Downstream execution effect', 'Did the follow-on sim, trial, or real-world rep become more useful after the protocol?'],
  ['Adoption / completion rate', 'Do athletes actually finish this protocol when it is assigned in the target window?'],
  ['Negative-response rate', 'How often does the protocol create worse state, resistance, confusion, or mistimed arousal?'],
  ['Athlete-specific responsiveness', 'Which athletes, contexts, or state signatures seem to benefit or not benefit over time?'],
];

const GOVERNANCE_RULE_ROWS = [
  ['New family threshold', 'Create a new protocol family only when the mechanism, use window, and expected state shift are genuinely different from existing families.'],
  ['Variant threshold', 'Create a new variant when the family stays the same but dose, prompts, delivery, or window needs a meaningfully different expression.'],
  ['Publish rule', 'A runtime record can only be published once the variant is specified, bounded, and reviewed for misuse risk and evidence rationale.'],
  ['Registry boundary', 'Only published runtime records belong in the assignable Nora inventory; family and draft variant exploration stay upstream.'],
  ['Archive rule', 'Archive when the protocol is ineffective, duplicative, unsafe in practice, or superseded by a better sibling.'],
  ['Review cadence', 'Published protocols should be reviewed on a recurring cadence with evidence summaries, not left in the registry indefinitely without governance.'],
];

const GAP_ROWS = [
  ['Authoring depth', 'We now have a family/variant/runtime workspace, but the approval flow, evidence review packet, and governance rigor are still early compared with the sim side.'],
  ['Responsiveness memory', 'A first-pass athlete-level responsiveness service and planner weighting path now exist, but the evidence model is still early compared with the sim-side governance stack.'],
  ['Evidence model', 'We do not yet have a fully formal protocol-effectiveness dashboard or review packet like the sim-side governance stack.'],
  ['Sequencing model', 'Protocols are still mostly selected as single records, not as reviewed bundles or sequence patterns. This is explicitly deferred to v2.'],
];

const ProtocolGovernanceOverviewDoc: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Runtime"
        title="Protocol Governance Spec"
        version="Version 0.1 | March 17, 2026"
        summary="Governance-layer artifact for how PulseCheck should define, discover, evaluate, publish, and retire Nora protocols. This page treats protocols as bounded state interventions with their own ontology, evidence model, and review lifecycle rather than as lightweight content cards or sim variants in disguise."
        highlights={[
          {
            title: 'Protocols Are Their Own System',
            body: 'They deserve rigor similar to sim families, but with intervention- and state-shift-specific governance rather than sim-build assumptions.',
          },
          {
            title: 'Family, Variant, Runtime Record',
            body: 'The conceptual intervention family, designed variant, and assignable published record should be modeled separately.',
          },
          {
            title: 'Research + Runtime Evidence',
            body: 'Protocol governance should blend source literature, expert rationale, and live athlete-response evidence before widening runtime availability.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Governance artifact for PulseCheck protocols. It defines how a protocol enters the system, what kinds of protocol objects exist, how publish eligibility is decided, and how effectiveness should be monitored after a protocol becomes assignable."
        sourceOfTruth="This document is authoritative for protocol ontology, publish lifecycle, and evidence expectations. It complements the Protocol Registry tab, which shows runtime inventory, and the Nora Assignment Rules, which define how Nora selects among published options."
        masterReference="Use the Variant Registry and Sim Family Promotion Protocol as the closest governance analogs, but do not assume protocols should inherit the same object model or evidence standard one-for-one."
        relatedDocs={[
          'Protocol Registry',
          'Protocol Responsiveness Profile Spec',
          'Nora Assignment Rules',
          'Sim Family Promotion Protocol',
        ]}
      />

      <SectionBlock icon={Compass} title="Governing Principles">
        <DataTable columns={['Principle', 'Meaning']} rows={PRINCIPLE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={BookCopy} title="Canonical Object Model">
        <DataTable columns={['Object', 'Role', 'Meaning']} rows={OBJECT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={GitBranch} title="Entry and Lifecycle">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="How New Protocols Should Enter"
            accent="blue"
            body={<DataTable columns={['Entry Path', 'When It Applies']} rows={ENTRY_ROWS} />}
          />
          <InfoCard
            title="Lifecycle States"
            accent="green"
            body={<DataTable columns={['State', 'Meaning']} rows={LIFECYCLE_ROWS} />}
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={TestTube2} title="Evidence Model">
        <DataTable columns={['Evidence Signal', 'Why It Matters']} rows={EVIDENCE_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="What Makes Protocol Evidence Different"
            accent="amber"
            body="A protocol is not primarily judged by task performance in isolation. It should be judged by whether it changes state in the intended direction and whether that makes downstream execution more useful."
          />
          <InfoCard
            title="Why Athlete Responsiveness Matters"
            accent="purple"
            body="Two athletes can both be Yellow, but one may respond well to acute breathing while another responds better to cue-word or imagery priming. Governance should anticipate that the system will learn those differences over time."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Governance Rules">
        <DataTable columns={['Decision Point', 'Rule']} rows={GOVERNANCE_RULE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Current Gaps">
        <DataTable columns={['Gap', 'Why It Matters']} rows={GAP_ROWS} />
        <InfoCard
          title="Current Runtime Truth"
          accent="amber"
          body={
            <BulletList
              items={[
                'We now have a sibling runtime registry and a broader bounded inventory.',
                'We now have separate family, variant, and runtime records plus first-pass review and evidence panels in the registry workspace.',
                'We now have a first-pass athlete-level responsiveness service, candidate ranking, and coach-visible explanation traces, but not the full long-horizon evidence stack yet.',
                'This spec is the bridge between today’s runtime registry and the deeper authoring workflow we should build next.',
              ]}
            />
          }
        />
        <InfoCard
          title="Explicit v2 Deferral"
          accent="red"
          body="Protocol bundles, stacks, and sequencing rules are intentionally out of scope for this v1 governance model. The system should first learn how to define, review, and personalize single protocols well before moving into multi-step intervention design."
        />
      </SectionBlock>
    </div>
  );
};

const PROTOCOL_SYSTEM_PAGES: ArtifactPageEntry[] = [
  {
    id: 'governance-overview',
    label: 'Governance Overview',
    subtitle: 'Ontology, lifecycle, evidence model, and review rules for protocols.',
    icon: FileText,
    accent: '#c084fc',
    render: () => <ProtocolGovernanceOverviewDoc />,
  },
  {
    id: 'authoring-workflow',
    label: 'Authoring Workflow',
    subtitle: 'Workspace, publish controls, change classes, and revision model.',
    icon: Bot,
    accent: '#38bdf8',
    render: () => <PulseCheckProtocolAuthoringWorkflowTab />,
  },
  {
    id: 'responsiveness-profile',
    label: 'Responsiveness Profile Spec',
    subtitle: 'Athlete-level protocol response memory and planner weighting.',
    icon: Radar,
    accent: '#22c55e',
    render: () => <PulseCheckProtocolResponsivenessProfileSpecTab />,
  },
  {
    id: 'responsiveness-inspector',
    label: 'Responsiveness Inspector',
    subtitle: 'Read-only operator surface for browsing responsiveness memory.',
    icon: Compass,
    accent: '#f59e0b',
    render: () => <PulseCheckProtocolResponsivenessInspectorTab />,
  },
  {
    id: 'launch-readiness',
    label: 'Launch Readiness',
    subtitle: 'Go / no-go launch gates for registry, evidence, ops, and QA.',
    icon: ClipboardCheck,
    accent: '#14b8a6',
    render: () => <PulseCheckProtocolLaunchReadinessTab />,
  },
  {
    id: 'planner-policy',
    label: 'Planner Policy Enforcement',
    subtitle: 'Eligibility, filtering order, validator rules, and failure handling.',
    icon: Shield,
    accent: '#ef4444',
    render: () => <PulseCheckProtocolPlannerPolicyEnforcementTab />,
  },
  {
    id: 'practice-conversation',
    label: 'Practice Conversation Spec',
    subtitle: 'Teach, practice, evaluate runtime contract for Nora-guided protocol application.',
    icon: Bot,
    accent: '#14b8a6',
    render: () => <PulseCheckProtocolPracticeConversationSpecTab />,
  },
  {
    id: 'evidence-dashboard',
    label: 'Evidence Dashboard',
    subtitle: 'Monitoring and review dashboard for protocol effectiveness and risk.',
    icon: LineChart,
    accent: '#06b6d4',
    render: () => <PulseCheckProtocolEvidenceDashboardTab />,
  },
  {
    id: 'revision-audit',
    label: 'Revision & Audit Trace',
    subtitle: 'Lineage, planner traceability, and assignment provenance.',
    icon: History,
    accent: '#f97316',
    render: () => <PulseCheckProtocolRevisionAuditTraceTab />,
  },
  {
    id: 'ops-runbook',
    label: 'Ops Runbook',
    subtitle: 'Operational containment, triage, ownership, and recovery playbook.',
    icon: Wrench,
    accent: '#fb7185',
    render: () => <PulseCheckProtocolOpsRunbookTab />,
  },
  {
    id: 'launch-qa-matrix',
    label: 'Launch QA Matrix',
    subtitle: 'Launch-blocking scenario matrix for readiness and audit visibility.',
    icon: TestTube2,
    accent: '#eab308',
    render: () => <PulseCheckProtocolLaunchQaMatrixTab />,
  },
];

const PulseCheckProtocolGovernanceSpecTab: React.FC = () => {
  return (
    <ArtifactPageLibrary
      eyebrow="Pulse Check · Protocol System"
      title="Protocol System Library"
      summary="Governance parent artifact with internal pages for protocol authoring, responsiveness, launch controls, evidence, auditability, and live-ops discipline."
      entries={PROTOCOL_SYSTEM_PAGES}
    />
  );
};

export default PulseCheckProtocolGovernanceSpecTab;
