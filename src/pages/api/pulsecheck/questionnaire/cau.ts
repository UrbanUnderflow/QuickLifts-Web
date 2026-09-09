import type { NextApiRequest, NextApiResponse } from 'next';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }
  // The combined temporary-storage path has been retired. Do not persist or
  // log request bodies while the direct auntEDNA questionnaire contract is pending.
  return res.status(503).json({ error: 'Saving is paused while the direct auntEDNA connection is being completed. Your answers have not been submitted.' });
}
