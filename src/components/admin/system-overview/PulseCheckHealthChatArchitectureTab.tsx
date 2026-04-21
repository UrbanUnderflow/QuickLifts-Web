import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, AlertTriangle, ArrowRightLeft, Brain, ChevronRight, Database, FileText, MessageSquareQuote, ShieldCheck, Wrench, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';
import PulseCheckAthleteHealthContextSnapshotSpecTab from './PulseCheckAthleteHealthContextSnapshotSpecTab';
import PulseCheckHealthContextSourceRecordSpecTab from './PulseCheckHealthContextSourceRecordSpecTab';
import PulseCheckHealthContextSnapshotAssemblerSpecTab from './PulseCheckHealthContextSnapshotAssemblerSpecTab';
import PulseCheckHealthContextPersistenceStorageSpecTab from './PulseCheckHealthContextPersistenceStorageSpecTab';
import PulseCheckHealthContextOperationalOrchestrationSpecTab from './PulseCheckHealthContextOperationalOrchestrationSpecTab';
import PulseCheckHealthContextImplementationRolloutPlanTab from './PulseCheckHealthContextImplementationRolloutPlanTab';
import PulseCheckHealthContextOperatorRunbookTab from './PulseCheckHealthContextOperatorRunbookTab';
import PulseCheckHealthContextDefinitionOfDoneTab from './PulseCheckHealthContextDefinitionOfDoneTab';
import PulseCheckHealthContextEngineeringTaskBreakdownTab from './PulseCheckHealthContextEngineeringTaskBreakdownTab';
import PulseCheckHealthContextFirestoreSchemaIndexSpecTab from './PulseCheckHealthContextFirestoreSchemaIndexSpecTab';
import PulseCheckPhysiologyCognitionCorrelationEngineTab from './PulseCheckPhysiologyCognitionCorrelationEngineTab';
import PulseCheckCorrelationEngineContractLockTab from './PulseCheckCorrelationEngineContractLockTab';
import PulseCheckCorrelationDataModelSpecTab from './PulseCheckCorrelationDataModelSpecTab';
import PulseCheckCorrelationEngineEngineeringTaskBreakdownTab from './PulseCheckCorrelationEngineEngineeringTaskBreakdownTab';

const LIVE_NOW_ROWS = [
  ['Shared Firestore health summary', 'Pulse Check can read `daily-health-summaries` from the shared Firebase stack.', 'Live and already important.'],
  ['Fit With Pulse workout context', 'If the athlete trains in Fit With Pulse, workout summaries and lift aggregates can flow into the daily summary snapshot.', 'Live, but depends on upstream sync.'],
  ['Fit With Pulse legacy nutrition context', 'Legacy meal journal data and nutrition totals can be written into the same daily snapshot; Macra is the dedicated nutrition surface going forward.', 'Live in partial form.'],
  ['Health-backed Nora chat', 'Pulse Check can detect health questions, resolve summaries, generate story cards, and fall back to standard Nora when needed.', 'Live, but contract is still narrow.'],
  ['Contextual fallback summaries', 'If same-day data is missing, Pulse Check can use a recent summary for light context instead of fabricating data.', 'Live, but not yet formalized as provenance.'],
];

const CURRENT_STATE_ROWS = [
  ['Fit With Pulse', 'Acts as the primary writer for the Firestore daily health snapshot by combining HealthKit, workouts, and legacy food journal data.', 'Pulse Check benefits from this context today.'],
  ['Pulse Check', 'Primarily reads the shared daily summary and layers chat logic, fallback behavior, and simple insight generation on top.', 'Pulse Check is more consumer than producer right now.'],
  ['Source ownership', 'The most useful shared health context is currently assembled upstream in Fit With Pulse rather than inside Pulse Check.', 'Context quality depends on Fit With Pulse sync running.'],
  ['Identity contract', 'Health chat still passes a placeholder `current_user` in several paths while lower reads resolve through authenticated Firebase user state.', 'Works in self-service mode, but not from a clean explicit contract.'],
  ['Native Pulse Check capture', 'Pulse Check does not yet own a first-class ingestion layer for direct Apple Watch, HealthKit-only, or Oura-first athletes.', 'This is the biggest product gap for standalone Pulse Check.'],
];

const PRINCIPLE_CARDS = [
  {
    title: 'Shared Context Should Stay',
    accent: 'blue' as const,
    body: 'If the athlete uses Fit With Pulse, Pulse Check should inherit that richer workout and legacy nutrition context rather than pretending it is a separate universe.',
  },
  {
    title: 'Pulse Check Must Also Stand Alone',
    accent: 'green' as const,
    body: 'If the athlete never opens Fit With Pulse, Pulse Check still needs its own ingestion system for recovery, sleep, readiness, activity, and wearable context.',
  },
  {
    title: 'One Canonical Athlete Context',
    accent: 'amber' as const,
    body: 'Nora should not care whether context came from Fit With Pulse, Macra, HealthKit, Apple Watch, or Oura first. She should receive one normalized athlete context bundle with provenance and freshness.',
  },
];

const INGESTION_ROWS = [
  ['Lane A: Shared Fit With Pulse context', 'Workout summaries, exercise volume, legacy meal context, and any future training-plan or adherence signals from the Fit With Pulse ecosystem.', 'This is the richest training context lane and should remain first-class.'],
  ['Lane B: Native Apple Health / Apple Watch capture', 'HealthKit-authorized steps, calories, sleep, HR, HRV, body metrics, workouts, VO2 max, respiratory rate, and related Apple-device data even when Fit With Pulse is not used.', 'This is the standalone Pulse Check foundation.'],
  ['Lane C: Oura recovery lane', 'Sleep, readiness, recovery, temperature, HRV, resting heart rate, and other Oura-origin signals via HealthKit where available or direct connector sync where needed.', 'Needed for athletes whose primary recovery system is Oura.'],
  ['Lane D: Pulse Check-native behavioral context', 'Check-ins, mood, readiness answers, coaching notes, session completions, sim outcomes, and daily self-reported state.', 'This turns raw health data into athlete-specific coaching context.'],
  ['Lane E: Normalization and merge', 'All upstream inputs should merge into one canonical athlete-context snapshot with source attribution and recency markers.', 'This is the layer Nora should actually consume.'],
];

const GAP_ROWS = [
  ['Pulse Check lacks its own ingestion backbone', 'Today it mostly reads what Fit With Pulse wrote. If Fit With Pulse is not in the picture, Pulse Check has no equally robust native context pipeline.', 'Standalone athletes get a thinner experience.'],
  ['No canonical merged context object', 'There is a daily summary model, but not yet a broader `AthleteHealthContextSnapshot` spanning training, recovery, readiness, nutrition, and source provenance.', 'Nora still reasons from a narrower artifact than the product vision needs.'],
  ['Source freshness is under-specified', 'The system stores `lastSyncTimestamp`, but chat and UI do not consistently branch on what is fresh, stale, inferred, or historical.', 'Responses can sound more certain than the data deserves.'],
  ['Connector strategy is incomplete', 'HealthKit is partially leveraged upstream, but Pulse Check-native HealthKit capture and Oura strategy are not yet formalized as product contracts.', 'Important athlete segments are underserved.'],
  ['Auditability is weak', 'There is no durable event describing exactly which health context Nora used on a given turn.', 'Harder to debug, QA, and trust health-backed coaching.'],
  ['Schema drift is already visible', 'The shared snapshot contains richer fields than Pulse Check currently models or explains.', 'Useful context is left on the table.'],
];

const TARGET_FLOW = [
  {
    title: 'Ingest From Every Eligible Source',
    body: 'Accept context from Fit With Pulse, Pulse Check-native HealthKit reads, Apple Watch-origin metrics, Oura-origin recovery signals, Macra nutrition context where appropriate, and Pulse Check behavioral inputs such as check-ins and sim results.',
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
    body: 'Every major context block should say whether it came from Fit With Pulse, Macra, HealthKit, Apple Watch, Oura, or user-reported input, and whether it is direct, historical, inferred, stale, or missing.',
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
  ['Source status block', 'Per-source availability for Fit With Pulse, Macra, HealthKit, Apple Watch, Oura, and self-report inputs.', 'Required.'],
  ['Freshness block', 'Per-domain freshness such as `fresh`, `stale`, `historical_only`, or `missing`.', 'Required.'],
  ['Daily summary block', 'The current-day or requested-day normalized health summary for activity, sleep, recovery, nutrition, and workouts.', 'Required when available.'],
  ['Rolling trend block', '7-day, 14-day, and 30-day baselines for recovery and workload interpretation.', 'Strongly recommended.'],
  ['Training context block', 'Fit With Pulse workout summaries, volume, body parts worked, adherence, and recent training load.', 'Required when athlete uses training app.'],
  ['Recovery context block', 'Sleep, HRV, resting HR, readiness, and recovery-relevant wearable signals.', 'Required for health-backed coaching.'],
  ['Behavioral context block', 'Check-ins, mood, notes, sim results, compliance, and other subjective Pulse Check state.', 'Required for personalization.'],
  ['Provenance block', 'Exact sources used, timestamps, summary type, and whether data is direct, contextual, inferred, or empty.', 'Required.'],
];

const RESPONSE_RULES = [
  {
    title: 'Rich Shared Context',
    accent: 'blue' as const,
    body: <BulletList items={['If Fit With Pulse data is present, Nora should understand workouts, volume, and legacy nutrition context as part of the athlete story.', 'Training context should meaningfully shape coaching language, not live as disconnected metadata.', 'Pulse Check should surface that it understands both mental and physical load together.']} />,
  },
  {
    title: 'Standalone Pulse Check Context',
    accent: 'green' as const,
    body: <BulletList items={['If the athlete never uses Fit With Pulse, Pulse Check should still generate strong recovery and readiness context from HealthKit, Apple Watch, Oura, and self-report.', 'Standalone mode should not feel like a degraded placeholder mode.', 'Nora should adapt to the sources that are actually available.']} />,
  },
  {
    title: 'Sparse or Missing Context',
    accent: 'red' as const,
    body: <BulletList items={['Do not overclaim when data is stale or partial.', 'Name the gap clearly: no permission, not enough data yet, sync needed, or source disconnected.', 'Offer the best next step instead of pretending to know more than the system knows.']} />,
  },
];

const ROADMAP_ROWS = [
  ['Phase 1', 'Fix the current health-chat identity contract and document Fit With Pulse as the current snapshot writer while Pulse Check remains the reader.', 'This cleans up the existing system before expansion.'],
  ['Phase 2', 'Create and lock a canonical `AthleteHealthContextSnapshot` spec that merges daily summary, rolling trends, source status, and provenance.', 'This must be finalized before native ingestion starts so every adapter targets the same contract.'],
  ['Phase 3', 'Build Pulse Check-native HealthKit ingestion so Pulse Check can write or refresh context even without Fit With Pulse involvement.', 'This unlocks true standalone behavior after the contract is locked.'],
  ['Phase 4', 'Add Oura ingestion and normalize Oura recovery signals into the same canonical context model.', 'This broadens athlete compatibility without fragmenting Nora logic.'],
  ['Phase 5', 'Route Nora, proactive alerts, and coach views through the canonical snapshot plus audit events and role-aware privacy filters.', 'This makes the system robust, debuggable, and safe to scale.'],
];

interface HealthContextDocEntry {
  id: string;
  label: string;
  subtitle: string;
  icon: React.ElementType;
  accent: string;
  render: () => React.ReactNode;
}

const HealthContextArchitectureOverviewDoc: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Health Context"
        title="Health Context Pipeline"
        version="Version 0.2 | March 17, 2026"
        summary="Source-of-truth artifact for how Pulse Check should build robust athlete health context across the shared Fit With Pulse ecosystem, Macra nutrition context where appropriate, and its own standalone capture stack. This document covers current reality, target ingestion lanes, canonical context design, and the rollout path for making Nora meaningfully aware of workouts, recovery, health, and daily athlete state."
        highlights={[
          {
            title: 'Keep Shared Context',
            body: 'If the athlete uses Fit With Pulse, Pulse Check should inherit that training and legacy nutrition context as a first-class input rather than rebuilding it from scratch.',
          },
          {
            title: 'Own Standalone Capture',
            body: 'Pulse Check also needs its own native ingestion path for athletes who only connect Apple Health, Apple Watch, Oura, and self-reported readiness signals.',
          },
          {
            title: 'Normalize Before Nora',
            body: 'The target is one canonical athlete-context snapshot with source attribution, freshness, and provenance so every consumer can reason from the same truth.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Architecture artifact for the Pulse Check health-context lane. It defines how shared training context and direct wearable / health context should enter the system, how those inputs must be normalized, and what Nora should consume as the canonical athlete-health artifact."
        sourceOfTruth="This document is authoritative for source lanes, context normalization, provenance, freshness, and the relationship between Fit With Pulse-generated health context and Pulse Check-native capture. It supersedes any assumption that health-backed chat is only a lightweight Firestore read path."
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
            body="Nora should consume a merged athlete-context snapshot, not separately query Fit With Pulse workouts, Macra nutrition context, HealthKit summaries, Oura payloads, and check-ins on every turn. The merge should happen before response generation."
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

const HEALTH_CONTEXT_DOCS: HealthContextDocEntry[] = [
  {
    id: 'architecture',
    label: 'Architecture Overview',
    subtitle: 'Current reality, target lanes, canonical context design, and rollout path.',
    icon: Brain,
    accent: '#a78bfa',
    render: () => <HealthContextArchitectureOverviewDoc />,
  },
  {
    id: 'physiology-cognition-correlation-engine',
    label: 'Physiology-Cognition Correlation Engine',
    subtitle: 'Joined-model system for learning athlete-specific mind-body patterns from physiology plus sims.',
    icon: Brain,
    accent: '#8b5cf6',
    render: () => <PulseCheckPhysiologyCognitionCorrelationEngineTab />,
  },
  {
    id: 'correlation-engine-contract-lock',
    label: 'Contract Lock & Exit Criteria',
    subtitle: 'Milestone 0 freeze for naming, confidence tiers, messaging rules, and implementation exits.',
    icon: FileText,
    accent: '#38bdf8',
    render: () => <PulseCheckCorrelationEngineContractLockTab />,
  },
  {
    id: 'correlation-data-model-spec',
    label: 'Correlation Data Model Spec',
    subtitle: 'Buildable schema for evidence records, pattern models, projections, and assessment flags.',
    icon: Database,
    accent: '#22c55e',
    render: () => <PulseCheckCorrelationDataModelSpecTab />,
  },
  {
    id: 'correlation-engine-engineering-task-breakdown',
    label: 'Correlation Engine Engineering Task Breakdown',
    subtitle: 'Full milestone, ownership, QA, and release plan from schema lock to production readiness.',
    icon: Workflow,
    accent: '#f59e0b',
    render: () => <PulseCheckCorrelationEngineEngineeringTaskBreakdownTab />,
  },
  {
    id: 'snapshot-spec',
    label: 'Athlete Context Snapshot Spec',
    subtitle: 'Canonical merged athlete-health snapshot contract.',
    icon: Database,
    accent: '#38bdf8',
    render: () => <PulseCheckAthleteHealthContextSnapshotSpecTab />,
  },
  {
    id: 'source-record-spec',
    label: 'Source Record Spec',
    subtitle: 'Normalized source-record contract for adapter output.',
    icon: ArrowRightLeft,
    accent: '#22c55e',
    render: () => <PulseCheckHealthContextSourceRecordSpecTab />,
  },
  {
    id: 'snapshot-assembler-spec',
    label: 'Snapshot Assembler Spec',
    subtitle: 'Merge-engine rules for daily and rolling context snapshots.',
    icon: Workflow,
    accent: '#f59e0b',
    render: () => <PulseCheckHealthContextSnapshotAssemblerSpecTab />,
  },
  {
    id: 'persistence-storage-spec',
    label: 'Persistence & Storage Spec',
    subtitle: 'Storage model for records, snapshots, traces, and status.',
    icon: Database,
    accent: '#f97316',
    render: () => <PulseCheckHealthContextPersistenceStorageSpecTab />,
  },
  {
    id: 'operational-orchestration-spec',
    label: 'Operational Orchestration Spec',
    subtitle: 'Connector lifecycle, sync scheduling, retries, and stale handling.',
    icon: Activity,
    accent: '#14b8a6',
    render: () => <PulseCheckHealthContextOperationalOrchestrationSpecTab />,
  },
  {
    id: 'implementation-rollout-plan',
    label: 'Implementation Rollout Plan',
    subtitle: 'Milestones for MVP, migration, ownership, and cutover.',
    icon: Wrench,
    accent: '#eab308',
    render: () => <PulseCheckHealthContextImplementationRolloutPlanTab />,
  },
  {
    id: 'operator-runbook',
    label: 'Operator Runbook',
    subtitle: 'Validation, parity checks, backfill, and rollout readiness steps.',
    icon: ShieldCheck,
    accent: '#fb7185',
    render: () => <PulseCheckHealthContextOperatorRunbookTab />,
  },
  {
    id: 'definition-of-done',
    label: 'Definition Of Done',
    subtitle: 'True completion criteria versus optional follow-on work.',
    icon: FileText,
    accent: '#94a3b8',
    render: () => <PulseCheckHealthContextDefinitionOfDoneTab />,
  },
  {
    id: 'engineering-task-breakdown',
    label: 'Engineering Task Breakdown',
    subtitle: 'Execution workstream breakdown across platform, product, ops, and QA.',
    icon: Wrench,
    accent: '#ef4444',
    render: () => <PulseCheckHealthContextEngineeringTaskBreakdownTab />,
  },
  {
    id: 'firestore-schema-index-spec',
    label: 'Firestore Schema & Index Spec',
    subtitle: 'Collection, query, and composite-index contract for the health-context system.',
    icon: Database,
    accent: '#06b6d4',
    render: () => <PulseCheckHealthContextFirestoreSchemaIndexSpecTab />,
  },
];

const PulseCheckHealthChatArchitectureTab: React.FC = () => {
  const [activeDocId, setActiveDocId] = useState<string>(HEALTH_CONTEXT_DOCS[0].id);

  const activeDoc = HEALTH_CONTEXT_DOCS.find((doc) => doc.id === activeDocId) || HEALTH_CONTEXT_DOCS[0];

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FileText className="w-4 h-4 text-purple-400" />
          <p className="text-xs uppercase tracking-wide text-purple-400 font-semibold">
            Pulse Check · Health Context Pipeline
          </p>
        </div>
        <h2 className="text-xl font-semibold text-white">Health Context Pipeline Library</h2>
        <p className="text-sm text-zinc-400 mt-1">
          Architecture parent artifact with internal pages for the related health-context contracts, the physiology-cognition engine, rollout docs, and operating specs.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {HEALTH_CONTEXT_DOCS.map((doc) => {
          const Icon = doc.icon;
          const isActive = doc.id === activeDocId;
          return (
            <button
              key={doc.id}
              onClick={() => setActiveDocId(doc.id)}
              className="group relative text-left rounded-xl border px-4 py-3 transition-all duration-200"
              style={{
                background: isActive
                  ? `linear-gradient(135deg, ${doc.accent}18, ${doc.accent}08)`
                  : 'rgba(255,255,255,0.02)',
                borderColor: isActive ? `${doc.accent}50` : 'rgba(63,63,70,0.6)',
                boxShadow: isActive ? `0 0 24px ${doc.accent}12` : 'none',
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: isActive ? `${doc.accent}25` : 'rgba(255,255,255,0.05)',
                  }}
                >
                  <Icon
                    className="w-4 h-4"
                    style={{ color: isActive ? doc.accent : '#a1a1aa' }}
                  />
                </div>
                <div className="min-w-0">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: isActive ? '#fff' : '#d4d4d8' }}
                  >
                    {doc.label}
                  </p>
                  <p className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5">
                    {doc.subtitle}
                  </p>
                </div>
                <ChevronRight
                  className="w-4 h-4 ml-auto shrink-0 transition-transform group-hover:translate-x-0.5"
                  style={{ color: isActive ? doc.accent : '#52525b' }}
                />
              </div>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeDoc.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          {activeDoc.render()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default PulseCheckHealthChatArchitectureTab;
