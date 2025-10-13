import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useUser, useUserLoading } from '../../hooks/useUser';
import { subscriptionService } from '../../api/firebase/subscription/service';
import { coachService } from '../../api/firebase/coach';
import { privacyService } from '../../api/firebase/privacy/service';
import { signOut } from 'firebase/auth';
import { auth } from '../../api/firebase/config';
import { FaCheckCircle, FaSpinner, FaExclamationTriangle, FaUser, FaChevronDown, FaSignOutAlt } from 'react-icons/fa';
import PrivacyConsentModal from '../../components/PrivacyConsentModal';
import SignInModal from '../../components/SignInModal';

const AthleteConnectPage: React.FC = () => {
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
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  // Subscription gate state
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [creatingCheckout, setCreatingCheckout] = useState(false);
  // Plan picker state (PulseCheck). We hard-code price IDs and display prices to avoid Netlify env dependency.
  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const HARD_CODED_PLANS = {
    monthly: {
      // Stripe Price IDs: test vs live
      // Updated TEST priceId per latest screenshot
      priceId: isLocalhost ? 'price_1SHtdpRobSf56MUOMWHNd3ns' : 'price_1SHtQcRobSf56MUOgD0MHltS',
      displayPrice: '24.99',
    },
    annual: {
      priceId: isLocalhost ? 'price_1SHtgSRobSf56MUOcX5gfwUy' : 'price_1SHti3RobSf56MUOIULmEfK4',
      displayPrice: '219.99',
    },
    // Weekly plan can be added here when a Stripe price is available
  } as const;

  const planOptions = [
    {
      key: 'monthly',
      label: 'Monthly',
      cadence: 'per month',
      priceId: HARD_CODED_PLANS.monthly.priceId,
      displayPrice: HARD_CODED_PLANS.monthly.displayPrice,
    },
    {
      key: 'annual',
      label: 'Annual',
      cadence: 'per year',
      priceId: HARD_CODED_PLANS.annual.priceId,
      displayPrice: HARD_CODED_PLANS.annual.displayPrice,
    },
  ];
  const defaultSelected = (planOptions.find(p => p.key === 'monthly') || planOptions[0])?.priceId;
  const [selectedPriceId, setSelectedPriceId] = useState<string | undefined>(defaultSelected);

  // When connection succeeds, check subscription once
  useEffect(() => {
    if (!success || !currentUser?.id) {
      console.log('[SubscriptionGate] Skipping check', { success, hasUser: !!currentUser?.id });
      return;
    }
    let cancelled = false;
    const check = async () => {
      try {
        setCheckingSubscription(true);
        console.log('[SubscriptionGate] ensureActiveOrSync starting', { userId: currentUser.id, timestamp: new Date().toISOString() });
        const res = await subscriptionService.ensureActiveOrSync(currentUser.id);
        console.log('[SubscriptionGate] ensureActiveOrSync result', { isActive: res.isActive, latestExp: res.latestExpiration?.toISOString?.() });
        if (cancelled) return;
        setIsSubscribed(res.isActive);
        if (!res.isActive) {
          console.log('[SubscriptionGate] No active subscription → showing modal');
          setShowSubscriptionModal(true);
        } else {
          console.log('[SubscriptionGate] Active subscription detected → skipping modal');
        }
      } catch (e) {
        console.warn('[SubscriptionGate] ensureActiveOrSync error', e);
        if (cancelled) return;
        setIsSubscribed(false);
        setShowSubscriptionModal(true);
      } finally {
        if (!cancelled) setCheckingSubscription(false);
      }
    };
    check();
    return () => { cancelled = true; };
  }, [success, currentUser?.id]);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Preserve current path for Apple Sign In redirects (Safari mobile fix)
  useEffect(() => {
    if (typeof window !== 'undefined' && referralCode) {
      try {
        sessionStorage.setItem('pulse_auth_return_path', router.asPath);
        console.log('[AthleteConnect] Saved return path to sessionStorage:', router.asPath);
      } catch (e) {
        console.error('[AthleteConnect] Error saving return path:', e);
      }
    }
  }, [referralCode, router.asPath]);

  useEffect(() => {
    console.log('[AthleteConnect] useEffect triggered', { 
      referralCode, 
      currentUser: !!currentUser, 
      userLoading
    });

    if (!referralCode) {
      console.log('[AthleteConnect] No referralCode, returning early');
      return;
    }

    // Don't run if we already have coach info and are not loading
    if (coachInfo && !loading) {
      console.log('[AthleteConnect] Already have coach info and not loading, skipping');
      return;
    }

    let isCancelled = false;
    
    const handleInvite = async () => {
      try {
        console.log('[AthleteConnect] Starting handleInvite');
        
        if (typeof referralCode !== 'string') {
          console.error('[AthleteConnect] Invalid referralCode type:', typeof referralCode);
          setError('Invalid referral code.');
          setLoading(false);
          return;
        }
        
        // Only fetch coach if we don't have it yet
        if (!coachInfo) {
          console.log('[AthleteConnect] Fetching coach with referralCode:', referralCode);
          const coach = await coachService.findCoachByReferralCode(referralCode);
          console.log('[AthleteConnect] Coach fetch result:', !!coach, coach);
          
          if (!coach) {
            console.error('[AthleteConnect] Coach not found for referralCode:', referralCode);
            setError('Coach not found. Please check the referral code.');
            setLoading(false);
            return;
          }
          
          if (isCancelled) {
            console.log('[AthleteConnect] Operation was cancelled, returning');
            return;
          }

          console.log('[AthleteConnect] Setting coach info');
          setCoachInfo(coach);
        }

        console.log('[AthleteConnect] Checking auth state', { 
          currentUser: !!currentUser, 
          userLoading 
        });

        if (currentUser) {
          console.log('[AthleteConnect] User is logged in, showing connection interface');
          setLoading(false);
        } else if (userLoading === false) {
          console.log('[AthleteConnect] User not logged in, showing sign in/sign up options');
          setLoading(false);
        } else {
          console.log('[AthleteConnect] Still waiting for auth to resolve, userLoading:', userLoading);
        }
        
      } catch (err) {
        console.error('[AthleteConnect] Error in handleInvite:', err);
        setError('Failed to process invite. Please try again.');
        setLoading(false);
      }
    };

    console.log('[AthleteConnect] About to call handleInvite');
    handleInvite();

    return () => {
      console.log('[AthleteConnect] Cleanup function called');
      isCancelled = true;
    };
  }, [referralCode, currentUser, userLoading, coachInfo, loading]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

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
          coachName: coachInfo.username || `Coach ${coachInfo.referralCode}`,
          shareConversations,
          shareSentiment
        });
        
        setShowPrivacyModal(false);
        setSuccess(true);
        
        // No auto-redirect - let user read app download prompt and click manually
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
      <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-[#E0FE10] text-4xl mx-auto mb-4" />
          <div className="text-white text-xl">Processing invite...</div>
          <div className="text-zinc-400 text-sm mt-2">Please wait while we set up your connection</div>
        </div>
      </div>
    );
  }

  if (success) {
    // When we hit the success screen, check subscription once and show the subscription gate if needed
    if (currentUser && isSubscribed === null && !checkingSubscription) {
      // Testing override: show subscription modal regardless of status
      const force = router.query.forceSubscribe === '1' || router.query.force === 'subscribe';
      if (force) {
        console.log('[SubscriptionGate] FORCE enabled via query → showing subscription modal');
        setIsSubscribed(false);
        setShowSubscriptionModal(true);
        return;
      }
      setCheckingSubscription(true);
      // Use PulseCheck-only status to decide gating (plans type prefixed with 'pulsecheck-')
      subscriptionService.ensureActiveOrSyncPulseCheck(currentUser.id)
        .then((res) => {
          setIsSubscribed(res.isActive);
          if (!res.isActive) setShowSubscriptionModal(true);
        })
        .catch(() => {
          // On error, keep gate visible so user can self-serve
          setIsSubscribed(false);
          setShowSubscriptionModal(true);
        })
        .finally(() => setCheckingSubscription(false));
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black flex items-center justify-center px-4">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="mb-6">
            <FaCheckCircle className="text-green-400 text-6xl mx-auto mb-4 animate-bounce" />
          </div>
          
          <h1 className="text-3xl font-bold text-white mb-4">Connection Successful!</h1>
          <p className="text-zinc-300 mb-8">
            You're now connected with your coach. Ready to unlock your full potential!
          </p>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
            <div className="flex items-center space-x-4">
              {coachInfo?.profileImage?.profileImageURL ? (
                <img 
                  src={coachInfo.profileImage.profileImageURL} 
                  alt={coachInfo.username || 'Coach'} 
                  className="w-16 h-16 rounded-full object-cover border-2 border-[#E0FE10]"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center border-2 border-[#E0FE10]">
                  <FaUser className="text-[#E0FE10] text-2xl" />
                </div>
              )}
              <div className="text-left flex-1">
                <div className="text-white font-semibold text-lg">
                  {coachInfo?.displayName || coachInfo?.username || `Coach ${referralCode}`}
                </div>
                <div className="text-zinc-400 text-sm">Your fitness coach</div>
                {coachInfo?.bio && (
                  <div className="text-zinc-500 text-xs mt-1 line-clamp-2">{coachInfo.bio}</div>
                )}
              </div>
            </div>
          </div>

          {/* PulseCheck App Download CTA */}
          <div className="bg-gradient-to-r from-[#E0FE10]/10 to-lime-400/10 border border-[#E0FE10]/30 rounded-xl p-6 mb-6">
            <div className="mb-4">
              <div className="text-lg font-bold text-white mb-2">
                📱 Get the PulseCheck App
              </div>
              <p className="text-zinc-300 text-sm leading-relaxed">
                Chat with your coach and access AI-powered mindset coaching anytime, anywhere. Download PulseCheck to unlock:
              </p>
            </div>
            
            <ul className="text-left text-zinc-300 text-sm space-y-2 mb-6">
              <li className="flex items-start gap-2">
                <span className="text-[#E0FE10] flex-shrink-0">✓</span>
                <span>Direct messaging with your coach</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#E0FE10] flex-shrink-0">✓</span>
                <span>AI sports psychology & mindset coaching</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#E0FE10] flex-shrink-0">✓</span>
                <span>Daily readiness scores & performance insights</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#E0FE10] flex-shrink-0">✓</span>
                <span>Smart journaling & mental rep tracking</span>
              </li>
            </ul>
            
            <a
              href="https://apps.apple.com/by/app/pulsecheck-mindset-coaching/id6747253393"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-[#E0FE10] text-black px-6 py-4 rounded-xl hover:bg-lime-400 transition-colors font-bold text-lg mb-3"
            >
              Download PulseCheck
            </a>
            
            <p className="text-zinc-500 text-xs">
              Available on iPhone
            </p>
          </div>

          <button
            onClick={() => {
              try { localStorage.setItem('pulsecheck_has_seen_marketing', 'true'); } catch {}
              router.push('/PulseCheck?web=1');
            }}
            className="w-full bg-zinc-800 border border-zinc-700 text-white px-6 py-3 rounded-lg hover:bg-zinc-700 transition-colors font-semibold"
          >
            Continue to PulseCheck
          </button>

          {/* Subscription Gate Modal */}
          {showSubscriptionModal && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg text-left overflow-hidden">
                <div className="p-6 border-b border-zinc-800">
                  <h2 className="text-xl font-semibold text-white">Unlock PulseCheck</h2>
                  <p className="text-zinc-300 mt-2">
                    Subscribe to access AI mindset coaching and message your coach. You can cancel anytime.
                  </p>
                </div>

                <div className="p-6 space-y-3">
                  {/* Plan picker */}
                  <div className="space-y-2">
                    {planOptions.length === 0 && (
                      <div className="bg-zinc-800 rounded-lg px-4 py-3 text-zinc-400">
                        No PulseCheck plans are configured. Please set NEXT_PUBLIC_STRIPE_PRICE_PULSECHECK_* env vars.
                      </div>
                    )}
                    {planOptions.map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => setSelectedPriceId(opt.priceId)}
                        className={`w-full flex items-center justify-between rounded-lg px-4 py-3 border ${
                          selectedPriceId === opt.priceId
                            ? 'border-[#E0FE10] bg-zinc-800'
                            : 'border-zinc-700 bg-zinc-800/60 hover:bg-zinc-800'
                        }`}
                      >
                        <div className="text-left">
                          <div className="text-white font-medium">PulseCheck {opt.label}</div>
                          <div className="text-zinc-400 text-xs">{opt.cadence}</div>
                        </div>
                        <div className="text-white font-semibold">
                          {opt.displayPrice ? `$${opt.displayPrice}` : ''}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => setShowSubscriptionModal(false)}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white"
                    >
                      Not now
                    </button>
                    <button
                      onClick={async () => {
                        if (!currentUser) return;
                        try {
                          setCreatingCheckout(true);
                          // Resolve priceId precedence for checkout:
                          // 1) ?price=...
                          // 2) Selected plan from picker
                          // 3) Legacy athlete monthly fallback
                          const priceFromQuery = (typeof router.query.price === 'string' && router.query.price) || undefined;
                          const athleteMonthlyFallback = isLocalhost ? 'price_test_athlete_monthly' : 'price_live_athlete_monthly';
                          const priceId = priceFromQuery || selectedPriceId || athleteMonthlyFallback;
                          console.log('[SubscriptionGate] Creating checkout', { userId: currentUser.id, priceId, referralCode });
                          const res = await fetch('/.netlify/functions/create-athlete-checkout-session', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              userId: currentUser.id,
                              priceId,
                              coachReferralCode: typeof referralCode === 'string' ? referralCode : undefined,
                            })
                          });
                          const data = await res.json();
                          if (res.ok && data.url) {
                            // Save return path for Safari mobile
                            try { sessionStorage.setItem('pulse_auth_return_path', router.asPath); } catch {}
                            window.location.href = data.url as string;
                          } else {
                            console.error('[SubscriptionGate] Failed to create checkout session', data);
                          }
                        } catch (e) {
                          console.error('[SubscriptionGate] create checkout error', e);
                        } finally {
                          setCreatingCheckout(false);
                        }
                      }}
                      disabled={creatingCheckout}
                      className="px-4 py-2 bg-[#E0FE10] hover:bg-lime-400 rounded-lg text-black font-semibold disabled:opacity-50"
                    >
                      {creatingCheckout ? 'Redirecting…' : 'Subscribe'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black flex items-center justify-center px-4">
        <div className="text-center max-w-md mx-auto p-8">
          <FaExclamationTriangle className="text-red-400 text-6xl mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-white mb-4">Connection Issue</h1>
          <p className="text-zinc-300 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-[#E0FE10] text-black px-6 py-3 rounded-lg hover:bg-lime-400 transition-colors font-semibold"
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
      <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black flex items-center justify-center px-4">
        <div className="text-center max-w-md mx-auto p-8">
          <FaSpinner className="animate-spin text-[#E0FE10] text-6xl mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-white mb-4">Connecting to Coach</h1>
          <p className="text-zinc-300 mb-6">
            Setting up your connection...
          </p>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center space-x-4">
              {coachInfo?.profileImage?.profileImageURL ? (
                <img 
                  src={coachInfo.profileImage.profileImageURL} 
                  alt={coachInfo.username || 'Coach'} 
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                  <FaUser className="text-[#E0FE10]" />
                </div>
              )}
              <div className="text-left">
                <div className="text-white font-medium">
                  {coachInfo?.displayName || coachInfo?.username || `Coach ${referralCode}`}
                </div>
                <div className="text-zinc-400 text-sm">Connecting...</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Dynamic OG/Twitter meta for rich previews
  const title = `Join ${coachInfo?.displayName || coachInfo?.username || 'your coach'} on Pulse`;
  const description = `Connect with your coach for personalized fitness guidance and support.`;
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://fitwithpulse.ai';
  const ogImage = coachInfo?.profileImage?.profileImageURL || `${base}/athlete-connect-default.jpg`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black flex items-center justify-center px-4">
      <Head>
        <title>{title}</title>
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:url" content={`${base}/connect/${referralCode || ''}`} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />
      </Head>
      
      <div className="text-center max-w-md mx-auto p-8">
        {/* Signed in as badge with dropdown */}
        {currentUser && (
          <div className="mb-6 relative inline-block" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                <FaUser className="text-[#E0FE10] text-xs" />
              </div>
              <span className="text-zinc-400 text-sm">Signed in as</span>
              <span className="text-white text-sm font-medium">
                @{currentUser.username || currentUser.email?.split('@')[0]}
              </span>
              <FaChevronDown className={`text-zinc-400 text-xs transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown menu */}
            {showUserMenu && (
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden min-w-[200px] z-50">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-zinc-800 transition-colors"
                >
                  <FaSignOutAlt className="text-zinc-400" />
                  <span className="text-sm">Sign Out</span>
                </button>
              </div>
            )}
          </div>
        )}
        
        <div className="mb-8">
          <img 
            src="/pulseIcon.png" 
            alt="Pulse" 
            className="w-16 h-16 mx-auto mb-4"
          />
        </div>
        
        <h1 className="text-3xl font-bold text-white mb-3">You've Been Invited!</h1>
        <p className="text-zinc-400 mb-8">
          Connect with your coach to start your fitness journey
        </p>
        
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
          <div className="flex items-center space-x-4 mb-4">
            {coachInfo?.profileImage?.profileImageURL ? (
              <img 
                src={coachInfo.profileImage.profileImageURL} 
                alt={coachInfo.username || 'Coach'} 
                className="w-16 h-16 rounded-full object-cover border-2 border-[#E0FE10]"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center border-2 border-[#E0FE10]">
                <FaUser className="text-[#E0FE10] text-2xl" />
              </div>
            )}
            <div className="text-left flex-1">
              <div className="text-white font-semibold text-lg">
                {coachInfo?.displayName || coachInfo?.username || `Coach ${referralCode}`}
              </div>
              <div className="text-zinc-400 text-sm">Fitness Coach</div>
            </div>
          </div>
          
          {coachInfo?.bio && (
            <p className="text-zinc-300 text-sm text-left border-t border-zinc-800 pt-4">
              {coachInfo.bio}
            </p>
          )}
        </div>

        {/* Connection Button - Only show if user is logged in */}
        {currentUser ? (
          <>
            <div className="mb-6">
              <button
                onClick={connectToCoach}
                className="w-full bg-[#E0FE10] text-black px-6 py-4 rounded-xl hover:bg-lime-400 transition-colors font-semibold text-lg"
              >
                Connect with Coach
              </button>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
              <p className="text-zinc-500 text-xs">
                By connecting, you'll get personalized fitness coaching, workout tracking, and direct support from your coach.
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Sign In / Sign Up Options - Show when not logged in */}
            <div className="space-y-3 mb-6">
              <button
                onClick={() => setShowSignInModal(true)}
                className="w-full bg-[#E0FE10] text-black px-6 py-4 rounded-xl hover:bg-lime-400 transition-colors font-semibold text-lg"
              >
                Sign In
              </button>
              
              <div className="text-center">
                <span className="text-zinc-500 text-sm">or </span>
                <button
                  onClick={() => router.push(`/sign-up?coach=${referralCode}&redirect=${encodeURIComponent(router.asPath)}`)}
                  className="text-[#E0FE10] hover:text-lime-400 text-sm font-medium transition-colors underline"
                >
                  Create Account
                </button>
              </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
              <p className="text-zinc-500 text-xs">
                Sign in to connect with your coach and access personalized fitness coaching, workout tracking, and direct support.
              </p>
            </div>
          </>
        )}

        <button
          onClick={() => router.push('/')}
          className="mt-6 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
        >
          Maybe Later
        </button>

        {/* Privacy Consent Modal */}
        <PrivacyConsentModal
          isOpen={showPrivacyModal}
          onClose={() => setShowPrivacyModal(false)}
          onConsent={handlePrivacyConsent}
          coachName={coachInfo?.displayName || coachInfo?.username || `Coach ${referralCode}`}
          loading={connecting}
        />

        {/* Sign In Modal */}
        <SignInModal
          isVisible={showSignInModal}
          closable={true}
          onClose={() => setShowSignInModal(false)}
          onSignInSuccess={() => {
            console.log('[AthleteConnect] Sign in successful');
            setShowSignInModal(false);
            
            // Safari mobile fix: Ensure we stay on this page after Apple Sign In
            const returnPath = sessionStorage.getItem('pulse_auth_return_path');
            if (returnPath && returnPath !== router.asPath) {
              console.log('[AthleteConnect] Redirecting back to return path:', returnPath);
              router.push(returnPath);
            }
            // After sign-in, the page will re-render with currentUser populated
            // and show the connection button
          }}
          onSignInError={(error) => {
            console.error('[AthleteConnect] Sign in error:', error);
          }}
        />
      </div>
    </div>
  );
};

export default AthleteConnectPage;

