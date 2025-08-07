// Function to send notification emails to prize winners
const { db, headers } = require('./config/firebase');

const BREVO_API_KEY = process.env.BREVO_MARKETING_KEY;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "tre@fitwithpulse.ai";
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "Pulse Team";
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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { winners, challengeTitle, challengeId } = JSON.parse(event.body);

    console.log('[SendWinnerNotificationEmail] Processing winner notifications:', {
      winnersCount: winners.length,
      challengeTitle,
      challengeId
    });

    if (!winners || !Array.isArray(winners) || winners.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'No winners provided'
        })
      };
    }

    // Send emails to all winners
    const emailPromises = winners.map(async (winner) => {
      try {
        // Get winner's user data for email
        const userDoc = await db.collection('users').doc(winner.userId).get();
        if (!userDoc.exists) {
          console.error(`[SendWinnerNotificationEmail] User ${winner.userId} not found`);
          return { success: false, userId: winner.userId, error: 'User not found' };
        }

        const userData = userDoc.data();
        const userEmail = userData.email;
        const userName = userData.username || userData.displayName || userData.firstName || 'Winner';

        if (!userEmail) {
          console.error(`[SendWinnerNotificationEmail] No email for user ${winner.userId}`);
          return { success: false, userId: winner.userId, error: 'No email address' };
        }

        // Format prize amount
        const prizeAmount = (winner.prizeAmount / 100).toFixed(2);

        // Create dashboard URL
        const dashboardUrl = `${BASE_URL}/${userData.username}/earnings`;

        // Create HTML email content
        const htmlContent = `
          <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: #E0FE10; margin: 0; font-size: 32px; font-weight: bold;">🏆 Congratulations!</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 18px;">You've received prize money!</p>
            </div>

            <!-- Content -->
            <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Hi ${userName},
              </p>

              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                Great news! You've won prize money from the <strong>${challengeTitle}</strong> challenge!
              </p>

              <!-- Prize Details Card -->
              <div style="background: #e8f5e8; border: 2px solid #4caf50; border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center;">
                <h3 style="color: #2e7d32; margin: 0 0 15px 0; font-size: 24px;">💰 Prize Amount</h3>
                <div style="color: #2e7d32; font-size: 36px; font-weight: bold; margin-bottom: 10px;">
                  $${prizeAmount}
                </div>
                <p style="color: #555555; margin: 0; font-size: 14px;">
                  Placement: ${getOrdinalNumber(winner.rank)} place
                </p>
              </div>

              <!-- Next Steps -->
              <div style="background: #fff8e1; border: 2px solid #ffb300; border-radius: 12px; padding: 25px; margin: 25px 0;">
                <h3 style="color: #ff8f00; margin: 0 0 15px 0; font-size: 20px;">💳 Your Money is Ready!</h3>
                <p style="color: #555555; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
                  Your prize money has been deposited into your Pulse account and is ready for withdrawal. You can view your balance and withdraw funds from your earnings dashboard.
                </p>
                
                <!-- CTA Button -->
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${dashboardUrl}" 
                     style="background: linear-gradient(135deg, #E0FE10 0%, #a8d100 100%); 
                            color: #1a1a1a; 
                            padding: 15px 35px; 
                            text-decoration: none; 
                            border-radius: 8px; 
                            font-weight: bold; 
                            font-size: 16px; 
                            display: inline-block; 
                            box-shadow: 0 4px 15px rgba(224, 254, 16, 0.3);
                            transition: all 0.3s ease;">
                    💰 View Earnings & Withdraw
                  </a>
                </div>
              </div>

              <!-- Instructions -->
              <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h4 style="color: #333; margin: 0 0 15px 0; font-size: 16px;">How to withdraw your winnings:</h4>
                <ol style="color: #555; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
                  <li>Click the button above to go to your earnings dashboard</li>
                  <li>Review your prize money balance</li>
                  <li>Complete your payout information if needed</li>
                  <li>Request a withdrawal to your bank account</li>
                </ol>
              </div>

              <!-- Tax Information -->
              <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                <h4 style="color: #f57c00; margin: 0 0 10px 0; font-size: 16px;">📋 Important Tax Information</h4>
                <p style="color: #555555; margin: 0; font-size: 13px; line-height: 1.6;">
                  <strong>Please note:</strong> Prize winnings and earnings received from Pulse totaling $600 or more in a calendar year may be subject to tax reporting. 
                  At the end of the year, you'll be able to access any required tax documents from your earnings dashboard. 
                  We recommend consulting with a tax professional for guidance on reporting prize winnings.
                </p>
              </div>

              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-top: 30px;">
                Congratulations again on your achievement! Keep up the great work and we look forward to seeing you in future challenges.
              </p>

              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-top: 20px;">
                Best regards,<br>
                The Pulse Team 💪
              </p>
            </div>

            <!-- Footer -->
            <div style="text-align: center; padding: 20px; color: #888888; font-size: 12px;">
              <p style="margin: 0;">This email was sent by Pulse • Challenge ID: ${challengeId}</p>
              <p style="margin: 5px 0 0 0;">If you have questions about your prize, please contact support.</p>
            </div>
          </div>
        `;

        // Prepare Brevo email payload
        const brevoPayload = {
          sender: {
            name: SENDER_NAME,
            email: SENDER_EMAIL,
          },
          to: [
            {
              email: userEmail,
              name: userName,
            },
          ],
          subject: `🏆 You Won $${prizeAmount} in ${challengeTitle}!`,
          htmlContent: htmlContent,
          headers: {
            'X-Challenge-ID': challengeId,
            'X-Prize-Amount': prizeAmount,
            'X-Winner-Rank': winner.rank.toString(),
            'X-Email-Type': 'winner-notification'
          },
          replyTo: {
            email: SENDER_EMAIL,
            name: SENDER_NAME
          }
        };

        console.log('[SendWinnerNotificationEmail] Sending email to winner:', {
          to: userEmail,
          userName,
          prizeAmount: `$${prizeAmount}`,
          rank: winner.rank
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
          console.error(`[SendWinnerNotificationEmail] Brevo API Error for ${userEmail}:`, response.status, errorBody);
          return { success: false, userId: winner.userId, error: errorBody.message };
        }

        const responseData = await response.json();
        console.log(`[SendWinnerNotificationEmail] Email sent successfully to ${userEmail}:`, responseData);
        return { success: true, userId: winner.userId, messageId: responseData.messageId };

      } catch (error) {
        console.error(`[SendWinnerNotificationEmail] Error sending email to ${winner.userId}:`, error);
        return { success: false, userId: winner.userId, error: error.message };
      }
    });

    const emailResults = await Promise.all(emailPromises);
    const successfulEmails = emailResults.filter(result => result.success);
    const failedEmails = emailResults.filter(result => !result.success);

    console.log('[SendWinnerNotificationEmail] Email results:', {
      successful: successfulEmails.length,
      failed: failedEmails.length,
      totalWinners: winners.length
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        emailsSent: successfulEmails.length,
        emailsFailed: failedEmails.length,
        totalWinners: winners.length,
        results: emailResults,
        message: `Winner notification emails sent successfully to ${successfulEmails.length} of ${winners.length} winners`
      })
    };

  } catch (error) {
    console.error('[SendWinnerNotificationEmail] Error:', error);
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

// Helper function to convert numbers to ordinal (1st, 2nd, 3rd, etc.)
function getOrdinalNumber(num) {
  const suffix = ['th', 'st', 'nd', 'rd'];
  const value = num % 100;
  return num + (suffix[(value - 20) % 10] || suffix[value] || suffix[0]);
}

module.exports = { handler };