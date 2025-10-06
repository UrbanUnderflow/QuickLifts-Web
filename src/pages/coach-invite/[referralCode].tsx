import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useUser, useUserLoading } from '../../hooks/useUser';
import { coachService } from '../../api/firebase/coach';
import { privacyService } from '../../api/firebase/privacy/service';
import { FaCheckCircle, FaSpinner, FaExclamationTriangle, FaUser } from 'react-icons/fa';
import PrivacyConsentModal from '../../components/PrivacyConsentModal';

const CoachInvitePage: React.FC = () => {
  const router = useRouter();
  const { referralCode } = router.query;
  const currentUser = useUser();
  const userLoading = useUserLoading();
  
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coachInfo, setCoachInfo] = useState<any>(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  useEffect(() => {
    console.log('[CoachInvite] useEffect triggered', { 
      referralCode, 
      currentUser: !!currentUser, 
      userLoading
    });

    if (!referralCode) {
      console.log('[CoachInvite] No referralCode, returning early');
      return;
    }

    // Don't run if we already have coach info and are not loading
    if (coachInfo && !loading) {
      console.log('[CoachInvite] Already have coach info and not loading, skipping');
      return;
    }

    let isCancelled = false;
    
    const handleInvite = async () => {
      try {
        console.log('[CoachInvite] Starting handleInvite');
        
        if (typeof referralCode !== 'string') {
          console.error('[CoachInvite] Invalid referralCode type:', typeof referralCode);
          setError('Invalid referral code.');
          setLoading(false);
          return;
        }
        
        // Only fetch coach if we don't have it yet
        if (!coachInfo) {
          console.log('[CoachInvite] Fetching coach with referralCode:', referralCode);
          const coach = await coachService.findCoachByReferralCode(referralCode);
          console.log('[CoachInvite] Coach fetch result:', !!coach, coach);
          
          if (!coach) {
            console.error('[CoachInvite] Coach not found for referralCode:', referralCode);
            setError('Coach not found. Please check the referral code.');
            setLoading(false);
            return;
          }
          
          if (isCancelled) {
            console.log('[CoachInvite] Operation was cancelled, returning');
            return;
          }

          console.log('[CoachInvite] Setting coach info');
          setCoachInfo(coach);
        }

        console.log('[CoachInvite] Checking auth state', { 
          currentUser: !!currentUser, 
          userLoading 
        });

        if (currentUser) {
          console.log('[CoachInvite] User is logged in, showing connection interface');
          setLoading(false);
        } else if (userLoading === false) {
          console.log('[CoachInvite] User not logged in, redirecting to sign up');
          const redirectUrl = `/sign-up?coach=${referralCode}&redirect=${encodeURIComponent(router.asPath)}`;
          console.log('[CoachInvite] Redirect URL:', redirectUrl);
          router.push(redirectUrl);
        } else {
          console.log('[CoachInvite] Still waiting for auth to resolve, userLoading:', userLoading);
        }
        
      } catch (err) {
        console.error('[CoachInvite] Error in handleInvite:', err);
        setError('Failed to process invite. Please try again.');
        setLoading(false);
      }
    };

    console.log('[CoachInvite] About to call handleInvite');
    handleInvite();

    return () => {
      console.log('[CoachInvite] Cleanup function called');
      isCancelled = true;
    };
  }, [referralCode, currentUser, userLoading, coachInfo, loading]);

  const connectToCoach = async () => {
    if (!referralCode || !currentUser || typeof referralCode !== 'string') return;
    
    // Show privacy consent modal instead of connecting directly
    setShowPrivacyModal(true);
  };

  const handlePrivacyConsent = async (shareConversations: boolean, shareSentiment: boolean) => {
    if (!referralCode || !currentUser || typeof referralCode !== 'string' || !coachInfo) return;
    
    try {
      setConnecting(true);
      
      // Connect athlete to coach
      const success = await coachService.connectAthleteToCoach(currentUser.id, referralCode);
      
      if (success) {
        // Update privacy settings
        await privacyService.updatePrivacyConsent({
          athleteUserId: currentUser.id,
          coachId: coachInfo.id,
          coachName: `Coach ${coachInfo.referralCode}`,
          shareConversations,
          shareSentiment
        });
        
        setShowPrivacyModal(false);
        setSuccess(true);
        
        // Redirect to dashboard after success
        setTimeout(() => {
          router.push('/dashboard');
        }, 3000);
      } else {
        setError('Failed to connect to coach. You may already be connected or there was an error.');
        setShowPrivacyModal(false);
      }
      
    } catch (err) {
      console.error('Error connecting to coach:', err);
      setError('Failed to connect to coach. Please try again.');
      setShowPrivacyModal(false);
    } finally {
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-[#E0FE10] text-4xl mx-auto mb-4" />
          <div className="text-white text-xl">Processing invite...</div>
          <div className="text-zinc-400 text-sm mt-2">Please wait while we set up your connection</div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <FaCheckCircle className="text-green-400 text-6xl mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-white mb-4">Successfully Connected!</h1>
          <p className="text-zinc-300 mb-6">
            You're now connected to your coach. You'll be redirected to your dashboard shortly.
          </p>
          <div className="bg-zinc-900 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <FaUser className="text-[#E0FE10]" />
              <div className="text-left">
                <div className="text-white font-medium">Coach {referralCode}</div>
                <div className="text-zinc-400 text-sm">Your fitness coach</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <FaExclamationTriangle className="text-red-400 text-6xl mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-white mb-4">Connection Failed</h1>
          <p className="text-zinc-300 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-[#E0FE10] text-black px-6 py-3 rounded-lg hover:bg-lime-400 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full bg-zinc-700 text-white px-6 py-3 rounded-lg hover:bg-zinc-600 transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (connecting) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <FaSpinner className="animate-spin text-[#E0FE10] text-6xl mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-white mb-4">Connecting to Coach</h1>
          <p className="text-zinc-300 mb-6">
            Setting up your connection with Coach {referralCode}...
          </p>
          <div className="bg-zinc-900 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <FaUser className="text-[#E0FE10]" />
              <div className="text-left">
                <div className="text-white font-medium">Coach {referralCode}</div>
                <div className="text-zinc-400 text-sm">Connecting...</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Dynamic OG/Twitter meta for rich previews
  const title = `You're invited to coach on Pulse`;
  const description = `Access athlete CRM and AI Cognitive Behavior Therapy.`;
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://fitwithpulse.ai';
  const ogImage = coachInfo?.profileImage?.profileImageURL || `${base}/images/og/coach-invite-default.jpg`;

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <Head>
        <title>{title}</title>
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:url" content={`${base}/coach-invite/${referralCode || ''}`} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />
      </Head>
      <div className="text-center max-w-md mx-auto p-8">
        <FaUser className="text-[#E0FE10] text-6xl mx-auto mb-6" />
        <h1 className="text-3xl font-bold text-white mb-4">Coach Invitation</h1>
        <p className="text-zinc-300 mb-6">
          You've been invited to connect with Coach {referralCode}
        </p>
        
        <div className="bg-zinc-900 rounded-lg p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <FaUser className="text-[#E0FE10]" />
            <div className="text-left">
              <div className="text-white font-medium">
                {coachInfo ? `Coach ${coachInfo.referralCode}` : `Coach ${referralCode}`}
              </div>
              
            </div>
          </div>
          <p className="text-zinc-300 text-sm">
            This coach will help guide your fitness journey and provide personalized support through the Pulse app.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={connectToCoach}
            className="w-full bg-[#E0FE10] text-black px-6 py-3 rounded-lg hover:bg-lime-400 transition-colors font-medium"
          >
            Connect with Coach
          </button>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-zinc-700 text-white px-6 py-3 rounded-lg hover:bg-zinc-600 transition-colors"
          >
            Maybe Later
          </button>
        </div>

        {/* Privacy Consent Modal */}
        <PrivacyConsentModal
          isOpen={showPrivacyModal}
          onClose={() => setShowPrivacyModal(false)}
          onConsent={handlePrivacyConsent}
          coachName={coachInfo ? `Coach ${coachInfo.referralCode}` : `Coach ${referralCode}`}
          loading={connecting}
        />
      </div>
    </div>
  );
};

export default CoachInvitePage;
