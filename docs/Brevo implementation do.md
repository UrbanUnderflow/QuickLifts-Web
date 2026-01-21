# Brevo implementation (do)

This document outlines the **existing** Brevo (Sendinblue) email implementation pattern used across `QuickLifts-Web/netlify/functions/`.

The goal: **ship new emails without introducing new API keys** or new env var names—reuse what already works everywhere else in this repo.

---

## Environment variables (existing)

Across the codebase, Brevo is accessed using **one of these existing keys**:

- **`BREVO_MARKETING_KEY`** *(preferred)*  
- **`BREVO_API_KEY`** *(fallback)*

Optional (already used in several functions):

- **`BREVO_SENDER_EMAIL`** (defaults vary by function, commonly `no-reply@fitwithpulse.ai`)
- **`BREVO_SENDER_NAME`** (defaults vary by function, commonly `Pulse`)
- **`SITE_URL`** (used to build absolute links back to the web app; e.g. `https://fitwithpulse.ai`)

**Do not add new “Brevo key” env var names.** If you need a Brevo key, use `BREVO_MARKETING_KEY` (or `BREVO_API_KEY` as fallback).

---

## The API call (existing pattern)

Most functions send transactional email through Brevo using:

- **Endpoint**: `https://api.brevo.com/v3/smtp/email`
- **Header**: `api-key: <BREVO_MARKETING_KEY | BREVO_API_KEY>`
- **Body**: JSON payload with `sender`, `to`, `subject`, `htmlContent` (and optionally `replyTo`, `tags`, `scheduledAt`)

Common payload shape:

```js
const payload = {
  sender: { name: SENDER_NAME, email: SENDER_EMAIL },
  to: [{ email: toEmail, name: toName }],
  subject,
  htmlContent,
  replyTo: { email: SENDER_EMAIL, name: 'Pulse Team' }, // optional but recommended
  tags: ['some-tag', 'another-tag'].filter(Boolean),     // optional but recommended
  // scheduledAt: new Date().toISOString(),              // optional
};

const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
  method: 'POST',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'api-key': process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY,
  },
  body: JSON.stringify(payload),
});
```

---

## Files to reference (examples already in repo)

These are good “known working” references:

- `netlify/functions/send-welcome-email.ts`
- `netlify/functions/send-username-reminder-email.ts`
- `netlify/functions/send-friend-email.ts`
- `netlify/functions/send-coach-connection-email.js`
- `netlify/functions/send-approval-email.ts`

---

## Implementation guidance (do / don’t)

### Do

- **Do reuse the existing env vars** listed above.
- **Do keep emails privacy-safe** (especially coach/athlete flows): avoid including user message content or clinical details unless explicitly approved.
- **Do use tags** to help filter in Brevo (e.g. `coach-escalation`, `tier-1`).
- **Do make email sending “best-effort”** when appropriate (non-blocking): failure to email shouldn’t break the core user flow.
- **Do log failures safely** (status code + error text), without logging secrets.
- **Do include idempotency** when the email is triggered by scheduled jobs or webhooks (store a “sentAt” marker in Firestore).

### Don’t

- **Don’t introduce new API key env vars** (like `BREVO_ESCALATION_KEY`, etc.). Use `BREVO_MARKETING_KEY` / `BREVO_API_KEY`.
- **Don’t hardcode API keys** in code. Ever.
- **Don’t send sensitive message transcripts** to coaches via email.

---

## Template: minimal helper function (recommended)

For repeated email logic, prefer a small shared helper under `netlify/functions/utils/` (similar to other patterns in this repo).

```js
const BREVO_API_KEY = process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'no-reply@fitwithpulse.ai';
const SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Pulse';

async function sendBrevoEmail({ toEmail, toName, subject, htmlContent, tags = [] }) {
  if (!BREVO_API_KEY) return { success: false, skipped: true, reason: 'brevo_not_configured' };
  if (!toEmail) return { success: false, skipped: true, reason: 'missing_to_email' };

  const payload = {
    sender: { name: SENDER_NAME, email: SENDER_EMAIL },
    to: [{ email: toEmail, name: toName || toEmail }],
    subject,
    htmlContent,
    replyTo: { email: SENDER_EMAIL, name: 'Pulse Team' },
    tags: tags.filter(Boolean),
  };

  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'api-key': BREVO_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const errTxt = await resp.text().catch(() => '');
    return { success: false, status: resp.status, error: errTxt || 'brevo_send_failed' };
  }

  const data = await resp.json().catch(() => ({}));
  return { success: true, messageId: data?.messageId };
}

module.exports = { sendBrevoEmail };
```

---

## Coach escalation emails (privacy-safe)

Coach escalation emails should:

- **Tier 1:** notify coach that an athlete had a Nora conversation that should be escalated to the coach for review.
- **Tier 2/3:** notify coach that a Tier 2/3 escalation event occurred and a clinical handoff was initiated.
- Include a short section describing what tiers mean **for the coach**.
- **Exclude** the athlete’s actual conversation content.

---

## Troubleshooting checklist

- **Missing key**: confirm `BREVO_MARKETING_KEY` is set in the environment running the function.
- **Sender domain issues**: ensure `BREVO_SENDER_EMAIL` is verified in Brevo.
- **Silent failures**: log `resp.status` + response body text on non-2xx.
- **Links wrong**: confirm `SITE_URL` is set for the environment (`https://fitwithpulse.ai` in production).

