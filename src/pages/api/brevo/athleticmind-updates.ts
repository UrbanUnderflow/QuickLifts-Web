import type { NextApiRequest, NextApiResponse } from 'next';
import { handleBrevoSubscribe } from '../../../lib/brevoSubscribeHelper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const consent = req.body?.consent === true;

  if (!email) return res.status(400).json({ error: 'Email is required.' });
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (!consent) {
    return res.status(400).json({ error: 'Please agree to receive email updates before signing up.' });
  }

  try {
    await handleBrevoSubscribe({
      email,
      listKey: 'generic',
      utmCampaign: 'athleticmind-updatelist',
    });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[AthleticMind updates] Brevo subscription failed:', error);
    return res.status(500).json({ error: 'We couldn’t add you right now. Please try again later.' });
  }
}
