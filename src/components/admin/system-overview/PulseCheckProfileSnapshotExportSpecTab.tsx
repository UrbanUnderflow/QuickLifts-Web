import React from 'react';
import { AlertTriangle, Database, FileText, History, RefreshCw, ShieldCheck, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock } from './PulseCheckRuntimeDocPrimitives';

const CURRENT_STATE_ROWS = [
  ['Live athlete progress exists', '`athlete-mental-progress/{athleteId}` stores live pathway, MPR, and baseline-linked fields.', 'Existing runtime base; not a snapshot history system.'],
  ['Baseline writes exist', 'iOS Baseline Assessment writes `baselineProbe` straight into the progress doc.', 'A valid milestone write path already exists in product code.'],
  ['Canonical snapshot store missing', 'No first-class profile snapshot collection or deterministic snapshot writer is present.', 'This is the main implementation gap.'],
  ['Research export contract missing', 'No shared service defaults to canonical profile snapshots for export.', 'Exports would currently be ad hoc.'],
  ['Template validator missing', 'Profile can render template-like Nora copy, but there is no shared validator contract yet.', 'Needs cross-surface enforcement.'],
];

const COLLECTION_ROWS = [
  ['`athlete-mental-progress/{athleteId}`', 'Live profile state and snapshot pointers', '`currentCanonicalSnapshotIds`, `profileVersion`, `lastProfileSnapshotAt`, `baselineProbe`, `currentPathway`'],
  ['`athlete-mental-progress/{athleteId}/profile-snapshots/{snapshotKey}`', 'Single canonical head doc for each milestone scope', '`snapshotKey`, `milestoneType`, `pilotEnrollmentId`, `canonical`, `revision`, `payloadFingerprint`, `profilePayload`, `noraExplanation`'],
  ['`athlete-mental-progress/{athleteId}/profile-snapshots/{snapshotKey}/revisions/{revisionId}`', 'Immutable audit trail of superseded or replayed payloads', '`revision`, `supersededAt`, `supersededBy`, `writeReason`, `writerVersion`, `profilePayload`'],
  ['`research-export-jobs/{jobId}`', 'Export job metadata and options', '`dataset`, `canonicalOnly`, `milestones`, `requestedBy`, `createdAt`, `outputUri`'],
];

const HEAD_FIELD_ROWS = [
  ['Identity', '`snapshotKey`, `athleteId`, `milestoneType`, `pilotEnrollmentId`, `canonicalScopeKey`'],
  ['Lifecycle', '`canonical`, `revision`, `status`, `capturedAt`, `supersededAt`, `writeReason`'],
  ['Determinism', '`idempotencyKey`, `payloadFingerprint`, `writerVersion`, `sourceEventId`'],
  ['Profile payload', '`pillarScores`, `skillSummaries`, `modifierScores`, `trendSummary`, `currentEmphasis`, `nextMilestone`'],
  ['Narrative payload', '`noraExplanation.templateId`, `templateVersion`, `slots`, `renderedText`, `validated`'],
  ['Lineage', '`sourceRefs`, `derivedFromProgressUpdatedAt`, `derivedFromTrialCompletedAt`'],
];

const WRITE_PROTOCOL_ROWS = [
  ['1. Resolve scope', 'Build `canonicalScopeKey = athleteId + pilotEnrollmentIdOrSolo + milestoneType` and derive deterministic `snapshotKey`.'],
  ['2. Normalize input', 'Reduce source state into the milestone-safe snapshot payload only. Exclude transcripts, raw per-round logs, and escalation data.'],
  ['3. Fingerprint payload', 'Hash the normalized payload plus profile version and template version before writing.'],
  ['4. Transaction read', 'Read the canonical head doc for `snapshotKey` inside one transaction.'],
  ['5. Idempotent outcome', 'If fingerprint matches the current head, no-op and return the existing canonical snapshot.'],
  ['6. Canonical replace', 'If fingerprint differs, copy the prior head into `revisions`, increment revision, and overwrite the head doc in place.'],
  ['7. Pointer refresh', 'Update `athlete-mental-progress/{athleteId}` snapshot pointers and timestamps in the same transaction.'],
];

