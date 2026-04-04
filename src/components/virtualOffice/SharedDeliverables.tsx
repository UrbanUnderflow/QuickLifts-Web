import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useRouter } from 'next/router';
import { X, Package, ExternalLink, FileText, ChevronRight, RefreshCw, Check, XCircle } from 'lucide-react';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { addDoc, collection, query, orderBy, limit, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../api/firebase/config';

/* ─── types ─── */
interface Deliverable {
  id: string;
  title: string;
  description: string;
  filename: string;
  filePath: string;
  changeType?: string;
  emoji: string;
  tags: string[];
  status: string;
  verificationState?: string;
  verificationSource?: string;
  spotCheckRequired?: boolean;
  sampledForReview?: boolean;
  movementScore?: number;
  objectiveId?: string;
  outcomeId?: string;
  outcomeStatus?: string;
  outcomeClass?: string;
  outcomeDomain?: string;
  outcomeRole?: string;
  parentOutcomeId?: string;
  supersedesOutcomeId?: string;
  playbookId?: string;
  playbookVersion?: number;
  currentStageId?: string;
  stageGateStatus?: string;
  stageBlockReason?: string;
  speculative?: boolean;
  cleanupState?: string;
  cleanupBy?: string;
  readinessSignals?: unknown;
  executionScore?: number;
  commercialMovementScore?: number;
  creditedOutcomeScore?: number;
  netOutcomeScore?: number;
  businessDebtScore?: number;
  reviewReason?: string;
  completedAt?: string;
  taskRef?: string;
  taskId?: string;
  agentId: string;
  deliveryClass?: 'decision-grade' | 'supporting' | 'internal';
  movementSignals?: {
    score: number;
    impactLabel: string;
    impactToneClass: 'high' | 'medium' | 'low';
    signals: string[];
    rationale: string;
    classLabel: string;
    classSummary: string;
  };
}

type DeliverableStatusFilter = 'all' | 'needs-review' | 'approved' | 'work';
type DeliveryClassFilter = 'all' | 'decision-grade' | 'supporting' | 'internal';

interface AgentInfo {
  id: string;
  displayName: string;
  emoji: string;
  color: string;
  deliverableDir?: string;
}

const AGENTS: AgentInfo[] = [
  { id: 'sage', displayName: 'Sage', emoji: '🧬', color: '#34d399', deliverableDir: 'docs/sage/deliverables' },
  { id: 'nora', displayName: 'Nora', emoji: '⚡', color: '#22c55e', deliverableDir: 'docs/agents/nora/deliverables' },
  { id: 'scout', displayName: 'Scout', emoji: '🕵️', color: '#f59e0b', deliverableDir: 'docs/agents/scout/deliverables' },
  { id: 'solara', displayName: 'Solara', emoji: '❤️‍🔥', color: '#f43f5e', deliverableDir: 'docs/agents/solara/deliverables' },
];

const ARTIFACT_EMOJI: Record<string, string> = {
  code: '💻',
  document: '📄',
  test: '🧪',
  config: '⚙️',
  research: '🔬',
};

const AGENT_ROUTE_ALIASES: Record<string, string> = {
  scouts: 'scout',
};

const normalizeAgentKey = (value?: string) => (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const resolveAgentRouteId = (agentId?: string): string | null => {
  const normalized = normalizeAgentKey(agentId);
  if (!normalized) return null;
  const canonical = AGENT_ROUTE_ALIASES[normalized] || normalized;
  return AGENTS.some((agent) => agent.id === canonical) ? canonical : null;
};

const normalizeDeliverableStatus = (value?: string): string => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized || normalized === 'pending' || normalized === 'in-progress' || normalized === 'queued') {
    return 'work';
  }
  if (normalized === 'needsreview') return 'needs-review';
  if (normalized === 'approved' || normalized === 'verified') return 'verified-human';
  if (normalized === 'verified-auto' || normalized === 'verified-human' || normalized === 'needs-review' || normalized === 'rejected' || normalized === 'work') {
    return normalized;
  }
  if (normalized === 'reject') return 'rejected';
  return normalized || 'work';
};

const normalizeOutcomeStatus = (value?: string): string => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized || normalized === 'planned') return 'planned';
  if (normalized === 'executing') return 'executing';
  if (normalized === 'observing') return 'observing';
  if (normalized === 'confirmed') return 'confirmed';
  if (normalized === 'reversed') return 'reversed';
  if (normalized === 'waived') return 'waived';
  if (normalized === 'canceled' || normalized === 'cancelled') return 'canceled';
  if (normalized === 'superseded') return 'superseded';
  if (normalized === 'failed' || normalized === 'guardrail-failed') return 'failed';
  return normalized;
};

const normalizeOutcomeClass = (value?: string): string => {
  const normalized = String(value || '').trim().toLowerCase();
  if (['terminal', 'enabling', 'learning', 'invalidation', 'constraint'].includes(normalized)) {
    return normalized;
  }
  return normalized || 'unknown';
};

const outcomeStatusBadge = (status?: string) => {
  const normalized = normalizeOutcomeStatus(status);
  switch (normalized) {
    case 'planned':
      return { className: 'planned', label: 'PLANNED' };
    case 'executing':
      return { className: 'observing', label: 'EXECUTING' };
    case 'observing':
      return { className: 'observing', label: 'OBSERVING' };
    case 'confirmed':
      return { className: 'confirmed', label: 'CONFIRMED' };
    case 'reversed':
      return { className: 'reversed', label: 'REVERSED' };
    case 'waived':
      return { className: 'waived', label: 'WAIVED' };
    case 'canceled':
      return { className: 'canceled', label: 'CANCELED' };
    case 'superseded':
      return { className: 'superseded', label: 'SUPERSEDED' };
    case 'failed':
      return { className: 'failed', label: 'FAILED' };
    default:
      return { className: 'planned', label: normalized.toUpperCase() || 'PLANNED' };
  }
};

const outcomeClassBadge = (value?: string) => {
  const normalized = normalizeOutcomeClass(value);
  if (normalized === 'terminal') return { className: 'terminal', label: 'TERMINAL' };
  if (normalized === 'enabling') return { className: 'enabling', label: 'ENABLING' };
  if (normalized === 'learning') return { className: 'learning', label: 'LEARNING' };
  if (normalized === 'invalidation') return { className: 'invalidation', label: 'INVALIDATION' };
  if (normalized === 'constraint') return { className: 'constraint', label: 'CONSTRAINT' };
  return { className: 'unknown', label: normalized.toUpperCase() || 'UNKNOWN' };
};

