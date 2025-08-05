// Debug page for checking and fixing account linking issues
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';

interface ProfileDebugInfo {
  success: boolean;
  userId: string;
  profile: {
    username: string;
    email: string;
    hasCreator: boolean;
    creator: any;
    hasWinner: boolean;
    winner: any;
    hasCreatorStripeAccount: boolean;
    hasWinnerStripeAccount: boolean;
    creatorOnboardingStatus: string;
    winnerOnboardingStatus: string;
    creatorStripeAccountId: string;
    winnerStripeAccountId: string;
  };
}

interface FixResult {
  success: boolean;
  message?: string;
  error?: string;
  accountInfo?: {
    stripeAccountId: string;
    accountType: string;
    onboardingComplete: boolean;
    businessType: string;
    capabilities: any;
  };
}

const AccountLinkingDebug = () => {
  const currentUser = useSelector((state: RootState) => state.user.currentUser);
  const [debugInfo, setDebugInfo] = useState<ProfileDebugInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [fixResult, setFixResult] = useState<FixResult | null>(null);

  // Auto-fetch debug info when user is available
  useEffect(() => {
    if (currentUser?.id) {
      fetchDebugInfo();
    }
  }, [currentUser]);

  const fetchDebugInfo = async () => {
    if (!currentUser?.id) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/.netlify/functions/debug-user-profile?userId=${currentUser.id}`);
      const data = await response.json();
      setDebugInfo(data);
    } catch (error) {
      console.error('Error fetching debug info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fixAccountLinking = async () => {
    if (!currentUser?.id) return;
    
    setIsFixing(true);
    setFixResult(null);
    
    try {
      const response = await fetch('/.netlify/functions/fix-account-linking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: currentUser.id,
          userEmail: currentUser.email 
        })
      });
      
      const data = await response.json();
      setFixResult(data);
      
      // Refresh debug info after fixing
      if (data.success) {
        setTimeout(() => {
          fetchDebugInfo();
        }, 1000);
      }
    } catch (error) {
      console.error('Error fixing account linking:', error);
      setFixResult({
        success: false,
        error: 'Failed to fix account linking'
      });
    } finally {
      setIsFixing(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p>Please sign in to debug your account.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white py-10">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-4 mb-6">
          <h1 className="text-2xl font-bold mb-2">⚠️ DEBUG MODE</h1>
          <p className="text-red-200">
            This page is for debugging account linking issues. Only use in development.
          </p>
        </div>

        <div className="bg-zinc-900 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Account Profile Debug</h2>
            <button
              onClick={fetchDebugInfo}
              disabled={isLoading}
              className="bg-[#E0FE10] text-black py-2 px-4 rounded-lg font-semibold disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {isLoading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#E0FE10] mx-auto mb-4"></div>
              <p>Fetching profile data...</p>
            </div>
          )}

          {debugInfo && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-zinc-800 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Basic Info</h3>
                  <p><strong>User ID:</strong> {debugInfo.userId}</p>
                  <p><strong>Username:</strong> {debugInfo.profile.username}</p>
                  <p><strong>Email:</strong> {debugInfo.profile.email}</p>
                </div>

                <div className="bg-zinc-800 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Account Status</h3>
                  <p><strong>Has Creator:</strong> <span className={debugInfo.profile.hasCreator ? 'text-green-400' : 'text-red-400'}>{debugInfo.profile.hasCreator ? 'Yes' : 'No'}</span></p>
                  <p><strong>Has Creator Stripe:</strong> <span className={debugInfo.profile.hasCreatorStripeAccount ? 'text-green-400' : 'text-red-400'}>{debugInfo.profile.hasCreatorStripeAccount ? 'Yes' : 'No'}</span></p>
                  <p><strong>Creator Status:</strong> {debugInfo.profile.creatorOnboardingStatus}</p>
                </div>
              </div>

              <div className="bg-zinc-800 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Stripe Account IDs</h3>
                <p><strong>Creator Account ID:</strong> {debugInfo.profile.creatorStripeAccountId}</p>
                <p><strong>Winner Account ID:</strong> {debugInfo.profile.winnerStripeAccountId}</p>
              </div>

              {debugInfo.profile.creator && (
                <div className="bg-zinc-800 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Creator Object (Raw)</h3>
                  <pre className="text-xs bg-zinc-900 p-2 rounded overflow-auto">
                    {JSON.stringify(debugInfo.profile.creator, null, 2)}
                  </pre>
                </div>
              )}

              {/* Issue Detection */}
              {!debugInfo.profile.hasCreatorStripeAccount && (
                <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2 text-yellow-200">⚠️ Issue Detected</h3>
                  <p className="text-yellow-300 mb-4">
                    Your profile is missing a Stripe account ID, but you might have a Stripe account. 
                    This could be why your earnings are showing as $0.00.
                  </p>
                  
                  <button
                    onClick={fixAccountLinking}
                    disabled={isFixing}
                    className="bg-yellow-600 text-black py-2 px-4 rounded-lg font-semibold disabled:opacity-50"
                  >
                    {isFixing ? 'Fixing...' : 'Try to Fix Account Linking'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fix Result */}
        {fixResult && (
          <div className={`rounded-xl p-4 mb-6 ${
            fixResult.success 
              ? 'bg-green-900/30 border border-green-500/50' 
              : 'bg-red-900/30 border border-red-500/50'
          }`}>
            <h3 className={`font-semibold mb-2 ${
              fixResult.success ? 'text-green-200' : 'text-red-200'
            }`}>
              {fixResult.success ? '✅ Fix Successful' : '❌ Fix Failed'}
            </h3>
            
            {fixResult.success && fixResult.accountInfo ? (
              <div className="space-y-2 text-green-300">
                <p><strong>Message:</strong> {fixResult.message}</p>
                <p><strong>Stripe Account ID:</strong> {fixResult.accountInfo.stripeAccountId}</p>
                <p><strong>Account Type:</strong> {fixResult.accountInfo.accountType}</p>
                <p><strong>Onboarding Complete:</strong> {fixResult.accountInfo.onboardingComplete ? 'Yes' : 'No'}</p>
                <p className="text-sm text-green-400 mt-4">
                  🎉 Your account linking has been fixed! Refresh your earnings page to see your data.
                </p>
              </div>
            ) : (
              <p className="text-red-300">
                <strong>Error:</strong> {fixResult.error}
              </p>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="bg-zinc-900 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">What This Page Does</h2>
          <div className="space-y-3 text-zinc-300">
            <p><strong>1. Profile Check:</strong> Shows what's actually stored in your Firestore profile</p>
            <p><strong>2. Issue Detection:</strong> Identifies if your Stripe account ID is missing</p>
            <p><strong>3. Automatic Fix:</strong> Searches for your Stripe account by email and links it to your profile</p>
            <p><strong>4. Verification:</strong> Refreshes the data to confirm the fix worked</p>
          </div>
          
          <div className="mt-6 p-4 bg-blue-900/30 border border-blue-500/50 rounded-lg">
            <p className="text-blue-200">
              <strong>Expected Issue:</strong> You have a Stripe account with earnings (as shown in your Stripe dashboard), 
              but the Stripe account ID wasn't properly saved to your Firestore profile during onboarding, 
              causing the earnings API to return $0.00.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountLinkingDebug; 