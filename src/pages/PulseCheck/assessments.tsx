import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { NextPage } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { type User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { ArrowRight, CheckCircle2, ClipboardCheck, Library, Mail, RefreshCw, Shield } from 'lucide-react';
import PageHead from '../../components/PageHead';
import { auth, db } from '../../api/firebase/config';
import authMethods from '../../api/firebase/auth';

type AssessmentId = 'parent' | 'coach' | 'athleticTrainer';

type AssessmentPurchase = {
  id: string;
  assessmentId?: AssessmentId;
  assessmentProductName?: string;
  amountCents?: number;
  currency?: string;
  status?: string;
  paidAt?: { seconds?: number } | Date | null;
  coachEmail?: string | null;
};

const ASSESSMENT_LABELS: Record<AssessmentId, string> = {
  parent: 'Parent readiness',
  coach: 'Coach readiness',
  athleticTrainer: 'Athletic trainer readiness',
};

const MAGIC_EMAIL_KEY = 'pulse_assessment_dashboard_magic_email';

const normalizeAssessmentId = (value: unknown): AssessmentId => {
  if (value === 'coach' || value === 'athleticTrainer') return value;
  return 'parent';
};

const formatMoney = (amountCents?: number, currency = 'usd') => {
  if (typeof amountCents !== 'number') return '$49.99';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
};

const paidAtMillis = (purchase: AssessmentPurchase) => {
  const paidAt = purchase.paidAt;
  if (paidAt instanceof Date) return paidAt.getTime();
  if (paidAt && typeof paidAt === 'object' && typeof paidAt.seconds === 'number') {
    return paidAt.seconds * 1000;
  }
  return 0;
};

const PulseWordmark = () => (
  <Link href="/pulseintelligencelabs" className="flex items-center gap-3" aria-label="Pulse Intelligence Labs">
    <img src="/pulse-logo.svg" alt="Pulse" className="h-8 w-auto" />
    <span className="hidden text-sm font-semibold tracking-tight text-stone-900 sm:block">Pulse Intelligence Labs</span>
  </Link>
);

const GridBackdrop = () => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
    <div className="absolute inset-0 bg-[#FAFAF7]" />
    <div className="absolute inset-x-0 top-0 h-px bg-stone-200/80" />
  </div>
);

const PulseCheckAssessmentsPage: NextPage = () => {
  const router = useRouter();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [authError, setAuthError] = useState('');
  const [purchases, setPurchases] = useState<AssessmentPurchase[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');

  const paymentSuccess = router.query.payment === 'success';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setFirebaseUser(nextUser);
      setAuthReady(true);
      if (nextUser?.email) setEmail((current) => current || nextUser.email || '');
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedEmail = window.localStorage.getItem(MAGIC_EMAIL_KEY);
    if (storedEmail) setEmail(storedEmail);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!authMethods.isMagicLink(window.location.href)) return;

    const storedEmail = window.localStorage.getItem(MAGIC_EMAIL_KEY) || email;
    if (!storedEmail) {
      setAuthError('Enter the email address you used so we can finish sign-in.');
      return;
    }

    let cancelled = false;
    setAuthLoading(true);
    authMethods.completeMagicLink(storedEmail, window.location.href)
      .then(() => {
        if (cancelled) return;
        window.localStorage.removeItem(MAGIC_EMAIL_KEY);
        setAuthMessage('');
        setAuthError('');
        void router.replace('/PulseCheck/assessments', undefined, { shallow: true });
      })
      .catch((error) => {
        if (!cancelled) {
          setAuthError(error instanceof Error ? error.message : 'Magic link sign-in could not be completed.');
        }
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [email, router]);

  const loadPurchases = useCallback(async (userId: string) => {
    setLoadingPurchases(true);
    setPurchaseError('');
    try {
      const snapshot = await getDocs(
        query(collection(db, 'pulsecheck-assessment-purchases'), where('purchaserUserId', '==', userId))
      );
      const rows = snapshot.docs
        .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<AssessmentPurchase, 'id'>) }))
        .sort((left, right) => paidAtMillis(right) - paidAtMillis(left));
      setPurchases(rows);
    } catch (error) {
      setPurchaseError(error instanceof Error ? error.message : 'Purchased assessments could not be loaded.');
    } finally {
      setLoadingPurchases(false);
    }
  }, []);

  useEffect(() => {
    if (!firebaseUser?.uid) return;
    void loadPurchases(firebaseUser.uid);
  }, [firebaseUser?.uid, loadPurchases]);

  const signInWithGoogle = useCallback(async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      await authMethods.signInWithGoogle();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Google sign-in could not be completed.');
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const signInWithApple = useCallback(async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      await authMethods.signInWithApple();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Apple sign-in could not be completed.');
      setAuthLoading(false);
    }
  }, []);

  const sendMagicLink = useCallback(async () => {
    setAuthLoading(true);
    setAuthError('');
    setAuthMessage('');
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (typeof window !== 'undefined') window.localStorage.setItem(MAGIC_EMAIL_KEY, normalizedEmail);
      await authMethods.sendMagicLink(normalizedEmail, typeof window !== 'undefined' ? window.location.href : undefined);
      setAuthMessage('Magic link sent. Open it from this device to view your assessments.');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Magic link could not be sent.');
    } finally {
      setAuthLoading(false);
    }
  }, [email]);

  const dashboardCopy = useMemo(() => {
    if (paymentSuccess) return 'Your payment is being confirmed. Purchased assessments appear here as soon as Stripe finishes processing.';
    return 'Your purchased assessments and trainings will live here.';
  }, [paymentSuccess]);

  return (
    <>
      <PageHead
        metaData={{
          pageId: 'pulsecheck-assessments-dashboard',
          pageTitle: 'My PulseCheck Assessments',
          metaDescription: 'View and complete purchased PulseCheck readiness assessments.',
          lastUpdated: new Date().toISOString(),
        }}
        pageOgUrl="https://fitwithpulse.ai/PulseCheck/assessments"
        themeColor="#FAFAF7"
      />

      <main data-assessment-page="true" className="relative min-h-screen overflow-hidden bg-[#FAFAF7] text-stone-900">
        <GridBackdrop />

        <nav className="fixed left-0 right-0 top-0 z-50 border-b border-stone-200/80 bg-[#FAFAF7]/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3 sm:px-8">
            <PulseWordmark />
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/elite-athlete-support-readiness-assessments?assessment=parent"
                className="rounded-lg px-3 py-2 text-xs font-semibold text-stone-500 transition hover:bg-stone-200/70 hover:text-stone-900"
              >
                Parent readiness
              </Link>
              <Link
                href="/elite-athlete-support-readiness-assessments?assessment=coach"
                className="rounded-lg px-3 py-2 text-xs font-semibold text-stone-500 transition hover:bg-stone-200/70 hover:text-stone-900"
              >
                Coach readiness
              </Link>
              <Link
                href="/elite-athlete-support-readiness-assessments?assessment=athleticTrainer"
                className="rounded-lg px-3 py-2 text-xs font-semibold text-stone-500 transition hover:bg-stone-200/70 hover:text-stone-900"
              >
                Athletic trainer readiness
              </Link>
            </div>
            <Link
              href="/elite-athlete-support-readiness-assessments"
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-700"
            >
              <ClipboardCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Assessment suite</span>
            </Link>
          </div>
        </nav>

        <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-16 pt-24 sm:px-8">
          <header className="border-b border-stone-200 pb-12 pt-10">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-600">
                <Library className="h-3.5 w-3.5" />
                My library
              </div>
              <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
                My assessments
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-stone-500">{dashboardCopy}</p>
            </div>
          </header>

          <div className="grid gap-8 py-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
            <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-[0_18px_55px_rgba(68,64,60,0.06)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#4F6F59]/30 bg-[#4F6F59]/10">
                <Shield className="h-6 w-6 text-[#4F6F59]" />
              </div>
              <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">Saved access</p>
              <h2 className="mt-3 text-2xl font-semibold leading-tight text-stone-900">Assessment purchases stay with your account.</h2>
              <p className="mt-4 text-sm leading-6 text-stone-500">
                Sign in before purchase, then come back here to complete readiness assessments or view future trainings.
              </p>
            </div>

            {!authReady ? (
              <div className="rounded-lg border border-stone-200 bg-white p-6 text-stone-500 shadow-[0_18px_55px_rgba(68,64,60,0.06)]">
                Loading account...
              </div>
            ) : !firebaseUser ? (
              <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-[0_18px_55px_rgba(68,64,60,0.06)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">Claim your assessments</p>
                <h2 className="mt-3 text-2xl font-semibold text-stone-900">Sign in to view purchases</h2>
                <p className="mt-2 text-sm leading-6 text-stone-500">
                  Use the same account before purchase so your assessment is saved here.
                </p>
                <div className="mt-5 grid gap-3">
                  <button
                    onClick={signInWithGoogle}
                    disabled={authLoading}
                    className="min-h-[46px] rounded-lg border border-stone-200 bg-stone-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Continue with Google
                  </button>
                  <button
                    onClick={signInWithApple}
                    disabled={authLoading}
                    className="min-h-[46px] rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-900 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Continue with Apple
                  </button>
                </div>
                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-stone-200" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-400">or</span>
                  <div className="h-px flex-1 bg-stone-200" />
                </div>
                <div className="grid gap-3">
                  <label htmlFor="assessment-dashboard-email" className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">
                    Email magic link
                  </label>
                  <input
                    id="assessment-dashboard-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="min-h-[46px] rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-400"
                  />
                  <button
                    onClick={sendMagicLink}
                    disabled={authLoading}
                    className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-[#4F6F59] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Mail className="h-4 w-4" />
                    Send magic link
                  </button>
                </div>
                {authMessage && (
                  <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                    {authMessage}
                  </div>
                )}
                {authError && (
                  <div className="mt-4 rounded-lg border border-[#A85353]/25 bg-[#A85353]/5 px-4 py-3 text-sm font-medium text-[#A85353]">
                    {authError}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">Signed in</p>
                    <p className="mt-1 text-base font-semibold text-stone-900">{firebaseUser.email || 'Signed in'}</p>
                    <p className="mt-1 text-xs text-stone-500">Purchases sync after Stripe confirms payment.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => firebaseUser.uid && loadPurchases(firebaseUser.uid)}
                    disabled={loadingPurchases}
                    className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white/70 px-3 py-2 text-sm font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </button>
                </div>

                {purchaseError && (
                  <div className="mt-5 rounded-lg border border-[#A85353]/25 bg-[#A85353]/5 px-4 py-3 text-sm font-medium text-[#A85353]">
                    {purchaseError}
                  </div>
                )}
                {loadingPurchases ? (
                  <div className="mt-8 rounded-lg border border-stone-200 bg-white p-6 text-sm text-stone-500 shadow-[0_18px_55px_rgba(68,64,60,0.06)]">
                    Loading purchases...
                  </div>
                ) : purchases.length === 0 ? (
                  <div className="mt-6 rounded-lg border border-stone-200 bg-white p-6 shadow-[0_18px_55px_rgba(68,64,60,0.06)]">
                    <h3 className="text-xl font-semibold text-stone-900">No purchased assessments yet</h3>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-stone-500">
                      Purchase an assessment and it will appear here after payment confirmation.
                    </p>
                    <Link
                      href="/elite-athlete-support-readiness-assessments"
                      className="mt-5 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-[#4F6F59] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                    >
                      View assessments
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                ) : (
                  <div className="mt-6 grid gap-4">
                    {purchases.map((purchase) => {
                      const assessmentId = normalizeAssessmentId(purchase.assessmentId);
                      return (
                        <div key={purchase.id} className="relative overflow-hidden rounded-lg border border-stone-200 bg-white p-6 shadow-[0_18px_55px_rgba(68,64,60,0.06)]">
                          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#4F6F59] to-[#456978]" />
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <div className="inline-flex items-center gap-2 rounded-lg border border-[#4F6F59]/25 bg-[#4F6F59]/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4F6F59]">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Purchased
                              </div>
                              <h3 className="mt-4 text-2xl font-semibold leading-tight text-stone-900">
                                {purchase.assessmentProductName || ASSESSMENT_LABELS[assessmentId]}
                              </h3>
                              <p className="mt-1 text-sm text-stone-500">
                                {formatMoney(purchase.amountCents, purchase.currency)} {purchase.coachEmail ? `via ${purchase.coachEmail}` : ''}
                              </p>
                            </div>
                            <Link
                              href={`/elite-athlete-support-readiness-assessments?assessment=${assessmentId}&paid=success&start=1`}
                              className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-[#4F6F59] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                            >
                              Complete assessment
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
};

export default PulseCheckAssessmentsPage;
