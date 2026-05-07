export type MacroKey = 'calories' | 'protein' | 'carbs' | 'fat';
export type MacroUnit = 'kcal' | 'g';
export type NutritionInsightType =
  | 'status'
  | 'save_the_day'
  | 'tomorrow_adjustment'
  | 'pattern'
  | 'food_driver'
  | 'timing'
  | 'data_quality'
  | 'no_intervention';
export type NutritionConfidence = 'high' | 'medium' | 'low';
export type NutritionTimeContext = 'early_day' | 'mid_day' | 'late_day' | 'closed_day';
export type NutritionGoalContext = 'cut' | 'bulk' | 'recomp' | 'maintain' | 'athlete' | 'general';

export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealRecord {
  id?: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  createdAt: number;
  dayKey?: string;
  loggedTimeZoneIdentifier?: string;
}

export interface DayTotal extends MacroTotals {
  dayKey: string;
  mealCount: number;
}

export interface MacroGap {
  macro: MacroKey;
  label: string;
  unit: MacroUnit;
  actual: number;
  target: number;
  delta: number;
  direction: 'over' | 'under' | 'on_target';
}

export interface TimingBuckets {
  morning: MacroTotals;
  midday: MacroTotals;
  evening: MacroTotals;
  late: MacroTotals;
}

export interface TopContributor {
  macro: MacroKey;
  mealId?: string;
  mealName: string;
  amount: number;
  unit: MacroUnit;
}

export interface NutritionFactLedger {
  version: 'nutrition-reasoning-v1';
  date: string;
  timezone: string;
  generatedAtEpochMs: number;
  totals: MacroTotals;
  targets: MacroTotals | null;
  deltas: MacroGap[];
  mealCount: number;
  mealIds: string[];
  timingBuckets: TimingBuckets;
  topContributors: Partial<Record<MacroKey, TopContributor>>;
  history: {
    windowDays: number;
    loggedDays: number;
    unloggedDays: number;
    averages: MacroTotals | null;
    proteinHitDays: number | null;
    proteinHitThresholdPercent: number;
  };
  goalContext: NutritionGoalContext;
  timeContext: NutritionTimeContext;
  confidence: NutritionConfidence;
  dataGaps: string[];
  allowedNumbers: number[];
}

export interface CandidateInsight {
  id: string;
  type: NutritionInsightType;
  claim: string;
  evidence: string[];
  interpretation: string;
  recommendedAction: string;
  confidence: NutritionConfidence;
  allowedNumbers: number[];
  basePriority: number;
  score: number;
  scoreBreakdown: Array<{ label: string; value: number; reason: string }>;
  guardrails: GuardrailResult;
}

export interface GuardrailResult {
  passed: boolean;
  blockedReasons: string[];
  warnings: string[];
}

export interface ValidatedNutritionInsight {
  type: NutritionInsightType;
  title: string;
  fact: string;
  interpretation: string;
  action: string;
  confidenceNote: string | null;
  icon: string;
  points: string[];
  selectedCandidateId: string;
  rejectedCandidateIds: string[];
  validationTrace: GuardrailResult;
}

export interface NutritionContextSnapshot {
  userId?: string;
  date: string;
  timezone: string;
  ledger: NutritionFactLedger;
  selectedCandidate?: CandidateInsight;
  candidates: CandidateInsight[];
}

export interface BuildLedgerParams {
  date: string;
  timezone: string;
  hourLocal: number;
  meals: MealRecord[];
  target: MacroTotals | null;
  history: DayTotal[];
  frequentFoods: string[];
  goalDirection?: string;
  activityLevel?: string;
  generatedAtEpochMs?: number;
}

export interface BuildInsightParams {
  ledger: NutritionFactLedger;
  meals: MealRecord[];
  history: DayTotal[];
  frequentFoods: string[];
  previousCandidateId?: string;
  previousType?: string;
}

export const sumMeals = (meals: MealRecord[]): MacroTotals => meals.reduce((a, m) => ({
  calories: a.calories + m.calories,
  protein: a.protein + m.protein,
  carbs: a.carbs + m.carbs,
  fat: a.fat + m.fat,
}), { calories: 0, protein: 0, carbs: 0, fat: 0 });

const round = (value: number) => Math.round(Number.isFinite(value) ? value : 0);

const emptyTotals = (): MacroTotals => ({ calories: 0, protein: 0, carbs: 0, fat: 0 });

const macroUnit = (macro: MacroKey): MacroUnit => (macro === 'calories' ? 'kcal' : 'g');

const macroLabel = (macro: MacroKey) => (macro === 'calories' ? 'calories' : macro);

export const formatMacroAmount = (macro: MacroKey, value: number): string => (
  macro === 'calories' ? `${round(value)} kcal` : `${round(value)}g ${macroLabel(macro)}`
);

export const formatDelta = (gap: MacroGap): string => {
  const amount = Math.abs(round(gap.delta));
  if (gap.direction === 'on_target') return `${gap.label} on target`;
  if (gap.macro === 'calories') return `${amount} kcal ${gap.direction === 'over' ? 'over' : 'left'}`;
  return `${amount}g ${gap.label} ${gap.direction === 'over' ? 'over' : 'left'}`;
};

const macroGaps = (totals: MacroTotals, target: MacroTotals | null): MacroGap[] => {
  if (!target) return [];
  return (['calories', 'protein', 'carbs', 'fat'] as MacroKey[])
    .filter((macro) => target[macro] > 0)
    .map((macro) => {
      const delta = round(totals[macro] - target[macro]);
      return {
        macro,
        label: macroLabel(macro),
        unit: macroUnit(macro),
        actual: round(totals[macro]),
        target: round(target[macro]),
        delta,
        direction: delta === 0 ? 'on_target' : delta > 0 ? 'over' : 'under',
      };
    });
};

export const largestGap = (gaps: MacroGap[]): MacroGap | null => {
  if (gaps.length === 0) return null;
  return [...gaps].sort((a, b) => {
    const aRatio = a.target > 0 ? Math.abs(a.delta) / a.target : 0;
    const bRatio = b.target > 0 ? Math.abs(b.delta) / b.target : 0;
    return bRatio - aRatio;
  })[0];
};

const topMealForMacro = (meals: MealRecord[], macro: MacroKey): MealRecord | null => (
  [...meals].sort((a, b) => b[macro] - a[macro])[0] || null
);

const deriveGoalContext = (goalDirection?: string, activityLevel?: string): NutritionGoalContext => {
  const text = `${goalDirection || ''} ${activityLevel || ''}`.toLowerCase();
  if (text.includes('athlete')) return 'athlete';
  if (text.includes('bulk') || text.includes('gain')) return 'bulk';
  if (text.includes('cut') || text.includes('loss') || text.includes('lose')) return 'cut';
  if (text.includes('recomp')) return 'recomp';
  if (text.includes('maintain')) return 'maintain';
  return 'general';
};

const deriveTimeContext = (hourLocal: number): NutritionTimeContext => {
  if (hourLocal < 11) return 'early_day';
  if (hourLocal < 17) return 'mid_day';
  if (hourLocal < 21) return 'late_day';
  return 'closed_day';
};

const confidenceRank: Record<NutritionConfidence, number> = { high: 3, medium: 2, low: 1 };

const deriveConfidence = (mealCount: number, target: MacroTotals | null, loggedDays: number): NutritionConfidence => {
  if (mealCount > 0 && target && loggedDays >= 5) return 'high';
  if (mealCount > 0 && target) return 'medium';
  return 'low';
};

const buildTimingBuckets = (meals: MealRecord[], hourForMeal: (meal: MealRecord) => number): TimingBuckets => {
  const buckets: TimingBuckets = {
    morning: emptyTotals(),
    midday: emptyTotals(),
    evening: emptyTotals(),
    late: emptyTotals(),
  };

  for (const meal of meals) {
    const hour = hourForMeal(meal);
    const bucket = hour < 11 ? buckets.morning : hour < 16 ? buckets.midday : hour < 21 ? buckets.evening : buckets.late;
    bucket.calories += meal.calories;
    bucket.protein += meal.protein;
    bucket.carbs += meal.carbs;
    bucket.fat += meal.fat;
  }

  return buckets;
};

