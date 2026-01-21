/**
 * PulseCheck Escalation Handler Function
 * 
 * Handles escalation actions:
 * - Create escalation record
 * - Process consent decisions
 * - Trigger clinical handoff to AuntEDNA
 * - Generate conversation summaries
 * - Notify coaches
 * 
 * Endpoint: POST /.netlify/functions/pulsecheck-escalation
 * Body: { action, userId, conversationId, ... }
 */

const { initializeFirebaseAdmin, db, headers } = require('./config/firebase');

// Escalation Tier enum values
const EscalationTier = {
  None: 0,
  MonitorOnly: 1,
  ElevatedRisk: 2,
  CriticalRisk: 3
};

// Status enums
const ConsentStatus = {
  Pending: 'pending',
  Accepted: 'accepted',
  Declined: 'declined',
  NotRequired: 'not-required'
};

const HandoffStatus = {
  Pending: 'pending',
  Initiated: 'initiated',
  Completed: 'completed',
  Failed: 'failed'
};

const EscalationRecordStatus = {
  Active: 'active',
  Resolved: 'resolved',
  Declined: 'declined'
};

// AuntEDNA placeholder URLs (replace with real endpoints)
const AUNTEDNA_BASE_URL = process.env.AUNTEDNA_API_URL || 'https://api.auntedna.com/v1';
const AUNTEDNA_API_KEY = process.env.AUNTEDNA_API_KEY || '';
const USE_MOCK = process.env.AUNTEDNA_MOCK === 'true' || !AUNTEDNA_API_KEY;

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
    const { action } = body;

    switch (action) {
      case 'create':
        return await handleCreateEscalation(body);
      case 'consent':
        return await handleConsent(body);
      case 'handoff':
        return await handleClinicalHandoff(body);
      case 'summary':
        return await generateConversationSummary(body);
      case 'notify-coach':
        return await notifyCoach(body);
      case 'resolve':
        return await handleResolve(body);
      default:
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
    }

  } catch (error) {
    console.error('[pulsecheck-escalation] Error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};

/**
 * Create a new escalation record
 */
async function handleCreateEscalation(body) {
  const {
    userId,
    conversationId,
    tier,
    category,
    triggerMessageId,
    triggerContent,
    classificationReason,
    classificationConfidence
  } = body;

  if (!userId || !conversationId || tier === undefined) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const nowSec = Math.floor(Date.now() / 1000);

  // Create escalation record
  const escalationData = {
    userId,
    conversationId,
    tier,
    category: category || 'general',
    triggerMessageId: triggerMessageId || '',
    triggerContent: triggerContent || '',
    classificationReason: classificationReason || '',
    classificationConfidence: classificationConfidence || 0,
    consentStatus: tier === EscalationTier.CriticalRisk ? ConsentStatus.NotRequired : ConsentStatus.Pending,
    handoffStatus: HandoffStatus.Pending,
    coachNotified: false,
    createdAt: nowSec,
    status: EscalationRecordStatus.Active
  };

  const docRef = await db.collection('escalation-records').add(escalationData);
  const escalationId = docRef.id;
  await docRef.update({ id: escalationId });

  // Update conversation with escalation state
  await db.collection('conversations').doc(conversationId).set({
    escalationTier: tier,
    escalationStatus: EscalationRecordStatus.Active,
    escalationRecordId: escalationId,
    isInSafetyMode: tier === EscalationTier.CriticalRisk,
    lastEscalationAt: nowSec
  }, { merge: true });

  // For Tier 3 (Critical), immediately initiate handoff
  if (tier === EscalationTier.CriticalRisk) {
    // Trigger async handoff (don't wait)
    triggerCriticalHandoff(userId, conversationId, escalationId, escalationData).catch(err => {
      console.error('[pulsecheck-escalation] Critical handoff error:', err);
    });
  }

  console.log('[pulsecheck-escalation] Created escalation:', {
    id: escalationId,
    userId: userId.slice(0, 8) + '...',
    tier,
    category
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      escalationId,
      tier,
      requiresConsent: tier === EscalationTier.ElevatedRisk,
      isCritical: tier === EscalationTier.CriticalRisk
    })
  };
}

/**
 * Handle consent decision (Tier 2 only)
 */
async function handleConsent(body) {
  const { escalationId, userId, consent } = body;

  if (!escalationId || !userId || consent === undefined) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const docRef = db.collection('escalation-records').doc(escalationId);
  const doc = await docRef.get();

  if (!doc.exists) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Escalation not found' }) };
  }

  const data = doc.data();

  // Verify ownership
  if (data.userId !== userId) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const nowSec = Math.floor(Date.now() / 1000);

  if (consent) {
    // User accepted - initiate clinical handoff
    await docRef.update({
      consentStatus: ConsentStatus.Accepted,
      consentTimestamp: nowSec
    });

    // Trigger handoff
    triggerElevatedHandoff(userId, data.conversationId, escalationId, data).catch(err => {
      console.error('[pulsecheck-escalation] Elevated handoff error:', err);
    });

    console.log('[pulsecheck-escalation] Consent accepted:', escalationId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        status: 'consent_accepted',
        message: 'Thank you. A mental health professional will reach out soon.'
      })
    };
  } else {
    // User declined
    await docRef.update({
      consentStatus: ConsentStatus.Declined,
      consentTimestamp: nowSec,
      status: EscalationRecordStatus.Declined
    });

    // Update conversation state
    await db.collection('conversations').doc(data.conversationId).set({
      escalationStatus: EscalationRecordStatus.Declined
    }, { merge: true });

    console.log('[pulsecheck-escalation] Consent declined:', escalationId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        status: 'consent_declined',
        message: 'Understood. I\'m still here if you want to talk. Remember, you can always reach out to a professional if things change.'
      })
    };
  }
}

