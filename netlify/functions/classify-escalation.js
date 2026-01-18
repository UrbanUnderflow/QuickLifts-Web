/**
 * Nora (PulseCheck) Escalation Classification Function
 * 
 * Analyzes user messages to determine if escalation is needed.
 * Uses OpenAI with admin-defined escalation conditions as context.
 * 
 * Endpoint: POST /.netlify/functions/classify-escalation
 * Body: { userId, message, conversationId, recentMessages?, mentalNotes? }
 * Returns: { tier, category, reason, confidence, shouldEscalate, suggestedResponse? }
 */

const { initializeFirebaseAdmin, db, headers } = require('./config/firebase');

// Escalation Tier enum values (match TypeScript types)
const EscalationTier = {
  None: 0,
  MonitorOnly: 1,
  ElevatedRisk: 2,
  CriticalRisk: 3
};

// Escalation Categories (subset for quick reference)
const EscalationCategory = {
  // Tier 1
  PerformanceStress: 'performance-stress',
  Fatigue: 'fatigue',
  EmotionalVariability: 'emotional-variability',
  Burnout: 'burnout',
  // Tier 2
  PersistentDistress: 'persistent-distress',
  AnxietyIndicators: 'anxiety-indicators',
  DisorderedEating: 'disordered-eating',
  IdentityImpact: 'identity-impact',
  InjuryPsychological: 'injury-psychological',
  RecurrentTier1: 'recurrent-tier1',
  // Tier 3
  SelfHarm: 'self-harm',
  SuicidalIdeation: 'suicidal-ideation',
  ImminentSafetyRisk: 'imminent-safety-risk',
  SeverePsychologicalDistress: 'severe-psychological-distress',
  AbuseDisclosure: 'abuse-disclosure',
  RapidDeterioration: 'rapid-deterioration',
  // Default
  General: 'general'
};

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
    const { userId, message, conversationId, recentMessages = [], mentalNotes = [] } = body;

    if (!userId || !message) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing userId or message' }) };
    }

    // Load escalation conditions from Firestore (admin-defined)
    const conditionsSnap = await db
      .collection('escalation-conditions')
      .where('isActive', '==', true)
      .orderBy('tier', 'asc')
      .orderBy('priority', 'desc')
      .get();

    const conditions = conditionsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Build training context from conditions
    const trainingContext = buildTrainingContext(conditions);

    // Load user's recent escalation history (to detect recurrence)
    const escalationHistorySnap = await db
      .collection('escalation-records')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    const escalationHistory = escalationHistorySnap.docs.map(doc => ({
      tier: doc.data().tier,
      category: doc.data().category,
      createdAt: doc.data().createdAt
    }));

    // Build classification prompt
    const classificationPrompt = buildClassificationPrompt(
      message,
      recentMessages,
      mentalNotes,
      escalationHistory,
      trainingContext
    );

    // Call OpenAI for classification
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
        messages: [
          { role: 'system', content: classificationPrompt.system },
          { role: 'user', content: classificationPrompt.user }
        ],
        temperature: 0.1, // Low temperature for consistent classification
        max_tokens: 500,
        response_format: { type: 'json_object' }
      })
    });

    if (!completionRes.ok) {
      const errText = await completionRes.text();
      console.error('[classify-escalation] OpenAI error:', errText);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'OpenAI error', detail: errText }) };
    }

    const completion = await completionRes.json();
    const responseText = completion.choices?.[0]?.message?.content?.trim();

    if (!responseText) {
      console.error('[classify-escalation] Empty response from OpenAI');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          tier: EscalationTier.None,
          category: EscalationCategory.General,
          reason: 'Unable to classify',
          confidence: 0,
          shouldEscalate: false
        })
      };
    }

    // Parse the JSON response
    let classification;
    try {
      classification = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('[classify-escalation] Failed to parse response:', responseText);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          tier: EscalationTier.None,
          category: EscalationCategory.General,
          reason: 'Classification parse error',
          confidence: 0,
          shouldEscalate: false
        })
      };
    }

    // Validate and normalize the response
    const result = normalizeClassification(classification);

    // Log classification for monitoring (without PII)
    console.log('[classify-escalation] Result:', {
      userId: userId.slice(0, 8) + '...',
      tier: result.tier,
      category: result.category,
      confidence: result.confidence,
      shouldEscalate: result.shouldEscalate
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('[classify-escalation] Error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};

/**
 * Build training context from admin-defined conditions
 */
function buildTrainingContext(conditions) {
  const tier1 = conditions.filter(c => c.tier === EscalationTier.MonitorOnly);
  const tier2 = conditions.filter(c => c.tier === EscalationTier.ElevatedRisk);
  const tier3 = conditions.filter(c => c.tier === EscalationTier.CriticalRisk);

  const formatCondition = (c) => {
    const examples = (c.examplePhrases || []).slice(0, 3).map(p => `"${p}"`).join(', ');
    const keywords = (c.keywords || []).join(', ');
    return `- **${c.title}** (${c.category}): ${c.description}\n  Examples: ${examples || 'N/A'}\n  Keywords: ${keywords || 'N/A'}`;
  };

  let context = '';

  if (tier1.length > 0) {
    context += `\n### TIER 1: Monitor-Only (notify coach, adaptive support)\n${tier1.map(formatCondition).join('\n\n')}`;
  }

  if (tier2.length > 0) {
    context += `\n\n### TIER 2: Elevated Risk (consent-based clinical escalation)\n${tier2.map(formatCondition).join('\n\n')}`;
  }

  if (tier3.length > 0) {
    context += `\n\n### TIER 3: Critical Risk (MANDATORY clinical escalation)\n${tier3.map(formatCondition).join('\n\n')}`;
  }

  return context.trim() || 'No specific conditions defined. Use clinical judgment based on standard sport psychology escalation criteria.';
}

/**
 * Build the classification prompt for OpenAI
 */
function buildClassificationPrompt(message, recentMessages, mentalNotes, escalationHistory, trainingContext) {
  const systemPrompt = `You are a clinical safety classifier for Nora, an AI mental performance coach for athletes.

Your task is to analyze athlete messages and determine if escalation is needed based on clinical criteria.

## ESCALATION TIERS:

**Tier 0 (None)**: Normal conversation, no concerns
- Typical sport psychology topics
- Performance questions
- General wellness discussion

**Tier 1 (Monitor-Only)**: Low-risk concerns requiring coach notification
- Performance stress within normal range
- Temporary fatigue or low motivation  
- Minor emotional fluctuations
- Early burnout signs

**Tier 2 (Elevated Risk)**: Consent-based clinical escalation
- Persistent distress (2+ weeks)
- Significant anxiety impacting performance/daily life
- Disordered eating patterns
- Athletic identity crisis
- Psychological impact from injury
- Recurrent Tier 1 concerns (3+ in 30 days)

**Tier 3 (Critical Risk)**: MANDATORY immediate escalation
- Any mention of self-harm, cutting, or hurting oneself
- Suicidal ideation, thoughts of ending life, or wishing to not be alive
- Imminent safety risk to self or others
- Severe psychological distress with functional impairment
- Disclosure of abuse (past or present)
- Rapid deterioration from previous state

## ADMIN-DEFINED CONDITIONS:
${trainingContext}

## RESPONSE FORMAT:
You must respond with a JSON object:
{
  "tier": 0|1|2|3,
  "category": "category-slug",
  "reason": "Brief clinical reasoning (1-2 sentences)",
  "confidence": 0.0-1.0,
  "shouldEscalate": true|false,
  "suggestedResponse": "If tier 3, provide a safety-focused response template"
}

## CRITICAL RULES:
1. ALWAYS err on the side of caution for safety concerns
2. Tier 3 has ZERO threshold - any clear safety signal = immediate escalation
3. Consider context from recent messages and mental notes
4. Recurrent Tier 1 patterns should elevate to Tier 2
5. If uncertain between tiers, choose the higher tier
6. Never dismiss potential safety concerns as "just venting"`;

  // Build context from recent messages
  let conversationContext = '';
  if (recentMessages && recentMessages.length > 0) {
    const last5 = recentMessages.slice(-5);
    conversationContext = '\n\n## Recent Conversation:\n' + 
      last5.map(m => `${m.isFromUser ? 'Athlete' : 'AI'}: ${m.content}`).join('\n');
  }

  // Build context from mental notes
  let notesContext = '';
  if (mentalNotes && mentalNotes.length > 0) {
    notesContext = '\n\n## Athlete Mental Notes:\n' + 
      mentalNotes.map(n => `- ${n.category || 'Note'}: ${n.content || n.title}`).join('\n');
  }

  // Build escalation history context
  let historyContext = '';
  if (escalationHistory && escalationHistory.length > 0) {
    const recentCount = escalationHistory.filter(e => {
      const daysAgo = (Date.now() / 1000 - e.createdAt) / (60 * 60 * 24);
      return daysAgo <= 30;
    }).length;

    if (recentCount > 0) {
      historyContext = `\n\n## Escalation History:\n- ${recentCount} escalation(s) in the past 30 days`;
      if (recentCount >= 3) {
        historyContext += '\n- **PATTERN ALERT**: Recurrent concerns detected - consider Tier 2 elevation';
      }
    }
  }

  const userPrompt = `Analyze this athlete message for escalation:

## Current Message:
"${message}"
${conversationContext}${notesContext}${historyContext}

Classify this message and return your analysis as JSON.`;

  return {
    system: systemPrompt,
    user: userPrompt
  };
}

/**
 * Normalize and validate the classification response
 */
function normalizeClassification(raw) {
  // Default safe response
  const defaultResponse = {
    tier: EscalationTier.None,
    category: EscalationCategory.General,
    reason: 'No escalation needed',
    confidence: 0.5,
    shouldEscalate: false
  };

  if (!raw || typeof raw !== 'object') {
    return defaultResponse;
  }

  // Normalize tier
  let tier = parseInt(raw.tier, 10);
  if (isNaN(tier) || tier < 0 || tier > 3) {
    tier = EscalationTier.None;
  }

  // Normalize category
  let category = raw.category || EscalationCategory.General;
  if (typeof category !== 'string') {
    category = EscalationCategory.General;
  }

  // Normalize confidence
  let confidence = parseFloat(raw.confidence);
  if (isNaN(confidence) || confidence < 0 || confidence > 1) {
    confidence = 0.5;
  }

  // Determine if escalation is needed
  const shouldEscalate = tier >= EscalationTier.ElevatedRisk || 
    (tier === EscalationTier.MonitorOnly && confidence > 0.8);

  return {
    tier,
    category,
    reason: raw.reason || 'Classification complete',
    confidence,
    shouldEscalate,
    suggestedResponse: tier === EscalationTier.CriticalRisk ? raw.suggestedResponse : undefined
  };
}
