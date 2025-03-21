// FILE: pages/trainer/dashboard.tsx
// Dashboard for trainers to view their earnings and payment status

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { userService } from '../../api/firebase/user/service';

interface EarningsData {
  totalEarned: number;
  pendingPayout: number;
  availableBalance: number;
  roundsSold: number;
  lastUpdated?: string;
  recentSales: {
    date: string;
    roundTitle: string;
    amount: number;
    status?: string;
  }[];
  isNewAccount: boolean;
}

const TrainerDashboard = () => {
  const [dashboardUrl, setDashboardUrl] = useState<string>('');
  const [accountStatus, setAccountStatus] = useState<'loading' | 'not_started' | 'incomplete' | 'complete' | 'error'>('loading');
  const [earningsData, setEarningsData] = useState<EarningsData | null>(null);
  const [isAccountLoading, setIsAccountLoading] = useState(true);
  const [isEarningsLoading, setIsEarningsLoading] = useState(true);
  const [isDashboardLinkLoading, setIsDashboardLinkLoading] = useState(false);
  const router = useRouter();
  
  // Get user from Redux store
  const currentUser = useSelector((state: RootState) => state.user.currentUser);
  const isLoading = useSelector((state: RootState) => state.user.loading);

  useEffect(() => {
    // If still loading, wait
    if (isLoading) {
      return;
    }
    
    // Check if user is authenticated
    if (!currentUser) {
      router.push('/login?redirect=/trainer/dashboard');
      return;
    }

    // Check if the user completed the onboarding from a redirect
    if (router.query.complete) {
      markOnboardingComplete();
    }

    fetchAccountStatus();
    fetchEarningsData();
  }, [router.query, currentUser, isLoading, router]);

  const markOnboardingComplete = async () => {
    if (!currentUser?.id) return;
    
    try {
      await fetch(
        `/.netlify/functions/complete-stripe-onboarding?userId=${currentUser.id}`
      );
      // Refresh the page without the query parameter
      router.replace('/trainer/dashboard');
    } catch (err) {
      console.error('Error marking onboarding complete:', err);
    }
  };

  const fetchAccountStatus = async () => {
    if (!currentUser?.id) return;
    
    setIsAccountLoading(true);
    
    try {
      const userData = await userService.fetchUserFromFirestore(currentUser.id);
      console.log('User data retrieved for status check:', {
        id: userData?.id,
        hasCreator: !!userData?.creator,
        creatorType: userData?.creator ? typeof userData.creator : 'n/a',
        onboardingStatus: userData?.creator?.onboardingStatus || 'none',
        hasStripeId: !!userData?.creator?.stripeAccountId,
        stripeAccountId: userData?.creator?.stripeAccountId || 'none',
        creatorObjectKeys: userData?.creator ? Object.keys(userData.creator) : [],
        creatorJSON: userData?.creator ? JSON.stringify(userData.creator) : 'n/a'
      });

      // First check if the creator object exists and has a stripeAccountId property
      // that is not undefined, null, or empty string
      const hasValidStripeAccount = 
        userData?.creator && 
        typeof userData.creator.stripeAccountId === 'string' && 
        userData.creator.stripeAccountId.trim() !== '';
        
      console.log('Has valid Stripe account:', hasValidStripeAccount);
      
      if (hasValidStripeAccount) {
        console.log('User has Stripe account ID:', userData?.creator?.stripeAccountId);
        setAccountStatus('complete');
        
        // If status doesn't match the presence of stripeAccountId, fix it
        if (userData?.creator?.onboardingStatus !== 'complete') {
          console.log('Fixing inconsistent onboarding status');
          await fetch(
            `/.netlify/functions/complete-stripe-onboarding?userId=${currentUser.id}`
          );
        }
        
        // Generate Stripe Dashboard link
        generateDashboardLink();
      } else {
        console.log('No valid stripe account ID found, checking onboarding status');
        // If status is complete but no stripeAccountId, fix the inconsistency
        if (userData?.creator?.onboardingStatus === 'complete') {
          console.log('Fixing inconsistency: status is complete but no stripeAccountId');
          await fetch(
            `/.netlify/functions/reset-onboarding?userId=${currentUser.id}`
          );
        }
        
        setAccountStatus('incomplete');
        console.log('Account status set to incomplete');
      }
    } catch (err) {
      console.error('Error fetching account status:', err);
      setAccountStatus('error');
    } finally {
      setIsAccountLoading(false);
    }
  };

  const fetchEarningsData = async () => {
    if (!currentUser?.id) return;
    
    try {
      setIsEarningsLoading(true);
      const response = await fetch(`/.netlify/functions/get-earnings?userId=${currentUser.id}`);
      const data = await response.json();
      
      console.log('Earnings data:', data);
      
      if (data.success && data.earnings) {
        setEarningsData(data.earnings);
      } else {
        console.error('Error fetching earnings data:', data.error || 'Unknown error');
        // Initialize with zeros if there's an error
        setEarningsData({
          totalEarned: 0,
          pendingPayout: 0,
          availableBalance: 0,
          roundsSold: 0,
          recentSales: [],
          lastUpdated: new Date().toISOString(),
          isNewAccount: true
        });
      }
    } catch (error) {
      console.error('Error fetching earnings data:', error);
      // Initialize with zeros if there's an error
      setEarningsData({
        totalEarned: 0,
        pendingPayout: 0,
        availableBalance: 0,
        roundsSold: 0,
        recentSales: [],
        lastUpdated: new Date().toISOString(),
        isNewAccount: true
      });
    } finally {
      setIsEarningsLoading(false);
    }
  };

  const generateDashboardLink = async () => {
    if (!currentUser?.id) return;
    
    setIsDashboardLinkLoading(true);
    
    try {
      console.log('Generating dashboard link for user:', currentUser.id);
      const response = await fetch('/.netlify/functions/get-dashboard-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      
      const data = await response.json();
      console.log('Dashboard link response:', data);
      
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

  const renderAccountStatus = () => {
    console.log('Rendering account status:', accountStatus);
    
    if (isAccountLoading) {
      return (
        <div className="bg-zinc-900 p-6 rounded-xl mb-8 animate-pulse">
          <div className="h-6 bg-zinc-800 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-zinc-800 rounded w-2/3 mb-6"></div>
          <div className="h-10 bg-zinc-800 rounded w-1/4"></div>
        </div>
      );
    }
    
    switch (accountStatus) {
      case 'loading':
        return <div className="text-zinc-400">Loading account status...</div>;
      
      case 'not_started':
        return (
          <div className="bg-zinc-900 p-6 rounded-xl mb-8">
            <h2 className="text-xl font-semibold mb-4">Set Up Payments</h2>
            <p className="mb-6">You need to connect a payment account to receive payments for your training rounds.</p>
            <button 
              onClick={() => router.push('/trainer/connect-account')}
              className="bg-[#E0FE10] text-black py-3 px-6 rounded-xl font-semibold"
            >
              Set Up Payments
            </button>
          </div>
        );
      
      case 'incomplete':
        return (
          <div className="bg-zinc-900 p-6 rounded-xl mb-8">
            <h2 className="text-xl font-semibold mb-4">Complete Your Payment Setup</h2>
            <p className="mb-6">You've started setting up your payment account but haven't completed the process.</p>
            <button 
              onClick={() => router.push('/trainer/connect-account')}
              className="bg-[#E0FE10] text-black py-3 px-6 rounded-xl font-semibold"
            >
              Resume Setup
            </button>
          </div>
        );
      
      case 'complete':
        return (
          <div className="bg-zinc-900 p-6 rounded-xl mb-8">
            <h2 className="text-xl font-semibold mb-4">Payment Account Active</h2>
            <p className="mb-6">Your payment account is set up and ready to receive payments.</p>
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
        );
      
      case 'error':
        return (
          <div className="bg-red-900/30 border border-red-500 text-red-200 p-4 rounded-xl mb-8">
            There was an error loading your account status. Please try refreshing the page.
          </div>
        );
    }
  };

  // Function to render earnings statistics
  const renderEarningsStats = () => {
    if (isEarningsLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-lg shadow p-4 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      );
    }
    
    if (!earningsData) return null;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-gray-500 text-sm font-semibold">Total Earned</h3>
          <p className="text-2xl font-bold">${earningsData.totalEarned.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-gray-500 text-sm font-semibold">Available Balance</h3>
          <p className="text-2xl font-bold">${earningsData.availableBalance.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-gray-500 text-sm font-semibold">Rounds Sold</h3>
          <p className="text-2xl font-bold">{earningsData.roundsSold}</p>
        </div>
      </div>
    );
  };
  
  // Function to render recent sales
  const renderRecentSales = () => {
    if (isEarningsLoading) {
      return (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4 animate-pulse"></div>
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Round</th>
                <th className="text-right py-2">Amount</th>
                <th className="text-right py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4].map(i => (
                <tr key={i} className="border-b animate-pulse">
                  <td className="py-3"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
                  <td className="py-3"><div className="h-4 bg-gray-200 rounded w-full"></div></td>
                  <td className="py-3 text-right"><div className="h-4 bg-gray-200 rounded w-1/2 ml-auto"></div></td>
                  <td className="py-3 text-right"><div className="h-4 bg-gray-200 rounded w-1/2 ml-auto"></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    
    if (!earningsData || !earningsData.recentSales || earningsData.recentSales.length === 0) {
      return (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold mb-4">Recent Sales</h3>
          <p className="text-gray-500 text-center py-6">No transactions yet</p>
        </div>
      );
    }
    
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-4">Recent Sales</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Date</th>
              <th className="text-left py-2">Round</th>
              <th className="text-right py-2">Amount</th>
              <th className="text-right py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {earningsData.recentSales.map((sale, index) => (
              <tr key={index} className="border-b">
                <td className="py-3">{sale.date}</td>
                <td className="py-3">{sale.roundTitle}</td>
                <td className="py-3 text-right">${sale.amount.toFixed(2)}</td>
                <td className="py-3 text-right">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    (sale.status === 'succeeded' || sale.status === 'completed') 
                      ? 'bg-green-100 text-green-800' 
                      : sale.status === 'pending' 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-gray-100 text-gray-800'
                  }`}>
                    {sale.status === 'succeeded' ? 'Completed' : 
                     sale.status === 'completed' ? 'Completed' : 
                     sale.status === 'pending' ? 'Pending' : 
                     (sale.status || 'Unknown').charAt(0).toUpperCase() + (sale.status || 'Unknown').slice(1)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-gray-500 mt-4 text-right">
          Last updated: {new Date(earningsData.lastUpdated || new Date().toISOString()).toLocaleString()}
        </p>
      </div>
    );
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
      <div className="max-w-4xl mx-auto px-6">
        <h1 className="text-3xl font-bold mb-6">Trainer Dashboard</h1>
        
        {renderAccountStatus()}
        
        {!isAccountLoading && accountStatus === 'complete' && (
          <>
            {earningsData && earningsData.isNewAccount && !isEarningsLoading && (
              <div className="bg-zinc-900 p-6 rounded-xl mb-8">
                <h2 className="text-xl font-semibold mb-4">No Transactions Yet</h2>
                <p className="mb-6">
                  Your payment account is set up and ready to receive payments, but you haven't
                  received any payments yet. When payments are received, they'll appear here.
                </p>
                <div className="flex items-center justify-center p-8 border border-zinc-800 rounded-lg">
                  <div className="text-center">
                    <div className="text-zinc-400 mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p>When you make your first sale, earnings information will appear here.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {renderEarningsStats()}
            {renderRecentSales()}
          </>
        )}
      </div>
    </div>
  );
};

export default TrainerDashboard;