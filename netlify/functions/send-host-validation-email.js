// Function to send host validation email for prize distribution
const { db, headers } = require('./config/firebase');

const BREVO_API_KEY = process.env.BREVO_MARKETING_KEY;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "tre@fitwithpulse.ai";
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "Pulse Team";
const BASE_URL = process.env.NETLIFY_URL || process.env.URL || 'https://fitwithpulse.ai';

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
    const challengeDoc = await db.collection('sweatlist-collection').doc(challengeId).get();
    if (!challengeDoc.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Challenge not found'
        })
      };
    }

    const challengeData = challengeDoc.data();
    const hostUserId = challengeData.ownerId;

    if (!hostUserId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Challenge host not found'
        })
      };
    }

    // Get host user information
    const hostDoc = await db.collection('users').doc(hostUserId).get();
    if (!hostDoc.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Host user not found'
        })
      };
    }

    const hostData = hostDoc.data();
    const hostEmail = hostData.email;
    const hostName = hostData.username || hostData.displayName || 'Challenge Host';

    if (!hostEmail) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Host email not found'
        })
      };
    }

    // Create confirmation URL
    const confirmationUrl = `${BASE_URL}/.netlify/functions/confirm-prize-distribution?prizeId=${prizeAssignmentId}&token=${generateSecureToken(prizeAssignmentId)}`;

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
            Hi <strong>${hostName}</strong>,
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

    // Prepare Brevo email payload
    const brevoPayload = {
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL,
      },
      to: [
        {
          email: hostEmail,
          name: hostName,
        },
      ],
      subject: `🏆 Confirm Prize Distribution - ${challengeTitle}`,
      htmlContent: htmlContent,
      headers: {
        'X-Prize-Assignment-ID': prizeAssignmentId,
        'X-Challenge-ID': challengeId,
        'X-Email-Type': 'host-validation'
      },
      replyTo: {
        email: SENDER_EMAIL,
        name: SENDER_NAME
      }
    };

    console.log('[SendHostValidationEmail] Sending email to host:', {
      to: hostEmail,
      hostName,
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
      console.error("Brevo API Error:", response.status, errorBody);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Failed to send email: ${errorBody.message || 'Unknown error'}`
        })
      };
    }

    const responseData = await response.json();
    console.log('[SendHostValidationEmail] Email sent successfully:', responseData);

    // Update prize assignment with email sent status
    await db.collection('challenge-prizes').doc(prizeAssignmentId).update({
      hostEmailSent: true,
      hostEmailSentAt: new Date(),
      hostEmailMessageId: responseData.messageId,
      confirmationToken: generateSecureToken(prizeAssignmentId),
      confirmationExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      updatedAt: new Date()
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        messageId: responseData.messageId,
        hostEmail: hostEmail,
        hostName: hostName,
        message: 'Host validation email sent successfully'
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
    .update(prizeAssignmentId + Date.now())
    .digest('hex')
    .substring(0, 32);
}

module.exports = { handler }; 