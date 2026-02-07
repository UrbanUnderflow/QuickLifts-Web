import type { Handler } from '@netlify/functions';
import { getFirestore } from './utils/getServiceAccount';
import * as admin from 'firebase-admin';

type SendResponse = {
    success: boolean;
    skipped?: boolean;
    messageId?: string;
    error?: string;
    resetLink?: string;
};

type RequestBody = {
    toEmail: string;
    firstName?: string;
    isTest?: boolean;
    subjectOverride?: string;
    htmlOverride?: string;
};

function escapeHtml(input: string) {
    if (!input) return '';
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderPasswordResetEmail(opts: { firstName?: string; resetLink: string }) {
    const name = (opts.firstName || '').trim();
    const greetingName = name ? name : 'there';
    const resetLink = opts.resetLink;

    const subject = 'Reset your Pulse password';

    const html = `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(subject)}</title>
    </head>
    <body style="margin:0;padding:0;background:#0a0a0b;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
        Reset your Pulse password to get back to your fitness journey.
      </div>

      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0a0a0b;padding:24px 0;">
        <tr>
          <td align="center" style="padding: 0 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;">
              <tr>
                <td align="center" style="padding: 6px 8px 18px 8px;">
                  <!-- Pulse Logo -->
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" valign="middle">
                        <img src="https://fitwithpulse.ai/PulseProgrammingLogoWhite.png" alt="Pulse" width="140" height="auto" style="display:block;width:140px;height:auto;" />
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="border:1px solid rgba(255,255,255,0.08);background:rgba(24,24,27,0.95);border-radius:20px;overflow:hidden;">
                  <div style="height:2px;background:linear-gradient(90deg, transparent, rgba(224,254,16,0.7), transparent);"></div>
                  
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:32px 22px;">
                    <tr>
                      <td align="center">
                        <!-- Lock Icon -->
                        <table role="presentation" cellpadding="0" cellspacing="0" width="64" height="64" style="width:64px;height:64px;border-radius:50%;background:rgba(224,254,16,0.15);margin-bottom:20px;">
                          <tr>
                            <td align="center" valign="middle" style="font-size:28px;">
                              🔐
                            </td>
                          </tr>
                        </table>
                        
                        <!-- Greeting -->
                        <h1 style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:24px;line-height:1.2;color:#E0FE10;font-weight:900;">
                          Reset Your Password
                        </h1>
                        
                        <p style="margin:0 0 24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:16px;line-height:1.6;color:#A1A1AA;">
                          Hey ${escapeHtml(greetingName)}, no worries — it happens to the best of us.
                        </p>
                        
                        <!-- Message -->
                        <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:#E4E4E7;">
                          Click the button below to reset your password.
                        </p>
                        <p style="margin:0 0 28px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:13px;line-height:1.6;color:#71717A;">
                          This link expires in 1 hour for your security.
                        </p>
                        
                        <!-- CTA Button -->
                        <a href="${resetLink}" style="display:inline-block;background:#E0FE10;color:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-weight:900;font-size:14px;text-decoration:none;padding:14px 32px;border-radius:12px;">
                          RESET PASSWORD
                        </a>
                        
                        <p style="margin:24px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:12px;line-height:1.6;color:#52525B;">
                          If you didn't request this, you can safely ignore this email.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td align="center" style="padding:24px 22px 0 22px;">
                  <p style="margin:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:13px;color:#71717A;">
                    Follow Pulse
                  </p>
                  <!-- Social Links as Text -->
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:12px;">
                        <a href="https://instagram.com/fitwithpulse" style="color:#A1A1AA;text-decoration:none;padding:0 8px;">Instagram</a>
                        <span style="color:#52525B;">•</span>
                        <a href="https://youtube.com/@fitwithpulse" style="color:#A1A1AA;text-decoration:none;padding:0 8px;">YouTube</a>
                        <span style="color:#52525B;">•</span>
                        <a href="https://tiktok.com/@fitwithpulse" style="color:#A1A1AA;text-decoration:none;padding:0 8px;">TikTok</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td align="center" style="padding:24px 8px 0 8px;">
                  <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:11px;line-height:1.6;color:#52525B;">
                    © ${new Date().getFullYear()} Pulse Intelligence Labs, Inc.
                  </p>
                  <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:11px;line-height:1.6;color:#52525B;">
                    You received this email because a password reset was requested for your <a href="https://fitwithpulse.ai" style="color:#71717A;text-decoration:underline;">Pulse</a> account.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;

    return { subject, html };
}

async function getPasswordResetTemplateFromFirestore(): Promise<{ subject: string; html: string } | null> {
    try {
        const db = await getFirestore();
        const snap = await db.collection('email-templates').doc('password-reset-v1').get();
        if (!snap.exists) return null;
        const data = snap.data() || {};
        const subject = typeof data.subject === 'string' ? data.subject : '';
        const html = typeof data.html === 'string' ? data.html : '';
        if (!subject || !html) return null;
        return { subject, html };
    } catch (e) {
        console.warn('[send-password-reset-email] Failed to load template from Firestore:', e);
        return null;
    }
}

function applyTemplateVars(
    input: string,
    vars: { firstName?: string; resetLink?: string }
) {
    const firstName = (vars.firstName || '').trim() || 'there';
    const resetLink = vars.resetLink || '#';
    return input
        .replace(/\{\{first_name\}\}/g, escapeHtml(firstName))
        .replace(/\{\{firstName\}\}/g, escapeHtml(firstName))
        .replace(/\{\{reset_link\}\}/g, resetLink)
        .replace(/\{\{resetLink\}\}/g, resetLink);
}

async function sendMailgunEmail(
    to: string,
    subject: string,
    html: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const apiKey = process.env.MAILGUN_API_KEY || '';
    const domain = process.env.MAILGUN_DOMAIN || '';
    const fromEmail = process.env.MAILGUN_FROM_EMAIL || 'Pulse <noreply@fitwithpulse.ai>';

    if (!apiKey || !domain) {
        console.error('[sendMailgunEmail] Missing Mailgun credentials');
        return { success: false, error: 'Missing Mailgun credentials' };
    }

    const formData = new URLSearchParams();
    formData.append('from', fromEmail);
    formData.append('to', to);
    formData.append('subject', subject);
    formData.append('html', html);

    const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[sendMailgunEmail] Mailgun error:', errorText);
        return { success: false, error: errorText };
    }

    const json = await response.json();
    return { success: true, messageId: json.id };
}

async function generatePasswordResetLink(email: string): Promise<string> {
    try {
        // Use Firebase Admin SDK to generate password reset link
        const auth = admin.auth();
        const actionCodeSettings = {
            url: 'https://fitwithpulse.ai/login?resetComplete=true',
            handleCodeInApp: false,
        };

        const resetLink = await auth.generatePasswordResetLink(email, actionCodeSettings);
        return resetLink;
    } catch (error) {
        console.error('[generatePasswordResetLink] Error:', error);
        throw error;
    }
}

export const handler: Handler = async (event) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Method not allowed' }),
        };
    }

    let body: RequestBody;
    try {
        body = JSON.parse(event.body || '{}');
    } catch {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Invalid JSON body' }),
        };
    }

    const { toEmail, firstName, isTest, subjectOverride, htmlOverride } = body;

    if (!toEmail) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'Missing required field: toEmail' }),
        };
    }

    try {
        // Generate the password reset link using Firebase Admin
        let resetLink = 'https://fitwithpulse.ai/login'; // Fallback for test emails

        if (!isTest) {
            try {
                resetLink = await generatePasswordResetLink(toEmail);
                console.log('[send-password-reset-email] Generated reset link for:', toEmail);
            } catch (linkError: any) {
                // If user doesn't exist, still return success but don't send email
                if (linkError.code === 'auth/user-not-found') {
                    console.log('[send-password-reset-email] User not found:', toEmail);
                    return {
                        statusCode: 200,
                        headers: corsHeaders,
                        body: JSON.stringify({
                            success: true,
                            skipped: true,
                            message: 'If an account exists, a reset email has been sent.'
                        }),
                    };
                }
                throw linkError;
            }
        }

        // Use template override if provided (from admin test), else check Firestore, else use default
        let subject: string;
        let html: string;

        if (subjectOverride && htmlOverride) {
            subject = applyTemplateVars(subjectOverride, { firstName, resetLink });
            html = applyTemplateVars(htmlOverride, { firstName, resetLink });
        } else {
            const firestoreTemplate = await getPasswordResetTemplateFromFirestore();
            if (firestoreTemplate) {
                subject = applyTemplateVars(firestoreTemplate.subject, { firstName, resetLink });
                html = applyTemplateVars(firestoreTemplate.html, { firstName, resetLink });
            } else {
                const defaultEmail = renderPasswordResetEmail({ firstName, resetLink });
                subject = defaultEmail.subject;
                html = defaultEmail.html;
            }
        }

        // Send via Mailgun
        const result = await sendMailgunEmail(toEmail, subject, html);

        if (!result.success) {
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({ success: false, error: result.error }),
            };
        }

        console.log('[send-password-reset-email] Sent to:', toEmail, 'messageId:', result.messageId);

        const response: SendResponse = {
            success: true,
            messageId: result.messageId,
        };

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(response),
        };
    } catch (error: any) {
        console.error('[send-password-reset-email] Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: error.message || 'Internal error' }),
        };
    }
};
