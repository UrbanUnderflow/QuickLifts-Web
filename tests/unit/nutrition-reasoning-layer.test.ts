import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNutritionFactLedger,
  generateCandidateInsights,
  selectCandidateInsight,
  validateAndAssembleInsight,
  type DayTotal,
  type MealRecord,
} from '../../netlify/functions/utils/nutritionReasoningLayer';

const hourForMeal = () => 18;

const meal = (overrides: Partial<MealRecord> = {}): MealRecord => ({
  id: 'meal-1',
  name: 'Chicken rice bowl',
  calories: 600,
  protein: 45,
  carbs: 60,
  fat: 15,
  createdAt: Date.UTC(2026, 4, 5, 22) / 1000,
  ...overrides,
});

const historyDay = (dayKey: string, protein = 120): DayTotal => ({
  dayKey,
  calories: 2100,
  protein,
  carbs: 210,
  fat: 70,
  mealCount: 4,
});

test('thin history creates an honest data_quality candidate', () => {
  const ledger = buildNutritionFactLedger({
    date: '2026-05-05',
    timezone: 'America/New_York',
    hourLocal: 18,
    meals: [meal()],
    target: { calories: 2200, protein: 180, carbs: 240, fat: 70 },
    history: [historyDay('2026-05-04')],
    frequentFoods: [],
  }, hourForMeal);

  const candidates = generateCandidateInsights({
    ledger,
    meals: [meal()],
    history: [historyDay('2026-05-04')],
    frequentFoods: [],
  });

  assert.ok(candidates.some((candidate) => candidate.type === 'data_quality'));
  assert.equal(candidates.some((candidate) => candidate.type === 'pattern'), false);
});

test('close enough days prioritize no_intervention', () => {
  const meals = [meal({ calories: 2242, protein: 309, carbs: 90, fat: 60 })];
  const history = Array.from({ length: 7 }, (_, index) => historyDay(`2026-04-${20 + index}`, 300));
  const ledger = buildNutritionFactLedger({
    date: '2026-05-05',
    timezone: 'America/New_York',
    hourLocal: 22,
    meals,
    target: { calories: 2178, protein: 296, carbs: 105, fat: 57 },
    history,
    frequentFoods: [],
  }, hourForMeal);

  const { selected } = selectCandidateInsight({ ledger, meals, history, frequentFoods: [] });

  assert.equal(selected.type, 'no_intervention');
});

test('validator replaces generated copy with unsupported numbers', () => {
  const meals = [meal({ calories: 2242, protein: 309, carbs: 90, fat: 60 })];
  const history = Array.from({ length: 7 }, (_, index) => historyDay(`2026-04-${20 + index}`, 300));
  const ledger = buildNutritionFactLedger({
    date: '2026-05-05',
    timezone: 'America/New_York',
    hourLocal: 22,
    meals,
    target: { calories: 2178, protein: 296, carbs: 105, fat: 57 },
    history,
    frequentFoods: [],
  }, hourForMeal);
  const { selected, rejectedCandidateIds } = selectCandidateInsight({ ledger, meals, history, frequentFoods: [] });

  const insight = validateAndAssembleInsight({
    candidate: selected,
    ledger,
    rejectedCandidateIds,
    generated: {
      title: '342g protein by tonight',
      fact: 'You are at 342g protein and 427 kcal over.',
      interpretation: 'This is a rare finish.',
      action: 'Cut rice tonight.',
      confidenceNote: null,
    },
  });

  assert.equal(insight.validationTrace.passed, false);
  assert.match(insight.fact, /2,242|2242|P309|309/);
  assert.doesNotMatch(insight.fact, /342|427/);
});

test('closed-day selection avoids save_the_day as the chosen candidate', () => {
  const meals = [meal({ calories: 1400, protein: 90, carbs: 100, fat: 45 })];
  const history = Array.from({ length: 7 }, (_, index) => historyDay(`2026-04-${20 + index}`, 170));
  const ledger = buildNutritionFactLedger({
    date: '2026-05-05',
    timezone: 'America/New_York',
    hourLocal: 22,
    meals,
    target: { calories: 2200, protein: 180, carbs: 240, fat: 70 },
    history,
    frequentFoods: [],
  }, hourForMeal);

  const { selected } = selectCandidateInsight({ ledger, meals, history, frequentFoods: [] });

  assert.notEqual(selected.type, 'save_the_day');
  assert.doesNotMatch(selected.recommendedAction, /tonight/i);
});
