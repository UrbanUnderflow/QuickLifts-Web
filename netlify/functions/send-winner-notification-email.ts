import type { Handler } from '@netlify/functions';
import {
  getBaseSiteUrl,
  resolveRecipient,
  resolveSequenceTemplate,
  sendBrevoTransactionalEmail,
} from './utils/emailSequenceHelpers';

type WinnerInput = {
  userId?: string;
  toEmail?: string;
  firstName?: string;
  username?: string;
  rank?: number;
  prizeAmount?: number;
};

type WinnerSendResult = {
  success: boolean;
  userId?: string;
  toEmail?: string;
  messageId?: string;
  skipped?: boolean;
  error?: string;
};

type RequestBody = {
  winners?: WinnerInput[];
  challengeTitle?: string;
  challengeId?: string;
  toEmail?: string;
  firstName?: string;
  username?: string;
  rank?: number;
  prizeAmount?: number;
  isTest?: boolean;
  subjectOverride?: string;
  htmlOverride?: string;
  scheduledAt?: string;
};

function normalizePrizeCents(raw: any): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (!Number.isInteger(n)) return Math.round(n * 100); // dollars
  if (n >= 1000) return Math.round(n); // likely cents
  return Math.round(n * 100); // small integer, assume dollars
}

function getOrdinal(rank: number): string {
  const v = rank % 100;
  if (v >= 11 && v <= 13) return `${rank}th`;
  const last = rank % 10;
  if (last === 1) return `${rank}st`;
  if (last === 2) return `${rank}nd`;
  if (last === 3) return `${rank}rd`;
  return `${rank}th`;
}

function renderFallbackHtml(args: {
  firstName: string;
  challengeTitle: string;
  challengeId: string;
  rank: number;
  prizeAmountDollars: string;
  dashboardUrl: string;
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
                <h1 style="margin:0 0 10px 0;font-size:24px;line-height:1.2;color:#e0fe10;">🏆 You won prize money</h1>
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#d4d4d8;">
                  ${args.firstName}, you placed <strong>${getOrdinal(args.rank)}</strong> in <strong>${args.challengeTitle}</strong>.
                </p>
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#d4d4d8;">
                  Prize amount: <strong>$${args.prizeAmountDollars}</strong>
                </p>
                <p style="margin:20px 0;">
                  <a href="${args.dashboardUrl}" style="display:inline-block;background:#e0fe10;color:#101113;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:700;">
                    View Earnings & Withdraw
                  </a>
                </p>
                <p style="margin:0;font-size:12px;line-height:1.7;color:#8e8e95;">
                  Challenge ID: ${args.challengeId}
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

async function sendSingleWinnerEmail(args: {
  winner: WinnerInput;
  challengeTitle: string;
  challengeId: string;
  subjectOverride?: string;
  htmlOverride?: string;
  isTest?: boolean;
  scheduledAt?: string;
}): Promise<WinnerSendResult> {
  const recipient = await resolveRecipient({
    userId: args.winner.userId,
    toEmail: args.winner.toEmail,
    firstName: args.winner.firstName || args.winner.username,
  });

  if (!recipient) {
    return {
      success: false,
      userId: args.winner.userId,
      toEmail: args.winner.toEmail,
      skipped: true,
      error: 'No recipient email',
    };
  }

  const rank = Number(args.winner.rank || 1) || 1;
  const prizeCents = normalizePrizeCents(args.winner.prizeAmount);
  const prizeAmountDollars = (prizeCents / 100).toFixed(2);
  const baseSiteUrl = getBaseSiteUrl();
  const dashboardUrl = recipient.username
    ? `${baseSiteUrl}/${encodeURIComponent(recipient.username)}/earnings`
    : `${baseSiteUrl}/winner/dashboard`;

  const fallbackSubject = `🏆 You won $${prizeAmountDollars} in ${args.challengeTitle}!`;
  const fallbackHtml = renderFallbackHtml({
    firstName: recipient.firstName,
    challengeTitle: args.challengeTitle,
    challengeId: args.challengeId,
    rank,
    prizeAmountDollars,
    dashboardUrl,
  });

  const template = await resolveSequenceTemplate({
    templateDocId: 'winner-notification-v1',
    fallbackSubject,
    fallbackHtml,
    subjectOverride: args.subjectOverride,
    htmlOverride: args.htmlOverride,
    vars: {
      firstName: recipient.firstName,
      first_name: recipient.firstName,
      username: recipient.username,
      challengeTitle: args.challengeTitle,
      challenge_title: args.challengeTitle,
      challengeId: args.challengeId,
      challenge_id: args.challengeId,
      rank,
      rank_ordinal: getOrdinal(rank),
      prizeAmount: prizeAmountDollars,
      prize_amount: prizeAmountDollars,
      dashboardUrl,
      dashboard_url: dashboardUrl,
    },
  });

  const sendResult = await sendBrevoTransactionalEmail({
    toEmail: recipient.toEmail,
    toName: recipient.toName,
    subject: template.subject,
    htmlContent: template.html,
    tags: ['winner-notification', `rank:${rank}`, args.isTest ? 'test' : ''],
    scheduledAt: args.scheduledAt,
  });

  if (!sendResult.success) {
    return {
      success: false,
      userId: args.winner.userId,
      toEmail: recipient.toEmail,
      error: sendResult.error || 'Failed to send',
    };
  }

  return {
    success: true,
    userId: args.winner.userId,
    toEmail: recipient.toEmail,
    messageId: sendResult.messageId,
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  try {
    const body = (event.body ? JSON.parse(event.body) : {}) as RequestBody;
    const {
      winners: rawWinners,
      challengeTitle = 'your Pulse challenge',
      challengeId = 'unknown-challenge',
      toEmail,
      firstName,
      username,
      rank = 1,
      prizeAmount = 10000,
      isTest,
      subjectOverride,
      htmlOverride,
      scheduledAt,
    } = body;

    const winners: WinnerInput[] =
      Array.isArray(rawWinners) && rawWinners.length > 0
        ? rawWinners
        : toEmail
          ? [{ toEmail, firstName, username, rank, prizeAmount }]
          : [];

    if (winners.length === 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, error: 'No winners provided' }),
      };
    }

    const results: WinnerSendResult[] = [];
    for (const winner of winners) {
      const result = await sendSingleWinnerEmail({
        winner,
        challengeTitle,
        challengeId,
        subjectOverride,
        htmlOverride,
        isTest,
        scheduledAt,
      });
      results.push(result);
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.length - successful;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        emailsSent: successful,
        emailsFailed: failed,
        totalWinners: winners.length,
        results,
        message: `Winner notification emails sent to ${successful} of ${winners.length} winners`,
      }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: error?.message || 'Internal server error',
      }),
    };
  }
};
