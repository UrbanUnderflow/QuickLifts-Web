import React from 'react';
import { Activity, Database, Link2, ShieldCheck, Smartphone, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const CURRENT_BASELINE_ROWS = [
  ['Apple Watch / HealthKit', 'Platform bridge and permission layer for iOS-first athletes.', 'Current baseline lane for wearable health context.'],
  ['Oura', 'Direct Oura API plus Apple Health fallback when direct consent is unavailable.', 'Current premium recovery lane with dual-path support.'],
];

const INTEGRATION_TAXONOMY_ROWS = [
  ['Consumer wearable', 'Personal device with fitness, sleep, heart-rate, recovery, or training context.', 'Garmin, Oura, Whoop, Polar, Fitbit, COROS'],
  ['Mobile health platform', 'OS-level aggregator or permission layer that mirrors many devices.', 'Apple HealthKit, Samsung Health / Health Connect'],
  ['Biometric / wellness device', 'Body composition, blood pressure, weight, or recovery-adjacent device.', 'Withings'],
  ['Team / enterprise system', 'Club, college, or pro-performance feed with session and workload context.', 'Catapult'],
  ['Ecosystem app', 'No public device API; only bridgeable through another platform.', 'Nike ecosystem'],
];

const WISHLIST_ROWS = [
  ['Tier 1', 'Garmin', 'Best all-around athlete value: training load, sleep, recovery, and broad brand recognition.', 'Partner API / cloud feed when available'],
  ['Tier 1', 'Polar', 'Clean sports-data model and strong training pedigree.', 'Direct API / partner feed'],
  ['Tier 1', 'Withings', 'Biometrics, body composition, sleep, and health-adjacent depth.', 'Direct API'],
  ['Tier 1', 'Samsung Health / Galaxy Watch', 'Android scale plus a strong platform bridge path.', 'Health Connect / Samsung Health SDK'],
  ['Tier 1', 'Catapult', 'Elite team performance data and high-value B2B alliance potential.', 'Enterprise feed / partner integration'],
  ['Tier 2', 'Whoop', 'Recovery-first positioning and strong athlete community.', 'Partner API or platform bridge'],
  ['Tier 2', 'COROS', 'Endurance niche with useful training and activity context.', 'Partner API / cloud feed'],
  ['Tier 2', 'Fitbit', 'Broad consumer reach and legacy sleep/activity coverage.', 'Public API'],
  ['Tier 3', 'Nike ecosystem', 'Brand halo is real, but direct device/API access is weak.', 'Bridge only until a true API exists'],
];

const INTEGRATION_PRINCIPLES = [
  'One canonical athlete-context contract: every source normalizes into source records before anything reaches Nora or coach surfaces.',
  'Direct vendor/API lanes win over mirrored data when both exist for the same domain and day.',
  'Platform bridges remain first-class: HealthKit and Health Connect are not “fallback-only” if they are the native lane for the athlete.',
  'Alliance value matters: prioritize vendors that expand athlete reach and strategic partnership options, not just raw data volume.',
];

const SOURCE_RECORD_ROWS = [
  ['Garmin daily summary / activity', '`summary_input` / `measurement`', 'Training volume, activity, recovery, sleep, and readiness-like signals.'],
  ['Polar training / HR / sleep', '`measurement` / `session` / `summary_input`', 'Workout context, heart-rate traces, sleep, and recovery inputs.'],
  ['Withings body metrics', '`measurement`', 'Weight, body composition, blood pressure, and related biometrics.'],
  ['Samsung Health / Galaxy Watch mirror', '`summary_input` / `measurement`', 'Android-side health and wearable context mirrored through the platform bridge.'],
  ['Whoop recovery / strain / sleep', '`summary_input` / `measurement`', 'Recovery-first context and daily strain/posture.'],
  ['COROS workouts', '`session` / `measurement`', 'Endurance workouts, activity, and related training context.'],
  ['Fitbit activity / sleep / HR', '`summary_input` / `measurement`', 'Consumer-scale activity, sleep, and heart-rate context.'],
  ['Catapult team session feed', '`session` / `derived_signal`', 'Team or enterprise workload, session, and athlete-load context.'],
  ['Nike ecosystem bridge', '`summary_input`', 'Only if Nike data is mirrored into a supported health platform.'],
];

const ROUTING_ROWS = [
  ['1', 'Shared QuickLifts / FitWithPulse training context', 'If available, keep workout and nutrition context from the shared app stack as the strongest training source.'],
  ['2', 'Direct vendor API / partner feed', 'Use the native device or vendor feed when available and consented.'],
  ['3', 'Platform bridge', 'Use HealthKit or Health Connect when the device primarily routes through the mobile health platform.'],
  ['4', 'Self-report / check-in context', 'Fill gaps only after device and platform lanes are evaluated.'],
];

const FRESHNESS_ROWS = [
  ['Direct vendor feed', 'Freshness should follow the provider sync marker or latest observation date.', 'Preferred when available.'],
  ['Platform bridge', 'Freshness should reflect the platform sync time plus a source-status check.', 'Acceptable when the device is meant to live inside HealthKit / Health Connect.'],
  ['Enterprise feed', 'Freshness should track session closeout or team sync completion.', 'Use for Catapult and similar systems.'],
  ['No active consent', 'Mark `no_permission` or `disconnected` and do not pretend the source is current.', 'Fail honest, not silent.'],
];

const RISKS_ROWS = [
  ['API availability changes', 'Some vendors require partner approval, membership, or can change access rules.', 'Prefer vendors with stable public docs and build fallback lanes early.'],
  ['Mirror gaps', 'HealthKit / Health Connect mirrors do not always expose every vendor-native field.', 'Use direct APIs where that richness matters.'],
  ['Duplicate signals', 'Steps, calories, and workouts can arrive from multiple sources.', 'Use source precedence and provenance to prevent silent double counting.'],
  ['Consent burden', 'Too many scopes or too many vendors can reduce opt-in.', 'Request minimum useful permissions and phase the rest.'],
  ['Android fragmentation', 'Samsung and Health Connect are powerful but add platform diversity.', 'Treat platform bridges as first-class, but model them explicitly.'],
  ['Niche ecosystems', 'Some brands have strong audience value but weak integration surfaces.', 'Keep a bridge-only lane until the API story improves.'],
];

const ROADMAP_ROWS = [
  ['Phase 1', 'Lock the device taxonomy, source-record mapping, and precedence rules.', 'Prevents one-off adapters from inventing their own shapes.'],
  ['Phase 2', 'Prioritize direct lanes for Garmin, Polar, Withings, and Samsung Health / Galaxy Watch.', 'Covers the most useful technical and alliance value early.'],
  ['Phase 3', 'Add Catapult, Whoop, COROS, and Fitbit as the next expansion tier.', 'Broadens the athlete and team footprint without breaking the contract.'],
  ['Phase 4', 'Keep Nike ecosystem integration bridge-only unless a real vendor API becomes available.', 'Avoids overbuilding on a weak direct path.'],
  ['Phase 5', 'Expose source-health, freshness, and retirement rules in ops tooling.', 'Keeps the integration matrix maintainable.'],
];

const STRATEGIC_CARDS = [
  {
    title: 'Best Technical Fit',
    accent: 'blue' as const,
    body: <BulletList items={['Garmin, Polar, and Withings give us the cleanest blend of signal richness and integration realism.', 'Samsung Health / Health Connect is essential for Android reach.', 'Catapult matters when the customer is a team, not just a single athlete.']} />,
  },
  {
    title: 'Best Alliance Fit',
    accent: 'green' as const,
    body: <BulletList items={['Garmin brings broad consumer trust.', 'Withings opens wellness and biometric adjacency.', 'Catapult opens the strongest enterprise and team-performance lane.']} />,
  },
  {
    title: 'Do Not Overbuild',
    accent: 'amber' as const,
    body: <BulletList items={['Nike ecosystem should stay bridge-only until a true API path appears.', 'Fitbit is valuable, but it should not outrank higher-fidelity training partners.', 'Every new source still has to normalize into the same canonical health-context pipeline.']} />,
  },
];

const DEVICE_LANES = [
  {
    title: 'Direct Vendor Lane',
    body: 'Use the device or vendor cloud API directly when the platform provides one and the consent model supports stable sync.',
    owner: 'Device connector layer',
  },
  {
    title: 'Platform Bridge Lane',
    body: 'Use HealthKit or Health Connect when the device is primarily meant to be consumed through the phone OS health stack.',
    owner: 'Mobile platform layer',
  },
  {
    title: 'Enterprise Feed Lane',
    body: 'Use team / club / pro systems like Catapult as workload and session feeds, then normalize them into the same athlete snapshot.',
    owner: 'Enterprise integrations',
  },
  {
    title: 'Bridge-Only Lane',
    body: 'If a vendor has no stable public integration path, keep it as a mirrored or secondary source rather than a first-class adapter.',
    owner: 'Strategy gate',
  },
];

const PulseCheckDeviceIntegrationStrategyTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="PulseCheck Health Context"
        title="Device Integration Strategy"
        version="Version 0.1 | March 17, 2026"
        summary="Operating reference for how PulseCheck should integrate wearables, platform bridges, and elite performance systems. The goal is to keep device integrations source-aware, freshness-aware, and normalized into the same canonical athlete-context pipeline instead of creating one-off adapters."
        highlights={[
          {
            title: 'One Pipeline',
            body: 'Every device or platform should normalize into the same source-record and snapshot system before Nora or coach surfaces consume it.',
          },
          {
            title: 'Direct Then Bridge',
            body: 'Prefer direct vendor APIs where available, but treat HealthKit and Health Connect as first-class platform lanes rather than second-class fallbacks.',
          },
          {
            title: 'Alliance-Aware',
            body: 'The wishlist should balance data quality with strategic partnerships, not just consumer volume.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Strategy artifact for deciding which device and platform integrations PulseCheck should pursue, how they should be classified, and how they should feed the canonical athlete-context pipeline."
        sourceOfTruth="This page is the reference for wearable, platform, and team-system integrations. It explains the integration taxonomy, wishlist tiers, routing rules, and why the same canonical contract must absorb every source."
        masterReference="Use this page when scoping new device work, deciding whether a vendor belongs on the roadmap, or checking how a vendor should map into source records and snapshots."
        relatedDocs={[
          'Health Context Architecture',
          'Athlete Context Snapshot Spec',
          'Health Context Source Record Spec',
          'Health Context Snapshot Assembler Spec',
          'Health Context Persistence & Storage Spec',
          'Health Context Operational Orchestration Spec',
          'Oura Integration Strategy',
        ]}
      />

      <SectionBlock icon={Activity} title="Current Baseline">
        <DataTable columns={['Lane', 'Current Role', 'Notes']} rows={CURRENT_BASELINE_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Important Boundary"
            accent="blue"
            body="QuickLifts / FitWithPulse still matters as a shared training-context source, but it is not a device integration. This document focuses on devices and platforms that can feed the same canonical health-context pipeline."
          />
          <InfoCard
            title="Current Strength"
            accent="green"
            body="Apple Watch / HealthKit and Oura already give PulseCheck a real starting point: one platform bridge lane and one dual-path recovery lane. The next step is expanding that model into a broader device system."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Database} title="Integration Taxonomy">
        <DataTable columns={['Class', 'What It Means', 'Examples']} rows={INTEGRATION_TAXONOMY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Wishlist And Partnership Priorities">
        <DataTable columns={['Tier', 'Target', 'Why It Belongs', 'Preferred Path']} rows={WISHLIST_ROWS} />
        <CardGrid columns="md:grid-cols-3">
          {STRATEGIC_CARDS.map((card) => (
            <InfoCard key={card.title} title={card.title} accent={card.accent} body={card.body} />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Link2} title="Source-Record Mapping">
        <DataTable columns={['Source', 'Canonical Record Type', 'Primary Payload']} rows={SOURCE_RECORD_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Routing And Freshness">
        <DataTable columns={['Priority', 'Lane', 'Rule']} rows={ROUTING_ROWS} />
        <div className="mt-4">
          <DataTable columns={['Source State', 'Meaning', 'Runtime Rule']} rows={FRESHNESS_ROWS} />
        </div>
      </SectionBlock>

      <SectionBlock icon={Database} title="Device Integration Lanes">
        <DataTable columns={['Lane', 'When To Use It', 'Owner']} rows={DEVICE_LANES.map((lane) => [lane.title, lane.body, lane.owner])} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Key Risks">
        <DataTable columns={['Risk', 'Impact', 'Mitigation']} rows={RISKS_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Rollout Recommendation">
        <DataTable columns={['Phase', 'Scope', 'Why']} rows={ROADMAP_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Suggested First Wave"
            accent="green"
            body="If we optimize for both technology and alliance value, the first wave should be Garmin, Polar, Withings, and Samsung Health / Galaxy Watch, with Catapult added for enterprise and team accounts."
          />
          <InfoCard
            title="Strategy Rule"
            accent="amber"
            body="No matter how many vendors we add, every one of them should land in the same canonical health-context pipeline. That is what keeps PulseCheck from becoming a pile of isolated device adapters."
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckDeviceIntegrationStrategyTab;
