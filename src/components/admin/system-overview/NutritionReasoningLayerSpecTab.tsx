import React from 'react';
import { Brain, CheckCircle2, ClipboardList, Database, Gauge, GitBranch, Layers3, RefreshCw, ShieldCheck, Sparkles, Utensils } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const ARCHITECTURE_ROWS = [
  ['1', 'Nutrition Fact Ledger', 'Server-owned source of truth for all numbers, targets, deltas, timing, top contributors, confidence, and source provenance.'],
  ['2', 'Candidate Insight Engine', 'Deterministic code generates eligible coaching reads such as status, tomorrow adjustment, food driver, timing, or data quality.'],
  ['3', 'Scoring + Guardrails', 'Candidates are ranked by confidence, goal relevance, actionability, novelty, severity, and hard contradiction checks.'],
  ['4', 'Nora Copy Layer', 'The model receives approved facts and candidate decisions only. It writes concise human copy but does not calculate or invent.'],
  ['5', 'Validated Insight Payload', 'Server validates unsupported numbers, conflicting advice, weak actions, and copy policy before persistence or push.'],
  ['6', 'Product Consumers', 'Macra daily insights consume first; PulseCheck later consumes athlete nutrition context inside health/sports intelligence snapshots.'],
];

const FACT_LEDGER_ROWS = [
  ['todayTotals', 'kcal, protein, carbs, fat, net carbs, fiber when available', 'Exact numbers shown in UI and allowed in copy.'],
  ['targets', 'daily kcal/protein/carbs/fat', 'Defines over/under/on-target status. Invalid all-zero targets become null.'],
  ['deltas', 'amount + direction per macro', 'Prevents model math and contradiction errors.'],
  ['mealCount', 'number of logged meals for selected day', 'Supports status and logging consistency reads.'],
  ['topContributors', 'top meal/food by kcal, protein, carbs, fat', 'Only source allowed for food-driver claims.'],
  ['timingBuckets', 'morning, midday, evening, late macro distribution', 'Supports timing insights without freeform inference.'],
  ['loggedHistory', 'logged days only, window days, averages, hit rates', 'Pattern claims are based only on days with actual logs.'],
  ['goalContext', 'cut, bulk, recomp, maintain, athlete, general', 'Shapes action selection and avoids wrong advice.'],
  ['timeContext', 'early, mid-day, late, closed day', 'Blocks “eat more tonight” after the day is essentially closed.'],
  ['confidence', 'high, medium, low with data gaps', 'Controls whether Nora can say pattern, trend, rare, usually, or no intervention.'],
  ['provenance', 'source app, meal ids, generatedAt, timezone, ledger version', 'Makes every insight auditable and replayable across products.'],
];

const CANDIDATE_ROWS = [
  ['status', 'Where the user stands right now.', 'Current totals vs targets are the most useful read.'],
  ['save_the_day', 'What to do before the day ends.', 'There is time to act and a clear macro gap remains.'],
  ['tomorrow_adjustment', 'One tweak for tomorrow.', 'The day is late/closed or the best move is a next-day adjustment.'],
  ['pattern', 'Repeated behavior across enough logged days.', 'At least 5 logged days; stronger trend language needs 7+.'],
  ['food_driver', 'Food or meal that moved the numbers most.', 'A top contributor materially explains the day.'],
  ['timing', 'Meal distribution issue.', 'Timing buckets reveal front-loading, late-loading, or uneven protein cadence.'],
  ['data_quality', 'Not enough consistent logs to infer a real trend.', 'History is thin or inconsistent; the honest insight is data coverage.'],
  ['no_intervention', 'User is close enough; avoid overcorrecting.', 'Targets are essentially met and dramatic advice would be noise.'],
];

const SCORING_ROWS = [
  ['Accuracy confidence', '+30', 'Facts are complete, fresh, and internally consistent.'],
  ['User goal relevance', '+20', 'Candidate directly supports cut, bulk, recomp, maintenance, or athlete demand.'],
  ['Actionability', '+20', 'There is one concrete next move available.'],
  ['Novelty', '+10', 'Not the same angle as the last saved insight.'],
  ['Severity / importance', '+10', 'The miss or opportunity is material enough to mention.'],
  ['Specific food/action available', '+10', 'The action can name a real logged, frequent, or approved food option.'],
  ['Insufficient history', 'Block or heavy penalty', 'Pattern/trend claims are not eligible when data coverage is too low.'],
  ['Closed day mismatch', 'Block', 'No “eat more tonight” when the day is effectively over.'],
  ['Contradictory macro advice', 'Block', 'No reducing carbs if carbs are under target; no reducing protein if protein is under target.'],
  ['Overdrama near target', 'Penalty', 'Close-enough days should bias toward no_intervention or tiny adjustment.'],
];

const HARD_GUARDRAILS = [
  'No nutrition arithmetic in the model layer. All numbers must come from the fact ledger.',
  'No historical claim unless at least 5 logged days exist.',
  'No strong trend, rare, usually, or pattern language unless at least 7 logged days support it.',
  'No macro number unless it appears in the allowedNumbers set for the selected candidate.',
  'No food blame unless that food is an actual top contributor.',
  'No recommendation to reduce carbs when carbs are under target.',
  'No recommendation to reduce protein when protein is under target.',
  'No “eat more tonight” or “fix this tonight” after the day is closed.',
  'No moralizing language: good, bad, cheat, failed, clean, dirty.',
  'No vague actions like “be mindful,” “eat balanced,” or “consider improving.”',
  'No advice that conflicts with goal direction, training context, or source confidence.',
];

const PERSONALIZATION_ROWS = [
  ['Cutting', 'Protect protein first; trim the smallest surplus rather than cutting a whole meal.'],
  ['Bulking', 'Prioritize missed calories/carbs; avoid shame language around surplus when the goal supports intake.'],
  ['Recomp', 'Emphasize protein consistency plus reasonable calorie range.'],
  ['Athlete', 'Tie nutrition to training/recovery only when training, sport, or schedule context exists.'],
  ['Inconsistent logger', 'Make logging coverage the action; avoid pretending thin history is a trend.'],
  ['Late eater', 'Suggest front-loading tomorrow rather than punishing late-night behavior.'],
  ['Repeated foods', 'Use actual frequent foods for realistic swaps or keep/remove decisions.'],
  ['Low history', 'Say what is missing and ask for more consistent logs before pattern claims.'],
];

const OUTPUT_ROWS = [
  ['title', 'Decision headline, not a vague label.', '“Protein hit; 64 kcal over”'],
  ['fact', 'Exact ledger-backed number sentence.', '“You’re at 2,242 kcal vs 2,178, with 309g protein against a 296g target.”'],
  ['interpretation', 'Why the fact matters for the goal.', '“The structure worked. This is not a day to overcorrect.”'],
  ['action', 'One specific next move.', '“Tomorrow, keep protein anchors and trim one snack-sized calorie add-on.”'],
  ['confidenceNote', 'Only when useful.', '“Only 3 days logged, so this is a coverage read, not a trend.”'],
];

const CROSS_APP_ROWS = [
  ['Macra iOS', 'First implementation surface for daily insights, Ask Nora nutrition chat, macro planning, and insight regeneration.', 'Consumes fact ledger + validated insight payload from Web/Admin functions.'],
  ['Fit With Pulse', 'Shared workout/energy context can enrich nutrition interpretation without becoming the nutrition source of truth.', 'Feeds calories-out/training context where provenance is clear.'],
  ['PulseCheck', 'Future athlete-context consumer. Nora should understand athlete nutrition profile, macro consistency, fueling timing, and data confidence.', 'Reads a normalized NutritionContextSnapshot inside the health/sports intelligence stack.'],
  ['Web/Admin', 'Owns reasoning-layer server functions, validation, QA dashboard, audit traces, and cross-product schema governance.', 'Maintains candidate logic, guardrails, generated payloads, and operator review tools.'],
];

