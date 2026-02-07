import type { Handler } from '@netlify/functions';
import {
  getBaseSiteUrl,
  resolveRecipient,
  resolveSequenceTemplate,
  sendBrevoTransactionalEmail,
} from './utils/emailSequenceHelpers';

type SendResponse = {
  success: boolean;
  skipped?: boolean;
  messageId?: string;
  error?: string;
};

type RequestBody = {
  userId?: string;
  toEmail?: string;
  firstName?: string;
  challengeTitle?: string;
  challengeId?: string;
  hoursRemaining?: number;
  completedCount?: number;
  totalPlanned?: number;
  isTest?: boolean;
  subjectOverride?: string;
  htmlOverride?: string;
  scheduledAt?: string;
};

function renderFallbackHtml(args: {
  firstName: string;
  challengeTitle: string;
  hoursRemaining: number;
  completedCount: number;
  totalPlanned: number;
  roundUrl: string;
  standaloneUrl: string;
  hostChallengeUrl: string;
}): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background:#0b0b0b;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0b0b0b;padding:24px 0;">
      <tr>
        <td align="center" style="padding:0 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;background:#15171b;border:1px solid #2a2f36;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:24px;font-family:Arial,sans-serif;color:#f4f4f5;">
                <h1 style="margin:0 0 10px 0;font-size:24px;line-height:1.2;color:#e0fe10;">${args.hoursRemaining} hours left in ${args.challengeTitle}</h1>
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#d4d4d8;">
                  ${args.firstName}, finish strong. You are at <strong>${args.completedCount}/${args.totalPlanned}</strong> planned workouts.
                </p>
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#d4d4d8;">
                  Complete your next workout now, then keep momentum going with standalone workouts after this challenge.
                </p>
                <p style="margin:20px 0 10px 0;">
                  <a href="${args.roundUrl}" style="display:inline-block;background:#e0fe10;color:#101113;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:700;">
                    Finish Challenge Strong
                  </a>
                </p>
                <p style="margin:0 0 10px 0;font-size:13px;line-height:1.7;color:#b9b9bf;">
                  After this challenge ends:
                  <a href="${args.standaloneUrl}" style="color:#e0fe10;text-decoration:underline;">generate standalone workouts</a>
                  and keep training.
                </p>
                <p style="margin:0;font-size:13px;line-height:1.7;color:#b9b9bf;">
                  Want to level up? <a href="${args.hostChallengeUrl}" style="color:#e0fe10;text-decoration:underline;">Host your own challenge with friends</a>.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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
    const {
      userId,
      toEmail,
      firstName,
      challengeTitle = 'your Round',
      challengeId,
      hoursRemaining = 24,
      completedCount = 0,
      totalPlanned = 0,
      isTest,
      subjectOverride,
      htmlOverride,
      scheduledAt,
    } = body;

    const recipient = await resolveRecipient({ userId, toEmail, firstName });
    if (!recipient) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, skipped: true } satisfies SendResponse),
      };
    }

    const siteUrl = getBaseSiteUrl();
    const roundUrl = challengeId ? `${siteUrl}/round/${encodeURIComponent(challengeId)}` : `${siteUrl}/rounds`;
    const standaloneUrl = `${siteUrl}/programming?web=1`;
    const hostChallengeUrl = `${siteUrl}/build-your-round`;

    const fallbackSubject = `${hoursRemaining}h left in ${challengeTitle} - finish strong`;
    const fallbackHtml = renderFallbackHtml({
      firstName: recipient.firstName,
      challengeTitle,
      hoursRemaining,
      completedCount,
      totalPlanned: Math.max(totalPlanned, 0),
      roundUrl,
      standaloneUrl,
      hostChallengeUrl,
    });

    const template = await resolveSequenceTemplate({
      templateDocId: 'challenge-ending-soon-v1',
      fallbackSubject,
      fallbackHtml,
      subjectOverride,
      htmlOverride,
      vars: {
        firstName: recipient.firstName,
        first_name: recipient.firstName,
        username: recipient.username,
        challengeTitle,
        challenge_title: challengeTitle,
        challengeId: challengeId || '',
        challenge_id: challengeId || '',
        hoursRemaining,
        hours_remaining: hoursRemaining,
        completedCount,
        completed_count: completedCount,
        totalPlanned,
        total_planned: totalPlanned,
        roundUrl,
        round_url: roundUrl,
        standaloneUrl,
        standalone_url: standaloneUrl,
        hostChallengeUrl,
        host_challenge_url: hostChallengeUrl,
      },
    });

    const sendResult = await sendBrevoTransactionalEmail({
      toEmail: recipient.toEmail,
      toName: recipient.toName,
      subject: template.subject,
      htmlContent: template.html,
      tags: ['challenge-ending-soon', `hours:${hoursRemaining}`, isTest ? 'test' : ''],
      scheduledAt,
    });

    if (!sendResult.success) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: sendResult.error || 'Failed to send' } satisfies SendResponse),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, messageId: sendResult.messageId } satisfies SendResponse),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error?.message || 'Internal error' } satisfies SendResponse),
    };
  }
};

