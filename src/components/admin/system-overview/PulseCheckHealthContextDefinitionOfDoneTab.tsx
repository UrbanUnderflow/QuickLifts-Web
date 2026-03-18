import React from 'react';
import { CheckCircle2, ClipboardList, ShieldCheck, Sparkles, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock } from './PulseCheckRuntimeDocPrimitives';

const DONE_CARDS = [
  {
    title: 'Runtime Done',
    accent: 'green' as const,
    body: 'PulseCheck health-backed runtime surfaces use the canonical snapshot path for the intended rollout scope, and legacy direct reads are no longer part of the hot path for that scope.',
  },
  {
    title: 'Data Done',
    accent: 'blue' as const,
    body: 'Canonical source-status, source-record, snapshot, and trace artifacts exist for the supported lanes, and parity checks show the bridge path is trustworthy.',
  },
  {
    title: 'Ops Done',
    accent: 'amber' as const,
    body: 'The team can inspect freshness, source posture, parity, and rebuild behavior without digging through raw collections or guessing what the runtime used.',
  },
];

const MUST_HAVE_ROWS = [
  ['Canonical snapshot is the runtime source of truth for scoped PulseCheck health flows', 'Required', 'This is the architectural cutover, not just a storage side project.'],
  ['QuickLifts bridge lane is producing canonical docs in live environments', 'Required', 'Protects current value while the new system rolls out.'],
  ['PulseCheck-native HealthKit lane can create useful standalone context', 'Required', 'Needed for athletes who do not use QuickLifts / FitWithPulse.'],
  ['Health runtime exposes honest states like ready, no permission, no data, stale, and error', 'Required', 'Prevents misleading athlete messaging.'],
  ['Parity tooling exists and has been run against representative bridge scenarios', 'Required', 'Confirms the canonical snapshot matches the current system where it should.'],
  ['Freshness and source-posture semantics are trustworthy', 'Required', 'A zero-filled placeholder day cannot masquerade as real recovery context.'],
  ['Firestore schema, indexes, and registry are in sync across dev and prod', 'Required', 'Prevents runtime drift and environment surprises.'],
  ['At least one operator-visible validation surface exists', 'Required', 'Could be parity reports, trace views, source posture inspection, or rebuild controls.'],
  ['Focused test harness coverage is green for bridge, runtime resolver, and native HealthKit path', 'Required', 'Close-out should not rely on hope or manual spot checks only.'],
  ['No new health consumer is allowed to add fresh legacy direct-read branches', 'Required', 'Prevents backsliding while the system is stabilizing.'],
];

const NICE_TO_HAVE_ROWS = [
  ['Direct Oura connector live in production', 'Nice to have', 'Important next expansion lane, but not required to call the core pipeline complete.'],
  ['Historical backfill beyond the recent working window', 'Nice to have', 'Improves trend depth but should not block first system completion.'],
  ['Broader consumer rollout outside Nora', 'Nice to have', 'Dashboards, coach projections, and more surfaces can follow once the core path is stable.'],
  ['Richer operator UI for traces and rebuilds', 'Nice to have', 'Helpful for scale, but basic operability is enough for first close-out.'],
  ['Coach-facing privacy-filtered health projections', 'Nice to have', 'Separate sensitive-surface milestone, not required for the core pipeline close.'],
  ['Multi-source merge depth beyond QuickLifts + HealthKit', 'Nice to have', 'Future-proofing expansion, not MVP completion.'],
];

const CLOSE_OUT_ROWS = [
  ['Bridge-only athlete passes parity', 'A real or mock athlete using QuickLifts-backed context shows no meaningful parity drift on the validator fields.', 'Validates migration lane.'],
  ['Standalone athlete path works', 'An athlete with no QuickLifts usage can still produce meaningful context from PulseCheck-native HealthKit.', 'Validates standalone promise.'],
  ['Runtime UX is honest under failure', 'Denied, stale, disconnected, and empty-data states are visible and understandable in the product.', 'Validates product trust.'],
  ['Operational inspection is possible', 'Team can inspect source posture, canonical presence, and rebuild/parity status without custom ad hoc scripts every time.', 'Validates supportability.'],
  ['Feature-flag decision is clear', 'Either the canonical runtime flag is enabled for the intended scope or there is a documented reason it is not yet enabled.', 'Validates rollout readiness.'],
];

const BLOCKERS = [
  'Canonical collections still exist only on paper and are not populated in the target environment.',
  'Runtime still depends on direct `daily-health-summaries` reads for the scoped health experience.',
  'HealthKit standalone path cannot produce context without QuickLifts present.',
  'Parity shows unresolved drift on the bridge path for supported fields.',
  'Freshness or source posture is still ambiguous enough that the UX can lie to the athlete.',
  'The team cannot tell which source the runtime actually used for an answer.',
];

