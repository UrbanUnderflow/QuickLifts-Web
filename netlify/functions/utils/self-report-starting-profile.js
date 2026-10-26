const FAMILIES = [
  'breathing_body_awareness', 'visualization', 'attention_cues', 'self_talk_reframing',
  'emotional_regulation', 'reflection_learning', 'belief_identity', 'coherence',
];
const FAMILIARITY = new Set(['new_to_me', 'heard_of_it', 'know_it', 'practiced_it', 'use_it']);
const ARCHETYPES = new Set(['invasion', 'net_racket', 'race', 'judged', 'stage', 'precision', 'combat', 'attempt', 'general']);
const text = value => typeof value === 'string' ? value.trim() : '';
function invalid(message) { const error = new Error(message); error.statusCode = 400; throw error; }

/** This is a self-report record, not a competency or cognitive-task assessment. */
function normalizeSelfReportStartingProfile(value) {
  if (value?.version !== 6 || value.assessmentKind !== 'self_report_starting_profile') invalid('Invalid starting profile version.');
  const familiarity = {};
  for (const family of FAMILIES) {
    const selection = value.familiarity?.[family];
    if (!FAMILIARITY.has(selection)) invalid('Invalid starting profile familiarity.');
    familiarity[family] = selection;
  }
  const answeredFamiliarity = value.answeredFamiliarity ?? [];
  if (!Array.isArray(answeredFamiliarity) || new Set(answeredFamiliarity).size !== answeredFamiliarity.length
      || answeredFamiliarity.some(family => !FAMILIES.includes(family))) invalid('Invalid answered familiarity fields.');
  // Project allowed fields; client-injected scores, claimed stages and challenge evidence are discarded.
  return {
    version: 6, assessmentKind: 'self_report_starting_profile',
    completedAt: Number.isFinite(value.completedAt) ? value.completedAt : Date.now(),
    source: text(value.source) || 'self-report-starting-profile',
    sportName: text(value.sportName) || null,
    sportArchetype: ARCHETYPES.has(value.sportArchetype) ? value.sportArchetype : 'general',
    familiarity, answeredFamiliarity,
  };
}
module.exports = { normalizeSelfReportStartingProfile };
