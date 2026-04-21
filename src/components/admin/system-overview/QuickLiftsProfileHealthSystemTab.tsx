import React from 'react';
import {
  Activity,
  BarChart3,
  Clock3,
  Database,
  FileText,
  GitBranch,
  Layers,
  RefreshCw,
  Shield,
  Target,
} from 'lucide-react';
import ArtifactPageLibrary, { ArtifactPageEntry } from './ArtifactPageLibrary';
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

const EXPERIENCE_ROWS = [
  ['Health Story Hero', 'Plain-language daily state, summary, top drivers, freshness, source chips, and full-story CTA', 'Lead with interpretation, not a giant score.'],
  ['Goal Context', 'One-line connection from today’s state to the athlete’s active goal', 'Fallback to a generic training-context sentence when no goal exists.'],
  ['Recovery + Readiness', 'Primary proof card for how recovered the athlete is right now', 'Prefer Oura when fresh; fall back to Apple Health HRV and resting-heart-rate interpretation.'],
  ['Sleep', 'Sleep duration, quality, and stage context', 'Prefer Oura when fresh; otherwise use enhanced HealthKit plus manual sleep context.'],
  ['Movement + Workouts', 'Steps, workouts, movement minutes, and training output', 'Unify Apple Health and Fit With Pulse-native training signals without double counting.'],
  ['Nutrition + Energy', 'Fueling and output context', 'Use reconciliation logic so intake and burn are comparable instead of duplicate calorie views.'],
  ['Body Trends', 'Latest body metric plus short trend context', 'Keep as a supporting context card, never the headline story.'],
  ['Full Story Drill-Down', 'Detailed health story modal with deeper sections and date navigation', 'Must open aligned to the same snapshot narrative used on profile.'],
];

const SOURCE_ROWS = [
  ['Recovery / readiness', 'Oura', 'Apple Health HRV + resting heart rate interpretation', 'If neither lane is trustworthy, the hero should say `Needs More Data`.'],
  ['Sleep', 'Oura', 'Enhanced HealthKit + manual sleep, then HealthKit-only or manual-only', 'Use source chips and freshness so athletes know what powered the sleep read.'],
  ['Movement / workouts', 'Apple Health plus Fit With Pulse-native sessions', 'Phone fallback where already supported', 'Show one coherent movement story rather than duplicate workout containers.'],
  ['Nutrition / energy', 'Fit With Pulse legacy food context plus HealthKit burn; deep nutrition now belongs in Macra', 'HealthKit-only or manual supplementation', 'Do not blindly sum overlapping calorie systems.'],
  ['Body trends', 'Newest valid body metric regardless of source', 'Fit With Pulse manual body weight if Apple Health is absent', 'Freshness cadence is slower than recovery or movement domains.'],
];

const HEADLINE_ROWS = [
  ['`readyToPush`', 'High-confidence day with supportive recovery and sleep plus no meaningful fueling or load constraint', 'Use sparingly. This is earned, not the default positive state.'],
  ['`onTrack`', 'Steady-state healthy day with enough data and no major limiter', 'Default good state when signals are supportive or neutral.'],
  ['`buildCarefully`', 'Real caution exists, but not a hard stop', 'Use for moderate recovery drag, underfueling, sleep drag, or fallback-only evidence that still supports training with care.'],
  ['`recoveryNeeded`', 'Strongest limiter is a high-severity recovery or sleep constraint', 'Lead with the constraint instead of averaging it away with strong movement.'],
  ['`needsMoreData`', 'Coverage is too weak or confidence is low', 'Prefer honesty over optimistic speculation when core domains are missing or stale.'],
];

const EMPTY_STATE_ROWS = [
  ['No wearables connected', 'Explain the value of connecting Apple Health and Oura, keep the surface usable, and show connect CTAs.'],
  ['Apple Health only', 'Show movement, energy, heart, and workout-based stories with fallback recovery interpretation.'],
  ['Oura only', 'Show sleep and recovery context, and explain that workout depth improves with Apple Health.'],
  ['Sparse data', 'Use `Needs More Data`, explain what is missing, and avoid empty premium-looking cards.'],
  ['Partial sync failure', 'Keep healthy domains usable and degrade only the affected domain with explicit source messaging.'],
  ['Stale cache', 'Show historical context if available, but do not present stale guidance as fresh advice.'],
];

const SNAPSHOT_FIELD_ROWS = [
  ['Identity', '`id`, `userId`, `snapshotDateKey`, `windowType`, `timezone`', 'At most one active daily snapshot per user and day.'],
  ['Versioning', '`schemaVersion`, `generationRulesVersion`, `sourceResolutionVersion`', 'Persisted with every snapshot so teams can trace which rules produced a headline later.'],
  ['Narrative', '`headline`, `goalContext`, `confidence`, `sourcesUsed`', 'Hero, cards, and modal entry all read the same interpretation layer.'],
  ['Freshness + coverage', '`freshnessByDomain`, `coverage`, `generatedAt`, `expiresAt`', 'Separate domain staleness from snapshot TTL.'],
  ['Cards', '`recoveryReadiness`, `sleep`, `movementWorkouts`, `nutritionEnergy`, `bodyTrends`', 'Cards prove the story rather than generating their own conflicting narratives.'],
  ['Lineage', '`basedOnDailySummaryId`, `basedOnHealthContextSnapshotId`, `basedOnHealthContextRevisionId`', 'Keep clear provenance to upstream health-context inputs.'],
  ['Diagnostics', '`diagnostics`', 'Internal-only in v1; useful for debug builds and implementation QA.'],
];

const FRESHNESS_ROWS = [
  ['Oura recovery / readiness / sleep', '24 hours', 'Fall back to Apple Health or `Needs More Data` depending on domain coverage.'],
  ['Apple Health movement / workouts / heart', '12 hours', 'A stale movement lane can still support history, but not fresh hero claims for today.'],
  ['Fit With Pulse workouts / legacy food / manual entries', '12 hours', 'Invalidate immediately on local write so profile reacts to the athlete’s action.'],
  ['Body trends', '7 days', 'Treat body metrics as slower-moving context, not same-day decay.'],
  ['Snapshot cache TTL', '15 minutes or next local midnight', 'Expired snapshots may render as stale while regeneration runs.'],
];

const INVALIDATION_STEPS = [
  {
    title: 'Load cached snapshot when valid',
    body: 'Opening profile should use the newest non-expired snapshot first so the screen feels instant, then decide whether regeneration is needed.',
    owner: 'ProfileHealthSnapshotService',
  },
  {
    title: 'Regenerate on source and write events',
    body: 'New meals, workouts, manual body-weight edits, manual sleep edits, Apple Health refresh completion, and Oura refresh completion should invalidate affected domains immediately.',
    owner: 'Snapshot service + sync hooks',
  },
  {
    title: 'Honor trigger precedence',
    body: 'Manual refresh should outrank passive refresh events. If multiple triggers arrive together, coalesce them into one regeneration run with the strongest trigger reason attached.',
    owner: 'Snapshot service',
  },
  {
    title: 'Keep historical dates honest',
    body: 'For past dates, evaluate completeness relative to that selected day’s available evidence rather than labeling the whole snapshot stale relative to now.',
    owner: 'Snapshot service + view model',
  },
  {
    title: 'Store diagnostics behind an internal gate',
    body: 'Diagnostics can stay memory-only or be persisted for internal builds, but they must not leak into athlete-facing v1 UI or public sharing paths.',
    owner: 'Engineering + QA',
  },
];

const OURA_ROWS = [
  ['Sleep-derived recovery fields', '`sleepDuration`, `deepSleepDuration`, `remSleepDuration`, `sleepEfficiency`, `timeInBedHours`, `heartRateResting`, `heartRateVariability`, `respiratoryRate`'],
  ['Readiness-derived fields', '`readinessScore`, `recoveryIndex`, `temperatureDeviation`, `readinessState`'],
  ['Availability rule', 'Treat these as synced health-context inputs, not values inferred from connection status alone.'],
  ['Coverage rule', 'Support `connected but no fresh payload` without fabricating Oura-backed cards.'],
];