const formatOutcomeScore = (value?: number) => {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '0';
  const rounded = Math.round(Number(value) * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}` : `${rounded.toFixed(2)}`;
};

const timestampLikeToDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const raw = value as { toDate?: () => Date; seconds?: number; nanos?: number };
  if (typeof raw.toDate === 'function') return raw.toDate();
  if (typeof raw.seconds === 'number') return new Date(raw.seconds * 1000 + Math.floor((raw.nanos || 0) / 1_000_000));
  return null;
};

const formatCountdownLike = (value?: unknown) => {
  const date = timestampLikeToDate(value);
  if (!date) return '';
  const diffMs = date.getTime() - Date.now();
  if (Number.isNaN(diffMs)) return '';
  if (diffMs <= 0) return `Overdue by ${Math.max(1, Math.round(Math.abs(diffMs) / 60000))}m`;
  const hours = Math.floor(diffMs / 3_600_000);
  const mins = Math.floor((diffMs % 3_600_000) / 60000);
  return hours <= 0 ? `In ${Math.max(1, mins)}m` : `In ${hours}h ${mins}m`;
};

const normalizeReadinessSignalState = (value?: string) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized || normalized === 'missing') return 'missing';
  if (normalized === 'pending') return 'pending';
  if (normalized === 'verified' || normalized === 'ready') return 'verified';
  if (normalized === 'failed') return 'failed';
  if (normalized === 'waived') return 'waived';
  if (normalized === 'expired') return 'expired';
  if (normalized === 'revoked') return 'revoked';
  return normalized;
};

const summarizeReadinessSignals = (value: unknown): Array<{ id: string; label: string; state: string }> => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((signal: any, index) => ({
      id: signal?.id || `signal-${index}`,
      label: signal?.label || signal?.id || `Signal ${index + 1}`,
      state: normalizeReadinessSignalState(signal?.state),
    }));
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, any>).map(([id, signal]) => ({
      id,
      label: signal?.label || id,
      state: normalizeReadinessSignalState(signal?.state),
    }));
  }
  return [];
};

const normalizeDeliverableChangeType = (value?: string): string => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'new') return 'new';
  if (normalized === 'edited' || normalized === 'modified') return 'edited';
  if (normalized === 'deleted') return 'deleted';
  return 'edited';
};

const normalizeDeliveryClass = (value?: string): Deliverable['deliveryClass'] => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'decision-grade' || normalized === 'decisiongrade' || normalized === 'decision') return 'decision-grade';
  if (normalized === 'supporting' || normalized === 'support') return 'supporting';
  if (normalized === 'internal') return 'internal';
  return 'supporting';
};

const MOVEMENT_KEYWORDS = [
  'north star',
  'partnership',
  'customer',
  'activation',
  'conversion',
  'revenue',
  'retention',
  'churn',
  'engagement',
  'onboarding',
  'dashboard',
  'campaign',
  'api',
  'automation',
  'workflow',
  'community',
  'run',
  'checkout',
  'billing',
  'on-site',
];

const INTERNAL_PATH_SEGMENTS = [
  '/scripts/',
  '/node_modules/',
  '/backups/',
  'AGENTS.md',
  'agent-runner',
  '.github',
  'openapi',
  'schema',
];

const resolveDeliveryClass = (score: number, text: string, filePath: string): 'decision-grade' | 'supporting' | 'internal' => {
  const normalizedText = normalizeText(text);
  const normalizedPath = normalizeText(filePath);

  if (score <= 2 || /onboarding checklist|runbook|handoff|note|manifesto/.test(normalizedText)) {
    return 'supporting';
  }

  if (score >= 4 && !INTERNAL_PATH_SEGMENTS.some((segment) => normalizedPath.includes(normalizeText(segment)))) {
    return 'decision-grade';
  }

  if (
    score >= 3 &&
    /(^|\/)(src|web|functions)\//.test(normalizedPath)
  ) {
    return 'decision-grade';
  }

  if (score >= 2) {
    return 'supporting';
  }

  return 'internal';
};

const deriveMovementSignals = (d: Deliverable) => {
  const text = normalizeText([d.title, d.description, d.reviewReason, d.filePath, ...(d.tags || [])].join(' '));
  const filePath = d.filePath || '';
  const hasObjectiveLanguage = /north\s*star|revenue|partner|conversion|retention|community|engagement|onboarding/.test(text);
  const isInternalFile = INTERNAL_PATH_SEGMENTS.some((segment) => normalizeText(filePath).includes(normalizeText(segment)));

  const signals: string[] = [];
  let score = 1;

  if (d.reviewReason?.trim()) {
    score += 2;
    signals.push('Reviewer supplied a rationale for why this move matters.');
  } else {
    signals.push('No reviewer rationale yet.');
  }

  const matched = MOVEMENT_KEYWORDS.filter((term) => text.includes(term));
  score += Math.min(4, matched.length);
  signals.push(...matched.slice(0, 4).map((term) => `Contains impact signal: ${term}`));

  if (filePath) {
    if (/\b(src|web|functions)\//.test(filePath)) {
      score += 2;
      signals.push('Touches runtime or application behavior.');
    } else if (/\bdocs\//.test(filePath)) {
      signals.push('Documentation artifact — verify execution impact before approval.');
    } else if (/\bconfig\b/.test(filePath)) {
      signals.push('Configuration artifact; confirm production impact and rollback path.');
    }
  }

  if (d.changeType === 'new') {
    score += 1;
    signals.push('New artifact introduced.');
  }

  if (isInternalFile) {
    score = Math.max(0, score - 2);
    signals.push('Likely internal/operational artifact path.');
  }

  if (hasObjectiveLanguage) {
    score += 1;
  }

  const clampedScore = Math.min(7, Math.max(1, score));
  const deliveryClass = resolveDeliveryClass(clampedScore, text, filePath);
  const impactLabel = clampedScore >= 6 ? 'High' : clampedScore >= 4 ? 'Medium' : clampedScore >= 2 ? 'Low' : 'Minimal';
  const impactToneClass: 'low' | 'medium' | 'high' =
    clampedScore >= 6 ? 'high' : clampedScore >= 4 ? 'high' : clampedScore >= 2 ? 'medium' : 'low';

  const classLabel = deliveryClass === 'decision-grade'
    ? 'Decision Grade'
    : deliveryClass === 'supporting'
      ? 'Supporting'
      : 'Internal';

  const classSummary =
    deliveryClass === 'decision-grade'
      ? 'Likely moves user-facing outcomes and should be reviewed before approval.'
      : deliveryClass === 'supporting'
        ? 'Potentially useful but mostly supports downstream execution.'
        : 'Internal / operational artifact; keep only if paired with external impact tasks.';

  return {
    score: clampedScore,
    impactLabel,
    impactToneClass,
    signals: Array.from(new Set(signals)).slice(0, 6),
    rationale: d.reviewReason || 'No rationale supplied yet. Ask for a concise movement rationale before approving.',
    classLabel,
    classSummary,
  };
};

const normalizeText = (value?: string) => String(value || '').toLowerCase();

const sanitizeRecordedFilePath = (rawPath?: string): string => {
  if (!rawPath) return '';
  let next = rawPath.trim();
  if (!next) return '';

  // `git status --porcelain` entries are recorded like `M path/to/file` or `?? docs/file.md`.
  const porcelainMatch = next.match(/^[ MADRCU?!]{1,2}\s+(.*)$/);
  if (porcelainMatch) {
    next = porcelainMatch[1].trim();
  }

  // Rename entries can appear like `old/path -> new/path`; we want the destination.
  if (next.includes(' -> ')) {
    next = next.split(' -> ').pop()?.trim() || next;
  }

  // Remove wrapping quotes from paths with spaces.
  if (
    (next.startsWith('"') && next.endsWith('"')) ||
    (next.startsWith("'") && next.endsWith("'"))
  ) {
    next = next.slice(1, -1);
  }

  const trimmed = next.replace(/^\.\/+/, '');
  return trimmed.replace(/^docs\/agents\/sage\/deliverables(?=$|\/)/, 'docs/sage/deliverables');
};

/* ─── component ─── */
interface SharedDeliverablesProps {
  onClose: () => void;
}

export const SharedDeliverables: React.FC<SharedDeliverablesProps> = ({ onClose }) => {
  const router = useRouter();
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAgent, setFilterAgent] = useState<string | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<DeliverableStatusFilter>('needs-review');
  const [deliveryClassFilter, setDeliveryClassFilter] = useState<DeliveryClassFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileLoading, setFileLoading] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    const all: Deliverable[] = [];

    try {
      // Query Firestore agent-deliverables collection
      const q = query(
        collection(db, 'agent-deliverables'),
        orderBy('createdAt', 'desc'),
        limit(200),
      );
      const snap = await getDocs(q);

      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const filePath = sanitizeRecordedFilePath(data.filePath || '');
        const basename = filePath.split('/').pop() || data.title || 'untitled';
        const draftDeliverable = {
          id: docSnap.id,
          title: data.title || basename,
          description: data.description || `Task: ${data.taskName || 'Unknown'}`,
          filename: basename,
          filePath,
          emoji: ARTIFACT_EMOJI[data.artifactType] || '📄',
          tags: data.tags || [data.artifactType || 'document'].filter(Boolean),
          changeType: normalizeDeliverableChangeType(data.changeType),
          status: normalizeDeliverableStatus(data.verificationState || data.status),
          verificationState: normalizeDeliverableStatus(data.verificationState || data.status),
          verificationSource: data.verificationSource || '',
          spotCheckRequired: data.spotCheckRequired === true,
          sampledForReview: data.sampledForReview === true,
          movementScore: Number(data.movementScore || 0),
          objectiveId: data.objectiveId || '',
          outcomeId: data.outcomeId || '',
          outcomeStatus: data.outcomeStatus || '',
          outcomeClass: data.outcomeClass || '',
          outcomeDomain: data.outcomeDomain || '',
          outcomeRole: data.outcomeRole || '',
          parentOutcomeId: data.parentOutcomeId || '',
          supersedesOutcomeId: data.supersedesOutcomeId || '',
          creditedOutcomeScore: data.creditedOutcomeScore !== undefined ? Number(data.creditedOutcomeScore) : undefined,
          netOutcomeScore: data.netOutcomeScore !== undefined ? Number(data.netOutcomeScore) : undefined,
          businessDebtScore: data.businessDebtScore !== undefined ? Number(data.businessDebtScore) : undefined,
          reviewReason: data.reviewReason || '',
          completedAt: data.createdAt?.toDate?.()?.toISOString?.() || undefined,
          taskRef: data.taskName || data.taskId || undefined,
          taskId: data.taskId || '',
          agentId: data.agentId || 'unknown',
          deliveryClass: normalizeDeliveryClass(data.deliveryClass),
        } as Deliverable;
        const movementSignals = deriveMovementSignals(draftDeliverable);

        const movementClass = draftDeliverable.deliveryClass || resolveDeliveryClass(movementSignals.score, draftDeliverable.title, filePath);
        all.push({
          ...draftDeliverable,
          movementSignals,
          deliveryClass: movementClass,
        });
      }
    } catch (err) {
      console.error('Failed to load deliverables from Firestore:', err);
    }

    setDeliverables(all);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const getAgent = (id: string) => AGENTS.find((a) => a.id === (resolveAgentRouteId(id) || id)) || AGENTS[0];

  const getAgentRouteFromId = (agentId: string) => {
    const routeId = resolveAgentRouteId(agentId) || normalizeAgentKey(agentId);
    return AGENTS.find((agent) => agent.id === routeId) || AGENTS[0];
  };

  const handleExpand = async (d: Deliverable) => {
    if (expandedId === d.id) {
      setExpandedId(null);
      setFileContent('');
      return;
    }
    setExpandedId(d.id);
    setFileLoading(true);
    try {
      const agent = getAgent(d.agentId);
      const filePath = sanitizeRecordedFilePath(d.filePath);
      const deliverableDir = (agent?.deliverableDir || '').trim().replace(/\/+$/, '');
      const fullFilePath = filePath
        ? deliverableDir && !filePath.includes('/') && !filePath.startsWith('http://') && !filePath.startsWith('https://')
          ? `${deliverableDir}/${filePath}`
          : filePath
        : '';
      if (!filePath) {
        setFileContent('⚠️ No file path recorded for this deliverable.');
      } else {
        const res = await fetch(`/api/read-file?path=${encodeURIComponent(fullFilePath)}`);
        if (res.ok) {
          const data = await res.json();
          setFileContent(data.content || '(empty file)');
        } else {
          setFileContent(`⚠️ File not found: ${fullFilePath}`);
        }
      }
    } catch {
      setFileContent('Failed to load file content.');
    }
    setFileLoading(false);
  };

  const navigateToAgent = (agentId: string, filePath?: string, taskRef?: string) => {
    const agent = getAgentRouteFromId(agentId);
    const params = new URLSearchParams();
    const normalizedFilePath = sanitizeRecordedFilePath(filePath);
    if (normalizedFilePath) params.set('file', normalizedFilePath);
    if (taskRef?.trim()) {
      params.set('taskRef', taskRef.trim());
      params.set('taskId', taskRef.trim());
      params.set('objectiveCode', taskRef.trim());
    }
    onClose();
    router.push(`/admin/deliverables/${agent.id}${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const agentCounts = AGENTS.map((a) => ({
    ...a,
    count: deliverables.filter((d) => (resolveAgentRouteId(d.agentId) || normalizeAgentKey(d.agentId)) === a.id).length,
  }));

  const statusCounts = {
    all: deliverables.length,
    needsReview: deliverables.filter((d) => ['needs-review', 'rejected'].includes(normalizeDeliverableStatus(d.status))).length,
    approved: deliverables.filter((d) => ['verified-auto', 'verified-human'].includes(normalizeDeliverableStatus(d.status))).length,
    work: deliverables.filter((d) => {
      const status = normalizeDeliverableStatus(d.status);
      return !['needs-review', 'rejected', 'verified-auto', 'verified-human'].includes(status);
    }).length,
  };
  const movementClassCounts = {
    all: deliverables.length,
    decisionGrade: deliverables.filter((d) => (d.deliveryClass || 'supporting') === 'decision-grade').length,
    supporting: deliverables.filter((d) => (d.deliveryClass || 'supporting') === 'supporting').length,
    internal: deliverables.filter((d) => (d.deliveryClass || 'supporting') === 'internal').length,
  };

  const isNeedsReview = (status?: string) => ['needs-review', 'rejected'].includes(normalizeDeliverableStatus(status));
  const isApproved = (status?: string) => ['verified-auto', 'verified-human'].includes(normalizeDeliverableStatus(status));
  const isDecisionGrade = (deliveryClass?: string) => (deliveryClass || 'supporting') === 'decision-grade';
  const isSupporting = (deliveryClass?: string) => (deliveryClass || 'supporting') === 'supporting';
  const isInternal = (deliveryClass?: string) => (deliveryClass || 'supporting') === 'internal';

  const filtered = deliverables
    .filter((d) => {
      if (filterAgent === 'all') return true;
      return (resolveAgentRouteId(d.agentId) || d.agentId) === filterAgent;
    })
    .filter((d) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'needs-review') return isNeedsReview(d.status);
      if (statusFilter === 'approved') return isApproved(d.status);
      return !isNeedsReview(d.status) && !isApproved(d.status);
    })
    .filter((d) => {
      if (deliveryClassFilter === 'all') return true;
      if (deliveryClassFilter === 'decision-grade') return isDecisionGrade(d.deliveryClass);
      if (deliveryClassFilter === 'supporting') return isSupporting(d.deliveryClass);
      return isInternal(d.deliveryClass);
    });

