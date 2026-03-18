import React from 'react';
import { AlertTriangle, ArrowRightLeft, Database, ShieldCheck, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const SOURCE_PATH_ROWS = [
  ['Direct Oura OAuth/API lane', 'PulseCheck connects to Oura through the Cloud API using OAuth2 and refresh tokens.', 'Primary path for Oura-native readiness and recovery context.'],
  ['HealthKit-derived fallback lane', 'Oura syncs into Apple Health / HealthKit and PulseCheck consumes the Apple Health mirror when the direct API is unavailable or not enabled.', 'Secondary path for compatibility and resilience.'],
  ['Canonical merge target', 'Both lanes should write into the same health-context source-record contract before snapshot assembly.', 'Keeps Nora and coach surfaces source-agnostic.'],
  ['Recommended default', 'Use direct Oura first, HealthKit fallback second.', 'Maximizes signal quality and keeps provenance honest.'],
];

const OURA_SCOPE_ROWS = [
  ['`email`', 'User email address', 'Optional; only request if PulseCheck needs it for account matching or support workflows.'],
  ['`personal`', 'Gender, age, height, weight', 'Useful for baselines and body-metric context, but keep minimum-necessary consent in mind.'],
  ['`daily`', 'Sleep, activity, and readiness daily summaries', 'Core scope for PulseCheck recovery and readiness context.'],
  ['`heartrate`', 'Time-series heart rate for Gen 3 users', 'Use when PulseCheck needs richer heart-rate traces than Apple Health fallback can provide.'],
  ['`workout`', 'Auto-detected and user-entered workouts', 'Useful for training load and activity attribution.'],
  ['`tag`', 'User-entered tags', 'Helpful for self-reported context and event markers.'],
  ['`session`', 'Guided and unguided sessions in the Oura app', 'Useful for recovery or mindfulness context.'],
  ['`spo2`', 'Daily SpO2 average recorded during sleep', 'Useful for recovery / respiratory context when available.'],
];

const HEALTHKIT_ROWS = [
  ['Exported from Oura to Apple Health', 'Active Energy, Heart Rate, Height, Mindful Minutes, Respiratory Rate, Sleep, Steps, Weight, Workouts, Workout Active Calories, Workout Distance, Workout Duration, Workout Type.', 'This is the fallback lane PulseCheck can consume without direct Oura OAuth.'],
  ['Imported from Apple Health to Oura', 'Date of Birth, Heart Rate, Height, Sex, Weight, Workout Routes, Workouts, Workout Calories, Workout Distance, Workout Duration, Workout Type.', 'Important for understanding what is mirrored back into Oura, but not all of it is Oura-native signal.'],
  ['Key limitation', 'Apple Health sync is iOS-only and depends on Oura app configuration plus phone/background refresh behavior.', 'HealthKit fallback is convenient, but not a full substitute for direct Oura API access.'],
];

const SOURCE_RECORD_ROWS = [
  ['Oura daily summary', '`oura` / `oura_daily_summary_api`', '`summary_input`', '`summary`, `activity`, `recovery`', 'Daily sleep, activity, readiness, and profile-derived values.'],
  ['Oura heart-rate series', '`oura` / `oura_heartrate_timeseries`', '`measurement`', '`recovery`', 'Time-series heart-rate samples for richer recovery analysis.'],
  ['Oura workout', '`oura` / `oura_workout`', '`session`', '`training`', 'Workout duration, calories, workout type, and time window.'],
  ['Oura tag', '`oura` / `oura_tag`', '`journal_entry`', '`behavioral`', 'User-entered markers that explain unusual days or recovery notes.'],
  ['Oura session', '`oura` / `oura_session`', '`session`', '`behavioral`', 'Meditation, breathwork, or guided session context.'],
  ['Oura SpO2', '`oura` / `oura_spo2`', '`measurement`', '`recovery`', 'Sleep-time oxygen saturation signal where the scope is granted.'],
  ['HealthKit mirror of Oura data', '`healthkit` / `oura_via_healthkit_export`', '`summary_input`', '`activity`, `recovery`, `training`', 'Fallback record when Oura is only flowing through Apple Health.'],
];

const PRECEDENCE_ROWS = [
  ['1', 'Direct Oura API', 'Use this for Oura-native daily summary, readiness, heart-rate, workout, tag, session, and SpO2 data.'],
  ['2', 'HealthKit-derived Oura mirror', 'Use this when the athlete has Oura -> Apple Health enabled but direct OAuth is missing, revoked, or not desired.'],
  ['3', 'QuickLifts / FitWithPulse shared context', 'Keep this as the strongest training and nutrition lane when it exists, because it can include the workout and meal details Oura will never own.'],
  ['4', 'PulseCheck self-report', 'Fill behavioral gaps only after the wearable and training lanes have been evaluated.'],
];

const FRESHNESS_ROWS = [
  ['Direct Oura summary', 'Fresh when the latest `daily` payload has synced within the expected Oura publication window.', 'Preferred freshness marker.'],
  ['Direct Oura time series', 'Fresh when the latest sync marker has advanced for the chosen domain.', 'Used for heart-rate and similar sample streams.'],
  ['HealthKit fallback', 'Fresh when Apple Health has a recent Oura-exported update and the source status is still connected.', 'Acceptable fallback, but provenance should say it is mirrored.'],
  ['Missing or expired auth', 'Mark `no_permission` or `disconnected` and do not pretend the data is current.', 'Fail honest, not silent.'],
];

const CONNECTOR_STEPS = [
  {
    title: 'Choose Direct Oura First',
    body: 'Register PulseCheck as an Oura Cloud API application and prefer the server-side OAuth2 flow so we can hold refresh tokens securely and keep sync stable beyond a single access token window.',
    owner: 'PulseCheck backend',
  },
  {
    title: 'Request Minimum Scopes',
    body: 'Start with `daily`, then add `workout`, `heartrate`, `tag`, `session`, and `spo2` only when product value justifies them. Keep `email` and `personal` optional instead of defaulting to broad consent.',
    owner: 'Product + backend',
  },
  {
    title: 'Sync Canonical Source Records',
    body: 'Normalize direct Oura payloads into the health-context source-record contract instead of writing Oura-specific shapes into downstream consumers.',
    owner: 'Ingestion layer',
  },
  {
    title: 'Enable HealthKit Fallback',
    body: 'If Oura is connected to Apple Health, map the mirrored Oura data into the same source-record contract so PulseCheck still has recovery context even when direct API access is unavailable.',
    owner: 'PulseCheck iOS',
  },
  {
    title: 'Assemble One Athlete Context Snapshot',
    body: 'Merge direct Oura, HealthKit-derived Oura, QuickLifts context, and self-report into one canonical athlete snapshot with provenance and freshness.',
    owner: 'Context assembler',
  },
  {
    title: 'Degrade Gracefully',
    body: 'If Oura membership, OAuth, or Apple Health permissions change, move the source to an explicit disconnected or no-permission state and preserve the last known good snapshot revision.',
    owner: 'Operational layer',
  },
];

const RISKS_ROWS = [
  ['Membership dependency', 'Gen3 and Ring 4 users without active Oura Membership cannot use the API.', 'Gate the direct lane with clear consent and fallback messaging.'],
  ['Token lifecycle', 'Client-side-only OAuth does not give refresh tokens and expires quickly.', 'Use the server-side flow for production.'],
  ['HealthKit incompleteness', 'Oura-to-Apple-Health sync does not expose the same richness as the direct API.', 'Treat HealthKit as fallback, not equivalence.'],
  ['Background sync drift', 'Apple Health sync depends on phone state, background refresh, and the Oura app being opened regularly.', 'Add freshness checks and stale-state UX.'],
  ['Double-counting risk', 'Oura and other wearable sources can overlap on steps or activity calories.', 'Use source precedence and provenance to avoid silent duplication.'],
  ['Consent scope creep', 'Over-requesting Oura scopes can reduce opt-in rates.', 'Request the minimum useful scope set and expand only when needed.'],
];

const ROADMAP_ROWS = [
  ['Phase 1', 'Launch direct Oura OAuth with `daily` plus the minimum account metadata needed for stable linking.', 'Gets the core recovery lane live.'],
  ['Phase 2', 'Add HealthKit-derived Oura fallback mapping for athletes already syncing Oura into Apple Health.', 'Prevents a single-path dependency.'],
  ['Phase 3', 'Expand to `workout`, `heartrate`, `tag`, `session`, and `spo2` where product value is clear.', 'Improves context richness without front-loading consent burden.'],
  ['Phase 4', 'Fold Oura into the canonical source-record and snapshot merge rules used by PulseCheck health context.', 'Makes Oura source-agnostic for consumers.'],
  ['Phase 5', 'Add operator tooling and freshness alerts for membership expiry, revoked consent, or stale mirrored data.', 'Keeps the lane maintainable.'],
];

const PulseCheckOuraIntegrationStrategyTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="PulseCheck Health Context"
        title="Oura Integration Strategy"
        version="Version 0.1 | March 17, 2026"
        summary="Concrete strategy for bringing Oura into PulseCheck through a direct OAuth/API lane plus a HealthKit-derived fallback lane. The goal is to preserve Oura-native recovery context when available, fall back cleanly when only Apple Health is present, and normalize both into the existing canonical health-context pipeline."
        highlights={[
          {
            title: 'Direct API Is Primary',
            body: 'Use Oura OAuth/API as the richest source of Oura-native readiness, sleep, workout, heart-rate, tag, session, and SpO2 context.',
          },
          {
            title: 'HealthKit Is The Fallback',
            body: 'If the athlete only has Oura syncing into Apple Health, PulseCheck can still ingest mirrored Oura data through HealthKit.',
          },
          {
            title: 'Normalize Before Consumers',
            body: 'Both lanes should become canonical source records first, then roll up into the same athlete-context snapshot used by Nora and coach surfaces.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Integration strategy artifact for the Oura lane inside PulseCheck. It defines the direct OAuth/API path, the Apple Health fallback path, the source-record mapping, the freshness posture, and the rollout order for making Oura part of the canonical athlete-context stack."
        sourceOfTruth="This page is the operating reference for how PulseCheck should connect to Oura, what data domains should be requested, how Apple Health fallback fits, and how the merged context should remain source-aware and freshness-aware."
        masterReference="Use this page when implementing Oura OAuth, Apple Health fallback ingestion, canonical source records, or the merge-precedence rules that decide which recovery signal PulseCheck should trust."
        relatedDocs={[
          'Health Context Architecture',
          'Athlete Context Snapshot Spec',
          'Health Context Source Record Spec',
          'Health Context Snapshot Assembler Spec',
          'Health Context Persistence & Storage Spec',
          'Health Context Operational Orchestration Spec',
          'Health Context Implementation Rollout Plan',
        ]}
      />

      <SectionBlock icon={ArrowRightLeft} title="Current Integration Paths">
        <DataTable columns={['Path', 'What It Gives PulseCheck', 'Status / Recommendation']} rows={SOURCE_PATH_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Direct Oura OAuth / API Lane">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Auth Model"
            accent="blue"
            body={
              <BulletList
                items={[
                  'Oura uses OAuth2 for the Cloud API.',
                  'The server-side flow supports refresh tokens and is the recommended production posture.',
                  'The client-side-only flow exists, but it does not support refresh tokens and the token currently expires after 30 days.',
                ]}
              />
            }
          />
          <InfoCard
            title="Recommended Consent Shape"
            accent="green"
            body={
              <BulletList
                items={[
                  'Start with `daily` as the core recovery lane.',
                  'Add `workout`, `heartrate`, `tag`, `session`, and `spo2` when product value justifies the extra consent.',
                  'Keep `email` and `personal` optional rather than mandatory.',
                ]}
              />
            }
          />
        </CardGrid>
        <div className="mt-4">
          <DataTable columns={['Scope', 'Domain', 'PulseCheck Use']} rows={OURA_SCOPE_ROWS} />
        </div>
      </SectionBlock>

      <SectionBlock icon={Database} title="HealthKit-Derived Oura Fallback Lane">
        <DataTable columns={['Oura <-> Apple Health Direction', 'Data Exposed', 'Why It Matters']} rows={HEALTHKIT_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Fallback Rule"
            accent="amber"
            body="If the athlete only exposes Oura through Apple Health, PulseCheck should consume that mirrored data rather than failing the experience. The fallback must be labeled as mirrored so Nora and analytics do not overclaim direct Oura provenance."
          />
          <InfoCard
            title="Limitation"
            accent="red"
            body="Apple Health fallback is useful for sleep, activity, heart rate, and workouts, but it is not a full replacement for the direct Oura API when PulseCheck wants Oura-native readiness, tags, or richer recovery semantics."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Database} title="Source-Record Mapping">
        <DataTable columns={['Source Record', 'Source Family / Type', 'Record Type', 'Primary Domain', 'Payload Focus']} rows={SOURCE_RECORD_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Connector Lifecycle">
        <StepRail steps={CONNECTOR_STEPS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Merge Precedence And Freshness">
        <DataTable columns={['Priority', 'Source', 'Rule']} rows={PRECEDENCE_ROWS} />
        <div className="mt-4">
          <DataTable columns={['Freshness State', 'Meaning', 'Runtime Rule']} rows={FRESHNESS_ROWS} />
        </div>
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Key Risks">
        <DataTable columns={['Risk', 'Impact', 'Mitigation']} rows={RISKS_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Rollout Recommendation">
        <DataTable columns={['Phase', 'Scope', 'Why']} rows={ROADMAP_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Best-Path Recommendation"
            accent="green"
            body="Ship direct Oura OAuth/API first, because it carries the most complete Oura-native signal. Add the HealthKit-derived fallback immediately after so standalone athletes still get useful context even if direct consent is missing."
          />
          <InfoCard
            title="Architecture Rule"
            accent="blue"
            body="Do not let consumers care which lane was used. Both lanes should normalize into the same source-record and snapshot pipeline, with provenance deciding how much trust and freshness to assign."
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckOuraIntegrationStrategyTab;
