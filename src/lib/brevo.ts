import Brevo from '@getbrevo/brevo';

// Initialize Brevo Events API client
const eventsApi = new Brevo.EventsApi();
eventsApi.setApiKey(Brevo.EventsApiApiKeys.apiKey, process.env.BREVO_MARKETING_KEY!);

/**
 * Send a custom event to Brevo for a contact (by email or UID).
 * @param emailOrUid - The contact's email or unique ID
 * @param eventName - The event name (e.g. 'JoinedChallenge', 'WorkoutCompleted')
 * @param data - Additional event properties (object)
 */
export async function sendBrevoEvent(
  emailOrUid: string,
  eventName: string,
  data: Record<string, any> = {}
) {
  try {
    const res = await fetch('https://api.brevo.com/v3/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_MARKETING_KEY as string,
        'accept': 'application/json',
      },
      body: JSON.stringify({
        event_name: eventName,
        identifiers: { email_id: emailOrUid },
        event_properties: data,
      }),
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Brevo event error: ${error}`);
    }
  } catch (e) {
    console.error('Brevo event error', e);
  }
} 