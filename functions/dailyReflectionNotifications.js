/**
 * Daily Check-In Notifications
 * 
 * Sends personalized Pulse Check reminder pushes to the native iOS app
 * at the user's preferred time so the athlete returns to the web Today task.
 * 
 * We keep the legacy export names for deployment compatibility.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const messaging = admin.messaging();

// Daily check-in prompts - varied to keep engagement fresh
const REFLECTION_PROMPTS = [
  { title: "PulseCheck daily check-in", body: "Open today's web task and log how you're showing up." },
  { title: "Time for your daily check-in", body: "Give PulseCheck one honest signal so Nora can guide the next rep." },
  { title: "Your web check-in is ready", body: "Complete today's PulseCheck task and keep your signal fresh." },
  { title: "Take today's PulseCheck read", body: "A quick check-in keeps your profile and assignments current." },
  { title: "Check in before the day runs away", body: "Open the web task and capture today's mental readiness." },
  { title: "Keep your PulseCheck rhythm alive", body: "Today's web check-in only takes a moment." },
  { title: "Nora needs today's signal", body: "Open the web daily task and log your readiness." },
  { title: "Stay in the PulseCheck loop", body: "Complete today's web check-in to keep training personalized." }
];

/**
 * Get a random reflection prompt
 */
function getRandomPrompt() {
  return REFLECTION_PROMPTS[Math.floor(Math.random() * REFLECTION_PROMPTS.length)];
}

function resolvePulseCheckFcmToken(userData = {}) {
  return typeof userData.pulseCheckFcmToken === 'string' ? userData.pulseCheckFcmToken.trim() : '';
}

function resolvePulseCheckPushTarget(userData = {}) {
  const token = resolvePulseCheckFcmToken(userData);
  if (!token) {
    return { token: '', eligible: false, reason: 'missing_pulsecheck_fcm_token' };
  }

  const sourceApp = typeof userData.pushTokenSourceApp === 'string'
    ? userData.pushTokenSourceApp.trim().toLowerCase()
    : '';

  if (sourceApp !== 'pulsecheck') {
    return {
      token: '',
      eligible: false,
      reason: sourceApp ? 'pulsecheck_source_app_mismatch' : 'missing_pulsecheck_source_app',
    };
  }

  return { token, eligible: true, reason: 'eligible' };
}

/**
 * Send notification to a single user
 */
async function sendReflectionNotification(userId, fcmToken, prompt) {
  const webUrl = 'https://fitwithpulse.ai/PulseCheck?section=today&source=ios-push&task=daily-check-in';
  const message = {
    token: fcmToken,
    notification: {
      title: prompt.title,
      body: prompt.body
    },
    data: {
      type: 'MENTAL_CHECKIN',
      prompt: prompt.title,
      checkInType: 'morning',
      timestamp: String(Math.floor(Date.now() / 1000)),
      screen: 'web_checkin',
      webUrl,
    },
    apns: {
      payload: {
        aps: {
          alert: {
            title: prompt.title,
            body: prompt.body
          },
          badge: 1,
          sound: 'default',
          'content-available': 1
        }
      }
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'daily_check_in'
      }
    }
  };

  try {
    const response = await messaging.send(message);
    console.log(`✅ Sent daily reflection to ${userId}: ${response}`);
    
    // Log the notification
    await db.collection('notification-logs').add({
      userId,
      type: 'MENTAL_CHECKIN',
      title: prompt.title,
      body: prompt.body,
      webUrl,
      success: true,
      sentAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true, userId };
  } catch (error) {
    console.error(`❌ Failed to send to ${userId}:`, error.message);
    return { success: false, userId, error: error.message };
  }
}

/**
 * Get users who should receive daily check-in notification at the current hour
 * 
 * Users have timezone-specific preferences, so we need to:
 * 1. Find users whose preferred hour matches their local time
 * 2. Account for timezone differences
 */
async function getUsersForCurrentHour() {
  const now = new Date();
  const currentUTCHour = now.getUTCHours();
  
  // Get all users with daily check-in reminders enabled
  const usersSnapshot = await db.collection('users')
    .where('dailyReflectionPreferences.enabled', '==', true)
    .get();
  
  const usersToNotify = [];
  
  for (const doc of usersSnapshot.docs) {
    const userData = doc.data();
    const prefs = userData.dailyReflectionPreferences;
    
    const pulseCheckPushTarget = resolvePulseCheckPushTarget(userData);
    if (!prefs || !pulseCheckPushTarget.eligible) continue;
    
    const userTimezone = prefs.timezone || 'America/New_York';
    const preferredHour = prefs.hour ?? 20; // Default 8 PM
    
    try {
      // Calculate what hour it is in the user's timezone
      const userLocalTime = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
      const userLocalHour = userLocalTime.getHours();
      
      // Check if this is the user's preferred notification time
      if (userLocalHour === preferredHour) {
        usersToNotify.push({
          userId: doc.id,
          fcmToken: pulseCheckPushTarget.token,
          userName: userData.displayName || userData.name || 'Athlete'
        });
      }
    } catch (tzError) {
      // If timezone parsing fails, fall back to UTC comparison
      console.warn(`Timezone error for ${doc.id}: ${tzError.message}`);
    }
  }
  
  return usersToNotify;
}

/**
 * Scheduled: Send daily check-in notifications
 * Runs every hour to catch users in different timezones
 * 
 * Deploy with: firebase deploy --only functions:scheduledDailyReflection
 */
exports.scheduledDailyReflection = onSchedule(
  {
    schedule: "0 * * * *", // Every hour on the hour
    timeZone: "UTC",
    memory: "256MiB",
    timeoutSeconds: 120
  },
  async (event) => {
    console.log('🧠 Running daily check-in notification check');
    
    try {
      const usersToNotify = await getUsersForCurrentHour();
      
      if (usersToNotify.length === 0) {
        console.log('No users to notify at this hour');
        return null;
      }
      
      console.log(`Found ${usersToNotify.length} users to notify`);
      
      // Send notifications
      const results = await Promise.all(
        usersToNotify.map(user => {
          const prompt = getRandomPrompt();
          return sendReflectionNotification(user.userId, user.fcmToken, prompt);
        })
      );
      
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      console.log(`✅ Daily check-in notifications sent. Success: ${successful}, Failed: ${failed}`);
      
      // Record batch stats
      await db.collection('notification-batch-logs').add({
        type: 'MENTAL_CHECKIN',
        totalTargeted: usersToNotify.length,
        successful,
        failed,
        runAt: admin.firestore.FieldValue.serverTimestamp(),
        utcHour: new Date().getUTCHours()
      });
      
      return null;
    } catch (error) {
      console.error('Error running daily reflection notifications:', error);
      throw error;
    }
  }
);

/**
 * HTTP Trigger: Send test daily check-in notification (for debugging)
 * 
 * Usage: POST /sendTestReflection with body { userId: "xxx" }
 */
exports.sendTestReflectionNotification = require('firebase-functions').https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  
  const { userId } = req.body;
  
  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }
  
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    const userData = userDoc.data();
    const pulseCheckPushTarget = resolvePulseCheckPushTarget(userData);
    
    if (!pulseCheckPushTarget.eligible) {
      res.status(400).json({ error: `User is not eligible for Pulse Check push: ${pulseCheckPushTarget.reason}` });
      return;
    }
    
    const prompt = getRandomPrompt();
    const result = await sendReflectionNotification(userId, pulseCheckPushTarget.token, prompt);
    
    res.json(result);
  } catch (error) {
    console.error('Error sending test reflection:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = exports;
