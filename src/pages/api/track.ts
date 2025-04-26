import type { NextApiRequest, NextApiResponse } from 'next';
// Remove the SDK import: import Brevo from '@getbrevo/brevo';

// IMPORTANT: Ensure BREVO_MARKETING_KEY is set in your server environment variables
const brevoApiKey = process.env.BREVO_MARKETING_KEY;

if (!brevoApiKey) {
  console.error(
    'BREVO_MARKETING_KEY environment variable is not set. Brevo tracking via API route disabled.'
  );
}

/**
 * Sends a custom event to Brevo via the REST API.
 * This function should only be called server-side within this API route.
 * @param emailOrUid - The contact's email or unique ID
 * @param eventName - The event name (e.g. 'JoinedChallenge', 'WorkoutCompleted')
 * @param data - Additional event properties (object)
 */
async function sendBrevoEventViaApi(
  emailOrUid: string,
  eventName: string,
  data: Record<string, any> = {}
): Promise<void> {
  if (!brevoApiKey) {
    // Logged at startup, but double-check here
    console.error(
      '[API Route /api/track] Brevo API Key not configured. Skipping event:', eventName
    );
    // Do not throw here, let the handler return a 500
    return; 
  }

  const payload = {
    event: eventName, // Use 'event' based on REST API docs, not 'event_name'
    email: emailOrUid, // Assuming emailOrUid is the email Brevo expects
    properties: data,
    // Add contactProperties if needed, based on Brevo docs/needs
  };

  try {
    console.log(
      `[API Route /api/track] Sending Brevo event via REST: ${eventName} for ${emailOrUid}`
    );
    const response = await fetch('https://api.brevo.com/v3/trackEvent', { // Corrected endpoint based on REST API docs for tracking
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': brevoApiKey,
        'accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // Brevo often returns 202 Accepted or 204 No Content on success for events
    if (!response.ok && response.status !== 202 && response.status !== 204) {
      let errorBody = 'Unknown error';
      try {
        errorBody = await response.text();
      } catch (e) { /* Ignore if reading body fails */ }
      console.error(
        `[API Route /api/track] Brevo API error (${response.status}):`, errorBody
      );
      throw new Error(`Brevo API request failed with status ${response.status}`);
    }

    console.log(
      `[API Route /api/track] Brevo event sent successfully via REST: ${eventName}`
    );
  } catch (error: any) {
    console.error(
      `[API Route /api/track] Error sending Brevo event '${eventName}' via REST:`, error.message || error
    );
    // Rethrow to be caught by the main handler
    throw new Error(`Failed to send Brevo event: ${eventName}`);
  }
}


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const { emailOrUid, eventName, data } = req.body;

  if (!emailOrUid || !eventName) {
    return res.status(400).json({ message: 'Missing required fields: emailOrUid and eventName' });
  }

  if (!brevoApiKey) {
    console.error(
      '[API Route /api/track] Brevo API Key not configured. Cannot track event.'
    );
    return res.status(500).json({ message: 'Tracking configuration error.' });
  }

  try {
    // Call the function using fetch
    await sendBrevoEventViaApi(emailOrUid, eventName, data || {}); 
    // Send success response (Brevo API might return 202/204, but our API route succeeded)
    return res.status(200).json({ message: 'Event tracking initiated successfully' });
  } catch (error: any) {
    console.error(`[API Route /api/track] Handler failed to track event: ${error.message}`);
    return res.status(500).json({ message: 'Failed to track event' });
  }
} 