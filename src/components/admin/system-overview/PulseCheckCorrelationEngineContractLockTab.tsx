import React from 'react';
import { FileLock2, ShieldCheck, Workflow, Database, MessageSquareQuote, CheckCircle2 } from 'lucide-react';
import {
  BulletList,
  CardGrid,
  DataTable,
  DocHeader,
  InfoCard,
  RuntimeAlignmentPanel,
  SectionBlock,
} from './PulseCheckRuntimeDocPrimitives';

const BASELINE_ROWS = [
  ['Parent engine spec', '`Physiology-Cognition Correlation Engine` is the implementation baseline for system role, confidence behavior, messaging posture, and consumer boundaries.', 'Frozen for Milestone 0.'],
  ['Data model spec', '`Correlation Data Model Spec` is the implementation baseline for engine objects, storage boundaries, and field groups.', 'Frozen for Milestone 0.'],
  ['Pilot dashboard stack', '`Correlation Engine Pilot Dashboard`, addendum, and ops runbook define the pilot monitoring boundary for active pilots.', 'Frozen for pilot dashboard implementation.'],
  ['Oura child spec', '`Oura Cognitive Correlation Spec` is the first source-specific implementation child and may not redefine engine-level rules.', 'Frozen as child implementation, not parent governance.'],
  ['Profile snapshot contract', '`Profile Snapshot & Export Spec` remains the canonical home for milestone snapshot storage and export behavior.', 'Frozen with engine extension rule.'],
  ['Health context contract', '`Athlete Context Snapshot Spec` remains the canonical input contract for physiology posture and provenance.', 'Frozen as upstream input contract.'],
];

const NAMING_ROWS = [
  ['Engine object', '`Correlation Evidence Record`', 'Use exactly this name for the atomic joined evidence unit. Do not fork into `correlationRow`, `joinedSignal`, or local variants.'],
  ['Engine object', '`Athlete Pattern Model`', 'Use exactly this name for the learned relationship object. Do not fork into `insightModel` or `thresholdProfile`.'],
  ['Engine object', '`Recommendation Projection`', 'Use exactly this name for consumer-safe runtime output. Do not call projections “patterns” or “evidence” in UI or storage.'],
  ['Engine object', '`Assessment Context Flag`', 'Use exactly this name for milestone physiology interpretation. Do not create alternate names like `physiologyFlag` or `captureRecoveryTag`.'],
  ['Snapshot field', '`profilePayload.stateContextAtCapture.assessmentContextFlag`', 'This is the only valid storage location for milestone physiology assessment context inside profile snapshots.'],
  ['Confidence enum', '`directional`, `emerging`, `stable`, `high_confidence`, `degraded`', 'These tiers are locked and may not be renamed per consumer or connector.'],
  ['Pilot reporting scope', '`Pilot`, `PilotCohort`, and `PilotEnrollment`', 'Pilot dashboards must use pilot-scoped truth. Do not substitute raw team membership for pilot populations.'],
];

const MESSAGING_ROWS = [
  ['Athlete-facing', 'Lead with what the athlete can do today, use personal pattern language, and speak in confidence-appropriate terms like “may,” “tends to,” or “usually.”', 'Short, actionable, human.'],
  ['Coach-facing', 'Show evidence density, affected domains, confidence posture, and planning-grade implications.', 'Operational, inspectable, not motivational.'],
  ['Correlation rule', 'Speak in terms of relationship and tendency unless stronger validation exists.', 'No fake causality.'],
  ['Wearable rule', 'Wearables inform the interpretation; they do not “decide” or “shape” the athlete by themselves.', 'Avoid vendor-overclaim language.'],
  ['Medical boundary', 'No diagnostic, treatment, or speculative medical language.', 'Performance lane only.'],
];

const EXIT_CRITERIA_ROWS = [
  ['Evidence exit', 'Canonical Correlation Evidence Record schema is frozen, writes are revision-safe, and quality/provenance fields are defined.', 'Required before pattern jobs start.'],
  ['Pattern exit', 'Athlete Pattern Model schema, confidence tiers, decay posture, and contradiction rules are frozen.', 'Required before projection work starts.'],
  ['Projection exit', 'Recommendation Projection schema, consumer boundaries, and messaging validator rules are frozen.', 'Required before athlete-facing or Nora rollout.'],
  ['Snapshot-flag exit', 'Assessment Context Flag path and storage rule are frozen and explicitly integrated into `stateContextAtCapture`.', 'Required before milestone annotation work starts.'],
  ['Pilot-scope exit', 'Pilot dashboard surfaces and reporting rules are explicitly scoped to active pilots and `PilotEnrollment` truth.', 'Required before pilot monitoring work starts.'],
  ['Ops exit', 'Trace expectations, operator visibility expectations, and rebuild ownership are defined.', 'Required before broad pilot work.'],
  ['QA exit', 'Launch-blocking scenario classes and trust checks are explicitly listed.', 'Required before implementation leaves architecture-only status.'],
  ['Release-gate exit', 'Production readiness gates are written and accepted by product, architecture, and engineering.', 'Required before release planning.'],
];

