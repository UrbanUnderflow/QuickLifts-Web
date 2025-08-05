import React, { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { userService } from '../../api/firebase/user/service';
import { User } from '../../api/firebase/user';
import Image from 'next/image';
import Link from 'next/link';
import { trackEvent } from '../../lib/analytics';

// Define interfaces for unified earnings data
interface UnifiedEarnings {
  totalBalance: number;
  totalEarned: number;
  pendingPayout: number;
  creatorEarnings: {
    totalEarned: number;
    availableBalance: number;
    pendingPayout: number;
    roundsSold: number;
    stripeAccountId?: string;
    onboardingStatus: string;
  };
  prizeWinnings: {
    totalEarned: number;
    availableBalance: number;
    pendingPayout: number;
    totalWins: number;
    stripeAccountId?: string;
    onboardingStatus: string;
  };
  transactions: Array<{
    id: string;
    type: 'creator_sale' | 'prize_winning';
    date: string;
    amount: number;
    description: string;
    status: string;
    metadata: any;
  }>;
  canRequestPayout: boolean;
  minimumPayoutAmount: number;
  nextPayoutDate?: string;
  hasCreatorAccount: boolean;
  hasWinnerAccount: boolean;
  needsAccountSetup: boolean;
  lastUpdated: string;
  isNewAccount: boolean;
}

interface EarningsPageProps {
  profileUser: User | null;
  isOwner: boolean;
  error: string | null;
}

const UnifiedEarningsPage: React.FC<EarningsPageProps> = ({ 
  profileUser, 
  isOwner, 
  error: serverError 
}) => {
  const router = useRouter();
  const { username } = router.query;
  
  // Redux state
  const currentUser = useSelector((state: RootState) => state.user.currentUser);
  const isLoading = useSelector((state: RootState) => state.user.loading);

  // Local state
  const [earningsData, setEarningsData] = useState<UnifiedEarnings | null>(null);
  const [isEarningsLoading, setIsEarningsLoading] = useState(true);
  const [error, setError] = useState<string | null>(serverError);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState<string>('');
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [dashboardUrl, setDashboardUrl] = useState<string>('');
  const [isDashboardLinkLoading, setIsDashboardLinkLoading] = useState(false);
  const [earningsPrivacy, setEarningsPrivacy] = useState({
    showTotalEarnings: false,
    showEarningsBreakdown: false,
    showTransactionCount: false,
    showRecentActivity: false
  });
  const [autoFixAttempted, setAutoFixAttempted] = useState(false);

  const API_BASE_URL = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:8888/.netlify/functions'
    : 'https://fitwithpulse.ai/.netlify/functions';

  // Determine if current user is viewing their own earnings
  const isActualOwner = currentUser && profileUser && currentUser.id === profileUser.id;

  // Authentication check
  useEffect(() => {
    if (!isLoading && !currentUser && isActualOwner) {
      // Redirect to login if trying to access own earnings without authentication
      router.push(`/login?redirect=/${username}/earnings`);
    }
  }, [currentUser, isLoading, isActualOwner, router, username]);

  // Fetch earnings data
  useEffect(() => {
    const fetchEarningsData = async () => {
      if (!profileUser?.id || !isActualOwner) {
        setIsEarningsLoading(false);
        return;
      }

      try {
        setIsEarningsLoading(true);
        console.log('Fetching unified earnings for user:', profileUser.id);
        
        const response = await fetch(`${API_BASE_URL}/get-unified-earnings?userId=${profileUser.id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch earnings data');
        }
        
        const data = await response.json();
        console.log('Unified earnings data received:', data);
        
        if (data.success) {
          setEarningsData(data.earnings);
          
          // Track earnings page view
          if (profileUser?.email) {
            trackEvent(profileUser.email, 'EarningsPageViewed', {
              userId: profileUser.id,
              username: profileUser.username,
              totalBalance: data.earnings.totalBalance,
              totalEarned: data.earnings.totalEarned,
              hasCreatorEarnings: data.earnings.creatorEarnings.totalEarned > 0,
              hasPrizeWinnings: data.earnings.prizeWinnings.totalEarned > 0,
              isNewAccount: data.earnings.isNewAccount
            });
          }
        } else {
          throw new Error(data.error || 'Failed to load earnings data');
        }
      } catch (err) {
        console.error('Error fetching earnings:', err);
        setError(err instanceof Error ? err.message : 'Failed to load earnings data');
      } finally {
        setIsEarningsLoading(false);
      }
    };

         fetchEarningsData();
   }, [profileUser?.id, isActualOwner, API_BASE_URL]);

  // Auto-fix missing stripeAccountId when conditions are met
  useEffect(() => {
    const attemptAutoFix = async () => {
      // Trigger auto-fix if:
      // 1. User is viewing their own earnings page
      // 2. Either: Account shows as new but has setup, OR there's an error loading earnings (likely missing stripeAccountId)
      // 3. We haven't already attempted an auto-fix
      // 4. Not currently loading
      const shouldAutoFix = isActualOwner &&
        !autoFixAttempted && 
        !isEarningsLoading &&
        profileUser?.id && (
          // Case 1: Account setup but showing as new (normal auto-fix trigger)
          (earningsData?.isNewAccount === true && (earningsData?.hasCreatorAccount || earningsData?.hasWinnerAccount)) ||
          // Case 2: Error loading earnings (likely missing stripeAccountId)
          (error && error.includes('Failed to fetch earnings data'))
        );

      if (shouldAutoFix) {
        console.log('🔧 Auto-fix triggered on earnings page:', 
          earningsData?.isNewAccount ? 'Account appears set up but no transactions found' : 'Error loading earnings data',
          '- Attempting to relink Stripe account...');
        setAutoFixAttempted(true);
        
        try {
          // Call the health check function to find and relink missing stripeAccountId
          const response = await fetch(`${API_BASE_URL}/health-check-stripe-accounts?userId=${profileUser.id}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (!response.ok) {
            throw new Error(`Health check failed: ${response.status}`);
          }
          
          const result = await response.json();
          
          console.log('Health check result:', result);
          
          if (result.success) {
            console.log('✅ Auto-fix completed successfully. Refreshing earnings data...');
          } else {
            // If health check didn't succeed, try alternative approach
            console.log('Health check did not fix issue, trying alternative approach...');
            if (profileUser?.id) {
              const altResponse = await fetch(`${API_BASE_URL}/complete-stripe-onboarding?userId=${profileUser.id}`);
              if (altResponse.ok) {
                console.log('Alternative fix attempt completed');
              }
            }
          }
          
          // Always try to refresh data regardless of which method was used
          if (profileUser?.id) {
            // Wait a moment for database updates to propagate, then refresh
            setTimeout(async () => {
              if (profileUser?.id) {
                try {
                  setError(null); // Clear error state
                  setIsEarningsLoading(true);
                  
                  const response = await fetch(`${API_BASE_URL}/get-unified-earnings?userId=${profileUser.id}`);
                  const data = await response.json();
                  
                  if (data.success) {
                    setEarningsData(data.earnings);
                  } else {
                    console.warn('Still getting error after auto-fix:', data.error);
                  }
                } catch (error) {
                  console.error('Error refetching earnings after auto-fix:', error);
                } finally {
                  setIsEarningsLoading(false);
                }
              }
            }, 3000); // Increased delay to give database time to update
          }
        } catch (error) {
          console.error('❌ Auto-fix attempt failed:', error);
        }
      }
    };

    attemptAutoFix();
  }, [isActualOwner, earningsData?.isNewAccount, earningsData?.hasCreatorAccount, earningsData?.hasWinnerAccount, autoFixAttempted, isEarningsLoading, profileUser?.id, API_BASE_URL, error]);

  // Generate dashboard link
  const generateDashboardLink = async () => {
    if (!profileUser?.id) return;
    
    setIsDashboardLinkLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/get-dashboard-link-unified`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: profileUser.id, 
          accountType: 'auto' 
        }),
      });
      
      const data = await response.json();
      if (data.success && data.url) {
        setDashboardUrl(data.url);
        
        // Track dashboard link generation
        if (profileUser?.email) {
          trackEvent(profileUser.email, 'StripeDashboardLinkGenerated', {
            userId: profileUser.id,
            accountType: data.accountUsed || 'auto',
            hasCreatorAccount: earningsData?.hasCreatorAccount || false,
            hasWinnerAccount: earningsData?.hasWinnerAccount || false
          });
        }
      } else {
        console.error('Error getting dashboard link:', data.error);
      }
    } catch (err) {
      console.error('Error generating dashboard link:', err);
    } finally {
      setIsDashboardLinkLoading(false);
    }
  };

  // Handle payout request
  const handlePayoutRequest = async () => {
    if (!profileUser?.id || !payoutAmount) return;
    
    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount < 10) {
      alert('Please enter a valid amount (minimum $10.00)');
      return;
    }

    setPayoutLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/initiate-unified-payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profileUser.id,
          amount: amount,
          currency: 'usd'
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        // Track successful payout request
        if (profileUser?.email) {
          trackEvent(profileUser.email, 'PayoutRequested', {
            userId: profileUser.id,
            amount: amount,
            currency: 'usd',
            strategy: data.payout.strategy,
            estimatedArrival: data.payout.estimatedArrival.businessDays,
            payoutRecordId: data.payout.payoutRecordId
          });
        }
        
        alert(`Payout of $${amount.toFixed(2)} initiated successfully! Expected arrival: ${data.payout.estimatedArrival.businessDays}`);
        setShowPayoutModal(false);
        setPayoutAmount('');
        // Refresh earnings data
        window.location.reload();
      } else {
        // Track failed payout request
        if (profileUser?.email) {
          trackEvent(profileUser.email, 'PayoutFailed', {
            userId: profileUser.id,
            amount: amount,
            currency: 'usd',
            error: data.error
          });
        }
        
        alert(`Payout failed: ${data.error}`);
      }
    } catch (err) {
      console.error('Error initiating payout:', err);
      alert('Error initiating payout. Please try again.');
    } finally {
      setPayoutLoading(false);
    }
  };

  // Enhanced account setup logic with better detection
  const needsAnyAccountSetup = () => {
    if (!earningsData) return false;
    
    const hasCreatorEarnings = earningsData.creatorEarnings.totalEarned > 0;
    const hasPrizeWinnings = earningsData.prizeWinnings.totalEarned > 0;
    
    // Only show setup if they have specific earnings but no corresponding account
    const needsCreatorSetup = hasCreatorEarnings && !earningsData.hasCreatorAccount;
    const needsWinnerSetup = hasPrizeWinnings && !earningsData.hasWinnerAccount;
    
    return needsCreatorSetup || needsWinnerSetup;
  };

  const getAccountSetupDetails = () => {
    if (!earningsData) return { type: 'creator', hasEarnings: false };
    
    const hasCreatorEarnings = earningsData.creatorEarnings.totalEarned > 0;
    const hasPrizeWinnings = earningsData.prizeWinnings.totalEarned > 0;
    
    // Determine primary setup type based on earnings
    let primaryType = 'creator'; // Default to creator setup
    
    if (hasPrizeWinnings && !hasCreatorEarnings) {
      primaryType = 'winner';
    } else if (hasPrizeWinnings && hasCreatorEarnings) {
      // If they have both, prioritize creator setup first
      primaryType = 'creator';
    }
    
    return {
      type: primaryType,
      hasEarnings: hasCreatorEarnings || hasPrizeWinnings,
      hasCreatorEarnings,
      hasPrizeWinnings,
      creatorAmount: earningsData.creatorEarnings.totalEarned,
      prizeAmount: earningsData.prizeWinnings.totalEarned
    };
  };

  // Handle account setup navigation
  const handleAccountSetup = (setupType?: 'creator' | 'winner') => {
    const setupDetails = getAccountSetupDetails();
    const finalSetupType = setupType || setupDetails.type;
    
    const targetUrl = finalSetupType === 'winner' 
      ? '/winner/connect-account' 
      : '/trainer/connect-account';
    
    // Track account setup initiation
    if (profileUser?.email) {
      trackEvent(profileUser.email, 'AccountSetupInitiated', {
        userId: profileUser.id,
        setupType: finalSetupType,
        hasCreatorEarnings: setupDetails.hasCreatorEarnings,
        hasPrizeWinnings: setupDetails.hasPrizeWinnings,
        creatorEarningsAmount: setupDetails.creatorAmount,
        prizeWinningsAmount: setupDetails.prizeAmount,
        initiatedFrom: 'earnings_page'
      });
    }
    
    router.push(targetUrl);
  };

  // Loading state
  if (isLoading || isEarningsLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#E0FE10]"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white py-10">
        <div className="max-w-4xl mx-auto px-6 text-center">
          {autoFixAttempted ? (
            // Silent auto-fix in progress - show normal loading
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E0FE10] mb-4"></div>
              <h1 className="text-3xl font-bold mb-4">Loading your earnings...</h1>
              <p className="text-zinc-400">Please wait while we load your earnings data.</p>
            </div>
          ) : (
            // Show error only if auto-fix hasn't been attempted
            <>
              <h1 className="text-3xl font-bold mb-4">Error Loading Earnings</h1>
              <p className="text-zinc-400 mb-6">{error}</p>
              <button
                onClick={() => router.back()}
                className="bg-[#E0FE10] text-black py-3 px-6 rounded-xl font-semibold"
              >
                Go Back
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

       // Render comprehensive account setup view when needed
  const renderAccountSetupView = () => {
    const setupDetails = getAccountSetupDetails();
    
    return (
      <div className="min-h-screen bg-zinc-950 text-white py-10">
        <div className="max-w-4xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="text-6xl mb-6">🔗</div>
            <h1 className="text-3xl font-bold mb-4">Connect Your Payment Account</h1>
            <p className="text-zinc-400 text-lg mb-6">
              You have earnings available! Connect a payment account to access your earnings and request payouts.
            </p>
          </div>

          {/* Earnings Preview */}
          {setupDetails.hasEarnings && (
            <div className="bg-zinc-900 rounded-xl p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4 text-center">Your Available Earnings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {setupDetails.hasCreatorEarnings && (
                  <div className="bg-zinc-800 p-4 rounded-lg">
                    <h3 className="font-semibold text-[#E0FE10] mb-2">Creator Earnings</h3>
                    <p className="text-2xl font-bold">${setupDetails.creatorAmount.toFixed(2)}</p>
                    <p className="text-sm text-zinc-400">From selling rounds and programs</p>
                  </div>
                )}
                {setupDetails.hasPrizeWinnings && (
                  <div className="bg-zinc-800 p-4 rounded-lg">
                    <h3 className="font-semibold text-[#E0FE10] mb-2">Prize Winnings</h3>
                    <p className="text-2xl font-bold">${setupDetails.prizeAmount.toFixed(2)}</p>
                    <p className="text-sm text-zinc-400">From winning challenges</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Setup Options */}
          <div className="space-y-6">
            {setupDetails.hasCreatorEarnings && (
              <div className="bg-zinc-900 rounded-xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-3xl">💼</div>
                  <div>
                    <h3 className="text-xl font-semibold">Creator Account Setup</h3>
                    <p className="text-zinc-400">Connect your account to receive creator earnings</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-zinc-300">
                    <span className="text-[#E0FE10]">✓</span>
                    <span>Receive payments from program sales</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-300">
                    <span className="text-[#E0FE10]">✓</span>
                    <span>Track your earnings and payouts</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-300">
                    <span className="text-[#E0FE10]">✓</span>
                    <span>Access to Stripe Express Dashboard</span>
                  </div>
                </div>
                <button
                  onClick={() => handleAccountSetup('creator')}
                  className="w-full mt-4 bg-[#E0FE10] text-black py-3 px-6 rounded-xl font-semibold hover:bg-[#C5E609] transition-colors"
                >
                  Setup Creator Account
                </button>
              </div>
            )}

            {setupDetails.hasPrizeWinnings && (
              <div className="bg-zinc-900 rounded-xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-3xl">🏆</div>
                  <div>
                    <h3 className="text-xl font-semibold">Winner Account Setup</h3>
                    <p className="text-zinc-400">Connect your account to receive prize money</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-zinc-300">
                    <span className="text-[#E0FE10]">✓</span>
                    <span>Receive challenge prize money</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-300">
                    <span className="text-[#E0FE10]">✓</span>
                    <span>Fast and secure payouts</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-300">
                    <span className="text-[#E0FE10]">✓</span>
                    <span>Track your winnings history</span>
                  </div>
                </div>
                <button
                  onClick={() => handleAccountSetup('winner')}
                  className="w-full mt-4 bg-[#E0FE10] text-black py-3 px-6 rounded-xl font-semibold hover:bg-[#C5E609] transition-colors"
                >
                  Setup Winner Account
                </button>
              </div>
            )}

            {/* Default setup when no specific earnings */}
            {!setupDetails.hasEarnings && (
              <div className="bg-zinc-900 rounded-xl p-6">
                <div className="text-center">
                  <div className="text-3xl mb-4">💰</div>
                  <h3 className="text-xl font-semibold mb-2">Ready to Start Earning?</h3>
                  <p className="text-zinc-400 mb-6">
                    Set up your payment account to receive earnings from selling programs or winning challenges.
                  </p>
                  <button
                    onClick={() => handleAccountSetup('creator')}
                    className="bg-[#E0FE10] text-black py-3 px-6 rounded-xl font-semibold hover:bg-[#C5E609] transition-colors"
                  >
                    Setup Payment Account
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Security Notice */}
          <div className="mt-8 bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <span className="text-green-400 text-xl">🔒</span>
              <div>
                <p className="font-semibold text-green-400">Secure Payment Processing</p>
                <p className="text-sm text-zinc-400">
                  Your payment information is processed securely through Stripe. We never store your banking details.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Authentication mismatch - user trying to access someone else's earnings while logged in
  if (!isActualOwner && currentUser && profileUser) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white py-10">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-6">
              {profileUser?.profileImage?.profileImageURL ? (
                <Image
                  src={profileUser.profileImage.profileImageURL}
                  alt={profileUser.displayName}
                  width={96}
                  height={96}
                  className="rounded-full"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center">
                  <span className="text-2xl">{profileUser?.displayName?.charAt(0) || 'U'}</span>
                </div>
              )}
            </div>
            
            <h1 className="text-3xl font-bold mb-2">{profileUser?.displayName}'s Earnings</h1>
            <p className="text-zinc-400 mb-6">@{profileUser?.username}</p>
          </div>

          <div className="bg-orange-900/30 border border-orange-500/50 rounded-xl p-8 text-center">
            <div className="text-6xl mb-4">🔐</div>
            <h2 className="text-xl font-semibold mb-4">Account Access Required</h2>
            <p className="text-zinc-300 mb-6">
              You're currently signed in as <strong className="text-[#E0FE10]">@{currentUser.username}</strong>, 
              but this earnings dashboard belongs to <strong>@{profileUser.username}</strong>.
            </p>
            
            <div className="bg-zinc-900 rounded-lg p-4 mb-6">
              <p className="text-sm text-zinc-400 mb-4">
                To access this earnings dashboard, you need to:
              </p>
              <div className="text-left space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-orange-400">•</span>
                  <span className="text-sm">Sign out of your current account</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-orange-400">•</span>
                  <span className="text-sm">Sign in as @{profileUser.username}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-orange-400">•</span>
                  <span className="text-sm">Then return to this page</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <button
                onClick={() => {
                  // Use the logout API to properly sign out and redirect
                  const redirectUrl = `/${profileUser.username}/earnings`;
                  window.location.href = `/api/auth/logout?redirect=${encodeURIComponent(redirectUrl)}`;
                }}
                className="w-full bg-[#E0FE10] text-black py-3 px-6 rounded-xl font-semibold hover:bg-[#C5E609] transition-colors"
              >
                Sign Out & Switch Accounts
              </button>
              
              <div className="flex gap-4">
                <Link href={`/profile/${profileUser.username}`} className="flex-1">
                  <button className="w-full bg-zinc-800 text-white py-3 px-6 rounded-xl font-semibold hover:bg-zinc-700 transition-colors">
                    View {profileUser.displayName}'s Profile
                  </button>
                </Link>
                
                <Link href={`/${currentUser.username}/earnings`} className="flex-1">
                  <button className="w-full bg-zinc-800 text-white py-3 px-6 rounded-xl font-semibold hover:bg-zinc-700 transition-colors">
                    View My Earnings
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not logged in but trying to access someone's earnings (public view)
  if (!isActualOwner) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white py-10">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-6">
              {profileUser?.profileImage?.profileImageURL ? (
                <Image
                  src={profileUser.profileImage.profileImageURL}
                  alt={profileUser.displayName}
                  width={96}
                  height={96}
                  className="rounded-full"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center">
                  <span className="text-2xl">{profileUser?.displayName?.charAt(0) || 'U'}</span>
                </div>
              )}
            </div>
            
            <h1 className="text-3xl font-bold mb-2">{profileUser?.displayName}'s Earnings</h1>
            <p className="text-zinc-400 mb-6">@{profileUser?.username}</p>
          </div>

          <div className="bg-zinc-900 rounded-xl p-8 text-center">
            <div className="text-6xl mb-4">💰</div>
            <h2 className="text-xl font-semibold mb-4">Earnings Privacy</h2>
            <p className="text-zinc-400 mb-6">
              {profileUser?.displayName} has chosen to keep their earnings private.
            </p>
            
            <div className="space-y-4">
              <Link href={`/profile/${profileUser?.username}`}>
                <button className="w-full bg-zinc-800 text-white py-3 px-6 rounded-xl font-semibold">
                  View Profile
                </button>
              </Link>
              
              {currentUser ? (
                <Link href={`/${currentUser.username}/earnings`}>
                  <button className="w-full bg-[#E0FE10] text-black py-3 px-6 rounded-xl font-semibold">
                    View My Earnings
                  </button>
                </Link>
              ) : (
                <button
                  onClick={() => router.push('/login')}
                  className="w-full bg-[#E0FE10] text-black py-3 px-6 rounded-xl font-semibold"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show account setup view if user needs to connect accounts
  if (isActualOwner && earningsData && needsAnyAccountSetup()) {
    return renderAccountSetupView();
  }

  // Owner viewing their own earnings (private view)
  return (
    <div className="min-h-screen bg-zinc-950 text-white py-10">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <div className="text-6xl">💰</div>
          </div>
          <h1 className="text-3xl font-bold mb-2">My Earnings</h1>
          <p className="text-zinc-400 mb-4">
            Your complete earnings dashboard from the Pulse platform
          </p>
          
          {/* Privacy Settings Button */}
          <button
            onClick={() => setShowPrivacyModal(true)}
            className="text-sm text-zinc-400 hover:text-white flex items-center gap-2 mx-auto"
          >
            <span>⚙️</span>
            Privacy Settings
          </button>
        </div>

        {/* Loading state for earnings */}
        {!earningsData ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#E0FE10] mx-auto mb-4"></div>
            <p className="text-zinc-400">Loading your earnings...</p>
          </div>
        ) : (
          <>
            {/* Main Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Total Balance */}
              <div className="bg-zinc-900 p-6 rounded-xl border border-[#E0FE10]/20">
                <h3 className="text-zinc-400 text-sm mb-2">Available Balance</h3>
                <p className="text-3xl font-bold text-[#E0FE10]">
                  ${earningsData.totalBalance.toFixed(2)}
                </p>
                <p className="text-xs text-zinc-500 mt-1">Ready for payout</p>
              </div>

              {/* Total Earned */}
              <div className="bg-zinc-900 p-6 rounded-xl">
                <h3 className="text-zinc-400 text-sm mb-2">Total Earned</h3>
                <p className="text-3xl font-bold">
                  ${earningsData.totalEarned.toFixed(2)}
                </p>
                <p className="text-xs text-zinc-500 mt-1">Lifetime earnings</p>
              </div>

              {/* Pending */}
              <div className="bg-zinc-900 p-6 rounded-xl">
                <h3 className="text-zinc-400 text-sm mb-2">Pending Payout</h3>
                <p className="text-3xl font-bold text-yellow-400">
                  ${earningsData.pendingPayout.toFixed(2)}
                </p>
                <p className="text-xs text-zinc-500 mt-1">Processing</p>
              </div>
            </div>

            {/* Earnings Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Creator Earnings */}
              <div className="bg-zinc-900 p-6 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold">Creator Earnings</h3>
                  <span className="text-2xl">🎯</span>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Total Earned</span>
                    <span className="font-semibold">${earningsData.creatorEarnings.totalEarned.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Available</span>
                    <span className="font-semibold text-green-400">${earningsData.creatorEarnings.availableBalance.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Programs Sold</span>
                    <span className="font-semibold">{earningsData.creatorEarnings.roundsSold}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      earningsData.creatorEarnings.onboardingStatus === 'complete' 
                        ? 'bg-green-400' 
                        : 'bg-yellow-400'
                    }`}></div>
                    <span className="text-sm text-zinc-400">
                      {earningsData.creatorEarnings.onboardingStatus === 'complete' 
                        ? 'Account Active' 
                        : 'Setup Required'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Prize Winnings */}
              <div className="bg-zinc-900 p-6 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold">Prize Winnings</h3>
                  <span className="text-2xl">🏆</span>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Total Earned</span>
                    <span className="font-semibold">${earningsData.prizeWinnings.totalEarned.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Available</span>
                    <span className="font-semibold text-green-400">${earningsData.prizeWinnings.availableBalance.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Challenges Won</span>
                    <span className="font-semibold">{earningsData.prizeWinnings.totalWins}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      earningsData.prizeWinnings.onboardingStatus === 'complete' 
                        ? 'bg-green-400' 
                        : 'bg-yellow-400'
                    }`}></div>
                    <span className="text-sm text-zinc-400">
                      {earningsData.prizeWinnings.onboardingStatus === 'complete' 
                        ? 'Account Active' 
                        : 'Setup Required'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              {/* Payout Button */}
              {earningsData.canRequestPayout ? (
                <button
                  onClick={() => setShowPayoutModal(true)}
                  disabled={earningsData.totalBalance < earningsData.minimumPayoutAmount}
                  className="flex-1 bg-[#E0FE10] text-black py-3 px-6 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Request Payout
                </button>
              ) : earningsData.needsAccountSetup ? (
                <button
                  onClick={() => handleAccountSetup()}
                  className="flex-1 bg-[#E0FE10] text-black py-3 px-6 rounded-xl font-semibold"
                >
                  Setup Payment Account
                </button>
              ) : (
                <button
                  disabled
                  className="flex-1 bg-zinc-800 text-zinc-500 py-3 px-6 rounded-xl font-semibold cursor-not-allowed"
                >
                  No Earnings Available
                </button>
              )}

              {/* Dashboard Link */}
              {(earningsData.hasCreatorAccount || earningsData.hasWinnerAccount) && (
                <>
                  {isDashboardLinkLoading ? (
                    <div className="flex-1 bg-zinc-800 py-3 px-6 rounded-xl font-semibold flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                    </div>
                  ) : dashboardUrl ? (
                    <a 
                      href={dashboardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-zinc-800 text-white py-3 px-6 rounded-xl font-semibold text-center"
                    >
                      View Stripe Dashboard
                    </a>
                  ) : (
                    <button 
                      onClick={generateDashboardLink}
                      className="flex-1 bg-zinc-800 text-white py-3 px-6 rounded-xl font-semibold"
                    >
                      Load Dashboard Link
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Recent Transactions */}
            <div className="bg-zinc-900 p-6 rounded-xl">
              <h3 className="text-xl font-semibold mb-6">Recent Transactions</h3>
              
              {earningsData.transactions.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">📊</div>
                  <p className="text-zinc-400 mb-2">No transactions yet</p>
                  <p className="text-sm text-zinc-500">Your earnings will appear here when you start selling programs or winning challenges</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {earningsData.transactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="text-2xl">
                          {transaction.type === 'creator_sale' ? '🎯' : '🏆'}
                        </div>
                        <div>
                          <p className="font-semibold">{transaction.description}</p>
                          <p className="text-sm text-zinc-400">
                            {transaction.type === 'creator_sale' ? 'Program Sale' : 'Prize Winning'} • {transaction.date}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-400">+${transaction.amount.toFixed(2)}</p>
                        <p className={`text-xs ${
                          transaction.status === 'completed' || transaction.status === 'paid' 
                            ? 'text-green-400' 
                            : transaction.status === 'pending' 
                              ? 'text-yellow-400' 
                              : 'text-zinc-400'
                        }`}>
                          {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Last Updated */}
            <div className="text-center mt-8">
              <p className="text-xs text-zinc-500">
                Last updated: {new Date(earningsData.lastUpdated).toLocaleString()}
              </p>
            </div>
          </>
        )}

        {/* Payout Modal */}
        {showPayoutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-zinc-900 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-semibold mb-4">Request Payout</h3>
              
              <div className="mb-4">
                <p className="text-sm text-zinc-400 mb-2">Available Balance</p>
                <p className="text-2xl font-bold text-[#E0FE10]">
                  ${earningsData?.totalBalance.toFixed(2)}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm text-zinc-400 mb-2">
                  Payout Amount (minimum ${earningsData?.minimumPayoutAmount})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400">$</span>
                  <input
                    type="number"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    placeholder="0.00"
                    min={earningsData?.minimumPayoutAmount}
                    max={earningsData?.totalBalance}
                    step="0.01"
                    className="w-full bg-zinc-800 text-white pl-8 pr-4 py-3 rounded-lg border border-zinc-700 focus:border-[#E0FE10] focus:outline-none"
                  />
                </div>
              </div>

              <div className="mb-6">
                <p className="text-xs text-zinc-500">
                  Estimated arrival: {earningsData?.nextPayoutDate 
                    ? `${earningsData.nextPayoutDate} (2-7 business days)` 
                    : '2-7 business days'}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPayoutModal(false)}
                  className="flex-1 bg-zinc-800 text-white py-3 px-4 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePayoutRequest}
                  disabled={payoutLoading || !payoutAmount || parseFloat(payoutAmount) < (earningsData?.minimumPayoutAmount || 10)}
                  className="flex-1 bg-[#E0FE10] text-black py-3 px-4 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {payoutLoading ? 'Processing...' : 'Request Payout'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Privacy Settings Modal */}
        {showPrivacyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-zinc-900 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-semibold mb-4">Earnings Privacy Settings</h3>
              <p className="text-sm text-zinc-400 mb-6">
                Control what earnings information is visible on your public profile
              </p>
              
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Show Total Earnings</p>
                    <p className="text-xs text-zinc-500">Display your total earnings amount publicly</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={earningsPrivacy.showTotalEarnings}
                      onChange={(e) => setEarningsPrivacy(prev => ({
                        ...prev,
                        showTotalEarnings: e.target.checked
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#E0FE10]"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Show Earnings Breakdown</p>
                    <p className="text-xs text-zinc-500">Show creator vs prize earnings split</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={earningsPrivacy.showEarningsBreakdown}
                      onChange={(e) => setEarningsPrivacy(prev => ({
                        ...prev,
                        showEarningsBreakdown: e.target.checked
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#E0FE10]"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Show Transaction Count</p>
                    <p className="text-xs text-zinc-500">Display number of sales and wins</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={earningsPrivacy.showTransactionCount}
                      onChange={(e) => setEarningsPrivacy(prev => ({
                        ...prev,
                        showTransactionCount: e.target.checked
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#E0FE10]"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Show Recent Activity</p>
                    <p className="text-xs text-zinc-500">Show recent transaction types (not amounts)</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={earningsPrivacy.showRecentActivity}
                      onChange={(e) => setEarningsPrivacy(prev => ({
                        ...prev,
                        showRecentActivity: e.target.checked
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#E0FE10]"></div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPrivacyModal(false)}
                  className="flex-1 bg-zinc-800 text-white py-3 px-4 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Track privacy settings update
                    if (profileUser?.email) {
                      trackEvent(profileUser.email, 'EarningsPrivacyUpdated', {
                        userId: profileUser.id,
                        showTotalEarnings: earningsPrivacy.showTotalEarnings,
                        showEarningsBreakdown: earningsPrivacy.showEarningsBreakdown,
                        showTransactionCount: earningsPrivacy.showTransactionCount,
                        showRecentActivity: earningsPrivacy.showRecentActivity
                      });
                    }
                    
                    // TODO: Save privacy settings to user profile
                    console.log('Saving privacy settings:', earningsPrivacy);
                    setShowPrivacyModal(false);
                  }}
                  className="flex-1 bg-[#E0FE10] text-black py-3 px-4 rounded-lg font-semibold"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<EarningsPageProps> = async (context) => {
  const { username } = context.params || {};

  if (!username || typeof username !== 'string') {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  try {
    const API_BASE_URL = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:8888/.netlify/functions'
      : 'https://fitwithpulse.ai/.netlify/functions';

    // Fetch the profile user data
    const response = await fetch(`${API_BASE_URL}/get-user-profile?username=${username}`);
    
    if (!response.ok) {
      throw new Error('Profile not found');
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to load profile');
    }

    const profileUser = data.user;

    // Check if this is the user viewing their own earnings
    // We'll determine this on the client side based on authentication
    const isOwner = false; // Will be determined client-side

    return {
      props: {
        profileUser,
        isOwner,
        error: null
      }
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    return {
      props: {
        profileUser: null,
        isOwner: false,
        error: error instanceof Error ? error.message : 'Failed to load profile'
      }
    };
  }
};

export default UnifiedEarningsPage; 