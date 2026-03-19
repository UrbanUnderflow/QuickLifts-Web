import React from 'react';
import { Activity, BarChart3, Brain, Database, MessageSquareQuote, ShieldCheck, Target, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const DIFFERENTIATOR_ROWS = [
  ['Oura / wearable partners', 'Sleep, HRV, resting heart rate, readiness, recovery, strain, and time-series physiology.', 'They do not run PulseCheck sims, so they cannot directly observe how the athlete thinks or performs under those states.'],
  ['PulseCheck sims', 'Composure, focus, decision quality, pressure sensitivity, consistency, error recovery, and protocol response.', 'Sims do not know whether the athlete arrived in a high-recovery or low-recovery physiological state unless that state is joined in.'],
  ['PulseCheck joined model', 'Physiology plus cognitive performance in the same athlete over time.', 'Lets us learn personal thresholds, ideal windows, and coachable behavior patterns that neither lane can learn alone.'],
];

const CORRELATION_FAMILY_ROWS = [
  ['Sleep quantity and architecture', 'Total sleep, deep sleep, REM, sleep efficiency, bedtime timing, sleep consistency.', 'Decision quality, focus stability, reset speed, pressure response, rep volatility.', 'Learn personal sleep thresholds, ideal bedtime windows, and when the athlete should train precision versus intensity.'],
  ['Recovery state', 'HRV, resting heart rate, readiness, overnight recovery markers.', 'Composure, inhibitory control, cue discipline, execution steadiness, reaction quality.', 'Identify the athlete’s best recovery band for top mental performance and early-warning conditions for noisy reps.'],
  ['Load and fatigue interaction', 'Activity strain, prior-day workouts, cumulative recovery load, activity heart rate.', 'Fatigability, drift under pressure, decision acceleration, late-session drop-off.', 'Tell whether heavy training should change mental load, sim timing, or protocol selection.'],
  ['Circadian timing', 'Sleep timing, wake timing, current freshness window, time of day.', 'Morning vs evening sim quality, adaptability, focus latency, stability under distraction.', 'Recommend the best time window for cognitively demanding work and detect when poor recovery shifts that window later.'],
  ['Stress-state interaction', 'Stress-related physiology, elevated resting HR, suppressed HRV, poor readiness combinations.', 'Pressure sensitivity, error recovery, narrowing attention, emotional leakage.', 'Differentiate days that call for cleaner reps and steadier pacing from days that can tolerate more chaos or challenge.'],
  ['Protocol responsiveness by body state', 'Current physiology plus recent protocol usage and recovery posture.', 'Pre-post sim delta, subjective benefit, responsiveness trend, session outcome quality.', 'Learn which protocols work best for this athlete under specific physiological states instead of treating tools as universally effective.'],
];

const INITIAL_CORRELATION_ROWS = [
  ['Total sleep vs decision score', 'What amount of sleep produces the athlete’s cleanest decision-making?', 'Personal sleep target.'],
  ['Deep sleep vs reset speed', 'Does deep sleep improve how quickly the athlete settles after mistakes?', 'Recovery-driven protocol emphasis.'],
  ['HRV vs focus stability', 'How stable is attention when HRV is above or below personal baseline?', 'Daily mental-load recommendation.'],
  ['Resting HR deviation vs pressure sensitivity', 'Does elevated resting HR predict noisier pressure reps?', 'Warn against chaotic or high-pressure sim choices.'],
  ['Sleep timing vs next-day best sim window', 'Does earlier sleep create sharper morning reps or just better later-day performance?', 'Recommended sim timing.'],
  ['Poor sleep + low HRV vs compounding drop', 'How much worse is performance when both core recovery signals are down together?', 'High-risk state flag.'],
  ['Recovery score vs repeatability', 'Is the athlete consistent only when recovery is high, or can they still be steady under average recovery?', 'Consistency coaching.'],
  ['Training load vs next-day cognitive drift', 'How does a hard physical day affect the following day’s mental control?', 'Training-plan coordination.'],
  ['Protocol effectiveness by physiology', 'Which protocol helps most when HRV is low, sleep is short, or stress is elevated?', 'Body-state-specific tool recommendation.'],
  ['Personal HRV sweet spot', 'At what HRV range does the athlete usually deliver their best reps?', 'Personal readiness band.'],
  ['Minimum sleep floor', 'Below what sleep threshold does sim quality become unreliable for this athlete?', 'Guardrail recommendation.'],
  ['Best bedtime window', 'What bedtime range most often precedes sharp, steady sim results?', 'Behavior recommendation.'],
];

const DATA_THRESHOLD_ROWS = [
  ['Stage 0 | No correlation permission', 'Oura not connected or not enough sim history.', 'Do not infer correlations. Show only raw wearable context and a note that personal patterns need more linked history.', 'No correlation insight.'],
  ['Stage 1 | Early directional learning', 'At least 7 Oura-backed days plus 5 scored sims touching the target skill.', 'Allow weak directional observations only, such as “you tend to look steadier after better sleep,” but no personalized thresholds or prescriptions.', 'Observation only.'],
  ['Stage 2 | Emerging personal pattern', 'At least 21 Oura-backed days plus 12 scored sims across multiple recovery states.', 'Allow personal tendencies, tentative thresholds, and timing suggestions when the same pattern repeats across separate windows.', 'Low-confidence recommendation allowed.'],
  ['Stage 3 | Stable personal thresholding', 'At least 45 Oura-backed days plus 24 scored sims with enough variance in sleep / HRV / recovery states.', 'Allow explicit personal ranges, recommended sleep windows, and body-state-specific protocol recommendations.', 'Normal recommendation tier.'],
  ['Stage 4 | High-confidence personalization', 'At least 75 Oura-backed days plus 40 scored sims and repeated confirmation in multiple physiological conditions.', 'Allow coach-grade confidence labels and stronger planning guidance because the athlete-specific pattern is demonstrably stable.', 'High-confidence recommendation tier.'],
];

const CONFIDENCE_ROWS = [
  ['`directional`', 'Pattern has appeared, but sample size is still small or narrow.', 'Athlete-facing copy must say “may” or “tends to.” No precise thresholds.'],
  ['`emerging`', 'Pattern repeats across more than one state window and is not contradicted by recent evidence.', 'Allow gentle recommendations and broad ranges, but avoid exact floors or hard planning claims.'],
  ['`stable`', 'Pattern persists across enough time and state diversity to count as athlete-specific.', 'Allow explicit sleep bands, timing windows, and “usually performs best when…” language.'],
  ['`high_confidence`', 'Pattern is repeated, recent, and resilient even when the athlete’s workload or schedule changes.', 'Allow coach-facing planning use, stronger labels, and operational recommendations.'],
  ['`degraded`', 'Recent evidence is stale, conflicting, or based on too little variety.', 'Demote the insight, explain that confidence dropped, and avoid keeping old recommendations alive silently.'],
];

const RECOMMENDATION_POLICY_ROWS = [
  ['Sleep target recommendation', 'Enough stable evidence that mental performance clusters inside a personal sleep-duration band.', 'Recommend a range such as “you usually look sharpest around 7h45-8h15,” not a universal target.'],
  ['Bedtime recommendation', 'Enough stable evidence that sleep timing predicts next-day sim quality.', 'Recommend a bedtime window, not a moralized “good” bedtime.'],
  ['Daily cognitive load recommendation', 'Same-day recovery signals plus a known athlete pattern.', 'Suggest `push`, `steady`, or `protect` mode rather than pretending the wearable owns the decision.'],
  ['Best training window recommendation', 'Time-of-day performance pattern is stable enough.', 'Recommend morning / midday / evening windows for focus-heavy or pressure-heavy work.'],
  ['Protocol suggestion', 'A protocol repeatedly helps when the athlete is in a certain physiological condition.', 'Say “When recovery looks like this, Box Breathing tends to land well for you.”'],
  ['High-risk warning', 'Compound low-recovery state has historically preceded major sim drift.', 'Warn honestly without sounding medical or deterministic.'],
];

const ATHLETE_MESSAGING_ROWS = [
  ['Start with what the athlete can do', 'Lead with actionability, such as “Today may be better for cleaner reps than chaos.”', 'Do not start with abstract model language.'],
  ['Separate body observation from training choice', 'Say “Oura is telling us X, so we may want to do Y.”', 'Do not say Oura is deciding or shaping the athlete directly.'],
  ['Use personal pattern language', '“You usually look sharpest when…”', 'Avoid generic wellness advice that could apply to anyone.'],
  ['Show confidence honestly', '“Early pattern” or “This is becoming consistent for you.”', 'Do not hide uncertainty behind authoritative copy.'],
  ['Avoid medical claims', 'Keep the language in the lane of readiness, focus, consistency, and mental performance.', 'Do not imply diagnosis or treatment.'],
];

const COACH_MESSAGING_ROWS = [
  ['Expose the supporting evidence', 'Show sample size, linked states, confidence tier, and the underlying sim domains affected.', 'Coach surfaces need to understand why an insight exists, not just what it says.'],
  ['Prefer planning posture over motivation copy', 'Coach readouts should translate into session-shaping decisions.', 'Do not mirror the athlete-facing motivational tone exactly.'],
  ['Show state-specific response patterns', 'Example: “Below personal HRV baseline, decision quality falls 11% while composure holds.”', 'This is the operational value for programming.'],
  ['Flag when the model should not be trusted', 'Show stale, conflicting, or low-variety evidence explicitly.', 'Never present a weak correlation as a coach-grade conclusion.'],
];

const GUARDRAIL_ROWS = [
  ['No fake causality', 'PulseCheck may observe a stable relationship between recovery state and sim performance, but should still speak in terms of correlation unless stronger validation exists.', 'Prevents overclaiming.'],
  ['No universal sleep prescriptions', 'Recommendations must be athlete-specific and evidence-backed rather than defaulting to generic “8 hours” advice.', 'Keeps the system differentiated and honest.'],
  ['No silent stale reuse', 'Old correlations should decay when the evidence base is no longer recent or representative.', 'Protects athlete trust.'],
  ['No raw-vendor-first messaging', 'Athlete-facing language should describe what the body state may mean for training, not dump raw vendor payloads without interpretation.', 'Maintains product clarity.'],
  ['No hidden recommendation jumps', 'If the recommendation changes because the athlete entered a different physiological band, that reason should be inspectable.', 'Supports coaching trust and operator debugging.'],
];

const LIFECYCLE_STEPS = [
  {
    title: 'Collect joined evidence',
    body: 'Capture Oura-derived physiology and scored PulseCheck sim performance under the same athlete identity and relevant time windows.',
    owner: 'Health context + sim runtime',
  },
  {
    title: 'Normalize and align',
    body: 'Project wearable state and sim outcomes into one comparable evidence model that can ask questions like “what happened when HRV was below baseline?”',
    owner: 'Correlation engine',
  },
  {
    title: 'Learn personal patterns',
    body: 'Estimate athlete-specific relationships, thresholds, and preferred windows using enough history to avoid one-off conclusions.',
    owner: 'Modeling layer',
  },
  {
    title: 'Assign confidence',
    body: 'Label the insight based on sample size, state diversity, recency, and contradiction pressure so weak patterns do not sound settled.',
    owner: 'Evidence governance',
  },
  {
    title: 'Turn into product guidance',
    body: 'Translate the insight into athlete-facing and coach-facing messaging with the right tone, confidence framing, and operational use.',
    owner: 'Runtime consumers',
  },
  {
    title: 'Decay and refresh',
    body: 'Recompute as new Oura and sim data arrives. Demote or retire patterns that stop holding up over time.',
    owner: 'Operational layer',
  },
];

const PulseCheckOuraCognitiveCorrelationSpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="PulseCheck Health Context"
        title="Oura Cognitive Correlation Spec"
        version="Version 0.1 | March 19, 2026"
        summary="Product spec for the joined-model layer that turns Oura physiology plus PulseCheck simulation results into athlete-specific cognitive correlations. This is the layer that lets PulseCheck learn how a given athlete’s mental game changes under specific body states, then translate that into evidence-backed guidance about sleep, recovery, timing, and protocol choice."
        highlights={[
          {
            title: 'This Is The Differentiator',
            body: 'Wearables see the body and sims see the mind. PulseCheck can see how the mind behaves inside different physiological states.',
          },
          {
            title: 'Personal Thresholds Over Generic Advice',
            body: 'The product should learn athlete-specific sleep floors, HRV bands, and ideal timing windows instead of handing everyone the same recommendation.',
          },
          {
            title: 'Confidence Must Be Visible',
            body: 'The system should not overstate weak patterns. Observation, recommendation, and coach-grade planning need separate confidence bars.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Design artifact for the correlation layer that sits above normalized Oura / health-context ingestion and above raw sim scoring. It defines what kinds of joined physiology-to-cognition relationships PulseCheck should learn, when the system has enough evidence to speak confidently, and how those insights should be translated for athletes and coaches."
        sourceOfTruth="Use this page to decide which Oura-to-sim correlations are valid product targets, what minimum data is required before an insight can go live, how recommendation confidence should work, and how athlete copy must differ from coach copy."
        masterReference="Any implementation that tries to generate sleep, HRV, readiness, or timing recommendations from Oura + PulseCheck evidence should follow this spec first. If a proposed insight cannot be expressed through these evidence, confidence, and messaging rules, update this spec before shipping the insight."
        relatedDocs={[
          'Oura Integration Strategy',
          'Health Context Pipeline',
          'Athlete Context Snapshot Spec',
          'State Signal Layer',
          'Profile Architecture',
          'Nora Assignment Rules',
        ]}
      />

      <SectionBlock icon={Brain} title="Why PulseCheck Can Do This">
        <DataTable columns={['System', 'What It Can See', 'What It Cannot See']} rows={DIFFERENTIATOR_ROWS} />
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="Joined-Model Thesis"
            accent="purple"
            body="The product edge is not “we have Oura data.” The edge is “we know how this athlete’s mind performs under different recovery states because we also run the sims.”"
          />
          <InfoCard
            title="Recommendation Thesis"
            accent="green"
            body="The goal is to turn body-state observations into usable coaching guidance, such as when to push, when to steady, when to protect, and what protocol tends to land best."
          />
          <InfoCard
            title="Trust Thesis"
            accent="amber"
            body="The system should only become more specific as it earns the right to be more specific. Confidence must rise with evidence, not with product ambition."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Activity} title="Correlation Families">
        <DataTable columns={['Family', 'Physiology Inputs', 'PulseCheck Outputs', 'Product Value']} rows={CORRELATION_FAMILY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Target} title="Initial Correlations To Prioritize">
        <DataTable columns={['Correlation', 'Question', 'Product Output']} rows={INITIAL_CORRELATION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Minimum Evidence Thresholds">
        <DataTable columns={['Maturity Stage', 'Minimum Data', 'Allowed Product Behavior', 'Output Tier']} rows={DATA_THRESHOLD_ROWS} />
      </SectionBlock>

      <SectionBlock icon={BarChart3} title="Confidence Model">
        <DataTable columns={['Tier', 'Meaning', 'Runtime Rule']} rows={CONFIDENCE_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Core Confidence Inputs"
            accent="blue"
            body={
              <BulletList
                items={[
                  'Sample size of linked Oura-backed days and scored sims.',
                  'State diversity: the athlete must have performed under meaningfully different sleep / recovery conditions.',
                  'Recency: old evidence should count less than fresh evidence.',
                  'Contradiction pressure: if recent data disagrees, the model should demote confidence.',
                ]}
              />
            }
          />
          <InfoCard
            title="What Confidence Should Not Depend On"
            accent="red"
            body={
              <BulletList
                items={[
                  'How compelling the copy sounds.',
                  'Whether the recommendation is behaviorally attractive.',
                  'Whether a generic wellness heuristic would support the same answer.',
                  'How badly we want the insight to exist as a product surface.',
                ]}
              />
            }
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Recommendation Generation Policy">
        <DataTable columns={['Recommendation Type', 'When It Is Allowed', 'Output Rule']} rows={RECOMMENDATION_POLICY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={MessageSquareQuote} title="Messaging Rules">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Athlete-Facing Rules"
            accent="green"
            body={<BulletList items={ATHLETE_MESSAGING_ROWS.map(([title, body]) => `${title}: ${body}`)} />}
          />
          <InfoCard
            title="Coach-Facing Rules"
            accent="blue"
            body={<BulletList items={COACH_MESSAGING_ROWS.map(([title, body]) => `${title}: ${body}`)} />}
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Guardrails">
        <DataTable columns={['Guardrail', 'Rule', 'Why']} rows={GUARDRAIL_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Insight Lifecycle">
        <StepRail steps={LIFECYCLE_STEPS} />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckOuraCognitiveCorrelationSpecTab;
