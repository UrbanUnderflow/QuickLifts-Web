import React, { useEffect } from 'react';
import type { AppProps } from 'next/app';
import { Provider, useSelector } from 'react-redux';
import { store, persistor } from '../redux/store'; 
import { PersistGate } from 'redux-persist/integration/react';
import '../components/Footer/GlisteningButton.css';
import '../index.css';
import '../styles/animations.css';
import Script from 'next/script';
import mixpanel from 'mixpanel-browser';
import { RootState } from '../redux/store';

import AuthWrapper from '../components/AuthWrapper';
import Toast from '../components/common/Toast';
import GlobalLoader from '../components/common/GlobalLoader';

// Only import in development mode
const isDev = process.env.NODE_ENV === 'development';
if (isDev) {
  require('../utils/envDebug');
}

// Helper component to handle Mixpanel logic, since hooks can only be called inside components
const MixpanelInitializer: React.FC = () => {
  const currentUser = useSelector((state: RootState) => state.user.currentUser);

  // Initialize Mixpanel on mount
  useEffect(() => {
    const mixpanelToken = process.env.NEXT_PUBLIC_MIXPANEL_PROJECT_TOKEN;
    if (mixpanelToken) {
      mixpanel.init(mixpanelToken, {
        debug: process.env.NODE_ENV === 'development',
        track_pageview: true,
        persistence: 'localStorage',
      });
      console.log('[Mixpanel] Initialized');
      // Register super properties that apply to all web events
      mixpanel.register({
        platform: 'web',
        // Optionally add app version if available
        // app_version: process.env.NEXT_PUBLIC_APP_VERSION,
      });
    } else {
      console.warn('[Mixpanel] Project token not found. Tracking disabled.');
    }
  }, []);

  // Identify user when available or changes
  useEffect(() => {
    if (currentUser?.id) {
      mixpanel.identify(currentUser.id);
      mixpanel.people.set({
        $email: currentUser.email,
        $name: currentUser.displayName,
        username: currentUser.username,
        registrationComplete: currentUser.registrationComplete,
      });
      console.log('[Mixpanel] User identified:', currentUser.id);
    } else {
      console.log('[Mixpanel] No user identified.');
    }
  }, [currentUser]);

  return null;
};

const MyApp: React.FC<AppProps> = ({ Component, pageProps }) => {
  useEffect(() => {
    // Log a reminder about environment debugging in development mode
    if (isDev && typeof window !== 'undefined') {
      console.log('🔧 Debug tools available in development mode. Try window.debugEnv() in console.');
    }
  }, []);

  return (    
    <>
      {/* TikTok Pixel Code Start (Global) */}
      <Script id="tiktok-pixel" strategy="afterInteractive">
        {`
          !function (w, d, t) {
            w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))};};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e;},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
            ttq.load('D03A763C77UE0J0RV17G');
            ttq.page();
          }(window, document, 'ttq');
        `}
      </Script>
      {/* TikTok Pixel Code End (Global) */}
      {/* Redux Provider and App Content */}
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <MixpanelInitializer />
          <AuthWrapper>
            <Component {...pageProps} />
          </AuthWrapper>
          <Toast />
          <GlobalLoader />
        </PersistGate>
      </Provider>
    </>
  );
};

export default MyApp;