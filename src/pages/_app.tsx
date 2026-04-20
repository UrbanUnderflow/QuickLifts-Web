import React, { useEffect } from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';
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

// ─── Default OG fallback ───────────────────────────────────────────
// These are rendered on EVERY page via _app. If a page sets its own
// og:title / og:image via <PageHead> or raw <Head>, Next.js will
// append both — but crawlers pick the LAST occurrence, so page-level
// tags win. Pages that set nothing get this baseline.
//
// The default image is the Pulse Intelligence Labs splash — a pre-rendered
// static PNG (dark gradient, soft orbs, "PIL" wordmark in white→lime
// gradient, styled after the Macra / Fit With Pulse app splash screens).
// We use a static PNG instead of the og-image Lambda because the Lambda's
// librsvg has no access to system fonts and renders text as tofu. The image
// is generated locally via scripts/generate-pil-og.js where macOS fonts work.
const DEFAULT_OG_IMAGE = 'https://fitwithpulse.ai/pil-og.png';
const DEFAULT_TITLE = 'Pulse Community Fitness';
const DEFAULT_DESCRIPTION = 'Real workouts, Real people, move together.';

// Pages that deserve a hand-picked fallback title when they don't set ogMeta.
// Everything else is derived from the URL path.
const PAGE_TITLE_MAP: Record<string, string> = {
  '/': DEFAULT_TITLE,
  '/about': 'About — Pulse',
  '/pricing': 'Pricing — Pulse',
  '/coach': 'Coach — Pulse',
  '/investor': 'Investor — Pulse',
  '/auntedna': 'auntEDNA.ai — Pulse',
  '/pulse-auntedna-pitch': 'Pulse × auntEDNA.ai',
  '/pulse-auntedna-stakeholder-deck': 'Pulse × auntEDNA.ai — Stakeholder Deck',
  '/pulsecheck': 'Pulse Check',
  '/morning-mobility-challenge': 'Morning Mobility — Pulse',
  '/mobility': 'Mobility — Pulse',
  '/terms': 'Terms — Pulse',
  '/delete-account': 'Delete Account — Pulse',
};

function humanizeSlug(slug: string): string {
  return slug
    .replace(/\.(html?|md)$/i, '')
    .replace(/[-_]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => (word.length <= 3 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

function deriveDefaultTitle(pathname: string, asPath: string): string {
  if (PAGE_TITLE_MAP[pathname]) return PAGE_TITLE_MAP[pathname];

  // Dynamic routes give us pathname like '/press/[slug]'; asPath has the real slug.
  const cleanPath = (asPath || pathname).split('?')[0].split('#')[0];
  const segments = cleanPath.split('/').filter(Boolean);
  if (segments.length === 0) return DEFAULT_TITLE;

  const lastSegment = segments[segments.length - 1];
  if (!lastSegment || lastSegment.startsWith('[')) return DEFAULT_TITLE;

  return `${humanizeSlug(lastSegment)} — Pulse`;
}

// Only import in development mode
const isDev = process.env.NODE_ENV === 'development';
if (isDev) {
  require('../utils/envDebug');
}

// Helper component to handle Mixpanel logic, since hooks can only be called inside components
const MixpanelInitializer: React.FC = () => {
  const currentUser = useSelector((state: RootState) => state.user.currentUser);
  const mixpanelToken = process.env.NEXT_PUBLIC_MIXPANEL_PROJECT_TOKEN;
  const mixpanelEnabled = Boolean(mixpanelToken);
  const [mixpanelReady, setMixpanelReady] = React.useState(false);

  // Initialize Mixpanel on mount
  useEffect(() => {
    if (mixpanelEnabled && mixpanelToken) {
      try {
        mixpanel.init(mixpanelToken, {
          debug: process.env.NODE_ENV === 'development',
          track_pageview: true,
          persistence: 'localStorage',
        });
        console.log('[Mixpanel] Initialized');
        mixpanel.register({
          platform: 'web',
          // Optionally add app version if available
          // app_version: process.env.NEXT_PUBLIC_APP_VERSION,
        });
        setMixpanelReady(true);
      } catch (e) {
        console.warn('[Mixpanel] Init failed:', e);
        setMixpanelReady(false);
      }
    } else {
      console.warn('[Mixpanel] Project token not found. Tracking disabled.');
      setMixpanelReady(false);
    }
  }, [mixpanelEnabled, mixpanelToken]);

  // Identify user when available or changes — only if Mixpanel was initialized
  useEffect(() => {
    if (!mixpanelEnabled || !mixpanelReady) {
      return;
    }

    if (currentUser?.id) {
      try {
        mixpanel.identify(currentUser.id);
        mixpanel.people?.set?.({
          $email: currentUser.email,
          $name: currentUser.displayName,
          username: currentUser.username,
          registrationComplete: currentUser.registrationComplete,
        });
        console.log('[Mixpanel] User identified:', currentUser.id);
      } catch (e) {
        console.warn('[Mixpanel] identify failed:', e);
      }
    } else {
      console.log('[Mixpanel] No user identified.');
    }
  }, [currentUser, mixpanelEnabled, mixpanelReady]);

  return null;
};

const MyApp: React.FC<AppProps> = ({ Component, pageProps }) => {
  const router = useRouter();

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

  // ── SSR-safe OG meta extraction ──────────────────────────────────
  // PersistGate renders `null` during SSR, blocking all page-level <Head>
  // from being included in the initial HTML. Crawlers (iMessage, WhatsApp,
  // Twitter, Slack) only see the server-rendered HTML, so OG tags MUST be
  // rendered here at the _app level, outside PersistGate.
  //
  // Pages that need custom OG tags pass `ogMeta` via getServerSideProps:
  //   { title, description, image, url, lastUpdated }
  const ogMeta = (pageProps as any)?.ogMeta as
    | { title: string; description: string; image: string; url: string }
    | undefined;

  const derivedTitle = ogMeta?.title
    ? ogMeta.title
    : deriveDefaultTitle(router?.pathname || '/', router?.asPath || '/');

  const ogTitle = derivedTitle;
  const ogDescription = ogMeta?.description || DEFAULT_DESCRIPTION;
  const ogImage = ogMeta?.image || DEFAULT_OG_IMAGE;
  const ogUrl = ogMeta?.url || '';

  return (
    <>
      {/* OG meta tags — rendered at _app level so they survive SSR even
          when PersistGate blocks page rendering. Page-specific values
          come from ogMeta in pageProps (set by getServerSideProps). */}
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" key="viewport" />
        <meta property="og:site_name" content="Pulse Fitness" />
        <meta property="og:type" content={ogMeta ? 'article' : 'website'} />
        <meta property="og:title" content={ogTitle} key="og:title" />
        <meta property="og:description" content={ogDescription} key="og:description" />
        <meta property="og:image" content={ogImage} key="og:image" />
        <meta property="og:image:secure_url" content={ogImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        {ogUrl && <meta property="og:url" content={ogUrl} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} key="twitter:title" />
        <meta name="twitter:description" content={ogDescription} key="twitter:description" />
        <meta name="twitter:image" content={ogImage} key="twitter:image" />
      </Head>

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
