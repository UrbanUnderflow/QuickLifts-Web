import React from 'react';
import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileText,
  LayoutPanelTop,
  ShieldCheck,
  Waypoints,
} from 'lucide-react';
import {
  BulletList,
  CardGrid,
  DataTable,
  DocHeader,
  InfoCard,
  RuntimeAlignmentPanel,
  SectionBlock,
} from './PulseCheckRuntimeDocPrimitives';

const STACK_ROWS = [
  ['Correlation Engine Pilot Dashboard', 'Defines what the team should observe inside one pilot.', 'The Research Readout consumes this governed surface as its evidence frame.'],
  ['Pilot Dashboard Addendum', 'Locks denominator vocabulary and reporting-separation rules.', 'The Research Readout must preserve those same layer boundaries in generated interpretation.'],
  ['Pilot Ops Runbook', 'Defines what humans do when pilot signals require action.', 'The Research Readout may surface implications. Human review and triage owners retain decision authority.'],
  ['Pilot Research Readout', 'Interprets what a pilot may mean, with caveats and review state.', 'This evidence-bounded interpretation layer becomes governance-grade output through human review and approval.'],
];

const PLACEMENT_ROWS = [
  ['Surface placement', 'Research Readout workspace inside Insights & Research at `/admin/pulsecheckPilotDashboard/[pilotId]`.', 'Keeps findings, hypotheses, generated interpretation, limitations, and review history together inside one governed research area.'],
  ['Scope root', 'One `pilotId` is always required.', 'Every readout stays inside the selected pilot frame.'],
  ['Filter context', 'Optional date window and optional `cohortId` filter.', 'The exact evidence frame must be frozen and saved with the generated readout.'],
  ['Entry posture', 'Manual `Generate AI Readout` action in V1.', 'Human reviewers stay in control and can inspect the supporting dashboard evidence before accepting anything.'],
];

const READINESS_ROWS = [
  ['Pilot status gate', 'Pilot must be `active` or `completed`.', 'Official readout generation is available for active and completed pilot states.'],
  ['Sample-size gate', 'Minimum eligible pilot-athlete threshold must be met for each generated section.', 'If the threshold is missed, that section should say `insufficient evidence for interpretation`.'],
  ['Telemetry-completeness gate', 'Minimum completeness threshold must be met for the metrics or hypotheses being discussed.', 'Suppress unsupported sections and state the completeness reason.'],
  ['Freshness gate', 'The evidence frame has clear major stale-data and recompute-risk checks.', 'Resolve major freshness risks or label the affected evidence as historical or unstable.'],
  ['Denominator gate', 'Every summarized metric or claim must have an explicit denominator available in the governed read model.', 'If the denominator is missing, the claim is blocked.'],
];

const CLAIM_ROWS = [
  ['Observed', 'Directly supported by the frozen pilot read model.', 'Allowed example: `18 of 42 eligible pilot athletes reached at least one stable pattern during the selected period.`'],
  ['Inferred', 'Interpretation drawn from observed evidence with bounded confidence.', 'Allowed example: `The pattern is consistent with improved personalization readiness. Outcome validation remains incomplete.`'],
  ['Speculative', 'A forward-looking or weakly supported idea that may guide follow-up research.', 'Allowed example: `This may indicate a cohort-specific recovery threshold effect that requires replication.`'],
];

const BASELINE_ROWS = [
  ['Within-athlete comparison', 'Compares an athlete against their own prior state or matched conditions.', 'Preferred when discussing change, improvement, or response over time.'],
  ['Cross-cohort comparison', 'Compares one cohort inside the same pilot against another cohort.', 'Must name both cohorts and state any completeness or size imbalance.'],
  ['Pre-pilot baseline context', 'Uses clearly labeled pre-pilot history as context.', 'Must stay visually separate from pilot-period KPIs and claims.'],
  ['No baseline available', 'Describes the pilot state with a state-only frame.', 'Use state language and reserve improvement, decline, and causal claims for evidence frames with a supported comparison.'],
];

