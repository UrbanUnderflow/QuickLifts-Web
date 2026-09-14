import type { NextApiRequest, NextApiResponse } from 'next';
/** Public capability flags only. No curriculum, account, or enrollment data. */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  return res.status(200).json({ sharedWrites: process.env.LINEAR_CURRICULUM_PUBLISH_ENABLED === 'true', runtime: process.env.LINEAR_CURRICULUM_RUNTIME_ENABLED === 'true' });
}