const buildAllowedNumbers = (params: {
  totals: MacroTotals;
  target: MacroTotals | null;
  gaps: MacroGap[];
  meals: MealRecord[];
  history: NutritionFactLedger['history'];
  timingBuckets: TimingBuckets;
}): number[] => {
  const allowed = new Set<number>([
    params.totals.calories,
    params.totals.protein,
    params.totals.carbs,
    params.totals.fat,
    params.meals.length,
    params.history.windowDays,
    params.history.loggedDays,
    params.history.unloggedDays,
  ]);

  if (params.target) {
    allowed.add(params.target.calories);
    allowed.add(params.target.protein);
    allowed.add(params.target.carbs);
    allowed.add(params.target.fat);
  }

  for (const gap of params.gaps) {
    allowed.add(gap.actual);
    allowed.add(gap.target);
    allowed.add(Math.abs(round(gap.delta)));
  }

  if (params.history.averages) {
    allowed.add(params.history.averages.calories);
    allowed.add(params.history.averages.protein);
    allowed.add(params.history.averages.carbs);
    allowed.add(params.history.averages.fat);
  }
  if (typeof params.history.proteinHitDays === 'number') {
    allowed.add(params.history.proteinHitDays);
    allowed.add(params.history.proteinHitThresholdPercent);
  }

  for (const bucket of Object.values(params.timingBuckets)) {
    allowed.add(bucket.calories);
    allowed.add(bucket.protein);
    allowed.add(bucket.carbs);
    allowed.add(bucket.fat);
  }

  return Array.from(allowed).filter((n) => Number.isFinite(n)).map(round).sort((a, b) => a - b);
};

export const buildNutritionFactLedger = (
  params: BuildLedgerParams,
  hourForMeal: (meal: MealRecord) => number,
): NutritionFactLedger => {
  const totals = sumMeals(params.meals);
  const deltas = macroGaps(totals, params.target);
  const timingBuckets = buildTimingBuckets(params.meals, hourForMeal);
  const historyWindowDays = 14;
  const historyWindow = params.history.slice(0, historyWindowDays);
  const loggedDays = historyWindow.length;
  const unloggedDays = Math.max(0, historyWindowDays - loggedDays);
  const proteinTarget = params.target?.protein || 0;
  const proteinHitDays = proteinTarget > 0
    ? historyWindow.filter((day) => day.protein >= proteinTarget * 0.92).length
    : null;

  const averages = loggedDays > 0 ? {
    calories: round(historyWindow.reduce((s, d) => s + d.calories, 0) / loggedDays),
    protein: round(historyWindow.reduce((s, d) => s + d.protein, 0) / loggedDays),
    carbs: round(historyWindow.reduce((s, d) => s + d.carbs, 0) / loggedDays),
    fat: round(historyWindow.reduce((s, d) => s + d.fat, 0) / loggedDays),
  } : null;

  const topContributors: Partial<Record<MacroKey, TopContributor>> = {};
  for (const macro of ['calories', 'protein', 'carbs', 'fat'] as MacroKey[]) {
    const meal = topMealForMacro(params.meals, macro);
    if (meal && meal[macro] > 0) {
      topContributors[macro] = {
        macro,
        mealId: meal.id,
        mealName: meal.name,
        amount: round(meal[macro]),
        unit: macroUnit(macro),
      };
    }
  }

  const dataGaps: string[] = [];
  if (!params.target) dataGaps.push('No macro target available.');
  if (params.meals.length === 0) dataGaps.push('No meals logged for this day.');
  if (loggedDays < 5) dataGaps.push('Fewer than 5 logged history days; pattern claims are disabled.');
  else if (loggedDays < 7) dataGaps.push('Fewer than 7 logged history days; strong trend language is disabled.');

  const history = {
    windowDays: historyWindowDays,
    loggedDays,
    unloggedDays,
    averages,
    proteinHitDays,
    proteinHitThresholdPercent: 92,
  };

  const allowedNumbers = buildAllowedNumbers({
    totals,
    target: params.target,
    gaps: deltas,
    meals: params.meals,
    history,
    timingBuckets,
  });

  return {
    version: 'nutrition-reasoning-v1',
    date: params.date,
    timezone: params.timezone,
    generatedAtEpochMs: params.generatedAtEpochMs || Date.now(),
    totals,
    targets: params.target,
    deltas,
    mealCount: params.meals.length,
    mealIds: params.meals.map((meal) => meal.id).filter((id): id is string => Boolean(id)),
    timingBuckets,
    topContributors,
    history,
    goalContext: deriveGoalContext(params.goalDirection, params.activityLevel),
    timeContext: deriveTimeContext(params.hourLocal),
    confidence: deriveConfidence(params.meals.length, params.target, loggedDays),
    dataGaps,
    allowedNumbers,
  };
};