const ENERGY_SOURCE_ROWS = [
  ['Apple Health / HealthKit', 'Direct active + basal energy plus day-level aggregation', 'Primary contributor in v1', 'Treat as the core day aggregate, but validate mirrored writes before allowing any additive overlay.'],
  ['Fit With Pulse-native workouts', 'Session timing, calorie provenance, and unsynced gap-fill coverage', 'Contributing source only', 'Only approved workout families may overlay active calories before HealthKit catch-up.'],
  ['Manual energy entries', 'Athlete-authored corrections for missing or wrong device data', 'Correction source', 'Time window present means `windowScoped`; no time window means `fullDay` correction intent in v1.'],
  ['Estimator', 'BMR / historical / hybrid fallback decomposition', 'Fallback only', 'Use when direct coverage is weak, lower confidence, and explain the inference.'],
  ['Oura', 'Agreement validation and future enrichment', 'Validator-only in v1', 'May improve confidence or expose discrepancies, but must not contribute calories in v1.'],
];

const ENERGY_SNAPSHOT_ROWS = [
  ['Identity + timing', '`id`, `userId`, `snapshotDateKey`, `timezone`, `generatedAt`, `expiresAt`', 'All day windows and cache boundaries are anchored to the athlete-local timezone.'],
  ['Resolved values', '`restingCalories`, `activeCalories`, `totalCalories`', 'Preserve `total = resting + active`, even if components require inferred decomposition with a confidence penalty.'],
  ['Resolution provenance', '`primarySourceByMetric`, `resolutionLabel`, `contributingSources`, `validatingSources`', 'Persist the winner story without pretending `enhanced` is a raw source family.'],
  ['Trust + state', '`confidence`, `freshness`, `coverage`, `discrepancyFlags`, `isProvisional`', 'Captures completeness, sync lag, duplicate-risk suppression, and rollout-safe UI hints.'],
  ['Traceability', '`segments`, `diagnostics`', 'Segments keep raw source refs so operators can answer why a day resolved the way it did.'],
];

const ENERGY_RULE_ROWS = [
  ['Resting / basal', 'Apple Health direct basal energy', 'Manual correction, then estimator', 'Fit With Pulse workouts do not author resting calories.'],
  ['Active calories', 'Apple Health direct active energy', 'Approved Fit With Pulse gap fill, manual correction, estimator', 'Never stack Fit With Pulse overlays on top of mirrored Apple Health workout burn.'],
  ['Total calories out', 'Derived from resolved resting + active', 'Trusted total proxy only when components are weak', 'Never sum multiple full-day totals from different systems.'],
  ['Home surface', '`ResolvedEnergySnapshot.totalCalories`', 'N/A', 'Use a compact source label only in v1; keep detailed contributor composition out of Home.'],
  ['Profile + nutrition surfaces', 'Same `ResolvedEnergySnapshot` object', 'N/A', 'Do not let Home, Profile, and net-energy views drift onto different calorie-out answers.'],
];

const ENERGY_ACCEPTANCE_ROWS = [
  ['Clean Apple Health day', '`singleSource`, high confidence, no discrepancy flags.'],
  ['Missing-watch manual correction', 'Manual calories apply only to the corrected window with no double counting.'],
  ['Fit With Pulse workout before HealthKit catch-up', 'Pending-sync overlay fills the gap, then de-duplicates after HealthKit confirms it.'],
  ['Mirrored Oura agreement', 'Apple Health stays primary, Oura validates only, and confidence rises.'],
  ['Trusted total without component breakdown', 'Resolver preserves the total invariant through inferred components and logs diagnostics.'],
  ['Historical recompute with incomplete data', 'Freshness can be acceptable while coverage still shows the day is incomplete.'],
];

const ENERGY_GUARDRAILS = [
  'No direct Oura calorie contribution in v1; keep it validator-only behind the current gate.',
  'No Home migration until the acceptance matrix passes for both today and historical dates.',
  'No new parallel energy path; evolve `EnhancedEnergyDataService` into the canonical resolver.',
  'No ungated Fit With Pulse active-calorie overlays; only approved workout families may participate.',
  'Treat `EnergySourceRecordRef` as required for any non-inferred segment wherever the raw source record exists.',
];

const STORY_LOCKS = [
  'Lead with one descriptive state and short summary before raw metrics.',
  'Never imply a medical diagnosis or use clinical language in the profile story.',
  'Do not let cards or the drill-down modal compute a separate headline for the same day.',
  'Keep confidence internal-only in athlete-facing v1 and use it to shape copy tone instead of showing a badge.',
  'Keep health stories private by default until the athlete explicitly shares them in a future release.',
];

