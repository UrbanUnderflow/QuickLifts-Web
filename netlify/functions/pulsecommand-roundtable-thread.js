const { admin, headers, initializeFirebaseAdmin } = require('./config/firebase');

const DEVICES_COLLECTION = 'pulsecommand-operator-devices';
const GROUP_CHATS_COLLECTION = 'agent-group-chats';
const DEFAULT_MACRA_CHAT_ID = 'macra-growth-ops-roundtable';
const ALLOWED_BUNDLE_IDS = new Set(['com.fitwithpulse.command']);

const jsonHeaders = {
  ...headers,
  'Access-Control-Allow-Headers': `${headers['Access-Control-Allow-Headers']}, X-PulseCommand-Operator-Secret`,
  'Content-Type': 'application/json',
};

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLimit(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 80;
  return Math.min(parsed, 200);
}

function sanitizeDeviceId(value) {
  return normalizeString(value).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 120);
}

function isAuthorizedBySecret(event) {
  const expectedSecret = normalizeString(process.env.PULSECOMMAND_OPERATOR_SECRET);
  if (!expectedSecret) return false;

  const authHeader = normalizeString(event.headers?.authorization || event.headers?.Authorization);
  const explicitHeader = normalizeString(
    event.headers?.['x-pulsecommand-operator-secret']
    || event.headers?.['X-PulseCommand-Operator-Secret']
  );

  return authHeader === `Bearer ${expectedSecret}` || explicitHeader === expectedSecret;
}

async function assertRegisteredDevice(db, body) {
  const deviceId = sanitizeDeviceId(body.deviceId);
  if (!deviceId) {
    const error = new Error('PulseCommand device is not registered');
    error.statusCode = 401;
    throw error;
  }

  const deviceRef = db.collection(DEVICES_COLLECTION).doc(deviceId);
  const snap = await deviceRef.get();
  if (!snap.exists) {
    const error = new Error('PulseCommand device is not registered');
    error.statusCode = 401;
    throw error;
  }

  const data = snap.data() || {};
  if (data.enabled === false || data.bundleId !== 'com.fitwithpulse.command') {
    const error = new Error('PulseCommand device is not authorized');
    error.statusCode = 403;
    throw error;
  }
}

function timestampIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

function timestampMs(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  return null;
}

function serializeTimestampFields(data, field) {
  return {
    [field]: timestampIso(data?.[field]),
    [`${field}Ms`]: timestampMs(data?.[field]),
  };
}

function serializeAgentResponse(response = {}) {
  return {
    content: normalizeString(response.content),
    status: normalizeString(response.status) || 'pending',
    error: normalizeString(response.error),
    timedOutReason: normalizeString(response.timedOutReason),
    ...serializeTimestampFields(response, 'startedAt'),
    ...serializeTimestampFields(response, 'completedAt'),
    ...serializeTimestampFields(response, 'timedOutAt'),
  };
}

function serializeResponses(value = {}) {
  const responses = {};
  for (const [agentId, response] of Object.entries(value || {})) {
    responses[agentId] = serializeAgentResponse(response || {});
  }
  return responses;
}

function serializeTurnState(value = {}) {
  if (!value || typeof value !== 'object') return null;
  return {
    participants: Array.isArray(value.participants) ? value.participants : [],
    turnOrder: Array.isArray(value.turnOrder) ? value.turnOrder : [],
    coordinator: normalizeString(value.coordinator),
    turnIndex: Number.isFinite(Number(value.turnIndex)) ? Number(value.turnIndex) : 0,
    currentTurnAgent: normalizeString(value.currentTurnAgent),
    turnSlaMs: Number.isFinite(Number(value.turnSlaMs)) ? Number(value.turnSlaMs) : 30000,
    currentTurnStartedAt: timestampIso(value.currentTurnStartedAt),
    currentTurnStartedAtMs: timestampMs(value.currentTurnStartedAt),
  };
}

function serializeMessage(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    from: normalizeString(data.from),
    fromName: normalizeString(data.fromName),
    content: normalizeString(data.content),
    responses: serializeResponses(data.responses || {}),
    allCompleted: data.allCompleted === true,
    mode: normalizeString(data.mode),
    meetingPhase: normalizeString(data.meetingPhase || data.context?.meetingPhase),
    missionPhase: normalizeString(data.missionPhase || data.context?.missionPhase),
    isFollowUp: data.isFollowUp === true,
    threadDepth: Number.isFinite(Number(data.threadDepth)) ? Number(data.threadDepth) : 0,
    turnState: serializeTurnState(data.turnState),
    context: {
      missionPhase: normalizeString(data.context?.missionPhase),
      meetingPhase: normalizeString(data.context?.meetingPhase),
      context: normalizeString(data.context?.context),
      teamId: normalizeString(data.context?.teamId),
      missionId: normalizeString(data.context?.missionId),
    },
    ...serializeTimestampFields(data, 'createdAt'),
    ...serializeTimestampFields(data, 'broadcastedAt'),
  };
}

function serializeChat(doc) {
  if (!doc.exists) return null;
  const data = doc.data() || {};
  return {
    id: doc.id,
    participants: Array.isArray(data.participants) ? data.participants : [],
    createdBy: normalizeString(data.createdBy),
    status: normalizeString(data.status),
    phase: normalizeString(data.phase),
    context: {
      missionId: normalizeString(data.context?.missionId),
      northStarTitle: normalizeString(data.context?.northStarTitle),
      missionSummary: normalizeString(data.context?.missionSummary),
      missionPhase: normalizeString(data.context?.missionPhase),
      meetingPhase: normalizeString(data.context?.meetingPhase),
      participants: Array.isArray(data.context?.participants) ? data.context.participants : [],
    },
    metadata: {
      messageCount: Number.isFinite(Number(data.metadata?.messageCount)) ? Number(data.metadata.messageCount) : 0,
      sessionDuration: Number.isFinite(Number(data.metadata?.sessionDuration)) ? Number(data.metadata.sessionDuration) : 0,
    },
    ...serializeTimestampFields(data, 'createdAt'),
    ...serializeTimestampFields(data, 'lastMessageAt'),
    ...serializeTimestampFields(data, 'updatedAt'),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: jsonHeaders, body: '' };
  }

  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return {
      statusCode: 405,
      headers: jsonHeaders,
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  try {
    initializeFirebaseAdmin({ headers: event.headers || {} });
    const db = admin.firestore();
    const query = event.queryStringParameters || {};
    const body = event.body ? JSON.parse(event.body) : {};
    const payload = { ...query, ...body };
    const bundleId = normalizeString(payload.bundleId);

    if (bundleId && !ALLOWED_BUNDLE_IDS.has(bundleId)) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ success: false, error: 'Invalid PulseCommand bundle id' }),
      };
    }

    if (!isAuthorizedBySecret(event)) {
      await assertRegisteredDevice(db, payload);
    }

    const chatId = normalizeString(payload.chatId) || DEFAULT_MACRA_CHAT_ID;
    const limit = normalizeLimit(payload.limit);
    const chatRef = db.collection(GROUP_CHATS_COLLECTION).doc(chatId);
    const [chatSnap, messageSnap] = await Promise.all([
      chatRef.get(),
      chatRef.collection('messages').orderBy('createdAt', 'desc').limit(limit).get(),
    ]);

    const messages = messageSnap.docs
      .map(serializeMessage)
      .reverse();

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: true,
        chatId,
        chat: serializeChat(chatSnap),
        messages,
      }),
    };
  } catch (error) {
    console.error('[pulsecommand-roundtable-thread] Error:', error);
    return {
      statusCode: error.statusCode || 500,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Failed to load PulseCommand Round Table thread',
      }),
    };
  }
};
