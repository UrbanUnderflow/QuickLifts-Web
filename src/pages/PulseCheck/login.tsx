import type { NextPage } from 'next';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import {
  signInWithPopup,
  OAuthProvider,
  UserCredential,
  getRedirectResult,
} from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { auth, initializeFirebase } from '../../api/firebase/config';
import authService from '../../api/firebase/auth';
import { userService, User, SubscriptionType } from '../../api/firebase/user';
import { useUser } from '../../hooks/useUser';
import PageHead from '../../components/PageHead';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { toggleDevMode } from '../../redux/devModeSlice';

const PULSECHECK_PURPLE = '#8B5CF6';
const PULSECHECK_PURPLE_SOFT = '#A78BFA';
const PULSECHECK_PURPLE_DEEP = '#7C3AED';

// ─────────────────────────────────────────────────
// FLOATING ORB — ambient background helper
// ─────────────────────────────────────────────────
const FloatingOrb: React.FC<{
  color: string;
  size: number;
  style: React.CSSProperties;
  delay?: number;
}> = ({ color, size, style, delay = 0 }) => (
  <motion.div
    className="absolute rounded-full blur-3xl pointer-events-none"
    style={{ backgroundColor: color, width: size, height: size, ...style }}
    animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.28, 0.15] }}
    transition={{ duration: 10, repeat: Infinity, delay, ease: 'easeInOut' }}
  />
);

// ─────────────────────────────────────────────────
// GLASS SURFACE — reusable glassy container
// ─────────────────────────────────────────────────
const GlassSurface: React.FC<{
  children: React.ReactNode;
  accentColor?: string;
  className?: string;
}> = ({ children, accentColor = PULSECHECK_PURPLE, className = '' }) => (
  <div className={`relative ${className}`}>
    <div
      className="absolute -inset-[1px] rounded-[32px] overflow-hidden pointer-events-none"
      style={{
        background: `linear-gradient(180deg, ${accentColor}30 0%, ${accentColor}08 40%, transparent 100%)`,
      }}
    />
    <div
      className="relative rounded-[32px] overflow-hidden backdrop-blur-2xl border border-white/[0.08]"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
        boxShadow: '0 32px 100px rgba(0,0,0,0.5), 0 1px 0 inset rgba(255,255,255,0.07)',
      }}
    >
      {/* Top chromatic line */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px] opacity-60"
        style={{ background: `linear-gradient(90deg, transparent 5%, ${accentColor}50, transparent 95%)` }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent pointer-events-none" />
      {children}
    </div>
  </div>
);

// ─────────────────────────────────────────────────
// DEV MODE TOGGLE — only visible on localhost
// ─────────────────────────────────────────────────
const DevModeToggle: React.FC = () => {
  const dispatch = useDispatch();
  const isDevelopment = useSelector((state: RootState) => state.devMode.isDevelopment);
  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';

  useEffect(() => {
    const savedMode = window.localStorage.getItem('devMode') === 'true';
    if (savedMode !== isDevelopment) {
      console.log('[PulseCheck Login DevMode] Syncing with saved mode:', { savedMode, currentMode: isDevelopment });
      dispatch(toggleDevMode());
      initializeFirebase(savedMode);
    }
  }, []);

  const handleToggle = () => {
    const newMode = !isDevelopment;
    console.log('[PulseCheck Login DevMode] Toggling:', {
      from: isDevelopment ? 'development' : 'production',
      to: newMode ? 'development' : 'production',
    });
    window.localStorage.setItem('devMode', String(newMode));
    dispatch(toggleDevMode());
    initializeFirebase(newMode);
    setTimeout(() => window.location.reload(), 300);
  };

  return (
    <button
      onClick={handleToggle}
      className="fixed top-4 left-4 z-50 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-2 backdrop-blur-md border"
      style={{
        background: isDevelopment
          ? 'rgba(224,254,16,0.15)'
          : 'rgba(255,255,255,0.06)',
        borderColor: isDevelopment
          ? 'rgba(224,254,16,0.3)'
          : 'rgba(255,255,255,0.1)',
        color: isDevelopment ? '#E0FE10' : 'rgba(255,255,255,0.7)',
      }}
      title={`Using ${isDevelopment ? 'development' : 'production'} Firebase config${isLocalhost ? ' (Local)' : ''}`}
    >
      {isDevelopment ? '🔧 Dev' : '🚀 Prod'}{isLocalhost ? ' (Local)' : ''}
    </button>
  );
};

