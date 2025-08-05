// FILE: pages/winner/connect-account.tsx
// Connect account page for challenge winners to receive prize money

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import { GetServerSideProps } from 'next';
import PageHead from '../../components/PageHead';
import { RootState } from '../../redux/store';
import { userService } from '../../api/firebase/user/service';
import { StripeOnboardingStatus } from '../../api/firebase/user/types';
import { adminMethods } from '../../api/firebase/admin/methods';
import { PageMetaData as FirestorePageMetaData } from '../../api/firebase/admin/types';

// Define a serializable version of PageMetaData for this page's props
interface SerializablePageMetaData extends Omit<FirestorePageMetaData, 'lastUpdated'> {
  lastUpdated: string;
}

interface WinnerConnectAccountPageProps {
  metaData: SerializablePageMetaData | null;
}

const WinnerConnectAccountPage: React.FC<WinnerConnectAccountPageProps> = ({ metaData }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboardingLink, setOnboardingLink] = useState<string | null>(null);
  const [challengeInfo, setChallengeInfo] = useState<{
    title: string;
    prizeAmount: number;
    placement: number;
  } | null>(null);
  
  const router = useRouter();
  const { challengeId, placement } = router.query;
  
  // Get user from Redux store
  const currentUser = useSelector((state: RootState) => state.user.currentUser);
  const isLoading = useSelector((state: RootState) => state.user.loading);

  useEffect(() => {
    // If state is still loading, wait
    if (isLoading) {
      return;
    }
    
    // Only proceed if user is authenticated (AuthWrapper will handle redirect if not)
    if (!currentUser) {
      console.log('[WinnerConnectAccount] No user found, AuthWrapper will handle redirect');
      return;
    }

    console.log('[WinnerConnectAccount] User authenticated, checking connect account status');
    
    // Fetch challenge info to show prize details
    if (challengeId && placement) {
      fetchChallengeInfo();
    }
    
    // Check if user already has Connect account details
    checkConnectAccountStatus();
  }, [currentUser, isLoading, router, challengeId, placement]);

  const fetchChallengeInfo = async () => {
    try {
      const response = await fetch(`/.netlify/functions/get-winner-prize-info?challengeId=${challengeId}&placement=${placement}`);
      const data = await response.json();
      
      if (data.success) {
        setChallengeInfo(data.challengeInfo);
      }
    } catch (error) {
      console.error('Error fetching challenge info:', error);
    }
  };

  const checkConnectAccountStatus = async () => {
    // Make sure we have a user before proceeding
    if (!currentUser?.id) {
      console.log('[WinnerConnectAccount] No user ID found');
      return;
    }
    
    try {
      console.log('[WinnerConnectAccount] Fetching fresh user data for:', currentUser.id);
      // Fetch fresh user data directly from Firestore using userService
      const refreshedUser = await userService.fetchUserFromFirestore(currentUser.id);
      
      // Check if the user has a Stripe account ID in the winner field
      if (refreshedUser?.winner?.stripeAccountId) {
        console.log('[WinnerConnectAccount] User has Stripe account ID:', refreshedUser.winner.stripeAccountId);
        
        // If onboardingStatus doesn't match the presence of stripeAccountId, fix it
        if (refreshedUser.winner.onboardingStatus !== StripeOnboardingStatus.Complete) {
          console.log('[WinnerConnectAccount] Fixing inconsistent onboarding status');
          
          // Call the complete-winner-stripe-onboarding function to fix the status
          await fetch(
            `/.netlify/functions/complete-winner-stripe-onboarding?userId=${currentUser.id}`
          );
        }
        
        // Redirect to unified earnings dashboard because user has a Stripe account
        console.log('[WinnerConnectAccount] Redirecting to unified earnings dashboard');
        
        // Preserve challenge context if available
        const queryParams = new URLSearchParams();
        if (challengeId) queryParams.append('challengeId', challengeId as string);
        if (placement) queryParams.append('placement', placement as string);
        
        const redirectUrl = `/${currentUser.username}/earnings${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
        router.push(redirectUrl);
      } else if (refreshedUser?.winner?.onboardingStatus === StripeOnboardingStatus.Complete) {
        // If status is complete but no stripeAccountId, fix the inconsistency
        console.log('[WinnerConnectAccount] Fixing inconsistency: status is complete but no stripeAccountId');
        
        await fetch(
          `/.netlify/functions/reset-winner-onboarding?userId=${currentUser.id}`
        );
        
        // Continue with normal flow after reset
      }
      
      // Check if there's an existing onboarding link
      if (refreshedUser?.winner?.onboardingLink) {
        const expirationDate = new Date(refreshedUser.winner.onboardingExpirationDate || 0);
        const now = new Date();
        
        if (now < expirationDate) {
          console.log('[WinnerConnectAccount] Found valid existing onboarding link');
          setOnboardingLink(refreshedUser.winner.onboardingLink);
          return;
        } else {
          console.log('[WinnerConnectAccount] Onboarding link expired, will create new one');
        }
      }
      
    } catch (error) {
      console.error('[WinnerConnectAccount] Error checking connect account status:', error);
      setError('Failed to check account status. Please try again.');
    }
  };

  const handleStartOnboarding = async () => {
    if (!currentUser?.id) {
      setError('You must be logged in to connect an account.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('[WinnerConnectAccount] Starting onboarding for user:', currentUser.id);
      
      const response = await fetch('/.netlify/functions/create-winner-connected-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId: currentUser.id,
          challengeId: challengeId,
          placement: placement
        }),
      });

      const data = await response.json();
      console.log('[WinnerConnectAccount] Response from create-winner-connected-account:', data);

      if (data.success && data.accountLink) {
        setOnboardingLink(data.accountLink);
      } else {
        throw new Error(data.error || 'Failed to create account link');
      }
    } catch (err: any) {
      console.error('[WinnerConnectAccount] Error starting onboarding:', err);
      setError(err.message || 'Failed to start onboarding process. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state if Redux is loading
  if (isLoading) {
    return (
      <>
        <PageHead
          metaData={metaData}
          pageOgUrl="https://fitwithpulse.ai/winner/connect-account"
        />
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#E0FE10]"></div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead
        metaData={metaData}
        pageOgUrl="https://fitwithpulse.ai/winner/connect-account"
      />
      <div className="min-h-screen bg-zinc-950 text-white py-10">
        <div className="max-w-md mx-auto px-6">
          <h1 className="text-3xl font-bold mb-4">🏆 Congratulations!</h1>
          
          {challengeInfo && (
            <div className="bg-gradient-to-r from-yellow-400/20 to-orange-400/20 border border-yellow-400/30 p-6 rounded-xl mb-8">
              <h2 className="text-xl font-semibold mb-2">Challenge Winner</h2>
              <p className="text-lg mb-2">
                <strong>{challengeInfo.title}</strong>
              </p>
              <p className="text-2xl font-bold text-[#E0FE10]">
                Prize: ${(challengeInfo.prizeAmount / 100).toFixed(2)}
              </p>
              <p className="text-zinc-300 text-sm mt-2">
                {challengeInfo.placement === 1 ? '🥇 1st Place' : 
                 challengeInfo.placement === 2 ? '🥈 2nd Place' : 
                 challengeInfo.placement === 3 ? '🥉 3rd Place' : 
                 `#${challengeInfo.placement} Place`}
              </p>
            </div>
          )}
          
          <div className="bg-zinc-900 p-6 rounded-xl mb-8">
            <h2 className="text-xl font-semibold mb-4">Claim Your Prize</h2>
            <p className="mb-6">
              To receive your prize money, you need to connect a payment account. 
              This allows us to securely transfer your winnings directly to your bank account.
            </p>
            
            {error && (
              <div className="bg-red-900/30 border border-red-500 text-red-200 p-3 mb-4 rounded">
                {error}
              </div>
            )}
            
            {onboardingLink ? (
              <div>
                <p className="mb-4">Your payment account is ready to be set up. Click the button below to complete your onboarding:</p>
                <a 
                  href={onboardingLink}
                  className="bg-[#E0FE10] text-black py-3 px-6 w-full block text-center rounded-xl font-semibold"
                >
                  Complete Payment Setup
                </a>
                <p className="mt-4 text-sm text-zinc-400">
                  You'll be redirected to Stripe to provide your banking information securely.
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
                {loading ? 'Setting Up...' : 'Set Up Payment Account'}
              </button>
            )}
          </div>
          
          <div className="text-sm text-zinc-400">
            <h3 className="font-semibold mb-2">What happens next?</h3>
            <ul className="space-y-1">
              <li>• You'll provide banking information to Stripe (our payment processor)</li>
              <li>• Stripe will verify your identity (standard requirement)</li>
              <li>• Once approved, your prize money will be transferred</li>
              <li>• You'll have access to a dashboard to track your payment</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
};

export const getServerSideProps: GetServerSideProps<WinnerConnectAccountPageProps> = async (context) => {
  let rawMetaData: FirestorePageMetaData | null = null;
  try {
    rawMetaData = await adminMethods.getPageMetaData('winner--connect-account');
  } catch (error) {
    console.error("Error fetching page meta data for winner connect-account page:", error);
  }

  let serializableMetaData: SerializablePageMetaData | null = null;
  if (rawMetaData) {
    serializableMetaData = {
      ...rawMetaData,
      lastUpdated: rawMetaData.lastUpdated.toDate().toISOString(),
    };
  }

  return {
    props: {
      metaData: serializableMetaData,
    },
  };
};

export default WinnerConnectAccountPage; 