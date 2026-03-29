// netlify/functions/send-staff-invite-email.js
// Sends a staff invite email via Brevo (Sendinblue) transactional API

const { buildEmailDedupeKey, sendBrevoTransactionalEmail } = require('./utils/sendBrevoTransactionalEmail');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method not allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const {
      toEmail,
      coachName = 'a Pulse coach',
      inviteUrl,
      signUpUrl,
      subject = 'You are invited to join Pulse Coach staff',
      message
    } = body;

    if (!toEmail || !inviteUrl) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Missing toEmail or inviteUrl' }) };
    }

    const htmlContent = `
      <div style="font-family: Inter, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #e5e7eb; background: #0b0b0b; padding: 24px;">
        <div style="max-width: 560px; margin: 0 auto; background: #111317; border: 1px solid #2a2f36; border-radius: 12px; overflow: hidden;">
          <div style="padding: 24px;">
            <h2 style="margin: 0 0 8px; color: #ffffff;">Staff Invitation</h2>
            <p style="margin: 0 0 16px;">${coachName} invited you to join their staff on Pulse.</p>
            ${message ? `<p style=\"margin: 0 0 16px; color: #cbd5e1;\">${message}</p>` : ''}
            <p style="margin: 0 0 20px;">Click the button below to accept the invitation and create your account:</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${inviteUrl}" style="background: #E0FE10; color: #000; padding: 12px 18px; border-radius: 10px; text-decoration: none; font-weight: 600;">Accept Invitation</a>
            </div>
            <p style="font-size: 12px; color: #94a3b8;">If the button doesn’t work, copy and paste this link into your browser:<br />
              <a href="${inviteUrl}" style="color: #a3e635;">${inviteUrl}</a>
            </p>
            ${signUpUrl ? `<p style="font-size: 12px; color: #94a3b8;">Don’t have an account yet? Create one here so the connection is automatic:<br />
              <a href="${signUpUrl}" style="color: #a3e635;">${signUpUrl}</a>
            </p>` : ''}
          </div>
        </div>
      </div>
    `;

    const sendResult = await sendBrevoTransactionalEmail({
      toEmail,
      subject,
      htmlContent,
      sender: { name: 'Pulse', email: 'no-reply@fitwithpulse.ai' },
      headers: { 'X-Email-Type': 'staff-invite' },
      idempotencyKey: buildEmailDedupeKey(['staff-invite-v1', toEmail, inviteUrl]),
      idempotencyMetadata: {
        sequence: 'staff-invite',
        toEmail,
        inviteUrl,
      },
      bypassDailyRecipientLimit: true,
      dailyRecipientMetadata: {
        sequence: 'staff-invite',
      },
    });

    if (!sendResult.success) {
      console.error('[send-staff-invite-email] Brevo error:', sendResult.error);
      return { statusCode: 400, body: JSON.stringify({ message: 'Failed to send invite', details: sendResult.error }) };
    }

    return { statusCode: 200, body: JSON.stringify({ message: 'Invite sent', result: { messageId: sendResult.messageId } }) };
  } catch (err) {
    console.error('[send-staff-invite-email] Unexpected error:', err);
    return { statusCode: 500, body: JSON.stringify({ message: 'Internal error' }) };
  }
};

