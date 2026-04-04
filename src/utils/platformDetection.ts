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
  appStoreUrl: 'https://apps.apple.com/vn/app/fit-with-pulse/id6451497729',
  playStoreUrl: 'https://play.google.com/store/apps/details?id=ai.fitwithpulse.pulse',
  
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
  appStoreWithDeepLink: (_deepLinkPath: string): string => {
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

  const browserWindow = window as Window;
  const browserDocument = document;
  let didOpenApp = browserDocument.visibilityState === 'hidden';

  const iframe = browserDocument.createElement('iframe');
  iframe.style.display = 'none';
  iframe.setAttribute('aria-hidden', 'true');

  let fallbackTimer: number | null = null;

  const cleanup = () => {
    browserDocument.removeEventListener('visibilitychange', handleVisibilityChange);
    browserWindow.removeEventListener('pagehide', handlePageHide);
    browserWindow.removeEventListener('blur', handleBlur);

    if (fallbackTimer !== null) {
      browserWindow.clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }

    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  };

  const markAppOpened = () => {
    didOpenApp = true;
    cleanup();
  };

  const handleVisibilityChange = () => {
    if (browserDocument.visibilityState === 'hidden') {
      markAppOpened();
    }
  };

  const handlePageHide = () => {
    markAppOpened();
  };

  const handleBlur = () => {
    browserWindow.setTimeout(() => {
      if (browserDocument.visibilityState === 'hidden') {
        markAppOpened();
      }
    }, 0);
  };

  browserDocument.addEventListener('visibilitychange', handleVisibilityChange);
  browserWindow.addEventListener('pagehide', handlePageHide);
  browserWindow.addEventListener('blur', handleBlur);

  iframe.src = deepLinkUrl;
  browserDocument.body.appendChild(iframe);
  browserWindow.location.href = deepLinkUrl;

  fallbackTimer = browserWindow.setTimeout(() => {
    if (didOpenApp || browserDocument.visibilityState === 'hidden') {
      cleanup();
      return;
    }

    cleanup();
    browserWindow.location.href = fallbackUrl;
  }, 1600);
};

export default platformDetection;