const getGap = (ledger: NutritionFactLedger, macro: MacroKey) => ledger.deltas.find((gap) => gap.macro === macro);

const nearTarget = (ledger: NutritionFactLedger) => {
  if (!ledger.targets) return false;
  const calGap = Math.abs(getGap(ledger, 'calories')?.delta || 0);
  const proteinGap = Math.abs(getGap(ledger, 'protein')?.delta || 0);
  const carbsGap = Math.abs(getGap(ledger, 'carbs')?.delta || 0);
  const fatGap = Math.abs(getGap(ledger, 'fat')?.delta || 0);
  return calGap <= 100 && proteinGap <= 15 && carbsGap <= 20 && fatGap <= 8;
};

const conciseStatusFact = (ledger: NutritionFactLedger) => (
  ledger.targets
    ? `You are at ${ledger.totals.calories} kcal vs ${ledger.targets.calories}, with P${ledger.totals.protein}/C${ledger.totals.carbs}/F${ledger.totals.fat} across ${ledger.mealCount} meals.`
    : `You are at ${ledger.totals.calories} kcal with P${ledger.totals.protein}/C${ledger.totals.carbs}/F${ledger.totals.fat} across ${ledger.mealCount} meals.`
);

const actionForGap = (gap: MacroGap | null, ledger: NutritionFactLedger, frequentFoods: string[]): string => {
  const firstFrequent = frequentFoods[0];
  if (!gap) return 'Keep logging the same way tomorrow so Nora can compare like-for-like days.';
  const tomorrow = ledger.timeContext === 'closed_day';

  if (gap.direction === 'under') {
    if (gap.macro === 'protein') {
      return tomorrow
        ? 'Tomorrow, put a 25-35g protein anchor in your first two meals.'
        : 'Add a 25-35g protein anchor next, like egg whites, Greek yogurt, tuna, chicken, or whey.';
    }
    if (gap.macro === 'carbs') {
      return tomorrow
        ? 'Tomorrow, move one measured carb serving earlier instead of trying to catch up late.'
        : 'Add a measured carb serving next, like rice, oats, potatoes, fruit, or a rice cake.';
    }
    if (gap.macro === 'fat') {
      return tomorrow
        ? 'Tomorrow, add one small fat serving to a planned meal.'
        : 'Add a small fat serving next, like olive oil, avocado, nuts, or whole eggs.';
    }
    return tomorrow
      ? 'Tomorrow, add one planned calorie anchor earlier in the day.'
      : 'Add one planned calorie anchor next instead of grazing.';
  }

  const contributor = ledger.topContributors[gap.macro];
  if (gap.direction === 'over' && contributor) {
    return `Tomorrow, adjust "${contributor.mealName}" first; it was today's biggest ${gap.label} contributor.`;
  }
  if (firstFrequent) {
    return `Tomorrow, keep "${firstFrequent}" only if it still fits the macro gap after your first two meals.`;
  }
  return 'Tomorrow, trim the smallest add-on instead of cutting a full meal.';
};

const makeCandidate = (
  partial: Omit<CandidateInsight, 'score' | 'scoreBreakdown' | 'guardrails' | 'allowedNumbers'>,
  ledger: NutritionFactLedger,
): CandidateInsight => {
  const guardrails = validateCandidate(partial as CandidateInsight, ledger);
  const scored = scoreCandidate({
    ...(partial as CandidateInsight),
    allowedNumbers: ledger.allowedNumbers,
    score: 0,
    scoreBreakdown: [],
    guardrails,
  }, ledger);
  return scored;
};

export const validateCandidate = (
  candidate: Pick<CandidateInsight, 'type' | 'recommendedAction' | 'claim'>,
  ledger: NutritionFactLedger,
): GuardrailResult => {
  const blockedReasons: string[] = [];
  const warnings: string[] = [];
  const action = candidate.recommendedAction.toLowerCase();
  const proteinGap = getGap(ledger, 'protein');
  const carbGap = getGap(ledger, 'carbs');

  if ((candidate.type === 'pattern' || /\b(pattern|trend|rare|usually)\b/i.test(candidate.claim)) && ledger.history.loggedDays < 5) {
    blockedReasons.push('Pattern claim requires at least 5 logged history days.');
  }
  if (/\b(trend|rare|usually)\b/i.test(candidate.claim) && ledger.history.loggedDays < 7) {
    blockedReasons.push('Strong trend language requires at least 7 logged history days.');
  }
  if (ledger.timeContext === 'closed_day' && /\btonight|before bed|next meal tonight\b/i.test(candidate.recommendedAction)) {
    blockedReasons.push('Closed-day insight cannot tell the user to eat more tonight.');
  }
  if (carbGap?.direction === 'under' && /\b(save|cut|reduce|lower)\b.*\b(carbs?|rice|potato|oats?|fruit)\b/i.test(action)) {
    blockedReasons.push('Cannot reduce carbs when carbs are under target.');
  }
  if (proteinGap?.direction === 'under' && /\b(reduce|lower|skip|cut)\b.*\b(protein|egg|chicken|whey|fish|beef|yogurt)\b/i.test(action)) {
    blockedReasons.push('Cannot reduce protein when protein is under target.');
  }
  if (/\b(be mindful|balanced|eat better|consider improving|try harder)\b/i.test(candidate.recommendedAction)) {
    warnings.push('Action is vague and should be replaced.');
  }

  return { passed: blockedReasons.length === 0, blockedReasons, warnings };
};

export const scoreCandidate = (candidate: CandidateInsight, ledger: NutritionFactLedger): CandidateInsight => {
  const breakdown: Array<{ label: string; value: number; reason: string }> = [
    { label: 'basePriority', value: candidate.basePriority, reason: 'Candidate-specific starting priority.' },
  ];

  if (candidate.confidence === 'high') breakdown.push({ label: 'accuracyConfidence', value: 30, reason: 'Facts and coverage support this read.' });
  else if (candidate.confidence === 'medium') breakdown.push({ label: 'accuracyConfidence', value: 18, reason: 'Facts are usable but history coverage is limited.' });
  else breakdown.push({ label: 'accuracyConfidence', value: 6, reason: 'Sparse or incomplete nutrition context.' });

  if (candidate.type === 'no_intervention' && nearTarget(ledger)) breakdown.push({ label: 'goalRelevance', value: 20, reason: 'Avoiding overcorrection is the useful action.' });
  else if (ledger.goalContext !== 'general') breakdown.push({ label: 'goalRelevance', value: 18, reason: `Action can respect ${ledger.goalContext} context.` });
  else breakdown.push({ label: 'goalRelevance', value: 10, reason: 'General macro relevance.' });

  breakdown.push({ label: 'actionability', value: /\b(be mindful|balanced|consider)\b/i.test(candidate.recommendedAction) ? 4 : 20, reason: 'Specificity of next action.' });
  if (candidate.type === 'food_driver' && Object.keys(ledger.topContributors).length > 0) breakdown.push({ label: 'specificFood', value: 10, reason: 'A real top contributor can be named.' });
  if (candidate.type === 'pattern' && ledger.history.loggedDays >= 7) breakdown.push({ label: 'historySupport', value: 10, reason: 'Enough logged days for trend language.' });
  if (candidate.type === 'data_quality' && ledger.history.loggedDays < 5) breakdown.push({ label: 'dataQualityFit', value: 20, reason: 'Thin history makes coverage the honest read.' });
  if (candidate.type === 'save_the_day' && ledger.timeContext === 'closed_day') breakdown.push({ label: 'closedDayPenalty', value: -40, reason: 'Closed day should use tomorrow adjustment.' });
  if (candidate.type === 'tomorrow_adjustment' && ledger.timeContext === 'closed_day') breakdown.push({ label: 'closedDayFit', value: 15, reason: 'Day is closed, so tomorrow framing fits.' });
  if (candidate.type !== 'no_intervention' && nearTarget(ledger)) breakdown.push({ label: 'overdramaPenalty', value: -12, reason: 'Near-target days should avoid dramatic correction.' });
  if (!candidate.guardrails.passed) breakdown.push({ label: 'guardrailBlock', value: -999, reason: candidate.guardrails.blockedReasons.join(' ') });

  const score = breakdown.reduce((sum, item) => sum + item.value, 0);
  return { ...candidate, score, scoreBreakdown: breakdown };
};

