import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { useUser } from '../hooks/useUser';
import { getStripePublishableKey } from '../utils/stripeKey';
import { getPriceId } from '../utils/stripeConstants';

// Initialize Stripe
const stripePromise = loadStripe(getStripePublishableKey());

interface Props {
  isOpen: boolean;
  closeModal: () => void;
}

const CoachProductModal: React.FC<Props> = ({ isOpen, closeModal }) => {
  const currentUser = useUser();
  const [planType, setPlanType] = useState<'monthly' | 'annual'>('monthly');
  const [partnerCode, setPartnerCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'auth' | 'plan'>('auth');

  // Determine current step based on user authentication
  React.useEffect(() => {
    if (currentUser) {
      setStep('plan');
    } else {
      setStep('auth');
    }
  }, [currentUser]);

  const handleCoachSubscription = async () => {
    if (!currentUser) {
      setError('Please sign in to continue');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const priceId = getPriceId('coach', planType);
      
      console.log('[CoachSubscription] Creating coach checkout session for:', { 
        userId: currentUser.id, 
        priceId,
        partnerCode
      });

      const response = await fetch('/.netlify/functions/create-coach-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          priceId,
          userId: currentUser.id,
          partnerCode: partnerCode || undefined,
          userType: 'coach' // Standard coach, not partner
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create coach checkout session.');
      }

      const sessionId = data.sessionId;
      if (!sessionId) {
        throw new Error('Could not retrieve session ID.');
      }

      // Redirect to Stripe Checkout
      console.log(`[CoachSubscription] Redirecting to Stripe Checkout with session ID: ${sessionId}`);
      const stripe = await stripePromise;
      if (stripe) {
        const { error } = await stripe.redirectToCheckout({ sessionId });
        if (error) {
          console.error('[CoachSubscription] Stripe redirect error:', error);
          setError(error.message || 'Failed to redirect to payment.');
        }
      } else {
        throw new Error('Stripe.js failed to load.');
      }

    } catch (err: any) {
      console.error('[CoachSubscription] Error handling coach subscription:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthRequired = () => {
    setError('Please sign in or create an account to continue with your coach subscription.');
  };

  const resetModal = () => {
    setError(null);
    setIsLoading(false);
    setPlanType('monthly');
    setPartnerCode('');
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
          <h2 className="text-2xl font-bold text-white">Start Your Coach Subscription</h2>
          <button
            onClick={handleClose}
            className="text-zinc-400 hover:text-white focus:outline-none transition-colors"
          >
            <svg className="h-6 w-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

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
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-[#E0FE10] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-black" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Sign In Required</h3>
              <p className="text-zinc-400 mb-6">
                Please sign in or create an account to start your coach subscription.
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={handleAuthRequired}
                className="w-full bg-gradient-to-r from-purple-500 to-[#E0FE10] text-black px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/20 transition-all"
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

        {/* Plan Selection */}
        {step === 'plan' && (
          <>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-4">Choose Your Plan</h3>
              
              {/* Plan Toggle */}
              <div className="flex bg-zinc-800 rounded-xl p-1 mb-6">
                <button
                  onClick={() => setPlanType('monthly')}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                    planType === 'monthly' 
                      ? 'bg-gradient-to-r from-purple-500 to-[#E0FE10] text-black' 
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setPlanType('annual')}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                    planType === 'annual' 
                      ? 'bg-gradient-to-r from-purple-500 to-[#E0FE10] text-black' 
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Annual
                  <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                    Save 16%
                  </span>
                </button>
              </div>

              {/* Plan Details */}
              <div className="bg-zinc-800 rounded-xl p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-xl font-bold text-white">Coach Subscription</h4>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-purple-400">
                      {planType === 'monthly' ? '$24.99' : '$249'}
                    </div>
                    <div className="text-zinc-400 text-sm">
                      per {planType === 'monthly' ? 'month' : 'year'}
                    </div>
                  </div>
                </div>
                <ul className="space-y-2 text-zinc-300 text-sm">
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-[#E0FE10]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    Unlimited athletes get free access
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-[#E0FE10]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    Coach dashboard & team insights
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-[#E0FE10]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    Direct athlete communication
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-[#E0FE10]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    Team management tools
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-[#E0FE10]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    Full Pulse + PulseCheck access for athletes
                  </li>
                </ul>
              </div>

              {/* Partner Code Field */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="partnerCode" className="block text-white font-medium mb-2">
                    Partner Code (Optional)
                  </label>
                  <input
                    type="text"
                    id="partnerCode"
                    value={partnerCode}
                    onChange={(e) => setPartnerCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:border-purple-500 transition-colors"
                    placeholder="e.g., COACH123"
                    maxLength={8}
                  />
                  <p className="text-zinc-400 text-xs mt-1">Enter a partner coach's code to share revenue with them</p>
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
                onClick={handleCoachSubscription}
                disabled={isLoading}
                className="flex-1 bg-gradient-to-r from-purple-500 to-[#E0FE10] text-black px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </div>
                ) : (
                  `Subscribe ${planType === 'monthly' ? '$24.99/mo' : '$249/yr'}`
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CoachProductModal;
