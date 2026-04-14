import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { admin } from "./config/firebase";
import { buildEmailDedupeKey, sendBrevoTransactionalEmail } from './utils/emailSequenceHelpers';

const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "tre@fitwithpulse.ai";
const BASE_URL = process.env.CUSTOM_BASE_URL || "https://fitwithpulse.ai";

// Resolve branding based on which company the document belongs to
function resolveBranding(companyName: string) {
  const isTres = companyName?.toLowerCase().includes('tresproperties') ||
    companyName?.toLowerCase().includes('tres');
  return {
    senderName: isTres ? 'Tremaine Grant' : 'Pulse Intelligence Labs',
    displayCompany: isTres ? 'TresProperties LLC' : 'Pulse Intelligence Labs, Inc.',
    requestedBy: 'Tremaine Grant',
    requestedByCompany: isTres ? 'TresProperties LLC' : 'Pulse Intelligence Labs, Inc.',
    footerCompany: isTres ? 'TresProperties LLC' : 'Pulse Intelligence Labs, Inc.',
    accentColor: isTres ? '#3B82F6' : '#E0FE10',
    accentText: isTres ? '#FFFFFF' : '#000000',
  };
}

const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { documentId, documentName, documentType: _documentType, recipientName, recipientEmail, companyName, previewMode } = JSON.parse(event.body || "{}");

    if (!documentId || !recipientEmail) {
      return { statusCode: 400, body: JSON.stringify({ message: "Missing required fields." }) };
    }

    const branding = resolveBranding(companyName || '');

    const signingUrl = `${BASE_URL}/sign/${documentId}${previewMode ? '?preview=1' : ''}`;
    const subject = previewMode
      ? `🧪 Preview Signature Test: "${documentName}"`
      : `📝 Action Required: Please Sign "${documentName}"`;

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
              color: ${branding.accentColor};
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
              border-left: 4px solid ${branding.accentColor};
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
              background-color: ${branding.accentColor};
              color: ${branding.accentText} !important;
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
              color: ${branding.accentColor};
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          <div style="padding: 20px; background-color: #09090b;">
            <div class="container">
              <div class="header">
                <h1>${branding.displayCompany}</h1>
                <p>Document Signing Request</p>
              </div>
              
              <div class="content">
                <p class="greeting">Hi ${recipientName},</p>
                
                <p class="message">
                  ${previewMode
                    ? `<strong>${branding.requestedBy}</strong> from ${branding.requestedByCompany} sent you a preview signing test for the following document:`
                    : `<strong>${branding.requestedBy}</strong> from ${branding.requestedByCompany} has requested your signature on the following document:`}
                </p>
                
                <div class="document-box">
                  <p class="document-label">Document</p>
                  <p class="document-name">${documentName}</p>
                </div>
                
                <p class="message">
                  ${previewMode
                    ? 'This is a sandbox preview of the signing flow. You can click through, sign, and test the full experience without affecting the live document packet.'
                    : 'Please use the secure link below to review, download, and sign this document. The signing process takes less than a minute.'}
                </p>
                
                <div style="text-align: center;">
                  <a href="${signingUrl}" class="cta-button">
                    ${previewMode ? 'Open Preview Signing Flow →' : 'Review & Sign Document →'}
                  </a>
                </div>
                
                <p class="message" style="font-size: 14px; color: #71717a;">
                  ${previewMode
                    ? 'This preview email is for testing only. It uses a sandbox signing request and will not update the actual live document status.'
                    : 'This is a secure, legally-binding electronic signature request. Your signature will be recorded along with timestamp and verification details for compliance purposes.'}
                </p>
              </div>
              
              <div class="footer">
                <p>© ${new Date().getFullYear()} ${branding.footerCompany}. All rights reserved.</p>
                <p>Questions? Reply to this email or reach out at <a href="mailto:tre@fitwithpulse.ai">tre@fitwithpulse.ai</a></p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const sendResult = await sendBrevoTransactionalEmail({
      toEmail: recipientEmail,
      toName: recipientName || recipientEmail,
      subject,
      htmlContent,
      sender: {
        name: branding.senderName,
        email: SENDER_EMAIL,
      },
      idempotencyKey: buildEmailDedupeKey(['signing-request-v1', documentId, recipientEmail]),
      idempotencyMetadata: {
        sequence: 'signing-request',
        documentId,
        recipientEmail,
      },
      bypassDailyRecipientLimit: true,
      dailyRecipientMetadata: {
        sequence: 'signing-request',
        documentId,
      },
    });

    if (!sendResult.success) {
      console.error("Brevo API Error:", sendResult.error);
      return {
        statusCode: 502,
        body: JSON.stringify({ message: "Failed to send email via Brevo.", details: sendResult.error })
      };
    }

    // Update the signing request status in Firestore
    try {
      const db = admin.firestore();
      await db.collection("signingRequests").doc(documentId).update({
        status: "sent",
        sentAt: new Date(),
      });
    } catch (dbError) {
      console.error("Failed to update Firestore:", dbError);
      // Don't fail the request if Firestore update fails
    }

    console.log("Signing request email sent successfully:", sendResult.messageId);

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
