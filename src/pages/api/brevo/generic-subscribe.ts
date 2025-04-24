import type { NextApiRequest, NextApiResponse } from 'next';
import { handleBrevoSubscribe } from '../../../lib/brevoSubscribeHelper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email, utmCampaign } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Validate email format
  const emailFormat = /^\S+@\S+\.\S+$/;
  if (!emailFormat.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    await handleBrevoSubscribe({ email, listKey: 'generic', utmCampaign, attributes: { PLATFORM: 'web' } });
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error('Brevo contact error', e);
    return res.status(500).json({ error: e.message || 'brevo-failed' });
  }
} 