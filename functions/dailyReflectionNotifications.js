/**
 * Daily Reflection Notifications
 * 
 * Sends personalized "How was your day?" notifications to users
 * at their preferred time to encourage journaling with Nora.
 * 
 * This is a core feature for building mental training habits.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const messaging = admin.messaging();

// Reflection prompts - varied to keep engagement fresh
const REFLECTION_PROMPTS = [
  { title: "How was your day?", body: "Take a moment to reflect with Nora 🧠" },
  { title: "Time to reflect", body: "What went well today? Let's talk about it ✨" },
  { title: "Evening check-in", body: "Nora is ready to help you process your day 🌙" },
  { title: "Daily reflection time", body: "2 minutes of reflection = stronger mental game 💪" },
  { title: "How are you feeling?", body: "Share your wins and challenges with Nora 🎯" },
  { title: "End your day strong", body: "A quick reflection builds tomorrow's mindset 🌟" },
  { title: "Moment of clarity", body: "What did you learn today? Tell Nora 📝" },
  { title: "Your mental check-in", body: "Processing today helps you win tomorrow 🏆" }
];

/**
 * Get a random reflection prompt
 */
function getRandomPrompt() {
  return REFLECTION_PROMPTS[Math.floor(Math.random() * REFLECTION_PROMPTS.length)];
}

/**
 * Send notification to a single user
 */
async function sendReflectionNotification(userId, fcmToken, prompt) {
  const message = {
    token: fcmToken,
    notification: {
      title: prompt.title,
      body: prompt.body
    },
    data: {
      type: 'DAILY_REFLECTION',
      prompt: prompt.title,
      timestamp: String(Math.floor(Date.now() / 1000)),
      screen: 'chat' // Deep link to chat
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
        channelId: 'daily_reflection'
      }
    }
  };

  try {
    const response = await messaging.send(message);
    console.log(`✅ Sent daily reflection to ${userId}: ${response}`);
    
    // Log the notification
    await db.collection('notification-logs').add({
      userId,
      type: 'DAILY_REFLECTION',
      title: prompt.title,
      body: prompt.body,
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
 * Get users who should receive reflection notification at the current hour
 * 
 * Users have timezone-specific preferences, so we need to:
 * 1. Find users whose preferred hour matches their local time
 * 2. Account for timezone differences
 */
async function getUsersForCurrentHour() {
  const now = new Date();
  const currentUTCHour = now.getUTCHours();
  
  // Get all users with daily reflection enabled
  const usersSnapshot = await db.collection('users')
    .where('dailyReflectionPreferences.enabled', '==', true)
    .get();
  
  const usersToNotify = [];
  
  for (const doc of usersSnapshot.docs) {
    const userData = doc.data();
    const prefs = userData.dailyReflectionPreferences;
    
    if (!prefs || !userData.fcmToken) continue;
    
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
          fcmToken: userData.fcmToken,
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
 * Scheduled: Send daily reflection notifications
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
    console.log('🌙 Running daily reflection notification check');
    
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
      
      console.log(`✅ Daily reflection notifications sent. Success: ${successful}, Failed: ${failed}`);
      
      // Record batch stats
      await db.collection('notification-batch-logs').add({
        type: 'DAILY_REFLECTION',
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
 * HTTP Trigger: Send test reflection notification (for debugging)
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
    const fcmToken = userData.fcmToken;
    
    if (!fcmToken) {
      res.status(400).json({ error: 'User has no FCM token' });
      return;
    }
    
    const prompt = getRandomPrompt();
    const result = await sendReflectionNotification(userId, fcmToken, prompt);
    
    res.json(result);
  } catch (error) {
    console.error('Error sending test reflection:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = exports;
