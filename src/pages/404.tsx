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
  const [debugCode, setDebugCode] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Generate a unique debug code for this 404 instance
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      setDebugCode(code);

      // Parse URL components
      const url = new URL(window.location.href);
      const pathSegments = url.pathname.split('/').filter(Boolean);
      
      // Detect potential round/challenge URLs
      const isRoundUrl = pathSegments.includes('round') || pathSegments.includes('round-invitation');
      const roundId = isRoundUrl ? pathSegments[pathSegments.indexOf('round') + 1] || pathSegments[pathSegments.indexOf('round-invitation') + 1] : null;
      
      const info = {
        // Basic info
        debugCode: code,
        timestamp: new Date().toISOString(),
        currentUrl: window.location.href,
        pathname: router.asPath,
        referrer: document.referrer,
        
        // URL Analysis
        urlComponents: {
          protocol: url.protocol,
          host: url.host,
          pathname: url.pathname,
          search: url.search,
          hash: url.hash,
          pathSegments: pathSegments,
        },
        
        // Route Analysis
        routeAnalysis: {
          isRoundUrl,
          roundId,
          possibleIntendedRoute: isRoundUrl ? (roundId ? `/round/${roundId}` : '/round/[missing-id]') : 'unknown',
          pathDepth: pathSegments.length,
          hasQueryParams: url.search.length > 0,
          queryParams: Object.fromEntries(url.searchParams.entries()),
        },
        
        // Device & Browser info
        device: {
          userAgent: navigator.userAgent,
          isAndroid: /Android/i.test(navigator.userAgent),
          isIOS: /iPhone|iPad|iPod/i.test(navigator.userAgent),
          isChrome: /Chrome/i.test(navigator.userAgent),
          isSamsung: /SamsungBrowser/i.test(navigator.userAgent),
          isSafari: /Safari/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent),
          isFirefox: /Firefox/i.test(navigator.userAgent),
          isMobile: /Mobi|Android/i.test(navigator.userAgent),
          screenSize: `${window.screen.width}x${window.screen.height}`,
          viewportSize: `${window.innerWidth}x${window.innerHeight}`,
        },
        
        // Network & Performance
        network: {
          connectionType: (navigator as any).connection?.effectiveType || 'unknown',
          downlink: (navigator as any).connection?.downlink || 'unknown',
          rtt: (navigator as any).connection?.rtt || 'unknown',
        },
        
        // Session info
        session: {
          cookiesEnabled: navigator.cookieEnabled,
          language: navigator.language,
          languages: navigator.languages,
          platform: navigator.platform,
          onLine: navigator.onLine,
          localStorage: (() => {
            try {
              return localStorage.length > 0 ? `${localStorage.length} items` : 'empty';
            } catch {
              return 'unavailable';
            }
          })(),
        },
        
        // Potential issues
        potentialIssues: [
          ...(isRoundUrl && !roundId ? ['Missing round ID in URL'] : []),
          ...(url.pathname.includes('//') ? ['Double slashes in URL'] : []),
          ...(url.pathname.includes('%') ? ['URL encoding issues'] : []),
          ...(/[^a-zA-Z0-9\-_\/\.]/.test(url.pathname) ? ['Special characters in path'] : []),
          ...(pathSegments.length > 5 ? ['Very deep URL path'] : []),
        ],
      };
      
      setDebugInfo(info);
      
      // Enhanced logging
      console.group(`[404] Page Not Found - Debug Code: ${code}`);
      console.error('Full Debug Info:', info);
      console.error('Quick Summary:', {
        url: window.location.href,
        intended: info.routeAnalysis.possibleIntendedRoute,
        device: `${info.device.isAndroid ? 'Android' : info.device.isIOS ? 'iOS' : 'Desktop'} - ${info.device.isChrome ? 'Chrome' : info.device.isSafari ? 'Safari' : 'Other'}`,
        issues: info.potentialIssues,
      });
      console.groupEnd();
      
      // Send analytics event if available
      if (window.gtag) {
        window.gtag('event', 'page_not_found', {
          page_path: router.asPath,
          user_agent: navigator.userAgent,
          debug_code: code,
          is_round_url: isRoundUrl,
          round_id: roundId,
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
            
            {/* Show the actual problem in plain English */}
            <div className="mb-6 p-4 bg-red-900/20 border border-red-600/30 rounded-lg">
              <p className="text-red-400 text-sm mb-2">
                <strong>What happened:</strong>
              </p>
              <div className="text-red-300 text-sm space-y-1">
                <p>You tried to go to: <code className="bg-black/50 px-2 py-1 rounded text-xs">{debugInfo.currentUrl}</code></p>
                {debugInfo.routeAnalysis?.isRoundUrl ? (
                  debugInfo.routeAnalysis.roundId ? (
                    <p>This looks like a challenge/round link, but the page doesn't exist.</p>
                  ) : (
                    <p>This challenge/round link is missing the ID number.</p>
                  )
                ) : (
                  <p>This page doesn't exist on our website.</p>
                )}
              </div>
            </div>
            
            {/* URL Analysis */}
            {debugInfo.routeAnalysis?.isRoundUrl && (
              <div className="mb-6 p-4 bg-blue-900/20 border border-blue-600/30 rounded-lg">
                <p className="text-blue-400 text-sm mb-2">
                  <strong>Round/Challenge URL Detected:</strong>
                </p>
                <div className="text-blue-300 text-sm space-y-1">
                  <p>Attempted URL: <code className="bg-black/50 px-2 py-1 rounded text-xs">{debugInfo.currentUrl}</code></p>
                  {debugInfo.routeAnalysis.roundId ? (
                    <p>Round ID: <code className="bg-black/50 px-2 py-1 rounded text-xs">{debugInfo.routeAnalysis.roundId}</code></p>
                  ) : (
                    <p className="text-yellow-400">⚠️ Missing Round ID in URL</p>
                  )}
                  <p>Suggested: <code className="bg-black/50 px-2 py-1 rounded text-xs">{debugInfo.routeAnalysis.possibleIntendedRoute}</code></p>
                </div>
              </div>
            )}
            
            {/* Potential Issues */}
            {debugInfo.potentialIssues && debugInfo.potentialIssues.length > 0 && (
              <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                <p className="text-yellow-400 text-sm mb-2">
                  <strong>Potential Issues Detected:</strong>
                </p>
                <ul className="text-yellow-300 text-sm space-y-1">
                  {debugInfo.potentialIssues.map((issue: string, index: number) => (
                    <li key={index}>• {issue}</li>
                  ))}
                </ul>
              </div>
            )}
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
          
          {/* Simple tech info for support */}
          <div className="mt-8 text-left">
            <div className="p-3 bg-zinc-800 rounded">
              <h4 className="text-white text-sm font-semibold mb-2">📱 Technical Info (for support):</h4>
              <div className="text-xs space-y-1 text-zinc-300">
                <p><strong>Page you tried:</strong> {debugInfo.currentUrl}</p>
                <p><strong>Your device:</strong> {debugInfo.device?.isAndroid ? 'Android Phone' : debugInfo.device?.isIOS ? 'iPhone/iPad' : 'Computer'}</p>
                <p><strong>Browser:</strong> {debugInfo.device?.isChrome ? 'Chrome' : debugInfo.device?.isSafari ? 'Safari' : debugInfo.device?.isSamsung ? 'Samsung Browser' : 'Other'}</p>
                <p><strong>When:</strong> {new Date(debugInfo.timestamp).toLocaleString()}</p>
                {debugInfo.referrer && (
                  <p><strong>Came from:</strong> {debugInfo.referrer}</p>
                )}
                {debugInfo.routeAnalysis?.isRoundUrl && (
                  <p><strong>Round/Challenge ID:</strong> {debugInfo.routeAnalysis.roundId || 'MISSING - This is the problem!'}</p>
                )}
              </div>
              
              <button
                onClick={() => {
                  const simpleDebugText = `Problem: Page not found\nURL: ${debugInfo.currentUrl}\nDevice: ${debugInfo.device?.isAndroid ? 'Android' : debugInfo.device?.isIOS ? 'iOS' : 'Desktop'} ${debugInfo.device?.isChrome ? 'Chrome' : debugInfo.device?.isSafari ? 'Safari' : debugInfo.device?.isSamsung ? 'Samsung' : 'Other'}\nTime: ${new Date(debugInfo.timestamp).toLocaleString()}\nCame from: ${debugInfo.referrer || 'Direct link'}\nIssue: ${debugInfo.routeAnalysis?.isRoundUrl ? (debugInfo.routeAnalysis.roundId ? 'Round page missing' : 'Round ID missing from URL') : 'Page does not exist'}`;
                  navigator.clipboard.writeText(simpleDebugText).then(() => {
                    alert('Info copied! You can paste this to support.');
                  }).catch(() => {
                    const textArea = document.createElement('textarea');
                    textArea.value = simpleDebugText;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    alert('Info copied! You can paste this to support.');
                  });
                }}
                className="w-full bg-blue-600 text-white text-sm py-2 px-4 rounded hover:bg-blue-700 transition-colors mt-3"
              >
                📋 Copy Info for Support
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Custom404; 