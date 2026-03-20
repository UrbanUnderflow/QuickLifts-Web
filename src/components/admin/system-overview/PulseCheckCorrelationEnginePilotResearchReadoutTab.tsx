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
  ['Correlation Engine Pilot Dashboard', 'Defines what the team should observe inside one pilot.', 'The Research Readout must consume this governed pilot surface rather than inventing its own data frame.'],
  ['Pilot Dashboard Addendum', 'Locks denominator vocabulary and reporting-separation rules.', 'The Research Readout must preserve those same layer boundaries in generated interpretation.'],
  ['Pilot Ops Runbook', 'Defines what humans do when pilot signals require action.', 'The Research Readout may surface implications, but it does not replace review or triage ownership.'],
  ['Pilot Research Readout', 'Interprets what a pilot may mean, with caveats and review state.', 'This is the evidence-bounded interpretation layer, not the source of official truth by itself.'],
];

const PLACEMENT_ROWS = [
  ['Surface placement', 'Research Readout tab inside `/admin/pulsecheckPilotDashboard/[pilotId]`.', 'Keeps the readout visibly downstream of the governed pilot dashboard and adjacent to Overview, Findings, and Hypotheses.'],
  ['Scope root', 'One `pilotId` is always required.', 'The readout is never global and never team-wide by default.'],
  ['Filter context', 'Optional date window and optional `cohortId` filter.', 'The exact evidence frame must be frozen and saved with the generated readout.'],
  ['Entry posture', 'Manual `Generate AI Readout` action in V1.', 'Human reviewers stay in control and can inspect the supporting dashboard evidence before accepting anything.'],
];

const READINESS_ROWS = [
  ['Pilot status gate', 'Pilot must be `active` or `completed`.', 'Draft, paused, or archived pilots should not generate official readouts.'],
  ['Sample-size gate', 'Minimum eligible pilot-athlete threshold must be met for each generated section.', 'If the threshold is missed, that section should say `insufficient evidence for interpretation`.'],
  ['Telemetry-completeness gate', 'Minimum completeness threshold must be met for the metrics or hypotheses being discussed.', 'The readout should suppress unsupported sections rather than decorating thin evidence.'],
  ['Freshness gate', 'No unresolved major stale-data or recompute-risk warnings for the evidence frame being summarized.', 'The readout should not present stale or unstable evidence as current insight.'],
  ['Denominator gate', 'Every summarized metric or claim must have an explicit denominator available in the governed read model.', 'If the denominator is missing, the claim is blocked.'],
];

const CLAIM_ROWS = [
  ['Observed', 'Directly supported by the frozen pilot read model.', 'Allowed example: `18 of 42 eligible pilot athletes reached at least one stable pattern during the selected period.`'],
  ['Inferred', 'Interpretation drawn from observed evidence with bounded confidence.', 'Allowed example: `The pattern is consistent with improved personalization readiness, but outcome validation remains incomplete.`'],
  ['Speculative', 'A forward-looking or weakly supported idea that may guide follow-up research.', 'Allowed example: `This may indicate a cohort-specific recovery threshold effect that requires replication.`'],
];

const BASELINE_ROWS = [
  ['Within-athlete comparison', 'Compares an athlete against their own prior state or matched conditions.', 'Preferred when discussing change, improvement, or response over time.'],
  ['Cross-cohort comparison', 'Compares one cohort inside the same pilot against another cohort.', 'Must name both cohorts and state any completeness or size imbalance.'],
  ['Pre-pilot baseline context', 'Uses clearly labeled pre-pilot history as context.', 'Must stay visually separate from pilot-period KPIs and claims.'],
  ['No baseline available', 'Describes the pilot state without a comparison frame.', 'The readout must not imply improvement, decline, or causal effect in this mode.'],
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
  ['`pulsecheck-pilot-research-readout-revisions/{revisionId}`', 'Optional append-only revision or supersession log when approved readouts are regenerated or materially revised.', 'Preserves governance-grade lineage without mutating prior accepted output silently.'],
  ['Frozen evidence payload reference', 'Reference or embedded snapshot metadata for the exact pilot dashboard frame used to generate the readout.', 'Ties the interpretation to one reproducible evidence frame.'],
  ['Hypothesis linkage fields', 'Persist hypothesis codes referenced by each section and claim.', 'Supports traceability back to official pilot hypotheses.'],
];

