// Function to record a completed payment in Firestore

const admin = require('firebase-admin');
const { db } = require('./config/firebase');
const { toUnixTimestamp, fromUnixTimestamp } = require('./utils/date-helpers');

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
    
    // Get owner's Stripe account ID
    let ownerStripeAccountId = connectedAccountId;
    if (!ownerStripeAccountId && effectiveOwnerId) {
      const ownerDoc = await db.collection('users').doc(effectiveOwnerId).get();
      if (ownerDoc.exists) {
        const ownerData = ownerDoc.data();
        ownerStripeAccountId = ownerData?.creator?.stripeAccountId;
        console.log('Retrieved owner Stripe account ID:', ownerStripeAccountId);
      }
    }
    
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
          hasProfileImage: !!userData.profileImage,
          email: userData.email
        });

        // Get challenge data from sweatlist-collection
        const sweatlistQuery = await db.collection('sweatlist-collection').where('challenge.id', '==', challengeId).limit(1).get();
        
        if (!sweatlistQuery.empty) {
          const sweatlistDoc = sweatlistQuery.docs[0];
          const challengeData = sweatlistDoc.data();

          console.log('Found challenge data:', {
            challengeId,
            title: challengeData.challenge?.title,
            currentParticipants: challengeData.participants?.length || 0,
            hasChallenge: !!challengeData.challenge,
            documentId: sweatlistDoc.id
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
              challenge: challengeData.challenge || challengeData, // Use challenge object if available, otherwise use full data
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
              joinDate: joinDate.toISOString(),
              hasChallengeData: !!userChallengeData.challenge
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
              totalParticipants: updatedChallenge.participants.length,
              documentId: sweatlistDoc.id
            });

            // Update the challenge document with new participant
            const challengeRef = db.collection('sweatlist-collection').doc(sweatlistDoc.id);
            batch.update(challengeRef, {
              participants: updatedChallenge.participants,
              updatedAt: toUnixTimestamp(new Date())
            });

            console.log('Successfully prepared userChallenge creation:', {
              userChallengeId,
              challengeId,
              buyerId,
              documentId: sweatlistDoc.id
            });
          } else {
            // If user is already a participant, create a new userChallenge with merged data
            console.log('User already a participant, creating new userChallenge with merged data');
            
            // Generate new userChallenge ID
            userChallengeId = `${challengeId}-${buyerId}-${Date.now()}`;
            const joinDate = new Date();
            
            // Create new userChallenge data, preserving existing data
            const userChallengeData = {
              id: userChallengeId,
              challenge: challengeData.challenge || challengeData,
              challengeId,
              userId: buyerId,
              fcmToken: userData.fcmToken || existingParticipant.fcmToken || '',
              profileImage: userData.profileImage || existingParticipant.profileImage || {},
              progress: existingParticipant.progress || 0,
              completedWorkouts: existingParticipant.completedWorkouts || [],
              referralChain: existingParticipant.referralChain || {
                originalHostId: '',
                sharedBy: ''
              },
              isCompleted: existingParticipant.isCompleted || false,
              uid: buyerId,
              location: userData.location || existingParticipant.location || null,
              city: existingParticipant.city || '',
              country: existingParticipant.country || '',
              timezone: existingParticipant.timezone || '',
              username: userData.username || existingParticipant.username || '',
              joinDate: toUnixTimestamp(joinDate),
              createdAt: toUnixTimestamp(joinDate),
              updatedAt: toUnixTimestamp(new Date()),
              pulsePoints: {
                ...existingParticipant.pulsePoints,
                baseCompletion: existingParticipant.pulsePoints?.baseCompletion || 0,
                firstCompletion: existingParticipant.pulsePoints?.firstCompletion || 0,
                streakBonus: existingParticipant.pulsePoints?.streakBonus || 0,
                cumulativeStreakBonus: existingParticipant.pulsePoints?.cumulativeStreakBonus || 0,
                checkInBonus: existingParticipant.pulsePoints?.checkInBonus || 0,
                effortRating: existingParticipant.pulsePoints?.effortRating || 0,
                chatParticipation: existingParticipant.pulsePoints?.chatParticipation || 0,
                locationCheckin: existingParticipant.pulsePoints?.locationCheckin || 0,
                contentEngagement: existingParticipant.pulsePoints?.contentEngagement || 0,
                encouragementSent: existingParticipant.pulsePoints?.encouragementSent || 0,
                encouragementReceived: existingParticipant.pulsePoints?.encouragementReceived || 0
              },
              currentStreak: existingParticipant.currentStreak || 0,
              encouragedUsers: existingParticipant.encouragedUsers || [],
              encouragedByUsers: existingParticipant.encouragedByUsers || [],
              checkIns: existingParticipant.checkIns || []
            };

            console.log('Preparing to create merged userChallenge:', {
              oldUserChallengeId: existingParticipant.id,
              newUserChallengeId: userChallengeId,
              userId: buyerId,
              username: userData.username,
              preservedData: {
                progress: userChallengeData.progress,
                completedWorkouts: userChallengeData.completedWorkouts.length,
                currentStreak: userChallengeData.currentStreak,
                joinDate: userChallengeData.joinDate
              }
            });

            // Add new userChallenge record
            const userChallengeRef = db.collection('user-challenge').doc(userChallengeId);
            batch.set(userChallengeRef, userChallengeData);

            // Update challenge participants array to use new userChallenge
            const updatedParticipants = challengeData.participants.map(p => 
              p.userId === buyerId ? userChallengeData : p
            );

            const updatedChallenge = {
              ...challengeData,
              participants: updatedParticipants
            };

            // Update the challenge document with updated participant
            const challengeRef = db.collection('sweatlist-collection').doc(sweatlistDoc.id);
            batch.update(challengeRef, {
              participants: updatedParticipants,
              updatedAt: toUnixTimestamp(new Date())
            });

            console.log('Successfully prepared merged userChallenge:', {
              oldUserChallengeId: existingParticipant.id,
              newUserChallengeId: userChallengeId,
              challengeId,
              buyerId,
              documentId: sweatlistDoc.id
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
    
    // Log timestamp details to help debug
    console.log('Timestamp conversion details:', {
      currentJsDate: now.toISOString(),
      convertedUnixTimestamp: toUnixTimestamp(now),
      convertedBackToIsoString: fromUnixTimestamp(toUnixTimestamp(now))
    });
    
    // Get buyer email from user data if not provided in request
    let effectiveBuyerEmail = buyerEmail;
    let userData = null;
    
    // If we have a buyerId, get the user data
    if (buyerId) {
      const userDoc = await db.collection('users').doc(buyerId).get();
      userData = userDoc.data();
      
      if (userData && !effectiveBuyerEmail) {
        effectiveBuyerEmail = userData.email;
      }
    }
    
    console.log('Payment buyer email:', {
      fromRequest: buyerEmail,
      fromUserData: userData?.email,
      effective: effectiveBuyerEmail
    });

    const paymentRecord = {
      paymentId,
      amount: amount || 0,
      currency: 'usd',
      status: 'completed', // Setting to completed immediately instead of waiting for webhook
      challengeId,
      ownerId: effectiveOwnerId || null,
      buyerId: buyerId || null,
      buyerEmail: effectiveBuyerEmail || null,
      challengeTitle: challengeTitle || 'Round',
      userChallengeId: userChallengeId || null,
      createdAt: toUnixTimestamp(now),
      updatedAt: toUnixTimestamp(now),
      platformFee, // Now this will always be calculated
      ownerAmount, // Now this will always be calculated
      ownerStripeAccountId: ownerStripeAccountId || null
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