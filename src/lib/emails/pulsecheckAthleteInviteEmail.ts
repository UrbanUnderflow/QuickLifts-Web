// Shared, dependency-free renderer for the PulseCheck ATHLETE invite email.
//
// Athletes are app-first: redeeming the link routes them to download the Pulse
// app and sign in to connect to their team (see pilot-invite-next-steps). This
// email's copy reflects that, unlike the staff/team-invite email.
//
// Single source of truth used by BOTH:
//   • netlify/functions/send-pulsecheck-athlete-invite-email.ts (the real send)
//   • src/pages/api/pulsecheck/preview/athlete-invite-email.ts   (the live preview)
//
// Keep this pure (no Brevo/send imports) so it bundles into a Next.js API route
// AND a Netlify function without dragging mail-SDK deps along.

export function escapeHtml(input: string) {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export type AthleteInviteEmailSource = 'coach' | 'admin';

export function buildAthleteInviteEmailDraft(opts: {
  recipientName?: string;
  organizationName?: string;
  teamName?: string;
  pilotName?: string;
  senderName?: string;
  inviteSource?: AthleteInviteEmailSource;
}) {
  const name = (opts.recipientName || '').trim() || 'there';
  const organizationName = (opts.organizationName || 'your team').trim();
  const teamName = (opts.teamName || '').trim();
  const pilotName = (opts.pilotName || '').trim();
  const senderName = (opts.senderName || 'your coach').trim();
  const inviteSource: AthleteInviteEmailSource = opts.inviteSource === 'admin' ? 'admin' : 'coach';
  const targetName = teamName || organizationName;

  const subject = teamName
    ? `You're invited to join ${teamName} on PulseCheck`
    : `You're invited to join ${organizationName} on PulseCheck`;

  if (inviteSource === 'admin') {
    return {
      subject,
      introText: `Hey ${name}, PulseCheck invited you to join ${targetName}${pilotName ? ` for ${pilotName}` : ''}.`,
      detailText:
        'Use this email when you sign in so we can connect you to the right team, consent forms, intake, and onboarding tasks.',
      buttonLabel: 'JOIN PULSECHECK',
      preheader: 'Download the PulseCheck app and sign in with this email to join your team on PulseCheck.',
    };
  }

  return {
    subject,
    introText: `Hey ${name}, ${senderName} invited you to join ${targetName} on PulseCheck.`,
    detailText: 'Use this email when you sign in so your coach can connect you to the team.',
    buttonLabel: 'JOIN YOUR TEAM',
    preheader: 'Download the PulseCheck app and sign in with this email to join your team on PulseCheck.',
  };
}

const formatTextForEmailHtml = (input: string) => escapeHtml(input).replace(/\n/g, '<br/>');

export function renderAthleteInviteEmail(opts: {
  recipientName?: string;
  organizationName?: string;
  teamName?: string;
  pilotName?: string;
  activationUrl: string;
  senderName?: string;
  inviteSource?: AthleteInviteEmailSource;
  subjectOverride?: string;
  introText?: string;
  detailText?: string;
  buttonLabel?: string;
}) {
  const activationUrl = opts.activationUrl;
  const draft = buildAthleteInviteEmailDraft(opts);

  const subject = (opts.subjectOverride || '').trim() || draft.subject;
  const introText = (opts.introText || '').trim() || draft.introText;
  const detailText = (opts.detailText || '').trim() || draft.detailText;
  const buttonLabel = (opts.buttonLabel || '').trim() || draft.buttonLabel;

  const html = `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(subject)}</title>
    </head>
    <body style="margin:0;padding:0;background:#ffffff;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
        ${escapeHtml(draft.preheader)}
      </div>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff;padding:24px 0;">
        <tr>
          <td align="center" style="padding: 0 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;">
              <tr>
                <td align="center" style="padding: 6px 8px 18px 8px;">
                  <img src="https://fitwithpulse.ai/pulseCheckIcon.png" alt="PulseCheck" width="64" height="64" style="display:block;width:64px;height:64px;border-radius:14px;" />
                </td>
              </tr>
              <tr>
                <td style="border:1px solid #e4e4e7;background:#ffffff;border-radius:20px;overflow:hidden;">
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:32px 22px;">
                    <tr>
                      <td align="center">
                        <table role="presentation" cellpadding="0" cellspacing="0" width="64" height="64" style="width:64px;height:64px;border-radius:50%;background:#f4f4f5;margin-bottom:20px;">
                          <tr>
                            <td align="center" valign="middle" style="font-size:28px;">📲</td>
                          </tr>
                        </table>
                        <h1 style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:24px;line-height:1.2;color:#000000;font-weight:900;">
                          You're invited to PulseCheck
                        </h1>
                        <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:16px;line-height:1.6;color:#000000;">
                          ${formatTextForEmailHtml(introText)}
                        </p>
                        <p style="margin:0 0 28px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:13px;line-height:1.6;color:#52525B;">
                          ${formatTextForEmailHtml(detailText)}
                        </p>
                        <a href="${escapeHtml(activationUrl)}" style="display:inline-block;background:#000000;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-weight:900;font-size:14px;text-decoration:none;padding:14px 32px;border-radius:12px;">
                          ${escapeHtml(buttonLabel)}
                        </a>
                        <p style="margin:20px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:12px;line-height:1.6;color:#52525B;">
                          Already have the PulseCheck app? Open it and sign in with this email.
                        </p>
                        <p style="margin:16px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:12px;line-height:1.6;color:#52525B;">
                          If the button doesn't work, copy and paste this link into your browser:<br/>
                          <span style="word-break:break-all;color:#000000;">${escapeHtml(activationUrl)}</span>
                        </p>
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
                  <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:11px;line-height:1.6;color:#52525B;">
                    Need help? Reply to this email or contact <a href="mailto:hello@fitwithpulse.ai" style="color:#000000;text-decoration:underline;">hello@fitwithpulse.ai</a>.
                  </p>
                  <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:11px;line-height:1.6;color:#52525B;">
                    You received this email because you were invited to a team on <a href="https://fitwithpulse.ai" style="color:#000000;text-decoration:underline;">PulseCheck</a>.
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