const LOCK_CARDS = [
  {
    title: 'No Parallel Snapshot Field',
    accent: 'red' as const,
    body: 'Milestone physiology interpretation must extend `stateContextAtCapture`. No second profile-snapshot field may be created for the same concept.',
  },
  {
    title: 'No Connector-Specific Confidence Fork',
    accent: 'blue' as const,
    body: 'Oura, Apple Watch, Garmin, and future lanes all inherit the same engine confidence tiers. Source-specific docs may specialize thresholds, but not rename confidence levels.',
  },
  {
    title: 'No Runtime Copy Drift',
    accent: 'green' as const,
    body: 'Athlete-facing and coach-facing language must remain subordinate to the locked messaging rules so runtime outputs cannot overclaim before evidence is ready.',
  },
  {
    title: 'No Team-Level Pilot Drift',
    accent: 'amber' as const,
    body: 'Pilot dashboards must read active-pilot populations from `PilotEnrollment` truth. They may not quietly widen into team-wide or whole-system analytics.',
  },
];

const PulseCheckCorrelationEngineContractLockTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Physiology-Cognition Correlation Engine"
        title="Contract Lock & Exit Criteria"
        version="Version 0.1 | March 19, 2026"
        summary="Milestone 0 contract-freeze artifact for the Physiology-Cognition Correlation Engine. This page locks the baseline documents, naming, confidence tiers, snapshot integration rule, messaging posture, and milestone exit criteria that engineering must treat as implementation constraints before build work begins."
        highlights={[
          {
            title: 'This Freezes Milestone 0',
            body: 'The engine, data model, and dependent snapshot rules are now treated as implementation baseline rather than evolving draft language.',
          },
          {
            title: 'One Shared Trust Model',
            body: 'Confidence tiers, correlation language, and athlete-versus-coach messaging rules are locked across the system.',
          },
          {
            title: 'Snapshot Integration Is Explicit',
            body: 'Assessment context extends `stateContextAtCapture` only and may not appear as a second milestone field elsewhere.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Milestone 0 governance artifact for freezing implementation baseline, naming, confidence, messaging, and exit criteria."
        sourceOfTruth="This page is authoritative for what is now frozen at the start of engineering implementation for the correlation engine. It should be used to reject schema drift, naming drift, confidence-tier drift, or copy drift during build-out."
        masterReference="Use the engine spec for system role, the data model spec for object schema, the profile snapshot spec for milestone storage, and this page for the rules that say those contracts are now locked for implementation."
        relatedDocs={[
          'Physiology-Cognition Correlation Engine',
          'Correlation Data Model Spec',
          'Correlation Engine Pilot Dashboard',
          'Oura Cognitive Correlation Spec',
          'Profile Snapshot & Export Spec',
          'Athlete Context Snapshot Spec',
        ]}
      />

      <SectionBlock icon={FileLock2} title="Frozen Baseline Artifacts">
        <DataTable columns={['Artifact', 'Locked Meaning', 'Milestone 0 Status']} rows={BASELINE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Locked Naming And Enum Rules">
        <DataTable columns={['Type', 'Locked Name', 'Rule']} rows={NAMING_ROWS} />
      </SectionBlock>

      <SectionBlock icon={MessageSquareQuote} title="Locked Messaging Boundaries">
        <DataTable columns={['Audience / Rule', 'Locked Behavior', 'Output Posture']} rows={MESSAGING_ROWS} />
      </SectionBlock>

      <SectionBlock icon={CheckCircle2} title="Milestone Exit Criteria">
        <DataTable columns={['Area', 'Exit Condition', 'Why']} rows={EXIT_CRITERIA_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Implementation Lock Checks">
        <CardGrid columns="md:grid-cols-3">
          {LOCK_CARDS.map((card) => (
            <InfoCard key={card.title} title={card.title} accent={card.accent} body={card.body} />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Milestone 0 Definition Of Done">
        <InfoCard
          title="Milestone 0 Is Complete When"
          accent="green"
          body={
            <BulletList
              items={[
                'The parent engine and data-model specs are explicitly frozen as the implementation baseline.',
                'Pilot monitoring surfaces are explicitly locked to active pilots and `PilotEnrollment` scope.',
                'All dependent docs use the same object names and confidence tiers.',
                'The profile snapshot contract explicitly stores milestone physiology interpretation only in `stateContextAtCapture.assessmentContextFlag`.',
                'Athlete-facing and coach-facing messaging rules are locked in writing.',
                'Evidence, pattern, projection, snapshot-flag, ops, QA, and release-gate exits are all written and accepted as implementation constraints.',
              ]}
            />
          }
        />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckCorrelationEngineContractLockTab;
