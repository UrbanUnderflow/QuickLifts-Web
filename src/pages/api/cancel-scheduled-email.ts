import type { NextApiRequest, NextApiResponse } from 'next';

interface CancelEmailRequest {
  messageId: string;
}

interface CancelEmailResponse {
  success: boolean;
  message?: string;
}

const BREVO_API_KEY = process.env.BREVO_MARKETING_KEY;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CancelEmailResponse | { error: string; success: boolean }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', success: false });
  }

  try {
    const { messageId } = req.body as CancelEmailRequest;

    // Validate input
    if (!messageId?.trim()) {
      return res.status(400).json({ error: 'Message ID is required', success: false });
    }

    if (!BREVO_API_KEY) {
      console.error('Brevo API key (BREVO_MARKETING_KEY) is not set.');
      return res.status(500).json({ error: 'Email service configuration error', success: false });
    }

    console.log(`🚫 Cancelling scheduled email: ${messageId}`);

    // Cancel email using Brevo API
    const response = await fetch(`https://api.brevo.com/v3/smtp/email/${messageId}`, {
      method: "DELETE",
      headers: {
        "Accept": "application/json",
        "api-key": BREVO_API_KEY,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Brevo API Error:", response.status, errorBody);
      
      if (response.status === 404) {
        return res.status(404).json({ 
          error: 'Email not found or already sent',
          success: false
        });
      }
      
      return res.status(response.status).json({ 
        error: `Failed to cancel email: ${errorBody || 'Unknown error'}`,
        success: false
      });
    }

    console.log("✅ Email cancelled successfully via Brevo");

    return res.status(200).json({
      success: true,
      message: 'Email cancelled successfully'
    });

  } catch (error) {
    console.error("Error in cancel-scheduled-email function:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal Server Error',
      success: false
    });
  }
} 