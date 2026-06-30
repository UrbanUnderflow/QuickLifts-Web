const { FieldValue } = require('firebase-admin/firestore');

const DEVICES_COLLECTION = 'pulsecommand-operator-devices';
const LOGS_COLLECTION = 'pulsecommand-notification-logs';
const MAX_BODY_LENGTH = 220;

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function truncateToken(token) {
  const normalized = normalizeString(token);
  return normalized ? `${normalized.slice(0, 18)}...` : 'MISSING';
}

function normalizeData(values = {}) {
  return Object.entries(values).reduce((result, [key, value]) => {
    if (value === undefined || value === null) return result;
    if (Array.isArray(value)) {
      result[key] = value.map((item) => String(item)).join('|').slice(0, 1000);
    } else {
      result[key] = String(value).slice(0, 1000);
    }
    return result;
  }, {});
}

function compactBody(value) {
  const normalized = normalizeString(value).replace(/\s+/g, ' ');
  if (normalized.length <= MAX_BODY_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_BODY_LENGTH - 1)}…`;
}

function buildNotificationTitle({ agentName = '', operatorFields = {} } = {}) {
  const priority = normalizeString(operatorFields.operatorPriority).toLowerCase();
  const event = normalizeString(operatorFields.operatorEvent || operatorFields.proactiveType || 'update');
  const name = normalizeString(agentName) || 'Agent';

  if (priority === 'warning' || priority === 'urgent' || event === 'failed') {
    return `${name} needs attention`;
  }
  if (event.includes('complete')) return `${name} completed a task`;
  if (event.includes('finding') || event.includes('signal')) return `${name} found a signal`;
  return `${name} update`;
}

function isInvalidTokenError(error) {
  const code = normalizeString(error?.code);
  return code === 'messaging/registration-token-not-registered'
    || code === 'messaging/invalid-registration-token'
    || code === 'messaging/invalid-argument';
}

function buildOperatorPushMessage({ token, commandId, agentId, agentName, content, operatorFields = {} }) {
  const title = buildNotificationTitle({ agentName, operatorFields });
  const body = compactBody(operatorFields.operatorSummary || content || 'Open PulseCommand for the latest agent update.');
  const proactiveType = normalizeString(operatorFields.proactiveType || 'update');
  const priority = normalizeString(operatorFields.operatorPriority || 'update');

  return {
    token,
    notification: { title, body },
    data: normalizeData({
      type: 'PULSECOMMAND_OPERATOR_UPDATE',
      route: 'operator_inbox',
      commandId,
      agentId,
      agentName,
      proactiveType,
      operatorEvent: operatorFields.operatorEvent || proactiveType,
      operatorPriority: priority,
      taskId: operatorFields.taskId,
      taskName: operatorFields.taskName,
      missionId: operatorFields.missionId,
      requiresReply: operatorFields.requiresReply === true ? 'true' : 'false',
    }),
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-push-type': 'alert',
      },
      payload: {
        aps: {
          alert: {
            title,
            subtitle: priority === 'decision' ? 'Decision recommended' : 'PulseCommand',
            body,
          },
          badge: 1,
          sound: priority === 'update' ? 'default' : 'default',
          'thread-id': `pulsecommand-${agentId || 'operator'}`,
        },
      },
    },
  };
}

async function loadOperatorDevices(db) {
  const snap = await db.collection(DEVICES_COLLECTION).limit(100).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter((device) => device.enabled !== false)
    .filter((device) => normalizeString(device.fcmToken));
}

async function logOperatorPush({ db, commandId, agentId, agentName, device, success, messageId = '', error = null }) {
  try {
    await db.collection(LOGS_COLLECTION).add({
      commandId: commandId || '',
      agentId: agentId || '',
      agentName: agentName || '',
      deviceId: device?.id || '',
      ownerId: device?.ownerId || '',
      platform: device?.platform || '',
      app: device?.app || 'PulseCommand',
      tokenPreview: truncateToken(device?.fcmToken),
      success: success === true,
      messageId: messageId || null,
      error: error
        ? {
            code: error.code || 'UNKNOWN',
            message: error.message || 'Unknown push error',
          }
        : null,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (logError) {
    console.warn(`[operatorPush] Failed to write push log: ${logError.message}`);
  }
}

async function disableInvalidDeviceToken(db, device, error) {
  if (!device?.id || !isInvalidTokenError(error)) return;
  try {
    await db.collection(DEVICES_COLLECTION).doc(device.id).set({
      enabled: false,
      disabledAt: FieldValue.serverTimestamp(),
      disabledReason: error.code || 'invalid_fcm_token',
      lastError: error.message || 'Invalid FCM token',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch (disableError) {
    console.warn(`[operatorPush] Failed to disable invalid token for ${device.id}: ${disableError.message}`);
  }
}

async function sendOperatorPush({
  db,
  messaging,
  commandId = '',
  agentId = '',
  agentName = '',
  content = '',
  operatorFields = {},
} = {}) {
  if (!db || !messaging) {
    return { success: false, sent: 0, failed: 0, error: 'Missing db or messaging client' };
  }

  const devices = await loadOperatorDevices(db);
  if (devices.length === 0) {
    return { success: true, sent: 0, failed: 0, reason: 'no_registered_operator_devices' };
  }

  let sent = 0;
  let failed = 0;

  for (const device of devices) {
    const message = buildOperatorPushMessage({
      token: device.fcmToken,
      commandId,
      agentId,
      agentName,
      content,
      operatorFields,
    });

    try {
      const messageId = await messaging.send(message);
      sent += 1;
      await logOperatorPush({ db, commandId, agentId, agentName, device, success: true, messageId });
    } catch (error) {
      failed += 1;
      await logOperatorPush({ db, commandId, agentId, agentName, device, success: false, error });
      await disableInvalidDeviceToken(db, device, error);
      console.warn(`[operatorPush] Failed to send PulseCommand push to ${device.id}: ${error.message}`);
    }
  }

  return { success: failed === 0, sent, failed };
}

module.exports = {
  buildOperatorPushMessage,
  sendOperatorPush,
};
