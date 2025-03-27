// Function to record a completed payment in Firestore

const admin = require('firebase-admin');
const { db } = require('./config/firebase');
const { toUnixTimestamp } = require('./utils/date-helpers');

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
  try {
    // Check if we have the required environment variables
    if (!process.env.FIREBASE_SECRET_KEY_ALT) {
      console.warn('FIREBASE_SECRET_KEY_ALT environment variable is missing. Using dummy mode.');
      // In development, we'll just initialize with a placeholder
      admin.initializeApp({
        projectId: "quicklifts-dd3f1"
      });
    } else {
      // Initialize with the actual credentials
      admin.initializeApp({
        credential: admin.credential.cert({
          "type": "service_account",
          "project_id": "quicklifts-dd3f1",
          "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ALT,
          "private_key": process.env.FIREBASE_SECRET_KEY_ALT.replace(/\\n/g, '\n'),
          "client_email": "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
          "client_id": "111494077667496751062",
          "auth_uri": "https://accounts.google.com/o/oauth2/auth",
          "token_uri": "https://oauth2.googleapis.com/token",
          "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
          "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com"
        })
      });
    }
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
  }
}

const handler = async (event) => {
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    // Parse the request body
    const data = JSON.parse(event.body);
    const { challengeId, paymentId, buyerId, ownerId, amount, buyerEmail, connectedAccountId } = data;
    
    console.log('Recording payment completion:', {
      challengeId,
      paymentId,
      buyerId,
      ownerId,
      amount
    });
    
    if (!challengeId || !paymentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Missing required parameters' })
      };
    }
    
    // Verify the challenge exists
    const challengeDoc = await db.collection('challenges').doc(challengeId).get();
    let challengeOwnerId = null;
    let challengeTitle = 'Round';
    
    if (challengeDoc.exists) {
      const challengeData = challengeDoc.data();
      challengeOwnerId = challengeData.ownerId;
      challengeTitle = challengeData.title || challengeTitle;
      console.log(`Challenge found: ${challengeId}, owner:`, challengeOwnerId, 'title:', challengeTitle);
    } else {
      // Try to find in sweatlist-collection
      const sweatlistQuery = await db.collection('sweatlist-collection').where('challenge.id', '==', challengeId).limit(1).get();
      
      if (!sweatlistQuery.empty) {
        const sweatlistDoc = sweatlistQuery.docs[0];
        const sweatlistData = sweatlistDoc.data();
        
        if (sweatlistData.ownerId) {
          challengeOwnerId = sweatlistData.ownerId;
        } else if (sweatlistData.challenge && sweatlistData.challenge.ownerId) {
          challengeOwnerId = sweatlistData.challenge.ownerId;
        }
        
        // Get title from sweatlist collection
        if (sweatlistData.challenge && sweatlistData.challenge.title) {
          challengeTitle = sweatlistData.challenge.title;
        }
        
        console.log(`Challenge found in sweatlist: ${challengeId}, owner:`, challengeOwnerId, 'title:', challengeTitle);
      } else {
        console.warn(`Challenge not found: ${challengeId}`);
        return {
          statusCode: 404,
          body: JSON.stringify({ success: false, error: 'Challenge not found' })
        };
      }
    }
    
    // Get the effective owner ID to store in the payment record
    let effectiveOwnerId = null;
    
    if (ownerId) {
      // If ownerId is provided in the request, use it
      effectiveOwnerId = Array.isArray(ownerId) && ownerId.length > 0 ? ownerId[0] : ownerId;
    } else if (challengeOwnerId) {
      // Otherwise use the owner ID from the challenge
      effectiveOwnerId = Array.isArray(challengeOwnerId) && challengeOwnerId.length > 0 ? 
        challengeOwnerId[0] : challengeOwnerId;
    }
    
    console.log('Effective owner ID for payment record:', effectiveOwnerId);
    
    // Calculate platform fee (3%) and owner amount
    const platformFee = Math.round((amount || 0) * 0.03);
    const ownerAmount = (amount || 0) - platformFee;

    console.log('Payment split:', {
      totalAmount: amount || 0,
      platformFee,
      ownerAmount
    });
    
    // Start a batch write
    const batch = db.batch();
    let userChallengeId = null;

    // If we have a buyerId, create userChallenge record first
    if (buyerId) {
      console.log('Starting userChallenge creation process for buyer:', buyerId);
      
      // Get user data
      const userDoc = await db.collection('users').doc(buyerId).get();
      const userData = userDoc.data();

      if (userData) {
        console.log('Found user data:', {
          username: userData.username,
          hasFcmToken: !!userData.fcmToken,
          hasProfileImage: !!userData.profileImage
        });

        // Get challenge data
        const challengeDoc = await db.collection('sweatlist-collection').doc(challengeId).get();
        const challengeData = challengeDoc.data();

        if (challengeData) {
          console.log('Found challenge data:', {
            challengeId,
            title: challengeData.challenge?.title,
            currentParticipants: challengeData.participants?.length || 0
          });

          // Check if user is already a participant
          const existingParticipant = challengeData.participants?.find(
            p => p.userId === buyerId
          );

          if (!existingParticipant) {
            console.log('User is not an existing participant, creating new userChallenge');
            
            // Create userChallenge record
            userChallengeId = `${challengeId}-${buyerId}-${Date.now()}`;
            const joinDate = new Date();
            
            const userChallengeData = {
              id: userChallengeId,
              challenge: challengeData,
              challengeId,
              userId: buyerId,
              fcmToken: userData.fcmToken || '',
              profileImage: userData.profileImage || {},
              progress: 0,
              completedWorkouts: [],
              referralChain: {
                originalHostId: '',
                sharedBy: ''
              },
              isCompleted: false,
              uid: buyerId,
              location: userData.location || null,
              city: '',
              country: '',
              timezone: '',
              username: userData.username || '',
              joinDate: toUnixTimestamp(joinDate),
              createdAt: toUnixTimestamp(joinDate),
              updatedAt: toUnixTimestamp(joinDate),
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

            console.log('Preparing to create userChallenge with data:', {
              userChallengeId,
              userId: buyerId,
              username: userData.username,
              joinDate: joinDate.toISOString()
            });

            // Add userChallenge record
            const userChallengeRef = db.collection('user-challenge').doc(userChallengeId);
            batch.set(userChallengeRef, userChallengeData);

            // Update challenge with new participant
            const updatedChallenge = {
              ...challengeData,
              participants: [...(challengeData.participants || []), userChallengeData]
            };

            console.log('Updating challenge with new participant:', {
              challengeId,
              newParticipantId: userChallengeId,
              totalParticipants: updatedChallenge.participants.length
            });

            // Update the challenge document with new participant
            const challengeRef = db.collection('sweatlist-collection').doc(challengeId);
            batch.update(challengeRef, {
              participants: updatedChallenge.participants,
              updatedAt: toUnixTimestamp(new Date())
            });

            console.log('Successfully prepared userChallenge creation:', {
              userChallengeId,
              challengeId,
              buyerId
            });
          } else {
            // If user is already a participant, use their existing userChallenge ID
            userChallengeId = existingParticipant.id;
            console.log('User already a participant:', {
              userChallengeId,
              userId: buyerId,
              existingParticipantData: {
                progress: existingParticipant.progress,
                isCompleted: existingParticipant.isCompleted,
                joinDate: existingParticipant.joinDate
              }
            });
          }
        } else {
          console.error('Challenge data not found for challengeId:', challengeId);
        }
      } else {
        console.error('User data not found for buyerId:', buyerId);
      }
    } else {
      console.log('No buyerId provided, skipping userChallenge creation');
    }
    
    // Create a payment record in Firestore
    const now = new Date();
    const paymentRecord = {
      paymentId,
      amount: amount || 0,
      currency: 'usd',
      status: 'pending', // Will be updated to 'succeeded' by webhook
      challengeId,
      ownerId: effectiveOwnerId || null,
      buyerId: buyerId || null,
      buyerEmail: buyerEmail || null,
      challengeTitle: challengeTitle || 'Round',
      userChallengeId: userChallengeId || null,
      createdAt: toUnixTimestamp(now),
      updatedAt: toUnixTimestamp(now),
      platformFee, // Now this will always be calculated
      ownerAmount, // Now this will always be calculated
      stripeAccountId: connectedAccountId || null
    };

    // Remove any undefined values from the payment record
    Object.keys(paymentRecord).forEach(key => {
      if (paymentRecord[key] === undefined) {
        delete paymentRecord[key];
      }
    });

    // Add payment record
    const paymentRef = db.collection('payments').doc(paymentId);
    batch.set(paymentRef, paymentRecord);

    // Commit all changes atomically
    await batch.commit();
    console.log('Created payment record and userChallenge in Firestore:', {
      paymentId,
      userChallengeId,
      paymentRecord // Log the actual payment record for debugging
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        paymentDetails: {
          id: paymentId,
          challengeId,
          challengeTitle,
          amount: amount || 0,
          userChallengeId // Include userChallenge ID in the response
        }
      })
    };
  } catch (error) {
    console.error('Error completing payment:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message || 'Unknown error' })
    };
  }
};

module.exports = { handler }; 