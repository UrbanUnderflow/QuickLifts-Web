const { admin, headers, initializeFirebaseAdmin } = require('./config/firebase');
const { sendOperatorPush } = require('../../scripts/operatorPush');

const jsonHeaders = {
  ...headers,
  'Access-Control-Allow-Headers': `${headers['Access-Control-Allow-Headers']}, X-PulseCommand-Operator-Push-Secret`,
  'Content-Type': 'application/json',
};

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isAuthorized(event) {
  const expectedSecret = normalizeString(process.env.PULSECOMMAND_OPERATOR_PUSH_SECRET);
  if (!expectedSecret) {
    return process.env.NODE_ENV !== 'production';
  }

  const authHeader = normalizeString(event.headers?.authorization || event.headers?.Authorization);
  const explicitHeader = normalizeString(
    event.headers?.['x-pulsecommand-operator-push-secret']
    || event.headers?.['X-PulseCommand-Operator-Push-Secret']
  );

  return authHeader === `Bearer ${expectedSecret}` || explicitHeader === expectedSecret;
}

function operatorFieldsFromDoc(data = {}) {
  return {
    proactiveType: data.proactiveType || data.metadata?.proactiveType || 'update',
    operatorEvent: data.operatorEvent || data.metadata?.operatorEvent || data.proactiveType || 'update',
    operatorPriority: data.operatorPriority || data.metadata?.operatorPriority || 'update',
    operatorSummary: data.operatorSummary || data.content || 'PulseCommand update',
    taskId: data.taskId || data.metadata?.taskId || '',
    taskName: data.taskName || data.metadata?.taskName || '',
    missionId: data.missionId || data.metadata?.missionId || '',
    requiresReply: data.requiresReply === true || data.metadata?.requiresReply === 'true',
  };
}

async function loadCommandPayload(db, commandId) {
  const normalizedCommandId = normalizeString(commandId);
  if (!normalizedCommandId) return null;

  const snap = await db.collection('agent-commands').doc(normalizedCommandId).get();
  if (!snap.exists) {
    const error = new Error('Command not found');
    error.statusCode = 404;
    throw error;
  }

  const data = snap.data() || {};
  return {
    commandId: snap.id,
    agentId: normalizeString(data.from) || 'agent',
    agentName: normalizeString(data.agentName) || normalizeString(data.from) || 'Agent',
    content: normalizeString(data.content) || normalizeString(data.response) || 'PulseCommand update',
    operatorFields: operatorFieldsFromDoc(data),
  };
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

  if (!isAuthorized(event)) {
    return {
      statusCode: 401,
      headers: jsonHeaders,
      body: JSON.stringify({ success: false, error: 'Unauthorized' }),
    };
  }

  try {
    initializeFirebaseAdmin({ headers: event.headers || {} });
    const db = admin.firestore();
    const body = event.body ? JSON.parse(event.body) : {};

    const commandPayload = await loadCommandPayload(db, body.commandId);
    const payload = commandPayload || {
      commandId: normalizeString(body.commandId),
      agentId: normalizeString(body.agentId) || 'nora',
      agentName: normalizeString(body.agentName) || 'Nora',
      content: normalizeString(body.content) || 'PulseCommand push test from QuickLifts-Web.',
      operatorFields: {
        proactiveType: normalizeString(body.proactiveType) || 'test',
        operatorEvent: normalizeString(body.operatorEvent) || 'test',
        operatorPriority: normalizeString(body.operatorPriority) || 'update',
        operatorSummary: normalizeString(body.operatorSummary) || normalizeString(body.summary) || 'PulseCommand push test',
        taskId: normalizeString(body.taskId),
        taskName: normalizeString(body.taskName),
        missionId: normalizeString(body.missionId),
        requiresReply: body.requiresReply === true,
      },
    };

    const result = await sendOperatorPush({
      db,
      messaging: admin.messaging(),
      ...payload,
    });

    return {
      statusCode: result.success ? 200 : 207,
      headers: jsonHeaders,
      body: JSON.stringify({ success: result.success, ...result }),
    };
  } catch (error) {
    console.error('[pulsecommand-send-operator-push] Error:', error);
    return {
      statusCode: error.statusCode || 500,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Failed to send PulseCommand push',
      }),
    };
  }
};
