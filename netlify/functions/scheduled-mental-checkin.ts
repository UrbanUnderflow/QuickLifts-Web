import type { Handler } from '@netlify/functions';
import { getFirestore, initAdmin } from './utils/getServiceAccount';

/**
 * Scheduled Mental Check-In Notifications
 * 
 * This function runs on a schedule and sends push notifications
 * to users prompting them to complete their daily mental check-in.
 * 
 * Schedule: Every day at configurable times (morning, evening)
 * 
 * Netlify Schedule Configuration (add to netlify.toml):
 * [[functions]]
 *   name = "scheduled-mental-checkin"
 *   schedule = "0 13 * * *"  # 8AM EST / 1PM UTC
 */

const BATCH_LIMIT = 500;

interface CheckInConfig {
  enabled?: boolean;
  morningTimeUtc?: string; // "HH:MM"
  eveningTimeUtc?: string; // "HH:MM"
  lastMorningRunDateUtc?: string;
  lastEveningRunDateUtc?: string;
}

interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function utcDateString(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getCheckInType(now: Date, config: CheckInConfig): 'morning' | 'evening' | null {
  const morningTime = (config.morningTimeUtc || '13:00').trim(); // 8AM EST = 1PM UTC
  const eveningTime = (config.eveningTimeUtc || '01:00').trim(); // 8PM EST = 1AM UTC (next day)
  
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();
  const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
  
  // Check if within 30 minutes of target time
  const isNearMorning = isWithinTimeWindow(currentTimeStr, morningTime, 30);
  const isNearEvening = isWithinTimeWindow(currentTimeStr, eveningTime, 30);
  
  if (isNearMorning) return 'morning';
  if (isNearEvening) return 'evening';
  return null;
}

function isWithinTimeWindow(current: string, target: string, windowMinutes: number): boolean {
  const [currentH, currentM] = current.split(':').map(Number);
  const [targetH, targetM] = target.split(':').map(Number);
  
  const currentTotalMinutes = currentH * 60 + currentM;
  const targetTotalMinutes = targetH * 60 + targetM;
  
  const diff = Math.abs(currentTotalMinutes - targetTotalMinutes);
  return diff <= windowMinutes;
}

function getCheckInMessage(type: 'morning' | 'evening'): { title: string; body: string } {
  if (type === 'morning') {
    return {
      title: '☀️ Good Morning',
      body: 'Quick mental pulse check — how\'s your readiness today? (1-5)',
    };
  }
  return {
    title: '🌙 Evening Wind-Down',
    body: 'Before you rest, take a moment to reflect. How did today go mentally?',
  };
}

async function sendNotification(
  messaging: any,
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string>
): Promise<NotificationResult> {
  try {
    const message = {
      token: fcmToken,
      notification: { title, body },
      data,
      apns: {
        payload: {
          aps: {
            alert: { title, body },
            badge: 1,
            sound: 'default',
          },
        },
      },
      android: {
        priority: 'high' as const,
        notification: { sound: 'default' },
      },
    };

    const messageId = await messaging.send(message);
    return { success: true, messageId };
  } catch (error: any) {
    console.error(`Failed to send notification to token ${fcmToken.substring(0, 10)}...`, error.message);
    return { success: false, error: error.message };
  }
}

export const handler: Handler = async (event) => {
  try {
    // Initialize Firebase Admin
    const admin = initAdmin();
    const db = await getFirestore();
    const messaging = admin.messaging();

    const now = new Date();
    const today = utcDateString(now);

    // Get config
    const configRef = db.collection('mental-training-config').doc('checkin-schedule');
    const configSnap = await configRef.get();
    const config: CheckInConfig = configSnap.exists ? (configSnap.data() as CheckInConfig) : {};

    // Check if enabled
    if (config.enabled === false) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'Check-ins disabled', processed: 0 }),
      };
    }

    // Determine which check-in type to send
    const checkInType = getCheckInType(now, config);
    if (!checkInType) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'Not scheduled time', processed: 0 }),
      };
    }

    // Check if already ran today for this type
    const lastRunKey = checkInType === 'morning' ? 'lastMorningRunDateUtc' : 'lastEveningRunDateUtc';
    if (config[lastRunKey] === today) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: `Already ran ${checkInType} check-in today`, processed: 0 }),
      };
    }

    // Mark as ran for today
    await configRef.set(
      {
        ...config,
        [lastRunKey]: today,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    // Query users who have:
    // 1. FCM token
    // 2. Mental training enabled (or haven't opted out)
    // 3. Active in the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const usersSnap = await db
      .collection('users')
      .where('fcmToken', '!=', null)
      .limit(BATCH_LIMIT)
      .get();

    if (usersSnap.empty) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'No users to notify', processed: 0 }),
      };
    }

    const { title, body } = getCheckInMessage(checkInType);
    const notificationData = {
      type: 'MENTAL_CHECKIN',
      checkInType,
      timestamp: String(Date.now()),
    };

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const fcmToken = userData.fcmToken;

      if (!fcmToken || typeof fcmToken !== 'string') {
        continue;
      }

      // Check if user has opted out of mental training notifications
      const mentalTrainingPrefs = userData.mentalTrainingPreferences;
      if (mentalTrainingPrefs?.checkInNotificationsEnabled === false) {
        continue;
      }

      // Check last activity (optional - remove if you want to notify all users)
      const lastActive = userData.updatedAt?.toDate?.() || userData.updatedAt;
      if (lastActive && lastActive < thirtyDaysAgo) {
        continue; // Skip inactive users
      }

      const result = await sendNotification(messaging, fcmToken, title, body, notificationData);
      
      if (result.success) {
        successCount++;
      } else {
        failCount++;
        if (errors.length < 10) {
          errors.push(result.error || 'Unknown error');
        }
      }
    }

    // Log the notification batch
    await db.collection('notification-logs').add({
      type: 'MENTAL_CHECKIN_BATCH',
      checkInType,
      date: today,
      successCount,
      failCount,
      totalAttempted: successCount + failCount,
      errors: errors.slice(0, 10),
      createdAt: new Date(),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        checkInType,
        processed: successCount + failCount,
        successCount,
        failCount,
      }),
    };
  } catch (error: any) {
    console.error('Scheduled mental check-in error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};

/**
 * Manual trigger endpoint for testing
 * POST /.netlify/functions/scheduled-mental-checkin
 * Body: { "userId": "xxx", "checkInType": "morning" | "evening" }
 */
export const manualHandler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { userId, checkInType } = JSON.parse(event.body || '{}');
    
    if (!userId || !checkInType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'userId and checkInType required' }),
      };
    }

    const admin = initAdmin();
    const db = await getFirestore();
    const messaging = admin.messaging();

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'User not found' }),
      };
    }

    const userData = userDoc.data();
    const fcmToken = userData?.fcmToken;

    if (!fcmToken) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'User has no FCM token' }),
      };
    }

    const { title, body } = getCheckInMessage(checkInType);
    const result = await sendNotification(messaging, fcmToken, title, body, {
      type: 'MENTAL_CHECKIN',
      checkInType,
      timestamp: String(Date.now()),
    });

    return {
      statusCode: result.success ? 200 : 500,
      body: JSON.stringify(result),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
