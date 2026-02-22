import React, { useEffect, useMemo, useState, CSSProperties } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { useRouter } from 'next/router';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { AgentPresence } from '../../api/firebase/presence/service';
import { db } from '../../api/firebase/config';
import { progressTimelineService } from '../../api/firebase/progressTimeline/service';
import { kanbanService } from '../../api/firebase/kanban/service';
import { nudgeLogService } from '../../api/firebase/nudgeLog/service';
import { KanbanTask } from '../../api/firebase/kanban/types';
import {
  ProgressTimelineEntry,
  ProgressBeat,
  ConfidenceColor,
  ArtifactType,
  TimelineStateTag,
  HourlySnapshotEntry,
  NudgeLogEntry,
  NudgeOutcome,
  NudgeChannel,
} from '../../api/firebase/progressTimeline/types';
import {
  X, Send, ChevronDown, ChevronUp,
  Lightbulb, Rocket, CheckCircle2, AlertTriangle, TrendingUp,
  Zap, Clock, Link2, MessageCircle, Activity, ExternalLink, Copy, Target, ListChecks,
} from 'lucide-react';

/* ── Props ── */
interface ProgressTimelinePanelProps {
  agents: AgentPresence[];
  onClose: () => void;
}

/* ── Constants ── */
const beatConfig: Record<ProgressBeat, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  hypothesis: { label: 'Hypothesis', icon: <Lightbulb size={13} />, color: '#60a5fa', bg: 'rgba(59,130,246,0.12)' },
  'work-in-flight': { label: 'In Progress', icon: <Rocket size={13} />, color: '#a78bfa', bg: 'rgba(139,92,246,0.12)' },
  result: { label: 'Result', icon: <CheckCircle2 size={13} />, color: '#34d399', bg: 'rgba(34,197,94,0.12)' },
  block: { label: 'Blocker', icon: <AlertTriangle size={13} />, color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  'signal-spike': { label: 'Signal Spike', icon: <TrendingUp size={13} />, color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
};

const colorConfig: Record<ConfidenceColor, { label: string; dot: string }> = {
  blue: { label: 'Listening', dot: '#3b82f6' },
  green: { label: 'Momentum', dot: '#22c55e' },
  yellow: { label: 'Friction', dot: '#eab308' },
  red: { label: 'Stalled', dot: '#ef4444' },
};

const avatarColors: Record<string, string> = {
  nora: '#22c55e', scout: '#f59e0b', solara: '#f43f5e', sage: '#8b5cf6', antigravity: '#6366f1',
};

const channelLabels: Record<NudgeChannel, string> = { automation: 'Auto', manual: 'Manual', system: 'System' };
const lensOptions = ['Delight Hunt', 'Friction Hunt', 'Partnership Leverage', 'Retention Proof', 'Fundraising Story', 'Off-Cycle'];
const AGENT_ROUTE_ALIASES: Record<string, string> = {
  branddirector: 'solara',
  intel: 'sage',
  research: 'sage',
  scouts: 'scout',
};
const AGENT_ROUTE_IDS = new Set(['antigravity', 'nora', 'scout', 'solara', 'sage']);

const normalizeAgentKey = (value?: string) => (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const OBJECTIVE_CODE_SKIP_TOKENS = new Set([
  '-', 'N/A', 'NA', 'NONE', 'UNKNOWN', 'UNASSIGNED', 'UNTRACKED', 'NIL', 'NULL', 'TBD', 'TODO', 'TEMP', 'GENERAL',
]);

const normalizeObjectiveCode = (value?: string): string => {
  const normalized = (value || '').trim().toUpperCase();
  if (!normalized) return '';
  if (normalized.length < 2 || normalized.length > 24) return '';
  if (OBJECTIVE_CODE_SKIP_TOKENS.has(normalized)) return '';
  if (normalized.includes('/') || normalized.includes('\\')) return '';
  if (normalized.includes('://')) return '';
  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(normalized)) return '';
  if (normalized === '-') return '';
  if (/^\d+$/.test(normalized)) return '';
  return normalized;
};

const sanitizeRecordedFilePath = (rawPath?: string): string => {
  if (!rawPath) return '';
  let next = rawPath.trim();
  if (!next) return '';

  const porcelainMatch = next.match(/^[ MADRCU?!]{1,2}\s+(.*)$/);
  if (porcelainMatch) {
    next = porcelainMatch[1].trim();
  }

  if (next.includes(' -> ')) {
    next = next.split(' -> ').pop()?.trim() || next;
  }

  if (
    (next.startsWith('"') && next.endsWith('"')) ||
    (next.startsWith("'") && next.endsWith("'"))
  ) {
    next = next.slice(1, -1);
  }

  const trimmed = next.replace(/^\.\/+/, '');
  return trimmed.replace(/^docs\/agents\/sage\/deliverables(?=$|\/)/, 'docs/sage/deliverables');
};

const resolveAgentRouteId = (agentId?: string, agentName?: string): string | null => {
  const candidates = [agentId, agentName];
  for (const candidate of candidates) {
    const normalized = normalizeAgentKey(candidate);
    if (!normalized) continue;
    const canonical = AGENT_ROUTE_ALIASES[normalized] || normalized;
    if (AGENT_ROUTE_IDS.has(canonical)) return canonical;
  }
  return null;
};

type FeedItem =
  | { id: string; type: 'beat'; createdAt: number; payload: ProgressTimelineEntry }
  | { id: string; type: 'nudge'; createdAt: number; payload: NudgeLogEntry };

type ObjectiveProgressItem =
  | { type: 'beat'; id: string; createdAt: number; payload: ProgressTimelineEntry }
  | { type: 'nudge'; id: string; createdAt: number; payload: NudgeLogEntry };

type ObjectiveProgressGroup = {
  code: string;
  label: string;
  taskCount: number;
  doneCount: number;
  inProgressCount: number;
  todoCount: number;
  completionPercent: number;
  objectiveTasks: KanbanTask[];
  recentItems: ObjectiveProgressItem[];
  lastEventAt: number;
};

type TabKey = 'feed' | 'snapshots' | 'objectives';
type CopyState = 'idle' | 'copied' | 'error';
const UNLABELED_OBJECTIVE_LABEL = 'Strategic Objective';

const FEED_BEAT_LIMIT = 200;
const FEED_NUDGE_LIMIT = 80;
const SNAPSHOT_LIMIT = 40;

/* ── Styles ── */
const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
  } as CSSProperties,
  panel: {
    width: 'min(640px, 92vw)', maxHeight: '85vh', background: '#0a0e14', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 20, display: 'flex', flexDirection: 'column', color: '#e7e9ea',
    boxShadow: '0 32px 64px rgba(0,0,0,0.5)', overflow: 'hidden',
  } as CSSProperties,
  header: {
    padding: '20px 24px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  } as CSSProperties,
  headerActions: {
    display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
  } as CSSProperties,
  title: { fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' } as CSSProperties,
  subtitle: { fontSize: 13, color: '#6b7280', margin: '3px 0 0' } as CSSProperties,
  closeBtn: {
    width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280', display: 'flex',
    alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
  } as CSSProperties,
  copyIconBtn: (state: CopyState): CSSProperties => ({
    width: 34,
    height: 34,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.08)',
    background:
      state === 'copied'
        ? 'rgba(34,197,94,0.15)'
        : state === 'error'
          ? 'rgba(248,113,113,0.15)'
          : 'rgba(255,255,255,0.04)',
    color: state === 'copied' ? '#4ade80' : state === 'error' ? '#f87171' : '#9ca3af',
  }),
  tabs: {
    display: 'flex', alignItems: 'center', gap: 0, padding: '0 24px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  } as CSSProperties,
  tab: (active: boolean): CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px', fontSize: 13, fontWeight: 600,
    color: active ? '#1d9bf0' : '#6b7280', background: 'none', border: 'none',
    borderBottom: active ? '2px solid #1d9bf0' : '2px solid transparent', cursor: 'pointer',
  }),
  tabCount: {
    fontSize: 10, fontWeight: 700, padding: '1px 6px', background: 'rgba(29,155,240,0.15)',
    color: '#1d9bf0', borderRadius: 10, marginLeft: 4,
  } as CSSProperties,
  composeToggle: (open: boolean): CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', fontSize: 13, fontWeight: 600,
    background: open ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #1d9bf0, #1a8cd8)',
    color: open ? '#6b7280' : 'white', border: 'none', borderRadius: 20, cursor: 'pointer', marginLeft: 'auto', margin: '6px 0 6px auto',
  }),
  content: { flex: 1, overflowY: 'auto', overflowX: 'hidden' } as CSSProperties,
  // Card styles
  card: (borderColor: string): CSSProperties => ({
    padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.04)',
    borderLeft: `3px solid ${borderColor}`,
  }),
  cardRow: { display: 'flex', gap: 12, alignItems: 'flex-start' } as CSSProperties,
  avatar: (color: string, size = 38): CSSProperties => ({
    width: size, height: size, minWidth: size, borderRadius: '50%', flexShrink: 0,
    background: `linear-gradient(135deg, ${color}30, ${color}15)`, border: `2px solid ${color}55`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size * 0.42, fontWeight: 700, color: color,
  }),
  cardBody: { flex: 1, minWidth: 0 } as CSSProperties,
  cardHeader: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', lineHeight: 1.3 } as CSSProperties,
  name: { fontWeight: 700, fontSize: 14, color: '#e7e9ea' } as CSSProperties,
  objCode: { fontSize: 12, color: '#1d9bf0', fontWeight: 500 } as CSSProperties,
  dot: { color: '#4b5563', fontSize: 12 } as CSSProperties,
  time: { color: '#6b7280', fontSize: 12 } as CSSProperties,
  headline: { margin: '6px 0 0', fontSize: 14, lineHeight: 1.5, color: '#d1d5db', wordWrap: 'break-word' } as CSSProperties,
  tags: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 } as CSSProperties,
  tag: (color: string, bg?: string): CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', fontSize: 11, fontWeight: 600,
    border: `1px solid ${color}44`, borderRadius: 16, color, background: bg || 'transparent',
  }),
  confDot: (color: string): CSSProperties => ({
    width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0,
  }),
  nudgeBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700,
    color: '#a78bfa', background: 'rgba(139,92,246,0.12)', padding: '1px 8px', borderRadius: 10,
  } as CSSProperties,
  artifact: {
    marginTop: 10, padding: '10px 12px', background: 'rgba(29,155,240,0.06)',
    border: '1px solid rgba(29,155,240,0.12)', borderRadius: 12, fontSize: 13, color: '#9ca3af', lineHeight: 1.45,
  } as CSSProperties,
  artifactLink: {
    display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10,
    fontSize: 13, color: '#1d9bf0', textDecoration: 'none',
  } as CSSProperties,
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '60px 20px', color: '#4b5563', gap: 8,
  } as CSSProperties,
  // Composer
  composer: {
    padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.02)',
  } as CSSProperties,
  composeForm: { display: 'flex', flexDirection: 'column', gap: 12 } as CSSProperties,
  composeTop: { display: 'flex', alignItems: 'center', gap: 10 } as CSSProperties,
  input: (flex?: number): CSSProperties => ({
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '7px 10px', color: '#e7e9ea', fontSize: 13, flex: flex ?? undefined,
    outline: 'none', fontFamily: 'inherit',
  }),
  textarea: {
    width: '100%', background: 'transparent', border: 'none', color: '#e7e9ea',
    fontSize: 15, resize: 'none', padding: '8px 0', outline: 'none',
    borderBottom: '1px solid rgba(255,255,255,0.06)', fontFamily: 'inherit',
  } as CSSProperties,
  beatChipGroup: { display: 'flex', flexWrap: 'wrap', gap: 6 } as CSSProperties,
  beatChip: (active: boolean, color: string, bg: string): CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11, fontWeight: active ? 700 : 500,
    background: active ? bg : 'rgba(255,255,255,0.04)', color: active ? color : '#6b7280',
    border: `1px solid ${active ? color + '66' : 'rgba(255,255,255,0.08)'}`, borderRadius: 16, cursor: 'pointer',
  }),
  optionRow: { display: 'flex', gap: 8 } as CSSProperties,
  select: {
    flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8, padding: '6px 8px', color: '#e7e9ea', fontSize: 12, outline: 'none',
  } as CSSProperties,
  publishBtn: (disabled: boolean): CSSProperties => ({
    alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 20px', fontSize: 13, fontWeight: 700,
    background: 'linear-gradient(135deg, #1d9bf0, #1a8cd8)',
    color: 'white', border: 'none', borderRadius: 20, cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }),
  error: { color: '#f87171', fontSize: 12, margin: 0 } as CSSProperties,
  // Snapshot
  snapCard: (borderColor: string): CSSProperties => ({
    padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.04)',
    borderLeft: `3px solid ${borderColor}`,
  }),
  snapTop: { display: 'flex', alignItems: 'center', gap: 10 } as CSSProperties,
  snapName: { fontSize: 13, fontWeight: 700, color: '#e7e9ea' } as CSSProperties,
  snapCode: { fontSize: 12, color: '#1d9bf0', marginLeft: 6 } as CSSProperties,
  snapTime: {
    marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4,
    fontSize: 11, color: '#6b7280',
  } as CSSProperties,
  snapNote: { fontSize: 13, color: '#9ca3af', margin: '8px 0 0 48px', lineHeight: 1.4 } as CSSProperties,
};

