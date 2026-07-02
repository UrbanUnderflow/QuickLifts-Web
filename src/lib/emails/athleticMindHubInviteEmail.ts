import { escapeHtml } from '../../../netlify/functions/utils/emailSequenceHelpers';

type AthleticMindHubInviteEmailArgs = {
  activationUrl: string;
  permissionLabel: string;
  recipientName?: string;
  senderName?: string;
};

export function renderAthleticMindHubInviteEmail({
  activationUrl,
  permissionLabel,
  recipientName,
  senderName,
}: AthleticMindHubInviteEmailArgs) {
  const safeUrl = escapeHtml(activationUrl);
  const greetingName = escapeHtml((recipientName || '').trim() || 'there');
  const safePermission = escapeHtml(permissionLabel);
  const safeSender = escapeHtml((senderName || '').trim() || 'the Athletic Mind Council');

  return `
    <html>
      <body style="margin:0;background:#f4f1ea;color:#16251f;font-family:Inter,Arial,sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1ea;padding:28px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffdf8;border:1px solid #ded6c7;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="background:#16251f;color:#fff8e6;padding:26px 28px;">
                    <div style="font-size:13px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#e7b953;">Athletic Mind Council</div>
                    <h1 style="margin:12px 0 0;font-size:34px;line-height:1.08;font-weight:800;">You have been invited to Athletic Mind Hub</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px;">
                    <p style="font-size:17px;line-height:1.6;margin:0 0 16px;">Hi ${greetingName},</p>
                    <p style="font-size:17px;line-height:1.6;margin:0 0 16px;">
                      ${safeSender} invited you to join Athletic Mind Hub with <strong>${safePermission}</strong> access.
                    </p>
                    <p style="font-size:17px;line-height:1.6;margin:0 0 24px;">
                      Open the invite below, sign in or create your Pulse account, and we will drop you straight into the council workspace.
                    </p>
                    <a href="${safeUrl}" style="display:inline-block;background:#e7b953;color:#14241e;text-decoration:none;font-weight:900;border-radius:8px;padding:14px 20px;">
                      Open Athletic Mind Hub
                    </a>
                    <p style="font-size:13px;line-height:1.5;color:#5f6d66;margin:24px 0 0;">
                      If the button does not work, copy and paste this link into your browser:<br />
                      <a href="${safeUrl}" style="color:#286177;">${safeUrl}</a>
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
}
