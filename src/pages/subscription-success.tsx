import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowRight, CheckCircle2, Download } from 'lucide-react';
import { RootState } from '../redux/store';
import { useUser } from '../hooks/useUser';
import { clearRoundIdRedirect, clearLoginRedirectPath } from '../redux/tempRedirectSlice';
import { isLocalhost } from '../utils/stripeKey';

// Define verification status types
type VerificationStatus = 'idle' | 'verifying' | 'verified' | 'error';

const MACRA_WEB_OFFER_SOURCE = 'macra_web_offer_24h';
const MACRA_APP_STORE_URL = 'https://apps.apple.com/us/app/macra-ai-calorie/id6463771067';
const MACRA_OPEN_URL = 'macra://subscription/success';

const singleQueryValue = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) return value[0] || '';
  return typeof value === 'string' ? value : '';
};

const buildAppReturnUrl = (baseUrl: string, params: Record<string, string | undefined>) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });

  try {
    const url = new URL(baseUrl);
    searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
    return url.toString();
  } catch {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${searchParams.toString()}`;
  }
};

const redirectToApp = (baseUrl: string, params: Record<string, string | undefined>) => {
  window.location.replace(buildAppReturnUrl(baseUrl, params));
};

const SubscriptionSuccessPage: React.FC = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const currentUser = useUser(); // Check user status
  const { roundIdRedirect: _roundIdRedirect, loginRedirectPath: _loginRedirectPath } = useSelector((state: RootState) => state.tempRedirect);
  const [countdown, setCountdown] = useState(5); // Countdown state (5 seconds)
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifiedAccountEmail, setVerifiedAccountEmail] = useState('');
  const [isLocal, setIsLocal] = useState(false);

  useEffect(() => {
    setIsLocal(isLocalhost());
  }, []);

  const sessionId = router.isReady ? singleQueryValue(router.query.session_id) : '';
  const queryUserId = router.isReady ? singleQueryValue(router.query.userId) : '';
  const appReturnUrl = router.isReady ? singleQueryValue(router.query.appReturnUrl) : '';
  const source = router.isReady ? singleQueryValue(router.query.source) : '';
  const macraOfferStatus = router.isReady ? singleQueryValue(router.query.status || router.query.macra_offer) : '';
  const isCancelledReturn = router.isReady && singleQueryValue(router.query.cancelled) === '1';
  const isMacraWebOffer = source === MACRA_WEB_OFFER_SOURCE;
  const isMacraAlreadyActiveReturn = isMacraWebOffer && macraOfferStatus === 'already_active';
  const verificationUserId = isMacraWebOffer ? queryUserId : currentUser?.id || queryUserId;

  useEffect(() => {
    if (!router.isReady || !isCancelledReturn) return;

    if (appReturnUrl) {
      redirectToApp(appReturnUrl, {
        status: 'cancelled',
        userId: verificationUserId,
        source,
      });
      return;
    }

    router.replace('/subscribe');
  }, [router, router.isReady, isCancelledReturn, appReturnUrl, verificationUserId, source]);

  // Effect for verification
  useEffect(() => {
    // Only run verification if router is ready and we haven't started yet.
    // App checkout returns include the app user id, so the user does not need
    // to be logged into the web app for this page to verify the Stripe session.
    if (router.isReady && !isCancelledReturn && !isMacraAlreadyActiveReturn && verificationStatus === 'idle') {
      if (!verificationUserId) {
        console.error('[SubscriptionSuccess] Missing user id for subscription verification.');

        if (appReturnUrl) {
          redirectToApp(appReturnUrl, {
            status: 'error',
            error: 'missing_user_id',
            session_id: sessionId,
            source,
          });
          return;
        }

        const errorParams = new URLSearchParams({
          message: 'Missing account information. Please try subscribing again.',
          error: 'MISSING_USER_ID',
          details: 'The user ID was not found in the URL parameters.'
        });

        router.replace(`/subscription-error?${errorParams.toString()}`);
        return;
      }

      if (!sessionId) {
        console.error('[SubscriptionSuccess] Missing session_id in query parameters.');

        if (appReturnUrl) {
          redirectToApp(appReturnUrl, {
            status: 'error',
            error: 'missing_session_id',
            userId: verificationUserId,
            source,
          });
          return;
        }
        
        // Redirect to error page for missing session ID
        const errorParams = new URLSearchParams({
          message: 'Missing payment session information. Please try subscribing again.',
          error: 'MISSING_SESSION_ID',
          details: 'The payment session ID was not found in the URL parameters.'
        });
        
        router.replace(`/subscription-error?${errorParams.toString()}`);
        return;
      }

      console.log('[SubscriptionSuccess] Starting verification with session_id:', sessionId);
      setVerificationStatus('verifying');
      setErrorMessage(null);

      // Define async function to call backend API
      const verifySession = async () => {
        try {
          const response = await fetch('/.netlify/functions/verify-subscription', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sessionId: sessionId, userId: verificationUserId }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Verification failed with status: ${response.status}`);
          }

          const verificationPayload = await response.json().catch(() => null);
          const accountEmail =
            typeof verificationPayload?.user?.email === 'string'
              ? verificationPayload.user.email.trim()
              : '';
          setVerifiedAccountEmail(accountEmail);

          // Success!
          console.log('[SubscriptionSuccess] Verification successful.');
          setVerificationStatus('verified');

          if (appReturnUrl) {
            redirectToApp(appReturnUrl, {
              status: 'success',
              session_id: sessionId,
              userId: verificationUserId,
              source,
            });
          }
        } catch (error) {
          console.error('[SubscriptionSuccess] Verification API call failed:', error);
          
          // Parse error response if it's a JSON error
          let errorMessage = 'An unknown error occurred during verification.';
          let errorCode = 'UNKNOWN_ERROR';
          let errorDetails = '';
          
          if (error instanceof Error) {
            errorMessage = error.message;
            
            // Try to parse JSON error response
            try {
              const errorData = JSON.parse(error.message);
              if (errorData.message) errorMessage = errorData.message;
              if (errorData.error) errorCode = errorData.error;
              if (errorData.details) errorDetails = errorData.details;
            } catch {
              // Not JSON, use the original error message
              errorDetails = error.message;
            }
          }
          
          // Redirect to error page with error details
          const errorParams = new URLSearchParams({
            message: errorMessage,
            error: errorCode,
            ...(errorDetails && { details: errorDetails })
          });
          
          console.log('[SubscriptionSuccess] Redirecting to error page with details:', {
            message: errorMessage,
            error: errorCode,
            details: errorDetails
          });

          if (appReturnUrl) {
            redirectToApp(appReturnUrl, {
              status: 'error',
              error: errorCode,
              session_id: sessionId,
              userId: verificationUserId,
              source,
            });
            return;
          }
          
          router.replace(`/subscription-error?${errorParams.toString()}`);
        }
      };

      verifySession();
    }
  }, [
    router,
    router.isReady,
    sessionId,
    verificationUserId,
    verificationStatus,
    appReturnUrl,
    source,
    isCancelledReturn,
    isMacraAlreadyActiveReturn,
  ]);

  // Effect for countdown timer (only runs after verification)
  useEffect(() => {
    if (isMacraWebOffer) return;
    if (verificationStatus !== 'verified' || countdown <= 0) return;

    const timerId = setInterval(() => {
      setCountdown((prevCount) => prevCount - 1);
    }, 1000);

    return () => clearInterval(timerId);
  }, [countdown, verificationStatus, isMacraWebOffer]);

  // Effect for redirecting (only runs after verification and countdown)
  useEffect(() => {
    if (isMacraWebOffer) return;
    if (verificationStatus === 'verified' && countdown <= 0 && !appReturnUrl && verificationUserId && router.isReady) {
      const destination = '/'; // Always redirect to home
      console.log(`[SubscriptionSuccess] Verified, redirecting to home: ${destination}`);
      
      // Clear any temporary redirect paths from redux state, just in case
      dispatch(clearRoundIdRedirect());
      dispatch(clearLoginRedirectPath());

      // Important: if on localhost, make sure we're redirecting to localhost instead of production
      let finalDestination = destination;
      if (isLocal && !destination.startsWith('http')) {
        const baseUrl = window.location.origin; // e.g. "http://localhost:3000"
        finalDestination = `${baseUrl}${destination.startsWith('/') ? '' : '/'}${destination}`;
        console.log(`[SubscriptionSuccess] On localhost, final redirect to: ${finalDestination}`);
      }

      router.replace(finalDestination);
    }
  }, [appReturnUrl, verificationUserId, router, dispatch, countdown, verificationStatus, isLocal, isMacraWebOffer]);

  if (isMacraAlreadyActiveReturn && !appReturnUrl) {
    return (
      <>
        <Head>
          <title>Macra Access Active | Macra</title>
          <meta name="robots" content="noindex,nofollow" />
        </Head>

        <main className="relative min-h-screen overflow-hidden bg-[#060806] text-white">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(224,254,16,0.13),transparent_34%,rgba(255,255,255,0.05)_68%,transparent)]" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:44px_44px]" />

          <section className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10">
            <div className="w-full max-w-3xl rounded-[28px] border border-white/[0.12] bg-black/[0.55] p-6 shadow-2xl backdrop-blur md:p-10">
              <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl border border-[#e0fe10]/40 bg-[#e0fe10]/10 shadow-[0_0_48px_rgba(224,254,16,0.24)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/macra-icon.png" alt="Macra" className="h-14 w-14 rounded-2xl" />
              </div>

              <div className="mx-auto max-w-2xl text-center">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#e0fe10]/30 bg-[#e0fe10]/10 px-4 py-2 text-sm font-bold text-[#e0fe10]">
                  <CheckCircle2 className="h-4 w-4" />
                  Access already active
                </div>

                <h1 className="text-5xl font-black tracking-normal text-white sm:text-6xl">You are already set.</h1>
                <p className="mt-5 text-2xl font-black leading-tight text-[#e0fe10] sm:text-3xl">
                  No checkout needed.
                </p>
                <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-zinc-300 sm:text-lg">
                  This Macra account already has active access. Download the Macra app, then sign in with the same
                  email address that received this offer and you will be ready to use it.
                </p>
              </div>

              <div className="mt-9 grid gap-3 sm:grid-cols-3">
                {[
                  'Checkout skipped',
                  'Access confirmed',
                  'Macra ready',
                ].map((label) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-4 text-center">
                    <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-[#e0fe10]" />
                    <p className="text-sm font-bold text-zinc-100">{label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <a
                  href={MACRA_APP_STORE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#e0fe10] px-6 py-4 text-base font-black text-black transition-colors hover:bg-[#cbed0e]"
                >
                  <Download className="h-5 w-5" />
                  Download Macra
                </a>
                <a
                  href={MACRA_OPEN_URL}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.08] px-6 py-4 text-base font-black text-white transition-colors hover:bg-white/[0.13]"
                >
                  Open Macra
                  <ArrowRight className="h-5 w-5" />
                </a>
              </div>
            </div>
          </section>
        </main>
      </>
    );
  }

  if (isMacraWebOffer && verificationStatus === 'verified' && !appReturnUrl) {
    return (
      <>
        <Head>
          <title>Macra Trial Activated | Macra</title>
          <meta name="robots" content="noindex,nofollow" />
        </Head>

        <main className="relative min-h-screen overflow-hidden bg-[#060806] text-white">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(224,254,16,0.12),transparent_34%,rgba(255,255,255,0.05)_68%,transparent)]" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:44px_44px]" />

          <section className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10">
            <div className="w-full max-w-3xl rounded-[28px] border border-white/[0.12] bg-black/[0.55] p-6 shadow-2xl backdrop-blur md:p-10">
              <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl border border-[#e0fe10]/40 bg-[#e0fe10]/10 shadow-[0_0_48px_rgba(224,254,16,0.24)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/macra-icon.png" alt="Macra" className="h-14 w-14 rounded-2xl" />
              </div>

              <div className="mx-auto max-w-2xl text-center">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#e0fe10]/30 bg-[#e0fe10]/10 px-4 py-2 text-sm font-bold text-[#e0fe10]">
                  <CheckCircle2 className="h-4 w-4" />
                  Trial activated
                </div>

                <h1 className="text-5xl font-black tracking-normal text-white sm:text-6xl">Success!</h1>
                <p className="mt-5 text-2xl font-black leading-tight text-[#e0fe10] sm:text-3xl">
                  Your 1-month free trial is active.
                </p>
                <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-zinc-300 sm:text-lg">
                  Download the Macra app, then sign in using{' '}
                  {verifiedAccountEmail ? (
                    <span className="font-black text-white">{verifiedAccountEmail}</span>
                  ) : (
                    'the email attached to this trial'
                  )}{' '}
                  and you will be ready to use it.
                </p>
              </div>

              <div className="mt-9 grid gap-3 sm:grid-cols-3">
                {[
                  'Free month applied',
                  'Account ready',
                  'Macra unlocked',
                ].map((label) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-4 text-center">
                    <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-[#e0fe10]" />
                    <p className="text-sm font-bold text-zinc-100">{label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <a
                  href={MACRA_APP_STORE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#e0fe10] px-6 py-4 text-base font-black text-black transition-colors hover:bg-[#cbed0e]"
                >
                  <Download className="h-5 w-5" />
                  Download Macra
                </a>
                <a
                  href={MACRA_OPEN_URL}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.08] px-6 py-4 text-base font-black text-white transition-colors hover:bg-white/[0.13]"
                >
                  Open Macra
                  <ArrowRight className="h-5 w-5" />
                </a>
              </div>

              {isLocal && (
                <div className="mx-auto mt-7 max-w-md rounded-full bg-yellow-500/20 px-4 py-2 text-center text-xs font-bold text-yellow-200">
                  Test Mode: Using Stripe Test Environment
                </div>
              )}
            </div>
          </section>
        </main>
      </>
    );
  }

  // --- Render Logic ---
  const renderContent = () => {
    switch (verificationStatus) {
      case 'verifying':
        return (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#E0FE10] mb-6"></div>
            <h1 className="text-2xl font-bold mb-2">Verifying Subscription...</h1>
            <p className="text-zinc-400">Please wait while we confirm your payment.</p>
            {isLocal && (
              <div className="mt-4 px-3 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full">
                Test Mode: Using Stripe Test Environment
              </div>
            )}
          </>
        );
      case 'verified':
        return (
          <>
            {(countdown > 0 || appReturnUrl) && (
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#E0FE10] mb-6"></div>
            )}
            <h1 className="text-2xl font-bold mb-2">Subscription Successful!</h1>
            <p className="text-zinc-400">Thank you for subscribing to Pulse.</p>
            <p className="text-zinc-500 mt-1">
              {appReturnUrl ? 'Returning to your app...' : countdown > 0 ? `Redirecting you in ${countdown} seconds...` : 'Redirecting you now...'}
            </p>
            {isLocal && (
              <div className="mt-4 px-3 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full">
                Test Mode: Using Stripe Test Environment
              </div>
            )}
          </>
        );
      case 'error':
        return (
          <>
            {/* Optional: Add an error icon */}
            <svg className="w-16 h-16 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <h1 className="text-2xl font-bold mb-2 text-red-400">Verification Failed</h1>
            <p className="text-zinc-400 text-center mb-4">
              {errorMessage || 'An error occurred while verifying your subscription.'}
            </p>
            <button
              onClick={() => {
                // If on localhost, go to localhost home
                if (isLocal) {
                  window.location.href = window.location.origin;
                } else {
                  router.push('/');
                }
              }}
              className="mt-4 px-4 py-2 bg-[#E0FE10] text-black rounded-lg font-semibold hover:bg-[#c8e60e] transition-colors"
            >
              Go to Homepage
            </button>
            {isLocal && (
              <div className="mt-4 px-3 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full">
                Test Mode: Using Stripe Test Environment
              </div>
            )}
          </>
        );
      case 'idle':
      default:
        return (
          <>
            {/* Optional: Show a loading indicator while waiting for user/router */}
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#E0FE10] mb-6"></div>
            <p className="text-zinc-500 mt-1">Loading...</p>
            {isLocal && (
              <div className="mt-4 px-3 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full">
                Test Mode: Using Stripe Test Environment
              </div>
            )}
          </>
        );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      {/* Background gradient effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-1/2 h-1/2 bg-[#E0FE10]/10 blur-[150px] rounded-full transform -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-1/4 w-1/2 h-1/2 bg-[#E0FE10]/10 blur-[150px] rounded-full transform translate-y-1/2"></div>
      </div>
      
      {/* Test Mode Indicator */}
      {isLocal && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500/90 text-black py-1 px-4 text-center text-sm z-50">
          <strong>Test Mode:</strong> Using Stripe Test Environment - Payments won't be charged
        </div>
      )}
      
      <div className="relative z-10 text-center py-8">
        <img src="/pulse-logo.svg" alt="Pulse Logo" className="h-10 mb-6" />
        {renderContent()}
      </div>
    </div>
  );
};

export default SubscriptionSuccessPage;
