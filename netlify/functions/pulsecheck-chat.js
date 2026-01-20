// PulseCheck Chat Function (MVP)
// - Accepts user message and optional conversationId
// - Loads minimal user context
// - Loads recent conversation messages
// - Calls OpenAI Chat Completions (requires OPENAI_API_KEY)
// - Includes escalation classification for safety monitoring
// - Saves/updates conversation document in Firestore (conversations)

const { initializeFirebaseAdmin, admin, headers } = require('./config/firebase');

// Escalation Tier enum values
const EscalationTier = {
  None: 0,
  MonitorOnly: 1,
  ElevatedRisk: 2,
  CriticalRisk: 3
};

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Initialize Firebase Admin
    let db;
    try {
      initializeFirebaseAdmin({ headers: event.headers || {} });
      // Get fresh db reference after initialization
      db = admin.firestore();
    } catch (firebaseInitError) {
      console.error('[pulsecheck-chat] Firebase initialization error:', firebaseInitError);
      return { 
        statusCode: 500, 
        headers, 
        body: JSON.stringify({ error: 'Firebase initialization failed', detail: firebaseInitError.message }) 
      };
    }

    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (parseError) {
      console.error('[pulsecheck-chat] JSON parse error:', parseError);
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: 'Invalid JSON in request body' }) 
      };
    }
    const { 
      userId, 
      message, 
      conversationId, 
      skipEscalation = false,
      systemPromptContext, // Optional: iOS sends health context and other user-specific data
      userContext,         // Optional: iOS sends structured user context
      recentMessages: clientRecentMessages // Optional: iOS may send its own recent messages
    } = body;

    if (!userId || !message) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing userId or message' }) };
    }

    // Load user context from Firestore (unless client provided it)
    let displayName, sport, goals;
    
    if (userContext) {
      // Use client-provided context (iOS sends this with health data)
      displayName = userContext.name || 'Athlete';
      sport = userContext.sport || '';
      goals = Array.isArray(userContext.goals) ? userContext.goals : [];
    } else {
      // Load from Firestore
      try {
        const userSnap = await db.collection('users').doc(userId).get();
        const userData = userSnap.exists ? userSnap.data() : {};
        displayName = userData.displayName || userData.username || 'Athlete';
        sport = userData.primarySport || '';
        goals = Array.isArray(userData.goals) ? userData.goals : [];
      } catch (userLoadError) {
        console.error('[pulsecheck-chat] Error loading user data:', userLoadError);
        // Use defaults if user load fails
        displayName = 'Athlete';
        sport = '';
        goals = [];
      }
    }

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
      try {
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
      } catch (convoQueryError) {
        console.error('[pulsecheck-chat] Error querying conversations:', convoQueryError);
        // Continue without existing conversation - will create new one
        convoRef = null;
        convo = null;
      }
    }

    // Build recent message history
    // Prefer client-provided messages (iOS sends these), fall back to Firestore conversation
    let recentMessages;
    if (Array.isArray(clientRecentMessages) && clientRecentMessages.length > 0) {
      // iOS client provided recent messages (includes local context)
      recentMessages = clientRecentMessages.slice(-20);
      console.log('[pulsecheck-chat] Using client-provided recent messages:', recentMessages.length);
    } else {
      // Use Firestore conversation (web clients)
      recentMessages = Array.isArray(convo?.messages) ? convo.messages.slice(-20) : [];
    }

    // Persona/system prompt (aligned with iOS basePersona)
    const basePersona = `You are Nora, an elite AI mental performance coach. Your workout data now talks back.\n\nTone ▸ Warm, intellectually sharp, quietly confident.\nApproach ▸ Active-listening → concise reflection → single actionable insight → 1 follow-up Q.\nStyle ▸ ≤ 60 words (≈3 short sentences). Use the athlete's first name. No clichés or filler.\nDon'ts ▸ Never repeat a question they already answered. Never apologize unless a real mistake.`;

    // Context prompt - use iOS-provided systemPromptContext if available (includes health data)
    let systemPrompt;
    if (systemPromptContext) {
      // iOS sends complete system prompt including health context
      systemPrompt = `${systemPromptContext}\n\n### Conversation Memory Rule\nBefore asking a question, scan the last 6 messages. If you already asked it and the user answered, do not ask again. Acknowledge their answer and advance the topic.`;
      console.log('[pulsecheck-chat] Using iOS-provided system context (includes health data)');
    } else {
      // Build system prompt from Firestore data (web clients)
      systemPrompt = `${basePersona}\n\n## User Context:\n- Name: ${displayName}${sport ? `\n- Sport/Activity: ${sport}` : ''}${goals.length ? `\n- Mental Performance Goals: ${goals.join(', ')}` : ''}\n\n### Conversation Memory Rule\nBefore asking a question, scan the last 6 messages. If you already asked it and the user answered, do not ask again. Acknowledge their answer and advance the topic.`;
    }

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
    try {
      if (!convoRef) {
        const data = {
          userId,
          title: 'Nora',
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
          title: convo?.title || 'Nora',
          messages: updated,
          updatedAt: nowSec
        }, { merge: true });
        newConvoId = convoRef.id;
      }
    } catch (saveError) {
      console.error('[pulsecheck-chat] Error saving conversation:', saveError);
      // Continue - we still have the response to return, just conversation wasn't saved
      // This is not critical enough to fail the entire request
    }

    // === ESCALATION CLASSIFICATION ===
    // Run classification in parallel with response (don't block)
    let escalation = null;
    
    if (!skipEscalation) {
      try {
        console.log('[pulsecheck-chat] Starting escalation classification...');
        escalation = await classifyEscalation(
          db,
          userId,
          message,
          recentMessages,
          newConvoId
        );
        
        console.log('[pulsecheck-chat] Escalation check result:', {
          userId: userId.slice(0, 8) + '...',
          tier: escalation?.tier,
          shouldEscalate: escalation?.shouldEscalate,
          category: escalation?.category,
          confidence: escalation?.confidence,
          hasEscalation: !!escalation
        });

        // Create escalation records for Tier 2 (Elevated) and Tier 3 (Critical)
        if (escalation && escalation.shouldEscalate) {
          const tier = escalation.tier;
          if (tier === EscalationTier.ElevatedRisk || tier === EscalationTier.CriticalRisk) {
            console.log(`[pulsecheck-chat] Creating escalation record for Tier ${tier}`);
            // Trigger escalation record creation asynchronously
            createEscalationRecord(db, userId, newConvoId, aiMsg.id, message, escalation)
              .then(recordId => {
                console.log('[pulsecheck-chat] Escalation record created successfully:', recordId);
              })
              .catch(err => {
                console.error('[pulsecheck-chat] Escalation record creation error:', err);
                console.error('[pulsecheck-chat] Error stack:', err.stack);
              });
          } else {
            console.log(`[pulsecheck-chat] Escalation tier ${tier} does not require record creation (Tier 2/3 only)`);
          }
        } else {
          console.log('[pulsecheck-chat] No escalation needed or shouldEscalate is false');
        }
      } catch (escErr) {
        console.error('[pulsecheck-chat] Escalation classification error:', escErr);
        console.error('[pulsecheck-chat] Escalation error stack:', escErr.stack);
        // Don't fail the chat if classification fails
      }
    } else {
      console.log('[pulsecheck-chat] Escalation skipped (skipEscalation=true)');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        conversationId: newConvoId,
        assistantMessage,
        escalation: escalation ? {
          tier: escalation.tier,
          category: escalation.category,
          reason: escalation.reason,
          confidence: escalation.confidence,
          shouldEscalate: escalation.shouldEscalate
        } : null
      })
    };
  } catch (error) {
    console.error('[pulsecheck-chat] error', error);
    console.error('[pulsecheck-chat] error stack', error.stack);
    console.error('[pulsecheck-chat] error message', error.message);
    
    // Return more detailed error for debugging (but don't expose sensitive info)
    const errorMessage = error.message || 'Unknown error';
    const isDevelopment = process.env.NETLIFY_DEV === 'true' || process.env.NODE_ENV === 'development';
    
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ 
        error: 'Server error',
        detail: isDevelopment ? errorMessage : undefined,
        type: error.name || 'Error'
      }) 
    };
  }
};

function cryptoRandomId() {
  // simple random id; not cryptographically secure but fine for UI ids
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

/**
 * Classify message for escalation
 */
async function classifyEscalation(db, userId, message, recentMessages, conversationId) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  // Load escalation conditions from Firestore
  let conditionsSnap;
  try {
    console.log('[pulsecheck-chat] Loading escalation conditions from Firestore...');
    conditionsSnap = await db
      .collection('escalation-conditions')
      .where('isActive', '==', true)
      .orderBy('tier', 'asc')
      .orderBy('priority', 'desc')
      .get();
    console.log(`[pulsecheck-chat] Loaded ${conditionsSnap.docs.length} active escalation conditions`);
  } catch (queryError) {
    console.error('[pulsecheck-chat] Error loading escalation conditions:', queryError);
    console.error('[pulsecheck-chat] Query error details:', {
      message: queryError.message,
      code: queryError.code,
      stack: queryError.stack
    });
    // If query fails (e.g., missing index), continue without conditions
    return null;
  }

  const conditions = conditionsSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  if (conditions.length === 0) {
    console.warn('[pulsecheck-chat] No active escalation conditions found - classification may be less accurate');
  }

  // Build training context
  const trainingContext = buildEscalationTrainingContext(conditions);

  // Build classification prompt
  const systemPrompt = `You are a clinical safety classifier for PulseCheck.

ESCALATION TIERS:
- Tier 0 (None): Normal conversation
- Tier 1 (Monitor-Only): Low-risk concerns, notify coach
- Tier 2 (Elevated Risk): Consent-based clinical escalation
- Tier 3 (Critical Risk): MANDATORY immediate escalation

${trainingContext}

Respond with JSON only:
{"tier":0-3,"category":"string","reason":"brief reason","confidence":0.0-1.0,"shouldEscalate":boolean}

CRITICAL: Err on side of caution. Tier 3 has ZERO threshold for safety concerns.`;

  const conversationContext = recentMessages.length > 0
    ? '\nRecent messages:\n' + recentMessages.slice(-5).map(m => 
        `${m.isFromUser ? 'User' : 'AI'}: ${m.content}`
      ).join('\n')
    : '';

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Classify this message:\n\n"${message}"${conversationContext}` }
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' }
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[pulsecheck-chat] Classification API error:', {
        status: res.status,
        statusText: res.statusText,
        error: errorText
      });
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.warn('[pulsecheck-chat] Classification API returned no content');
      return null;
    }
    
    try {
      const parsed = JSON.parse(content);
      console.log('[pulsecheck-chat] Classification result:', parsed);
      return parsed;
    } catch (parseErr) {
      console.error('[pulsecheck-chat] Failed to parse classification JSON:', parseErr);
      console.error('[pulsecheck-chat] Raw content:', content);
      return null;
    }
  } catch (err) {
    console.error('[pulsecheck-chat] Classification error:', err);
    console.error('[pulsecheck-chat] Classification error stack:', err.stack);
    return null;
  }
}

/**
 * Build training context from conditions
 */
function buildEscalationTrainingContext(conditions) {
  const tier1 = conditions.filter(c => c.tier === 1);
  const tier2 = conditions.filter(c => c.tier === 2);
  const tier3 = conditions.filter(c => c.tier === 3);

  const fmt = (c) => `- ${c.title}: ${c.description}${c.examplePhrases?.length ? ` (e.g. "${c.examplePhrases[0]}")` : ''}`;

  let ctx = '';
  if (tier1.length) ctx += '\nTier 1 conditions:\n' + tier1.map(fmt).join('\n');
  if (tier2.length) ctx += '\nTier 2 conditions:\n' + tier2.map(fmt).join('\n');
  if (tier3.length) ctx += '\nTier 3 conditions:\n' + tier3.map(fmt).join('\n');
  
  return ctx || 'Use clinical judgment for escalation.';
}

/**
 * Create escalation record for Tier 2/3
 */
async function createEscalationRecord(db, userId, conversationId, messageId, triggerContent, classification) {
  try {
    console.log('[pulsecheck-chat] createEscalationRecord called with:', {
      userId: userId.slice(0, 8) + '...',
      conversationId,
      tier: classification.tier,
      category: classification.category
    });
    
    const nowSec = Math.floor(Date.now() / 1000);
    
    const data = {
      userId,
      conversationId,
      tier: classification.tier,
      category: classification.category || 'general',
      triggerMessageId: messageId,
      triggerContent: triggerContent,
      classificationReason: classification.reason || '',
      classificationConfidence: classification.confidence || 0,
      consentStatus: classification.tier === EscalationTier.CriticalRisk ? 'not-required' : 'pending',
      handoffStatus: 'pending',
      coachNotified: false,
      createdAt: nowSec,
      status: 'active'
    };

    console.log('[pulsecheck-chat] Creating escalation record in Firestore...');
    const docRef = await db.collection('escalation-records').add(data);
    console.log('[pulsecheck-chat] Escalation record document created with ID:', docRef.id);
    
    await docRef.update({ id: docRef.id });
    console.log('[pulsecheck-chat] Updated escalation record with ID field');

    // Update conversation state
    console.log('[pulsecheck-chat] Updating conversation with escalation state...');
    await db.collection('conversations').doc(conversationId).set({
      escalationTier: classification.tier,
      escalationStatus: 'active',
      escalationRecordId: docRef.id,
      isInSafetyMode: classification.tier === EscalationTier.CriticalRisk,
      lastEscalationAt: nowSec
    }, { merge: true });
    console.log('[pulsecheck-chat] Conversation updated successfully');

    console.log('[pulsecheck-chat] Escalation record created successfully:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('[pulsecheck-chat] Error in createEscalationRecord:', error);
    console.error('[pulsecheck-chat] Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    throw error; // Re-throw so caller can handle it
  }
}