const API_ROWS = [
  ['`getPilotResearchReadouts(pilotId)`', 'List saved readouts for one pilot ordered by generation date.', 'Supports tab history, approval review, and superseded readout browsing.'],
  ['`generatePilotResearchReadout(input)`', 'Run readiness checks, freeze the evidence frame, call the AI layer, and save a draft readout.', 'V1 manual generation entry point.'],
  ['`updatePilotResearchReadoutReview(input)`', 'Persist review state, section resolutions, reviewer notes, and approval metadata.', 'Keeps human review authoritative.'],
  ['`supersedePilotResearchReadout(readoutId)`', 'Mark an older approved readout as superseded when a newer governed version replaces it.', 'Protects historical traceability.'],
];

const UI_STATE_ROWS = [
  ['Empty', 'No saved readout exists yet for the selected pilot/filter frame.', 'Show readiness requirements, generation controls, and what the tab will produce.'],
  ['Generating', 'A readout is being generated for a frozen pilot frame.', 'Lock the controls, show the frozen scope summary, and avoid implying the draft is available until saved.'],
  ['Draft Ready', 'A generated draft exists and is waiting for human review.', 'Show section-by-section citations, claim tags, and reviewer controls.'],
  ['Reviewed / Approved', 'A reviewer has accepted or revised the draft into governance-grade output.', 'Display review metadata prominently and allow supersession, not silent overwrite.'],
  ['Suppressed Section', 'A section failed readiness or evidence requirements.', 'Show the exact suppression reason instead of generic summary text.'],
];

const TICKET_ROWS = [
  ['R1', 'Define readout Firestore schema and exported TypeScript contracts.', 'Platform + web', 'Unblocks storage, renderer typing, and review workflow.'],
  ['R2', 'Build pilot readout readiness evaluator against the governed dashboard read model.', 'Platform', 'Prevents unsupported generations.'],
  ['R3', 'Create manual generation action and service/API path for one pilot frame.', 'Web + platform', 'V1 generation entry point.'],
  ['R4', 'Build Research Readout tab UI with empty, generating, draft, approved, and suppressed states.', 'Web', 'Makes the product surface match the implementation spec.'],
  ['R5', 'Persist review state, section resolutions, reviewer notes, and supersession handling.', 'Web + platform', 'Human review must be first-class, not an afterthought.'],
  ['R6', 'Add section citations, claim tags, denominators, and limitation rendering in the UI.', 'Web', 'Keeps the AI layer auditable instead of magical.'],
  ['R7', 'Write QA cases for readiness suppression, baseline labeling, and hypothesis-status suggestion boundaries.', 'QA + product', 'Protects against overclaiming and governance drift.'],
];

const REVIEW_ROWS = [
  ['Readout review state', '`draft`, `reviewed`, `approved`, `superseded`', 'Tracks whether the generated readout has become governance-grade output or remains a draft artifact.'],
  ['Section reviewer resolution', '`accepted`, `revised`, `rejected`, `carry-forward`', 'Lets reviewers operationalize or reject sections instead of letting generated drafts accumulate silently.'],
  ['Hypothesis authority rule', 'AI may suggest a hypothesis status but cannot set the official pilot-dashboard status alone.', 'A human reviewer remains the final authority for official hypothesis posture.'],
];

