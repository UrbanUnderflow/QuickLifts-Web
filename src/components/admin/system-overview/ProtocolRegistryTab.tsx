import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  BookCopy,
  BrainCircuit,
  GitBranch,
  History,
  Layers3,
  PlusCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';
import {
  ExerciseCategory,
  protocolRegistryService,
  type PulseCheckProtocolClass,
  type PulseCheckProtocolDefinition,
  type PulseCheckProtocolDeliveryMode,
  type PulseCheckProtocolEvidenceSummary,
  type PulseCheckProtocolFamily,
  type PulseCheckProtocolFamilyHistoryEntry,
  type PulseCheckProtocolFamilyStatus,
  type PulseCheckProtocolGovernanceStage,
  type PulseCheckProtocolHistoryEntry,
  type PulseCheckProtocolPublishStatus,
  type PulseCheckProtocolResponseFamily,
  type PulseCheckProtocolReviewGate,
  type PulseCheckProtocolReviewStatus,
  type PulseCheckProtocolVariant,
  type PulseCheckProtocolVariantHistoryEntry,
} from '../../../api/firebase/mentaltraining';
import {
  BulletList,
  CardGrid,
  DataTable,
  DocHeader,
  InfoCard,
  InlineTag,
  RuntimeAlignmentPanel,
  SectionBlock,
} from './PulseCheckRuntimeDocPrimitives';

const CLASS_EXPLANATIONS: Record<string, string> = {
  regulation: 'Downshift or steady the athlete when activation, anxiety, or emotional spillover is the bottleneck.',
  priming: 'Sharpen, energize, or narrow attention so the athlete can step into a useful rep.',
  recovery: 'Help the athlete clear post-load stress, rumination, or fatigue after demanding work.',
};

type ActiveProtocolClass = Exclude<PulseCheckProtocolClass, 'none'>;

const PROTOCOL_CLASS_OPTIONS: ActiveProtocolClass[] = ['regulation', 'priming', 'recovery'];
const CATEGORY_OPTIONS = Object.values(ExerciseCategory);
const DELIVERY_OPTIONS: PulseCheckProtocolDeliveryMode[] = [
  'guided_breathing',
  'guided_focus',
  'guided_imagery',
  'guided_reframe',
  'guided_reflection',
  'embodied_reset',
];
const RESPONSE_FAMILY_OPTIONS: PulseCheckProtocolResponseFamily[] = [
  'acute_downshift',
  'steady_regulation',
  'activation_upshift',
  'focus_narrowing',
  'confidence_priming',
  'imagery_priming',
  'recovery_downregulation',
  'recovery_reflection',
  'cognitive_reframe',
];
const GOVERNANCE_STAGE_OPTIONS: PulseCheckProtocolGovernanceStage[] = [
  'nominated',
  'structured',
  'sandbox',
  'pilot',
  'published',
  'restricted',
  'archived',
];
const FAMILY_STATUS_OPTIONS: PulseCheckProtocolFamilyStatus[] = ['candidate', 'locked'];
const PUBLISH_STATUS_OPTIONS: PulseCheckProtocolPublishStatus[] = ['draft', 'published', 'archived'];

function humanizeTag(tag: string): string {
  return tag.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseTags(raw: string): string[] {
  return Array.from(new Set(raw.split(',').map((item) => item.trim()).filter(Boolean)));
}

function formatDate(timestamp?: number) {
  if (!timestamp) return 'Not set';
  return new Date(timestamp).toLocaleString();
}

function compareDraft(record: unknown) {
  return JSON.stringify(record ?? null);
}

const FieldShell: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="space-y-2">
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      {hint ? <div className="text-xs text-zinc-600">{hint}</div> : null}
    </div>
    {children}
  </label>
);

const inputClassName =
  'w-full rounded-xl border border-zinc-800 bg-[#0b1220] px-3 py-2 text-sm text-white outline-none transition focus:border-lime-400/60';

const textareaClassName =
  'w-full rounded-xl border border-zinc-800 bg-[#0b1220] px-3 py-2 text-sm text-white outline-none transition focus:border-lime-400/60 min-h-[110px]';

function reviewStatusColor(status: PulseCheckProtocolReviewStatus) {
  switch (status) {
    case 'approved':
      return 'green';
    case 'blocked':
      return 'red';
    case 'in_review':
      return 'amber';
    default:
      return 'blue';
  }
}

function renderChecklist(gates: PulseCheckProtocolReviewGate[]) {
  if (!gates.length) {
    return <div className="text-xs text-zinc-500">No review gates configured.</div>;
  }

  return (
    <div className="space-y-2">
      {gates.map((gate) => (
        <div key={gate.key} className="rounded-2xl border border-zinc-800 bg-black/20 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <InlineTag
              label={gate.status}
              color={gate.status === 'passed' ? 'green' : gate.status === 'blocked' ? 'red' : 'amber'}
            />
            <span className="text-sm text-white">{gate.label}</span>
          </div>
          {gate.note ? <div className="mt-1 text-xs text-zinc-500">{gate.note}</div> : null}
        </div>
      ))}
    </div>
  );
}

function renderEvidencePanel(panel: PulseCheckProtocolEvidenceSummary | undefined) {
  if (!panel) {
    return <div className="text-xs text-zinc-500">No evidence signals captured yet.</div>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-zinc-800 bg-black/20 p-3 text-sm text-zinc-300">
        <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Signal Mix</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <InlineTag label={`+ ${panel.positiveSignals}`} color="green" />
          <InlineTag label={`0 ${panel.neutralSignals}`} color="amber" />
          <InlineTag label={`- ${panel.negativeSignals}`} color="red" />
        </div>
      </div>
      <div className="rounded-2xl border border-zinc-800 bg-black/20 p-3 text-sm text-zinc-300">
        <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Responsiveness</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <InlineTag label={panel.responseDirection} color={panel.responseDirection === 'positive' ? 'green' : panel.responseDirection === 'negative' ? 'red' : panel.responseDirection === 'mixed' ? 'amber' : 'blue'} />
          <InlineTag label={`${panel.confidence} confidence`} color="blue" />
          <InlineTag label={`${panel.sampleSize} samples`} color="blue" />
        </div>
      </div>
      {panel.explanation ? (
        <div className="rounded-2xl border border-zinc-800 bg-black/20 p-3 text-sm text-zinc-300 sm:col-span-2">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Explanation</div>
          <div className="mt-2">{panel.explanation}</div>
        </div>
      ) : null}
      {panel.lastObservedAt ? (
        <div className="rounded-2xl border border-zinc-800 bg-black/20 p-3 text-xs text-zinc-500 sm:col-span-2">
          Last observed: {formatDate(panel.lastObservedAt)}
        </div>
      ) : null}
    </div>
  );
}

