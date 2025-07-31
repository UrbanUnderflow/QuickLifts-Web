// FILE: pages/winner/dashboard.tsx
// Public winner dashboard page for Stripe onboarding completion and prize history

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';

interface PrizeRecord {
  id: string;
  challengeId: string;
  challengeTitle: string;
  placement: number;
  score: number;
  prizeAmount: number;
  status: 'pending' | 'processing' | 'paid' | 'failed';
  createdAt: any;
  updatedAt: any;
  paidAt?: any;
  stripeTransferId?: string;
}

interface WinnerSummary {
  totalEarnings: number;
  totalWins: number;
  pendingAmount: number;
  paidAmount: number;
  onboardingStatus: string;
  stripeAccountId: string | null;
  lastPayoutDate: any;
}

const WinnerDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [prizeRecords, setPrizeRecords] = useState<PrizeRecord[]>([]);
  const [summary, setSummary] = useState<WinnerSummary | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dashboardUrl, setDashboardUrl] = useState<string>('');
  const [isDashboardLinkLoading, setIsDashboardLinkLoading] = useState(false);
  
  const router = useRouter();
  const { complete, challengeId, placement } = router.query;

  const currentUser = useSelector((state: RootState) => state.user.currentUser);
  const isLoading = useSelector((state: RootState) => state.user.loading);

  useEffect(() => {
    // Check if this is a Stripe onboarding completion redirect
    if (complete === 'true') {
      setOnboardingComplete(true);
      
      // If user is logged in, mark their onboarding as complete
      if (currentUser?.id) {
        markOnboardingComplete();
      }
    }
  }, [complete, currentUser]);

  useEffect(() => {
    // Fetch prize data when user is available
    if (currentUser?.id && !isLoading) {
      fetchPrizeHistory();
    }
  }, [currentUser, isLoading]);

  const markOnboardingComplete = async () => {
    if (!currentUser?.id) return;
    
    setLoading(true);
    try {
      await fetch(`/.netlify/functions/complete-winner-stripe-onboarding?userId=${currentUser.id}`);
      console.log('Winner onboarding marked as complete');
      // Refresh prize data after marking complete
      if (currentUser?.id) {
        fetchPrizeHistory();
      }
    } catch (err) {
      console.error('Error marking winner onboarding complete:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrizeHistory = async () => {
    if (!currentUser?.id) return;
    
    setIsLoadingData(true);
    try {
      const response = await fetch(`/.netlify/functions/get-winner-prize-history?userId=${currentUser.id}`);
      const data = await response.json();
      
      if (data.success) {
        setPrizeRecords(data.prizeRecords || []);
        setSummary(data.summary || null);
        console.log('Prize history loaded:', data);
        
        // Generate Stripe dashboard link if user has completed onboarding
        if (data.summary?.stripeAccountId && data.summary?.onboardingStatus === 'complete') {
          generateDashboardLink();
        }
      } else {
        console.error('Error fetching prize history:', data.error);
      }
    } catch (error) {
      console.error('Error fetching prize history:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const generateDashboardLink = async () => {
    if (!currentUser?.id) return;
    
    setIsDashboardLinkLoading(true);
    try {
      const response = await fetch('/.netlify/functions/get-dashboard-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, accountType: 'winner' }),
      });
      
      const data = await response.json();
      if (data.success && data.url) {
        setDashboardUrl(data.url);
      } else {
        console.error('Error getting dashboard link:', data.error);
      }
    } catch (err) {
      console.error('Error generating dashboard link:', err);
    } finally {
      setIsDashboardLinkLoading(false);
    }
  };

  const getPlacementDisplay = (placement: number) => {
    switch (placement) {
      case 1: return { emoji: '🥇', text: '1st Place' };
      case 2: return { emoji: '🥈', text: '2nd Place' };
      case 3: return { emoji: '🥉', text: '3rd Place' };
      default: return { emoji: '🏆', text: `${placement}th Place` };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-900/30 text-yellow-400 border border-yellow-500/50">Pending</span>;
      case 'processing':
        return <span className="px-2 py-1 text-xs rounded-full bg-blue-900/30 text-blue-400 border border-blue-500/50">Processing</span>;
      case 'paid':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-900/30 text-green-400 border border-green-500/50">Paid</span>;
      case 'failed':
        return <span className="px-2 py-1 text-xs rounded-full bg-red-900/30 text-red-400 border border-red-500/50">Failed</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-zinc-700 text-zinc-400">Unknown</span>;
    }
  };

  const handleReturnToChallenge = () => {
    if (challengeId) {
      router.push(`/round/${challengeId}/wrapup`);
    } else {
      router.push('/');
    }
  };

  const handleSignIn = () => {
    router.push('/login');
  };

  const renderSummaryStats = () => {
    if (!summary) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-zinc-900 p-4 rounded-xl">
          <h3 className="text-zinc-400 text-sm mb-1">Total Earned</h3>
          <p className="text-2xl font-bold">${(summary.totalEarnings / 100).toFixed(2)}</p>
        </div>
        
        <div className="bg-zinc-900 p-4 rounded-xl">
          <h3 className="text-zinc-400 text-sm mb-1">Pending</h3>
          <p className="text-2xl font-bold text-yellow-400">${(summary.pendingAmount / 100).toFixed(2)}</p>
        </div>
        
        <div className="bg-zinc-900 p-4 rounded-xl">
          <h3 className="text-zinc-400 text-sm mb-1">Paid Out</h3>
          <p className="text-2xl font-bold text-green-400">${(summary.paidAmount / 100).toFixed(2)}</p>
        </div>
        
        <div className="bg-zinc-900 p-4 rounded-xl">
          <h3 className="text-zinc-400 text-sm mb-1">Total Wins</h3>
          <p className="text-2xl font-bold">{summary.totalWins}</p>
        </div>
      </div>
    );
  };

  const renderPrizeHistory = () => {
    if (isLoadingData) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-zinc-900 p-6 rounded-xl animate-pulse">
              <div className="h-4 bg-zinc-800 rounded w-1/3 mb-2"></div>
              <div className="h-6 bg-zinc-800 rounded w-1/2 mb-4"></div>
              <div className="h-3 bg-zinc-800 rounded w-1/4"></div>
            </div>
          ))}
        </div>
      );
    }

    if (prizeRecords.length === 0) {
      return (
        <div className="bg-zinc-900 rounded-xl p-8 text-center">
          <div className="text-4xl mb-4">🏆</div>
          <h3 className="text-xl font-semibold mb-2">No Prize Wins Yet</h3>
          <p className="text-zinc-400 mb-6">
            You haven't won any challenges with prize money yet. Keep competing to earn your first prize!
          </p>
          <button
            onClick={() => router.push('/')}
            className="bg-[#E0FE10] text-black py-3 px-6 rounded-xl font-semibold"
          >
            Find Challenges
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {prizeRecords.map((record) => {
          const placement = getPlacementDisplay(record.placement);
          return (
            <div key={record.id} className="bg-zinc-900 p-6 rounded-xl">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{placement.emoji}</span>
                    <div>
                      <h3 className="font-semibold">{record.challengeTitle}</h3>
                      <p className="text-sm text-zinc-400">{placement.text}</p>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-500">Score: {Math.floor(record.score)} points</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-400">${(record.prizeAmount / 100).toFixed(2)}</p>
                  {getStatusBadge(record.status)}
                </div>
              </div>
              
              <div className="flex items-center justify-between text-sm text-zinc-400">
                <span>
                  Won on {record.createdAt?.toDate ? 
                    record.createdAt.toDate().toLocaleDateString() : 
                    new Date(record.createdAt).toLocaleDateString()
                  }
                </span>
                <button
                  onClick={() => router.push(`/round/${record.challengeId}/wrapup`)}
                  className="text-[#E0FE10] hover:underline"
                >
                  View Challenge →
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderPaymentSetup = () => {
    if (!summary) return null;

    const hasStripeAccount = summary.stripeAccountId && summary.onboardingStatus === 'complete';

    return (
      <div className="bg-zinc-900 p-6 rounded-xl mb-8">
        <h2 className="text-xl font-semibold mb-4">Payment Account</h2>
        
        {hasStripeAccount ? (
          <div>
            <p className="text-green-400 mb-4">✅ Payment account active and ready to receive payouts</p>
            {isDashboardLinkLoading ? (
              <div className="h-10 bg-zinc-800 rounded w-48 animate-pulse"></div>
            ) : dashboardUrl ? (
              <a 
                href={dashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#E0FE10] text-black py-3 px-6 rounded-xl font-semibold inline-block"
              >
                View Stripe Dashboard
              </a>
            ) : (
              <button 
                onClick={generateDashboardLink}
                className="bg-zinc-800 text-white py-3 px-6 rounded-xl font-semibold"
              >
                Load Dashboard Link
              </button>
            )}
          </div>
        ) : summary.totalWins > 0 ? (
          <div>
            <p className="text-yellow-400 mb-4">⚠️ You have prize money but need to set up payments</p>
            <button
              onClick={() => {
                if (prizeRecords.length > 0) {
                  router.push(`/winner/connect-account?challengeId=${prizeRecords[0].challengeId}&placement=${prizeRecords[0].placement}`);
                }
              }}
              className="bg-[#E0FE10] text-black py-3 px-6 rounded-xl font-semibold"
            >
              Set Up Payment Account
            </button>
          </div>
        ) : (
          <p className="text-zinc-400">Payment account setup will be available when you win your first challenge with prize money.</p>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white py-10">
      <div className="max-w-4xl mx-auto px-6">
        {onboardingComplete ? (
          // Stripe onboarding completion success
          <div className="text-center mb-8">
            <div className="mb-8">
              <div className="text-6xl mb-4">🎉</div>
              <h1 className="text-3xl font-bold mb-4">Payment Setup Complete!</h1>
              <p className="text-lg text-zinc-300 mb-6">
                Your payment account has been successfully set up. You're all ready to receive your prize money!
              </p>
            </div>

            <div className="bg-green-900/30 border border-green-500/50 rounded-xl p-6 mb-8">
              <div className="text-4xl mb-2">✅</div>
              <h2 className="text-xl font-semibold mb-2">Next Steps</h2>
              <p className="text-green-200 text-sm">
                Your prize money will be processed and transferred to your account within 1-2 business days. 
                You'll receive an email confirmation once the transfer is complete.
              </p>
            </div>

            <div className="space-y-4 mb-8">
              {challengeId && (
                <button
                  onClick={handleReturnToChallenge}
                  className="w-full bg-[#E0FE10] text-black py-3 px-6 rounded-xl font-semibold"
                >
                  Return to Challenge Results
                </button>
              )}
              
              <button
                onClick={() => setOnboardingComplete(false)}
                className="w-full bg-zinc-800 text-white py-3 px-6 rounded-xl font-semibold"
              >
                View Prize Dashboard
              </button>
            </div>
          </div>
        ) : (
          // Regular winner dashboard
          <div>
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🏆</div>
              <h1 className="text-3xl font-bold mb-4">Winner Dashboard</h1>
              
              {currentUser ? (
                <p className="text-lg text-zinc-300 mb-6">
                  Welcome back, {currentUser.username}!
                </p>
              ) : (
                <div className="mb-6">
                  <p className="text-lg text-zinc-300 mb-4">
                    Sign in to view your prize money status and history.
                  </p>
                  <button
                    onClick={handleSignIn}
                    className="bg-[#E0FE10] text-black py-3 px-6 rounded-xl font-semibold"
                  >
                    Sign In
                  </button>
                </div>
              )}
            </div>

            {currentUser && (
              <>
                {renderSummaryStats()}
                {renderPaymentSetup()}
                
                <div className="mb-8">
                  <h2 className="text-2xl font-bold mb-6">Prize History</h2>
                  {renderPrizeHistory()}
                </div>
              </>
            )}

            {!currentUser && (
              <div className="text-center">
                <button
                  onClick={() => router.push('/')}
                  className="bg-zinc-800 text-white py-3 px-6 rounded-xl font-semibold"
                >
                  Continue as Guest
                </button>
              </div>
            )}
          </div>
        )}
        
        {loading && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-zinc-900 p-6 rounded-xl">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white mx-auto mb-4"></div>
              <p>Finalizing setup...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WinnerDashboard; 