const statusBadge = (status?: string) => {
    const normalized = normalizeDeliverableStatus(status);
    if (isNeedsReview(status)) {
      return normalized === 'rejected'
        ? { className: 'rejected', label: 'REJECTED' }
        : { className: 'needs-review', label: 'NEEDS REVIEW' };
    }
    if (normalized === 'verified-auto') {
      return { className: 'approved', label: 'VERIFIED AUTO' };
    }
    if (normalized === 'verified-human') {
      return { className: 'approved', label: 'VERIFIED HUMAN' };
    }
    if (status === 'pending-recovery') return { className: 'work', label: 'WORK' };
    if (status === 'complete') return { className: 'approved', label: 'VERIFIED HUMAN' };
    return { className: 'work', label: 'WORK' };
  };

  const changeTypeBadge = (changeType?: string) => {
    const normalized = normalizeDeliverableChangeType(changeType);
    if (normalized === 'new') {
      return { className: 'new', label: 'NEW' };
    }
    if (normalized === 'deleted') {
      return { className: 'deleted', label: 'DELETED' };
    }
    return { className: 'edited', label: 'EDITED' };
  };

  const deliveryClassBadge = (deliveryClass?: string) => {
    const normalized = normalizeDeliveryClass(deliveryClass);
    if (normalized === 'decision-grade') {
      return { className: 'decision-grade', label: 'DECISION' };
    }
    if (normalized === 'internal') {
      return { className: 'internal', label: 'INTERNAL' };
    }
    return { className: 'supporting', label: 'SUPPORTING' };
  };

  const handleApprove = async (deliverableId: string) => {
    try {
      await updateDoc(doc(db, 'agent-deliverables', deliverableId), {
        status: 'verified-human',
        verificationState: 'verified-human',
        verificationSource: 'human-review',
        reviewedAt: serverTimestamp(),
      });
      setDeliverables((current) => current.map((item) => item.id === deliverableId
        ? { ...item, status: 'verified-human', verificationState: 'verified-human', verificationSource: 'human-review' }
        : item));
    } catch (err) {
      console.error('Failed to approve deliverable:', err);
    }
  };

  const handleDeny = async (deliverable: Deliverable) => {
    const title = deliverable.title || deliverable.filename || 'this deliverable';
    const reviewReason = window.prompt(`Reject ${title}. Why does it need correction?`, deliverable.reviewReason || 'Needs correction before approval.');
    if (reviewReason === null) return;
    const confirmed = window.confirm(`Reject ${title} and keep it in the audit trail?`);
    if (!confirmed) return;

    try {
      await updateDoc(doc(db, 'agent-deliverables', deliverable.id), {
        status: 'rejected',
        verificationState: 'rejected',
        verificationSource: 'human-review',
        reviewReason: reviewReason.trim() || 'Rejected in Shared Deliverables.',
        reviewedAt: serverTimestamp(),
      });

      if (deliverable.taskId) {
        await updateDoc(doc(db, 'agent-tasks', deliverable.taskId), {
          status: 'needs-review',
          reviewReason: reviewReason.trim() || 'Rejected from Shared Deliverables.',
          updatedAt: serverTimestamp(),
        }).catch(() => undefined);

        await addDoc(collection(db, 'agent-tasks'), {
          name: `[CORRECTION] ${deliverable.title}`,
          description: `Human review rejected deliverable "${deliverable.title}".\n\nReason: ${reviewReason.trim() || 'Rejected from Shared Deliverables.'}\n\nOriginal deliverable path: ${deliverable.filePath || 'n/a'}`,
          assignee: getAgent(deliverable.agentId).displayName,
          status: 'needs-spec',
          priority: 'high',
          source: 'human-spot-check',
          taskClass: 'correction',
          plannerSource: 'mission-supervisor',
          specVersion: 2,
          mode: 'execute',
          objectiveId: deliverable.objectiveId || '',
          originalTaskId: deliverable.taskId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch(() => undefined);
      }

      setDeliverables((current) => current.map((item) => item.id === deliverable.id
        ? {
          ...item,
          status: 'rejected',
          verificationState: 'rejected',
          verificationSource: 'human-review',
          reviewReason: reviewReason.trim() || 'Rejected in Shared Deliverables.',
        }
        : item));
    } catch (err) {
      console.error('Failed to reject deliverable:', err);
    }
  };

  const panel = (
    <div className="sd-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="sd-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sd-header">
          <div className="sd-header-left">
            <div className="sd-header-icon">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="sd-title">Shared Deliverables</h2>
            <p className="sd-subtitle">
                {statusCounts.all} deliverable{statusCounts.all !== 1 ? 's' : ''} across {agentCounts.filter((a) => a.count > 0).length} agent{agentCounts.filter((a) => a.count > 0).length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="sd-header-actions">
            <button className="sd-icon-btn" onClick={loadAll} title="Refresh">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'sd-spinning' : ''}`} />
            </button>
            <button className="sd-close" onClick={onClose}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Agent filter pills */}
        <div className="sd-filters">
          <button
            className={`sd-filter-pill ${filterAgent === 'all' ? 'active' : ''}`}
            onClick={() => setFilterAgent('all')}
          >
            All <span className="sd-pill-count">{deliverables.length}</span>
          </button>
          {agentCounts.map((a) => (
            <button
              key={a.id}
              className={`sd-filter-pill ${filterAgent === a.id ? 'active' : ''}`}
              onClick={() => setFilterAgent(a.id)}
              style={{ '--pill-color': a.color } as React.CSSProperties}
            >
              <span className="sd-pill-emoji">{a.emoji}</span>
              {a.displayName}
              <span className="sd-pill-count">{a.count}</span>
            </button>
          ))}
        </div>

        {/* Status filter pills */}
        <div className="sd-filters">
          <button
            className={`sd-filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All <span className="sd-pill-count">{statusCounts.all}</span>
          </button>
          <button
            className={`sd-filter-pill ${statusFilter === 'needs-review' ? 'active' : ''}`}
            onClick={() => setStatusFilter('needs-review')}
          >
            Needs Review <span className="sd-pill-count">{statusCounts.needsReview}</span>
          </button>
          <button
            className={`sd-filter-pill ${statusFilter === 'approved' ? 'active' : ''}`}
            onClick={() => setStatusFilter('approved')}
          >
            Approved <span className="sd-pill-count">{statusCounts.approved}</span>
          </button>
          <button
            className={`sd-filter-pill ${statusFilter === 'work' ? 'active' : ''}`}
            onClick={() => setStatusFilter('work')}
          >
            Work <span className="sd-pill-count">{statusCounts.work}</span>
          </button>
        </div>

        <div className="sd-filters">
          <button
            className={`sd-filter-pill ${deliveryClassFilter === 'all' ? 'active' : ''}`}
            onClick={() => setDeliveryClassFilter('all')}
          >
            All Classes <span className="sd-pill-count">{movementClassCounts.all}</span>
          </button>
          <button
            className={`sd-filter-pill ${deliveryClassFilter === 'decision-grade' ? 'active' : ''}`}
            onClick={() => setDeliveryClassFilter('decision-grade')}
          >
            Decision Grade <span className="sd-pill-count">{movementClassCounts.decisionGrade}</span>
          </button>
          <button
            className={`sd-filter-pill ${deliveryClassFilter === 'supporting' ? 'active' : ''}`}
            onClick={() => setDeliveryClassFilter('supporting')}
          >
            Supporting <span className="sd-pill-count">{movementClassCounts.supporting}</span>
          </button>
          <button
            className={`sd-filter-pill ${deliveryClassFilter === 'internal' ? 'active' : ''}`}
            onClick={() => setDeliveryClassFilter('internal')}
          >
            Internal <span className="sd-pill-count">{movementClassCounts.internal}</span>
          </button>
        </div>

        {/* Content */}
        <div className="sd-content">
          {loading && (
            <div className="sd-empty">
              <div className="sd-loader" />
              <p>Loading deliverables…</p>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="sd-empty">
              <Package className="w-10 h-10 sd-empty-icon" />
              <p className="sd-empty-title">No deliverables yet</p>
              <p className="sd-empty-desc">
                When agents complete research tasks, their deliverables will appear here.
              </p>
            </div>
          )}

          {!loading && filtered.map((d) => {
            const agent = getAgent(d.agentId);
            const isExpanded = expandedId === d.id;
            return (
              <div key={d.id} className={`sd-item ${isExpanded ? 'sd-item-expanded' : ''}`}>
                <div className="sd-item-header" onClick={() => handleExpand(d)}>
                  <span className="sd-item-emoji">{d.emoji}</span>
                  <div className="sd-item-info">
                    <span className="sd-item-title">{d.title}</span>
                    <span className="sd-item-desc">{d.description}</span>
                    <div className="sd-item-meta">
                      <span
                        className="sd-agent-badge"
                        style={{ borderColor: `${agent.color}40`, color: agent.color }}
                      >
                        {agent.emoji} {agent.displayName}
                      </span>
                      {(() => {
                        const badge = statusBadge(d.status);
                        return (
                          <span className={`sd-status-badge ${badge.className}`}>
                            {badge.label}
                          </span>
                        );
                      })()}
                      {(() => {
                        const badge = changeTypeBadge(d.changeType);
                        return (
                          <span className={`sd-change-badge ${badge.className}`}>
                            {badge.label}
                          </span>
                        );
                      })()}
                      {(() => {
                        const badge = deliveryClassBadge(d.deliveryClass);
                        return (
                          <span className={`sd-delivery-badge ${badge.className}`}>
                            {badge.label}
                          </span>
                        );
                      })()}
                      {d.outcomeStatus && (() => {
                        const badge = outcomeStatusBadge(d.outcomeStatus);
                        return (
                          <span className={`sd-outcome-badge ${badge.className}`}>
                            {badge.label}
                          </span>
                        );
                      })()}
                      {d.outcomeClass && (() => {
                        const badge = outcomeClassBadge(d.outcomeClass);
                        return (
                          <span className={`sd-outcome-badge ${badge.className}`}>
                            {badge.label}
                          </span>
                        );
                      })()}
                      {d.playbookId && (
                        <span className="sd-outcome-badge planned">
                          PLAYBOOK {d.playbookId}{d.playbookVersion ? ` · v${d.playbookVersion}` : ''}
                        </span>
                      )}
                      {d.currentStageId && (
                        <span className="sd-outcome-badge executing">
                          STAGE {d.currentStageId}
                        </span>
                      )}
                      {d.speculative && (
                        <span className="sd-outcome-badge waived">
                          SPECULATIVE
                        </span>
                      )}
                      {d.completedAt && (
                        <span className="sd-date">{new Date(d.completedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="sd-item-actions">
                    <button
                      className="sd-nav-btn"
                      onClick={(e) => { e.stopPropagation(); navigateToAgent(d.agentId, d.filePath, d.taskRef); }}
                      title={`Open ${agent.displayName}'s deliverables page`}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                    <span className={`sd-chevron ${isExpanded ? 'open' : ''}`}>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>

                  {isExpanded && (
                    <div className="sd-item-body">
                      {(() => {
                          const movement = d.movementSignals || deriveMovementSignals(d);
                          return (
                            <details className="sd-movement-section">
                              <summary className="sd-movement-summary">
                                <span>Movement assessment</span>
                                <span className={`sd-movement-badge ${movement.impactToneClass}`}>
                                  {movement.impactLabel} ({movement.score}/7)
                            </span>
                          </summary>
                          <div className="sd-movement-content">
                            <div className="sd-movement-rationale">
                              <strong>Why this matters:</strong>
                              <p>{movement.rationale}</p>
                            </div>
                            {movement.signals.length > 0 && (
                              <ul className="sd-movement-signals">
                                {movement.signals.map((signal) => (
                                  <li key={signal}>{signal}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </details>
                      );
                    })()}
                    {isNeedsReview(d.status) && d.reviewReason && (
                      <div className="sd-review-note">
                        <strong>Review reason:</strong>
                        <span>{d.reviewReason}</span>
                      </div>
                    )}
                    {(d.spotCheckRequired || d.sampledForReview || d.verificationSource) && (
                      <div className="sd-review-note">
                        <strong>Verification:</strong>
                        <span>
                          {d.verificationState || 'work'}
                          {d.verificationSource ? ` via ${d.verificationSource}` : ''}
                          {d.spotCheckRequired ? ' · spot-check required' : ''}
                          {d.sampledForReview ? ' · sampled for review' : ''}
                          {d.movementScore ? ` · movement ${d.movementScore}` : ''}
                        </span>
                      </div>
                    )}
                    {(d.outcomeId || d.outcomeStatus || d.outcomeClass || d.outcomeDomain || d.creditedOutcomeScore !== undefined || d.netOutcomeScore !== undefined || d.businessDebtScore !== undefined) && (
                      <div className="sd-review-note">
                        <strong>Outcome linkage:</strong>
                        <span>
                          {d.outcomeStatus ? outcomeStatusBadge(d.outcomeStatus).label : 'PLANNED'}
                          {d.outcomeClass ? ` · ${outcomeClassBadge(d.outcomeClass).label}` : ''}
                          {d.outcomeDomain ? ` · ${d.outcomeDomain}` : ''}
                          {d.creditedOutcomeScore !== undefined ? ` · credited ${formatOutcomeScore(d.creditedOutcomeScore)}` : ''}
                          {d.netOutcomeScore !== undefined ? ` · net ${formatOutcomeScore(d.netOutcomeScore)}` : ''}
                          {d.businessDebtScore !== undefined ? ` · debt ${formatOutcomeScore(d.businessDebtScore)}` : ''}
                        </span>
                        {d.outcomeId && (
                          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#52525b', fontFamily: 'JetBrains Mono, monospace' }}>
                            Outcome ID: {d.outcomeId}
                          </p>
                        )}
                        {(d.parentOutcomeId || d.supersedesOutcomeId) && (
                          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#52525b' }}>
                            {d.parentOutcomeId ? `Parent ${d.parentOutcomeId}` : ''}
                            {d.parentOutcomeId && d.supersedesOutcomeId ? ' · ' : ''}
                            {d.supersedesOutcomeId ? `Supersedes ${d.supersedesOutcomeId}` : ''}
                          </p>
                        )}
                      </div>
                    )}
                    {(d.playbookId || d.currentStageId || d.stageGateStatus || d.stageBlockReason || d.cleanupState || d.cleanupBy || Boolean(d.readinessSignals)) && (
                      <div className="sd-review-note">
                        <strong>Mission sequencing:</strong>
                        <span>
                          {d.playbookId ? `playbook ${d.playbookId}${d.playbookVersion ? ` · v${d.playbookVersion}` : ''}` : 'playbook —'}
                          {d.currentStageId ? ` · stage ${d.currentStageId}` : ''}
                          {d.stageGateStatus ? ` · gate ${d.stageGateStatus}` : ''}
                          {d.speculative ? ' · speculative' : ''}
                          {d.cleanupState ? ` · cleanup ${d.cleanupState}` : ''}
                          {d.cleanupBy ? ` · ${formatCountdownLike(d.cleanupBy)}` : ''}
                        </span>
                        {d.stageBlockReason && (
                          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#f59e0b' }}>
                            Blocked: {d.stageBlockReason}
                          </p>
                        )}
                        {summarizeReadinessSignals(d.readinessSignals).length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                            {summarizeReadinessSignals(d.readinessSignals).map((signal) => (
                              <span key={signal.id} className={`sd-outcome-badge ${signal.state}`}>
                                {signal.label} · {signal.state.toUpperCase()}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {(d.executionScore !== undefined || d.commercialMovementScore !== undefined) && (
                      <div className="sd-review-note">
                        <strong>Mission scores:</strong>
                        <span>
                          {d.executionScore !== undefined ? `execution ${formatOutcomeScore(d.executionScore)}` : 'execution —'}
                          {d.commercialMovementScore !== undefined ? ` · commercial ${formatOutcomeScore(d.commercialMovementScore)}` : ''}
                        </span>
                      </div>
                    )}
                    {d.tags.length > 0 && (
                      <div className="sd-tags">
                        {d.tags.map((t) => (
                          <span key={t} className="sd-tag">{t}</span>
                        ))}
                      </div>
                    )}
                    <div className="sd-file-preview">
                      <div className="sd-file-header">
                        <FileText className="w-3 h-3" />
                        <span>{d.filename}</span>
                      </div>
                      {fileLoading ? (
                        <div className="sd-file-loading">
                          <div className="sd-loader-sm" />
                          <span>Loading…</span>
                        </div>
                      ) : (
                        <div className="sd-file-content-rendered">
                          <MarkdownRenderer content={fileContent} accentColor={agent.color} />
                        </div>
                      )}
                    </div>
                  {(isNeedsReview(d.status) || d.status === 'verified-auto' || d.spotCheckRequired) && (
                    <div className="sd-review-actions">
                        <button
                          className="sd-approve-btn"
                          onClick={() => handleApprove(d.id)}
                        >
                          <Check className="w-3.5 h-3.5" />
                          Verify
                        </button>
                        <button
                          className="sd-deny-btn"
                          onClick={() => handleDeny(d)}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </div>
                    )}
                    <button
                      className="sd-open-page-btn"
                      onClick={() => navigateToAgent(d.agentId, d.filePath, d.taskRef)}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open {agent.displayName}&apos;s full deliverables page
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .sd-overlay {
          position: fixed; inset: 0; z-index: 9998;
          display: flex; justify-content: flex-end;
          background: rgba(0,0,0,0.45);
          backdrop-filter: blur(4px);
          animation: sdFade 0.2s ease-out;
        }
        @keyframes sdFade { from { opacity: 0; } to { opacity: 1; } }

        .sd-panel {
          width: 480px; max-width: 92vw; height: 100vh;
          background: linear-gradient(180deg, #111118 0%, #0d0d18 100%);
          border-left: 1px solid rgba(99,102,241,0.1);
          display: flex; flex-direction: column;
          animation: sdSlideIn 0.3s ease-out;
          box-shadow: -12px 0 48px rgba(0,0,0,0.5);
        }
        @keyframes sdSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        .sd-header {
          display: flex; align-items: center;
          justify-content: space-between;
          padding: 20px 20px 14px;
          border-bottom: 1px solid rgba(63,63,70,0.12);
        }
        .sd-header-left { display: flex; align-items: center; gap: 12px; }
        .sd-header-icon {
          width: 38px; height: 38px; border-radius: 10px;
          background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1));
          border: 1px solid rgba(99,102,241,0.15);
          display: flex; align-items: center; justify-content: center;
          color: #818cf8;
        }
        .sd-title { font-size: 15px; font-weight: 700; color: #e4e4e7; margin: 0; }
        .sd-subtitle { font-size: 11px; color: #71717a; margin: 2px 0 0; }
        .sd-header-actions { display: flex; align-items: center; gap: 4px; }
        .sd-icon-btn {
          width: 30px; height: 30px; border-radius: 8px;
          border: none; background: transparent; color: #71717a;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .sd-icon-btn:hover { background: rgba(255,255,255,0.06); color: #e4e4e7; }
        .sd-spinning { animation: sdSpin 0.8s linear infinite; }
        @keyframes sdSpin { to { transform: rotate(360deg); } }
        .sd-close {
          width: 30px; height: 30px; border-radius: 8px;
          border: none; background: transparent; color: #71717a;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
        }
        .sd-close:hover { background: rgba(255,255,255,0.06); color: #e4e4e7; }

        /* Filters */
        .sd-filters {
          display: flex; flex-wrap: wrap; gap: 6px;
          padding: 12px 20px;
          border-bottom: 1px solid rgba(63,63,70,0.1);
        }
        .sd-filter-pill {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 4px 10px; border-radius: 8px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          color: #94a3b8; font-size: 11px; font-weight: 500;
          cursor: pointer; transition: all 0.2s; font-family: inherit;
        }
        .sd-filter-pill:hover { background: rgba(255,255,255,0.06); }
        .sd-filter-pill.active {
          background: rgba(99,102,241,0.12);
          border-color: rgba(99,102,241,0.25);
          color: #a5b4fc;
        }
        .sd-pill-emoji { font-size: 12px; }
        .sd-pill-count {
          font-size: 10px; font-weight: 600; padding: 0 5px;
          background: rgba(255,255,255,0.06); border-radius: 4px;
          font-family: 'JetBrains Mono', monospace;
        }

        /* Content */
        .sd-content {
          flex: 1; overflow-y: auto; padding: 12px;
          scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.06) transparent;
        }

        .sd-empty {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 60px 20px; text-align: center;
        }
        .sd-empty-icon { color: #3f3f46; margin-bottom: 12px; }
        .sd-empty-title { font-size: 14px; font-weight: 600; color: #52525b; margin: 0; }
        .sd-empty-desc { font-size: 12px; color: #3f3f46; margin: 6px 0 0; max-width: 280px; }
        .sd-loader {
          width: 28px; height: 28px;
          border: 2px solid rgba(99,102,241,0.15);
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: sdSpin 0.8s linear infinite;
          margin-bottom: 12px;
        }

        /* Individual deliverable */
        .sd-item {
          border-radius: 12px;
          border: 1px solid rgba(63,63,70,0.1);
          background: rgba(255,255,255,0.01);
          margin-bottom: 8px;
          overflow: hidden;
          transition: all 0.2s;
        }
        .sd-item:hover { border-color: rgba(99,102,241,0.12); }
        .sd-item-expanded {
          border-color: rgba(99,102,241,0.2);
          background: rgba(99,102,241,0.02);
        }

        .sd-item-header {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 14px; cursor: pointer; user-select: none;
          transition: background 0.15s;
        }
        .sd-item-header:hover { background: rgba(255,255,255,0.02); }
        .sd-item-emoji { font-size: 22px; flex-shrink: 0; margin-top: 1px; }
        .sd-item-info { flex: 1; min-width: 0; }
        .sd-item-title {
          display: block; font-size: 13px; font-weight: 600; color: #e4e4e7;
        }
        .sd-item-desc {
          display: block; font-size: 11px; color: #71717a; line-height: 1.4;
          margin-top: 2px;
          display: -webkit-box; -webkit-line-clamp: 2;
          -webkit-box-orient: vertical; overflow: hidden;
        }
        .sd-item-meta {
          display: flex; align-items: center; gap: 8px;
          margin-top: 6px; flex-wrap: wrap;
        }
        .sd-agent-badge {
          padding: 1px 8px; border-radius: 12px;
          border: 1px solid; font-size: 10px; font-weight: 600;
        }
        .sd-status-badge {
          font-size: 9px; font-weight: 600; padding: 1px 6px;
          border-radius: 4px; font-family: 'JetBrains Mono', monospace;
        }
        .sd-outcome-badge {
          font-size: 9px; font-weight: 700; padding: 1px 6px;
          border-radius: 4px; font-family: 'JetBrains Mono', monospace;
          border: 1px solid rgba(255,255,255,0.08);
        }
        .sd-outcome-badge.planned {
          background: rgba(99,102,241,0.12); color: #a5b4fc;
          border-color: rgba(99,102,241,0.25);
        }
        .sd-outcome-badge.verified,
        .sd-outcome-badge.ready {
          background: rgba(34,197,94,0.12); color: #4ade80;
          border-color: rgba(34,197,94,0.25);
        }
        .sd-outcome-badge.observing {
          background: rgba(34,211,238,0.12); color: #22d3ee;
          border-color: rgba(34,211,238,0.25);
        }
        .sd-outcome-badge.pending {
          background: rgba(59,130,246,0.12); color: #60a5fa;
          border-color: rgba(59,130,246,0.25);
        }
        .sd-outcome-badge.confirmed {
          background: rgba(34,197,94,0.12); color: #4ade80;
          border-color: rgba(34,197,94,0.25);
        }
        .sd-outcome-badge.reversed,
        .sd-outcome-badge.failed {
          background: rgba(244,63,94,0.12); color: #fb7185;
          border-color: rgba(244,63,94,0.25);
        }
        .sd-outcome-badge.waived {
          background: rgba(251,191,36,0.12); color: #fbbf24;
          border-color: rgba(251,191,36,0.25);
        }
        .sd-outcome-badge.canceled,
        .sd-outcome-badge.superseded {
          background: rgba(148,163,184,0.12); color: #cbd5e1;
          border-color: rgba(148,163,184,0.25);
        }
        .sd-outcome-badge.expired,
        .sd-outcome-badge.missing,
        .sd-outcome-badge.revoked {
          background: rgba(148,163,184,0.12); color: #cbd5e1;
          border-color: rgba(148,163,184,0.25);
        }
        .sd-outcome-badge.terminal {
          background: rgba(34,197,94,0.12); color: #4ade80;
          border-color: rgba(34,197,94,0.25);
        }
        .sd-outcome-badge.enabling {
          background: rgba(59,130,246,0.12); color: #60a5fa;
          border-color: rgba(59,130,246,0.25);
        }
        .sd-outcome-badge.learning {
          background: rgba(251,191,36,0.12); color: #fbbf24;
          border-color: rgba(251,191,36,0.25);
        }
        .sd-outcome-badge.invalidation {
          background: rgba(244,63,94,0.12); color: #fb7185;
          border-color: rgba(244,63,94,0.25);
        }
        .sd-outcome-badge.constraint {
          background: rgba(45,212,191,0.12); color: #2dd4bf;
          border-color: rgba(45,212,191,0.25);
        }
        .sd-outcome-badge.unknown {
          background: rgba(148,163,184,0.12); color: #cbd5e1;
          border-color: rgba(148,163,184,0.25);
        }
        .sd-change-badge {
          font-size: 9px; font-weight: 600; padding: 1px 6px;
          border-radius: 4px; font-family: 'JetBrains Mono', monospace;
        }
        .sd-change-badge.new {
          background: rgba(34,197,94,0.12); color: #4ade80;
          border: 1px solid rgba(34,197,94,0.25);
        }
        .sd-change-badge.edited {
          background: rgba(59,130,246,0.12); color: #60a5fa;
          border: 1px solid rgba(59,130,246,0.25);
        }
        .sd-change-badge.deleted {
          background: rgba(244,63,94,0.1); color: #fda4af;
          border: 1px solid rgba(244,63,94,0.25);
        }
        .sd-delivery-badge {
          font-size: 9px; font-weight: 600; padding: 1px 6px;
          border-radius: 4px; font-family: 'JetBrains Mono', monospace;
        }
        .sd-delivery-badge.decision-grade {
          background: rgba(16,185,129,0.12); color: #34d399;
          border: 1px solid rgba(16,185,129,0.2);
        }
        .sd-delivery-badge.supporting {
          background: rgba(59,130,246,0.12); color: #60a5fa;
          border: 1px solid rgba(59,130,246,0.2);
        }
        .sd-delivery-badge.internal {
          background: rgba(148,163,184,0.12); color: #9ca3af;
          border: 1px solid rgba(148,163,184,0.2);
        }
        .sd-status-badge.pending {
          background: rgba(245,158,11,0.12); color: #f59e0b;
          border: 1px solid rgba(245,158,11,0.2);
        }
        .sd-status-badge.work {
          background: rgba(148,163,184,0.12); color: #cbd5e1;
          border: 1px solid rgba(148,163,184,0.2);
        }
        .sd-status-badge.pending {
          background: rgba(148,163,184,0.12); color: #cbd5e1;
          border: 1px solid rgba(148,163,184,0.2);
        }
        .sd-status-badge.complete {
          background: rgba(34,197,94,0.1); color: #22c55e;
          border: 1px solid rgba(34,197,94,0.2);
        }
        .sd-status-badge.needs-review {
          background: rgba(249,115,22,0.12); color: #fb923c;
          border: 1px solid rgba(249,115,22,0.2);
        }
        .sd-status-badge.approved {
          background: rgba(16,185,129,0.12); color: #34d399;
          border: 1px solid rgba(16,185,129,0.2);
        }
        .sd-status-badge.rejected {
          background: rgba(239,68,68,0.12); color: #f87171;
          border: 1px solid rgba(239,68,68,0.2);
        }
        .sd-date {
          font-size: 10px; color: #52525b;
          font-family: 'JetBrains Mono', monospace;
        }
        .sd-review-note {
          margin: 10px 0 0;
          padding: 8px 10px;
          border: 1px solid rgba(251,146,60,0.2);
          border-radius: 8px;
          background: rgba(251,146,60,0.06);
          color: #fdba74;
          font-size: 11px;
          line-height: 1.4;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .sd-review-note strong {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: #f59e0b;
        }
        .sd-review-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 10px;
        }
        .sd-approve-btn,
        .sd-deny-btn {
          flex: 1;
          border-radius: 8px;
          border: 1px solid transparent;
          padding: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 11px;
          font-weight: 600;
          font-family: inherit;
        }
        .sd-approve-btn {
          color: #34d399;
          border-color: rgba(16,185,129,0.3);
          background: rgba(16,185,129,0.08);
        }
        .sd-approve-btn:hover {
          background: rgba(16,185,129,0.16);
          border-color: rgba(16,185,129,0.45);
        }
        .sd-deny-btn {
          color: #fda4af;
          border-color: rgba(248,113,113,0.3);
          background: rgba(248,113,113,0.08);
        }
        .sd-deny-btn:hover {
          background: rgba(248,113,113,0.16);
          border-color: rgba(248,113,113,0.45);
        }
        .sd-item-actions {
          display: flex; align-items: center; gap: 4px;
          flex-shrink: 0; margin-top: 2px;
        }
        .sd-nav-btn {
          width: 26px; height: 26px; border-radius: 6px;
          border: 1px solid rgba(99,102,241,0.15);
          background: rgba(99,102,241,0.06); color: #818cf8;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .sd-nav-btn:hover {
          background: rgba(99,102,241,0.15);
          border-color: rgba(99,102,241,0.3);
          color: #a5b4fc;
        }
        .sd-chevron {
          color: #52525b; display: flex; align-items: center;
          transition: transform 0.2s;
        }
        .sd-chevron.open { transform: rotate(90deg); }

        /* Expanded body */
        .sd-item-body {
          padding: 0 14px 14px;
          border-top: 1px solid rgba(63,63,70,0.08);
          animation: sdExpand 0.2s ease-out;
        }
        @keyframes sdExpand {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .sd-movement-section {
          margin-top: 10px;
          border: 1px solid rgba(16,185,129,0.18);
          border-radius: 8px;
          background: rgba(16,185,129,0.08);
          overflow: hidden;
        }
        .sd-movement-summary {
          list-style: none;
          cursor: pointer;
          padding: 8px 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          font-size: 10px;
          color: #6ee7b7;
          font-weight: 700;
          font-family: inherit;
          letter-spacing: 0.03em;
        }
        .sd-movement-summary::-webkit-details-marker { display: none; }
        .sd-movement-summary::after {
          content: '▸';
          color: #7dd3fc;
          transition: transform 0.2s;
        }
        .sd-movement-section[open] .sd-movement-summary::after {
          transform: rotate(90deg);
        }
        .sd-movement-content {
          padding: 10px;
          border-top: 1px solid rgba(16,185,129,0.14);
          background: rgba(17, 24, 39, 0.55);
          display: grid;
          gap: 8px;
        }
        .sd-movement-rationale {
          color: #d1fae5;
          font-size: 11px;
          line-height: 1.45;
        }
        .sd-movement-rationale strong {
          color: #6ee7b7;
          font-size: 10px;
          display: block;
          margin-bottom: 4px;
          letter-spacing: 0.02em;
        }
        .sd-movement-rationale p { margin: 0; }
        .sd-movement-signals {
          margin: 0;
          padding-left: 14px;
          font-size: 10px;
          color: #99f6e4;
          display: grid;
          gap: 4px;
          line-height: 1.4;
        }
        .sd-movement-badge {
          border-radius: 999px;
          font-size: 9px;
          padding: 2px 8px;
          border: 1px solid transparent;
          flex-shrink: 0;
        }
        .sd-movement-badge.high {
          background: rgba(16, 185, 129, 0.14);
          color: #86efac;
          border-color: rgba(16, 185, 129, 0.35);
        }
        .sd-movement-badge.medium {
          background: rgba(250, 204, 21, 0.14);
          color: #fde047;
          border-color: rgba(250, 204, 21, 0.35);
        }
        .sd-movement-badge.low {
          background: rgba(248, 113, 113, 0.14);
          color: #fca5a5;
          border-color: rgba(248, 113, 113, 0.35);
        }
        .sd-tags {
          display: flex; flex-wrap: wrap; gap: 4px;
          padding: 10px 0 8px;
        }
        .sd-tag {
          font-size: 9px; padding: 2px 6px; border-radius: 4px;
          background: rgba(255,255,255,0.04); color: #71717a;
          font-family: 'JetBrains Mono', monospace;
        }
        .sd-file-preview {
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.04);
          background: rgba(0,0,0,0.2);
          overflow: hidden;
        }
        .sd-file-header {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 10px;
          background: rgba(255,255,255,0.02);
          border-bottom: 1px solid rgba(255,255,255,0.04);
          font-size: 10px; color: #52525b;
          font-family: 'JetBrains Mono', monospace;
        }
        .sd-file-content-rendered {
          max-height: 320px; overflow-y: auto;
          scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.06) transparent;
        }
        .sd-file-content-rendered :global(.md-rendered) {
          padding: 12px 14px;
          font-size: 12px;
        }
        .sd-file-loading {
          display: flex; align-items: center; gap: 8px;
          padding: 16px 10px; color: #71717a; font-size: 11px;
        }
        .sd-loader-sm {
          width: 14px; height: 14px;
          border: 2px solid rgba(99,102,241,0.15);
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: sdSpin 0.8s linear infinite;
        }
        .sd-open-page-btn {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          width: 100%; padding: 8px; margin-top: 10px;
          border-radius: 8px;
          border: 1px solid rgba(99,102,241,0.15);
          background: rgba(99,102,241,0.06);
          color: #818cf8; font-size: 11px; font-weight: 600;
          cursor: pointer; transition: all 0.2s; font-family: inherit;
        }
        .sd-open-page-btn:hover {
          background: rgba(99,102,241,0.12);
          border-color: rgba(99,102,241,0.3);
          box-shadow: 0 0 16px rgba(99,102,241,0.08);
        }
      `}</style>
    </div>
  );

  return ReactDOM.createPortal(panel, document.body);
};
