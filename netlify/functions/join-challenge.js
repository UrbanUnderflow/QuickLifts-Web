const { admin } = require('./config/firebase');

const db = admin.firestore();

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
    console.log('📥 Received request:', event.body);
    const { username, challengeId, sharedBy } = JSON.parse(event.body);

    if (!username || !challengeId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Username and challengeId are required'
        })
      };
    }

    console.log('🔗 Referral info:', { sharedBy: sharedBy || 'none' });

    // Get user by username
    const usersRef = db.collection('users');
    const userSnapshot = await usersRef.where('username', '==', username).get();

    if (userSnapshot.empty) {
      console.log('❌ User not found:', username);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'User not found'
        })
      };
    }

    const userData = userSnapshot.docs[0].data();
    const userId = userSnapshot.docs[0].id;

    // Get challenge
    const challengeRef = db.collection('sweatlist-collection').doc(challengeId);
    const challengeDoc = await challengeRef.get();

    if (!challengeDoc.exists) {
      console.log('❌ Challenge not found:', challengeId);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Challenge not found'
        })
      };
    }

    const challenge = challengeDoc.data();
    const userChallengeId = `${challengeId}-${userId}-${Date.now()}`;

    // Create user challenge document
    const userRound = {
      id: userChallengeId,
      challenge: challenge,
      challengeId: challengeId,
      userId: userId,
      fcmToken: userData.fcmToken || '',
      profileImage: userData.profileImage || {},
      progress: 0,
      completedWorkouts: [],
      referralChain: {
        originalHostId: sharedBy || '',
        sharedBy: sharedBy || ''
      },
      isCompleted: false,
      uid: userId,
      location: userData.location || null,
      city: '',
      country: '',
      timezone: '',
      username: username,
      joinDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      pulsePoints: {
        baseCompletion: 0,
        firstCompletion: 0,
        streakBonus: 0,
        checkInBonus: 0,
        effortRating: 0,
        chatParticipation: 0,
        locationCheckin: 0,
        contentEngagement: 0,
        encouragementSent: 0,
        encouragementReceived: 0
      },
      currentStreak: 0,
      encouragedUsers: [],
      encouragedByUsers: [],
      checkIns: []
    };

    console.log('🆕 Creating new UserTogetherRound with ID:', userChallengeId);
    console.log('📤 Data to Firestore:', userRound);

    // Save to Firestore
    await db.collection('user-challenge').doc(userChallengeId).set(userRound);
    console.log('✅ User challenge created successfully');

    // --- Gym affiliate KPI instrumentation ---
    // If the challenge has a gymAffiliateId, update that affiliate's
    // uniqueParticipants and tracking list so each user is only counted once.
    if (challenge.gymAffiliateId) {
      const gymAffiliateId = challenge.gymAffiliateId;
      const gymAffiliateRef = db.collection('gymAffiliates').doc(gymAffiliateId);

      console.log('📈 Updating gym affiliate KPIs for join:', {
        gymAffiliateId,
        userId,
        challengeId
      });

      await db.runTransaction(async (tx) => {
        const affiliateSnap = await tx.get(gymAffiliateRef);
        if (!affiliateSnap.exists) {
          console.warn('⚠️ gymAffiliates doc not found for gymAffiliateId; skipping KPI update.', {
            gymAffiliateId,
            userId,
            challengeId
          });
          return;
        }

        const data = affiliateSnap.data() || {};
        const uniqueIds = Array.isArray(data.uniqueParticipantUserIds)
          ? data.uniqueParticipantUserIds
          : [];

        // Only increment uniqueParticipants if this user hasn't been counted yet
        if (!uniqueIds.includes(userId)) {
          uniqueIds.push(userId);

          const currentUnique = typeof data.uniqueParticipants === 'number'
            ? data.uniqueParticipants
            : 0;

          tx.update(gymAffiliateRef, {
            uniqueParticipants: currentUnique + 1,
            uniqueParticipantUserIds: uniqueIds
          });

          console.log('✅ Incremented uniqueParticipants for gym affiliate.', {
            gymAffiliateId,
            userId,
            newUniqueParticipants: currentUnique + 1
          });
        } else {
          console.log('ℹ️ User already counted as unique participant for this gym affiliate. Skipping increment.', {
            gymAffiliateId,
            userId
          });
        }
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Successfully joined challenge'
      })
    };

  } catch (error) {
    console.error('❌ Error creating user challenge:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
