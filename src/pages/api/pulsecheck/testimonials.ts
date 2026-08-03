import type { NextApiRequest, NextApiResponse } from 'next';

const allowedRoles = new Set(['coach', 'athlete', 'parent', 'admin']);

const cleanText = (value: unknown, maxLength: number) => {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
};

const cleanEmail = (value: unknown) => {
  const email = cleanText(value, 180).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '';
  return email;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const name = cleanText(req.body?.name, 120);
  const email = cleanEmail(req.body?.email);
  const role = cleanText(req.body?.role, 40);
  const organization = cleanText(req.body?.organization, 180);
  const testimonial = cleanText(req.body?.testimonial, 1600);
  const source = cleanText(req.body?.source, 120) || 'pulsecheck-testimonials-page';
  const permission = req.body?.permission === true;

  if (!name) return res.status(400).json({ error: 'Please enter your name.' });
  if (!email) return res.status(400).json({ error: 'Please enter a valid email.' });
  if (!allowedRoles.has(role)) return res.status(400).json({ error: 'Please choose a role.' });
  if (testimonial.length < 24) {
    return res.status(400).json({ error: 'Please add a little more detail.' });
  }
  if (!permission) {
    return res.status(400).json({ error: 'Please confirm permission before submitting.' });
  }

  try {
    const admin = (await import('../../../lib/firebase-admin')).default;
    const docRef = await admin.firestore().collection('pulsecheck-testimonial-submissions').add({
      name,
      email,
      role,
      organization,
      testimonial,
      source,
      status: 'pending-review',
      permission,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: cleanText(req.headers['user-agent'], 240),
      ipAddress:
        cleanText(req.headers['x-forwarded-for'], 160) ||
        cleanText(req.socket.remoteAddress, 80),
    });

    return res.status(200).json({ ok: true, id: docRef.id });
  } catch (error) {
    console.error('[pulsecheck-testimonials] submission failed', error);
    return res.status(500).json({ error: 'We could not submit this testimonial yet.' });
  }
}
