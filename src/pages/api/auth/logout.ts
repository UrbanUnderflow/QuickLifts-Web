import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { redirect } = req.query;
    const logoutUrl = redirect && typeof redirect === 'string'
      ? `/logout?redirect=${encodeURIComponent(redirect)}`
      : '/logout';

    return res.redirect(302, logoutUrl);

  } catch (error) {
    console.error('Error in logout API:', error);
    
    // Fallback redirect
    const redirectUrl = req.query.redirect
      ? `/logout?redirect=${encodeURIComponent(req.query.redirect as string)}`
      : '/logout';
      
    return res.redirect(302, redirectUrl);
  }
} 
