// =============================================================================
// sendTwilioSms — shared Twilio SMS sender for PulseCheck server functions.
//
// This is the single place SMS goes out. It is intentionally side-effect free
// beyond the Twilio API call: callers own logging, consent checks, and dedupe.
//
// Env required (when any is missing the send is SKIPPED, not failed, so callers
// degrade gracefully in environments without Twilio configured):
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_FROM_NUMBER   (E.164, e.g. +13015551234)
//
// Returns a uniform result shape:
//   { skipped: boolean, success?: boolean, messageSid?: string|null,
//     reason?: string, error?: string }
// =============================================================================

const E164 = /^\+\d{10,15}$/;

// Normalize loosely-formatted phone strings to E.164. Bare 10-digit input is
// assumed US (+1). Returns '' when it can't be normalized to a plausible number.
function normalizePhoneToE164(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) return '';
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  if (hasPlus) {
    return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : '';
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return '';
}

function isValidE164(value) {
  return E164.test(value || '');
}

// Send an SMS. `to` may be loosely formatted; it is normalized to E.164.
async function sendTwilioSms({ to, body }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    return { skipped: true, reason: 'Twilio credentials not configured.' };
  }
  const normalizedTo = normalizePhoneToE164(to);
  if (!normalizedTo || !isValidE164(normalizedTo)) {
    return { skipped: true, reason: 'No valid phone number to text.' };
  }
  const messageBody = typeof body === 'string' ? body.trim() : '';
  if (!messageBody) {
    return { skipped: true, reason: 'Empty SMS body.' };
  }
  try {
    const params = new URLSearchParams();
    params.append('To', normalizedTo);
    params.append('From', from);
    params.append('Body', messageBody);
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { skipped: false, success: false, error: data?.message || `Twilio ${response.status}` };
    }
    return { skipped: false, success: true, messageSid: data.sid || null };
  } catch (error) {
    return { skipped: false, success: false, error: error?.message || String(error) };
  }
}

module.exports = { sendTwilioSms, normalizePhoneToE164, isValidE164 };
