import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { useUser } from '../hooks/useUser';
import { clearRoundIdRedirect, clearLoginRedirectPath } from '../redux/tempRedirectSlice';
import { isLocalhost } from '../utils/stripeKey';

// Define verification status types
type VerificationStatus = 'idle' | 'verifying' | 'verified' | 'error';

const SubscriptionSuccessPage: React.FC = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const currentUser = useUser(); // Check user status
  const { roundIdRedirect, loginRedirectPath } = useSelector((state: RootState) => state.tempRedirect);
  const [countdown, setCountdown] = useState(5); // Countdown state (5 seconds)
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLocal, setIsLocal] = useState(false);

  useEffect(() => {
    setIsLocal(isLocalhost());
  }, []);

  // Effect for verification
  useEffect(() => {
    // Only run verification if router is ready, user is loaded, and we haven't started yet
    if (router.isReady && currentUser && verificationStatus === 'idle') {
      const sessionId = router.query.session_id as string | undefined;

      if (!sessionId) {
        console.error('[SubscriptionSuccess] Missing session_id in query parameters.');
        setErrorMessage('Missing payment session information.');
        setVerificationStatus('error');
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
            body: JSON.stringify({ sessionId: sessionId, userId: currentUser.id }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Verification failed with status: ${response.status}`);
          }

          // Success!
          console.log('[SubscriptionSuccess] Verification successful.');
          setVerificationStatus('verified');
        } catch (error) {
          console.error('[SubscriptionSuccess] Verification API call failed:', error);
          setErrorMessage(error instanceof Error ? error.message : 'An unknown error occurred during verification.');
          setVerificationStatus('error');
        }
      };

      verifySession();
    }
  }, [router.isReady, router.query.session_id, currentUser, verificationStatus]); // Add dependencies

  // Effect for countdown timer (only runs after verification)
  useEffect(() => {
    if (verificationStatus !== 'verified' || countdown <= 0) return;

    const timerId = setInterval(() => {
      setCountdown((prevCount) => prevCount - 1);
    }, 1000);

    return () => clearInterval(timerId);
  }, [countdown, verificationStatus]);

  // Effect for redirecting (only runs after verification and countdown)
  useEffect(() => {
    if (verificationStatus === 'verified' && countdown <= 0 && currentUser && router.isReady) {
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
  }, [currentUser, router, dispatch, countdown, verificationStatus, isLocal]);

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
            {countdown > 0 && (
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#E0FE10] mb-6"></div>
            )}
            <h1 className="text-2xl font-bold mb-2">Subscription Successful!</h1>
            <p className="text-zinc-400">Thank you for subscribing to Pulse.</p>
            <p className="text-zinc-500 mt-1">
              {countdown > 0 ? `Redirecting you in ${countdown} seconds...` : 'Redirecting you now...'}
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