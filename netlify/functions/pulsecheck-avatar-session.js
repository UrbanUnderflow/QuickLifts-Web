const crypto = require('crypto');
const { initializeFirebaseAdmin, getFirebaseAdminApp, admin, headers } = require('./config/firebase');

const REQUIRED_ANGLES = ['front', 'left_side', 'back', 'right_side'];
const GENERATOR_VERSION = 'pulsecheck-multiview-avatar-v1';
const ASSET_FORMAT = 'usdz';

const RESPONSE_HEADERS = {
  ...headers,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

function createError(statusCode, message, details = undefined) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

async function verifyAuth(event, adminApp) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError(401, 'Missing Authorization header');
  }

  return admin.auth(adminApp).verifyIdToken(authHeader.slice('Bearer '.length));
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    throw createError(400, 'Invalid JSON body');
  }
}

function nowMs() {
  return Date.now();
}

function nowSeconds() {
  return Date.now() / 1000;
}

function createEmptyCaptures() {
  return REQUIRED_ANGLES.map((angle) => ({ angle }));
}

function normalizeCapture(capture = {}) {
  const angle = String(capture.angle || '').trim();
  if (!REQUIRED_ANGLES.includes(angle)) {
    throw createError(400, `Unsupported avatar capture angle: ${angle || 'missing'}`);
  }

  return stripUndefined({
    angle,
    sourceImageURL: typeof capture.sourceImageURL === 'string' ? capture.sourceImageURL : undefined,
    maskImageURL: typeof capture.maskImageURL === 'string' ? capture.maskImageURL : undefined,
    width: Number.isFinite(Number(capture.width)) ? Number(capture.width) : undefined,
    height: Number.isFinite(Number(capture.height)) ? Number(capture.height) : undefined,
    validationScore: Number.isFinite(Number(capture.validationScore)) ? Number(capture.validationScore) : undefined,
    failureReason: typeof capture.failureReason === 'string' ? capture.failureReason : undefined,
    capturedAt: Number.isFinite(Number(capture.capturedAt)) ? Number(capture.capturedAt) : nowMs(),
  });
}

function mergeCaptures(existingCaptures = [], nextCapture) {
  const byAngle = new Map(
    REQUIRED_ANGLES.map((angle) => [
      angle,
      existingCaptures.find((capture) => capture?.angle === angle) || { angle },
    ])
  );
  byAngle.set(nextCapture.angle, { ...byAngle.get(nextCapture.angle), ...nextCapture });
  return REQUIRED_ANGLES.map((angle) => byAngle.get(angle));
}

function validateCaptureSet(captures = []) {
  const byAngle = new Map(captures.map((capture) => [capture?.angle, capture]));
  const missingAngles = REQUIRED_ANGLES.filter((angle) => !byAngle.get(angle)?.sourceImageURL);
  if (missingAngles.length) {
    return {
      status: 'needs_retake',
      readyForGeneration: false,
      failureReason: 'missing_required_angle',
      angles: missingAngles,
    };
  }

  const failedCapture = captures.find((capture) => capture?.failureReason);
  if (failedCapture) {
    return {
      status: 'needs_retake',
      readyForGeneration: false,
      failureReason: failedCapture.failureReason,
      angles: [failedCapture.angle],
    };
  }

  return {
    status: 'accepted',
    readyForGeneration: true,
  };
}

function stripUndefined(value) {
  if (Array.isArray(value)) {
    return value.map(stripUndefined);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((accumulator, [key, entry]) => {
      if (typeof entry !== 'undefined') {
        accumulator[key] = stripUndefined(entry);
      }
      return accumulator;
    }, {});
  }

  return value;
}

function buildAvatarAsset({
  status,
  sessionId,
  captures,
  createdAt,
  completedAt,
  failureReason,
  thumbnailURL,
  previewImageURL,
  modelURL,
}) {
  return stripUndefined({
    status,
    sessionId,
    captures: captures || createEmptyCaptures(),
    modelURL,
    thumbnailURL,
    previewImageURL,
    generatorVersion: GENERATOR_VERSION,
    assetFormat: ASSET_FORMAT,
    createdAt: createdAt || nowMs(),
    updatedAt: nowMs(),
    completedAt,
    failureReason,
  });
}

async function loadCurrentAvatar(userRef) {
  const snapshot = await userRef.get();
  return snapshot.exists ? snapshot.data()?.avatarShowroom : undefined;
}

function assertSessionMatch(currentAvatar, sessionId) {
  if (!currentAvatar || currentAvatar.sessionId !== sessionId) {
    throw createError(404, 'Avatar session not found');
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: RESPONSE_HEADERS, body: '' };
  }

  try {
    initializeFirebaseAdmin({ headers: event.headers || {} });
    const adminApp = getFirebaseAdminApp({ headers: event.headers || {} });
    const db = admin.firestore(adminApp);
    const decodedToken = await verifyAuth(event, adminApp);
    const userRef = db.collection('users').doc(decodedToken.uid);

    if (event.httpMethod === 'GET') {
      const sessionId = String(event.queryStringParameters?.sessionId || '').trim();
      const currentAvatar = await loadCurrentAvatar(userRef);
      if (sessionId) {
        assertSessionMatch(currentAvatar, sessionId);
      }

      return {
        statusCode: 200,
        headers: RESPONSE_HEADERS,
        body: JSON.stringify({
          success: true,
          status: currentAvatar?.status || 'not_started',
          sessionId: currentAvatar?.sessionId,
          stage: currentAvatar?.status === 'processing' ? 'building_avatar_shape' : currentAvatar?.status,
          progress: currentAvatar?.status === 'ready' ? 1 : currentAvatar?.status === 'processing' ? 0.68 : 0,
          avatarShowroom: currentAvatar || null,
        }),
      };
    }

    if (event.httpMethod === 'DELETE') {
      const sessionId = String(event.queryStringParameters?.sessionId || '').trim();
      if (!sessionId) {
        throw createError(400, 'Missing sessionId');
      }

      const currentAvatar = await loadCurrentAvatar(userRef);
      assertSessionMatch(currentAvatar, sessionId);
      const deletedAvatar = buildAvatarAsset({
        ...currentAvatar,
        status: 'deleted',
        sessionId,
        captures: currentAvatar.captures || [],
        failureReason: undefined,
      });

      await userRef.set({
        avatarShowroom: deletedAvatar,
        updatedAt: nowSeconds(),
      }, { merge: true });

      return {
        statusCode: 200,
        headers: RESPONSE_HEADERS,
        body: JSON.stringify({ success: true, status: 'deleted', sessionId }),
      };
    }

    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: RESPONSE_HEADERS,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

    const body = parseBody(event);
    const action = String(body.action || 'create').trim();

    if (action === 'create') {
      const sessionId = `avatar_session_${crypto.randomUUID()}`;
      const avatar = buildAvatarAsset({
        status: 'capture_in_progress',
        sessionId,
        captures: createEmptyCaptures(),
      });

      await userRef.set({
        avatarShowroom: avatar,
        updatedAt: nowSeconds(),
      }, { merge: true });

      return {
        statusCode: 200,
        headers: RESPONSE_HEADERS,
        body: JSON.stringify({
          success: true,
          sessionId,
          requiredAngles: REQUIRED_ANGLES,
        }),
      };
    }

    const sessionId = String(body.sessionId || '').trim();
    if (!sessionId) {
      throw createError(400, 'Missing sessionId');
    }

    const currentAvatar = await loadCurrentAvatar(userRef);
    assertSessionMatch(currentAvatar, sessionId);

    if (action === 'capture_uploaded') {
      const capture = normalizeCapture(body.capture || body);
      const captures = mergeCaptures(currentAvatar.captures || [], capture);
      const avatar = buildAvatarAsset({
        ...currentAvatar,
        status: 'capture_in_progress',
        sessionId,
        captures,
        thumbnailURL: currentAvatar.thumbnailURL || capture.sourceImageURL,
        previewImageURL: currentAvatar.previewImageURL || capture.sourceImageURL,
      });

      await userRef.set({
        avatarShowroom: avatar,
        updatedAt: nowSeconds(),
      }, { merge: true });

      return {
        statusCode: 200,
        headers: RESPONSE_HEADERS,
        body: JSON.stringify({
          success: true,
          angle: capture.angle,
          status: capture.failureReason ? 'needs_retake' : 'accepted',
          validationScore: capture.validationScore,
          failureReason: capture.failureReason,
        }),
      };
    }

    if (action === 'validate') {
      const captures = Array.isArray(body.captures)
        ? body.captures.map(normalizeCapture)
        : currentAvatar.captures || [];
      const validation = validateCaptureSet(captures);
      const avatar = buildAvatarAsset({
        ...currentAvatar,
        status: validation.readyForGeneration ? 'validating' : 'validation_failed',
        sessionId,
        captures,
        failureReason: validation.failureReason,
      });

      await userRef.set({
        avatarShowroom: avatar,
        updatedAt: nowSeconds(),
      }, { merge: true });

      return {
        statusCode: 200,
        headers: RESPONSE_HEADERS,
        body: JSON.stringify(validation),
      };
    }

    if (action === 'generate') {
      const captures = currentAvatar.captures || [];
      const validation = validateCaptureSet(captures);
      if (!validation.readyForGeneration) {
        throw createError(422, 'Avatar capture set is not ready for generation', validation);
      }

      const firstCaptureURL = captures.find((capture) => capture?.sourceImageURL)?.sourceImageURL;
      const readyAvatar = buildAvatarAsset({
        ...currentAvatar,
        status: 'ready',
        sessionId,
        captures,
        thumbnailURL: currentAvatar.thumbnailURL || firstCaptureURL,
        previewImageURL: currentAvatar.previewImageURL || firstCaptureURL,
        modelURL: currentAvatar.modelURL,
        completedAt: nowMs(),
      });

      await userRef.set({
        avatarShowroom: readyAvatar,
        updatedAt: nowSeconds(),
      }, { merge: true });

      return {
        statusCode: 200,
        headers: RESPONSE_HEADERS,
        body: JSON.stringify({
          success: true,
          jobId: `avatar_job_${crypto.randomUUID()}`,
          status: 'queued',
          mockGeneration: true,
          avatarShowroom: readyAvatar,
        }),
      };
    }

    throw createError(400, `Unsupported avatar session action: ${action}`);
  } catch (error) {
    console.error('[pulsecheck-avatar-session] Failed:', {
      message: error?.message,
      statusCode: error?.statusCode,
      details: error?.details,
    });

    return {
      statusCode: error?.statusCode || 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        error: error?.message || 'Avatar session request failed.',
        details: error?.details,
      }),
    };
  }
};
