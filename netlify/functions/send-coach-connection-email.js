// Sends an email to the coach when an athlete subscribes + connects via PulseCheck
// Uses the existing Brevo (Sendinblue) transactional API pattern from other functions

const BREVO_API_KEY = process.env.BREVO_MARKETING_KEY;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'no-reply@fitwithpulse.ai';
const SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Pulse';
const SITE_URL = process.env.SITE_URL || 'http://localhost:8888';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
  }

  try {
    if (!BREVO_API_KEY) {
      console.error('[send-coach-connection-email] Missing BREVO_MARKETING_KEY');
      return { statusCode: 500, body: JSON.stringify({ message: 'Brevo not configured' }) };
    }

    const body = JSON.parse(event.body || '{}');
    const { coachEmail, coachName, athleteName } = body;

    if (!coachEmail) {
      return { statusCode: 400, body: JSON.stringify({ message: 'coachEmail required' }) };
    }

    const subject = `${athleteName || 'An athlete'} just connected with you on PulseCheck`;
    const dashboardUrl = `${SITE_URL}/coach/dashboard`;
    const htmlContent = `
      <div style="font-family: Inter, Arial, sans-serif; line-height: 1.6; color: #111">
        <h2 style="margin:0 0 12px">${athleteName || 'An athlete'} just connected via PulseCheck</h2>
        <p>
          You can now:
        </p>
        <ul>
          <li>View and track their mental notes (if they’ve opted to share)</li>
          <li>Message them directly in Pulse</li>
          <li>Encourage check-ins and support their mindset goals</li>
        </ul>
        <p style="margin-top:16px">
          Open Pulse and check your Messages to start a conversation.
        </p>

        <div style="margin:24px 0">
          <a href="${dashboardUrl}"
             style="display:inline-block;background:#E0FE10;color:#000;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:600">
            View Coach Dashboard
          </a>
        </div>

        <p style="margin-top:24px; color:#555; font-size:13px">This is an automated notification from Pulse.</p>
      </div>
    `;

    const brevoPayload = {
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: coachEmail, name: coachName || 'Coach' }],
      subject,
      htmlContent,
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify(brevoPayload),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error('[send-coach-connection-email] Brevo error:', response.status, errorBody);
      return { statusCode: 500, body: JSON.stringify({ message: 'Failed to send email' }) };
    }

    const json = await response.json().catch(() => ({}));
    console.log('[send-coach-connection-email] Email sent:', json);
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('[send-coach-connection-email] Unexpected error:', err);
    return { statusCode: 500, body: JSON.stringify({ message: 'Unexpected error' }) };
  }
};


