// PulseCheck Chat Function (MVP)
// - Accepts user message and optional conversationId
// - Loads minimal user context
// - Loads recent conversation messages
// - Calls OpenAI Chat Completions (requires OPEN_AI_SECRET_KEY)
// - Includes escalation classification for safety monitoring
// - Saves/updates conversation document in Firestore (conversations)

const { initializeFirebaseAdmin, admin, headers } = require('./config/firebase');
const { runtimeHelpers: pulseCheckSubmissionRuntime } = require('./submit-pulsecheck-checkin');

const SNAPSHOTS_COLLECTION = 'state-snapshots';
const CONVERSATION_SIGNAL_EVENTS_COLLECTION = 'conversation-derived-signal-events';
const VALID_ROUTING = new Set([
  'protocol_only',
  'sim_only',
  'trial_only',
  'protocol_then_sim',
  'sim_then_protocol',
  'defer_alternate_path',
]);
const VALID_PROTOCOL_CLASSES = new Set(['regulation', 'priming', 'recovery', 'none']);
const VALID_CONFIDENCE = new Set(['high', 'medium', 'low']);
const VALID_READINESS = new Set(['green', 'yellow', 'red']);
const MUTABLE_ASSIGNMENT_STATUSES = new Set(['assigned']);

// Escalation Tier enum values
const EscalationTier = {
  None: 0,
  MonitorOnly: 1,
  ElevatedRisk: 2,
  CriticalRisk: 3
};

// ============================================================================
// Mental assignment reminder onboarding (chat-driven preference capture)
// ============================================================================

function normalizeText(t) {
  return String(t || '').trim().toLowerCase();
}

function parseYesNo(text) {
  const t = normalizeText(text);
  if (!t) return null;
  if (/\b(yes|yeah|yep|sure|ok|okay|please do|do it|enable|turn on)\b/.test(t)) return 'yes';
  if (/\b(no|nope|nah|don't|do not|stop|disable|turn off)\b/.test(t)) return 'no';
  return null;
}

function parseTimeFromText(text) {
  const t = normalizeText(text);
  if (!t) return null;
  if (/\bnoon\b/.test(t)) return { hour: 12, minute: 0 };
  if (/\bmidnight\b/.test(t)) return { hour: 0, minute: 0 };

  // e.g. "7", "7pm", "7:30 pm", "19:15"
  const m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const ampm = m[3];

  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) return null;

  if (ampm) {
    if (hour < 1 || hour > 12) return null;
    if (ampm === 'pm' && hour !== 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
  } else {
    // 24h fallback
    if (hour < 0 || hour > 23) return null;
  }

  return { hour, minute };
}

function shouldUseSmartNoon(text) {
  const t = normalizeText(text);
  return /\b(you decide|you choose|whatever you think|best time|surprise me|up to you|pick for me)\b/.test(t);
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim())));
}

function appendUnique(values, additions) {
  return Array.from(new Set([...(Array.isArray(values) ? values : []), ...(Array.isArray(additions) ? additions : [])].filter(Boolean)));
}

function stripUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefinedDeep(entry)).filter((entry) => entry !== undefined);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((accumulator, [key, entry]) => {
      const cleaned = stripUndefinedDeep(entry);
      if (cleaned !== undefined) {
        accumulator[key] = cleaned;
      }
      return accumulator;
    }, {});
  }

  return value === undefined ? undefined : value;
}

function extractJsonObject(text) {
  if (!text || typeof text !== 'string') return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1));
      } catch (nestedError) {
        return null;
      }
    }
  }

  return null;
}

async function callOpenAiJson({ systemPrompt, userPayload }) {
  const apiKey = process.env.OPEN_AI_SECRET_KEY;
  if (!apiKey) return null;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 450,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`OpenAI request failed (${response.status}): ${errorText.slice(0, 240)}`);
  }

  const completion = await response.json();
  return extractJsonObject(completion?.choices?.[0]?.message?.content);
}

function deriveOverallReadiness({ readinessScore, dimensions }) {
  if (readinessScore >= 70 && dimensions.focusReadiness >= 65 && dimensions.cognitiveFatigue <= 45) return 'green';
  if (readinessScore < 45 || dimensions.cognitiveFatigue >= 70 || dimensions.emotionalLoad >= 70) return 'red';
  return 'yellow';
}

function deriveProtocolClass(dimensions) {
  if ((dimensions.cognitiveFatigue ?? 0) >= 70) return 'recovery';
  if ((dimensions.activation ?? 0) >= 65 || (dimensions.emotionalLoad ?? 0) >= 65) return 'regulation';
  if ((dimensions.focusReadiness ?? 0) <= 45) return 'priming';
  return 'none';
}

function buildCandidateHints({ routing, assignment }) {
  if (routing === 'trial_only') return ['trial'];
  if (routing === 'protocol_only') return ['protocol'];
  if (routing === 'protocol_then_sim' || routing === 'sim_then_protocol') return ['protocol', 'sim'];
  if (routing === 'defer_alternate_path') return ['protocol'];
  if (assignment?.actionType === 'protocol') return ['protocol'];
  if (assignment?.actionType === 'defer') return [];
  return ['sim'];
}

function buildReadinessScore(dimensions) {
  const focus = dimensions.focusReadiness ?? 50;
  const fatigue = dimensions.cognitiveFatigue ?? 50;
  const emotional = dimensions.emotionalLoad ?? 50;
  const activation = dimensions.activation ?? 50;
  return clamp(
    50
      + ((focus - 50) * 0.5)
      - ((fatigue - 50) * 0.35)
      - ((emotional - 50) * 0.2)
      + ((activation - 50) * 0.1)
  );
}

function messageMayContainStateSignal(message) {
  const t = normalizeText(message);
  if (!t || t.length < 6) return false;

  return /\b(sleep|slept|tired|drained|exhausted|fried|scattered|overwhelmed|anxious|anxiety|nervous|rattled|heavy|pressure|stressed|stress|panic|calm|calmer|better|good now|good now|ready|locked in|focused|settled|not up for it|not ready|burned out|burnt out|gassed|flat)\b/.test(t);
}

function buildFallbackAssignmentPreferenceSignalAnalysis({ message, snapshot, assignment }) {
  const text = normalizeText(message);
  if (!text || text.length < 4) {
    return null;
  }

  const isDeferredAssessment =
    String(assignment?.actionType || '') === 'defer'
    || String(assignment?.status || '') === 'deferred'
    || String(snapshot?.recommendedRouting || '') === 'defer_alternate_path';

  if (!isDeferredAssessment) {
    return null;
  }

  const indicatesPreference = /\b(like|want|prefer|interested in|sounds good|good idea|let'?s do|i'?m into|i am into)\b/.test(text);
  if (!indicatesPreference) {
    return null;
  }

  if (/\b(visuali[sz]ation|visuali[sz]e|imagery|mental rehearsal)\b/.test(text)) {
    return {
      shouldCreateEvent: true,
      confidence: 'medium',
      summary: 'The athlete explicitly asked for visualization support, which should steer today’s deferred alternate path toward a bounded priming protocol instead of leaving the task unresolved.',
      supportingEvidence: [
        'The athlete named visualization as the support lane they want today.',
        'Today is still in a deferred or alternate-path assessment state.',
      ],
      contradictionSummary: 'Latest chat message clarified the athlete’s preferred support modality for today’s alternate-path assignment.',
      contextTags: [
        'chat_signal_refresh',
        'athlete_preference_visualization',
        'visualization',
        'pre_training',
      ],
      dimensionDeltas: {
        activation: 0,
        focusReadiness: 0,
        emotionalLoad: 0,
        cognitiveFatigue: 0,
      },
      overallReadiness: snapshot?.overallReadiness || 'yellow',
      recommendedRouting: 'protocol_only',
      recommendedProtocolClass: 'priming',
      supportFlag: false,
      decisionSource: 'fallback_rules',
    };
  }

  return null;
}

function validateDeltaNumber(value) {
  return Number.isFinite(value) ? Math.max(-20, Math.min(20, Math.round(value))) : 0;
}

function buildFallbackConversationSignalAnalysis({ message, snapshot }) {
  const text = normalizeText(message);
  if (!messageMayContainStateSignal(text)) {
    return null;
  }

  const sleepSignal = /\b(sleep|slept|awake|insomnia)\b/.test(text);
  const lowSignal = /\b(drained|exhausted|fried|scattered|overwhelmed|anxious|nervous|rattled|heavy|not up for it|not ready|burned out|burnt out|gassed|flat|stressed|panic|pressure)\b/.test(text);
  const recoverySignal = /\b(calm|calmer|better|good now|ready|locked in|focused|settled)\b/.test(text);

  if (!lowSignal && !recoverySignal) {
    return null;
  }

  if (lowSignal) {
    const protocolClass = sleepSignal ? 'recovery' : 'regulation';
    const supportFlag = snapshot?.overallReadiness === 'red' || /\b(not up for it|panic|burned out|burnt out)\b/.test(text);
    return {
      shouldCreateEvent: true,
      confidence: sleepSignal ? 'high' : 'medium',
      summary: sleepSignal
        ? 'The athlete described a more depleted state than the current assignment posture, especially around sleep or recovery.'
        : 'The athlete described a more constrained state than the current assignment posture.',
      supportingEvidence: uniqueStrings([
        sleepSignal ? 'User described poor sleep or recovery drag.' : '',
        /\b(scattered|focused)\b/.test(text) ? 'User gave a direct focus-quality cue.' : '',
        /\b(anxious|nervous|rattled|pressure|panic)\b/.test(text) ? 'User described pressure or emotional load.' : '',
      ]),
      contradictionSummary: 'Latest chat message signals lower readiness than the current runtime posture.',
      contextTags: uniqueStrings([
        'chat_signal_refresh',
        'chat_correction',
        sleepSignal ? 'sleep_drag' : '',
        /\b(anxious|nervous|rattled|pressure|panic)\b/.test(text) ? 'pressure_load' : '',
      ]),
      dimensionDeltas: {
        activation: sleepSignal ? -8 : -4,
        focusReadiness: -10,
        emotionalLoad: /\b(anxious|nervous|rattled|pressure|panic)\b/.test(text) ? 14 : 8,
        cognitiveFatigue: sleepSignal ? 14 : 8,
      },
      overallReadiness: supportFlag ? 'red' : 'yellow',
      recommendedRouting: supportFlag ? 'defer_alternate_path' : 'protocol_only',
      recommendedProtocolClass: protocolClass,
      supportFlag,
      decisionSource: 'fallback_rules',
    };
  }

  return {
    shouldCreateEvent: true,
    confidence: 'medium',
    summary: 'The athlete described a more ready and settled state than the prior snapshot captured.',
    supportingEvidence: uniqueStrings([
      /\b(calm|calmer|settled)\b/.test(text) ? 'User reported calmer physiology.' : '',
      /\b(ready|locked in|focused|better|good now)\b/.test(text) ? 'User reported improved readiness.' : '',
    ]),
    contradictionSummary: 'Latest chat message signals stronger readiness than the prior constrained posture.',
    contextTags: ['chat_signal_refresh', 'chat_correction', 'readiness_rebound'],
    dimensionDeltas: {
      activation: 6,
      focusReadiness: 10,
      emotionalLoad: -10,
      cognitiveFatigue: -8,
    },
    overallReadiness: snapshot?.overallReadiness === 'red' ? 'yellow' : 'green',
    recommendedRouting: 'sim_only',
    recommendedProtocolClass: 'none',
    supportFlag: false,
    decisionSource: 'fallback_rules',
  };
}