/**
 * Trigger clinical handoff to AuntEDNA
 */
async function handleClinicalHandoff(body) {
  const { escalationId, userId, conversationId } = body;

  if (!escalationId || !userId || !conversationId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const escalationRef = db.collection('escalation-records').doc(escalationId);
  const escalationDoc = await escalationRef.get();

  if (!escalationDoc.exists) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Escalation not found' }) };
  }

  const escalationData = escalationDoc.data();

  // Build handoff payload
  const handoffResult = await performClinicalHandoff(
    userId,
    conversationId,
    escalationId,
    escalationData
  );

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(handoffResult)
  };
}

/**
 * Generate AI summary of conversation for clinical handoff
 */
async function generateConversationSummary(body) {
  const { conversationId, escalationId } = body;

  if (!conversationId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing conversationId' }) };
  }

  // Load conversation
  const convoDoc = await db.collection('conversations').doc(conversationId).get();
  if (!convoDoc.exists) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Conversation not found' }) };
  }

  const convoData = convoDoc.data();
  const messages = Array.isArray(convoData.messages) ? convoData.messages : [];

  // Build conversation transcript
  const transcript = messages.map(m => 
    `${m.isFromUser ? 'Athlete' : 'AI'}: ${m.content}`
  ).join('\n');

  // Generate summary with OpenAI
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing OPENAI_API_KEY' }) };
  }

  const summaryPrompt = `You are creating a clinical summary for a mental health professional reviewing an athlete's PulseCheck conversation.

Summarize the following conversation, focusing on:
1. Primary concerns expressed by the athlete
2. Emotional state and any distress indicators
3. Any safety concerns mentioned
4. Key themes or patterns
5. Current coping strategies mentioned

Be objective and clinical. Do not diagnose. Keep the summary under 200 words.

## Conversation:
${transcript}`;

  const completionRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a clinical documentation assistant. Write concise, professional summaries.' },
        { role: 'user', content: summaryPrompt }
      ],
      temperature: 0.3,
      max_tokens: 400
    })
  });

  if (!completionRes.ok) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Summary generation failed' }) };
  }

  const completion = await completionRes.json();
  const summary = completion.choices?.[0]?.message?.content?.trim() || 'Summary unavailable.';

  // Save summary to escalation record if provided
  if (escalationId) {
    await db.collection('escalation-records').doc(escalationId).update({
      conversationSummary: summary
    });
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      summary
    })
  };
}

/**
 * Notify coach of escalation (Tier 1 and above)
 */
async function notifyCoach(body) {
  const { sendCoachEscalationEmail } = require('./utils/sendCoachEscalationEmail');
  const { escalationId, userId, coachId } = body;

  if (!escalationId || !userId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  // Find coach if not provided
  let targetCoachId = coachId;
  if (!targetCoachId) {
    // Look up athlete's connected coach
    const connectionSnap = await db
      .collection('athlete-coach-connections')
      .where('athleteId', '==', userId)
      .where('status', '==', 'accepted')
      .limit(1)
      .get();

    if (!connectionSnap.empty) {
      targetCoachId = connectionSnap.docs[0].data().coachId;
    }
  }

  if (!targetCoachId) {
    console.log('[pulsecheck-escalation] No coach found for notification');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: false,
        reason: 'no_coach_connected'
      })
    };
  }

  const nowSec = Math.floor(Date.now() / 1000);

  // Load tier (for correct coach messaging + email copy)
  let tier = EscalationTier.None;
  try {
    const escalationSnap = await db.collection('escalation-records').doc(escalationId).get();
    if (escalationSnap.exists) {
      const data = escalationSnap.data() || {};
      if (typeof data.tier === 'number') tier = data.tier;
    }
  } catch (e) {
    console.warn('[pulsecheck-escalation] Failed to load escalation tier (non-blocking):', e?.message || e);
  }

  // Update escalation record
  await db.collection('escalation-records').doc(escalationId).update({
    coachNotified: true,
    coachId: targetCoachId,
    coachNotifiedAt: nowSec
  });

  // Create notification for coach
  // Note: This would integrate with your push notification system
  // For now, we create a notification document
  await db.collection('notifications').add({
    userId: targetCoachId,
    type: 'escalation-alert',
    title: tier === EscalationTier.MonitorOnly ? 'Athlete Check-In (Monitor)' : 'Athlete Check-In Alert',
    message:
      tier === EscalationTier.MonitorOnly
        ? 'An athlete you coach was flagged for monitor-only concern. Please review when you can.'
        : tier === EscalationTier.ElevatedRisk || tier === EscalationTier.CriticalRisk
          ? 'An athlete you coach had an escalation event and was handed off to a clinical professional. Please check your dashboard.'
          : 'An athlete you coach has been flagged for elevated concern. Please check your dashboard.',
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
      console.log('[pulsecheck-escalation] Coach email sent (best-effort):', {
        success: result?.success,
        skipped: result?.skipped,
        tier,
        coachId: targetCoachId,
      });
    } else {
      console.log('[pulsecheck-escalation] Coach email missing; skipping email send', {
        coachId: targetCoachId,
      });
    }
  } catch (emailErr) {
    console.warn('[pulsecheck-escalation] Coach email send failed (non-blocking):', emailErr?.message || emailErr);
  }

  console.log('[pulsecheck-escalation] Coach notified:', {
    coachId: targetCoachId,
    escalationId
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      coachNotified: true,
      coachId: targetCoachId
    })
  };
}

/**
 * Resolve an escalation
 */
async function handleResolve(body) {
  const { escalationId, userId, resolvedBy } = body;

  if (!escalationId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing escalationId' }) };
  }

  const nowSec = Math.floor(Date.now() / 1000);

  await db.collection('escalation-records').doc(escalationId).update({
    status: EscalationRecordStatus.Resolved,
    resolvedAt: nowSec,
    resolvedBy: resolvedBy || 'system'
  });

  // Update conversation state
  const escalationDoc = await db.collection('escalation-records').doc(escalationId).get();
  if (escalationDoc.exists) {
    const data = escalationDoc.data();
    await db.collection('conversations').doc(data.conversationId).set({
      escalationStatus: EscalationRecordStatus.Resolved,
      isInSafetyMode: false
    }, { merge: true });
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      resolved: true
    })
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Perform clinical handoff to AuntEDNA
 */
async function performClinicalHandoff(userId, conversationId, escalationId, escalationData) {
  // Load user profile
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.exists ? userDoc.data() : {};

  // Build short user object
  const shortUser = {
    userId,
    displayName: userData.displayName || userData.username || 'Unknown',
    email: userData.email,
    username: userData.username,
    sport: userData.primarySport,
    goals: userData.goals,
    dateOfBirth: userData.dateOfBirth,
    emergencyContact: userData.emergencyContact
  };

  // Load conversation for summary
  const convoDoc = await db.collection('conversations').doc(conversationId).get();
  const convoData = convoDoc.exists ? convoDoc.data() : {};
  
  // Generate summary if not already done
  let summary = escalationData.conversationSummary;
  if (!summary) {
    const summaryResult = await generateConversationSummaryInternal(convoData.messages || []);
    summary = summaryResult;
    
    // Save to escalation record
    await db.collection('escalation-records').doc(escalationId).update({
      conversationSummary: summary
    });
  }

  // Load relevant mental notes
  const notesSnap = await db
    .collection('user-mental-notes')
    .doc(userId)
    .collection('notes')
    .where('status', '==', 'active')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  const mentalNotes = notesSnap.docs.map(d => ({
    id: d.id,
    title: d.data().title,
    content: d.data().content,
    category: d.data().category,
    severity: d.data().severity
  }));

  // Build handoff payload
  const payload = {
    pulseUserId: userId,
    pulseConversationId: conversationId,
    escalationRecordId: escalationId,
    athlete: shortUser,
    tier: escalationData.tier,
    category: escalationData.category,
    triggerContent: escalationData.triggerContent,
    classificationReason: escalationData.classificationReason,
    conversationSummary: summary,
    relevantMentalNotes: mentalNotes,
    escalationTimestamp: Date.now(),
    pulseApiCallback: `${process.env.URL || 'https://pulsefitness.app'}/.netlify/functions/auntedna-callback`
  };

  // Update handoff status
  await db.collection('escalation-records').doc(escalationId).update({
    handoffStatus: HandoffStatus.Initiated
  });

  // Send to AuntEDNA
  let result;
  if (USE_MOCK) {
    // Mock response
    result = {
      success: true,
      escalationId: `ae-${escalationId.slice(0, 8)}`,
      status: escalationData.tier === EscalationTier.CriticalRisk ? 'assigned' : 'received',
      estimatedContactTime: escalationData.tier === EscalationTier.CriticalRisk ? 'Within 15 minutes' : 'Within 24 hours'
    };
    console.log('[pulsecheck-escalation] Mock AuntEDNA response:', result);
  } else {
    try {
      const response = await fetch(`${AUNTEDNA_BASE_URL}/escalations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUNTEDNA_API_KEY}`
        },
        body: JSON.stringify(payload)
      });
      result = await response.json();
    } catch (err) {
      console.error('[pulsecheck-escalation] AuntEDNA request failed:', err);
      result = { success: false, error: err.message };
    }
  }

  // Update final status
  if (result.success) {
    await db.collection('escalation-records').doc(escalationId).update({
      handoffStatus: HandoffStatus.Completed,
      clinicalReferenceId: result.escalationId
    });
  } else {
    await db.collection('escalation-records').doc(escalationId).update({
      handoffStatus: HandoffStatus.Failed
    });
  }

  return result;
}

/**
 * Trigger critical handoff (Tier 3 - immediate)
 */
async function triggerCriticalHandoff(userId, conversationId, escalationId, escalationData) {
  console.log('[pulsecheck-escalation] Triggering critical handoff:', escalationId);
  
  // Notify coach immediately
  await notifyCoach({ escalationId, userId });
  
  // Perform clinical handoff
  const result = await performClinicalHandoff(userId, conversationId, escalationId, escalationData);
  
  console.log('[pulsecheck-escalation] Critical handoff complete:', result);
  return result;
}

/**
 * Trigger elevated handoff (Tier 2 - after consent)
 */
async function triggerElevatedHandoff(userId, conversationId, escalationId, escalationData) {
  console.log('[pulsecheck-escalation] Triggering elevated handoff:', escalationId);
  
  // Notify coach
  await notifyCoach({ escalationId, userId });
  
  // Perform clinical handoff
  const result = await performClinicalHandoff(userId, conversationId, escalationId, escalationData);
  
  console.log('[pulsecheck-escalation] Elevated handoff complete:', result);
  return result;
}

/**
 * Internal summary generation
 */
async function generateConversationSummaryInternal(messages) {
  if (!messages || messages.length === 0) {
    return 'No conversation history available.';
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return 'Summary unavailable.';
  }

  const transcript = messages.map(m => 
    `${m.isFromUser ? 'Athlete' : 'AI'}: ${m.content}`
  ).join('\n');

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'Create a brief clinical summary (under 150 words) focusing on concerns, emotional state, and safety indicators.' 
          },
          { role: 'user', content: `Summarize this conversation:\n\n${transcript}` }
        ],
        temperature: 0.3,
        max_tokens: 300
      })
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || 'Summary unavailable.';
  } catch (err) {
    console.error('[pulsecheck-escalation] Summary generation error:', err);
    return 'Summary generation failed.';
  }
}