const METADATA_ROWS = [
  ['Readout-level metadata', '`readoutId`, `pilotId`, generation timestamp, model version, prompt version, read-model version, date window, cohort filter, baseline mode, readiness result, review state', 'Makes every readout reproducible and auditable later.'],
  ['Claim-level metadata', 'Claim type, denominator, evidence sources, confidence, baseline comparison mode, caveat flag, and linked limitations', 'Prevents unsupported statements from appearing as free-floating conclusions.'],
  ['Evidence freeze', 'Exact KPI snapshot or governed read-model payload used for generation', 'The readout must be tied to one frozen evidence frame rather than a moving dashboard target.'],
  ['Citation-by-section', 'Dashboard block or metric family used, related hypotheses, and active limitations', 'Every section should point back to its source frame even when the prose is AI-generated.'],
];

const RULES = [
  'The Research Readout is a research copilot, not an autonomous analyst.',
  'The readout must consume the governed pilot dashboard read model, not raw ad hoc queries or mutable live logic.',
  'If a section does not meet readiness thresholds, suppress the claim and say why instead of softening into vague helpful language.',
  'Do not collapse engine health, evidence quality, insight production, outcome validation, adoption, and hypothesis governance into one blended success story.',
  'Do not use causal language unless the pilot design and evidence frame truly support it.',
  'Every saved readout must preserve enough metadata for a later reviewer to reproduce the evidence frame and understand why the claim was generated.',
];

const RELEASE_ROWS = [
  ['V1', 'Manual generation, frozen evidence frame, readiness gate, structured section output, hypothesis suggestions, reviewer state, and reproducibility metadata.', 'Gets the team an auditable AI-assisted interpretation layer without pretending the system can self-govern.'],
  ['V2', 'Automated weekly draft generation, richer outcome-validation narratives, adoption-aware synthesis, publishable-candidate queue, and assisted follow-up analysis planning.', 'Only unlock after the pilot telemetry and review workflow are mature enough to support automation responsibly.'],
];

const PulseCheckCorrelationEnginePilotResearchReadoutTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Physiology-Cognition Correlation Engine"
        title="Pilot Research Readout Implementation Spec"
        version="Version 1.0 | March 20, 2026"
        summary="Implementation spec for the pilot-scoped Research Readout layer inside the Correlation Engine Pilot Dashboard. This artifact defines how AI-assisted pilot interpretation should work without drifting into freeform analysis: where the readout lives, what evidence frame it may use, when generation is allowed, how claims must be tagged and traced, and how human review governs the final result."
        highlights={[
          {
            title: 'Research Copilot, Not Autonomous Analyst',
            body: 'The readout may interpret governed pilot evidence, but it cannot silently set official truth or replace human hypothesis review.',
          },
          {
            title: 'Frozen Evidence Frame',
            body: 'Every generated readout must lock to one pilot, one date window, one cohort filter, one read-model version, and one KPI snapshot or equivalent evidence payload.',
          },
          {
            title: 'Claim Discipline Is Mandatory',
            body: 'Every generated statement must be tagged as Observed, Inferred, or Speculative, and unsupported sections should be suppressed rather than decorated with vague language.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Pilot-scoped AI-assisted interpretation layer for governed dashboard evidence. It defines how the Research Readout tab should be generated, constrained, stored, reviewed, and reproduced."
        sourceOfTruth="This document is authoritative for Pilot Research Readout placement, gating, output schema, metadata, and human-review workflow. It is not authoritative for the pilot dashboard KPI definitions, engine confidence rules, or provisioning scope model."
        masterReference="Use this page when implementing the Research Readout tab, save model, prompt inputs, review workflow, or any AI-assisted pilot summary behavior."
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

      <SectionBlock icon={LayoutPanelTop} title="Tab UI States">
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
            body="If the evidence frame does not support a section, the system should say so directly with a reason like `insufficient evidence for interpretation`, `sample too small`, `telemetry coverage too uneven`, or `baseline comparison unavailable`."
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
