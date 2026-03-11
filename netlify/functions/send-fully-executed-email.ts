import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

const BREVO_API_KEY = process.env.BREVO_MARKETING_KEY;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "tre@fitwithpulse.ai";
const SENDER_NAME = "Pulse Intelligence Labs";
const ADMIN_EMAIL = "tre@fitwithpulse.ai";
const BASE_URL = process.env.CUSTOM_BASE_URL || "https://fitwithpulse.ai";

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    if (!BREVO_API_KEY) {
        console.error("Brevo API key (BREVO_MARKETING_KEY) is not set.");
        return { statusCode: 500, body: JSON.stringify({ message: "Email service configuration error." }) };
    }

    try {
        const { documentId, documentName, allSigners } = JSON.parse(event.body || "{}");

        if (!documentId || !documentName || !allSigners || allSigners.length === 0) {
            return { statusCode: 400, body: JSON.stringify({ message: "Missing required fields." }) };
        }

        const viewUrl = `${BASE_URL}/sign/${documentId}?download=true`;

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
            const executedResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "api-key": BREVO_API_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    sender: { name: SENDER_NAME, email: SENDER_EMAIL },
                    to: recipients,
                    subject: executedSubject,
                    htmlContent: executedHtmlContent,
                }),
            });

            if (!executedResponse.ok) {
                console.error("Failed to send fully executed confirmation:", await executedResponse.json());
                return { statusCode: 500, body: JSON.stringify({ message: "Failed to send to Brevo API." }) };
            }
        }

        return { statusCode: 200, body: JSON.stringify({ message: "Fully executed email sent successfully." }) };

    } catch (error: any) {
        console.error("Error in send-fully-executed-email function:", error);
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
