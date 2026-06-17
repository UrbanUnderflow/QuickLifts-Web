import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Copy,
  Database,
  FlaskConical,
  Plus,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Trash2,
  Users,
} from 'lucide-react';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../../api/firebase/config';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { useUser } from '../../hooks/useUser';

type ExperimentParameterMap = {
  macra_paywall_default_plan: 'annual' | 'monthly';
  macra_paywall_layout_variant: 'trial_confidence_control' | 'trial_confidence' | 'hard_paywall_value';
  onboarding_experience_variant: 'standard' | 'nora_guided';
};

type ExperimentVariant = {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  weight: number;
  parameters: ExperimentParameterMap;
};

type ExperimentDocument = {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  assignmentSalt: string;
  primaryMetric: string;
  owner: string;
  variants: ExperimentVariant[];
};

type ExperimentAssignmentConfidence = 'exact' | 'inferred' | 'unknown';

type ExperimentVariantResult = {
  variantId: string;
  variantName: string;
  assignments: number;
  exactAssignments: number;
  inferredAssignments: number;
  qualifiedUsers: number;
  onboardingCompletions: number;
  paywallViews: number;
  valuePreviewViews: number;
  pricingDisclosureViews: number;
  trialConfidenceViews: number;
  planSelections: number;
  ctaTaps: number;
  checkoutStarts: number;
  purchaseBridgeViews: number;
  purchaseBridgeContinues: number;
  appleCancels: number;
  cancelFeedbackPresented: number;
  cancelFeedbackSubmitted: number;
  trialActivationScreens: number;
  trialActivationPrimaryActions: number;
  trialStarts: number;
  paidConversions: number;
  trialRate: number;
  paidRate: number;
  liftVsBaseline: number | null;
};

type ExperimentResultsSnapshot = {
  id: string;
  experimentId: string;
  generatedAt: any;
  generatedBy?: string;
  assignmentSalt: string;
  loadedUsers: number;
  assignedUsers: number;
  exactAssignments: number;
  inferredAssignments: number;
  unknownAssignments: number;
  qualityLabel: string;
  variants: ExperimentVariantResult[];
  unknownSamples: Array<{ userId: string; email: string; reason: string }>;
  aggregateValidation?: {
    appsFlyerTrialStarts: number;
    appsFlyerEvents: number;
    fineGrainedEvents?: Record<string, number>;
    note: string;
  };
  dataInputs?: {
    onboardingUsers: number;
    profiles: number;
    purchaseLogs: number;
    appsFlyerUserDocs: number;
    appsFlyerAggregateEvents: number;
  };
  configSnapshot: ExperimentDocument;
};

type AppsFlyerAttributionDoc = Record<string, any> & {
  id: string;
  customerUserId?: string | null;
};

type MacraPurchaseLog = Record<string, any> & {
  id: string;
  userId?: string;
  uid?: string;
  authUid?: string;
  appUserId?: string;
  email?: string;
  toEmail?: string;
  recipientEmail?: string;
  to?: string;
  status?: string;
  purchaseStatus?: string;
  plan?: Record<string, any> | string;
  metadata?: Record<string, any>;
  cancelFeedbackMetadata?: Record<string, any>;
};

const EXPERIMENT_COLLECTION = 'macra-experiments';
const EXPERIMENT_ID = 'macra_paywall_onboarding';
const EXPERIMENT_RESULTS_COLLECTION = 'macra-experiment-results';
const EXPERIMENT_BACKFILL_USER_LIMIT = 1000;
const EXPERIMENT_BACKFILL_LOG_LIMIT = 1000;
const EXPERIMENT_BACKFILL_PROFILE_CHUNK_SIZE = 40;
const EXPERIMENT_BACKFILL_ATTRIBUTION_CHUNK_SIZE = 30;
const MACRA_APPSFLYER_TRIAL_EVENT_NAMES = ['af_start_trial', 'start_trial', 'trial_started', 'macra_trial_started'];
const MACRA_APPSFLYER_PURCHASE_EVENT_NAMES = ['af_subscribe', 'af_purchase', 'subscribe', 'purchase', 'macra_subscription_started'];
const MACRA_APPSFLYER_EXPERIMENT_ASSIGNMENT_EVENT_NAMES = ['macra_experiment_assignment'];
const MACRA_APPSFLYER_VALUE_PREVIEW_EVENT_NAMES = ['macra_paywall_value_preview_viewed'];
const MACRA_APPSFLYER_PRICING_DISCLOSURE_EVENT_NAMES = ['macra_paywall_pricing_disclosure_viewed'];
const MACRA_APPSFLYER_TRIAL_CONFIDENCE_EVENT_NAMES = ['macra_paywall_trial_confidence_viewed'];
const MACRA_APPSFLYER_PLAN_SELECTED_EVENT_NAMES = ['macra_subscription_plan_selected'];
const MACRA_APPSFLYER_CHECKOUT_STARTED_EVENT_NAMES = ['af_initiated_checkout', 'macra_subscription_web_checkout_started'];
const MACRA_APPSFLYER_PURCHASE_BRIDGE_VIEWED_EVENT_NAMES = ['macra_paywall_purchase_bridge_viewed'];
const MACRA_APPSFLYER_PURCHASE_BRIDGE_CONTINUED_EVENT_NAMES = ['macra_paywall_purchase_bridge_continued'];
const MACRA_APPSFLYER_APPLE_CANCEL_EVENT_NAMES = ['macra_subscription_purchase_cancelled'];
const MACRA_APPSFLYER_CANCEL_FEEDBACK_PRESENTED_EVENT_NAMES = ['macra_paywall_cancel_feedback_presented'];
const MACRA_APPSFLYER_CANCEL_FEEDBACK_SUBMITTED_EVENT_NAMES = ['macra_paywall_cancel_feedback_submitted'];
const MACRA_APPSFLYER_TRIAL_ACTIVATION_SCREEN_EVENT_NAMES = ['macra_trial_activation_screen_viewed'];
const MACRA_APPSFLYER_TRIAL_ACTIVATION_PRIMARY_EVENT_NAMES = ['macra_trial_activation_primary_pressed'];

const MACRA_EXPERIMENT_EVENT_BREAKDOWN = [
  { key: 'experimentAssignments', label: 'Experiment assignment', eventNames: MACRA_APPSFLYER_EXPERIMENT_ASSIGNMENT_EVENT_NAMES },
  { key: 'valuePreviewViews', label: 'Value preview', eventNames: MACRA_APPSFLYER_VALUE_PREVIEW_EVENT_NAMES },
  { key: 'pricingDisclosureViews', label: 'Pricing disclosure', eventNames: MACRA_APPSFLYER_PRICING_DISCLOSURE_EVENT_NAMES },
  { key: 'trialConfidenceViews', label: 'Trial confidence', eventNames: MACRA_APPSFLYER_TRIAL_CONFIDENCE_EVENT_NAMES },
  { key: 'planSelections', label: 'Plan selected', eventNames: MACRA_APPSFLYER_PLAN_SELECTED_EVENT_NAMES },
  { key: 'purchaseBridgeViews', label: 'Apple bridge viewed', eventNames: MACRA_APPSFLYER_PURCHASE_BRIDGE_VIEWED_EVENT_NAMES },
  { key: 'purchaseBridgeContinues', label: 'Apple bridge continued', eventNames: MACRA_APPSFLYER_PURCHASE_BRIDGE_CONTINUED_EVENT_NAMES },
  { key: 'checkoutStarts', label: 'Checkout started', eventNames: MACRA_APPSFLYER_CHECKOUT_STARTED_EVENT_NAMES },
  { key: 'appleCancels', label: 'Apple cancels', eventNames: MACRA_APPSFLYER_APPLE_CANCEL_EVENT_NAMES },
  { key: 'cancelFeedbackPresented', label: 'Cancel feedback shown', eventNames: MACRA_APPSFLYER_CANCEL_FEEDBACK_PRESENTED_EVENT_NAMES },
  { key: 'cancelFeedbackSubmitted', label: 'Cancel feedback submitted', eventNames: MACRA_APPSFLYER_CANCEL_FEEDBACK_SUBMITTED_EVENT_NAMES },
  { key: 'trialActivationScreens', label: 'Activation screen', eventNames: MACRA_APPSFLYER_TRIAL_ACTIVATION_SCREEN_EVENT_NAMES },
  { key: 'trialActivationPrimaryActions', label: 'Activation primary', eventNames: MACRA_APPSFLYER_TRIAL_ACTIVATION_PRIMARY_EVENT_NAMES },
  { key: 'trialStarts', label: 'Trial starts', eventNames: MACRA_APPSFLYER_TRIAL_EVENT_NAMES },
  { key: 'paidConversions', label: 'Paid conversion', eventNames: MACRA_APPSFLYER_PURCHASE_EVENT_NAMES },
] as const;

