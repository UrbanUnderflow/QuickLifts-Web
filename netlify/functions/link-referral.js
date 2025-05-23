const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      "type": "service_account",
      "project_id": "quicklifts-dd3f1",
      "private_key_id": process.env.FIREBASE_PRIVATE_KEY,
      "private_key": process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n'),
      "client_email": "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
      "client_id": "111494077667496751062",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com"
    })
  });
}

const db = admin.firestore();
const messaging = admin.messaging();
const { FieldValue } = admin.firestore;

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400'
};

exports.handler = async (event, context) => {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ''
    };
  }

  // Add CORS headers to all responses
  const headers = {
    ...corsHeaders,
    'Content-Type': 'application/json'
  };

  try {
    console.log('📥 Received manual referral link request:', event.body);
    const { referrerId, referrerUsername, refereeId, refereeUsername, challengeId, challengeTitle } = JSON.parse(event.body);

    if (!referrerId || !refereeId || !challengeId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'referrerId, refereeId, and challengeId are required'
        })
      };
    }

    if (referrerId === refereeId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Referrer and referee cannot be the same person'
        })
      };
    }

    console.log(`🔗 [Manual Referral] Processing: ${referrerUsername} -> ${refereeUsername} in challenge ${challengeTitle}`);

    // 1. Find the referee's user-challenge document for this challenge
    const refereeUserChallengeQuery = await db.collection('user-challenge')
      .where('userId', '==', refereeId)
      .where('challengeId', '==', challengeId)
      .limit(1)
      .get();

    if (refereeUserChallengeQuery.empty) {
      console.log(`❌ [Manual Referral] Referee ${refereeUsername} (${refereeId}) not found in challenge ${challengeId}`);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Referee ${refereeUsername} is not a participant in this challenge`
        })
      };
    }

    const refereeUserChallengeDoc = refereeUserChallengeQuery.docs[0];
    const refereeUserChallengeData = refereeUserChallengeDoc.data();
    const refereeUserChallengeId = refereeUserChallengeDoc.id;

    console.log(`✅ [Manual Referral] Found referee's user-challenge: ${refereeUserChallengeId}`);

    // 2. Check if referral chain already has a sharedBy value
    const currentReferralChain = refereeUserChallengeData.referralChain || {};
    if (currentReferralChain.sharedBy && currentReferralChain.sharedBy !== '') {
      console.log(`⚠️ [Manual Referral] Referee already has referral chain sharedBy: ${currentReferralChain.sharedBy}`);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: `${refereeUsername} already has a referral chain linked to another user. Current sharedBy: ${currentReferralChain.sharedBy}`
        })
      };
    }

    // 3. Find the referrer's user-challenge document for this challenge
    const referrerUserChallengeQuery = await db.collection('user-challenge')
      .where('userId', '==', referrerId)
      .where('challengeId', '==', challengeId)
      .limit(1)
      .get();

    if (referrerUserChallengeQuery.empty) {
      console.log(`❌ [Manual Referral] Referrer ${referrerUsername} (${referrerId}) not found in challenge ${challengeId}`);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Referrer ${referrerUsername} is not a participant in this challenge`
        })
      };
    }

    const referrerUserChallengeDoc = referrerUserChallengeQuery.docs[0];
    const referrerUserChallengeData = referrerUserChallengeDoc.data();
    const referrerUserChallengeId = referrerUserChallengeDoc.id;

    console.log(`✅ [Manual Referral] Found referrer's user-challenge: ${referrerUserChallengeId}`);

    // 4. Update the referee's referral chain
    await db.collection('user-challenge').doc(refereeUserChallengeId).update({
      'referralChain.sharedBy': referrerId,
      'referralChain.originalHostId': referrerId, // Set same as sharedBy for manual links
      'updatedAt': FieldValue.serverTimestamp()
    });

    console.log(`✅ [Manual Referral] Updated referee's referral chain: sharedBy = ${referrerId}`);

    // 5. Award 25 points to the referrer
    const currentReferralBonus = referrerUserChallengeData.pulsePoints?.referralBonus || 0;
    const newReferralBonus = currentReferralBonus + 25;

    await db.collection('user-challenge').doc(referrerUserChallengeId).update({
      'pulsePoints.referralBonus': newReferralBonus,
      'pulsePoints.totalPoints': FieldValue.increment(25),
      'updatedAt': FieldValue.serverTimestamp()
    });

    console.log(`✅ [Manual Referral] Awarded 25 points to ${referrerUsername}. New referral bonus total: ${newReferralBonus}`);

    // 6. Send notification to referrer
    const referrerFcmToken = referrerUserChallengeData.fcmToken;
    if (referrerFcmToken && referrerFcmToken !== '') {
      try {
        const notificationPayload = {
          token: referrerFcmToken,
          notification: {
            title: '💰 +25 Pulse Points!',
            body: `Your friend ${refereeUsername} just joined "${challengeTitle}" using your link! You earned 25 points.`
          },
          data: {
            type: 'referral_join_bonus',
            challengeId: challengeId,
            userId: referrerId,
            referredUserId: refereeId,
            referredUsername: refereeUsername || 'Unknown',
            pointsEarned: '25',
            timestamp: String(Math.floor(Date.now() / 1000)),
            isManualLink: 'true' // Flag to indicate this was manually linked
          },
          apns: {
            payload: {
              aps: {
                alert: {
                  title: '💰 +25 Pulse Points!',
                  body: `Your friend ${refereeUsername} just joined "${challengeTitle}" using your link! You earned 25 points.`
                },
                badge: 1,
                sound: 'default'
              }
            }
          },
          android: {
            priority: 'high',
            notification: { sound: 'default' }
          }
        };

        await messaging.send(notificationPayload);
        console.log(`✅ [Manual Referral] Successfully sent notification to ${referrerUsername} (${referrerId})`);

      } catch (notificationError) {
        console.error(`❌ [Manual Referral] Failed to send notification to ${referrerId}:`, notificationError);
        // Don't fail the entire operation if notification fails
      }
    } else {
      console.log(`⚠️ [Manual Referral] No FCM token found for referrer ${referrerId}, skipping notification`);
    }

    // 7. Log successful manual referral for analytics
    console.log(`🎉 [Manual Referral] COMPLETED: Referrer ${referrerUsername} (${referrerId}) earned 25 points for referring ${refereeUsername} (${refereeId}) to challenge ${challengeId}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Successfully linked referral. ${referrerUsername} awarded 25 points.`,
        details: {
          referrerId,
          referrerUsername,
          refereeId,
          refereeUsername,
          challengeId,
          challengeTitle,
          pointsAwarded: 25,
          newReferralBonus: newReferralBonus
        }
      })
    };

  } catch (error) {
    console.error('❌ [Manual Referral] Error processing manual referral link:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error while linking referral'
      })
    };
  }
}; 