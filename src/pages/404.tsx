import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

const Custom404: React.FC = () => {
  const router = useRouter();
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const info = {
        userAgent: navigator.userAgent,
        currentUrl: window.location.href,
        referrer: document.referrer,
        isAndroid: /Android/i.test(navigator.userAgent),
        isChrome: /Chrome/i.test(navigator.userAgent),
        isSamsung: /SamsungBrowser/i.test(navigator.userAgent),
        timestamp: new Date().toISOString(),
        pathname: router.asPath,
      };
      
      setDebugInfo(info);
      
      // Log for debugging
      console.error('[404] Page not found:', info);
      
      // Send analytics event if available
      if (window.gtag) {
        window.gtag('event', 'page_not_found', {
          page_path: router.asPath,
          user_agent: navigator.userAgent,
        });
      }
    }
  }, [router.asPath]);

  const handleRetry = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    router.push('/');
  };

  return (
    <>
      <Head>
        <title>Page Not Found | Pulse</title>
        <meta name="description" content="The page you're looking for doesn't exist." />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      
      <div className="min-h-screen bg-zinc-900 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="mb-8">
            <img src="/pulse-logo-white.svg" alt="Pulse" className="h-12 mx-auto mb-6" />
            <h1 className="text-4xl font-bold mb-4">404</h1>
            <h2 className="text-xl font-semibold mb-4">Page Not Found</h2>
            <p className="text-zinc-400 mb-6">
              The page you're looking for doesn't exist or may have been moved.
            </p>
          </div>
          
          {debugInfo.isAndroid && (
            <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
              <p className="text-yellow-400 text-sm">
                <strong>Android User:</strong> If you're experiencing issues, try refreshing the page or clearing your browser cache.
              </p>
            </div>
          )}
          
          <div className="space-y-4 mb-8">
            <button
              onClick={handleRetry}
              className="w-full bg-[#E0FE10] text-black font-semibold py-3 px-4 rounded-lg hover:bg-[#c8e60e] transition-colors"
            >
              Refresh Page
            </button>
            
            <button
              onClick={handleGoHome}
              className="w-full bg-zinc-800 text-white font-semibold py-3 px-4 rounded-lg hover:bg-zinc-700 transition-colors"
            >
              Go to Home
            </button>
          </div>
          
          <div className="space-y-2 text-sm">
            <Link href="/about" className="block text-zinc-400 hover:text-[#E0FE10] transition-colors">
              About Pulse
            </Link>
            <Link href="/rounds" className="block text-zinc-400 hover:text-[#E0FE10] transition-colors">
              Rounds Feature
            </Link>
            <Link href="/creator" className="block text-zinc-400 hover:text-[#E0FE10] transition-colors">
              Creator Program
            </Link>
          </div>
          
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-8 text-left">
              <summary className="cursor-pointer text-zinc-400 hover:text-white text-sm">
                Debug Information (Development)
              </summary>
              <pre className="mt-2 p-4 bg-zinc-800 rounded text-xs overflow-auto text-green-400">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </>
  );
};

export default Custom404; 