const DEFAULT_EXPERIMENT: ExperimentDocument = {
  id: EXPERIMENT_ID,
  name: 'Macra Paywall + Onboarding',
  description: 'Controls Macra onboarding and paywall treatments from Firestore-backed experiment config.',
  isEnabled: true,
  assignmentSalt: 'macra-paywall-onboarding-2026-05',
  primaryMetric: 'paid_conversion',
  owner: 'Macra',
  variants: [
    {
      id: 'baseline',
      name: 'Baseline (long paywall)',
      description: 'Retired control 2026-06-16. Long paywall with standard onboarding.',
      isEnabled: false,
      weight: 0,
      parameters: {
        macra_paywall_default_plan: 'annual',
        macra_paywall_layout_variant: 'trial_confidence_control',
        onboarding_experience_variant: 'standard',
      },
    },
    {
      id: 'variant_a',
      name: 'Monthly + annual, both with trial',
      description: 'Active flow 2026-06-16. Compact trial-prep + plan selection showing BOTH monthly and annual, each with the 3-day free trial (monthly trial added in ASC 2026-06-15).',
      isEnabled: true,
      weight: 100,
      parameters: {
        macra_paywall_default_plan: 'annual',
        macra_paywall_layout_variant: 'trial_confidence',
        onboarding_experience_variant: 'standard',
      },
    },
    {
      id: 'variant_b',
      name: 'Nora guided onboarding',
      description: 'Adds the early intent question, Nora prompt bubbles, simpler reminder copy, and compact paywall.',
      isEnabled: false,
      weight: 0,
      parameters: {
        macra_paywall_default_plan: 'annual',
        macra_paywall_layout_variant: 'trial_confidence',
        onboarding_experience_variant: 'nora_guided',
      },
    },
    {
      id: 'variant_c',
      name: 'Hard paywall monthly',
      description: 'Retired 2026-06-16 — monthly-only, no trial. Converted ~1% with ~95% Apple-sheet cancels.',
      isEnabled: false,
      weight: 0,
      parameters: {
        macra_paywall_default_plan: 'monthly',
        macra_paywall_layout_variant: 'hard_paywall_value',
        onboarding_experience_variant: 'nora_guided',
      },
    },
  ],
};

const normalizeVariant = (variant: Partial<ExperimentVariant>, index: number): ExperimentVariant => ({
  id: variant.id || `variant_${index + 1}`,
  name: variant.name || `Variant ${index + 1}`,
  description: variant.description || '',
  isEnabled: variant.isEnabled ?? true,
  weight: Number(variant.weight ?? 0),
  parameters: {
    macra_paywall_default_plan: variant.parameters?.macra_paywall_default_plan || 'annual',
    macra_paywall_layout_variant: variant.parameters?.macra_paywall_layout_variant || 'trial_confidence',
    onboarding_experience_variant: variant.parameters?.onboarding_experience_variant || 'standard',
  },
});

const normalizeExperiment = (data: Partial<ExperimentDocument> | null): ExperimentDocument => {
  if (!data) return DEFAULT_EXPERIMENT;
  return {
    ...DEFAULT_EXPERIMENT,
    ...data,
    variants: Array.isArray(data.variants) && data.variants.length > 0
      ? data.variants.map(normalizeVariant)
      : DEFAULT_EXPERIMENT.variants,
  };
};

const promotionSaltForVariant = (variantId: string) => {
  const safeVariantId = variantId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'variant';

  return `${EXPERIMENT_ID}-rollout-${safeVariantId}-${Date.now()}`;
};

const normalizeString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const getNestedValue = (source: Record<string, any> | null | undefined, path: string): any => {
  if (!source || !path) return undefined;
  return path.split('.').reduce<any>((acc, part) => (acc === null || acc === undefined ? undefined : acc[part]), source);
};

const scoreNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const scoreMillis = (value: unknown): number | null => {
  if (!value) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    return value < 10000000000 ? value * 1000 : value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value instanceof Date) {
    const millis = value.getTime();
    return Number.isFinite(millis) ? millis : null;
  }
  if (typeof (value as any)?.toMillis === 'function') {
    const millis = (value as any).toMillis();
    return Number.isFinite(millis) ? millis : null;
  }
  if (typeof (value as any)?.toDate === 'function') {
    const millis = (value as any).toDate().getTime();
    return Number.isFinite(millis) ? millis : null;
  }
  if (typeof (value as any)?.seconds === 'number') {
    const millis = (value as any).seconds * 1000 + Math.round(((value as any).nanoseconds || 0) / 1000000);
    return Number.isFinite(millis) ? millis : null;
  }
  return null;
};

const maxScoreMillis = (...values: unknown[]): number | null => {
  const millis = values
    .map(scoreMillis)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return millis.length ? Math.max(...millis) : null;
};

const formatPercent = (value: number, denominator: number): string =>
  denominator > 0 ? `${Math.round((value / denominator) * 100)}%` : '0%';

const formatSignedPercent = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) return 'Baseline';
  const rounded = Math.round(value * 100);
  return `${rounded >= 0 ? '+' : ''}${rounded}%`;
};

const formatAdminDate = (value: unknown): string => {
  const millis = scoreMillis(value);
  if (!millis) return 'Not generated yet';
  return new Date(millis).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatIsoTimestamp = (value: unknown): string | null => {
  const millis = scoreMillis(value);
  return millis ? new Date(millis).toISOString() : null;
};

const getFirstString = (sources: Array<Record<string, any> | null | undefined>, paths: string[]): string => {
  for (const source of sources) {
    for (const path of paths) {
      const value = path.includes('.') ? getNestedValue(source, path) : source?.[path];
      const normalized = normalizeString(value);
      if (normalized) return normalized;
    }
  }
  return '';
};

const getFirstNumber = (sources: Array<Record<string, any> | null | undefined>, paths: string[]): number | null => {
  for (const source of sources) {
    for (const path of paths) {
      const value = path.includes('.') ? getNestedValue(source, path) : source?.[path];
      const parsed = scoreNumber(value);
      if (parsed !== null) return parsed;
    }
  }
  return null;
};

const inferAgeYears = (data: Record<string, any>, profile: Record<string, any> | null, purchaseLogs: MacraPurchaseLog[] = []): number | null => {
  const directAge = getFirstNumber([profile, data], [
    'ageYears',
    'age',
    'macraAgeYears',
    'macraProfile.ageYears',
    'macraProfile.age',
  ]);
  if (directAge !== null && directAge >= 0 && directAge < 120) return Math.floor(directAge);

  for (const log of purchaseLogs) {
    const metadataAge = getFirstNumber([log], ['metadata.age_years', 'cancelFeedbackMetadata.age_years']);
    if (metadataAge !== null && metadataAge >= 0 && metadataAge < 120) return Math.floor(metadataAge);
  }

  const birthdateMs = maxScoreMillis(
    getNestedValue(profile, 'birthdate'),
    getNestedValue(profile, 'dateOfBirth'),
    data.birthdate,
    data.dateOfBirth,
    getNestedValue(data, 'macraProfile.birthdate'),
    getNestedValue(data, 'macraProfile.dateOfBirth')
  );
  if (!birthdateMs) return null;

  const ageYears = Math.floor((Date.now() - birthdateMs) / (365.25 * 24 * 60 * 60 * 1000));
  return ageYears >= 0 && ageYears < 120 ? ageYears : null;
};

const purchaseLogMillis = (log: Record<string, any>): number | null =>
  maxScoreMillis(log.updatedAtEpoch, log.createdAtEpoch, log.updatedAt, log.createdAt, log.sentAt, log.lastEventAt);

const normalizePurchaseStatus = (value: unknown): string => normalizeString(value).toLowerCase();

const purchaseStatusIsSuccess = (status: string): boolean =>
  ['success', 'succeeded', 'paid', 'active', 'trial_started', 'trialing'].includes(status);

const purchaseStatusIsCanceled = (status: string): boolean =>
  ['canceled', 'cancelled', 'user_cancelled', 'abandoned'].includes(status);

const matchesUserOrEmail = (row: Record<string, any>, userId: string, email: string): boolean => {
  const rowUserId = normalizeString(row.userId || row.uid || row.authUid || row.appUserId);
  if (rowUserId && rowUserId === userId) return true;

  const rowEmail = normalizeString(row.email || row.toEmail || row.recipientEmail || row.to);
  return Boolean(email && rowEmail && rowEmail.toLowerCase() === email.toLowerCase());
};

const appsFlyerEventCount = (appsFlyer: Record<string, any> | null | undefined, eventNames: string[]): number =>
  eventNames.reduce((total, eventName) => total + (scoreNumber(getNestedValue(appsFlyer, `eventCounts.${eventName}`)) || 0), 0);

const appsFlyerLatestEventAt = (appsFlyer: Record<string, any> | null | undefined, eventNames: string[]): number | null =>
  maxScoreMillis(...eventNames.map((eventName) => getNestedValue(appsFlyer, `eventLatestAt.${eventName}`)));

const appsFlyerSummaryEventCount = (appsFlyerSummary: Record<string, any> | null | undefined, eventNames: string[]): number =>
  eventNames.reduce((total, eventName) => total + Number(getNestedValue(appsFlyerSummary, `events.byName.${eventName}`) || 0), 0);

const deterministicHashPercent = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 10000 / 10000;
};

const inferWeightedVariant = (experiment: ExperimentDocument, userId: string): ExperimentVariant | null => {
  const enabledVariants = experiment.variants.filter((variant) => variant.isEnabled && Number(variant.weight || 0) > 0);
  const totalWeight = enabledVariants.reduce((total, variant) => total + Number(variant.weight || 0), 0);
  if (!enabledVariants.length || totalWeight <= 0) return null;

  const bucket = deterministicHashPercent(`${experiment.assignmentSalt}:${userId}`) * totalWeight;
  let cursor = 0;
  return enabledVariants.find((variant) => {
    cursor += Number(variant.weight || 0);
    return bucket < cursor;
  }) || enabledVariants[enabledVariants.length - 1];
};

const resolveExperimentAssignment = (experiment: ExperimentDocument, userId: string, data: Record<string, any>): {
  variant: ExperimentVariant | null;
  confidence: ExperimentAssignmentConfidence;
  reason: string;
} => {
  const explicitVariantId = getFirstString([data], [
    `macraExperiments.${EXPERIMENT_ID}.variantId`,
    `experiments.${EXPERIMENT_ID}.variantId`,
    `experimentAssignments.${EXPERIMENT_ID}.variantId`,
    `macraExperimentAssignments.${EXPERIMENT_ID}.variantId`,
    'macraExperiment.variantId',
    'macraExperimentVariantId',
    'experimentVariantId',
  ]);
  if (explicitVariantId) {
    const exactVariant = experiment.variants.find((variant) => variant.id === explicitVariantId);
    if (exactVariant) return { variant: exactVariant, confidence: 'exact', reason: 'Saved variant ID' };
  }

  const paywallLayout = getFirstString([data], [
    `macraExperiments.${EXPERIMENT_ID}.parameters.macra_paywall_layout_variant`,
    'macra_paywall_layout_variant',
    'macraPaywallLayoutVariant',
    'macraExperimentParameters.macra_paywall_layout_variant',
  ]);
  const onboardingVariant = getFirstString([data], [
    `macraExperiments.${EXPERIMENT_ID}.parameters.onboarding_experience_variant`,
    'onboarding_experience_variant',
    'macraOnboardingExperienceVariant',
    'macraExperimentParameters.onboarding_experience_variant',
  ]);
  if (paywallLayout || onboardingVariant) {
    const parameterMatches = experiment.variants.filter((variant) =>
      (!paywallLayout || variant.parameters.macra_paywall_layout_variant === paywallLayout) &&
      (!onboardingVariant || variant.parameters.onboarding_experience_variant === onboardingVariant)
    );
    if (parameterMatches.length === 1) {
      return { variant: parameterMatches[0], confidence: 'exact', reason: 'Saved treatment parameters' };
    }
  }

  const inferredVariant = inferWeightedVariant(experiment, userId);
  return inferredVariant
    ? { variant: inferredVariant, confidence: 'inferred', reason: 'Backfilled from assignment salt and user ID' }
    : { variant: null, confidence: 'unknown', reason: 'No saved assignment and no enabled rollout weight' };
};

const createEmptyVariantResult = (variant: ExperimentVariant): ExperimentVariantResult => ({
  variantId: variant.id,
  variantName: variant.name,
  assignments: 0,
  exactAssignments: 0,
  inferredAssignments: 0,
  qualifiedUsers: 0,
  onboardingCompletions: 0,
  paywallViews: 0,
  valuePreviewViews: 0,
  pricingDisclosureViews: 0,
  trialConfidenceViews: 0,
  planSelections: 0,
  ctaTaps: 0,
  checkoutStarts: 0,
  purchaseBridgeViews: 0,
  purchaseBridgeContinues: 0,
  appleCancels: 0,
  cancelFeedbackPresented: 0,
  cancelFeedbackSubmitted: 0,
  trialActivationScreens: 0,
  trialActivationPrimaryActions: 0,
  trialStarts: 0,
  paidConversions: 0,
  trialRate: 0,
  paidRate: 0,
  liftVsBaseline: null,
});

