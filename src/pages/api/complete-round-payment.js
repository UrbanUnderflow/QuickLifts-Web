import { db } from '../../lib/firebase-admin'; // You'll need to set this up

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { challengeId, paymentId, userId, username } = req.body;
    
    // Get user data
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    // Get challenge data
    const challengeDoc = await db.collection('sweatlist-collection').doc(challengeId).get();
    const challengeData = challengeDoc.data();

    if (!userData || !challengeData) {
      return res.status(404).json({ error: 'User or challenge not found' });
    }

    // Create userChallenge record
    const userChallengeId = `${challengeId}-${userId}-${Date.now()}`;
    const joinDate = new Date();
    
    const userChallengeData = {
      id: userChallengeId,
      challenge: challengeData,
      challengeId,
      userId,
      fcmToken: userData.fcmToken || '',
      profileImage: userData.profileImage || {},
      progress: 0,
      completedWorkouts: [],
      referralChain: {
        originalHostId: '',
        sharedBy: ''
      },
      isCompleted: false,
      uid: userId,
      location: userData.location || null,
      city: '',
      country: '',
      timezone: '',
      username: username || userData.username,
      joinDate,
      createdAt: joinDate,
      updatedAt: new Date(),
      pulsePoints: {
        baseCompletion: 0,
        firstCompletion: 0,
        streakBonus: 0,
        cumulativeStreakBonus: 0,
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

    // Update challenge with new participant
    const updatedChallenge = {
      ...challengeData,
      participants: [...(challengeData.participants || []), userChallengeData]
    };

    // Start a batch write
    const batch = db.batch();

    // Update the challenge document with new participant
    const challengeRef = db.collection('sweatlist-collection').doc(challengeId);
    batch.update(challengeRef, {
      participants: updatedChallenge.participants,
      updatedAt: new Date()
    });

    // Add payment record
    const paymentRef = db.collection('payments').doc();
    batch.set(paymentRef, {
      challengeId,
      paymentId,
      userId,
      status: 'completed',
      timestamp: new Date()
    });

    // Add userChallenge record
    const userChallengeRef = db.collection('user-challenge').doc(userChallengeId);
    batch.set(userChallengeRef, userChallengeData);

    // Commit all changes atomically
    await batch.commit();
    
    // Return success
    res.status(200).json({ 
      success: true,
      userChallengeId,
      userChallenge: userChallengeData
    });
  } catch (err) {
    console.error('Error completing payment:', err);
    res.status(500).json({ error: 'Failed to complete payment' });
  }
}