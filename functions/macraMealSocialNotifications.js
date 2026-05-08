const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

const { logNotification } = require('./notificationLogger');

const db = admin.firestore();
const messaging = admin.messaging();

const usersCollection = 'users';
const mealLogsCollection = 'mealLogs';

/**
 * Resolves the Macra-scoped push token for a user. Mirrors the resolver in
 * functions/macraDailyInsight.js — never falls back to users.fcmToken,
 * which belongs to Pulse and would route Macra pushes to the wrong app.
 */
function resolveMacraPushToken(userData = {}) {
  const pushTokens = (userData && userData.pushTokens && typeof userData.pushTokens === 'object')
    ? userData.pushTokens
    : {};
  const candidates = [
    { token: userData && userData.macraFcmToken, source: 'users.macraFcmToken' },
    { token: pushTokens.macra, source: 'users.pushTokens.macra' },
  ];
  for (const candidate of candidates) {
    if (typeof candidate.token === 'string' && candidate.token.trim().length > 0) {
      return { token: candidate.token.trim(), source: candidate.source };
    }
  }
  return { token: '', source: '' };
}

/**
 * Resolves a friendly display name for a user (email localpart, fallback
 * to "Someone"). Used in notification titles so the recipient sees who
 * just liked or commented.
 */
async function resolveActorDisplayName(actorUid) {
  if (!actorUid) return 'Someone';
  try {
    const snap = await db.collection(usersCollection).doc(actorUid).get();
    const data = snap.exists ? snap.data() || {} : {};
    const email = data.email || data.username;
    if (typeof email === 'string' && email.length > 0) {
      const local = email.split('@')[0];
      return local && local.length > 0 ? local : 'Someone';
    }
  } catch (err) {
    console.warn(`[macraMealSocial] resolveActorDisplayName failed for ${actorUid}: ${err.message}`);
  }
  return 'Someone';
}

/**
 * Pulls a short label for the meal so the push body has context. Falls
 * back to "your meal" when the meal doc is missing or unnamed.
 */
async function resolveMealLabel(ownerUid, mealId) {
  if (!ownerUid || !mealId) return 'your meal';
  try {
    const ref = db.collection(usersCollection).doc(ownerUid)
      .collection(mealLogsCollection).doc(mealId);
    const snap = await ref.get();
    if (!snap.exists) return 'your meal';
    const data = snap.data() || {};
    const name = (typeof data.name === 'string') ? data.name.trim() : '';
    if (!name) return 'your meal';
    if (name.length > 40) return `${name.slice(0, 37).trim()}…`;
    return name;
  } catch (err) {
    console.warn(`[macraMealSocial] resolveMealLabel failed for ${ownerUid}/${mealId}: ${err.message}`);
    return 'your meal';
  }
}

/**
 * Sends a Macra push to the meal owner. Skips silently when:
 * - The actor IS the owner (no self-pushes)
 * - The owner has no Macra-scoped push token (fall-through to fcmToken
 *   would surface Macra pushes under the Pulse app — refused per the
 *   audit on functions/macraDailyInsight.js).
 */
async function sendOwnerPush({
  ownerUid,
  mealId,
  actorUid,
  notificationType,
  title,
  body,
  extraData = {},
  functionName,
  recipientUid,
}) {
  if (!ownerUid) {
    console.warn(`[${functionName}] missing ownerUid; skipping.`);
    return;
  }
  if (!mealId) {
    console.warn(`[${functionName}] missing mealId; skipping.`);
    return;
  }
  if (actorUid && actorUid === ownerUid) {
    console.log(`[${functionName}] owner ${ownerUid} acted on own meal ${mealId}; skipping self-push.`);
    return;
  }

  const ownerSnap = await db.collection(usersCollection).doc(ownerUid).get();
  if (!ownerSnap.exists) {
    console.warn(`[${functionName}] owner doc missing for ${ownerUid}; skipping.`);
    return;
  }
  const ownerData = ownerSnap.data() || {};
  const { token, source } = resolveMacraPushToken(ownerData);
  if (!token) {
    console.warn(`[${functionName}] no Macra push token for owner ${ownerUid}; refusing fcmToken fallback.`);
    return;
  }

  const dataPayload = Object.assign(
    {
      type: notificationType,
      mealId: String(mealId),
      ownerUid: String(ownerUid),
      actorUid: actorUid ? String(actorUid) : '',
      timestamp: String(Math.floor(Date.now() / 1000)),
      screen: 'macra_meal_detail',
    },
    extraData
  );

  const message = {
    token,
    notification: { title, body },
    data: dataPayload,
    apns: {
      headers: { 'apns-priority': '10' },
      payload: {
        aps: {
          alert: { title, body },
          sound: 'default',
          badge: 1,
        },
      },
    },
  };

  try {
    const response = await messaging.send(message);
    console.log(`✅ [${functionName}] sent to ${ownerUid} via ${source}: ${response}`);
    await logNotification({
      recipient: { userId: ownerUid, fcmToken: token },
      title,
      body,
      dataPayload,
      notificationType,
      functionName,
      success: true,
      messageId: response,
      tokenSource: source,
    });
  } catch (err) {
    console.error(`❌ [${functionName}] send failed for ${ownerUid}: ${err.message}`);
    try {
      await logNotification({
        recipient: { userId: ownerUid, fcmToken: token },
        title,
        body,
        dataPayload,
        notificationType,
        functionName,
        success: false,
        errorMessage: err.message,
        tokenSource: source,
      });
    } catch (logErr) {
      console.warn(`[${functionName}] logNotification failed: ${logErr.message}`);
    }
  }
}

/**
 * Triggers when a buddy likes a Macra meal. Doc id of the like is the
 * liker's uid (idempotent toggle). Pushes once per *create* — toggling
 * off and back on will re-push, which is fine because likes are
 * lightweight social signals and the rate is bounded by tap speed.
 */
exports.onMacraMealLikeCreated = onDocumentCreated(
  `${usersCollection}/{ownerUid}/${mealLogsCollection}/{mealId}/likes/{likerUid}`,
  async (event) => {
    const { ownerUid, mealId, likerUid } = event.params;
    const functionName = 'onMacraMealLikeCreated';

    if (!ownerUid || !mealId || !likerUid) {
      console.warn(`[${functionName}] missing params; skipping.`);
      return null;
    }
    if (likerUid === ownerUid) {
      console.log(`[${functionName}] self-like by ${ownerUid} on ${mealId}; skipping.`);
      return null;
    }

    const [actorName, mealLabel] = await Promise.all([
      resolveActorDisplayName(likerUid),
      resolveMealLabel(ownerUid, mealId),
    ]);

    await sendOwnerPush({
      ownerUid,
      mealId,
      actorUid: likerUid,
      notificationType: 'MACRA_MEAL_LIKE',
      title: `${actorName} liked your meal`,
      body: `${actorName} liked ${mealLabel}.`,
      extraData: { actorName },
      functionName,
      recipientUid: ownerUid,
    });

    return null;
  }
);

/**
 * Triggers when a buddy comments on a Macra meal. Body includes the
 * comment text (truncated) so the push reads as a real conversation
 * starter, not just "someone said something".
 */
exports.onMacraMealCommentCreated = onDocumentCreated(
  `${usersCollection}/{ownerUid}/${mealLogsCollection}/{mealId}/comments/{commentId}`,
  async (event) => {
    const { ownerUid, mealId, commentId } = event.params;
    const functionName = 'onMacraMealCommentCreated';
    const snap = event.data;

    if (!snap) {
      console.warn(`[${functionName}] no snapshot for ${ownerUid}/${mealId}/${commentId}; skipping.`);
      return null;
    }
    const commentData = snap.data() || {};
    const authorUid = commentData.authorUid;
    const text = (typeof commentData.text === 'string') ? commentData.text.trim() : '';

    if (!authorUid || !text) {
      console.warn(`[${functionName}] missing authorUid or text on ${commentId}; skipping.`);
      return null;
    }
    if (authorUid === ownerUid) {
      console.log(`[${functionName}] self-comment by ${ownerUid} on ${mealId}; skipping.`);
      return null;
    }

    const [actorName, mealLabel] = await Promise.all([
      resolveActorDisplayName(authorUid),
      resolveMealLabel(ownerUid, mealId),
    ]);

    const truncated = text.length > 110 ? `${text.slice(0, 107).trim()}…` : text;

    await sendOwnerPush({
      ownerUid,
      mealId,
      actorUid: authorUid,
      notificationType: 'MACRA_MEAL_COMMENT',
      title: `${actorName} commented on ${mealLabel}`,
      body: truncated,
      extraData: { actorName, commentId: String(commentId) },
      functionName,
      recipientUid: ownerUid,
    });

    return null;
  }
);
