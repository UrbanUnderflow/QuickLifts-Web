/**
 * Platform Detection Utilities
 * Used for smart routing between iOS app and web experiences
 */

export const platformDetection = {
  /**
   * Check if the user is on an iOS device (iPhone, iPad, iPod)
   */
  isIOS: (): boolean => {
    if (typeof window === 'undefined') return false;
    
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent);
  },

  /**
   * Check if the user is on an Android device
   */
  isAndroid: (): boolean => {
    if (typeof window === 'undefined') return false;
    
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /android/.test(userAgent);
  },

  /**
   * Check if the user is on any mobile device
   */
  isMobile: (): boolean => {
    if (typeof window === 'undefined') return false;
    
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod|android|webos|blackberry|windows phone/.test(userAgent);
  },

  /**
   * Check if the user is on desktop
   */
  isDesktop: (): boolean => {
    return !platformDetection.isMobile();
  },

  /**
   * Check if the app is running in standalone mode (installed as PWA)
   */
  isStandalone: (): boolean => {
    if (typeof window === 'undefined') return false;
    
    return ('standalone' in window.navigator) && (window.navigator as any).standalone;
  },

  /**
   * Get the current platform
   */
  getPlatform: (): 'ios' | 'android' | 'desktop' => {
    if (platformDetection.isIOS()) return 'ios';
    if (platformDetection.isAndroid()) return 'android';
    return 'desktop';
  }
};

/**
 * App Store and Deep Link URLs
 */
export const appLinks = {
  appStoreUrl: 'https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729',
  
  // Deep link schemes
  pulseScheme: 'pulse://',
  
  /**
   * Generate a deep link URL for creator onboarding
   */
  creatorOnboardingDeepLink: (): string => {
    return 'pulse://creator-onboarding';
  },
  
  /**
   * Generate an App Store URL with a specific deep link parameter
   * This uses the App Store's ability to pass parameters to the app on first launch
   */
  appStoreWithDeepLink: (deepLinkPath: string): string => {
    // The App Store doesn't directly support deep link parameters,
    // but we can use AppsFlyer OneLink for deferred deep linking
    // For now, just return the App Store URL
    return appLinks.appStoreUrl;
  }
};

/**
 * Smart routing for creator onboarding
 * - iOS: Deep link to app or App Store
 * - Android/Desktop: Route to web onboarding
 */
export const routeCreatorOnboarding = (): { action: 'deep-link' | 'app-store' | 'web', url: string } => {
  const platform = platformDetection.getPlatform();
  
  if (platform === 'ios') {
    // For iOS, we'll try to open the app via deep link
    // The calling code should handle the fallback to App Store
    return {
      action: 'deep-link',
      url: appLinks.creatorOnboardingDeepLink()
    };
  }
  
  // For Android and Desktop, use web onboarding
  return {
    action: 'web',
    url: '/creator-onboarding'
  };
};

/**
 * Attempt to open the iOS app via deep link
 * Falls back to App Store after a timeout
 */
export const openIOSAppOrStore = (deepLinkUrl: string, fallbackUrl: string = appLinks.appStoreUrl): void => {
  if (typeof window === 'undefined') return;
  
  const startTime = Date.now();
  
  // Create a hidden iframe to attempt opening the app
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = deepLinkUrl;
  document.body.appendChild(iframe);
  
  // Also try direct location change
  window.location.href = deepLinkUrl;
  
  // Set up fallback to App Store
  setTimeout(() => {
    // If we're still on this page after 1.5 seconds, the app probably isn't installed
    // Check if the page is still visible (user hasn't left)
    if (document.visibilityState === 'visible' && Date.now() - startTime < 2000) {
      window.location.href = fallbackUrl;
    }
    
    // Clean up iframe
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }, 1500);
};

export default platformDetection;

