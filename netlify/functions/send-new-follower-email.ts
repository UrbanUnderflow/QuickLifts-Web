import type { Handler } from '@netlify/functions';
import { getFirestore } from './utils/getServiceAccount';

type SendResponse = {
  success: boolean;
  skipped?: boolean;
  messageId?: string;
  error?: string;
};

type RequestBody = {
  userId?: string;
  toEmail: string;
  firstName?: string;
  followerName?: string;
  followerUsername?: string;
  followerProfileImageUrl?: string;
  followerLocation?: string;
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

function renderNewFollowerEmail(opts: {
  firstName?: string;
  followerName?: string;
  followerUsername?: string;
  followerProfileImageUrl?: string;
  followerLocation?: string;
}) {
  const followerName = (opts.followerName || 'Someone').trim();
  const followerUsername = (opts.followerUsername || '').trim();
  const followerLocation = (opts.followerLocation || '').trim();
  const followerProfileImageUrl = (opts.followerProfileImageUrl || '').trim();

  // Generate initials for avatar fallback
  const initials = followerName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const subject = `${followerName} is now following you on Pulse`;

  const viewProfileUrl = followerUsername
    ? `https://fitwithpulse.ai/@${encodeURIComponent(followerUsername)}`
    : 'https://fitwithpulse.ai/profile';

  // Avatar section - show image if available, otherwise show initials
  const avatarHtml = followerProfileImageUrl
    ? `<img src="${escapeHtml(followerProfileImageUrl)}" alt="${escapeHtml(followerName)}" width="80" height="80" style="width:80px;height:80px;border-radius:50%;object-fit:cover;display:block;" />`
    : `<div style="width:80px;height:80px;border-radius:50%;background:#27272a;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-weight:700;font-size:28px;color:#E0FE10;">${escapeHtml(initials)}</div>`;

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
        ${escapeHtml(followerName)} is now following you on Pulse. Check out their profile!
      </div>

      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0a0a0b;padding:24px 0;">
        <tr>
          <td align="center" style="padding: 0 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;">
              <tr>
                <td style="padding: 6px 8px 18px 8px;">
                  <div style="display:flex;align-items:center;justify-content:center;gap:12px;">
                    <div style="width:44px;height:44px;border-radius:12px;background:#E0FE10;display:inline-flex;align-items:center;justify-content:center;">
                      <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-weight:900;color:#0a0a0b;font-size:20px;">P</span>
                    </div>
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-weight:800;color:#ffffff;font-size:18px;letter-spacing:0.2px;">
                      Pulse
                    </div>
                  </div>
                </td>
              </tr>

              <tr>
                <td style="border:1px solid rgba(255,255,255,0.08);background:rgba(24,24,27,0.75);backdrop-filter: blur(12px);border-radius:20px;overflow:hidden;">
                  <div style="height:2px;background:linear-gradient(90deg, transparent, rgba(224,254,16,0.7), transparent);"></div>
                  
                  <div style="padding:32px 22px;text-align:center;">
                    <!-- Profile Avatar -->
                    <div style="display:inline-block;margin-bottom:16px;">
                      ${avatarHtml}
                    </div>
                    
                    <!-- Follower Name -->
                    <h1 style="margin:0 0 4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:24px;line-height:1.2;color:#E0FE10;font-weight:900;">
                      ${escapeHtml(followerName)}
                    </h1>
                    
                    ${followerLocation ? `
                    <p style="margin:0 0 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:14px;color:#A1A1AA;">
                      ${escapeHtml(followerLocation)}
                    </p>
                    ` : '<div style="margin-bottom:16px;"></div>'}
                    
                    <!-- Message -->
                    <p style="margin:0 0 24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:16px;line-height:1.6;color:#E4E4E7;">
                      ${escapeHtml(followerName)} now follows you.
                    </p>
                    
                    <!-- CTA Button -->
                    <a href="${viewProfileUrl}" style="display:inline-block;background:#E0FE10;color:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-weight:900;font-size:14px;text-decoration:none;padding:14px 28px;border-radius:12px;">
                      VIEW PROFILE
                    </a>
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding:24px 22px 0 22px;">
                  <div style="text-align:center;">
                    <p style="margin:0 0 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:13px;color:#71717A;">
                      Follow Pulse
                    </p>
                    <div style="display:flex;align-items:center;justify-content:center;gap:16px;">
                      <a href="https://instagram.com/fitwithpulse" style="display:inline-block;width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,0.15);text-decoration:none;" title="Instagram">
                        <img src="https://fitwithpulse.ai/email-assets/instagram-icon.png" alt="Instagram" width="36" height="36" style="display:block;width:36px;height:36px;" />
                      </a>
                      <a href="https://twitter.com/fitwithpulse" style="display:inline-block;width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,0.15);text-decoration:none;" title="Twitter">
                        <img src="https://fitwithpulse.ai/email-assets/twitter-icon.png" alt="Twitter" width="36" height="36" style="display:block;width:36px;height:36px;" />
                      </a>
                      <a href="https://tiktok.com/@fitwithpulse" style="display:inline-block;width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,0.15);text-decoration:none;" title="TikTok">
                        <img src="https://fitwithpulse.ai/email-assets/tiktok-icon.png" alt="TikTok" width="36" height="36" style="display:block;width:36px;height:36px;" />
                      </a>
                    </div>
                  </div>
                </td>
              </tr>

              <tr>
                <td align="center" style="padding:24px 8px 0 8px;">
                  <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:11px;line-height:1.6;color:#52525B;">
                    © ${new Date().getFullYear()} Pulse Intelligence Labs, Inc.
                  </p>
                  <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:11px;line-height:1.6;color:#52525B;">
                    You received this message because you are a member of <a href="https://fitwithpulse.ai" style="color:#71717A;text-decoration:underline;">Pulse</a>.
                  </p>
                  <p style="margin:8px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:11px;line-height:1.6;">
                    <a href="https://fitwithpulse.ai/settings/notifications" style="color:#71717A;text-decoration:underline;">Unsubscribe from future emails when someone follows you</a>
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

async function getNewFollowerTemplateFromFirestore(): Promise<{ subject: string; html: string } | null> {
  try {
    const db = await getFirestore();
    const snap = await db.collection('email-templates').doc('new-follower-v1').get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    const subject = typeof data.subject === 'string' ? data.subject : '';
    const html = typeof data.html === 'string' ? data.html : '';
    if (!subject || !html) return null;
    return { subject, html };
  } catch (e) {
    console.warn('[send-new-follower-email] Failed to load template from Firestore:', e);
    return null;
  }
}

function applyTemplateVars(
  input: string,
  vars: { firstName?: string; followerName?: string; followerUsername?: string; followerLocation?: string }
) {
  const firstName = (vars.firstName || '').trim() || 'there';
  const followerName = (vars.followerName || 'Someone').trim();
  const followerUsername = (vars.followerUsername || '').trim();
  const followerLocation = (vars.followerLocation || '').trim();
  return input
    .replace(/\{\{first_name\}\}/g, escapeHtml(firstName))
    .replace(/\{\{firstName\}\}/g, escapeHtml(firstName))
    .replace(/\{\{follower_name\}\}/g, escapeHtml(followerName))
    .replace(/\{\{followerName\}\}/g, escapeHtml(followerName))
    .replace(/\{\{follower_username\}\}/g, escapeHtml(followerUsername))
    .replace(/\{\{followerUsername\}\}/g, escapeHtml(followerUsername))
    .replace(/\{\{follower_location\}\}/g, escapeHtml(followerLocation))
    .replace(/\{\{followerLocation\}\}/g, escapeHtml(followerLocation));
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' } satisfies SendResponse),
    };
  }

  try {
    const apiKey = process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY;
    const senderEmail = 'tre@fitwithpulse.ai';
    const senderName = 'Pulse';

    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Brevo not configured' } satisfies SendResponse),
      };
    }

    const body = (event.body ? JSON.parse(event.body) : {}) as RequestBody;
    const {
      userId,
      toEmail,
      firstName,
      followerName,
      followerUsername,
      followerProfileImageUrl,
      followerLocation,
      isTest,
      subjectOverride,
      htmlOverride,
    } = body;

    if (!toEmail) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Missing toEmail' } satisfies SendResponse),
      };
    }

    // Template selection priority:
    // 1) Explicit overrides (admin preview/test)
    // 2) Firestore template (admin-editable)
    // 3) Built-in fallback (safe default)
    let subject = (subjectOverride || '').trim();
    let html = (htmlOverride || '').trim();
    if (!subject || !html) {
      const saved = await getNewFollowerTemplateFromFirestore();
      if (saved) {
        subject = saved.subject;
        html = saved.html;
      } else {
        const fallback = renderNewFollowerEmail({
          firstName,
          followerName,
          followerUsername,
          followerProfileImageUrl,
          followerLocation,
        });
        subject = fallback.subject;
        html = fallback.html;
      }
    }

    // Apply simple variable replacement for admin-saved templates
    subject = applyTemplateVars(subject, { firstName, followerName, followerUsername, followerLocation });
    html = applyTemplateVars(html, { firstName, followerName, followerUsername, followerLocation });

    const payload: any = {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: toEmail, name: firstName || toEmail }],
      subject,
      htmlContent: html,
      replyTo: { email: senderEmail, name: 'Pulse Team' },
      tags: ['new-follower', isTest ? 'test' : null].filter(Boolean),
    };

    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return {
        statusCode: resp.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: err?.message || 'Brevo API error' } satisfies SendResponse),
      };
    }

    const data = await resp.json().catch(() => ({}));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, messageId: data?.messageId } satisfies SendResponse),
    };
  } catch (e: any) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: e?.message || 'Internal error' } satisfies SendResponse),
    };
  }
};