async function getCurrentStateSnapshot(db, userId, todaysNoraAssignment) {
  const todayId = `${userId}_${new Date().toISOString().split('T')[0]}`;
  const directSnapshotId = todaysNoraAssignment?.sourceStateSnapshotId || todayId;
  const directSnap = await db.collection(SNAPSHOTS_COLLECTION).doc(directSnapshotId).get();
  if (directSnap.exists) {
    return { id: directSnap.id, ...(directSnap.data() || {}) };
  }

  const fallbackQuery = await db
    .collection(SNAPSHOTS_COLLECTION)
    .where('athleteId', '==', userId)
    .where('sourceDate', '==', todayId.split('_').slice(1).join('_'))
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get();
  if (fallbackQuery.empty) {
    return null;
  }

  const doc = fallbackQuery.docs[0];
  return { id: doc.id, ...(doc.data() || {}) };
}

async function deriveConversationSignalAnalysis({ message, recentMessages, snapshot, assignment }) {
  if (!snapshot) {
    return null;
  }

  const stateSignal = messageMayContainStateSignal(message);
  const preferenceSignal = buildFallbackAssignmentPreferenceSignalAnalysis({ message, snapshot, assignment });
  if (!stateSignal && !preferenceSignal) {
    return null;
  }

  if (preferenceSignal && !stateSignal) {
    return preferenceSignal;
  }

  const fallback = buildFallbackConversationSignalAnalysis({ message, snapshot }) || preferenceSignal;

  try {
    const raw = await callOpenAiJson({
      systemPrompt: [
        'You detect whether an athlete chat message creates a meaningful PulseCheck state correction for Nora.',
        'Return only valid JSON.',
        'Use only the provided evidence.',
        'Do not invent medical claims.',
        'Only create an event when the message materially updates readiness, fatigue, emotional load, focus, or assignment suitability.',
        'Allowed confidence: high, medium, low.',
        'Allowed readiness: green, yellow, red.',
        'Allowed routing: protocol_only, sim_only, trial_only, protocol_then_sim, sim_then_protocol, defer_alternate_path.',
        'Allowed protocolClass: regulation, priming, recovery, none.',
        'Dimension deltas must be integers from -20 to 20.',
        'JSON shape: {"shouldCreateEvent":false,"confidence":"medium","summary":"","supportingEvidence":[],"contradictionSummary":"","contextTags":[],"dimensionDeltas":{"activation":0,"focusReadiness":0,"emotionalLoad":0,"cognitiveFatigue":0},"overallReadiness":"yellow","recommendedRouting":"sim_only","recommendedProtocolClass":"none","supportFlag":false}',
      ].join(' '),
      userPayload: {
        latestUserMessage: message,
        recentMessages: Array.isArray(recentMessages) ? recentMessages.slice(-6) : [],
        currentStateSnapshot: snapshot,
        todaysAssignment: assignment || null,
      },
    });

    if (!raw || typeof raw !== 'object') {
      return fallback;
    }

    if (raw.shouldCreateEvent !== true) {
      return fallback;
    }

    const confidence = VALID_CONFIDENCE.has(raw.confidence) ? raw.confidence : (fallback?.confidence || 'medium');
    const overallReadiness = VALID_READINESS.has(raw.overallReadiness) ? raw.overallReadiness : (fallback?.overallReadiness || snapshot.overallReadiness || 'yellow');
    const recommendedRouting = VALID_ROUTING.has(raw.recommendedRouting)
      ? raw.recommendedRouting
      : (fallback?.recommendedRouting || snapshot.recommendedRouting || 'sim_only');
    const recommendedProtocolClass = VALID_PROTOCOL_CLASSES.has(raw.recommendedProtocolClass)
      ? raw.recommendedProtocolClass
      : (fallback?.recommendedProtocolClass || snapshot.recommendedProtocolClass || 'none');

    return {
      shouldCreateEvent: true,
      confidence,
      summary: typeof raw.summary === 'string' && raw.summary.trim()
        ? raw.summary.trim()
        : (fallback?.summary || 'Latest athlete chat message materially updated the current-day state posture.'),
      supportingEvidence: uniqueStrings(raw.supportingEvidence).length
        ? uniqueStrings(raw.supportingEvidence)
        : (fallback?.supportingEvidence || []),
      contradictionSummary: typeof raw.contradictionSummary === 'string' && raw.contradictionSummary.trim()
        ? raw.contradictionSummary.trim()
        : (fallback?.contradictionSummary || 'Latest athlete chat message changes the prior state interpretation.'),
      contextTags: uniqueStrings(raw.contextTags).length
        ? uniqueStrings(raw.contextTags)
        : (fallback?.contextTags || ['chat_signal_refresh']),
      dimensionDeltas: {
        activation: validateDeltaNumber(raw.dimensionDeltas?.activation),
        focusReadiness: validateDeltaNumber(raw.dimensionDeltas?.focusReadiness),
        emotionalLoad: validateDeltaNumber(raw.dimensionDeltas?.emotionalLoad),
        cognitiveFatigue: validateDeltaNumber(raw.dimensionDeltas?.cognitiveFatigue),
      },
      overallReadiness,
      recommendedRouting,
      recommendedProtocolClass,
      supportFlag: typeof raw.supportFlag === 'boolean' ? raw.supportFlag : (fallback?.supportFlag || false),
      decisionSource: 'ai',
    };
  } catch (error) {
    console.warn('[pulsecheck-chat] Conversation signal extraction fell back to runtime heuristics:', error?.message || error);
    return fallback;
  }
}

function refreshSnapshotFromConversationSignal({ snapshot, assignment, signalAnalysis, eventId, eventAt }) {
  if (!snapshot || !signalAnalysis?.shouldCreateEvent) {
    return null;
  }

  const currentDimensions = snapshot.stateDimensions || {
    activation: 50,
    focusReadiness: 50,
    emotionalLoad: 50,
    cognitiveFatigue: 50,
  };
  const deltas = signalAnalysis.dimensionDeltas || {};
  const nextDimensions = {
    activation: clamp((currentDimensions.activation || 50) + (deltas.activation || 0)),
    focusReadiness: clamp((currentDimensions.focusReadiness || 50) + (deltas.focusReadiness || 0)),
    emotionalLoad: clamp((currentDimensions.emotionalLoad || 50) + (deltas.emotionalLoad || 0)),
    cognitiveFatigue: clamp((currentDimensions.cognitiveFatigue || 50) + (deltas.cognitiveFatigue || 0)),
  };

  let nextReadinessScore = typeof snapshot.readinessScore === 'number'
    ? clamp(snapshot.readinessScore + ((deltas.focusReadiness || 0) * 0.45) - ((deltas.cognitiveFatigue || 0) * 0.3) - ((deltas.emotionalLoad || 0) * 0.2) + ((deltas.activation || 0) * 0.1))
    : buildReadinessScore(nextDimensions);

  if (signalAnalysis.overallReadiness === 'red') {
    nextReadinessScore = Math.min(nextReadinessScore, 42);
  } else if (signalAnalysis.overallReadiness === 'green') {
    nextReadinessScore = Math.max(nextReadinessScore, 72);
  } else {
    nextReadinessScore = clamp(nextReadinessScore, 45, 69);
  }

  const overallReadiness = signalAnalysis.overallReadiness || deriveOverallReadiness({
    readinessScore: nextReadinessScore,
    dimensions: nextDimensions,
  });
  const recommendedRouting = VALID_ROUTING.has(signalAnalysis.recommendedRouting)
    ? signalAnalysis.recommendedRouting
    : (snapshot.recommendedRouting || 'sim_only');
  const recommendedProtocolClass = VALID_PROTOCOL_CLASSES.has(signalAnalysis.recommendedProtocolClass)
    ? signalAnalysis.recommendedProtocolClass
    : (snapshot.recommendedProtocolClass || deriveProtocolClass(nextDimensions));
  const supportFlag = typeof signalAnalysis.supportFlag === 'boolean'
    ? signalAnalysis.supportFlag
    : Boolean(snapshot.supportFlag);
  const previousInterpretation = snapshot.enrichedInterpretation || {};
  const plannerNote = `Chat-derived correction: ${signalAnalysis.summary}`;

  return {
    ...snapshot,
    stateDimensions: nextDimensions,
    overallReadiness,
    confidence: signalAnalysis.confidence || snapshot.confidence || 'medium',
    freshness: 'current',
    sourcesUsed: appendUnique(snapshot.sourcesUsed, ['conversation_signal_runtime']),
    sourceEventIds: appendUnique(snapshot.sourceEventIds, [eventId]),
    contextTags: appendUnique(snapshot.contextTags, ['chat_signal_refresh', ...(signalAnalysis.contextTags || [])]),
    recommendedRouting,
    recommendedProtocolClass,
    candidateClassHints: buildCandidateHints({ routing: recommendedRouting, assignment }),
    readinessScore: nextReadinessScore,
    supportFlag,
    decisionSource: signalAnalysis.decisionSource || snapshot.decisionSource || 'fallback_rules',
    enrichedInterpretation: {
      summary: signalAnalysis.summary || previousInterpretation.summary || 'Latest athlete chat message updated the state snapshot.',
      likelyPrimaryFactor: previousInterpretation.likelyPrimaryFactor || 'mixed',
      supportingSignals: appendUnique(previousInterpretation.supportingSignals, signalAnalysis.supportingEvidence || []),
      contradictions: appendUnique(previousInterpretation.contradictions, signalAnalysis.contradictionSummary ? [signalAnalysis.contradictionSummary] : []),
      plannerNotes: appendUnique(previousInterpretation.plannerNotes, [plannerNote]),
      confidenceRationale:
        previousInterpretation.confidenceRationale
        || 'Nora incorporated a structured chat-derived signal into the current-day snapshot.',
      supportFlag,
      modelSource: signalAnalysis.decisionSource || previousInterpretation.modelSource || 'fallback_rules',
    },
    updatedAt: eventAt,
  };
}

function buildSnapshotContextSection(snapshot, conversationSignalEvent) {
  if (!snapshot) {
    return '';
  }

  const summary = snapshot.enrichedInterpretation?.summary || 'No enriched summary saved.';
  const plannerNotes = uniqueStrings(snapshot.enrichedInterpretation?.plannerNotes).slice(-2);
  const noteLines = plannerNotes.length ? `\n- Planner Notes: ${plannerNotes.join(' | ')}` : '';
  const correctionLine = conversationSignalEvent
    ? `\n- Latest Chat Correction: ${conversationSignalEvent.inferredDelta?.summary || 'A meaningful chat-derived state update was recorded just now.'}`
    : '';

  return `\n\n## Current State Snapshot:\n- Overall Readiness: ${snapshot.overallReadiness || 'unknown'}\n- Confidence: ${snapshot.confidence || 'medium'}\n- Routing Posture: ${snapshot.recommendedRouting || 'sim_only'}\n- Protocol Class Hint: ${snapshot.recommendedProtocolClass || 'none'}\n- Support Flag: ${snapshot.supportFlag ? 'true' : 'false'}\n- Snapshot Summary: ${summary}${noteLines}${correctionLine}\nRules:\n- Treat this as the latest runtime state estimate.\n- If a just-recorded chat correction makes the athlete meaningfully more constrained than the earlier assignment posture, do not push them into the heavier version of the task as if nothing changed.\n- Keep recommendations bounded and explain when the state seems to have shifted.`;
}

async function getActiveMentalAssignments(db, userId) {
  const snap = await db
    .collection('sim-assignments')
    .where('athleteUserId', '==', userId)
    .where('status', 'in', ['pending', 'in_progress'])
    .limit(5)
    .get();
  return snap.empty ? [] : snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function humanizeAssignmentField(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDailyAssignmentActionLabel(assignment) {
  if (!assignment) {
    return null;
  }

  if (assignment.actionType === 'defer') {
    return 'pause for today';
  }

  return (
    humanizeAssignmentField(assignment.simSpecId) ||
    humanizeAssignmentField(assignment.protocolLabel) ||
    humanizeAssignmentField(assignment.legacyExerciseId) ||
    humanizeAssignmentField(assignment.sessionType) ||
    (assignment.actionType === 'lighter_sim' ? 'lighter sim' : 'sim')
  );
}

const APPLE_REFERENCE_EPOCH_MS = Date.UTC(2001, 0, 1, 0, 0, 0, 0);

function normalizeConversationTimestampSeconds(timestampValue) {
  if (typeof timestampValue === 'number' && Number.isFinite(timestampValue)) {
    return timestampValue;
  }

  if (typeof timestampValue === 'string') {
    const parsed = Number(timestampValue);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (!timestampValue || typeof timestampValue !== 'object') {
    return null;
  }

  if (typeof timestampValue.toDate === 'function') {
    const dateValue = timestampValue.toDate();
    if (dateValue instanceof Date && Number.isFinite(dateValue.getTime())) {
      return dateValue.getTime() / 1000;
    }
  }

  const secondsCandidate = timestampValue.seconds ?? timestampValue._seconds;
  if (typeof secondsCandidate === 'number' && Number.isFinite(secondsCandidate)) {
    const nanosecondsCandidate = timestampValue.nanoseconds ?? timestampValue._nanoseconds;
    if (typeof nanosecondsCandidate === 'number' && Number.isFinite(nanosecondsCandidate)) {
      return secondsCandidate + (nanosecondsCandidate / 1e9);
    }
    return secondsCandidate;
  }

  return null;
}

function sourceDatesFromConversationTimestamp(timestampValue) {
  const timestampSeconds = normalizeConversationTimestampSeconds(timestampValue);
  if (timestampSeconds === null) {
    return [];
  }

  const candidateDates = [
    new Date(timestampSeconds * 1000),
    new Date(APPLE_REFERENCE_EPOCH_MS + (timestampSeconds * 1000)),
  ]
    .filter((value) => Number.isFinite(value.getTime()))
    .map((value) => value.toISOString().split('T')[0]);

  return Array.from(new Set(candidateDates));
}

function buildTodaysConversationMessages(conversation, sourceDate) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  return messages
    .filter((entry) => sourceDatesFromConversationTimestamp(entry?.timestamp).includes(sourceDate))
    .slice(-20);
}

async function getTodaysNoraAssignment(db, userId) {
  const todayId = `${userId}_${new Date().toISOString().split('T')[0]}`;
  const snap = await db.collection('pulsecheck-daily-assignments').doc(todayId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

async function getAthleteMentalProgress(db, userId) {
  const snap = await db.collection('athlete-mental-progress').doc(userId).get();
  if (!snap.exists) return null;
  return snap.data() || null;
}

async function recoverSnapshotFromSavedConversation({
  db,
  userId,
  sourceDate,
  snapshot,
  assignment,
}) {
  if (!db || !userId || !sourceDate || !snapshot) {
    return {
      applied: false,
      detail: 'Missing recovery context.',
    };
  }

  const conversationSnap = await db
    .collection('conversations')
    .where('userId', '==', userId)
    .get();

  const conversations = conversationSnap.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0));

  const conversation = conversations.find((entry) => buildTodaysConversationMessages(entry, sourceDate).length > 0);
  if (!conversation) {
    return {
      applied: false,
      detail: 'No saved Nora conversation from today was available.',
    };
  }

  const recentMessages = buildTodaysConversationMessages(conversation, sourceDate);
  const latestUserMessage = [...recentMessages].reverse().find((entry) =>
    entry?.isFromUser === true
    && typeof entry?.content === 'string'
    && entry.content.trim().length > 0
  );

  if (!latestUserMessage) {
    return {
      applied: false,
      detail: 'No saved athlete message from today was available for recovery.',
    };
  }

  const eventSnap = await db
    .collection(CONVERSATION_SIGNAL_EVENTS_COLLECTION)
    .where('athleteId', '==', userId)
    .where('sourceDate', '==', sourceDate)
    .get();
  const existingMessageIds = new Set(
    eventSnap.docs
      .map((docSnap) => docSnap.data()?.messageId)
      .filter((value) => typeof value === 'string' && value.trim())
  );

  const candidateUserMessages = [...recentMessages]
    .reverse()
    .filter((entry) =>
      entry?.isFromUser === true
      && typeof entry?.content === 'string'
      && entry.content.trim().length > 0
    );

  let selectedUserMessage = null;
  let signalAnalysis = null;

  for (const candidateUserMessage of candidateUserMessages) {
    if (existingMessageIds.has(candidateUserMessage.id)) {
      continue;
    }

    const candidateSignalAnalysis = await deriveConversationSignalAnalysis({
      message: candidateUserMessage.content,
      recentMessages,
      snapshot,
      assignment,
    });

    if (candidateSignalAnalysis?.shouldCreateEvent) {
      selectedUserMessage = candidateUserMessage;
      signalAnalysis = candidateSignalAnalysis;
      break;
    }
  }

  if (!signalAnalysis?.shouldCreateEvent) {
    if (existingMessageIds.has(latestUserMessage.id)) {
      return {
        applied: false,
        detail: 'Latest saved Nora conversation signal was already applied.',
        conversationId: conversation.id,
        messageId: latestUserMessage.id,
      };
    }

    return {
      applied: false,
      detail: 'Saved Nora conversation did not contain a material assignment signal.',
      conversationId: conversation.id,
      messageId: latestUserMessage.id,
    };
  }

  const eventRef = db.collection(CONVERSATION_SIGNAL_EVENTS_COLLECTION).doc();
  const eventAt = Date.now();
  const refreshedSnapshot = refreshSnapshotFromConversationSignal({
    snapshot,
    assignment,
    signalAnalysis,
    eventId: eventRef.id,
    eventAt,
  });

  if (!refreshedSnapshot) {
    return {
      applied: false,
      detail: 'Conversation recovery could not refresh the current snapshot.',
      conversationId: conversation.id,
      messageId: latestUserMessage.id,
    };
  }

  const conversationSignalEvent = {
    id: eventRef.id,
    athleteId: userId,
    conversationId: conversation.id,
    messageId: selectedUserMessage.id,
    sourceDate,
    sourceAssignmentId: assignment?.id,
    sourceStateSnapshotId: snapshot.id,
    supersedesSnapshotId: snapshot.id,
    confidence: signalAnalysis.confidence || snapshot.confidence || 'medium',
    inferredDelta: {
      activationDelta: signalAnalysis.dimensionDeltas?.activation || 0,
      focusReadinessDelta: signalAnalysis.dimensionDeltas?.focusReadiness || 0,
      emotionalLoadDelta: signalAnalysis.dimensionDeltas?.emotionalLoad || 0,
      cognitiveFatigueDelta: signalAnalysis.dimensionDeltas?.cognitiveFatigue || 0,
      overallReadiness: signalAnalysis.overallReadiness,
      recommendedRouting: signalAnalysis.recommendedRouting,
      recommendedProtocolClass: signalAnalysis.recommendedProtocolClass,
      supportFlag: signalAnalysis.supportFlag,
      summary: signalAnalysis.summary,
      contradictionSummary: signalAnalysis.contradictionSummary,
      supportingEvidence: signalAnalysis.supportingEvidence || [],
      contextTags: signalAnalysis.contextTags || [],
    },
    eventAt,
    createdAt: eventAt,
    decisionSource: signalAnalysis.decisionSource || 'fallback_rules',
  };

  await Promise.all([
    eventRef.set(stripUndefinedDeep(conversationSignalEvent)),
    db.collection(SNAPSHOTS_COLLECTION).doc(snapshot.id).set(stripUndefinedDeep(refreshedSnapshot), { merge: true }),
  ]);

  return {
    applied: true,
    detail: 'Recovered today’s assignment context from the saved Nora conversation.',
    conversationId: conversation.id,
    messageId: selectedUserMessage.id,
    conversationSignalEvent,
    stateSnapshot: refreshedSnapshot,
  };
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Initialize Firebase Admin
    let db;
    try {
      initializeFirebaseAdmin({ headers: event.headers || {} });
      // Get fresh db reference after initialization
      db = admin.firestore();
    } catch (firebaseInitError) {
      console.error('[pulsecheck-chat] Firebase initialization error:', firebaseInitError);
      return { 
        statusCode: 500, 
        headers, 
        body: JSON.stringify({ error: 'Firebase initialization failed', detail: firebaseInitError.message }) 
      };
    }

    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (parseError) {
      console.error('[pulsecheck-chat] JSON parse error:', parseError);
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: 'Invalid JSON in request body' }) 
      };
    }
    const { 
      userId, 
      message, 
      conversationId, 
      skipEscalation = false,
      systemPromptContext, // DEPRECATED: iOS used to send full prompt, now sends raw data
      userContext,         // Optional: iOS sends structured user context
      healthContext,       // Optional: iOS sends health data from HealthKit
      lastNoraResponseLength, // Optional: For turn-taking detection
      recentMessages: clientRecentMessages, // Optional: iOS may send its own recent messages
      coachDirective // Optional: iOS can send a bounded coaching directive for this turn
    } = body;

    if (!userId || !message) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing userId or message' }) };
    }

    // Always load user doc for preferences (even if iOS provides userContext)
    let userSnapForPrefs = null;
    let userDataForPrefs = {};
    try {
      userSnapForPrefs = await db.collection('users').doc(userId).get();
      userDataForPrefs = userSnapForPrefs.exists ? (userSnapForPrefs.data() || {}) : {};
    } catch (e) {
      console.error('[pulsecheck-chat] Error loading user prefs:', e);
      userDataForPrefs = {};
    }

    // Load user context from Firestore (unless client provided it)
    let displayName, sport, goals;
    
    if (userContext) {
      // Use client-provided context (iOS sends this with health data)
      displayName = userContext.name || 'Athlete';
      sport = userContext.sport || '';
      goals = Array.isArray(userContext.goals) ? userContext.goals : [];
    } else {
      // Load from Firestore
      try {
        const userData = userDataForPrefs || {};
        displayName = userData.displayName || userData.username || 'Athlete';
        sport = userData.primarySport || '';
        goals = Array.isArray(userData.goals) ? userData.goals : [];
      } catch (userLoadError) {
        console.error('[pulsecheck-chat] Error loading user data:', userLoadError);
        // Use defaults if user load fails
        displayName = 'Athlete';
        sport = '';
        goals = [];
      }
    }

    // Load existing conversation (if provided)
    let convoRef = null;
    let convo = null;

    if (conversationId) {
      convoRef = db.collection('conversations').doc(conversationId);
      const doc = await convoRef.get();
      if (doc.exists) convo = doc.data();
    }

    if (!convo) {
      // Get most recent conversation for this user
      try {
        const snap = await db
          .collection('conversations')
          .where('userId', '==', userId)
          .orderBy('updatedAt', 'desc')
          .limit(1)
          .get();
        if (!snap.empty) {
          convoRef = snap.docs[0].ref;
          convo = snap.docs[0].data();
        }
      } catch (convoQueryError) {
        console.error('[pulsecheck-chat] Error querying conversations:', convoQueryError);
        // Continue without existing conversation - will create new one
        convoRef = null;
        convo = null;
      }
    }

    if (!convoRef) {
      convoRef = db.collection('conversations').doc();
    }

    // Build recent message history
    // Prefer client-provided messages (iOS sends these), fall back to Firestore conversation
    let recentMessages;
    if (Array.isArray(clientRecentMessages) && clientRecentMessages.length > 0) {
      // iOS client provided recent messages (includes local context)
      recentMessages = clientRecentMessages.slice(-20);
      console.log('[pulsecheck-chat] Using client-provided recent messages:', recentMessages.length);
    } else {
      // Use Firestore conversation (web clients)
      recentMessages = Array.isArray(convo?.messages) ? convo.messages.slice(-20) : [];
    }

    let todaysNoraAssignment = null;
    let athleteMentalProgress = null;
    let currentStateSnapshot = null;
    let conversationSignalEvent = null;
    let assignmentRefreshApplied = false;
    try {
      [todaysNoraAssignment, athleteMentalProgress] = await Promise.all([
        getTodaysNoraAssignment(db, userId),
        getAthleteMentalProgress(db, userId),
      ]);
      currentStateSnapshot = await getCurrentStateSnapshot(db, userId, todaysNoraAssignment);
    } catch (contextError) {
      console.warn('[pulsecheck-chat] Failed to load Nora assignment context (non-blocking):', contextError?.message || contextError);
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const userMsg = {
      id: cryptoRandomId(),
      content: message,
      isFromUser: true,
      timestamp: nowSec,
      messageType: 'text'
    };
    let newConvoId = conversationId || convo?.id || convoRef.id;

    try {
      const signalAnalysis = await deriveConversationSignalAnalysis({
        message,
        recentMessages,
        snapshot: currentStateSnapshot,
        assignment: todaysNoraAssignment,
      });

      if (signalAnalysis?.shouldCreateEvent && currentStateSnapshot) {
        const eventRef = db.collection(CONVERSATION_SIGNAL_EVENTS_COLLECTION).doc();
        const eventAt = Date.now();
        const refreshedSnapshot = refreshSnapshotFromConversationSignal({
          snapshot: currentStateSnapshot,
          assignment: todaysNoraAssignment,
          signalAnalysis,
          eventId: eventRef.id,
          eventAt,
        });

        if (refreshedSnapshot) {
          conversationSignalEvent = {
            id: eventRef.id,
            athleteId: userId,
            conversationId: newConvoId,
            messageId: userMsg.id,
            sourceDate: currentStateSnapshot.sourceDate || new Date().toISOString().split('T')[0],
            sourceAssignmentId: todaysNoraAssignment?.id,
            sourceStateSnapshotId: currentStateSnapshot.id,
            supersedesSnapshotId: currentStateSnapshot.id,
            confidence: signalAnalysis.confidence || currentStateSnapshot.confidence || 'medium',
            inferredDelta: {
              activationDelta: signalAnalysis.dimensionDeltas?.activation || 0,
              focusReadinessDelta: signalAnalysis.dimensionDeltas?.focusReadiness || 0,
              emotionalLoadDelta: signalAnalysis.dimensionDeltas?.emotionalLoad || 0,
              cognitiveFatigueDelta: signalAnalysis.dimensionDeltas?.cognitiveFatigue || 0,
              overallReadiness: signalAnalysis.overallReadiness,
              recommendedRouting: signalAnalysis.recommendedRouting,
              recommendedProtocolClass: signalAnalysis.recommendedProtocolClass,
              supportFlag: signalAnalysis.supportFlag,
              summary: signalAnalysis.summary,
              contradictionSummary: signalAnalysis.contradictionSummary,
              supportingEvidence: signalAnalysis.supportingEvidence || [],
              contextTags: signalAnalysis.contextTags || [],
            },
            eventAt,
            createdAt: eventAt,
            decisionSource: signalAnalysis.decisionSource || 'fallback_rules',
          };

          await Promise.all([
            eventRef.set(stripUndefinedDeep(conversationSignalEvent)),
            db.collection(SNAPSHOTS_COLLECTION).doc(currentStateSnapshot.id).set(stripUndefinedDeep(refreshedSnapshot), { merge: true }),
          ]);
          currentStateSnapshot = refreshedSnapshot;

          const assignmentStatus = String(todaysNoraAssignment?.status || '');
          const assignmentActionType = String(todaysNoraAssignment?.actionType || '');
          const canRefreshCurrentAssignment =
            !todaysNoraAssignment
            || MUTABLE_ASSIGNMENT_STATUSES.has(assignmentStatus)
            || assignmentStatus === 'deferred'
            || assignmentActionType === 'defer';

          if (canRefreshCurrentAssignment
            && athleteMentalProgress?.activeProgram) {
            const priorAssignment = todaysNoraAssignment;
            const rematerialized = await pulseCheckSubmissionRuntime.rematerializeAssignmentFromSnapshot({
              db,
              athleteId: userId,
              sourceCheckInId:
                priorAssignment?.sourceCheckInId
                || currentStateSnapshot.sourceCheckInId
                || currentStateSnapshot.rawSignalSummary?.explicitSelfReport?.id
                || '',
              sourceStateSnapshotId: currentStateSnapshot.id,
              sourceDate: currentStateSnapshot.sourceDate || new Date().toISOString().split('T')[0],
              timezone: priorAssignment?.timezone,
              progress: athleteMentalProgress,
            });

            if (rematerialized?.dailyAssignment) {
              todaysNoraAssignment = rematerialized.dailyAssignment;
              currentStateSnapshot = rematerialized.stateSnapshot || currentStateSnapshot;
              assignmentRefreshApplied =
                !priorAssignment
                || priorAssignment.actionType !== rematerialized.dailyAssignment.actionType
                || priorAssignment.chosenCandidateId !== rematerialized.dailyAssignment.chosenCandidateId
                || priorAssignment.rationale !== rematerialized.dailyAssignment.rationale
                || priorAssignment.status !== rematerialized.dailyAssignment.status
                || priorAssignment.sourceStateSnapshotId !== rematerialized.dailyAssignment.sourceStateSnapshotId
                || priorAssignment.updatedAt !== rematerialized.dailyAssignment.updatedAt;
            }
          }
        }
      }
    } catch (signalError) {
      console.warn('[pulsecheck-chat] Chat-derived signal refresh failed (non-blocking):', signalError?.message || signalError);
    }

    // =========================================================================
    // Response Context Detection (for natural conversation flow)
    // =========================================================================
    
    function classifyResponseContext(userMessage, lastNoraResponseLength) {
      const lowercased = userMessage.toLowerCase();
      const wordCount = userMessage.split(/\s+/).filter(w => w.length > 0).length;
      
      // 1. TURN-TAKING: If Nora just gave a long response (100+ words), keep this one shorter
      if (lastNoraResponseLength && lastNoraResponseLength > 100) {
        return {
          context: 'turnTaking',
          wordRange: { min: 40, max: 80 },
          maxTokens: 220
        };
      }
      
      // 2. TEACHING: User asking "how", "what should I", "why", "explain", etc.
      const teachingIndicators = [
        'how do i', 'how can i', 'how should i',
        'what should', 'what can i do',
        'why do i', 'why does', 'why is',
        'explain', 'help me understand',
        'what\'s the best way', 'any tips',
        'advice on', 'advice for',
        'what would you recommend', 'what do you suggest'
      ];
      if (teachingIndicators.some(indicator => lowercased.includes(indicator))) {
        return {
          context: 'teaching',
          wordRange: { min: 100, max: 200 },
          maxTokens: 450
        };
      }
      
      // 3. QUICK EXCHANGE: User sent a very short message (<15 words)
      if (wordCount < 15) {
        const shortQuestionIndicators = ['?', 'what', 'how', 'why', 'when', 'where', 'who'];
        const isQuestion = shortQuestionIndicators.some(ind => lowercased.includes(ind));
        
        // Short questions might need teaching, not quick exchange
        if (isQuestion && teachingIndicators.some(indicator => lowercased.includes(indicator))) {
          return {
            context: 'teaching',
            wordRange: { min: 100, max: 200 },
            maxTokens: 450
          };
        }
        
        return {
          context: 'quickExchange',
          wordRange: { min: 30, max: 50 },
          maxTokens: 150
        };
      }
      
      // 4. LISTENING: User sharing deeply (long message OR emotional content)
      const emotionalIndicators = [
        'i feel', 'i\'m feeling', 'feeling like',
        'struggling', 'overwhelmed', 'stressed',
        'disappointed', 'frustrated', 'anxious',
        'worried', 'scared', 'nervous',
        'not my best', 'hard time', 'difficult'
      ];
      const isEmotionalShare = emotionalIndicators.some(ind => lowercased.includes(ind));
      
      if (wordCount > 80 || isEmotionalShare) {
        return {
          context: 'listening',
          wordRange: { min: 30, max: 60 },
          maxTokens: 180
        };
      }
      
      // 5. STANDARD: Default balanced conversation
      return {
        context: 'standard',
        wordRange: { min: 60, max: 100 },
        maxTokens: 280
      };
    }
    
    // Detect response context
    const responseContext = classifyResponseContext(message, lastNoraResponseLength);
    console.log(`[pulsecheck-chat] Response context: ${responseContext.context}, word range: ${responseContext.wordRange.min}-${responseContext.wordRange.max}`);
    
    // =========================================================================
    // Build System Prompt (centralized for both iOS and web)
    // =========================================================================
    
    const basePersona = `You are **Nora**, an elite AI mental performance coach. Your workout data now talks back.

Tone ▸ Warm, intellectually sharp, quietly confident.

Conversation Style ▸ 
- Respond naturally like a real person in conversation
- Match the user's energy: short messages get short responses, deep questions get thorough answers
- When they share deeply or emotionally, validate briefly and give them space to continue
- When they ask questions or need explanation, provide thorough guidance
- After you give a long response, keep the next one shorter (take turns in conversation)

Approach ▸ Active-listening → concise reflection → actionable insight when appropriate.
Style ▸ Use the athlete's first name. No clichés or filler. Be genuine and present.
Don'ts ▸ Never repeat a question they already answered. Never apologize unless a real mistake.`;

    // Build user context section
    let userContextSection = `## User Context:\n- Name: ${displayName}`;
    if (sport) userContextSection += `\n- Sport/Activity: ${sport}`;
    if (userContext?.mood) userContextSection += `\n- Current Mood: ${userContext.mood}/10`;
    if (goals.length) userContextSection += `\n- Mental Performance Goals: ${goals.join(', ')}`;
    
    // Add health context if provided (iOS sends this from HealthKit)
    let healthContextSection = '';
    if (healthContext) {
      healthContextSection = `\n\n## Health & Fitness Context:\n${healthContext}\n\nUse this health data to provide personalized insights and recommendations. Reference specific patterns, trends, and achievements when relevant to the conversation. Be encouraging about positive trends and supportive about areas for improvement.`;
    }

    let assignmentContextSection = '';
    if (todaysNoraAssignment) {
      const assignmentAction = getDailyAssignmentActionLabel(todaysNoraAssignment) || 'nora task';
      assignmentContextSection = `\n\n## Today's Nora Assignment (Execution Truth):\n- Status: ${todaysNoraAssignment.status || 'assigned'}\n- Action: ${assignmentAction}\n- Rationale: ${todaysNoraAssignment.rationale || 'No rationale saved.'}`;

      if (todaysNoraAssignment.readinessBand) {
        assignmentContextSection += `\n- Readiness Band: ${todaysNoraAssignment.readinessBand}`;
      }
      if (todaysNoraAssignment.sourceDate) {
        assignmentContextSection += `\n- Source Date: ${todaysNoraAssignment.sourceDate}`;
      }

      assignmentContextSection += `\nRules:\n- Treat this assignment as the source of truth for today's performance task.\n- If the status is deferred, superseded, or coach-adjusted, do not speak as if the original task is still active.\n- If the athlete asks what they should do today, anchor your answer to this assignment before offering broader coaching context.\n- When naming today's rep, use this saved task or a plain-language paraphrase of the same saved task.\n- Do not invent a different assignment unless you clearly frame it as separate brainstorming and not the active task.`;
      if (conversationSignalEvent && !['started', 'completed', 'deferred', 'overridden', 'superseded'].includes(todaysNoraAssignment.status || '')) {
        assignmentContextSection += assignmentRefreshApplied
          ? `\n- A newer chat-derived signal refreshed both the state snapshot and the current mutable assignment. Speak to the updated task, not the stale one.`
          : `\n- A newer chat-derived signal just refreshed the state snapshot. If that newer evidence makes the athlete more constrained than the original assignment posture, acknowledge the shift and keep the immediate next step bounded instead of pushing the heavier version of the task.`;
      }
    } else if (athleteMentalProgress?.activeProgram) {
      const activeProgram = athleteMentalProgress.activeProgram;
      const recommendedAction =
        humanizeAssignmentField(activeProgram.recommendedSimId) ||
        humanizeAssignmentField(activeProgram.recommendedLegacyExerciseId) ||
        humanizeAssignmentField(activeProgram.sessionType) ||
        'next best rep';

      assignmentContextSection = `\n\n## Current Program Recommendation (No Daily Task Materialized Yet):\n- Recommended Focus: ${recommendedAction}\n- Rationale: ${activeProgram.rationale || 'No rationale saved.'}\nRules:\n- This is recommendation context, not a confirmed assigned task.\n- If the athlete asks what is assigned today, be honest that no daily Nora task is materialized yet.\n- Do not invent a branded drill, sim, or protocol name that is not present in the runtime recommendation context.`;
    }
    const snapshotContextSection = buildSnapshotContextSection(currentStateSnapshot, conversationSignalEvent);
    
    // Add context-specific instructions
    let contextInstructions = '';
    switch (responseContext.context) {
      case 'teaching':
        contextInstructions = `\n\n## Response Mode: TEACHING\nThe user is asking for help, explanation, or guidance.\n\nYOUR RESPONSE SHOULD:\n- Be thorough and educational (${responseContext.wordRange.min}-${responseContext.wordRange.max} words)\n- Explain the concept or strategy clearly\n- Give a specific, actionable example they can use\n- End with a check-in question to ensure understanding\n\nThis is a coaching moment - take the time to teach properly.`;
        break;
      case 'listening':
        contextInstructions = `\n\n## Response Mode: LISTENING\nThe user is sharing something meaningful or emotional.\n\nYOUR RESPONSE MUST:\n- Be brief and validating (${responseContext.wordRange.min}-${responseContext.wordRange.max} words)\n- Show you heard the specific details they shared\n- Validate the weight of what they're carrying\n- Reframe any self-criticism positively\n- End with an open question that gives them space: "How are you feeling about that?" or "How are you holding up?"\n\nDO NOT:\n- Ask "what action can you take?" or offer solutions yet\n- Pivot to achievements/PRs unless they asked\n- Match their message length - they need space to continue sharing`;
        break;
      case 'quickExchange':
        contextInstructions = `\n\n## Response Mode: QUICK EXCHANGE\nThe user sent a short message. Match their energy.\n\nYOUR RESPONSE SHOULD:\n- Be snappy and conversational (${responseContext.wordRange.min}-${responseContext.wordRange.max} words)\n- Match their brevity\n- Keep the dialogue flowing naturally`;
        break;
      case 'turnTaking':
        contextInstructions = `\n\n## Response Mode: TURN-TAKING\nYou just gave a longer response. Now it's their turn to talk more.\n\nYOUR RESPONSE SHOULD:\n- Be moderate in length (${responseContext.wordRange.min}-${responseContext.wordRange.max} words)\n- Avoid another long explanation\n- Give them space to respond and continue the conversation`;
        break;
      case 'standard':
        contextInstructions = `\n\n## Response Mode: STANDARD\nBalanced conversational response (${responseContext.wordRange.min}-${responseContext.wordRange.max} words).\nBe natural and genuine.`;
        break;
    }
    
    // Build final system prompt
    const coachDirectiveSection = coachDirective
      ? `\n\n## Active Coaching Directive:\n${coachDirective}`
      : '';

    let systemPrompt = `${basePersona}\n\n${userContextSection}${healthContextSection}${assignmentContextSection}${snapshotContextSection}${contextInstructions}${coachDirectiveSection}\n\n### Conversation Memory Rule\nBefore asking a question, scan the last 6 messages. If you already asked it and the user answered, **do not ask again**.\nInstead, acknowledge their answer and advance the topic.`;
    
    // Legacy support: If iOS still sends systemPromptContext (old version), use it but log a warning
    if (systemPromptContext && !healthContext) {
      console.warn('[pulsecheck-chat] DEPRECATED: iOS sent systemPromptContext. Please update to send healthContext and userContext separately.');
      systemPrompt = `${systemPromptContext}\n\n### Conversation Memory Rule\nBefore asking a question, scan the last 6 messages. If you already asked it and the user answered, do not ask again. Acknowledge their answer and advance the topic.`;
    }

    // =========================================================================
    // Assignment reminder onboarding (before OpenAI)
    // =========================================================================
    const assignmentPrefs = userDataForPrefs?.mentalTrainingPreferences?.assignmentReminders;
    const onboarding = userDataForPrefs?.mentalTrainingPreferences?.assignmentRemindersOnboarding || {};
    const onboardingState = onboarding?.state || 'none';

    let assistantMessage = null;
    let handledOnboarding = false;

    if (onboardingState === 'asked') {
      const yn = parseYesNo(message);
      if (yn === 'no') {
        await db.collection('users').doc(userId).set({
          mentalTrainingPreferences: {
            assignmentReminders: {
              enabled: false,
              updatedAt: new Date()
            },
            assignmentRemindersOnboarding: {
              state: 'none',
              updatedAt: new Date()
            }
          }
        }, { merge: true });
        assistantMessage = `All good, ${displayName.split(' ')[0]} — I won't send reminders for assignments.`;
        handledOnboarding = true;
      } else if (yn === 'yes') {
        await db.collection('users').doc(userId).set({
          mentalTrainingPreferences: {
            assignmentRemindersOnboarding: {
              state: 'awaiting_time',
              updatedAt: new Date()
            }
          }
        }, { merge: true });
        assistantMessage =
          `Got it. What time should I remind you if you haven’t completed your assigned exercise?\n\n` +
          `- Reply with a time like “7pm”\n` +
          `- Or say “you decide” and I’ll default to noon local time.`;
        handledOnboarding = true;
      }
    } else if (onboardingState === 'awaiting_time') {
      const tz =
        assignmentPrefs?.timezone ||
        userDataForPrefs?.dailyReflectionPreferences?.timezone ||
        userDataForPrefs?.timezone ||
        'UTC';

      if (shouldUseSmartNoon(message)) {
        await db.collection('users').doc(userId).set({
          mentalTrainingPreferences: {
            assignmentReminders: {
              enabled: true,
              mode: 'smart',
              hour: 12,
              minute: 0,
              timezone: tz,
              updatedAt: new Date()
            },
            assignmentRemindersOnboarding: {
              state: 'none',
              updatedAt: new Date()
            }
          }
        }, { merge: true });
        assistantMessage = `Perfect. I’ll remind you at noon local time if you haven’t completed your assignment.`;
        handledOnboarding = true;
      } else {
        const parsed = parseTimeFromText(message);
        if (!parsed) {
          assistantMessage = `Tell me a reminder time like “7pm” (or say “you decide” for noon).`;
          handledOnboarding = true;
        } else {
          await db.collection('users').doc(userId).set({
            mentalTrainingPreferences: {
              assignmentReminders: {
                enabled: true,
                mode: 'custom',
                hour: parsed.hour,
                minute: parsed.minute,
                timezone: tz,
                updatedAt: new Date()
              },
              assignmentRemindersOnboarding: {
                state: 'none',
                updatedAt: new Date()
              }
            }
          }, { merge: true });
          const minuteStr = String(parsed.minute).padStart(2, '0');
          assistantMessage = `Done. I’ll remind you at ${parsed.hour}:${minuteStr} (your local time) if you haven’t completed your assignment.`;
          handledOnboarding = true;
        }
      }
    }

    // If not handled, proceed with OpenAI
    if (!handledOnboarding) {
      // Prepare messages for OpenAI
      const openAiMessages = [
        { role: 'system', content: systemPrompt }
      ];

      for (const m of recentMessages) {
        const role = m.isFromUser ? 'user' : 'assistant';
        openAiMessages.push({ role, content: m.content });
      }

      openAiMessages.push({ role: 'user', content: message });

      // Call OpenAI
      // Support both environment variable names for compatibility
      const apiKey = process.env.OPEN_AI_SECRET_KEY;
      if (!apiKey) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing OPEN_AI_SECRET_KEY' }) };
      }

      const completionRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: openAiMessages,
          temperature: 0.6,
          max_tokens: responseContext.maxTokens,
          frequency_penalty: 0.5,
          presence_penalty: 0.3
        })
      });

      if (!completionRes.ok) {
        // Parse OpenAI error response
        let errorData;
        const contentType = completionRes.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            errorData = await completionRes.json();
          } catch (e) {
            const errText = await completionRes.text();
            console.error('[pulsecheck-chat] OpenAI API error (non-JSON):', errText);
            return { 
              statusCode: 502, 
              headers, 
              body: JSON.stringify({ error: 'OpenAI API error', detail: errText.substring(0, 500) }) 
            };
          }
        } else {
          const errText = await completionRes.text();
          console.error('[pulsecheck-chat] OpenAI API error (non-JSON):', errText);
          return { 
            statusCode: 502, 
            headers, 
            body: JSON.stringify({ error: 'OpenAI API error', detail: errText.substring(0, 500) }) 
          };
        }

        // Handle specific OpenAI error types
        const errorType = errorData?.error?.type || errorData?.error?.code;
        const errorMessage = errorData?.error?.message || 'Unknown error';
        
        console.error('[pulsecheck-chat] OpenAI API error:', { errorType, errorMessage, status: completionRes.status });
        
        let userFriendlyMessage = 'AI service temporarily unavailable. Please try again shortly.';
        let statusCode = 502;
        
        if (errorType === 'insufficient_quota' || errorMessage.includes('quota')) {
          userFriendlyMessage = 'AI service quota exceeded. Please check your OpenAI account settings or try again later.';
          statusCode = 429; // Too Many Requests
        } else if (errorType === 'rate_limit_exceeded' || errorMessage.includes('rate limit')) {
          userFriendlyMessage = 'AI service rate limit exceeded. Please wait a moment and try again.';
          statusCode = 429;
        } else if (errorType === 'invalid_api_key' || errorMessage.includes('API key')) {
          userFriendlyMessage = 'AI service configuration error. Please contact support.';
          statusCode = 500;
        } else if (errorMessage) {
          // Include the actual error message for debugging (truncated)
          userFriendlyMessage = `AI service error: ${errorMessage.substring(0, 200)}`;
        }
        
        return { 
          statusCode, 
          headers, 
          body: JSON.stringify({ 
            error: userFriendlyMessage,
            errorType: errorType,
            detail: process.env.NODE_ENV === 'development' ? errorMessage : undefined
          }) 
        };
      }

      const completion = await completionRes.json();
      assistantMessage = completion.choices?.[0]?.message?.content?.trim() || "I'm here to support you. Can you share more?";

      // If user has active assignments and hasn't opted in/out yet, Nora should ask once.
      try {
        const hasExplicitPref = assignmentPrefs?.enabled === true || assignmentPrefs?.enabled === false;
        const lastPromptedAt = onboarding?.lastPromptedAtSec || 0;
        const nowSec = Math.floor(Date.now() / 1000);
        const recentlyPrompted = nowSec - lastPromptedAt < 7 * 24 * 60 * 60; // 7 days

        if (!hasExplicitPref && onboardingState === 'none' && !recentlyPrompted) {
          const activeAssignments = await getActiveMentalAssignments(db, userId);
          if (activeAssignments.length > 0) {
            assistantMessage +=
              `\n\nAlso — you have assigned mental exercises right now. Want me to send reminders if you haven’t completed them by noon (local time)? Reply “yes” or “no”.`;
            await db.collection('users').doc(userId).set({
              mentalTrainingPreferences: {
                assignmentRemindersOnboarding: {
                  state: 'asked',
                  lastPromptedAtSec: nowSec,
                  updatedAt: new Date()
                }
              }
            }, { merge: true });
          }
        }
      } catch (e) {
        console.warn('[pulsecheck-chat] assignment reminder prompt check failed (non-blocking):', e?.message || e);
      }
    }

    // Update conversation: append messages and save
    const aiMsg = {
      id: cryptoRandomId(),
      content: assistantMessage,
      isFromUser: false,
      timestamp: nowSec,
      messageType: 'text'
    };

    try {
      if (!convo?.messages?.length) {
        const data = {
          id: convoRef.id,
          userId,
          title: 'Nora',
          messages: [userMsg, aiMsg],
          tags: [],
          actionCardInteractions: [],
          sessionDuration: 0,
          createdAt: nowSec,
          updatedAt: nowSec
        };
        await convoRef.set(data, { merge: true });
        newConvoId = convoRef.id;
      } else {
        const updated = Array.isArray(convo?.messages) ? [...convo.messages, userMsg, aiMsg] : [userMsg, aiMsg];
        await convoRef.set({
          id: convoRef.id,
          userId,
          title: convo?.title || 'Nora',
          messages: updated,
          updatedAt: nowSec
        }, { merge: true });
        newConvoId = convoRef.id;
      }
    } catch (saveError) {
      console.error('[pulsecheck-chat] Error saving conversation:', saveError);
      // Continue - we still have the response to return, just conversation wasn't saved
      // This is not critical enough to fail the entire request
    }

    // === ESCALATION CLASSIFICATION ===
    // Run classification in parallel with response (don't block)
    let escalation = null;
    
    console.log('[pulsecheck-chat] ========== ESCALATION FLOW START ==========');
    console.log('[pulsecheck-chat] Escalation parameters:', {
      skipEscalation,
      userId: userId.slice(0, 8) + '...',
      messageLength: message.length,
      messagePreview: message.substring(0, 50) + '...',
      recentMessagesCount: recentMessages?.length || 0,
      conversationId: newConvoId
    });
    
    if (!skipEscalation) {
      try {
        console.log('[pulsecheck-chat] [1/5] Starting escalation classification...');
        const classificationStartTime = Date.now();
        
        escalation = await classifyEscalation(
          db,
          userId,
          message,
          recentMessages,
          newConvoId
        );
        
        const classificationDuration = Date.now() - classificationStartTime;
        console.log(`[pulsecheck-chat] [2/5] Classification completed in ${classificationDuration}ms`);
        console.log('[pulsecheck-chat] [2/5] Escalation classification result:', {
          hasResult: !!escalation,
          tier: escalation?.tier,
          tierName: escalation?.tier === 0 ? 'None' : escalation?.tier === 1 ? 'MonitorOnly' : escalation?.tier === 2 ? 'ElevatedRisk' : escalation?.tier === 3 ? 'CriticalRisk' : 'Unknown',
          shouldEscalate: escalation?.shouldEscalate,
          category: escalation?.category,
          reason: escalation?.reason,
          confidence: escalation?.confidence,
          fullObject: JSON.stringify(escalation, null, 2)
        });

        // Create escalation records for Tier 1+ (Monitor-Only and above)
        console.log('[pulsecheck-chat] [3/5] Evaluating escalation record creation...');
        console.log('[pulsecheck-chat] [3/5] Evaluation checks:', {
          hasEscalation: !!escalation,
          shouldEscalate: escalation?.shouldEscalate,
          tier: escalation?.tier,
          isTier1: escalation?.tier === EscalationTier.MonitorOnly,
          isTier2: escalation?.tier === EscalationTier.ElevatedRisk,
          isTier3: escalation?.tier === EscalationTier.CriticalRisk,
          shouldCreateRecord: escalation && escalation.tier >= EscalationTier.MonitorOnly
        });
        
        if (escalation && escalation.tier >= EscalationTier.MonitorOnly) {
          const tier = escalation.tier;
          console.log(`[pulsecheck-chat] [4/5] Escalation tier detected (record will be saved). Tier: ${tier}`);
          console.log(`[pulsecheck-chat] [4/5] Record creation params:`, {
            userId: userId.slice(0, 8) + '...',
            conversationId: newConvoId,
            messageId: aiMsg.id,
            tier,
            category: escalation.category,
            shouldEscalate: escalation.shouldEscalate
          });
          
          // Trigger escalation record creation asynchronously (Tier 1+)
          const recordCreationStartTime = Date.now();
          createEscalationRecord(db, userId, newConvoId, aiMsg.id, message, escalation)
            .then(async recordId => {
              const recordCreationDuration = Date.now() - recordCreationStartTime;
              console.log(`[pulsecheck-chat] [5/5] ✅ Escalation record created successfully in ${recordCreationDuration}ms`);
              console.log(`[pulsecheck-chat] [5/5] Record ID: ${recordId}`);

              // Tier 1 (Monitor-Only): notify coach (no AuntEdna escalation)
              if (tier === EscalationTier.MonitorOnly) {
                console.log('[pulsecheck-chat] [5/5] Tier 1 => notifying coach (monitor-only)');
                try {
                  await notifyCoachForEscalation(db, recordId, userId, tier);
                  console.log('[pulsecheck-chat] [5/5] ✅ Coach notified for Tier 1 escalation');
                } catch (notifyErr) {
                  console.error('[pulsecheck-chat] [5/5] ❌ Coach notify failed (non-blocking):', notifyErr?.message || notifyErr);
                }
              }

              console.log('[pulsecheck-chat] ========== ESCALATION FLOW SUCCESS ==========');
            })
            .catch(err => {
              const recordCreationDuration = Date.now() - recordCreationStartTime;
              console.error(`[pulsecheck-chat] [5/5] ❌ Escalation record creation FAILED after ${recordCreationDuration}ms`);
              console.error('[pulsecheck-chat] [5/5] Error details:', {
                message: err.message,
                code: err.code,
                stack: err.stack
              });
              console.error('[pulsecheck-chat] ========== ESCALATION FLOW FAILED ==========');
            });
        } else {
          console.log('[pulsecheck-chat] [3/5] No escalation record needed:', {
            reason: !escalation ? 'No escalation result' : escalation.tier === EscalationTier.None ? 'tier is 0 (None)' : 'Unknown',
            escalationTier: escalation?.tier
          });
          console.log('[pulsecheck-chat] ========== ESCALATION FLOW COMPLETE (No escalation) ==========');
        }
      } catch (escErr) {
        console.error('[pulsecheck-chat] ❌ ESCALATION CLASSIFICATION EXCEPTION');
        console.error('[pulsecheck-chat] Error type:', escErr.constructor.name);
        console.error('[pulsecheck-chat] Error message:', escErr.message);
        console.error('[pulsecheck-chat] Error code:', escErr.code);
        console.error('[pulsecheck-chat] Error stack:', escErr.stack);
        console.error('[pulsecheck-chat] ========== ESCALATION FLOW ERROR ==========');
        // Don't fail the chat if classification fails
      }
    } else {
      console.log('[pulsecheck-chat] ⏭️ Escalation skipped (skipEscalation=true)');
      console.log('[pulsecheck-chat] ========== ESCALATION FLOW SKIPPED ==========');
    }

    // Prepare response
    const escalationResponse = escalation ? {
      tier: escalation.tier,
      category: escalation.category,
      reason: escalation.reason,
      confidence: escalation.confidence,
      shouldEscalate: escalation.shouldEscalate
    } : null;
    
    console.log('[pulsecheck-chat] ========== RESPONSE PREPARATION ==========');
    console.log('[pulsecheck-chat] Response escalation object:', {
      hasEscalation: !!escalationResponse,
      escalationResponse: JSON.stringify(escalationResponse, null, 2)
    });
    console.log('[pulsecheck-chat] Full response payload:', {
      conversationId: newConvoId,
      assistantMessageLength: assistantMessage.length,
      hasEscalation: !!escalationResponse,
      escalationTier: escalationResponse?.tier,
      escalationShouldEscalate: escalationResponse?.shouldEscalate
    });
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        conversationId: newConvoId,
        assistantMessage,
        escalation: escalationResponse,
        stateSnapshot: currentStateSnapshot || null,
        conversationSignalEvent: conversationSignalEvent || null,
        dailyAssignment: todaysNoraAssignment || null,
        assignmentRefreshApplied,
      })
    };
  } catch (error) {
    console.error('[pulsecheck-chat] error', error);
    console.error('[pulsecheck-chat] error stack', error.stack);
    console.error('[pulsecheck-chat] error message', error.message);
    
    // Return more detailed error for debugging (but don't expose sensitive info)
    const errorMessage = error.message || 'Unknown error';
    const isDevelopment = process.env.NETLIFY_DEV === 'true' || process.env.NODE_ENV === 'development';
    
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ 
        error: 'Server error',
        detail: isDevelopment ? errorMessage : undefined,
        type: error.name || 'Error'
      }) 
    };
  }
};

