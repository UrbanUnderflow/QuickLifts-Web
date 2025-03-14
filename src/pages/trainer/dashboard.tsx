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
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
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
    }
  };

  const fetchEarningsData = async () => {
    if (!currentUser?.id) return;
    
    try {
      console.log('Fetching earnings data for user:', currentUser.id);
      const response = await fetch(`/.netlify/functions/get-earnings?userId=${currentUser.id}`);
      const data = await response.json();
      console.log('Earnings data received:', data);
      
      if (data.success) {
        setEarnings(data.earnings);
      } else {
        console.error('Error in earnings data response:', data.error);
        // Initialize with empty data on error
        setEarnings({
          totalEarned: 0,
          pendingPayout: 0,
          availableBalance: 0,
          roundsSold: 0,
          recentSales: [],
          lastUpdated: new Date().toISOString(),
          isNewAccount: true
        });
      }
    } catch (err) {
      console.error('Error fetching earnings data:', err);
      // Initialize with empty data on error
      setEarnings({
        totalEarned: 0,
        pendingPayout: 0,
        availableBalance: 0,
        roundsSold: 0,
        recentSales: [],
        lastUpdated: new Date().toISOString(),
        isNewAccount: true
      });
    }
  };

  const generateDashboardLink = async () => {
    if (!currentUser?.id) return;
    
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
    }
  };

  const renderAccountStatus = () => {
    console.log('Rendering account status:', accountStatus);
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
            {dashboardUrl && (
              <a 
                href={dashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#E0FE10] text-black py-3 px-6 rounded-xl font-semibold inline-block"
              >
                View Stripe Dashboard
              </a>
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
        
        {earnings && accountStatus === 'complete' && earnings.isNewAccount && (
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
        
        {earnings && accountStatus === 'complete' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-zinc-900 p-4 rounded-xl">
              <h3 className="text-zinc-400 text-sm mb-1">Total Earned</h3>
              <p className="text-2xl font-bold">${earnings.totalEarned.toFixed(2)}</p>
            </div>
            
            <div className="bg-zinc-900 p-4 rounded-xl">
              <h3 className="text-zinc-400 text-sm mb-1">Available Balance</h3>
              <p className="text-2xl font-bold">${earnings.availableBalance.toFixed(2)}</p>
            </div>
            
            <div className="bg-zinc-900 p-4 rounded-xl">
              <h3 className="text-zinc-400 text-sm mb-1">Pending Payout</h3>
              <p className="text-2xl font-bold">${earnings.pendingPayout.toFixed(2)}</p>
            </div>
            
            <div className="bg-zinc-900 p-4 rounded-xl">
              <h3 className="text-zinc-400 text-sm mb-1">Rounds Sold</h3>
              <p className="text-2xl font-bold">{earnings.roundsSold}</p>
            </div>
          </div>
        )}
        
        {earnings && earnings.recentSales && earnings.recentSales.length > 0 && (
          <div className="bg-zinc-900 p-6 rounded-xl">
            <h2 className="text-xl font-semibold mb-4">Recent Sales</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="py-3 text-left text-zinc-400">Date</th>
                    <th className="py-3 text-left text-zinc-400">Round</th>
                    <th className="py-3 text-right text-zinc-400">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {earnings.recentSales.map((sale, index) => (
                    <tr key={index} className="border-b border-zinc-800">
                      <td className="py-3">{new Date(sale.date).toLocaleDateString()}</td>
                      <td className="py-3">{sale.roundTitle}</td>
                      <td className="py-3 text-right">${sale.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainerDashboard;