// notify-meal-logged
//
// Macra writes a meal log to `users/{uid}/mealLogs/{docId}` and POSTs
// here so the member's 1-on-1 hosts can be notified that food was
// logged. Pulse iOS already wires the deep-link target for
// `oneOnOneClientActivity` push payloads — this function just walks
// the active 1-on-1 trainings, resolves each host's FCM token, and
// fans out the push via the existing `send-notification` Netlify
// function (so we inherit its dedupe + logging without duplicating).
//
// Throttle: only one `food` push per (hostId, memberId) every 30 min.
// State lives in `oneOnOnePushThrottle/{hostId}__{memberId}__food`
// so multiple clients can read/write atomically without coordinating.
//
// Request body:  { userId: string, mealId?: string }
// Response:      { success: bool, hostsNotified: int, hostsThrottled: int }

const { db, admin } = require('./config/firebase');

const THROTTLE_COLLECTION = 'oneOnOnePushThrottle';
const THROTTLE_WINDOW_SECONDS = 30 * 60; // 30 minutes
const ACTIVITY_TYPE = 'food';
const NOTIFICATION_TYPE = 'oneOnOneClientActivity';

/**
 * Build the throttle doc id for a (host, member, activity) triple.
 * Sortable + grep-friendly so we can spot frequent fliers in the
 * Firestore console without joining tables.
 */
function throttleDocId(hostId, memberId, activity) {
  return `${hostId}__${memberId}__${activity}`;
}

/**
 * Resolve the public-facing send-notification endpoint. Defaults to
 * the production Netlify URL so this function works the same in
 * local netlify-cli runs as it does deployed.
 */
function sendNotificationURL() {
  return (
    process.env.SEND_NOTIFICATION_URL ||
    'https://fitwithpulse.ai/.netlify/functions/send-notification'
  );
}

/**
 * Try to atomically reserve a 30-min throttle slot for this
 * (host, member, food) triple. Returns true if we won the slot
 * (and therefore should send), false if a recent push is still
 * within the throttle window.
 */
async function reserveThrottleSlot(hostId, memberId) {
  const docId = throttleDocId(hostId, memberId, ACTIVITY_TYPE);
  const docRef = db.collection(THROTTLE_COLLECTION).doc(docId);
  const nowSec = Math.floor(Date.now() / 1000);

  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      const lastSentAt = snap.exists ? Number(snap.data()?.lastSentAt || 0) : 0;
      if (lastSentAt && nowSec - lastSentAt < THROTTLE_WINDOW_SECONDS) {
        return false;
      }
      tx.set(docRef, {
        hostId,
        memberId,
        activity: ACTIVITY_TYPE,
        lastSentAt: nowSec,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return true;
    });
  } catch (err) {
    // Fail-open: if Firestore hiccups we'd rather send a duplicate
    // than swallow the host's first ping silently.
    console.warn('[notify-meal-logged] Throttle reservation failed open:', err);
    return true;
  }
}

/**
 * Build the customData payload for the OneOnOne client-activity
 * push. Mirrors the shape Pulse iOS produces in
 * `NotificationService.sendOneOnOneClientActivityNotification`.
 */
function buildCustomData(trainingId, clientUsername) {
  return {
    type: NOTIFICATION_TYPE,
    trainingId,
    clientUsername,
    activity: ACTIVITY_TYPE,
  };
}

function buildTitle(clientUsername) {
  const safeName = (clientUsername || '').trim() || 'Your client';
  return `${safeName} is training`;
}

function buildBody(clientUsername) {
  const safeName = (clientUsername || '').trim() || 'Your client';
  return `${safeName} logged food in Macra. Tap to open the room.`;
}

/**
 * POST to the existing send-notification function so the actual FCM
 * dispatch + logging path stays identical to Pulse iOS pushes.
 */
async function dispatchPush({ fcmToken, title, body, customData }) {
  const url = sendNotificationURL();
  const payload = {
    fcmToken,
    payload: {
      notification: { title, body },
      data: customData,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`send-notification ${response.status}: ${text || 'no body'}`);
  }
  return response.json().catch(() => ({ success: true }));
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, message: 'POST only' }) };
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'Invalid JSON body' }) };
  }

  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  const mealId = typeof body.mealId === 'string' ? body.mealId.trim() : '';

  if (!userId) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'Missing userId' }) };
  }

  try {
    // 1. Resolve the member user — used for the push display name
    //    and to confirm they exist (defensive against bad IDs).
    const memberSnap = await db.collection('users').doc(userId).get();
    if (!memberSnap.exists) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, hostsNotified: 0, hostsThrottled: 0, reason: 'member-not-found' }),
      };
    }
    const memberData = memberSnap.data() || {};
    const memberUsername = (memberData.username || memberData.displayName || '').trim();

    // 2. Find active 1-on-1 trainings where this user is a participant.
    //    We then filter in-code to the ones where they're the *member*
    //    (we never ping when the host is the one logging their own food).
    const trainingsSnap = await db.collection('oneOnOneTrainings')
      .where('participantIds', 'array-contains', userId)
      .where('status', '==', 'active')
      .get();

    if (trainingsSnap.empty) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, hostsNotified: 0, hostsThrottled: 0, reason: 'no-active-trainings' }),
      };
    }

    let hostsNotified = 0;
    let hostsThrottled = 0;
    const errors = [];

    for (const doc of trainingsSnap.docs) {
      const training = doc.data() || {};
      if (training.memberId !== userId) continue; // skip host-side logs
      const hostId = (training.hostId || '').trim();
      if (!hostId) continue;

      // 3. Throttle per (host, member, food) at 30 min.
      const reserved = await reserveThrottleSlot(hostId, userId);
      if (!reserved) {
        hostsThrottled += 1;
        continue;
      }

      // 4. Resolve host's freshest FCM token. Stored hostInfo.fcmToken
      //    on the training doc may be stale (token rotation), so prefer
      //    the live user doc and fall back to the embedded snapshot.
      let fcmToken = '';
      try {
        const hostSnap = await db.collection('users').doc(hostId).get();
        if (hostSnap.exists) {
          fcmToken = (hostSnap.data()?.fcmToken || '').trim();
        }
      } catch (err) {
        console.warn('[notify-meal-logged] Host user lookup failed:', err);
      }
      if (!fcmToken) {
        fcmToken = (training?.hostInfo?.fcmToken || '').trim();
      }
      if (!fcmToken) {
        console.warn('[notify-meal-logged] No FCM token for host', hostId, '— skipping');
        continue;
      }

      // 5. Fan out via existing send-notification endpoint.
      try {
        await dispatchPush({
          fcmToken,
          title: buildTitle(memberUsername),
          body: buildBody(memberUsername),
          customData: buildCustomData(doc.id, memberUsername),
        });
        hostsNotified += 1;
      } catch (err) {
        console.error('[notify-meal-logged] Push dispatch failed for host', hostId, err);
        errors.push({ hostId, message: String(err?.message || err) });
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        hostsNotified,
        hostsThrottled,
        errors: errors.length ? errors : undefined,
        mealId: mealId || undefined,
      }),
    };
  } catch (err) {
    console.error('[notify-meal-logged] Top-level failure:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, message: String(err?.message || err) }),
    };
  }
};
