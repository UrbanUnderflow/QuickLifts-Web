import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../lib/firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

/**
 * Notify a survey owner that a survey response was submitted (completed).
 * Used for Client Intake Forms (surveys stored under creator-pages/{userId}/pages/{pageSlug}/surveys/{surveyId}/responses/{responseId})
 *
 * Security model:
 * - This endpoint does NOT accept Brevo API keys from the client.
 * - It validates the response exists, and enforces idempotency via `completionEmailSentAt` on the response doc.
 */

const BREVO_API_KEY = process.env.BREVO_MARKETING_KEY;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'tre@fitwithpulse.ai';
const SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Pulse';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://fitwithpulse.ai';

type NotifyCompletedRequestBody = {
  ownerUserId: string;
  pageSlug: string;
  surveyId: string;
  responseId: string;
  username?: string;
};

type NotifyCompletedResponse =
  | { success: true; alreadySent: boolean; messageId?: string }
  | { success: false; error: string };

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildEmailHtml(params: {
  hostName: string;
  surveyTitle: string;
  respondentName?: string;
  respondentEmail?: string;
  viewUrl: string;
}) {
  const {
    hostName,
    surveyTitle,
    respondentName,
    respondentEmail,
    viewUrl,
  } = params;

  const respondentLine = respondentName || respondentEmail
    ? `${escapeHtml(respondentName || 'Client')}${respondentEmail ? ` (${escapeHtml(respondentEmail)})` : ''}`
    : 'A client';

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin:0; padding:0; background:#0b0b0c; color:#e4e4e7; }
        .container { max-width: 640px; margin: 0 auto; padding: 28px 18px; }
        .card { background: #111113; border: 1px solid #27272a; border-radius: 16px; padding: 22px; }
        .logo { font-weight: 800; letter-spacing: 0.5px; color: #E0FE10; font-size: 18px; }
        .h1 { margin: 14px 0 8px; font-size: 22px; color: #ffffff; }
        .p { margin: 0 0 14px; color: #a1a1aa; line-height: 1.6; }
        .pill { display:inline-block; padding: 6px 10px; border-radius: 999px; background: rgba(224,254,16,0.12); border: 1px solid rgba(224,254,16,0.25); color: #E0FE10; font-size: 12px; }
        .btn { display:inline-block; padding: 12px 16px; border-radius: 12px; background: #E0FE10; color: #000; font-weight: 700; text-decoration: none; }
        .meta { margin-top: 14px; font-size: 12px; color: #71717a; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="logo">Pulse</div>
          <div class="pill">Survey completed</div>
          <div class="h1">${escapeHtml(surveyTitle)}</div>
          <p class="p">
            Hey ${escapeHtml(hostName)}, ${respondentLine} just completed your intake survey.
          </p>
          <a class="btn" href="${escapeHtml(viewUrl)}" target="_blank" rel="noreferrer">View responses</a>
          <div class="meta">
            Tip: Open Creator Studio → Client Intake Forms → select the survey to view responses.
          </div>
        </div>
      </div>
    </body>
  </html>
  `;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<NotifyCompletedResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  if (!BREVO_API_KEY) {
    console.error('Brevo API key (BREVO_MARKETING_KEY) is not set.');
    return res.status(500).json({ success: false, error: 'Email service configuration error' });
  }

  try {
    // Firebase Admin is initialized on import
    const db = getFirestore();

    const body = (req.body || {}) as Partial<NotifyCompletedRequestBody>;
    const ownerUserId = String(body.ownerUserId || '').trim();
    const pageSlug = String(body.pageSlug || '').trim();
    const surveyId = String(body.surveyId || '').trim();
    const responseId = String(body.responseId || '').trim();
    const username = body.username ? String(body.username).trim() : '';

    if (!ownerUserId || !pageSlug || !surveyId || !responseId) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const responseRef = db
      .collection('creator-pages')
      .doc(ownerUserId)
      .collection('pages')
      .doc(pageSlug)
      .collection('surveys')
      .doc(surveyId)
      .collection('responses')
      .doc(responseId);

    const [responseSnap, surveySnap, ownerSnap] = await Promise.all([
      responseRef.get(),
      db
        .collection('creator-pages')
        .doc(ownerUserId)
        .collection('pages')
        .doc(pageSlug)
        .collection('surveys')
        .doc(surveyId)
        .get(),
      db.collection('users').doc(ownerUserId).get(),
    ]);

    if (!responseSnap.exists) {
      return res.status(404).json({ success: false, error: 'Response not found' });
    }
    if (!surveySnap.exists) {
      return res.status(404).json({ success: false, error: 'Survey not found' });
    }
    if (!ownerSnap.exists) {
      return res.status(404).json({ success: false, error: 'Owner not found' });
    }

    const responseData = responseSnap.data() || {};
    const alreadySent = !!responseData.completionEmailSentAt;
    if (alreadySent) {
      return res.status(200).json({ success: true, alreadySent: true });
    }

    const surveyData = surveySnap.data() || {};
    const ownerData = ownerSnap.data() || {};

    const hostEmail = String(ownerData.email || ownerData.userEmail || '').trim();
    const hostName = String(ownerData.username || ownerData.name || 'there').trim();
    if (!hostEmail) {
      console.warn('[notify-completed] Owner has no email. ownerUserId=', ownerUserId);
      // Mark as "sent" to avoid infinite retry loops; we still return success.
      await responseRef.set(
        {
          completionEmailSentAt: FieldValue.serverTimestamp(),
          completionEmailMessageId: null,
          completionEmailError: 'Owner missing email',
        },
        { merge: true }
      );
      return res.status(200).json({ success: true, alreadySent: false });
    }

    const surveyTitle = String(surveyData.title || 'Client Intake Form');
    const respondentName = responseData.respondentName ? String(responseData.respondentName) : undefined;
    const respondentEmail = responseData.respondentEmail ? String(responseData.respondentEmail) : undefined;

    // We don’t have a dedicated response viewer route; send user to Creator Studio.
    // If username is available, we can include the intake page too for context.
    const viewUrl = `${BASE_URL}/create`;
    const subject = `✅ Intake survey completed: ${surveyTitle}`;
    const htmlContent = buildEmailHtml({
      hostName,
      surveyTitle,
      respondentName,
      respondentEmail,
      viewUrl,
    });

    const brevoPayload = {
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: hostEmail, name: hostName }],
      subject,
      htmlContent,
      headers: {
        'X-Email-Type': 'survey-completed',
        'X-Survey-Owner': ownerUserId,
        'X-Survey-Id': surveyId,
        'X-Response-Id': responseId,
        ...(username ? { 'X-Owner-Username': username } : {}),
      },
    };

    const brevoResp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(brevoPayload),
    });

    if (!brevoResp.ok) {
      const errorBody = await brevoResp.json().catch(() => ({}));
      console.error('[notify-completed] Brevo API Error:', brevoResp.status, errorBody);
      return res.status(brevoResp.status).json({
        success: false,
        error: `Failed to send email: ${errorBody.message || 'Unknown error'}`,
      });
    }

    const responseDataBrevo = await brevoResp.json();
    const messageId = responseDataBrevo?.messageId ? String(responseDataBrevo.messageId) : undefined;

    await responseRef.set(
      {
        completionEmailSentAt: FieldValue.serverTimestamp(),
        completionEmailMessageId: messageId || null,
      },
      { merge: true }
    );

    return res.status(200).json({ success: true, alreadySent: false, messageId });
  } catch (error) {
    console.error('[notify-completed] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal Server Error',
    });
  }
}

