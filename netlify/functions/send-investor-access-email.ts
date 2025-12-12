import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

const BREVO_API_KEY = process.env.BREVO_MARKETING_KEY;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "tre@fitwithpulse.ai";
const SENDER_NAME = "Tremaine @ Pulse Intelligence Labs";

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  if (!BREVO_API_KEY) {
    console.error("Brevo API key (BREVO_MARKETING_KEY) is not set.");
    return { statusCode: 500, body: JSON.stringify({ message: "Email service configuration error." }) };
  }

  try {
    const { email, name } = JSON.parse(event.body || "{}");

    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ message: "Missing email in request body." }) };
    }

    const recipientName = name || "there";
    const subject = `🔓 You've Been Granted Access to the Pulse Investor Dataroom`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
              margin: 0; 
              padding: 0; 
              background-color: #09090b; 
              color: #ffffff; 
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              background-color: #18181b; 
              border-radius: 16px;
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #18181b 0%, #27272a 100%);
              padding: 40px 30px;
              text-align: center;
              border-bottom: 1px solid #27272a;
            }
            .header h1 {
              color: #E0FE10;
              font-size: 28px;
              font-weight: 700;
              margin: 0 0 8px 0;
              letter-spacing: -0.5px;
            }
            .header p {
              color: #a1a1aa;
              font-size: 14px;
              margin: 0;
            }
            .content {
              padding: 40px 30px;
            }
            .greeting {
              font-size: 18px;
              color: #ffffff;
              margin-bottom: 20px;
            }
            .message {
              font-size: 16px;
              line-height: 1.6;
              color: #d4d4d8;
              margin-bottom: 30px;
            }
            .cta-button {
              display: inline-block;
              background-color: #E0FE10;
              color: #000000 !important;
              text-decoration: none;
              padding: 16px 32px;
              border-radius: 12px;
              font-weight: 600;
              font-size: 16px;
              text-align: center;
              margin: 10px 0 30px 0;
            }
            .cta-button:hover {
              background-color: #d8f521;
            }
            .instructions {
              background-color: #27272a;
              border-radius: 12px;
              padding: 24px;
              margin: 30px 0;
            }
            .instructions-title {
              color: #E0FE10;
              font-size: 14px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin: 0 0 16px 0;
            }
            .step {
              display: flex;
              align-items: flex-start;
              margin-bottom: 16px;
            }
            .step:last-child {
              margin-bottom: 0;
            }
            .step-number {
              background-color: #E0FE10;
              color: #000000;
              width: 24px;
              height: 24px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              font-weight: 700;
              margin-right: 12px;
              flex-shrink: 0;
            }
            .step-text {
              color: #d4d4d8;
              font-size: 14px;
              line-height: 1.5;
            }
            .step-text strong {
              color: #ffffff;
            }
            .divider {
              height: 1px;
              background-color: #27272a;
              margin: 30px 0;
            }
            .footer {
              padding: 30px;
              text-align: center;
              background-color: #09090b;
              border-top: 1px solid #27272a;
            }
            .footer p {
              color: #71717a;
              font-size: 12px;
              margin: 0 0 8px 0;
            }
            .footer a {
              color: #E0FE10;
              text-decoration: none;
            }
            .signature {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #27272a;
            }
            .signature p {
              color: #d4d4d8;
              font-size: 14px;
              margin: 4px 0;
            }
            .signature strong {
              color: #ffffff;
            }
          </style>
        </head>
        <body>
          <div style="padding: 20px; background-color: #09090b;">
            <div class="container">
              <div class="header">
                <h1>Pulse Intelligence Labs</h1>
                <p>Investor Dataroom Access</p>
              </div>
              
              <div class="content">
                <p class="greeting">Hi ${recipientName},</p>
                
                <p class="message">
                  Great news! <strong>Tremaine @ Pulse Intelligence Labs, Inc.</strong> has granted you access to our confidential Investor Dataroom.
                </p>
                
                <p class="message">
                  Inside, you'll find comprehensive information about Pulse — the creator-powered fitness platform turning short workout videos into multiplayer training experiences.
                </p>
                
                <div style="text-align: center;">
                  <a href="https://fitwithpulse.ai/investor" class="cta-button">
                    Access Dataroom →
                  </a>
                </div>
                
                <div class="instructions">
                  <p class="instructions-title">📋 How to Access</p>
                  <div class="step">
                    <div class="step-number">1</div>
                    <div class="step-text">Enter this email address: <strong>${email}</strong></div>
                  </div>
                  <div class="step">
                    <div class="step-number">2</div>
                    <div class="step-text">Click <strong>"Access Dataroom"</strong></div>
                  </div>
                </div>
                
                <p class="message" style="font-size: 14px;">
                  This dataroom contains confidential information intended only for authorized investors. Please do not share access credentials or materials without permission.
                </p>
                
                <div class="signature">
                  <p><strong>Tremaine Grant</strong></p>
                  <p>Founder & CEO</p>
                  <p style="color: #71717a;">Pulse Intelligence Labs, Inc.</p>
                </div>
              </div>
              
              <div class="footer">
                <p>© ${new Date().getFullYear()} Pulse Intelligence Labs, Inc. All rights reserved.</p>
                <p>Questions? Reply to this email or reach out at <a href="mailto:invest@fitwithpulse.ai">invest@fitwithpulse.ai</a></p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const brevoPayload = {
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL,
      },
      to: [
        {
          email: email,
          name: name || email,
        },
      ],
      subject: subject,
      htmlContent: htmlContent,
    };

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
        body: JSON.stringify({ message: "Failed to send email via Brevo.", details: errorBody })
      };
    }
    
    const responseData = await response.json();
    console.log("Investor access email sent successfully via Brevo:", responseData);

    return { statusCode: 200, body: JSON.stringify({ message: "Investor access email sent successfully." }) };

  } catch (error: any) {
    console.error("Error in send-investor-access-email function:", error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        message: "Internal server error while sending email.", 
        details: error.message 
      })
    };
  }
};

export { handler };


