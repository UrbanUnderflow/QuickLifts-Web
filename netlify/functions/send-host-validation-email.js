// Function to send host validation email for prize distribution
const { db, headers } = require('./config/firebase');

const BREVO_API_KEY = process.env.BREVO_MARKETING_KEY;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "tre@fitwithpulse.ai";
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "Pulse Team";
// Always use production URL for email links, even in development
const BASE_URL = 'https://fitwithpulse.ai';

const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    if (!db) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Firebase database not available'
        })
      };
    }

    if (!BREVO_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Email service not configured'
        })
      };
    }

    const {
      prizeAssignmentId,
      challengeId,
      challengeTitle,
      prizeAmount,
      prizeStructure,
      requestedBy
    } = JSON.parse(event.body || '{}');

    console.log('[SendHostValidationEmail] Processing request:', {
      prizeAssignmentId,
      challengeId,
      challengeTitle,
      prizeAmount,
      requestedBy
    });

    // Validate required fields
    if (!prizeAssignmentId || !challengeId || !challengeTitle || !prizeAmount || !requestedBy) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields'
        })
      };
    }

    // Get the challenge data to find the host
    console.log(`[SendHostValidationEmail] Looking for challengeId: ${challengeId}`);
    
    let challengeDoc = await db.collection('sweatlist-collection').doc(challengeId).get();
    
    // If not found in sweatlist-collection, try challenges collection
    if (!challengeDoc.exists) {
      console.log(`[SendHostValidationEmail] Challenge not found in sweatlist-collection, trying challenges collection`);
      challengeDoc = await db.collection('challenges').doc(challengeId).get();
    }
    
    if (!challengeDoc.exists) {
      console.log(`[SendHostValidationEmail] Challenge not found in either collection`);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Challenge not found in any collection'
        })
      };
    }

    const challengeData = challengeDoc.data();
    console.log('[SendHostValidationEmail] Challenge data:', {
      id: challengeDoc.id,
      ownerId: challengeData?.ownerId,
      createdBy: challengeData?.createdBy,
      hostId: challengeData?.hostId,
      allFields: Object.keys(challengeData || {})
    });
    
    const ownerIds = challengeData.ownerId;

    if (!ownerIds || !Array.isArray(ownerIds) || ownerIds.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Challenge has no owners'
        })
      };
    }

    // Get all host user information
    const hostPromises = ownerIds.map(async (hostUserId) => {
      const hostDoc = await db.collection('users').doc(hostUserId).get();
      if (hostDoc.exists) {
        const hostData = hostDoc.data();
        return {
          id: hostUserId,
          email: hostData.email,
          name: hostData.username || hostData.displayName || 'Challenge Host'
        };
      }
      return null;
    });

    const hostResults = await Promise.all(hostPromises);
    const validHosts = hostResults.filter(host => host !== null && host.email);

    if (validHosts.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'No valid hosts found with email addresses'
        })
      };
    }

    console.log('[SendHostValidationEmail] Found hosts:', validHosts);

    // Determine current challenge winners to include in email
    let winnersInfo = [];
    let challengeHasEnded = false;
    try {
      console.log('[SendHostValidationEmail] Determining current winners...');
      
      // First, check if challenge has ended by getting challenge details
      let challengeEndDate = null;
      if (challengeDoc.exists) {
        const challengeData = challengeDoc.data();
        challengeEndDate = challengeData.endDate;
        
        // Convert endDate using proper date conversion
        if (challengeEndDate) {
          // Handle Firestore Timestamp conversion
          let convertedEndDate;
          if (challengeEndDate && typeof challengeEndDate.toDate === 'function') {
            convertedEndDate = challengeEndDate.toDate();
          } else if (challengeEndDate instanceof Date) {
            convertedEndDate = challengeEndDate;
          } else if (typeof challengeEndDate === 'number') {
            // If timestamp looks like seconds (less than 10 billion), convert to milliseconds
            convertedEndDate = challengeEndDate < 10000000000 ? 
              new Date(challengeEndDate * 1000) : 
              new Date(challengeEndDate);
          } else {
            console.warn('[SendHostValidationEmail] Invalid endDate format:', challengeEndDate);
            convertedEndDate = new Date();
          }
          
          challengeHasEnded = convertedEndDate < new Date();
          console.log('[SendHostValidationEmail] Challenge end date:', convertedEndDate);
          console.log('[SendHostValidationEmail] Challenge has ended:', challengeHasEnded);
        }
      }
      
      // Get all participants for this challenge
      const participantsSnapshot = await db.collection('user-challenge')
        .where('challengeId', '==', challengeId)
        .get();

      if (!participantsSnapshot.empty) {
        // Extract participants with scores from pulsePoints
        const participants = participantsSnapshot.docs.map(doc => {
          const data = doc.data();
          const pulsePoints = data.pulsePoints || {};
          return {
            id: doc.id,
            userId: data.userId,
            challengeId: data.challengeId,
            score: pulsePoints.totalPoints || 0,
            isComplete: data.isComplete || false,
            completedAt: data.completedAt,
            updatedAt: data.updatedAt,
            username: data.username // Include username if available in user-challenge
          };
        });

        // If challenge has ended, get final winners. Otherwise, show current leaderboard
        let relevantParticipants;
        if (challengeHasEnded) {
          // Challenge ended - show only completed participants (final winners)
          relevantParticipants = participants
            .filter(p => p.isComplete)
            .sort((a, b) => b.score - a.score);
          console.log(`[SendHostValidationEmail] Challenge ended - ${relevantParticipants.length} completed participants`);
        } else {
          // Challenge still active - show all participants by current score
          relevantParticipants = participants
            .sort((a, b) => b.score - a.score);
          console.log(`[SendHostValidationEmail] Challenge active - ${relevantParticipants.length} total participants`);
        }

        // Get top 3 participants for display
        const topParticipants = relevantParticipants.slice(0, 3);
        
        // Fetch usernames for top participants (if not already in user-challenge)
        const userPromises = topParticipants.map(async (participant) => {
          try {
            // If username is already in the user-challenge document, use it
            if (participant.username) {
              return {
                userId: participant.userId,
                username: participant.username,
                score: participant.score,
                isComplete: participant.isComplete
              };
            }
            
            // Otherwise, fetch from users collection
            const userDoc = await db.collection('users').doc(participant.userId).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              return {
                userId: participant.userId,
                username: userData.username || userData.displayName || 'Unknown User',
                score: participant.score,
                isComplete: participant.isComplete
              };
            }
            return null;
          } catch (error) {
            console.error(`Error fetching user ${participant.userId}:`, error);
            return null;
          }
        });

        const userResults = await Promise.all(userPromises);
        winnersInfo = userResults.filter(user => user !== null);
        
        // Store additional info for email template
        winnersInfo.totalParticipants = relevantParticipants.length;
        winnersInfo.challengeHasEnded = challengeHasEnded;
        winnersInfo.showingCompletedOnly = challengeHasEnded;
        
        console.log('[SendHostValidationEmail] Current leaderboard:', winnersInfo);
      }
    } catch (error) {
      console.error('[SendHostValidationEmail] Error determining winners:', error);
      // Continue without winner info if there's an error
      winnersInfo.challengeHasEnded = challengeHasEnded;
    }

    // Generate confirmation token (only once)
    const confirmationToken = generateSecureToken(prizeAssignmentId);
    const confirmationUrl = `${BASE_URL}/.netlify/functions/confirm-prize-distribution?prizeId=${prizeAssignmentId}&token=${confirmationToken}`;

    // Format prize structure description
    const getPrizeStructureDescription = (structure) => {
      switch (structure) {
        case 'winner_takes_all':
          return '100% to 1st place';
        case 'top_three_split':
          return '60% / 25% / 15% split (1st/2nd/3rd)';
        case 'top_five_split':
          return '40% / 25% / 20% / 10% / 5% split';
        case 'custom':
          return 'Custom distribution';
        default:
          return structure;
      }
    };

    // Create email HTML content
    const htmlContent = `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #E0FE10; margin: 0; font-size: 28px; font-weight: bold;">🏆 Prize Distribution Confirmation</h1>
          <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px;">Your challenge is ready for winner rewards!</p>
        </div>

        <!-- Content -->
        <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Hi there,
          </p>

          <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
            Great news! Prize money has been assigned to your challenge and is ready for distribution to the winners.
          </p>

          <!-- Challenge Details Card -->
          <div style="background: #f8f9fa; border: 2px solid #E0FE10; border-radius: 12px; padding: 25px; margin: 25px 0;">
            <h3 style="color: #1a1a1a; margin: 0 0 15px 0; font-size: 20px;">📋 Challenge Details</h3>
            <div style="color: #555555; font-size: 15px; line-height: 1.8;">
              <p style="margin: 8px 0;"><strong>Challenge:</strong> ${challengeTitle}</p>
              <p style="margin: 8px 0;"><strong>Prize Pool:</strong> $${prizeAmount.toFixed(2)}</p>
              <p style="margin: 8px 0;"><strong>Distribution:</strong> ${getPrizeStructureDescription(prizeStructure)}</p>
            </div>
          </div>

          ${winnersInfo.length > 0 ? `
          <!-- Current Leaderboard -->
          <div style="background: ${winnersInfo.challengeHasEnded ? '#e8f5e8' : '#fff8e1'}; border: 2px solid ${winnersInfo.challengeHasEnded ? '#4caf50' : '#ffb300'}; border-radius: 12px; padding: 25px; margin: 25px 0;">
            <h3 style="color: ${winnersInfo.challengeHasEnded ? '#2e7d32' : '#ff8f00'}; margin: 0 0 15px 0; font-size: 20px;">
              ${winnersInfo.challengeHasEnded ? '🏆 Final Winners' : '📊 Current Leaderboard'}
            </h3>
            <div style="color: #555555; font-size: 15px;">
              ${winnersInfo.map((winner, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
                const position = index + 1;
                return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: ${index < winnersInfo.length - 1 ? '1px solid #e0e0e0' : 'none'};">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 18px;">${medal}</span>
                    <div>
                      <p style="margin: 0; font-weight: bold; color: #333;">${position}. ${winner.username}</p>
                      <p style="margin: 0; font-size: 13px; color: #666;">Score: ${winner.score.toLocaleString()} points</p>
                    </div>
                  </div>
                </div>
                `;
              }).join('')}
            </div>
            <p style="margin: 15px 0 0 0; font-size: 13px; color: #666; font-style: italic;">
              ${winnersInfo.challengeHasEnded ? 
                (winnersInfo.totalParticipants > winnersInfo.length ? 
                  `Showing top ${winnersInfo.length} of ${winnersInfo.totalParticipants} participants who completed the challenge` : 
                  `All ${winnersInfo.length} participants who completed the challenge`) :
                (winnersInfo.totalParticipants > winnersInfo.length ? 
                  `Showing top ${winnersInfo.length} of ${winnersInfo.totalParticipants} current participants` : 
                  `All ${winnersInfo.length} current participants shown`)
              }
            </p>
          </div>
          ` : `
          <!-- No Winners/Participants Yet -->
          <div style="background: ${winnersInfo.challengeHasEnded ? '#ffebee' : '#fff3e0'}; border: 2px solid ${winnersInfo.challengeHasEnded ? '#f44336' : '#ff9800'}; border-radius: 12px; padding: 25px; margin: 25px 0;">
            <h3 style="color: ${winnersInfo.challengeHasEnded ? '#c62828' : '#f57c00'}; margin: 0 0 10px 0; font-size: 18px;">
              ${winnersInfo.challengeHasEnded ? '⚠️ No Completed Participants' : '⏳ Challenge in Progress'}
            </h3>
            <p style="color: #666; margin: 0; font-size: 14px;">
              ${winnersInfo.challengeHasEnded ? 
                'This challenge has ended, but no participants completed their challenge activities. No prize money will be distributed.' : 
                'Challenge is currently active. Winners will be determined when the challenge ends.'
              }
            </p>
          </div>
          `}

          <div style="background: #e8f4fd; border-left: 4px solid #2196F3; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <h4 style="color: #1976D2; margin: 0 0 10px 0; font-size: 16px;">🎯 What happens next?</h4>
            <p style="color: #555555; margin: 0; font-size: 14px; line-height: 1.6;">
              Click the confirmation button below to authorize prize distribution to the challenge winners. 
              This will automatically send the prize money to the winners' accounts based on their final rankings.
            </p>
          </div>

          <!-- Action Button -->
          <div style="text-align: center; margin: 35px 0;">
            <a href="${confirmationUrl}" 
               style="display: inline-block; background: #E0FE10; color: #000000; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(224, 254, 16, 0.3); transition: all 0.3s ease;">
              ✅ Confirm Prize Distribution
            </a>
          </div>

          <div style="background: #fff8e1; border: 1px solid #ffcc02; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h4 style="color: #f57c00; margin: 0 0 10px 0; font-size: 14px;">⚠️ Important Notes:</h4>
            <ul style="color: #666666; font-size: 13px; line-height: 1.6; margin: 0; padding-left: 20px;">
              <li>Only click confirm if you've verified the challenge results and winners</li>
              <li>Prize distribution cannot be undone once confirmed</li>
              <li>Winners will be notified automatically when prizes are sent</li>
              <li>This link expires in 7 days for security</li>
            </ul>
          </div>

          <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-top: 30px;">
            Questions? Simply reply to this email and we'll help you out.
          </p>

          <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 0;">
            Best regards,<br>
            <strong>The Pulse Team</strong>
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 20px; color: #888888; font-size: 12px;">
          <p style="margin: 0;">This email was sent by Pulse • Challenge ID: ${challengeId}</p>
          <p style="margin: 5px 0 0 0;">If you didn't expect this email, please contact support.</p>
        </div>
      </div>
    `;

    // Send emails to all valid hosts
    const emailPromises = validHosts.map(async (host) => {
      const brevoPayload = {
        sender: {
          name: SENDER_NAME,
          email: SENDER_EMAIL,
        },
        to: [
          {
            email: host.email,
            name: host.name,
          },
        ],
        subject: `🏆 Confirm Prize Distribution - ${challengeTitle}`,
        htmlContent: htmlContent,
        headers: {
          'X-Prize-Assignment-ID': prizeAssignmentId,
          'X-Challenge-ID': challengeId,
          'X-Email-Type': 'host-validation',
          'X-Host-ID': host.id
        },
        replyTo: {
          email: SENDER_EMAIL,
          name: SENDER_NAME
        }
      };

      console.log('[SendHostValidationEmail] Sending email to host:', {
        to: host.email,
        hostName: host.name,
        hostId: host.id,
        challengeTitle,
        prizeAmount
      });

      // Send email via Brevo API
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(brevoPayload),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        console.error(`Brevo API Error for host ${host.id}:`, response.status, errorBody);
        return { success: false, host: host.id, error: errorBody.message };
      }

      const responseData = await response.json();
      console.log(`[SendHostValidationEmail] Email sent successfully to ${host.email}:`, responseData);
      return { success: true, host: host.id, messageId: responseData.messageId };
    });

    const emailResults = await Promise.all(emailPromises);
    const successfulEmails = emailResults.filter(result => result.success);
    const failedEmails = emailResults.filter(result => !result.success);

    if (successfulEmails.length === 0) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Failed to send email to any hosts',
          details: failedEmails
        })
      };
    }

    // Update prize assignment with email sent status
    const updateData = {
      hostEmailSent: true,
      hostEmailSentAt: new Date(),
      hostEmailMessageIds: successfulEmails.map(result => result.messageId),
      confirmationToken: confirmationToken,
      confirmationExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      updatedAt: new Date(),
      emailsSentToHosts: validHosts.length,
      emailsSuccessful: successfulEmails.length,
      emailsFailed: failedEmails.length
    };

    await db.collection('challenge-prizes').doc(prizeAssignmentId).update(updateData);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        emailsSent: successfulEmails.length,
        emailsFailed: failedEmails.length,
        messageIds: successfulEmails.map(result => result.messageId),
        hostEmails: validHosts.map(host => host.email),
        message: `Host validation emails sent successfully to ${successfulEmails.length} of ${validHosts.length} hosts`
      })
    };

  } catch (error) {
    console.error('[SendHostValidationEmail] Error:', error);
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

// Helper function to generate secure token for confirmation
function generateSecureToken(prizeAssignmentId) {
  const crypto = require('crypto');
  const secret = process.env.JWT_SECRET || 'fallback-secret-key';
  return crypto
    .createHmac('sha256', secret)
    .update(prizeAssignmentId)
    .digest('hex')
    .substring(0, 32);
}

module.exports = { handler }; 