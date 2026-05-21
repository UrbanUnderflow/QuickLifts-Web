import type { Handler } from '@netlify/functions';
import { getFirestore } from './utils/getServiceAccount';
import {
  applyTemplateVars,
  buildEmailDedupeKey,
  escapeHtml,
  getBaseSiteUrl,
  loadTemplateFromFirestore,
  resolveRecipient,
  sendBrevoTransactionalEmail,
} from './utils/emailSequenceHelpers';
import { evaluateMacraEmailEligibility, MACRA_EMAIL_SENDER } from './utils/macraEmailEligibility';

const {
  MACRA_WEB_OFFER_CAMPAIGN_ID,
  normalizePlan,
  signMacraOfferLink,
} = require('./utils/macraStripe');
const {
  MACRA_MIXPANEL_EVENTS,
  safeTrackMacraWebOfferEvent,
} = require('./utils/mixpanelAnalytics');

type SendResponse = {
  success: boolean;
  skipped?: boolean;
  messageId?: string;
  checkoutUrl?: string;
  error?: string;
};

type RequestBody = {
  userId?: string;
  toEmail?: string;
  firstName?: string;
  isTest?: boolean;
  subjectOverride?: string;
  htmlOverride?: string;
  plan?: string;
};

const FALLBACK_SUBJECT = 'Your Macra plan is ready, plus a free month';
const OFFER_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function buildCheckoutUrl(args: { userId: string; plan: string }): string {
  const siteUrl = getBaseSiteUrl();
  const campaignId = MACRA_WEB_OFFER_CAMPAIGN_ID;
  const normalizedPlan = normalizePlan(args.plan);
  const expiresAt = Date.now() + OFFER_LINK_TTL_MS;
  const sig = signMacraOfferLink({
    userId: args.userId,
    campaignId,
    plan: normalizedPlan,
    expiresAt,
  });

  const url = new URL('/macra-offer', siteUrl);
  url.searchParams.set('uid', args.userId);
  url.searchParams.set('campaign', campaignId);
  url.searchParams.set('plan', normalizedPlan);
  url.searchParams.set('expires', String(expiresAt));
  url.searchParams.set('sig', sig);
  return url.toString();
}

function renderFallbackHtml(args: { firstName: string; checkoutUrl: string }): string {
  const greeting = args.firstName || 'there';
  const logoUrl = `${getBaseSiteUrl()}/macra-icon.png`;
  const checkoutUrl = escapeHtml(args.checkoutUrl);
  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(FALLBACK_SUBJECT)}</title>
    </head>
    <body style="margin:0;padding:0;background:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0a0a0b;padding:24px 0;">
        <tr>
          <td align="center" style="padding: 0 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;">
              <tr>
                <td style="padding: 6px 8px 18px 8px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;">
                    <tr>
                      <td style="vertical-align:middle;padding-right:12px;">
                        <img src="${logoUrl}" width="44" height="44" alt="Macra" style="display:block;width:44px;height:44px;border-radius:12px;border:0;outline:none;text-decoration:none;" />
                      </td>
                      <td style="vertical-align:middle;font-weight:800;color:#ffffff;font-size:18px;letter-spacing:0.2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;">Macra</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="border:1px solid rgba(255,255,255,0.08);background:rgba(24,24,27,0.78);border-radius:20px;overflow:hidden;">
                  <div style="height:2px;background:linear-gradient(90deg, transparent, rgba(224,254,16,0.82), transparent);"></div>
                  <div style="padding:28px 24px 8px 24px;">
                    <p style="margin:0 0 10px 0;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#E0FE10;font-weight:800;">One free month</p>
                    <h1 style="margin:0 0 12px 0;font-size:30px;line-height:1.18;color:#ffffff;font-weight:900;">
                      Your Macra plan is ready, ${escapeHtml(greeting)}.
                    </h1>
                    <p style="margin:0 0 18px 0;font-size:15px;line-height:1.7;color:#D4D4D8;">
                      You already built your nutrition profile. Start Macra today and your first month is free before the subscription renews.
                    </p>
                    <p style="margin:0 0 22px 0;font-size:13px;line-height:1.7;color:#A1A1AA;">
                      You can cancel before renewal if Macra is not the right fit.
                    </p>
                    <a href="${checkoutUrl}" style="display:inline-block;background:#E0FE10;color:#101113;text-decoration:none;padding:13px 18px;border-radius:12px;font-weight:900;font-size:14px;">
                      Start your free month
                    </a>
                  </div>
                  <div style="padding: 22px 24px 26px 24px;">
                    <div style="padding:16px 16px;border-radius:16px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.06);">
                      <p style="margin:0;font-size:13px;line-height:1.7;color:#E4E4E7;">
                        Inside Macra, Nora helps turn your profile into targets, meal feedback, and daily coaching so you know exactly what to adjust next.
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding: 16px 8px 0 8px;text-align:center;font-size:12px;line-height:1.6;color:#71717A;">
                  Sent by Macra · A Pulse Intelligence Labs app<br />
                  Reply to this email if you do not want Macra emails.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

