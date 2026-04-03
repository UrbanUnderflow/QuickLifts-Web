import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { buildEmailDedupeKey, sendBrevoTransactionalEmail } from './utils/emailSequenceHelpers';

const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "tre@fitwithpulse.ai";
const SENDER_NAME = "Pulse Intelligence Labs";
const ADMIN_EMAIL = "tre@fitwithpulse.ai";
const BASE_URL = process.env.CUSTOM_BASE_URL || "https://fitwithpulse.ai";

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { documentId, documentName, recipientName, recipientEmail, signedAt, typedName, companyName, previewMode } = JSON.parse(event.body || "{}");

    if (!documentId || !recipientEmail) {
      return { statusCode: 400, body: JSON.stringify({ message: "Missing required fields." }) };
    }

    const viewUrl = `${BASE_URL}/sign/${documentId}?download=true${previewMode ? '&preview=1' : ''}`;
    const adminUrl = `${BASE_URL}/admin/documentSigning`;
    const formattedDate = new Date(signedAt).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    // Email to Admin (Tremaine)
    const adminSubject = previewMode
      ? `🧪 Preview Signed: "${documentName}" by ${recipientName}`
      : `✅ Document Signed: "${documentName}" by ${recipientName}`;
    const adminHtmlContent = `
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
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              padding: 40px 30px;
              text-align: center;
            }
            .header h1 {
              color: #ffffff;
              font-size: 24px;
              font-weight: 700;
              margin: 0 0 8px 0;
            }
            .header p {
              color: rgba(255,255,255,0.8);
              font-size: 14px;
              margin: 0;
            }
            .content {
              padding: 40px 30px;
            }
            .success-icon {
              width: 60px;
              height: 60px;
              background: #10b981;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 20px;
              font-size: 30px;
            }
            .details-box {
              background-color: #27272a;
              border-radius: 12px;
              padding: 20px;
              margin: 20px 0;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              border-bottom: 1px solid #3f3f46;
            }
            .detail-row:last-child {
              border-bottom: none;
            }
            .detail-label {
              color: #a1a1aa;
              font-size: 14px;
            }
            .detail-value {
              color: #ffffff;
              font-size: 14px;
              font-weight: 500;
            }
            .cta-button {
              display: inline-block;
              background-color: #E0FE10;
              color: #000000 !important;
              text-decoration: none;
              padding: 14px 28px;
              border-radius: 12px;
              font-weight: 600;
              font-size: 14px;
              text-align: center;
              margin: 5px;
            }
            .secondary-button {
              display: inline-block;
              background-color: #27272a;
              color: #ffffff !important;
              text-decoration: none;
              padding: 14px 28px;
              border-radius: 12px;
              font-weight: 600;
              font-size: 14px;
              text-align: center;
              margin: 5px;
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
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div style="padding: 20px; background-color: #09090b;">
            <div class="container">
              <div class="header">
                <h1>${previewMode ? '🧪 Preview Signed' : '✓ Document Signed'}</h1>
                <p>${previewMode ? 'A preview signing flow has been completed' : 'A document has been signed successfully'}</p>
              </div>
              
              <div class="content">
                <div class="details-box">
                  <div class="detail-row">
                    <span class="detail-label">Document</span>
                    <span class="detail-value">${documentName}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Signer</span>
                    <span class="detail-value">${recipientName}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Email</span>
                    <span class="detail-value">${recipientEmail}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Signature</span>
                    <span class="detail-value" style="font-style: italic;">${typedName}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Signed At</span>
                    <span class="detail-value">${formattedDate}</span>
                  </div>
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${viewUrl}" class="cta-button">
                    ${previewMode ? 'Download Preview Signed Document' : 'Download Signed Document'}
                  </a>
                  <a href="${adminUrl}" class="secondary-button">
                    View All Documents
                  </a>
                </div>
              </div>
              
              <div class="footer">
                <p>Pulse Intelligence Labs, Inc. • Document Signing System</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Email to Signer (Confirmation)
    const signerSubject = previewMode
      ? `🧪 Preview Complete: "${documentName}"`
      : `✅ You've Signed: "${documentName}"`;
    const signerHtmlContent = `
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
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              padding: 40px 30px;
              text-align: center;
            }
            .header h1 {
              color: #ffffff;
              font-size: 24px;
              font-weight: 700;
              margin: 0 0 8px 0;
            }
            .content {
              padding: 40px 30px;
            }
            .message {
              font-size: 16px;
              line-height: 1.6;
              color: #d4d4d8;
              margin-bottom: 20px;
            }
            .details-box {
              background-color: #27272a;
              border-radius: 12px;
              padding: 20px;
              margin: 20px 0;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              border-bottom: 1px solid #3f3f46;
            }
            .detail-row:last-child {
              border-bottom: none;
            }
            .detail-label {
              color: #a1a1aa;
              font-size: 14px;
            }
            .detail-value {
              color: #ffffff;
              font-size: 14px;
              font-weight: 500;
            }
            .cta-button {
              display: inline-block;
              background-color: #E0FE10;
              color: #000000 !important;
              text-decoration: none;
              padding: 14px 28px;
              border-radius: 12px;
              font-weight: 600;
              font-size: 14px;
              text-align: center;
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
          </style>
        </head>
        <body>
          <div style="padding: 20px; background-color: #09090b;">
            <div class="container">
              <div class="header">
                <h1>${previewMode ? '🧪 Preview Signed Successfully' : '✓ Document Signed Successfully'}</h1>
              </div>
              
              <div class="content">
                <p class="message">
                  Hi ${recipientName},
                </p>
                <p class="message">
                  ${previewMode
                    ? 'You completed the preview signing flow successfully. This email confirms the sandbox signature was recorded for testing.'
                    : 'Thank you for signing the document. This email confirms that your signature has been recorded successfully.'}
                </p>
                
                <div class="details-box">
                  <div class="detail-row">
                    <span class="detail-label">Document</span>
                    <span class="detail-value">${documentName}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Your Signature</span>
                    <span class="detail-value" style="font-style: italic;">${typedName}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Signed At</span>
                    <span class="detail-value">${formattedDate}</span>
                  </div>
                </div>
                
                <p class="message" style="font-size: 14px;">
                  ${previewMode
                    ? 'This was a preview-only signing test. You can still download the preview signed version below.'
                    : 'Please keep this email for your records. You can download a copy of the signed document using the button below.'}
                </p>
                
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${viewUrl}" class="cta-button">
                    ${previewMode ? 'Download Preview Signed Document' : 'Download Signed Document'}
                  </a>
                </div>
              </div>
              
              <div class="footer">
                <p>© ${new Date().getFullYear()} Pulse Intelligence Labs, Inc. All rights reserved.</p>
                <p>This is an automated confirmation email.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email to Admin
    const adminSendResult = await sendBrevoTransactionalEmail({
      toEmail: ADMIN_EMAIL,
      toName: "Tremaine Grant",
      subject: adminSubject,
      htmlContent: adminHtmlContent,
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      idempotencyKey: buildEmailDedupeKey(['signed-confirmation-admin-v1', documentId, recipientEmail]),
      idempotencyMetadata: {
        sequence: 'signed-confirmation-admin',
        documentId,
        recipientEmail,
      },
      bypassDailyRecipientLimit: true,
      dailyRecipientMetadata: {
        sequence: 'signed-confirmation-admin',
        documentId,
      },
    });

    if (!adminSendResult.success) {
      console.error("Failed to send admin notification:", adminSendResult.error);
    }

    // Send confirmation email to Signer
    const signerSendResult = await sendBrevoTransactionalEmail({
      toEmail: recipientEmail,
      toName: recipientName,
      subject: signerSubject,
      htmlContent: signerHtmlContent,
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      idempotencyKey: buildEmailDedupeKey(['signed-confirmation-signer-v1', documentId, recipientEmail]),
      idempotencyMetadata: {
        sequence: 'signed-confirmation-signer',
        documentId,
        recipientEmail,
      },
      bypassDailyRecipientLimit: true,
      dailyRecipientMetadata: {
        sequence: 'signed-confirmation-signer',
        documentId,
      },
    });

    if (!signerSendResult.success) {
      console.error("Failed to send signer confirmation:", signerSendResult.error);
    }

    // --- NEW LOGIC: Fully Executed Email for Multiple Signers ---
    const { isFullyExecuted, allSigners } = JSON.parse(event.body || "{}");

    if (!previewMode && isFullyExecuted && allSigners && allSigners.length > 1) {
      console.log(`Document [${documentId}] is fully executed. Notifying all ${allSigners.length} signers.`);

      const executedSubject = `📜 FULLY EXECUTED: "${documentName}"`;
      const executedHtmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #09090b; color: #ffffff; }
              .container { max-width: 600px; margin: 0 auto; background-color: #18181b; border-radius: 16px; overflow: hidden; }
              .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 40px 30px; text-align: center; }
              .header h1 { color: #ffffff; font-size: 24px; font-weight: 700; margin: 0 0 8px 0; }
              .content { padding: 40px 30px; }
              .message { font-size: 16px; line-height: 1.6; color: #d4d4d8; margin-bottom: 20px; text-align: center; }
              .cta-button { display: inline-block; background-color: #3b82f6; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 600; font-size: 14px; text-align: center; }
              .footer { padding: 30px; text-align: center; background-color: #09090b; border-top: 1px solid #27272a; }
              .footer p { color: #71717a; font-size: 12px; margin: 0 0 8px 0; }
            </style>
          </head>
          <body>
            <div style="padding: 20px; background-color: #09090b;">
              <div class="container">
                <div class="header">
                  <h1>📜 Fully Executed Document</h1>
                </div>
                <div class="content">
                  <p class="message">
                    Great news! All parties have signed the document <strong>"${documentName}"</strong>.
                  </p>
                  <p class="message">
                    The document is now fully executed and binding. You can view and download the completed version below.
                  </p>
                  <div style="text-align: center; margin-top: 30px;">
                    <a href="${viewUrl}" class="cta-button">Download Fully Executed Document</a>
                  </div>
                </div>
                <div class="footer">
                  <p>© ${new Date().getFullYear()} Pulse Intelligence Labs, Inc. All rights reserved.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;

      // Filter out invalid emails just in case
      let recipients = allSigners.filter((s: any) => s && s.email && s.name);

      // Also add the admin to the executed email CC/To so they know it is done
      recipients.push({ name: "Tremaine Grant", email: ADMIN_EMAIL });

      if (recipients.length > 0) {
        const results = await Promise.all(
          recipients.map((recipient: any) =>
            sendBrevoTransactionalEmail({
              toEmail: recipient.email,
              toName: recipient.name,
              subject: executedSubject,
              htmlContent: executedHtmlContent,
              sender: { name: SENDER_NAME, email: SENDER_EMAIL },
              idempotencyKey: buildEmailDedupeKey(['signed-confirmation-executed-v1', documentId, recipient.email]),
              idempotencyMetadata: {
                sequence: 'signed-confirmation-executed',
                documentId,
                recipientEmail: recipient.email,
              },
              bypassDailyRecipientLimit: true,
              dailyRecipientMetadata: {
                sequence: 'signed-confirmation-executed',
                documentId,
              },
            })
          )
        );

        const failures = results.filter((result) => !result.success);
        if (failures.length > 0) {
          console.error("Failed to send fully executed confirmation:", failures.map((result) => result.error));
        } else {
          console.log("Fully executed notification sent to:", recipients.map((r: any) => r.email));
        }
      }
    }

    console.log("Signed confirmation emails sent successfully");

    return { statusCode: 200, body: JSON.stringify({ message: "Confirmation emails sent successfully." }) };

  } catch (error: any) {
    console.error("Error in send-signed-confirmation function:", error);
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


