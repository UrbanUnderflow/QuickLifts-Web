import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Test endpoint to manually trigger review emails
 * Only available in development or with admin auth
 */

interface TestEmailsResponse {
  success: boolean;
  type?: string;
  result?: any;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TestEmailsResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // Only allow in development or with special header
  const isAdmin = req.headers['x-admin-key'] === process.env.ADMIN_API_KEY;
  const isDev = process.env.NODE_ENV !== 'production';
  
  if (!isDev && !isAdmin) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  const { type } = req.body;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 8888}`;

  try {
    let endpoint: string;
    
    switch (type) {
      case 'weekly-checkin':
        endpoint = `${baseUrl}/api/review/send-weekly-checkin`;
        break;
      case 'draft-reminder':
        endpoint = `${baseUrl}/api/review/send-draft-reminder`;
        break;
      default:
        return res.status(400).json({ success: false, error: 'Invalid email type. Use: weekly-checkin or draft-reminder' });
    }

    console.log(`🧪 Testing email: ${type}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': process.env.CRON_SECRET || 'test-secret',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        type,
        error: result.error || 'Failed to send test email'
      });
    }

    return res.status(200).json({
      success: true,
      type,
      result
    });

  } catch (error) {
    console.error('Error testing email:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal Server Error'
    });
  }
}



