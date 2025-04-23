import { sendBrevoEvent } from './brevo';
import mixpanel from 'mixpanel-browser'; // Import the initialized instance

/**
 * Sends an event simultaneously to Mixpanel and Brevo.
 * Use this as the single point for tracking key user actions.
 * @param emailOrUid - The contact's email or unique ID (used as distinct_id in Mixpanel)
 * @param eventName - The event name (e.g. 'JoinedChallenge', 'WorkoutCompleted')
 * @param data - Additional event properties (object), sent to both platforms
 */
export async function trackEvent(
  emailOrUid: string,
  eventName: string,
  data: Record<string, any> = {}
) {
  console.log(`[Analytics] Tracking event: ${eventName}`, { emailOrUid, ...data });

  // --- Send to Mixpanel ---
  try {
    // Use the imported mixpanel instance
    mixpanel.track(eventName, {
      distinct_id: emailOrUid, // Ensure Mixpanel knows who performed the event
      platform: 'web', // Explicitly tag web events
      ...data, // Include event-specific properties
    });
    console.log('[Analytics] Mixpanel event sent successfully', { eventName, emailOrUid, data });
  } catch (mixpanelError) {
    console.error('[Analytics] Error sending to Mixpanel:', mixpanelError);
  }

  // --- Send to Brevo --- 
  try {
    await sendBrevoEvent(emailOrUid, eventName, data);
    console.log('[Analytics] Brevo event sent successfully', { eventName, emailOrUid });
  } catch (brevoError) {
    // Error is already logged within sendBrevoEvent, but catch here too if needed
    console.error('[Analytics] Error sending event to Brevo caught in wrapper:', brevoError);
  }
} 