const CONTRACT_LOCKS = [
  'Persist version fields with every snapshot so rule changes are traceable.',
  'Use deterministic headline-state selection instead of letting each module infer its own state.',
  'Apply source precedence before rendering any metric card or hero copy.',
  'Separate domain freshness from cache expiry so a valid snapshot can still expose a stale domain honestly.',
  'Align modal entry-state to the snapshot narrative, even if the modal renders richer raw charts below it.',
];

export const QuickLiftsProfileHealthStorySpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Fit With Pulse Profile System"
        title="Profile Health Story Spec"
        version="Spec v2 | March 23, 2026"
        summary="Product and UX contract for turning the Fit With Pulse profile into a story-led health surface. This artifact defines the hero, proof cards, privacy defaults, source transparency, and the shared constraints that keep Apple Health, Oura, and Fit With Pulse-native signals coherent in one profile experience."
        highlights={[
          {
            title: 'Story First, Proof Second',
            body: 'The profile should answer “how am I doing right now?” before it asks the athlete to interpret a wall of raw health metrics.',
          },
          {
            title: 'One Snapshot Under Everything',
            body: 'Hero, supporting cards, and the full health story modal must all derive from the same `ProfileHealthSnapshot` instead of computing separate narratives.',
          },
          {
            title: 'Private By Default',
            body: 'Health insight modules stay athlete-private in v1, with any future public sharing treated as an explicit opt-in layer.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Authoritative product contract for how Fit With Pulse should present health stories inside the profile without losing the deeper Health Data Story experience."
        sourceOfTruth="This page is authoritative for profile information architecture, hero behavior, source transparency, privacy posture, and no-data / sparse-data / stale-state user treatment."
        masterReference="Use the Profile Health Snapshot Contract when implementing service behavior, freshness evaluation, source precedence, invalidation, and modal entry-state alignment."
        relatedDocs={[
          'PROFILE_HEALTH_STORY_SPEC.md',
          'PROFILE_HEALTH_SNAPSHOT_CONTRACT.md',
          'ProfileView.swift',
          'ActivityDetailModal.swift',
          'ActivityDetailModalViewModel.swift',
        ]}
      />

      <SectionBlock icon={Layers} title="V1 Experience Shape">
        <DataTable columns={['Module', 'Contents', 'Locked Rule']} rows={EXPERIENCE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Activity} title="Source Priority By Domain">
        <DataTable columns={['Domain', 'Primary source', 'Fallback', 'V1 note']} rows={SOURCE_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Enhanced Means Reconciled"
            accent="blue"
            body="Use `Enhanced` when the story or card reflects multiple sources or reconciliation logic. Do not surface enriched values as though they came from one single raw source."
          />
          <InfoCard
            title="Conflict Rule"
            accent="amber"
            body="When domains disagree, lead with the strongest limiting factor first. Strong movement does not cancel weak recovery, and strong sleep does not erase clear underfueling for the active goal."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={BarChart3} title="Headline States And Story Guardrails">
        <DataTable columns={['State', 'Meaning', 'Copy posture']} rows={HEADLINE_ROWS} />
        <InfoCard title="Locked Story Rules" accent="green" body={<BulletList items={STORY_LOCKS} />} />
      </SectionBlock>

      <SectionBlock icon={Shield} title="Privacy, Missing Data, And Graceful Degradation">
        <DataTable columns={['Scenario', 'Required behavior']} rows={EMPTY_STATE_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Public Profile Rule"
            accent="red"
            body="Public profile should continue to show safe existing stats only. Detailed health stories and proof cards remain private unless a future explicit sharing control is added."
          />
          <InfoCard
            title="Goal Context Fallback"
            accent="purple"
            body="If the athlete has no active goal, keep the module visible with a generic training-context explanation rather than leaving an empty gap beneath the hero."
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export const QuickLiftsProfileHealthSnapshotContractTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Fit With Pulse Runtime Contract"
        title="Profile Health Snapshot Contract"
        version="Contract v1 | March 23, 2026"
        summary="Implementation-facing contract for the shared `ProfileHealthSnapshot` read model. This artifact defines the versioned schema, source precedence, freshness behavior, invalidation model, and modal-alignment rules that keep profile health interpretation deterministic."
        highlights={[
          {
            title: 'Versioned Snapshot Truth',
            body: 'Every snapshot carries schema, generation-rules, and source-resolution versions so teams can trace which logic produced a health story later.',
          },
          {
            title: 'Deterministic Headline Selection',
            body: 'The hero state is chosen from a fixed decision table rather than being inferred separately by hero, cards, or modal components.',
          },
          {
            title: 'Freshness And Invalidation Are Explicit',
            body: 'Domain thresholds, snapshot TTL, and write-trigger invalidation rules make the profile responsive without pretending stale data is current.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Authoritative engineering contract for how the profile health snapshot is shaped, generated, cached, invalidated, and consumed across profile and modal surfaces."
        sourceOfTruth="This page is authoritative for `ProfileHealthSnapshot` schema, required card payloads, version fields, freshness rules, trigger behavior, source precedence, and Oura capability assumptions for v1."
        masterReference="Use the Profile Health Story Spec for surface behavior and copy posture. Use this page when implementing `ProfileHealthSnapshotService`, profile health view models, cache invalidation, and drill-down alignment."
        relatedDocs={[
          'PROFILE_HEALTH_SNAPSHOT_CONTRACT.md',
          'HealthDataModels.swift',
          'HealthDataSyncService.swift',
          'EnhancedEnergyDataService.swift',
          'oura-sync.js',
        ]}
      />

      <SectionBlock icon={Database} title="Snapshot Shape">
        <DataTable columns={['Group', 'Required fields', 'Why it exists']} rows={SNAPSHOT_FIELD_ROWS} />
        <InfoCard title="Engineering Locks" accent="green" body={<BulletList items={CONTRACT_LOCKS} />} />
      </SectionBlock>

      <SectionBlock icon={GitBranch} title="Headline Decision And Freshness Rules">
        <DataTable columns={['Headline state', 'Contract rule', 'Implication']} rows={HEADLINE_ROWS} />
        <DataTable columns={['Domain', 'Stale after', 'Runtime behavior']} rows={FRESHNESS_ROWS} />
      </SectionBlock>

      <SectionBlock icon={RefreshCw} title="Generation And Invalidation Flow">
        <StepRail steps={INVALIDATION_STEPS} />
      </SectionBlock>

      <SectionBlock icon={Clock3} title="Oura v1 Capability Baseline">
        <DataTable columns={['Lane', 'Fields or rule']} rows={OURA_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Connection State Is Not Data"
            accent="red"
            body="A connected Oura account should influence connect-state messaging, but it must not be treated as proof that today’s recovery or sleep payload is present and fresh."
          />
          <InfoCard
            title="Confidence Treatment"
            accent="blue"
            body="Confidence stays internal-only in athlete-facing v1 UI. Use it to soften or strengthen copy, stale-state language, and fallback posture rather than showing a visible badge."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Target} title="Implementation Notes To Preserve">
        <InfoCard
          title="Build Notes"
          accent="amber"
          body={
            <BulletList
              items={[
                'Manual refresh should outrank passive sync completions when choosing the winning trigger reason.',
                'Historical dates should be evaluated for completeness relative to the selected day, not marked stale just because they are in the past.',
                'Diagnostics must stay behind an internal-only gate even if engineering chooses to persist them for QA or debug analysis.',
              ]}
            />
          }
        />
      </SectionBlock>
    </div>
  );
};

export const QuickLiftsProfileHealthEnergyMergeSpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Fit With Pulse Runtime Contract"
        title="Enhanced Energy Merge Spec"
        version="Spec v1 | March 24, 2026"
        summary="Canonical contract for resolving calories out across Apple Health, Fit With Pulse-native workouts, manual corrections, estimators, and Oura validation without double counting. This artifact locks the shared `ResolvedEnergySnapshot` model that Home, Profile, and Macra-facing nutrition context should all consume where applicable."
        highlights={[
          {
            title: 'One Calories-Out Truth',
            body: 'Home, Profile, and net-energy views should all read the same resolved output instead of mixing raw HealthKit totals on one surface and enriched values on another.',
          },
          {
            title: 'Multiple Sources, No Double Count',
            body: 'Segments, coverage, and mirrored-source suppression let Fit With Pulse enrich device data without stacking the same underlying workout twice.',
          },
          {
            title: 'Conservative V1 Guardrails',
            body: 'Oura stays validator-only, Fit With Pulse overlays require an explicit whitelist, and Home does not migrate until the acceptance matrix passes.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Authoritative engineering contract for how Fit With Pulse should resolve daily energy output across multiple sources while preserving provenance, coverage, and rollout-safe UI behavior."
        sourceOfTruth="This page is authoritative for `ResolvedEnergySnapshot`, source precedence, segment provenance, coverage modeling, duplicate suppression, pending-sync behavior, and Home/Profile migration guardrails."
        masterReference="Use the Profile Health Snapshot Contract when wiring the resolved calories-out result into broader profile narrative generation. Use this page when implementing the energy resolver itself."
        relatedDocs={[
          'ENHANCED_ENERGY_MERGE_SPEC.md',
          'EnhancedEnergyDataService.swift',
          'HealthDataSyncService.swift',
          'HomePulseView.swift',
          'ManualEntry.swift',
        ]}
      />

      <SectionBlock icon={Layers} title="Source Families And Roles">
        <DataTable columns={['Source', 'Best use', 'V1 role', 'Locked rule']} rows={ENERGY_SOURCE_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Traceability Is Required"
            accent="red"
            body="`EnergySourceRecordRef` should be treated as required for any non-inferred segment wherever the underlying raw record exists. Missing refs in those cases are a traceability bug, not optional cleanup work."
          />
          <InfoCard
            title="Mirrored Source Safety"
            accent="amber"
            body="When mirror certainty is low, suppress additive contribution and record diagnostics rather than risking duplicate calories on Home."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Database} title="Resolved Snapshot Contract">
        <DataTable columns={['Group', 'Locked fields', 'V1 meaning']} rows={ENERGY_SNAPSHOT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={GitBranch} title="Resolution Rules And Guardrails">
        <DataTable columns={['Lane', 'Primary owner', 'Fallback / contributor path', 'Locked v1 rule']} rows={ENERGY_RULE_ROWS} />
        <InfoCard title="V1 Delivery Locks" accent="green" body={<BulletList items={ENERGY_GUARDRAILS} />} />
      </SectionBlock>

      <SectionBlock icon={RefreshCw} title="Acceptance Matrix And Migration Gate">
        <DataTable columns={['Scenario', 'Expected outcome']} rows={ENERGY_ACCEPTANCE_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Home Display Rule"
            accent="blue"
            body="Home should stay intentionally simple in v1: compact source label, provisional-state treatment when needed, and no detailed contributor composition."
          />
          <InfoCard
            title="Coverage Drives Trust"
            accent="purple"
            body="Coverage is a first-class snapshot field because confidence, historical completeness, and rollout safety all depend on how much of the day is direct, corrected, inferred, or still missing."
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

const PROFILE_HEALTH_PAGES: ArtifactPageEntry[] = [
  {
    id: 'profile-health-story-spec',
    label: 'Story Spec',
    subtitle: 'Hero, proof cards, source transparency, privacy, and graceful profile states.',
    icon: FileText,
    accent: '#84cc16',
    render: () => <QuickLiftsProfileHealthStorySpecTab />,
  },
  {
    id: 'profile-health-snapshot-contract',
    label: 'Snapshot Contract',
    subtitle: 'Versioned read model, freshness, invalidation, and modal alignment rules.',
    icon: Database,
    accent: '#38bdf8',
    render: () => <QuickLiftsProfileHealthSnapshotContractTab />,
  },
  {
    id: 'profile-health-energy-merge-spec',
    label: 'Energy Merge Spec',
    subtitle: 'Canonical calories-out resolution across Apple Health, Fit With Pulse, manual corrections, estimators, and Oura validation.',
    icon: Activity,
    accent: '#f97316',
    render: () => <QuickLiftsProfileHealthEnergyMergeSpecTab />,
  },
];

const QuickLiftsProfileHealthSystemTab: React.FC = () => {
  return (
    <ArtifactPageLibrary
      eyebrow="Fit With Pulse · Profile Health"
      title="Profile Health System Library"
      summary="Handbook library for the Fit With Pulse profile-health stack, including the story-led surface contract, the shared `ProfileHealthSnapshot` runtime model, and the canonical enhanced-energy resolution spec that keeps calories out consistent across Home and Profile. QuickLifts remains the internal repo/runtime lineage name."
      entries={PROFILE_HEALTH_PAGES}
    />
  );
};

export default QuickLiftsProfileHealthSystemTab;
