import React, { useState } from 'react';
import {
  Activity,
  Check,
  Clipboard,
  ClipboardCopy,
  Cpu,
  Layers,
  LayoutDashboard,
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
import {
  SPORTS_INTELLIGENCE_DOCS_BUNDLE,
  SPORTS_INTELLIGENCE_DOCS_BYTES,
} from './sportsIntelligencePlainTextBundle';

// Compact toolbar button for copying the full Sports Intelligence spec bundle
// to the clipboard. Lives at the top of the Sports Intelligence Layer tab so a
// reviewer can grab everything (this spec + Aggregation + Inference Contract +
// Report Outlines + Contextual Detection + Nora Context Capture + Session Detection + Sport Load Model)
// in one click and paste it into another agent for review without tabbing
// across the System Overview.
const CopyAllSportsIntelligenceDocsButton: React.FC = () => {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(SPORTS_INTELLIGENCE_DOCS_BUNDLE);
      setState('copied');
      window.setTimeout(() => setState('idle'), 2200);
    } catch (err) {
      console.error('[CopyAllSportsIntelligenceDocs] clipboard write failed', err);
      setState('failed');
      window.setTimeout(() => setState('idle'), 2200);
    }
  };

  const kb = (SPORTS_INTELLIGENCE_DOCS_BYTES / 1024).toFixed(1);

  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-white">Copy all Sports Intelligence specs</p>
        <p className="text-xs text-zinc-500">
          Bundles this page plus Aggregation + Inference Contract, Report Outlines, Contextual Detection Engine, Nora Context Capture, Session Detection + Matching, and Sport Load Model into one markdown document — for hand-off to a reviewer agent.
        </p>
      </div>
      <button
        type="button"
        onClick={onClick}
        className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${
          state === 'copied'
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
            : state === 'failed'
              ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
              : 'border-zinc-700 bg-zinc-900/80 text-zinc-100 hover:border-zinc-500 hover:bg-zinc-800'
        }`}
      >
        {state === 'copied' ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
        <span>
          {state === 'copied' ? 'Copied to clipboard' : state === 'failed' ? 'Copy failed — try again' : 'Copy all docs'}
        </span>
        <span className="text-xs text-zinc-500">{kb} KB</span>
      </button>
    </div>
  );
};

const SPORTS_INTELLIGENCE_THESIS =
  'What is the athlete’s physical state teaching us about their mental performance environment?';

const ARCHITECTURE_LAYERS = [
  ['Inputs', 'Device-agnostic biometric surface, PulseCheck sims, daily Nora check-ins, FWP workouts, Macra nutrition, sport-config policy.', 'Sources are heterogeneous. The layer treats them as inputs to a single interpretation pipeline; no consumer reads any source directly.'],
  ['Normalization', 'Adapters convert each source into the canonical record shape (Athlete Context Snapshot, Correlation Evidence Record, sport-config attribute values).', 'Renaming or fork-defining record types is forbidden — see Health Context Source Record Spec.'],
  ['Reasoning layer', 'Sports Fact Ledger → Candidate Read Engine → Scoring + Guardrails → Nora/Coach Copy Layer → Validated Intelligence Payload.', 'AI may phrase the read; code decides eligibility, support, usefulness, and rubric safety. The core question is how physical state shapes focus, composure, decisioning, confidence, and habit formation — not whether Nora should change the physical workout.'],
  ['Output surfaces', 'Weekly Sports Intelligence Report, Game-Day Readiness Report, Early-Warning Alerts, Macra nutrition context, Nora coaching context, AuntEDNA escalation context.', 'Each surface has its own audience, latency, and copy posture. Coaches get pattern intelligence and supporting data; coaches keep authority over physical programming decisions.'],
];

const REASONING_LAYER_ROWS = [
  ['1', 'Sports Fact Ledger', 'Server- or runtime-owned source of truth for sport profile, time context, source freshness, recovery facts, load facts, session facts, cognitive evidence, check-ins, nutrition context, allowed claims, blocked claims, and missing inputs.'],
  ['2', 'Candidate Read Engine', 'Deterministic code generates eligible reads such as readiness_status, recovery_limiter, load_spike, intent_mismatch, game_day_prep, fueling_context, session_confirmation_needed, data_quality, and no_intervention.'],
  ['3', 'Scoring + Guardrails', 'Candidates are ranked by data confidence, sport relevance, timing relevance, actionability, materiality, novelty, source freshness, and executable Nora rubric readiness. Unsupported claims are blocked before copy.'],
  ['4', 'Nora / Coach Copy Layer', 'Nora and coach-report generators receive approved facts and selected candidates only. They may translate tone and wording, but may not invent facts, causes, physiology, sessions, or actions.'],
  ['5', 'Validated Intelligence Payload', 'Final output persists the ledger, candidates, selected read, rejected reads, rubric results, guardrail trace, evidence refs, final copy, and review status so operators can answer “why did Nora say this?” in under 30 seconds.'],
];

const REASONING_PAYLOAD_ROWS = [
  ['SportsFactLedger', 'athleteContext, timeContext, sourceFreshness, recoveryFacts, loadFacts, sessionFacts, cognitiveFacts, checkInFacts, nutritionFacts, missingInputs, allowedClaims, blockedClaims, evidenceRefs.'],
  ['SportsCandidateRead', 'id, type, claim, fact, interpretation, recommendedAction, confidence, score, scoreBreakdown, guardrails, audiencePolicy.'],
  ['ValidatedSportsIntelligencePayload', 'ledger, candidates, selectedCandidate, rejectedCandidateIds, copy, rubricResults, guardrailResults, unsupportedClaims, finalStatus, provenance.'],
  ['Admin QA Trace', 'final read preview, ledger explorer, candidate rankings, source freshness table, unsupported-claim scanner, Nora rubric results, reviewer actions.'],
];

const DEVICE_LAYER_ROWS = [
  ['Apple HealthKit / Apple Watch', 'HealthKit bridge → Apple Health adapter → Health Context Source Record.', 'Active source today. Existing Fit With Pulse path; rewiring through HCSR is in flight so Sports Intelligence reads from the canonical surface and not HKHealthStore directly.'],
  ['Oura', 'Oura OAuth/API direct lane (preferred) or HealthKit-derived fallback → Oura adapter → Health Context Source Record.', 'Active source today. Direct OAuth preferred; HealthKit fallback documented in the Oura Integration Strategy spec.'],
  ['Polar', 'Polar OAuth + Accesslink → Polar adapter → Health Context Source Record.', 'Planned future device. Adapter not yet implemented; on the HCSR build queue.'],
  ['Whoop / Garmin / future', 'Per-vendor OAuth → vendor adapter → Health Context Source Record.', 'Planned future devices; implementation-only addition once HCSR adapter scaffolding lands.'],
  ['Pulse Check self-report', 'Nora check-in → self-report intake → Health Context Source Record with `source: pulsecheck_self_report`.', 'Active when an athlete has no connected wearable. Confidence capped at `emerging` per spec — never drives high-trust coach claims.'],
  ['Coach-entered', 'Manual entry → manual adapter → Health Context Source Record with provenance flag.', 'Lowest-confidence lane; explicit provenance carries through to coach-facing copy.'],
];

const NORMALIZED_FIELDS = [
  ['Sleep', 'totalSleepMin, deepSleepMin, remSleepMin, sleepEfficiency, sleepConsistencyScore, latency.', 'All adapters target these field names. No vendor-specific keys leak through.'],
  ['Heart-rate variability', 'rmssdMs, hrvBaselineDeltaPct, hrvTrend7d, restingHr, restingHrTrend7d.', 'Each adapter normalizes to ms / bpm. No raw vendor units.'],
  ['Recovery & readiness', 'recoveryScore (0-100), readinessScore (0-100), recoveryTrend7d, sourceConfidence.', 'Score scales harmonized across vendors before recovery is read by any consumer.'],
  ['Training load', 'externalLoadAU, internalLoadRpeAU, acwr (acute:chronic), microcycleLoadDelta, sessionRpe.', 'External load: distance, jumps, etc. Internal: HR-derived. RPE: athlete-reported.'],
  ['Workout sessions', 'sessionId, sport, modality, durationMin, intensity, sessionRpe, completedAt.', 'Reads from FWP `workoutSessions`; never re-stores the truth.'],
  ['Competition / travel context', 'competitionId, scheduledAt, opponentOrEventName, locationTimezone, travelDistanceMiles, travelDays, travelDirection, travelImpactFactor.', 'Optional first-class context record. Game-day readiness may use travel only when schedule/travel provenance is present; otherwise it omits the factor.'],
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
  ['Weekly Sports Intelligence Report', 'Coach', 'Sundays before the week starts.', 'Team load trend, aggregate sentiment, cognitive movement (Focus / Composure / Decisioning), individual vs team-wide recovery patterns, athlete watchlist, mental-coaching prompts, and reviewer-visible validated payload trace. Walk-through with Pulse Check team weekly during pilot.'],
  ['Game-Day Readiness Report', 'Coach', 'Morning of competition.', 'Athlete-by-athlete mind-body state combining biometric recovery, cognitive trajectory, sentiment 48h prior, optional travel impact factor, and pre-competition protocols. Each athlete read must trace to a selected candidate and source freshness state.'],
  ['Early-Warning Alert', 'Coach', 'Real-time after review gate.', 'Sustained pattern flags are candidate alerts only until reviewed: individual under-recovery, team-wide under-recovery, sudden sentiment shift, cognitive decline. Clinical-threshold signals do NOT route here; they go through escalation.'],
  ['Coach Nora Transparency Panel', 'Coach / reviewer', 'On athlete review surfaces.', 'Read-only context panel showing recent Nora conversations plus recent assigned protocols / sims and rationale. It helps staff understand what Nora has already told the athlete without giving coaches raw athlete-Nora message review powers from Nora Guard.'],
  ['Macra Daily Insight Context', 'Athlete (via Nora)', 'Cloud-scheduled, ~7pm local.', 'Sport context block injected into the Macra daily-insight cloud function so nutrition guidance reflects training load, position demand, season phase, game density. Implemented Phase 2.'],
  ['Nora Coaching Context', 'Athlete (via Nora)', 'On every chat or check-in turn.', 'Sport `noraContext` + risk flags + selected validated sports read injected into Nora prompts. Athlete-facing copy must pass the executable Nora rubric, not just the prompt instructions.'],
  ['AuntEDNA Escalation Context', 'Clinician', 'On clinical handoff only.', 'Recent readiness trends, sentiment patterns, simulation performance — minimum-necessary set. After handoff, clinical authority owns the relationship.'],
];

const ATHLETE_INSIGHT_TYPES = [
  ['Compounding Momentum', 'Sleep, recovery, routine, nutrition, and mental training are lining up.', 'Praise the pattern and teach that the small things are becoming the big edge.'],
  ['Composure Opportunity', 'Recovery is lower, but not a clinical or safety state.', 'Frame the day as a useful chance to practice staying steady when conditions are not perfect.'],
  ['Focus Support Day', 'Sleep timing, recovery, or load suggests attention may take more effort.', 'Give one simple focus cue or reset before the first demanding task.'],
  ['Recovery Debt Pattern', 'Under-recovery repeats across several days.', 'Teach that the system needs support; protect bedtime, fueling rhythm, or recovery routine without shame language.'],
  ['Mismatch Insight', 'Mental training is improving while physical habits are not supporting it, or vice versa.', 'Show the athlete how body-state habits make mental reps stick deeper.'],
  ['Steady Builder Day', 'No dramatic signal.', 'Use average days to build identity: complete the mental rep and keep the routine clean.'],
];

const COACH_PATTERN_ROWS = [
  ['Individual pattern', 'One athlete is under-recovered or carrying higher load while the team is steady.', 'Name the athlete, show the supporting evidence, and suggest a mental-coaching prompt such as a quick composure check-in or reset cue.'],
  ['Team-wide pattern', 'A meaningful share of the roster shows lower recovery, sleep disruption, sentiment drop, or cognitive drift.', 'Surface it as a possible environment or schedule pattern for coach review, not as an automatic training correction.'],
  ['Unit / role pattern', 'A position group, event group, lineup role, or travel group shows a shared state pattern.', 'Help the coach see whether the issue clusters by role, minutes, travel, class schedule, or competition density.'],
  ['Compounding strength', 'The team or athlete is stacking sleep, mental reps, check-ins, and stable physiology.', 'Make the good pattern visible so coaches can reinforce the identity and habits that are working.'],
  ['Data coverage pattern', 'Wear rate, Nora completion, or training/nutrition context is thin.', 'Explain what is missing before interpretation so coaches know whether the signal is trustworthy.'],
];

const COACH_BOUNDARY_ROWS = [
  ['Give the data', 'Recovery distribution, load trend, sleep consistency, cognitive movement, check-in trend, adherence, and named evidence refs.', 'Specific physical programming directives such as cut reps, reduce minutes, adjust contact, throwing, jump, sprint, or lift volume.'],
  ['Interpret the pattern', 'Whether the pattern is individual, unit-level, or team-wide, and why that distinction matters for a coach.', 'Blaming the athlete or declaring a coaching problem without enough evidence.'],
  ['Offer mental-coaching prompts', 'Questions and cues a coach can use: “What helps you stay composed when energy is lower?” “What is your next-play cue today?”', 'Replacing the coach’s technical, tactical, or strength-and-conditioning judgment.'],
  ['Preserve authority', 'Clear language that the report is decision support, not a clearance tool or physical training plan.', 'Any phrasing that makes Nora sound like the head coach, athletic trainer, or clinician.'],
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
  ['Phase 3a — Sports Intelligence Reasoning Layer v0.3', 'Install the Nutrition Layer pattern for sports: fact ledger, candidate reads, scoring, guardrails, executable Nora rubric, validated payloads, replay fixtures, and admin QA trace. Polar 360 athlete read is the first live consumer.', 'In build.'],
  ['Phase 3b — Coach-facing reports', 'Weekly Sports Intelligence Report + Game-Day Readiness Report generation pipeline. Initial sport coverage: basketball, golf, bowling (initial pilot scope). Outputs launch as human-reviewed drafts until inference evaluation clears automation gates.', 'In design.'],
  ['Phase 4 — Early pilot operation', '110-day pilot: 20 days onboarding + 90 days operation. Adherence as primary metric. Weekly walk-throughs with each head coach.', 'Pilot brief approved; awaiting contract finalization.'],
  ['Phase 5 — Adaptive Framing Scale', 'Persistent per-athlete framing profile (1-10) calibrated by Nora and shared back to coaches. Current Phase 2 prompts may use static sport framing policy, but durable athlete-level AFS memory is not considered shipped until this phase.', 'Specced; build follows pilot.'],
  ['Phase 6 — Cross-sport scale', 'Football, soccer, baseball, softball, volleyball, tennis configurations harden with pilot evidence. Per-sport KPIs surface on the thin Coach Dashboard via each sport\'s `kpiRefs`, while the coaching decision surface remains the narrative reports the dashboard links into.', 'Pilot-dependent.'],
];

const TRUST_GATES = [
  ['Build now', 'Sports Fact Ledger, candidate read generation, scoring, guardrails, rubric validation, report draft generation, Macra/Nora sport-context enrichment, evidence/provenance display.', 'May run automatically if outputs are clearly marked as context or draft intelligence and persist the validated payload trace.'],
  ['Human review required', 'Weekly Sports Intelligence Reports, Game-Day Readiness Reports, high-impact coach-facing pattern interpretations.', 'Pulse Check team reviews before coach delivery during early pilots.'],
  ['Blocked from full automation', 'Early-warning alerts, high-trust athlete watchlist promotion, sustained under-recovery flags, coach-facing risk recommendations.', 'Requires locked thresholds, evaluation criteria, false-positive review, and pilot evidence in the Aggregation + Inference Contract.'],
  ['Never owned here', 'Clinical-threshold interpretation, clinical return-to-play decisions, clinician-gated disclosures.', 'Until AuntEDNA integration ships, Tier 3 signals route through `pulsecheck-clinical-escalations` to the team\'s designated clinician staff member. The clinician applies judgment; the athlete\'s app gates to a 988 / Crisis Text Line / 911 surface and informs them the clinician has been notified. Pulse never auto-dials emergency services.'],
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
    title: 'Reports Carry The Interpretation, Dashboard Stays Thin',
    accent: 'green' as const,
    body: 'Coaches do receive a dashboard, but the dashboard is intentionally thin. The interpretation layer carries the work and lands in concise narrative reports timed to coaching decisions; the dashboard exists to make those reports easy to find, scan, and act on without forcing the coach to dig through raw scores. The coach gets pattern intelligence and mental-performance prompts — never raw vendor scores delivered as judgment.',
  },
  {
    title: 'Clinical Boundary Is Architectural',
    accent: 'amber' as const,
    body: 'Performance signals stay in the Sports Intelligence Layer. Clinical-threshold signals route through the `pulsecheck-clinical-escalations` pipeline to the team\'s designated clinician staff member; AuntEDNA integration becomes the canonical clinical lane when it ships. Sports Intelligence does not own clinical authority, does not reverse a clinician-gated return, and never auto-dials 988 / 911 — the athlete\'s app surfaces the resources and the athlete remains in control of any call.',
  },
  {
    title: 'AI Writes, Code Reasons',
    accent: 'purple' as const,
    body: 'Sports Intelligence does not ask AI to notice, diagnose, or infer from scratch. Code builds the fact ledger, selects the candidate read, blocks unsupported claims, and runs the executable Nora rubric before any athlete or coach sees the copy.',
  },
  {
    title: 'Plain Athlete Language',
    accent: 'green' as const,
    body: 'Athlete-facing copy must sound like a coach talking to a smart middle schooler: clear, direct, and specific. Words like baseline, block, push signal, pullback signal, accessories, finishers, and normal-start read fail unless rewritten into an everyday mental action such as complete the Nora session, use one reset cue, protect bedtime, or notice focus during the first demanding task.',
  },
  {
    title: 'Coach Owns Physical Programming',
    accent: 'amber' as const,
    body: 'Sports Intelligence may show recovery, load, trend, individual, and team-wide patterns so coaches can make better decisions. It must not tell the coach to change reps, sets, minutes, contact dose, throwing volume, or any other physical programming variable. Nora coaches the mental layer; the coach owns the physical plan.',
  },
];

const PulseCheckSportsIntelligenceLayerSpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Sports Intelligence"
        title="Sports Intelligence Layer: Architecture & Product Boundaries"
        version="Version 0.3 | May 6, 2026"
        summary="The Sports Intelligence Layer is the device-agnostic, sport-aware interpretation system that translates raw biometrics, simulation evidence, daily check-ins, training, nutrition, and schedule context into mental-performance intelligence. It asks what the athlete’s physical state is teaching us about their performance environment, while preserving the coach’s authority over physical programming."
        highlights={[
          {
            title: 'Device-Agnostic Surface',
            body: 'No single device is the contract. Apple Watch / HealthKit and Oura are the active sources today; Polar, Whoop, and Garmin are planned future devices. Sports Intelligence reads from the normalized health-context surface — every adapter, plus self-report, flows through the same record shape.',
          },
          {
            title: 'Mind-Body Performance Environment',
            body: 'The layer connects physical state to focus, composure, decisioning, confidence, and habit formation. It does not prescribe sets, reps, minutes, contact, throws, jumps, intervals, or workout changes.',
          },
          {
            title: 'Coach Context Without Overreach',
            body: 'Coach reports distinguish individual under-recovery from team-wide under-recovery, show supporting data and trends, and offer mental-coaching prompts so coaches can make their own physical training decisions.',
          },
        ]}
      />

      <InfoCard
        title="Operating Thesis"
        accent="purple"
        body={
          <div className="space-y-3">
            <p className="text-lg font-semibold leading-relaxed text-white">
              “{SPORTS_INTELLIGENCE_THESIS}”
            </p>
            <p>
              Athlete-facing reads should create a mindset shift: small physical habits, mental reps, nutrition timing,
              sleep, recovery, self-talk, and composure practice compound into the long-game edge. Coach-facing reads
              should make individual vs team patterns legible without telling the coach how to run the physical program.
            </p>
          </div>
        }
      />

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 sm:p-5">
        <CopyAllSportsIntelligenceDocsButton />
      </div>

      <InfoCard
        title="Slice 1 Operating Posture"
        accent="amber"
        body={
          <div className="space-y-3">
            <p>
              Pulse team manually curates inference + adherence; reports flow through reviewer screen; no auto-delivery during pilot.
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <a
                href="/admin/sportsIntelligenceReports"
                className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 font-medium text-amber-100 transition hover:border-amber-300/60"
              >
                Open reviewer screen
              </a>
              <a
                href="/coach-report-demo"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1 font-medium text-purple-100 transition hover:border-purple-300/60"
              >
                View coach mock reports
              </a>
            </div>
            <p className="text-xs text-zinc-400">
              Code-owned reportPolicy/loadModel changes ship to Firestore through <code className="rounded bg-black/30 px-1 py-0.5 text-zinc-200">npx tsx scripts/seed-pulsecheck-sports.ts</code> in diff mode first, then <code className="rounded bg-black/30 px-1 py-0.5 text-zinc-200">--apply</code> after review.
            </p>
          </div>
        }
      />

      <RuntimeAlignmentPanel
        role="Interpretation layer between raw signals and consumer surfaces. Owns sport-aware aggregation, athlete-specific baselines, output formatting, and policy enforcement."
        sourceOfTruth="This page is the product and architecture boundary baseline for what Sports Intelligence is, the layers it sits between, and how new sports / devices / output surfaces extend it. The companion Aggregation + Inference Contract is the source of truth for formulas, windows, fallback behavior, thresholds, and payload schemas."
        masterReference="Sport configuration is owned by `company-config/pulsecheck-sports` (admin: `/admin/pulsecheckSportConfiguration`). Biometric input is owned by the Athlete Context Snapshot Spec. Cognitive evidence is owned by the Physiology-Cognition Correlation Engine. Decisioning rules are owned by the Sports Intelligence Aggregation + Inference Contract."
        relatedDocs={[
          'Athlete Context Snapshot Spec',
          'Health Context Source Record Spec',
          'Health Context Snapshot Assembler Spec',
          'Physiology-Cognition Correlation Engine',
          'Correlation Data Model Spec',
          'Device & Wearable Integrations',
          'Oura Integration Strategy',
          'Sports Intelligence Aggregation + Inference Contract',
          'Report Outlines + Coach Mock Reports',
          'Contextual Detection Engine',
          'Macra',
          'AuntEDNA Integration Strategy',
        ]}
      />

      <SectionBlock icon={Activity} title="Mind-Body Performance Framework">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Athlete Job"
            accent="purple"
            body="Teach the athlete how physical state, sleep, nutrition timing, recovery habits, self-talk, and mental reps compound into focus, composure, confidence, decision-making, and long-game maturity. Lower-readiness days become training opportunities, not deficit labels."
          />
          <InfoCard
            title="Coach Job"
            accent="green"
            body="Show coaches which patterns are individual, unit-level, or team-wide, with enough supporting data to inform their own judgment. Sports Intelligence offers mental-performance prompts and pattern context; it does not prescribe the physical program."
          />
        </CardGrid>
        <DataTable columns={['Athlete Insight Type', 'When It Fires', 'What It Should Teach']} rows={ATHLETE_INSIGHT_TYPES} />
        <DataTable columns={['Coach Pattern', 'What It Means', 'How The Report Should Help']} rows={COACH_PATTERN_ROWS} />
        <DataTable columns={['Boundary', 'Allowed', 'Blocked']} rows={COACH_BOUNDARY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Layers} title="System Architecture (4 Layers)">
        <DataTable columns={['Layer', 'What Lives Here', 'Constraint']} rows={ARCHITECTURE_LAYERS} />
      </SectionBlock>

      <SectionBlock icon={Cpu} title="Reasoning Layer v0.3">
        <InfoCard
          title="Nutrition Layer Pattern Applied To Sports"
          accent="purple"
          body="The product failure we are eliminating is data-flavored confidence. A sports read must prove what it knows, what it inferred, what it refused to say, and why the final copy passed the Nora rubric."
        />
        <DataTable columns={['Step', 'Layer', 'Responsibility']} rows={REASONING_LAYER_ROWS} />
        <DataTable columns={['Payload', 'Required Contents']} rows={REASONING_PAYLOAD_ROWS} />
      </SectionBlock>

      <SectionBlock icon={RadioTower} title="Device-Agnostic Biometric Surface">
        <InfoCard
          title="Why This Layer Exists"
          accent="blue"
          body={
            <BulletList
              items={[
                'Pulse runs multiple device integrations (Apple Watch / HealthKit and Oura active today; Polar, Whoop, and Garmin planned). Sports Intelligence cannot couple to any one device.',
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
                'Each sport: id, display name, emoji, positions[], attributes[], metrics[], prompting{}, reportPolicy{} (and reportPolicy.loadModel once wired).',
                '`attributes[]` capture sport-specific athlete dimensions (competitive level, season phase, training load pattern, body composition goal, etc.). `includeInNoraContext` and `includeInMacraContext` flags control which products inject which attribute.',
                '`metrics[]` define sport-native KPIs in their actual units (Minutes/Game, Pitch Count, Total Distance, Vertical Jump). Coach reports surface these directly.',
                '`prompting.noraContext` and `prompting.macraNutritionContext` are injected verbatim into Nora and Macra prompts. `riskFlags`, `restrictedAdvice`, `recommendedLanguage` enforce sport-native posture.',
                'Edit split: sport list, attributes, metrics, and prompting are edited via the Sports Intelligence Layer admin page (`/admin/pulsecheckSportConfiguration`) — adding a new sport is an admin operation, not an engineering deploy. `reportPolicy` and `reportPolicy.loadModel` are review-only on that page and edited in code so coach-facing intelligence can never be misconfigured through the UI.',
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
            body="Sport `noraContext`, risk flags, and current sport framing policy are injected into every Nora prompt. Nora may speak the sport's language, but the athlete-facing job is mental-performance education: connect body state to focus, composure, decision-making, confidence, habits, and the daily Nora rep. Persistent per-athlete Adaptive Framing Scale calibration remains a Phase 5 build item."
          />
          <InfoCard
            title="Coach Reports + Thin Coach Dashboard"
            accent="green"
            body="Coaches make decisions from reports — concise, narrative outputs timed to when coaching decisions get made. The report must distinguish individual vs team-wide patterns so the coach can tell whether a state issue is isolated, clustered, or systemic. It surfaces data, trend, watchlist, adherence/coverage state, and mental-coaching prompts; it does not tell the coach how to modify the physical program. Pulse Check team does a 20-minute weekly walk-through with each head coach during pilot."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={LayoutDashboard} title="Coach Dashboard — Thin Surface, Reports Are The Truth">
        <InfoCard
          title="Why The Dashboard Exists"
          accent="blue"
          body="The dashboard is the access surface for reports, not a replacement for them. Coaches need one place to land — see the latest weekly, open the game-day read, scan watchlist names, glance at adherence — without digging. The interpretation work is already done upstream; the dashboard's job is to make that work easy to find, easy to read, and visually trustworthy."
        />
        <DataTable
          columns={['Dashboard Block', 'Purpose', 'Depth Constraint']}
          rows={[
            ['Latest Weekly Report Card', 'One-click into this week\'s Weekly Sports Intelligence Report.', 'Show only top line, read confidence, and review status. Full report opens in a dedicated reader.'],
            ['Game-Day Readiness Tile', 'When a competition is within 48 hours, the upcoming game-day report is one tap away.', 'Surfaces athlete-by-athlete mind-body state band and confidence; no raw biometric scores.'],
            ['Athlete Watchlist Strip', 'Named watchlist athletes from the most recent reviewed report.', 'Names + confidence chip + one-line "why this matters mentally". No leaderboards, no rankings.'],
            ['Individual vs Team Pattern Strip', 'Shows whether under-recovery, sleep disruption, sentiment drift, or cognitive movement is isolated or team-wide.', 'Pattern context only. No automatic claim that the athlete or coach caused the pattern.'],
            ['Adherence + Coverage Strip', 'Wear rate, Nora completion, protocol/sim completion, training/RPE coverage at team level.', 'Lives at the top of the dashboard so coaches see participation state before any interpretation.'],
            ['Supporting Sport-Native KPIs', 'A small, sport-config-defined KPI strip (e.g. minutes/game, jump count, pitch count).', 'KPIs only, never readiness scores. Filtered through `kpiRefs` in the sport reportPolicy — no invented metrics.'],
            ['Report Archive', 'Searchable list of all reviewed weekly + game-day reports for the team.', 'Read-only; respects the same review-status filters as the report pipeline.'],
          ]}
        />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Design Posture"
            accent="purple"
            body="User-friendly, stunning, and easy to navigate. Calm visual hierarchy, generous whitespace, sport-color cues that match the sport-config registry, and zero raw vendor scores rendered as judgment. The dashboard should feel like a coach's home page, not an analytics console."
          />
          <InfoCard
            title="What The Dashboard Is NOT"
            accent="red"
            body="Not the interpretation layer. Not a place to expose raw HRV / readiness scores as athlete labels. Not a leaderboard. Not a physical training prescription tool. Not a substitute for the weekly walkthrough during pilot. If a question can only be answered by reading the full narrative report, the dashboard's job is to surface that report, not to summarize it inline."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Automation Trust Gates">
        <DataTable columns={['Gate', 'Scope', 'Rule']} rows={TRUST_GATES} />
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
                'Companion Aggregation + Inference Contract exists with baseline windows, source precedence, missing-data behavior, confidence propagation, output payloads, and automation gates.',
                'Sports Intelligence Reasoning Layer v0.3 is installed: fact ledger, candidates, scoring, guardrails, executable Nora rubric, validated payloads, and admin QA traces.',
                'Mind-body performance framework is explicit: athlete reads teach the physical-state-to-mental-performance connection; coach reads separate individual, unit, and team-wide patterns.',
                'Plain athlete language rule is executable: coach-room filler like baseline, block, push signal, pullback signal, accessories, finishers, and normal-start read is blocked from athlete-facing copy.',
                'Physical programming boundary is executable: athlete and coach copy cannot prescribe sets, reps, minutes, contact, throwing, jump, sprint, lift, or workout changes.',
                'Macra hookup (sport profile capture + cloud-driven daily insight + Nora context) is implemented and pulled into this spec as Phase 1 + 2.',
                'Phased roadmap is captured with explicit pilot dependency for Phases 4–6.',
                'Non-negotiables (device-agnostic, sport-and-athlete-specific, reports-carry-the-interpretation-thin-dashboard-as-access-surface, clinical-boundary-is-architectural) are written so future PRs can be measured against them.',
              ]}
            />
          }
        />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckSportsIntelligenceLayerSpecTab;
