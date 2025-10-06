import type { NextApiRequest, NextApiResponse } from 'next';
import { reunionPaymentsService } from '../../api/firebase/reunionPayments/service';

// TEMP dev-only seed route. Will only run on localhost to avoid accidental prod writes.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isLocalhost = (req.headers.referer || req.headers.origin || '').includes('localhost');
  if (!isLocalhost) {
    return res.status(403).json({ ok: false, error: 'Forbidden outside localhost' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    // Seed data inferred from two photos. Notes captured in apr1Note/aug1Note/dec1Note.
    const seed = [
      // First page
      { name: 'Bert', apr1Amount: 50, apr1Note: 'T' },
      { name: 'Jackie', apr1Amount: 50, apr1Note: 'T' },
      { name: 'Javon', apr1Amount: 50, apr1Note: 'T' },
      { name: 'Willie', apr1Amount: 50, apr1Note: 'T' },

      // Second page
      { name: 'Olivia & Noel', apr1Amount: 100, apr1Note: 'T' },
      { name: 'Shenae', apr1Amount: 50, apr1Note: 'T' },
      { name: 'Faye & Frank', apr1Amount: 100, apr1Note: 'T', aug1Amount: 50, aug1Note: 'T' },
      { name: 'Patricia', apr1Amount: 50, apr1Note: 'T' },
      { name: 'Glen & Jen', apr1Amount: 100, apr1Note: 'T' },
      { name: 'Lloyd', apr1Amount: 50, apr1Note: 'T' },
      { name: 'Crystal & Errol', apr1Amount: 100, apr1Note: 'T', dec1Amount: 100, dec1Note: 'T' },
      { name: 'Gavin & Alana', apr1Amount: 100, apr1Note: 'T' },
      { name: 'Kareem & Houston', apr1Amount: 100, apr1Note: 'T' },
      // "Junior" row had no legible amount for Apr 1st in the photo
      { name: 'Tyrone Lindsey', apr1Amount: 100, apr1Note: 'T(R)' },
      // A few names in the mid-section were unclear; add them later once confirmed
      { name: 'Javon & Javari', apr1Amount: 75, apr1Note: 'T' },
      { name: 'Sam & Chris', apr1Amount: 100, apr1Note: 'T' },
      { name: 'Angela (Merle)', apr1Amount: 50, apr1Note: 'T' },
      { name: 'Olive Getten', apr1Amount: 50, apr1Note: 'T(R)' },
      { name: 'Arlene Lewis', apr1Amount: 50, apr1Note: 'T(R)' },
      { name: 'Katherine Goburn', apr1Amount: 50, apr1Note: 'T(R)' },
      { name: 'Sariah Yates', apr1Amount: 50, apr1Note: 'T(R)' },
      { name: 'Shakira', apr1Amount: 50, apr1Note: 'T' },
      { name: 'Mekala', apr1Amount: 100, apr1Note: 'T' },
      { name: 'Christine & Neville', apr1Amount: 100, apr1Note: 'T' },
      { name: 'Myles', apr1Amount: 50, apr1Note: 'T' },
      { name: 'Mavis', apr1Amount: 50, apr1Note: 'T' },
      { name: 'Viviene', apr1Amount: 50, apr1Note: 'T' }
    ];

    const results: any[] = [];
    for (const r of seed) {
      const id = await reunionPaymentsService.upsert(r);
      results.push({ id, name: r.name });
    }
    return res.status(200).json({ ok: true, count: results.length, results });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e?.message || 'Unknown error' });
  }
}


