import React, { useState, useEffect, useRef } from 'react';
import { Check, Tag } from 'lucide-react';
import { useUser } from '../hooks/useUser';
import { signOut } from 'firebase/auth';
import { auth } from '../api/firebase/config';
import { getStripePublishableKey, isLocalhost } from '../utils/stripeKey';
import SignInModal from '../components/SignInModal';
import { loadStripe } from '@stripe/stripe-js';
import Link from 'next/link';

const stripePromise = loadStripe(getStripePublishableKey());

const Subscribe: React.FC = () => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentUser = useUser();
  const [isLocal, setIsLocal] = useState(false);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);

  const openCheckoutUrl = (url: string) => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isInApp = /FBAN|FBAV|Instagram|LinkedInApp|Twitter|Outlook|Mail|Messenger|Snapchat|Pinterest/i.test(ua);
    if (isInApp) {
      window.location.href = url;
      return;
    }
    let pendingWindow: Window | null = null;
    const sameTabFallback = () => {
      try { if (pendingWindow && !pendingWindow.closed) pendingWindow.close(); } catch {}
      window.location.href = url;
    };
    try {
      try { pendingWindow = window.open('', '_blank'); } catch {}
      if (pendingWindow && !pendingWindow.closed) {
        pendingWindow.location.href = url;
        setTimeout(() => { if (!document.hidden) sameTabFallback(); }, 800);
      } else {
        const newWindow = window.open(url, '_blank');
        if (!newWindow || newWindow.closed) sameTabFallback();
      }
    } catch { sameTabFallback(); }
  };

  useEffect(() => {
    setIsLocal(isLocalhost());
  }, []);

  // Stripe Price IDs
  const LIVE_MONTHLY_PRICE_ID = 'price_1PDq26RobSf56MUOucDIKLhd';
  const LIVE_ANNUAL_PRICE_ID = 'price_1PDq3LRobSf56MUOng0UxhCC';
  const TEST_MONTHLY_PRICE_ID = 'price_1RMIUNRobSf56MUOfeB4gIot';
  const TEST_ANNUAL_PRICE_ID = 'price_1RMISFRobSf56MUOpcSoohjP';
  
  const monthlyPriceId = isLocal ? TEST_MONTHLY_PRICE_ID : LIVE_MONTHLY_PRICE_ID;
  const annualPriceId = isLocal ? TEST_ANNUAL_PRICE_ID : LIVE_ANNUAL_PRICE_ID;

  const handleSubscribeClick = async (planType: 'monthly' | 'yearly') => {
    if (!currentUser) {
      setIsSignInModalOpen(true);
      return;
    }
    setIsLoading(true);
    setError(null);
    const priceId = planType === 'monthly' ? monthlyPriceId : annualPriceId;
    try {
        const base = '/checkout-redirect';
        const params = new URLSearchParams({ type: 'subscribe', userId: currentUser.id, priceId });
      openCheckoutUrl(`${base}?${params.toString()}`);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignInSuccess = () => setIsSignInModalOpen(false);

  const features = [
    'Join unlimited Rounds',
    'Access all creator content',
    'Track workouts & progress',
    'AI-powered recommendations',
    'Community challenges',
    'Priority support',
  ];

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Test Mode Banner */}
      {isLocal && (
        <div className="bg-yellow-500 text-black py-2 px-4 text-center text-sm font-medium">
          Test Mode: Using Stripe Test Environment
        </div>
      )}
      
      {/* Sign In Modal */}
      <SignInModal 
        isVisible={isSignInModalOpen}
        onClose={() => setIsSignInModalOpen(false)}
        onSignInSuccess={handleSignInSuccess}
        onSignUpSuccess={handleSignInSuccess}
      />
      
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center">
            <img src="/pulse-logo-green.svg" alt="Pulse" className="h-8 w-auto" />
          </Link>
          
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/#move-section" className="text-zinc-400 hover:text-white text-sm font-medium transition-colors">
              How it works
            </Link>
            <Link href="/creators" className="text-zinc-400 hover:text-white text-sm font-medium transition-colors">
              For Creators
            </Link>
            <Link href="/rounds" className="text-zinc-400 hover:text-white text-sm font-medium transition-colors">
              Rounds
            </Link>
          </nav>

          {currentUser ? (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span>Signed in as {currentUser.username}</span>
            </div>
          ) : (
            <button 
              onClick={() => setIsSignInModalOpen(true)} 
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            <span className="text-zinc-400 italic font-normal">Everything</span> you need to crush your goals.
            </h1>
          <p className="text-zinc-400 text-lg">
            Unlock the full Pulse experience. Cancel anytime.
            </p>
          </div>

        {/* Plan Toggle */}
        <div className="flex justify-center mb-12">
          <div className="bg-zinc-900 p-1 rounded-full inline-flex border border-zinc-800">
            <button
              onClick={() => setSelectedPlan('yearly')}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                selectedPlan === 'yearly'
                  ? 'bg-white text-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Yearly
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                selectedPlan === 'yearly' ? 'bg-[#E0FE10] text-black' : 'bg-[#E0FE10]/20 text-[#E0FE10]'
              }`}>
                Save 33%
              </span>
            </button>
                <button
              onClick={() => setSelectedPlan('monthly')}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                    selectedPlan === 'monthly' 
                  ? 'bg-white text-black'
                  : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>

            {/* Error Display */}
            {error && (
          <div className="mb-8 p-4 bg-red-900/50 border border-red-700 text-red-200 rounded-xl text-center max-w-md mx-auto">
            {error}
              </div>
            )}

        {/* Pricing Card */}
        <div className="max-w-md mx-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
            {/* Card Header */}
            <div className="p-8 pb-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-[#E0FE10] rounded-xl flex items-center justify-center">
                  <Tag className="w-5 h-5 text-black" />
                </div>
                <span className="text-white text-xl font-bold">Pulse Pro</span>
              </div>
              <p className="text-zinc-400 text-sm">
                Full access to everything Pulse has to offer.
              </p>
            </div>

            {/* Pricing */}
            <div className="px-8 pb-6">
              {selectedPlan === 'yearly' ? (
                <>
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold text-white">$3.33</span>
                    <span className="text-zinc-400">/month, billed yearly</span>
                </div>
                  <p className="text-zinc-500 text-sm mt-1">$39.99/year total</p>
                </>
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-white">$4.99</span>
                  <span className="text-zinc-400">/month</span>
                </div>
              )}
            </div>

            {/* CTA Button */}
            <div className="px-8 pb-6">
              <button 
                onClick={() => handleSubscribeClick(selectedPlan)}
                disabled={isLoading}
                className="w-full py-4 bg-[#E0FE10] hover:bg-[#d4f00f] text-black font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {isLoading ? 'Processing...' : 'Get Started'}
              </button>
            </div>

            {/* Divider */}
            <div className="border-t border-zinc-800 mx-8"></div>

            {/* Features */}
            <div className="p-8 pt-6">
              <p className="text-zinc-500 text-sm mb-4">What you unlock:</p>
              <ul className="space-y-3">
                {features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-[#E0FE10]" />
                  </div>
                    <span className="text-zinc-300 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Trust Elements */}
          <div className="flex items-center justify-center gap-6 mt-8 text-sm text-zinc-500">
            <span>🔒 Secure payment</span>
            <span>✓ Cancel anytime</span>
          </div>
        </div>

        {/* Creator Program Banner */}
        <div className="max-w-md mx-auto mt-12">
          <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-2xl p-6 text-center">
            <div className="inline-flex items-center gap-2 bg-purple-500/20 text-purple-300 text-xs font-medium px-3 py-1 rounded-full mb-3">
              <span>✨</span> For Creators
            </div>
            <h3 className="text-white text-lg font-bold mb-2">Free for creators</h3>
            <p className="text-zinc-400 text-sm mb-4">
              Apply for our 100 Trainers Program and get Pulse Pro free while you build your community.
            </p>
            <Link 
              href="/100trainers"
              className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors"
            >
              Apply now
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Unique Business Need Section */}
        <div className="text-center mt-20 pt-16 border-t border-zinc-800">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Have a unique business need?
          </h2>
          <p className="text-zinc-400 max-w-xl mx-auto mb-8">
            Running a studio or gym? Looking to bring Pulse to your team? We offer custom solutions and volume pricing.
          </p>
          <a 
            href="mailto:tre@fitwithpulse.ai"
            className="inline-flex items-center gap-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-full px-6 py-3 transition-colors"
          >
            <img 
              src="/TremaineFounder.jpg" 
              alt="Tremaine" 
              className="w-10 h-10 rounded-full object-cover"
            />
            <span className="text-zinc-300 font-medium">Talk to our team</span>
            <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </a>
        </div>
      </main>
    </div>
  );
};

export default Subscribe;
