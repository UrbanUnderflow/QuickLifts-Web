import React from 'react';
import { Activity, AlertTriangle, ArrowRightLeft, Brain, Database, MessageSquareQuote, ShieldCheck } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const LIVE_NOW_ROWS = [
  ['Shared Firestore health summary', 'PulseCheck can read `daily-health-summaries` from the shared Firebase stack.', 'Live and already important.'],
  ['QuickLifts workout context', 'If the athlete trains in QuickLifts / FitWithPulse, workout summaries and lift aggregates can flow into the daily summary snapshot.', 'Live, but depends on upstream sync.'],
  ['QuickLifts nutrition context', 'Meal journal data and nutrition totals can be written into the same daily snapshot.', 'Live in partial form.'],
  ['Health-backed Nora chat', 'PulseCheck can detect health questions, resolve summaries, generate story cards, and fall back to standard Nora when needed.', 'Live, but contract is still narrow.'],
  ['Contextual fallback summaries', 'If same-day data is missing, PulseCheck can use a recent summary for light context instead of fabricating data.', 'Live, but not yet formalized as provenance.'],
];

const CURRENT_STATE_ROWS = [
  ['QuickLifts / FitWithPulse', 'Acts as the primary writer for the Firestore daily health snapshot by combining HealthKit, workouts, and food journal data.', 'PulseCheck benefits from this context today.'],
  ['PulseCheck', 'Primarily reads the shared daily summary and layers chat logic, fallback behavior, and simple insight generation on top.', 'PulseCheck is more consumer than producer right now.'],
  ['Source ownership', 'The most useful health context is currently assembled upstream in QuickLifts rather than inside PulseCheck.', 'Context quality depends on QuickLifts sync running.'],
  ['Identity contract', 'Health chat still passes a placeholder `current_user` in several paths while lower reads resolve through authenticated Firebase user state.', 'Works in self-service mode, but not from a clean explicit contract.'],
  ['Native PulseCheck capture', 'PulseCheck does not yet own a first-class ingestion layer for direct Apple Watch, HealthKit-only, or Oura-first athletes.', 'This is the biggest product gap for standalone PulseCheck.'],
];

const PRINCIPLE_CARDS = [
  {
    title: 'Shared Context Should Stay',
    accent: 'blue' as const,
    body: 'If the athlete uses QuickLifts / FitWithPulse, PulseCheck should absolutely inherit that richer workout and nutrition context rather than pretending it is a separate universe.',
  },
  {
    title: 'PulseCheck Must Also Stand Alone',
    accent: 'green' as const,
    body: 'If the athlete never opens QuickLifts, PulseCheck still needs its own ingestion system for recovery, sleep, readiness, activity, and wearable context.',
  },
  {
    title: 'One Canonical Athlete Context',
    accent: 'amber' as const,
    body: 'Nora should not care whether context came from QuickLifts, HealthKit, Apple Watch, or Oura first. She should receive one normalized athlete context bundle with provenance and freshness.',
  },
];

const INGESTION_ROWS = [
  ['Lane A: Shared QuickLifts context', 'Workout summaries, exercise volume, meal logs, nutrition totals, and any future training-plan or adherence signals from the FitWithPulse ecosystem.', 'This is the richest training context lane and should remain first-class.'],
  ['Lane B: Native Apple Health / Apple Watch capture', 'HealthKit-authorized steps, calories, sleep, HR, HRV, body metrics, workouts, VO2 max, respiratory rate, and related Apple-device data even when QuickLifts is not used.', 'This is the standalone PulseCheck foundation.'],
  ['Lane C: Oura recovery lane', 'Sleep, readiness, recovery, temperature, HRV, resting heart rate, and other Oura-origin signals via HealthKit where available or direct connector sync where needed.', 'Needed for athletes whose primary recovery system is Oura.'],
  ['Lane D: PulseCheck-native behavioral context', 'Check-ins, mood, readiness answers, coaching notes, session completions, sim outcomes, and daily self-reported state.', 'This turns raw health data into athlete-specific coaching context.'],
  ['Lane E: Normalization and merge', 'All upstream inputs should merge into one canonical athlete-context snapshot with source attribution and recency markers.', 'This is the layer Nora should actually consume.'],
];

const GAP_ROWS = [
  ['PulseCheck lacks its own ingestion backbone', 'Today it mostly reads what QuickLifts wrote. If QuickLifts is not in the picture, PulseCheck has no equally robust native context pipeline.', 'Standalone athletes get a thinner experience.'],
  ['No canonical merged context object', 'There is a daily summary model, but not yet a broader `AthleteHealthContextSnapshot` spanning training, recovery, readiness, nutrition, and source provenance.', 'Nora still reasons from a narrower artifact than the product vision needs.'],
  ['Source freshness is under-specified', 'The system stores `lastSyncTimestamp`, but chat and UI do not consistently branch on what is fresh, stale, inferred, or historical.', 'Responses can sound more certain than the data deserves.'],
  ['Connector strategy is incomplete', 'HealthKit is partially leveraged upstream, but PulseCheck-native HealthKit capture and Oura strategy are not yet formalized as product contracts.', 'Important athlete segments are underserved.'],
  ['Auditability is weak', 'There is no durable event describing exactly which health context Nora used on a given turn.', 'Harder to debug, QA, and trust health-backed coaching.'],
  ['Schema drift is already visible', 'The shared snapshot contains richer fields than PulseCheck currently models or explains.', 'Useful context is left on the table.'],
];

