import React from 'react';
import {
  Activity,
  BarChart3,
  Brain,
  Database,
  GitBranch,
  MessageSquareQuote,
  ShieldCheck,
  Sparkles,
  Target,
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
  StepRail,
} from './PulseCheckRuntimeDocPrimitives';

const SYSTEM_STACK_ROWS = [
  ['Health Context Pipeline', 'What body signals do we have?', 'Normalizes wearable and physiological inputs into canonical source records and athlete-context snapshots.'],
  ['State Signal Layer', 'What state does the athlete appear to be in today?', 'Interprets daily context into runtime state posture, freshness, and routing outputs for Nora.'],
  ['Physiology-Cognition Correlation Engine', 'How does this athlete usually perform under states like this?', 'Learns personal mind-body patterns from joined physiology plus sim evidence, scores confidence, and projects recommendations.'],
  ['Runtime Consumers', 'How should the system respond?', 'Feeds profile, Nora, protocol planning, coach views, trial interpretation, and research layers.'],
];

const RESPONSIBILITY_ROWS = [
  ['Learn personal thresholds', 'Find athlete-specific sleep floors, HRV bands, timing windows, and state-performance relationships instead of generic wellness heuristics.'],
  ['Assign confidence', 'Score pattern strength based on sample size, state diversity, recency, and contradiction pressure.'],
  ['Generate recommendations', 'Turn stable patterns into athlete-facing and coach-facing guidance with confidence-appropriate language.'],
  ['Decay stale patterns', 'Demote or retire old relationships when fresh evidence is missing or recent evidence conflicts.'],
  ['Annotate assessments', 'Mark Baseline, Midpoint, Endpoint, and other key captures with physiological context so research and coaches can interpret results honestly.'],
  ['Project to runtime', 'Feed insights into Nora, profile surfaces, protocol selection, and planning layers without asking consumers to re-learn correlations themselves.'],
];

const ARTIFACT_ROWS = [
  ['Correlation Evidence Record', 'Joined evidence unit tying physiology state, sim outcome, timestamp, and athlete identity into one comparable row.', 'This is the raw fuel for correlation learning.'],
  ['Athlete Pattern Model', 'Per-athlete learned relationship layer covering thresholds, sweet spots, fragile bands, and body-state-specific response patterns.', 'This becomes the long-lived personal pattern memory.'],
  ['Recommendation Projection', 'Athlete-facing or coach-facing output generated from a stable pattern plus current-day physiology posture.', 'This is what Profile, Nora, and coach tools actually consume.'],
  ['Assessment Context Flag', 'Annotation on Baseline, Midpoint, Endpoint, or other key captures that says whether the athlete was physiologically advantaged, normal, or compromised at capture time.', 'This prevents misreading a trial result without context.'],
];

const CORRELATION_FAMILY_ROWS = [
  ['Sleep quantity and architecture', 'Total sleep, deep sleep, REM, efficiency, timing, consistency', 'Decision quality, focus stability, reset speed, pressure response, volatility', 'Learn personal sleep floors, ideal sleep bands, and whether better sleep improves precision, composure, or both.'],
  ['Recovery state', 'HRV, resting HR, readiness, overnight recovery markers', 'Composure, inhibitory control, cue discipline, execution steadiness, reaction quality', 'Identify the athlete’s strongest recovery band for mental sharpness and the earliest warning states for noisy reps.'],
  ['Load and fatigue interaction', 'Activity strain, prior-day training load, cumulative fatigue posture', 'Drift under pressure, decision acceleration, fatigability, late-session drop-off', 'Shape training-day mental load and detect when high physical load should change cognitive work.'],
  ['Circadian timing', 'Sleep timing, wake timing, freshness window, time of day', 'Morning versus evening sim quality, focus latency, adaptability, steadiness', 'Recommend when this athlete tends to do their best focus-heavy or pressure-heavy work.'],
  ['Stress-state interaction', 'Elevated resting HR, suppressed HRV, poor-readiness combinations, stress-adjacent physiology', 'Pressure sensitivity, error recovery, attention narrowing, emotional leakage', 'Differentiate days that call for steadier work from days that can tolerate more challenge.'],
  ['Protocol responsiveness by body state', 'Current physiology plus recent protocol usage and recovery posture', 'Pre-post sim delta, subjective benefit, response trend, session outcome quality', 'Learn which tools land best for this athlete when the body state changes.'],
];

