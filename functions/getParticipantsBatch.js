const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

// Ensure Firebase Admin SDK is initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

const USER_CHALLENGE_COLLECTION = "user-challenge";
const FIRESTORE_IN_LIMIT = 30;

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sanitizeFirestoreValue(value) {
  // Convert Firestore Timestamp -> unix seconds (matches iOS Double seconds convention)
  if (value && typeof value === "object" && typeof value.toDate === "function") {
    try {
      const d = value.toDate();
      if (d instanceof Date && !Number.isNaN(d.getTime())) {
        return Math.floor(d.getTime() / 1000);
      }
    } catch (_) {
      // fall through
    }
  }

  // Convert Firestore GeoPoint -> { latitude, longitude }
  if (value && typeof value === "object" && typeof value.latitude === "number" && typeof value.longitude === "number") {
    return { latitude: value.latitude, longitude: value.longitude };
  }

  if (Array.isArray(value)) return value.map(sanitizeFirestoreValue);

  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeFirestoreValue(v);
    return out;
  }

  return value;
}

/**
 * Batch fetches participants (UserChallenge docs) for many challengeIds.
 *
 * iOS expects:
 *   input:  { challengeIds: string[] }
 *   output: { [challengeId: string]: Array<{ ...userChallengeData, id: string }> }
 */
exports.getParticipantsBatch = onCall({ region: "us-central1", runtime: "nodejs22" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in to fetch participants.");
  }

  const { challengeIds } = request.data || {};

  if (!Array.isArray(challengeIds) || challengeIds.length === 0) {
    logger.info("getParticipantsBatch: no challengeIds provided; returning empty object.");
    return {};
  }

  if (!challengeIds.every((id) => typeof id === "string" && id.trim().length > 0)) {
    throw new HttpsError("invalid-argument", "The function must be called with an array of strings for 'challengeIds'.");
  }

  // Dedupe to reduce query work, but still return a map keyed by requested ids.
  const uniqueIds = Array.from(new Set(challengeIds.map((s) => s.trim())));

  // Seed with empty arrays so callers always get keys back
  const result = Object.fromEntries(uniqueIds.map((id) => [id, []]));

  logger.info(`getParticipantsBatch: fetching participants for ${uniqueIds.length} challengeIds.`, {
    challengeIdsCount: uniqueIds.length,
    uid: request.auth.uid,
  });

  try {
    const chunks = chunkArray(uniqueIds, FIRESTORE_IN_LIMIT);

    // Run chunk queries in parallel
    const snapshots = await Promise.all(
      chunks.map((chunk) =>
        db.collection(USER_CHALLENGE_COLLECTION).where("challengeId", "in", chunk).get()
      )
    );

    for (const snap of snapshots) {
      for (const doc of snap.docs) {
        const data = doc.data() || {};
        const challengeId = data.challengeId;
        if (typeof challengeId !== "string" || !challengeId) continue;

        // Sanitize (GeoPoint/Timestamp) and include docId as "id" (iOS expects it)
        const payload = sanitizeFirestoreValue({ ...data, id: doc.id });

        if (!result[challengeId]) result[challengeId] = [];
        result[challengeId].push(payload);
      }
    }

    logger.info("getParticipantsBatch: done.", {
      requestedChallengeIds: uniqueIds.length,
      returnedChallengeIds: Object.keys(result).length,
      totalParticipants: Object.values(result).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0),
    });

    return result;
  } catch (error) {
    logger.error("getParticipantsBatch: failed.", error);
    throw new HttpsError("internal", "Failed to fetch participants.", error?.message);
  }
});

