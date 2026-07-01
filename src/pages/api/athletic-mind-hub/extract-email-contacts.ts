import type { NextApiRequest, NextApiResponse } from 'next';

type ExtractedEmailContact = {
  name: string;
  email: string;
  notes: string;
};

type ExtractEmailContactsResponse =
  | { contacts: ExtractedEmailContact[]; rawText?: string }
  | { error: string };

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const OPENAI_BRIDGE_FEATURE_ID = 'athleticMindHubEmailExtraction';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

function cleanJsonResponse(value: string) {
  return value
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
}

function normalizeEmail(value: string) {
  return value.trim().replace(/[),.;:\]]+$/g, '').toLowerCase();
}

function normalizeContact(contact: Partial<ExtractedEmailContact>): ExtractedEmailContact | null {
  const email = normalizeEmail(String(contact.email || ''));
  if (!email || !email.includes('@')) return null;

  return {
    name: String(contact.name || '').trim(),
    email,
    notes: String(contact.notes || '').trim(),
  };
}

function dedupeContacts(contacts: Array<ExtractedEmailContact | null>) {
  const seen = new Set<string>();
  const deduped: ExtractedEmailContact[] = [];

  contacts.forEach((contact) => {
    if (!contact || seen.has(contact.email)) return;
    seen.add(contact.email);
    deduped.push(contact);
  });

  return deduped;
}

function extractEmailFallback(value: string) {
  const emails = value.match(EMAIL_PATTERN) || [];
  return dedupeContacts(emails.map((email) => normalizeContact({ email })));
}

function parseModelContacts(value: string) {
  const cleaned = cleanJsonResponse(value);

  try {
    const parsed = JSON.parse(cleaned) as { contacts?: Partial<ExtractedEmailContact>[]; rawText?: string };
    const contacts = Array.isArray(parsed.contacts)
      ? dedupeContacts(parsed.contacts.map(normalizeContact))
      : [];
    return {
      contacts,
      rawText: typeof parsed.rawText === 'string' ? parsed.rawText : cleaned,
    };
  } catch (_error) {
    return {
      contacts: extractEmailFallback(cleaned),
      rawText: cleaned,
    };
  }
}

function getBridgeOrigin() {
  return (process.env.OPENAI_BRIDGE_FALLBACK_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || 'https://fitwithpulse.ai')
    .replace(/\/+$/, '');
}

function getBridgeErrorMessage(value: unknown) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return 'Email extraction failed. Try a clearer screenshot.';

  const record = value as Record<string, unknown>;
  const error = record.error;
  if (error && typeof error === 'object') {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === 'string') return message;
  }
  if (typeof record.message === 'string') return record.message;
  return 'Email extraction failed. Try a clearer screenshot.';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ExtractEmailContactsResponse>,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const imageDataUrl = typeof req.body?.imageDataUrl === 'string' ? req.body.imageDataUrl : '';
  if (!imageDataUrl.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Upload an image file to extract emails.' });
  }

  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Please sign in before importing contacts.' });
  }

  try {
    const bridgeResponse = await fetch(`${getBridgeOrigin()}/api/openai/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        'openai-organization': OPENAI_BRIDGE_FEATURE_ID,
        'x-pulsecheck-firebase-mode': 'prod',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0,
        max_tokens: 1600,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You extract email contacts from screenshots and return strict JSON only.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: [
                  'Extract every clearly visible email address from this image.',
                  'If a person name is clearly adjacent to an email, include it.',
                  'If no name is visible for an email, set name to an empty string.',
                  'Always set notes to an empty string.',
                  'Do not infer missing names. Do not invent emails.',
                  'Return only JSON in this exact shape:',
                  '{"contacts":[{"name":"","email":"person@example.com","notes":""}],"rawText":"optional OCR text"}',
                ].join('\n'),
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageDataUrl,
                  detail: 'high',
                },
              },
            ],
          },
        ],
      }),
    });

    const bridgeData = await bridgeResponse.json();
    if (!bridgeResponse.ok) {
      return res.status(bridgeResponse.status).json({ error: getBridgeErrorMessage(bridgeData) });
    }

    const content = bridgeData.choices?.[0]?.message?.content || '';
    const parsed = parseModelContacts(content);
    const contacts = parsed.contacts.length ? parsed.contacts : extractEmailFallback(parsed.rawText || content);

    return res.status(200).json({
      contacts,
      rawText: parsed.rawText,
    });
  } catch (error) {
    console.error('[AthleticMindHub] Email image extraction failed', error);
    return res.status(500).json({ error: 'Email extraction failed. Try a clearer screenshot.' });
  }
}
