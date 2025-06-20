import type { NextApiRequest, NextApiResponse } from 'next';

interface EmailRecipient {
  email: string;
  name: string;
}

interface SendEmailRequest {
  to: EmailRecipient;
  subject: string;
  htmlContent: string;
  prospectId: string;
}

interface SendEmailResponse {
  success: boolean;
  messageId?: string;
  scheduledFor: string;
}

const BREVO_API_KEY = process.env.BREVO_MARKETING_KEY;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "tre@fitwithpulse.ai";
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "Tremaine Grant";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SendEmailResponse | { error: string; success: boolean }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', success: false });
  }

  try {
    const { to, subject, htmlContent, prospectId } = req.body as SendEmailRequest;

    // Validate input
    if (!to?.email || !to?.name || !subject?.trim() || !htmlContent?.trim()) {
      return res.status(400).json({ error: 'Missing required email fields', success: false });
    }

    if (!BREVO_API_KEY) {
      console.error('Brevo API key (BREVO_MARKETING_KEY) is not set.');
      return res.status(500).json({ error: 'Email service configuration error', success: false });
    }

    // Calculate 5 minutes from now in ISO format for scheduling
    const scheduledTime = new Date(Date.now() + 5 * 60 * 1000);
    const scheduledTimeISO = scheduledTime.toISOString();

    console.log(`📧 Scheduling VC email to ${to.email} for ${scheduledTimeISO}`);

    // Create professional HTML email content with better formatting
    const formattedHtmlContent = `
      <html>
        <head>
          <style>
            body { 
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
              margin: 0; 
              padding: 0; 
              background-color: #f8fafc; 
              color: #334155; 
              line-height: 1.6;
            }
            .container { 
              max-width: 600px; 
              margin: 20px auto; 
              background-color: #ffffff; 
              padding: 40px; 
              border-radius: 8px; 
              border: 1px solid #e2e8f0; 
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); 
            }
            .content {
              font-size: 16px;
              line-height: 1.6;
            }
            .footer { 
              margin-top: 40px; 
              padding-top: 20px;
              border-top: 1px solid #e2e8f0;
              text-align: center; 
              font-size: 12px; 
              color: #64748b; 
            }
            a { 
              color: #3b82f6; 
              text-decoration: none; 
            }
            a:hover {
              text-decoration: underline;
            }
            p { 
              margin-bottom: 16px; 
              color: #334155; 
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="content">
              ${htmlContent}
            </div>
            <div class="footer">
              <p>Sent via Pulse | ${new Date().getFullYear()}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Prepare Brevo API payload for scheduled email
    const brevoPayload = {
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL,
      },
      to: [
        {
          email: to.email,
          name: to.name,
        },
      ],
      subject: subject,
      htmlContent: formattedHtmlContent,
      scheduledAt: scheduledTimeISO, // Schedule for 5 minutes from now
      // Add tracking and analytics
      headers: {
        'X-Prospect-ID': prospectId,
        'X-Email-Type': 'vc-outreach'
      },
      // Enable tracking
      replyTo: {
        email: SENDER_EMAIL,
        name: SENDER_NAME
      }
    };

    console.log('📤 Sending to Brevo API with payload:', {
      to: brevoPayload.to,
      subject: brevoPayload.subject,
      scheduledAt: brevoPayload.scheduledAt,
      prospectId
    });

    // Send to Brevo API
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
      return res.status(response.status).json({ 
        error: `Failed to schedule email via Brevo: ${errorBody.message || 'Unknown error'}`,
        success: false
      });
    }

    const responseData = await response.json();
    console.log("📧 Email scheduled successfully via Brevo:", responseData);

    return res.status(200).json({
      success: true,
      messageId: responseData.messageId,
      scheduledFor: scheduledTimeISO
    });

  } catch (error) {
    console.error("Error in send-vc-email function:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal Server Error',
      success: false
    });
  }
} 