const TRACE_ROWS = [
  ['Pilot Summary', 'Pilot identity, period covered, cohort filter, participant/completeness summary, and the dashboard blocks used.'],
  ['Hypothesis Mapper', 'Hypothesis IDs referenced, supporting evidence, contradicting evidence, denominators, and status suggestion rationale.'],
  ['Findings Interpreter', 'Which findings-layer metrics, evidence-quality signals, and limitations informed the interpretation.'],
  ['Research Notes', 'Candidate publishable-finding framing, confounders, replication needs, and claim-type tags.'],
  ['Limitations', 'Active missing telemetry, stale-data posture, cohort imbalance, low adherence, unresolved contradictions, and any blocked sections.'],
];

const OUTPUT_ROWS = [
  ['Pilot Summary', 'Plain-language statement of what pilot ran, when, which cohorts were included, and whether the evidence frame met readiness.'],
  ['Hypothesis Mapper', 'Structured evidence review for each active pilot hypothesis, including a suggested status that still requires human acceptance.'],
  ['Findings Interpreter', 'Narrative explanation of strongest signals, weakest signals, and where the engine may be over-reading sparse evidence.'],
  ['Research Notes', 'Candidate publishable findings, framed cautiously and paired with caveats, confounders, and replication needs.'],
  ['Limitations', 'Explicit uncertainty layer that explains what weakens interpretation or blocks stronger claims.'],
];

const DATA_MODEL_ROWS = [
  ['`pulsecheck-pilot-research-readouts/{readoutId}`', 'Stores the generated readout body, frozen evidence-frame metadata, readiness result, review state, and reviewer audit fields.', 'Canonical saved readout artifact.'],
  ['`pulsecheck-pilot-research-readout-revisions/{revisionId}`', 'Optional append-only revision or supersession log when approved readouts are regenerated or materially revised.', 'Preserves prior accepted output and governance-grade lineage across revisions.'],
  ['Frozen evidence payload reference', 'Reference or embedded snapshot metadata for the exact pilot dashboard frame used to generate the readout.', 'Ties the interpretation to one reproducible evidence frame.'],
  ['Hypothesis linkage fields', 'Persist hypothesis codes referenced by each section and claim.', 'Supports traceability back to official pilot hypotheses.'],
];

const API_ROWS = [
  ['`getPilotResearchReadouts(pilotId)`', 'List saved readouts for one pilot ordered by generation date.', 'Supports research history, approval review, and superseded readout browsing.'],
  ['`generatePilotResearchReadout(input)`', 'Run readiness checks, freeze the evidence frame, call the AI layer, and save a draft readout.', 'V1 manual generation entry point.'],
  ['`updatePilotResearchReadoutReview(input)`', 'Persist review state, section resolutions, reviewer notes, and approval metadata.', 'Keeps human review authoritative.'],
  ['`supersedePilotResearchReadout(readoutId)`', 'Mark an older approved readout as superseded when a newer governed version replaces it.', 'Protects historical traceability.'],
];

const UI_STATE_ROWS = [
  ['Empty', 'No saved readout exists yet for the selected pilot/filter frame.', 'Show readiness requirements, generation controls, and what the tab will produce.'],
  ['Generating', 'A readout is being generated for a frozen pilot frame.', 'Lock the controls, show the frozen scope summary, and show draft availability after the save completes.'],
  ['Draft Ready', 'A generated draft exists and is waiting for human review.', 'Show section-by-section citations, claim tags, and reviewer controls.'],
  ['Reviewed / Approved', 'A reviewer has accepted or revised the draft into governance-grade output.', 'Display review metadata prominently and preserve approved history through supersession.'],
  ['Suppressed Section', 'A section failed readiness or evidence requirements.', 'Show the exact suppression reason in the section.'],
];

const TICKET_ROWS = [
  ['R1', 'Define readout Firestore schema and exported TypeScript contracts.', 'Platform + web', 'Unblocks storage, renderer typing, and review workflow.'],
  ['R2', 'Build pilot readout readiness evaluator against the governed dashboard read model.', 'Platform', 'Prevents unsupported generations.'],
  ['R3', 'Create manual generation action and service/API path for one pilot frame.', 'Web + platform', 'V1 generation entry point.'],
  ['R4', 'Build the Research Readout workspace inside Insights & Research with empty, generating, draft, approved, and suppressed states.', 'Web', 'Makes the product surface match the task-based pilot dashboard structure.'],
  ['R5', 'Persist review state, section resolutions, reviewer notes, and supersession handling.', 'Web + platform', 'Human review remains a first-class part of the workflow.'],
  ['R6', 'Add section citations, claim tags, denominators, and limitation rendering in the UI.', 'Web', 'Keeps the AI layer auditable and evidence-bounded.'],
  ['R7', 'Write QA cases for readiness suppression, baseline labeling, and hypothesis-status suggestion boundaries.', 'QA + product', 'Protects against overclaiming and governance drift.'],
];

const REVIEW_ROWS = [
  ['Readout review state', '`draft`, `reviewed`, `approved`, `superseded`', 'Tracks whether the generated readout has become governance-grade output or remains a draft artifact.'],
  ['Section reviewer resolution', '`accepted`, `revised`, `rejected`, `carry-forward`', 'Gives every generated section an explicit reviewer decision.'],
  ['Hypothesis authority rule', 'AI may suggest a hypothesis status.', 'A human reviewer sets the official hypothesis posture.'],
];

const METADATA_ROWS = [
  ['Readout-level metadata', '`readoutId`, `pilotId`, generation timestamp, model version, prompt version, read-model version, date window, cohort filter, baseline mode, readiness result, review state', 'Makes every readout reproducible and auditable later.'],
  ['Claim-level metadata', 'Claim type, denominator, evidence sources, confidence, baseline comparison mode, caveat flag, and linked limitations', 'Prevents unsupported statements from appearing as free-floating conclusions.'],
  ['Evidence freeze', 'Exact KPI snapshot or governed read-model payload used for generation', 'Every readout ties to one frozen evidence frame.'],
  ['Citation-by-section', 'Dashboard block or metric family used, related hypotheses, and active limitations', 'Every section should point back to its source frame even when the prose is AI-generated.'],
];

const RULES = [
  'The Research Readout serves as a research copilot under human review authority.',
  'The readout consumes the governed pilot dashboard read model and its frozen evidence frame.',
  'A section below its readiness threshold is suppressed with a specific reason.',
  'Engine health, evidence quality, insight production, outcome validation, adoption, and hypothesis governance keep separate meanings in every readout.',
  'Causal language requires a pilot design and evidence frame that support a causal claim.',
  'Every saved readout must preserve enough metadata for a later reviewer to reproduce the evidence frame and understand why the claim was generated.',
];

const RELEASE_ROWS = [
  ['V1', 'Manual generation, frozen evidence frame, readiness gate, structured section output, hypothesis suggestions, reviewer state, and reproducibility metadata.', 'Gives the team an auditable AI-assisted interpretation layer with human governance.'],
  ['V2', 'Automated weekly draft generation, richer outcome-validation narratives, adoption-aware synthesis, publishable-candidate queue, and assisted follow-up analysis planning.', 'Only unlock after the pilot telemetry and review workflow are mature enough to support automation responsibly.'],
];

