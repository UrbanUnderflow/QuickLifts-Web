import type { Handler } from '@netlify/functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccount) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(serviceAccount)),
      });
    } catch (e) {
      console.error('[brevo-webhook] Firebase init error:', e);
    }
  }
}

const db = admin.apps.length ? admin.firestore() : null;

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
  'X-Mailin-custom'?: string; // Custom headers we set (contains friendId, emailRecordId)
}

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
      const { event: eventType, email, 'message-id': messageId, date, link } = webhookEvent;
      
      console.log(`[brevo-webhook] Processing event: ${eventType} for ${email}`);

      // Parse custom headers to get friendId
      let friendId: string | null = null;
      let emailRecordId: string | null = null;
      
      if (webhookEvent['X-Mailin-custom']) {
        try {
          const custom = JSON.parse(webhookEvent['X-Mailin-custom']);
          friendId = custom.friendId || null;
          emailRecordId = custom.emailRecordId || null;
        } catch (e) {
          console.warn('[brevo-webhook] Failed to parse X-Mailin-custom:', e);
        }
      }

      // If we have a friendId, update the friend's email tracking
      if (friendId) {
        const friendRef = db.collection('friends-of-business').doc(friendId);
        const friendDoc = await friendRef.get();
        
        if (friendDoc.exists) {
          const now = new Date();
          const updateData: Record<string, any> = {
            lastEmailEvent: eventType,
            lastEmailEventAt: now,
          };

          // Track specific events
          switch (eventType) {
            case 'delivered':
              updateData.lastEmailDeliveredAt = now;
              updateData.emailStatus = 'delivered';
              break;
            case 'opened':
              updateData.lastEmailOpenedAt = now;
              updateData.emailOpenCount = admin.firestore.FieldValue.increment(1);
              updateData.emailStatus = 'opened';
              break;
            case 'click':
              updateData.lastEmailClickedAt = now;
              updateData.emailClickCount = admin.firestore.FieldValue.increment(1);
              updateData.lastEmailClickedLink = link || null;
              updateData.emailStatus = 'clicked';
              break;
            case 'soft_bounce':
            case 'hard_bounce':
              updateData.emailStatus = 'bounced';
              updateData.emailBounceType = eventType;
              break;
            case 'spam':
              updateData.emailStatus = 'spam';
              break;
            case 'unsubscribe':
              updateData.emailStatus = 'unsubscribed';
              break;
          }

          await friendRef.update(updateData);
          console.log(`[brevo-webhook] Updated friend ${friendId} with event ${eventType}`);

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
          const now = new Date();
          const updateData: Record<string, any> = {
            lastEmailEvent: eventType,
            lastEmailEventAt: now,
          };

          switch (eventType) {
            case 'delivered':
              updateData.lastEmailDeliveredAt = now;
              updateData.emailStatus = 'delivered';
              break;
            case 'opened':
              updateData.lastEmailOpenedAt = now;
              updateData.emailOpenCount = admin.firestore.FieldValue.increment(1);
              updateData.emailStatus = 'opened';
              break;
            case 'click':
              updateData.lastEmailClickedAt = now;
              updateData.emailClickCount = admin.firestore.FieldValue.increment(1);
              updateData.lastEmailClickedLink = link || null;
              updateData.emailStatus = 'clicked';
              break;
            case 'soft_bounce':
            case 'hard_bounce':
              updateData.emailStatus = 'bounced';
              break;
            case 'spam':
              updateData.emailStatus = 'spam';
              break;
          }

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