// ─────────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ─────────────────────────────────────────────────
type ViewState = 'login' | 'signup' | 'forgot';

const STORAGE_KEY_PC = 'pulsecheck_has_seen_marketing';

const PulseCheckLoginPage: NextPage = () => {
  const router = useRouter();
  const currentUser = useUser();
  const legacyFlow = typeof router.query.legacyFlow === 'string' ? router.query.legacyFlow : '';
  const legacyRef = typeof router.query.ref === 'string' ? router.query.ref.trim() : '';

  // ── form state ──
  const [view, setView] = useState<ViewState>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const legacyFlowMessage = useMemo(() => {
    if (legacyFlow === 'athlete-referral-retired') {
      return {
        title: 'Legacy athlete referral links are retired',
        body: legacyRef
          ? `The old coach referral code ${legacyRef} no longer grants athlete access. Ask your coach or team admin for a current PulseCheck team invite link.`
          : 'Ask your coach or team admin for a current PulseCheck team invite link.',
      };
    }

    if (legacyFlow === 'coach-referral-retired') {
      return {
        title: 'Legacy coach referral links are retired',
        body: legacyRef
          ? `The old coach referral code ${legacyRef} no longer provisions new coach accounts. New coach-led organizations should start through PulseCheck coach setup or a direct admin activation link.`
          : 'New coach-led organizations should start through PulseCheck coach setup or a direct admin activation link.',
      };
    }

    if (legacyFlow === 'coach-staff-migration') {
      return {
        title: 'Legacy staff invite flow is being retired',
        body: 'Create your account here, then have your team admin issue the current PulseCheck team invite so your membership, commercial access, and permissions land in the right container.',
      };
    }

    return null;
  }, [legacyFlow, legacyRef]);

  // ── password validation ──
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasMinLength = password.length >= 8;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  // ── redirect on already-signed-in ──
  useEffect(() => {
    if (currentUser) {
      // Already signed in — go straight to the app
      localStorage.setItem(STORAGE_KEY_PC, 'true');
      router.replace('/PulseCheck?web=1');
    }
  }, [currentUser, router]);

  // ── handle redirect results (Apple sign-in redirect) ──
  useEffect(() => {
    let isMounted = true;

    const handleRedirect = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const isRedirecting = urlParams.has('state') || window.location.href.includes('__/auth/handler');
      if (!isRedirecting) return;

      try {
        setIsLoading(true);
        const result = await getRedirectResult(auth);
        if (!isMounted) return;
        if (result?.user) {
          await ensureFirestoreUser(result.user);
          enterApp();
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('[PulseCheck Login] Redirect result error:', err);
        setError(err instanceof Error ? err.message : 'Authentication redirect failed');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    handleRedirect();
    return () => { isMounted = false; };
  }, []);

  const enterApp = useCallback(() => {
    localStorage.setItem(STORAGE_KEY_PC, 'true');
    router.replace('/PulseCheck?web=1');
  }, [router]);

  const ensureFirestoreUser = async (firebaseUser: any) => {
    let firestoreUser = await userService.fetchUserFromFirestore(firebaseUser.uid);
    if (!firestoreUser) {
      if (!firebaseUser.email) {
        throw new Error('Authentication did not provide an email address.');
      }
      firestoreUser = new User(firebaseUser.uid, {
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || '',
        registrationComplete: false,
        subscriptionType: SubscriptionType.unsubscribed,
      });
      await userService.createUser(firebaseUser.uid, firestoreUser);
    }
    userService.nonUICurrentUser = firestoreUser;
    return firestoreUser;
  };

  // ──────────────────────────────────────────────────
  // AUTH HANDLERS — mirrors SignInModal exactly
  // ──────────────────────────────────────────────────

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await authService.signInWithEmail(email, password);
      await ensureFirestoreUser(result.user);
      enterApp();
    } catch (err: any) {
      console.error('[PulseCheck Login] Email sign-in error:', err);
      switch (err.code) {
        case 'auth/user-not-found':
          setError('No account found with this email address.');
          break;
        case 'auth/wrong-password':
          setError('Incorrect password. Please try again.');
          break;
        case 'auth/invalid-email':
          setError('Invalid email address.');
          break;
        case 'auth/too-many-requests':
          setError('Too many attempts. Please wait a moment and try again.');
          break;
        case 'auth/invalid-credential':
          setError('Invalid email or password. Please try again.');
          break;
        default:
          setError(err.message || 'Sign in failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('Please enter your email.'); return; }
    if (!hasMinLength || !hasUppercase || !hasNumber) {
      setError('Please make sure your password meets all requirements.');
      return;
    }
    if (!passwordsMatch) { setError('Passwords do not match.'); return; }

    setIsLoading(true);
    setError(null);
    try {
      const result = await authService.signUpWithEmail({ email, password, username: '' });
      await ensureFirestoreUser(result.user);
      enterApp();
    } catch (err: any) {
      console.error('[PulseCheck Login] Email sign-up error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('An account already exists with this email. Please sign in instead.');
      } else {
        setError(err.message || 'Sign up failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Google: mirrors SignInModal → authService.signInWithGoogle()
  //    which uses signInWithPopup(auth, provider, browserPopupRedirectResolver) ──
  const handleGoogleSignIn = async () => {
    try {
      console.log('[PulseCheck Login] Starting Google auth');
      setIsLoading(true);
      setError(null);
      setActiveProvider('google');

      const result = await authService.signInWithGoogle();
      const user = result.user;

      if (!user || !user.email) {
        console.error('[PulseCheck Login] Google sign-in completed but no email provided.');
        setError('Sign-in failed: Email address is required.');
        setIsLoading(false);
        setActiveProvider(null);
        return;
      }

      console.log('[PulseCheck Login] Google sign-in success:', { uid: user.uid, email: user.email });
      await ensureFirestoreUser(user);
      enterApp();
    } catch (err: any) {
      console.error('[PulseCheck Login] Google auth error:', err);
      let errorMessage = 'An unexpected error occurred';

      switch (err.code) {
        case 'auth/popup-blocked':
          errorMessage = 'Please enable popups for this site and try again';
          break;
        case 'auth/popup-closed-by-user':
          errorMessage = 'Sign-in cancelled. Please try again';
          break;
        case 'auth/cancelled-popup-request':
          errorMessage = 'Another sign-in attempt is already in progress';
          break;
        case 'auth/account-exists-with-different-credential':
          errorMessage = 'An account already exists with this email using a different sign-in method.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection and try again';
          break;
        default:
          errorMessage = err.message || errorMessage;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setActiveProvider(null);
    }
  };

  // ── Apple: mirrors SignInModal handleSocialAuth('apple') exactly ──
  //    Uses signInWithPopup(auth, appleProvider) — same as SignInModal line 319 ──
  const handleAppleSignIn = async () => {
    try {
      console.log('[PulseCheck Login] Starting Apple auth');
      setIsLoading(true);
      setError(null);
      setActiveProvider('apple');

      // Initialize Apple OAuth provider — exact same as SignInModal
      const appleProvider = new OAuthProvider('apple.com');
      appleProvider.addScope('email');
      appleProvider.addScope('name');

      try {
        // Sign in with popup — mirrors SignInModal line 319
        const result: UserCredential = await signInWithPopup(auth, appleProvider);
        const user = result.user;

        // Fetch or create user in Firestore — mirrors SignInModal lines 322-330
        let firestoreUser = await userService.fetchUserFromFirestore(user.uid);
        if (!firestoreUser) {
          if (!user.email) {
            throw new Error('Apple sign-in did not return an email address.');
          }
          firestoreUser = new User(user.uid, {
            id: user.uid,
            email: user.email || '',
            displayName: user.displayName || '',
          });
          await userService.createUser(user.uid, firestoreUser);
        }

        userService.nonUICurrentUser = firestoreUser;
        console.log('[PulseCheck Login] Apple sign-in success:', { uid: user.uid, email: user.email });

        // PulseCheck bypasses subscription gating — go straight to app
        enterApp();
      } catch (error: unknown) {
        console.error('[PulseCheck Login] Apple sign-in popup error:', error);
        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError('An unknown error occurred during Apple sign-in');
        }
      }
    } catch (err: any) {
      console.error('[PulseCheck Login] Apple auth error:', err);
      let errorMessage = 'An unexpected error occurred';

      switch (err.code) {
        case 'auth/popup-blocked':
          errorMessage = 'Please enable popups for this site and try again';
          break;
        case 'auth/popup-closed-by-user':
          errorMessage = 'Sign-in cancelled. Please try again';
          break;
        case 'auth/cancelled-popup-request':
          errorMessage = 'Another sign-in attempt is already in progress';
          break;
        case 'auth/account-exists-with-different-credential':
          errorMessage = 'An account already exists with this email using a different sign-in method.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection and try again';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'Apple sign-in is not available in this environment. Please try Google or email sign-in.';
          break;
        default:
          errorMessage = err.message || errorMessage;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setActiveProvider(null);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('Please enter your email address.'); return; }
    setIsLoading(true);
    setError(null);
    try {
      await authService.resetPassword(email);
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── If user is already signed in, show nothing until redirect fires ──
  if (currentUser) return null;

  return (
    <>
      <PageHead
        metaData={{
          pageId: 'pulsecheck-login',
          pageTitle: 'Sign In — PulseCheck',
          metaDescription: 'Sign in to PulseCheck, the mental performance OS for elite athletic programs.',
          lastUpdated: new Date().toISOString(),
        }}
        pageOgUrl="https://fitwithpulse.ai/PulseCheck/login"
      />

      <div className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ background: '#060608' }}>
        {/* ── DEV/PROD TOGGLE — localhost only ── */}
        {typeof window !== 'undefined' && window.location.hostname === 'localhost' && <DevModeToggle />}

        {/* ── AMBIENT ORBS ── */}
        <FloatingOrb color={PULSECHECK_PURPLE} size={600} style={{ top: '-15%', left: '-10%' }} delay={0} />
        <FloatingOrb color="#3B82F6" size={400} style={{ bottom: '-10%', right: '-8%' }} delay={3} />
        <FloatingOrb color={PULSECHECK_PURPLE_SOFT} size={300} style={{ top: '50%', right: '20%' }} delay={6} />

        {/* Noise texture */}
        <div
          className="absolute inset-0 opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=\")",
          }}
        />

        {/* ── CONTENT ── */}
        <div className="relative z-10 w-full max-w-[460px] mx-auto px-5 py-8">
          {/* LOGO + BACK */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            {/* Back to marketing */}
            <button
              type="button"
              onClick={() => router.push('/PulseCheck')}
              className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to PulseCheck
            </button>

            {/* Logo / Brand */}
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6A9AFA] to-[#8B5CF6] flex items-center justify-center shadow-lg shadow-[#8B5CF6]/20">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" width="18" height="18">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">PulseCheck</h1>
            </div>
            <p className="text-sm text-zinc-500">
              The mental performance OS for elite programs
            </p>
          </motion.div>

          {/* ── GLASS LOGIN CARD ── */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <GlassSurface accentColor={view === 'forgot' ? '#3B82F6' : '#8B5CF6'}>
              <div className="p-7 sm:p-8">
                {legacyFlowMessage ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-5 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-4"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-200" />
                      <div>
                        <p className="text-sm font-semibold text-amber-50">{legacyFlowMessage.title}</p>
                        <p className="mt-2 text-sm leading-7 text-amber-50/80">{legacyFlowMessage.body}</p>
                      </div>
                    </div>
                  </motion.div>
                ) : null}

                {/* ── Error banner ── */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-5 rounded-xl p-3.5 flex items-start gap-3"
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
                    >
                      <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-300 leading-relaxed">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ═══ SIGN IN VIEW ═══ */}
                {view === 'login' && (
                  <motion.div
                    key="login"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                  >
                    <h2 className="text-xl font-bold text-white mb-1">Welcome back</h2>
                    <p className="text-sm text-zinc-400 mb-6">Sign in to your PulseCheck account</p>

                    {/* Social buttons */}
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={isLoading}
                        className="flex items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white transition-all duration-200 hover:brightness-110 disabled:opacity-50"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        {activeProvider === 'google' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 48 48">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                          </svg>
                        )}
                        Google
                      </button>

                      <button
                        type="button"
                        onClick={handleAppleSignIn}
                        disabled={isLoading}
                        className="flex items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white transition-all duration-200 hover:brightness-110 disabled:opacity-50"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        {activeProvider === 'apple' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                          </svg>
                        )}
                        Apple
                      </button>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3 mb-5">
                      <div className="flex-1 h-px bg-white/[0.08]" />
                      <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-600 font-medium">or</span>
                      <div className="flex-1 h-px bg-white/[0.08]" />
                    </div>

                    {/* Email form */}
                    <form onSubmit={handleEmailSignIn} className="space-y-4">
                      <div>
                        <label className="block text-[11px] uppercase tracking-[0.2em] text-zinc-500 font-medium mb-2">
                          Email
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setError(null); }}
                          placeholder="you@program.edu"
                          className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition-all duration-200 focus:ring-1 focus:ring-[#8B5CF6]/50"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                          autoComplete="email"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] uppercase tracking-[0.2em] text-zinc-500 font-medium mb-2">
                          Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError(null); }}
                            placeholder="••••••••"
                            className="w-full rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder:text-zinc-600 outline-none transition-all duration-200 focus:ring-1 focus:ring-[#8B5CF6]/50"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Forgot password */}
                      <div className="text-right">
                        <button
                          type="button"
                          onClick={() => { setView('forgot'); setError(null); setResetSent(false); }}
                          className="text-xs text-[#8B5CF6] hover:text-[#A78BFA] transition-colors font-medium"
                        >
                          Forgot password?
                        </button>
                      </div>

                      {/* Submit */}
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                        style={{
                          background: `linear-gradient(135deg, ${PULSECHECK_PURPLE}, ${PULSECHECK_PURPLE_DEEP})`,
                          boxShadow: '0 4px 20px rgba(139,92,246,0.28)',
                        }}
                      >
                        {isLoading && !activeProvider ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            Sign In
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    </form>

                    {/* Switch to sign up */}
                    <p className="mt-6 text-center text-sm text-zinc-500">
                      Don't have an account?{' '}
                      <button
                        type="button"
                        onClick={() => { setView('signup'); setError(null); setPassword(''); setConfirmPassword(''); }}
                        className="text-[#8B5CF6] hover:text-[#A78BFA] font-semibold transition-colors"
                      >
                        Create one
                      </button>
                    </p>
                  </motion.div>
                )}

                {/* ═══ SIGN UP VIEW ═══ */}
                {view === 'signup' && (
                  <motion.div
                    key="signup"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                  >
                    <h2 className="text-xl font-bold text-white mb-1">Create your account</h2>
                    <p className="text-sm text-zinc-400 mb-6">Get started with PulseCheck</p>

                    {/* Social buttons */}
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={isLoading}
                        className="flex items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white transition-all duration-200 hover:brightness-110 disabled:opacity-50"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        {activeProvider === 'google' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 48 48">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                          </svg>
                        )}
                        Google
                      </button>

                      <button
                        type="button"
                        onClick={handleAppleSignIn}
                        disabled={isLoading}
                        className="flex items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white transition-all duration-200 hover:brightness-110 disabled:opacity-50"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        {activeProvider === 'apple' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                          </svg>
                        )}
                        Apple
                      </button>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3 mb-5">
                      <div className="flex-1 h-px bg-white/[0.08]" />
                      <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-600 font-medium">or</span>
                      <div className="flex-1 h-px bg-white/[0.08]" />
                    </div>

                    {/* Email/Password form */}
                    <form onSubmit={handleEmailSignUp} className="space-y-4">
                      <div>
                        <label className="block text-[11px] uppercase tracking-[0.2em] text-zinc-500 font-medium mb-2">
                          Email
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setError(null); }}
                          placeholder="you@program.edu"
                          className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition-all duration-200 focus:ring-1 focus:ring-[#8B5CF6]/50"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                          autoComplete="email"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] uppercase tracking-[0.2em] text-zinc-500 font-medium mb-2">
                          Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError(null); }}
                            placeholder="••••••••"
                            className="w-full rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder:text-zinc-600 outline-none transition-all duration-200 focus:ring-1 focus:ring-[#8B5CF6]/50"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>

                        {/* Password requirements */}
                        {password.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-3 space-y-1.5"
                          >
                            {[
                              { met: hasMinLength, label: 'At least 8 characters' },
                              { met: hasUppercase, label: 'One uppercase letter' },
                              { met: hasNumber, label: 'One number' },
                            ].map((req) => (
                              <div key={req.label} className="flex items-center gap-2">
                                <CheckCircle2
                                  className={`h-3.5 w-3.5 transition-colors ${req.met ? 'text-emerald-400' : 'text-zinc-700'}`}
                                />
                                <span className={`text-xs transition-colors ${req.met ? 'text-zinc-300' : 'text-zinc-600'}`}>
                                  {req.label}
                                </span>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] uppercase tracking-[0.2em] text-zinc-500 font-medium mb-2">
                          Confirm Password
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                            placeholder="••••••••"
                            className="w-full rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder:text-zinc-600 outline-none transition-all duration-200 focus:ring-1 focus:ring-[#8B5CF6]/50"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {confirmPassword.length > 0 && (
                          <div className="flex items-center gap-2 mt-2">
                            <CheckCircle2
                              className={`h-3.5 w-3.5 transition-colors ${passwordsMatch ? 'text-emerald-400' : 'text-zinc-700'}`}
                            />
                            <span className={`text-xs transition-colors ${passwordsMatch ? 'text-zinc-300' : 'text-zinc-600'}`}>
                              Passwords match
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Submit */}
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                        style={{
                          background: `linear-gradient(135deg, ${PULSECHECK_PURPLE}, ${PULSECHECK_PURPLE_DEEP})`,
                          boxShadow: '0 4px 20px rgba(139,92,246,0.28)',
                        }}
                      >
                        {isLoading && !activeProvider ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            Create Account
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    </form>

                    {/* Switch to sign in */}
                    <p className="mt-6 text-center text-sm text-zinc-500">
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => { setView('login'); setError(null); setPassword(''); setConfirmPassword(''); }}
                        className="text-[#8B5CF6] hover:text-[#A78BFA] font-semibold transition-colors"
                      >
                        Sign in
                      </button>
                    </p>
                  </motion.div>
                )}

                {/* ═══ FORGOT PASSWORD VIEW ═══ */}
                {view === 'forgot' && (
                  <motion.div
                    key="forgot"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                  >
                    <button
                      type="button"
                      onClick={() => { setView('login'); setError(null); setResetSent(false); }}
                      className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-5"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back to sign in
                    </button>

                    <h2 className="text-xl font-bold text-white mb-1">Reset password</h2>
                    <p className="text-sm text-zinc-400 mb-6">
                      Enter your email and we'll send you a reset link.
                    </p>

                    {resetSent ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-xl p-5 text-center"
                        style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}
                      >
                        <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-white mb-1">Check your email</p>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          We've sent a password reset link to <span className="text-zinc-200 font-medium">{email}</span>.
                          Check your inbox and follow the instructions.
                        </p>
                      </motion.div>
                    ) : (
                      <form onSubmit={handleForgotPassword} className="space-y-4">
                        <div>
                          <label className="block text-[11px] uppercase tracking-[0.2em] text-zinc-500 font-medium mb-2">
                            Email
                          </label>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setError(null); }}
                            placeholder="you@program.edu"
                            className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition-all duration-200 focus:ring-1 focus:ring-[#3B82F6]/50"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                            autoComplete="email"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isLoading}
                          className="w-full rounded-xl py-3.5 text-sm font-semibold transition-all duration-200 hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                          style={{
                            background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
                            color: 'white',
                            boxShadow: '0 4px 20px rgba(59,130,246,0.25)',
                          }}
                        >
                          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Reset Link'}
                        </button>
                      </form>
                    )}
                  </motion.div>
                )}
              </div>
            </GlassSurface>
          </motion.div>

          {/* Footer note */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 text-center text-[11px] text-zinc-600 leading-relaxed"
          >
            Review Pulse&apos;s{' '}
            <a href="/terms" className="text-zinc-500 hover:text-zinc-400 underline underline-offset-2">Terms</a>{' '}
            and{' '}
            <a href="/privacy" className="text-zinc-500 hover:text-zinc-400 underline underline-offset-2">Privacy Policy</a>.
          </motion.p>
        </div>
      </div>
    </>
  );
};

export default PulseCheckLoginPage;
