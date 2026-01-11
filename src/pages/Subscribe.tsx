import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Tag, ChevronDown, Shield, Star } from 'lucide-react';
import { useUser } from '../hooks/useUser';
import { getStripePublishableKey, isLocalhost } from '../utils/stripeKey';
import SignInModal from '../components/SignInModal';
import { loadStripe } from '@stripe/stripe-js';
import Link from 'next/link';

const stripePromise = loadStripe(getStripePublishableKey());

// Floating orb for subtle background
const FloatingOrb: React.FC<{
  color: string;
  size: string;
  position: { top?: string; bottom?: string; left?: string; right?: string };
  delay?: number;
}> = ({ color, size, position, delay = 0 }) => (
  <motion.div
    className={`absolute ${size} rounded-full blur-3xl pointer-events-none opacity-30`}
    style={{ backgroundColor: color, ...position }}
    animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.35, 0.2] }}
    transition={{ duration: 10, repeat: Infinity, delay, ease: "easeInOut" }}
  />
);

// FAQ Item Component
const FAQItem: React.FC<{
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
  delay?: number;
}> = ({ question, answer, isOpen, onToggle, delay = 0 }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay }}
    className="border-b border-zinc-800/50"
  >
    <button
      onClick={onToggle}
      className="w-full py-4 flex items-center justify-between text-left"
    >
      <span className="text-sm font-medium text-zinc-300">{question}</span>
      <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    {isOpen && (
      <motion.div 
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        className="pb-4 text-zinc-500 text-sm leading-relaxed"
      >
        {answer}
      </motion.div>
    )}
  </motion.div>
);

