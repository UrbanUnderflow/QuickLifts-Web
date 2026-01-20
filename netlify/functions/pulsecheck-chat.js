// PulseCheck Chat Function (MVP)
// - Accepts user message and optional conversationId
// - Loads minimal user context
// - Loads recent conversation messages
// - Calls OpenAI Chat Completions (requires OPEN_AI_SECRET_KEY)
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
    const apiKey = process.env.OPEN_AI_SECRET_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing OPEN_AI_SECRET_KEY' }) };
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
    
    console.log('[pulsecheck-chat] ========== ESCALATION FLOW START ==========');
    console.log('[pulsecheck-chat] Escalation parameters:', {
      skipEscalation,
      userId: userId.slice(0, 8) + '...',
      messageLength: message.length,
      messagePreview: message.substring(0, 50) + '...',
      recentMessagesCount: recentMessages?.length || 0,
      conversationId: newConvoId
    });
    
    if (!skipEscalation) {
      try {
        console.log('[pulsecheck-chat] [1/5] Starting escalation classification...');
        const classificationStartTime = Date.now();
        
        escalation = await classifyEscalation(
          db,
          userId,
          message,
          recentMessages,
          newConvoId
        );
        
        const classificationDuration = Date.now() - classificationStartTime;
        console.log(`[pulsecheck-chat] [2/5] Classification completed in ${classificationDuration}ms`);
        console.log('[pulsecheck-chat] [2/5] Escalation classification result:', {
          hasResult: !!escalation,
          tier: escalation?.tier,
          tierName: escalation?.tier === 0 ? 'None' : escalation?.tier === 1 ? 'MonitorOnly' : escalation?.tier === 2 ? 'ElevatedRisk' : escalation?.tier === 3 ? 'CriticalRisk' : 'Unknown',
          shouldEscalate: escalation?.shouldEscalate,
          category: escalation?.category,
          reason: escalation?.reason,
          confidence: escalation?.confidence,
          fullObject: JSON.stringify(escalation, null, 2)
        });

        // Create escalation records for Tier 2 (Elevated) and Tier 3 (Critical)
        console.log('[pulsecheck-chat] [3/5] Evaluating escalation record creation...');
        console.log('[pulsecheck-chat] [3/5] Evaluation checks:', {
          hasEscalation: !!escalation,
          shouldEscalate: escalation?.shouldEscalate,
          tier: escalation?.tier,
          isTier2: escalation?.tier === EscalationTier.ElevatedRisk,
          isTier3: escalation?.tier === EscalationTier.CriticalRisk,
          shouldCreateRecord: escalation && escalation.shouldEscalate && (escalation.tier === EscalationTier.ElevatedRisk || escalation.tier === EscalationTier.CriticalRisk)
        });
        
        if (escalation && escalation.shouldEscalate) {
          const tier = escalation.tier;
          console.log(`[pulsecheck-chat] [4/5] Escalation triggered! Tier: ${tier}`);
          
          if (tier === EscalationTier.ElevatedRisk || tier === EscalationTier.CriticalRisk) {
            console.log(`[pulsecheck-chat] [4/5] Tier ${tier} requires record creation - proceeding...`);
            console.log(`[pulsecheck-chat] [4/5] Record creation params:`, {
              userId: userId.slice(0, 8) + '...',
              conversationId: newConvoId,
              messageId: aiMsg.id,
              tier,
              category: escalation.category
            });
            
            // Trigger escalation record creation asynchronously
            const recordCreationStartTime = Date.now();
            createEscalationRecord(db, userId, newConvoId, aiMsg.id, message, escalation)
              .then(recordId => {
                const recordCreationDuration = Date.now() - recordCreationStartTime;
                console.log(`[pulsecheck-chat] [5/5] ✅ Escalation record created successfully in ${recordCreationDuration}ms`);
                console.log(`[pulsecheck-chat] [5/5] Record ID: ${recordId}`);
                console.log('[pulsecheck-chat] ========== ESCALATION FLOW SUCCESS ==========');
              })
              .catch(err => {
                const recordCreationDuration = Date.now() - recordCreationStartTime;
                console.error(`[pulsecheck-chat] [5/5] ❌ Escalation record creation FAILED after ${recordCreationDuration}ms`);
                console.error('[pulsecheck-chat] [5/5] Error details:', {
                  message: err.message,
                  code: err.code,
                  stack: err.stack
                });
                console.error('[pulsecheck-chat] ========== ESCALATION FLOW FAILED ==========');
              });
          } else {
            console.log(`[pulsecheck-chat] [4/5] Tier ${tier} does not require record creation (only Tier 2/3 create records)`);
            console.log('[pulsecheck-chat] ========== ESCALATION FLOW COMPLETE (No record needed) ==========');
          }
        } else {
          console.log('[pulsecheck-chat] [3/5] No escalation record needed:', {
            reason: !escalation ? 'No escalation result' : !escalation.shouldEscalate ? 'shouldEscalate is false' : 'Unknown',
            escalationTier: escalation?.tier
          });
          console.log('[pulsecheck-chat] ========== ESCALATION FLOW COMPLETE (No escalation) ==========');
        }
      } catch (escErr) {
        console.error('[pulsecheck-chat] ❌ ESCALATION CLASSIFICATION EXCEPTION');
        console.error('[pulsecheck-chat] Error type:', escErr.constructor.name);
        console.error('[pulsecheck-chat] Error message:', escErr.message);
        console.error('[pulsecheck-chat] Error code:', escErr.code);
        console.error('[pulsecheck-chat] Error stack:', escErr.stack);
        console.error('[pulsecheck-chat] ========== ESCALATION FLOW ERROR ==========');
        // Don't fail the chat if classification fails
      }
    } else {
      console.log('[pulsecheck-chat] ⏭️ Escalation skipped (skipEscalation=true)');
      console.log('[pulsecheck-chat] ========== ESCALATION FLOW SKIPPED ==========');
    }

    // Prepare response
    const escalationResponse = escalation ? {
      tier: escalation.tier,
      category: escalation.category,
      reason: escalation.reason,
      confidence: escalation.confidence,
      shouldEscalate: escalation.shouldEscalate
    } : null;
    
    console.log('[pulsecheck-chat] ========== RESPONSE PREPARATION ==========');
    console.log('[pulsecheck-chat] Response escalation object:', {
      hasEscalation: !!escalationResponse,
      escalationResponse: JSON.stringify(escalationResponse, null, 2)
    });
    console.log('[pulsecheck-chat] Full response payload:', {
      conversationId: newConvoId,
      assistantMessageLength: assistantMessage.length,
      hasEscalation: !!escalationResponse,
      escalationTier: escalationResponse?.tier,
      escalationShouldEscalate: escalationResponse?.shouldEscalate
    });
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        conversationId: newConvoId,
        assistantMessage,
        escalation: escalationResponse
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
  const apiKey = process.env.OPEN_AI_SECRET_KEY;
  if (!apiKey) return null;

  // Load escalation conditions from Firestore
  console.log('[classifyEscalation] [STEP 1] Loading escalation conditions from Firestore...');
  console.log('[classifyEscalation] [STEP 1] Query parameters:', {
    collection: 'escalation-conditions',
    filter: 'isActive == true',
    orderBy: ['tier asc', 'priority desc']
  });
  
  let conditionsSnap;
  try {
    const queryStartTime = Date.now();
    conditionsSnap = await db
      .collection('escalation-conditions')
      .where('isActive', '==', true)
      .orderBy('tier', 'asc')
      .orderBy('priority', 'desc')
      .get();
    const queryDuration = Date.now() - queryStartTime;
    console.log(`[classifyEscalation] [STEP 1] ✅ Query completed in ${queryDuration}ms`);
    console.log(`[classifyEscalation] [STEP 1] Loaded ${conditionsSnap.docs.length} documents`);
  } catch (queryError) {
    console.error('[classifyEscalation] [STEP 1] ❌ Query FAILED');
    console.error('[classifyEscalation] [STEP 1] Error type:', queryError.constructor.name);
    console.error('[classifyEscalation] [STEP 1] Error message:', queryError.message);
    console.error('[classifyEscalation] [STEP 1] Error code:', queryError.code);
    console.error('[classifyEscalation] [STEP 1] Error stack:', queryError.stack);
    // If query fails (e.g., missing index), continue without conditions
    return null;
  }

  console.log('[classifyEscalation] [STEP 2] Processing conditions...');
  const conditions = conditionsSnap.docs.map((doc, index) => {
    const data = doc.data();
    console.log(`[classifyEscalation] [STEP 2] Condition ${index + 1}/${conditionsSnap.docs.length}:`, {
      id: doc.id,
      tier: data.tier,
      category: data.category,
      title: data.title,
      isActive: data.isActive,
      priority: data.priority,
      examplePhrasesCount: data.examplePhrases?.length || 0,
      keywordsCount: data.keywords?.length || 0
    });
    return {
      id: doc.id,
      ...data
    };
  });
  
  if (conditions.length === 0) {
    console.warn('[classifyEscalation] [STEP 2] ⚠️ No active escalation conditions found');
    console.warn('[classifyEscalation] [STEP 2] Classification will proceed with default behavior');
    // Continue with classification but with minimal context
  } else {
    const tierBreakdown = {
      tier0: conditions.filter(c => c.tier === 0).length,
      tier1: conditions.filter(c => c.tier === 1).length,
      tier2: conditions.filter(c => c.tier === 2).length,
      tier3: conditions.filter(c => c.tier === 3).length
    };
    console.log('[classifyEscalation] [STEP 2] ✅ Conditions breakdown:', tierBreakdown);
    console.log('[classifyEscalation] [STEP 2] Total conditions:', conditions.length);
  }

  // Build training context
  console.log('[classifyEscalation] [STEP 3] Building training context...');
  const trainingContext = buildEscalationTrainingContext(conditions);
  console.log('[classifyEscalation] [STEP 3] Training context length:', trainingContext.length);
  console.log('[classifyEscalation] [STEP 3] Training context preview:', trainingContext.substring(0, 200) + '...');

  // Build classification prompt
  console.log('[classifyEscalation] [STEP 4] Building classification prompt...');
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

  console.log('[classifyEscalation] [STEP 4] Prompt details:', {
    systemPromptLength: systemPrompt.length,
    userMessageLength: message.length,
    conversationContextLength: conversationContext.length,
    recentMessagesCount: recentMessages.length
  });

  console.log('[classifyEscalation] [STEP 5] Calling OpenAI API for classification...');
  console.log('[classifyEscalation] [STEP 5] API request details:', {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    hasApiKey: !!apiKey,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING'
  });

  try {
    const apiCallStartTime = Date.now();
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

    const apiCallDuration = Date.now() - apiCallStartTime;
    console.log(`[classifyEscalation] [STEP 5] API call completed in ${apiCallDuration}ms`);
    console.log('[classifyEscalation] [STEP 5] Response status:', res.status, res.statusText);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('[classifyEscalation] [STEP 5] ❌ API call FAILED');
      console.error('[classifyEscalation] [STEP 5] Error details:', {
        status: res.status,
        statusText: res.statusText,
        error: errorText,
        headers: Object.fromEntries(res.headers.entries())
      });
      return null;
    }

    console.log('[classifyEscalation] [STEP 6] Parsing API response...');
    const data = await res.json();
    console.log('[classifyEscalation] [STEP 6] Response structure:', {
      hasChoices: !!data.choices,
      choicesCount: data.choices?.length || 0,
      model: data.model,
      usage: data.usage
    });
    
    const content = data.choices?.[0]?.message?.content;
    console.log('[classifyEscalation] [STEP 6] Content extracted:', {
      hasContent: !!content,
      contentLength: content?.length || 0,
      contentPreview: content ? content.substring(0, 200) + '...' : 'NONE'
    });
    
    if (!content) {
      console.warn('[classifyEscalation] [STEP 6] ⚠️ No content in response');
      console.warn('[classifyEscalation] [STEP 6] Full response:', JSON.stringify(data, null, 2));
      return null;
    }
    
    console.log('[classifyEscalation] [STEP 7] Parsing JSON content...');
    try {
      const parsed = JSON.parse(content);
      console.log('[classifyEscalation] [STEP 7] ✅ JSON parsed successfully');
      console.log('[classifyEscalation] [STEP 7] Raw classification result:', JSON.stringify(parsed, null, 2));
      
      console.log('[classifyEscalation] [STEP 8] Validating and normalizing classification result...');
      
      // Ensure shouldEscalate is set correctly based on tier
      // Tier 2 (Elevated) and Tier 3 (Critical) should always escalate
      // Tier 1 (Monitor) might escalate depending on the response
      // Tier 0 (None) should never escalate
      const originalTier = parsed.tier;
      const originalShouldEscalate = parsed.shouldEscalate;
      
      if (parsed.tier === undefined || parsed.tier === null) {
        console.warn('[classifyEscalation] [STEP 8] ⚠️ Classification missing tier, defaulting to 0');
        parsed.tier = 0;
      }
      
      // Set shouldEscalate based on tier if not provided or incorrect
      if (parsed.shouldEscalate === undefined || parsed.shouldEscalate === null) {
        parsed.shouldEscalate = parsed.tier >= EscalationTier.ElevatedRisk;
        console.log('[classifyEscalation] [STEP 8] Set shouldEscalate based on tier:', {
          tier: parsed.tier,
          shouldEscalate: parsed.shouldEscalate,
          reason: 'was undefined/null'
        });
      } else if (parsed.tier >= EscalationTier.ElevatedRisk && !parsed.shouldEscalate) {
        // Override: Tier 2/3 must escalate
        console.warn('[classifyEscalation] [STEP 8] ⚠️ Overriding shouldEscalate to true for tier', parsed.tier);
        parsed.shouldEscalate = true;
      } else if (parsed.tier === EscalationTier.None && parsed.shouldEscalate) {
        // Override: Tier 0 should not escalate
        console.warn('[classifyEscalation] [STEP 8] ⚠️ Overriding shouldEscalate to false for tier 0');
        parsed.shouldEscalate = false;
      }
      
      console.log('[classifyEscalation] [STEP 8] Validation complete:', {
        original: { tier: originalTier, shouldEscalate: originalShouldEscalate },
        final: { tier: parsed.tier, shouldEscalate: parsed.shouldEscalate },
        changed: originalTier !== parsed.tier || originalShouldEscalate !== parsed.shouldEscalate
      });
      
      console.log('[classifyEscalation] [STEP 8] ✅ Final classification result:', JSON.stringify(parsed, null, 2));
      console.log('[classifyEscalation] ========== CLASSIFICATION COMPLETE ==========');
      return parsed;
    } catch (parseErr) {
      console.error('[classifyEscalation] [STEP 7] ❌ JSON parse FAILED');
      console.error('[classifyEscalation] [STEP 7] Parse error:', {
        message: parseErr.message,
        stack: parseErr.stack
      });
      console.error('[classifyEscalation] [STEP 7] Raw content that failed to parse:', content);
      console.error('[classifyEscalation] [STEP 7] Content length:', content.length);
      console.error('[classifyEscalation] [STEP 7] Content type:', typeof content);
      return null;
    }
  } catch (err) {
    console.error('[classifyEscalation] ❌ CLASSIFICATION EXCEPTION');
    console.error('[classifyEscalation] Error type:', err.constructor.name);
    console.error('[classifyEscalation] Error message:', err.message);
    console.error('[classifyEscalation] Error code:', err.code);
    console.error('[classifyEscalation] Error stack:', err.stack);
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
  console.log('[createEscalationRecord] ========== RECORD CREATION START ==========');
  console.log('[createEscalationRecord] [STEP 1] Function called with parameters:', {
    userId: userId.slice(0, 8) + '...',
    conversationId,
    messageId,
    triggerContentLength: triggerContent.length,
    triggerContentPreview: triggerContent.substring(0, 50) + '...',
    classification: JSON.stringify(classification, null, 2)
  });
  
  try {
    console.log('[createEscalationRecord] [STEP 2] Preparing record data...');
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

    console.log('[createEscalationRecord] [STEP 2] Record data prepared:', {
      tier: data.tier,
      category: data.category,
      consentStatus: data.consentStatus,
      handoffStatus: data.handoffStatus,
      createdAt: data.createdAt,
      status: data.status,
      hasTriggerContent: !!data.triggerContent,
      triggerContentLength: data.triggerContent.length,
      hasReason: !!data.classificationReason,
      confidence: data.classificationConfidence
    });

    console.log('[createEscalationRecord] [STEP 3] Creating document in escalation-records collection...');
    const addStartTime = Date.now();
    const docRef = await db.collection('escalation-records').add(data);
    const addDuration = Date.now() - addStartTime;
    console.log(`[createEscalationRecord] [STEP 3] ✅ Document created in ${addDuration}ms`);
    console.log('[createEscalationRecord] [STEP 3] Document ID:', docRef.id);
    console.log('[createEscalationRecord] [STEP 3] Document path:', docRef.path);
    
    console.log('[createEscalationRecord] [STEP 4] Updating document with ID field...');
    const updateStartTime = Date.now();
    await docRef.update({ id: docRef.id });
    const updateDuration = Date.now() - updateStartTime;
    console.log(`[createEscalationRecord] [STEP 4] ✅ ID field updated in ${updateDuration}ms`);

    console.log('[createEscalationRecord] [STEP 5] Updating conversation document...');
    const conversationUpdateStartTime = Date.now();
    const conversationUpdate = {
      escalationTier: classification.tier,
      escalationStatus: 'active',
      escalationRecordId: docRef.id,
      isInSafetyMode: classification.tier === EscalationTier.CriticalRisk,
      lastEscalationAt: nowSec
    };
    console.log('[createEscalationRecord] [STEP 5] Conversation update data:', conversationUpdate);
    
    await db.collection('conversations').doc(conversationId).set(conversationUpdate, { merge: true });
    const conversationUpdateDuration = Date.now() - conversationUpdateStartTime;
    console.log(`[createEscalationRecord] [STEP 5] ✅ Conversation updated in ${conversationUpdateDuration}ms`);
    console.log('[createEscalationRecord] [STEP 5] Conversation ID:', conversationId);

    console.log('[createEscalationRecord] ========== RECORD CREATION SUCCESS ==========');
    console.log('[createEscalationRecord] Final record ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('[createEscalationRecord] ========== RECORD CREATION FAILED ==========');
    console.error('[createEscalationRecord] Error type:', error.constructor.name);
    console.error('[createEscalationRecord] Error message:', error.message);
    console.error('[createEscalationRecord] Error code:', error.code);
    console.error('[createEscalationRecord] Error stack:', error.stack);
    console.error('[createEscalationRecord] Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    throw error; // Re-throw so caller can handle it
  }
}