const DATA_THRESHOLD_ROWS = [
  ['Stage 0 | No correlation permission', 'No usable physiology lane or not enough linked sim history.', 'Do not infer patterns. Show only raw body-state context and explain that personal pattern learning needs more linked evidence.'],
  ['Stage 1 | Early directional learning', 'At least 7 physiology-backed days plus 5 scored sims touching the target skill.', 'Allow weak directional observations only. No personalized thresholds or strong prescriptions.'],
  ['Stage 2 | Emerging personal pattern', 'At least 21 physiology-backed days plus 12 scored sims across more than one recovery state.', 'Allow tentative personal tendencies and broad ranges when patterns repeat across separate windows.'],
  ['Stage 3 | Stable personal thresholding', 'At least 45 physiology-backed days plus 24 scored sims with enough variance in sleep, HRV, and recovery states.', 'Allow explicit personal ranges, timing windows, and body-state-specific recommendations.'],
  ['Stage 4 | High-confidence personalization', 'At least 75 physiology-backed days plus 40 scored sims with repeated confirmation in multiple physiological conditions.', 'Allow stronger coach-grade planning guidance and stable recommendation surfaces.'],
];

const CONFIDENCE_ROWS = [
  ['`directional`', 'Pattern has appeared, but sample size is still small or narrow.', 'Say “may” or “tends to.” No precise thresholds.'],
  ['`emerging`', 'Pattern repeats across more than one state window and is not contradicted by recent evidence.', 'Allow gentle recommendations and broad ranges, but avoid exact floors.'],
  ['`stable`', 'Pattern persists across enough time and state diversity to count as athlete-specific.', 'Allow explicit ranges and “you usually look sharpest when…” language.'],
  ['`high_confidence`', 'Pattern is repeated, recent, and resilient even as workload or schedule changes.', 'Allow coach-facing planning use and stronger operational labels.'],
  ['`degraded`', 'Recent evidence is stale, conflicting, or based on too little variety.', 'Demote the insight and explain that confidence dropped.'],
];

const CONSUMER_ROWS = [
  ['Profile system', 'Show the athlete what usually helps, what tends to cost them, and what today’s body state may mean.', 'Short, direct coaching language plus optional deeper evidence.'],
  ['Nora runtime', 'Shape daily guidance, phrasing, protocol suggestions, and how hard Nora recommends pushing.', 'Use current physiology plus stable personal patterns, not raw vendor payloads.'],
  ['Protocol planner', 'Choose tools that tend to help under today’s physiological posture.', 'This is where body-state-specific protocol response becomes operational.'],
  ['Coach dashboard', 'Expose planning-grade evidence, sample sizes, thresholds, and state-specific response patterns.', 'Coaches need inspectable reasoning, not only athlete copy.'],
  ['Trial architecture', 'Annotate Baseline, Midpoint, Endpoint, and retention captures with physiological context quality.', 'Prevents false comparisons when a key assessment happened under compromised recovery.'],
  ['Research and analytics', 'Study how physiology and mental performance interact over time across individuals and cohorts.', 'This becomes a differentiated joined-data asset, not just a UX feature.'],
];

const MESSAGING_RULES = [
  'Athlete-facing language should start with what the athlete can do, not with model jargon.',
  'Speak in terms of correlation and tendency unless the evidence is strong enough to be explicit.',
  'Do not say the wearable is deciding anything; the body state is informing how we interpret and respond.',
  'Coach-facing language should expose the evidence density, confidence, and domains affected.',
  'Old patterns should decay visibly when recent evidence no longer supports them.',
];

const ENGINE_LIFECYCLE = [
  {
    title: 'Collect joined evidence',
    body: 'Capture physiology-backed state plus scored PulseCheck sim performance under the same athlete identity and aligned time windows.',
    owner: 'Health context + sim runtime',
  },
  {
    title: 'Normalize into evidence records',
    body: 'Project wearable state and sim outcomes into a comparable evidence model that can ask questions like “what happens when HRV is below baseline?”',
    owner: 'Correlation engine',
  },
  {
    title: 'Learn athlete patterns',
    body: 'Estimate personal thresholds, sweet spots, and fragile bands using enough history to avoid one-off conclusions.',
    owner: 'Pattern layer',
  },
  {
    title: 'Score confidence and freshness',
    body: 'Label the pattern based on sample size, state diversity, recency, and contradiction pressure so weak patterns do not sound settled.',
    owner: 'Evidence governance',
  },
  {
    title: 'Project into product guidance',
    body: 'Translate the pattern into athlete-facing, coach-facing, and runtime-facing outputs with the right confidence framing.',
    owner: 'Runtime consumers',
  },
  {
    title: 'Refresh, decay, and annotate',
    body: 'Recompute as new data arrives, retire stale patterns, and attach physiological context flags to key assessments.',
    owner: 'Operational layer',
  },
];

const PulseCheckPhysiologyCognitionCorrelationEngineTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="PulseCheck Health Context"
        title="Physiology-Cognition Correlation Engine"
        version="Version 0.1 | March 19, 2026"
        summary="Parent artifact for the PulseCheck system that learns athlete-specific mind-body patterns from normalized physiology plus PulseCheck simulation evidence. This is the layer that turns body-state inputs and measured mental-performance outcomes into personal thresholds, confidence-scored recommendations, and context-aware coaching guidance."
        highlights={[
          {
            title: 'This Is The Differentiator',
            body: 'Wearables see the body and sims see the mind. PulseCheck can see how the mind behaves inside different physiological states.',
          },
          {
            title: 'Not Vendor-Specific',
            body: 'Oura is the first child implementation, but the engine should eventually learn from Apple Watch, Garmin, Whoop, and future physiological lanes too.',
          },
          {
            title: 'Confidence Has To Be Earned',
            body: 'The system should become more specific only when sample size, diversity, and freshness support the insight.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="System artifact for the joined-model layer that sits between physiology ingestion and runtime consumers. It defines how PulseCheck should learn athlete-specific patterns from body-state evidence plus sim outcomes, how confidence works, what outputs the engine owns, and how those outputs should feed Nora, profile, coaches, protocols, and trials."
        sourceOfTruth="Use this page when defining the shared correlation model, evidence thresholds, confidence rules, recommendation-generation policy, trial-context flags, or any consumer that wants to use physiology-to-cognition learning across devices."
        masterReference="Any source-specific implementation, including Oura, Apple Watch, Garmin, Whoop, or future wearable lanes, should follow this engine spec first. If a proposed correlation or recommendation cannot fit these governance rules, update this engine before shipping the source-specific insight."
        relatedDocs={[
          'Health Context Pipeline',
          'Contract Lock & Exit Criteria',
          'State Signal Layer',
          'Athlete Context Snapshot Spec',
          'Correlation Data Model Spec',
          'Correlation Engine Engineering Task Breakdown',
          'Profile Architecture',
          'Nora Assignment Rules',
          'Oura Cognitive Correlation Spec',
        ]}
      />

      <SectionBlock icon={GitBranch} title="Where This Sits In The Stack">
        <DataTable columns={['Layer', 'Question', 'Role']} rows={SYSTEM_STACK_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Sparkles} title="Why This Exists">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="Joined-Model Thesis"
            accent="purple"
            body="The product edge is not that PulseCheck has wearable data. The edge is that PulseCheck can observe how this athlete thinks and performs under different body states."
          />
          <InfoCard
            title="Recommendation Thesis"
            accent="green"
            body="The engine should turn physiology-backed patterns into usable coaching guidance about when to push, when to steady, what protocol tends to land, and how to interpret important assessments."
          />
          <InfoCard
            title="Platform Thesis"
            accent="amber"
            body="This is a reusable capability, not an Oura feature. Each new physiological source should enrich the same engine rather than starting a new insight system."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Engine Responsibilities">
        <DataTable columns={['Responsibility', 'Rule']} rows={RESPONSIBILITY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Core Object Model">
        <DataTable columns={['Artifact', 'Meaning', 'Why It Exists']} rows={ARTIFACT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Activity} title="Correlation Families">
        <DataTable columns={['Family', 'Physiology Inputs', 'PulseCheck Outputs', 'Product Value']} rows={CORRELATION_FAMILY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Target} title="Minimum Evidence Thresholds">
        <DataTable columns={['Maturity Stage', 'Minimum Data', 'Allowed Product Behavior']} rows={DATA_THRESHOLD_ROWS} />
      </SectionBlock>

      <SectionBlock icon={BarChart3} title="Confidence Model">
        <DataTable columns={['Tier', 'Meaning', 'Runtime Rule']} rows={CONFIDENCE_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Confidence Inputs"
            accent="blue"
            body={
              <BulletList
                items={[
                  'Sample size of linked physiology-backed days and scored sims.',
                  'State diversity across sleep, HRV, readiness, and recovery conditions.',
                  'Recency: old evidence should count less than fresh evidence.',
                  'Contradiction pressure when recent data disagrees with the old pattern.',
                ]}
              />
            }
          />
          <InfoCard
            title="Confidence Anti-Patterns"
            accent="red"
            body={
              <BulletList
                items={[
                  'Do not raise confidence because the copy sounds compelling.',
                  'Do not raise confidence because the recommendation is behaviorally attractive.',
                  'Do not silently preserve a pattern once recent evidence stops supporting it.',
                  'Do not let vendor prestige stand in for actual evidence density.',
                ]}
              />
            }
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Brain} title="Runtime Consumers">
        <DataTable columns={['Consumer', 'What It Uses', 'Rule']} rows={CONSUMER_ROWS} />
      </SectionBlock>

      <SectionBlock icon={MessageSquareQuote} title="Messaging Rules">
        <InfoCard
          title="Shared Output Rules"
          accent="green"
          body={<BulletList items={MESSAGING_RULES} />}
        />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Guardrail">
        <InfoCard
          title="Correlation, Not Causation"
          accent="amber"
          body="PulseCheck may observe a stable relationship between body state and mental performance, but it should still speak in terms of correlation unless stronger validation exists. The engine’s value comes from athlete-specific usefulness, not from pretending to prove causal science it has not earned."
        />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Engine Lifecycle">
        <StepRail steps={ENGINE_LIFECYCLE} />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckPhysiologyCognitionCorrelationEngineTab;
