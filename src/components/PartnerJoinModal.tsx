import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { loadStripe } from '@stripe/stripe-js';
import { useUser } from '../hooks/useUser';
import { getStripePublishableKey } from '../utils/stripeKey';
// import { STRIPE_PRICES, getPriceId } from '../utils/stripeConstants';
import { FaUser, FaCheckCircle } from 'react-icons/fa';
import { coachService } from '../api/firebase/coach';

// Initialize Stripe (for future use)
const _stripePromise = loadStripe(getStripePublishableKey());

interface Props {
  isOpen: boolean;
  closeModal: () => void;
}

const PartnerJoinModal: React.FC<Props> = ({ isOpen, closeModal }) => {
  const currentUser = useUser();
  const router = useRouter();
  const [referralCode, setReferralCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'auth' | 'details' | 'existing'>('auth');
  const [_hasExistingPartnership, setHasExistingPartnership] = useState<boolean>(false);
  const [codeValidation, setCodeValidation] = useState<{
    isAvailable: boolean;
    suggestions?: string[];
    message?: string;
  } | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState<boolean>(false);

  // Check if user already has a partner profile and determine step
  useEffect(() => {
    const checkPartnerStatus = async () => {
      if (!currentUser) {
        setStep('auth');
        return;
      }

      try {
        // Use coach service to check for existing profile
        const coachProfile = await coachService.getCoachProfile(currentUser.id);
        
        if (coachProfile && (coachProfile.subscriptionStatus === 'partner' || coachProfile.userType === 'partner')) {
          setHasExistingPartnership(true);
          setReferralCode(coachProfile.referralCode || '');
          setStep('existing');
          return;
        }
      } catch (error) {
        console.log('Error checking coach profile:', error);
      }
      
      // If no existing partnership found, show signup form
      setStep('details');
    };

    checkPartnerStatus();
  }, [currentUser]);

  // Debounced referral code validation
  useEffect(() => {
    if (!referralCode.trim()) {
      setCodeValidation(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsValidatingCode(true);
      try {
        const validation = await coachService.validateReferralCode(referralCode);
        setCodeValidation(validation);
      } catch (error) {
        console.error('Error validating referral code:', error);
        setCodeValidation({
          isAvailable: false,
          message: 'Error checking code availability'
        });
      } finally {
        setIsValidatingCode(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [referralCode]);

  const handlePartnerSignup = async () => {
    if (!currentUser) {
      setError('Please sign in to continue');
      return;
    }

    // Validate referral code if provided
    if (referralCode.trim() && codeValidation && !codeValidation.isAvailable) {
      setError('Please choose an available referral code or leave blank to auto-generate');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[PartnerSignup] Creating partner profile for:', { 
        userId: currentUser.id, 
        referralCode
      });

      // Use coach service to create partner profile
      const partnerProfile = await coachService.createPartnerProfile(
        currentUser.id,
        referralCode || undefined
      );

      console.log(`[PartnerSignup] Partner profile created successfully:`, partnerProfile);
      
      // Close modal first, then navigate to coach dashboard
      closeModal();
      
      // Use Next.js router for navigation instead of hard redirect
      console.log('[PartnerSignup] Navigating to coach dashboard...');
      await router.push('/coach/dashboard');
      console.log('[PartnerSignup] Navigation completed');

    } catch (err: any) {
      console.error('[PartnerSignup] Error handling partner signup:', err);
      
      // Check if it's an "already exists" error
      if (err.message && err.message.includes('already exists')) {
        setHasExistingPartnership(true);
        setStep('existing');
        return;
      }
      
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthRequired = () => {
    // Close the modal and redirect to partner application page
    // The AuthWrapper will handle showing sign-in modal if not authenticated
    handleClose();
    window.location.href = '/partner/apply';
  };

  const resetModal = () => {
    setReferralCode('');
    setError(null);
    setIsLoading(false);
  };

  const handleClose = () => {
    resetModal();
    closeModal();
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm"></div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full max-w-lg mx-4 z-10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Become a Coach Partner</h2>
          <button
            onClick={handleClose}
            className="text-zinc-400 hover:text-white focus:outline-none transition-colors"
          >
            <svg className="h-6 w-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        {/* User Badge - Show when signed in */}
        {currentUser && (
          <div className="mb-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <div className="flex items-center gap-3">
              {currentUser.profileImage?.profileImageURL ? (
                <img 
                  src={currentUser.profileImage.profileImageURL}
                  alt={currentUser.username}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                  <FaUser className="w-4 h-4 text-zinc-400" />
                </div>
              )}
              <div>
                <div className="text-sm text-white font-medium">
                  Signed in as {currentUser.username}
                </div>
                <div className="text-xs text-zinc-400">
                  {currentUser.email}
                </div>
              </div>
              <div className="ml-auto">
                <FaCheckCircle className="w-5 h-5 text-[#E0FE10]" />
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Authentication Required */}
        {step === 'auth' && (
          <div className="text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-[#E0FE10] to-lime-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-black" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Sign In Required</h3>
              <p className="text-zinc-400 mb-6">
                Please sign in or create an account to start your coach partnership journey.
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={handleAuthRequired}
                className="w-full bg-gradient-to-r from-[#E0FE10] to-lime-400 text-black px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-[#E0FE10]/20 transition-all"
              >
                Sign In / Create Account
              </button>
              <button
                onClick={handleClose}
                className="w-full bg-zinc-800 text-white px-6 py-3 rounded-xl font-semibold hover:bg-zinc-700 transition-colors"
              >
                Maybe Later
              </button>
            </div>
          </div>
        )}

                {/* Partner Details */}
        {step === 'details' && (
          <>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-4">Partner Details</h3>
              
              {/* Partnership Benefits */}
              <div className="bg-zinc-800 rounded-xl p-6 mb-6">
                <h4 className="text-xl font-bold text-white mb-4">✨ Your Partnership Benefits</h4>
                <ul className="space-y-2 text-zinc-300 text-sm">
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-[#E0FE10]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    <strong>No subscription fee</strong> - Free access to all features
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-[#E0FE10]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    40% revenue share from your athletes ($12.99/month each)
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-[#E0FE10]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    20% bonus from coaches you refer to the platform
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-[#E0FE10]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    Full coach dashboard & athlete management tools
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-[#E0FE10]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    Direct athlete communication tools
                  </li>
                </ul>
              </div>

              {/* Optional Fields */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="referralCode" className="block text-white font-medium mb-2">
                    Your Referral Code (Optional)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="referralCode"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      className={`w-full px-4 py-3 bg-zinc-800 border rounded-xl text-white placeholder-zinc-400 focus:outline-none transition-colors ${
                        codeValidation?.isAvailable === false 
                          ? 'border-red-500 focus:border-red-400' 
                          : codeValidation?.isAvailable === true 
                          ? 'border-green-500 focus:border-green-400'
                          : 'border-zinc-700 focus:border-[#E0FE10]'
                      }`}
                      placeholder="e.g., TREMAINE"
                      maxLength={12}
                    />
                    {isValidatingCode && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <svg className="animate-spin h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  {/* Validation Message */}
                  {codeValidation?.message && (
                    <p className={`text-xs mt-2 ${
                      codeValidation.isAvailable ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {codeValidation.message}
                    </p>
                  )}
                  
                  {/* Suggestions */}
                  {codeValidation?.suggestions && codeValidation.suggestions.length > 0 && (
                    <div className="mt-3">
                      <p className="text-zinc-400 text-xs mb-2">Available alternatives:</p>
                      <div className="flex flex-wrap gap-2">
                        {codeValidation.suggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => setReferralCode(suggestion)}
                            className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded-lg transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {!referralCode.trim() && (
                    <p className="text-zinc-400 text-xs mt-1">Leave blank to auto-generate</p>
                  )}
                </div>


              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-8">
              <button
                onClick={handleClose}
                disabled={isLoading}
                className="flex-1 bg-zinc-800 text-white px-6 py-3 rounded-xl font-semibold hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePartnerSignup}
                disabled={isLoading}
                className="flex-1 bg-gradient-to-r from-[#E0FE10] to-lime-400 text-black px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-[#E0FE10]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating Profile...
                  </div>
                ) : (
                  `Join as Partner`
                )}
              </button>
            </div>
          </>
        )}

        {/* Existing Partner Step */}
        {step === 'existing' && (
          <div className="text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-[#E0FE10] to-lime-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <FaCheckCircle className="h-8 w-8 text-black" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Welcome Back, Partner!</h3>
              <p className="text-zinc-400 mb-6">
                You're all set up as a Pulse partner. Access your dashboard to manage athletes, track earnings, and grow your coaching business.
              </p>
            </div>
            
            {/* Referral Code Display */}
            {referralCode && (
              <div className="bg-zinc-800/50 rounded-xl p-4 mb-6">
                <h4 className="text-lg font-semibold text-white mb-3">Your Referral Code</h4>
                <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-700">
                  <div className="flex items-center justify-between">
                    <span className="text-[#E0FE10] font-mono text-lg font-bold">{referralCode}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(referralCode);
                        // You could add a toast notification here
                      }}
                      className="text-zinc-400 hover:text-white transition-colors"
                      title="Copy referral code"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="text-zinc-400 text-sm mt-2">
                  Share this code with athletes to link them to your partnership
                </p>
              </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-[#E0FE10] mb-1">40%</div>
                <div className="text-zinc-400 text-sm">Revenue Share</div>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-[#E0FE10] mb-1">$0</div>
                <div className="text-zinc-400 text-sm">Monthly Fees</div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  closeModal();
                  router.push('/coach/dashboard');
                }}
                className="w-full bg-gradient-to-r from-[#E0FE10] to-lime-400 text-black px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-[#E0FE10]/20 transition-all"
              >
                Access Partner Dashboard
              </button>
              <button
                onClick={handleClose}
                className="w-full bg-zinc-800 text-white px-6 py-3 rounded-xl font-semibold hover:bg-zinc-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PartnerJoinModal;