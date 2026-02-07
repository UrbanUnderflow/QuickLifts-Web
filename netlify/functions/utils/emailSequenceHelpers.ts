import { getFirestore } from './getServiceAccount';

export type SequenceTemplate = {
  subject: string;
  html: string;
};

export type SequenceRecipient = {
  toEmail: string;
  toName: string;
  firstName: string;
  username: string;
  userData: Record<string, any> | null;
};

export type SequenceEmailSendResult = {
  success: boolean;
  messageId?: string;
  skipped?: boolean;
  error?: string;
};

function toText(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

export function escapeHtml(input: string): string {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toSnakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

function buildTemplateVarLookup(vars: Record<string, any>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(vars || {})) {
    const v = toText(value);
    map.set(key, v);
    map.set(key.toLowerCase(), v);
    map.set(toSnakeCase(key), v);
    map.set(toSnakeCase(key).toLowerCase(), v);
  }
  return map;
}

export function applyTemplateVars(input: string, vars: Record<string, any>): string {
  if (!input) return '';
  const lookup = buildTemplateVarLookup(vars);
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_full, token) => {
    if (lookup.has(token)) return escapeHtml(lookup.get(token) || '');
    const lower = String(token).toLowerCase();
    if (lookup.has(lower)) return escapeHtml(lookup.get(lower) || '');
    return '';
  });
}

export async function loadTemplateFromFirestore(templateDocId: string): Promise<SequenceTemplate | null> {
  if (!templateDocId) return null;
  try {
    const db = await getFirestore();
    const snap = await db.collection('email-templates').doc(templateDocId).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    const subject = typeof data.subject === 'string' ? data.subject.trim() : '';
    const html = typeof data.html === 'string' ? data.html : '';
    if (!subject || !html) return null;
    return { subject, html };
  } catch (error) {
    console.warn('[emailSequenceHelpers] Failed to load template:', templateDocId, error);
    return null;
  }
}

export async function resolveRecipient(args: {
  userId?: string;
  toEmail?: string;
  firstName?: string;
}): Promise<SequenceRecipient | null> {
  const emailFromPayload = (args.toEmail || '').trim();
  const firstNameFromPayload = (args.firstName || '').trim();

  let userData: Record<string, any> | null = null;
  if (args.userId) {
    try {
      const db = await getFirestore();
      const snap = await db.collection('users').doc(args.userId).get();
      if (snap.exists) {
        userData = snap.data() || {};
      }
    } catch (error) {
      console.warn('[emailSequenceHelpers] Failed to resolve user:', args.userId, error);
    }
  }

  const userEmail = typeof userData?.email === 'string' ? userData.email.trim() : '';
  const toEmail = (emailFromPayload || userEmail).trim();
  if (!toEmail) return null;

  const userDisplayName = typeof userData?.displayName === 'string' ? userData.displayName.trim() : '';
  const userUsername = typeof userData?.username === 'string' ? userData.username.trim() : '';
  const fallbackName = userDisplayName || userUsername || toEmail;

  const firstName = (firstNameFromPayload || userDisplayName.split(' ')[0] || userUsername || 'there').trim();
  const toName = fallbackName;

  return {
    toEmail,
    toName,
    firstName: firstName || 'there',
    username: userUsername || '',
    userData,
  };
}

export async function sendBrevoTransactionalEmail(args: {
  toEmail: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  tags?: string[];
  scheduledAt?: string;
}): Promise<SequenceEmailSendResult> {
  const apiKey = process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'Brevo not configured' };
  }

  if (!args.toEmail) {
    return { success: false, error: 'Missing recipient email' };
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'tre@fitwithpulse.ai';
  const senderName = process.env.BREVO_SENDER_NAME || 'Pulse';

  const payload: Record<string, any> = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: args.toEmail, name: args.toName || args.toEmail }],
    subject: args.subject,
    htmlContent: args.htmlContent,
    replyTo: { email: senderEmail, name: 'Pulse Team' },
    tags: (args.tags || []).filter(Boolean),
  };

  if (args.scheduledAt) {
    const d = new Date(args.scheduledAt);
    if (!Number.isNaN(d.getTime())) {
      payload.scheduledAt = d.toISOString();
    }
  }

  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const errJson = await resp.json().catch(() => ({}));
    return {
      success: false,
      error: errJson?.message || `Brevo API error (${resp.status})`,
    };
  }

  const data = await resp.json().catch(() => ({}));
  return { success: true, messageId: data?.messageId };
}

export async function resolveSequenceTemplate(args: {
  templateDocId: string;
  fallbackSubject: string;
  fallbackHtml: string;
  subjectOverride?: string;
  htmlOverride?: string;
  vars?: Record<string, any>;
}): Promise<SequenceTemplate> {
  const overrideSubject = (args.subjectOverride || '').trim();
  const overrideHtml = (args.htmlOverride || '').trim();

  let subject = overrideSubject;
  let html = overrideHtml;

  if (!subject || !html) {
    const saved = await loadTemplateFromFirestore(args.templateDocId);
    if (saved) {
      subject = subject || saved.subject;
      html = html || saved.html;
    }
  }

  subject = subject || args.fallbackSubject;
  html = html || args.fallbackHtml;

  const vars = args.vars || {};
  return {
    subject: applyTemplateVars(subject, vars),
    html: applyTemplateVars(html, vars),
  };
}

export function toMillis(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (value > 1_000_000_000_000) return value; // likely ms
    if (value > 1_000_000_000) return value * 1000; // likely seconds
    return null;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toDate === 'function') {
    const d = value.toDate();
    return d instanceof Date ? d.getTime() : null;
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  return null;
}

export function getBaseSiteUrl(): string {
  return (process.env.SITE_URL || process.env.URL || 'https://fitwithpulse.ai').replace(/\/$/, '');
}

