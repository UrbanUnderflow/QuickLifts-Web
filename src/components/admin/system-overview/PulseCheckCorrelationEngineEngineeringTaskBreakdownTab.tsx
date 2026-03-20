import React from 'react';
import { AlertTriangle, BarChart3, Brain, Database, FileText, ShieldCheck, TestTube2, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const STREAM_ROWS = [
  ['Architecture + governance', 'Freeze schema, enums, confidence rules, and shared messaging boundaries before runtime code starts drifting.', 'Product / architecture', 'Immediate'],
  ['Data foundation', 'Stand up canonical engine collections, revision posture, ids, and storage rules for evidence, patterns, and projections.', 'Platform', 'Immediate'],
  ['Evidence generation', 'Turn health-context snapshots plus scored sims into joined Correlation Evidence Records.', 'Platform + PulseCheck iOS', 'Immediate after schema lock'],
  ['Pattern computation', 'Compute Athlete Pattern Models, thresholds, confidence, decay, and contradiction handling.', 'Platform / modeling', 'Near-term'],
  ['Runtime projections', 'Generate Profile-, Nora-, coach-, and protocol-safe Recommendation Projections.', 'Platform + PulseCheck iOS + web', 'After first patterns exist'],
  ['Assessment annotation', 'Extend canonical profile snapshots with `assessmentContextFlag` inside `stateContextAtCapture`.', 'Profile pipeline / platform', 'After pattern confidence exists'],
  ['Pilot dashboard + governance', 'Build the active-pilot directory, pilot detail dashboard, hypothesis tracking, and pilot-scoped review surfaces rooted in `PilotEnrollment` truth.', 'Web + ops + product', 'In parallel with Milestone 6'],
  ['Ops + research', 'Build operator visibility, export paths, inspection tools, and data-quality monitoring.', 'Web + ops + platform', 'Continuous'],
  ['QA + launch', 'Prove evidence quality, projection honesty, stale handling, milestone annotation correctness, and rollout safety before broad release.', 'QA / ops / product', 'Continuous with formal sign-off at launch'],
];

const M0_ROWS = [
  ['Freeze engine v1 contract', 'Mark the parent engine spec and data-model spec as the implementation baseline.', 'Product / architecture', 'Prevents field and enum drift.'],
  ['Close remaining naming gaps', 'Align ids, enums, and confidence labels across Health Context, Profile Snapshot, Protocol, and Runtime docs.', 'Product / architecture', 'Prevents schema mismatch between systems.'],
  ['Write implementation acceptance checklist', 'Define milestone-by-milestone exit criteria for evidence, patterns, projections, profile flags, and launch.', 'Product / architecture', 'Needed for handoff and sign-off.'],
  ['Lock athlete-facing and coach-facing messaging posture', 'Confirm what language may be shown at each confidence tier.', 'Product / design', 'Prevents runtime copy from outrunning evidence.'],
];

const M1_ROWS = [
  ['Create engine Firestore namespace', 'Stand up `athlete-physiology-cognition/{athleteId}` root plus `evidence-records`, `pattern-models`, `revisions`, and `recommendation-projections` stores.', 'Platform', 'Required storage foundation.'],
  ['Define deterministic ids and revision policy', 'Implement `evidenceId`, `patternKey`, `projectionKey`, and revision rollover rules.', 'Platform', 'Needed for idempotency and auditability.'],
  ['Add security placeholders and role boundaries', 'Protect engine records and define which consumers may read athlete, coach, or ops projections.', 'Platform / web', 'Prevents accidental overexposure.'],
  ['Add operator trace stubs', 'Persist enough trace metadata to understand when evidence and patterns are written.', 'Platform + ops', 'Trust foundation, not optional polish.'],
];

const M2_ROWS = [
  ['Map health snapshot inputs into engine-ready physiology posture', 'Transform canonical health-context domains and provenance into the physiology block used by evidence records.', 'Platform', 'Engine should ingest normalized physiology, not vendor payloads.'],
  ['Map scored sims into normalized cognitive outcome block', 'Project sim session results into skill, pillar, and session-quality fields for the evidence record.', 'PulseCheck iOS + platform', 'Allows domain-specific learning instead of only total score learning.'],
  ['Implement evidence writer service', 'Emit append-only Correlation Evidence Records from aligned physiology windows and scored sim sessions.', 'Platform', 'First real runtime object.'],
  ['Implement evidence correction lineage', 'If an evidence record must be corrected, preserve lineage and correction reason instead of silent mutation.', 'Platform', 'Audit safety.'],
  ['Add evidence quality flags', 'Persist missing-signal, mirrored-source, stale-source, and low-variety posture on evidence records.', 'Platform', 'Needed for later confidence scoring.'],
  ['Backfill first historical evidence window', 'Create enough historical evidence from existing health snapshots and sim history to validate the pipeline before consumer rollout.', 'Platform / research', 'Avoids starting the engine from zero at launch.'],
];

const M3_ROWS = [
  ['Implement first pattern family computations', 'Start with sleep-to-decision, sleep-to-focus, HRV-to-focus, HRV-to-composure, and recovery-to-consistency relationships.', 'Modeling / platform', 'Highest-value initial patterns.'],
  ['Compute confidence and freshness posture', 'Assign `directional`, `emerging`, `stable`, `high_confidence`, or `degraded` based on sample size, diversity, recency, and contradiction pressure.', 'Modeling / platform', 'Shared trust model.'],
  ['Implement decay logic', 'Demote stale or contradicted patterns rather than preserving old thresholds forever.', 'Modeling / platform', 'Core product honesty rule.'],
  ['Implement revisioned pattern writes', 'Persist canonical Athlete Pattern Models plus revision history when thresholds or summaries materially change.', 'Platform', 'Audit + research requirement.'],
  ['Add explainability fields', 'Populate athlete summary, coach summary, threshold ranges, and supported consumer tags on pattern models.', 'Platform', 'Consumers need explainable pattern state, not only a score.'],
];

const M4_ROWS = [
  ['Build Profile recommendation projections', 'Generate concise athlete-facing outputs for Profile using stable patterns plus current physiology posture.', 'Platform + PulseCheck iOS', 'First athlete-facing consumer.'],
  ['Build Nora recommendation projections', 'Generate runtime-safe guidance for daily coaching, pacing, and protocol shaping.', 'Platform + PulseCheck iOS', 'Moves Nora off raw physiology interpretation.'],
  ['Build coach-grade projections', 'Generate evidence-rich coach outputs with supporting pattern keys, confidence posture, and state-specific effect summaries.', 'Platform + web', 'Needed for planning use, not just athlete UX.'],
  ['Build protocol planner projections', 'Surface body-state-specific protocol recommendations that tie into the protocol governance system.', 'Platform + planner owners', 'Connects engine to protocol personalization.'],
  ['Add projection validator', 'Ensure rendered outputs are template-safe, confidence-safe, and do not overclaim causality or medical meaning.', 'Platform + product', 'Prevents runtime overreach.'],
  ['Add projection expiration and refresh rules', 'Define when projections become stale and must be recomputed.', 'Platform', 'Runtime freshness requirement.'],
];

const M5_ROWS = [
  ['Extend profile snapshot writer', 'Write `assessmentContextFlag` into `profilePayload.stateContextAtCapture` during Baseline, Midpoint, Endpoint, Retention, and approved staff checkpoints.', 'Profile pipeline / platform', 'Critical integration milestone.'],
  ['Build assessment flag classifier', 'Classify captures as `advantaged`, `normal`, `compromised`, or `unknown` relative to the athlete’s learned patterns.', 'Modeling / platform', 'Turns pattern learning into trial interpretation.'],
  ['Add athlete-safe and coach-detail summaries', 'Persist both shallow and deeper flag explanations inside the assessment context block.', 'Platform + product', 'Supports multiple surfaces cleanly.'],
  ['Update export contract', 'Include `assessmentContextFlag` in canonical profile snapshot exports and engine-linked research joins.', 'Platform / research', 'Research parity and auditability.'],
  ['Validate no duplicate context fields exist', 'Ensure no second physiology assessment field is created outside `stateContextAtCapture`.', 'Platform / QA', 'Protects schema discipline.'],
];

const M6_ROWS = [
  ['Build operator inspection surface', 'Expose evidence density, stale patterns, degraded confidence, projection validity, and milestone flag posture for debugging.', 'Web + ops', 'Needed before broader rollout.'],
  ['Build active-pilot dashboard directory', 'List active pilots by team and allow drill-in to one pilot dashboard.', 'Web + product', 'Pilot monitoring should start from the pilot index, not from a global engine page.'],
  ['Materialize pilot-scoped reporting queries', 'Build pilot dashboard reads from `PilotEnrollment`-scoped joins rather than raw team membership or whole-engine aggregates.', 'Platform + web', 'Protects pilot boundaries and denominator honesty.'],
  ['Add hypothesis tracker storage and review workflow', 'Persist pilot hypotheses, status history, notes, and review timestamps.', 'Web + ops + product', 'Needed for honest pilot governance, not just static docs.'],
  ['Add rebuild and recompute controls', 'Allow safe per-athlete or scoped recompute of evidence, patterns, and projections.', 'Platform + ops', 'Operational resilience.'],
  ['Add quality monitoring', 'Track evidence volume, stale-source rates, contradiction spikes, projection failure rates, and flag coverage.', 'Ops + platform', 'Launch monitoring requirement.'],
  ['Add pilot adoption telemetry and reporting', 'Track recommendation engagement, follow-through, coach views, and override posture per pilot.', 'Web + platform', 'Adoption is part of pilot success, not optional polish.'],
  ['Add export and research harness', 'Expose canonical exports and validation queries for evidence-to-pattern-to-flag lineage.', 'Platform / research', 'Enables trust and analysis.'],
];

const QA_ROWS = [
  ['No physiology connected', 'Engine should emit no pattern claims and projections should stay in observation-only or unavailable posture.', 'Launch-blocking'],
  ['Early-data athlete', 'Engine should show directional language only and avoid threshold claims.', 'Launch-blocking'],
  ['Stable Oura-backed athlete', 'Engine should compute stable patterns and project athlete-safe and coach-safe outputs consistently.', 'Launch-blocking'],
  ['Contradictory recent evidence', 'Engine should degrade confidence instead of silently preserving an old recommendation.', 'Launch-blocking'],
  ['Milestone captured under compromised recovery', 'Profile snapshot should carry `assessmentContextFlag` inside `stateContextAtCapture` with correct confidence and explanation.', 'Launch-blocking'],
  ['Mirrored or stale physiology source', 'Evidence quality should reflect mirrored / stale posture and projections should downshift accordingly.', 'High'],
  ['Protocol recommendation under low recovery', 'Planner projection should reflect body-state-specific protocol behavior without inventing certainty.', 'High'],
  ['Export lineage check', 'Research export should tie snapshots, patterns, and evidence together without duplicate context fields.', 'High'],
];

const PRODUCTION_GATES = [
  ['Schema gate', 'All four engine objects are implemented with revision-safe writes and no competing duplicate context fields exist.', 'Required before pilot.'],
  ['Evidence gate', 'Evidence generation is reliable, source-aware, and backfilled enough to support meaningful early-pattern learning.', 'Required before pattern rollout.'],
  ['Pattern gate', 'Confidence, decay, contradiction, and freshness logic behave correctly across staged evidence maturity levels.', 'Required before athlete-facing projections.'],
  ['Projection gate', 'Athlete, Nora, coach, and protocol projections all point back to supporting patterns and obey messaging guardrails.', 'Required before runtime rollout.'],
  ['Assessment gate', 'Milestone snapshots correctly store `assessmentContextFlag` inside `stateContextAtCapture` and exports remain canonical.', 'Required before trial-aware release.'],
  ['Pilot-scope gate', 'Pilot dashboard populations resolve from active `PilotEnrollment` truth and exclude non-pilot athletes by default.', 'Required before active pilot monitoring is trusted.'],
  ['Ops gate', 'Inspection tools, rebuild controls, and monitoring exist for evidence, patterns, projections, and flag health.', 'Required before broad release.'],
  ['QA gate', 'Launch-blocking scenarios all pass on pilot data and staged environments.', 'Required before production expansion.'],
];

const FILE_ROWS = [
  ['Health Context Pipeline + assembler layer', 'Supply canonical physiology posture and provenance inputs for evidence writing.', 'Platform', 'Upstream dependency.'],
  ['PulseCheck sim scoring runtime', 'Emit normalized sim outcomes and session-quality data for evidence creation.', 'PulseCheck iOS', 'Cognitive measurement dependency.'],
  ['Engine storage / compute services', 'Own evidence writers, pattern jobs, projection generation, revision handling, and recompute controls.', 'Platform', 'System core.'],
  ['Profile snapshot writer', 'Extend `stateContextAtCapture` with `assessmentContextFlag` at milestone creation time.', 'Platform / profile pipeline', 'Key integration surface.'],
  ['Nora runtime / Profile UI / coach tooling', 'Consume projections and flags with confidence-safe copy and visibility rules.', 'PulseCheck iOS + web', 'Primary consumers.'],
  ['Pilot dashboard reporting service + UI', 'Own active-pilot listing, pilot detail KPIs, hypothesis workflow, and pilot-scoped athlete drill-down.', 'Web + ops', 'Primary monitoring surface for live pilots.'],
  ['Research and ops tooling', 'Own export views, inspection surfaces, and monitoring dashboards.', 'Web + ops + research', 'Production trust layer.'],
];

const GUARDRAIL_CARDS = [
  {
    title: 'Modeling Guardrail',
    accent: 'red' as const,
    body: <BulletList items={['Do not let source-specific connectors invent their own pattern schema.', 'Do not persist thresholds or sweet spots inside recommendation projections.', 'Do not skip contradiction and decay handling just to get early outputs on screen.']} />,
  },
  {
    title: 'Profile Guardrail',
    accent: 'blue' as const,
    body: <BulletList items={['`assessmentContextFlag` extends `stateContextAtCapture` only.', 'Do not create a second milestone physiology annotation elsewhere in the snapshot.', 'Keep athlete-safe and coach-detail explanations coordinated off the same flag object.']} />,
  },
  {
    title: 'Runtime Guardrail',
    accent: 'green' as const,
    body: <BulletList items={['Nora and Profile should read projections, not raw evidence records.', 'Coach-facing outputs must expose confidence and sample support.', 'No consumer should overclaim stronger certainty than the underlying pattern model allows.']} />,
  },
];

const MILESTONE_STEPS = [
  {
    title: 'Milestone 0: Contract Lock',
    body: 'Freeze engine schema, naming, confidence posture, and the integrated snapshot-extension rule for `assessmentContextFlag`.',
    owner: 'Product + architecture',
  },
  {
    title: 'Milestone 1: Data Foundation',
    body: 'Create engine stores, ids, revisions, and the base operator traces needed to trust the pipeline.',
    owner: 'Platform',
  },
  {
    title: 'Milestone 2: Evidence Generation',
    body: 'Start emitting joined Correlation Evidence Records from physiology snapshots plus scored sim outcomes and backfill enough history to validate the system.',
    owner: 'Platform + PulseCheck iOS',
  },
  {
    title: 'Milestone 3: Pattern Learning',
    body: 'Compute canonical Athlete Pattern Models with confidence, decay, and contradiction handling for the first correlation families.',
    owner: 'Modeling layer',
  },
  {
    title: 'Milestone 4: Runtime Projections',
    body: 'Generate Profile, Nora, coach, and protocol projections from shared pattern models with validator-safe copy.',
    owner: 'Platform + runtime consumers',
  },
  {
    title: 'Milestone 5: Assessment Context',
    body: 'Write milestone `assessmentContextFlag` into canonical profile snapshots and expose it to exports and milestone interpretation flows.',
    owner: 'Profile pipeline + research',
  },
  {
    title: 'Milestone 6: Ops, QA, and Launch',
    body: 'Stand up operator tooling, monitoring, rebuild controls, full QA coverage, and production gates before expanding beyond pilot scope.',
    owner: 'Ops + QA + product',
  },
];

const PulseCheckCorrelationEngineEngineeringTaskBreakdownTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Physiology-Cognition Correlation Engine"
        title="Correlation Engine Engineering Task Breakdown"
        version="Version 0.1 | March 19, 2026"
        summary="Execution-facing breakdown of the Physiology-Cognition Correlation Engine from schema lock through production-ready launch. This artifact translates the engine and data-model specs into concrete workstreams, milestone tasks, ownership boundaries, QA scenarios, and release gates so the feature can move from architecture to shipping system."
        highlights={[
          {
            title: 'End-To-End, Not Partial',
            body: 'This breakdown covers storage, evidence, learning, projections, profile integration, ops, QA, and launch readiness rather than stopping at modeling logic alone.',
          },
          {
            title: 'Profile Snapshot Coordination Is Explicit',
            body: 'The milestone physiology interpretation work extends `stateContextAtCapture` instead of creating a parallel snapshot field.',
          },
          {
            title: 'Production Grade Means Operable',
            body: 'The feature is not done when patterns exist; it is done when operators can inspect, QA can validate, and launch gates can actually protect trust.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Execution artifact for turning the Physiology-Cognition Correlation Engine into a production-ready system."
        sourceOfTruth="This page is authoritative for the engineering sequence, milestone decomposition, owner boundaries, validation matrix, and release gates required to ship the engine safely."
        masterReference="Use the parent engine and data-model specs for architecture and schema. Use this page when creating tickets, staffing milestones, sequencing implementation, or judging production readiness."
        relatedDocs={[
          'Physiology-Cognition Correlation Engine',
          'Correlation Data Model Spec',
          'Correlation Engine Pilot Dashboard',
          'Correlation Engine Pilot Ops Runbook',
          'Health Context Pipeline',
          'Profile Snapshot & Export Spec',
          'Oura Cognitive Correlation Spec',
        ]}
      />

      <SectionBlock icon={Brain} title="Primary Workstreams">
        <DataTable columns={['Workstream', 'Scope', 'Owner', 'Timing']} rows={STREAM_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Milestone Sequence">
        <StepRail steps={MILESTONE_STEPS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Milestone 0 Tasks">
        <DataTable columns={['Task', 'Meaning', 'Owner', 'Why']} rows={M0_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Milestone 1 Tasks">
        <DataTable columns={['Task', 'Meaning', 'Owner', 'Why']} rows={M1_ROWS} />
      </SectionBlock>

      <SectionBlock icon={BarChart3} title="Milestone 2 Tasks">
        <DataTable columns={['Task', 'Meaning', 'Owner', 'Why']} rows={M2_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Brain} title="Milestone 3 Tasks">
        <DataTable columns={['Task', 'Meaning', 'Owner', 'Why']} rows={M3_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Milestone 4 Tasks">
        <DataTable columns={['Task', 'Meaning', 'Owner', 'Why']} rows={M4_ROWS} />
      </SectionBlock>

      <SectionBlock icon={FileText} title="Milestone 5 Tasks">
        <DataTable columns={['Task', 'Meaning', 'Owner', 'Why']} rows={M5_ROWS} />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Milestone 6 Tasks">
        <DataTable columns={['Task', 'Meaning', 'Owner', 'Why']} rows={M6_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Likely File / Module Ownership">
        <DataTable columns={['Area', 'Expected Responsibility', 'Owner', 'Why']} rows={FILE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={TestTube2} title="QA Matrix">
        <DataTable columns={['Scenario', 'Meaning', 'Priority']} rows={QA_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Production Readiness Gates">
        <DataTable columns={['Gate', 'Meaning', 'Role']} rows={PRODUCTION_GATES} />
        <CardGrid columns="md:grid-cols-3">
          {GUARDRAIL_CARDS.map((card) => (
            <InfoCard key={card.title} title={card.title} accent={card.accent} body={card.body} />
          ))}
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckCorrelationEngineEngineeringTaskBreakdownTab;
