import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { useUser } from '../hooks/useUser';
import { clearRoundIdRedirect, clearLoginRedirectPath } from '../redux/tempRedirectSlice';

const SubscriptionSuccessPage: React.FC = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const currentUser = useUser(); // Check user status
  const { roundIdRedirect, loginRedirectPath } = useSelector((state: RootState) => state.tempRedirect);

  useEffect(() => {
    // Wait until we have user info and router is ready
    if (currentUser && router.isReady) {
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

      // Use replace to avoid the success page being in browser history
      router.replace(destination);
    }
    // Add dependencies: run when user/router/redirect state is confirmed
  }, [currentUser, router, roundIdRedirect, loginRedirectPath, dispatch]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-900 text-white p-4">
      <img src="/pulse-logo-white.svg" alt="Pulse Logo" className="h-10 mb-6" />
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#E0FE10] mb-6"></div>
      <h1 className="text-2xl font-bold mb-2">Subscription Successful!</h1>
      <p className="text-zinc-400">Thank you for subscribing to Pulse.</p>
      <p className="text-zinc-500 mt-1">Redirecting you now...</p>
    </div>
  );
};

export default SubscriptionSuccessPage; 