export const generateCandidateInsights = (params: BuildInsightParams): CandidateInsight[] => {
  const { ledger, frequentFoods } = params;
  const candidates: CandidateInsight[] = [];
  const primaryGap = largestGap(ledger.deltas);
  const statusEvidence = [conciseStatusFact(ledger)];
  if (primaryGap) statusEvidence.push(formatDelta(primaryGap));

  candidates.push(makeCandidate({
    id: 'status-current-macro-position',
    type: 'status',
    claim: primaryGap ? `${formatDelta(primaryGap)} is the main macro read.` : `${ledger.totals.calories} kcal logged today.`,
    evidence: statusEvidence,
    interpretation: nearTarget(ledger)
      ? 'This is close enough that the useful coaching is restraint, not a dramatic correction.'
      : 'The useful read is where the day actually stands before changing anything.',
    recommendedAction: primaryGap ? actionForGap(primaryGap, ledger, frequentFoods) : 'Keep logging the same way tomorrow so Nora can compare like-for-like days.',
    confidence: ledger.confidence,
    basePriority: 25,
  }, ledger));

  if (nearTarget(ledger)) {
    candidates.push(makeCandidate({
      id: 'no-intervention-close-enough',
      type: 'no_intervention',
      claim: 'Targets are close enough that no major correction is needed.',
      evidence: statusEvidence,
      interpretation: 'The structure worked. The best move is to avoid turning a tiny miss into an unnecessary reset.',
      recommendedAction: 'Tomorrow, keep the same protein structure and only trim the smallest add-on if you want a tighter landing.',
      confidence: ledger.confidence,
      basePriority: 35,
    }, ledger));
  }

  if (primaryGap) {
    candidates.push(makeCandidate({
      id: ledger.timeContext === 'closed_day' ? 'tomorrow-primary-gap' : 'save-day-primary-gap',
      type: ledger.timeContext === 'closed_day' ? 'tomorrow_adjustment' : 'save_the_day',
      claim: `${formatDelta(primaryGap)} is the highest-leverage adjustment.`,
      evidence: [conciseStatusFact(ledger), formatDelta(primaryGap)],
      interpretation: primaryGap.direction === 'under'
        ? `The day is missing ${primaryGap.label}; the fix should be a planned add, not grazing.`
        : `The surplus is explainable; adjust the smallest driver rather than changing the whole plan.`,
      recommendedAction: actionForGap(primaryGap, ledger, frequentFoods),
      confidence: ledger.confidence,
      basePriority: 32,
    }, ledger));
  }

  const calorieContributor = ledger.topContributors.calories;
  if (calorieContributor && calorieContributor.amount >= Math.max(250, ledger.totals.calories * 0.22)) {
    candidates.push(makeCandidate({
      id: 'food-driver-calorie-contributor',
      type: 'food_driver',
      claim: `"${calorieContributor.mealName}" was today's biggest calorie driver.`,
      evidence: [`${calorieContributor.mealName}: ${calorieContributor.amount} kcal`, conciseStatusFact(ledger)],
      interpretation: 'When one meal drives the day, the cleanest adjustment is usually inside that meal.',
      recommendedAction: `Tomorrow, adjust "${calorieContributor.mealName}" first if you want to change the day without rebuilding everything.`,
      confidence: ledger.confidence,
      basePriority: 20,
    }, ledger));
  }

  const proteinLate = ledger.timingBuckets.evening.protein + ledger.timingBuckets.late.protein;
  if (ledger.totals.protein > 0 && proteinLate / ledger.totals.protein >= 0.65 && ledger.mealCount >= 3) {
    candidates.push(makeCandidate({
      id: 'timing-late-protein-load',
      type: 'timing',
      claim: `${proteinLate}g protein landed after midday.`,
      evidence: [`Evening + late protein: ${proteinLate}g`, `Total protein: ${ledger.totals.protein}g`],
      interpretation: 'The total can work, but late-loading makes the day harder to steer.',
      recommendedAction: 'Tomorrow, move one 25-35g protein anchor into breakfast or lunch.',
      confidence: ledger.confidence,
      basePriority: 18,
    }, ledger));
  }

  if (ledger.history.loggedDays >= 5 && ledger.history.averages) {
    const proteinHitDays = ledger.history.proteinHitDays ?? 0;
    candidates.push(makeCandidate({
      id: 'pattern-logged-day-protein-coverage',
      type: 'pattern',
      claim: `Across ${ledger.history.loggedDays} logged days, protein hit ${proteinHitDays}/${ledger.history.loggedDays}.`,
      evidence: [
        `${ledger.history.loggedDays} logged days in ${ledger.history.windowDays} days`,
        `${proteinHitDays}/${ledger.history.loggedDays} protein-hit days`,
        `Logged-day average: ${ledger.history.averages.calories} kcal, P${ledger.history.averages.protein}`,
      ],
      interpretation: 'This is a logged-day pattern only; it should not be described as a full-window average.',
      recommendedAction: 'Add 2-3 more fully logged days this week so Nora can spot patterns earlier.',
      confidence: ledger.history.loggedDays >= 7 ? 'high' : 'medium',
      basePriority: ledger.history.loggedDays >= 7 ? 18 : 8,
    }, ledger));
  } else {
    candidates.push(makeCandidate({
      id: 'data-quality-thin-history',
      type: 'data_quality',
      claim: `Only ${ledger.history.loggedDays}/${ledger.history.windowDays} recent days have usable logs.`,
      evidence: [`Logged days: ${ledger.history.loggedDays}`, `Unlogged days: ${ledger.history.unloggedDays}`],
      interpretation: 'The honest read is data coverage, not a nutrition trend.',
      recommendedAction: 'Fully log the next 2-3 days so Nora can compare patterns instead of guessing.',
      confidence: 'high',
      basePriority: ledger.history.loggedDays < 3 ? 28 : 12,
    }, ledger));
  }

  return candidates
    .filter((candidate) => candidate.guardrails.passed)
    .sort((a, b) => b.score - a.score);
};

