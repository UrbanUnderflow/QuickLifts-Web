const MAX_MESSAGE_LENGTH = 4_000;
const MAX_PUSH_INSTALLATIONS = 100;
const PULSE_CHECK_PUSH_MODEL_VERSION = 2;
const STALE_PUSH_TOKEN_ERROR_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

const normalizeString = (value) => (
  typeof value === 'string' ? value.trim() : ''
);

const normalizeParticipantIds = (value) => (
  Array.isArray(value)
    ? [...new Set(value.map(normalizeString).filter(Boolean))].sort()
    : []
);

function timestampToMillis(value) {
  if (value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }

  if (value && typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const seconds = value?._seconds ?? value?.seconds;
  const nanoseconds = value?._nanoseconds ?? value?.nanoseconds ?? 0;
  if (typeof seconds === 'number' && Number.isFinite(seconds)) {
    return (seconds * 1_000) + Math.floor(nanoseconds / 1_000_000);
  }

  return 0;
}

function normalizePushInstallationRecord(record = {}) {
  const data = record.data && typeof record.data === 'object'
    ? record.data
    : {};
  const documentId = normalizeString(record.id);
  const installationId = normalizeString(data.installationId);
  const ownerUserId = normalizeString(data.ownerUserId);
  const token = normalizeString(data.token);
  const sourceApp = normalizeString(data.sourceApp).toLowerCase();
  const platform = normalizeString(data.platform).toLowerCase();

  if (
    !documentId
    || documentId !== installationId
    || !ownerUserId
    || !token
    || sourceApp !== 'pulsecheck'
    || !['ios', 'ipados', 'android', 'web'].includes(platform)
  ) {
    return null;
  }

  return {
    documentId,
    installationId,
    ownerUserId,
    token,
    sourceApp,
    platform,
    updatedAtMillis: timestampToMillis(data.updatedAt),
  };
}

function collectPulseCheckPushCandidateTokens({
  recipientId,
  userData = {},
  installationRecords = [],
}) {
  const normalizedRecipientId = normalizeString(recipientId);
  const records = Array.isArray(installationRecords)
    ? installationRecords.slice(0, MAX_PUSH_INSTALLATIONS)
    : [];
  const modelVersion = Number(userData.pulseCheckPushTokenModelVersion) || 0;
  const modelEnabled = modelVersion >= PULSE_CHECK_PUSH_MODEL_VERSION
    || records.length > 0;
  const candidates = [];

  if (modelEnabled) {
    records.forEach((record) => {
      const normalized = normalizePushInstallationRecord(record);
      if (normalized?.ownerUserId === normalizedRecipientId) {
        candidates.push({
          token: normalized.token,
          source: 'installation',
          installationId: normalized.installationId,
          documentId: normalized.documentId,
        });
      }
    });
  } else {
    const token = normalizeString(userData.pulseCheckFcmToken);
    const sourceApp = normalizeString(userData.pushTokenSourceApp).toLowerCase();
    const declaredOwner = normalizeString(
      userData.pulseCheckFcmTokenOwnerUserId
    );
    if (
      token
      && sourceApp === 'pulsecheck'
      && (!declaredOwner || declaredOwner === normalizedRecipientId)
    ) {
      candidates.push({
        token,
        source: 'legacy',
        installationId: '',
        documentId: '',
      });
    }
  }

  return {
    modelEnabled,
    candidates,
    tokens: [...new Set(candidates.map(({ token }) => token))],
  };
}

function resolveCurrentClaimsByToken(claimRecords = []) {
  const claimsByToken = new Map();

  claimRecords.forEach((record) => {
    const normalized = normalizePushInstallationRecord(record);
    if (!normalized) {
      return;
    }

    const current = claimsByToken.get(normalized.token);
    if (!current || normalized.updatedAtMillis > current.updatedAtMillis) {
      claimsByToken.set(normalized.token, {
        ...normalized,
        ambiguous: false,
      });
      return;
    }

    if (
      normalized.updatedAtMillis === current.updatedAtMillis
      && (
        normalized.ownerUserId !== current.ownerUserId
        || normalized.installationId !== current.installationId
      )
    ) {
      claimsByToken.set(normalized.token, {
        ...current,
        ambiguous: true,
      });
    }
  });

  return claimsByToken;
}

function resolvePulseCheckPushTargets({
  recipientId,
  userData = {},
  installationRecords = [],
  claimRecords = [],
}) {
  const normalizedRecipientId = normalizeString(recipientId);
  const collected = collectPulseCheckPushCandidateTokens({
    recipientId: normalizedRecipientId,
    userData,
    installationRecords,
  });
  const claimsByToken = resolveCurrentClaimsByToken(claimRecords);
  const targetsByToken = new Map();

  collected.candidates.forEach((candidate) => {
    const currentClaim = claimsByToken.get(candidate.token);
    const isAccepted = candidate.source === 'installation'
      ? Boolean(
        currentClaim
        && !currentClaim.ambiguous
        && currentClaim.ownerUserId === normalizedRecipientId
        && currentClaim.installationId === candidate.installationId
      )
      : Boolean(
        !currentClaim
        || (
          !currentClaim.ambiguous
          && currentClaim.ownerUserId === normalizedRecipientId
        )
      );
    if (!isAccepted) {
      return;
    }

    const currentTarget = targetsByToken.get(candidate.token) || {
      token: candidate.token,
      source: candidate.source,
      installations: [],
    };
    if (candidate.source === 'installation') {
      currentTarget.installations.push({
        installationId: candidate.installationId,
        documentId: candidate.documentId,
      });
    }
    targetsByToken.set(candidate.token, currentTarget);
  });

  return {
    modelEnabled: collected.modelEnabled,
    targets: [...targetsByToken.values()],
  };
}

function isStalePushTokenError(error) {
  return STALE_PUSH_TOKEN_ERROR_CODES.has(normalizeString(error?.code));
}

function resolvePulseCheckSenderName(userData = {}, senderType = '') {
  const firstAndLast = [userData.firstName, userData.lastName]
    .map(normalizeString)
    .filter(Boolean)
    .join(' ');
  const resolved = [
    userData.displayName,
    userData.name,
    firstAndLast,
    userData.username,
  ].map(normalizeString).find(Boolean);
  return resolved?.slice(0, 100)
    || (normalizeString(senderType).toLowerCase() === 'coach'
      ? 'Your coach'
      : 'Your athlete');
}

function resolveCoachAthleteMessageEnvelope(messageData = {}, conversationData = {}) {
  const conversationId = normalizeString(messageData.conversationId);
  const coachId = normalizeString(conversationData.coachId);
  const athleteId = normalizeString(conversationData.athleteId);
  const senderId = normalizeString(messageData.senderId);
  const senderType = normalizeString(messageData.senderType).toLowerCase();
  const content = normalizeString(messageData.content);
  const messageType = normalizeString(messageData.messageType).toLowerCase() || 'text';
  const teamId = normalizeString(conversationData.teamId);
  const organizationId = normalizeString(conversationData.organizationId);
  const participantIds = normalizeParticipantIds(conversationData.participantIds);
  const hasAnyModernScope = Boolean(teamId || organizationId || participantIds.length);
  const expectedParticipantIds = [athleteId, coachId].filter(Boolean).sort();

  if (
    !conversationId
    || !coachId
    || !athleteId
    || coachId === athleteId
    || !senderId
    || !content
    || content.length > MAX_MESSAGE_LENGTH
    || !['coach', 'athlete'].includes(senderType)
    || !['text', 'image', 'file'].includes(messageType)
  ) {
    return null;
  }

  if (
    hasAnyModernScope
    && (
      !teamId
      || !organizationId
      || participantIds.length !== 2
      || participantIds.some(
        (participantId, index) => participantId !== expectedParticipantIds[index]
      )
    )
  ) {
    return null;
  }

  const expectedSenderId = senderType === 'coach' ? coachId : athleteId;
  if (senderId !== expectedSenderId) {
    return null;
  }

  const recipientId = senderType === 'coach' ? athleteId : coachId;
  const senderName = normalizeString(
    senderType === 'coach'
      ? conversationData.coachName
      : conversationData.athleteName
  ) || (senderType === 'coach' ? 'Your coach' : 'Your athlete');

  return {
    conversationId,
    coachId,
    athleteId,
    senderId,
    senderType,
    recipientId,
    senderName,
    content,
    messageType,
    teamId,
    organizationId,
  };
}

function buildCoachAthletePushData({
  envelope,
  messageId,
  messagePreview,
  timestamp,
}) {
  return {
    type: 'COACH_MESSAGE',
    conversationId: envelope.conversationId,
    senderId: envelope.senderId,
    senderType: envelope.senderType,
    recipientId: envelope.recipientId,
    coachId: envelope.coachId,
    athleteId: envelope.athleteId,
    teamId: envelope.teamId,
    organizationId: envelope.organizationId,
    message: messagePreview,
    messageId: normalizeString(messageId),
    timestamp: normalizeString(timestamp),
  };
}

module.exports = {
  MAX_MESSAGE_LENGTH,
  MAX_PUSH_INSTALLATIONS,
  PULSE_CHECK_PUSH_MODEL_VERSION,
  buildCoachAthletePushData,
  collectPulseCheckPushCandidateTokens,
  isStalePushTokenError,
  normalizeParticipantIds,
  normalizePushInstallationRecord,
  resolveCoachAthleteMessageEnvelope,
  resolvePulseCheckPushTargets,
  resolvePulseCheckSenderName,
  timestampToMillis,
};