function cryptoRandomId() {
  // simple random id; not cryptographically secure but fine for UI ids
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

/**
 * Classify message for escalation
 */
async function classifyEscalation(db, userId, message, recentMessages, conversationId) {
  const apiKey = process.env.OPEN_AI_SECRET_KEY;
  if (!apiKey) return null;

  // Load escalation conditions from Firestore
  console.log('[classifyEscalation] [STEP 1] Loading escalation conditions from Firestore...');
  console.log('[classifyEscalation] [STEP 1] Query parameters:', {
    collection: 'escalation-conditions',
    filter: 'isActive == true',
    orderBy: ['tier asc', 'priority desc']
  });
  
  let conditionsSnap;
  try {
    const queryStartTime = Date.now();
    conditionsSnap = await db
      .collection('escalation-conditions')
      .where('isActive', '==', true)
      .orderBy('tier', 'asc')
      .orderBy('priority', 'desc')
      .get();
    const queryDuration = Date.now() - queryStartTime;
    console.log(`[classifyEscalation] [STEP 1] ✅ Query completed in ${queryDuration}ms`);
    console.log(`[classifyEscalation] [STEP 1] Loaded ${conditionsSnap.docs.length} documents`);
  } catch (queryError) {
    console.error('[classifyEscalation] [STEP 1] ❌ Query FAILED');
    console.error('[classifyEscalation] [STEP 1] Error type:', queryError.constructor.name);
    console.error('[classifyEscalation] [STEP 1] Error message:', queryError.message);
    console.error('[classifyEscalation] [STEP 1] Error code:', queryError.code);
    console.error('[classifyEscalation] [STEP 1] Error stack:', queryError.stack);
    // If query fails (e.g., missing index), continue without conditions
    return null;
  }

  console.log('[classifyEscalation] [STEP 2] Processing conditions...');
  const conditions = conditionsSnap.docs.map((doc, index) => {
    const data = doc.data();
    console.log(`[classifyEscalation] [STEP 2] Condition ${index + 1}/${conditionsSnap.docs.length}:`, {
      id: doc.id,
      tier: data.tier,
      category: data.category,
      title: data.title,
      isActive: data.isActive,
      priority: data.priority,
      examplePhrasesCount: data.examplePhrases?.length || 0,
      keywordsCount: data.keywords?.length || 0
    });
    return {
      id: doc.id,
      ...data
    };
  });
  
  if (conditions.length === 0) {
    console.warn('[classifyEscalation] [STEP 2] ⚠️ No active escalation conditions found');
    console.warn('[classifyEscalation] [STEP 2] Classification will proceed with default behavior');
    // Continue with classification but with minimal context
  } else {
    const tierBreakdown = {
      tier0: conditions.filter(c => c.tier === 0).length,
      tier1: conditions.filter(c => c.tier === 1).length,
      tier2: conditions.filter(c => c.tier === 2).length,
      tier3: conditions.filter(c => c.tier === 3).length
    };
    console.log('[classifyEscalation] [STEP 2] ✅ Conditions breakdown:', tierBreakdown);
    console.log('[classifyEscalation] [STEP 2] Total conditions:', conditions.length);
  }

  // Build training context
  console.log('[classifyEscalation] [STEP 3] Building training context...');
  const trainingContext = buildEscalationTrainingContext(conditions);
  console.log('[classifyEscalation] [STEP 3] Training context length:', trainingContext.length);
  console.log('[classifyEscalation] [STEP 3] Training context preview:', trainingContext.substring(0, 200) + '...');

  // Build classification prompt
  console.log('[classifyEscalation] [STEP 4] Building classification prompt...');
  const systemPrompt = `You are a clinical safety classifier for PulseCheck.

ESCALATION TIERS:
- Tier 0 (None): Normal conversation
- Tier 1 (Monitor-Only): Low-risk concerns, notify coach
- Tier 2 (Elevated Risk): Consent-based clinical escalation
- Tier 3 (Critical Risk): MANDATORY immediate escalation

${trainingContext}

Respond with JSON only:
{"tier":0-3,"category":"string","reason":"brief reason","confidence":0.0-1.0,"shouldEscalate":boolean}

CRITICAL: Err on side of caution. Tier 3 has ZERO threshold for safety concerns.`;

  const conversationContext = recentMessages.length > 0
    ? '\nRecent messages:\n' + recentMessages.slice(-5).map(m => 
        `${m.isFromUser ? 'User' : 'AI'}: ${m.content}`
      ).join('\n')
    : '';

  console.log('[classifyEscalation] [STEP 4] Prompt details:', {
    systemPromptLength: systemPrompt.length,
    userMessageLength: message.length,
    conversationContextLength: conversationContext.length,
    recentMessagesCount: recentMessages.length
  });

  console.log('[classifyEscalation] [STEP 5] Calling OpenAI API for classification...');
  console.log('[classifyEscalation] [STEP 5] API request details:', {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    hasApiKey: !!apiKey,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING'
  });

  try {
    const apiCallStartTime = Date.now();
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Classify this message:\n\n"${message}"${conversationContext}` }
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' }
      })
    });

    const apiCallDuration = Date.now() - apiCallStartTime;
    console.log(`[classifyEscalation] [STEP 5] API call completed in ${apiCallDuration}ms`);
    console.log('[classifyEscalation] [STEP 5] Response status:', res.status, res.statusText);
    
    if (!res.ok) {
      // Parse OpenAI error response
      let errorData;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          errorData = await res.json();
        } catch (e) {
          const errorText = await res.text();
          console.error('[classifyEscalation] [STEP 5] ❌ API call FAILED (non-JSON error)');
          console.error('[classifyEscalation] [STEP 5] Error details:', {
            status: res.status,
            statusText: res.statusText,
            error: errorText.substring(0, 500),
            headers: Object.fromEntries(res.headers.entries())
          });
          return null;
        }
      } else {
        const errorText = await res.text();
        console.error('[classifyEscalation] [STEP 5] ❌ API call FAILED (non-JSON error)');
        console.error('[classifyEscalation] [STEP 5] Error details:', {
          status: res.status,
          statusText: res.statusText,
          error: errorText.substring(0, 500),
          headers: Object.fromEntries(res.headers.entries())
        });
        return null;
      }

      const errorType = errorData?.error?.type || errorData?.error?.code;
      const errorMessage = errorData?.error?.message || 'Unknown error';
      
      console.error('[classifyEscalation] [STEP 5] ❌ API call FAILED');
      console.error('[classifyEscalation] [STEP 5] Error details:', {
        status: res.status,
        statusText: res.statusText,
        errorType: errorType,
        errorMessage: errorMessage,
        headers: Object.fromEntries(res.headers.entries())
      });
      
      // Log specific quota/rate limit errors
      if (errorType === 'insufficient_quota' || errorMessage.includes('quota')) {
        console.error('[classifyEscalation] [STEP 5] ⚠️ QUOTA EXCEEDED - OpenAI API quota issue');
      } else if (errorType === 'rate_limit_exceeded' || errorMessage.includes('rate limit')) {
        console.error('[classifyEscalation] [STEP 5] ⚠️ RATE LIMIT EXCEEDED');
      }
      
      return null;
    }

    console.log('[classifyEscalation] [STEP 6] Parsing API response...');
    const data = await res.json();
    console.log('[classifyEscalation] [STEP 6] Response structure:', {
      hasChoices: !!data.choices,
      choicesCount: data.choices?.length || 0,
      model: data.model,
      usage: data.usage
    });
    
    const content = data.choices?.[0]?.message?.content;
    console.log('[classifyEscalation] [STEP 6] Content extracted:', {
      hasContent: !!content,
      contentLength: content?.length || 0,
      contentPreview: content ? content.substring(0, 200) + '...' : 'NONE'
    });
    
    if (!content) {
      console.warn('[classifyEscalation] [STEP 6] ⚠️ No content in response');
      console.warn('[classifyEscalation] [STEP 6] Full response:', JSON.stringify(data, null, 2));
      return null;
    }
    
    console.log('[classifyEscalation] [STEP 7] Parsing JSON content...');
    try {
      const parsed = JSON.parse(content);
      console.log('[classifyEscalation] [STEP 7] ✅ JSON parsed successfully');
      console.log('[classifyEscalation] [STEP 7] Raw classification result:', JSON.stringify(parsed, null, 2));
      
      console.log('[classifyEscalation] [STEP 8] Validating and normalizing classification result...');
      
      // Ensure shouldEscalate is set correctly based on tier
      // Tier 2 (Elevated) and Tier 3 (Critical) should always escalate
      // Tier 1 (Monitor) might escalate depending on the response
      // Tier 0 (None) should never escalate
      const originalTier = parsed.tier;
      const originalShouldEscalate = parsed.shouldEscalate;
      
      if (parsed.tier === undefined || parsed.tier === null) {
        console.warn('[classifyEscalation] [STEP 8] ⚠️ Classification missing tier, defaulting to 0');
        parsed.tier = 0;
      }
      
      // Set shouldEscalate based on tier if not provided or incorrect
      if (parsed.shouldEscalate === undefined || parsed.shouldEscalate === null) {
        parsed.shouldEscalate = parsed.tier >= EscalationTier.ElevatedRisk;
        console.log('[classifyEscalation] [STEP 8] Set shouldEscalate based on tier:', {
          tier: parsed.tier,
          shouldEscalate: parsed.shouldEscalate,
          reason: 'was undefined/null'
        });
      } else if (parsed.tier >= EscalationTier.ElevatedRisk && !parsed.shouldEscalate) {
        // Override: Tier 2/3 must escalate
        console.warn('[classifyEscalation] [STEP 8] ⚠️ Overriding shouldEscalate to true for tier', parsed.tier);
        parsed.shouldEscalate = true;
      } else if (parsed.tier === EscalationTier.None && parsed.shouldEscalate) {
        // Override: Tier 0 should not escalate
        console.warn('[classifyEscalation] [STEP 8] ⚠️ Overriding shouldEscalate to false for tier 0');
        parsed.shouldEscalate = false;
      }
      
      console.log('[classifyEscalation] [STEP 8] Validation complete:', {
        original: { tier: originalTier, shouldEscalate: originalShouldEscalate },
        final: { tier: parsed.tier, shouldEscalate: parsed.shouldEscalate },
        changed: originalTier !== parsed.tier || originalShouldEscalate !== parsed.shouldEscalate
      });
      
      console.log('[classifyEscalation] [STEP 8] ✅ Final classification result:', JSON.stringify(parsed, null, 2));
      console.log('[classifyEscalation] ========== CLASSIFICATION COMPLETE ==========');
      return parsed;
    } catch (parseErr) {
      console.error('[classifyEscalation] [STEP 7] ❌ JSON parse FAILED');
      console.error('[classifyEscalation] [STEP 7] Parse error:', {
        message: parseErr.message,
        stack: parseErr.stack
      });
      console.error('[classifyEscalation] [STEP 7] Raw content that failed to parse:', content);
      console.error('[classifyEscalation] [STEP 7] Content length:', content.length);
      console.error('[classifyEscalation] [STEP 7] Content type:', typeof content);
      return null;
    }
  } catch (err) {
    console.error('[classifyEscalation] ❌ CLASSIFICATION EXCEPTION');
    console.error('[classifyEscalation] Error type:', err.constructor.name);
    console.error('[classifyEscalation] Error message:', err.message);
    console.error('[classifyEscalation] Error code:', err.code);
    console.error('[classifyEscalation] Error stack:', err.stack);
    return null;
  }
}

/**
 * Build training context from conditions
 */
function buildEscalationTrainingContext(conditions) {
  const tier1 = conditions.filter(c => c.tier === 1);
  const tier2 = conditions.filter(c => c.tier === 2);
  const tier3 = conditions.filter(c => c.tier === 3);

  const fmt = (c) => `- ${c.title}: ${c.description}${c.examplePhrases?.length ? ` (e.g. "${c.examplePhrases[0]}")` : ''}`;

  let ctx = '';
  if (tier1.length) ctx += '\nTier 1 conditions:\n' + tier1.map(fmt).join('\n');
  if (tier2.length) ctx += '\nTier 2 conditions:\n' + tier2.map(fmt).join('\n');
  if (tier3.length) ctx += '\nTier 3 conditions:\n' + tier3.map(fmt).join('\n');
  
  return ctx || 'Use clinical judgment for escalation.';
}

/**
 * Create escalation record for Tier 2/3
 */
async function createEscalationRecord(db, userId, conversationId, messageId, triggerContent, classification) {
  console.log('[createEscalationRecord] ========== RECORD CREATION START ==========');
  console.log('[createEscalationRecord] [STEP 1] Function called with parameters:', {
    userId: userId.slice(0, 8) + '...',
    conversationId,
    messageId,
    triggerContentLength: triggerContent.length,
    triggerContentPreview: triggerContent.substring(0, 50) + '...',
    classification: JSON.stringify(classification, null, 2)
  });
  
  try {
    console.log('[createEscalationRecord] [STEP 2] Preparing record data...');
    const nowSec = Math.floor(Date.now() / 1000);
    
    // Tier behavior:
    // - Tier 1 (MonitorOnly): save record + notify coach; no consent/handoff needed
    // - Tier 2 (ElevatedRisk): consent-based handoff
    // - Tier 3 (CriticalRisk): mandatory clinical handoff, no consent
    const consentStatus =
      classification.tier === EscalationTier.ElevatedRisk ? 'pending' : 'not-required';

    const data = {
      userId,
      conversationId,
      tier: classification.tier,
      category: classification.category || 'general',
      triggerMessageId: messageId,
      triggerContent: triggerContent,
      classificationReason: classification.reason || '',
      classificationConfidence: classification.confidence || 0,
      consentStatus,
      handoffStatus: 'pending',
      coachNotified: false,
      createdAt: nowSec,
      status: 'active'
    };

    console.log('[createEscalationRecord] [STEP 2] Record data prepared:', {
      tier: data.tier,
      category: data.category,
      consentStatus: data.consentStatus,
      handoffStatus: data.handoffStatus,
      createdAt: data.createdAt,
      status: data.status,
      hasTriggerContent: !!data.triggerContent,
      triggerContentLength: data.triggerContent.length,
      hasReason: !!data.classificationReason,
      confidence: data.classificationConfidence
    });

    console.log('[createEscalationRecord] [STEP 3] Creating document in escalation-records collection...');
    const addStartTime = Date.now();
    const docRef = await db.collection('escalation-records').add(data);
    const addDuration = Date.now() - addStartTime;
    console.log(`[createEscalationRecord] [STEP 3] ✅ Document created in ${addDuration}ms`);
    console.log('[createEscalationRecord] [STEP 3] Document ID:', docRef.id);
    console.log('[createEscalationRecord] [STEP 3] Document path:', docRef.path);
    
    console.log('[createEscalationRecord] [STEP 4] Updating document with ID field...');
    const updateStartTime = Date.now();
    await docRef.update({ id: docRef.id });
    const updateDuration = Date.now() - updateStartTime;
    console.log(`[createEscalationRecord] [STEP 4] ✅ ID field updated in ${updateDuration}ms`);

    console.log('[createEscalationRecord] [STEP 5] Updating conversation document...');
    const conversationUpdateStartTime = Date.now();
    const conversationUpdate = {
      escalationTier: classification.tier,
      escalationStatus: 'active',
      escalationRecordId: docRef.id,
      isInSafetyMode: classification.tier === EscalationTier.CriticalRisk,
      lastEscalationAt: nowSec
    };
    console.log('[createEscalationRecord] [STEP 5] Conversation update data:', conversationUpdate);
    
    await db.collection('conversations').doc(conversationId).set(conversationUpdate, { merge: true });
    const conversationUpdateDuration = Date.now() - conversationUpdateStartTime;
    console.log(`[createEscalationRecord] [STEP 5] ✅ Conversation updated in ${conversationUpdateDuration}ms`);
    console.log('[createEscalationRecord] [STEP 5] Conversation ID:', conversationId);

    console.log('[createEscalationRecord] ========== RECORD CREATION SUCCESS ==========');
    console.log('[createEscalationRecord] Final record ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('[createEscalationRecord] ========== RECORD CREATION FAILED ==========');
    console.error('[createEscalationRecord] Error type:', error.constructor.name);
    console.error('[createEscalationRecord] Error message:', error.message);
    console.error('[createEscalationRecord] Error code:', error.code);
    console.error('[createEscalationRecord] Error stack:', error.stack);
    console.error('[createEscalationRecord] Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    throw error; // Re-throw so caller can handle it
  }
}

/**
 * Tier 1+ coach notification helper (Tier 1 required; Tier 2 optional; Tier 3 optional)
 * Mirrors `pulsecheck-escalation` notifyCoach behavior, but runs locally to avoid function-to-function calls.
 */
async function notifyCoachForEscalation(db, escalationId, userId, tier) {
  const { sendCoachEscalationEmail } = require('./utils/sendCoachEscalationEmail');

  // Find athlete's connected coach
  const connectionSnap = await db
    .collection('athlete-coach-connections')
    .where('athleteId', '==', userId)
    .where('status', '==', 'accepted')
    .limit(1)
    .get();

  if (connectionSnap.empty) {
    console.log('[notifyCoachForEscalation] No coach found for athlete', { userId: userId?.slice?.(0, 8) + '...' });
    return { success: false, reason: 'no_coach_connected' };
  }

  const targetCoachId = connectionSnap.docs[0].data().coachId;
  const nowSec = Math.floor(Date.now() / 1000);

  // Update escalation record (idempotent-ish: overwrite to true)
  await db.collection('escalation-records').doc(escalationId).update({
    coachNotified: true,
    coachId: targetCoachId,
    coachNotifiedAt: nowSec
  });

  // Create notification for coach
  const title = tier === EscalationTier.MonitorOnly ? 'Athlete Check-In (Monitor)' : 'Athlete Check-In Alert';
  const msg =
    tier === EscalationTier.MonitorOnly
      ? 'An athlete you coach was flagged for monitor-only concern. Please review when you can.'
      : 'An athlete you coach has been flagged for elevated concern. Please check your dashboard.';

  await db.collection('notifications').add({
    userId: targetCoachId,
    type: 'escalation-alert',
    title,
    message: msg,
    escalationId,
    athleteId: userId,
    read: false,
    createdAt: nowSec
  });

  // Email coach (non-blocking). Do NOT include conversation details.
  try {
    const coachSnap = await db.collection('users').doc(targetCoachId).get();
    const coach = coachSnap.exists ? (coachSnap.data() || {}) : {};
    const coachEmail = typeof coach.email === 'string' ? coach.email.trim() : '';
    const coachName = (coach.displayName || coach.username || '').trim();

    const athleteSnap = await db.collection('users').doc(userId).get();
    const athlete = athleteSnap.exists ? (athleteSnap.data() || {}) : {};
    const athleteName = (athlete.displayName || athlete.username || 'An athlete').trim();

    if (coachEmail) {
      const siteUrl = process.env.SITE_URL || '';
      const result = await sendCoachEscalationEmail({
        coachEmail,
        coachName,
        athleteName,
        tier,
        siteUrl,
      });
      console.log('[notifyCoachForEscalation] Coach email sent (best-effort):', {
        success: result?.success,
        skipped: result?.skipped,
        tier,
        coachId: targetCoachId,
      });

      // Log to Notification Logs dashboard (email channel; no FCM token)
      try {
        const FieldValue = admin.firestore.FieldValue;
        await db.collection('notification-logs').add({
          fcmToken: coachEmail ? `email:${coachEmail.substring(0, 20)}...` : 'EMAIL',
          title: `Coach escalation email (Tier ${tier})`,
          body:
            tier === EscalationTier.MonitorOnly
              ? 'Tier 1 coach-review escalation email sent (privacy-safe).'
              : `Tier ${tier} clinical-handoff escalation email sent (privacy-safe).`,
          notificationType: 'COACH_ESCALATION_EMAIL',
          functionName: 'netlify/pulsecheck-chat.notifyCoachForEscalation',
          success: !!result?.success,
          messageId: result?.messageId || null,
          error: result?.success
            ? null
            : { code: result?.reason || 'EMAIL_FAILED', message: result?.error || 'Email send failed or skipped' },
          dataPayload: {
            channel: 'email',
            coachId: targetCoachId,
            athleteId: userId,
            escalationId,
            tier,
            skipped: !!result?.skipped,
          },
          timestamp: FieldValue.serverTimestamp(),
          timestampEpoch: nowSec,
          createdAt: FieldValue.serverTimestamp(),
          version: '1.0',
        });
      } catch (logErr) {
        console.warn('[notifyCoachForEscalation] Failed to write notification-logs (non-blocking):', logErr?.message || logErr);
      }
    } else {
      console.log('[notifyCoachForEscalation] Coach email missing; skipping email send', {
        coachId: targetCoachId,
      });

      // Log missing email to Notification Logs dashboard (helps debug why nothing appears)
      try {
        const FieldValue = admin.firestore.FieldValue;
        await db.collection('notification-logs').add({
          fcmToken: 'EMAIL',
          title: `Coach escalation email skipped (Tier ${tier})`,
          body: 'Coach email missing on user profile; email not sent.',
          notificationType: 'COACH_ESCALATION_EMAIL',
          functionName: 'netlify/pulsecheck-chat.notifyCoachForEscalation',
          success: false,
          messageId: null,
          error: { code: 'MISSING_COACH_EMAIL', message: 'Coach user doc has no email.' },
          dataPayload: { channel: 'email', coachId: targetCoachId, athleteId: userId, escalationId, tier },
          timestamp: FieldValue.serverTimestamp(),
          timestampEpoch: nowSec,
          createdAt: FieldValue.serverTimestamp(),
          version: '1.0',
        });
      } catch (logErr) {
        console.warn('[notifyCoachForEscalation] Failed to write notification-logs for missing email (non-blocking):', logErr?.message || logErr);
      }
    }
  } catch (emailErr) {
    console.warn('[notifyCoachForEscalation] Coach email send failed (non-blocking):', emailErr?.message || emailErr);

    // Log email exception to Notification Logs dashboard
    try {
      const FieldValue = admin.firestore.FieldValue;
      await db.collection('notification-logs').add({
        fcmToken: 'EMAIL',
        title: `Coach escalation email error (Tier ${tier})`,
        body: 'Coach escalation email threw an exception (privacy-safe).',
        notificationType: 'COACH_ESCALATION_EMAIL',
        functionName: 'netlify/pulsecheck-chat.notifyCoachForEscalation',
        success: false,
        messageId: null,
        error: { code: emailErr?.code || 'EMAIL_EXCEPTION', message: emailErr?.message || String(emailErr) },
        dataPayload: { channel: 'email', coachId: targetCoachId, athleteId: userId, escalationId, tier },
        timestamp: FieldValue.serverTimestamp(),
        timestampEpoch: nowSec,
        createdAt: FieldValue.serverTimestamp(),
        version: '1.0',
      });
    } catch (logErr) {
      console.warn('[notifyCoachForEscalation] Failed to write notification-logs for email exception (non-blocking):', logErr?.message || logErr);
    }
  }

  return { success: true, coachId: targetCoachId };
}

exports.runtimeHelpers = {
  getTodaysNoraAssignment,
  getCurrentStateSnapshot,
  deriveConversationSignalAnalysis,
  refreshSnapshotFromConversationSignal,
  recoverSnapshotFromSavedConversation,
};
