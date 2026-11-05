const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateAthleteSurveyCadence: evaluate } = require('../../../netlify/functions/utils/athlete-survey-cadence');
const DAY = 86400000;
const START = Date.parse('2026-01-01T12:00:00Z');
const at = (day) => START + day * DAY;
const response = (day, kind = 'trust', stage = null) => ({
  id: `${kind}-${day}`, surveyKind: kind, submittedAtMs: at(day),
  metricPayload: stage ? { promptStage: stage } : null,
});
const schedule = (day, overrides = {}) => evaluate({
  nowMs: at(day), startMs: START, endMs: at(84), completedSessions: 3, ...overrides,
});
const trust = (state) => state.pendingPrompts.filter((prompt) => prompt.surveyKind === 'trust').map((prompt) => prompt.promptStage);

test('initial requires three completed sessions and does not recur after an answer', () => {
  assert.deepEqual(trust(schedule(5, { completedSessions: 2 })), []);
  assert.deepEqual(trust(schedule(5)), ['initial']);
  assert.deepEqual(schedule(5).pendingPrompts.map(p => p.surveyKind), ['trust']);
  assert.deepEqual(trust(schedule(35, { responses: [response(5)] })), []);
  assert.deepEqual(trust(schedule(-1)), []);
});

test('midpoint requires at least 56 days and respects exact 28-day spacing', () => {
  assert.deepEqual(trust(schedule(28, { endMs: at(55), responses: [response(0)] })), []);
  assert.deepEqual(trust(schedule(28, { endMs: at(56), responses: [response(0)] })), ['midpoint']);
  assert.deepEqual(trust(schedule(28, { endMs: at(56), responses: [response(7)] })), []);
  assert.deepEqual(trust(schedule(35, { endMs: at(56), responses: [response(7)] })), ['midpoint']);
});

test('one prompt takes precedence and midpoint cannot repeat after its cooldown', () => {
  assert.deepEqual(trust(schedule(42)), ['midpoint']);
  assert.deepEqual(trust(schedule(70, { responses: [response(42, 'trust', 'midpoint')] })), []);
  assert.deepEqual(trust(schedule(70, { responses: [response(42)] })), []);
});

test('endpoint uses a fixed recent-response window, preserving the actual response date', () => {
  const state = schedule(84, { responses: [response(60)] });
  assert.deepEqual(trust(state), []);
  assert.equal(state.surveyCoverage.trust.endpointUsesEarlierResponse, true);
  assert.equal(state.surveyCoverage.trust.endpointResponseSubmittedAtMs, at(60));
  assert.deepEqual(trust(schedule(100, { responses: [response(60)] })), []);
  assert.deepEqual(trust(schedule(84, { responses: [response(56)] })), []);
  assert.deepEqual(trust(schedule(84, { responses: [response(55)] })), ['endpoint']);
});

test('endpoint is one-time, expires after 28 days, and respects an earlier freeze', () => {
  assert.deepEqual(trust(schedule(100, { responses: [response(84)] })), []);
  assert.deepEqual(trust(schedule(111)), ['endpoint']);
  assert.deepEqual(trust(schedule(112)), []);
  const frozen = { endpointFrozen: true, frozenAtMs: at(20), responses: [response(5)] };
  assert.deepEqual(trust(schedule(20, frozen)), []);
  assert.deepEqual(trust(schedule(40, frozen)), []);
  assert.deepEqual(trust(schedule(90, { endMs: null, endpointFrozen: true })), []);
});

test('quarterly requires ongoing enrollment and recent activity, never an endpoint backlog', () => {
  const active = { ongoingActive: true, recentlyActive: true, responses: [response(84)] };
  assert.deepEqual(trust(schedule(173, active)), []);
  assert.deepEqual(trust(schedule(174, active)), ['quarterly']);
  assert.deepEqual(schedule(174, active).pendingPrompts.map(p => p.surveyKind), ['trust']);
  assert.deepEqual(trust(schedule(174, { ...active, ongoingActive: false })), []);
  assert.deepEqual(trust(schedule(174, { ...active, recentlyActive: false })), []);
  assert.deepEqual(trust(schedule(263, { ...active, responses: [response(174, 'trust', 'quarterly')] })), []);
  assert.deepEqual(trust(schedule(264, { ...active, responses: [response(174, 'trust', 'quarterly')] })), ['quarterly']);
});

test('open-ended enrollment supports initial then 90-day follow-up without invented milestones', () => {
  const open = { startMs: null, endMs: null, ongoingActive: true, recentlyActive: true };
  assert.deepEqual(trust(schedule(5, open)), ['initial']);
  assert.deepEqual(trust(schedule(94, { ...open, responses: [response(5)] })), []);
  assert.deepEqual(trust(schedule(95, { ...open, responses: [response(5)] })), ['quarterly']);
});

test('NPS completion is independent so partial submissions never re-request trust', () => {
  const state = schedule(42, { responses: [response(42, 'trust', 'midpoint')] });
  assert.deepEqual(state.pendingPrompts, [{ surveyKind: 'nps', promptStage: 'midpoint', promptReason: 'pilot_midpoint' }]);
  assert.deepEqual(schedule(70, { responses: [response(42), response(42, 'nps')] }).pendingPrompts, []);
});

test('future responses cannot satisfy a milestone or create a false ongoing anchor', () => {
  assert.deepEqual(trust(schedule(5, { responses: [response(6)] })), ['initial']);
});