/* ── Component ── */
const ProgressTimelinePanel: React.FC<ProgressTimelinePanelProps> = ({ agents, onClose }) => {
  const router = useRouter();
  const [entries, setEntries] = useState<ProgressTimelineEntry[]>([]);
  const [snapshots, setSnapshots] = useState<HourlySnapshotEntry[]>([]);
  const [nudges, setNudges] = useState<NudgeLogEntry[]>([]);
  const [objectiveTasks, setObjectiveTasks] = useState<KanbanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('feed');
  const [objectiveLabelByCode, setObjectiveLabelByCode] = useState<Record<string, string>>({});
  const [composerOpen, setComposerOpen] = useState(false);
  const [hoverCard, setHoverCard] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<CopyState>('idle');

  const filteredEntries = entries;
  const filteredNudges = nudges;
  const filteredSnapshots = snapshots;

  const feedItems = useMemo<FeedItem[]>(() => {
    const b: FeedItem[] = filteredEntries.map((e) => ({ id: `b-${e.id}`, type: 'beat', createdAt: e.createdAt?.getTime?.() || 0, payload: e }));
    const n: FeedItem[] = filteredNudges.map((e) => ({ id: `n-${e.id}`, type: 'nudge', createdAt: e.createdAt?.getTime?.() || 0, payload: e }));
    return [...b, ...n].sort((a, b) => b.createdAt - a.createdAt);
  }, [filteredEntries, filteredNudges]);

  // Composer state
  const [agentId, setAgentId] = useState('');
  const [objectiveCode, setObjectiveCode] = useState('');
  const [beat, setBeat] = useState<ProgressBeat>('hypothesis');
  const [headline, setHeadline] = useState('');
  const [lensTag, setLensTag] = useState(lensOptions[0]);
  const [confidenceColor, setConfidenceColor] = useState<ConfidenceColor>('blue');
  const [stateTag, setStateTag] = useState<TimelineStateTag>('signals');
  const [artifactType, setArtifactType] = useState<ArtifactType>('none');
  const [artifactText, setArtifactText] = useState('');
  const [artifactUrl, setArtifactUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!agentId && agents.length > 0) setAgentId(agents[0].id); }, [agents, agentId]);

  useEffect(() => {
    const u1 = progressTimelineService.listen((items) => { setEntries(items); setLoading(false); }, { limit: FEED_BEAT_LIMIT });
    const u2 = progressTimelineService.listenSnapshots((items) => setSnapshots(items), { limit: SNAPSHOT_LIMIT });
    const u3 = nudgeLogService.listen((items) => setNudges(items), { limit: FEED_NUDGE_LIMIT });
    let active = true;

      const hydrateObjectiveLabels = async () => {
      try {
        const tasks = await kanbanService.fetchAllTasks();
        const labels: Record<string, string> = {};

        tasks.forEach((task) => {
          const code = normalizeObjectiveCode(task.objectiveCode);
          const name = (task.name || '').trim();

          if (!code || !name) return;
          if (!labels[code]) labels[code] = name;
        });
        if (active) {
          setObjectiveTasks(tasks);
          setObjectiveLabelByCode(labels);
        }
      } catch (error) {
        console.error('Failed to hydrate objective labels from kanban tasks', error);
      }
    };

    void hydrateObjectiveLabels();

    return () => {
      active = false;
      u1();
      u2();
      u3();
    };
  }, []);

  const resolveObjectiveLabel = (rawCode: string): string => {
    const code = normalizeObjectiveCode(rawCode);
    if (!code) return '';
    return objectiveLabelByCode[code] || '';
  };

  const resolveObjectiveDisplayLabel = (rawCode: string, fallback = ''): string => {
    const directLabel = resolveObjectiveLabel(rawCode);
    if (directLabel) return directLabel;
    return fallback;
  };

  const feedTabCountTitle = `Showing ${feedItems.length} items (${entries.length} beats + ${nudges.length} nudges). Limits: ${FEED_BEAT_LIMIT} beats, ${FEED_NUDGE_LIMIT} nudges.`;

  const objectiveProgressGroups = useMemo<ObjectiveProgressGroup[]>(() => {
    const groups = new Map<string, ObjectiveProgressGroup>();

    const ensureGroup = (code: string) => {
      const existing = groups.get(code);
      if (existing) return existing;

      const label = resolveObjectiveDisplayLabel(code, UNLABELED_OBJECTIVE_LABEL);
      const group: ObjectiveProgressGroup = {
        code,
        label,
        taskCount: 0,
        doneCount: 0,
        inProgressCount: 0,
        todoCount: 0,
        completionPercent: 0,
        objectiveTasks: [],
        recentItems: [],
        lastEventAt: 0,
      };
      groups.set(code, group);
      return group;
    };

    objectiveTasks.forEach((task) => {
      const code = normalizeObjectiveCode(task.objectiveCode);
      if (!code) return;

      const group = ensureGroup(code);
      group.taskCount += 1;
      if (task.status === 'done') group.doneCount += 1;
      else if (task.status === 'in-progress') group.inProgressCount += 1;
      else group.todoCount += 1;
      group.objectiveTasks.push(task);
      group.label = resolveObjectiveDisplayLabel(code, group.label);
    });

    filteredEntries.forEach((entry) => {
      const code = normalizeObjectiveCode(entry.objectiveCode);
      if (!code) return;
      const group = ensureGroup(code);
      const createdAt = entry.createdAt?.getTime?.() || 0;
      group.recentItems.push({ type: 'beat', id: `b-${entry.id}`, createdAt, payload: entry });
      if (createdAt > group.lastEventAt) {
        group.lastEventAt = createdAt;
      }
    });

    filteredNudges.forEach((entry) => {
      const code = normalizeObjectiveCode(entry.objectiveCode);
      if (!code) return;
      const group = ensureGroup(code);
      const createdAt = entry.createdAt?.getTime?.() || 0;
      group.recentItems.push({ type: 'nudge', id: `n-${entry.id}`, createdAt, payload: entry });
      if (createdAt > group.lastEventAt) {
        group.lastEventAt = createdAt;
      }
    });

    // Keep tasks with no events discoverable for progress visibility.
    objectiveTasks.forEach((task) => {
      const code = normalizeObjectiveCode(task.objectiveCode);
      if (!code) return;
      const group = ensureGroup(code);
      if (!group.lastEventAt) {
        const updated = task.updatedAt?.getTime?.() || task.createdAt?.getTime?.() || 0;
        group.lastEventAt = updated;
      }
    });

    groups.forEach((group) => {
      const total = group.taskCount || 1;
      group.completionPercent = Math.round((group.doneCount / total) * 100);
      group.recentItems.sort((a, b) => b.createdAt - a.createdAt);
      group.label = resolveObjectiveDisplayLabel(group.code, group.label);
      if (!group.label) {
        group.label = UNLABELED_OBJECTIVE_LABEL;
      }
    });

    return [...groups.values()].sort((a, b) => b.lastEventAt - a.lastEventAt);
  }, [filteredEntries, filteredNudges, objectiveTasks, objectiveLabelByCode]);

  const formatExportTimestamp = (value?: Date): string => {
    if (!value) return 'unknown-time';
    try {
      return format(value, 'yyyy-MM-dd HH:mm:ss');
    } catch {
      return 'unknown-time';
    }
  };

  const buildFeedExportText = (): string => {
    const lines: string[] = [
      'Heartbeat Feed export',
      `Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`,
      `Loaded items: ${feedItems.length} (beats: ${filteredEntries.length}, nudges: ${filteredNudges.length})`,
      `Configured limits: beats ${FEED_BEAT_LIMIT}, nudges ${FEED_NUDGE_LIMIT}`,
      '',
    ];

    feedItems.forEach((item, index) => {
      if (item.type === 'beat') {
        const entry = item.payload as ProgressTimelineEntry;
        lines.push(
          `[${index + 1}] BEAT ${formatExportTimestamp(entry.createdAt)} | ${entry.agentName || entry.agentId || 'Unknown'} | ${entry.objectiveCode || '-'} | ${entry.beat} | ${entry.headline}`
        );

        const tags: string[] = [];
        if (entry.lensTag) tags.push(`lens=${entry.lensTag}`);
        tags.push(`confidence=${entry.confidenceColor || 'blue'}`);
        tags.push(`state=${entry.stateTag || 'signals'}`);
        lines.push(`tags: ${tags.join(', ')}`);

        if (entry.artifactType === 'text' && entry.artifactText) {
          lines.push(`artifact: ${entry.artifactText}`);
        }
        if (entry.artifactType === 'url' && entry.artifactUrl) {
          lines.push(`artifact_url: ${entry.artifactUrl}`);
        }
      } else {
        const entry = item.payload as NudgeLogEntry;
        lines.push(
          `[${index + 1}] NUDGE ${formatExportTimestamp(entry.createdAt)} | ${entry.agentName || entry.agentId || 'Unknown'} | ${entry.objectiveCode || '-'} | ${entry.outcome} | ${entry.message}`
        );
        lines.push(
          `channel: ${entry.channel}${entry.respondedAt ? ` | responded: ${formatExportTimestamp(entry.respondedAt)}` : ''}`
        );
      }

      lines.push('');
    });

    return lines.join('\n').trim();
  };

  const buildSnapshotsExportText = (): string => {
    const exportSnapshots = filteredSnapshots;

    const lines: string[] = [
      'Health Snapshot export',
      `Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`,
      `Loaded snapshots: ${exportSnapshots.length}`,
      `Configured limit: ${SNAPSHOT_LIMIT}`,
      '',
    ];

    exportSnapshots.forEach((snapshot, index) => {
      lines.push(
        `[${index + 1}] SNAPSHOT ${formatExportTimestamp(snapshot.createdAt)} | ${snapshot.agentName || snapshot.agentId || 'Unknown'} | ${snapshot.objectiveCode || '-'} | ${snapshot.color} | ${snapshot.stateTag}`
      );
      if (snapshot.note) lines.push(`note: ${snapshot.note}`);
      if (snapshot.beatCompleted) lines.push(`beat_completed: ${snapshot.beatCompleted}`);
      lines.push('');
    });

    return lines.join('\n').trim();
  };

  const buildObjectiveProgressExportText = (): string => {
    const lines: string[] = [
      'Objective Progress export',
      `Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`,
      `Objectives tracked: ${objectiveProgressGroups.length}`,
      '',
    ];

    objectiveProgressGroups.forEach((group, index) => {
      lines.push(
        `[${index + 1}] ${group.label} | code:${group.code} | tasks: ${group.taskCount} (${group.doneCount} done, ${group.inProgressCount} in-progress, ${group.todoCount} todo) | completion ${group.completionPercent}%`
      );
      if (group.recentItems.length > 0) {
        lines.push('  Recent events:');
        group.recentItems.slice(0, 5).forEach((item) => {
          if (item.type === 'beat') {
            const beatItem = item.payload as ProgressTimelineEntry;
            lines.push(`  - ${formatExportTimestamp(beatItem.createdAt)} beat:${beatItem.beat} | ${beatItem.agentName || beatItem.agentId || 'Unknown'} | ${beatItem.headline}`);
          } else {
            const nudgeItem = item.payload as NudgeLogEntry;
            lines.push(`  - ${formatExportTimestamp(nudgeItem.createdAt)} nudge:${nudgeItem.outcome} | ${nudgeItem.agentName || nudgeItem.agentId || 'Unknown'} | ${nudgeItem.message}`);
          }
        });
      }
      lines.push('');
    });

    return lines.join('\n').trim();
  };

  const copyTextToClipboard = async (text: string): Promise<boolean> => {
    if (!text) return false;

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fall through to legacy copy path.
      }
    }

    if (typeof document === 'undefined') return false;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  };

  const handleCopyTimeline = async () => {
    const exportText = activeTab === 'feed'
      ? buildFeedExportText()
      : activeTab === 'snapshots'
        ? buildSnapshotsExportText()
        : buildObjectiveProgressExportText();
    const copied = await copyTextToClipboard(exportText);
    setCopyState(copied ? 'copied' : 'error');
    setTimeout(() => setCopyState('idle'), 1600);
  };

  const selectedAgent = useMemo(() => agents.find((a) => a.id === agentId), [agents, agentId]);

  const resetForm = () => {
    setHeadline(''); setObjectiveCode(''); setBeat('work-in-flight');
    setLensTag(lensOptions[0]); setConfidenceColor('blue'); setStateTag('signals');
    setArtifactType('none'); setArtifactText(''); setArtifactUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent) { setError('Select an agent.'); return; }
    if (!objectiveCode.trim() || !headline.trim()) { setError('Objective code and headline required.'); return; }
    setIsSaving(true); setError(null);
    try {
      await progressTimelineService.publish({
        agentId: selectedAgent.id, agentName: selectedAgent.displayName, emoji: selectedAgent.emoji,
        objectiveCode: objectiveCode.trim(), beat, headline: headline.trim(), lensTag: lensTag.trim(),
        confidenceColor, stateTag, artifactType,
        artifactText: artifactType === 'text' ? artifactText.trim() : '',
        artifactUrl: artifactType === 'url' ? artifactUrl.trim() : '',
      });
      resetForm(); setComposerOpen(false);
    } catch (err: any) { setError(err?.message || 'Failed to publish.'); }
    finally { setIsSaving(false); }
  };

  const getAvatarColor = (id?: string, name?: string) =>
    avatarColors[(id ?? name ?? '').toLowerCase()] || '#6366f1';

  const getResultBeatDestination = (entry: ProgressTimelineEntry): string | null => {
    if (entry.beat !== 'result') return null;

    const explicitUrl = entry.artifactType === 'url' ? entry.artifactUrl?.trim() : '';
    if (explicitUrl) return explicitUrl;

    const objectiveCode = entry.objectiveCode?.trim();
    const agentRouteId = resolveAgentRouteId(entry.agentId, entry.agentName);

    if (objectiveCode) {
      return `/admin/projectManagement?taskId=${encodeURIComponent(objectiveCode)}`;
    }

    if (agentRouteId) {
      return `/admin/deliverables/${agentRouteId}`;
    }

    return null;
  };

  const resolveDeliverableDestinationForTask = async (entry: ProgressTimelineEntry): Promise<string | null> => {
    const taskId = entry.objectiveCode?.trim();
    if (!taskId) return null;

    const findByTaskField = async (field: string): Promise<{ filePath?: string; agentId?: string; agentName?: string } | null> => {
      try {
        const deliverablesQuery = query(
          collection(db, 'agent-deliverables'),
          where(field, '==', taskId),
          limit(1),
        );
        const snap = await getDocs(deliverablesQuery);
        if (snap.empty) return null;
        return snap.docs[0].data() as { filePath?: string; agentId?: string; agentName?: string };
      } catch {
        return null;
      }
    };

    const data = await findByTaskField('taskId')
      .then((match) => match || findByTaskField('taskRef'))
      .then((match) => match || findByTaskField('objectiveCode'))
      .then((match) => match || findByTaskField('taskName'));

    if (!data) return null;

    const filePath = sanitizeRecordedFilePath(data.filePath);
    const agentRouteId = resolveAgentRouteId(data.agentId, data.agentName) || resolveAgentRouteId(entry.agentId, entry.agentName);
    if (!agentRouteId) return null;

    const params = new URLSearchParams({
      taskRef: taskId,
      taskId,
      objectiveCode: taskId,
    });
    if (filePath) params.set('file', filePath);

    return `/admin/deliverables/${agentRouteId}?${params.toString()}`;
  };

  const openResultBeatDestination = async (entry: ProgressTimelineEntry) => {
    const explicitUrl = entry.artifactType === 'url' ? entry.artifactUrl?.trim() : '';
    const resolvedByTask = !explicitUrl ? await resolveDeliverableDestinationForTask(entry) : '';
    const destination = explicitUrl || resolvedByTask || getResultBeatDestination(entry);
    if (!destination) return;

    if (/^https?:\/\//i.test(destination)) {
      window.open(destination, '_blank', 'noopener,noreferrer');
      return;
    }

    router.push(destination);
  };

  /* ── Beat card ── */
  const renderBeatCard = (entry: ProgressTimelineEntry) => {
    const cfg = beatConfig[entry.beat];
    const cc = colorConfig[entry.confidenceColor];
    const timeAgo = formatDistanceToNow(entry.createdAt || new Date(), { addSuffix: true });
    const color = getAvatarColor(entry.agentId, entry.agentName);
    const isHovered = hoverCard === `b-${entry.id}`;
    const resultDestination = getResultBeatDestination(entry);
    const isResultClickable = Boolean(resultDestination);

    return (
      <div key={entry.id}
        style={{
          ...S.card(cc.dot),
          background: isHovered ? 'rgba(255,255,255,0.02)' : 'transparent',
          transition: 'background 0.15s',
          cursor: isResultClickable ? 'pointer' : 'default',
        }}
        onMouseEnter={() => setHoverCard(`b-${entry.id}`)}
        onMouseLeave={() => setHoverCard(null)}
        onClick={isResultClickable ? (e) => {
          const target = e.target as HTMLElement;
          if (target.closest('a,button')) return;
          void openResultBeatDestination(entry);
        } : undefined}
        onKeyDown={isResultClickable ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            void openResultBeatDestination(entry);
          }
        } : undefined}
        role={isResultClickable ? 'button' : undefined}
        tabIndex={isResultClickable ? 0 : undefined}
        aria-label={isResultClickable ? 'Open deliverable' : undefined}
      >
        <div style={S.cardRow}>
          <div style={S.avatar(color)}>
            {entry.emoji || entry.agentName?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div style={S.cardBody}>
            <div style={S.cardHeader}>
              <span style={S.name}>{entry.agentName}</span>
              {resolveObjectiveLabel(entry.objectiveCode) && (
                <span style={S.objCode} title={resolveObjectiveLabel(entry.objectiveCode)}>{resolveObjectiveLabel(entry.objectiveCode)}</span>
              )}
              <span style={S.dot}>·</span>
              <span style={S.time}>{timeAgo}</span>
            </div>
            <p style={S.headline}>{entry.headline}</p>
            {entry.artifactType === 'text' && entry.artifactText && (
              <div style={S.artifact}>{entry.artifactText}</div>
            )}
            {entry.artifactType === 'url' && entry.artifactUrl && (
              <a href={entry.artifactUrl} target="_blank" rel="noreferrer" style={S.artifactLink} onClick={(e) => e.stopPropagation()}>
                <Link2 size={13} /> {entry.artifactUrl.replace(/^https?:\/\//, '').slice(0, 50)}
              </a>
            )}
            <div style={S.tags}>
              <span style={S.tag(cfg.color, cfg.bg)}>{cfg.icon} {cfg.label}</span>
              {entry.lensTag && <span style={S.tag('#fbbf24')}>{entry.lensTag}</span>}
              <span style={S.tag('#6b7280')}>
                <span style={S.confDot(cc.dot)} />
                {cc.label}
              </span>
              {isResultClickable && (
                <span style={S.tag('#1d9bf0', 'rgba(29,155,240,0.12)')}>
                  <ExternalLink size={11} />
                  Open deliverable
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ── Nudge card ── */
  const renderNudgeCard = (entry: NudgeLogEntry) => {
    const timeAgo = formatDistanceToNow(entry.createdAt || new Date(), { addSuffix: true });
    const oc: Record<NudgeOutcome, { color: string; icon: React.ReactNode }> = {
      pending: { color: '#fbbf24', icon: <Clock size={12} /> },
      acknowledged: { color: '#60a5fa', icon: <MessageCircle size={12} /> },
      resolved: { color: '#34d399', icon: <CheckCircle2 size={12} /> },
    };
    const outcome = oc[entry.outcome];
    const color = getAvatarColor(entry.agentId, entry.agentName);
    const isHovered = hoverCard === `n-${entry.id}`;

    return (
      <div key={entry.id}
        style={{ ...S.card('#a78bfa'), background: isHovered ? 'rgba(139,92,246,0.04)' : 'transparent', transition: 'background 0.15s' }}
        onMouseEnter={() => setHoverCard(`n-${entry.id}`)}
        onMouseLeave={() => setHoverCard(null)}
      >
        <div style={S.cardRow}>
          <div style={S.avatar(color)}>
            {entry.agentName?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div style={S.cardBody}>
            <div style={S.cardHeader}>
              <span style={S.name}>{entry.agentName}</span>
              <span style={S.nudgeBadge}><Zap size={11} /> Nudge</span>
              <span style={S.dot}>·</span>
              <span style={S.time}>{timeAgo}</span>
            </div>
            <p style={S.headline}>{entry.message}</p>
            <div style={S.tags}>
              <span style={S.tag(outcome.color)}>
                {outcome.icon}
                {entry.outcome.charAt(0).toUpperCase() + entry.outcome.slice(1)}
              </span>
              <span style={S.tag('#6b7280')}>{channelLabels[entry.channel]}</span>
              {entry.respondedAt && (
                <span style={{ fontSize: 11, color: '#6b7280' }}>
                  Replied {formatDistanceToNow(entry.respondedAt, { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ── Snapshot card ── */
  const renderSnapshotCard = (s: HourlySnapshotEntry) => {
    const cc = colorConfig[s.color] || colorConfig.blue;
    const color = getAvatarColor(s.agentId, s.agentName);

    // Safe date formatting — guard against missing/invalid hourIso
    let timeLabel = 'Unknown';
    try {
      const d = s.hourIso ? new Date(s.hourIso) : s.createdAt ? new Date(s.createdAt) : null;
      if (d && !isNaN(d.getTime())) {
        timeLabel = format(d, 'MMM d, HH:mm');
      }
    } catch { /* fall back to 'Unknown' */ }

    return (
      <div key={s.id} style={S.snapCard(cc.dot)}>
          <div style={S.snapTop}>
          <div style={S.avatar(color, 30)}>
            {s.agentName?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <span style={S.snapName}>{s.agentName || 'Agent'}</span>
            {resolveObjectiveLabel(s.objectiveCode) && (
              <span style={S.snapCode} title={resolveObjectiveLabel(s.objectiveCode)}>{resolveObjectiveLabel(s.objectiveCode)}</span>
            )}
          </div>
          <span style={S.snapTime}><Clock size={11} /> {timeLabel}</span>
        </div>
        <p style={S.snapNote}>{s.note || 'No note logged'}</p>
      </div>
    );
  };

  const renderObjectiveProgressCard = (group: ObjectiveProgressGroup) => {
    const progressColor = group.completionPercent >= 70 ? '#34d399' : group.completionPercent >= 40 ? '#fbbf24' : '#ef4444';
    const meterValue = Math.min(100, Math.max(0, group.completionPercent));
    const lastEvent = group.lastEventAt ? `${formatDistanceToNow(new Date(group.lastEventAt), { addSuffix: true })}` : 'No events yet';

    return (
      <div
        key={group.code}
        style={{
          ...S.card(progressColor),
          borderLeftWidth: 4,
          marginBottom: 10,
          padding: '14px 16px',
        }}
      >
        <div style={S.cardRow}>
          <div style={S.avatar(progressColor, 30)}>
            <Target size={14} />
          </div>
          <div style={S.cardBody}>
            <div style={{ ...S.cardHeader, alignItems: 'center' }}>
              <span style={S.name}>{group.label}</span>
              <span style={S.dot}>·</span>
              <span style={{ ...S.time, color: '#6b7280' }}>{lastEvent}</span>
            </div>
            <div style={S.tags}>
              <span style={S.tag(progressColor, `${progressColor}22`)}>
                <ListChecks size={10} /> {group.taskCount} tasks
              </span>
              <span style={S.tag('#a78bfa')}>
                {group.doneCount} done
              </span>
              <span style={S.tag('#f59e0b')}>
                {group.inProgressCount} active
              </span>
              <span style={S.tag('#6b7280')}>
                {group.todoCount} queued
              </span>
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>
                Objective completion: <strong style={{ color: '#d1d5db' }}>{group.completionPercent}%</strong>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${meterValue}%`, height: '100%', background: progressColor, transition: 'width 0.3s' }} />
              </div>
            </div>
            {group.objectiveTasks.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 11, color: '#9ca3af', lineHeight: 1.5 }}>
                <span style={{ color: '#e5e7eb', fontWeight: 600 }}>Tickets:</span>{' '}
                {group.objectiveTasks.slice(0, 3).map((task) => task.name || 'Unnamed ticket').join(' • ')}
                {group.objectiveTasks.length > 3 ? ` +${group.objectiveTasks.length - 3} more` : ''}
              </div>
            )}
            {group.recentItems.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Recent signals:</div>
                <ul style={{ margin: 0, paddingLeft: 16, display: 'grid', gap: 4, fontSize: 11, color: '#d1d5db' }}>
                  {group.recentItems.slice(0, 4).map((item) => {
                    if (item.type === 'beat') {
                      const entry = item.payload as ProgressTimelineEntry;
                      return (
                        <li key={item.id}>
                          <span style={{ color: '#6b7280' }}>{formatDistanceToNow(entry.createdAt || new Date(), { addSuffix: true })}</span>{' '}
                          <span style={{ color: '#1d9bf0' }}>{entry.agentName || entry.agentId || 'agent'}</span> — {entry.headline}
                        </li>
                      );
                    }
                    const entry = item.payload as NudgeLogEntry;
                    return (
                      <li key={item.id}>
                        <span style={{ color: '#6b7280' }}>{formatDistanceToNow(entry.createdAt || new Date(), { addSuffix: true })}</span>{' '}
                        <span style={{ color: '#a78bfa' }}>{entry.agentName || entry.agentId || 'agent'}</span> — {entry.message}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={S.overlay} onClick={(e) => { e.stopPropagation(); }}>
      <div style={S.panel}>

        {/* ── Header ── */}
        <div style={S.header}>
          <div>
            <h2 style={S.title}>Heartbeat Feed</h2>
            <p style={S.subtitle}>Events, nudges, and team progress — all in one stream</p>
          </div>
          <div style={S.headerActions}>
            <button
              style={S.copyIconBtn(copyState)}
              onClick={() => { void handleCopyTimeline(); }}
              title={
                copyState === 'copied'
                  ? 'Copied'
                  : copyState === 'error'
                    ? 'Copy failed'
                    : activeTab === 'feed'
                      ? 'Copy loaded events'
                      : activeTab === 'snapshots'
                        ? 'Copy health snapshots'
                        : 'Copy objective progress'
              }
              aria-label={
                copyState === 'copied'
                  ? 'Copied'
                  : copyState === 'error'
                    ? 'Copy failed'
                    : activeTab === 'feed'
                      ? 'Copy loaded events'
                      : activeTab === 'snapshots'
                        ? 'Copy health snapshots'
                        : 'Copy objective progress'
              }
            >
              <Copy size={15} />
            </button>
            <button style={S.closeBtn} onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={S.tabs}>
          <button style={S.tab(activeTab === 'feed')} onClick={() => setActiveTab('feed')}>
            <Activity size={14} /> Events (task work + nudges)
            {feedItems.length > 0 && <span style={S.tabCount} title={feedTabCountTitle}>{feedItems.length}</span>}
          </button>
          <button style={S.tab(activeTab === 'snapshots')} onClick={() => setActiveTab('snapshots')}>
            <Clock size={14} /> Health Snapshot
            {filteredSnapshots.length > 0 && <span style={S.tabCount}>{filteredSnapshots.length}</span>}
          </button>
          <button style={S.tab(activeTab === 'objectives')} onClick={() => setActiveTab('objectives')}>
            <Target size={14} /> Objective Progress
            {objectiveProgressGroups.length > 0 && <span style={S.tabCount}>{objectiveProgressGroups.length}</span>}
          </button>
          <button style={S.composeToggle(composerOpen)} onClick={() => setComposerOpen(!composerOpen)}>
            <Send size={14} /> Post Beat
            {composerOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* ── Composer ── */}
        {composerOpen && (
          <div style={S.composer}>
            <form onSubmit={handleSubmit} style={S.composeForm}>
              <div style={S.composeTop}>
                {selectedAgent && (
                  <div style={S.avatar(getAvatarColor(selectedAgent.id), 32)}>
                    {selectedAgent.emoji || selectedAgent.displayName?.charAt(0)?.toUpperCase()}
                  </div>
                )}
                <select style={{ ...S.input(1) } as CSSProperties} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)}
                </select>
                <input style={{ ...S.input(), width: 110, textAlign: 'center', fontWeight: 700, letterSpacing: '0.05em' } as CSSProperties}
                  value={objectiveCode}
                  onChange={(e) => setObjectiveCode(e.target.value.toUpperCase())}
                  placeholder="OBJ-CODE"
                />
              </div>
              <textarea style={S.textarea} value={headline} onChange={(e) => setHeadline(e.target.value)}
                placeholder="What's happening? Describe the beat…" rows={2}
              />
              <div style={S.beatChipGroup}>
                {(Object.keys(beatConfig) as ProgressBeat[]).map((b) => {
                  const c = beatConfig[b];
                  return (
                    <button key={b} type="button" style={S.beatChip(beat === b, c.color, c.bg)} onClick={() => setBeat(b)}>
                      {c.icon} {c.label}
                    </button>
                  );
                })}
              </div>
              <div style={S.optionRow}>
                <select style={S.select} value={confidenceColor} onChange={(e) => setConfidenceColor(e.target.value as ConfidenceColor)}>
                  {(Object.keys(colorConfig) as ConfidenceColor[]).map((c) => <option key={c} value={c}>{colorConfig[c].label}</option>)}
                </select>
                <select style={S.select} value={stateTag} onChange={(e) => setStateTag(e.target.value as TimelineStateTag)}>
                  <option value="signals">Signals</option>
                  <option value="meanings">Meanings</option>
                </select>
                <select style={S.select} value={lensTag} onChange={(e) => setLensTag(e.target.value)}>
                  {lensOptions.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              {error && <p style={S.error}>{error}</p>}
              <button style={S.publishBtn(isSaving)} type="submit" disabled={isSaving}>
                <Send size={14} /> {isSaving ? 'Posting…' : 'Publish'}
              </button>
            </form>
          </div>
        )}

        {/* ── Content ── */}
        <div style={S.content}>
          {activeTab === 'feed' && (
            loading ? (
              <div style={S.empty}><p style={{ margin: 0, fontSize: 14 }}>Loading events…</p></div>
            ) : feedItems.length === 0 ? (
              <div style={S.empty}>
                <Activity size={32} style={{ opacity: 0.3 }} />
                <p style={{ margin: 0, fontSize: 14 }}>No events logged yet.</p>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Post the first one using the button above.</p>
              </div>
            ) : (
              feedItems.map((item) =>
                item.type === 'beat'
                  ? renderBeatCard(item.payload as ProgressTimelineEntry)
                  : renderNudgeCard(item.payload as NudgeLogEntry)
              )
            )
          )}

          {activeTab === 'snapshots' && (
            filteredSnapshots.length === 0 ? (
              <div style={S.empty}>
                <Clock size={32} style={{ opacity: 0.3 }} />
                <p style={{ margin: 0, fontSize: 14 }}>No health snapshots recorded yet.</p>
              </div>
            ) : (
              filteredSnapshots.map(renderSnapshotCard)
            )
          )}

          {activeTab === 'objectives' && (
            objectiveProgressGroups.length === 0 ? (
              <div style={S.empty}>
                <Target size={32} style={{ opacity: 0.3 }} />
                <p style={{ margin: 0, fontSize: 14 }}>No objective progress yet.</p>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                  Start posting beats with objective codes to see progress maps by objective.
                </p>
              </div>
            ) : (
              objectiveProgressGroups.map(renderObjectiveProgressCard)
            )
          )}
        </div>

      </div>
    </div>
  );
};

export default ProgressTimelinePanel;