const OUT_OF_SCOPE = [
  'Oura does not need to be complete for the health-context pipeline to count as done.',
  'Every dashboard and coach surface does not need to be migrated before we can close the core feature.',
  'Perfect historical migration is not required if recent-window runtime value is solid and explicit.',
  'A polished operator console is not mandatory if the team already has enough inspection and rebuild capability.',
];

const SIGNOFF_ROWS = [
  ['Product', 'The athlete experience is honest and the supported user stories work end to end.', 'Required'],
  ['PulseCheck iOS', 'Runtime cutover is stable and new health work is building on snapshots, not legacy reads.', 'Required'],
  ['QuickLifts / bridge owner', 'Shared-summary bridge quality and parity are acceptable for the supported scope.', 'Required'],
  ['Platform / data owner', 'Canonical collections, indexes, and rebuild behavior are production-safe.', 'Required'],
  ['Ops / QA', 'Validation scenarios have been exercised and the team can inspect failures or drift quickly.', 'Required'],
];

const PulseCheckHealthContextDefinitionOfDoneTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="PulseCheck Health Context"
        title="Health Context Definition Of Done"
        version="Version 0.1 | March 17, 2026"
        summary="Close-out artifact for deciding when the PulseCheck health-context feature is actually done. This document separates launch-blocking must-haves from expansion-oriented nice-to-haves so the team can stop treating open opportunity as unfinished core system work."
        highlights={[
          {
            title: 'Done Means Operationally Real',
            body: 'The pipeline is not done when code exists. It is done when runtime, data, tests, and operator inspection all work together for the intended scope.',
          },
          {
            title: 'Must-Have Vs Nice-To-Have',
            body: 'Oura, richer dashboards, and deeper backfill matter, but they should not keep the core health-context feature open forever if the primary system promise is already satisfied.',
          },
          {
            title: 'Close On Supported Scope',
            body: 'We should close this feature when bridge-backed and standalone athlete paths are both trustworthy for the agreed runtime surface, not when every future source and consumer is shipped.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Exit-criteria artifact for the health-context pipeline and runtime rollout. Use this page when deciding whether the feature can be marked complete, whether open work is still blocking, and whether a proposed task belongs to core completion or later expansion."
        sourceOfTruth="This document is authoritative for what counts as required completion versus optional expansion for the current health-context feature."
        masterReference="Use this page during milestone review, release readiness, feature close-out, and post-rollout cleanup decisions."
        relatedDocs={[
          'Health Context Architecture',
          'Health Context Implementation Rollout Plan',
          'Health Context Engineering Task Breakdown',
          'Health Context Firestore Schema & Index Spec',
          'Oura Integration Strategy',
        ]}
      />

      <SectionBlock icon={CheckCircle2} title="What Done Means">
        <CardGrid columns="md:grid-cols-3">
          {DONE_CARDS.map((card) => (
            <InfoCard key={card.title} title={card.title} accent={card.accent} body={card.body} />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ClipboardList} title="Must-Haves">
        <DataTable columns={['Requirement', 'Priority', 'Why It Blocks Close-Out']} rows={MUST_HAVE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Sparkles} title="Nice-To-Haves">
        <DataTable columns={['Future Item', 'Priority', 'Why It Does Not Block Core Completion']} rows={NICE_TO_HAVE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Close-Out Gates">
        <DataTable columns={['Gate', 'Definition', 'Why']} rows={CLOSE_OUT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Signoff Checklist">
        <DataTable columns={['Owner', 'What They Must Be Comfortable With', 'Level']} rows={SIGNOFF_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Feature Can Be Closed When"
            accent="green"
            body={<BulletList items={['The bridge lane is trustworthy.', 'The standalone HealthKit lane is real.', 'Runtime reads snapshots for the supported scope.', 'Operators can inspect and validate the system.', 'Remaining open work is expansion, not core viability.']} />}
          />
          <InfoCard
            title="Feature Must Stay Open When"
            accent="red"
            body={<BulletList items={BLOCKERS} />}
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Sparkles} title="Explicitly Out Of Scope For Close-Out">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Do Not Hold The Feature Open For"
            accent="amber"
            body={<BulletList items={OUT_OF_SCOPE} />}
          />
          <InfoCard
            title="Recommended Next Wave After Close-Out"
            accent="blue"
            body={<BulletList items={['Direct Oura connector and merge policy rollout.', 'Broader dashboard and coach projection consumers.', 'Richer rebuild tooling and trace UI.', 'Longer-window historical migration and backfill depth.']} />}
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckHealthContextDefinitionOfDoneTab;
