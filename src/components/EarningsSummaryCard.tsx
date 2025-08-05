import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface EarningsSummary {
  totalEarned: number;
  availableBalance: number;
  creatorEarnings: number;
  prizeWinnings: number;
  totalTransactions: number;
  isNewAccount: boolean;
}

interface EarningsSummaryCardProps {
  userId: string;
  username: string;
  isOwnProfile: boolean;
  privacySettings?: {
    showTotalEarnings: boolean;
    showEarningsBreakdown: boolean;
    showTransactionCount: boolean;
  };
}

const EarningsSummaryCard: React.FC<EarningsSummaryCardProps> = ({
  userId,
  username,
  isOwnProfile,
  privacySettings = {
    showTotalEarnings: false,
    showEarningsBreakdown: false,
    showTransactionCount: false
  }
}) => {
  const [earningsSummary, setEarningsSummary] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:8888/.netlify/functions'
    : 'https://fitwithpulse.ai/.netlify/functions';

  useEffect(() => {
    const fetchEarningsSummary = async () => {
      if (!userId || (!isOwnProfile && !privacySettings.showTotalEarnings)) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/get-unified-earnings?userId=${userId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch earnings data');
        }
        
        const data = await response.json();
        
        if (data.success) {
          const earnings = data.earnings;
          setEarningsSummary({
            totalEarned: earnings.totalEarned,
            availableBalance: earnings.totalBalance,
            creatorEarnings: earnings.creatorEarnings.totalEarned,
            prizeWinnings: earnings.prizeWinnings.totalEarned,
            totalTransactions: earnings.transactions.length,
            isNewAccount: earnings.isNewAccount
          });
        } else {
          throw new Error(data.error || 'Failed to load earnings data');
        }
      } catch (err) {
        console.error('Error fetching earnings summary:', err);
        setError(err instanceof Error ? err.message : 'Failed to load earnings');
      } finally {
        setLoading(false);
      }
    };

    fetchEarningsSummary();
  }, [userId, isOwnProfile, privacySettings, API_BASE_URL]);

  // Loading state
  if (loading) {
    return (
      <div className="bg-zinc-900 p-6 rounded-xl animate-pulse">
        <div className="h-4 bg-zinc-800 rounded w-1/3 mb-4"></div>
        <div className="h-8 bg-zinc-800 rounded w-1/2 mb-2"></div>
        <div className="h-3 bg-zinc-800 rounded w-2/3"></div>
      </div>
    );
  }

  // Error state
  if (error && isOwnProfile) {
    return (
      <div className="bg-zinc-900 p-6 rounded-xl">
        <div className="text-center">
          <div className="text-2xl mb-2">⚠️</div>
          <p className="text-sm text-zinc-400">Unable to load earnings</p>
        </div>
      </div>
    );
  }

  // No earnings data or privacy restricted
  if (!earningsSummary || (!isOwnProfile && !privacySettings.showTotalEarnings)) {
    if (isOwnProfile) {
      return (
        <div className="bg-zinc-900 p-6 rounded-xl">
          <div className="text-center">
            <div className="text-4xl mb-4">💰</div>
            <h3 className="font-semibold mb-2">Start Earning</h3>
            <p className="text-sm text-zinc-400 mb-4">
              Create training programs or compete in challenges to start earning
            </p>
            <Link href={`/${username}/earnings`}>
              <button className="bg-[#E0FE10] text-black py-2 px-4 rounded-lg text-sm font-semibold">
                View Dashboard
              </button>
            </Link>
          </div>
        </div>
      );
    } else {
      return (
        <div className="bg-zinc-900 p-6 rounded-xl">
          <div className="text-center">
            <div className="text-4xl mb-4">🔒</div>
            <h3 className="font-semibold mb-2">Private Earnings</h3>
            <p className="text-sm text-zinc-400">
              Earnings information is private
            </p>
          </div>
        </div>
      );
    }
  }

  // Render earnings summary based on privacy settings and ownership
  return (
    <div className="bg-zinc-900 p-6 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Earnings</h3>
        <span className="text-2xl">💰</span>
      </div>

      <div className="space-y-3">
        {/* Total Earnings - show if own profile or privacy allows */}
        {(isOwnProfile || privacySettings.showTotalEarnings) && (
          <div className="flex justify-between">
            <span className="text-zinc-400">Total Earned</span>
            <span className="font-semibold text-[#E0FE10]">
              ${earningsSummary.totalEarned.toFixed(2)}
            </span>
          </div>
        )}

        {/* Available Balance - own profile only */}
        {isOwnProfile && (
          <div className="flex justify-between">
            <span className="text-zinc-400">Available</span>
            <span className="font-semibold text-green-400">
              ${earningsSummary.availableBalance.toFixed(2)}
            </span>
          </div>
        )}

        {/* Earnings Breakdown - show if own profile or privacy allows */}
        {(isOwnProfile || privacySettings.showEarningsBreakdown) && (
          <>
            {earningsSummary.creatorEarnings > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-400 text-sm">Creator</span>
                <span className="text-sm">${earningsSummary.creatorEarnings.toFixed(2)}</span>
              </div>
            )}
            {earningsSummary.prizeWinnings > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-400 text-sm">Prizes</span>
                <span className="text-sm">${earningsSummary.prizeWinnings.toFixed(2)}</span>
              </div>
            )}
          </>
        )}

        {/* Transaction Count - show if own profile or privacy allows */}
        {(isOwnProfile || privacySettings.showTransactionCount) && (
          <div className="flex justify-between">
            <span className="text-zinc-400 text-sm">Transactions</span>
            <span className="text-sm">{earningsSummary.totalTransactions}</span>
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="mt-4 pt-4 border-t border-zinc-800">
        <Link href={`/${username}/earnings`}>
          <button className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-2 px-4 rounded-lg text-sm font-semibold transition-colors">
            {isOwnProfile ? 'View Full Dashboard' : 'View Earnings'}
          </button>
        </Link>
      </div>
    </div>
  );
};

export default EarningsSummaryCard; 