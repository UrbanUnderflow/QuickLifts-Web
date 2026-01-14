import type { Handler } from '@netlify/functions';
import * as admin from 'firebase-admin';

// TEMPORARY: Hardcoded for testing - REMOVE after confirming webhook works
// TODO: Move to secure storage and rotate this key!
const TEMP_SERVICE_ACCOUNT = {
  type: "service_account",
  project_id: "quicklifts-dd3f1",
  private_key_id: "abbd015806ef3b43d93101522f12d029e736f447",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDEZkOP1Kz/jfQc\nLrN2SKLVdRNCZHGHN+wcfqQXknnD47Y6GBA35O1573Ipk5FaRNvxysB/YP/Z9dLP\nOO/xk8yRA+FFI32kzQlBIpVHDVN/upfXRWS/38+1kktPD3EjwEFRB8HvYVopCm1k\nCaFOZZfrrHM2IEdboKDt3ByLoNNPLZhivcurhBm4PENNEVlyMiqqWBwTu0sFGkZ8\nLHQ4JGtaPe5VomlpVlokKmdQzEwVTWexSeQkbdXnYkd1m/sfT3mjP6RLBlXlJ4f/\nOp36QofqPxNRV7TJ/YkrL2nOLo6gq6XWS3ciVINUS9cuPlEIg+5OrR4eQUYhay3N\n5dakXn+ZAgMBAAECggEAJv+de9KB1a8E4ZG+bgbnWpaIT/8s8eo/Vrso70tVJXoy\nhZ+gnNC2/Sb4VtwoGTIiMIWPqtuCgm/HQAGw15n/HW6VTUrKWK6kH0x0MuspAOx2\n2Ta81kLldksJ7DWHRE+ZSLNPJa8BnbOl3B7zamNPAuu35vAK611eh0zVWD6Dpy1v\n7933i/pOMpvDY0ieoT0pl0GJcCVOBTS2f8z1+huepW5++G0TrTCZdq9ixCF68xEc\nyGTr1Dz/Qdv4gIO2SNk3TfKmw/HaL3tQM1izdMsJVs+nPxzmHj3tLnppyQJJFwcF\nZ1njhg6eSHPOINU/wu2KL2B+pXiROBLQr1JnvJsCZwKBgQDsYNrmbDhShYeU+OSs\nSaQx0POBeZFtlsMIbJomTSDr73Gn4ZXJaXfNoqvIuJel5SCTytK36Y+84/S3xeuy\nmXGMpfqBmEilMU5D4VOmSH/HFH6+35m1LWFw3aWSVGuUSIEQoWTKjWB9zQVwFd5w\nEw6HsuNm1IJvsEfZpzXpcydBMwKBgQDUs9cLfY93MbkT5M/WL9jbPp846HZxvzeW\nGiBR7gMAPMre32DPDKQKqnRVAvXJPhd8mKjC3T4gRm+NBWKLQjIUO0RQoVG39HN/\n9yGBTyLMccJf5d9MZe5OIwkVhbN5ekPucNhqHJQEIVz0duZ7UhFgfgLSroy/04vA\ndjgGeGxUAwKBgD+9Pkm0FNvrtcut8bujf+sO9RqMtXJfnOfAoTCCy8XTI0qpwcI1\n9mA05S2S2RGa31X68yc0i9Xbgjmr3Qqj5cKPXyVi8vPYf8o+EFheZFZCaIr/sGry\nebv9iJAUw42Qn3zkiFE2HjbN+hFnVDvUZ66fxkIMO7/yQO2n8RmqO4ORAoGAFbqV\nglf+WvfaZ1zdmoziw2r/Swn8Z5xYKl5a5OPCrLiJJQF+20f4ThqhrbmSsE9GiPTz\ncIy3dwabCLX/HijSAt0XGoGQXpF7Zxww8QvLi0UnzTIngJ99G8BagjdZYVSLMgWX\nJifrOwzJeTPYUcrNeaUF1s38FPCgezXYfVi6AE8CgYEAv+9EP3q6zY51CMtXKb04\n1yLrnZze20aUMmAQ0KE1nH9ZRk7GgT+Bbmq1Nw6Ro3xItPffX42S5w8jDhiZJK/j\neVGloaXM9MHG2uTPWSVlUJ2ew2LcYpq42PbJUuS06teFFPohMCOs7urTc0Vdya5u\ngTynFJmBFslLO3UKNPAshn0=\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
  client_id: "111494077667496751062",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

// Initialize Firebase Admin with hardcoded credentials for testing
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(TEMP_SERVICE_ACCOUNT as admin.ServiceAccount),
    });
    console.log('[brevo-webhook] Firebase initialized with temp credentials');
  } catch (e) {
    console.error('[brevo-webhook] Firebase init error:', e);
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

      // Parse custom headers to get friendId and updatePeriodId
      let friendId: string | null = null;
      let emailRecordId: string | null = null;
      let updatePeriodId: string | null = null;
      
      if (webhookEvent['X-Mailin-custom']) {
        try {
          const custom = JSON.parse(webhookEvent['X-Mailin-custom']);
          friendId = custom.friendId || null;
          emailRecordId = custom.emailRecordId || null;
          updatePeriodId = custom.updatePeriodId || null;
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

          // Also update the per-update period tracking if we have an updatePeriodId
          if (updatePeriodId) {
            const periodKey = `emailUpdates.${updatePeriodId}`;
            switch (eventType) {
              case 'delivered':
                updateData[`${periodKey}.status`] = 'delivered';
                updateData[`${periodKey}.deliveredAt`] = now;
                break;
              case 'opened':
                updateData[`${periodKey}.status`] = 'opened';
                updateData[`${periodKey}.openedAt`] = now;
                updateData[`${periodKey}.openCount`] = admin.firestore.FieldValue.increment(1);
                break;
              case 'click':
                updateData[`${periodKey}.status`] = 'clicked';
                updateData[`${periodKey}.clickedAt`] = now;
                updateData[`${periodKey}.clickCount`] = admin.firestore.FieldValue.increment(1);
                break;
              case 'soft_bounce':
              case 'hard_bounce':
                updateData[`${periodKey}.status`] = 'bounced';
                break;
              case 'spam':
                updateData[`${periodKey}.status`] = 'spam';
                break;
            }
          }

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
