import React, { useState, useEffect } from 'react';
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
    if (!referralCode || userLoading) return;
    
    const handleInvite = async () => {
      try {
        setLoading(true);
        
        if (typeof referralCode !== 'string') {
          setError('Invalid referral code.');
          return;
        }
        
        // First, verify the coach exists
        const coach = await coachService.findCoachByReferralCode(referralCode);
        if (!coach) {
          setError('Coach not found. Please check the referral code.');
          return;
        }
        
        setCoachInfo(coach);
        
        if (!currentUser) {
          // User not logged in - redirect to sign up with referral code
          router.push(`/sign-up?coach=${referralCode}&redirect=${encodeURIComponent(router.asPath)}`);
          return;
        }
        
        // User is logged in - show connection interface
        setLoading(false);
        
      } catch (err) {
        console.error('Error handling invite:', err);
        setError('Failed to process invite. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    handleInvite();
  }, [referralCode, currentUser, userLoading]);

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

  if (loading || userLoading) {
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

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
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
              <div className="text-zinc-400 text-sm">
                {coachInfo?.userType === 'partner' ? 'Partner Coach' : 'Fitness Coach'}
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