export const selectCandidateInsight = (params: BuildInsightParams): {
  selected: CandidateInsight;
  candidates: CandidateInsight[];
  rejectedCandidateIds: string[];
} => {
  const candidates = generateCandidateInsights(params);
  if (candidates.length === 0) {
    const fallback = makeCandidate({
      id: 'status-fallback',
      type: 'status',
      claim: conciseStatusFact(params.ledger),
      evidence: [conciseStatusFact(params.ledger)],
      interpretation: 'This is the safest read from the available data.',
      recommendedAction: 'Keep logging meals consistently so Nora can produce stronger reads.',
      confidence: params.ledger.confidence,
      basePriority: 1,
    }, params.ledger);
    return { selected: fallback, candidates: [fallback], rejectedCandidateIds: [] };
  }

  const selected = candidates.find((candidate) => (
    candidate.id !== params.previousCandidateId && candidate.type !== params.previousType
  )) || candidates[0];

  return {
    selected,
    candidates,
    rejectedCandidateIds: candidates.filter((candidate) => candidate.id !== selected.id).map((candidate) => candidate.id),
  };
};

const unsupportedNumbers = (text: string, allowedNumbers: number[]): number[] => {
  const allowed = new Set(allowedNumbers.map(round));
  const nums = text.match(/\b\d+\b/g)?.map(Number) || [];
  return nums.filter((n) => n > 9 && !allowed.has(round(n)));
};