const Subscribe: React.FC = () => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentUser = useUser();
  const [isLocal, setIsLocal] = useState(false);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

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

  const faqs = [
    {
      question: "Can I cancel anytime?",
      answer: "Yes, absolutely. Cancel your subscription anytime from your account settings. No questions asked, no hidden fees."
    },
    {
      question: "What happens after I subscribe?",
      answer: "You get instant access to all Pulse Pro features. Join any Round, access all creator content, and start tracking your progress immediately."
    },
    {
      question: "Is there a free trial?",
      answer: "New users can explore Pulse for free with limited features. Subscribe to Pro to unlock everything including unlimited Rounds and premium content."
    },
    {
      question: "Can I switch between monthly and yearly?",
      answer: "Yes! You can switch plans anytime. If you upgrade to yearly, you'll get prorated credit for your remaining monthly subscription."
    }
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white overflow-hidden">
      {/* Test Mode Banner */}
      {isLocal && (
        <div className="bg-yellow-500 text-black py-2 px-4 text-center text-sm font-medium relative z-50">
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

      {/* Subtle Background Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <FloatingOrb color="#E0FE10" size="w-[600px] h-[600px]" position={{ top: '-20%', left: '-10%' }} delay={0} />
        <FloatingOrb color="#10B981" size="w-[400px] h-[400px]" position={{ bottom: '10%', right: '-5%' }} delay={3} />
      </div>
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-[100] bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <Link href="/" className="flex items-center">
              <img src="/pulse-logo-green.svg" alt="Pulse" className="h-8 sm:h-10 w-auto" />
            </Link>
            
            <nav className="hidden md:flex items-center gap-8">
              <a href="/#move-section" className="text-zinc-400 hover:text-white transition-colors text-sm font-medium">
                How it works
              </a>
              <a href="/moves" className="text-zinc-400 hover:text-white transition-colors text-sm font-medium">
                Moves
              </a>
              <a href="/rounds" className="text-zinc-400 hover:text-white transition-colors text-sm font-medium">
                Rounds
              </a>
              <a href="/creators" className="text-zinc-400 hover:text-white transition-colors text-sm font-medium">
                Creators
              </a>
              <a href="/subscribe" className="text-[#E0FE10] hover:text-[#d4f00f] transition-colors text-sm font-medium font-semibold">
                Pricing
              </a>
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
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-5xl mx-auto px-6 pt-32 pb-20">
        {/* Hero */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4">
            <span className="text-zinc-500 italic font-light">Everything</span> you need to crush your goals.
          </h1>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto">
            Unlock the full Pulse experience. Cancel anytime.
          </p>
        </motion.div>

        {/* Social Proof Bar */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap items-center justify-center gap-6 mb-12 text-sm"
        >
          <div className="flex items-center gap-2">
            <div className="flex text-[#E0FE10]">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-current" />
              ))}
            </div>
            <span className="text-zinc-400">4.9 on App Store</span>
          </div>
          <span className="text-zinc-700 hidden sm:inline">•</span>
          <span className="text-zinc-400">Trusted by 1,000+ athletes</span>
          <span className="text-zinc-700 hidden sm:inline">•</span>
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Shield className="w-4 h-4 text-[#10B981]" />
            <span>30-day money-back guarantee</span>
          </div>
        </motion.div>

        {/* Plan Toggle */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex justify-center mb-10"
        >
          <div className="bg-zinc-900/80 backdrop-blur-xl p-1.5 rounded-full inline-flex border border-white/10">
            <button
              onClick={() => setSelectedPlan('yearly')}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                selectedPlan === 'yearly'
                  ? 'bg-white text-black shadow-lg'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Yearly
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                selectedPlan === 'yearly' ? 'bg-[#E0FE10] text-black' : 'bg-[#E0FE10]/20 text-[#E0FE10]'
              }`}>
                Save 33%
              </span>
            </button>
            <button
              onClick={() => setSelectedPlan('monthly')}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                selectedPlan === 'monthly' 
                  ? 'bg-white text-black shadow-lg'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
          </div>
        </motion.div>

        {/* Error Display */}
        {error && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-8 p-4 bg-red-900/50 border border-red-700 text-red-200 rounded-xl text-center max-w-md mx-auto"
          >
            {error}
          </motion.div>
        )}

        {/* Pricing Card - Glass Treatment */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="max-w-md mx-auto"
        >
          <div className="relative group">
            {/* Glow effect */}
            <div className="absolute -inset-1 rounded-3xl blur-xl opacity-0 group-hover:opacity-40 transition-all duration-700 bg-gradient-to-br from-[#E0FE10]/30 to-[#10B981]/20" />
            
            {/* Card */}
            <div className="relative bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden">
              {/* Top accent line */}
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#E0FE10]/60 to-transparent" />
              
              {/* Card Header */}
              <div className="p-8 pb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-[#E0FE10] rounded-xl flex items-center justify-center shadow-lg shadow-[#E0FE10]/20">
                    <Tag className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <span className="text-white text-xl font-bold block">Pulse Pro</span>
                    <span className="text-zinc-500 text-xs">Full access to everything</span>
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div className="px-8 pb-6">
                {selectedPlan === 'yearly' ? (
                  <motion.div
                    key="yearly"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-bold text-white">$3.33</span>
                      <span className="text-zinc-400">/month</span>
                    </div>
                    <p className="text-zinc-500 text-sm mt-1">$39.99 billed annually</p>
                    <div className="mt-3 inline-flex items-center gap-1.5 bg-[#10B981]/20 text-[#10B981] text-xs font-medium px-2.5 py-1 rounded-full">
                      <Check className="w-3 h-3" />
                      You save $20/year
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="monthly"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-bold text-white">$4.99</span>
                      <span className="text-zinc-400">/month</span>
                    </div>
                    <p className="text-zinc-500 text-sm mt-1">Billed monthly</p>
                  </motion.div>
                )}
              </div>

              {/* CTA Button */}
              <div className="px-8 pb-6">
                <motion.button 
                  onClick={() => handleSubscribeClick(selectedPlan)}
                  disabled={isLoading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-4 bg-[#E0FE10] hover:bg-[#d4f00f] text-black font-bold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-[#E0FE10]/20"
                >
                  {isLoading ? 'Processing...' : 'Get Started'}
                </motion.button>
                <p className="text-center text-zinc-500 text-xs mt-3">
                  30-day money-back guarantee • Cancel anytime
                </p>
              </div>

              {/* Divider */}
              <div className="border-t border-white/5 mx-8"></div>

              {/* Features */}
              <div className="p-8 pt-6">
                <p className="text-zinc-500 text-sm mb-4">What you unlock:</p>
                <ul className="space-y-3">
                  {features.map((feature, idx) => (
                    <motion.li 
                      key={idx} 
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center gap-3"
                    >
                      <div className="w-5 h-5 rounded-full bg-[#E0FE10]/15 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-[#E0FE10]" />
                      </div>
                      <span className="text-zinc-300 text-sm">{feature}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Trust Elements */}
          <div className="flex items-center justify-center gap-6 mt-8 text-sm text-zinc-500">
            <div className="flex items-center gap-1.5">
              <span>🔒</span>
              <span>Secure payment</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>✓</span>
              <span>Cancel anytime</span>
            </div>
          </div>
        </motion.div>

        {/* FAQ Section */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="max-w-md mx-auto mt-16"
        >
          <h3 className="text-lg font-bold text-white mb-6 text-center">Common questions</h3>
          <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-2xl px-6">
            {faqs.map((faq, idx) => (
              <FAQItem
                key={idx}
                question={faq.question}
                answer={faq.answer}
                isOpen={openFAQ === idx}
                onToggle={() => setOpenFAQ(openFAQ === idx ? null : idx)}
                delay={idx * 0.05}
              />
            ))}
          </div>
        </motion.div>

        {/* Creator Program Banner */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-md mx-auto mt-16"
        >
          <div className="relative group">
            <div className="absolute -inset-1 rounded-2xl blur-xl opacity-0 group-hover:opacity-30 transition-all duration-700 bg-gradient-to-r from-purple-500/30 to-blue-500/30" />
            <div className="relative bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-2xl p-6 text-center backdrop-blur-xl">
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
        </motion.div>

        {/* Business Section */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-20 pt-16 border-t border-zinc-800/50"
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Have a unique business need?
          </h2>
          <p className="text-zinc-400 max-w-xl mx-auto mb-8 text-sm">
            Running a studio or gym? Looking to bring Pulse to your team? We offer custom solutions and volume pricing.
          </p>
          <motion.a 
            href="mailto:tre@fitwithpulse.ai"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-3 bg-zinc-900/80 hover:bg-zinc-800/80 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 transition-colors"
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
          </motion.a>
        </motion.div>
      </main>
    </div>
  );
};

export default Subscribe;
