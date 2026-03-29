const NOTIFICATION_LOGS_COLLECTION = 'notification-logs';

function truncateToken(fcmToken) {
  return fcmToken ? `${String(fcmToken).substring(0, 20)}...` : 'MISSING';
}

function normalizeStringMap(values = {}) {
  return Object.entries(values).reduce((result, [key, value]) => {
    if (value === undefined || value === null) {
      return result;
    }

    result[key] = typeof value === 'string' ? value : String(value);
    return result;
  }, {});
}

function sanitizeName(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function resolvePulseCheckFcmToken(userData = {}) {
  return sanitizeName(userData.pulseCheckFcmToken);
}

function resolvePulseCheckPushTarget(userData = {}) {
  const token = resolvePulseCheckFcmToken(userData);
  if (!token) {
    return { token: '', eligible: false, reason: 'missing_pulsecheck_fcm_token' };
  }

  const sourceApp = sanitizeName(userData.pushTokenSourceApp).toLowerCase();
  if (sourceApp !== 'pulsecheck') {
    return {
      token: '',
      eligible: false,
      reason: sourceApp ? 'pulsecheck_source_app_mismatch' : 'missing_pulsecheck_source_app',
    };
  }

  return { token, eligible: true, reason: 'eligible' };
}

function resolveAthleteFirstName(userData = {}) {
  const preferredName = sanitizeName(userData.preferredName);
  if (preferredName) return preferredName.split(/\s+/)[0];

  const displayName = sanitizeName(userData.displayName);
  if (displayName) return displayName.split(/\s+/)[0];

  const username = sanitizeName(userData.username);
  if (username) return username;

  return '';
}

function buildGreeting(name) {
  const trimmed = sanitizeName(name);
  return trimmed ? `Hey ${trimmed},` : 'Hey,';
}

function buildNoraBiometricBriefNotification({
  athleteName = '',
  snapshotDateKey = '',
  observedDateKey = '',
} = {}) {
  const prompt = "Hey Nora, walk me through my biometric brief.";
  const assistantOpeningMessage = "Your biometric brief is ready. I can walk you through what your latest recovery signals are saying and what to do with them.";
  const launchSubtitle = "Opening Nora with your latest biometric brief.";

  return {
    title: 'Nora',
    body: `${buildGreeting(athleteName)} your biometric brief is ready. Let's talk about it.`,
    subtitle: 'Biometric brief ready',
    notificationType: 'BIOMETRIC_BRIEF_READY',
    data: normalizeStringMap({
      type: 'BIOMETRIC_BRIEF_READY',
      dmKind: 'biometric_brief_ready',
      route: 'nora_chat',
      prompt,
      assistantOpeningMessage,
      launchSubtitle,
      snapshotDateKey,
      observedDateKey,
      timestamp: Date.now(),
    }),
  };
}

function buildNoraDailyReflectionNotification({
  athleteName = '',
  localDate = '',
} = {}) {
  const prompt = "Hey Nora, here's how my day went...";
  const assistantOpeningMessage = "Hey, how was your day? Give me the real version and I'll help you make sense of it.";
  const launchSubtitle = "Opening Nora for your end-of-day debrief.";

  return {
    title: 'Nora',
    body: `${buildGreeting(athleteName)} how was your day? I'm ready when you are.`,
    subtitle: 'End-of-day check-in',
    notificationType: 'DAILY_REFLECTION',
    data: normalizeStringMap({
      type: 'DAILY_REFLECTION',
      dmKind: 'end_of_day_reflection',
      route: 'nora_chat',
      prompt,
      assistantOpeningMessage,
      launchSubtitle,
      localDate,
      timestamp: Date.now(),
    }),
  };
}

function buildNoraPushMessage({
  fcmToken,
  title,
  body,
  subtitle = '',
  data = {},
}) {
  const normalizedData = normalizeStringMap(data);

  return {
    token: fcmToken,
    notification: {
      title,
      body,
    },
    data: normalizedData,
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-push-type': 'alert',
      },
      payload: {
        aps: {
          alert: {
            title,
            subtitle,
            body,
          },
          badge: 1,
          sound: 'default',
          category: 'NORA_DM',
          'thread-id': 'nora-dm',
        },
      },
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
      },
    },
  };
}

function classifyMessagingFailure(error) {
  const code = typeof error?.code === 'string' ? error.code.trim() : '';
  const message = typeof error?.message === 'string' ? error.message.trim() : '';

  if (code === 'messaging/third-party-auth-error') {
    return {
      failureCategory: 'apns_or_fcm_credential_misconfigured',
      errorCode: code,
      message,
      needsConsoleConfig: true,
      recommendedAction: 'Check Firebase Cloud Messaging APNs credentials for the PulseCheck iOS app in Firebase console.',
    };
  }

  return {
    failureCategory: 'unknown_messaging_failure',
    errorCode: code || 'UNKNOWN',
    message,
    needsConsoleConfig: false,
    recommendedAction: null,
  };
}

async function logNotification({
  db,
  fcmToken,
  title,
  body,
  dataPayload = {},
  notificationType = 'UNKNOWN',
  functionName = 'netlify/pulsecheck-notification-utils',
  success = false,
  messageId = null,
  error = null,
  additionalContext = {},
}) {
  if (!db) return null;

  try {
    const logEntry = {
      fcmToken: truncateToken(fcmToken),
      title,
      body,
      dataPayload,
      notificationType,
      functionName,
      success,
      messageId,
      error: error
        ? {
            code: error.code || 'UNKNOWN',
            message: error.message || 'Unknown error',
            details: error.details || null,
          }
        : null,
      additionalContext,
      timestamp: new Date(),
      timestampEpoch: Math.floor(Date.now() / 1000),
      createdAt: new Date(),
      version: '1.0',
    };

    const logRef = await db.collection(NOTIFICATION_LOGS_COLLECTION).add(logEntry);
    return logRef.id;
  } catch (logError) {
    console.error('[pulsecheck-notification-utils] Failed to write notification log:', logError);
    return null;
  }
}

async function sendLoggedNoraPush({
  messaging,
  db,
  userId = '',
  fcmToken,
  title,
  body,
  subtitle = '',
  data = {},
  notificationType = 'UNKNOWN',
  functionName = 'netlify/pulsecheck-notification-utils',
  additionalContext = {},
}) {
  if (!messaging) {
    return { success: false, error: 'Messaging client is required' };
  }

  if (!fcmToken || typeof fcmToken !== 'string' || !fcmToken.trim()) {
    return { success: false, error: 'Missing FCM token' };
  }

  const normalizedToken = fcmToken.trim();
  const message = buildNoraPushMessage({
    fcmToken: normalizedToken,
    title,
    body,
    subtitle,
    data,
  });

  try {
    const messageId = await messaging.send(message);
    const logId = await logNotification({
      db,
      fcmToken: normalizedToken,
      title,
      body,
      dataPayload: data,
      notificationType,
      functionName,
      success: true,
      messageId,
      additionalContext: {
        userId,
        ...additionalContext,
      },
    });

    return { success: true, messageId, logId };
  } catch (error) {
    const failure = classifyMessagingFailure(error);
    const logId = await logNotification({
      db,
      fcmToken: normalizedToken,
      title,
      body,
      dataPayload: data,
      notificationType,
      functionName,
      success: false,
      error: {
        ...(error || {}),
        code: failure.errorCode,
        message: failure.message || error?.message || 'Unknown error',
        details: failure.recommendedAction,
      },
      additionalContext: {
        userId,
        failureCategory: failure.failureCategory,
        needsConsoleConfig: failure.needsConsoleConfig,
        recommendedAction: failure.recommendedAction,
        ...additionalContext,
      },
    });

    const logPayload = {
      code: failure.errorCode,
      failureCategory: failure.failureCategory,
      needsConsoleConfig: failure.needsConsoleConfig,
      recommendedAction: failure.recommendedAction,
      message: failure.message || error?.message || 'Unknown error',
    };
    if (failure.needsConsoleConfig) {
      console.warn('[pulsecheck-notification-utils] Nora push is unavailable until APNs/FCM credentials are fixed:', logPayload);
    } else {
      console.error('[pulsecheck-notification-utils] Failed to send Nora push:', logPayload);
    }
    return {
      success: false,
      error: failure.message || error?.message || 'Unknown error',
      errorCode: failure.errorCode,
      failureCategory: failure.failureCategory,
      needsConsoleConfig: failure.needsConsoleConfig,
      recommendedAction: failure.recommendedAction,
      logId,
    };
  }
}

module.exports = {
  buildNoraBiometricBriefNotification,
  buildNoraDailyReflectionNotification,
  buildNoraPushMessage,
  classifyMessagingFailure,
  normalizeStringMap,
  resolveAthleteFirstName,
  resolvePulseCheckFcmToken,
  resolvePulseCheckPushTarget,
  sendLoggedNoraPush,
};
