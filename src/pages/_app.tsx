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
import ErrorBoundary from '../components/ErrorBoundary';
import RouterErrorBoundary from '../components/RouterErrorBoundary';

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
  // Add debugging for Android issues
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('[App] User Agent:', navigator.userAgent);
      console.log('[App] Current URL:', window.location.href);
      
      // Check for Android-specific issues
      const isAndroid = /Android/i.test(navigator.userAgent);
      if (isAndroid) {
        console.log('[App] Android device detected');
        
        // Add Android-specific error handling
        window.addEventListener('error', (event) => {
          console.error('[App] Android Error:', event.error);
        });
        
        window.addEventListener('unhandledrejection', (event) => {
          console.error('[App] Android Unhandled Rejection:', event.reason);
        });
      }
    }
  }, []);

  return (
    <>
      {/* Google Analytics */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-XXXXXXXXXX');
        `}
      </Script>

      <Provider store={store}>
        <ErrorBoundary fallbackRender={(error) => (
          <div style={{ padding: '20px', textAlign: 'center', color: 'white', backgroundColor: 'black', minHeight: '100vh' }}>
            <h1>Application Error</h1>
            <p>We've encountered an unexpected issue. Please try again later.</p>
            {process.env.NODE_ENV === 'development' && error && (
              <pre style={{ marginTop: '20px', textAlign: 'left', background: '#333', padding: '10px', borderRadius: '5px', color: '#ffcccc' }}>
                {error.toString()}
              </pre>
            )}
          </div>
        )}>
          <PersistGate loading={null} persistor={persistor}>
            <RouterErrorBoundary>
              <MixpanelInitializer />
              <AuthWrapper>
                <Component {...pageProps} />
              </AuthWrapper>
              <Toast />
              <GlobalLoader />
            </RouterErrorBoundary>
          </PersistGate>
        </ErrorBoundary>
      </Provider>
    </>
  );
};

export default MyApp;