const PulseCheckCorrelationEnginePilotResearchReadoutTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Physiology-Cognition Correlation Engine"
        title="Pilot Research Readout Implementation Spec"
        version="Version 1.1 | August 23, 2026"
        summary="Implementation spec for the pilot-scoped Research Readout workspace inside Insights & Research. This artifact defines its placement, allowed evidence frame, generation gate, claim trace, and human-review workflow."
        highlights={[
          {
            title: 'Research Copilot With Human Authority',
            body: 'The readout interprets governed pilot evidence. Human review establishes official hypothesis posture and approved output.',
          },
          {
            title: 'Frozen Evidence Frame',
            body: 'Every generated readout must lock to one pilot, one date window, one cohort filter, one read-model version, and one KPI snapshot or equivalent evidence payload.',
          },
          {
            title: 'Claim Discipline Is Mandatory',
            body: 'Every generated statement carries an Observed, Inferred, or Speculative tag. Unsupported sections are suppressed with a specific reason.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Pilot-scoped AI-assisted interpretation layer for governed dashboard evidence inside Insights & Research. It defines how the Research Readout workspace is generated, constrained, stored, reviewed, and reproduced."
        sourceOfTruth="This document is authoritative for Pilot Research Readout placement, gating, output schema, metadata, and human-review workflow. Pilot dashboard KPI definitions, engine confidence rules, and provisioning scope remain governed by their respective contracts."
        masterReference="Use this page when implementing the Research Readout workspace, save model, prompt inputs, review workflow, or any AI-assisted pilot summary behavior."
        relatedDocs={[
          'Correlation Engine Pilot Dashboard',
          'Correlation Engine Pilot Dashboard Addendum',
          'Correlation Engine Pilot Ops Runbook',
          'Correlation Data Model Spec',
          'Correlation Engine Engineering Task Breakdown',
        ]}
      />

      <SectionBlock icon={Waypoints} title="Role In Stack">
        <DataTable columns={['Artifact', 'Primary Job', 'Relationship To This Spec']} rows={STACK_ROWS} />
      </SectionBlock>

      <SectionBlock icon={LayoutPanelTop} title="Placement And Route Contract">
        <DataTable columns={['Placement Rule', 'Implementation', 'Why']} rows={PLACEMENT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ClipboardCheck} title="Readiness Gate">
        <DataTable columns={['Gate', 'Requirement', 'Failure Behavior']} rows={READINESS_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Claim Discipline And Baseline Rules">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard title="Claim Types" accent="blue" body={<DataTable columns={['Type', 'Meaning', 'Constraint']} rows={CLAIM_ROWS} />} />
          <InfoCard title="Baseline Discipline" accent="green" body={<DataTable columns={['Mode', 'Meaning', 'Rule']} rows={BASELINE_ROWS} />} />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={BarChart3} title="Evidence Trace Contract">
        <DataTable columns={['Readout Section', 'Required Evidence Trace']} rows={TRACE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={FileText} title="Output Schema">
        <DataTable columns={['Section', 'Purpose']} rows={OUTPUT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Implementation Contract">
        <DataTable columns={['Collection / Contract', 'Meaning', 'Why']} rows={DATA_MODEL_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Waypoints} title="Generation API Shape">
        <DataTable columns={['Method', 'Primary Job', 'Why']} rows={API_ROWS} />
      </SectionBlock>

      <SectionBlock icon={LayoutPanelTop} title="Workspace UI States">
        <DataTable columns={['State', 'Meaning', 'Required Behavior']} rows={UI_STATE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={CheckCircle2} title="Save And Review Workflow">
        <DataTable columns={['Workflow Element', 'Allowed States', 'Rule']} rows={REVIEW_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Reproducibility Metadata">
        <DataTable columns={['Metadata Layer', 'Required Fields', 'Why']} rows={METADATA_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Operating Rules">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard title="Non-Negotiable Rules" accent="red" body={<BulletList items={RULES} />} />
          <InfoCard
            title="Unsupported Claim Suppression"
            accent="amber"
            body="An unsupported section states a specific reason such as `insufficient evidence for interpretation`, `sample too small`, `telemetry coverage too uneven`, or `baseline comparison unavailable`."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ClipboardCheck} title="V1 And V2 Boundary">
        <DataTable columns={['Phase', 'Scope', 'Why']} rows={RELEASE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={CheckCircle2} title="First V1 Engineering Tickets">
        <DataTable columns={['Ticket', 'Task', 'Owner', 'Why']} rows={TICKET_ROWS} />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckCorrelationEnginePilotResearchReadoutTab;
