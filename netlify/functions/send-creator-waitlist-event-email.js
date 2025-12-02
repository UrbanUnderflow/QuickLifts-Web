const { headers } = require('./config/firebase');

const BREVO_API_KEY = process.env.BREVO_MARKETING_KEY;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'no-reply@fitwithpulse.ai';
const SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Pulse: The Fitness Collective';

exports.handler = async (event) => {
  // CORS preflight
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
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  if (!BREVO_API_KEY) {
    console.error('[send-creator-waitlist-event-email] Brevo API key not configured');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Email service not configured' }),
    };
  }

  try {
    const { entries } = JSON.parse(event.body || '{}');

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'No recipients provided' }),
      };
    }

    console.log('[send-creator-waitlist-event-email] Sending event emails for waitlist', {
      count: entries.length,
    });

    const emailPromises = entries.map(async (entry, idx) => {
      try {
        const rawName = (entry && entry.name) || '';
        const safeName = rawName.trim() || 'there';

        const entrySubject =
          (entry && entry.subject && String(entry.subject)) ||
          'You’re in for STRETCH N SIP on Friday, December 5th at 7:00 PM';
        const entryBody = entry && entry.body ? String(entry.body) : null;
        const entrySenderName =
          (entry && entry.senderName && String(entry.senderName).trim()) || SENDER_NAME;

        // If a custom body is provided, wrap it in a simple HTML shell preserving line breaks.
        const htmlContent =
          entryBody != null && entryBody !== ''
            ? `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; background-color: #0b0b0b; color: #e5e7eb;">
            <div style="background-color: #111317; border-radius: 16px; padding: 32px 24px; border: 1px solid #27272a;">
              <pre style="margin: 0; white-space: pre-wrap; font-size: 14px; line-height: 1.6; color: #e5e7eb;">${escapeHtml(
                entryBody
              )}</pre>
            </div>
          </div>
        `
            : buildDefaultHtmlTemplate(safeName);

        const toEmail = (entry && entry.email && String(entry.email).toLowerCase().trim()) || null;
        if (!toEmail) {
          console.warn('[send-creator-waitlist-event-email] Skipping entry without email at index', idx);
          return { success: false, error: 'Missing email', index: idx };
        }

        const brevoPayload = {
          sender: { name: entrySenderName, email: SENDER_EMAIL },
          to: [{ email: toEmail, name: safeName }],
          subject: entrySubject,
          htmlContent,
          headers: { 'X-Email-Type': 'creator-waitlist-event-confirmation' },
        };

        const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'api-key': BREVO_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(brevoPayload),
        });

        if (!resp.ok) {
          const errTxt = await resp.text().catch(() => '');
          console.error('[send-creator-waitlist-event-email] Brevo send failed:', resp.status, errTxt);
          return { success: false, error: 'Brevo send failed', status: resp.status, index: idx };
        }

        const data = await resp.json().catch(() => ({}));
        return { success: true, index: idx, brevo: data };
      } catch (err) {
        console.error('[send-creator-waitlist-event-email] Unexpected error for entry', idx, err);
        return { success: false, error: err && err.message ? err.message : 'Unknown error', index: idx };
      }
    });

    const results = await Promise.all(emailPromises);
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log('[send-creator-waitlist-event-email] Completed sending emails', {
      total: entries.length,
      succeeded,
      failed,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        total: entries.length,
        succeeded,
        failed,
        results,
      }),
    };
  } catch (error) {
    console.error('[send-creator-waitlist-event-email] Handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error && error.message ? error.message : 'Internal error' }),
    };
  }
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildDefaultHtmlTemplate(safeName) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; background-color: #0b0b0b; color: #e5e7eb;">
      <div style="background-color: #111317; border-radius: 16px; padding: 32px 24px; border: 1px solid #27272a;">
        <p style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #ffffff;">Hey ${safeName}! You’re in!</p>

        <p style="margin: 0 0 12px; font-size: 14px; color: #e5e7eb;">
          Thank you for confirming your attendance for my <strong>STRETCH N SIP</strong> on
          <strong>Friday, December 5th at 7:00 PM</strong>, powered by <strong>Pulse: The Fitness Collective</strong>.
        </p>

        <p style="margin: 0 0 16px; font-size: 14px; color: #e5e7eb;">
          I can’t wait to host you inside this luxurious space by The LeJardin Group for an evening of movement, restoration, and good vibes.
        </p>

        <h3 style="margin: 24px 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: #a1a1aa;">Location</h3>
        <p style="margin: 0 0 16px; font-size: 14px; color: #e5e7eb;">
          4730 Paran Valley NW<br />
          Sandy Springs, GA
        </p>

        <h3 style="margin: 16px 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: #a1a1aa;">What to Bring</h3>
        <ul style="margin: 0 0 16px 20px; padding: 0; font-size: 14px; color: #e5e7eb; list-style-type: disc;">
          <li>A yoga mat</li>
          <li>A towel</li>
          <li>Comfortable clothing for stretching</li>
        </ul>

        <p style="margin: 0 0 16px; font-size: 14px; color: #e5e7eb;">
          There will be an array of wine and refreshments provided, including our featured red wine partner: <strong>CanArieCap</strong>.
        </p>

        <h3 style="margin: 24px 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: #a1a1aa;">A Few Things to Know</h3>
        <ul style="margin: 0 0 16px 20px; padding: 0; font-size: 14px; color: #e5e7eb; list-style-type: disc;">
          <li>Some parts of the event will be filmed for future promotional content.</li>
          <li>Space is limited. If you can no longer attend, please let me know so your spot can be offered to someone on the waitlist.</li>
          <li>
            Alcohol will be served during the social hour. If you plan to drink, please arrange a rideshare,
            designated driver, or safe transportation option. Your safety matters.
          </li>
        </ul>

        <hr style="border: none; border-top: 1px solid #27272a; margin: 24px 0;" />

        <h3 style="margin: 0 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: #a1a1aa;">
          Important Liability + Safety Notice
        </h3>
        <p style="margin: 0 0 12px; font-size: 14px; color: #e5e7eb;">
          By attending <strong>STRETCH N SIP</strong>, you acknowledge the following:
        </p>
        <ul style="margin: 0 0 16px 20px; padding: 0; font-size: 14px; color: #e5e7eb; list-style-type: disc;">
          <li>You are voluntarily participating in physical activity and assume all responsibility for your own health and safety during the event.</li>
          <li>You release the event host, property owner, and any affiliated vendors from liability for injuries, accidents, or personal property loss that may occur during the event.</li>
          <li>Once the event concludes and you leave the premises, you accept full responsibility for your transportation choices and personal conduct.</li>
          <li>The host is not liable for any incidents, injuries, or damages that occur off-site or after your departure.</li>
        </ul>

        <p style="margin: 16px 0 20px; font-size: 14px; color: #e5e7eb;">
          We’re excited to Stretch, Sip, and unWine with you. See you soon!
        </p>

        <p style="margin: 0 0 4px; font-size: 14px; color: #e5e7eb;">
          —Jaidus
        </p>
        <p style="margin: 0 0 16px; font-size: 13px; color: #d4d4d8;">
          Jaidus Mondesir<br />
          Artist | Health, Wellness, &amp; Nutrition Coach | Travel Blogger
        </p>

        <p style="margin: 0 0 4px; font-size: 13px; color: #d4d4d8;">
          <strong>SOULCYCLE BUCKHEAD</strong><br />
          3400 AROUND LENOX ROAD NE<br />
          ATLANTA, GA 30326
        </p>

        <p style="margin: 12px 0 0; font-size: 13px; color: #d4d4d8;">
          MOBILE: 954-658-6776
        </p>
      </div>
    </div>
  `;
}



