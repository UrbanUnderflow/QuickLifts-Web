const { db, headers } = require('./config/firebase');

const BREVO_API_KEY = process.env.BREVO_MARKETING_KEY;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "tre@fitwithpulse.ai";
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "Pulse Security";

// Check if we should send email based on rate limiting (10 minutes per IP)
const shouldSendEmail = async (ip, type) => {
  if (!ip) {
    console.log('No IP address provided, allowing email');
    return true;
  }

  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    // Query for recent email notifications from this IP
    const recentEmailsQuery = await db.collection('secureAccessLogs')
      .where('ip', '==', ip)
      .where('emailSent', '==', true)
      .where('serverTimestamp', '>', tenMinutesAgo)
      .limit(1)
      .get();

    if (!recentEmailsQuery.empty) {
      const recentLog = recentEmailsQuery.docs[0].data();
      console.log(`Rate limiting: Email already sent for IP ${ip} within last 10 minutes at ${recentLog.serverTimestamp?.toDate()}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking email rate limit:', error);
    // If we can't check, err on the side of caution and allow the email
    return true;
  }
};

// Send email notification using Brevo (matching your existing pattern)
const sendEmailNotification = async (logData) => {
  try {
    if (!BREVO_API_KEY) {
      console.error('Brevo API key (BREVO_MARKETING_KEY) is not set.');
      return { success: false, error: 'Brevo API key not configured' };
    }

    // Check rate limiting
    const shouldSend = await shouldSendEmail(logData.ip, logData.type);
    if (!shouldSend) {
      console.log(`Rate limiting: Skipping email for IP ${logData.ip} - already sent within last 10 minutes`);
      return { 
        success: true, 
        message: 'Email skipped due to rate limiting (10 minute cooldown per IP)',
        rateLimited: true 
      };
    }

    const getAlertColor = (type) => {
      switch (type) {
        case 'successful_access': return { bg: '#065f46', text: '#10b981' };
        case 'failed_attempt': return { bg: '#7f1d1d', text: '#ef4444' };
        case 'lockout': return { bg: '#92400e', text: '#f59e0b' };
        default: return { bg: '#374151', text: '#9ca3af' };
      }
    };

    const alertColor = getAlertColor(logData.type);
    const isSuccess = logData.type === 'successful_access';

    const brevoPayload = {
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL
      },
      to: [{
        email: 'tremaine.grant@gmail.com',
        name: 'Tremaine Grant'
      }],
      subject: `🚨 Secure Page Access Alert - ${logData.type.replace('_', ' ').toUpperCase()}`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a1a1a; color: white; padding: 20px; border-radius: 8px;">
            <h2 style="color: ${alertColor.text}; margin-top: 0;">
              🔒 Secure Page Access Alert
            </h2>
            
            <div style="background: #2a2a2a; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <h3 style="margin-top: 0; color: #e5e5e5;">Access Details</h3>
              <table style="width: 100%; color: #d1d5db;">
                <tr>
                  <td style="padding: 5px 0; font-weight: bold;">Type:</td>
                  <td style="padding: 5px 0;">
                    <span style="background: ${alertColor.bg}; 
                                 color: ${alertColor.text}; 
                                 padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                      ${logData.type.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; font-weight: bold;">Timestamp:</td>
                  <td style="padding: 5px 0;">${new Date(logData.timestamp).toLocaleString()}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; font-weight: bold;">IP Address:</td>
                  <td style="padding: 5px 0; font-family: monospace;">${logData.ip || 'Unknown'}</td>
                </tr>
                ${logData.location ? `
                <tr>
                  <td style="padding: 5px 0; font-weight: bold;">Location:</td>
                  <td style="padding: 5px 0;">
                    ${logData.location.city && logData.location.country 
                      ? `${logData.location.city}, ${logData.location.country}`
                      : `${logData.location.latitude.toFixed(4)}, ${logData.location.longitude.toFixed(4)}`
                    }
                  </td>
                </tr>
                ` : ''}
                ${logData.attempts ? `
                <tr>
                  <td style="padding: 5px 0; font-weight: bold;">Attempts:</td>
                  <td style="padding: 5px 0;">${logData.attempts}/3</td>
                </tr>
                ` : ''}
              </table>
            </div>
            
            <div style="background: #2a2a2a; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <h4 style="margin-top: 0; color: #e5e5e5;">User Agent</h4>
              <p style="font-family: monospace; font-size: 12px; color: #9ca3af; word-break: break-all; margin: 0;">
                ${logData.userAgent}
              </p>
            </div>
            
            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #374151; font-size: 12px; color: #9ca3af;">
              This is an automated security alert from the Pulse secure page monitoring system.
            </div>
          </div>
        </div>
      `
    };

    // Send email via Brevo API (matching your existing pattern)
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
      console.error('Brevo API Error for secure access alert:', response.status, errorBody);
      return { success: false, error: errorBody.message || 'Brevo API error' };
    }

    const responseData = await response.json();
    console.log(`✅ Secure access alert email sent successfully via Brevo for IP ${logData.ip}:`, responseData);
    
    return { 
      success: true, 
      message: 'Email notification sent via Brevo',
      messageId: responseData.messageId,
      rateLimited: false
    };

  } catch (error) {
    console.error('Failed to send email notification via Brevo:', error);
    return { success: false, error: error.message };
  }
};

exports.handler = async (event, context) => {
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

    const logData = JSON.parse(event.body);
    console.log('🔒 Secure access log received:', logData);

    // Validate required fields
    if (!logData.timestamp || !logData.type) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: timestamp and type are required' 
        })
      };
    }

    // Send email notification for all access types (check rate limiting first)
    const emailResult = await sendEmailNotification(logData);

    // Store in Firestore with email status
    let firestoreResult = { success: false };
    try {
      const docRef = await db.collection('secureAccessLogs').add({
        ...logData,
        serverTimestamp: db.FieldValue.serverTimestamp(),
        createdAt: new Date(logData.timestamp),
        emailSent: emailResult.success && !emailResult.rateLimited,
        emailRateLimited: emailResult.rateLimited || false,
        emailError: emailResult.success ? null : emailResult.error
      });
      
      console.log('✅ Stored in Firestore with ID:', docRef.id);
      firestoreResult = { success: true, id: docRef.id };
    } catch (firestoreError) {
      console.error('❌ Firestore error:', firestoreError);
      firestoreResult = { success: false, error: firestoreError.message };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Access logged successfully',
        firestore: firestoreResult,
        email: emailResult,
        logId: firestoreResult.id || null,
        rateLimitInfo: emailResult.rateLimited ? 
          'Email notification skipped due to rate limiting (10 minute cooldown per IP)' : 
          'Email notification processed normally'
      })
    };

  } catch (error) {
    console.error('❌ Error processing secure access log:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