const IMPLEMENTATION_CHECKLIST_ROWS = [
  ['0', 'Contract lock', 'Define shared TypeScript types for FactLedger, CandidateInsight, ValidatedInsight, NutritionContextSnapshot, and guardrail result.', 'Not started'],
  ['1', 'Fact ledger v1', 'Move Macra daily totals, targets, deltas, local-day bucketing, top contributors, timing buckets, history coverage, confidence, and provenance into a reusable builder.', 'Started'],
  ['1', 'Ledger persistence', 'Persist facts with generated insights and expose enough metadata for debugging stale or incorrect copy.', 'Started'],
  ['2', 'Candidate generator', 'Implement deterministic candidate generation for status, save_the_day, tomorrow_adjustment, pattern, food_driver, timing, data_quality, and no_intervention.', 'Not started'],
  ['2', 'Candidate tests', 'Unit-test macro contradiction cases, thin-history cases, local-day timezone cases, and close-enough no_intervention cases.', 'Not started'],
  ['3', 'Scoring + guardrails', 'Rank candidates and block unsafe/contradictory candidates before Nora sees them.', 'Not started'],
  ['3', 'Allowed action library', 'Create reusable action templates by goal, macro gap, time of day, convenience pattern, and approved food set.', 'Not started'],
  ['4', 'Nora copy layer', 'Constrain the model to rewrite selected candidates only; reject unsupported numbers and weak/vague actions.', 'Not started'],
  ['4', 'Validated payload schema', 'Return title, fact, interpretation, action, confidenceNote, selectedCandidateId, rejectedCandidateIds, and validation trace.', 'Not started'],
  ['5', 'Regenerate semantics', 'Make regenerate select next-best candidate or angle, not simply re-roll the same prompt.', 'Not started'],
  ['6', 'Admin QA dashboard', 'Show fact ledger, all candidates, scores, rejection reasons, final copy, and feedback labels for tuning.', 'Not started'],
  ['7', 'PulseCheck bridge', 'Publish NutritionContextSnapshot into the athlete health-context pipeline for Nora, reports, and sport-aware fueling context.', 'Future'],
];

const ACCEPTANCE_CRITERIA = [
  'Every number in the insight matches the fact ledger and the user-facing totals for the same day/timezone.',
  'The first sentence is useful without reading the rest.',
  'The action is specific, doable, and consistent with macro status and goal direction.',
  'The selected insight type is justified by available data and confidence.',
  'Low-confidence days do not pretend to have patterns.',
  'Regenerate produces a materially different eligible angle or explains why this is still the best read.',
  'PulseCheck consumers receive nutrition profile context with source labels, confidence, freshness, and no unsupported diet claims.',
];

const PHASES = [
  {
    title: 'Freeze The Shared Contract',
    owner: 'Platform + Nutrition',
    body: 'Define shared schemas and copy policy before adding new prompt behavior. The contract must work for Macra today and PulseCheck athlete context later.',
  },
  {
    title: 'Build The Fact Ledger',
    owner: 'Web/Admin Runtime',
    body: 'Centralize daily totals, local-day bucketing, targets, deltas, top contributors, timing, history coverage, confidence, and provenance.',
  },
  {
    title: 'Generate And Score Candidates',
    owner: 'Nutrition Reasoning',
    body: 'Let deterministic code produce eligible coaching decisions, score them, and block contradictory or low-confidence claims.',
  },
  {
    title: 'Add Nora As Copy Layer Only',
    owner: 'AI Platform',
    body: 'Give Nora the selected candidate and approved facts. Validate every output before persistence, push, or chat display.',
  },
  {
    title: 'Upgrade Regenerate And QA',
    owner: 'Product + Ops',
    body: 'Make regenerate choose alternate candidates and add admin review tooling to inspect facts, candidate rankings, and rejection reasons.',
  },
  {
    title: 'Publish Nutrition Context To PulseCheck',
    owner: 'PulseCheck Runtime',
    body: 'Roll up athlete nutrition profile, fueling timing, macro consistency, and confidence into the health-context snapshot without making Macra data look like clinical truth.',
  },
];

const NutritionReasoningLayerSpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Shared Intelligence"
        title="Nutrition Reasoning Layer"
        version="Version 0.1 | May 5, 2026"
        summary="Cross-product spec for replacing freeform AI nutrition commentary with a fact-grounded reasoning layer. Macra is the first consumer for daily insights. PulseCheck should later consume the same source-aware nutrition context so Nora can understand an athlete’s fueling profile, macro consistency, and data confidence inside the broader health and sports intelligence stack."
        highlights={[
          {
            title: 'AI Writes, Code Reasons',
            body: 'The model should never calculate nutrition. Server-owned facts, candidates, scoring, and guardrails decide what may be said.',
          },
          {
            title: 'Trust Before Cleverness',
            body: 'Every insight must prove itself with exact app numbers before offering coaching. Inaccurate totals are a product failure, not a prompt style issue.',
          },
          {
            title: 'Built For Multiple Apps',
            body: 'Macra gets better daily insights now. PulseCheck later gets a NutritionContextSnapshot for athlete-aware Nora decisions and reports.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Shared reasoning artifact for nutrition intelligence across Macra, Fit With Pulse, PulseCheck, and Web/Admin."
        sourceOfTruth="This document is authoritative for the nutrition fact ledger, candidate insight engine, scoring rules, guardrails, copy-layer boundary, regenerate behavior, and cross-app rollout checklist."
        masterReference="Use this page before editing Macra daily insights, Ask Nora nutrition prompts, nutrition profile snapshots, PulseCheck nutrition context, or any AI copy that references food, macros, fueling, or nutrition history."
        relatedDocs={[
          { label: 'Macra', sectionId: 'macra-system-overview' },
          { label: 'Health Context Pipeline', sectionId: 'pulsecheck-health-chat-architecture' },
          { label: 'Sports Intelligence Layer', sectionId: 'pulsecheck-sports-intelligence-layer-spec' },
          { label: 'Adaptive Framing Layer', sectionId: 'pulsecheck-adaptive-framing-layer-spec' },
          { label: 'System Design & Language', sectionId: 'system-design-language' },
        ]}
      />

      <SectionBlock icon={ShieldCheck} title="Product Critique This Layer Solves">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="Trust Is The Admission Ticket"
            accent="red"
            body="If the card says 2,242 kcal and the insight says a different total or delta, the user stops trusting the coaching. Fact mismatch is the first thing this layer eliminates."
          />
          <InfoCard
            title="Insights Are Not Reports"
            accent="amber"
            body="Three bullets of restated math feel like generated commentary. The useful unit is one coaching decision, backed by one exact fact, one interpretation, and one next move."
          />
          <InfoCard
            title="Regenerate Must Mean Something"
            accent="blue"
            body="Regenerate should not roll dice on wording. It should recompute facts if needed, select the next-best eligible candidate, or explain that the same read is still the most useful."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Layers3} title="System Shape">
        <InfoCard
          title="Pipeline"
          accent="green"
          body="Meal logs + targets + history → Nutrition Fact Ledger → Candidate Insight Engine → Scoring + Guardrails → Nora Copy Layer → Validated Insight Payload → Macra UI / push / history / PulseCheck context."
        />
        <DataTable columns={['Step', 'Layer', 'Responsibility']} rows={ARCHITECTURE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Nutrition Fact Ledger">
        <DataTable columns={['Field', 'Contents', 'Why It Exists']} rows={FACT_LEDGER_ROWS} />
        <InfoCard
          title="Persistence Requirement"
          accent="blue"
          body="Every generated insight should persist the ledger or a ledger reference beside final copy. Operators need to inspect the exact facts, candidates, and validations that produced a card."
        />
      </SectionBlock>

      <SectionBlock icon={GitBranch} title="Candidate Insight Engine">
        <DataTable columns={['Candidate Type', 'Meaning', 'Eligibility Signal']} rows={CANDIDATE_ROWS} />
        <InfoCard
          title="Core Contract"
          accent="green"
          body="The engine should ask: what is the one useful nutrition decision today? It should not ask the model to notice something from scratch."
        />
      </SectionBlock>

      <SectionBlock icon={Gauge} title="Scoring And Guardrails">
        <DataTable columns={['Signal', 'Score / Rule', 'Effect']} rows={SCORING_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard title="Hard Guardrails" accent="red" body={<BulletList items={HARD_GUARDRAILS} />} />
          <InfoCard
            title="Soft Preference Rules"
            accent="amber"
            body={
              <BulletList
                items={[
                  'Prefer the smallest useful adjustment.',
                  'Prefer real logged foods, frequent foods, or approved food/action templates.',
                  'Prefer no_intervention when the user is close enough.',
                  'Acknowledge uncertainty when history is thin.',
                  'Avoid making every day feel like a correction.',
                ]}
              />
            }
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Sparkles} title="Nora Copy Layer">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Allowed Input"
            body={
              <BulletList
                items={[
                  'Fact ledger',
                  'Top one to three scored candidates',
                  'Allowed numbers',
                  'Allowed foods/actions',
                  'Goal and time context',
                  'Copy constraints and forbidden claims',
                ]}
              />
            }
          />
          <InfoCard
            title="Forbidden Behavior"
            accent="red"
            body={
              <BulletList
                items={[
                  'No independent calculations.',
                  'No invented food contributors.',
                  'No trend language beyond confidence gates.',
                  'No generic “be mindful” coaching.',
                  'No action outside the approved candidate/action set.',
                ]}
              />
            }
          />
        </CardGrid>
        <DataTable columns={['Output Field', 'Purpose', 'Example']} rows={OUTPUT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={RefreshCw} title="Regenerate Behavior">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard title="If Facts Changed" accent="green" body="Recompute the ledger and regenerate candidates before any copy changes." />
          <InfoCard title="If Facts Are Stable" accent="blue" body="Pick the next-best eligible candidate or a different angle such as timing, food driver, or tomorrow adjustment." />
          <InfoCard title="If No Better Candidate Exists" accent="amber" body="Return a clear message that this is still the most useful read from today’s data." />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Utensils} title="Personalization Rules">
        <DataTable columns={['Context', 'Action Bias']} rows={PERSONALIZATION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Brain} title="Cross-App Nutrition Context">
        <DataTable columns={['Consumer', 'Use Case', 'Contract']} rows={CROSS_APP_ROWS} />
        <InfoCard
          title="PulseCheck Future Contract"
          accent="purple"
          body="PulseCheck should consume nutrition as a source-aware context layer: macro consistency, fueling timing, recovery-relevant intake, supplement signals when available, goal direction, history coverage, and confidence. It should not treat nutrition data as diagnosis, medical instruction, or coach-visible certainty when provenance is weak."
        />
      </SectionBlock>

      <SectionBlock icon={ClipboardList} title="Implementation Checklist">
        <DataTable columns={['Phase', 'Checklist Item', 'Definition Of Done', 'Status']} rows={IMPLEMENTATION_CHECKLIST_ROWS} />
        <StepRail steps={PHASES} />
      </SectionBlock>

      <SectionBlock icon={CheckCircle2} title="Acceptance Criteria">
        <InfoCard title="A Shipped Insight Passes If..." accent="green" body={<BulletList items={ACCEPTANCE_CRITERIA} />} />
      </SectionBlock>
    </div>
  );
};

export default NutritionReasoningLayerSpecTab;
