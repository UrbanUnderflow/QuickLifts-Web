// FILE: netlify/functions/setup-prize-test-scenario.js
// Creates a complete test scenario for prize money testing with fake participants

const { db, admin } = require('./config/firebase');

const handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { 
      winnerUserId,           // The user who should be the winner
      prizeAmount = 10000,    // Prize pool in cents ($100.00)
      distributionType = "top_three_weighted", // Prize distribution type
      participantCount = 8,   // Total number of participants
      autoComplete = true     // Whether to auto-complete the challenge
    } = JSON.parse(event.body || '{}');
    
    if (!winnerUserId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({
          success: false,
          error: 'winnerUserId is required'
        })
      };
    }

    console.log(`[PrizeTestSetup] Setting up test scenario for winner: ${winnerUserId}`);

    // 1. Create test challenge with prize money
    const challengeId = `test_prize_challenge_${Date.now()}`;
    const challengeData = {
      id: challengeId,
      title: "🏆 Test Prize Challenge",
      description: "Auto-generated test challenge for prize money testing",
      status: "active",
      durationInDays: 7,
      startDate: admin.firestore.FieldValue.serverTimestamp(),
      endDate: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: winnerUserId,
      isPublic: true,
      category: "strength",
      difficulty: "beginner",
      prizeMoney: {
        isEnabled: true,
        totalAmount: prizeAmount,
        currency: "USD",
        winnerCount: 3,
        distributionType: distributionType,
        customDistribution: [],
        winnersCalculated: false,
        winners: []
      },
      participants: [],
      workouts: [
        {
          id: `workout_${challengeId}_1`,
          title: "Test Workout 1",
          exercises: [
            { name: "Push-ups", sets: 3, reps: 10 },
            { name: "Squats", sets: 3, reps: 15 }
          ]
        },
        {
          id: `workout_${challengeId}_2`, 
          title: "Test Workout 2",
          exercises: [
            { name: "Burpees", sets: 3, reps: 8 },
            { name: "Planks", sets: 3, reps: 30 }
          ]
        }
      ]
    };

    // Save challenge to Firestore
    await db.collection('challenges').doc(challengeId).set(challengeData);
    console.log(`[PrizeTestSetup] Created challenge: ${challengeId}`);

    // 2. Generate fake participant data
    const fakeParticipants = generateFakeParticipants(participantCount, winnerUserId);
    
    // 3. Create user-challenge documents for all participants
    const batch = db.batch();
    const userChallengePromises = [];

    for (let i = 0; i < fakeParticipants.length; i++) {
      const participant = fakeParticipants[i];
      const userChallengeId = `${challengeId}_${participant.userId}`;
      
      const userChallengeData = {
        id: userChallengeId,
        userId: participant.userId,
        username: participant.username,
        challengeId: challengeId,
        status: "active",
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        pulsePoints: {
          baseCompletion: participant.score.baseCompletion,
          firstCompletion: participant.score.firstCompletion,
          streakBonus: participant.score.streakBonus,
          checkInBonus: participant.score.checkInBonus,
          effortRating: participant.score.effortRating,
          chatParticipation: participant.score.chatParticipation,
          locationCheckin: participant.score.locationCheckin,
          contentEngagement: participant.score.contentEngagement,
          encouragementSent: participant.score.encouragementSent,
          encouragementReceived: participant.score.encouragementReceived,
          totalPoints: participant.score.totalPoints
        },
        completedWorkouts: generateCompletedWorkouts(challengeData.workouts, participant.score.totalPoints),
        currentStreak: Math.floor(participant.score.totalPoints / 100),
        longestStreak: Math.floor(participant.score.totalPoints / 80),
        encouragedUsers: [],
        checkIns: generateCheckIns(participant.score.totalPoints),
        profileImage: {
          profileImageURL: participant.profileImageURL
        }
      };

      const userChallengeRef = db.collection('user-challenge').doc(userChallengeId);
      batch.set(userChallengeRef, userChallengeData);
    }

    // Commit all user-challenge documents
    await batch.commit();
    console.log(`[PrizeTestSetup] Created ${fakeParticipants.length} participants`);

    // 4. If autoComplete is true, complete the challenge and calculate winners
    let completionResult = null;
    if (autoComplete) {
      console.log(`[PrizeTestSetup] Auto-completing challenge...`);
      
      try {
        const testCompleteResponse = await fetch(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/test-complete-challenge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            challengeId: challengeId,
            testMode: true 
          })
        });
        
        if (testCompleteResponse.ok) {
          completionResult = await testCompleteResponse.json();
          console.log(`[PrizeTestSetup] Challenge completed with ${completionResult.winners?.length || 0} winners`);
        } else {
          console.error(`[PrizeTestSetup] Failed to complete challenge:`, testCompleteResponse.status);
        }
      } catch (error) {
        console.error(`[PrizeTestSetup] Error completing challenge:`, error);
      }
    }

    // 5. Prepare response
    const response = {
      success: true,
      challengeId: challengeId,
      timestamp: new Date().toISOString(),
      setup: {
        prizePool: prizeAmount / 100,
        distributionType: distributionType,
        participantCount: fakeParticipants.length,
        winnerUserId: winnerUserId,
        autoCompleted: autoComplete
      },
      participants: fakeParticipants.map((p, index) => ({
        rank: index + 1,
        userId: p.userId,
        username: p.username,
        score: p.score.totalPoints,
        isWinner: index < 3 // Top 3 are winners in most distributions
      })),
      urls: {
        challengeDetail: `/round/${challengeId}`,
        challengeWrapup: `/round/${challengeId}/wrapup`,
        winnerRedemption: `/winner/connect-account?challengeId=${challengeId}&placement=1`
      },
      completion: completionResult,
      message: `Test scenario created! ${winnerUserId} is the winner with ${fakeParticipants[0].score.totalPoints} points. ${autoComplete ? 'Challenge auto-completed.' : 'Visit the URLs to test the UI.'}`
    };

    console.log(`[PrizeTestSetup] Test scenario setup successful`);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('[PrizeTestSetup] Error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};

// Helper function to generate fake participants
function generateFakeParticipants(count, winnerUserId) {
  const fakeNames = [
    "Alex Thompson", "Jordan Smith", "Casey Johnson", "Riley Brown", 
    "Morgan Davis", "Taylor Wilson", "Cameron Miller", "Avery Garcia",
    "Quinn Rodriguez", "Sage Martinez", "River Anderson", "Phoenix Clark"
  ];
  
  const profileImages = [
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1494790108755-2616b32bb48a?w=150&h=150&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face"
  ];

  const participants = [];
  
  // First participant is always the winner with highest score
  participants.push({
    userId: winnerUserId,
    username: "You (Test Winner)",
    profileImageURL: profileImages[0],
    score: generateScoreBreakdown(950) // High winning score
  });

  // Generate other participants with decreasing scores
  for (let i = 1; i < count; i++) {
    const baseScore = 850 - (i * 50) + Math.floor(Math.random() * 40); // Decreasing scores with some randomness
    const userId = `test_user_${i}_${Date.now()}`;
    const username = fakeNames[i % fakeNames.length] || `Test User ${i}`;
    
    participants.push({
      userId: userId,
      username: username,
      profileImageURL: profileImages[i % profileImages.length],
      score: generateScoreBreakdown(Math.max(baseScore, 100)) // Ensure minimum score
    });
  }

  return participants;
}

// Helper function to generate realistic score breakdown
function generateScoreBreakdown(totalTarget) {
  // Distribute the total points across different categories realistically
  const baseCompletion = Math.floor(totalTarget * 0.4); // 40% from base completion
  const firstCompletion = Math.floor(totalTarget * 0.15); // 15% from first completion
  const streakBonus = Math.floor(totalTarget * 0.2); // 20% from streaks
  const checkInBonus = Math.floor(totalTarget * 0.1); // 10% from check-ins
  const effortRating = Math.floor(totalTarget * 0.05); // 5% from effort
  const chatParticipation = Math.floor(totalTarget * 0.05); // 5% from chat
  const locationCheckin = Math.floor(totalTarget * 0.02); // 2% from location
  const contentEngagement = Math.floor(totalTarget * 0.02); // 2% from engagement
  const encouragementSent = Math.floor(totalTarget * 0.005); // 0.5% from encouragement sent
  
  // Calculate remaining to reach target
  const calculated = baseCompletion + firstCompletion + streakBonus + checkInBonus + 
                    effortRating + chatParticipation + locationCheckin + 
                    contentEngagement + encouragementSent;
  
  const encouragementReceived = totalTarget - calculated; // Remainder

  return {
    baseCompletion,
    firstCompletion,
    streakBonus,
    checkInBonus,
    effortRating,
    chatParticipation,
    locationCheckin,
    contentEngagement,
    encouragementSent,
    encouragementReceived: Math.max(encouragementReceived, 0),
    totalPoints: totalTarget
  };
}

// Helper function to generate completed workouts based on score
function generateCompletedWorkouts(workouts, score) {
  const completionRate = Math.min(score / 800, 1); // Higher scores = more completed workouts
  const numCompleted = Math.floor(workouts.length * completionRate);
  
  return workouts.slice(0, numCompleted).map((workout, index) => ({
    workoutId: workout.id,
    completedAt: new Date(Date.now() - (workouts.length - index) * 24 * 60 * 60 * 1000).toISOString(),
    exercises: workout.exercises.map(exercise => ({
      name: exercise.name,
      completed: true,
      sets: exercise.sets
    }))
  }));
}

// Helper function to generate check-ins based on score
function generateCheckIns(score) {
  const checkInCount = Math.floor(score / 150); // Rough ratio
  const checkIns = [];
  
  for (let i = 0; i < checkInCount; i++) {
    checkIns.push({
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
      location: i % 2 === 0 ? "Home Gym" : "Local Fitness Center",
      mood: ["motivated", "energized", "focused", "determined"][i % 4]
    });
  }
  
  return checkIns;
}

module.exports = { handler }; 