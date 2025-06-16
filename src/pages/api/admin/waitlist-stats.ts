import type { NextApiRequest, NextApiResponse } from 'next';
import { FirestoreWaitlistService } from '../../../lib/firestore-waitlist';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Simple auth check - you can enhance this with proper authentication
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.ADMIN_API_TOKEN;
  
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const stats = await FirestoreWaitlistService.getWaitlistStats();
    
    return res.status(200).json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Admin] Error fetching waitlist stats:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch waitlist statistics',
      message: error.message 
    });
  }
} 