import React, { useState, useEffect } from 'react';
import { FaXmark } from 'react-icons/fa6';

interface SmartAppBannerProps {
  variant?: 'top' | 'bottom';
}

const APP_STORE_URL = 'https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729';

const SmartAppBanner: React.FC<SmartAppBannerProps> = ({ variant = 'bottom' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if user has previously dismissed the banner
    const dismissed = localStorage.getItem('pulse_app_banner_dismissed');
    if (dismissed) {
      setIsDismissed(true);
      return;
    }

    // Detect iOS device
    const checkIsIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
      const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone;
      
      // Don't show if already in the app (standalone mode)
      if (isInStandaloneMode) return false;
      
      return isIOSDevice;
    };

    const iosDetected = checkIsIOS();
    setIsIOS(iosDetected);
    setIsVisible(iosDetected);
  }, []);

  const handleOpenApp = () => {
    // Try to open the app first using universal link
    // If app is installed, it will open; otherwise, it falls back to App Store
    
    // Try universal link first (more reliable on iOS 9+)
    window.location.href = APP_STORE_URL;
    
    // Alternative approach: Try custom scheme, then fall back
    // setTimeout(() => {
    //   // If we're still here after 1.5s, app probably isn't installed
    //   if (Date.now() - now < 2000) {
    //     window.location.href = APP_STORE_URL;
    //   }
    // }, 1500);
    // window.location.href = APP_SCHEME;
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    // Remember dismissal for 24 hours
    localStorage.setItem('pulse_app_banner_dismissed', Date.now().toString());
    
    // Clear after 24 hours
    setTimeout(() => {
      localStorage.removeItem('pulse_app_banner_dismissed');
    }, 24 * 60 * 60 * 1000);
  };

  if (!isVisible || isDismissed || !isIOS) return null;

  if (variant === 'top') {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 safe-area-top">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center overflow-hidden">
              <img src="/logo192.png" alt="Pulse" className="w-10 h-10" />
            </div>
            <div>
              <div className="text-white font-semibold text-sm">Pulse</div>
              <div className="text-zinc-400 text-xs">Open in the Pulse app</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenApp}
              className="bg-[#E0FE10] text-black px-4 py-1.5 rounded-full font-bold text-sm hover:bg-lime-300 transition-colors"
            >
              OPEN
            </button>
            <button
              onClick={handleDismiss}
              className="p-2 text-zinc-400 hover:text-white transition-colors"
              aria-label="Dismiss"
            >
              <FaXmark className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Bottom variant (Instagram-style persistent link)
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
      <div className="bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800">
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <button
            onClick={handleOpenApp}
            className="flex-1 text-center text-[#E0FE10] font-semibold text-base hover:text-lime-300 transition-colors"
          >
            Use the app
          </button>
          <button
            onClick={handleDismiss}
            className="p-2 text-zinc-500 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <FaXmark className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SmartAppBanner;

