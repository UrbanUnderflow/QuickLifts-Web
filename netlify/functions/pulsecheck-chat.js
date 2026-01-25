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

// ============================================================================
// Mental assignment reminder onboarding (chat-driven preference capture)
// ============================================================================

function normalizeText(t) {
  return String(t || '').trim().toLowerCase();
}

function parseYesNo(text) {
  const t = normalizeText(text);
  if (!t) return null;
  if (/\b(yes|yeah|yep|sure|ok|okay|please do|do it|enable|turn on)\b/.test(t)) return 'yes';
  if (/\b(no|nope|nah|don't|do not|stop|disable|turn off)\b/.test(t)) return 'no';
  return null;
}

function parseTimeFromText(text) {
  const t = normalizeText(text);
  if (!t) return null;
  if (/\bnoon\b/.test(t)) return { hour: 12, minute: 0 };
  if (/\bmidnight\b/.test(t)) return { hour: 0, minute: 0 };

  // e.g. "7", "7pm", "7:30 pm", "19:15"
  const m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const ampm = m[3];

  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) return null;

  if (ampm) {
    if (hour < 1 || hour > 12) return null;
    if (ampm === 'pm' && hour !== 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
  } else {
    // 24h fallback
    if (hour < 0 || hour > 23) return null;
  }

  return { hour, minute };
}

function shouldUseSmartNoon(text) {
  const t = normalizeText(text);
  return /\b(you decide|you choose|whatever you think|best time|surprise me|up to you|pick for me)\b/.test(t);
}

async function getActiveMentalAssignments(db, userId) {
  const snap = await db
    .collection('mental-exercise-assignments')
    .where('athleteUserId', '==', userId)
    .where('status', 'in', ['pending', 'in_progress'])
    .limit(5)
    .get();
  return snap.empty ? [] : snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

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
      systemPromptContext, // DEPRECATED: iOS used to send full prompt, now sends raw data
      userContext,         // Optional: iOS sends structured user context
      healthContext,       // Optional: iOS sends health data from HealthKit
      lastNoraResponseLength, // Optional: For turn-taking detection
      recentMessages: clientRecentMessages // Optional: iOS may send its own recent messages
    } = body;

    if (!userId || !message) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing userId or message' }) };
    }

    // Always load user doc for preferences (even if iOS provides userContext)
    let userSnapForPrefs = null;
    let userDataForPrefs = {};
    try {
      userSnapForPrefs = await db.collection('users').doc(userId).get();
      userDataForPrefs = userSnapForPrefs.exists ? (userSnapForPrefs.data() || {}) : {};
    } catch (e) {
      console.error('[pulsecheck-chat] Error loading user prefs:', e);
      userDataForPrefs = {};
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
        const userData = userDataForPrefs || {};
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

    // =========================================================================
    // Response Context Detection (for natural conversation flow)
    // =========================================================================
    
    function classifyResponseContext(userMessage, lastNoraResponseLength) {
      const lowercased = userMessage.toLowerCase();
      const wordCount = userMessage.split(/\s+/).filter(w => w.length > 0).length;
      
      // 1. TURN-TAKING: If Nora just gave a long response (100+ words), keep this one shorter
      if (lastNoraResponseLength && lastNoraResponseLength > 100) {
        return {
          context: 'turnTaking',
          wordRange: { min: 40, max: 80 },
          maxTokens: 220
        };
      }
      
      // 2. TEACHING: User asking "how", "what should I", "why", "explain", etc.
      const teachingIndicators = [
        'how do i', 'how can i', 'how should i',
        'what should', 'what can i do',
        'why do i', 'why does', 'why is',
        'explain', 'help me understand',
        'what\'s the best way', 'any tips',
        'advice on', 'advice for',
        'what would you recommend', 'what do you suggest'
      ];
      if (teachingIndicators.some(indicator => lowercased.includes(indicator))) {
        return {
          context: 'teaching',
          wordRange: { min: 100, max: 200 },
          maxTokens: 450
        };
      }
      
      // 3. QUICK EXCHANGE: User sent a very short message (<15 words)
      if (wordCount < 15) {
        const shortQuestionIndicators = ['?', 'what', 'how', 'why', 'when', 'where', 'who'];
        const isQuestion = shortQuestionIndicators.some(ind => lowercased.includes(ind));
        
        // Short questions might need teaching, not quick exchange
        if (isQuestion && teachingIndicators.some(indicator => lowercased.includes(indicator))) {
          return {
            context: 'teaching',
            wordRange: { min: 100, max: 200 },
            maxTokens: 450
          };
        }
        
        return {
          context: 'quickExchange',
          wordRange: { min: 30, max: 50 },
          maxTokens: 150
        };
      }
      
      // 4. LISTENING: User sharing deeply (long message OR emotional content)
      const emotionalIndicators = [
        'i feel', 'i\'m feeling', 'feeling like',
        'struggling', 'overwhelmed', 'stressed',
        'disappointed', 'frustrated', 'anxious',
        'worried', 'scared', 'nervous',
        'not my best', 'hard time', 'difficult'
      ];
      const isEmotionalShare = emotionalIndicators.some(ind => lowercased.includes(ind));
      
      if (wordCount > 80 || isEmotionalShare) {
        return {
          context: 'listening',
          wordRange: { min: 30, max: 60 },
          maxTokens: 180
        };
      }
      
      // 5. STANDARD: Default balanced conversation
      return {
        context: 'standard',
        wordRange: { min: 60, max: 100 },
        maxTokens: 280
      };
    }
    
    // Detect response context
    const responseContext = classifyResponseContext(message, lastNoraResponseLength);
    console.log(`[pulsecheck-chat] Response context: ${responseContext.context}, word range: ${responseContext.wordRange.min}-${responseContext.wordRange.max}`);
    
    // =========================================================================
    // Build System Prompt (centralized for both iOS and web)
    // =========================================================================
    
    const basePersona = `You are **Nora**, an elite AI mental performance coach. Your workout data now talks back.

Tone ▸ Warm, intellectually sharp, quietly confident.

Conversation Style ▸ 
- Respond naturally like a real person in conversation
- Match the user's energy: short messages get short responses, deep questions get thorough answers
- When they share deeply or emotionally, validate briefly and give them space to continue
- When they ask questions or need explanation, provide thorough guidance
- After you give a long response, keep the next one shorter (take turns in conversation)

Approach ▸ Active-listening → concise reflection → actionable insight when appropriate.
Style ▸ Use the athlete's first name. No clichés or filler. Be genuine and present.
Don'ts ▸ Never repeat a question they already answered. Never apologize unless a real mistake.`;

    // Build user context section
    let userContextSection = `## User Context:\n- Name: ${displayName}`;
    if (sport) userContextSection += `\n- Sport/Activity: ${sport}`;
    if (userContext?.mood) userContextSection += `\n- Current Mood: ${userContext.mood}/10`;
    if (goals.length) userContextSection += `\n- Mental Performance Goals: ${goals.join(', ')}`;
    
    // Add health context if provided (iOS sends this from HealthKit)
    let healthContextSection = '';
    if (healthContext) {
      healthContextSection = `\n\n## Health & Fitness Context:\n${healthContext}\n\nUse this health data to provide personalized insights and recommendations. Reference specific patterns, trends, and achievements when relevant to the conversation. Be encouraging about positive trends and supportive about areas for improvement.`;
    }
    
    // Add context-specific instructions
    let contextInstructions = '';
    switch (responseContext.context) {
      case 'teaching':
        contextInstructions = `\n\n## Response Mode: TEACHING\nThe user is asking for help, explanation, or guidance.\n\nYOUR RESPONSE SHOULD:\n- Be thorough and educational (${responseContext.wordRange.min}-${responseContext.wordRange.max} words)\n- Explain the concept or strategy clearly\n- Give a specific, actionable example they can use\n- End with a check-in question to ensure understanding\n\nThis is a coaching moment - take the time to teach properly.`;
        break;
      case 'listening':
        contextInstructions = `\n\n## Response Mode: LISTENING\nThe user is sharing something meaningful or emotional.\n\nYOUR RESPONSE MUST:\n- Be brief and validating (${responseContext.wordRange.min}-${responseContext.wordRange.max} words)\n- Show you heard the specific details they shared\n- Validate the weight of what they're carrying\n- Reframe any self-criticism positively\n- End with an open question that gives them space: "How are you feeling about that?" or "How are you holding up?"\n\nDO NOT:\n- Ask "what action can you take?" or offer solutions yet\n- Pivot to achievements/PRs unless they asked\n- Match their message length - they need space to continue sharing`;
        break;
      case 'quickExchange':
        contextInstructions = `\n\n## Response Mode: QUICK EXCHANGE\nThe user sent a short message. Match their energy.\n\nYOUR RESPONSE SHOULD:\n- Be snappy and conversational (${responseContext.wordRange.min}-${responseContext.wordRange.max} words)\n- Match their brevity\n- Keep the dialogue flowing naturally`;
        break;
      case 'turnTaking':
        contextInstructions = `\n\n## Response Mode: TURN-TAKING\nYou just gave a longer response. Now it's their turn to talk more.\n\nYOUR RESPONSE SHOULD:\n- Be moderate in length (${responseContext.wordRange.min}-${responseContext.wordRange.max} words)\n- Avoid another long explanation\n- Give them space to respond and continue the conversation`;
        break;
      case 'standard':
        contextInstructions = `\n\n## Response Mode: STANDARD\nBalanced conversational response (${responseContext.wordRange.min}-${responseContext.wordRange.max} words).\nBe natural and genuine.`;
        break;
    }
    
    // Build final system prompt
    let systemPrompt = `${basePersona}\n\n${userContextSection}${healthContextSection}${contextInstructions}\n\n### Conversation Memory Rule\nBefore asking a question, scan the last 6 messages. If you already asked it and the user answered, **do not ask again**.\nInstead, acknowledge their answer and advance the topic.`;
    
    // Legacy support: If iOS still sends systemPromptContext (old version), use it but log a warning
    if (systemPromptContext && !healthContext) {
      console.warn('[pulsecheck-chat] DEPRECATED: iOS sent systemPromptContext. Please update to send healthContext and userContext separately.');
      systemPrompt = `${systemPromptContext}\n\n### Conversation Memory Rule\nBefore asking a question, scan the last 6 messages. If you already asked it and the user answered, do not ask again. Acknowledge their answer and advance the topic.`;
    }

    // =========================================================================
    // Assignment reminder onboarding (before OpenAI)
    // =========================================================================
    const assignmentPrefs = userDataForPrefs?.mentalTrainingPreferences?.assignmentReminders;
    const onboarding = userDataForPrefs?.mentalTrainingPreferences?.assignmentRemindersOnboarding || {};
    const onboardingState = onboarding?.state || 'none';

    let assistantMessage = null;
    let handledOnboarding = false;

    if (onboardingState === 'asked') {
      const yn = parseYesNo(message);
      if (yn === 'no') {
        await db.collection('users').doc(userId).set({
          mentalTrainingPreferences: {
            assignmentReminders: {
              enabled: false,
              updatedAt: new Date()
            },
            assignmentRemindersOnboarding: {
              state: 'none',
              updatedAt: new Date()
            }
          }
        }, { merge: true });
        assistantMessage = `All good, ${displayName.split(' ')[0]} — I won't send reminders for assignments.`;
        handledOnboarding = true;
      } else if (yn === 'yes') {
        await db.collection('users').doc(userId).set({
          mentalTrainingPreferences: {
            assignmentRemindersOnboarding: {
              state: 'awaiting_time',
              updatedAt: new Date()
            }
          }
        }, { merge: true });
        assistantMessage =
          `Got it. What time should I remind you if you haven’t completed your assigned exercise?\n\n` +
          `- Reply with a time like “7pm”\n` +
          `- Or say “you decide” and I’ll default to noon local time.`;
        handledOnboarding = true;
      }
    } else if (onboardingState === 'awaiting_time') {
      const tz =
        assignmentPrefs?.timezone ||
        userDataForPrefs?.dailyReflectionPreferences?.timezone ||
        userDataForPrefs?.timezone ||
        'UTC';

      if (shouldUseSmartNoon(message)) {
        await db.collection('users').doc(userId).set({
          mentalTrainingPreferences: {
            assignmentReminders: {
              enabled: true,
              mode: 'smart',
              hour: 12,
              minute: 0,
              timezone: tz,
              updatedAt: new Date()
            },
            assignmentRemindersOnboarding: {
              state: 'none',
              updatedAt: new Date()
            }
          }
        }, { merge: true });
        assistantMessage = `Perfect. I’ll remind you at noon local time if you haven’t completed your assignment.`;
        handledOnboarding = true;
      } else {
        const parsed = parseTimeFromText(message);
        if (!parsed) {
          assistantMessage = `Tell me a reminder time like “7pm” (or say “you decide” for noon).`;
          handledOnboarding = true;
        } else {
          await db.collection('users').doc(userId).set({
            mentalTrainingPreferences: {
              assignmentReminders: {
                enabled: true,
                mode: 'custom',
                hour: parsed.hour,
                minute: parsed.minute,
                timezone: tz,
                updatedAt: new Date()
              },
              assignmentRemindersOnboarding: {
                state: 'none',
                updatedAt: new Date()
              }
            }
          }, { merge: true });
          const minuteStr = String(parsed.minute).padStart(2, '0');
          assistantMessage = `Done. I’ll remind you at ${parsed.hour}:${minuteStr} (your local time) if you haven’t completed your assignment.`;
          handledOnboarding = true;
        }
      }
    }

    // If not handled, proceed with OpenAI
    if (!handledOnboarding) {
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
      // Support both environment variable names for compatibility
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
          max_tokens: responseContext.maxTokens,
          frequency_penalty: 0.5,
          presence_penalty: 0.3
        })
      });

      if (!completionRes.ok) {
        // Parse OpenAI error response
        let errorData;
        const contentType = completionRes.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            errorData = await completionRes.json();
          } catch (e) {
            const errText = await completionRes.text();
            console.error('[pulsecheck-chat] OpenAI API error (non-JSON):', errText);
            return { 
              statusCode: 502, 
              headers, 
              body: JSON.stringify({ error: 'OpenAI API error', detail: errText.substring(0, 500) }) 
            };
          }
        } else {
          const errText = await completionRes.text();
          console.error('[pulsecheck-chat] OpenAI API error (non-JSON):', errText);
          return { 
            statusCode: 502, 
            headers, 
            body: JSON.stringify({ error: 'OpenAI API error', detail: errText.substring(0, 500) }) 
          };
        }

        // Handle specific OpenAI error types
        const errorType = errorData?.error?.type || errorData?.error?.code;
        const errorMessage = errorData?.error?.message || 'Unknown error';
        
        console.error('[pulsecheck-chat] OpenAI API error:', { errorType, errorMessage, status: completionRes.status });
        
        let userFriendlyMessage = 'AI service temporarily unavailable. Please try again shortly.';
        let statusCode = 502;
        
        if (errorType === 'insufficient_quota' || errorMessage.includes('quota')) {
          userFriendlyMessage = 'AI service quota exceeded. Please check your OpenAI account settings or try again later.';
          statusCode = 429; // Too Many Requests
        } else if (errorType === 'rate_limit_exceeded' || errorMessage.includes('rate limit')) {
          userFriendlyMessage = 'AI service rate limit exceeded. Please wait a moment and try again.';
          statusCode = 429;
        } else if (errorType === 'invalid_api_key' || errorMessage.includes('API key')) {
          userFriendlyMessage = 'AI service configuration error. Please contact support.';
          statusCode = 500;
        } else if (errorMessage) {
          // Include the actual error message for debugging (truncated)
          userFriendlyMessage = `AI service error: ${errorMessage.substring(0, 200)}`;
        }
        
        return { 
          statusCode, 
          headers, 
          body: JSON.stringify({ 
            error: userFriendlyMessage,
            errorType: errorType,
            detail: process.env.NODE_ENV === 'development' ? errorMessage : undefined
          }) 
        };
      }

      const completion = await completionRes.json();
      assistantMessage = completion.choices?.[0]?.message?.content?.trim() || "I'm here to support you. Can you share more?";

      // If user has active assignments and hasn't opted in/out yet, Nora should ask once.
      try {
        const hasExplicitPref = assignmentPrefs?.enabled === true || assignmentPrefs?.enabled === false;
        const lastPromptedAt = onboarding?.lastPromptedAtSec || 0;
        const nowSec = Math.floor(Date.now() / 1000);
        const recentlyPrompted = nowSec - lastPromptedAt < 7 * 24 * 60 * 60; // 7 days

        if (!hasExplicitPref && onboardingState === 'none' && !recentlyPrompted) {
          const activeAssignments = await getActiveMentalAssignments(db, userId);
          if (activeAssignments.length > 0) {
            assistantMessage +=
              `\n\nAlso — you have assigned mental exercises right now. Want me to send reminders if you haven’t completed them by noon (local time)? Reply “yes” or “no”.`;
            await db.collection('users').doc(userId).set({
              mentalTrainingPreferences: {
                assignmentRemindersOnboarding: {
                  state: 'asked',
                  lastPromptedAtSec: nowSec,
                  updatedAt: new Date()
                }
              }
            }, { merge: true });
          }
        }
      } catch (e) {
        console.warn('[pulsecheck-chat] assignment reminder prompt check failed (non-blocking):', e?.message || e);
      }
    }

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

        // Create escalation records for Tier 1+ (Monitor-Only and above)
        console.log('[pulsecheck-chat] [3/5] Evaluating escalation record creation...');
        console.log('[pulsecheck-chat] [3/5] Evaluation checks:', {
          hasEscalation: !!escalation,
          shouldEscalate: escalation?.shouldEscalate,
          tier: escalation?.tier,
          isTier1: escalation?.tier === EscalationTier.MonitorOnly,
          isTier2: escalation?.tier === EscalationTier.ElevatedRisk,
          isTier3: escalation?.tier === EscalationTier.CriticalRisk,
          shouldCreateRecord: escalation && escalation.tier >= EscalationTier.MonitorOnly
        });
        
        if (escalation && escalation.tier >= EscalationTier.MonitorOnly) {
          const tier = escalation.tier;
          console.log(`[pulsecheck-chat] [4/5] Escalation tier detected (record will be saved). Tier: ${tier}`);
          console.log(`[pulsecheck-chat] [4/5] Record creation params:`, {
            userId: userId.slice(0, 8) + '...',
            conversationId: newConvoId,
            messageId: aiMsg.id,
            tier,
            category: escalation.category,
            shouldEscalate: escalation.shouldEscalate
          });
          
          // Trigger escalation record creation asynchronously (Tier 1+)
          const recordCreationStartTime = Date.now();
          createEscalationRecord(db, userId, newConvoId, aiMsg.id, message, escalation)
            .then(async recordId => {
              const recordCreationDuration = Date.now() - recordCreationStartTime;
              console.log(`[pulsecheck-chat] [5/5] ✅ Escalation record created successfully in ${recordCreationDuration}ms`);
              console.log(`[pulsecheck-chat] [5/5] Record ID: ${recordId}`);

              // Tier 1 (Monitor-Only): notify coach (no AuntEdna escalation)
              if (tier === EscalationTier.MonitorOnly) {
                console.log('[pulsecheck-chat] [5/5] Tier 1 => notifying coach (monitor-only)');
                try {
                  await notifyCoachForEscalation(db, recordId, userId, tier);
                  console.log('[pulsecheck-chat] [5/5] ✅ Coach notified for Tier 1 escalation');
                } catch (notifyErr) {
                  console.error('[pulsecheck-chat] [5/5] ❌ Coach notify failed (non-blocking):', notifyErr?.message || notifyErr);
                }
              }

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
          console.log('[pulsecheck-chat] [3/5] No escalation record needed:', {
            reason: !escalation ? 'No escalation result' : escalation.tier === EscalationTier.None ? 'tier is 0 (None)' : 'Unknown',
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
      // Parse OpenAI error response
      let errorData;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          errorData = await res.json();
        } catch (e) {
          const errorText = await res.text();
          console.error('[classifyEscalation] [STEP 5] ❌ API call FAILED (non-JSON error)');
          console.error('[classifyEscalation] [STEP 5] Error details:', {
            status: res.status,
            statusText: res.statusText,
            error: errorText.substring(0, 500),
            headers: Object.fromEntries(res.headers.entries())
          });
          return null;
        }
      } else {
        const errorText = await res.text();
        console.error('[classifyEscalation] [STEP 5] ❌ API call FAILED (non-JSON error)');
        console.error('[classifyEscalation] [STEP 5] Error details:', {
          status: res.status,
          statusText: res.statusText,
          error: errorText.substring(0, 500),
          headers: Object.fromEntries(res.headers.entries())
        });
        return null;
      }

      const errorType = errorData?.error?.type || errorData?.error?.code;
      const errorMessage = errorData?.error?.message || 'Unknown error';
      
      console.error('[classifyEscalation] [STEP 5] ❌ API call FAILED');
      console.error('[classifyEscalation] [STEP 5] Error details:', {
        status: res.status,
        statusText: res.statusText,
        errorType: errorType,
        errorMessage: errorMessage,
        headers: Object.fromEntries(res.headers.entries())
      });
      
      // Log specific quota/rate limit errors
      if (errorType === 'insufficient_quota' || errorMessage.includes('quota')) {
        console.error('[classifyEscalation] [STEP 5] ⚠️ QUOTA EXCEEDED - OpenAI API quota issue');
      } else if (errorType === 'rate_limit_exceeded' || errorMessage.includes('rate limit')) {
        console.error('[classifyEscalation] [STEP 5] ⚠️ RATE LIMIT EXCEEDED');
      }
      
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
    
    // Tier behavior:
    // - Tier 1 (MonitorOnly): save record + notify coach; no consent/handoff needed
    // - Tier 2 (ElevatedRisk): consent-based handoff
    // - Tier 3 (CriticalRisk): mandatory clinical handoff, no consent
    const consentStatus =
      classification.tier === EscalationTier.ElevatedRisk ? 'pending' : 'not-required';

    const data = {
      userId,
      conversationId,
      tier: classification.tier,
      category: classification.category || 'general',
      triggerMessageId: messageId,
      triggerContent: triggerContent,
      classificationReason: classification.reason || '',
      classificationConfidence: classification.confidence || 0,
      consentStatus,
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

/**
 * Tier 1+ coach notification helper (Tier 1 required; Tier 2 optional; Tier 3 optional)
 * Mirrors `pulsecheck-escalation` notifyCoach behavior, but runs locally to avoid function-to-function calls.
 */
async function notifyCoachForEscalation(db, escalationId, userId, tier) {
  const { sendCoachEscalationEmail } = require('./utils/sendCoachEscalationEmail');

  // Find athlete's connected coach
  const connectionSnap = await db
    .collection('athlete-coach-connections')
    .where('athleteId', '==', userId)
    .where('status', '==', 'accepted')
    .limit(1)
    .get();

  if (connectionSnap.empty) {
    console.log('[notifyCoachForEscalation] No coach found for athlete', { userId: userId?.slice?.(0, 8) + '...' });
    return { success: false, reason: 'no_coach_connected' };
  }

  const targetCoachId = connectionSnap.docs[0].data().coachId;
  const nowSec = Math.floor(Date.now() / 1000);

  // Update escalation record (idempotent-ish: overwrite to true)
  await db.collection('escalation-records').doc(escalationId).update({
    coachNotified: true,
    coachId: targetCoachId,
    coachNotifiedAt: nowSec
  });

  // Create notification for coach
  const title = tier === EscalationTier.MonitorOnly ? 'Athlete Check-In (Monitor)' : 'Athlete Check-In Alert';
  const msg =
    tier === EscalationTier.MonitorOnly
      ? 'An athlete you coach was flagged for monitor-only concern. Please review when you can.'
      : 'An athlete you coach has been flagged for elevated concern. Please check your dashboard.';

  await db.collection('notifications').add({
    userId: targetCoachId,
    type: 'escalation-alert',
    title,
    message: msg,
    escalationId,
    athleteId: userId,
    read: false,
    createdAt: nowSec
  });

  // Email coach (non-blocking). Do NOT include conversation details.
  try {
    const coachSnap = await db.collection('users').doc(targetCoachId).get();
    const coach = coachSnap.exists ? (coachSnap.data() || {}) : {};
    const coachEmail = typeof coach.email === 'string' ? coach.email.trim() : '';
    const coachName = (coach.displayName || coach.username || '').trim();

    const athleteSnap = await db.collection('users').doc(userId).get();
    const athlete = athleteSnap.exists ? (athleteSnap.data() || {}) : {};
    const athleteName = (athlete.displayName || athlete.username || 'An athlete').trim();

    if (coachEmail) {
      const siteUrl = process.env.SITE_URL || '';
      const result = await sendCoachEscalationEmail({
        coachEmail,
        coachName,
        athleteName,
        tier,
        siteUrl,
      });
      console.log('[notifyCoachForEscalation] Coach email sent (best-effort):', {
        success: result?.success,
        skipped: result?.skipped,
        tier,
        coachId: targetCoachId,
      });

      // Log to Notification Logs dashboard (email channel; no FCM token)
      try {
        const FieldValue = admin.firestore.FieldValue;
        await db.collection('notification-logs').add({
          fcmToken: coachEmail ? `email:${coachEmail.substring(0, 20)}...` : 'EMAIL',
          title: `Coach escalation email (Tier ${tier})`,
          body:
            tier === EscalationTier.MonitorOnly
              ? 'Tier 1 coach-review escalation email sent (privacy-safe).'
              : `Tier ${tier} clinical-handoff escalation email sent (privacy-safe).`,
          notificationType: 'COACH_ESCALATION_EMAIL',
          functionName: 'netlify/pulsecheck-chat.notifyCoachForEscalation',
          success: !!result?.success,
          messageId: result?.messageId || null,
          error: result?.success
            ? null
            : { code: result?.reason || 'EMAIL_FAILED', message: result?.error || 'Email send failed or skipped' },
          dataPayload: {
            channel: 'email',
            coachId: targetCoachId,
            athleteId: userId,
            escalationId,
            tier,
            skipped: !!result?.skipped,
          },
          timestamp: FieldValue.serverTimestamp(),
          timestampEpoch: nowSec,
          createdAt: FieldValue.serverTimestamp(),
          version: '1.0',
        });
      } catch (logErr) {
        console.warn('[notifyCoachForEscalation] Failed to write notification-logs (non-blocking):', logErr?.message || logErr);
      }
    } else {
      console.log('[notifyCoachForEscalation] Coach email missing; skipping email send', {
        coachId: targetCoachId,
      });

      // Log missing email to Notification Logs dashboard (helps debug why nothing appears)
      try {
        const FieldValue = admin.firestore.FieldValue;
        await db.collection('notification-logs').add({
          fcmToken: 'EMAIL',
          title: `Coach escalation email skipped (Tier ${tier})`,
          body: 'Coach email missing on user profile; email not sent.',
          notificationType: 'COACH_ESCALATION_EMAIL',
          functionName: 'netlify/pulsecheck-chat.notifyCoachForEscalation',
          success: false,
          messageId: null,
          error: { code: 'MISSING_COACH_EMAIL', message: 'Coach user doc has no email.' },
          dataPayload: { channel: 'email', coachId: targetCoachId, athleteId: userId, escalationId, tier },
          timestamp: FieldValue.serverTimestamp(),
          timestampEpoch: nowSec,
          createdAt: FieldValue.serverTimestamp(),
          version: '1.0',
        });
      } catch (logErr) {
        console.warn('[notifyCoachForEscalation] Failed to write notification-logs for missing email (non-blocking):', logErr?.message || logErr);
      }
    }
  } catch (emailErr) {
    console.warn('[notifyCoachForEscalation] Coach email send failed (non-blocking):', emailErr?.message || emailErr);

    // Log email exception to Notification Logs dashboard
    try {
      const FieldValue = admin.firestore.FieldValue;
      await db.collection('notification-logs').add({
        fcmToken: 'EMAIL',
        title: `Coach escalation email error (Tier ${tier})`,
        body: 'Coach escalation email threw an exception (privacy-safe).',
        notificationType: 'COACH_ESCALATION_EMAIL',
        functionName: 'netlify/pulsecheck-chat.notifyCoachForEscalation',
        success: false,
        messageId: null,
        error: { code: emailErr?.code || 'EMAIL_EXCEPTION', message: emailErr?.message || String(emailErr) },
        dataPayload: { channel: 'email', coachId: targetCoachId, athleteId: userId, escalationId, tier },
        timestamp: FieldValue.serverTimestamp(),
        timestampEpoch: nowSec,
        createdAt: FieldValue.serverTimestamp(),
        version: '1.0',
      });
    } catch (logErr) {
      console.warn('[notifyCoachForEscalation] Failed to write notification-logs for email exception (non-blocking):', logErr?.message || logErr);
    }
  }

  return { success: true, coachId: targetCoachId };
}