const TEMPLATE_ROWS = [
  ['Stored with snapshot', '`templateId`, `templateVersion`, `slots`, `renderedText`, `validated`'],
  ['Allowed inputs', 'Current emphasis, named growth area, pressure pattern, consistency state, next milestone'],
  ['Disallowed inputs', 'Free-form model prose, diagnostic labels, inferred mental-health claims, transcript excerpts'],
  ['Render rule', 'Maximum two sentences; every sentence must come from an approved template family'],
];

const EXPORT_ROWS = [
  ['`profile_snapshot_export_v1`', 'Default export', 'Canonical head docs only. One row per athlete, milestone, and pilot enrollment scope.'],
  ['`profile_snapshot_audit_v1`', 'Audit export', 'Superseded revisions, replay attempts, correction lineage, and write metadata.'],
  ['`profile_snapshot_join_view_v1`', 'Optional analysis view', 'Canonical snapshots joined to permitted sim or program summaries by timestamp and athlete ID.'],
];

const PHASE_ROWS = [
  ['Phase 1', 'Schema and writer contract', 'Add head + revision schema, deterministic key builder, and transaction-based writer.'],
  ['Phase 2', 'Milestone integration', 'Route onboarding, baseline, midpoint, endpoint, retention, and manual staff checkpoint writes through the shared writer.'],
  ['Phase 3', 'Template validator', 'Ship shared Nora explanation templates plus a validator that rejects non-compliant copy before persistence.'],
  ['Phase 4', 'Research export', 'Add canonical-default export service and separate audit export path.'],
  ['Phase 5', 'Backfill', 'Convert existing baseline-only athletes into baseline canonical heads with revision `1` and explicit backfill provenance.'],
];

const VALIDATOR_RULES = [
  '`renderedText` must be reproducible from `templateId + templateVersion + slots` with no extra free text.',
  'Maximum two sentences; if the render produces more, the write fails validation.',
  'Only performance-language vocabulary is allowed. Diagnostic, clinical, or speculative emotional-state wording is rejected.',
  'Every slot value must come from persisted profile facts or enumerated runtime outputs, never from a free-form LLM completion.',
  'When emphasis and milestone are unchanged, the writer should reuse the existing validated explanation rather than churn text.',
];

const DEFAULT_EXPORT_FIELDS = [
  '`snapshotKey`, `athleteId`, `pilotEnrollmentId`, `milestoneType`, `capturedAt`, `revision`, `profileVersion`',
  '`pillarScores`, `modifierScores`, `currentEmphasis`, `nextMilestone`, `pressurePattern`, `consistencyState`',
  '`noraExplanation.templateId`, `noraExplanation.templateVersion`, `noraExplanation.renderedText`',
  '`payloadFingerprint`, `sourceEventId`, `writerVersion`, `validityFlags`',
];

const PulseCheckProfileSnapshotExportSpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Profile Pipeline"
        title="Canonical Snapshot & Research Export Spec"
        version="Version 1.0 | March 14, 2026"
        summary="Implementation-facing artifact for the missing Pulse Check profile snapshot pipeline. This spec defines the canonical snapshot store, idempotent write protocol, template-bound Nora explanation contract, and canonical-first research export behavior."
        highlights={[
          {
            title: 'One Canonical Head Per Milestone Scope',
            body: 'Official profile milestones write to a deterministic canonical document keyed by athlete, milestone, and pilot-enrollment scope.',
          },
          {
            title: 'Corrections Replace Canonical Truth',
            body: 'Retries and corrected payloads overwrite the canonical head in place while preserving older versions in a revision audit trail.',
          },
          {
            title: 'Exports Default To Canonical Only',
            body: 'Research and ops exports should read canonical head docs by default; superseded versions belong in the audit dataset only.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Implementation spec for building the profile snapshot writer, storage model, and export contract."
        sourceOfTruth="This document is authoritative for where canonical profile snapshots live, how they are keyed and superseded, how Nora explanation text is validated, and what research export must include by default."
        masterReference="Use Profile Architecture for the surface IA and milestone definitions. Use this page when implementing persistence, revision history, export jobs, or Nora explanation validation."
        relatedDocs={[
          'Profile Architecture v1.3',
          'Runtime Architecture v1.0',
          'State Signal Layer v1.2',
          'Member Onboarding Guide',
        ]}
      />

      <SectionBlock icon={AlertTriangle} title="Current Gap Assessment">
        <DataTable columns={['Observed State', 'What Exists Now', 'Why It Is Not Enough']} rows={CURRENT_STATE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Canonical Data Model">
        <DataTable columns={['Path', 'Purpose', 'Critical Fields']} rows={COLLECTION_ROWS} />
        <DataTable columns={['Field Group', 'Required Contents']} rows={HEAD_FIELD_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Deterministic Snapshot Key"
            accent="blue"
            body="For official milestones, use a deterministic key such as `solo__baseline` or `{pilotEnrollmentId}__midpoint`. The same milestone scope must always resolve to the same canonical head document."
          />
          <InfoCard
            title="Why Head + Revisions"
            accent="green"
            body="This keeps one practical truth for the product and export pipeline while preserving superseded payloads for audit, correction review, and backfill verification."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Idempotent Snapshot Write Protocol">
        <DataTable columns={['Step', 'Runtime Rule']} rows={WRITE_PROTOCOL_ROWS} />
        <InfoCard
          title="Required Transaction Boundary"
          accent="amber"
          body="The canonical head write, revision archival, and progress-pointer refresh must commit in one transaction or one server-side critical section. Partial writes are not acceptable because they create export and UI disagreement."
        />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Template-Bound Nora Explanation Contract">
        <DataTable columns={['Aspect', 'Locked Rule']} rows={TEMPLATE_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard title="Validator Rules" accent="green" body={<BulletList items={VALIDATOR_RULES} />} />
          <InfoCard
            title="Persistence Rule"
            accent="blue"
            body="Snapshots should persist both the rendered explanation and the structured template inputs that produced it. That makes the explanation auditable, reproducible, and safe to export."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={FileText} title="Research Export Contract">
        <DataTable columns={['Dataset', 'Use', 'Rules']} rows={EXPORT_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard title="Default Fields" accent="blue" body={<BulletList items={DEFAULT_EXPORT_FIELDS} />} />
          <InfoCard
            title="Default Query Behavior"
            accent="amber"
            body={
              <BulletList
                items={[
                  'Set `canonicalOnly = true` by default for every profile snapshot export job.',
                  'Exclude superseded revisions unless the caller explicitly requests the audit dataset.',
                  'Join to raw sim logs only in downstream analysis views, not in the canonical export itself.',
                ]}
              />
            }
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={History} title="Rollout Sequence">
        <DataTable columns={['Phase', 'Deliverable', 'Exit Condition']} rows={PHASE_ROWS} />
        <InfoCard
          title="Backfill Note"
          accent="red"
          body="Existing athletes with only `baselineProbe` in live progress need a controlled backfill. The backfill should create baseline canonical heads with explicit provenance instead of pretending those rows were produced by the new writer from day one."
        />
      </SectionBlock>

      <SectionBlock icon={RefreshCw} title="First Implementation Targets">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard title="Writer Service" body="Shared helper or backend endpoint that owns snapshot-key generation, fingerprinting, transaction writes, and revision rollover." />
          <InfoCard title="Export Service" body="Canonical-default export path with explicit audit-mode opt-in and stable `profile_snapshot_export_v1` schema." />
          <InfoCard title="Validator Package" body="Shared Nora explanation template definitions and validation helpers reused by iOS, web admin, and any future server writer." />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckProfileSnapshotExportSpecTab;
