import React from 'react';
import {
  Activity,
  Clipboard,
  Cpu,
  Layers,
  Map,
  Plug,
  RadioTower,
  ShieldCheck,
  Trophy,
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
} from './PulseCheckRuntimeDocPrimitives';

const ARCHITECTURE_LAYERS = [
  ['Inputs', 'Device-agnostic biometric surface, PulseCheck sims, daily Nora check-ins, FWP workouts, Macra nutrition, sport-config policy.', 'Sources are heterogeneous. The layer treats them as inputs to a single interpretation pipeline; no consumer reads any source directly.'],
  ['Normalization', 'Adapters convert each source into the canonical record shape (Athlete Context Snapshot, Correlation Evidence Record, sport-config attribute values).', 'Renaming or fork-defining record types is forbidden — see Health Context Source Record Spec.'],
  ['Aggregation & inference', 'Sport-aware aggregators compute per-athlete baselines, training load, readiness, sentiment trend, Focus / Composure / Decisioning movement, and confidence tiers.', 'Inference is athlete-specific, not population-average. Same physiology produces different recommendations across sport, position, season phase.'],
  ['Output surfaces', 'Weekly Sports Intelligence Report, Game-Day Readiness Report, Early-Warning Alerts, Macra nutrition context, Nora coaching context, AuntEDNA escalation context.', 'Each surface has its own audience, latency, and copy posture. Coaches do not read dashboards; they read reports.'],
];

const DEVICE_LAYER_ROWS = [
  ['Polar (UMES pilot device partner)', 'Polar OAuth + Accesslink → Polar adapter → Health Context Source Record.', 'Active for UMES pilot. Polar is one device, not the contract.'],
  ['Apple Watch / HealthKit', 'HealthKit bridge → Apple Health adapter → Health Context Source Record.', 'Existing Fit With Pulse path. Reused without re-implementation.'],
  ['Oura', 'Oura OAuth/API direct lane (preferred) or HealthKit-derived fallback → Oura adapter → Health Context Source Record.', 'Already speced in `Oura Integration Strategy`. Inherits engine confidence tiers.'],
  ['Whoop / Garmin / future', 'Per-vendor OAuth → vendor adapter → Health Context Source Record.', 'Implementation-only addition; no engine, schema, or messaging changes required.'],
  ['Self-reported / coach-entered', 'Manual entry → manual adapter → Health Context Source Record with provenance flag.', 'Lowest-confidence lane; explicit provenance carries through to coach-facing copy.'],
];

const NORMALIZED_FIELDS = [
  ['Sleep', 'totalSleepMin, deepSleepMin, remSleepMin, sleepEfficiency, sleepConsistencyScore, latency.', 'All adapters target these field names. No vendor-specific keys leak through.'],
  ['Heart-rate variability', 'rmssdMs, hrvBaselineDeltaPct, hrvTrend7d, restingHr, restingHrTrend7d.', 'Each adapter normalizes to ms / bpm. No raw vendor units.'],
  ['Recovery & readiness', 'recoveryScore (0-100), readinessScore (0-100), recoveryTrend7d, sourceConfidence.', 'Score scales harmonized across vendors before recovery is read by any consumer.'],
  ['Training load', 'externalLoadAU, internalLoadRpeAU, acwr (acute:chronic), microcycleLoadDelta, sessionRpe.', 'External load: distance, jumps, etc. Internal: HR-derived. RPE: athlete-reported.'],
  ['Workout sessions', 'sessionId, sport, modality, durationMin, intensity, sessionRpe, completedAt.', 'Reads from FWP `workoutSessions`; never re-stores the truth.'],
  ['Cognitive performance', 'focusScore, composureScore, decisioningScore, simEvidenceCount, lastUpdatedAt.', 'Driven by simulation results + Correlation Engine. Always paired with confidence tier.'],
  ['Sentiment / mental state', 'sentimentRollingAvg, riskFlags[], protocolEffectiveness.', 'Rolled up from daily check-ins; aggregated only — individual disclosures stay clinician-gated.'],
];

const SPORT_PROFILE_FIELDS = [
  ['athleteSport', 'Sport id from `company-config/pulsecheck-sports` (e.g. `basketball`).', 'Mirrored to root `users/{uid}.athleteSport` for cross-product reads. Set during Macra athlete-onboarding (Phase 1) and PulseCheck onboarding.'],
  ['athleteSportName', 'Display name from sport config.', 'Cached on root user doc to avoid a config lookup on every read.'],
  ['athleteSportPosition', 'Position string from sport config (optional).', 'Position-specific demands flow into nutrition, training-load interpretation, and game-day readiness.'],
  ['Sport-specific attributes', 'Per-sport attributes captured via PulseCheck onboarding: competitive level, season phase, training load pattern, body composition goal, etc.', 'Defined in sport config `attributes[]` with `includeInMacraContext` and `includeInNoraContext` flags. Edited via `/admin/pulsecheckSportConfiguration`.'],
  ['Sport-specific metrics', 'Per-sport metrics: minutes/game, pitch count, jump count, total distance, etc.', 'Defined in sport config `metrics[]`. Coach-facing reports surface these in sport-native units.'],
  ['Sport prompting policy', '`noraContext`, `macraNutritionContext`, `riskFlags`, `restrictedAdvice`, `recommendedLanguage`.', 'Editable per sport. Injected verbatim into Macra and Nora prompts so coaching language stays sport-native.'],
];

const OUTPUT_SURFACES = [
  ['Weekly Sports Intelligence Report', 'Coach', 'Sundays before the week starts.', 'Team load trend, aggregate sentiment, cognitive movement (Focus / Composure / Decisioning), athlete watchlist, recommended training adjustments. Walk-through with Pulse Check team weekly during pilot.'],
  ['Game-Day Readiness Report', 'Coach', 'Morning of competition.', 'Athlete-by-athlete readiness combining biometric recovery, cognitive trajectory, sentiment 48h prior, travel impact factor, recommended pre-competition protocols.'],
  ['Early-Warning Alert', 'Coach', 'Real-time.', 'Sustained pattern flags: trending overtrained, sudden sentiment shift, cognitive decline. Rare by design — not a stream. Clinical-threshold signals do NOT route here; they go through escalation.'],
  ['Macra Daily Insight Context', 'Athlete (via Nora)', 'Cloud-scheduled, ~7pm local.', 'Sport context block injected into the Macra daily-insight cloud function so nutrition guidance reflects training load, position demand, season phase, game density. Implemented Phase 2.'],
  ['Nora Coaching Context', 'Athlete (via Nora)', 'On every chat or check-in turn.', 'Sport `noraContext` + risk flags + recent biometric posture injected into Nora prompts. Already wired in `nora-nutrition-chat`.'],
  ['AuntEDNA Escalation Context', 'Clinician', 'On clinical handoff only.', 'Recent readiness trends, sentiment patterns, simulation performance — minimum-necessary set. After handoff, clinical authority owns the relationship.'],
];

const MACRA_HOOKUP_ROWS = [
  ['Onboarding capture', 'Sport selector + position picker shown only when activityLevel === athlete. Pulls live from `company-config/pulsecheck-sports`. Persisted to `users/{uid}/macra/profile` AND mirrored to `users/{uid}.athleteSport*`.', 'Phase 1 — shipped.'],
  ['Daily insight context', 'Cloud function `generate-macra-daily-insight` reads `athleteSport` + sport config and injects sport-specific nutrition policy + risk flags into the gpt-4o prompt. Insight type tags (`predictive`, `pattern`, `distribution`, `outcome`, `training_coupled`, `pantry`) are returned and rendered.', 'Phase 2 — shipped.'],
  ['Macra Nora chat context', 'Existing `nora-nutrition-chat` already loads sport context block (`PulseCheckAthleteContext`). Sport prompting policy fed verbatim.', 'Phase 2 — already in place.'],
  ['Per-sport macro adjustments', 'Sport `macraNutritionContext` + body-composition-goal attribute drive macro target adjustments (e.g. football lineman vs. skill position).', 'Phase 3 — design-only.'],
  ['Game-day fueling protocol', 'Macra surface that fires on competition days using FWP-scheduled training events + sport-config policy: pre-game macros, halftime fuel, post-game recovery window.', 'Phase 4 — design-only.'],
];