const generatedActionConflicts = (action: string, ledger: NutritionFactLedger): string[] => {
  const reasons: string[] = [];
  const lower = action.toLowerCase();
  const carbGap = getGap(ledger, 'carbs');
  const proteinGap = getGap(ledger, 'protein');
  if (ledger.timeContext === 'closed_day' && /\btonight|before bed|next meal tonight\b/i.test(action)) {
    reasons.push('Generated action uses tonight language after the day is closed.');
  }
  if (carbGap?.direction === 'under' && /\b(save|cut|reduce|lower)\b.*\b(carbs?|rice|potato|oats?|fruit)\b/i.test(lower)) {
    reasons.push('Generated action reduces carbs while carbs are under target.');
  }
  if (proteinGap?.direction === 'under' && /\b(reduce|lower|skip|cut)\b.*\b(protein|egg|chicken|whey|fish|beef|yogurt)\b/i.test(lower)) {
    reasons.push('Generated action reduces protein while protein is under target.');
  }
  if (/\b(be mindful|balanced|eat better|consider improving|try harder)\b/i.test(action)) {
    reasons.push('Generated action is vague.');
  }
  return reasons;
};

export const validateAndAssembleInsight = (params: {
  candidate: CandidateInsight;
  ledger: NutritionFactLedger;
  generated?: Partial<Pick<ValidatedNutritionInsight, 'title' | 'fact' | 'interpretation' | 'action' | 'confidenceNote'>>;
  rejectedCandidateIds: string[];
}): ValidatedNutritionInsight => {
  const blockedReasons: string[] = [];
  const warnings: string[] = [];

  const fallbackTitle = params.candidate.claim.length <= 42
    ? params.candidate.claim
    : params.candidate.type === 'no_intervention'
      ? 'Close enough; do not overcorrect'
      : params.candidate.type === 'data_quality'
        ? 'More logs needed for patterns'
        : (largestGap(params.ledger.deltas) ? formatDelta(largestGap(params.ledger.deltas)!).replace('left', 'remaining') : 'Nutrition read');

  let title = (params.generated?.title || fallbackTitle).trim().slice(0, 56);
  let fact = (params.generated?.fact || params.candidate.evidence[0] || conciseStatusFact(params.ledger)).trim();
  let interpretation = (params.generated?.interpretation || params.candidate.interpretation).trim();
  let action = (params.generated?.action || params.candidate.recommendedAction).trim();
  let confidenceNote = params.generated?.confidenceNote?.trim() || null;

  for (const field of [
    ['title', title],
    ['fact', fact],
    ['interpretation', interpretation],
    ['action', action],
    ['confidenceNote', confidenceNote || ''],
  ] as Array<[string, string]>) {
    const unsupported = unsupportedNumbers(field[1], params.candidate.allowedNumbers);
    if (unsupported.length > 0) {
      blockedReasons.push(`${field[0]} contains unsupported number(s): ${unsupported.join(', ')}.`);
    }
  }

  const actionConflicts = generatedActionConflicts(action, params.ledger);
  blockedReasons.push(...actionConflicts);

  if (blockedReasons.length > 0) {
    warnings.push('Generated copy was replaced with deterministic candidate copy.');
    title = fallbackTitle.slice(0, 56);
    fact = params.candidate.evidence[0] || conciseStatusFact(params.ledger);
    interpretation = params.candidate.interpretation;
    action = params.candidate.recommendedAction;
    confidenceNote = params.ledger.confidence === 'low' ? params.ledger.dataGaps[0] || 'Low-confidence nutrition read.' : null;
  }

  const points = [fact, interpretation, confidenceNote].filter((p): p is string => Boolean(p));

  return {
    type: params.candidate.type,
    title,
    fact,
    interpretation,
    action,
    confidenceNote,
    icon: iconForCandidateType(params.candidate.type),
    points,
    selectedCandidateId: params.candidate.id,
    rejectedCandidateIds: params.rejectedCandidateIds,
    validationTrace: {
      passed: blockedReasons.length === 0,
      blockedReasons,
      warnings,
    },
  };
};

export const iconForCandidateType = (type: NutritionInsightType): string => {
  switch (type) {
    case 'save_the_day': return 'bolt.fill';
    case 'tomorrow_adjustment': return 'arrow.right.circle.fill';
    case 'pattern': return 'chart.line.uptrend.xyaxis';
    case 'food_driver': return 'fork.knife.circle.fill';
    case 'timing': return 'clock.fill';
    case 'data_quality': return 'list.bullet.clipboard.fill';
    case 'no_intervention': return 'checkmark.seal.fill';
    case 'status':
    default:
      return 'chart.bar.fill';
  }
};
