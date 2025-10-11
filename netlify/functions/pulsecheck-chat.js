// PulseCheck Chat Function (MVP)
// - Accepts user message and optional conversationId
// - Loads minimal user context
// - Loads recent conversation messages
// - Calls OpenAI Chat Completions (requires OPENAI_API_KEY)
// - Saves/updates conversation document in Firestore (conversations)

const { initializeFirebaseAdmin, db, headers } = require('./config/firebase');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    initializeFirebaseAdmin({ headers: event.headers || {} });

    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const body = JSON.parse(event.body || '{}');
    const { userId, message, conversationId } = body;

    if (!userId || !message) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing userId or message' }) };
    }

    // Load user context
    const userSnap = await db.collection('users').doc(userId).get();
    const userData = userSnap.exists ? userSnap.data() : {};
    const displayName = userData.displayName || userData.username || 'Athlete';
    const sport = userData.primarySport || '';
    const goals = Array.isArray(userData.goals) ? userData.goals : [];

    // Load existing conversation (if provided)
    let convoRef = null;
    let convo = null;

    if (conversationId) {
      convoRef = db.collection('conversations').doc(conversationId);
      const doc = await convoRef.get();
      if (doc.exists) convo = doc.data();
    }

    if (!convo) {
      // Get most recent conversation for this user
      const snap = await db
        .collection('conversations')
        .where('userId', '==', userId)
        .orderBy('updatedAt', 'desc')
        .limit(1)
        .get();
      if (!snap.empty) {
        convoRef = snap.docs[0].ref;
        convo = snap.docs[0].data();
      }
    }

    // Build recent message history (MVP: use array on doc)
    const recentMessages = Array.isArray(convo?.messages) ? convo.messages.slice(-20) : [];

    // Persona/system prompt (aligned with iOS basePersona)
    const basePersona = `You are PulseCheck, an elite sport-psychology coach.\n\nTone ▸ Warm, intellectually sharp, quietly confident.\nApproach ▸ Active-listening → concise reflection → single actionable insight → 1 follow-up Q.\nStyle ▸ ≤ 60 words (≈3 short sentences). Use the athlete's first name. No clichés or filler.\nDon'ts ▸ Never repeat a question they already answered. Never apologize unless a real mistake.`;

    // Context prompt
    const systemPrompt = `${basePersona}\n\n## User Context:\n- Name: ${displayName}${sport ? `\n- Sport/Activity: ${sport}` : ''}${goals.length ? `\n- Mental Performance Goals: ${goals.join(', ')}` : ''}\n\n### Conversation Memory Rule\nBefore asking a question, scan the last 6 messages. If you already asked it and the user answered, do not ask again. Acknowledge their answer and advance the topic.`;

    // Prepare messages for OpenAI
    const openAiMessages = [
      { role: 'system', content: systemPrompt }
    ];

    for (const m of recentMessages) {
      const role = m.isFromUser ? 'user' : 'assistant';
      openAiMessages.push({ role, content: m.content });
    }

    openAiMessages.push({ role: 'user', content: message });

    // Call OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing OPENAI_API_KEY' }) };
    }

    const completionRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: openAiMessages,
        temperature: 0.6,
        max_tokens: 220,
        frequency_penalty: 0.5,
        presence_penalty: 0.3
      })
    });

    if (!completionRes.ok) {
      const errText = await completionRes.text();
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'OpenAI error', detail: errText }) };
    }

    const completion = await completionRes.json();
    const assistantMessage = completion.choices?.[0]?.message?.content?.trim() || "I'm here to support you. Can you share more?";

    // Update conversation: append messages and save
    const nowSec = Math.floor(Date.now() / 1000);
    const userMsg = {
      id: cryptoRandomId(),
      content: message,
      isFromUser: true,
      timestamp: nowSec,
      messageType: 'text'
    };
    const aiMsg = {
      id: cryptoRandomId(),
      content: assistantMessage,
      isFromUser: false,
      timestamp: nowSec,
      messageType: 'text'
    };

    let newConvoId = conversationId || convo?.id;
    if (!convoRef) {
      const data = {
        userId,
        title: 'PulseCheck',
        messages: [userMsg, aiMsg],
        tags: [],
        actionCardInteractions: [],
        sessionDuration: 0,
        createdAt: nowSec,
        updatedAt: nowSec
      };
      const docRef = await db.collection('conversations').add(data);
      newConvoId = docRef.id;
      await docRef.set({ id: newConvoId }, { merge: true });
    } else {
      const updated = Array.isArray(convo?.messages) ? [...convo.messages, userMsg, aiMsg] : [userMsg, aiMsg];
      await convoRef.set({
        id: convoRef.id,
        userId,
        title: convo?.title || 'PulseCheck',
        messages: updated,
        updatedAt: nowSec
      }, { merge: true });
      newConvoId = convoRef.id;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        conversationId: newConvoId,
        assistantMessage
      })
    };
  } catch (error) {
    console.error('[pulsecheck-chat] error', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};

function cryptoRandomId() {
  // simple random id; not cryptographically secure but fine for UI ids
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}