const PHASE_ROADMAP = [
  ['Phase 0 — Schema lock', 'Sport config schema (`company-config/pulsecheck-sports`) frozen with attributes, metrics, prompting fields, and `includeInMacraContext` / `includeInNoraContext` flags. Admin surface live at `/admin/pulsecheckSportConfiguration`.', 'Done.'],
  ['Phase 1 — Athlete sport profile capture', 'Macra athlete onboarding adds sport selector + position. Mirrored to root user doc for cross-product reads. PulseCheck onboarding already captures sport.', 'Done.'],
  ['Phase 2 — Macra hookup', 'Cloud-scheduled daily insight pulls sport context, FWP training, longitudinal patterns, distribution, outcome trend, frequent foods. Insight type tags drive UI badges. Push notifications fire at user evening hour.', 'Done.'],
  ['Phase 3 — Coach-facing reports', 'Weekly Sports Intelligence Report + Game-Day Readiness Report generation pipeline. Initial sport coverage: basketball, golf, bowling (UMES pilot scope).', 'In design.'],
  ['Phase 4 — UMES pilot operation', '110-day pilot: 20 days onboarding + 90 days operation. Adherence as primary metric. Weekly walk-throughs with each head coach.', 'Pilot brief approved; awaiting contract finalization.'],
  ['Phase 5 — Adaptive Framing Scale', 'Per-athlete framing profile (1-10) calibrated by Nora and shared back to coaches. Same data tunes Nora voice and primes face-to-face coach conversations.', 'Specced; build follows pilot.'],
  ['Phase 6 — Cross-sport scale', 'Football, soccer, baseball, softball, volleyball, tennis configurations harden with pilot evidence. Per-sport KPIs surface in coach dashboard.', 'Pilot-dependent.'],
];

const NON_NEGOTIABLES = [
  {
    title: 'Device-Agnostic By Contract',
    accent: 'red' as const,
    body: 'Sports Intelligence reads from the normalized health-context surface, never directly from Polar / Whoop / Oura / Apple Health APIs. New device support is an adapter, not a Sports Intelligence change.',
  },
  {
    title: 'Sport-Specific, Athlete-Specific',
    accent: 'blue' as const,
    body: 'Every recommendation is interpreted through the athlete\'s sport, position, season phase, and individual baseline — not a population average. Same readiness reading produces different guidance for a starting point guard mid-back-to-back vs. a freshman bowler day three of a tournament.',
  },
  {
    title: 'Coaches Read Reports, Not Dashboards',
    accent: 'green' as const,
    body: 'Outputs are concise narrative reports timed to coaching decisions. The interpretation layer does the work; the coach gets language and recommendations they can act on. No raw scores delivered as judgment.',
  },
  {
    title: 'Clinical Boundary Is Architectural',
    accent: 'amber' as const,
    body: 'Performance signals stay in the Sports Intelligence Layer. Clinical-threshold signals route through the escalation pipeline to AuntEDNA. Sports Intelligence does not own clinical authority and does not reverse a clinician-gated return.',
  },
];

const PulseCheckSportsIntelligenceLayerSpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Sports Intelligence"
        title="Sports Intelligence Layer Spec"
        version="Version 0.1 | April 24, 2026"
        summary="The Sports Intelligence Layer is the device-agnostic, sport-aware interpretation system that translates raw biometrics, simulation evidence, daily check-ins, training, and nutrition into coach-facing intelligence and athlete-facing context. It sits above the normalized health-context surface and below every consumer surface (coach reports, Macra, Nora, AuntEDNA escalation). This page is the implementation baseline: what the layer is, what it consumes, what it produces, and how it ships."
        highlights={[
          {
            title: 'Device-Agnostic Surface',
            body: 'Polar is the UMES pilot device partner, not the contract. Sports Intelligence reads from the normalized health-context surface — Apple Watch, Oura, Whoop, Garmin, and self-reported all flow through the same record shape.',
          },
          {
            title: 'Sport- And Athlete-Specific',
            body: 'Same biometric reading produces different recommendations across sport, position, season phase, and individual baseline. Generic wellness scoring is explicitly out of scope.',
          },
          {
            title: 'Macra Already Hooked In',
            body: 'Macra athlete onboarding writes the sport profile, the daily-insight cloud function pulls sport context, and Nora chat injects sport prompting policy verbatim. Phase 2 of the roadmap is shipped.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Interpretation layer between raw signals and consumer surfaces. Owns sport-aware aggregation, athlete-specific baselines, output formatting, and policy enforcement."
        sourceOfTruth="This page is the implementation baseline for what Sports Intelligence is, the layers it sits between, and how new sports / devices / output surfaces extend it. Use it to reject device-direct reads, generic wellness scoring, or coach-facing outputs that bypass the report pipeline."
        masterReference="Sport configuration is owned by `company-config/pulsecheck-sports` (admin: `/admin/pulsecheckSportConfiguration`). Biometric input is owned by the Athlete Context Snapshot Spec. Cognitive evidence is owned by the Physiology-Cognition Correlation Engine. This page is the bridge that turns those inputs into outputs."
        relatedDocs={[
          'Athlete Context Snapshot Spec',
          'Health Context Source Record Spec',
          'Health Context Snapshot Assembler Spec',
          'Physiology-Cognition Correlation Engine',
          'Correlation Data Model Spec',
          'Device & Wearable Integrations',
          'Oura Integration Strategy',
          'Macra',
          'AuntEDNA Integration Strategy',
        ]}
      />

      <SectionBlock icon={Layers} title="System Architecture (4 Layers)">
        <DataTable columns={['Layer', 'What Lives Here', 'Constraint']} rows={ARCHITECTURE_LAYERS} />
      </SectionBlock>

      <SectionBlock icon={RadioTower} title="Device-Agnostic Biometric Surface">
        <InfoCard
          title="Why This Layer Exists"
          accent="blue"
          body={
            <BulletList
              items={[
                'Pulse runs multiple device integrations (Polar for the UMES pilot, plus Apple Watch / HealthKit, Oura, and future Whoop / Garmin). Sports Intelligence cannot couple to any one device.',
                'All vendor data lands in the Health Context Source Record before any aggregator reads it. Adapters are the only code that touches vendor SDKs.',
                'Renaming or specializing field names per vendor is forbidden. HRV is `rmssdMs` whether it came from Polar, Oura, or Apple Health.',
                'Confidence tiers (`directional`, `emerging`, `stable`, `high_confidence`, `degraded`) are inherited from the Correlation Engine — adapters do not invent their own.',
              ]}
            />
          }
        />
        <DataTable columns={['Source Lane', 'Path Into The System', 'Status']} rows={DEVICE_LAYER_ROWS} />
        <DataTable columns={['Domain', 'Normalized Fields', 'Rule']} rows={NORMALIZED_FIELDS} />
      </SectionBlock>

      <SectionBlock icon={Trophy} title="Sport Configuration Registry">
        <InfoCard
          title="Single Source Of Truth For Sport-Specific Behavior"
          accent="green"
          body={
            <BulletList
              items={[
                'Stored at Firestore `company-config/pulsecheck-sports` as an array of `PulseCheckSportConfigurationEntry`.',
                'Each sport: id, display name, emoji, positions[], attributes[], metrics[], prompting{}.',
                '`attributes[]` capture sport-specific athlete dimensions (competitive level, season phase, training load pattern, body composition goal, etc.). `includeInNoraContext` and `includeInMacraContext` flags control which products inject which attribute.',
                '`metrics[]` define sport-native KPIs in their actual units (Minutes/Game, Pitch Count, Total Distance, Vertical Jump). Coach reports surface these directly.',
                '`prompting.noraContext` and `prompting.macraNutritionContext` are injected verbatim into Nora and Macra prompts. `riskFlags`, `restrictedAdvice`, `recommendedLanguage` enforce sport-native posture.',
                'Edited via `/admin/pulsecheckSportConfiguration`. New sports are an admin operation, not an engineering deploy.',
              ]}
            />
          }
        />
      </SectionBlock>

      <SectionBlock icon={Clipboard} title="Athlete Sport Profile (per-user)">
        <DataTable columns={['Field', 'Source', 'Notes']} rows={SPORT_PROFILE_FIELDS} />
      </SectionBlock>

      <SectionBlock icon={Cpu} title="Output Surfaces">
        <DataTable
          columns={['Surface', 'Audience', 'Cadence', 'Contents']}
          rows={OUTPUT_SURFACES}
        />
      </SectionBlock>

      <SectionBlock icon={Plug} title="Macra Hookup (Phase 1 + 2 Shipped)">
        <DataTable columns={['Hookup', 'Implementation', 'Status']} rows={MACRA_HOOKUP_ROWS} />
        <InfoCard
          title="Cloud-Driven Daily Insight"
          accent="green"
          body={
            <BulletList
              items={[
                'Scheduled Firebase function `scheduledMacraDailyInsight` runs hourly and selects users whose local evening hour matches the current UTC hour.',
                'Calls netlify function `generate-macra-daily-insight` with an internal token + userId. Function pulls 14d meal totals, today\'s meals + supplements, FWP workout RPE / fatigue, weight trend, frequent foods, sport context, distribution-by-time-bucket.',
                'Routes through the OpenAI bridge with feature id `macraDailyInsight` (gpt-4o, JSON mode, 600 max tokens).',
                'Persists to `users/{uid}/macraInsights/{dayKey}` so iOS reads via Firestore listener — no on-device generation, no second source of truth.',
                'Insight returns a `type` field (`predictive`, `pattern`, `distribution`, `outcome`, `training_coupled`, `pantry`). iOS renders the type as a chip on the journal insight card so we can A/B engagement per category.',
                'Manual Regenerate calls the same netlify function with the user\'s Firebase ID token; persists the same way; same listener picks up the new insight.',
              ]}
            />
          }
        />
      </SectionBlock>

      <SectionBlock icon={Activity} title="Nora & Coach Hookups">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Nora Coaching Context"
            accent="blue"
            body="Sport `noraContext` + risk flags + Adaptive Framing Scale calibration injected into every Nora prompt. Nora speaks the sport's language (possession, at-bat, pitch, point, set) without a separate per-sport implementation."
          />
          <InfoCard
            title="Coach Reports"
            accent="green"
            body="Coaches do not read dashboards. Weekly + Game-Day reports + Early-Warning Alerts are concise, narrative outputs timed to when coaching decisions get made. Pulse Check team does a 20-minute weekly walk-through with each head coach during pilot."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Map} title="Phased Build Roadmap">
        <DataTable columns={['Phase', 'Scope', 'Status']} rows={PHASE_ROADMAP} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Implementation Non-Negotiables">
        <CardGrid columns="md:grid-cols-2">
          {NON_NEGOTIABLES.map((card) => (
            <InfoCard key={card.title} title={card.title} accent={card.accent} body={card.body} />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Definition Of Done — Spec Stage">
        <InfoCard
          title="Spec Is Ready For Build When"
          accent="green"
          body={
            <BulletList
              items={[
                'Device-agnostic biometric surface contract is explicit: adapters only, no vendor leakage into Sports Intelligence reads.',
                'Sport configuration registry, athlete sport profile shape, and cross-product mirror fields are documented and the admin surface is live.',
                'Output surfaces (Weekly, Game-Day, Alerts, Macra context, Nora context, escalation) are defined with audience, cadence, and contents.',
                'Macra hookup (sport profile capture + cloud-driven daily insight + Nora context) is implemented and pulled into this spec as Phase 1 + 2.',
                'Phased roadmap is captured with explicit pilot dependency for Phases 4–6.',
                'Non-negotiables (device-agnostic, sport-and-athlete-specific, reports-not-dashboards, clinical-boundary-is-architectural) are written so future PRs can be measured against them.',
              ]}
            />
          }
        />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckSportsIntelligenceLayerSpecTab;
