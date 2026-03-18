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
  simModuleLibraryService,
  type MentalExercise,
  type PulseCheckProtocolClass,
  type PulseCheckProtocolDefinition,
  type PulseCheckProtocolEvidenceStatus,
  type PulseCheckProtocolDeliveryMode,
  type PulseCheckProtocolEvidenceSummary,
  type PulseCheckProtocolFamily,
  type PulseCheckProtocolFamilyHistoryEntry,
  type PulseCheckProtocolFamilyStatus,
  type PulseCheckProtocolGovernanceStage,
  type PulseCheckProtocolHistoryEntry,
  type PulseCheckProtocolResponseFamily,
  type PulseCheckProtocolReviewGate,
  type PulseCheckProtocolReviewStatus,
  type PulseCheckProtocolVariant,
  type PulseCheckProtocolVariantHistoryEntry,
} from '../../../api/firebase/mentaltraining';
import { getSeededProtocolFamilySpecById } from '../../../api/firebase/mentaltraining/pulsecheckProtocolFamilySpecs';
import { ExercisePlayer } from '../../mentaltraining';
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

function formatShortDate(timestamp?: number) {
  if (!timestamp) return 'Not set';
  return new Date(timestamp).toLocaleDateString();
}

function formatDurationSeconds(seconds?: number) {
  if (!seconds || seconds <= 0) return 'Not set';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

function formatTagList(tags: string[] | undefined, fallback = 'None configured', limit = 4) {
  if (!tags?.length) return fallback;
  const visible = tags.slice(0, limit).map(humanizeTag);
  const remainder = tags.length - visible.length;
  return remainder > 0 ? `${visible.join(', ')} +${remainder} more` : visible.join(', ');
}

function formatJsonPreview(value: unknown) {
  if (!value || (typeof value === 'object' && Object.keys(value as Record<string, unknown>).length === 0)) {
    return 'None';
  }
  return JSON.stringify(value, null, 2);
}

function compareDraft(record: unknown) {
  return JSON.stringify(record ?? null);
}

const REVIEW_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

type LaunchIssue = {
  label: string;
  detail?: string;
  severity: 'blocker' | 'warning';
};

type LaunchReadinessReport = {
  ready: boolean;
  dueAt?: number;
  dueLabel: string;
  blockers: LaunchIssue[];
  warnings: LaunchIssue[];
};

function deriveReviewDueAt(record: { nextReviewAt?: number; lastReviewedAt?: number; reviewCadenceDays?: number }) {
  if (typeof record.nextReviewAt === 'number') {
    return record.nextReviewAt;
  }

  if (typeof record.lastReviewedAt === 'number' && typeof record.reviewCadenceDays === 'number' && record.reviewCadenceDays > 0) {
    return record.lastReviewedAt + record.reviewCadenceDays * 24 * 60 * 60 * 1000;
  }

  return undefined;
}

function assessLaunchReadiness(record: {
  publishStatus?: PulseCheckProtocolDefinition['publishStatus'];
  isActive?: boolean;
  governanceStage?: PulseCheckProtocolGovernanceStage;
  reviewStatus?: PulseCheckProtocolReviewStatus;
  approvalStatus?: PulseCheckProtocolReviewStatus;
  reviewChecklist?: PulseCheckProtocolReviewGate[];
  reviewCadenceDays?: number;
  lastReviewedAt?: number;
  nextReviewAt?: number;
  evidenceStatus?: PulseCheckProtocolEvidenceStatus;
  evidenceSummary?: string;
  evidencePanel?: PulseCheckProtocolEvidenceSummary;
} | null): LaunchReadinessReport {
  if (!record) {
    return {
      ready: false,
      dueLabel: 'Not set',
      blockers: [],
      warnings: [],
    };
  }

  const now = Date.now();
  const blockers: LaunchIssue[] = [];
  const warnings: LaunchIssue[] = [];
  const dueAt = deriveReviewDueAt(record);
  const reviewStatus = record.reviewStatus || record.approvalStatus;
  const reviewChecklist = record.reviewChecklist || [];

  if (record.publishStatus && record.publishStatus !== 'published') {
    blockers.push({
      label: `Publish status is ${humanizeTag(record.publishStatus)}`,
      detail: 'The runtime must be published before Nora can use it in live inventory.',
      severity: 'blocker',
    });
  }

  if (record.isActive === false) {
    blockers.push({
      label: 'Record is inactive',
      detail: 'Inactive records are excluded from the live candidate set.',
      severity: 'blocker',
    });
  }

  if (reviewStatus && reviewStatus !== 'approved') {
    blockers.push({
      label: `Review status is ${humanizeTag(reviewStatus)}`,
      detail: 'This record still needs approval before launch.',
      severity: 'blocker',
    });
  }

  const blockedGates = reviewChecklist.filter((gate) => gate.status === 'blocked');
  const pendingGates = reviewChecklist.filter((gate) => gate.status === 'pending');
  if (blockedGates.length) {
    blockers.push({
      label: `${blockedGates.length} review gate${blockedGates.length === 1 ? '' : 's'} are blocked`,
      detail: blockedGates.map((gate) => gate.label).join(' • '),
      severity: 'blocker',
    });
  }
  if (pendingGates.length) {
    blockers.push({
      label: `${pendingGates.length} review gate${pendingGates.length === 1 ? '' : 's'} are still pending`,
      detail: pendingGates.map((gate) => gate.label).join(' • '),
      severity: 'blocker',
    });
  }

  if (dueAt) {
    const overdueBy = now - dueAt;
    if (overdueBy > 0) {
      blockers.push({
        label: `Review overdue since ${formatShortDate(dueAt)}`,
        detail: 'The review cadence has expired and the record should be rechecked before launch.',
        severity: 'blocker',
      });
    } else if (dueAt - now <= REVIEW_GRACE_MS) {
      warnings.push({
        label: `Review due soon on ${formatShortDate(dueAt)}`,
        detail: 'This record is within the review window and should be checked before launch if possible.',
        severity: 'warning',
      });
    }
  } else {
    warnings.push({
      label: 'No review due date is set',
      detail: 'Add a last review date or an explicit next review date so cadence can be enforced.',
      severity: 'warning',
    });
  }

  if (record.governanceStage && record.governanceStage !== 'published' && record.governanceStage !== 'restricted') {
    warnings.push({
      label: `Governance stage is ${humanizeTag(record.governanceStage)}`,
      detail: 'This record is still in a pre-launch governance posture.',
      severity: 'warning',
    });
  }

  if (record.evidenceStatus === 'insufficient') {
    warnings.push({
      label: 'Evidence is still insufficient',
      detail: 'Launch is possible, but evidence depth is thin and should be treated cautiously.',
      severity: 'warning',
    });
  } else if (record.evidenceStatus === 'watch') {
    warnings.push({
      label: 'Evidence is on watch',
      detail: 'Negative-response or mixed evidence needs attention before wider rollout.',
      severity: 'warning',
    });
  }

  if (!record.evidenceSummary?.trim() && !record.evidencePanel) {
    warnings.push({
      label: 'No evidence summary is attached',
      detail: 'The registry should carry a short evidence note so launch reviewers can understand the rationale.',
      severity: 'warning',
    });
  }

  return {
    ready: blockers.length === 0,
    dueAt,
    dueLabel: dueAt ? formatDate(dueAt) : 'Not set',
    blockers,
    warnings,
  };
}

function renderLaunchIssueList(issues: LaunchIssue[]) {
  if (!issues.length) {
    return <div className="text-xs text-zinc-500">None.</div>;
  }

  return (
    <div className="space-y-2">
      {issues.map((issue) => (
        <div key={issue.label} className={`rounded-2xl border p-3 ${issue.severity === 'blocker' ? 'border-red-500/20 bg-red-500/[0.06]' : 'border-amber-500/20 bg-amber-500/[0.06]'}`}>
          <div className={`text-sm font-medium ${issue.severity === 'blocker' ? 'text-red-100' : 'text-amber-100'}`}>{issue.label}</div>
          {issue.detail ? <div className="mt-1 text-xs text-zinc-500">{issue.detail}</div> : null}
        </div>
      ))}
    </div>
  );
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

function freshnessColor(freshness?: string) {
  switch (freshness) {
    case 'current':
      return 'green';
    case 'degraded':
      return 'amber';
    case 'refresh_required':
      return 'red';
    default:
      return 'blue';
  }
}

function renderEvidencePanel(panel: PulseCheckProtocolEvidenceSummary | undefined) {
  if (!panel) {
    return <div className="text-xs text-zinc-500">No evidence signals captured yet.</div>;
  }

  const freshness = panel.freshness;
  const downstream = panel.downstreamImpact;
  const downstreamTone =
    downstream?.responseDirection === 'positive' ? 'green' : downstream?.responseDirection === 'negative' ? 'red' : downstream?.responseDirection === 'mixed' ? 'amber' : 'blue';

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
        <div className="rounded-2xl border border-zinc-800 bg-black/20 p-3 text-sm text-zinc-300">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Freshness</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <InlineTag label={freshness ? humanizeTag(freshness.freshness) : 'Unknown'} color={freshnessColor(freshness?.freshness)} />
            {typeof freshness?.ageDays === 'number' ? <InlineTag label={`${freshness.ageDays} days old`} color="blue" /> : null}
            {typeof freshness?.staleAt === 'number' ? <InlineTag label={`Stale ${formatShortDate(freshness.staleAt)}`} color="amber" /> : null}
          </div>
          {freshness?.explanation ? <div className="mt-2 text-xs text-zinc-500">{freshness.explanation}</div> : null}
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-black/20 p-3 text-sm text-zinc-300">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Downstream Impact</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <InlineTag label={downstream ? humanizeTag(downstream.responseDirection) : 'No signal'} color={downstreamTone} />
            {downstream ? <InlineTag label={`${downstream.confidence} confidence`} color="blue" /> : null}
            {downstream ? <InlineTag label={`${downstream.sampleSize} samples`} color="blue" /> : null}
          </div>
          {downstream?.explanation ? <div className="mt-2 text-xs text-zinc-500">{downstream.explanation}</div> : null}
        </div>
      </div>
      {panel.explanation ? (
        <div className="rounded-2xl border border-zinc-800 bg-black/20 p-3 text-sm text-zinc-300">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Explanation</div>
          <div className="mt-2">{panel.explanation}</div>
        </div>
      ) : null}
      {(freshness?.lastObservedAt || downstream?.lastObservedAt || panel.lastObservedAt) ? (
        <div className="rounded-2xl border border-zinc-800 bg-black/20 p-3 text-xs text-zinc-500">
          {panel.lastObservedAt ? `Last observed: ${formatDate(panel.lastObservedAt)}.` : null}
          {freshness?.lastConfirmedAt ? ` Freshness confirmed: ${formatDate(freshness.lastConfirmedAt)}.` : null}
          {downstream?.lastConfirmedAt ? ` Downstream confirmed: ${formatDate(downstream.lastConfirmedAt)}.` : null}
        </div>
      ) : null}
    </div>
  );
}

function describeExerciseConfig(exercise: MentalExercise | null) {
  if (!exercise?.exerciseConfig) return 'No bound source config';
  return humanizeTag(exercise.exerciseConfig.type);
}

const listButtonClass = (selected: boolean) =>
  `w-full rounded-2xl border px-4 py-3 text-left transition ${
    selected
      ? 'border-lime-400/50 bg-lime-500/10'
      : 'border-zinc-800 bg-black/20 hover:border-zinc-700 hover:bg-white/[0.03]'
  }`;

function needsSeedScientificBasisBackfill(families: PulseCheckProtocolFamily[]) {
  return families.some((family) => {
    const seededSpec = getSeededProtocolFamilySpecById(family.id);
    if (!seededSpec) return false;
    return !family.evidenceSummary?.trim() && !family.sourceReferences.length;
  });
}

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
  const [autoSeedAttempted, setAutoSeedAttempted] = useState(false);
  const [sourceExercise, setSourceExercise] = useState<MentalExercise | null>(null);
  const [sourceExerciseLoading, setSourceExerciseLoading] = useState(false);
  const [sourceExerciseError, setSourceExerciseError] = useState<string | null>(null);
  const [previewExercise, setPreviewExercise] = useState<MentalExercise | null>(null);

  const loadWorkspace = async (preferred?: { familyId?: string | null; variantId?: string | null; runtimeId?: string | null }) => {
    setLoading(true);
    try {
      let workspace = await protocolRegistryService.listWorkspace();
      const shouldAutoSeed =
        !autoSeedAttempted &&
        workspace.families.length === 0 &&
        workspace.variants.length === 0 &&
        workspace.runtimeRecords.length === 0;
      const shouldAutoBackfillScientificBasis =
        !autoSeedAttempted &&
        workspace.families.length > 0 &&
        needsSeedScientificBasisBackfill(workspace.families);

      if (shouldAutoSeed || shouldAutoBackfillScientificBasis) {
        setAutoSeedAttempted(true);
        setSyncing(true);
        setSyncMessage(
          shouldAutoSeed
            ? 'Protocol registry is empty. Syncing starter protocols into Firestore...'
            : 'Protocol registry needs a scientific-basis refresh. Syncing locked starter specs into Firestore...'
        );
        try {
          const result = await protocolRegistryService.syncSeedProtocols();
          workspace = await protocolRegistryService.listWorkspace();
          setSyncMessage(
            shouldAutoSeed
              ? `Protocol registry bootstrap complete. Created ${result.created}, updated ${result.updated}.`
              : `Protocol registry scientific-basis refresh complete. Created ${result.created}, updated ${result.updated}.`
          );
        } catch (error) {
          console.error('Failed to auto-sync protocol registry seeds:', error);
          setSyncMessage(
            shouldAutoSeed
              ? 'Protocol registry is empty and automatic seed sync failed. Use Sync Seed Protocols to retry.'
              : 'Protocol registry scientific-basis refresh failed. Use Sync Seed Protocols to retry.'
          );
        } finally {
          setSyncing(false);
        }
      }

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

  const familyLaunchReadiness = useMemo(() => assessLaunchReadiness(familyDraft), [familyDraft]);
  const variantLaunchReadiness = useMemo(() => assessLaunchReadiness(variantDraft), [variantDraft]);
  const runtimeLaunchReadiness = useMemo(() => assessLaunchReadiness(runtimeDraft), [runtimeDraft]);

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

  useEffect(() => {
    const exerciseId = runtimeDraft?.legacyExerciseId?.trim() || variantDraft?.legacyExerciseId?.trim() || '';
    if (!exerciseId) {
      setSourceExercise(null);
      setSourceExerciseError(null);
      setSourceExerciseLoading(false);
      return;
    }

    let cancelled = false;
    setSourceExerciseLoading(true);
    setSourceExerciseError(null);

    simModuleLibraryService
      .getById(exerciseId)
      .then((exercise) => {
        if (cancelled) return;
        setSourceExercise(exercise);
        setSourceExerciseError(exercise ? null : `No active source exercise found for ${exerciseId}.`);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to load protocol source exercise:', error);
        setSourceExercise(null);
        setSourceExerciseError('Failed to load the bound source exercise.');
      })
      .finally(() => {
        if (!cancelled) {
          setSourceExerciseLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [runtimeDraft?.legacyExerciseId, variantDraft?.legacyExerciseId]);

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

  const openProtocolPreview = async () => {
    const exerciseId = runtimeDraft?.legacyExerciseId?.trim() || variantDraft?.legacyExerciseId?.trim() || '';
    if (!exerciseId) {
      setWorkspaceMessage('Bind a legacy exercise id before previewing this protocol.');
      return;
    }

    if (sourceExercise?.id === exerciseId) {
      setPreviewExercise(sourceExercise);
      return;
    }

    setSourceExerciseLoading(true);
    setSourceExerciseError(null);
    try {
      const exercise = await simModuleLibraryService.getById(exerciseId);
      if (!exercise) {
        setSourceExercise(null);
        setSourceExerciseError(`No active source exercise found for ${exerciseId}.`);
        return;
      }
      setSourceExercise(exercise);
      setPreviewExercise(exercise);
    } catch (error) {
      console.error('Failed to preview protocol source exercise:', error);
      setSourceExerciseError('Failed to load the bound source exercise.');
    } finally {
      setSourceExerciseLoading(false);
    }
  };

  const openProtocolPreviewForRecord = async (protocol: PulseCheckProtocolDefinition) => {
    const exerciseId = protocol.legacyExerciseId?.trim();
    if (!exerciseId) {
      setWorkspaceMessage(`No source asset is bound to ${protocol.label} yet.`);
      return;
    }

    setSourceExerciseLoading(true);
    setSourceExerciseError(null);
    try {
      const exercise = await simModuleLibraryService.getById(exerciseId);
      if (!exercise) {
        setSourceExerciseError(`No active source exercise found for ${exerciseId}.`);
        return;
      }
      setSourceExercise(exercise);
      setPreviewExercise(exercise);
    } catch (error) {
      console.error('Failed to preview published protocol source exercise:', error);
      setSourceExerciseError('Failed to load the bound source exercise.');
    } finally {
      setSourceExerciseLoading(false);
    }
  };

  const openRuntimeInWorkspace = (protocol: PulseCheckProtocolDefinition) => {
    setSelectedFamilyId(protocol.familyId);
    setSelectedVariantId(protocol.variantId);
    setSelectedRuntimeId(protocol.id);
    setWorkspaceMessage(`Loaded ${protocol.label} into the runtime workspace.`);
  };

  const familyDirty = compareDraft(familyDraft) !== compareDraft(selectedFamily);
  const variantDirty = compareDraft(variantDraft) !== compareDraft(selectedVariant);
  const runtimeDirty = compareDraft(runtimeDraft) !== compareDraft(selectedRuntime);
  const publishBlocked =
    !familyDraft ||
    !variantDraft ||
    !runtimeDraft ||
    !familyLaunchReadiness.ready ||
    !variantLaunchReadiness.ready ||
    !runtimeLaunchReadiness.ready;

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
      <div key={`${protocol.id}-meta`} className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <InlineTag label={protocol.protocolClass} color="blue" />
          <InlineTag label={protocol.category} color="green" />
          <InlineTag label={humanizeTag(protocol.responseFamily)} color="amber" />
        </div>
        <div className="text-xs text-zinc-500">{protocol.publishedRevisionId || 'Draft lineage only'}</div>
      </div>,
      <div key={`${protocol.id}-delivery`} className="space-y-1">
        <div>{humanizeTag(protocol.deliveryMode)}</div>
        <div className="text-xs text-zinc-500">{formatDurationSeconds(protocol.durationSeconds)}</div>
        <div className="text-xs text-zinc-500">Use: {formatTagList(protocol.useWindowTags, 'General use', 2)}</div>
      </div>,
      <div key={`${protocol.id}-source`} className="space-y-1">
        <div className="text-zinc-300">{formatTagList(protocol.triggerTags, 'No trigger tags', 3)}</div>
        <div className="text-xs text-zinc-500">{protocol.legacyExerciseId || 'No source exercise'}</div>
      </div>,
      <div key={`${protocol.id}-actions`} className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => openRuntimeInWorkspace(protocol)}
          className="rounded-lg border border-zinc-700 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition hover:border-zinc-500 hover:bg-white/10"
        >
          Open
        </button>
        <button
          type="button"
          onClick={() => void openProtocolPreviewForRecord(protocol)}
          className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/15"
        >
          Preview
        </button>
      </div>,
    ]);
  }, [publishedRuntimeRecords]);

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
            <div className="mb-4">
              <p className="text-sm font-semibold text-white">Families</p>
              <p className="text-xs text-zinc-500">Intervention lanes and governance posture. Locked here and sourced from protocol specs.</p>
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
            <div className="mb-4">
              <p className="text-sm font-semibold text-white">Variants</p>
              <p className="text-xs text-zinc-500">Authored expressions inside the selected family. Locked here and sourced from variant specs.</p>
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
              )) : <div className="rounded-2xl border border-zinc-800 bg-black/20 px-4 py-6 text-sm text-zinc-500">Select a family to inspect its locked variant specs.</div>}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-[#090f1c] p-4">
            <div className="mb-4">
              <p className="text-sm font-semibold text-white">Runtime Records</p>
              <p className="text-xs text-zinc-500">Bounded published objects Nora can actually assign. Locked here and sourced from runtime specs.</p>
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
              )) : <div className="rounded-2xl border border-zinc-800 bg-black/20 px-4 py-6 text-sm text-zinc-500">Select a variant to inspect its locked runtime records.</div>}
            </div>
          </div>
        </div>

        {workspaceMessage ? <p className="text-sm text-zinc-400">{workspaceMessage}</p> : null}

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-3xl border border-zinc-800 bg-[#090f1c] p-5">
            <div className="mb-4 flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-zinc-400" />
              <div>
                <p className="text-sm font-semibold text-white">Family Spec</p>
                <p className="text-xs text-zinc-500">Locked source-of-truth definition for the selected intervention family.</p>
              </div>
            </div>
            {familyDraft ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-zinc-800 bg-black/20 p-3 text-xs text-zinc-500">
                  Family records are read-only in this registry. Change the governing protocol family spec and resync the registry if the family rules, mechanism, or scientific rationale need to change.
                </div>
                <div className="flex flex-wrap gap-2">
                  <InlineTag label={humanizeTag(familyDraft.protocolClass)} color="blue" />
                  <InlineTag label={humanizeTag(familyDraft.responseFamily)} color="amber" />
                  <InlineTag label={humanizeTag(familyDraft.governanceStage)} color="amber" />
                  <InlineTag label={humanizeTag(familyDraft.familyStatus)} color="green" />
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Definition</div>
                  <div className="mt-3 space-y-3">
                    <div>
                      <div className="text-sm font-medium text-white">{familyDraft.label}</div>
                      <div className="text-xs text-zinc-500">{familyDraft.id}</div>
                    </div>
                    <div className="text-sm text-zinc-300">
                      <span className="font-medium text-white">Mechanism:</span> {familyDraft.mechanismSummary || 'Not defined in the locked source spec yet.'}
                    </div>
                    <div className="text-sm text-zinc-300">
                      <span className="font-medium text-white">Target bottleneck:</span> {familyDraft.targetBottleneck || 'Not defined in the locked source spec yet.'}
                    </div>
                    <div className="text-sm text-zinc-300">
                      <span className="font-medium text-white">Expected state shift:</span> {familyDraft.expectedStateShift || 'Not defined in the locked source spec yet.'}
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Scientific Basis</div>
                  <div className="mt-3 space-y-3 text-sm text-zinc-300">
                    <div><span className="font-medium text-white">Evidence summary:</span> {familyDraft.evidenceSummary || 'No evidence summary attached yet.'}</div>
                    <div><span className="font-medium text-white">Source references:</span> {familyDraft.sourceReferences.length ? familyDraft.sourceReferences.join(', ') : 'No explicit source references attached yet.'}</div>
                    <div><span className="font-medium text-white">Linked source origin:</span> {sourceExercise?.origin || 'No bound source exercise origin available for the current selection.'}</div>
                    <div><span className="font-medium text-white">Linked neuroscience basis:</span> {sourceExercise?.neuroscience || 'No neuroscience note available for the current bound source.'}</div>
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Policy Envelope</div>
                  <div className="mt-3 space-y-2 text-sm text-zinc-300">
                    <div><span className="font-medium text-white">Use windows:</span> {formatTagList(familyDraft.useWindowTags, 'General use')}</div>
                    <div><span className="font-medium text-white">Avoid windows:</span> {formatTagList(familyDraft.avoidWindowTags, 'None configured')}</div>
                    <div><span className="font-medium text-white">Contraindications:</span> {formatTagList(familyDraft.contraindicationTags, 'None configured')}</div>
                  </div>
                </div>
              </div>
            ) : <div className="text-sm text-zinc-500">Select a family to inspect its locked spec.</div>}
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-[#090f1c] p-5">
            <div className="mb-4 flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-zinc-400" />
              <div>
                <p className="text-sm font-semibold text-white">Variant Spec</p>
                <p className="text-xs text-zinc-500">Locked authored expression for the selected family.</p>
              </div>
            </div>
            {variantDraft ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-zinc-800 bg-black/20 p-3 text-xs text-zinc-500">
                  Variant records are read-only in this registry. Change the variant spec source and resync if delivery, targeting, or authored language needs to change.
                </div>
                <div className="flex flex-wrap gap-2">
                  <InlineTag label={humanizeTag(variantDraft.deliveryMode)} color="blue" />
                  <InlineTag label={humanizeTag(variantDraft.category)} color="green" />
                  <InlineTag label={humanizeTag(variantDraft.governanceStage)} color="amber" />
                  <InlineTag label={humanizeTag(variantDraft.approvalStatus)} color={reviewStatusColor(variantDraft.approvalStatus)} />
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Expression</div>
                  <div className="mt-3 space-y-3 text-sm text-zinc-300">
                    <div>
                      <div className="font-medium text-white">{variantDraft.label}</div>
                      <div className="text-xs text-zinc-500">{variantDraft.id} · {variantDraft.variantVersion}</div>
                    </div>
                    <div><span className="font-medium text-white">Authored rationale:</span> {variantDraft.rationale || 'No rationale attached yet.'}</div>
                    <div><span className="font-medium text-white">Script summary:</span> {variantDraft.scriptSummary || 'No script summary attached yet.'}</div>
                    <div><span className="font-medium text-white">Delivery posture:</span> {humanizeTag(variantDraft.deliveryMode)} · {formatDurationSeconds(variantDraft.durationSeconds)}</div>
                    <div><span className="font-medium text-white">Bound source asset:</span> {variantDraft.legacyExerciseId || 'No bound source asset yet.'}</div>
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Targeting Rules</div>
                  <div className="mt-3 space-y-2 text-sm text-zinc-300">
                    <div><span className="font-medium text-white">Trigger tags:</span> {formatTagList(variantDraft.triggerTags, 'None configured')}</div>
                    <div><span className="font-medium text-white">Preferred contexts:</span> {formatTagList(variantDraft.preferredContextTags, 'Any supported context')}</div>
                    <div><span className="font-medium text-white">Use windows:</span> {formatTagList(variantDraft.useWindowTags, 'General use')}</div>
                    <div><span className="font-medium text-white">Avoid windows:</span> {formatTagList(variantDraft.avoidWindowTags, 'None configured')}</div>
                    <div><span className="font-medium text-white">Contraindications:</span> {formatTagList(variantDraft.contraindicationTags, 'None configured')}</div>
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Scientific Basis</div>
                  <div className="mt-3 space-y-3 text-sm text-zinc-300">
                    <div><span className="font-medium text-white">Evidence summary:</span> {variantDraft.evidenceSummary || 'No variant evidence summary attached yet.'}</div>
                    <div><span className="font-medium text-white">Source references:</span> {variantDraft.sourceReferences.length ? variantDraft.sourceReferences.join(', ') : 'No explicit variant source references attached yet.'}</div>
                    <div><span className="font-medium text-white">Bound source origin:</span> {sourceExercise?.origin || 'No bound source origin available yet.'}</div>
                    <div><span className="font-medium text-white">Bound neuroscience basis:</span> {sourceExercise?.neuroscience || 'No neuroscience note available for the current bound source.'}</div>
                    <div><span className="font-medium text-white">Best-for contexts:</span> {sourceExercise?.bestFor?.length ? sourceExercise.bestFor.slice(0, 4).join(', ') : 'Not available.'}</div>
                  </div>
                </div>
              </div>
            ) : <div className="text-sm text-zinc-500">Select a variant to inspect its locked spec.</div>}
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-[#090f1c] p-5">
            <div className="mb-4 flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-zinc-400" />
              <div>
                <p className="text-sm font-semibold text-white">Runtime Record</p>
                <p className="text-xs text-zinc-500">Locked bounded runtime that Nora actually sees at planning time.</p>
              </div>
            </div>
            {runtimeDraft ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-zinc-800 bg-black/20 p-3 text-xs text-zinc-500">
                  Runtime records are read-only in this registry. Change the upstream runtime spec and republish/resync if planner policy, publish posture, or delivery metadata needs to change.
                </div>
                <div className="flex flex-wrap gap-2">
                  <InlineTag label={humanizeTag(runtimeDraft.publishStatus)} color={runtimeDraft.publishStatus === 'published' ? 'green' : runtimeDraft.publishStatus === 'archived' ? 'red' : 'amber'} />
                  <InlineTag label={humanizeTag(runtimeDraft.protocolClass)} color="blue" />
                  <InlineTag label={humanizeTag(runtimeDraft.reviewStatus)} color={reviewStatusColor(runtimeDraft.reviewStatus)} />
                  <InlineTag label={`${runtimeDraft.reviewCadenceDays}d cadence`} color="blue" />
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Planner Contract</div>
                      <div className="mt-2 text-sm text-zinc-300">Runtime identity, lineage, delivery contract, and planner-safe policy envelope.</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void openProtocolPreview()}
                      disabled={sourceExerciseLoading || !(runtimeDraft.legacyExerciseId?.trim() || variantDraft?.legacyExerciseId?.trim())}
                      className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/15 disabled:opacity-60"
                    >
                      {sourceExerciseLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
                      {sourceExerciseLoading ? 'Loading...' : 'Preview Protocol'}
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm text-zinc-300">
                    <div className="rounded-2xl border border-zinc-800 bg-[#060b16] p-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Lineage</div>
                      <div className="mt-2 font-medium text-white">{runtimeDraft.label}</div>
                      <div className="text-xs text-zinc-500">{runtimeDraft.id}</div>
                      <div className="mt-1 text-xs text-zinc-500">{runtimeDraft.familyLabel} / {runtimeDraft.variantLabel} / {runtimeDraft.variantVersion}</div>
                      <div className="mt-1 text-xs text-zinc-500">{runtimeDraft.publishedRevisionId || 'Not published yet'}</div>
                    </div>
                    <div className="rounded-2xl border border-zinc-800 bg-[#060b16] p-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Delivery</div>
                      <div className="mt-2">{humanizeTag(runtimeDraft.deliveryMode)}</div>
                      <div className="mt-1 text-xs text-zinc-500">{humanizeTag(runtimeDraft.category)} · {formatDurationSeconds(runtimeDraft.durationSeconds)}</div>
                      <div className="mt-1 text-xs text-zinc-500">Source asset: {runtimeDraft.legacyExerciseId || 'Not bound'}</div>
                    </div>
                    <div className="rounded-2xl border border-zinc-800 bg-[#060b16] p-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Triggers</div>
                      <div className="mt-2 text-xs text-zinc-300">{formatTagList(runtimeDraft.triggerTags, 'No trigger tags')}</div>
                      <div className="mt-1 text-xs text-zinc-500">Preferred context: {formatTagList(runtimeDraft.preferredContextTags, 'Any supported context')}</div>
                    </div>
                    <div className="rounded-2xl border border-zinc-800 bg-[#060b16] p-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Safety Policy</div>
                      <div className="mt-2 text-xs text-zinc-300">Use windows: {formatTagList(runtimeDraft.useWindowTags, 'General use')}</div>
                      <div className="mt-1 text-xs text-zinc-500">Avoid: {formatTagList(runtimeDraft.avoidWindowTags, 'None configured')}</div>
                      <div className="mt-1 text-xs text-zinc-500">Contraindications: {formatTagList(runtimeDraft.contraindicationTags, 'None configured')}</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Scientific Basis</div>
                  <div className="mt-3 space-y-3 text-sm text-zinc-300">
                    <div><span className="font-medium text-white">Mechanism:</span> {runtimeDraft.mechanism || 'No runtime mechanism attached yet.'}</div>
                    <div><span className="font-medium text-white">Expected state shift:</span> {runtimeDraft.expectedStateShift || 'No expected shift attached yet.'}</div>
                    <div><span className="font-medium text-white">Source exercise description:</span> {sourceExercise?.description || 'No bound source description available yet.'}</div>
                    <div><span className="font-medium text-white">Source exercise neuroscience:</span> {sourceExercise?.neuroscience || 'No neuroscience note available for the current bound source.'}</div>
                    <div><span className="font-medium text-white">Benefits:</span> {sourceExercise?.benefits?.length ? sourceExercise.benefits.slice(0, 4).join(', ') : 'No benefits attached yet.'}</div>
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Bound Source Config</div>
                  <div className="mt-3 grid gap-3 xl:grid-cols-2">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Exercise Config</div>
                      <pre className="mt-2 overflow-x-auto rounded-xl border border-zinc-800 bg-[#060b16] p-3 text-[11px] leading-relaxed text-zinc-300">{formatJsonPreview(sourceExercise?.exerciseConfig)}</pre>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Runtime Config</div>
                      <pre className="mt-2 overflow-x-auto rounded-xl border border-zinc-800 bg-[#060b16] p-3 text-[11px] leading-relaxed text-zinc-300">{formatJsonPreview(sourceExercise?.runtimeConfig)}</pre>
                    </div>
                  </div>
                </div>
              </div>
            ) : <div className="text-sm text-zinc-500">Select a runtime record to inspect its locked runtime contract.</div>}
          </div>
        </div>
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Launch Readiness">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="Family Launch Blocking"
            accent={familyLaunchReadiness.ready ? 'green' : 'red'}
            body={
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <InlineTag label={familyLaunchReadiness.ready ? 'Ready' : 'Blocked'} color={familyLaunchReadiness.ready ? 'green' : 'red'} />
                  <InlineTag label={`Due ${familyLaunchReadiness.dueLabel}`} color="blue" />
                </div>
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Blockers</div>
                  {renderLaunchIssueList(familyLaunchReadiness.blockers)}
                </div>
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Warnings</div>
                  {renderLaunchIssueList(familyLaunchReadiness.warnings)}
                </div>
              </div>
            }
          />
          <InfoCard
            title="Variant Launch Blocking"
            accent={variantLaunchReadiness.ready ? 'green' : 'red'}
            body={
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <InlineTag label={variantLaunchReadiness.ready ? 'Ready' : 'Blocked'} color={variantLaunchReadiness.ready ? 'green' : 'red'} />
                  <InlineTag label={`Due ${variantLaunchReadiness.dueLabel}`} color="blue" />
                </div>
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Blockers</div>
                  {renderLaunchIssueList(variantLaunchReadiness.blockers)}
                </div>
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Warnings</div>
                  {renderLaunchIssueList(variantLaunchReadiness.warnings)}
                </div>
              </div>
            }
          />
          <InfoCard
            title="Runtime Launch Blocking"
            accent={runtimeLaunchReadiness.ready ? 'green' : 'red'}
            body={
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <InlineTag label={runtimeLaunchReadiness.ready ? 'Ready' : 'Blocked'} color={runtimeLaunchReadiness.ready ? 'green' : 'red'} />
                  <InlineTag label={`Due ${runtimeLaunchReadiness.dueLabel}`} color="blue" />
                </div>
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Blockers</div>
                  {renderLaunchIssueList(runtimeLaunchReadiness.blockers)}
                </div>
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Warnings</div>
                  {renderLaunchIssueList(runtimeLaunchReadiness.warnings)}
                </div>
              </div>
            }
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={SlidersHorizontal} title="Class Coverage">
        <DataTable columns={['Protocol Class', 'Published Count', 'Categories Represented', 'Role In Planning']} rows={classRows} />
      </SectionBlock>

      <SectionBlock icon={BrainCircuit} title="Published Inventory">
        <DataTable columns={['Protocol', 'Family / Variant', 'Runtime Identity', 'Delivery', 'Source Asset', 'Actions']} rows={inventoryRows} />
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

      {previewExercise ? (
        <ExercisePlayer
          exercise={previewExercise}
          previewMode
          onClose={() => setPreviewExercise(null)}
          onComplete={() => setPreviewExercise(null)}
        />
      ) : null}
    </div>
  );
};

export default ProtocolRegistryTab;