const listButtonClass = (selected: boolean) =>
  `w-full rounded-2xl border px-4 py-3 text-left transition ${
    selected
      ? 'border-lime-400/50 bg-lime-500/10'
      : 'border-zinc-800 bg-black/20 hover:border-zinc-700 hover:bg-white/[0.03]'
  }`;

const ProtocolRegistryTab: React.FC = () => {
  const [families, setFamilies] = useState<PulseCheckProtocolFamily[]>([]);
  const [variants, setVariants] = useState<PulseCheckProtocolVariant[]>([]);
  const [runtimeRecords, setRuntimeRecords] = useState<PulseCheckProtocolDefinition[]>([]);

  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedRuntimeId, setSelectedRuntimeId] = useState<string | null>(null);

  const [familyDraft, setFamilyDraft] = useState<PulseCheckProtocolFamily | null>(null);
  const [variantDraft, setVariantDraft] = useState<PulseCheckProtocolVariant | null>(null);
  const [runtimeDraft, setRuntimeDraft] = useState<PulseCheckProtocolDefinition | null>(null);

  const [familyHistory, setFamilyHistory] = useState<PulseCheckProtocolFamilyHistoryEntry[]>([]);
  const [variantHistory, setVariantHistory] = useState<PulseCheckProtocolVariantHistoryEntry[]>([]);
  const [runtimeHistory, setRuntimeHistory] = useState<PulseCheckProtocolHistoryEntry[]>([]);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null);

  const loadWorkspace = async (preferred?: { familyId?: string | null; variantId?: string | null; runtimeId?: string | null }) => {
    setLoading(true);
    try {
      const workspace = await protocolRegistryService.listWorkspace();
      setFamilies(workspace.families);
      setVariants(workspace.variants);
      setRuntimeRecords(workspace.runtimeRecords);

      const nextFamilyId =
        preferred?.familyId ||
        (selectedFamilyId && workspace.families.some((entry) => entry.id === selectedFamilyId) ? selectedFamilyId : null) ||
        workspace.families[0]?.id ||
        null;

      const nextVariantOptions = workspace.variants.filter((entry) => entry.familyId === nextFamilyId);
      const nextVariantId =
        preferred?.variantId ||
        (selectedVariantId && nextVariantOptions.some((entry) => entry.id === selectedVariantId) ? selectedVariantId : null) ||
        nextVariantOptions[0]?.id ||
        null;

      const nextRuntimeOptions = workspace.runtimeRecords.filter((entry) => entry.variantId === nextVariantId);
      const nextRuntimeId =
        preferred?.runtimeId ||
        (selectedRuntimeId && nextRuntimeOptions.some((entry) => entry.id === selectedRuntimeId) ? selectedRuntimeId : null) ||
        nextRuntimeOptions[0]?.id ||
        null;

      setSelectedFamilyId(nextFamilyId);
      setSelectedVariantId(nextVariantId);
      setSelectedRuntimeId(nextRuntimeId);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, []);

  const selectedFamily = useMemo(
    () => families.find((entry) => entry.id === selectedFamilyId) || null,
    [families, selectedFamilyId]
  );

  const familyVariants = useMemo(
    () => variants.filter((entry) => entry.familyId === selectedFamilyId),
    [variants, selectedFamilyId]
  );

  const selectedVariant = useMemo(
    () => familyVariants.find((entry) => entry.id === selectedVariantId) || null,
    [familyVariants, selectedVariantId]
  );

  const variantRuntimeRecords = useMemo(
    () => runtimeRecords.filter((entry) => entry.variantId === selectedVariantId),
    [runtimeRecords, selectedVariantId]
  );

  const selectedRuntime = useMemo(
    () => variantRuntimeRecords.find((entry) => entry.id === selectedRuntimeId) || null,
    [variantRuntimeRecords, selectedRuntimeId]
  );

  useEffect(() => {
    setFamilyDraft(selectedFamily);
    if (selectedFamily) {
      void protocolRegistryService.listFamilyHistory(selectedFamily.id).then(setFamilyHistory);
    } else {
      setFamilyHistory([]);
    }
  }, [selectedFamily]);

  useEffect(() => {
    setVariantDraft(selectedVariant);
    if (selectedVariant) {
      void protocolRegistryService.listVariantHistory(selectedVariant.id).then(setVariantHistory);
    } else {
      setVariantHistory([]);
    }
  }, [selectedVariant]);

  useEffect(() => {
    setRuntimeDraft(selectedRuntime);
    if (selectedRuntime) {
      void protocolRegistryService.listHistory(selectedRuntime.id).then(setRuntimeHistory);
    } else {
      setRuntimeHistory([]);
    }
  }, [selectedRuntime]);

  const publishedRuntimeRecords = useMemo(
    () => runtimeRecords.filter((entry) => entry.publishStatus === 'published' && entry.isActive),
    [runtimeRecords]
  );

  const stageCounts = useMemo(() => {
    return GOVERNANCE_STAGE_OPTIONS.reduce<Record<string, number>>((acc, stage) => {
      acc[stage] = families.filter((family) => family.governanceStage === stage).length;
      return acc;
    }, {});
  }, [families]);

  const classRows = useMemo(() => {
    return ['regulation', 'priming', 'recovery'].map((protocolClass) => {
      const classProtocols = publishedRuntimeRecords.filter((protocol) => protocol.protocolClass === protocolClass);
      const categories = Array.from(new Set(classProtocols.map((protocol) => protocol.category))).sort();
      return [
        protocolClass,
        String(classProtocols.length),
        categories.length ? categories.join(', ') : 'None yet',
        CLASS_EXPLANATIONS[protocolClass],
      ];
    });
  }, [publishedRuntimeRecords]);

  const inventoryRows = useMemo(() => {
    return publishedRuntimeRecords.map((protocol) => [
      <div key={protocol.id} className="space-y-1">
        <div className="font-medium text-white">{protocol.label}</div>
        <div className="text-xs text-zinc-500">{protocol.id}</div>
      </div>,
      <div key={`${protocol.id}-family`} className="space-y-1">
        <div>{protocol.familyLabel}</div>
        <div className="text-xs text-zinc-500">{protocol.variantLabel} · {protocol.variantVersion}</div>
      </div>,
      <div key={`${protocol.id}-meta`} className="flex flex-wrap gap-2">
        <InlineTag label={protocol.protocolClass} color="blue" />
        <InlineTag label={protocol.category} color="green" />
        <InlineTag label={protocol.responseFamily.replace(/_/g, ' ')} color="amber" />
      </div>,
      <div key={`${protocol.id}-delivery`} className="space-y-1">
        <div>{protocol.deliveryMode.replace(/_/g, ' ')}</div>
        <div className="text-xs text-zinc-500">{Math.round(protocol.durationSeconds / 60)} min</div>
      </div>,
      <div key={`${protocol.id}-tags`} className="space-y-1">
        <div className="text-zinc-300">{protocol.triggerTags.slice(0, 3).map(humanizeTag).join(', ') || 'No trigger tags'}</div>
        <div className="text-xs text-zinc-500">{protocol.useWindowTags.slice(0, 2).map(humanizeTag).join(', ') || 'General use'}</div>
      </div>,
    ]);
  }, [publishedRuntimeRecords]);

  const updateFamilyDraft = <K extends keyof PulseCheckProtocolFamily>(key: K, value: PulseCheckProtocolFamily[K]) => {
    setFamilyDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const updateVariantDraft = <K extends keyof PulseCheckProtocolVariant>(key: K, value: PulseCheckProtocolVariant[K]) => {
    setVariantDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const updateRuntimeDraft = <K extends keyof PulseCheckProtocolDefinition>(key: K, value: PulseCheckProtocolDefinition[K]) => {
    setRuntimeDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const syncSeedProtocols = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await protocolRegistryService.syncSeedProtocols();
      setSyncMessage(`Synced protocol workspace seeds. Created ${result.created}, updated ${result.updated}.`);
      await loadWorkspace({ familyId: selectedFamilyId, variantId: selectedVariantId, runtimeId: selectedRuntimeId });
    } catch (error) {
      console.error('Failed to sync protocol registry seeds:', error);
      setSyncMessage('Failed to sync protocol registry seeds.');
    } finally {
      setSyncing(false);
    }
  };

  const createFamily = async () => {
    setWorking('create-family');
    setWorkspaceMessage(null);
    try {
      const family = await protocolRegistryService.createFamilyDraft();
      setWorkspaceMessage(`Created family ${family.label}.`);
      await loadWorkspace({ familyId: family.id });
    } catch (error) {
      console.error('Failed to create protocol family:', error);
      setWorkspaceMessage('Failed to create protocol family.');
    } finally {
      setWorking(null);
    }
  };

  const createVariant = async () => {
    if (!familyDraft) return;
    setWorking('create-variant');
    setWorkspaceMessage(null);
    try {
      const family = await protocolRegistryService.saveFamily(familyDraft);
      const variant = await protocolRegistryService.createVariantDraft(family);
      setWorkspaceMessage(`Created variant ${variant.label}.`);
      await loadWorkspace({ familyId: family.id, variantId: variant.id });
    } catch (error) {
      console.error('Failed to create protocol variant:', error);
      setWorkspaceMessage('Failed to create protocol variant.');
    } finally {
      setWorking(null);
    }
  };

  const createRuntime = async () => {
    if (!familyDraft || !variantDraft) return;
    setWorking('create-runtime');
    setWorkspaceMessage(null);
    try {
      const family = await protocolRegistryService.saveFamily(familyDraft);
      const variant = await protocolRegistryService.saveVariant({ ...variantDraft, familyId: family.id });
      const runtime = await protocolRegistryService.createRuntimeDraft(family, variant);
      setWorkspaceMessage(`Created runtime record ${runtime.label}.`);
      await loadWorkspace({ familyId: family.id, variantId: variant.id, runtimeId: runtime.id });
    } catch (error) {
      console.error('Failed to create runtime record:', error);
      setWorkspaceMessage('Failed to create runtime record.');
    } finally {
      setWorking(null);
    }
  };

  const saveFamily = async () => {
    if (!familyDraft) return;
    setWorking('save-family');
    setWorkspaceMessage(null);
    try {
      const family = await protocolRegistryService.saveFamily(familyDraft);
      setWorkspaceMessage(`Saved family ${family.label}.`);
      await loadWorkspace({ familyId: family.id, variantId: selectedVariantId, runtimeId: selectedRuntimeId });
    } catch (error) {
      console.error('Failed to save protocol family:', error);
      setWorkspaceMessage('Failed to save protocol family.');
    } finally {
      setWorking(null);
    }
  };

  const saveVariant = async () => {
    if (!variantDraft || !familyDraft) return;
    setWorking('save-variant');
    setWorkspaceMessage(null);
    try {
      const family = await protocolRegistryService.saveFamily(familyDraft);
      const variant = await protocolRegistryService.saveVariant({ ...variantDraft, familyId: family.id });
      setWorkspaceMessage(`Saved variant ${variant.label}.`);
      await loadWorkspace({ familyId: family.id, variantId: variant.id, runtimeId: selectedRuntimeId });
    } catch (error) {
      console.error('Failed to save protocol variant:', error);
      setWorkspaceMessage('Failed to save protocol variant.');
    } finally {
      setWorking(null);
    }
  };

  const saveRuntime = async () => {
    if (!runtimeDraft || !familyDraft || !variantDraft) return;
    setWorking('save-runtime');
    setWorkspaceMessage(null);
    try {
      const family = await protocolRegistryService.saveFamily(familyDraft);
      const variant = await protocolRegistryService.saveVariant({ ...variantDraft, familyId: family.id });
      const runtime = await protocolRegistryService.save({ ...runtimeDraft, familyId: family.id, variantId: variant.id });
      setWorkspaceMessage(`Saved runtime record ${runtime.label}.`);
      await loadWorkspace({ familyId: family.id, variantId: variant.id, runtimeId: runtime.id });
    } catch (error) {
      console.error('Failed to save runtime record:', error);
      setWorkspaceMessage('Failed to save runtime record.');
    } finally {
      setWorking(null);
    }
  };

  const publishRuntime = async () => {
    if (!runtimeDraft || !familyDraft || !variantDraft) return;
    setWorking('publish-runtime');
    setWorkspaceMessage(null);
    try {
      const family = await protocolRegistryService.saveFamily({ ...familyDraft, familyStatus: 'locked' });
      const variant = await protocolRegistryService.saveVariant({ ...variantDraft, familyId: family.id });
      const runtime = await protocolRegistryService.save({ ...runtimeDraft, familyId: family.id, variantId: variant.id });
      const published = await protocolRegistryService.publish(runtime);
      setWorkspaceMessage(`Published ${published.label}.`);
      await loadWorkspace({ familyId: family.id, variantId: variant.id, runtimeId: published.id });
    } catch (error) {
      console.error('Failed to publish runtime record:', error);
      setWorkspaceMessage('Failed to publish runtime record.');
    } finally {
      setWorking(null);
    }
  };

  const archiveRuntime = async () => {
    if (!runtimeDraft || !familyDraft || !variantDraft) return;
    setWorking('archive-runtime');
    setWorkspaceMessage(null);
    try {
      const family = await protocolRegistryService.saveFamily(familyDraft);
      const variant = await protocolRegistryService.saveVariant({ ...variantDraft, familyId: family.id });
      const runtime = await protocolRegistryService.save({ ...runtimeDraft, familyId: family.id, variantId: variant.id });
      const archived = await protocolRegistryService.archive(runtime);
      setWorkspaceMessage(`Archived ${archived.label}.`);
      await loadWorkspace({ familyId: family.id, variantId: variant.id, runtimeId: archived.id });
    } catch (error) {
      console.error('Failed to archive runtime record:', error);
      setWorkspaceMessage('Failed to archive runtime record.');
    } finally {
      setWorking(null);
    }
  };

  const familyDirty = compareDraft(familyDraft) !== compareDraft(selectedFamily);
  const variantDirty = compareDraft(variantDraft) !== compareDraft(selectedVariant);
  const runtimeDirty = compareDraft(runtimeDraft) !== compareDraft(selectedRuntime);
  const publishBlocked =
    !familyDraft ||
    !variantDraft ||
    !runtimeDraft ||
    familyDraft.reviewStatus !== 'approved' ||
    variantDraft.approvalStatus !== 'approved' ||
    runtimeDraft.reviewStatus !== 'approved';

  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Runtime"
        title="Protocol Registry"
        version="Version 0.3 | March 17, 2026"
        summary="Operational sibling to the sim Variant Registry for Nora’s bounded protocol inventory. This workspace now models the real hierarchy: protocol families define the intervention lane, protocol variants define the authored expression, and published runtime records are the bounded objects Nora can actually assign."
        highlights={[
          { title: 'Three-Layer Model', body: 'Families, variants, and published runtime records now exist as separate authoring objects instead of being flattened onto one protocol row.' },
          { title: 'Sim-Like Discipline', body: 'The workspace now mirrors the sim system more closely: upstream object shaping first, bounded runtime publication second.' },
          { title: 'Published Inventory Only', body: 'Nora still only plans from published active runtime records, which keeps the live candidate set bounded and reviewable.' },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Execution-inventory artifact and authoring workspace for bounded PulseCheck protocols. It now treats families, variants, and runtime records as separate layers, which is the same conceptual discipline we use for sim families and sim variants."
        sourceOfTruth="The Firestore-backed `pulsecheck-protocol-families`, `pulsecheck-protocol-variants`, and `pulsecheck-protocols` collections now form the shared protocol registry stack."
        masterReference="Use Variant Registry for simulation/trial inventory and this page for protocol-family, protocol-variant, and protocol-runtime inventory. Both feed the bounded candidate-set assembler, but the object models stay intentionally distinct."
        relatedDocs={[
          'Protocol Governance Spec',
          'Protocol Authoring Workflow',
          'Protocol Responsiveness Profile Spec',
          'Variant Registry',
          'Check-In ↔ AI Signal Layer Integration Spec',
          'Nora Assignment Rules',
        ]}
      />

      <SectionBlock icon={BookCopy} title="Registry Posture">
        <CardGrid columns="md:grid-cols-4">
          <InfoCard title="Protocol Families" accent="blue" body={loading ? 'Loading registry...' : `${families.length} family objects are currently in the registry.`} />
          <InfoCard title="Protocol Variants" accent="amber" body={loading ? 'Loading registry...' : `${variants.length} variant objects are currently in the registry.`} />
          <InfoCard title="Published Runtime Inventory" accent="green" body={loading ? 'Loading registry...' : `${publishedRuntimeRecords.length} published active runtime records are currently eligible for Nora planning.`} />
          <InfoCard title="Structured Or Better" accent="red" body={loading ? 'Loading registry...' : `${(stageCounts.structured || 0) + (stageCounts.sandbox || 0) + (stageCounts.pilot || 0) + (stageCounts.published || 0)} families have moved beyond nomination into actual authoring posture.`} />
        </CardGrid>
        <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">Seed Sync</p>
            <p className="text-sm text-zinc-400">
              Reconcile the in-repo starter inventory into Firestore as linked families, variants, and runtime records. Seed sync should backfill the baseline hierarchy, not replace authoring.
            </p>
            {syncMessage ? <p className="text-xs text-zinc-500">{syncMessage}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => void syncSeedProtocols()}
            disabled={syncing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-zinc-500 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Seed Protocols'}
          </button>
        </div>
      </SectionBlock>

      <SectionBlock icon={GitBranch} title="Hierarchy Workspace">
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-3xl border border-zinc-800 bg-[#090f1c] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Families</p>
                <p className="text-xs text-zinc-500">Intervention lanes and governance posture.</p>
              </div>
              <button type="button" onClick={() => void createFamily()} disabled={working !== null} className="inline-flex items-center gap-2 rounded-xl border border-lime-500/40 bg-lime-500/10 px-3 py-2 text-xs font-semibold text-lime-200 transition hover:bg-lime-500/15 disabled:opacity-60">
                <PlusCircle className="h-4 w-4" />
                New
              </button>
            </div>
            <div className="space-y-2">
              {families.map((family) => (
                <button key={family.id} type="button" onClick={() => setSelectedFamilyId(family.id)} className={listButtonClass(family.id === selectedFamilyId)}>
                  <div className="font-medium text-white">{family.label}</div>
                  <div className="mt-1 text-xs text-zinc-500">{family.id}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <InlineTag label={family.protocolClass} color="blue" />
                    <InlineTag label={family.governanceStage} color="amber" />
                    <InlineTag label={family.reviewStatus} color={reviewStatusColor(family.reviewStatus)} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-[#090f1c] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Variants</p>
                <p className="text-xs text-zinc-500">Authored expressions inside the selected family.</p>
              </div>
              <button type="button" onClick={() => void createVariant()} disabled={!familyDraft || working !== null} className="inline-flex items-center gap-2 rounded-xl border border-lime-500/40 bg-lime-500/10 px-3 py-2 text-xs font-semibold text-lime-200 transition hover:bg-lime-500/15 disabled:opacity-60">
                <PlusCircle className="h-4 w-4" />
                New
              </button>
            </div>
            <div className="space-y-2">
              {familyVariants.length ? familyVariants.map((variant) => (
                <button key={variant.id} type="button" onClick={() => setSelectedVariantId(variant.id)} className={listButtonClass(variant.id === selectedVariantId)}>
                  <div className="font-medium text-white">{variant.label}</div>
                  <div className="mt-1 text-xs text-zinc-500">{variant.variantVersion} · {variant.variantKey}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <InlineTag label={variant.deliveryMode.replace(/_/g, ' ')} color="blue" />
                    <InlineTag label={variant.governanceStage} color="amber" />
                    <InlineTag label={variant.approvalStatus} color={reviewStatusColor(variant.approvalStatus)} />
                  </div>
                </button>
              )) : <div className="rounded-2xl border border-zinc-800 bg-black/20 px-4 py-6 text-sm text-zinc-500">Select a family to view or create variants.</div>}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-[#090f1c] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Runtime Records</p>
                <p className="text-xs text-zinc-500">Bounded published objects Nora can actually assign.</p>
              </div>
              <button type="button" onClick={() => void createRuntime()} disabled={!familyDraft || !variantDraft || working !== null} className="inline-flex items-center gap-2 rounded-xl border border-lime-500/40 bg-lime-500/10 px-3 py-2 text-xs font-semibold text-lime-200 transition hover:bg-lime-500/15 disabled:opacity-60">
                <PlusCircle className="h-4 w-4" />
                New
              </button>
            </div>
            <div className="space-y-2">
              {variantRuntimeRecords.length ? variantRuntimeRecords.map((runtime) => (
                <button key={runtime.id} type="button" onClick={() => setSelectedRuntimeId(runtime.id)} className={listButtonClass(runtime.id === selectedRuntimeId)}>
                  <div className="font-medium text-white">{runtime.label}</div>
                  <div className="mt-1 text-xs text-zinc-500">{runtime.id}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <InlineTag label={runtime.publishStatus} color={runtime.publishStatus === 'published' ? 'green' : runtime.publishStatus === 'archived' ? 'red' : 'amber'} />
                    <InlineTag label={runtime.protocolClass} color="blue" />
                    <InlineTag label={runtime.reviewStatus} color={reviewStatusColor(runtime.reviewStatus)} />
                  </div>
                </button>
              )) : <div className="rounded-2xl border border-zinc-800 bg-black/20 px-4 py-6 text-sm text-zinc-500">Select a variant to view or create runtime records.</div>}
            </div>
          </div>
        </div>

        {workspaceMessage ? <p className="text-sm text-zinc-400">{workspaceMessage}</p> : null}

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-3xl border border-zinc-800 bg-[#090f1c] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-zinc-400" />
                <p className="text-sm font-semibold text-white">Family Workspace</p>
              </div>
              <button type="button" onClick={() => void saveFamily()} disabled={!familyDraft || working !== null} className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-zinc-500 hover:bg-white/10 disabled:opacity-60">
                <Save className="h-4 w-4" />
                Save
              </button>
            </div>
            {familyDraft ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <InlineTag label={familyDraft.reviewStatus} color={reviewStatusColor(familyDraft.reviewStatus)} />
                  <InlineTag label={familyDraft.evidenceStatus} color={familyDraft.evidenceStatus === 'credible' ? 'green' : familyDraft.evidenceStatus === 'watch' ? 'red' : 'amber'} />
                  <InlineTag label={`${familyDraft.reviewCadenceDays}d cadence`} color="blue" />
                </div>
                <FieldShell label="Family Label"><input className={inputClassName} value={familyDraft.label} onChange={(event) => updateFamilyDraft('label', event.target.value)} /></FieldShell>
                <FieldShell label="Protocol Class">
                  <select className={inputClassName} value={familyDraft.protocolClass} onChange={(event) => updateFamilyDraft('protocolClass', event.target.value as ActiveProtocolClass)}>
                    {PROTOCOL_CLASS_OPTIONS.map((option) => <option key={option} value={option}>{humanizeTag(option)}</option>)}
                  </select>
                </FieldShell>
                <FieldShell label="Response Family">
                  <select className={inputClassName} value={familyDraft.responseFamily} onChange={(event) => updateFamilyDraft('responseFamily', event.target.value as PulseCheckProtocolResponseFamily)}>
                    {RESPONSE_FAMILY_OPTIONS.map((option) => <option key={option} value={option}>{humanizeTag(option)}</option>)}
                  </select>
                </FieldShell>
                <FieldShell label="Family Status">
                  <select className={inputClassName} value={familyDraft.familyStatus} onChange={(event) => updateFamilyDraft('familyStatus', event.target.value as PulseCheckProtocolFamilyStatus)}>
                    {FAMILY_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{humanizeTag(option)}</option>)}
                  </select>
                </FieldShell>
                <FieldShell label="Governance Stage">
                  <select className={inputClassName} value={familyDraft.governanceStage} onChange={(event) => updateFamilyDraft('governanceStage', event.target.value as PulseCheckProtocolGovernanceStage)}>
                    {GOVERNANCE_STAGE_OPTIONS.map((option) => <option key={option} value={option}>{humanizeTag(option)}</option>)}
                  </select>
                </FieldShell>
                <FieldShell label="Mechanism Summary"><textarea className={textareaClassName} value={familyDraft.mechanismSummary} onChange={(event) => updateFamilyDraft('mechanismSummary', event.target.value)} /></FieldShell>
                <FieldShell label="Target Bottleneck"><textarea className={textareaClassName} value={familyDraft.targetBottleneck} onChange={(event) => updateFamilyDraft('targetBottleneck', event.target.value)} /></FieldShell>
                <FieldShell label="Expected State Shift"><textarea className={textareaClassName} value={familyDraft.expectedStateShift} onChange={(event) => updateFamilyDraft('expectedStateShift', event.target.value)} /></FieldShell>
                <FieldShell label="Use Window Tags"><input className={inputClassName} value={familyDraft.useWindowTags.join(', ')} onChange={(event) => updateFamilyDraft('useWindowTags', parseTags(event.target.value))} /></FieldShell>
                <FieldShell label="Avoid Window Tags"><input className={inputClassName} value={familyDraft.avoidWindowTags.join(', ')} onChange={(event) => updateFamilyDraft('avoidWindowTags', parseTags(event.target.value))} /></FieldShell>
                <FieldShell label="Contraindication Tags"><input className={inputClassName} value={familyDraft.contraindicationTags.join(', ')} onChange={(event) => updateFamilyDraft('contraindicationTags', parseTags(event.target.value))} /></FieldShell>
                <FieldShell label="Source References"><input className={inputClassName} value={familyDraft.sourceReferences.join(', ')} onChange={(event) => updateFamilyDraft('sourceReferences', parseTags(event.target.value))} /></FieldShell>
                <FieldShell label="Evidence Summary"><textarea className={textareaClassName} value={familyDraft.evidenceSummary || ''} onChange={(event) => updateFamilyDraft('evidenceSummary', event.target.value || undefined)} /></FieldShell>
                <FieldShell label="Review Notes"><textarea className={textareaClassName} value={familyDraft.reviewNotes || ''} onChange={(event) => updateFamilyDraft('reviewNotes', event.target.value || undefined)} /></FieldShell>
                <FieldShell label="Review Cadence Days"><input className={inputClassName} type="number" value={familyDraft.reviewCadenceDays} onChange={(event) => updateFamilyDraft('reviewCadenceDays', Number(event.target.value) || 0)} /></FieldShell>
                <div className="text-xs text-zinc-500">{familyDirty ? 'Unsaved changes' : 'Workspace in sync'} · Updated {formatDate(familyDraft.updatedAt)}</div>
                <div className="space-y-2 border-t border-zinc-800 pt-4">
                  <div className="text-sm font-semibold text-white">Review Gates</div>
                  {renderChecklist(familyDraft.reviewChecklist)}
                </div>
                <div className="space-y-2 border-t border-zinc-800 pt-4">
                  <div className="text-sm font-semibold text-white">Evidence & Responsiveness</div>
                  <div className="text-xs text-zinc-500">This panel is fed from live protocol assignment and assignment-event behavior, not manual admin counters.</div>
                  {renderEvidencePanel(familyDraft.evidencePanel)}
                </div>
                <div className="space-y-2 border-t border-zinc-800 pt-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white"><History className="h-4 w-4 text-zinc-400" /> History</div>
                  {familyHistory.slice(0, 4).map((entry) => <div key={entry.id} className="rounded-2xl border border-zinc-800 bg-black/20 p-3 text-sm text-zinc-300">{entry.summary}<div className="mt-1 text-xs text-zinc-500">{formatDate(entry.createdAt)}</div></div>)}
                </div>
              </div>
            ) : <div className="text-sm text-zinc-500">Select a family to edit.</div>}
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-[#090f1c] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-zinc-400" />
                <p className="text-sm font-semibold text-white">Variant Workspace</p>
              </div>
              <button type="button" onClick={() => void saveVariant()} disabled={!variantDraft || working !== null} className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-zinc-500 hover:bg-white/10 disabled:opacity-60">
                <Save className="h-4 w-4" />
                Save
              </button>
            </div>
            {variantDraft ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <InlineTag label={variantDraft.approvalStatus} color={reviewStatusColor(variantDraft.approvalStatus)} />
                  <InlineTag label={variantDraft.evidenceStatus} color={variantDraft.evidenceStatus === 'credible' ? 'green' : variantDraft.evidenceStatus === 'watch' ? 'red' : 'amber'} />
                  <InlineTag label={`${variantDraft.reviewCadenceDays}d cadence`} color="blue" />
                </div>
                <FieldShell label="Variant Label"><input className={inputClassName} value={variantDraft.label} onChange={(event) => updateVariantDraft('label', event.target.value)} /></FieldShell>
                <FieldShell label="Variant Key"><input className={inputClassName} value={variantDraft.variantKey} onChange={(event) => updateVariantDraft('variantKey', event.target.value)} /></FieldShell>
                <FieldShell label="Variant Version"><input className={inputClassName} value={variantDraft.variantVersion} onChange={(event) => updateVariantDraft('variantVersion', event.target.value)} /></FieldShell>
                <FieldShell label="Category">
                  <select className={inputClassName} value={variantDraft.category} onChange={(event) => updateVariantDraft('category', event.target.value as ExerciseCategory)}>
                    {CATEGORY_OPTIONS.map((option) => <option key={option} value={option}>{humanizeTag(option)}</option>)}
                  </select>
                </FieldShell>
                <FieldShell label="Delivery Mode">
                  <select className={inputClassName} value={variantDraft.deliveryMode} onChange={(event) => updateVariantDraft('deliveryMode', event.target.value as PulseCheckProtocolDeliveryMode)}>
                    {DELIVERY_OPTIONS.map((option) => <option key={option} value={option}>{humanizeTag(option)}</option>)}
                  </select>
                </FieldShell>
                <FieldShell label="Governance Stage">
                  <select className={inputClassName} value={variantDraft.governanceStage} onChange={(event) => updateVariantDraft('governanceStage', event.target.value as PulseCheckProtocolGovernanceStage)}>
                    {GOVERNANCE_STAGE_OPTIONS.map((option) => <option key={option} value={option}>{humanizeTag(option)}</option>)}
                  </select>
                </FieldShell>
                <FieldShell label="Legacy Exercise Id"><input className={inputClassName} value={variantDraft.legacyExerciseId} onChange={(event) => updateVariantDraft('legacyExerciseId', event.target.value)} /></FieldShell>
                <FieldShell label="Duration Seconds"><input className={inputClassName} type="number" value={variantDraft.durationSeconds} onChange={(event) => updateVariantDraft('durationSeconds', Number(event.target.value) || 0)} /></FieldShell>
                <FieldShell label="Rationale"><textarea className={textareaClassName} value={variantDraft.rationale} onChange={(event) => updateVariantDraft('rationale', event.target.value)} /></FieldShell>
                <FieldShell label="Script Summary"><textarea className={textareaClassName} value={variantDraft.scriptSummary} onChange={(event) => updateVariantDraft('scriptSummary', event.target.value)} /></FieldShell>
                <FieldShell label="Trigger Tags"><input className={inputClassName} value={variantDraft.triggerTags.join(', ')} onChange={(event) => updateVariantDraft('triggerTags', parseTags(event.target.value))} /></FieldShell>
                <FieldShell label="Preferred Context Tags"><input className={inputClassName} value={variantDraft.preferredContextTags.join(', ')} onChange={(event) => updateVariantDraft('preferredContextTags', parseTags(event.target.value))} /></FieldShell>
                <FieldShell label="Use Window Tags"><input className={inputClassName} value={variantDraft.useWindowTags.join(', ')} onChange={(event) => updateVariantDraft('useWindowTags', parseTags(event.target.value))} /></FieldShell>
                <FieldShell label="Avoid Window Tags"><input className={inputClassName} value={variantDraft.avoidWindowTags.join(', ')} onChange={(event) => updateVariantDraft('avoidWindowTags', parseTags(event.target.value))} /></FieldShell>
                <FieldShell label="Contraindication Tags"><input className={inputClassName} value={variantDraft.contraindicationTags.join(', ')} onChange={(event) => updateVariantDraft('contraindicationTags', parseTags(event.target.value))} /></FieldShell>
                <FieldShell label="Evidence Summary"><textarea className={textareaClassName} value={variantDraft.evidenceSummary || ''} onChange={(event) => updateVariantDraft('evidenceSummary', event.target.value || undefined)} /></FieldShell>
                <FieldShell label="Review Notes"><textarea className={textareaClassName} value={variantDraft.reviewNotes || ''} onChange={(event) => updateVariantDraft('reviewNotes', event.target.value || undefined)} /></FieldShell>
                <FieldShell label="Review Cadence Days"><input className={inputClassName} type="number" value={variantDraft.reviewCadenceDays} onChange={(event) => updateVariantDraft('reviewCadenceDays', Number(event.target.value) || 0)} /></FieldShell>
                <div className="text-xs text-zinc-500">{variantDirty ? 'Unsaved changes' : 'Workspace in sync'} · Updated {formatDate(variantDraft.updatedAt)}</div>
                <div className="space-y-2 border-t border-zinc-800 pt-4">
                  <div className="text-sm font-semibold text-white">Approval Gates</div>
                  {renderChecklist(variantDraft.reviewChecklist)}
                </div>
                <div className="space-y-2 border-t border-zinc-800 pt-4">
                  <div className="text-sm font-semibold text-white">Evidence & Responsiveness</div>
                  <div className="text-xs text-zinc-500">This panel is fed from live protocol assignment and assignment-event behavior, not manual admin counters.</div>
                  {renderEvidencePanel(variantDraft.evidencePanel)}
                </div>
                <div className="space-y-2 border-t border-zinc-800 pt-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white"><History className="h-4 w-4 text-zinc-400" /> History</div>
                  {variantHistory.slice(0, 4).map((entry) => <div key={entry.id} className="rounded-2xl border border-zinc-800 bg-black/20 p-3 text-sm text-zinc-300">{entry.summary}<div className="mt-1 text-xs text-zinc-500">{formatDate(entry.createdAt)}</div></div>)}
                </div>
              </div>
            ) : <div className="text-sm text-zinc-500">Select a variant to edit.</div>}
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-[#090f1c] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-zinc-400" />
                <p className="text-sm font-semibold text-white">Runtime Workspace</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void saveRuntime()} disabled={!runtimeDraft || working !== null} className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-zinc-500 hover:bg-white/10 disabled:opacity-60"><Save className="h-4 w-4" />Save</button>
                <button type="button" onClick={() => void publishRuntime()} disabled={publishBlocked || working !== null} className="inline-flex items-center gap-2 rounded-xl border border-lime-500/40 bg-lime-500/10 px-4 py-2 text-sm font-medium text-lime-200 transition hover:bg-lime-500/15 disabled:opacity-60"><Upload className="h-4 w-4" />Publish</button>
                <button type="button" onClick={() => void archiveRuntime()} disabled={!runtimeDraft || working !== null} className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/15 disabled:opacity-60"><Archive className="h-4 w-4" />Archive</button>
              </div>
            </div>
            {runtimeDraft ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <InlineTag label={runtimeDraft.reviewStatus} color={reviewStatusColor(runtimeDraft.reviewStatus)} />
                  <InlineTag label={runtimeDraft.evidenceStatus} color={runtimeDraft.evidenceStatus === 'credible' ? 'green' : runtimeDraft.evidenceStatus === 'watch' ? 'red' : 'amber'} />
                  <InlineTag label={`${runtimeDraft.reviewCadenceDays}d cadence`} color="blue" />
                </div>
                <FieldShell label="Runtime Label"><input className={inputClassName} value={runtimeDraft.label} onChange={(event) => updateRuntimeDraft('label', event.target.value)} /></FieldShell>
                <FieldShell label="Publish Status">
                  <select className={inputClassName} value={runtimeDraft.publishStatus} onChange={(event) => updateRuntimeDraft('publishStatus', event.target.value as PulseCheckProtocolPublishStatus)}>
                    {PUBLISH_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{humanizeTag(option)}</option>)}
                  </select>
                </FieldShell>
                <FieldShell label="Protocol Class">
                  <select className={inputClassName} value={runtimeDraft.protocolClass} onChange={(event) => updateRuntimeDraft('protocolClass', event.target.value as ActiveProtocolClass)}>
                    {PROTOCOL_CLASS_OPTIONS.map((option) => <option key={option} value={option}>{humanizeTag(option)}</option>)}
                  </select>
                </FieldShell>
                <FieldShell label="Category">
                  <select className={inputClassName} value={runtimeDraft.category} onChange={(event) => updateRuntimeDraft('category', event.target.value as ExerciseCategory)}>
                    {CATEGORY_OPTIONS.map((option) => <option key={option} value={option}>{humanizeTag(option)}</option>)}
                  </select>
                </FieldShell>
                <FieldShell label="Delivery Mode">
                  <select className={inputClassName} value={runtimeDraft.deliveryMode} onChange={(event) => updateRuntimeDraft('deliveryMode', event.target.value as PulseCheckProtocolDeliveryMode)}>
                    {DELIVERY_OPTIONS.map((option) => <option key={option} value={option}>{humanizeTag(option)}</option>)}
                  </select>
                </FieldShell>
                <FieldShell label="Sort Order"><input className={inputClassName} type="number" value={runtimeDraft.sortOrder} onChange={(event) => updateRuntimeDraft('sortOrder', Number(event.target.value) || 0)} /></FieldShell>
                <FieldShell label="Duration Seconds"><input className={inputClassName} type="number" value={runtimeDraft.durationSeconds} onChange={(event) => updateRuntimeDraft('durationSeconds', Number(event.target.value) || 0)} /></FieldShell>
                <FieldShell label="Legacy Exercise Id"><input className={inputClassName} value={runtimeDraft.legacyExerciseId} onChange={(event) => updateRuntimeDraft('legacyExerciseId', event.target.value)} /></FieldShell>
                <FieldShell label="Rationale"><textarea className={textareaClassName} value={runtimeDraft.rationale} onChange={(event) => updateRuntimeDraft('rationale', event.target.value)} /></FieldShell>
                <FieldShell label="Mechanism"><textarea className={textareaClassName} value={runtimeDraft.mechanism} onChange={(event) => updateRuntimeDraft('mechanism', event.target.value)} /></FieldShell>
                <FieldShell label="Expected State Shift"><textarea className={textareaClassName} value={runtimeDraft.expectedStateShift} onChange={(event) => updateRuntimeDraft('expectedStateShift', event.target.value)} /></FieldShell>
                <FieldShell label="Trigger Tags"><input className={inputClassName} value={runtimeDraft.triggerTags.join(', ')} onChange={(event) => updateRuntimeDraft('triggerTags', parseTags(event.target.value))} /></FieldShell>
                <FieldShell label="Preferred Context Tags"><input className={inputClassName} value={runtimeDraft.preferredContextTags.join(', ')} onChange={(event) => updateRuntimeDraft('preferredContextTags', parseTags(event.target.value))} /></FieldShell>
                <FieldShell label="Use Window Tags"><input className={inputClassName} value={runtimeDraft.useWindowTags.join(', ')} onChange={(event) => updateRuntimeDraft('useWindowTags', parseTags(event.target.value))} /></FieldShell>
                <FieldShell label="Avoid Window Tags"><input className={inputClassName} value={runtimeDraft.avoidWindowTags.join(', ')} onChange={(event) => updateRuntimeDraft('avoidWindowTags', parseTags(event.target.value))} /></FieldShell>
                <FieldShell label="Contraindication Tags"><input className={inputClassName} value={runtimeDraft.contraindicationTags.join(', ')} onChange={(event) => updateRuntimeDraft('contraindicationTags', parseTags(event.target.value))} /></FieldShell>
                <FieldShell label="Evidence Summary"><textarea className={textareaClassName} value={runtimeDraft.evidenceSummary || ''} onChange={(event) => updateRuntimeDraft('evidenceSummary', event.target.value || undefined)} /></FieldShell>
                <FieldShell label="Review Notes"><textarea className={textareaClassName} value={runtimeDraft.reviewNotes || ''} onChange={(event) => updateRuntimeDraft('reviewNotes', event.target.value || undefined)} /></FieldShell>
                <FieldShell label="Review Cadence Days"><input className={inputClassName} type="number" value={runtimeDraft.reviewCadenceDays} onChange={(event) => updateRuntimeDraft('reviewCadenceDays', Number(event.target.value) || 0)} /></FieldShell>
                <div className="text-xs text-zinc-500">{runtimeDirty ? 'Unsaved changes' : 'Workspace in sync'} · Updated {formatDate(runtimeDraft.updatedAt)} · Published {formatDate(runtimeDraft.publishedAt)}</div>
                {publishBlocked ? <div className="text-xs text-amber-300">Publish is gated until family review, variant approval, and runtime publish gates are all approved.</div> : null}
                <div className="space-y-2 border-t border-zinc-800 pt-4">
                  <div className="text-sm font-semibold text-white">Publish Gates</div>
                  {renderChecklist(runtimeDraft.reviewChecklist)}
                </div>
                <div className="space-y-2 border-t border-zinc-800 pt-4">
                  <div className="text-sm font-semibold text-white">Evidence & Responsiveness</div>
                  <div className="text-xs text-zinc-500">This panel is fed from live protocol assignment and assignment-event behavior, not manual admin counters.</div>
                  {renderEvidencePanel(runtimeDraft.evidencePanel)}
                </div>
                <div className="space-y-2 border-t border-zinc-800 pt-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white"><History className="h-4 w-4 text-zinc-400" /> History</div>
                  {runtimeHistory.slice(0, 4).map((entry) => <div key={entry.id} className="rounded-2xl border border-zinc-800 bg-black/20 p-3 text-sm text-zinc-300">{entry.summary}<div className="mt-1 text-xs text-zinc-500">{formatDate(entry.createdAt)}</div></div>)}
                </div>
              </div>
            ) : <div className="text-sm text-zinc-500">Select a runtime record to edit.</div>}
          </div>
        </div>
      </SectionBlock>

      <SectionBlock icon={SlidersHorizontal} title="Class Coverage">
        <DataTable columns={['Protocol Class', 'Published Count', 'Categories Represented', 'Role In Planning']} rows={classRows} />
      </SectionBlock>

      <SectionBlock icon={BrainCircuit} title="Published Inventory">
        <DataTable columns={['Protocol', 'Family / Variant', 'Runtime Identity', 'Delivery', 'Primary Triggers']} rows={inventoryRows} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Operating Rules">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard title="Why This Is Not In Variant Registry" accent="blue" body="The sim Variant Registry is build- and runtime-package oriented. Protocols need class, trigger, dose, delivery, governance, and publication semantics, but they do not have sim engines, locked trial specs, or vision packaging." />
          <InfoCard title="Shared Planning Boundary" accent="green" body="The candidate-set assembler should read published Sims from the sim variant/published-module path and published Protocol runtime records from this sibling registry, then hand both to the same bounded planner." />
        </CardGrid>
        <InfoCard
          title="Current Gaps"
          accent="amber"
          body={
            <BulletList
              items={[
                'Families, variants, and runtime records are now separate authoring objects, but we still need stronger evidence review, responsiveness analytics, and governance-specific approvals to make the system feel fully mature.',
                'The current workspace models the hierarchy correctly, but it is still a first-pass editor rather than a deeply opinionated publish-review pipeline like the sim side.',
                'Protocol sequencing and bundles remain intentionally deferred to v2 even though the hierarchy now leaves room for them later.',
              ]}
            />
          }
        />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Implementation Note">
        <InfoCard title="Current Runtime Truth" accent="amber" body="If the Firestore hierarchy is empty, the shared check-in runtime still seeds it from the in-repo starter file so the planner has a bounded published inventory. That remains an intentional bootstrap bridge, even now that the workspace supports distinct family, variant, and runtime records." />
      </SectionBlock>
    </div>
  );
};

export default ProtocolRegistryTab;
