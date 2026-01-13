import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../api/firebase/config';
import { doc, updateDoc, getDoc, collection, query, where, getDocs, increment } from 'firebase/firestore';

/**
 * Brevo Webhook for email tracking (opens, clicks, etc.)
 * Configure in Brevo: Transactional → Settings → Webhooks
 * URL: https://fitwithpulse.ai/api/brevo-webhook
 */

interface BrevoWebhookEvent {
  event: 
    | 'sent'
    | 'delivered' 
    | 'opened' 
    | 'unique_opened'
    | 'first_opening'
    | 'click' 
    | 'soft_bounce' 
    | 'hard_bounce' 
    | 'spam' 
    | 'complaint'
    | 'unsubscribe' 
    | 'blocked' 
    | 'deferred'
    | 'error'
    | 'invalid'
    | 'proxy_open';
  email: string;
  id?: number;
  date?: string;
  ts?: number;
  'message-id'?: string;
  subject?: string;
  tag?: string;
  link?: string;
  'X-Mailin-custom'?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    
    if (!body) {
      return res.status(400).json({ error: 'No body provided' });
    }

    // Brevo can send single events or batches
    const events: BrevoWebhookEvent[] = Array.isArray(body) ? body : [body];
    
    console.log(`[brevo-webhook] Received ${events.length} event(s)`);

    for (const webhookEvent of events) {
      const { event: eventType, email, link } = webhookEvent;
      
      console.log(`[brevo-webhook] Processing event: ${eventType} for ${email}`);

      // Parse custom headers to get friendId and updatePeriodId
      let friendId: string | null = null;
      let updatePeriodId: string | null = null;
      
      if (webhookEvent['X-Mailin-custom']) {
        try {
          const custom = JSON.parse(webhookEvent['X-Mailin-custom']);
          friendId = custom.friendId || null;
          updatePeriodId = custom.updatePeriodId || null;
        } catch (e) {
          console.warn('[brevo-webhook] Failed to parse X-Mailin-custom:', e);
        }
      }

      // If we have a friendId, update directly
      if (friendId) {
        await updateFriendEmailStatus(friendId, eventType, updatePeriodId, link);
      } else if (email) {
        // Try to find by email
        await updateFriendByEmail(email, eventType, updatePeriodId, link);
      }
    }

    return res.status(200).json({ success: true, processed: events.length });
  } catch (e: any) {
    console.error('[brevo-webhook] Error:', e);
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
}

async function updateFriendEmailStatus(
  friendId: string, 
  eventType: string, 
  updatePeriodId: string | null,
  link?: string
) {
  const friendRef = doc(db, 'friends-of-business', friendId);
  const friendDoc = await getDoc(friendRef);
  
  if (!friendDoc.exists()) {
    console.warn(`[brevo-webhook] Friend ${friendId} not found`);
    return;
  }

  const now = new Date();
  const updateData: Record<string, any> = {
    lastEmailEvent: eventType,
    lastEmailEventAt: now,
  };

  // Track specific events
  switch (eventType) {
    case 'sent':
      updateData.lastEmailSentAt = now;
      updateData.emailStatus = 'sent';
      break;
    case 'delivered':
      updateData.lastEmailDeliveredAt = now;
      updateData.emailStatus = 'delivered';
      break;
    case 'opened':
    case 'unique_opened':
    case 'first_opening':
    case 'proxy_open':
      updateData.lastEmailOpenedAt = now;
      updateData.emailOpenCount = increment(1);
      updateData.emailStatus = 'opened';
      break;
    case 'click':
      updateData.lastEmailClickedAt = now;
      updateData.emailClickCount = increment(1);
      updateData.lastEmailClickedLink = link || null;
      updateData.emailStatus = 'clicked';
      break;
    case 'soft_bounce':
      updateData.emailStatus = 'soft_bounce';
      updateData.emailBounceType = 'soft';
      break;
    case 'hard_bounce':
      updateData.emailStatus = 'hard_bounce';
      updateData.emailBounceType = 'hard';
      break;
    case 'spam':
    case 'complaint':
      updateData.emailStatus = 'spam';
      break;
    case 'unsubscribe':
      updateData.emailStatus = 'unsubscribed';
      break;
    case 'blocked':
      updateData.emailStatus = 'blocked';
      break;
    case 'deferred':
      updateData.emailStatus = 'deferred';
      break;
    case 'error':
    case 'invalid':
      updateData.emailStatus = 'error';
      break;
  }

  // Also update per-update period tracking if we have an updatePeriodId
  if (updatePeriodId) {
    const periodKey = `emailUpdates.${updatePeriodId}`;
    switch (eventType) {
      case 'sent':
        updateData[`${periodKey}.status`] = 'sent';
        break;
      case 'delivered':
        updateData[`${periodKey}.status`] = 'delivered';
        updateData[`${periodKey}.deliveredAt`] = now;
        break;
      case 'opened':
      case 'unique_opened':
      case 'first_opening':
      case 'proxy_open':
        updateData[`${periodKey}.status`] = 'opened';
        updateData[`${periodKey}.openedAt`] = now;
        updateData[`${periodKey}.openCount`] = increment(1);
        break;
      case 'click':
        updateData[`${periodKey}.status`] = 'clicked';
        updateData[`${periodKey}.clickedAt`] = now;
        updateData[`${periodKey}.clickCount`] = increment(1);
        break;
      case 'soft_bounce':
        updateData[`${periodKey}.status`] = 'soft_bounce';
        break;
      case 'hard_bounce':
        updateData[`${periodKey}.status`] = 'hard_bounce';
        break;
      case 'spam':
      case 'complaint':
        updateData[`${periodKey}.status`] = 'spam';
        break;
      case 'unsubscribe':
        updateData[`${periodKey}.status`] = 'unsubscribed';
        break;
      case 'blocked':
        updateData[`${periodKey}.status`] = 'blocked';
        break;
      case 'deferred':
        updateData[`${periodKey}.status`] = 'deferred';
        break;
      case 'error':
      case 'invalid':
        updateData[`${periodKey}.status`] = 'error';
        break;
    }
  }

  await updateDoc(friendRef, updateData);
  console.log(`[brevo-webhook] Updated friend ${friendId} with event ${eventType}`);
}

async function updateFriendByEmail(
  email: string, 
  eventType: string, 
  updatePeriodId: string | null,
  link?: string
) {
  const friendsQuery = query(
    collection(db, 'friends-of-business'),
    where('email', '==', email)
  );
  const snapshot = await getDocs(friendsQuery);
  
  if (snapshot.empty) {
    console.warn(`[brevo-webhook] No friend found with email: ${email}`);
    return;
  }

  // Update the first match
  const friendDoc = snapshot.docs[0];
  await updateFriendEmailStatus(friendDoc.id, eventType, updatePeriodId, link);
}
