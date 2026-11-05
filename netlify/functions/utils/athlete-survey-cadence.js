// Evidence-informed operating policy, not a validated scientific interval.
// See docs/research/athlete-trust-survey-cadence.md.
const DAY_MS = 24 * 60 * 60 * 1000;
const SURVEY_CADENCE_VERSION = 'trust_milestones_v2';
const SURVEY_PROMPT_COOLDOWN_DAYS = 28;

function evaluateAthleteSurveyCadence({
  nowMs, startMs = null, endMs = null, endpointFrozen = false,
  frozenAtMs = null, completedSessions = 0, responses = [],
  ongoingActive = false, recentlyActive = false,
}) {
  const validDate = (value) => Number.isFinite(value) && value > 0;
  const datedPilot = validDate(startMs) && validDate(endMs) && endMs > startMs;
  const midpointMs = datedPilot ? startMs + (endMs - startMs) / 2 : null;
  const endpointMs = endpointFrozen && validDate(frozenAtMs)
    ? Math.min(frozenAtMs, validDate(endMs) ? endMs : Infinity)
    : (validDate(endMs) ? endMs : null);
  const endpointEligible = endpointFrozen || (endpointMs !== null && nowMs >= endpointMs);
  const midpointEligible = datedPilot && endMs - startMs >= 56 * DAY_MS
    && nowMs >= midpointMs && !endpointEligible;
  const pendingPrompts = [];
  const coverage = {};

  for (const surveyKind of ['trust', 'nps']) {
    const history = responses.filter((response) => response.surveyKind === surveyKind
      && validDate(response.submittedAtMs) && response.submittedAtMs <= nowMs)
      .sort((a, b) => b.submittedAtMs - a.submittedAtMs);
    const latest = history[0];
    const coolingDown = latest && nowMs - latest.submittedAtMs < 28 * DAY_MS;
    const stageOf = (response) => response.metricPayload?.promptStage;
    const midpointResponse = history.find((response) => stageOf(response) === 'midpoint'
      || (midpointMs !== null && response.submittedAtMs >= midpointMs
        && (endpointMs === null || response.submittedAtMs < endpointMs)));
    // Compare with the fixed endpoint, never with a rolling "now - 28 days".
    const endpointResponse = endpointMs === null ? null : history.find((response) => (
      response.submittedAtMs >= endpointMs - 28 * DAY_MS
      && response.submittedAtMs < endpointMs + 28 * DAY_MS
      && stageOf(response) !== 'quarterly'
    ));
    coverage[surveyKind] = {
      midpointResponseId: midpointResponse?.id || null,
      endpointResponseId: endpointResponse?.id || null,
      endpointResponseSubmittedAtMs: endpointResponse?.submittedAtMs || null,
      endpointUsesEarlierResponse: Boolean(endpointResponse && endpointResponse.submittedAtMs < endpointMs),
    };
    let promptStage = null;
    let promptReason = null;
    if (validDate(startMs) && nowMs < startMs) continue;
    if (endpointEligible) {
      // A bounded endpoint window avoids collecting an old pilot endpoint months later.
      if (endpointMs !== null && nowMs >= endpointMs && nowMs < endpointMs + 28 * DAY_MS
        && !endpointResponse && !coolingDown) {
        promptStage = 'endpoint';
        promptReason = 'pilot_endpoint';
      } else if (surveyKind === 'trust' && endpointMs !== null
        && ongoingActive && recentlyActive
        && nowMs - Math.max(endpointMs, latest?.submittedAtMs || endpointMs) >= 90 * DAY_MS) {
        promptStage = 'quarterly';
        promptReason = 'active_use_quarterly';
      }
    } else if (midpointEligible && !midpointResponse && !coolingDown) {
      promptStage = 'midpoint';
      promptReason = 'pilot_midpoint';
    } else if (surveyKind === 'trust' && !latest && completedSessions >= 3) {
      promptStage = 'initial';
      promptReason = 'completed_session_threshold';
    } else if (surveyKind === 'trust' && !validDate(endMs) && !endpointFrozen && latest
      && ongoingActive && recentlyActive && nowMs - latest.submittedAtMs >= 90 * DAY_MS) {
      promptStage = 'quarterly';
      promptReason = 'active_use_quarterly';
    }
    if (promptStage) pendingPrompts.push({ surveyKind, promptStage, promptReason });
  }
  return {
    pendingPrompts, midpointEligible, endpointEligible, endpointAtMs: endpointMs,
    progressRatio: datedPilot ? Math.max(0, Math.min(1, (nowMs - startMs) / (endMs - startMs))) : null,
    promptCooldownDays: SURVEY_PROMPT_COOLDOWN_DAYS,
    cadenceVersion: SURVEY_CADENCE_VERSION,
    surveyCoverage: coverage,
  };
}

module.exports = { evaluateAthleteSurveyCadence, SURVEY_CADENCE_VERSION, SURVEY_PROMPT_COOLDOWN_DAYS };
