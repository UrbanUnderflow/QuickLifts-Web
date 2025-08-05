// FILE: pages/trainer/connect-account.tsx
// Updated to use userService directly instead of API calls

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { userService } from '../../api/firebase/user';
import { StripeOnboardingStatus } from '../../api/firebase/user/types';
import { db } from '../../api/firebase/config';
import { SubscriptionType } from '../../api/firebase/user/types';

const ConnectAccountPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboardingLink, setOnboardingLink] = useState<string | null>(null);
  const router = useRouter();
  
  // Get user from Redux store
  const currentUser = useSelector((state: RootState) => state.user.currentUser);
  const isLoading = useSelector((state: RootState) => state.user.loading);

  useEffect(() => {
    // If state is still loading, wait
    if (isLoading) {
      return;
    }
    
    // Check if user is already logged in
    if (!currentUser) {
      console.log('[ConnectAccount] No user found, redirecting to login');
      router.push('/login?redirect=/trainer/connect-account');
      return;
    }

    // Check if user has an active subscription
    if (currentUser.subscriptionType === SubscriptionType.unsubscribed) {
      console.log('[ConnectAccount] User is unsubscribed, redirecting to subscription page');
      router.push('/subscribe');
      return;
    }

    console.log('[ConnectAccount] User authenticated and subscribed, checking connect account status');
    // Check if user already has Connect account details
    checkConnectAccountStatus();
  }, [currentUser, isLoading, router]);

  const checkConnectAccountStatus = async () => {
    // Make sure we have a user before proceeding
    if (!currentUser?.id) {
      console.log('[ConnectAccount] No user ID found');
      return;
    }
    
    try {
      console.log('[ConnectAccount] Fetching fresh user data for:', currentUser.id);
      // Fetch fresh user data directly from Firestore using userService
      const refreshedUser = await userService.fetchUserFromFirestore(currentUser.id);
      
      // First, check if the user has a Stripe account ID - this is the definitive indicator
      if (refreshedUser?.creator?.stripeAccountId) {
        console.log('[ConnectAccount] User has Stripe account ID:', refreshedUser.creator.stripeAccountId);
        
        // If onboardingStatus doesn't match the presence of stripeAccountId, fix it
        if (refreshedUser.creator.onboardingStatus !== StripeOnboardingStatus.Complete) {
          console.log('[ConnectAccount] Fixing inconsistent onboarding status');
          
          // Call the complete-stripe-onboarding function to fix the status
          await fetch(
            `/.netlify/functions/complete-stripe-onboarding?userId=${currentUser.id}`
          );
        }
        
        // Redirect to unified earnings dashboard because user has a Stripe account
        console.log('[ConnectAccount] Redirecting to unified earnings dashboard');
        router.push(`/${currentUser.username}/earnings`);
      } 
      // If status is complete but no stripeAccountId, fix the inconsistency
      else if (refreshedUser?.creator?.onboardingStatus === StripeOnboardingStatus.Complete) {
        console.log('[ConnectAccount] Fixing inconsistency: status is complete but no stripeAccountId');
        
        // Call the reset-onboarding function to fix the status
        await fetch(
          `/.netlify/functions/reset-onboarding?userId=${currentUser.id}`
        );
        
        // No redirect - keep user on connect account page
      }
      // Check for existing onboarding link if not completed
      else if (refreshedUser?.creator?.onboardingLink && 
               refreshedUser.creator.onboardingExpirationDate && 
               new Date(refreshedUser.creator.onboardingExpirationDate) > new Date()) {
        console.log('[ConnectAccount] Found valid onboarding link');
        // Use existing onboarding link if not expired
        setOnboardingLink(refreshedUser.creator.onboardingLink);
      }
    } catch (err) {
      console.error('[ConnectAccount] Error checking account status:', err);
      setError('Failed to check account status. Please try again.');
    }
  };

  const handleStartOnboarding = async () => {
    // Make sure we have a user before proceeding
    if (!currentUser?.id) {
      setError('You must be logged in to set up payments');
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      // Log the request for debugging
      console.log('[ConnectAccount] Starting onboarding process for user:', currentUser.id);
      
      // Call the existing Netlify function to create Connect account
      const response = await fetch(
        `/.netlify/functions/create-connected-account?userId=${currentUser.id}`
      );
      
      console.log('[ConnectAccount] Create account response status:', response.status);
      
      // Get raw response text for debugging
      const responseText = await response.text();
      console.log('[ConnectAccount] Raw response:', responseText);
      
      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[ConnectAccount] JSON parse error:', parseError);
        throw new Error("Invalid response format from server");
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to create account');
      }

      // Check if the response contains the onboarding link directly
      if (data.accountLink) {
        console.log('[ConnectAccount] Using account link from response');
        setOnboardingLink(data.accountLink);
        return;
      }

      // If no direct link in response, fetch the updated user
      console.log('[ConnectAccount] Fetching updated user data');
      const refreshedUser = await userService.fetchUserFromFirestore(currentUser.id);
      
      if (refreshedUser?.creator?.onboardingLink) {
        console.log('[ConnectAccount] Found onboarding link in refreshed user data');
        setOnboardingLink(refreshedUser.creator.onboardingLink);
      } else {
        console.error('[ConnectAccount] No onboarding link found in response or user data');
        throw new Error('Failed to get onboarding link. Please try again.');
      }
    } catch (err) {
      console.error('[ConnectAccount] Error in onboarding process:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state if Redux is loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-zinc-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white py-10">
      <div className="max-w-md mx-auto px-6">
        <h1 className="text-3xl font-bold mb-4">Set Up Your Trainer Account</h1>
        
        <div className="bg-zinc-900 p-6 rounded-xl mb-8">
          <h2 className="text-xl font-semibold mb-4">Connect Payments</h2>
          <p className="mb-6">
            To receive payments for your training rounds, you need to connect a Stripe account.
            This allows you to securely receive payments directly to your bank account.
          </p>
          
          {error && (
            <div className="bg-red-900/30 border border-red-500 text-red-200 p-3 mb-4 rounded">
              {error}
            </div>
          )}
          
          {onboardingLink ? (
            <div>
              <p className="mb-4">Your account is ready to be set up. Click the button below to complete your onboarding:</p>
              <a 
                href={onboardingLink}
                className="bg-[#E0FE10] text-black py-3 px-6 w-full block text-center rounded-xl font-semibold"
              >
                Complete Stripe Setup
              </a>
              <p className="mt-4 text-sm text-zinc-400">
                You'll be redirected to Stripe to provide your business and banking information.
              </p>
            </div>
          ) : (
            <button 
              onClick={handleStartOnboarding}
              disabled={loading}
              className={`
                w-full py-3 px-6 rounded-xl font-semibold
                ${loading ? 'bg-[#E0FE10]/50' : 'bg-[#E0FE10]'} 
                text-black transition-all
              `}
            >
              {loading ? 'Setting Up...' : 'Set Up Payments'}
            </button>
          )}
        </div>
        
        <div className="text-sm text-zinc-400">
          <h3 className="font-medium text-zinc-300 mb-2">What happens next?</h3>
          <ul className="space-y-2">
            <li>• You'll create or connect your Stripe account</li>
            <li>• Provide your banking information for deposits</li>
            <li>• Complete identity verification (required by financial regulations)</li>
            <li>• Start receiving payments from your training rounds</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ConnectAccountPage;