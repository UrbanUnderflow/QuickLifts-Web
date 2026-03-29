const { admin } = require('./config/firebase');
const {
  buildRunSummaryFingerprint,
  findMatchingRunSummary,
  pickPreferredRunSummary,
  toMillis,
} = require('./run-summary-dedupe');

const db = admin.firestore();

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function parseJsonBody(event) {
  if (!event?.body) return {};
  try {
    return typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  } catch (error) {
    throw new Error('Request body must be valid JSON.');
  }
}

function compactObject(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => compactObject(entry))
      .filter((entry) => entry !== undefined);
  }

  const isPlainObject =
    value &&
    typeof value === 'object' &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

  if (isPlainObject) {
    return Object.entries(value).reduce((result, [key, entry]) => {
      if (entry === undefined || entry === null || entry === '') {
        return result;
      }
      const compacted = compactObject(entry);
      if (compacted === undefined) {
        return result;
      }
      result[key] = compacted;
      return result;
    }, {});
  }

  return value;
}

function serializeTimestamp(value) {
  if (!value) return null;

  if (typeof value === 'number' || typeof value === 'string') {
    return value;
  }

  if (value instanceof Date) {
    return value.getTime() / 1000;
  }

  if (typeof value.toDate === 'function') {
    return value.toDate().getTime() / 1000;
  }

  if (typeof value.seconds === 'number') {
    return value.seconds + (typeof value.nanoseconds === 'number' ? value.nanoseconds / 1e9 : 0);
  }

  return value;
}

function normalizeSummaryForStorage(summary, { keepCreatedAt = false } = {}) {
  const payload = compactObject({
    ...summary,
    id: summary.id || db.collection('users').doc().id,
    userId: summary.userId || '',
    sourceFamily: summary.sourceFamily || 'pulse_app',
    sourceSessionId: summary.sourceSessionId || summary.id || null,
    dedupeKey: summary.dedupeKey || buildRunSummaryFingerprint(summary),
    sourceSummaryFingerprint: buildRunSummaryFingerprint(summary),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: keepCreatedAt ? undefined : admin.firestore.FieldValue.serverTimestamp(),
  });

  return payload;
}

async function loadUserRunSummaries(userRef) {
  const snapshot = await userRef.collection('runSummaries').get();
  return snapshot.docs.map((doc) => {
    const data = doc.data() || {};
    return {
      id: doc.id,
      ...data,
      createdAt: serializeTimestamp(data.createdAt),
      updatedAt: serializeTimestamp(data.updatedAt),
      startTime: serializeTimestamp(data.startTime),
      completedAt: serializeTimestamp(data.completedAt),
    };
  });
}

async function removeDuplicateRunSummaries(userRef, duplicateIds = []) {
  const uniqueIds = Array.from(new Set(duplicateIds.filter(Boolean)));
  await Promise.all(
    uniqueIds.map((id) => userRef.collection('runSummaries').doc(id).delete())
  );
}

exports.handler = async (event) => {
  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const runSummary = parseJsonBody(event);

    if (!runSummary.userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'userId is required' }),
      };
    }

    const userRef = db.collection('users').doc(runSummary.userId);
    const incomingSummary = {
      ...runSummary,
      sourceFamily: runSummary.sourceFamily || 'pulse_app',
      sourceSessionId: runSummary.sourceSessionId || runSummary.id || null,
      dedupeKey: runSummary.dedupeKey || buildRunSummaryFingerprint(runSummary),
    };

    const existingSummaries = await loadUserRunSummaries(userRef);
    const matchingSummaries = existingSummaries.filter((summary) => {
      return findMatchingRunSummary([summary], incomingSummary) !== null;
    });

    const bestIncomingOrExisting = matchingSummaries.length > 0
      ? matchingSummaries.reduce((preferred, summary) => pickPreferredRunSummary(preferred, summary), incomingSummary)
      : incomingSummary;

    const hasMatch = matchingSummaries.length > 0;
    const targetDocId = hasMatch
      ? (matchingSummaries.find((summary) => summary.id === bestIncomingOrExisting.id)?.id || matchingSummaries[0].id)
      : (incomingSummary.id || userRef.collection('runSummaries').doc().id);

    const matchedExisting = matchingSummaries.find((summary) => summary.id === targetDocId) || null;
    const shouldKeepCreatedAt = Boolean(matchedExisting);

    const firestoreData = normalizeSummaryForStorage(
      {
        ...bestIncomingOrExisting,
        id: targetDocId,
      },
      { keepCreatedAt: shouldKeepCreatedAt }
    );

    await userRef.collection('runSummaries').doc(targetDocId).set(firestoreData, { merge: true });

    const duplicateIds = matchingSummaries
      .map((summary) => summary.id)
      .filter((id) => id !== targetDocId);

    if (duplicateIds.length > 0) {
      await removeDuplicateRunSummaries(userRef, duplicateIds);
    }

    console.log(`✅ Run summary saved: ${targetDocId} for user ${runSummary.userId}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        id: targetDocId,
        deduped: hasMatch,
        mergedFrom: compactObject({
          incomingId: runSummary.id || null,
          duplicateIds,
          fingerprint: buildRunSummaryFingerprint(incomingSummary),
        }),
        message: hasMatch
          ? 'Run summary saved successfully and matched against an existing session.'
          : 'Run summary saved successfully',
      }),
    };
  } catch (error) {
    console.error('Error saving run summary:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to save run summary',
        details: error.message,
      }),
    };
  }
};
