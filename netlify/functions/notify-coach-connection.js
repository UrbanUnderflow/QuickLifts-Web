// Netlify function: notify-coach-connection
// Purpose: When an athlete connects to a coach, send a DM + email to the coach (idempotent)

const admin = require('firebase-admin');

// Initialize Firebase Admin once (reuse pattern from other functions)
if (admin.apps.length === 0) {
  try {
    const projectId = 'quicklifts-dd3f1';
    const privateKey = process.env.FIREBASE_SECRET_KEY ? process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n') : '';
    const clientEmail = 'firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com';

    if (!privateKey) {
      admin.initializeApp({ projectId });
    } else {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, privateKey, clientEmail })
      });
    }
  } catch (e) {
    console.error('[notify-coach-connection] Firebase init error:', e);
  }
}

const db = admin.firestore();

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { athleteId, coachId, coachUserId, coachReferralCode, force = false, allowSelf = false } = body;
    console.log('[notify-coach-connection] Incoming payload', { athleteId, coachId, coachUserId, coachReferralCode, force, allowSelf });
    if (!athleteId) {
      return { statusCode: 400, body: JSON.stringify({ message: 'athleteId is required' }) };
    }

    // Resolve coach userId
    let resolvedCoachUserId = coachUserId || null;
    if (!resolvedCoachUserId && coachId) {
      const coachDoc = await db.collection('coaches').doc(coachId).get();
      if (coachDoc.exists) resolvedCoachUserId = coachDoc.data()?.userId || null;
    }
    if (!resolvedCoachUserId && coachReferralCode) {
      const snap = await db.collection('coaches').where('referralCode', '==', coachReferralCode).limit(1).get();
      if (!snap.empty) resolvedCoachUserId = snap.docs[0].data()?.userId || null;
    }
    if (!resolvedCoachUserId) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Coach not found' }) };
    }
    console.log('[notify-coach-connection] Resolved coach userId', { resolvedCoachUserId });
    
    // Skip self-DM in edge cases (e.g., testing with same account), unless allowSelf is true
    if (resolvedCoachUserId === athleteId && !allowSelf) {
      console.log('[notify-coach-connection] Self-connection detected, skipping DM/email');
      await db.collection('notifications').doc(`coach-connection-${resolvedCoachUserId}-${athleteId}`).set({
        coachUserId: resolvedCoachUserId,
        athleteId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        type: 'coach-connection-self-skip'
      }, { merge: true });
      return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Self-connection detected; DM/email skipped' }) };
    }

    // Idempotency: skip if we already notified for this pair
    const notifId = `coach-connection-${resolvedCoachUserId}-${athleteId}`;
    const notifRef = db.collection('notifications').doc(notifId);
    const notifDoc = await notifRef.get();
    if (notifDoc.exists && !force) {
      console.log('[notify-coach-connection] Idempotency hit; notification already exists', { notifId });
      return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Already notified' }) };
    }
    if (force) {
      console.log('[notify-coach-connection] Force enabled; proceeding even if prior notification exists');
    }

    // Ensure chat exists and add welcome message
    const chats = await db.collection('chats').where('participantIds', 'array-contains', athleteId).get();
    console.log('[notify-coach-connection] Chats containing athlete fetched', { count: chats.docs.length });
    let chatId = null;
    for (const d of chats.docs) {
      const data = d.data();
      if (Array.isArray(data.participantIds) && data.participantIds.includes(resolvedCoachUserId)) {
        chatId = d.id;
        console.log('[notify-coach-connection] Found existing chat for coach-athlete pair', { chatId });
        break;
      }
    }
    if (!chatId) {
      const coachUserDoc = await db.collection('users').doc(resolvedCoachUserId).get();
      const athleteDoc = await db.collection('users').doc(athleteId).get();
      const participants = [];
      if (athleteDoc.exists) participants.push({ id: athleteId, username: athleteDoc.data()?.username || '', profileImage: athleteDoc.data()?.profileImage || null });
      if (coachUserDoc.exists) participants.push({ id: resolvedCoachUserId, username: coachUserDoc.data()?.username || '', profileImage: coachUserDoc.data()?.profileImage || null });
      const newChat = await db.collection('chats').add({
        participantIds: [athleteId, resolvedCoachUserId],
        participants,
        lastMessage: 'Connected via PulseCheck',
        lastMessageTimestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      chatId = newChat.id;
      console.log('[notify-coach-connection] Created new chat', { chatId });
    }
    if (chatId) {
      const msgRef = await db.collection('chats').doc(chatId).collection('messages').add({
        senderId: athleteId,
        content: 'Hi coach! I just connected with you via PulseCheck. You can now view my mindset notes and message me here.',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        readBy: { [athleteId]: admin.firestore.FieldValue.serverTimestamp() }
      });
      console.log('[notify-coach-connection] Inserted connection message', { chatId, messageId: msgRef.id });
      // Update chat last message and timestamp for ordering in inbox
      await db.collection('chats').doc(chatId).update({
        lastMessage: 'Hi coach! I just connected with you via PulseCheck. You can now view my mindset notes and message me here.',
        lastMessageTimestamp: admin.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});
      console.log('[notify-coach-connection] Updated chat lastMessage + lastMessageTimestamp', { chatId });

      // Debug verification: fetch latest messages and log summary
      try {
        const verifySnap = await db.collection('chats').doc(chatId).collection('messages').orderBy('timestamp', 'desc').limit(20).get();
        const allContents = verifySnap.docs.map(d => (d.data()?.content || '')).filter(Boolean);
        const found = allContents.some(c => c.includes('connected with you via PulseCheck'));
        console.log('[notify-coach-connection] Verify messages', { chatId, count: verifySnap.docs.length, foundConnectionText: found, sample: allContents.slice(0, 5) });
      } catch (verifyErr) {
        console.warn('[notify-coach-connection] Verify messages failed', verifyErr);
      }
    }

    // Fire Brevo email (non-blocking)
    try {
      const coachDoc = await db.collection('users').doc(resolvedCoachUserId).get();
      const coachEmail = coachDoc.data()?.email;
      const athleteName = (await db.collection('users').doc(athleteId).get()).data()?.displayName || (await db.collection('users').doc(athleteId).get()).data()?.username || 'An athlete';
      if (coachEmail) {
        const baseUrl = process.env.SITE_URL || 'http://localhost:8888';
        await fetch(`${baseUrl}/.netlify/functions/send-coach-connection-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coachEmail, coachName: coachDoc.data()?.displayName || coachDoc.data()?.username, athleteName }),
        });
        console.log('[notify-coach-connection] Email dispatch queued', { coachEmail });
      }
    } catch (err) {
      console.warn('[notify-coach-connection] Email dispatch failed (non-blocking):', err);
    }

    await notifRef.set({ coachUserId: resolvedCoachUserId, athleteId, createdAt: admin.firestore.FieldValue.serverTimestamp(), type: 'coach-connection' });
    console.log('[notify-coach-connection] Notification record written', { notifId });
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error('[notify-coach-connection] Error:', error);
    return { statusCode: 500, body: JSON.stringify({ message: 'Unexpected error' }) };
  }
};