const TARGET_FLOW = [
  {
    title: 'Ingest From Every Eligible Source',
    body: 'Accept context from QuickLifts / FitWithPulse, PulseCheck-native HealthKit reads, Apple Watch-origin metrics, Oura-origin recovery signals, and PulseCheck behavioral inputs such as check-ins and sim results.',
    owner: 'Ingestion layer',
  },
  {
    title: 'Normalize Into Source Records',
    body: 'Transform each source into typed source records with athlete id, source type, observation time, sync time, confidence, and source-specific payload fields.',
    owner: 'Normalization layer',
  },
  {
    title: 'Build Canonical Daily and Rolling Context',
    body: 'Produce a canonical athlete-context snapshot that contains daily metrics plus rolling windows for trend-sensitive concepts like sleep baseline, HRV drift, workload, and readiness momentum.',
    owner: 'Context assembler',
  },
  {
    title: 'Attach Provenance and Freshness',
    body: 'Every major context block should say whether it came from QuickLifts, HealthKit, Apple Watch, Oura, or user-reported input, and whether it is direct, historical, inferred, stale, or missing.',
    owner: 'Context metadata layer',
  },
  {
    title: 'Feed Nora and Coach Surfaces',
    body: 'Nora, dashboards, proactive alerts, and future coach explanations should all consume the same canonical context snapshot rather than each re-implementing their own health fetch logic.',
    owner: 'Consumer layer',
  },
  {
    title: 'Persist Audit Events',
    body: 'When Nora uses health context, emit an event describing the branch, the snapshot revision, the sources used, and the no-data or stale-data handling path.',
    owner: 'Observability layer',
  },
];

const CONTEXT_ROWS = [
  ['Identity block', '`athleteUserId`, team / coach scope, permissions posture, and consent flags.', 'Required.'],
  ['Source status block', 'Per-source availability for QuickLifts, HealthKit, Apple Watch, Oura, and self-report inputs.', 'Required.'],
  ['Freshness block', 'Per-domain freshness such as `fresh`, `stale`, `historical_only`, or `missing`.', 'Required.'],
  ['Daily summary block', 'The current-day or requested-day normalized health summary for activity, sleep, recovery, nutrition, and workouts.', 'Required when available.'],
  ['Rolling trend block', '7-day, 14-day, and 30-day baselines for recovery and workload interpretation.', 'Strongly recommended.'],
  ['Training context block', 'QuickLifts workout summaries, volume, body parts worked, adherence, and recent training load.', 'Required when athlete uses training app.'],
  ['Recovery context block', 'Sleep, HRV, resting HR, readiness, and recovery-relevant wearable signals.', 'Required for health-backed coaching.'],
  ['Behavioral context block', 'Check-ins, mood, notes, sim results, compliance, and other subjective PulseCheck state.', 'Required for personalization.'],
  ['Provenance block', 'Exact sources used, timestamps, summary type, and whether data is direct, contextual, inferred, or empty.', 'Required.'],
];

const RESPONSE_RULES = [
  {
    title: 'Rich Shared Context',
    accent: 'blue' as const,
    body: <BulletList items={['If QuickLifts data is present, Nora should understand workouts, volume, and logged nutrition as part of the athlete story.', 'Training context should meaningfully shape coaching language, not live as disconnected metadata.', 'PulseCheck should surface that it understands both mental and physical load together.']} />,
  },
  {
    title: 'Standalone PulseCheck Context',
    accent: 'green' as const,
    body: <BulletList items={['If the athlete never uses QuickLifts, PulseCheck should still generate strong recovery and readiness context from HealthKit, Apple Watch, Oura, and self-report.', 'Standalone mode should not feel like a degraded placeholder mode.', 'Nora should adapt to the sources that are actually available.']} />,
  },
  {
    title: 'Sparse or Missing Context',
    accent: 'red' as const,
    body: <BulletList items={['Do not overclaim when data is stale or partial.', 'Name the gap clearly: no permission, not enough data yet, sync needed, or source disconnected.', 'Offer the best next step instead of pretending to know more than the system knows.']} />,
  },
];

const ROADMAP_ROWS = [
  ['Phase 1', 'Fix the current health-chat identity contract and document QuickLifts as the current snapshot writer while PulseCheck remains the reader.', 'This cleans up the existing system before expansion.'],
  ['Phase 2', 'Create and lock a canonical `AthleteHealthContextSnapshot` spec that merges daily summary, rolling trends, source status, and provenance.', 'This must be finalized before native ingestion starts so every adapter targets the same contract.'],
  ['Phase 3', 'Build PulseCheck-native HealthKit ingestion so PulseCheck can write or refresh context even without QuickLifts involvement.', 'This unlocks true standalone behavior after the contract is locked.'],
  ['Phase 4', 'Add Oura ingestion and normalize Oura recovery signals into the same canonical context model.', 'This broadens athlete compatibility without fragmenting Nora logic.'],
  ['Phase 5', 'Route Nora, proactive alerts, and coach views through the canonical snapshot plus audit events and role-aware privacy filters.', 'This makes the system robust, debuggable, and safe to scale.'],
];

const PulseCheckHealthChatArchitectureTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="PulseCheck Health Context"
        title="Health Context & Ingestion Architecture"
        version="Version 0.2 | March 17, 2026"
        summary="Source-of-truth artifact for how PulseCheck should build robust athlete health context across the shared FitWithPulse ecosystem and its own standalone capture stack. This document covers current reality, target ingestion lanes, canonical context design, and the rollout path for making Nora meaningfully aware of workouts, recovery, health, and daily athlete state."
        highlights={[
          {
            title: 'Keep Shared Context',
            body: 'If the athlete uses QuickLifts / FitWithPulse, PulseCheck should inherit that training and nutrition context as a first-class input rather than rebuilding it from scratch.',
          },
          {
            title: 'Own Standalone Capture',
            body: 'PulseCheck also needs its own native ingestion path for athletes who only connect Apple Health, Apple Watch, Oura, and self-reported readiness signals.',
          },
          {
            title: 'Normalize Before Nora',
            body: 'The target is one canonical athlete-context snapshot with source attribution, freshness, and provenance so every consumer can reason from the same truth.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Architecture artifact for the PulseCheck health-context lane. It defines how shared training context and direct wearable / health context should enter the system, how those inputs must be normalized, and what Nora should consume as the canonical athlete-health artifact."
        sourceOfTruth="This document is authoritative for source lanes, context normalization, provenance, freshness, and the relationship between QuickLifts-generated health context and PulseCheck-native capture. It supersedes any assumption that health-backed chat is only a lightweight Firestore read path."
        masterReference="Use this page when implementing health-backed Nora behavior, direct wearable ingestion, recovery and readiness context, or any system that needs to understand the athlete beyond a single chat turn."
        relatedDocs={[
          'Runtime Architecture v1.0',
          'State Signal Layer v1.3',
          'Check-In Integration Spec',
          'Athlete Context Snapshot Spec',
          'Health Context Source Record Spec',
          'Health Context Snapshot Assembler Spec',
          'Health Context Persistence & Storage Spec',
          'Health Context Operational Orchestration Spec',
          'Health Context Implementation Rollout Plan',
          'Snapshot Freshness Policy',
          'Permissions & Visibility Model',
        ]}
      />

      <SectionBlock icon={Activity} title="What Is Live Today">
        <DataTable columns={['Capability', 'Current Behavior', 'Status']} rows={LIVE_NOW_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Current System Reality">
        <DataTable columns={['Layer', 'Current Truth', 'Implication']} rows={CURRENT_STATE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Brain} title="Design Principles">
        <CardGrid columns="md:grid-cols-3">
          {PRINCIPLE_CARDS.map((card) => (
            <InfoCard key={card.title} title={card.title} accent={card.accent} body={card.body} />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ArrowRightLeft} title="Target Ingestion Lanes">
        <DataTable columns={['Lane', 'What It Should Capture', 'Why It Matters']} rows={INGESTION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Where The Gaps Actually Are">
        <DataTable columns={['Gap', 'Why It Matters', 'Current Risk']} rows={GAP_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ArrowRightLeft} title="Target End-to-End Context Flow">
        <StepRail steps={TARGET_FLOW} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Canonical Athlete Context Contract">
        <DataTable columns={['Block', 'Meaning', 'Rule']} rows={CONTEXT_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Canonical Product Rule"
            accent="green"
            body="Nora should consume a merged athlete-context snapshot, not separately query QuickLifts workouts, HealthKit summaries, Oura payloads, and check-ins on every turn. The merge should happen before response generation."
          />
          <InfoCard
            title="Privacy Boundary"
            accent="red"
            body="Coach-facing and staff-facing health views should consume a filtered version of this same canonical context only after role-aware access rules and minimum-necessary field exposure are defined."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={MessageSquareQuote} title="Nora Response Rules For Context Availability">
        <CardGrid columns="md:grid-cols-3">
          {RESPONSE_RULES.map((card) => (
            <InfoCard key={card.title} title={card.title} accent={card.accent} body={card.body} />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Implementation Roadmap">
        <DataTable columns={['Phase', 'Scope', 'Why It Comes Next']} rows={ROADMAP_ROWS} />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckHealthChatArchitectureTab;
