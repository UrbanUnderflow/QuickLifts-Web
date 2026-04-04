const NOTIFICATION_LOGS_COLLECTION = 'notification-logs';

function truncateToken(token) {
  if (!token) return 'MISSING';
  return `${String(token).substring(0, 20)}...`;
}

function normalizeRecipients(recipients = [], fcmToken) {
  if (Array.isArray(recipients) && recipients.length > 0) {
    return recipients
      .filter((recipient) => recipient && typeof recipient === 'object')
      .map((recipient) => ({
        userId: recipient.userId || recipient.uid || recipient.id || null,
        username: recipient.username || null,
        displayName: recipient.displayName || recipient.name || null,
        email: recipient.email || null,
        tokenPreview: recipient.tokenPreview || truncateToken(recipient.fcmToken || recipient.token || fcmToken),
        deliveryChannel: recipient.deliveryChannel || recipient.channel || (recipient.email ? 'email' : 'push'),
      }))
      .map((recipient) => Object.fromEntries(Object.entries(recipient).filter(([, value]) => value !== null && value !== '')))
      .filter((recipient) => Object.keys(recipient).length > 0);
  }

  return fcmToken ? [{ tokenPreview: truncateToken(fcmToken), deliveryChannel: 'push' }] : [];
}
const {
  loadPilotOperationalState,
  resolvePilotEnrollmentContext,
} = require('./utils/pulsecheck-pilot-metrics');

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

function isBlockingOperationalStatus(value) {
  const normalized = sanitizeName(value).toLowerCase();
  return ['paused', 'withdrawn', 'watch_list', 'watchlist', 'restricted', 'restriction', 'manual_hold'].includes(normalized);
}

function isNudgeSuppressedByOperationalRestriction(state = null) {
  if (!state) return false;

  const effectiveFlags = state.effectiveRestrictionFlags || state.restrictionFlags || {};
  const baseStatus = sanitizeName(state.baseStatus || state.status);
  const restrictionState = sanitizeName(state.restrictionState || state.operationalStatus);

  return effectiveFlags.suppressNudges === true
    || effectiveFlags.manualHold === true
    || isBlockingOperationalStatus(baseStatus)
    || isBlockingOperationalStatus(restrictionState);
}

async function loadPulseCheckNudgeSuppressionState({
  db,
  athleteId,
  preferredPilotId = null,
  preferredPilotEnrollmentId = null,
  preferredTeamMembershipId = null,
  allowMembershipFallback = false,
} = {}) {
  const normalizedAthleteId = sanitizeName(athleteId);
  if (!db || !normalizedAthleteId) {
    return {
      suppressed: false,
      reason: 'missing_context',
      state: null,
      context: null,
    };
  }

  try {
    const context = await resolvePilotEnrollmentContext({
      db,
      athleteId: normalizedAthleteId,
      preferredPilotEnrollmentId,
      preferredPilotId,
      preferredTeamMembershipId,
      allowMembershipFallback,
    });

    if (!context?.pilotEnrollmentId) {
      return {
        suppressed: false,
        reason: 'no_pilot_enrollment',
        state: null,
        context,
      };
    }

    const state = await loadPilotOperationalState(db, context.pilotEnrollmentId, {
      pilotEnrollment: context.pilotEnrollment,
      teamMembership: context.teamMembership,
    });

    if (isNudgeSuppressedByOperationalRestriction(state)) {
      return {
        suppressed: true,
        reason: state?.effectiveRestrictionFlags?.manualHold === true ? 'manual_hold' : 'suppress_nudges',
        state,
        context,
      };
    }

    return {
      suppressed: false,
      reason: 'eligible',
      state,
      context,
    };
  } catch (error) {
    console.warn('[pulsecheck-notification-utils] Failed to resolve nudge suppression state:', error?.message || error);
    return {
      suppressed: false,
      reason: 'load_failed',
      error,
      state: null,
      context: null,
    };
  }
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
  recipients = [],
}) {
  if (!db) return null;

  try {
    const normalizedRecipients = normalizeRecipients(recipients, fcmToken);
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
      recipients: normalizedRecipients,
      recipientSummary: {
        total: normalizedRecipients.length,
        identifiedUsers: normalizedRecipients.filter(
          (recipient) => recipient.userId || recipient.username || recipient.displayName || recipient.email
        ).length,
      },
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
    const recipients = [{
      userId,
      username: additionalContext.username || additionalContext.userName || '',
      displayName: additionalContext.displayName || '',
      email: additionalContext.email || '',
      fcmToken: normalizedToken,
      deliveryChannel: 'push',
    }];
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
      recipients,
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
      recipients,
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
  isBlockingOperationalStatus,
  isNudgeSuppressedByOperationalRestriction,
  loadPulseCheckNudgeSuppressionState,
  resolvePulseCheckFcmToken,
  resolvePulseCheckPushTarget,
  sendLoggedNoraPush,
};
