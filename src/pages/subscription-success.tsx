import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { useUser } from '../hooks/useUser';
import { clearRoundIdRedirect, clearLoginRedirectPath } from '../redux/tempRedirectSlice';

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
          const response = await fetch('/api/verify-subscription', {
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
      let destination = '/'; // Default to home
      let clearedState = false;

      if (roundIdRedirect) {
        destination = `/round/${roundIdRedirect}`;
        console.log(`[SubscriptionSuccess] Found roundIdRedirect, redirecting to: ${destination}`);
        dispatch(clearRoundIdRedirect());
        clearedState = true;
      } else if (loginRedirectPath) {
        destination = loginRedirectPath;
        console.log(`[SubscriptionSuccess] Found loginRedirectPath, redirecting to: ${destination}`);
        dispatch(clearLoginRedirectPath());
        clearedState = true;
      } else {
        console.log('[SubscriptionSuccess] No specific redirect found, redirecting to home.');
      }

      router.replace(destination);
    }
  }, [currentUser, router, roundIdRedirect, loginRedirectPath, dispatch, countdown, verificationStatus]);

  // --- Render Logic ---
  const renderContent = () => {
    switch (verificationStatus) {
      case 'verifying':
        return (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#E0FE10] mb-6"></div>
            <h1 className="text-2xl font-bold mb-2">Verifying Subscription...</h1>
            <p className="text-zinc-400">Please wait while we confirm your payment.</p>
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
              onClick={() => router.push('/')} // Go home button
              className="mt-4 px-4 py-2 bg-[#E0FE10] text-black rounded-lg font-semibold hover:bg-[#c8e60e] transition-colors"
            >
              Go to Homepage
            </button>
          </>
        );
      case 'idle':
      default:
        return (
          <>
            {/* Optional: Show a loading indicator while waiting for user/router */}
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#E0FE10] mb-6"></div>
            <p className="text-zinc-500 mt-1">Loading...</p>
          </>
        );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-900 text-white p-4">
      <img src="/pulse-logo-white.svg" alt="Pulse Logo" className="h-10 mb-6" />
      {renderContent()}
    </div>
  );
};

export default SubscriptionSuccessPage; 