const ExperimentsPage: React.FC = () => {
  const user = useUser();
  const [experiment, setExperiment] = useState<ExperimentDocument>(DEFAULT_EXPERIMENT);
  const [activeTab, setActiveTab] = useState<'setup' | 'results'>('setup');
  const [results, setResults] = useState<ExperimentResultsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [rcBackfill, setRcBackfill] = useState<{ loading: boolean; result: string | null; error: string | null }>({
    loading: false,
    result: null,
    error: null,
  });

  // Admin-gated backfill of `registrationComplete` for existing Macra users.
  // Goes through the Admin SDK (server) because users/{uid} rules are
  // owner-only — the client SDK can't write other users' docs.
  const runRegistrationBackfill = async (commit: boolean) => {
    setRcBackfill({ loading: true, result: null, error: null });
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not signed in');
      const res = await fetch('/.netlify/functions/backfill-macra-registration-complete', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${idToken}`,
          ...(auth.currentUser?.email ? { 'x-admin-email': auth.currentUser.email } : {}),
        },
        body: JSON.stringify({ commit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      const summary = data.dryRun
        ? `Dry run: ${data.eligible} of ${data.scanned} Macra users would be updated.`
        : `Updated ${data.updated} of ${data.scanned} Macra users (registrationComplete = true).`;
      setRcBackfill({ loading: false, result: summary, error: null });
    } catch (e) {
      setRcBackfill({ loading: false, result: null, error: e instanceof Error ? e.message : String(e) });
    }
  };

  const enabledWeight = useMemo(
    () => experiment.variants
      .filter(variant => variant.isEnabled)
      .reduce((total, variant) => total + Number(variant.weight || 0), 0),
    [experiment.variants]
  );

  const loadExperiment = async () => {
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const [experimentSnapshot, resultsSnapshot] = await Promise.all([
        getDoc(doc(db, EXPERIMENT_COLLECTION, EXPERIMENT_ID)),
        getDoc(doc(db, EXPERIMENT_RESULTS_COLLECTION, EXPERIMENT_ID)),
      ]);
      setExperiment(normalizeExperiment(experimentSnapshot.exists() ? experimentSnapshot.data() as Partial<ExperimentDocument> : null));
      setResults(resultsSnapshot.exists() ? resultsSnapshot.data() as ExperimentResultsSnapshot : null);
      if (!experimentSnapshot.exists()) {
        setMessage('Loaded default experiment. Save once to publish it to Firestore.');
      }
    } catch (loadError) {
      console.error('Failed to load experiment', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load experiment.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExperiment();
  }, []);

  const updateExperimentField = <K extends keyof ExperimentDocument>(key: K, value: ExperimentDocument[K]) => {
    setExperiment(current => ({ ...current, [key]: value }));
  };

  const updateVariant = (variantId: string, updates: Partial<ExperimentVariant>) => {
    setExperiment(current => ({
      ...current,
      variants: current.variants.map(variant => (
        variant.id === variantId ? { ...variant, ...updates } : variant
      )),
    }));
  };

  const updateVariantParameter = <K extends keyof ExperimentParameterMap>(
    variantId: string,
    key: K,
    value: ExperimentParameterMap[K]
  ) => {
    setExperiment(current => ({
      ...current,
      variants: current.variants.map(variant => (
        variant.id === variantId
          ? { ...variant, parameters: { ...variant.parameters, [key]: value } }
          : variant
      )),
    }));
  };

  const addVariant = () => {
    setExperiment(current => {
      const nextIndex = current.variants.length + 1;
      return {
        ...current,
        variants: [
          ...current.variants,
          {
            id: `variant_${nextIndex}`,
            name: `Variant ${nextIndex}`,
            description: 'New treatment. Configure parameters before enabling.',
            isEnabled: false,
            weight: 0,
            parameters: {
              macra_paywall_default_plan: 'annual',
              macra_paywall_layout_variant: 'trial_confidence',
              onboarding_experience_variant: 'standard',
            },
          },
        ],
      };
    });
  };

  const removeVariant = (variantId: string) => {
    setExperiment(current => ({
      ...current,
      variants: current.variants.filter(variant => variant.id !== variantId),
    }));
  };

  const promoteVariantToFullRollout = async (variantId: string) => {
    if (saving) return;

    const promotedVariant = experiment.variants.find(variant => variant.id === variantId);
    if (!promotedVariant) {
      setError('Variant could not be found.');
      return;
    }

    const confirmed = window.confirm(
      `Promote "${promotedVariant.name}" to 100%? This will publish it as the only active variant and create a new assignment salt.`
    );
    if (!confirmed) return;

    const promotedExperiment: ExperimentDocument = {
      ...experiment,
      isEnabled: true,
      assignmentSalt: promotionSaltForVariant(variantId),
      variants: experiment.variants.map(variant => (
        variant.id === variantId
          ? { ...variant, isEnabled: true, weight: 100 }
          : { ...variant, isEnabled: false, weight: 0 }
      )),
    };

    setSaving(true);
    setMessage('');
    setError('');

    try {
      const payload = {
        ...promotedExperiment,
        id: EXPERIMENT_ID,
        rolloutPromotedAt: serverTimestamp(),
        rolloutPromotedBy: user?.email || 'unknown',
        rolloutPromotedVariantId: promotedVariant.id,
        rolloutPromotedVariantName: promotedVariant.name,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || 'unknown',
      };

      await setDoc(doc(db, EXPERIMENT_COLLECTION, EXPERIMENT_ID), payload, { merge: true });
      setExperiment(promotedExperiment);
      setMessage(`${promotedVariant.name} is now published at 100%. New app sessions will read this rollout config.`);
    } catch (promoteError) {
      console.error('Failed to promote experiment variant', promoteError);
      setError(promoteError instanceof Error ? promoteError.message : 'Failed to promote variant.');
    } finally {
      setSaving(false);
    }
  };

  const saveExperiment = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const payload = {
        ...experiment,
        id: EXPERIMENT_ID,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || 'unknown',
      };
      await setDoc(doc(db, EXPERIMENT_COLLECTION, EXPERIMENT_ID), payload, { merge: true });
      setMessage('Experiment saved. New app sessions will read this assignment config.');
    } catch (saveError) {
      console.error('Failed to save experiment', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Failed to save experiment.');
    } finally {
      setSaving(false);
    }
  };

  const backfillResults = async () => {
    setBackfilling(true);
    setMessage('');
    setError('');

    try {
      const [usersSnapshot, purchaseLogsSnapshot, appsFlyerSummarySnapshot] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('hasCompletedMacraOnboarding', '==', true), limit(EXPERIMENT_BACKFILL_USER_LIMIT))),
        getDocs(query(collection(db, 'Macra-purchase-logs'), orderBy('createdAt', 'desc'), limit(EXPERIMENT_BACKFILL_LOG_LIMIT))).catch((purchaseLogError) => {
          console.warn('[Experiments] Failed to load purchase logs for result backfill', purchaseLogError);
          return null;
        }),
        getDoc(doc(db, 'appsflyer-scoreboards', 'macra')).catch(() => null),
      ]);

      const userDocs = usersSnapshot.docs.map((snapshot) => ({
        id: snapshot.id,
        data: (snapshot.data() || {}) as Record<string, any>,
      }));
      const purchaseLogs: MacraPurchaseLog[] = purchaseLogsSnapshot?.docs.map((snapshot) => ({
        id: snapshot.id,
        ...((snapshot.data() || {}) as Record<string, any>),
      })) || [];
      const appsFlyerSummary = appsFlyerSummarySnapshot?.exists()
        ? ((appsFlyerSummarySnapshot.data() || {}) as Record<string, any>)
        : null;

      const profileEntries: Array<[string, Record<string, any> | null]> = [];
      for (let index = 0; index < userDocs.length; index += EXPERIMENT_BACKFILL_PROFILE_CHUNK_SIZE) {
        const chunk = userDocs.slice(index, index + EXPERIMENT_BACKFILL_PROFILE_CHUNK_SIZE);
        const resolved = await Promise.all(
          chunk.map(async (row) => {
            try {
              const profileSnapshot = await getDoc(doc(db, 'users', row.id, 'macra', 'profile'));
              return [row.id, profileSnapshot.exists() ? ((profileSnapshot.data() || {}) as Record<string, any>) : null] as [string, Record<string, any> | null];
            } catch (profileError) {
              console.warn('[Experiments] Failed to load Macra profile for result backfill', row.id, profileError);
              return [row.id, null] as [string, Record<string, any> | null];
            }
          })
        );
        profileEntries.push(...resolved);
      }
      const profileByUserId = Object.fromEntries(profileEntries) as Record<string, Record<string, any> | null>;

      const appsFlyerByUserId: Record<string, Record<string, any> | null> = {};
      userDocs.forEach((row) => {
        appsFlyerByUserId[row.id] = null;
      });
      for (let index = 0; index < userDocs.length; index += EXPERIMENT_BACKFILL_ATTRIBUTION_CHUNK_SIZE) {
        const chunk = userDocs.slice(index, index + EXPERIMENT_BACKFILL_ATTRIBUTION_CHUNK_SIZE);
        const userIds = chunk.map((row) => row.id).filter(Boolean);
        if (!userIds.length) continue;
        try {
          const attributionSnapshot = await getDocs(
            query(collection(db, 'appsflyer-macra-users'), where('customerUserId', 'in', userIds))
          );
          attributionSnapshot.docs.forEach((snapshot) => {
            const data: AppsFlyerAttributionDoc = { id: snapshot.id, ...((snapshot.data() || {}) as Record<string, any>) };
            const customerUserId = normalizeString(data.customerUserId);
            if (customerUserId) appsFlyerByUserId[customerUserId] = data;
          });
        } catch (attributionError) {
          console.warn('[Experiments] Failed to load AppsFlyer attribution chunk for result backfill', attributionError);
        }

        await Promise.all(
          chunk
            .filter((row) => !appsFlyerByUserId[row.id])
            .map(async (row) => {
              try {
                const directSnapshot = await getDoc(doc(db, 'appsflyer-macra-users', row.id));
                if (directSnapshot.exists()) {
                  appsFlyerByUserId[row.id] = { id: directSnapshot.id, ...((directSnapshot.data() || {}) as Record<string, any>) };
                }
              } catch (attributionError) {
                console.warn('[Experiments] Failed to load direct AppsFlyer attribution doc for result backfill', row.id, attributionError);
              }
            })
        );
      }

      const resultByVariantId = new Map<string, ExperimentVariantResult>();
      experiment.variants.forEach((variant) => {
        resultByVariantId.set(variant.id, createEmptyVariantResult(variant));
      });
      const unknownSamples: ExperimentResultsSnapshot['unknownSamples'] = [];
      let exactAssignments = 0;
      let inferredAssignments = 0;
      let unknownAssignments = 0;

      userDocs.forEach((row) => {
        const data = row.data;
        const profile = profileByUserId[row.id] || null;
        const email = normalizeString(data.email);
        const userPurchaseLogs = purchaseLogs.filter((log) => matchesUserOrEmail(log, row.id, email));
        const appsFlyer = appsFlyerByUserId[row.id] || null;
        const assignment = resolveExperimentAssignment(experiment, row.id, data);

        if (!assignment.variant) {
          unknownAssignments += 1;
          if (unknownSamples.length < 10) {
            unknownSamples.push({ userId: row.id, email, reason: assignment.reason });
          }
          return;
        }

        const variantResult = resultByVariantId.get(assignment.variant.id);
        if (!variantResult) return;

        const statuses = userPurchaseLogs.map((log) => ({
          log,
          status: normalizePurchaseStatus(log.purchaseStatus || log.status),
          millis: purchaseLogMillis(log),
        }));
        const latestAttemptedAt = maxScoreMillis(
          ...statuses
            .filter((statusRow) => ['attempted', 'started', 'initiated'].includes(statusRow.status))
            .map((statusRow) => statusRow.millis)
        );
        const latestCanceledAt = maxScoreMillis(
          ...statuses.filter((statusRow) => purchaseStatusIsCanceled(statusRow.status)).map((statusRow) => statusRow.millis)
        );
        const latestSucceededAt = maxScoreMillis(
          ...statuses.filter((statusRow) => purchaseStatusIsSuccess(statusRow.status)).map((statusRow) => statusRow.millis)
        );
        const latestTrialSucceededAt = maxScoreMillis(
          ...statuses
            .filter((statusRow) => purchaseStatusIsSuccess(statusRow.status) && (scoreNumber(getNestedValue(statusRow.log, 'plan.trialDays')) || statusRow.status.includes('trial')))
            .map((statusRow) => statusRow.millis)
        );

        const profileSources = [profile, data.macraProfile, getNestedValue(data, 'macra.profile'), data];
        const ageYears = inferAgeYears(data, profile, userPurchaseLogs);
        const currentWeightKg = getFirstNumber(profileSources, ['currentWeightKg']);
        const goalWeightKg = getFirstNumber(profileSources, ['goalWeightKg']);
        const goalDirection = getFirstString(profileSources, ['goalDirection']);
        const pace = getFirstString(profileSources, ['pace']);
        const activityLevel = getFirstString(profileSources, ['activityLevel']);
        const biggestStruggle = getFirstString(profileSources, ['biggestStruggle']);
        const currentWeightRealistic = currentWeightKg !== null && currentWeightKg >= 35 && currentWeightKg <= 250;
        const goalWeightRealistic = goalWeightKg !== null && goalWeightKg >= 35 && goalWeightKg <= 250;
        const goalDeltaKg = currentWeightKg !== null && goalWeightKg !== null ? Math.abs(goalWeightKg - currentWeightKg) : null;
        const hasRealisticGoal =
          currentWeightRealistic &&
          goalWeightRealistic &&
          goalDeltaKg !== null &&
          goalDeltaKg <= Math.max(80, (currentWeightKg || 0) * 0.55) &&
          Boolean(goalDirection && pace && activityLevel && biggestStruggle);
        const macroCalories = getFirstNumber([data, profile], [
          'macros.personal.calories',
          'macroTargets.calories',
          'macraMacroTargets.calories',
          'planMacros.calories',
          'dailyCalorieTarget',
          'calorieTarget',
          'targetCalories',
        ]);
        const macroProtein = getFirstNumber([data, profile], [
          'macros.personal.protein',
          'macroTargets.protein',
          'macraMacroTargets.protein',
          'planMacros.protein',
          'proteinGrams',
          'targetProtein',
        ]);
        const macroCarbs = getFirstNumber([data, profile], [
          'macros.personal.carbs',
          'macroTargets.carbs',
          'macraMacroTargets.carbs',
          'planMacros.carbs',
          'carbsGrams',
          'targetCarbs',
        ]);
        const macroFat = getFirstNumber([data, profile], [
          'macros.personal.fat',
          'macroTargets.fat',
          'macraMacroTargets.fat',
          'planMacros.fat',
          'fatGrams',
          'targetFat',
        ]);
        const hasMacroTarget = Boolean(
          (macroCalories !== null && macroCalories >= 900 && macroCalories <= 6000) ||
            [macroProtein, macroCarbs, macroFat].filter((value) => value !== null && value > 0).length >= 2
        );
        const paywallViewCount = Math.max(
          scoreNumber(data.macraPaywallViewCount) || 0,
          scoreNumber(getNestedValue(data, 'macraPaywall.viewCount')) || 0,
          scoreNumber(getNestedValue(data, 'macraAnalytics.paywallViewCount')) || 0,
          scoreNumber(getNestedValue(data, 'macraEmailSequenceState.paywallViewCount')) || 0,
          scoreNumber(getNestedValue(data, 'macraEmailSequenceState.paywallView.count')) || 0
        );
        const paywallLastViewedAt = maxScoreMillis(
          data.macraLatestPaywallViewedAt,
          data.macraPaywallViewedAt,
          data.macraOnboardingPaywallReachedAt,
          data.macraPaywallReachedAt,
          getNestedValue(data, 'macraPaywall.lastViewedAt'),
          getNestedValue(data, 'macraAnalytics.lastPaywallViewedAt'),
          getNestedValue(data, 'macraEmailSequenceState.paywallViewedAt'),
          getNestedValue(data, 'macraEmailSequenceState.paywallLastViewedAt'),
          getNestedValue(data, 'macraEmailSequenceState.paywallView.lastViewedAt')
        );
        const ctaTappedAt = maxScoreMillis(
          data.macraPaywallCtaTappedAt,
          data.macraPaywallPrimaryButtonPressedAt,
          getNestedValue(data, 'macraPaywall.ctaTappedAt'),
          getNestedValue(data, 'macraAnalytics.paywallPrimaryButtonPressedAt'),
          getNestedValue(data, 'macraEmailSequenceState.paywallCtaTappedAt'),
          getNestedValue(data, 'macraEmailSequenceState.paywallPrimaryButtonPressedAt'),
          latestAttemptedAt
        );
        const appleCancelAt = maxScoreMillis(
          data.macraLatestPaywallCancelFeedbackAt,
          getNestedValue(data, 'macraLatestPaywallCancelFeedback.capturedAt'),
          latestCanceledAt
        );
        const appsFlyerTrialStartedAt = appsFlyerLatestEventAt(appsFlyer, MACRA_APPSFLYER_TRIAL_EVENT_NAMES);
        const appsFlyerPurchaseAt = appsFlyerLatestEventAt(appsFlyer, MACRA_APPSFLYER_PURCHASE_EVENT_NAMES);
        const trialEndAt = scoreMillis(data.trialEndDate);
        const rootTrialing = Boolean(data.isTrialing && trialEndAt && trialEndAt > Date.now());
        const trialStartedAt = maxScoreMillis(
          data.trialStartDate,
          data.macraTrialStartedAt,
          getNestedValue(data, 'macraEmailSequenceState.webOffer24hConvertedAt'),
          appsFlyerTrialStartedAt,
          latestTrialSucceededAt,
          rootTrialing && trialEndAt ? trialEndAt - 30 * 24 * 60 * 60 * 1000 : null
        );
        const subscriptionStatus = normalizeString(data.subscriptionStatus || data.macraSubscriptionStatus || data.revenueCatStatus).toLowerCase();
        const activeSubscriptionFlag = Boolean(
          data.isSubscribed ||
            data.hasActiveSubscription ||
            data.macraSubscriptionActive ||
            data.hasMacraPlus ||
            ['active', 'paid', 'subscribed', 'premium'].includes(subscriptionStatus)
        );
        const paidAt = maxScoreMillis(
          data.subscriptionStartedAt,
          data.macraSubscriptionStartedAt,
          appsFlyerPurchaseAt,
          activeSubscriptionFlag && !rootTrialing ? data.updatedAt : null,
          latestSucceededAt && latestSucceededAt !== latestTrialSucceededAt ? latestSucceededAt : null
        );

        const completedOnboarding = data.hasCompletedMacraOnboarding === true;
        const reachedPaywall = Boolean(paywallViewCount > 0 || paywallLastViewedAt || completedOnboarding);
        const qualified = Boolean(
          completedOnboarding &&
            ageYears !== null &&
            ageYears >= 18 &&
            profile &&
            hasRealisticGoal &&
            hasMacroTarget &&
            reachedPaywall
        );

        variantResult.assignments += 1;
        if (assignment.confidence === 'exact') {
          variantResult.exactAssignments += 1;
          exactAssignments += 1;
        } else if (assignment.confidence === 'inferred') {
          variantResult.inferredAssignments += 1;
          inferredAssignments += 1;
        }
        if (qualified) variantResult.qualifiedUsers += 1;
        if (completedOnboarding) variantResult.onboardingCompletions += 1;
        if (reachedPaywall) variantResult.paywallViews += 1;
        if (appsFlyerEventCount(appsFlyer, MACRA_APPSFLYER_VALUE_PREVIEW_EVENT_NAMES) > 0) variantResult.valuePreviewViews += 1;
        if (appsFlyerEventCount(appsFlyer, MACRA_APPSFLYER_PRICING_DISCLOSURE_EVENT_NAMES) > 0) variantResult.pricingDisclosureViews += 1;
        if (appsFlyerEventCount(appsFlyer, MACRA_APPSFLYER_TRIAL_CONFIDENCE_EVENT_NAMES) > 0) variantResult.trialConfidenceViews += 1;
        if (appsFlyerEventCount(appsFlyer, MACRA_APPSFLYER_PLAN_SELECTED_EVENT_NAMES) > 0) variantResult.planSelections += 1;
        if (ctaTappedAt) variantResult.ctaTaps += 1;
        if (latestAttemptedAt || appsFlyerEventCount(appsFlyer, MACRA_APPSFLYER_CHECKOUT_STARTED_EVENT_NAMES) > 0) variantResult.checkoutStarts += 1;
        if (appsFlyerEventCount(appsFlyer, MACRA_APPSFLYER_PURCHASE_BRIDGE_VIEWED_EVENT_NAMES) > 0) variantResult.purchaseBridgeViews += 1;
        if (appsFlyerEventCount(appsFlyer, MACRA_APPSFLYER_PURCHASE_BRIDGE_CONTINUED_EVENT_NAMES) > 0) variantResult.purchaseBridgeContinues += 1;
        if (appleCancelAt || appsFlyerEventCount(appsFlyer, MACRA_APPSFLYER_APPLE_CANCEL_EVENT_NAMES) > 0) variantResult.appleCancels += 1;
        if (appsFlyerEventCount(appsFlyer, MACRA_APPSFLYER_CANCEL_FEEDBACK_PRESENTED_EVENT_NAMES) > 0) variantResult.cancelFeedbackPresented += 1;
        if (appsFlyerEventCount(appsFlyer, MACRA_APPSFLYER_CANCEL_FEEDBACK_SUBMITTED_EVENT_NAMES) > 0) variantResult.cancelFeedbackSubmitted += 1;
        if (appsFlyerEventCount(appsFlyer, MACRA_APPSFLYER_TRIAL_ACTIVATION_SCREEN_EVENT_NAMES) > 0) variantResult.trialActivationScreens += 1;
        if (appsFlyerEventCount(appsFlyer, MACRA_APPSFLYER_TRIAL_ACTIVATION_PRIMARY_EVENT_NAMES) > 0) variantResult.trialActivationPrimaryActions += 1;
        if (trialStartedAt || appsFlyerEventCount(appsFlyer, MACRA_APPSFLYER_TRIAL_EVENT_NAMES) > 0) variantResult.trialStarts += 1;
        if (paidAt || appsFlyerEventCount(appsFlyer, MACRA_APPSFLYER_PURCHASE_EVENT_NAMES) > 0) variantResult.paidConversions += 1;
      });

      const usesPaidPrimaryMetric = ['paid_conversion', 'paid_conversions', 'paid'].includes(
        normalizeString(experiment.primaryMetric).toLowerCase()
      );
      const variantRows = Array.from(resultByVariantId.values()).map((variantResult) => ({
        ...variantResult,
        trialRate: variantResult.assignments ? variantResult.trialStarts / variantResult.assignments : 0,
        paidRate: variantResult.assignments ? variantResult.paidConversions / variantResult.assignments : 0,
      }));
      const rateForPrimaryMetric = (row: ExperimentVariantResult) => (
        usesPaidPrimaryMetric ? row.paidRate : row.trialRate
      );
      const baselineRow = variantRows.find((row) => row.variantId === 'baseline') || variantRows[0];
      const baselineRate = baselineRow ? rateForPrimaryMetric(baselineRow) : 0;
      const variantsWithLift = variantRows.map((row) => ({
        ...row,
        liftVsBaseline: row.variantId === 'baseline' || !baselineRate ? null : (rateForPrimaryMetric(row) - baselineRate) / baselineRate,
      }));
      const assignedUsers = exactAssignments + inferredAssignments;
      const exactShare = assignedUsers ? exactAssignments / assignedUsers : 0;
      const snapshot: ExperimentResultsSnapshot = {
        id: EXPERIMENT_ID,
        experimentId: EXPERIMENT_ID,
        generatedAt: new Date().toISOString(),
        generatedBy: user?.email || 'unknown',
        assignmentSalt: experiment.assignmentSalt,
        loadedUsers: userDocs.length,
        assignedUsers,
        exactAssignments,
        inferredAssignments,
        unknownAssignments,
        qualityLabel: exactShare >= 0.8 ? 'Strong exact assignment coverage' : exactShare >= 0.25 ? 'Mixed exact and inferred assignments' : 'Mostly inferred assignments',
        variants: variantsWithLift,
        unknownSamples,
        aggregateValidation: {
          appsFlyerTrialStarts: appsFlyerSummaryEventCount(appsFlyerSummary, MACRA_APPSFLYER_TRIAL_EVENT_NAMES),
          appsFlyerEvents: Number(getNestedValue(appsFlyerSummary, 'events.total') || 0),
          fineGrainedEvents: Object.fromEntries(
            MACRA_EXPERIMENT_EVENT_BREAKDOWN.map((row) => [
              row.key,
              appsFlyerSummaryEventCount(appsFlyerSummary, [...row.eventNames]),
            ])
          ),
          note: 'AppsFlyer aggregate data validates top-line event volume but cannot split by variant unless event metadata includes the variant.',
        },
        dataInputs: {
          onboardingUsers: userDocs.length,
          profiles: Object.values(profileByUserId).filter(Boolean).length,
          purchaseLogs: purchaseLogs.length,
          appsFlyerUserDocs: Object.values(appsFlyerByUserId).filter(Boolean).length,
          appsFlyerAggregateEvents: Number(getNestedValue(appsFlyerSummary, 'events.total') || 0),
        },
        configSnapshot: experiment,
      };

      await setDoc(
        doc(db, EXPERIMENT_RESULTS_COLLECTION, EXPERIMENT_ID),
        {
          ...snapshot,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setResults(snapshot);
      setActiveTab('results');
      setMessage(`Experiment results backfilled from ${userDocs.length} Macra onboarding users.`);
    } catch (backfillError) {
      console.error('Failed to backfill experiment results', backfillError);
      setError(backfillError instanceof Error ? backfillError.message : 'Failed to backfill experiment results.');
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Experiments | Admin</title>
      </Head>

      <main className="min-h-screen bg-[#07090d] text-white">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <Link href="/admin" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-white">
                <ArrowLeft className="h-4 w-4" />
                Admin
              </Link>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E0FE10] text-black">
                  <FlaskConical className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-3xl font-black tracking-tight">Experiments</h1>
                  <p className="mt-1 text-sm text-zinc-400">
                    Firestore-backed feature flags, rollout weights, and Macra onboarding variants.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={backfillResults}
                disabled={loading || saving || backfilling}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-200 transition hover:border-zinc-500 disabled:opacity-50"
              >
                <Database className={`h-4 w-4 ${backfilling ? 'animate-pulse' : ''}`} />
                {backfilling ? 'Backfilling...' : 'Backfill results'}
              </button>
              <button
                onClick={loadExperiment}
                disabled={loading || saving || backfilling}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-200 transition hover:border-zinc-500 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={saveExperiment}
                disabled={loading || saving || backfilling}
                className="inline-flex items-center gap-2 rounded-lg bg-[#E0FE10] px-4 py-2 text-sm font-black text-black transition hover:bg-[#c9e70e] disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save experiment'}
              </button>
            </div>
          </div>

          {message && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{message}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mb-6 flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
            {[
              { id: 'setup' as const, label: 'Setup', icon: SlidersHorizontal },
              { id: 'results' as const, label: 'Results', icon: BarChart3 },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-black transition ${
                    isActive
                      ? 'bg-[#E0FE10] text-black'
                      : 'border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === 'setup' ? (
            <>
          <section className="mb-6 rounded-2xl border border-zinc-800 bg-[#11151b] p-5">
            <div className="mb-3">
              <h3 className="text-sm font-black uppercase tracking-wide text-zinc-200">User maintenance</h3>
              <p className="mt-1 text-xs text-zinc-400">
                Backfill <code className="text-zinc-300">registrationComplete</code> for Macra users who finished
                onboarding before iOS wrote the flag. New users self-heal, so this is for one-off cleanups.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => runRegistrationBackfill(false)}
                disabled={rcBackfill.loading}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm font-bold text-zinc-200 transition hover:border-zinc-500 disabled:opacity-50"
              >
                {rcBackfill.loading ? 'Working…' : 'Preview (dry run)'}
              </button>
              <button
                type="button"
                onClick={() => runRegistrationBackfill(true)}
                disabled={rcBackfill.loading}
                className="inline-flex items-center gap-2 rounded-lg bg-[#E0FE10] px-3 py-2 text-sm font-black text-black transition hover:bg-[#c9e70e] disabled:opacity-50"
              >
                {rcBackfill.loading ? 'Working…' : 'Run backfill'}
              </button>
            </div>
            {rcBackfill.result && <p className="mt-3 text-sm text-emerald-200">{rcBackfill.result}</p>}
            {rcBackfill.error && <p className="mt-3 text-sm text-red-300">{rcBackfill.error}</p>}
          </section>

          <section className="mb-6 rounded-2xl border border-zinc-800 bg-[#11151b] p-5">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#E0FE10]">Firestore path</p>
                <p className="mt-1 font-mono text-sm text-zinc-300">{EXPERIMENT_COLLECTION}/{EXPERIMENT_ID}</p>
              </div>
              <label className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-black/20 px-4 py-3">
                <input
                  type="checkbox"
                  checked={experiment.isEnabled}
                  onChange={(event) => updateExperimentField('isEnabled', event.target.checked)}
                  className="h-4 w-4 accent-[#E0FE10]"
                />
                <span className="text-sm font-bold">Experiment enabled</span>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name">
                <input
                  value={experiment.name}
                  onChange={(event) => updateExperimentField('name', event.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#E0FE10]"
                />
              </Field>
              <Field label="Assignment salt">
                <input
                  value={experiment.assignmentSalt}
                  onChange={(event) => updateExperimentField('assignmentSalt', event.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 font-mono text-sm text-white outline-none focus:border-[#E0FE10]"
                />
              </Field>
              <Field label="Primary metric">
                <input
                  value={experiment.primaryMetric}
                  onChange={(event) => updateExperimentField('primaryMetric', event.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#E0FE10]"
                />
              </Field>
              <Field label="Owner">
                <input
                  value={experiment.owner}
                  onChange={(event) => updateExperimentField('owner', event.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#E0FE10]"
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Description">
                  <textarea
                    value={experiment.description}
                    onChange={(event) => updateExperimentField('description', event.target.value)}
                    className="min-h-[84px] w-full rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#E0FE10]"
                  />
                </Field>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-[#11151b]">
            <div className="flex flex-col gap-3 border-b border-zinc-800 p-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <SlidersHorizontal className="h-5 w-5 text-[#E0FE10]" />
                <div>
                  <h2 className="text-lg font-black">Variants</h2>
                  <p className="text-sm text-zinc-400">Enabled rollout weight total: {enabledWeight}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {enabledWeight !== 100 && (
                  <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-100">
                    Weights do not need to equal 100, but 100 is easier to reason about.
                  </div>
                )}
                <button
                  onClick={addVariant}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-black text-zinc-200 transition hover:border-zinc-500"
                >
                  <Plus className="h-4 w-4" />
                  Add variant
                </button>
              </div>
            </div>

            <div className="divide-y divide-zinc-800">
              {experiment.variants.map((variant) => (
                <VariantEditor
                  key={variant.id}
                  variant={variant}
                  isBusy={saving}
                  onUpdate={updateVariant}
                  onParameterUpdate={updateVariantParameter}
                  onPromote={promoteVariantToFullRollout}
                  onRemove={experiment.variants.length > 1 ? removeVariant : undefined}
                />
              ))}
            </div>
          </section>
            </>
          ) : (
            <ExperimentResultsPanel
              results={results}
              onBackfill={backfillResults}
              backfilling={backfilling}
            />
          )}
        </div>
      </main>
    </AdminRouteGuard>
  );
};

const ExperimentResultsPanel: React.FC<{
  results: ExperimentResultsSnapshot | null;
  onBackfill: () => void;
  backfilling: boolean;
}> = ({ results, onBackfill, backfilling }) => {
  const primaryMetric = normalizeString(results?.configSnapshot?.primaryMetric).toLowerCase();
  const usesPaidPrimaryMetric = ['paid_conversion', 'paid_conversions', 'paid'].includes(primaryMetric || 'paid_conversion');
  const primaryMetricLabel = usesPaidPrimaryMetric ? 'paid conversion' : 'trial start';
  const primaryMetricRate = (variant: ExperimentVariantResult) => (
    usesPaidPrimaryMetric ? variant.paidRate : variant.trialRate
  );
  const primaryMetricCount = (variant: ExperimentVariantResult) => (
    usesPaidPrimaryMetric ? variant.paidConversions : variant.trialStarts
  );
  const bestVariant = results?.variants
    .filter((variant) => variant.assignments > 0)
    .sort((left, right) => primaryMetricRate(right) - primaryMetricRate(left))[0];
  const aggregateFineGrainedEvents = results?.aggregateValidation?.fineGrainedEvents || {};
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const copyResultsToClipboard = async () => {
    if (!results) return;

    const variantPerformance = results.variants.map((variant) => ({
      variantId: variant.variantId,
      variantName: variant.variantName,
      assignments: variant.assignments,
      exactAssignments: variant.exactAssignments,
      inferredAssignments: variant.inferredAssignments,
      onboardingCompletions: variant.onboardingCompletions,
      qualifiedUsers: variant.qualifiedUsers,
      paywallViews: variant.paywallViews,
      ctaTaps: variant.ctaTaps,
      checkoutStarts: variant.checkoutStarts,
      appleCancels: variant.appleCancels,
      trialStarts: variant.trialStarts,
      trialRate: variant.trialRate,
      trialRateLabel: formatPercent(variant.trialStarts, variant.assignments),
      paidConversions: variant.paidConversions,
      paidRate: variant.paidRate,
      paidRateLabel: formatPercent(variant.paidConversions, variant.assignments),
      liftVsBaseline: variant.liftVsBaseline,
      liftVsBaselineLabel: formatSignedPercent(variant.liftVsBaseline),
    }));

    const diagnosticBreakdownByVariant = results.variants.map((variant) => ({
      variantId: variant.variantId,
      variantName: variant.variantName,
      assignedUsers: variant.assignments,
      checkpoints: {
        valuePreviewViews: variant.valuePreviewViews,
        pricingDisclosureViews: variant.pricingDisclosureViews,
        trialConfidenceViews: variant.trialConfidenceViews,
        planSelections: variant.planSelections,
        ctaTaps: variant.ctaTaps,
        checkoutStarts: variant.checkoutStarts,
        purchaseBridgeViews: variant.purchaseBridgeViews,
        purchaseBridgeContinues: variant.purchaseBridgeContinues,
        appleCancels: variant.appleCancels,
        cancelFeedbackPresented: variant.cancelFeedbackPresented,
        cancelFeedbackSubmitted: variant.cancelFeedbackSubmitted,
        trialActivationScreens: variant.trialActivationScreens,
        trialActivationPrimaryActions: variant.trialActivationPrimaryActions,
      },
    }));

    const payload = {
      reportType: 'macra-experiment-results-dashboard',
      copiedAt: new Date().toISOString(),
      experimentId: results.experimentId,
      snapshotGeneratedAt: formatIsoTimestamp(results.generatedAt),
      snapshotGeneratedAtLabel: formatAdminDate(results.generatedAt),
      assignmentSalt: results.assignmentSalt,
      primaryMetric: {
        key: results.configSnapshot?.primaryMetric || '',
        label: primaryMetricLabel,
        usesPaidPrimaryMetric,
        bestVariant: bestVariant ? {
          variantId: bestVariant.variantId,
          variantName: bestVariant.variantName,
          assignments: bestVariant.assignments,
          count: primaryMetricCount(bestVariant),
          rate: primaryMetricRate(bestVariant),
          rateLabel: formatPercent(primaryMetricCount(bestVariant), bestVariant.assignments),
        } : null,
      },
      summary: {
        loadedUsers: results.loadedUsers,
        assignedUsers: results.assignedUsers,
        exactAssignments: results.exactAssignments,
        inferredAssignments: results.inferredAssignments,
        unknownAssignments: results.unknownAssignments,
        qualityLabel: results.qualityLabel,
      },
      dataInputs: results.dataInputs || null,
      aggregateValidation: results.aggregateValidation || null,
      variantPerformance,
      diagnosticBreakdownByVariant,
      unknownSamples: results.unknownSamples || [],
      configSnapshot: results.configSnapshot,
    };

    const report = [
      'Macra Experiment Results Export',
      `Generated: ${new Date().toLocaleString()}`,
      `Snapshot: ${formatAdminDate(results.generatedAt)}`,
      `Loaded users: ${results.loadedUsers}`,
      '',
      '```json',
      JSON.stringify(payload, null, 2),
      '```',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(report);
      setCopyStatus('copied');
      window.setTimeout(() => setCopyStatus('idle'), 1600);
    } catch (error) {
      console.error('[Experiments] Failed to copy results export', error);
      setCopyStatus('error');
      window.setTimeout(() => setCopyStatus('idle'), 2400);
    }
  };

  if (!results) {
    return (
      <section className="rounded-2xl border border-zinc-800 bg-[#11151b] p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-[#E0FE10]" />
              <h2 className="text-xl font-black">Experiment Results</h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              No saved result snapshot yet. Backfill from Macra onboarding users, purchase logs, profiles, and AppsFlyer attribution to create the first read.
            </p>
          </div>
          <button
            onClick={onBackfill}
            disabled={backfilling}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#E0FE10] px-4 py-2 text-sm font-black text-black transition hover:bg-[#c9e70e] disabled:opacity-50"
          >
            <Database className={`h-4 w-4 ${backfilling ? 'animate-pulse' : ''}`} />
            {backfilling ? 'Backfilling...' : 'Backfill results'}
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-800 bg-[#11151b] p-5">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-[#E0FE10]" />
              <h2 className="text-xl font-black">Experiment Results</h2>
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              Last generated {formatAdminDate(results.generatedAt)} from {results.loadedUsers} Macra onboarding users.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => void copyResultsToClipboard()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-200 transition hover:border-[#E0FE10]/60 hover:text-[#E0FE10]"
            >
              {copyStatus === 'copied' ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Copy failed' : 'Copy results'}
            </button>
            <button
              onClick={onBackfill}
              disabled={backfilling}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#E0FE10] px-4 py-2 text-sm font-black text-black transition hover:bg-[#c9e70e] disabled:opacity-50"
            >
              <Database className={`h-4 w-4 ${backfilling ? 'animate-pulse' : ''}`} />
              {backfilling ? 'Backfilling...' : 'Refresh results'}
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <ResultMetric label="Assigned users" value={results.assignedUsers} sublabel={`${results.loadedUsers} loaded`} />
          <ResultMetric label="Exact assignments" value={results.exactAssignments} sublabel={formatPercent(results.exactAssignments, results.assignedUsers)} />
          <ResultMetric label="Inferred assignments" value={results.inferredAssignments} sublabel={formatPercent(results.inferredAssignments, results.assignedUsers)} />
          <ResultMetric label="Unknown users" value={results.unknownAssignments} sublabel="Not assigned to a variant" />
          <ResultMetric
            label={`Best ${primaryMetricLabel} rate`}
            value={bestVariant ? formatPercent(primaryMetricCount(bestVariant), bestVariant.assignments) : '0%'}
            sublabel={bestVariant?.variantName || 'No data'}
          />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
            <div className="mb-1 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Data quality</div>
            <div className="text-sm font-bold text-white">{results.qualityLabel}</div>
            <p className="mt-2 text-sm text-zinc-400">
              Exact means a saved variant ID or saved treatment parameters were found. Inferred means assignment was reconstructed from the current salt, user ID, and rollout weights.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
            <div className="mb-1 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">AppsFlyer validation</div>
            <div className="text-sm font-bold text-white">
              {results.aggregateValidation?.appsFlyerTrialStarts || 0} aggregate trial starts · {results.aggregateValidation?.appsFlyerEvents || 0} aggregate events
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              {results.aggregateValidation?.note || 'Top-line AppsFlyer validation will appear after the scoreboard has imported AppsFlyer data.'}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {MACRA_EXPERIMENT_EVENT_BREAKDOWN.map((eventRow) => (
                <div key={eventRow.key} className="flex items-center justify-between gap-3 rounded-lg bg-black/25 px-3 py-2">
                  <span className="text-xs font-semibold text-zinc-400">{eventRow.label}</span>
                  <span className="font-mono text-sm font-black text-white">{aggregateFineGrainedEvents[eventRow.key] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-zinc-800 bg-black/20 p-4">
          <div className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Data inputs</div>
          <div className="grid gap-3 text-sm text-zinc-300 md:grid-cols-5">
            <div>
              <div className="font-black text-white">{results.dataInputs?.onboardingUsers ?? results.loadedUsers}</div>
              <div className="text-xs text-zinc-500">Onboarding users</div>
            </div>
            <div>
              <div className="font-black text-white">{results.dataInputs?.profiles ?? 0}</div>
              <div className="text-xs text-zinc-500">Profile docs</div>
            </div>
            <div>
              <div className="font-black text-white">{results.dataInputs?.purchaseLogs ?? 0}</div>
              <div className="text-xs text-zinc-500">Purchase logs</div>
            </div>
            <div>
              <div className="font-black text-white">{results.dataInputs?.appsFlyerUserDocs ?? 0}</div>
              <div className="text-xs text-zinc-500">AppsFlyer user docs</div>
            </div>
            <div>
              <div className="font-black text-white">{results.dataInputs?.appsFlyerAggregateEvents ?? results.aggregateValidation?.appsFlyerEvents ?? 0}</div>
              <div className="text-xs text-zinc-500">Aggregate events</div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-[#11151b] p-5">
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="h-5 w-5 text-[#E0FE10]" />
          <div>
            <h2 className="text-lg font-black">Trial Breakdown By Variant</h2>
            <p className="text-sm text-zinc-400">Person-level checkpoints from matched first-party and AppsFlyer docs.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {results.variants.map((variant) => (
            <div key={variant.variantId} className="rounded-xl border border-zinc-800 bg-black/20 p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-white">{variant.variantName}</div>
                  <div className="font-mono text-xs text-zinc-500">{variant.variantId}</div>
                </div>
                <div className="text-right text-xs text-zinc-500">{variant.assignments} assigned</div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <DiagnosticMetric label="Value preview" value={variant.valuePreviewViews} denominator={variant.paywallViews} />
                <DiagnosticMetric label="Pricing disclosure" value={variant.pricingDisclosureViews} denominator={variant.paywallViews} />
                <DiagnosticMetric label="Trial confidence" value={variant.trialConfidenceViews} denominator={variant.paywallViews} />
                <DiagnosticMetric label="Plan selected" value={variant.planSelections} denominator={variant.paywallViews} />
                <DiagnosticMetric label="CTA taps" value={variant.ctaTaps} denominator={variant.paywallViews} />
                <DiagnosticMetric label="Checkout starts" value={variant.checkoutStarts} denominator={variant.ctaTaps || variant.paywallViews} />
                <DiagnosticMetric label="Apple bridge viewed" value={variant.purchaseBridgeViews} denominator={variant.ctaTaps || variant.paywallViews} />
                <DiagnosticMetric label="Bridge continued" value={variant.purchaseBridgeContinues} denominator={variant.purchaseBridgeViews || variant.ctaTaps || variant.paywallViews} />
                <DiagnosticMetric label="Apple cancels" value={variant.appleCancels} denominator={variant.checkoutStarts || variant.ctaTaps || variant.paywallViews} />
                <DiagnosticMetric label="Cancel feedback" value={variant.cancelFeedbackSubmitted} denominator={variant.cancelFeedbackPresented || variant.appleCancels || variant.paywallViews} />
                <DiagnosticMetric label="Activation screen" value={variant.trialActivationScreens} denominator={variant.trialStarts || variant.paidConversions || variant.assignments} />
                <DiagnosticMetric label="Activation primary" value={variant.trialActivationPrimaryActions} denominator={variant.trialActivationScreens || variant.trialStarts || variant.assignments} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#11151b]">
        <div className="flex items-center gap-3 border-b border-zinc-800 p-5">
          <Users className="h-5 w-5 text-[#E0FE10]" />
          <div>
            <h2 className="text-lg font-black">Variant Performance</h2>
            <p className="text-sm text-zinc-400">Primary metric: {primaryMetricLabel}s from assigned Macra onboarding users.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-800 text-sm">
            <thead className="bg-black/20 text-xs uppercase tracking-[0.16em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Variant</th>
                <th className="px-4 py-3 text-right">Assigned</th>
                <th className="px-4 py-3 text-right">Onboarding</th>
                <th className="px-4 py-3 text-right">Qualified</th>
                <th className="px-4 py-3 text-right">Paywall</th>
                <th className="px-4 py-3 text-right">CTA</th>
                <th className="px-4 py-3 text-right">Cancels</th>
                <th className="px-4 py-3 text-right">Trials</th>
                <th className="px-4 py-3 text-right">Trial rate</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Paid rate</th>
                <th className="px-4 py-3 text-right">Lift</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {results.variants.map((variant) => (
                <tr key={variant.variantId} className="text-zinc-300">
                  <td className="px-4 py-4">
                    <div className="font-bold text-white">{variant.variantName}</div>
                    <div className="font-mono text-xs text-zinc-500">{variant.variantId}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {variant.exactAssignments} exact · {variant.inferredAssignments} inferred
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right font-semibold text-white">{variant.assignments}</td>
                  <td className="px-4 py-4 text-right">{variant.onboardingCompletions}</td>
                  <td className="px-4 py-4 text-right">{variant.qualifiedUsers}</td>
                  <td className="px-4 py-4 text-right">{variant.paywallViews}</td>
                  <td className="px-4 py-4 text-right">{variant.ctaTaps}</td>
                  <td className="px-4 py-4 text-right">{variant.appleCancels}</td>
                  <td className="px-4 py-4 text-right font-semibold text-white">{variant.trialStarts}</td>
                  <td className="px-4 py-4 text-right">{formatPercent(variant.trialStarts, variant.assignments)}</td>
                  <td className="px-4 py-4 text-right">{variant.paidConversions}</td>
                  <td className="px-4 py-4 text-right">{formatPercent(variant.paidConversions, variant.assignments)}</td>
                  <td className={`px-4 py-4 text-right font-semibold ${variant.liftVsBaseline && variant.liftVsBaseline > 0 ? 'text-emerald-300' : variant.liftVsBaseline && variant.liftVsBaseline < 0 ? 'text-red-300' : 'text-zinc-400'}`}>
                    {formatSignedPercent(variant.liftVsBaseline)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {results.unknownSamples.length ? (
        <section className="rounded-2xl border border-zinc-800 bg-[#11151b] p-5">
          <h2 className="text-lg font-black">Unknown Assignment Samples</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {results.unknownSamples.map((sample) => (
              <div key={sample.userId} className="rounded-xl border border-zinc-800 bg-black/20 p-3">
                <div className="font-mono text-xs text-zinc-300">{sample.userId}</div>
                <div className="text-xs text-zinc-500">{sample.email || 'No email'} · {sample.reason}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};

const ResultMetric: React.FC<{ label: string; value: React.ReactNode; sublabel: string }> = ({ label, value, sublabel }) => (
  <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
    <div className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">{label}</div>
    <div className="mt-2 text-2xl font-black text-white">{value}</div>
    <div className="mt-1 text-xs text-zinc-500">{sublabel}</div>
  </div>
);

const DiagnosticMetric: React.FC<{ label: string; value?: number; denominator?: number }> = ({ label, value = 0, denominator = 0 }) => {
  const normalizedValue = Number(value || 0);
  const normalizedDenominator = Number(denominator || 0);
  return (
    <div className="rounded-lg bg-black/25 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-zinc-400">{label}</span>
        <span className="font-mono text-sm font-black text-white">{normalizedValue}</span>
      </div>
      <div className="mt-1 text-[11px] text-zinc-500">{formatPercent(normalizedValue, normalizedDenominator)}</div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-zinc-500">{label}</span>
    {children}
  </label>
);

type VariantEditorProps = {
  variant: ExperimentVariant;
  isBusy?: boolean;
  onUpdate: (variantId: string, updates: Partial<ExperimentVariant>) => void;
  onParameterUpdate: <K extends keyof ExperimentParameterMap>(
    variantId: string,
    key: K,
    value: ExperimentParameterMap[K]
  ) => void;
  onPromote: (variantId: string) => void;
  onRemove?: (variantId: string) => void;
};

const VariantEditor: React.FC<VariantEditorProps> = ({ variant, isBusy = false, onUpdate, onParameterUpdate, onPromote, onRemove }) => (
  <div className="p-5">
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-black">{variant.name}</h3>
          <span className="rounded-full border border-zinc-700 px-2.5 py-1 font-mono text-xs text-zinc-400">{variant.id}</span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-black ${variant.isEnabled ? 'bg-emerald-400/15 text-emerald-200' : 'bg-zinc-700/50 text-zinc-300'}`}>
            {variant.isEnabled ? 'Enabled' : 'Paused'}
          </span>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-zinc-400">{variant.description}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPromote(variant.id)}
          disabled={isBusy}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm font-bold text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" />
          Promote to 100%
        </button>
        <label className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-black/20 px-3 py-2">
          <input
            type="checkbox"
            checked={variant.isEnabled}
            onChange={(event) => onUpdate(variant.id, { isEnabled: event.target.checked })}
            className="h-4 w-4 accent-[#E0FE10]"
          />
          <span className="text-sm font-bold">Enabled</span>
        </label>
        {onRemove && (
          <button
            onClick={() => onRemove(variant.id)}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-100 transition hover:bg-red-500/15"
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </button>
        )}
      </div>
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Variant name">
        <input
          value={variant.name}
          onChange={(event) => onUpdate(variant.id, { name: event.target.value })}
          className="w-full rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#E0FE10]"
        />
      </Field>
      <Field label="Weight">
        <input
          type="number"
          min={0}
          value={variant.weight}
          onChange={(event) => onUpdate(variant.id, { weight: Number(event.target.value) })}
          className="w-full rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#E0FE10]"
        />
      </Field>
      <div className="md:col-span-2">
        <Field label="Description">
          <textarea
            value={variant.description}
            onChange={(event) => onUpdate(variant.id, { description: event.target.value })}
            className="min-h-[72px] w-full rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#E0FE10]"
          />
        </Field>
      </div>
      <Field label="Default plan">
        <select
          value={variant.parameters.macra_paywall_default_plan}
          onChange={(event) => onParameterUpdate(variant.id, 'macra_paywall_default_plan', event.target.value as ExperimentParameterMap['macra_paywall_default_plan'])}
          className="w-full rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#E0FE10]"
        >
          <option value="annual">Annual</option>
          <option value="monthly">Monthly</option>
        </select>
      </Field>
      <Field label="Paywall layout">
        <select
          value={variant.parameters.macra_paywall_layout_variant}
          onChange={(event) => onParameterUpdate(variant.id, 'macra_paywall_layout_variant', event.target.value as ExperimentParameterMap['macra_paywall_layout_variant'])}
          className="w-full rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#E0FE10]"
        >
          <option value="trial_confidence_control">Control</option>
          <option value="trial_confidence">Trial prep compact</option>
          <option value="hard_paywall_value">Hard paywall monthly</option>
        </select>
      </Field>
      <Field label="Onboarding variant">
        <select
          value={variant.parameters.onboarding_experience_variant}
          onChange={(event) => onParameterUpdate(variant.id, 'onboarding_experience_variant', event.target.value as ExperimentParameterMap['onboarding_experience_variant'])}
          className="w-full rounded-lg border border-zinc-700 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#E0FE10]"
        >
          <option value="standard">Standard</option>
          <option value="nora_guided">Nora guided</option>
        </select>
      </Field>
    </div>
  </div>
);

export default ExperimentsPage;
