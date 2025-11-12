const { admin, db, headers } = require('./config/firebase');

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { username, page, name, email } = JSON.parse(event.body || '{}');
    if (!username || !page || !name || !email) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing fields' }) };
    }

    // Lookup userId by username
    const usersRef = db.collection('users');
    const snap = await usersRef.where('username', '==', username).limit(1).get();
    if (snap.empty) {
      return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'User not found' }) };
    }
    const userId = snap.docs[0].id;

    const ref = db.collection('creator-pages').doc(userId).collection('waitlist').doc();
    await ref.set({
      id: ref.id,
      username,
      page,
      name,
      email: String(email).toLowerCase(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Attempt to fetch page details for email context
    let pageTitle = page;
    let pageHeadline = '';
    try {
      const pageDoc = await db.collection('creator-pages').doc(userId).collection('pages').doc(page).get();
      if (pageDoc.exists) {
        const pd = pageDoc.data() || {};
        pageTitle = pd.title || pageTitle;
        pageHeadline = pd.headline || '';
      }
    } catch (e) {
      console.warn('[creator-waitlist-signup] Failed to read page meta, continuing without it', e?.message);
    }

    // Fire Brevo confirmation email (non-blocking)
    (async () => {
      try {
        const BREVO_API_KEY = process.env.BREVO_MARKETING_KEY;
        if (!BREVO_API_KEY) {
          console.error('[creator-waitlist-signup] Brevo API key not configured');
          return;
        }
        const baseUrl = process.env.SITE_URL || 'https://fitwithpulse.ai';
        const pageUrl = `${baseUrl}/${username}/${page}`;
        const safeName = String(name).trim() || 'there';

        const htmlContent = `
          <div style="font-family: Inter, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #e5e7eb; background: #0b0b0b; padding: 24px;">
            <div style="max-width: 560px; margin: 0 auto; background: #111317; border: 1px solid #2a2f36; border-radius: 12px; overflow: hidden;">
              <div style="padding: 24px;">
                <h2 style="margin: 0 0 8px; color: #ffffff;">You're on the waitlist 🎉</h2>
                <p style="margin: 0 0 12px; color: #cbd5e1;">Hi ${safeName}, thanks for joining the waitlist.</p>
                <p style="margin: 0 16px 16px 0; color: #cbd5e1;">
                  You’ve been added to the waitlist for <strong style=\"color:#fff;\">${pageTitle}</strong>.
                </p>
                ${pageHeadline ? `<p style=\"margin:0 0 16px; color:#94a3b8;\">${pageHeadline}</p>` : ''}
                <div style="margin: 24px 0;">
                  <a href="${pageUrl}" style="background: #E0FE10; color: #000; padding: 12px 16px; border-radius: 10px; text-decoration: none; font-weight: 600;">View Page</a>
                </div>
                <p style="font-size: 12px; color: #94a3b8;">We’ll notify you as soon as access is confirmed. If the button doesn’t work, paste this link into your browser:<br />
                  <a href="${pageUrl}" style="color: #a3e635;">${pageUrl}</a>
                </p>
              </div>
            </div>
          </div>
        `;

        const brevoPayload = {
          sender: { name: 'Pulse', email: 'no-reply@fitwithpulse.ai' },
          to: [{ email: String(email).toLowerCase() }],
          subject: `You're on the waitlist for ${pageTitle}`,
          htmlContent,
          headers: { 'X-Email-Type': 'creator-waitlist-confirmation' }
        };

        const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'api-key': BREVO_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(brevoPayload)
        });
        if (!resp.ok) {
          const errTxt = await resp.text().catch(() => '');
          console.error('[creator-waitlist-signup] Brevo send failed:', resp.status, errTxt);
        }
      } catch (e) {
        console.error('[creator-waitlist-signup] Unexpected error sending Brevo email:', e);
      }
    })();

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, id: ref.id }) };
  } catch (error) {
    console.error('[creator-waitlist-signup] Error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
  }
};



