import React from 'react';
import {
  AlertTriangle,
  ClipboardCheck,
  FileJson,
  GitBranch,
  Gauge,
  Layers,
  LineChart,
  Route,
  Scale,
  ShieldCheck,
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

const BASELINE_WINDOWS = [
  ['Sleep volume / efficiency', '14 days minimum, 28 days preferred.', 'Daily rolling median + 7d trend.', 'If fewer than 7 valid nights exist, mark directional and suppress athlete-specific readiness recommendation.'],
  ['HRV / resting HR', '14 days minimum, 28 days preferred.', 'Rolling median, 7d trend, same-device preferred.', 'If source changes inside the baseline window, recompute with degraded confidence until 7 same-source days exist.'],
  ['Readiness / recovery score', '7 days minimum, 21 days preferred.', 'Vendor-harmonized 0-100 score, then athlete-relative delta.', 'Never compare raw scores across athletes. Treat score as within-athlete evidence only.'],
  ['Training load', '7d acute, 28d chronic.', 'ACWR plus microcycle delta and sport-native load metrics.', 'If external load is absent, use internal/RPE lane with provenance downgrade.'],
  ['Sentiment / check-in posture', '5 check-ins minimum, 14 days preferred.', 'Rolling average + direction + abrupt shift detector.', 'Do not expose individual disclosures in Sports Intelligence outputs.'],
  ['Cognitive movement', '3 valid sim sessions minimum, 14 days preferred.', 'Focus, Composure, Decisioning deltas from athlete baseline.', 'If sim count is thin, use narrative trend language only; do not produce strong recommendations.'],
  ['Travel impact', 'Competition travel record required.', 'Distance, timezone shift, travel days, travel direction.', 'If schedule/travel provenance is absent, omit travel instead of imputing.'],
];

const MINIMUM_DATA_RULES = [
  ['No biometric baseline', 'Use training, check-in, and cognitive evidence only.', 'Output may say biometric posture is unavailable; no recovery/readiness claim.'],
  ['One stale source', 'Exclude from score if older than its freshness SLA.', 'Explain as missing/stale data in internal trace. Coach copy says confidence is limited, not that the athlete is risky.'],
  ['Mixed wearable sources', 'Prefer the source with the strongest provenance and continuity.', 'Do not average vendor readiness scores. Normalize source records first, then aggregate canonical fields.'],
  ['Self-reported only', 'Allowed for context and athlete notes.', 'Cannot drive high-trust coach recommendation without corroborating evidence.'],
  ['Clinical-threshold signal', 'Stop Sports Intelligence delivery path.', 'Route through AuntEDNA escalation; performance report may include only post-handoff minimum-necessary context.'],
];

const SOURCE_PRECEDENCE = [
  ['Same-day canonical field conflict', 'Continuous wearable > HealthKit-derived wearable > athlete-entered > coach-entered.', 'Use the higher-provenance record and retain the losing record in trace.'],
  ['Direct vendor vs HealthKit fallback', 'Direct vendor lane wins when freshness and completeness are equal.', 'Fallback lane fills missing fields only when no direct value exists.'],
  ['Workout truth', 'FWP `workoutSessions` is canonical for session completion.', 'Sports Intelligence may derive load features but does not restate the workout source of truth.'],
  ['Sport profile truth', '`users/{uid}.athleteSport*` mirror for fast reads; sport config doc for policy.', 'If mirror and config disagree, config wins for policy and the mirror is queued for repair.'],
  ['Cognitive evidence', 'Correlation Evidence Record from the Correlation Engine.', 'Sports Intelligence consumes confidence tiers; it does not invent new correlation confidence labels.'],
];

const CONFIDENCE_PROPAGATION = [
  ['high_confidence', 'Multiple fresh lanes, sufficient athlete baseline, stable source provenance.', 'Can support direct report recommendations after pilot review.'],
  ['stable', 'Enough baseline and at least two aligned evidence families.', 'Can produce recommendation with normal confidence language.'],
  ['emerging', 'Pattern appears but baseline or evidence count is still maturing.', 'Use watch language: "monitor", "consider", "early pattern".'],
  ['directional', 'Thin or partially stale evidence still points one way.', 'Use context language only; no strong adjustment.'],
  ['degraded', 'Conflict, stale source, missing baseline, or source transition.', 'Do not generate automated coach recommendation. Preserve evidence for review.'],
];

const INTERPRETATION_RULES = [
  ['Readiness', 'Blend biometric recovery, sleep, HRV/RHR trend, cognitive movement, sentiment 48h, training load, optional travel.', 'Output is a readiness band plus explanation, not a universal wellness score.'],
  ['Training load', 'Compute ACWR, microcycle delta, session RPE trend, and sport-native metrics.', 'Recommendations change by sport, position, season phase, and upcoming competition density.'],
  ['Cognitive movement', 'Compare Focus / Composure / Decisioning to athlete baseline and recent sim family evidence.', 'Use confidence tier from Correlation Engine and avoid population-average claims.'],
  ['Sentiment trend', 'Aggregate check-in posture into trend and abrupt-shift signal.', 'No individual disclosure leaves clinician-gated or athlete-private contexts.'],
  ['Recommendation selection', 'Generate candidate reads, score them, block unsupported claims, then select the lowest-risk useful action that matches evidence confidence and sport policy.', 'Low confidence can recommend monitoring, asking for context, or coach conversation, not workload intervention.'],
];

const SPORTS_FACT_LEDGER_ROWS = [
  ['athleteContext', 'sport, position, season phase, level, goals, risk flags, coach policy.', 'Shapes what the same data means for this athlete.'],
  ['timeContext', 'today/yesterday, practice window, game-day window, travel window, recovery window.', 'Prevents “today” claims on historical cards and keeps actions tied to the correct decision moment.'],
  ['sourceFreshness', 'fresh/recent/stale/missing per recovery, activity, training, cognitive, behavioral, nutrition.', 'Controls hedging and blocks overconfident reads.'],
  ['recoveryFacts', 'sleep, HRV, resting HR, respiratory rate, readiness/recovery score, baseline deltas when available.', 'Allowed physiological facts. No interpretation without rule support.'],
  ['loadFacts', 'sessions, duration, HR zones, RPE, ACWR, microcycle load, prescribed-vs-actual.', 'Supports load and intent claims.'],
  ['sessionFacts', 'detected session, confirmed session, schedule match, coach intent, device coverage.', 'Blocks invented “yesterday’s pull session” style claims.'],
  ['cognitiveFacts', 'Focus, Composure, Decisioning movement, evidence count, confidence.', 'Supports mental-performance movement without population claims.'],
  ['checkInFacts', 'fatigue, soreness, sentiment trend, athlete-reported context, disclosure boundaries.', 'Adds athlete state while protecting privacy.'],
  ['nutritionFacts', 'NutritionContextSnapshot from the Nutrition Insight Layer when available.', 'Fueling context can inform sports reads but cannot invent diet claims.'],
  ['allowedClaims / blockedClaims', 'Exact facts Nora may say and tempting claims the engine forbids.', 'Turns copy validation into a deterministic check.'],
  ['missingInputs', 'The smallest missing answer that would materially improve the read.', 'Drives session_confirmation_needed or data_quality candidates.'],
  ['evidenceRefs', 'Snapshot ids, source-record ids, session ids, confirmation ids, sport-policy ids.', 'Makes every output replayable in admin QA.'],
];

const CANDIDATE_READ_ROWS = [
  ['readiness_status', 'Current readiness posture.', 'Fresh/recent recovery facts support a useful status read.'],
  ['recovery_limiter', 'Recovery is the limiting factor.', 'Readiness/recovery is materially below baseline or score band.'],
  ['load_spike', 'Load is unusually high.', 'ACWR/microcycle/session RPE crosses configured sport threshold.'],
  ['load_recovery_match', 'Load and recovery are aligned.', 'Recovery and load evidence agree; no dramatic adjustment needed.'],
  ['intent_mismatch', 'Actual session diverged from plan.', 'Prescribed-vs-actual or coach confirmation shows a mismatch.'],
  ['game_day_prep', 'Competition-window action.', 'Schedule proves competition proximity and evidence supports a pre-game move.'],
  ['cognitive_movement', 'Focus/Composure/Decisioning shift.', 'Enough sim evidence and confidence tier support the movement.'],
  ['fueling_context', 'Nutrition profile affects the sports read.', 'NutritionContextSnapshot is fresh enough and relevant to training/recovery.'],
  ['session_confirmation_needed', 'Ask athlete/coach before interpreting.', 'Missing session type, RPE, soreness, or intent would change the read.'],
  ['data_quality', 'Do not infer; improve coverage.', 'Freshness, baseline, or source coverage is too thin for a real sports claim.'],
  ['no_intervention', 'Stay on plan.', 'Evidence is aligned and no useful correction beats staying consistent.'],
];

const SCORING_GUARDRAIL_ROWS = [
  ['Data confidence', '+30 high_confidence / +24 stable / +14 emerging / +6 directional / block degraded high-impact claims.', 'Confidence controls both ranking and copy posture.'],
  ['Sport relevance', '+20 when the candidate maps to sport/position/season policy.', 'Prevents generic wellness reads from winning.'],
  ['Timing relevance', '+15 when the action affects the next real decision window.', 'Morning game-day and post-session reads should not sound the same.'],
  ['Actionability', '+20 for one concrete next move.', 'Vague advice loses or fails rubric.'],
  ['Materiality', '+10 for a meaningful load/recovery/cognitive change.', 'Avoids making every day a correction.'],
  ['Novelty', '+10 when not repeating the same angle.', 'Regenerate and weekly reports should find a different eligible angle.'],
  ['Unsupported session claim', 'Block.', 'No practice/lift/pull/competition claim unless sessionFacts or confirmation supports it.'],
  ['Unsupported physiology claim', 'Block.', 'No CNS, autonomic, respiratory-rate causal, or parasympathetic claims without approved rule and baseline.'],
  ['Stale-data overconfidence', 'Block or repair.', 'Freshness stale/missing/inferred requires hedging or data_quality.'],
  ['Clinical boundary', 'Block and route.', 'Clinical-threshold signals leave Sports Intelligence.'],
  ['Executable Nora rubric failure', 'Repair, fallback, or hold for review.', 'Athlete-facing copy must pass runtime checks, not just prompt instructions.'],
];

const SPORT_MODIFIERS = [
  ['Basketball point guard, congested schedule', 'High decisioning load + repeat high-intensity bouts.', 'Low HRV plus high ACWR triggers minutes-management review and shorter high-cognitive-load practice blocks.'],
  ['Basketball frontcourt, strength block', 'Higher contact/load tolerance but recovery debt matters.', 'Same low HRV may produce recovery emphasis rather than immediate role/minutes warning if sentiment and cognition are stable.'],
  ['Golf tournament week', 'Precision, sleep consistency, and composure trend carry more weight.', 'Poor sleep with stable composure may recommend warm-up/routine reinforcement, not load reduction.'],
  ['Bowling multi-day tournament', 'Repetition fatigue and day-over-day composure drift matter.', 'Tournament day-three fatigue trend can trigger recovery protocol and reduced extra reps.'],
  ['Off-season development', 'Training adaptation is acceptable when confidence is high and risk is low.', 'Moderate load increase can be framed as adaptation if sleep, sentiment, and cognition stay stable.'],
];

const ALERT_THRESHOLDS = [
  ['Overtraining pattern', 'ACWR > 1.5 or microcycle load delta > +25% for 3 days, plus degraded recovery or sentiment/cognitive decline.', 'Human review required in pilot. No automated coach alert until false-positive review clears.'],
  ['Sudden sentiment shift', '48h sentiment drop crosses configured threshold and persists across at least 2 check-ins.', 'If clinical language or self-harm indicators appear, route to escalation instead of Sports Intelligence alert.'],
  ['Cognitive decline', 'Focus/Composure/Decisioning drop >= 1 confidence band or configured percentile from athlete baseline across 2 valid sessions.', 'Must include simEvidenceCount and confidence tier. Thin evidence becomes watchlist only.'],
  ['Game-day readiness concern', 'Two or more evidence families indicate acute concern inside 48h pre-competition window.', 'Report as reviewed game-day note, not real-time automated alert, during early pilots.'],
  ['Data quality alert', 'Critical lane stale or missing for 3 expected sync cycles.', 'Ops/admin alert only. Never coach-facing as athlete risk.'],
];

const OUTPUT_SCHEMAS = [
  ['SportsFactLedger', 'athleteContext, timeContext, sourceFreshness, recoveryFacts, loadFacts, sessionFacts, cognitiveFacts, checkInFacts, nutritionFacts, allowedClaims, blockedClaims, missingInputs, evidenceRefs.'],
  ['SportsCandidateRead', 'id, type, claim, fact, interpretation, recommendedAction, confidence, score, scoreBreakdown, guardrails, audiencePolicy.'],
  ['SportsReasoningTrace', 'ledgerVersion, selectedCandidateId, rejectedCandidateIds, rubricResults, guardrailResults, unsupportedClaims, finalStatus, replayFixtureId?.'],
  ['ValidatedSportsIntelligencePayload', 'insightId, athleteId, dayKey, audience, layerVersion, ledger, candidates, selectedCandidate, copy, validation, provenance.'],
  ['AthleteReadinessInterpretation', 'athleteId, dayKey, readinessBand, evidence[], confidenceTier, missingInputs[], provenanceTrace[], coachCopy, athleteContextCopy.'],
  ['TrainingLoadInterpretation', 'athleteId, window, acuteLoad, chronicLoad, acwr, sportNativeMetrics[], loadBand, confidenceTier, recommendationIds[].'],
  ['CognitiveMovementInterpretation', 'athleteId, focusDelta, composureDelta, decisioningDelta, simEvidenceCount, confidenceTier, explanation.'],
  ['SportsRecommendation', 'id, targetAudience, actionType, recommendationStrength, sportModifiers[], contraindications[], evidenceRefs[], copyPolicy.'],
  ['SportsIntelligenceWeeklyReport', 'teamId, weekStart, aggregateTrends, athleteWatchlist[], recommendedAdjustments[], confidenceSummary, reviewStatus.'],
  ['GameDayReadinessReport', 'teamId, competitionId, generatedAt, athleteReadiness[], travelContext?, preCompetitionProtocols[], reviewStatus.'],
  ['SportsEarlyWarningAlert', 'teamId, athleteId, alertType, triggerEvidence[], thresholdTrace, escalationChecked, reviewStatus, deliveryStatus.'],
];

const COPY_RULES = [
  ['High confidence, aligned evidence', 'Use direct but non-diagnostic coaching language.', '"Consider reducing high-intensity repetitions today" is allowed after review.'],
  ['Emerging or directional evidence', 'Use monitoring language.', '"Early pattern worth watching" is preferred over intervention language.'],
  ['Degraded confidence', 'Name the limitation internally; keep coach copy restrained.', '"Data is incomplete today" is allowed. Do not imply athlete risk.'],
  ['Self-reported provenance', 'Carry provenance into copy when material.', '"Athlete-reported fatigue has trended up" is allowed.'],
  ['Clinical boundary', 'No clinical interpretation in Sports Intelligence copy.', 'Escalation output is minimum-necessary context after AuntEDNA handoff.'],
  ['Athlete-facing Nora copy', 'Must pass executable Nora rubric plus sports-specific unsupported-claim checks.', 'No mystery pronouns, vague actions, stale-data overconfidence, invented sessions, or physiology theater.'],
  ['Coach-facing report copy', 'Must translate internal confidence into coach voice while preserving evidence limits.', '"This read gets sharper when practice details land" beats "confidence is emerging."'],
];

const BUILD_EXIT_CRITERIA = [
  'Baseline jobs produce deterministic outputs for the same input frame and write provenance traces.',
  'Every recommendation can be traced to evidence refs, sport modifiers, confidence tier, and copy policy.',
  'Every athlete-facing read persists a SportsFactLedger, candidate list, selectedCandidateId, rejectedCandidateIds, rubric results, and guardrail trace.',
  'Candidate fixtures cover unsupported physiology claims, invented session claims, stale-data overconfidence, missing baseline, data-quality fallback, and no-intervention days.',
  'Executable Nora rubric runs on deterministic templates as well as model-generated text.',
  'Game-day and weekly report drafts expose reviewStatus before coach delivery.',
  'Alert thresholds are tested against pilot fixtures for false positives and false negatives before automated delivery is enabled.',
  'Missing-data fixtures cover no wearable, stale wearable, source transition, self-reported-only, and conflicting source records.',
  'Clinical-threshold fixtures prove Sports Intelligence stops and routes to escalation instead of generating performance copy.',
];

const SAMPLE_PAYLOAD = `{
  "athleteId": "ath_123",
  "dayKey": "2026-04-25",
  "readinessBand": "watch",
  "confidenceTier": "emerging",
  "evidence": [
    { "type": "hrv", "value": -14, "unit": "baselineDeltaPct", "source": "oura", "freshness": "fresh" },
    { "type": "training_load", "value": 1.42, "unit": "acwr", "source": "fwp_workoutSessions" },
    { "type": "cognitive", "pillar": "decisioning", "delta": -0.6, "confidenceTier": "stable" }
  ],
  "missingInputs": ["travelContext"],
  "sportModifiers": ["basketball", "point_guard", "in_season"],
  "recommendationIds": ["practice_decisioning_load_review"],
  "reviewStatus": "human_review_required"
}`;

const PulseCheckSportsIntelligenceAggregationInferenceContractTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Sports Intelligence"
        title="Aggregation + Inference Contract"
        version="Version 0.3 | May 6, 2026"
        summary="This companion contract turns the Sports Intelligence boundary spec into deterministic engineering behavior. Version 0.3 adds code-owned fact ledgers, candidate reads, scoring, guardrails, executable Nora rubric validation, and persisted reasoning traces so two teams cannot build incompatible or unsupported versions of the intelligence layer."
        highlights={[
          {
            title: 'Decisioning Contract',
            body: 'Locks how normalized inputs become fact ledgers, eligible candidate reads, selected recommendations, copy posture, and validated payloads.',
          },
          {
            title: 'Human Review By Default',
            body: 'Weekly and game-day report generation can be built now, but pilot coach delivery stays reviewed. Early-warning alerts remain blocked from full automation.',
          },
          {
            title: 'Confidence Carries Through',
            body: 'Every output preserves evidence refs, provenance, confidence tier, missing inputs, and copy posture from ingestion through coach-facing language.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Decisioning contract below the Sports Intelligence output surfaces and above the normalized health, cognitive, training, nutrition, sport-config, and schedule context records."
        sourceOfTruth="This page owns formulas, windows, fallback behavior, source precedence, confidence propagation, candidate read rules, guardrails, alert thresholds, executable rubric requirements, and canonical Sports Intelligence output schemas."
        masterReference="Architecture boundaries live in Sports Intelligence Layer: Architecture & Product Boundaries. Input schemas live in Athlete Context Snapshot, Health Context Source Record, Correlation Data Model, FWP workoutSessions, Macra nutrition records, and sport configuration."
        relatedDocs={[
          'Sports Intelligence Layer: Architecture & Product Boundaries',
          'Athlete Context Snapshot Spec',
          'Health Context Source Record Spec',
          'Health Context Snapshot Assembler Spec',
          'Correlation Data Model Spec',
          'Pilot Outcome Metrics Contract',
          'AuntEDNA Integration Strategy',
        ]}
      />

      <SectionBlock icon={FileJson} title="Fact Ledger + Candidate Reads">
        <InfoCard
          title="AI Does Not Notice The Read"
          accent="purple"
          body="The engine creates the evidence frame, candidate list, scores, and blocked-claim trace before Nora or coach-report copy runs. Model output is a copy layer, not the reasoning layer."
        />
        <DataTable columns={['Ledger Field', 'Contents', 'Why It Exists']} rows={SPORTS_FACT_LEDGER_ROWS} />
        <DataTable columns={['Candidate Type', 'Meaning', 'Eligibility Signal']} rows={CANDIDATE_READ_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Scoring + Guardrails">
        <DataTable columns={['Signal / Rule', 'Score Or Gate', 'Effect']} rows={SCORING_GUARDRAIL_ROWS} />
      </SectionBlock>

      <SectionBlock icon={LineChart} title="Baseline Windows">
        <DataTable columns={['Signal Family', 'Baseline Window', 'Calculation', 'Fallback Rule']} rows={BASELINE_WINDOWS} />
      </SectionBlock>

      <SectionBlock icon={GitBranch} title="Missing Data + Source Conflict Rules">
        <CardGrid columns="lg:grid-cols-2">
          <InfoCard
            title="Minimum Data Behavior"
            accent="amber"
            body={<DataTable columns={['Condition', 'System Behavior', 'Output Constraint']} rows={MINIMUM_DATA_RULES} />}
          />
          <InfoCard
            title="Mixed-Source Precedence"
            accent="blue"
            body={<DataTable columns={['Conflict', 'Resolution', 'Trace Rule']} rows={SOURCE_PRECEDENCE} />}
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Scale} title="Confidence Propagation">
        <DataTable columns={['Tier', 'Required Evidence Posture', 'Allowed Output Posture']} rows={CONFIDENCE_PROPAGATION} />
      </SectionBlock>

      <SectionBlock icon={Gauge} title="Interpretation Rules">
        <DataTable columns={['Output Family', 'Inputs', 'Rule']} rows={INTERPRETATION_RULES} />
      </SectionBlock>

      <SectionBlock icon={Route} title="Sport / Position / Season Modifiers">
        <DataTable columns={['Context', 'Modifier Logic', 'Recommendation Effect']} rows={SPORT_MODIFIERS} />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Alert Thresholds + Automation Gates">
        <InfoCard
          title="Pilot Default"
          accent="red"
          body="Early-warning alerts and high-trust coach recommendations are generated as review candidates only during early pilots. Automated coach delivery requires pilot evidence, threshold evaluation, and explicit release approval."
        />
        <DataTable columns={['Signal', 'Candidate Threshold', 'Delivery Gate']} rows={ALERT_THRESHOLDS} />
      </SectionBlock>

      <SectionBlock icon={FileJson} title="Canonical Output Schemas">
        <DataTable columns={['Record', 'Required Fields']} rows={OUTPUT_SCHEMAS} />
        <InfoCard
          title="Sample AthleteReadinessInterpretation"
          accent="purple"
          body={
            <pre className="overflow-x-auto rounded-xl border border-zinc-800 bg-black/30 p-4 text-xs leading-relaxed text-zinc-200">
              {SAMPLE_PAYLOAD}
            </pre>
          }
        />
      </SectionBlock>

      <SectionBlock icon={ClipboardCheck} title="Coach Copy Policy">
        <DataTable columns={['Evidence Posture', 'Copy Rule', 'Allowed Language']} rows={COPY_RULES} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Build Exit Criteria">
        <InfoCard
          title="Engineering-Ready When"
          accent="green"
          body={<BulletList items={BUILD_EXIT_CRITERIA} />}
        />
      </SectionBlock>

      <SectionBlock icon={Layers} title="First Phase 3 Build Slice">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="Basketball Weekly Draft"
            accent="green"
            body="Generate weekly team load trend, aggregate sentiment trend, cognitive movement, athlete watchlist candidates, and reviewed training-adjustment recommendations."
          />
          <InfoCard
            title="Basketball Game-Day Draft"
            accent="blue"
            body="Generate morning readiness draft with athlete-by-athlete evidence, missing-input trace, optional travel context, and pre-competition protocol recommendations."
          />
          <InfoCard
            title="Alerts Held Back"
            accent="red"
            body="Produce internal alert candidates for evaluation only. No automatic coach delivery until thresholds clear pilot evidence review."
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckSportsIntelligenceAggregationInferenceContractTab;
