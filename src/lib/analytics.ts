import mixpanel from 'mixpanel-browser'; // Import the initialized instance

/**
 * Sends an event simultaneously to Mixpanel (client-side) and triggers a server-side Brevo event.
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

  // --- Send to Mixpanel (Client-side) ---
  try {
    mixpanel.track(eventName, {
      distinct_id: emailOrUid,
      platform: 'web',
      ...data,
    });
    console.log('[Analytics] Mixpanel event sent successfully', { eventName, emailOrUid, data });
  } catch (mixpanelError) {
    console.error('[Analytics] Error sending to Mixpanel:', mixpanelError);
  }

  // --- Trigger Server-side Brevo Event via API Route ---
  try {
    // No need to await if we don't need the result immediately (fire and forget)
    fetch('/api/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emailOrUid, eventName, data }),
    })
    .then(response => {
      if (!response.ok) {
        // Log client-side error if API call fails, but don't block user flow
        console.error(`[Analytics] Error calling /api/track for Brevo event '${eventName}': ${response.status} ${response.statusText}`);
      } else {
        console.log(`[Analytics] Successfully triggered /api/track for Brevo event '${eventName}'`);
      }
    })
    .catch(error => {
      console.error(`[Analytics] Network error calling /api/track for Brevo event '${eventName}':`, error);
    });

  } catch (apiCallError) {
    // Catch synchronous errors during fetch setup (unlikely)
    console.error('[Analytics] Error initiating API call to /api/track:', apiCallError);
  }
} 