function ensureCheckoutUrlInHtml(html: string, checkoutUrl: string): string {
  const escapedCheckoutUrl = escapeHtml(checkoutUrl);
  if (!html || html.includes(checkoutUrl) || html.includes(escapedCheckoutUrl)) return html;

  const macraLandingHrefPattern =
    /href=(["'])(https?:\/\/(?:www\.)?fitwithpulse\.ai\/Macra(?:\?[^"']*)?|\/Macra(?:\?[^"']*)?)\1/gi;
  const rewritten = html.replace(macraLandingHrefPattern, `href="${escapedCheckoutUrl}"`);

  if (!rewritten.includes(checkoutUrl) && !rewritten.includes(escapedCheckoutUrl)) {
    console.warn('[send-macra-web-offer-email] Template did not contain a checkout placeholder or replaceable Macra CTA href.');
  }

  return rewritten;
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
    const body = (event.body ? JSON.parse(event.body) : {}) as RequestBody;
    const userId = (body.userId || '').trim();
    const { isTest, subjectOverride, htmlOverride } = body;
    const plan = normalizePlan(body.plan || 'monthly');

    const recipient = await resolveRecipient({
      userId: userId || undefined,
      toEmail: body.toEmail,
      firstName: body.firstName,
    });

    if (!recipient) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Missing toEmail / could not resolve recipient' } satisfies SendResponse),
      };
    }

    if (!userId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Macra web offer emails require a real user ID so the signed checkout link can apply checkout to the correct account.',
        } satisfies SendResponse),
      };
    }

    const ageEligibility = await evaluateMacraEmailEligibility({
      userId,
      userData: recipient.userData,
      sequenceId: MACRA_WEB_OFFER_CAMPAIGN_ID,
      markSkipped: true,
    });
    if (!ageEligibility.eligible) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, skipped: true } satisfies SendResponse),
      };
    }

    if (userId && !isTest) {
      const db = await getFirestore();
      const snap = await db.collection('users').doc(userId).get();
      if (snap.exists) {
        const data = snap.data() || {};
        if (
          data.macraEmailSequenceState?.webOffer24hSentAt ||
          data.macraEmailSequenceState?.webOffer24hConvertedAt
        ) {
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true, skipped: true } satisfies SendResponse),
          };
        }
      }
    }

    const checkoutUrl = buildCheckoutUrl({ userId, plan });

    let subject = (subjectOverride || '').trim();
    let html = (htmlOverride || '').trim();
    if (!subject || !html) {
      const saved = await loadTemplateFromFirestore(MACRA_WEB_OFFER_CAMPAIGN_ID);
      if (saved) {
        subject = saved.subject;
        html = saved.html;
      } else {
        subject = FALLBACK_SUBJECT;
        html = renderFallbackHtml({ firstName: recipient.firstName, checkoutUrl });
      }
    }

    const vars = {
      firstName: recipient.firstName,
      first_name: recipient.firstName,
      username: recipient.username,
      user_name: recipient.username,
      checkoutUrl,
      checkout_url: checkoutUrl,
      offerUrl: checkoutUrl,
      offer_url: checkoutUrl,
      plan,
      offerLabel: '1 free month',
      offer_label: '1 free month',
    };
    subject = applyTemplateVars(subject, vars) || subject;
    html = applyTemplateVars(html, vars) || html;
    html = ensureCheckoutUrlInHtml(html, checkoutUrl);

    const idempotencyKey = !isTest ? buildEmailDedupeKey([MACRA_WEB_OFFER_CAMPAIGN_ID, userId || recipient.toEmail]) : '';
    const customHeader = {
      emailSequenceId: MACRA_WEB_OFFER_CAMPAIGN_ID,
      campaignId: MACRA_WEB_OFFER_CAMPAIGN_ID,
      userId: userId || null,
      product: 'macra',
      plan,
    };

    const sendResult = await sendBrevoTransactionalEmail({
      toEmail: recipient.toEmail,
      toName: recipient.toName,
      subject,
      htmlContent: html,
      tags: ['macra', 'macra-web-offer', 'retarget-24h', isTest ? 'test' : null].filter(Boolean) as string[],
      headers: { 'X-Mailin-custom': JSON.stringify(customHeader) },
      sender: MACRA_EMAIL_SENDER,
      replyTo: MACRA_EMAIL_SENDER,
      idempotencyKey,
      bypassDailyRecipientLimit: true,
      idempotencyMetadata: idempotencyKey
        ? {
            sequence: MACRA_WEB_OFFER_CAMPAIGN_ID,
            userId: userId || null,
            toEmail: recipient.toEmail,
          }
        : undefined,
    });

    if (!sendResult.success) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: sendResult.error || 'Brevo API error' } satisfies SendResponse),
      };
    }

    if (userId && !isTest && !sendResult.skipped) {
      const db = await getFirestore();
      await db.collection('users').doc(userId).set(
        {
          macraEmailSequenceState: {
            webOffer24hEmailProvider: 'brevo',
            webOffer24hEmailMessageId: sendResult.messageId || null,
            webOffer24hPlan: plan,
            webOffer24hSentAt: new Date(),
            webOffer24hStatus: 'sent',
            webOffer24hLastUpdatedAt: new Date(),
          },
        },
        { merge: true } as any
      );
    }

    if (!isTest && !sendResult.skipped) {
      await safeTrackMacraWebOfferEvent({
        eventName: MACRA_MIXPANEL_EVENTS.emailSent,
        userId,
        email: recipient.toEmail,
        insertId: `macra-web-offer:email-sent:${sendResult.messageId || userId || recipient.toEmail}`,
        properties: {
          plan,
          email_provider: 'brevo',
          email_sequence_id: MACRA_WEB_OFFER_CAMPAIGN_ID,
          brevo_message_id: sendResult.messageId || null,
          recipient_email: recipient.toEmail,
          recipient_name: recipient.toName || null,
          is_test: false,
        },
      });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        skipped: sendResult.skipped,
        messageId: sendResult.messageId,
        checkoutUrl: isTest ? checkoutUrl : undefined,
      } satisfies SendResponse),
    };
  } catch (e: any) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: e?.message || 'Internal error' } satisfies SendResponse),
    };
  }
};
