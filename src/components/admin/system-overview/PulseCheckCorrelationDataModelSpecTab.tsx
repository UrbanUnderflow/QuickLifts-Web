import React from 'react';
import {
  AlertTriangle,
  BarChart3,
  Brain,
  Database,
  FileText,
  GitBranch,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import {
  BulletList,
  CardGrid,
  DataTable,
  DocHeader,
  InfoCard,
  RuntimeAlignmentPanel,
  SectionBlock,
  StepRail,
} from './PulseCheckRuntimeDocPrimitives';

const OBJECT_ROLE_ROWS = [
  ['Correlation Evidence Record', 'Atomic joined evidence unit linking physiology state and sim performance for one athlete and one aligned time window.', 'Raw learning input.'],
  ['Athlete Pattern Model', 'Long-lived per-athlete learned relationship object storing thresholds, sweet spots, fragile bands, and confidence.', 'Personal pattern memory.'],
  ['Recommendation Projection', 'Consumer-safe output generated from current physiology posture plus stable learned patterns.', 'Runtime guidance layer.'],
  ['Assessment Context Flag', 'Interpretation of the athlete’s physiology posture at the time of a key assessment or milestone capture.', 'Trial and profile context annotation.'],
];

const STORAGE_ROWS = [
  ['`athlete-physiology-cognition/{athleteId}`', 'Athlete-level root namespace for the engine.', '`lastEngineRefreshAt`, `activePatternKeys`, `engineVersion`'],
  ['`athlete-physiology-cognition/{athleteId}/evidence-records/{evidenceId}`', 'Append-only or revision-safe joined evidence units.', '`physiologyWindow`, `simOutcome`, `sourceRefs`, `qualityFlags`'],
  ['`athlete-physiology-cognition/{athleteId}/pattern-models/{patternKey}`', 'Current canonical learned patterns for this athlete.', '`patternFamily`, `confidenceTier`, `recommendationEligibility`, `thresholds`, `lastValidatedAt`'],
  ['`athlete-physiology-cognition/{athleteId}/pattern-models/{patternKey}/revisions/{revisionId}`', 'Superseded pattern revisions for audit and research review.', '`revision`, `supersededAt`, `changeReason`, `previousThresholds`'],
  ['`athlete-physiology-cognition/{athleteId}/recommendation-projections/{projectionKey}`', 'Optional persisted projection outputs for profile, Nora, coach, or ops consumers.', '`consumer`, `projectionDate`, `expiresAt`, `renderedSummary`, `supportingPatternKeys`'],
  ['`athlete-mental-progress/{athleteId}/profile-snapshots/{snapshotKey}`', 'Existing profile snapshot head doc extended with assessment context.', '`profilePayload.stateContextAtCapture.assessmentContextFlag`'],
];

const EVIDENCE_FIELD_ROWS = [
  ['Identity', '`evidenceId`, `athleteId`, `athleteLocalDate`, `sourceWindowStart`, `sourceWindowEnd`, `engineVersion`'],
  ['Physiology block', '`sourceFamily`, `sourceType`, `sleep`, `recovery`, `activityLoad`, `stressPosture`, `freshness`, `observationTimes`'],
  ['Sim block', '`simSessionId`, `simFamily`, `simVariant`, `skillDomain`, `pillarDomain`, `scores`, `completionQuality`, `sessionTimestamp`'],
  ['Alignment block', '`alignmentType`, `timeDeltaMinutes`, `windowRule`, `sameDayValidity`, `joinedBy`'],
  ['Quality block', '`dataConfidence`, `varietyTags`, `missingSignals`, `qualityFlags`, `exclusionReason`'],
  ['Lineage block', '`healthSnapshotRevision`, `sourceRecordRefs`, `trialOrAssignmentRefs`, `writeReason`'],
];

const EVIDENCE_RULES = [
  'A Correlation Evidence Record should represent one comparable physiology-to-performance observation unit, not a whole week of rolled-up data.',
  'The physiology block should preserve source provenance and freshness so low-quality or mirrored data can be down-weighted later.',
  'The sim block should store normalized performance domains, not just a raw total score, so the engine can learn domain-specific relationships.',
  'Evidence records should be append-only in spirit. If they must be corrected, preserve revision-safe lineage rather than silently mutating history.',
];

const PATTERN_FIELD_ROWS = [
  ['Identity', '`patternKey`, `athleteId`, `patternFamily`, `targetDomain`, `createdAt`, `lastValidatedAt`, `engineVersion`'],
  ['Evidence posture', '`sampleSizeDays`, `sampleSizeSims`, `stateDiversityScore`, `recentContradictionRate`, `coverageWindowDays`'],
  ['Pattern summary', '`observedRelationship`, `directionality`, `sweetSpotRange`, `minimumFloor`, `instabilityBand`, `bestTrainingWindow`'],
  ['Confidence block', '`confidenceTier`, `confidenceScore`, `freshnessTier`, `recommendationEligibility`, `degradedReason`'],
  ['Impact block', '`affectedDomains`, `supportedConsumers`, `protocolLinks`, `riskFlags`'],
  ['Narrative block', '`athleteSummary`, `coachSummary`, `explanationTemplateIds`, `lastProjectionAt`'],
];

const PATTERN_RULES = [
  'One Athlete Pattern Model should describe one family of relationship, such as sleep-duration-to-decision-quality or HRV-to-focus-stability.',
  'Thresholds belong here, not in the recommendation object. The pattern model owns the learned relationship.',
  'Confidence, freshness, and contradiction posture must live with the pattern so every consumer sees the same trust posture.',
  'Pattern revisions should roll when the learned threshold meaningfully changes, not on every recompute tick.',
];

const PROJECTION_FIELD_ROWS = [
  ['Identity', '`projectionKey`, `athleteId`, `consumer`, `projectionDate`, `generatedAt`, `expiresAt`'],
  ['Trigger posture', '`currentPhysiologyBand`, `currentStateSignalRefs`, `currentSnapshotRevision`, `projectionReason`'],
  ['Output block', '`summaryTitle`, `summaryBody`, `recommendedMode`, `suggestedProtocolIds`, `timingWindow`, `warningLevel`'],
  ['Support block', '`supportingPatternKeys`, `confidenceTier`, `confidenceDisplay`, `evidenceSnippet`, `sourceSummary`'],
  ['Governance block', '`templateId`, `templateVersion`, `copyValidated`, `medicalClaimCheck`, `staleAt`'],
];

const PROJECTION_RULES = [
  'Recommendation Projection is the delivery object, not the learning object. It should be cheap for runtime consumers to read and explain.',
  'Different consumers may receive different projections from the same underlying pattern set, but they should all point back to the same supporting pattern keys.',
  'Projection copy should always be template-bound or validator-safe so the same confidence rules apply everywhere.',
];

const FLAG_FIELD_ROWS = [
  ['Storage location', '`profilePayload.stateContextAtCapture.assessmentContextFlag`', 'Extend the existing snapshot capture-context block instead of creating a parallel top-level field.'],
  ['Status', '`advantaged`, `normal`, `compromised`, or `unknown`', 'Relative to this athlete’s learned physiology-performance patterns, not a universal body-state claim.'],
  ['Confidence', '`confidenceTier`, `confidenceScore`', 'Flag quality should reuse the engine confidence posture rather than inventing a separate trust model.'],
  ['Why', '`supportingPatternKeys`, `supportingSignals`, `deviationSummary`', 'Explain what made the assessment look advantaged or compromised.'],
  ['Window context', '`captureWindowStart`, `captureWindowEnd`, `sourceSnapshotRevision`, `observationTimes`', 'Keep the flag auditable against the exact physiology window used.'],
  ['Consumer note', '`athleteSafeSummary`, `coachDetailSummary`', 'Allow the profile and staff views to explain the flag at the right depth.'],
];

const FLAG_RULES = [
  'Assessment Context Flag extends `stateContextAtCapture`; it should not duplicate the broader state snapshot in a second unrelated object.',
  'Use this only for milestone-grade captures such as Baseline, Midpoint, Endpoint, Retention, and approved staff checkpoints.',
  'The flag should say whether the athlete was physiologically advantaged, normal, or compromised relative to their own patterns, not relative to a generic population norm.',
  'If confidence is too weak, store `unknown` and explain that the engine does not yet have enough evidence to classify the capture posture.',
];

const INTEGRATION_ROWS = [
  ['Health Context Pipeline', 'Writes the physiology posture and source provenance that evidence records use as their input layer.'],
  ['State Signal Layer', 'Provides current-state interpretation that can be referenced inside projections, but should not replace the engine’s learned pattern memory.'],
  ['PilotEnrollment + provisioning model', 'Provides the pilot scope key used by pilot dashboards, pilot exports, and athlete inclusion rules. Engine storage stays athlete-centric, but pilot reporting must join through enrollment truth.'],
  ['Profile Snapshot & Export Spec', 'Stores `assessmentContextFlag` inside `stateContextAtCapture` on canonical milestone snapshots.'],
  ['Protocol System', 'Consumes body-state-specific projection outputs when protocol responsiveness is tied to recovery posture.'],
  ['Nora Runtime', 'Reads recommendation projections instead of re-learning thresholds from raw physiology or sim history.'],
  ['Research Exports', 'Join canonical profile snapshots, pattern models, and evidence records by athlete and timestamp for deeper cohort analysis.'],
];

const BUILD_ORDER = [
  {
    title: 'Lock object schemas',
    body: 'Finalize the four runtime objects, field groups, enums, and storage boundaries before modeling logic or UI consumers are built.',
    owner: 'System design + platform',
  },
  {
    title: 'Emit evidence records',
    body: 'Write the service that turns normalized physiology snapshots and scored sim outcomes into append-only Correlation Evidence Records.',
    owner: 'Health context + sim runtime',
  },
  {
    title: 'Learn canonical pattern models',
    body: 'Build the first pattern computation job that derives athlete-level thresholds and confidence posture from evidence records.',
    owner: 'Engine modeling layer',
  },
  {
    title: 'Generate recommendation projections',
    body: 'Create consumer-safe outputs for Profile, Nora, coach views, and protocol planning, all backed by shared pattern keys.',
    owner: 'Runtime projection layer',
  },
  {
    title: 'Extend milestone snapshots',
    body: 'Write `assessmentContextFlag` into `stateContextAtCapture` on Baseline, Midpoint, Endpoint, Retention, and approved staff checkpoints.',
    owner: 'Profile snapshot writer',
  },
  {
    title: 'Export and monitor',
    body: 'Expose canonical exports and operator inspection for evidence density, stale patterns, degraded flags, and projection validity.',
    owner: 'Ops + research tooling',
  },
];

const PulseCheckCorrelationDataModelSpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Physiology-Cognition Correlation Engine"
        title="Correlation Data Model Spec"
        version="Version 0.1 | March 19, 2026"
        summary="Implementation-facing schema artifact for the four runtime objects that make the Physiology-Cognition Correlation Engine buildable: Correlation Evidence Record, Athlete Pattern Model, Recommendation Projection, and Assessment Context Flag. This page defines what each object stores, where it lives, how it connects to the existing health-context and profile systems, and how assessment context should extend the current profile snapshot model without creating duplicate fields."
        highlights={[
          {
            title: 'One Learning Object Per Job',
            body: 'Evidence records fuel learning, pattern models store learned relationships, projections deliver runtime guidance, and assessment flags annotate milestone captures.',
          },
          {
            title: 'Assessment Flags Extend Existing Snapshot Context',
            body: 'The milestone flag belongs inside `stateContextAtCapture`, not in a parallel profile field.',
          },
          {
            title: 'Shared Trust Model',
            body: 'Confidence, freshness, and contradiction posture should be owned once at the engine layer and reused by every consumer.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Schema and storage artifact for the core runtime objects behind the Physiology-Cognition Correlation Engine."
        sourceOfTruth="This page is authoritative for the four engine objects, their field groups, their storage boundaries, and the integration rule that milestone physiology interpretation extends `stateContextAtCapture` rather than duplicating it elsewhere."
        masterReference="Use the parent engine spec for why the system exists and how confidence should behave. Use this page when implementing collections, object schemas, revision behavior, joins, milestone annotations, or consumer-safe output contracts."
        relatedDocs={[
          'Physiology-Cognition Correlation Engine',
          'Athlete Context Snapshot Spec',
          'Profile Snapshot & Export Spec',
          'Profile Architecture',
          'State Signal Layer',
          'Oura Cognitive Correlation Spec',
        ]}
      />

      <SectionBlock icon={GitBranch} title="Core Engine Objects">
        <DataTable columns={['Object', 'Meaning', 'Primary Job']} rows={OBJECT_ROLE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Recommended Storage Model">
        <DataTable columns={['Path', 'Purpose', 'Critical Fields']} rows={STORAGE_ROWS} />
        <InfoCard
          title="Storage Principle"
          accent="blue"
          body="The engine should own its own athlete namespace for evidence, learned patterns, and projections. The only place it should write into an existing system contract is the milestone assessment annotation inside the canonical profile snapshot."
        />
        <InfoCard
          title="Reporting Scope Principle"
          accent="amber"
          body="Pilot dashboards should not force the engine to duplicate pilot keys onto every core object just to make reporting possible. Instead, pilot-scoped reporting should join engine objects back to `PilotEnrollment` and canonical pilot scope truth."
        />
      </SectionBlock>

      <SectionBlock icon={BarChart3} title="Correlation Evidence Record">
        <DataTable columns={['Field Group', 'Required Contents']} rows={EVIDENCE_FIELD_ROWS} />
        <InfoCard title="Object Rules" accent="green" body={<BulletList items={EVIDENCE_RULES} />} />
      </SectionBlock>

      <SectionBlock icon={Brain} title="Athlete Pattern Model">
        <DataTable columns={['Field Group', 'Required Contents']} rows={PATTERN_FIELD_ROWS} />
        <InfoCard title="Object Rules" accent="purple" body={<BulletList items={PATTERN_RULES} />} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Recommendation Projection">
        <DataTable columns={['Field Group', 'Required Contents']} rows={PROJECTION_FIELD_ROWS} />
        <InfoCard title="Object Rules" accent="amber" body={<BulletList items={PROJECTION_RULES} />} />
      </SectionBlock>

      <SectionBlock icon={FileText} title="Assessment Context Flag">
        <DataTable columns={['Aspect', 'Field', 'Rule']} rows={FLAG_FIELD_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard title="Integration Rule" accent="green" body={<BulletList items={FLAG_RULES} />} />
          <InfoCard
            title="Profile Snapshot Coordination"
            accent="blue"
            body="The Profile Snapshot system already stores `stateContextAtCapture`. The engine should extend that existing block with `assessmentContextFlag` instead of writing a second context field elsewhere. That keeps milestone capture context integrated, exportable, and audit-safe."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="System Integration Points">
        <DataTable columns={['System', 'How It Connects']} rows={INTEGRATION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Implementation Guardrails">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="No Duplicate Context Flags"
            accent="red"
            body="Do not create one milestone annotation field in Profile and another in the engine. There should be one integrated capture-context extension."
          />
          <InfoCard
            title="No Free-Floating Thresholds"
            accent="amber"
            body="Thresholds, sweet spots, and fragile bands belong in the Athlete Pattern Model. Projections should reference them, not duplicate them."
          />
          <InfoCard
            title="No Opaque Recommendations"
            accent="green"
            body="Every recommendation projection should point back to supporting pattern keys, confidence posture, and the physiology window that made it eligible."
          />
          <InfoCard
            title="No Denominator Drift"
            accent="blue"
            body="Pilot reporting may not substitute `TeamMembership` for `PilotEnrollment` when building dashboard populations. Team scope and pilot scope are different truths."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Build Sequence">
        <StepRail steps={BUILD_ORDER} />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckCorrelationDataModelSpecTab;
