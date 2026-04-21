import type { Handler } from '@netlify/functions';
import { admin } from './config/firebase';

const db = admin.firestore();
const PILOT_ATHLETE_COMMUNICATIONS_COLLECTION = 'pulsecheck-pilot-athlete-communications';

/**
 * Brevo Webhook Event Types:
 * - delivered: Email was delivered to the recipient's mail server
 * - opened: Recipient opened the email (tracked via pixel)
 * - click: Recipient clicked a link in the email
 * - soft_bounce: Temporary delivery failure
 * - hard_bounce: Permanent delivery failure
 * - spam: Recipient marked email as spam
 * - unsubscribe: Recipient unsubscribed
 */

interface BrevoWebhookEvent {
  event: 'delivered' | 'opened' | 'click' | 'soft_bounce' | 'hard_bounce' | 'spam' | 'unsubscribe' | 'blocked' | 'deferred';
  email: string;
  id: number;
  date: string;
  ts: number;
  'message-id'?: string;
  ts_event?: number;
  subject?: string;
  tag?: string;
  sending_ip?: string;
  ts_epoch?: number;
  link?: string; // For click events
  'X-Mailin-custom'?: string; // Custom headers we set (contains friendId, signingRequestId, emailRecordId)
}

const applyStatusUpdate = (
  updateData: Record<string, any>,
  eventType: BrevoWebhookEvent['event'],
  now: Date,
  link?: string,
  periodKey?: string
) => {
  const writePeriodField = (field: string, value: any) => {
    if (!periodKey) return;
    updateData[`${periodKey}.${field}`] = value;
  };

  switch (eventType) {
    case 'delivered':
      updateData.lastEmailDeliveredAt = now;
      updateData.emailStatus = 'delivered';
      writePeriodField('status', 'delivered');
      writePeriodField('deliveredAt', now);
      break;
    case 'opened':
      updateData.lastEmailOpenedAt = now;
      updateData.emailOpenCount = admin.firestore.FieldValue.increment(1);
      updateData.emailStatus = 'opened';
      writePeriodField('status', 'opened');
      writePeriodField('openedAt', now);
      writePeriodField('openCount', admin.firestore.FieldValue.increment(1));
      break;
    case 'click':
      updateData.lastEmailClickedAt = now;
      updateData.emailClickCount = admin.firestore.FieldValue.increment(1);
      updateData.lastEmailClickedLink = link || null;
      updateData.emailStatus = 'clicked';
      writePeriodField('status', 'clicked');
      writePeriodField('clickedAt', now);
      writePeriodField('clickCount', admin.firestore.FieldValue.increment(1));
      writePeriodField('clickedLink', link || null);
      break;
    case 'soft_bounce':
      updateData.emailStatus = 'soft_bounce';
      updateData.emailBounceType = 'soft_bounce';
      writePeriodField('status', 'soft_bounce');
      writePeriodField('bounceType', 'soft_bounce');
      break;
    case 'hard_bounce':
      updateData.emailStatus = 'hard_bounce';
      updateData.emailBounceType = 'hard_bounce';
      writePeriodField('status', 'hard_bounce');
      writePeriodField('bounceType', 'hard_bounce');
      break;
    case 'spam':
      updateData.emailStatus = 'spam';
      writePeriodField('status', 'spam');
      break;
    case 'unsubscribe':
      updateData.emailStatus = 'unsubscribed';
      writePeriodField('status', 'unsubscribed');
      break;
    case 'blocked':
      updateData.emailStatus = 'blocked';
      writePeriodField('status', 'blocked');
      break;
    case 'deferred':
      updateData.emailStatus = 'deferred';
      writePeriodField('status', 'deferred');
      break;
  }
};

const applyPilotAthleteCommunicationStatusUpdate = (
  updateData: Record<string, any>,
  eventType: BrevoWebhookEvent['event'],
  now: Date,
  link?: string
) => {
  switch (eventType) {
    case 'delivered':
      updateData.status = 'delivered';
      updateData.deliveredAt = now;
      break;
    case 'opened':
      updateData.status = 'opened';
      updateData.openedAt = now;
      break;
    case 'click':
      updateData.status = 'opened';
      updateData.openedAt = updateData.openedAt || now;
      updateData.clickedAt = now;
      updateData.clickedLink = link || null;
      break;
    case 'soft_bounce':
    case 'hard_bounce':
    case 'spam':
    case 'unsubscribe':
    case 'blocked':
    case 'deferred':
      updateData.status = 'failed';
      updateData.lastError = eventType;
      break;
  }
};

const SIGNING_REQUEST_STATUS_RANK: Record<string, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  opened: 3,
  viewed: 4,
  signed: 5,
};

const getSigningRequestStatusForEmailEvent = (eventType: BrevoWebhookEvent['event']) => {
  switch (eventType) {
    case 'delivered':
      return 'delivered';
    case 'opened':
    case 'click':
      return 'opened';
    case 'soft_bounce':
    case 'hard_bounce':
    case 'spam':
    case 'unsubscribe':
    case 'blocked':
      return 'failed';
    case 'deferred':
      return 'deferred';
    default:
      return null;
  }
};

const updateSigningRequestEmailStatus = async (args: {
  signingRequestId: string;
  eventType: BrevoWebhookEvent['event'];
  email: string;
  messageId?: string;
  link?: string;
  now: Date;
}) => {
  const requestRef = db.collection('signingRequests').doc(args.signingRequestId);
  const requestSnap = await requestRef.get();

  if (!requestSnap.exists) {
    console.warn(`[brevo-webhook] Signing request ${args.signingRequestId} not found`);
    return;
  }

  const data = requestSnap.data() || {};
  const FieldValue = admin.firestore.FieldValue;
  const updateData: Record<string, any> = {
    recipientEmail: data.recipientEmail || args.email,
    emailStatus: args.eventType,
    lastEmailEvent: args.eventType,
    lastEmailEventAt: args.now,
    updatedAt: args.now,
  };

  if (args.messageId) {
    updateData.messageId = args.messageId;
  }

  switch (args.eventType) {
    case 'delivered':
      updateData.deliveredAt = data.deliveredAt || args.now;
      break;
    case 'opened':
      updateData.openedAt = data.openedAt || args.now;
      updateData.openCount = FieldValue.increment(1);
      break;
    case 'click':
      updateData.clickedAt = args.now;
      updateData.clickedLink = args.link || null;
      if (!data.openedAt) {
        updateData.openedAt = args.now;
      }
      updateData.clickCount = FieldValue.increment(1);
      break;
    case 'soft_bounce':
    case 'hard_bounce':
    case 'spam':
    case 'unsubscribe':
    case 'blocked':
    case 'deferred':
      updateData.lastEmailError = args.eventType;
      break;
  }

  const nextStatus = getSigningRequestStatusForEmailEvent(args.eventType);
  if (nextStatus) {
    const currentStatus = typeof data.status === 'string' ? data.status : 'pending';
    if (['failed', 'deferred'].includes(nextStatus) && !['signed', 'viewed'].includes(currentStatus)) {
      updateData.status = nextStatus;
    } else {
      const currentRank = SIGNING_REQUEST_STATUS_RANK[currentStatus] ?? 0;
      const nextRank = SIGNING_REQUEST_STATUS_RANK[nextStatus] ?? 0;

      if (currentStatus !== 'signed' && currentStatus !== 'viewed' && nextRank >= currentRank) {
        updateData.status = nextStatus;
      }
    }
  }

  await requestRef.set(updateData, { merge: true });
  console.log(`[brevo-webhook] Updated signing request ${args.signingRequestId} with ${args.eventType}`);
};

export const handler: Handler = async (event) => {
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Verify the webhook secret if configured (recommended for production)
  const webhookSecret = process.env.BREVO_WEBHOOK_SECRET;
  if (webhookSecret) {
    const providedSecret = event.headers['x-brevo-secret'] || event.headers['X-Brevo-Secret'];
    if (providedSecret !== webhookSecret) {
      console.warn('[brevo-webhook] Invalid webhook secret');
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }
  }

  try {
    const body = event.body ? JSON.parse(event.body) : null;
    
    if (!body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No body provided' }),
      };
    }

    // Brevo can send single events or batches
    const events: BrevoWebhookEvent[] = Array.isArray(body) ? body : [body];
    
    console.log(`[brevo-webhook] Received ${events.length} event(s)`);

    if (!db) {
      console.error('[brevo-webhook] Firebase not initialized');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Database not available' }),
      };
    }

    for (const webhookEvent of events) {
      const { event: eventType, email, 'message-id': messageId, link } = webhookEvent;
      const now = new Date();
      
      console.log(`[brevo-webhook] Processing event: ${eventType} for ${email}`);

      // Parse custom headers to get friendId and updatePeriodId
      let friendId: string | null = null;
      let emailRecordId: string | null = null;
      let updatePeriodId: string | null = null;
      let pilotAthleteCommunicationId: string | null = null;
      let signingRequestId: string | null = null;
      
      if (webhookEvent['X-Mailin-custom']) {
        try {
          const custom = JSON.parse(webhookEvent['X-Mailin-custom']);
          friendId = custom.friendId || null;
          emailRecordId = custom.emailRecordId || null;
          updatePeriodId = custom.updatePeriodId || null;
          pilotAthleteCommunicationId = custom.pilotAthleteCommunicationId || null;
          signingRequestId = custom.signingRequestId || null;
        } catch (e) {
          console.warn('[brevo-webhook] Failed to parse X-Mailin-custom:', e);
        }
      }

      if (signingRequestId) {
        await updateSigningRequestEmailStatus({
          signingRequestId,
          eventType,
          email,
          messageId,
          link,
          now,
        });
      }

      if (pilotAthleteCommunicationId) {
        const outreachRef = db.collection(PILOT_ATHLETE_COMMUNICATIONS_COLLECTION).doc(pilotAthleteCommunicationId);
        const outreachUpdate: Record<string, any> = {
          lastEmailEvent: eventType,
          lastEmailEventAt: now,
          updatedAt: now,
        };
        applyPilotAthleteCommunicationStatusUpdate(outreachUpdate, eventType, now, link);
        if (messageId) {
          outreachUpdate.messageId = messageId;
        }
        await outreachRef.set(outreachUpdate, { merge: true });
      }

      // If we have a friendId, update the friend's email tracking
      if (friendId) {
        const friendRef = db.collection('friends-of-business').doc(friendId);
        const friendDoc = await friendRef.get();
        
        if (friendDoc.exists) {
          const updateData: Record<string, any> = {
            lastEmailEvent: eventType,
            lastEmailEventAt: now,
          };

          applyStatusUpdate(
            updateData,
            eventType,
            now,
            link,
            updatePeriodId ? `emailUpdates.${updatePeriodId}` : undefined
          );

          await friendRef.update(updateData);
          console.log(`[brevo-webhook] Updated friend ${friendId} with event ${eventType}${updatePeriodId ? ` for period ${updatePeriodId}` : ''}`);

          // Also store in email history subcollection for detailed tracking
          const historyRef = friendRef.collection('emailHistory').doc(emailRecordId || messageId || `${Date.now()}`);
          const historyDoc = await historyRef.get();
          
          if (historyDoc.exists) {
            // Update existing record
            const historyUpdate: Record<string, any> = {
              [`events.${eventType}`]: admin.firestore.FieldValue.arrayUnion({
                timestamp: now,
                link: link || null,
              }),
            };
            
            if (eventType === 'opened' && !historyDoc.data()?.firstOpenedAt) {
              historyUpdate.firstOpenedAt = now;
            }
            if (eventType === 'click' && !historyDoc.data()?.firstClickedAt) {
              historyUpdate.firstClickedAt = now;
            }
            
            await historyRef.update(historyUpdate);
          } else {
            // Create new record if it doesn't exist (fallback)
            await historyRef.set({
              email,
              messageId,
              createdAt: now,
              events: {
                [eventType]: [{
                  timestamp: now,
                  link: link || null,
                }],
              },
              ...(eventType === 'opened' ? { firstOpenedAt: now } : {}),
              ...(eventType === 'click' ? { firstClickedAt: now } : {}),
            });
          }
        } else {
          console.warn(`[brevo-webhook] Friend ${friendId} not found`);
        }
      } else {
        // No friendId - try to find by email
        console.log(`[brevo-webhook] No friendId, looking up by email: ${email}`);
        const friendsSnapshot = await db.collection('friends-of-business')
          .where('email', '==', email)
          .limit(1)
          .get();
        
        if (!friendsSnapshot.empty) {
          const friendDoc = friendsSnapshot.docs[0];
          const updateData: Record<string, any> = {
            lastEmailEvent: eventType,
            lastEmailEventAt: now,
          };

          applyStatusUpdate(updateData, eventType, now, link);

          await friendDoc.ref.update(updateData);
          console.log(`[brevo-webhook] Updated friend by email lookup with event ${eventType}`);
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, processed: events.length }),
    };
  } catch (e: any) {
    console.error('[brevo-webhook] Error:', e);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e?.message || 'Internal error' }),
    };
  }
};
