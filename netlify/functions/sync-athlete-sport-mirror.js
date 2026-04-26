// =============================================================================
// Sync Athlete Sport Mirror — iOS-callable cloud function that resolves the
// canonical athlete sport (PulseCheck membership preferred, Macra profile
// fallback) and writes it to the root user doc as `athleteSport`,
// `athleteSportName`, `athleteSportPosition`.
//
// Why: the Sports Intelligence Layer Spec says these fields are mirrored
// to the root user doc for cross-product reads (Macra daily insight,
// Nora chat, coach-report generator all read from the mirror). The TS
// service in `src/api/firebase/athleteSportProfileMirror.ts` covers the
// web-side; this function gives iOS a way to invoke the same logic
// after sport selection in PulseCheck or Macra onboarding.
//
// Auth: caller must present a Firebase ID token. The token uid must
// either (a) match the target uid, or (b) belong to an admin user.
// =============================================================================

const { initializeFirebaseAdmin, admin, headers } = require('./config/firebase');

const USERS_COLLECTION = 'users';
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';

const RESPONSE_HEADERS = {
  ...headers,
  'Content-Type': 'application/json',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify(body),
  };
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function requireFirebaseAuth(event) {
  const header = event?.headers?.authorization || event?.headers?.Authorization;
  if (!header || !header.startsWith('Bearer ')) {
    const error = new Error('Missing or malformed Authorization header');
    error.statusCode = 401;
    throw error;
  }
  const token = header.slice(7).trim();
  if (!token) {
    const error = new Error('Missing bearer token');
    error.statusCode = 401;
    throw error;
  }
  try {
    return await admin.auth().verifyIdToken(token);
  } catch (verifyErr) {
    const error = new Error('Invalid Firebase ID token');
    error.statusCode = 401;
    error.cause = verifyErr;
    throw error;
  }
}

async function resolveCanonicalSport(db, uid) {
  // PulseCheck team membership wins.
  const membershipsSnap = await db
    .collection(TEAM_MEMBERSHIPS_COLLECTION)
    .where('userId', '==', uid)
    .where('status', '==', 'active')
    .get();

  for (const docSnap of membershipsSnap.docs) {
    const data = docSnap.data() || {};
    const onboarding = data.athleteOnboarding || {};
    const sportId = normalizeString(onboarding.sportId || data.sportId || onboarding.athleteSport);
    if (!sportId) continue;
    return {
      source: 'pulsecheck_membership',
      fields: {
        athleteSport: sportId,
        athleteSportName:
          normalizeString(onboarding.sportName || data.sportName || onboarding.athleteSportName) || null,
        athleteSportPosition:
          normalizeString(onboarding.sportPosition || data.sportPosition || onboarding.athleteSportPosition)
          || null,
      },
    };
  }

  // Fallback: Macra profile.
  const macraSnap = await db.collection(USERS_COLLECTION).doc(uid).collection('macra').doc('profile').get();
  if (macraSnap.exists) {
    const data = macraSnap.data() || {};
    const sportId = normalizeString(data.sportId || data.athleteSport);
    if (sportId) {
      return {
        source: 'macra_profile',
        fields: {
          athleteSport: sportId,
          athleteSportName: normalizeString(data.sportName || data.athleteSportName) || null,
          athleteSportPosition: normalizeString(data.sportPosition || data.athleteSportPosition) || null,
        },
      };
    }
  }

  return { source: 'no_source', fields: {} };
}

function isAdminClaim(claims) {
  if (!claims) return false;
  return Boolean(claims.admin || claims.adminAccess || claims.role === 'admin');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: RESPONSE_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    initializeFirebaseAdmin(event);
    const decoded = await requireFirebaseAuth(event);
    const body = JSON.parse(event.body || '{}');
    const targetUid = normalizeString(body.uid) || decoded.uid;

    if (targetUid !== decoded.uid && !isAdminClaim(decoded)) {
      return json(403, {
        error: 'You may only sync your own athlete sport mirror unless you are an admin.',
      });
    }

    const db = admin.firestore();

    // Allow callers to pass canonical fields directly (saves a Firestore round-trip
    // when iOS already has the sport selection in hand). Falls back to resolving
    // from PulseCheck membership / Macra profile.
    const overrideSport = normalizeString(body.athleteSport);
    let resolved;
    if (overrideSport) {
      resolved = {
        source: 'manual_override',
        fields: {
          athleteSport: overrideSport,
          athleteSportName: normalizeString(body.athleteSportName) || null,
          athleteSportPosition: normalizeString(body.athleteSportPosition) || null,
        },
      };
    } else {
      resolved = await resolveCanonicalSport(db, targetUid);
    }

    const userRef = db.collection(USERS_COLLECTION).doc(targetUid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return json(404, { error: `User ${targetUid} does not exist.` });
    }

    const existing = userSnap.data() || {};
    const previous = {
      athleteSport: normalizeString(existing.athleteSport) || null,
      athleteSportName: normalizeString(existing.athleteSportName) || null,
      athleteSportPosition: normalizeString(existing.athleteSportPosition) || null,
    };

    const next = {
      athleteSport: resolved.fields.athleteSport || null,
      athleteSportName: resolved.fields.athleteSportName || null,
      athleteSportPosition: resolved.fields.athleteSportPosition || null,
    };

    const changed =
      previous.athleteSport !== next.athleteSport
      || previous.athleteSportName !== next.athleteSportName
      || previous.athleteSportPosition !== next.athleteSportPosition;

    if (changed) {
      await userRef.set(
        {
          athleteSport: next.athleteSport,
          athleteSportName: next.athleteSportName,
          athleteSportPosition: next.athleteSportPosition,
          athleteSportMirroredAt: admin.firestore.FieldValue.serverTimestamp(),
          athleteSportMirroredSource: resolved.source,
        },
        { merge: true },
      );
    }

    return json(200, {
      success: true,
      uid: targetUid,
      source: resolved.source,
      changed,
      previous,
      applied: next,
    });
  } catch (error) {
    console.error('[sync-athlete-sport-mirror] Failed:', error);
    const status = Number.isFinite(error?.statusCode) ? error.statusCode : 500;
    return json(status, {
      error: error?.message || 'Failed to sync athlete sport mirror.',
    });
  }
};

// Test surface
exports._private = {
  resolveCanonicalSport,
  isAdminClaim,
  normalizeString,
};
