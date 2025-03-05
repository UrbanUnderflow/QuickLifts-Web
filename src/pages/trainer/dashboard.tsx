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
  roundsSold: number;
  recentSales: {
    date: string;
    roundTitle: string;
    amount: number;
  }[];
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
        `https://fitwithpulse.ai/.netlify/functions/complete-onboarding?userId=${currentUser.id}`
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

      if (userData?.creator?.onboardingStatus === 'complete') {
        setAccountStatus('complete');
        // Generate Stripe Dashboard link
        generateDashboardLink();
      } else {
        setAccountStatus('incomplete');
      }
    } catch (err) {
      console.error('Error fetching account status:', err);
      setAccountStatus('error');
    }
  };

  const fetchEarningsData = async () => {
    if (!currentUser?.id) return;
    
    try {
      const response = await fetch(`/api/trainer/get-earnings?userId=${currentUser.id}`);
      const data = await response.json();
      
      if (data.success) {
        setEarnings(data.earnings);
      }
    } catch (err) {
      console.error('Error fetching earnings data:', err);
    }
  };

  const generateDashboardLink = async () => {
    if (!currentUser?.id) return;
    
    try {
      const response = await fetch('/api/trainer/get-dashboard-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      
      const data = await response.json();
      if (data.success && data.url) {
        setDashboardUrl(data.url);
      }
    } catch (err) {
      console.error('Error generating dashboard link:', err);
    }
  };

  const renderAccountStatus = () => {
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
        
        {earnings && accountStatus === 'complete' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-zinc-900 p-6 rounded-xl">
              <h3 className="text-zinc-400 text-sm mb-2">Total Earned</h3>
              <p className="text-3xl font-bold">${earnings.totalEarned.toFixed(2)}</p>
            </div>
            
            <div className="bg-zinc-900 p-6 rounded-xl">
              <h3 className="text-zinc-400 text-sm mb-2">Pending Payout</h3>
              <p className="text-3xl font-bold">${earnings.pendingPayout.toFixed(2)}</p>
            </div>
            
            <div className="bg-zinc-900 p-6 rounded-xl">
              <h3 className="text-zinc-400 text-sm mb-2">Rounds Sold</h3>
              <p className="text-3xl font-bold">{earnings.roundsSold}</p>
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