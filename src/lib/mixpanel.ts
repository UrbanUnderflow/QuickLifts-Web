import mixpanel from 'mixpanel-browser';

let helperInitialized = false;

function ensureMixpanelReady(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const token = process.env.NEXT_PUBLIC_MIXPANEL_PROJECT_TOKEN;
  if (!token) {
    return false;
  }

  if (helperInitialized) {
    return true;
  }

  try {
    mixpanel.init(token, {
      debug: process.env.NODE_ENV === 'development',
      persistence: 'localStorage',
    });
    mixpanel.register({
      platform: 'web',
    });
    helperInitialized = true;
    return true;
  } catch (error) {
    console.error('[Mixpanel] Helper init failed:', error);
    return false;
  }
}

export function safeTrackMixpanel(eventName: string, properties: Record<string, any> = {}): boolean {
  try {
    mixpanel.track(eventName, properties);
    return true;
  } catch (error) {
    if (!ensureMixpanelReady()) {
      console.warn('[Mixpanel] Skipping track because Mixpanel is not ready:', eventName, error);
      return false;
    }

    try {
      mixpanel.track(eventName, properties);
      return true;
    } catch (retryError) {
      console.error('[Mixpanel] Failed to track event after retry:', eventName, retryError);
      return false;
    }
  }
}
