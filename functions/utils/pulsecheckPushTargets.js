const admin = require('firebase-admin');
const {
  MAX_PUSH_INSTALLATIONS,
  collectPulseCheckPushCandidateTokens,
  isStalePushTokenError,
  resolvePulseCheckPushTargets,
} = require('./coachAthleteMessageContract');

const PUSH_TOKEN_SUBCOLLECTION = 'pulsecheckPushTokens';
const PUSH_INSTALLATION_COLLECTION = 'pulsecheck-push-installations';
const PUSH_CLAIM_QUERY_CHUNK_SIZE = 30;

const getDb = () => admin.firestore();

const chunk = (values, size) => {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};

async function loadPulseCheckPushTargets(recipientId, userRef, userData = {}) {
  const db = getDb();
  const tokenSnapshot = await userRef
    .collection(PUSH_TOKEN_SUBCOLLECTION)
    .limit(MAX_PUSH_INSTALLATIONS)
    .get();
  const installationRecords = tokenSnapshot.docs.map((document) => ({
    id: document.id,
    data: document.data(),
  }));
  const candidates = collectPulseCheckPushCandidateTokens({
    recipientId,
    userData,
    installationRecords,
  });
  const claimRecords = [];

  for (const tokens of chunk(candidates.tokens, PUSH_CLAIM_QUERY_CHUNK_SIZE)) {
    const snapshot = await db
      .collection(PUSH_INSTALLATION_COLLECTION)
      .where('token', 'in', tokens)
      .get();
    snapshot.docs.forEach((document) => {
      claimRecords.push({
        id: document.id,
        data: document.data(),
      });
    });
  }

  return resolvePulseCheckPushTargets({
    recipientId,
    userData,
    installationRecords,
    claimRecords,
  });
}

async function deleteStaleInstallationTarget(recipientId, userRef, target) {
  const db = getDb();
  for (const installation of target.installations) {
    const tokenRef = userRef
      .collection(PUSH_TOKEN_SUBCOLLECTION)
      .doc(installation.documentId);
    const claimRef = db
      .collection(PUSH_INSTALLATION_COLLECTION)
      .doc(installation.installationId);

    await db.runTransaction(async (transaction) => {
      const tokenDocument = await transaction.get(tokenRef);
      const claimDocument = await transaction.get(claimRef);
      const tokenData = tokenDocument.data() || {};
      const claimData = claimDocument.data() || {};

      if (
        tokenDocument.exists
        && tokenData.ownerUserId === recipientId
        && tokenData.installationId === installation.installationId
        && tokenData.token === target.token
      ) {
        transaction.delete(tokenRef);
      }
      if (
        claimDocument.exists
        && claimData.ownerUserId === recipientId
        && claimData.installationId === installation.installationId
        && claimData.token === target.token
      ) {
        transaction.delete(claimRef);
      }
    });
  }
}

async function deleteStaleLegacyTarget(userRef, target) {
  const db = getDb();
  await db.runTransaction(async (transaction) => {
    const userDocument = await transaction.get(userRef);
    const userData = userDocument.data() || {};
    if (userDocument.exists && userData.pulseCheckFcmToken === target.token) {
      transaction.update(userRef, {
        pulseCheckFcmToken: admin.firestore.FieldValue.delete(),
        pulseCheckFcmTokenOwnerUserId: admin.firestore.FieldValue.delete(),
        pulseCheckFcmTokenUpdatedAt: admin.firestore.FieldValue.delete(),
        pushTokenSourceApp: admin.firestore.FieldValue.delete(),
      });
    }
  });
}

async function cleanupStalePushTargets(recipientId, userRef, targets, responses) {
  const cleanupTasks = [];
  responses.forEach((response, index) => {
    if (response.success || !isStalePushTokenError(response.error)) {
      return;
    }

    const target = targets[index];
    cleanupTasks.push(
      target.source === 'installation'
        ? deleteStaleInstallationTarget(recipientId, userRef, target)
        : deleteStaleLegacyTarget(userRef, target)
    );
  });
  await Promise.all(cleanupTasks);
}

function logPushSendFailures(label, recipientId, targets, responses) {
  const failures = responses
    .map((response, index) => ({
      response,
      target: targets[index],
    }))
    .filter(({response}) => !response.success);

  if (failures.length === 0) {
    return;
  }

  const errorCodes = [...new Set(failures.map(({response}) => (
    response.error?.code || 'unknown'
  )))];
  console.warn(
    `${label} push failed for ${failures.length}/${targets.length} installation(s) on ${recipientId}.`,
    {errorCodes}
  );

  failures.slice(0, 5).forEach(({response, target}) => {
    console.warn(`${label} push target failure`, {
      recipientId,
      source: target?.source || 'unknown',
      tokenPreview: target?.token ? `${target.token.substring(0, 12)}...` : '',
      code: response.error?.code || 'unknown',
      message: response.error?.message || '',
    });
  });

  if (errorCodes.includes('messaging/third-party-auth-error')) {
    console.error(
      `${label} iOS push failed because Firebase Messaging could not authenticate with APNs. Check the Firebase iOS app APNs auth key/certificate for com.fitwithpulse.pulsecheck.`
    );
  }
}

module.exports = {
  cleanupStalePushTargets,
  loadPulseCheckPushTargets,
  logPushSendFailures,
};
