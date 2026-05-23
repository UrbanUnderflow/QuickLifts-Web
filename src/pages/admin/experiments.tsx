import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FlaskConical,
  Plus,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { useUser } from '../../hooks/useUser';

type ExperimentParameterMap = {
  macra_paywall_default_plan: 'annual' | 'monthly';
  macra_paywall_layout_variant: 'trial_confidence_control' | 'trial_confidence';
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

const EXPERIMENT_COLLECTION = 'macra-experiments';
const EXPERIMENT_ID = 'macra_paywall_onboarding';

const DEFAULT_EXPERIMENT: ExperimentDocument = {
  id: EXPERIMENT_ID,
  name: 'Macra Paywall + Onboarding',
  description: 'Controls Macra onboarding and paywall treatments from Firestore-backed experiment config.',
  isEnabled: true,
  assignmentSalt: 'macra-paywall-onboarding-2026-05',
  primaryMetric: 'trial_start',
  owner: 'Macra',
  variants: [
    {
      id: 'baseline',
      name: 'Baseline',
      description: 'Current long paywall with standard onboarding.',
      isEnabled: true,
      weight: 34,
      parameters: {
        macra_paywall_default_plan: 'annual',
        macra_paywall_layout_variant: 'trial_confidence_control',
        onboarding_experience_variant: 'standard',
      },
    },
    {
      id: 'variant_a',
      name: 'Trial prep compact',
      description: 'Current compact trial education and plan selection flow.',
      isEnabled: true,
      weight: 33,
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
      isEnabled: true,
      weight: 33,
      parameters: {
        macra_paywall_default_plan: 'annual',
        macra_paywall_layout_variant: 'trial_confidence',
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

const ExperimentsPage: React.FC = () => {
  const user = useUser();
  const [experiment, setExperiment] = useState<ExperimentDocument>(DEFAULT_EXPERIMENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
      const snapshot = await getDoc(doc(db, EXPERIMENT_COLLECTION, EXPERIMENT_ID));
      setExperiment(normalizeExperiment(snapshot.exists() ? snapshot.data() as Partial<ExperimentDocument> : null));
      if (!snapshot.exists()) {
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
                onClick={loadExperiment}
                disabled={loading || saving}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-200 transition hover:border-zinc-500 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={saveExperiment}
                disabled={loading || saving}
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
                  onUpdate={updateVariant}
                  onParameterUpdate={updateVariantParameter}
                  onRemove={experiment.variants.length > 1 ? removeVariant : undefined}
                />
              ))}
            </div>
          </section>
        </div>
      </main>
    </AdminRouteGuard>
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
  onUpdate: (variantId: string, updates: Partial<ExperimentVariant>) => void;
  onParameterUpdate: <K extends keyof ExperimentParameterMap>(
    variantId: string,
    key: K,
    value: ExperimentParameterMap[K]
  ) => void;
  onRemove?: (variantId: string) => void;
};

const VariantEditor: React.FC<VariantEditorProps> = ({ variant, onUpdate, onParameterUpdate, onRemove }) => (
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
