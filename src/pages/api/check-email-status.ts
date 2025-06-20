import type { NextApiRequest, NextApiResponse } from 'next';

interface CheckStatusRequest {
  messageId: string;
}

interface CheckStatusResponse {
  success: boolean;
  status?: 'queued' | 'inProgress' | 'processed';
  scheduledAt?: string;
  createdAt?: string;
}

const BREVO_API_KEY = process.env.BREVO_MARKETING_KEY;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CheckStatusResponse | { error: string; success: boolean }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', success: false });
  }

  try {
    const { messageId } = req.body as CheckStatusRequest;

    // Validate input
    if (!messageId?.trim()) {
      return res.status(400).json({ error: 'Message ID is required', success: false });
    }

    if (!BREVO_API_KEY) {
      console.error('Brevo API key (BREVO_MARKETING_KEY) is not set.');
      return res.status(500).json({ error: 'Email service configuration error', success: false });
    }

    console.log(`📊 Checking status for email: ${messageId}`);

    // Check email status using Brevo API
    const response = await fetch(`https://api.brevo.com/v3/smtp/emailStatus/${messageId}`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "api-key": BREVO_API_KEY,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Brevo API Error:", response.status, errorBody);
      
      if (response.status === 404) {
        // Email not found might mean it was already processed
        return res.status(200).json({ 
          success: true,
          status: 'processed'
        });
      }
      
      return res.status(response.status).json({ 
        error: `Failed to check email status: ${errorBody || 'Unknown error'}`,
        success: false
      });
    }

    const data = await response.json();
    console.log("📊 Email status response:", data);

    // Extract status from response
    let status: 'queued' | 'inProgress' | 'processed' = 'processed';
    
    if (data.batches && data.batches.length > 0) {
      const batch = data.batches[0];
      status = batch.status || 'processed';
    }

    return res.status(200).json({
      success: true,
      status: status,
      scheduledAt: data.batches?.[0]?.scheduledAt,
      createdAt: data.batches?.[0]?.createdAt
    });

  } catch (error) {
    console.error("Error in check-email-status function:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal Server Error',
      success: false
    });
  }
} 