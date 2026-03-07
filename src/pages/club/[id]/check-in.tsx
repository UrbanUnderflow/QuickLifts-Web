import { GetServerSideProps } from 'next';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  OAuthProvider,
  signInWithPopup,
  browserPopupRedirectResolver,
} from 'firebase/auth';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FaApple,
  FaCheck,
  FaGooglePlay,
} from 'react-icons/fa';
import {
  FiArrowRight,
  FiCheckCircle,
  FiLoader,
  FiLock,
  FiMail,
  FiUser,
} from 'react-icons/fi';
import PageHead from '../../../components/PageHead';
import { useUser } from '../../../hooks/useUser';
import { authMethods } from '../../../api/firebase/auth/methods';
import {
  resolveCheckInUserProfile,
} from '../../../api/firebase/auth/profile';
import {
  generateUsernameFromEmail,
  isUsernameAvailable as checkUsernameAvailability,
  isValidUsernameFormat,
  normalizeUsername,
} from '../../../api/firebase/auth/username';
import { auth } from '../../../api/firebase/config';
import { completeClubEventCheckin } from '../../../api/firebase/club/checkin';
import {
  ClubLandingPageProps,
  fetchClubLandingPageProps,
} from '../../../api/firebase/club/landingPage';
import { User } from '../../../api/firebase/user';
import {
  buildClubCheckInPath,
  buildClubOneLink,
  buildClubPath,
  pulseWebOrigin,
} from '../../../utils/clubLinks';
import { appLinks } from '../../../utils/platformDetection';

interface ClubCheckInPageProps extends ClubLandingPageProps {
  eventId?: string | null;
}

type AuthMode = 'signup' | 'signin';
type ViewState = 'form' | 'complete-profile' | 'success';
type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

interface CompletionContext {
  email: string;
  providerLabel: string;
}

function deriveDarkBackground(hex: string): string {
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const d = max - min;

  if (d > 0) {
    s = d / max;
    if (max === r) {
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / d + 2) / 6;
    } else {
      h = ((r - g) / d + 4) / 6;
    }
  }

  const ns = s * 0.6;
  const nv = 0.06;
  const c = nv * ns;
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  const m = nv - c;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  const hi = Math.floor(h * 6) % 6;

  if (hi === 0) {
    r1 = c;
    g1 = x;
  } else if (hi === 1) {
    r1 = x;
    g1 = c;
  } else if (hi === 2) {
    g1 = c;
    b1 = x;
  } else if (hi === 3) {
    g1 = x;
    b1 = c;
  } else if (hi === 4) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  const toHex = (value: number) => Math.round((value + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}

const isEmailValid = (value: string): boolean => /\S+@\S+\.\S+/.test(value);

const getErrorMessage = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return 'Something went wrong. Please try again.';
  }

  const code = (error as Error & { code?: string }).code;

  switch (code) {
    case 'auth/email-already-in-use':
      return 'That email is already in use. Try signing in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    default:
      break;
  }

  if (error.message === 'Username already taken') {
    return 'That username is already taken. Pick another one.';
  }

  if (error.message === 'Invalid username format') {
    return 'Use 3-20 characters with letters, numbers, periods, underscores, or hyphens.';
  }

  return error.message || 'Something went wrong. Please try again.';
};

const ClubCheckInPage: React.FC<ClubCheckInPageProps> = ({
  clubData,
  creatorData,
  error,
  eventId = null,
}) => {
  const router = useRouter();
  const currentUser = useUser();
  const redirectHandledRef = useRef(false);
  const authMethodRef = useRef<string>('unknown');

  // Capture the sharedBy param from the URL for attribution tracking
  const sharedBy = typeof router.query.sharedBy === 'string' ? router.query.sharedBy : null;

  const [viewState, setViewState] = useState<ViewState>('form');
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [completionContext, setCompletionContext] = useState<CompletionContext | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [username, setUsername] = useState('');
  const [hasEditedUsername, setHasEditedUsername] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolvingRedirect, setIsResolvingRedirect] = useState(true);

  const clubName = clubData?.name || 'Pulse Club';
  const successTitle = eventId ? "You're checked in!" : "You're in!";
  const successSubtitle = eventId
    ? `You're now a member of ${clubName}.`
    : `${clubName} is ready for you in the app.`;

  const rawAccent = clubData?.accentColor || '#E0FE10';
  const accent = rawAccent.startsWith('#') ? rawAccent : `#${rawAccent}`;
  const accentHex = accent.replace('#', '');
  const darkBg = useMemo(() => deriveDarkBackground(accentHex), [accentHex]);
  const accentTextColor = useMemo(() => {
    const r = parseInt(accentHex.slice(0, 2), 16);
    const g = parseInt(accentHex.slice(2, 4), 16);
    const b = parseInt(accentHex.slice(4, 6), 16);
    const isLightAccent = (r * 299 + g * 587 + b * 114) / 1000 > 128;
    return isLightAccent ? '#000000' : '#ffffff';
  }, [accentHex]);

  const usernameOwnerId = auth.currentUser?.uid || currentUser?.id || null;
  const normalizedUsername = useMemo(() => normalizeUsername(username), [username]);
  const openInPulseHref = useMemo(() => {
    if (!clubData?.id) {
      return '#';
    }

    return buildClubOneLink({
      clubId: clubData.id,
      fallbackPath: buildClubPath(clubData.id),
      sharedBy: currentUser?.id || auth.currentUser?.uid || null,
      title: `Open ${clubName} in Pulse`,
      description: `Open ${clubName} in Pulse to join the conversation.`,
      imageUrl: clubData.coverImageURL || clubData.logoURL || null,
    });
  }, [clubData, clubName, currentUser?.id]);

  const canonicalPath = useMemo(() => {
    if (!clubData?.id) {
      return '';
    }
    return buildClubCheckInPath(clubData.id, eventId);
  }, [clubData, eventId]);

  const queueCompletionStep = useCallback((emailAddress: string, providerLabel: string, suggestedUsername: string) => {
    setCompletionContext({ email: emailAddress, providerLabel });
    setUsername(suggestedUsername);
    setHasEditedUsername(false);
    setAuthMode('signup');
    setViewState('complete-profile');
  }, []);

  const finalizeSuccessfulCheckIn = useCallback(async (user: User, authMethod?: string) => {
    if (!clubData?.id) {
      throw new Error('Club not found.');
    }

    const attribution = {
      referredBy: sharedBy,
      authMethod: authMethod || authMethodRef.current || 'unknown',
      platform: 'web' as const,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : null,
    };

    await completeClubEventCheckin({
      clubId: clubData.id,
      eventId,
      user,
      attribution,
    });

    setCompletionContext(null);
    setFormError(null);
    setFieldErrors({});

    // Redirect to the club page with checkedIn flag so it shows the welcome modal
    await router.push(`/club/${clubData.id}?checkedIn=true`);
  }, [clubData, eventId, router, sharedBy]);

  // Auto-check-in for already-authenticated users (e.g. re-scanning the QR code)
  const autoCheckinHandledRef = useRef(false);

  useEffect(() => {
    if (autoCheckinHandledRef.current) {
      return;
    }

    // Wait until we know whether a user is signed in
    if (!currentUser?.id || !currentUser.username) {
      return;
    }

    if (!clubData?.id) {
      return;
    }

    // User is already signed in — skip the form and auto-complete check-in
    autoCheckinHandledRef.current = true;

    void finalizeSuccessfulCheckIn(currentUser, 'existing');
  }, [clubData?.id, currentUser, finalizeSuccessfulCheckIn]);

  useEffect(() => {
    if (viewState !== 'form' || authMode !== 'signup') {
      return;
    }

    if (hasEditedUsername) {
      return;
    }

    if (!email) {
      setUsername('');
      return;
    }

    setUsername(generateUsernameFromEmail(email));
  }, [authMode, email, hasEditedUsername, viewState]);

  useEffect(() => {
    if (viewState === 'success') {
      setUsernameStatus('idle');
      return;
    }

    if (!(viewState === 'complete-profile' || authMode === 'signup')) {
      setUsernameStatus('idle');
      return;
    }

    if (!username) {
      setUsernameStatus('idle');
      return;
    }

    if (!isValidUsernameFormat(normalizedUsername)) {
      setUsernameStatus('invalid');
      return;
    }

    let cancelled = false;
    setUsernameStatus('checking');

    const timeoutId = window.setTimeout(async () => {
      try {
        const available = await checkUsernameAvailability(normalizedUsername, usernameOwnerId);
        if (!cancelled) {
          setUsernameStatus(available ? 'available' : 'taken');
        }
      } catch (availabilityError) {
        console.error('[ClubCheckIn] Failed to check username availability:', availabilityError);
        if (!cancelled) {
          setUsernameStatus('idle');
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [authMode, normalizedUsername, username, usernameOwnerId, viewState]);

  useEffect(() => {
    if (redirectHandledRef.current) {
      return;
    }

    redirectHandledRef.current = true;
    let isMounted = true;

    const handleRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (!isMounted || !result?.user) {
          return;
        }

        const emailAddress = result.user.email || currentUser?.email || '';
        const suggestedUsername = generateUsernameFromEmail(emailAddress || 'pulseuser');
        const profileResult = await resolveCheckInUserProfile({
          firebaseUser: result.user,
          suggestedUsername,
        });

        if (!isMounted) {
          return;
        }

        if (profileResult.status === 'needs-username') {
          queueCompletionStep(profileResult.email, 'Apple', profileResult.suggestedUsername);
          return;
        }

        await finalizeSuccessfulCheckIn(profileResult.user, 'apple');
      } catch (redirectError) {
        console.error('[ClubCheckIn] Apple redirect completion failed:', redirectError);
        if (isMounted) {
          setFormError(getErrorMessage(redirectError));
        }
      } finally {
        if (isMounted) {
          setIsResolvingRedirect(false);
        }
      }
    };

    void handleRedirect();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.email, finalizeSuccessfulCheckIn, queueCompletionStep]);

  const resetErrors = () => {
    setFormError(null);
    setFieldErrors({});
  };

  const validateUsername = async (): Promise<boolean> => {
    if (!normalizedUsername) {
      setFieldErrors((previous) => ({ ...previous, username: 'Username is required.' }));
      return false;
    }

    if (!isValidUsernameFormat(normalizedUsername)) {
      setFieldErrors((previous) => ({
        ...previous,
        username: 'Use 3-20 characters with letters, numbers, periods, underscores, or hyphens.',
      }));
      return false;
    }

    const available = await checkUsernameAvailability(normalizedUsername, usernameOwnerId);
    setUsernameStatus(available ? 'available' : 'taken');

    if (!available) {
      setFieldErrors((previous) => ({ ...previous, username: 'That username is already taken.' }));
      return false;
    }

    return true;
  };

  const handleSignUpSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    resetErrors();

    const nextErrors: Record<string, string> = {};

    if (!email) {
      nextErrors.email = 'Email is required.';
    } else if (!isEmailValid(email)) {
      nextErrors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      nextErrors.password = 'Password is required.';
    } else if (password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters.';
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    let createdAuthUser: typeof auth.currentUser = null;

    try {
      const usernameIsValid = await validateUsername();
      if (!usernameIsValid) {
        setIsSubmitting(false);
        return;
      }

      const credential = await createUserWithEmailAndPassword(auth, email, password);
      createdAuthUser = credential.user;

      const profileResult = await resolveCheckInUserProfile({
        firebaseUser: credential.user,
        requestedUsername: normalizedUsername,
        suggestedUsername: normalizedUsername,
      });

      if (profileResult.status === 'needs-username') {
        queueCompletionStep(profileResult.email, 'email sign-up', profileResult.suggestedUsername);
        return;
      }

      await finalizeSuccessfulCheckIn(profileResult.user, 'email-signup');
    } catch (signUpError) {
      console.error('[ClubCheckIn] Sign-up failed:', signUpError);
      if (createdAuthUser && getErrorMessage(signUpError) === 'That username is already taken. Pick another one.') {
        queueCompletionStep(createdAuthUser.email || email, 'email sign-up', normalizedUsername || generateUsernameFromEmail(email));
      }
      setFormError(getErrorMessage(signUpError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignInSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    resetErrors();

    const nextErrors: Record<string, string> = {};

    if (!signInEmail) {
      nextErrors.signInEmail = 'Email is required.';
    } else if (!isEmailValid(signInEmail)) {
      nextErrors.signInEmail = 'Please enter a valid email address.';
    }

    if (!signInPassword) {
      nextErrors.signInPassword = 'Password is required.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const credential = await authMethods.signInWithEmail(signInEmail, signInPassword);
      const profileResult = await resolveCheckInUserProfile({
        firebaseUser: credential.user,
        suggestedUsername: generateUsernameFromEmail(credential.user.email || signInEmail),
      });

      if (profileResult.status === 'needs-username') {
        queueCompletionStep(profileResult.email, 'email sign-in', profileResult.suggestedUsername);
        return;
      }

      await finalizeSuccessfulCheckIn(profileResult.user, 'email-signin');
    } catch (signInError) {
      console.error('[ClubCheckIn] Sign-in failed:', signInError);
      setFormError(getErrorMessage(signInError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAppleSignIn = async () => {
    resetErrors();
    setIsSubmitting(true);

    try {
      // Use popup instead of redirect — redirect breaks in QR-launched in-app browsers
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');

      const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);

      if (!result?.user) {
        setFormError('Apple sign-in was cancelled.');
        setIsSubmitting(false);
        return;
      }

      const emailAddress = result.user.email || '';
      const suggestedUsername = generateUsernameFromEmail(emailAddress || 'pulseuser');
      const profileResult = await resolveCheckInUserProfile({
        firebaseUser: result.user,
        suggestedUsername,
      });

      if (profileResult.status === 'needs-username') {
        queueCompletionStep(profileResult.email, 'Apple', profileResult.suggestedUsername);
        return;
      }

      await finalizeSuccessfulCheckIn(profileResult.user, 'apple');
    } catch (appleError) {
      console.error('[ClubCheckIn] Apple sign-in failed:', appleError);
      setFormError(getErrorMessage(appleError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    resetErrors();

    const authenticatedUser = auth.currentUser;
    if (!authenticatedUser) {
      setFormError('Your session expired. Please try again.');
      return;
    }

    setIsSubmitting(true);

    try {
      const usernameIsValid = await validateUsername();
      if (!usernameIsValid) {
        setIsSubmitting(false);
        return;
      }

      const profileResult = await resolveCheckInUserProfile({
        firebaseUser: authenticatedUser,
        requestedUsername: normalizedUsername,
        suggestedUsername: normalizedUsername,
      });

      if (profileResult.status === 'needs-username') {
        queueCompletionStep(profileResult.email, completionContext?.providerLabel || 'sign-in', profileResult.suggestedUsername);
        return;
      }

      await finalizeSuccessfulCheckIn(profileResult.user, completionContext?.providerLabel === 'Apple' ? 'apple' : 'email-signup');
    } catch (completionError) {
      console.error('[ClubCheckIn] Profile completion failed:', completionError);
      setFormError(getErrorMessage(completionError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const usernameStatusCopy = (() => {
    switch (usernameStatus) {
      case 'checking':
        return 'Checking availability...';
      case 'available':
        return 'Available';
      case 'taken':
        return 'Already taken';
      case 'invalid':
        return 'Use 3-20 valid characters';
      default:
        return 'You can change this later.';
    }
  })();

  const usernameStatusColor = (() => {
    switch (usernameStatus) {
      case 'available':
        return 'text-emerald-300';
      case 'taken':
      case 'invalid':
        return 'text-rose-300';
      default:
        return 'text-zinc-400';
    }
  })();

  if (error || !clubData) {
    return (
      <div className="min-h-screen bg-[#0E0E10] flex items-center justify-center text-white px-6">
        <PageHead pageOgUrl={`${pulseWebOrigin}${router.asPath || ''}`} />
        <div className="max-w-md w-full rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 text-center">
          <h1 className="text-2xl font-bold mb-3">{error || 'Club not found'}</h1>
          <p className="text-zinc-400">This event check-in link is unavailable right now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white overflow-hidden" style={{ backgroundColor: darkBg }}>
      <PageHead
        pageOgUrl={`${pulseWebOrigin}${canonicalPath}`}
        metaData={{
          pageId: clubData.id,
          pageTitle: `${clubName} Check-In | Pulse`,
          metaDescription: `Check in to ${clubName}, join the club, and open the conversation in Pulse.`,
          ogTitle: `${clubName} Check-In`,
          ogDescription: `Create your account, check in, and jump into ${clubName} on Pulse.`,
          ogImage: clubData.coverImageURL || clubData.logoURL || 'https://fitwithpulse.ai/club-preview.png',
          ogUrl: `${pulseWebOrigin}${canonicalPath}`,
          twitterTitle: `${clubName} Check-In`,
          twitterDescription: `Create your account, check in, and jump into ${clubName} on Pulse.`,
          twitterImage: clubData.coverImageURL || clubData.logoURL || 'https://fitwithpulse.ai/club-preview.png',
          lastUpdated: new Date().toISOString(),
        }}
      />

      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-[40rem] h-[32rem] rounded-full blur-[150px] opacity-15"
          style={{ backgroundColor: accent }}
        />
        <div
          className="absolute bottom-0 right-[-8rem] w-[24rem] h-[24rem] rounded-full blur-[130px] opacity-10"
          style={{ backgroundColor: accent }}
        />
      </div>

      <div className="relative z-10 min-h-screen px-4 py-6 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] items-start">
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="rounded-[2rem] overflow-hidden border border-white/10 bg-white/[0.03] backdrop-blur-xl"
            >
              <div className="relative min-h-[22rem] sm:min-h-[28rem]">
                <img
                  src={clubData.coverImageURL || 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2070&auto=format&fit=crop'}
                  alt={clubName}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/20" />
                <div
                  className="absolute inset-0 opacity-25 mix-blend-screen"
                  style={{ background: `radial-gradient(circle at top left, ${accent}, transparent 50%)` }}
                />

                <div className="relative h-full flex flex-col justify-between p-6 sm:p-8">
                  <div className="flex items-start justify-between gap-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-black/25 backdrop-blur-md text-sm font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accent }} />
                      {eventId ? 'Event Check-In' : 'Join the club'}
                    </div>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-black/25 backdrop-blur-md text-sm text-zinc-200">
                      <FiCheckCircle className="shrink-0" />
                      {clubData.memberCount || 1}+ members
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm uppercase tracking-[0.28em] text-zinc-300">Pulse Club</p>
                      <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none">
                        <span
                          className="bg-clip-text text-transparent"
                          style={{ backgroundImage: `linear-gradient(135deg, #ffffff 15%, ${accent} 100%)` }}
                        >
                          {clubName}
                        </span>
                      </h1>
                    </div>

                    <p className="text-zinc-200 max-w-2xl text-base sm:text-lg leading-relaxed">
                      {clubData.description || `You scanned into ${clubName}. Create your account, join the club, and open the conversation in Pulse.`}
                    </p>

                    {creatorData && (
                      <div className="flex items-center gap-3 pt-3">
                        <img
                          src={creatorData.profileImage?.profileImageURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(creatorData.displayName || creatorData.username || 'Coach')}`}
                          alt={creatorData.displayName || creatorData.username || 'Creator'}
                          className="w-11 h-11 rounded-full object-cover border border-white/15"
                        />
                        <div>
                          <p className="text-sm text-zinc-400">Hosted by</p>
                          <p className="font-semibold text-white">@{creatorData.username || creatorData.displayName}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.06 }}
              className="rounded-[2rem] border border-white/10 bg-white/[0.05] backdrop-blur-2xl p-5 sm:p-6 shadow-[0_0_60px_rgba(0,0,0,0.35)]"
            >
              <AnimatePresence mode="wait">
                {isResolvingRedirect ? (
                  <motion.div
                    key="redirect-loading"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="min-h-[30rem] flex flex-col items-center justify-center text-center px-4"
                  >
                    <FiLoader className="animate-spin text-2xl mb-4" style={{ color: accent }} />
                    <h2 className="text-2xl font-bold mb-2">Completing sign-in</h2>
                    <p className="text-zinc-400">Checking your account and preparing your club access.</p>
                  </motion.div>
                ) : viewState === 'success' ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="min-h-[30rem] flex flex-col justify-between"
                  >
                    <div className="text-center pt-4">
                      <motion.div
                        initial={{ scale: 0.85, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 240, damping: 20 }}
                        className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-5"
                        style={{ backgroundColor: `${accent}22`, boxShadow: `0 0 40px ${accent}33` }}
                      >
                        <FaCheck className="text-2xl" style={{ color: accent }} />
                      </motion.div>
                      <h2 className="text-3xl font-black mb-3">{successTitle}</h2>
                      <p className="text-zinc-300 text-lg">{successSubtitle}</p>
                    </div>

                    <div className="space-y-3">
                      <a
                        href={appLinks.appStoreUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full flex items-center justify-between gap-3 rounded-2xl px-5 py-4 font-bold transition-transform hover:scale-[1.01]"
                        style={{ backgroundColor: accent, color: accentTextColor }}
                      >
                        <span className="flex items-center gap-3">
                          <FaApple className="text-xl" />
                          Download on the App Store
                        </span>
                        <FiArrowRight />
                      </a>

                      <a
                        href={appLinks.playStoreUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full flex items-center justify-between gap-3 rounded-2xl px-5 py-4 font-semibold bg-white/5 border border-white/10 text-white transition-colors hover:bg-white/10"
                      >
                        <span className="flex items-center gap-3">
                          <FaGooglePlay className="text-lg" style={{ color: accent }} />
                          Get it on Google Play
                        </span>
                        <FiArrowRight />
                      </a>

                      <a
                        href={openInPulseHref}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-4 font-semibold border border-white/10 bg-black/25 text-zinc-100 hover:bg-black/35 transition-colors"
                      >
                        Already have the app? Open in Pulse
                      </a>
                    </div>
                  </motion.div>
                ) : viewState === 'complete-profile' ? (
                  <motion.form
                    key="complete-profile"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    onSubmit={handleCompleteProfile}
                    className="space-y-5"
                  >
                    <div className="space-y-2">
                      <p className="text-sm uppercase tracking-[0.24em]" style={{ color: accent }}>Finish sign-in</p>
                      <h2 className="text-3xl font-black">Choose your username</h2>
                      <p className="text-zinc-400">
                        Your {completionContext?.providerLabel || 'sign-in'} worked. Add a username to complete your check-in.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-sm text-zinc-400 mb-1">Signed in as</p>
                      <p className="font-semibold text-white break-all">{completionContext?.email}</p>
                    </div>

                    <label className="block">
                      <span className="text-sm text-zinc-300 mb-2 flex items-center gap-2">
                        <FiUser />
                        Username
                      </span>
                      <input
                        value={username}
                        onChange={(event) => {
                          setUsername(event.target.value);
                          setHasEditedUsername(true);
                          setFieldErrors((previous) => ({ ...previous, username: '' }));
                        }}
                        placeholder="your.username"
                        className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5 text-white placeholder:text-zinc-500 outline-none focus:border-white/30"
                        autoCapitalize="none"
                        autoCorrect="off"
                      />
                      <div className={`mt-2 text-sm ${usernameStatusColor}`}>{fieldErrors.username || usernameStatusCopy}</div>
                    </label>

                    {formError && (
                      <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                        {formError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full rounded-2xl px-5 py-4 font-black transition-all disabled:opacity-70"
                      style={{ backgroundColor: accent, color: accentTextColor }}
                    >
                      {isSubmitting ? 'Finishing check-in...' : 'Complete Check-In'}
                    </button>
                  </motion.form>
                ) : (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-5"
                  >
                    <div className="space-y-2">
                      <p className="text-sm uppercase tracking-[0.24em]" style={{ color: accent }}>
                        {eventId ? 'Check in at the event' : 'Join the club'}
                      </p>
                      <h2 className="text-3xl font-black">
                        {authMode === 'signup' ? 'Create your account' : 'Sign back in'}
                      </h2>
                      <p className="text-zinc-400">
                        {authMode === 'signup'
                          ? 'Create your account, join the club automatically, then open the conversation in Pulse.'
                          : 'Sign in and we’ll finish your club access right away.'}
                      </p>
                    </div>

                    {formError && (
                      <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                        {formError}
                      </div>
                    )}

                    {authMode === 'signup' ? (
                      <form onSubmit={handleSignUpSubmit} className="space-y-4">
                        <label className="block">
                          <span className="text-sm text-zinc-300 mb-2 flex items-center gap-2">
                            <FiMail />
                            Email
                          </span>
                          <input
                            value={email}
                            onChange={(event) => {
                              setEmail(event.target.value);
                              setFieldErrors((previous) => ({ ...previous, email: '' }));
                            }}
                            placeholder="you@example.com"
                            className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5 text-white placeholder:text-zinc-500 outline-none focus:border-white/30"
                            autoComplete="email"
                            inputMode="email"
                          />
                          {fieldErrors.email && <div className="mt-2 text-sm text-rose-300">{fieldErrors.email}</div>}
                        </label>

                        <label className="block">
                          <span className="text-sm text-zinc-300 mb-2 flex items-center gap-2">
                            <FiUser />
                            Username
                          </span>
                          <input
                            value={username}
                            onChange={(event) => {
                              setUsername(event.target.value);
                              setHasEditedUsername(true);
                              setFieldErrors((previous) => ({ ...previous, username: '' }));
                            }}
                            placeholder="your.username"
                            className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5 text-white placeholder:text-zinc-500 outline-none focus:border-white/30"
                            autoCapitalize="none"
                            autoCorrect="off"
                          />
                          <div className={`mt-2 text-sm ${usernameStatusColor}`}>{fieldErrors.username || usernameStatusCopy}</div>
                        </label>

                        <label className="block">
                          <span className="text-sm text-zinc-300 mb-2 flex items-center gap-2">
                            <FiLock />
                            Password
                          </span>
                          <input
                            value={password}
                            onChange={(event) => {
                              setPassword(event.target.value);
                              setFieldErrors((previous) => ({ ...previous, password: '' }));
                            }}
                            type="password"
                            placeholder="At least 6 characters"
                            className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5 text-white placeholder:text-zinc-500 outline-none focus:border-white/30"
                            autoComplete="new-password"
                          />
                          {fieldErrors.password && <div className="mt-2 text-sm text-rose-300">{fieldErrors.password}</div>}
                        </label>

                        <label className="block">
                          <span className="text-sm text-zinc-300 mb-2 flex items-center gap-2">
                            <FiLock />
                            Confirm password
                          </span>
                          <input
                            value={confirmPassword}
                            onChange={(event) => {
                              setConfirmPassword(event.target.value);
                              setFieldErrors((previous) => ({ ...previous, confirmPassword: '' }));
                            }}
                            type="password"
                            placeholder="Re-enter your password"
                            className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5 text-white placeholder:text-zinc-500 outline-none focus:border-white/30"
                            autoComplete="new-password"
                          />
                          {fieldErrors.confirmPassword && (
                            <div className="mt-2 text-sm text-rose-300">{fieldErrors.confirmPassword}</div>
                          )}
                        </label>

                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full rounded-2xl px-5 py-4 font-black transition-all disabled:opacity-70"
                          style={{ backgroundColor: accent, color: accentTextColor }}
                        >
                          {isSubmitting ? 'Creating account...' : 'Create Account & Check In'}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleSignInSubmit} className="space-y-4">
                        <label className="block">
                          <span className="text-sm text-zinc-300 mb-2 flex items-center gap-2">
                            <FiMail />
                            Email
                          </span>
                          <input
                            value={signInEmail}
                            onChange={(event) => {
                              setSignInEmail(event.target.value);
                              setFieldErrors((previous) => ({ ...previous, signInEmail: '' }));
                            }}
                            placeholder="you@example.com"
                            className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5 text-white placeholder:text-zinc-500 outline-none focus:border-white/30"
                            autoComplete="email"
                          />
                          {fieldErrors.signInEmail && (
                            <div className="mt-2 text-sm text-rose-300">{fieldErrors.signInEmail}</div>
                          )}
                        </label>

                        <label className="block">
                          <span className="text-sm text-zinc-300 mb-2 flex items-center gap-2">
                            <FiLock />
                            Password
                          </span>
                          <input
                            value={signInPassword}
                            onChange={(event) => {
                              setSignInPassword(event.target.value);
                              setFieldErrors((previous) => ({ ...previous, signInPassword: '' }));
                            }}
                            type="password"
                            placeholder="Your password"
                            className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5 text-white placeholder:text-zinc-500 outline-none focus:border-white/30"
                            autoComplete="current-password"
                          />
                          {fieldErrors.signInPassword && (
                            <div className="mt-2 text-sm text-rose-300">{fieldErrors.signInPassword}</div>
                          )}
                        </label>

                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full rounded-2xl px-5 py-4 font-black transition-all disabled:opacity-70"
                          style={{ backgroundColor: accent, color: accentTextColor }}
                        >
                          {isSubmitting ? 'Signing in...' : 'Sign In & Check In'}
                        </button>
                      </form>
                    )}

                    <div className="relative py-1">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/10" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase tracking-[0.22em] text-zinc-500">
                        <span className="bg-transparent px-3">or</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAppleSignIn}
                      disabled={isSubmitting}
                      className="w-full rounded-2xl border border-white/10 bg-white text-black px-5 py-4 font-bold flex items-center justify-center gap-3 transition-transform hover:scale-[1.01] disabled:opacity-70"
                    >
                      <FaApple className="text-lg" />
                      Sign in with Apple
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        resetErrors();
                        setAuthMode((previous) => (previous === 'signup' ? 'signin' : 'signup'));
                      }}
                      className="text-sm text-zinc-400 hover:text-white transition-colors"
                    >
                      {authMode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
                      <span style={{ color: accent }}>{authMode === 'signup' ? 'Sign in' : 'Create one'}</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>
          </div>
        </div>
      </div>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<ClubCheckInPageProps> = async ({ params, query, res }) => {
  const id = params?.id as string | undefined;
  const sharedProps = await fetchClubLandingPageProps({ clubId: id, res });

  return {
    props: {
      ...sharedProps,
      eventId: typeof query.eventId === 'string' ? query.eventId : null,
    },
  };
};

export default ClubCheckInPage;
