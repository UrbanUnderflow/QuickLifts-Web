import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const BREVO_API_KEY = process.env.BREVO_MARKETING_KEY;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "tre@fitwithpulse.ai";
const SENDER_NAME = "Pulse Intelligence Labs";
const BASE_URL = process.env.URL || "https://fitwithpulse.ai";

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    initializeApp({
      credential: cert(serviceAccount),
    });
  } catch (error) {
    console.error("Failed to initialize Firebase Admin:", error);
  }
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  if (!BREVO_API_KEY) {
    console.error("Brevo API key (BREVO_MARKETING_KEY) is not set.");
    return { statusCode: 500, body: JSON.stringify({ message: "Email service configuration error." }) };
  }

  try {
    const { documentId, documentName, documentType, recipientName, recipientEmail } = JSON.parse(event.body || "{}");

    if (!documentId || !recipientEmail) {
      return { statusCode: 400, body: JSON.stringify({ message: "Missing required fields." }) };
    }

    const signingUrl = `${BASE_URL}/sign/${documentId}`;
    const subject = `📝 Action Required: Please Sign "${documentName}"`;

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
            .document-box {
              background-color: #27272a;
              border-radius: 12px;
              padding: 20px;
              margin: 20px 0;
              border-left: 4px solid #E0FE10;
            }
            .document-label {
              color: #a1a1aa;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 8px;
            }
            .document-name {
              color: #ffffff;
              font-size: 18px;
              font-weight: 600;
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
          </style>
        </head>
        <body>
          <div style="padding: 20px; background-color: #09090b;">
            <div class="container">
              <div class="header">
                <h1>Pulse Intelligence Labs</h1>
                <p>Document Signing Request</p>
              </div>
              
              <div class="content">
                <p class="greeting">Hi ${recipientName},</p>
                
                <p class="message">
                  <strong>Tremaine Grant</strong> from Pulse Intelligence Labs, Inc. has requested your signature on the following document:
                </p>
                
                <div class="document-box">
                  <p class="document-label">Document</p>
                  <p class="document-name">${documentName}</p>
                </div>
                
                <p class="message">
                  Please review and sign this document at your earliest convenience. The signing process takes less than a minute.
                </p>
                
                <div style="text-align: center;">
                  <a href="${signingUrl}" class="cta-button">
                    Review & Sign Document →
                  </a>
                </div>
                
                <p class="message" style="font-size: 14px; color: #71717a;">
                  This is a secure, legally-binding electronic signature request. Your signature will be recorded along with timestamp and verification details for compliance purposes.
                </p>
              </div>
              
              <div class="footer">
                <p>© ${new Date().getFullYear()} Pulse Intelligence Labs, Inc. All rights reserved.</p>
                <p>Questions? Reply to this email or reach out at <a href="mailto:tre@fitwithpulse.ai">tre@fitwithpulse.ai</a></p>
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
          email: recipientEmail,
          name: recipientName || recipientEmail,
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

    // Update the signing request status in Firestore
    try {
      const db = getFirestore();
      await db.collection("signingRequests").doc(documentId).update({
        status: "sent",
        sentAt: new Date(),
      });
    } catch (dbError) {
      console.error("Failed to update Firestore:", dbError);
      // Don't fail the request if Firestore update fails
    }
    
    const responseData = await response.json();
    console.log("Signing request email sent successfully:", responseData);

    return { statusCode: 200, body: JSON.stringify({ message: "Signing request sent successfully." }) };

  } catch (error: any) {
    console.error("Error in send-signing-request function:", error);
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
