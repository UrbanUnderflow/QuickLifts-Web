const { admin, headers, initializeFirebaseAdmin } = require('./config/firebase');

const DEVICES_COLLECTION = 'pulsecommand-operator-devices';
const GROUP_CHATS_COLLECTION = 'agent-group-chats';
const COMMANDS_COLLECTION = 'agent-commands';
const DEFAULT_MACRA_CHAT_ID = 'macra-growth-ops-roundtable';
const MACRA_MISSION_ID = 'macra-growth-ops';
const ALLOWED_AGENTS = ['nora', 'scout', 'solara', 'sage'];

const jsonHeaders = {
  ...headers,
  'Access-Control-Allow-Headers': `${headers['Access-Control-Allow-Headers']}, X-PulseCommand-Operator-Secret`,
  'Content-Type': 'application/json',
};

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeAgentId(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeParticipants(value) {
  const raw = Array.isArray(value) ? value : [];
  const normalized = raw.map(normalizeAgentId).filter((id) => ALLOWED_AGENTS.includes(id));
  const priority = ALLOWED_AGENTS.filter((id) => normalized.includes(id));
  const rest = normalized.filter((id) => !priority.includes(id));
  return [...new Set([...priority, ...rest])];
}

function resolveMode(value) {
  const mode = normalizeString(value).toLowerCase();
  return ['brainstorm', 'task', 'command'].includes(mode) ? mode : 'task';
}

function resolveMissionPhase(value) {
  const phase = normalizeString(value).toLowerCase();
  if (phase === 'planning' || phase === 'strategy') return 'planning';
  return 'execution';
}

function resolveMeetingPhase(value, missionPhase) {
  const phase = normalizeString(value).toLowerCase();
  if (phase === 'strategy' || phase === 'planning') return 'strategy';
  if (phase === 'action' || phase === 'execution' || phase === 'task') return 'action';
  return missionPhase === 'planning' ? 'strategy' : 'action';
}

function extractMentionedAgents(content, participants) {
  const lower = content.toLowerCase();
  return participants.filter((agentId) => lower.includes(`@${agentId}`));
}

function buildTurnState(participants, content) {
  const mentionedAgents = extractMentionedAgents(content, participants);
  const turnOrder = mentionedAgents.length
    ? [...mentionedAgents, ...participants.filter((id) => !mentionedAgents.includes(id))]
    : participants;

  return {
    participants,
    turnOrder,
    coordinator: 'nora',
    turnIndex: 0,
    currentTurnAgent: turnOrder[0] || null,
    turnSlaMs: 30000,
    currentTurnStartedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
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
  const deviceId = normalizeString(body.deviceId).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 120);
  if (!deviceId) {
    const error = new Error('PulseCommand device is not registered');
    error.statusCode = 401;
    throw error;
  }

  const deviceRef = db.collection(DEVICES_COLLECTION).doc(deviceId);
  const snap = await deviceRef.get();
  if (!snap.exists) {
    await deviceRef.set({
      ownerId: 'admin',
      app: 'PulseCommand',
      platform: 'ios',
      bundleId: 'com.fitwithpulse.command',
      enabled: true,
      registrationSource: 'roundtable-bootstrap',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return;
  }

  const data = snap.data() || {};
  if (data.enabled === false || data.bundleId !== 'com.fitwithpulse.command') {
    const error = new Error('PulseCommand device is not authorized');
    error.statusCode = 403;
    throw error;
  }
}

function resolveChatId(body) {
  const chatId = normalizeString(body.chatId);
  return chatId || DEFAULT_MACRA_CHAT_ID;
}

async function ensureChatSession(db, chatId, participants, missionPhase, meetingPhase) {
  const chatRef = db.collection(GROUP_CHATS_COLLECTION).doc(chatId);
  const snap = await chatRef.get();
  const payload = {
    participants,
    createdBy: 'admin',
    status: 'active',
    phase: missionPhase === 'planning' ? 'mission-kickoff' : 'mission-execution',
    context: {
      missionId: MACRA_MISSION_ID,
      northStarTitle: 'Macra Trial-Start Operating System',
      missionSummary: 'Macra operating mission seeded. Agents observe, recommend, decide, and log before changing the funnel.',
      missionPhase,
      meetingPhase,
      participants,
    },
    metadata: {
      messageCount: admin.firestore.FieldValue.increment(0),
      sessionDuration: 0,
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (snap.exists) {
    await chatRef.set(payload, { merge: true });
  } else {
    await chatRef.set({
      ...payload,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  return chatRef;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: jsonHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: jsonHeaders,
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  try {
    initializeFirebaseAdmin({ headers: event.headers || {} });
    const db = admin.firestore();
    const body = event.body ? JSON.parse(event.body) : {};
    body.event = event;

    const bundleId = normalizeString(body.bundleId);
    if (bundleId !== 'com.fitwithpulse.command') {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ success: false, error: 'Invalid PulseCommand bundle id' }),
      };
    }

    if (!isAuthorizedBySecret(event)) {
      await assertRegisteredDevice(db, body);
    }

    const content = normalizeString(body.content);
    if (!content || content.length > 5000) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ success: false, error: 'Message content is required and must be under 5000 characters' }),
      };
    }

    const participants = normalizeParticipants(body.participants);
    if (participants.length === 0) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ success: false, error: 'At least one Macra agent participant is required' }),
      };
    }

    const mode = resolveMode(body.mode);
    const missionPhase = resolveMissionPhase(body.missionPhase);
    const meetingPhase = resolveMeetingPhase(body.meetingPhase, missionPhase);
    const chatId = resolveChatId(body);
    const chatRef = await ensureChatSession(db, chatId, participants, missionPhase, meetingPhase);
    const messageRef = chatRef.collection('messages').doc();
    const mentionedAgents = extractMentionedAgents(content, participants);
    const turnState = buildTurnState(participants, content);

    const responses = {};
    participants.forEach((agentId) => {
      responses[agentId] = {
        content: '',
        status: 'pending',
      };
    });

    const batch = db.batch();
    batch.set(messageRef, {
      from: normalizeString(body.from) || 'admin',
      content,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      broadcastedAt: admin.firestore.FieldValue.serverTimestamp(),
      responses,
      allCompleted: false,
      mode,
      turnState,
      context: {
        missionPhase,
        meetingPhase,
        context: content,
      },
    });

    participants.forEach((agentId) => {
      const commandRef = db.collection(COMMANDS_COLLECTION).doc();
      batch.set(commandRef, {
        from: 'admin',
        to: agentId,
        type: 'group-chat',
        content,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        groupChatId: chatRef.id,
        messageId: messageRef.id,
        context: {
          otherAgents: participants.filter((id) => id !== agentId),
          mentionedAgents,
          turnState,
          turnSlaMs: 30000,
          followUpDepth: 0,
          meetingPhase,
          missionPhase,
        },
      });
    });

    batch.set(chatRef, {
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: {
        messageCount: admin.firestore.FieldValue.increment(1),
      },
    }, { merge: true });

    await batch.commit();

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: true,
        chatId: chatRef.id,
        messageId: messageRef.id,
        participants,
      }),
    };
  } catch (error) {
    console.error('[pulsecommand-roundtable-broadcast] Error:', error);
    return {
      statusCode: error.statusCode || 500,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Failed to broadcast PulseCommand Round Table message',
      }),
    };
  }
};
