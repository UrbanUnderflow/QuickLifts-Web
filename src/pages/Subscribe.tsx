import React, { useState, useEffect, useRef } from 'react';
import { useScrollFade } from '../hooks/useScrollFade';
import { CheckCircle, Star, Shield, Clock, Users, ChevronDown, LogOut } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js'; // Import Stripe.js
import { useUser } from '../hooks/useUser'; // Import useUser to get the userId
import { signOut } from 'firebase/auth'; // Import signOut
import { auth } from '../api/firebase/config'; // Import auth instance
import { getStripePublishableKey, isLocalhost } from '../utils/stripeKey'; // Import our utility functions
import SignInModal from '../components/SignInModal'; // Import SignInModal

// Load Stripe outside of component render to avoid recreating on every render
// Use our utility function to automatically get the correct key based on environment
const stripePromise = loadStripe(getStripePublishableKey());

const Subscribe: React.FC = () => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [isLoading, setIsLoading] = useState(false); // Loading state for API call
  const [error, setError] = useState<string | null>(null); // Error state
  const currentUser = useUser(); // Get current user
  const [isMenuOpen, setIsMenuOpen] = useState(false); // State for dropdown menu
  const menuRef = useRef<HTMLDivElement>(null); // Ref for dropdown menu
  const [isLocal, setIsLocal] = useState(false); // Track if running on localhost
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false); // Control SignInModal visibility

  // Helper: open Stripe Checkout with in-app browser handling and fallbacks
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
        setTimeout(() => {
          if (!document.hidden) {
            sameTabFallback();
          }
        }, 800);
      } else {
        const newWindow = window.open(url, '_blank');
        if (!newWindow || newWindow.closed) {
          sameTabFallback();
        }
      }
    } catch {
      sameTabFallback();
    }
  };

  useEffect(() => {
    const localCheck = isLocalhost();
    setIsLocal(localCheck);
    
    // Validate environment variables in production
    if (!localCheck) {
      // Explicitly type required env vars map
      const requiredEnvVars: Record<'stripePublishableKey' | 'siteUrl', string | undefined> = {
        stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://fitwithpulse.ai'
      };
      
      // Build a typed summary object for logging
      const envSummary: Record<'stripePublishableKey' | 'siteUrl', 'SET' | 'MISSING'> = (Object.keys(requiredEnvVars) as Array<keyof typeof requiredEnvVars>)
        .reduce((acc, key) => {
          acc[key] = requiredEnvVars[key] ? 'SET' as const : 'MISSING' as const;
          return acc;
        }, {} as Record<'stripePublishableKey' | 'siteUrl', 'SET' | 'MISSING'>);
      
      console.log('[Subscribe] Production environment check:', {
        hostname: typeof window !== 'undefined' ? window.location.hostname : 'server',
        envVars: envSummary,
        isLocal: localCheck
      });
      
      // Check for missing environment variables
      const missingVars = (Object.entries(requiredEnvVars) as Array<[keyof typeof requiredEnvVars, string | undefined]>)
        .filter(([, value]) => !value)
        .map(([key]) => key);
        
      if (missingVars.length > 0) {
        console.error('[Subscribe] Missing required environment variables:', missingVars);
        setError(`Configuration error: Missing environment variables: ${missingVars.join(', ')}`);
      }
    }
  }, []);

  // --- Live Stripe Price IDs ---
  const LIVE_MONTHLY_PRICE_ID = 'price_1PDq26RobSf56MUOucDIKLhd';
  const LIVE_ANNUAL_PRICE_ID = 'price_1PDq3LRobSf56MUOng0UxhCC';
  
  // --- Test Stripe Price IDs ---
  // Using test price IDs that work in the Stripe test environment
  const TEST_MONTHLY_PRICE_ID = 'price_1RMIUNRobSf56MUOfeB4gIot'; // Standard test price ID for monthly
  const TEST_ANNUAL_PRICE_ID = 'price_1RMISFRobSf56MUOpcSoohjP'; // Standard test price ID for annual
  
  // Dynamically select the right price ID based on environment
  const monthlyPriceId = isLocal ? TEST_MONTHLY_PRICE_ID : LIVE_MONTHLY_PRICE_ID;
  const annualPriceId = isLocal ? TEST_ANNUAL_PRICE_ID : LIVE_ANNUAL_PRICE_ID;

  // Precompute hrefs for pure anchor navigation (Safari reliability)
  const subscribeHref = (planType: 'monthly' | 'yearly') => {
    if (!currentUser) return '#';
    const priceId = planType === 'monthly' ? monthlyPriceId : annualPriceId;
    const q = new URLSearchParams({ type: 'subscribe', userId: currentUser.id, priceId });
    return `/checkout-redirect?${q.toString()}`;
  };

  const handleSubscribeClick = async (planType: 'monthly' | 'yearly') => {
    // Check if user is logged in first
    if (!currentUser) {
      console.log('[Subscribe] User not logged in, showing sign-in modal');
      setIsSignInModalOpen(true); // Show sign-in modal
      return;
    }

    setIsLoading(true);
    setError(null);

    const priceId = planType === 'monthly' ? monthlyPriceId : annualPriceId;

    try {
      // Open a placeholder tab synchronously to avoid mobile popup blockers
      let _pendingWindow: Window | null = null;
      try {
        _pendingWindow = window.open('', '_blank');
      } catch {}
      // 1. Call your Netlify Function to create a Checkout Session
      console.log('[Subscribe] Creating checkout session for:', { 
        userId: currentUser.id, 
        priceId,
        isTestMode: isLocal
      });
      const response = await fetch('/.netlify/functions/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId: priceId, userId: currentUser.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create checkout session.');
      }

      const sessionId = data.sessionId;
      const checkoutUrl = data.url as string | undefined;
      const useServerRedirect = true;
      if (useServerRedirect) {
        const base = '/checkout-redirect';
        const params = new URLSearchParams({ type: 'subscribe', userId: currentUser.id, priceId });
        const endpoint = `${base}?${params.toString()}`;
        openCheckoutUrl(endpoint);
        return;
      }

      if (!sessionId && !checkoutUrl) {
        throw new Error('Could not retrieve checkout session.');
      }

      if (checkoutUrl) {
        openCheckoutUrl(checkoutUrl);
      } else {
        const stripe = await stripePromise;
        if (stripe) {
          const { error } = await stripe.redirectToCheckout({ sessionId });
          if (error) setError(error.message || 'Failed to redirect to payment.');
        } else {
          throw new Error('Stripe.js failed to load.');
        }
      }

    } catch (err: any) {
      console.error('[Subscribe] Error handling subscription click:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    try {
      await signOut(auth); // Use direct Firebase signOut
      
      // Clear the localStorage flag so user sees marketing content instead of dashboard
      localStorage.removeItem('pulse_has_seen_marketing');
      
      // Redirect or update UI after sign out
      window.location.reload(); // Simple reload for now
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Handle sign in success
  const handleSignInSuccess = (_user: any) => {
    console.log('[Subscribe] Sign in successful, closing modal');
    setIsSignInModalOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuRef]);

  // Add subtle parallax effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const elements = document.querySelectorAll('.glass-card');
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      
      elements.forEach((el) => {
        const element = el as HTMLElement;
        element.style.transform = `translate(${x * 10}px, ${y * 10}px)`;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);
  
  const faqData = [
    {
      question: "What makes Pulse different from other fitness apps?",
      answer: "Pulse offers a unique experience by combining a vast library of workouts and exercises created by our diverse community of content creators with personalized AI-driven recommendations. You'll discover fresh, engaging content tailored to your fitness goals and preferences."
    },
    {
      question: "Can I track my workouts and progress on Pulse?",
      answer: "Absolutely! Pulse provides a comprehensive workout tracking system that allows you to log your sets, reps, and weights. You can also upload progress photos and videos to visually track your fitness journey over time."
    },
    {
      question: "How does Pulse help me discover new workouts and exercises?",
      answer: "Pulse uses advanced AI algorithms to analyze your workout history, preferences, and goals to recommend personalized workouts and exercises. You'll also have access to a vast library of content created by our expert content creators, ensuring you always have fresh and exciting workouts to try."
    },
    {
      question: "Can I follow specific content creators or trainers on Pulse?",
      answer: "Yes! Pulse allows you to follow your favorite content creators and trainers, making it easy to access their latest workouts and content. You can also interact with them and the wider Pulse community through comments, likes, and shares."
    },
    {
      question: "Does Pulse provide guidance on proper form and technique?",
      answer: "Yes, Pulse content creators prioritize demonstrating proper form and technique in their workout videos. Additionally, our AI-powered form tracking feature provides real-time feedback on your form during workouts, helping you stay safe and get the most out of your exercises."
    },
    {
      question: "Can I create custom workouts or save my favorite exercises on Pulse?",
      answer: "Yes, Pulse allows you to create custom workouts by combining your favorite exercises or following pre-designed workouts from our content creators. You can also save individual exercises to your library for quick access during your workouts."
    },
    {
      question: "Is there a community aspect to Pulse where I can connect with other fitness enthusiasts?",
      answer: "Yes, Pulse has a thriving community of fitness enthusiasts. You can connect with other users through comments, likes, and shares on workout posts. We also have community challenges and events to help you stay motivated and engaged with like-minded individuals."
    },
    {
      question: "What does a subscription to Pulse include?",
      answer: "A Pulse subscription gives you unlimited access to our vast library of workouts and exercises, personalized AI recommendations, workout tracking tools, progress tracking features, and community support. You'll also receive regular updates with new content and features to enhance your fitness journey."
    }
  ];

  // Testimonials data
  const testimonials = [
    {
      name: "Antonio",
      image: "/testimonial-1.png",
      text: "I love that with the app you have the ability to not only can concentrate on specific body parts but you also can share your workout videos with your community of folks. You can learn so much about what you're doing but also how you're doing it through the app. I would definitely recommend this for beginners but also advanced trainers that are looking for a way to bring their fitness community together and share each others experience working out.",
      rating: 5
    },
    {
      name: "Bobby",
      image: "/testimonial-2.png",
      text: "I found PULSE to be really intuitive and helpful for my workouts. Having videos that I can refer myself and clients to is awesome. It legit shows you HOW to do any exercise. 😎 The tracking is clutch. I'm not carrying my notebook around scribbling my weight and manually tracking my progress. It's all kept right here for me. I haven't used the AI feature yet, but I'm excited to incorporate this into my workouts. 💪🏾",
      rating: 5
    },
    {
      name: "Ellie",
      image: "/testimonial-3.png",
      text: "Great way to track my fitness goals and share my progress with others for motivation! App is so easy to use and navigate!",
      rating: 5
    }
  ];

  // CSS classes for glassmorphism
  const glassBg = "relative backdrop-blur-lg bg-black/30 border border-white/10 shadow-xl";
  const glassCard = "glass-card transition-all duration-300 relative backdrop-blur-lg bg-white/5 border border-white/10 shadow-xl hover:bg-white/10 hover:border-white/20 hover:shadow-2xl";
  const glassPrimary = "backdrop-blur-lg bg-[#E0FE10]/90 text-black border border-[#E0FE10]/50 shadow-lg shadow-[#E0FE10]/20 hover:bg-[#E0FE10] transition-all";
  const glassSecondary = "backdrop-blur-lg bg-white/5 text-white border border-white/10 shadow-lg hover:bg-white/10 transition-all";
  
  // Gradient text classes
  const gradientText = "text-transparent bg-clip-text bg-gradient-to-r from-[#E0FE10] to-[#B8FE00]";

  return (
    <div className="min-h-screen bg-black">
      {/* Background gradient effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-1/2 h-1/2 bg-[#E0FE10]/10 blur-[150px] rounded-full transform -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-1/4 w-1/2 h-1/2 bg-[#E0FE10]/10 blur-[150px] rounded-full transform translate-y-1/2"></div>
      </div>
      
      {/* Test Mode Indicator */}
      {isLocal && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500/90 text-black py-1 px-4 text-center text-sm z-50">
          <strong>Test Mode:</strong> Using Stripe Test Environment - Payments won't be charged
        </div>
      )}
      
      {/* Sign In Modal */}
      <SignInModal 
        isVisible={isSignInModalOpen}
        onClose={() => setIsSignInModalOpen(false)}
        onSignInSuccess={handleSignInSuccess}
        onSignUpSuccess={handleSignInSuccess}
      />
      
      <div className={`flex min-h-screen flex-col items-center ${isLocal ? 'pt-8' : ''}`}>
        
        {/* Navigation */}
        <nav className="w-full py-6 px-4 flex justify-between items-center max-w-7xl mx-auto">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2">
            <img src="/pulse-logo.svg" alt="Pulse Logo" className="h-8 w-auto" />
          </a>
          
          {/* User Menu - Only show if logged in */}
          {currentUser ? (
            <div className="relative" ref={menuRef}>
              <div 
                className="inline-flex items-center gap-1.5 bg-zinc-800/80 backdrop-blur-sm rounded-full px-2 py-1 cursor-pointer hover:bg-zinc-700/80 transition-colors"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                role="button"
                aria-label={`User menu for ${currentUser.username}`}
              >
                {currentUser.profileImage?.profileImageURL ? (
                  <img 
                    src={currentUser.profileImage.profileImageURL}
                    alt={currentUser.username}
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center">
                    <Users className="w-3.5 h-3.5 text-zinc-400" />
                  </div>
                )}
                <span className="text-xs text-white/90">Signed in as {currentUser.username}</span>
                <ChevronDown 
                  className={`w-3.5 h-3.5 text-white/70 transition-transform duration-200 ${
                    isMenuOpen ? 'rotate-180' : ''
                  }`} 
                />
              </div>
              
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-zinc-800 rounded-lg shadow-xl z-10 overflow-hidden">
                  <button 
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white transition-all"
                  >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button 
              onClick={() => setIsSignInModalOpen(true)} 
              className="text-white bg-white/10 rounded-full py-2 px-4 hover:bg-white/20 transition-all"
            >
              Sign In
            </button>
          )}
        </nav>

        {/* Page Content */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-12">
          {/* Hero Section - Glassmorphic style */}
          <section className="max-w-[1052.76px] mx-auto text-center pt-24 pb-16 px-4" ref={useScrollFade()}>
            <h1 className={`${gradientText} text-6xl sm:text-7xl font-bold mb-6 tracking-tight`}>
              Transform Your Fitness Journey
            </h1>
            <p className="text-white text-xl max-w-2xl mx-auto mb-6 leading-relaxed">
              Join thousands of members who have elevated their workout experience with Pulse
            </p>
            <div className="flex items-center justify-center space-x-2 text-zinc-400">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} fill="#E0FE10" color="#E0FE10" size={20} />
                ))}
              </div>
              <span>4.9/5 from 2,000+ reviews</span>
            </div>
          </section>

          {/* Limited Time Offer Banner */}
          <div className={`${glassPrimary} py-3 text-center mb-16 mx-4 sm:mx-auto max-w-3xl rounded-full`}>
            <p className="text-black font-bold text-lg flex items-center justify-center">
              <Clock size={18} className="mr-2" />
              Limited Time Offer: First month FREE + 33% saved annually
            </p>
          </div>

          {/* Subscription Cards - Glassmorphic and with clear comparison */}
          <section className="max-w-[1052.76px] mx-auto px-4 mb-24" ref={useScrollFade()}>
            <div className="mb-12 text-center">
              <h2 className="text-white text-3xl sm:text-4xl font-bold mb-4">
                Choose Your <span className={gradientText}>Membership Plan</span>
              </h2>
              <p className="text-zinc-400">
                All plans include full access to all features. Cancel anytime.
              </p>
            </div>

            {/* Toggle between plans */}
            <div className="flex justify-center mb-10">
              <div className={`${glassBg} p-1 rounded-full inline-flex`}>
                <button
                  className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                    selectedPlan === 'monthly' 
                      ? 'bg-white/10 text-white' 
                      : 'bg-transparent text-zinc-400 hover:text-white'
                  }`}
                  onClick={() => setSelectedPlan('monthly')}
                >
                  Monthly
                </button>
                <button
                  className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                    selectedPlan === 'yearly' 
                      ? 'bg-white/10 text-white' 
                      : 'bg-transparent text-zinc-400 hover:text-white'
                  }`}
                  onClick={() => setSelectedPlan('yearly')}
                >
                  Yearly <span className="text-[#E0FE10]">Save 33%</span>
                </button>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="my-4 p-4 bg-red-900 border border-red-700 text-red-200 rounded-lg text-center max-w-md mx-auto">
                Error: {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-center items-stretch gap-8 max-w-4xl mx-auto">
              {/* Monthly Plan */}
              <div 
                className={`${glassCard} relative flex-1 rounded-2xl overflow-hidden transition-all duration-500 ${
                  selectedPlan === 'monthly' 
                    ? 'border-[#E0FE10]/30 scale-100 opacity-100 z-10' 
                    : 'border-transparent scale-95 opacity-70'
                }`}
                style={{display: selectedPlan === 'monthly' ? 'block' : selectedPlan === 'yearly' ? 'none' : 'block'}}
              >
                <div className="p-8">
                  <div className="text-white text-2xl font-bold mb-2">Monthly Plan</div>
                  <div className="flex items-end mb-6">
                    <span className="text-5xl font-bold text-white">$4.99</span>
                    <span className="text-zinc-400 ml-2">/month</span>
                  </div>
                  
                  <ul className="space-y-4 mb-8">
                    <li className="flex items-start">
                      <CheckCircle className="text-[#E0FE10] mr-3 mt-1 flex-shrink-0" size={20} />
                      <span className="text-zinc-300">Full access to all Pulse features</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="text-[#E0FE10] mr-3 mt-1 flex-shrink-0" size={20} />
                      <span className="text-zinc-300">Access to new exercises added daily</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="text-[#E0FE10] mr-3 mt-1 flex-shrink-0" size={20} />
                      <span className="text-zinc-300">Cancel anytime</span>
                    </li>
                  </ul>
                  
                  <a
                    href={currentUser ? subscribeHref('monthly') : '#'}
                    onClick={(e) => { if (!currentUser) { e.preventDefault(); setIsSignInModalOpen(true); return; } handleSubscribeClick('monthly'); }}
                    className={`w-full py-4 rounded-full text-lg font-semibold transition-all ${glassSecondary} ${isLoading ? 'opacity-50 pointer-events-none' : ''} inline-flex items-center justify-center`}
                    aria-disabled={isLoading}
                  >
                    {isLoading ? 'Processing...' : 'Start Monthly Plan'}
                  </a>
                </div>
              </div>
              
              {/* Yearly Plan - Featured plan */}
              <div 
                className={`${glassCard} relative flex-1 rounded-2xl overflow-hidden transition-all duration-500 ${
                  selectedPlan === 'yearly' 
                    ? 'border-[#E0FE10]/30 scale-100 opacity-100 z-10' 
                    : 'border-transparent scale-95 opacity-70'
                }`}
                style={{display: selectedPlan === 'yearly' ? 'block' : selectedPlan === 'monthly' ? 'none' : 'block'}}
              >
                <div className="absolute top-0 w-full bg-[#E0FE10]/90 backdrop-blur-sm text-black py-1 text-center font-semibold">
                  MOST POPULAR — SAVE 33%
                </div>
                <div className="p-8 pt-12">
                  <div className="text-white text-2xl font-bold mb-2">Annual Plan</div>
                  <div className="flex items-end mb-2">
                    <span className="text-5xl font-bold text-white">$39.99</span>
                    <span className="text-zinc-400 ml-2">/year</span>
                  </div>
                  <div className="text-zinc-400 mb-6">Just $3.33/month</div>
                  
                  <ul className="space-y-4 mb-8">
                    <li className="flex items-start">
                      <CheckCircle className="text-[#E0FE10] mr-3 mt-1 flex-shrink-0" size={20} />
                      <span className="text-zinc-300">All Monthly Plan features</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="text-[#E0FE10] mr-3 mt-1 flex-shrink-0" size={20} />
                      <span className="text-zinc-300"><strong>33% savings</strong> vs monthly plan</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="text-[#E0FE10] mr-3 mt-1 flex-shrink-0" size={20} />
                      <span className="text-zinc-300">Priority customer support</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="text-[#E0FE10] mr-3 mt-1 flex-shrink-0" size={20} />
                      <span className="text-zinc-300">Early access to new features</span>
                    </li>
                  </ul>
                  
                  <a
                    href={currentUser ? subscribeHref('yearly') : '#'}
                    onClick={(e) => { if (!currentUser) { e.preventDefault(); setIsSignInModalOpen(true); return; } handleSubscribeClick('yearly'); }}
                    className={`w-full py-4 rounded-full text-lg font-semibold transition-all ${glassPrimary} ${isLoading ? 'opacity-50 pointer-events-none' : ''} inline-flex items-center justify-center`}
                    aria-disabled={isLoading}
                  >
                    {isLoading ? 'Processing...' : 'Get Started — First Month Free'}
                  </a>
                </div>
              </div>
            </div>

            {/* Guarantee and Trust Elements */}
            <div className={`${glassBg} flex flex-col sm:flex-row justify-center items-center gap-6 mt-10 text-center rounded-2xl p-4`}>
              <div className="flex items-center text-zinc-300">
                <Shield size={20} className="mr-2 text-[#E0FE10]" />
                <span>Secure payment</span>
              </div>
              <div className="flex items-center text-zinc-300">
                <Clock size={20} className="mr-2 text-[#E0FE10]" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </section>

          {/* Social Proof Section */}
          <section className={`w-full ${glassBg} py-20 mb-24 relative overflow-hidden`} ref={useScrollFade()}>
            {/* Background decoration */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#E0FE10]/10 rounded-full blur-[100px]"></div>
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[#E0FE10]/10 rounded-full blur-[100px]"></div>
            
            <div className="max-w-[1052.76px] mx-auto px-4 relative z-10">
              <h2 className="text-white text-3xl sm:text-4xl font-bold mb-16 text-center">
                Join <span className={gradientText}>100,000+ members</span> transforming their fitness journey
              </h2>
              
              <div className="flex flex-wrap justify-center gap-8">
                {testimonials.map((testimonial, index) => (
                  <div key={index} className={`${glassCard} rounded-2xl p-6 max-w-sm`}>
                    <div className="flex mb-4">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star 
                          key={star} 
                          fill={star <= testimonial.rating ? "#E0FE10" : "transparent"} 
                          color="#E0FE10" 
                          size={18} 
                        />
                      ))}
                    </div>
                    <p className="text-zinc-300 mb-6 line-clamp-6">"{testimonial.text}"</p>
                    <div className="flex items-center">
                      <span className="text-white font-medium">- {testimonial.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Features Grid Section */}
          <section className="max-w-[1052.76px] mx-auto px-4 py-24 relative" ref={useScrollFade()}>
            {/* Background decoration */}
            <div className="absolute -top-48 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px]"></div>
            <div className="absolute -bottom-48 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]"></div>

            <div className="relative z-10 mb-16 text-center">
              <h2 className="text-white text-3xl sm:text-4xl font-bold mb-4">
                Everything you need for <span className={gradientText}>fitness success</span>
              </h2>
              <p className="text-zinc-400 max-w-2xl mx-auto">
                Unlock all these features and more with your Pulse subscription
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
              {/* Feature cards */}
              <div className={`${glassCard} rounded-2xl p-6 flex flex-col h-full hover:translate-y-[-8px]`}>
                <div className="aspect-video bg-black/50 rounded-xl overflow-hidden mb-6">
                  <img src="/choose-body-parts-phone.png" alt="Body Part Selection" className="w-full h-full object-cover" />
                </div>
                <div className="text-white text-2xl font-bold mb-3">Body Part Selection</div>
                <div className="text-zinc-400 text-base flex-grow">
                  Select exactly which body parts you want to workout, with instant access to complementary exercises.
                </div>
              </div>

              <div className={`${glassCard} rounded-2xl p-6 flex flex-col h-full hover:translate-y-[-8px]`}>
                <div className="aspect-video bg-black/50 rounded-xl overflow-hidden mb-6">
                  <img src="/discover-exercise-phone.png" alt="Exercise Discovery" className="w-full h-full object-cover" />
                </div>
                <div className="text-white text-2xl font-bold mb-3">Exercise Discovery</div>
                <div className="text-zinc-400 text-base flex-grow">
                  Find your exercise, and create workouts that complement each other based off of cool exercise that you discover.
                </div>
              </div>

              <div className={`${glassCard} rounded-2xl p-6 flex flex-col h-full hover:translate-y-[-8px]`}>
                <div className="aspect-video bg-black/50 rounded-xl overflow-hidden mb-6">
                  <img src="/progress-log.png" alt="Progress Logs" className="w-full h-full object-cover" />
                </div>
                <div className="text-white text-2xl font-bold mb-3">Progress Logs</div>
                <div className="text-zinc-400 text-base flex-grow">
                  Logging reps, sets, and weight allows you to view your history of every workout.
                </div>
              </div>
            </div>

            <div className="mt-16 text-center relative z-10">
              <button 
                onClick={() => {
                  const element = document.getElementById('subscription-section');
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`${glassPrimary} px-10 py-4 rounded-full text-lg font-semibold`}
              >
                Get Started Today
              </button>
            </div>
          </section>

          {/* FAQ Section - Glassmorphic */}
          <section className={`${glassBg} py-24 relative overflow-hidden`} ref={useScrollFade()}>
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-[#E0FE10]/5 to-transparent"></div>

            <div className="max-w-[1052.76px] mx-auto px-4 relative z-10">
              <h2 className="text-white text-3xl sm:text-4xl font-bold mb-16 text-center">
                Frequently Asked <span className={gradientText}>Questions</span>
              </h2>

              <div className="max-w-3xl mx-auto">
                {faqData.map((item, index) => (
                  <div key={index} className={`${glassCard} mb-6 rounded-2xl p-6`}>
                    <h3 className="text-white text-xl font-medium mb-3">{item.question}</h3>
                    <p className="text-zinc-400">{item.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Final CTA Section */}
          {/* ... (existing final CTA section code) ... */}
        </main>
      </div>
    </div>
  );
};

export default Subscribe;