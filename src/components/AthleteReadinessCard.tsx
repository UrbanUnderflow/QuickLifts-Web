import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageCircle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Watch,
  Sparkles,
  ShieldAlert,
  Check,
} from 'lucide-react';
import { coachService } from '../api/firebase/coach/service';
import type {
  AthleteReadinessWorkspaceSnapshot,
  DailySentimentRecord,
} from '../api/firebase/coach/service';
import type {
  AthleteDeviceDayDetail,
  AthleteDeviceEvidencePayload,
  AthleteDeviceStatus,
} from '../api/firebase/pulsecheckDeviceMonitor';
import type { PulseCheckScoreComponentDayState } from '../utils/pulsecheckScoringV2';
import { pulseCheckScoreDisplayLabel } from '../utils/pulsecheckScorePresentation';
import {
  derivePulseCheckMoodEvidence,
  type PulseCheckMoodEvidence,
} from '../utils/pulsecheckMoodEvidence';
import CoachAthleteMessagingModal from './CoachAthleteMessagingModal';
import { useUser } from '../hooks/useUser';

// Lean "triage" readiness card: status-led, one-glance trend + why + daily
// check-ins + a clear action. Depth (28-day calendar, raw scores, tooltips)
// lives in View Details.

interface AthleteData {
  id: string;
  displayName: string;
  username?: string;
  email: string;
  profileImageUrl?: string;
  teamName?: string;
  sportOrProgram?: string;
  athleteAge?: number;
  lastActiveDate?: Date;
  lastCheckInDate?: Date;
  totalSessions?: number;
  weeklyGoalProgress?: number;
  sentimentScore?: number;
  conversationCount?: number;
  activeEscalationTier?: number;
  deviceCoveragePct?: number;
  deviceConnected?: boolean;
  deviceDailyPresence?: boolean[];
  deviceStatus?: AthleteDeviceStatus;
  youthTrack?: string;
  sentimentHistory?: DailySentimentRecord[];
}

type CoachScoreResult = {
  score: number | null;
  status: string;
  confidence: string;
  evidenceCoveragePercent: number;
  trendDelta: number | null;
  components?: Array<{
    key: string;
    score?: number | null;
    configuredWeightPercent?: number;
    detail?: string;
    dayStates?: PulseCheckScoreComponentDayState[];
  }>;
};

export type CoachScorecardRead = {
  methodologyVersion: string;
  wellbeing: CoachScoreResult;
  recovery: CoachScoreResult;
  adherence: CoachScoreResult;
  coherence: CoachScoreResult;
};

export type CoachScorecardResponse = {
  scorecard: CoachScorecardRead;
  deviceEvidence?: AthleteDeviceEvidencePayload;
  coachContext?: {
    mixedRecoverySignals: boolean;
    mixedSignalSummary: string | null;
    physicalTrainingBoundary: string;
  };
};

const DEMO_SHOWING_UP_DAYS = Array.from({ length: 14 }, (_, index) => {
  const day = index + 8;
  const state: PulseCheckScoreComponentDayState['state'] = index < 10
    ? 'complete'
    : index < 13 ? 'missed' : 'pending';
  const dateKey = `2026-08-${String(day).padStart(2, '0')}`;
  return {
    dateKey,
    state,
    label: `${dateKey}: Demo scheduled check-in ${state}.`,
    checkInState: state === 'complete'
      ? 'completed' as const
      : state === 'pending' ? 'pending' as const : 'missed' as const,
    checkInLabel: state === 'complete'
      ? 'Completed'
      : state === 'pending' ? 'Pending' : 'Missed',
    reason: state === 'complete'
      ? 'The scheduled check-in was completed.'
      : state === 'pending'
        ? 'This day is still open, so the scheduled check-in is not counted as missed yet.'
        : 'The scheduled check-in was not completed.',
  };
});

const DEMO_SCORECARD_RESPONSE: CoachScorecardResponse = {
  scorecard: {
    methodologyVersion: '2.2.3',
    coherence: {
      score: 76,
      status: 'available',
      confidence: 'moderate',
      evidenceCoveragePercent: 71,
      trendDelta: 3,
      components: [{ key: 'showing_up', dayStates: DEMO_SHOWING_UP_DAYS }],
    },
    wellbeing: { score: 78, status: 'available', confidence: 'moderate', evidenceCoveragePercent: 71, trendDelta: 4 },
    recovery: { score: 72, status: 'available', confidence: 'moderate', evidenceCoveragePercent: 64, trendDelta: -2 },
    adherence: {
      score: 77,
      status: 'available',
      confidence: 'strong',
      evidenceCoveragePercent: 93,
      trendDelta: 6,
      components: [{
        key: 'scheduled_check_ins',
        score: 77,
        configuredWeightPercent: 100,
        detail: '10 of 13 scorable scheduled check-ins completed.',
        dayStates: DEMO_SHOWING_UP_DAYS,
      }],
    },
  },
  coachContext: {
    mixedRecoverySignals: false,
    mixedSignalSummary: null,
    physicalTrainingBoundary: 'PulseCheck reports evidence and uncertainty. Coaches and sports medicine staff make physical training decisions.',
  },
};

const SHOWING_UP_STATE_META: Record<
  PulseCheckScoreComponentDayState['state'],
  { label: string; color: string; background: string; border: string }
> = {
  complete: {
    label: 'Complete',
    color: '#BEF264',
    background: 'rgba(190, 242, 100, 0.82)',
    border: '1px solid rgba(190, 242, 100, 0.3)',
  },
  missed: {
    label: 'Missed',
    color: '#FB7185',
    background: 'rgba(244, 63, 94, 0.56)',
    border: '1px solid rgba(251, 113, 133, 0.42)',
  },
  pending: {
    label: 'Pending',
    color: '#D4D4D8',
    background: 'rgba(255, 255, 255, 0.16)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  },
  excused: {
    label: 'Not scheduled',
    color: '#7DD3FC',
    background: 'rgba(56, 189, 248, 0.34)',
    border: '1px solid rgba(125, 211, 252, 0.34)',
  },
};

const showingUpDayStyle = (state: PulseCheckScoreComponentDayState['state']): React.CSSProperties => {
  const meta = SHOWING_UP_STATE_META[state] || SHOWING_UP_STATE_META.pending;
  return { background: meta.background, border: meta.border };
};

const formatShowingUpDate = (dateKey: string): string => {
  const date = new Date(`${dateKey}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? dateKey
    : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const showingUpStateMeta = (state: string) => {
  if (state in SHOWING_UP_STATE_META) {
    return SHOWING_UP_STATE_META[state as PulseCheckScoreComponentDayState['state']];
  }
  return SHOWING_UP_STATE_META.pending;
};

// Showing Up is the daily view of scheduled check-in completion.
const showingUpBreakdown = (day: PulseCheckScoreComponentDayState) => ({
  checkInLabel: day.checkInLabel || 'Not available',
  reason: day.reason || day.label,
});

// Trend-level theme extraction from a day's check-in messages (no transcripts).
const TOPIC_RULES: { label: string; rx: RegExp }[] = [
  { label: 'Sleep', rx: /\b(sleep|insomnia|tired|exhaust|rest)\b/i },
  { label: 'Stress', rx: /\b(stress|stressed|overwhelm|pressure)\b/i },
  { label: 'Anxiety', rx: /\b(anxious|anxiety|worried|worry|nervous)\b/i },
  { label: 'Mood', rx: /\b(sad|down|depress|low)\b/i },
  { label: 'Fatigue', rx: /\b(fatigue|drained|burnt|burnout)\b/i },
  { label: 'Injury', rx: /\b(injur|hurt|pain|sore)\b/i },
  { label: 'Competition', rx: /\b(game|match|compete|competition|meet)\b/i },
  { label: 'Confidence', rx: /\b(confiden|doubt|believe|nerves)\b/i },
];
const extractTopics = (messages: string[]): string[] => {
  const text = messages.join(' ').toLowerCase();
  const out: string[] = [];
  for (const r of TOPIC_RULES) {
    if (r.rx.test(text)) out.push(r.label);
    if (out.length >= 3) break;
  }
  return out;
};

type StatusKey = 'optimal' | 'flagged' | 'elevated' | 'escalated' | 'pending';

const STATUS: Record<StatusKey, { label: string; dot: string; text: string; line: string }> = {
  optimal: { label: 'Optimal', dot: '#22c55e', text: '#4ade80', line: 'rgba(34,197,94,0.55)' },
  flagged: { label: 'Watch', dot: '#f59e0b', text: '#fbbf24', line: 'rgba(245,158,11,0.55)' },
  elevated: { label: 'Needs attention', dot: '#fb923c', text: '#fb923c', line: 'rgba(251,146,60,0.6)' },
  escalated: { label: 'Escalated', dot: '#ef4444', text: '#f87171', line: 'rgba(239,68,68,0.65)' },
  pending: { label: 'No check-in', dot: '#71717a', text: '#a1a1aa', line: 'rgba(113,113,122,0.4)' },
};

const daysSince = (d?: Date): number | null => {
  if (!d || isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
};

const compactTrackLabel = (track?: string): string => {
  if (!track) return '';
  if (track === 'junior') return 'Junior';
  if (track === 'pro') return 'Pro';
  return track
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const ageGroupLabel = (age?: number, track?: string): string => {
  if (typeof age === 'number' && Number.isFinite(age) && age > 0) {
    if (age <= 12) return `Youth · ${age}`;
    if (age <= 18) return `Teen · ${age}`;
    if (age <= 22) return `College-age · ${age}`;
    return `Adult · ${age}`;
  }
  const trackLabel = compactTrackLabel(track);
  return trackLabel ? `${trackLabel} track` : '';
};

const profileInitial = (name: string) => (name.trim().charAt(0) || 'A').toUpperCase();

const AthleteAvatar: React.FC<{
  src?: string;
  name: string;
  size?: 'sm' | 'lg';
}> = ({ src, name, size = 'sm' }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const sizeClass = size === 'lg' ? 'h-11 w-11 text-sm' : 'h-9 w-9 text-xs';
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className={`${sizeClass} flex-none rounded-full object-cover ring-1 ring-white/10 transition group-hover/athlete-profile:ring-white/30`}
      />
    );
  }
  return (
    <span className={`${sizeClass} flex flex-none items-center justify-center rounded-full bg-zinc-800 font-bold text-zinc-200 ring-1 ring-white/10 transition group-hover/athlete-profile:ring-white/30`}>
      {profileInitial(name)}
    </span>
  );
};

const formatDeviceTime = (seconds?: number | null): string => {
  if (!seconds) return 'No data yet';
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return 'No data yet';
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatDuration = (seconds?: number | null): string => {
  const safeSeconds = Math.max(0, Math.round(seconds || 0));
  if (!safeSeconds) return 'No time recorded';
  const minutes = Math.max(1, Math.round(safeSeconds / 60));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${minutes}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const sentimentLabel = (score: number | null | undefined): string => {
  if (score == null) return 'No chat sentiment';
  if (score >= 0.25) return 'Positive';
  if (score <= -0.25) return 'Low';
  return 'Mixed';
};

const sentimentToneClass = (score: number | null | undefined): string => {
  if (score == null) return 'text-zinc-500';
  if (score >= 0.25) return 'text-emerald-300';
  if (score <= -0.25) return 'text-red-300';
  return 'text-amber-300';
};

const deriveStatus = (a: AthleteData): StatusKey => {
  const stale = daysSince(a.lastActiveDate);
  const lastCheckInDays = daysSince(a.lastCheckInDate);
  const hasCurrentSignal = (a.conversationCount ?? 0) > 0
    || (lastCheckInDays !== null && lastCheckInDays <= 7);
  if (!hasCurrentSignal || stale === null || stale > 7) return 'pending';
  const s = a.sentimentScore ?? 0;
  if (s >= 0.25) return 'optimal';
  if (s >= -0.1) return 'flagged';
  if (s >= -0.4) return 'elevated';
  return 'escalated';
};

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

type DayPoint = { has: boolean; score: number };
type DayDetail = DayPoint & {
  date: Date;
  moodLabel: string;
  moodEvidence: PulseCheckMoodEvidence;
  checkInCompleted: boolean;
  checkInCount: number;
  noraChatCount: number;
  noraMessageCount: number;
  noraSentimentScore: number | null;
  moduleAssignedCount: number;
  moduleCompletedCount: number;
  moduleDurationSeconds: number;
  topics: string[];
};

type ReadinessDeviceSource = {
  key: string;
  label: string;
  connectionStatus: 'synced' | 'stale' | 'not_connected';
  lastObservedAt: number | null;
  lastSyncedAt: number | null;
  wearDaysCovered: number;
  windowDays: number;
  wearCoveragePct: number;
  dailyPresence: boolean[];
  dailyDetails: (AthleteDeviceDayDetail | null)[];
};

const deviceSourceConnectionLabel = (device?: ReadinessDeviceSource): string => {
  if (!device || device.connectionStatus === 'not_connected') return 'Not connected';
  if (device.wearDaysCovered === 0) return 'Connected, waiting for data';
  if (device.connectionStatus === 'stale') return 'Connected, stale';
  return 'Synced';
};

const deviceSourceTone = (device?: ReadinessDeviceSource): string => {
  if (!device || device.connectionStatus === 'not_connected') return 'text-zinc-500';
  if (device.connectionStatus === 'stale') {
    return device.wearCoveragePct > 0 ? 'text-amber-300' : 'text-zinc-400';
  }
  if (device.wearCoveragePct > 0) return 'text-emerald-300';
  return 'text-zinc-300';
};

const deviceBadgeTone = (device: ReadinessDeviceSource): string => {
  if (device.connectionStatus === 'not_connected') {
    return 'border-white/10 bg-white/[0.03] text-zinc-500 hover:border-white/20 hover:text-zinc-300';
  }
  if (device.connectionStatus === 'stale') {
    return 'border-amber-300/25 bg-amber-300/[0.08] text-amber-200 hover:border-amber-300/45';
  }
  return 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-200 hover:border-emerald-300/45';
};

// Escalation tiers (mirrors the escalation system; demo derives them from status).
const TIER: Record<
  number,
  { label: string; pathway: string; color: string; means: string; action: string; indicators: string[] }
> = {
  1: {
    label: 'Tier 1 · Monitor',
    pathway: "You've been notified — check in when you can.",
    color: '#3B82F6',
    means: 'Concerns worth your attention — not an immediate clinical risk.',
    action: "You've been notified. Check in with the athlete when convenient.",
    indicators: ['Performance stress', 'Fatigue', 'Emotional variability'],
  },
  2: {
    label: 'Tier 2 · Elevated risk',
    pathway: 'Support pathway active, with athlete consent.',
    color: '#F97316',
    means: 'Elevated distress that may benefit from professional support.',
    action: 'Support pathway activated with athlete consent — routing in progress.',
    indicators: ['Persistent distress', 'Anxiety', 'Recurring concerns'],
  },
  3: {
    label: 'Tier 3 · Critical',
    pathway: 'Urgent — support pathway activated immediately.',
    color: '#EF4444',
    means: 'Critical safety concern requiring immediate professional intervention.',
    action: 'Support pathway activated immediately — a human professional is engaged.',
    indicators: ['Severe distress', 'Safety risk', 'Crisis indicators'],
  },
};

const deriveTier = (status: StatusKey, sentiment: number, provided?: number): number => {
  if (provided && provided > 0) return provided;
  if (status === 'escalated') return sentiment < -0.55 ? 3 : 2;
  if (status === 'elevated') return 1;
  return 0;
};

// Themes = trend-level signal only (never raw transcripts). Demo synthesizes
// deterministically per athlete; live wires to real topic extraction.
const THEMES_NEG = ['Sleep', 'Stress', 'Fatigue', 'Competition nerves', 'Confidence', 'Workload'];
const THEMES_POS = ['Focus', 'Recovery', 'Momentum'];

const hashStr = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

const deriveThemes = (id: string, status: StatusKey): string[] => {
  const pool = status === 'optimal' ? THEMES_POS : THEMES_NEG;
  const h = hashStr(id);
  const a = pool[h % pool.length];
  const b = pool[(Math.floor(h / 7)) % pool.length];
  return a === b ? [a] : [a, b];
};

// `demo` synthesizes device/modules/themes/tiers + per-day detail for the
// walkthrough. When false (live), the card shows only real signals — mood,
// check-ins, real escalation tier, real device wear — and never fakes the rest.
const AthleteReadinessCard: React.FC<{
  athlete: AthleteData;
  demo?: boolean;
  teamId?: string;
  organizationId?: string;
  readinessSnapshot?: AthleteReadinessWorkspaceSnapshot;
  scorecardResponse?: CoachScorecardResponse | null;
}> = ({ athlete, demo, teamId, organizationId, readinessSnapshot, scorecardResponse }) => {
  const readinessDetails = demo ? [] : readinessSnapshot?.details ?? null;
  const readinessAvailability = demo
    ? { checkIns: 'available', modules: 'available', nora: 'available' } as const
    : readinessSnapshot?.availability ?? null;
  const [messagingOpen, setMessagingOpen] = useState(false);
  const scorecardRead = demo ? DEMO_SCORECARD_RESPONSE : scorecardResponse ?? null;
  const [profileHover, setProfileHover] = useState<{ x: number; y: number; placement: 'above' | 'below' } | null>(null);
  const currentUser = useUser();
  const showingUpDays = useMemo(() => {
    const components = [
      ...(scorecardRead?.scorecard.coherence.components || []),
      ...(scorecardRead?.scorecard.adherence.components || []),
    ];
    const days = components.find((component) => component.dayStates?.length)?.dayStates || [];
    return [...days].sort((left, right) => left.dateKey.localeCompare(right.dateKey)).slice(-14);
  }, [scorecardRead]);
  const showingUpSummary = useMemo(() => {
    const completed = showingUpDays.filter((day) => day.state === 'complete').length;
    const scorable = showingUpDays.filter((day) => day.state === 'complete' || day.state === 'missed').length;
    return {
      completed,
      scorable,
      score: scorecardRead?.scorecard.adherence.score ?? null,
    };
  }, [scorecardRead, showingUpDays]);

  const status = deriveStatus(athlete);
  const meta = STATUS[status];
  const lastCheckInDays = daysSince(demo ? athlete.lastActiveDate : athlete.lastCheckInDate);

  // Build the last 14 days of readiness detail (most recent last). Per-day
  // device/modules/topics are synthesized in the demo; live wires to real data.
  const last14 = useMemo<DayDetail[]>(() => {
    const detailByDate = new Map((readinessDetails ?? []).map((r) => [r.date, r]));
    const historyByDate = new Map(
      (athlete.sentimentHistory ?? []).map((record) => [record.date, record])
    );
    const out: DayDetail[] = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateKey = ymd(d);
      const detail = detailByDate.get(dateKey);
      const h = hashStr(`${athlete.id}:${dateKey}`);
      const demoHas = status !== 'pending' && i < 11 && h % 5 !== 0;
      // Device per-day: real from the device monitor's dailyPresence on live
      // (index aligned oldest→today), synth in demo. Topics stay demo-only synth
      // here; live topics are fetched lazily on hover.
      const checkInCompleted = demo ? demoHas : detail?.checkInCompleted === true;
      const historyRecord = historyByDate.get(dateKey);
      const historySignalAvailable = !demo && (historyRecord?.messageCount ?? 0) > 0;
      const noraChatCount = demo && demoHas ? (h % 3 === 0 ? 2 : 1) : detail?.noraChatCount ?? 0;
      const noraMessageCount = demo && demoHas ? 2 + (h % 5) : detail?.noraMessageCount ?? 0;
      const demoScore = status === 'optimal'
        ? 0.5
        : status === 'flagged'
          ? 0.05
          : status === 'elevated'
            ? -0.3
            : -0.65;
      const noraSentimentScore = demo && demoHas
        ? Math.max(-1, Math.min(1, demoScore + ((h % 3) - 1) * 0.12))
        : detail?.noraSentimentScore ?? null;
      const has = checkInCompleted || noraMessageCount > 0 || historySignalAvailable;
      const selectedSelfReportLevel = detail?.coherenceEveningLevel || detail?.coherenceMorningLevel;
      const moodEvidence = derivePulseCheckMoodEvidence({
        hasEvidence: has,
        selfReportLevel: selectedSelfReportLevel,
        selfReportPeriod: detail?.coherenceEveningLevel
          ? 'Evening'
          : detail?.coherenceMorningLevel
            ? 'Morning'
            : null,
        noraSentimentScore,
        noraMessageCount,
        historySentimentScore: historyRecord?.sentimentScore ?? null,
        historyMessageCount: historyRecord?.messageCount ?? 0,
        historySources: historyRecord?.sources,
        demoSignalScore: demo && demoHas ? noraSentimentScore : null,
      });
      const score = moodEvidence.score;
      const moduleAssignedCount = demo ? (has ? 3 : 0) : detail?.moduleAssignedCount ?? 0;
      const moduleCompletedCount = demo && has
        ? Math.min(3, score < -0.3 ? h % 2 : 1 + (h % 3))
        : detail?.moduleCompletedCount ?? 0;
      const moduleDurationSeconds = demo && moduleCompletedCount > 0
        ? moduleCompletedCount * 180
        : detail?.moduleDurationSeconds ?? 0;
      const moodLabel = !has
        ? !demo && readinessAvailability?.checkIns !== 'available'
          ? 'Unavailable'
          : 'No check-in'
        : score >= 0.3 ? 'Good' : score >= -0.3 ? 'Mixed' : 'Low';
      let topics: string[] = [];
      if (demo && has && score < 0.3) {
        topics = [THEMES_NEG[h % THEMES_NEG.length]];
        if (score < -0.3) topics.push(THEMES_NEG[Math.floor(h / 5) % THEMES_NEG.length]);
        topics = Array.from(new Set(topics));
      }
      out.push({
        has,
        score,
        date: d,
        moodLabel,
        moodEvidence,
        checkInCompleted,
        checkInCount: demo && demoHas ? 1 : detail?.checkInCount ?? Number(checkInCompleted),
        noraChatCount,
        noraMessageCount,
        noraSentimentScore,
        moduleAssignedCount,
        moduleCompletedCount,
        moduleDurationSeconds,
        topics,
      });
    }
    return out;
  }, [readinessAvailability, readinessDetails, athlete.id, athlete.sentimentHistory, demo, status]);

  // Per-day hover tooltip state. On live, the day's themes are fetched lazily
  // from that day's check-in messages (trend-level keywords only).
  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null);
  const [showingUpHover, setShowingUpHover] = useState<{
    day: PulseCheckScoreComponentDayState;
    x: number;
    y: number;
    placement: 'above' | 'below';
  } | null>(null);
  const [deviceHover, setDeviceHover] = useState<{ x: number; y: number; device: ReadinessDeviceSource } | null>(null);
  const [dayTopics, setDayTopics] = useState<Record<string, string[]>>({});
  const fetchedDaysRef = useRef<Set<string>>(new Set());
  const onDayEnter = useCallback(
    (idx: number, e: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>) => {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const half = 160; // ~half the tooltip width; keep it on screen
      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
      const tooltipHeight = 410;
      const x = Math.max(half + 8, Math.min(viewportWidth - half - 8, r.left + r.width / 2));
      const y = Math.max(8, Math.min(r.top - tooltipHeight - 10, viewportHeight - tooltipHeight - 8));
      setHover({ idx, x, y });
      if (demo) return;
      const d = last14[idx];
      if (!d || !d.has) return;
      const key = ymd(d.date);
      if (fetchedDaysRef.current.has(key)) return;
      fetchedDaysRef.current.add(key);
      coachService
        .getMessagesForDate(athlete.id, key)
        .then((msgs) => setDayTopics((prev) => ({ ...prev, [key]: extractTopics(msgs || []) })))
        .catch(() => undefined);
    },
    [demo, last14, athlete.id]
  );
  const onDayLeave = useCallback(() => setHover(null), []);

  const onShowingUpEnter = useCallback((
    day: PulseCheckScoreComponentDayState,
    e: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
  ) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const half = 152;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const placement = rect.top < 260 ? 'below' : 'above';
    const x = Math.max(half + 8, Math.min(viewportWidth - half - 8, rect.left + rect.width / 2));
    setShowingUpHover({
      day,
      x,
      y: placement === 'below' ? rect.bottom : rect.top,
      placement,
    });
  }, []);
  const onShowingUpLeave = useCallback(() => setShowingUpHover(null), []);

  const onDeviceEnter = useCallback((device: ReadinessDeviceSource, e: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const half = 128;
    const x = Math.max(
      half + 8,
      Math.min((typeof window !== 'undefined' ? window.innerWidth : 1280) - half - 8, r.left + r.width / 2)
    );
    setDeviceHover({ x, y: r.top, device });
  }, []);
  const onDeviceLeave = useCallback(() => setDeviceHover(null), []);

  // Escalation banner hover → shows what's being done about it.
  const [escHover, setEscHover] = useState<{ x: number; y: number } | null>(null);
  const onEscEnter = useCallback((e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setEscHover({ x: r.left + r.width / 2, y: r.top });
  }, []);
  const onEscLeave = useCallback(() => setEscHover(null), []);

  const trend = useMemo<'improving' | 'declining' | 'steady'>(() => {
    const withData = last14.filter((d) => d.has);
    if (withData.length < 4) return 'steady';
    const half = Math.floor(withData.length / 2);
    const earlier = avg(withData.slice(0, half).map((d) => d.score));
    const recent = avg(withData.slice(half).map((d) => d.score));
    if (recent > earlier + 0.1) return 'improving';
    if (recent < earlier - 0.1) return 'declining';
    return 'steady';
  }, [last14]);

  const why = useMemo(() => {
    if (status === 'pending') {
      return lastCheckInDays != null
        ? `No check-in in ${lastCheckInDays} day${lastCheckInDays === 1 ? '' : 's'}`
        : 'No recorded check-ins';
    }
    const last7 = last14.slice(-7).filter((d) => d.has);
    const neg = last7.filter((d) => d.score < -0.1).length;
    const pos = last7.filter((d) => d.score >= 0.25).length;
    if (status === 'escalated') return neg ? `${neg} hard day${neg === 1 ? '' : 's'} this week — needs support` : 'Recent distress flagged';
    if (status === 'elevated') return neg ? `${neg} tough day${neg === 1 ? '' : 's'} this week` : 'Mood dipping this week';
    if (status === 'flagged') return 'Mixed week — worth a check-in';
    return pos >= 4 ? 'Consistent and dialed in' : 'Steady this week';
  }, [status, last14, lastCheckInDays]);

  // Risk tier + themes: real on live, synthesized only in the demo.
  const tier = demo ? deriveTier(status, athlete.sentimentScore ?? 0) : athlete.activeEscalationTier ?? 0;
  const themes = useMemo(() => (demo ? deriveThemes(athlete.id, status) : []), [athlete.id, status, demo]);
  const [acked, setAcked] = useState(false);
  const isAttention = status === 'escalated' || status === 'elevated' || status === 'flagged';
  const urgent = status === 'escalated' || status === 'elevated';
  const lastCheckin = useMemo(() => {
    if (!demo && readinessAvailability?.checkIns !== 'available') {
      return readinessAvailability ? 'Check-in data unavailable' : 'Loading check-ins';
    }
    for (let i = last14.length - 1; i >= 0; i--) {
      if (last14[i].checkInCompleted) {
        const ago = last14.length - 1 - i;
        return ago === 0 ? 'Checked in today' : ago === 1 ? 'Checked in yesterday' : `Last check-in ${ago}d ago`;
      }
    }
    if (lastCheckInDays === 0) return 'Checked in today';
    if (lastCheckInDays === 1) return 'Last check-in yesterday';
    return lastCheckInDays != null
      ? `Last check-in ${lastCheckInDays}d ago`
      : 'No recorded check-ins';
  }, [demo, last14, readinessAvailability, lastCheckInDays]);

  // Device: real connection + wear coverage on live, synthesized in demo.
  // Mental modules come from the daily readiness detail feed on live.
  const deviceEvidenceState = demo ? 'available' : athlete.deviceStatus?.evidenceState ?? 'unavailable';
  const deviceDataUnavailable = !demo && deviceEvidenceState === 'unavailable';
  const deviceConnected = demo
    ? (athlete.conversationCount ?? 0) > 0 || (athlete.weeklyGoalProgress ?? 0) > 10
    : athlete.deviceStatus
    ? athlete.deviceStatus.connectionStatus !== 'not_connected'
    : !!athlete.deviceConnected;
  const deviceCoveragePct = demo
    ? (deviceConnected ? 86 : 0)
    : athlete.deviceStatus?.wearCoveragePct ?? athlete.deviceCoveragePct ?? 0;
  const deviceWindowDays = athlete.deviceStatus?.windowDays ?? athlete.deviceDailyPresence?.length ?? 14;
  const deviceDaysCovered = athlete.deviceStatus?.wearDaysCovered
    ?? athlete.deviceDailyPresence?.filter(Boolean).length
    ?? 0;
  const devicePresence = athlete.deviceStatus?.dailyPresence
    || athlete.deviceDailyPresence
    || Array.from({ length: deviceWindowDays }, () => false);
  const deviceLabel = demo ? 'Demo device' : athlete.deviceStatus?.currentDeviceLabel || 'No device';
  const deviceSources = useMemo<ReadinessDeviceSource[]>(() => {
    if (demo) {
      return deviceConnected
        ? [{
            key: 'demo-device',
            label: deviceLabel,
            connectionStatus: 'synced',
            lastObservedAt: null,
            lastSyncedAt: null,
            wearDaysCovered: deviceDaysCovered,
            windowDays: deviceWindowDays,
            wearCoveragePct: deviceCoveragePct,
            dailyPresence: devicePresence,
            dailyDetails: devicePresence.map((present, index) =>
              present
                ? {
                    dayIndex: index,
                    dateLabel: '',
                    observedSeconds: 7 * 60 * 60,
                    recordCount: 1,
                    domains: ['Wearable'],
                    metrics: [],
                    wearNote: null,
                  }
                : null
            ),
          }]
        : [];
    }

    if (deviceDataUnavailable) return [];

    const connectedSources = (athlete.deviceStatus?.devices || [])
      .filter((device) =>
        device.connectionStatus !== 'not_connected'
        && device.wearDaysCovered > 0
      )
      .map((device): ReadinessDeviceSource => ({
        key: device.sourceFamily,
        label: device.label,
        connectionStatus: device.connectionStatus,
        lastObservedAt: device.lastObservedAt,
        lastSyncedAt: device.lastSyncedAt,
        wearDaysCovered: device.wearDaysCovered,
        windowDays: device.windowDays,
        wearCoveragePct: device.wearCoveragePct,
        dailyPresence: device.dailyPresence,
        dailyDetails: device.dailyDetails || device.dailyPresence.map(() => null),
      }));

    const hasUnattributedWearDays = devicePresence.some((present, index) => {
      if (!present) return false;
      return !connectedSources.some((source) => {
        const sourceIndex = source.dailyPresence.length - devicePresence.length + index;
        return sourceIndex >= 0
          && sourceIndex < source.dailyPresence.length
          && source.dailyPresence[sourceIndex];
      });
    });
    if (hasUnattributedWearDays) {
      const wearableSummary: ReadinessDeviceSource = {
        key: 'wearable-summary',
        label: 'Wearable data',
        connectionStatus: athlete.deviceStatus?.connectionStatus ?? 'synced',
        lastObservedAt: athlete.deviceStatus?.lastObservedAt ?? null,
        lastSyncedAt: athlete.deviceStatus?.lastSyncedAt ?? null,
        wearDaysCovered: deviceDaysCovered,
        windowDays: deviceWindowDays,
        wearCoveragePct: deviceCoveragePct,
        dailyPresence: devicePresence,
        dailyDetails: devicePresence.map(() => null),
      };
      return [wearableSummary, ...connectedSources.filter((source) => source.wearDaysCovered > 0)];
    }

    return connectedSources;
  }, [
    athlete.deviceStatus,
    demo,
    deviceDataUnavailable,
    deviceConnected,
    deviceCoveragePct,
    deviceDaysCovered,
    deviceLabel,
    devicePresence,
    deviceWindowDays,
  ]);
  const modulesDone: number | null = demo
    ? Math.max(0, Math.min(3, Math.round(((athlete.weeklyGoalProgress ?? 0) / 100) * 3)))
    : null;

  const deviceSummaryForDay = useCallback(
    (dayIndex: number) => {
      const offsetFor = (source: ReadinessDeviceSource) => source.dailyPresence.length - last14.length + dayIndex;
      const wornSources = deviceSources
        .map((source) => {
          const sourceIndex = offsetFor(source);
          if (sourceIndex < 0 || sourceIndex >= source.dailyPresence.length || !source.dailyPresence[sourceIndex]) return null;
          return {
            source,
            detail: source.dailyDetails[sourceIndex] ?? null,
          };
        })
        .filter((entry): entry is { source: ReadinessDeviceSource; detail: AthleteDeviceDayDetail | null } => !!entry);
      const observedSeconds = wornSources.reduce(
        (max, entry) => Math.max(max, entry.detail?.observedSeconds || 0),
        0
      );
      const wearNotes = Array.from(
        new Set(wornSources.map((entry) => entry.detail?.wearNote).filter((note): note is string => Boolean(note)))
      );

      return {
        worn: wornSources.length > 0,
        sourceNames: wornSources.map((entry) => entry.source.label),
        observedSeconds,
        wearNotes,
        evidenceState: deviceEvidenceState,
      };
    },
    [deviceEvidenceState, deviceSources, last14.length]
  );

  const adherenceStats = useMemo(() => {
    const moduleAssignedCount = last14.reduce((sum, day) => sum + day.moduleAssignedCount, 0);
    const moduleCompletedCount = last14.reduce((sum, day) => sum + day.moduleCompletedCount, 0);

    return {
      moduleAssignedCount,
      moduleCompletedCount,
    };
  }, [last14]);

  const TrendIcon = trend === 'improving' ? ArrowUpRight : trend === 'declining' ? ArrowDownRight : Minus;
  const trendColor = trend === 'improving' ? '#4ade80' : trend === 'declining' ? '#f87171' : '#a1a1aa';
  const profileRows = useMemo(
    () =>
      [
        { label: 'Username', value: athlete.username ? `@${athlete.username.replace(/^@/, '')}` : '' },
        { label: 'Email', value: athlete.email },
        { label: 'Sport', value: athlete.sportOrProgram },
        { label: 'Team', value: athlete.teamName },
        { label: 'Age group', value: ageGroupLabel(athlete.athleteAge, athlete.youthTrack) },
      ].filter((row) => row.value && row.value.trim().length > 0),
    [
      athlete.athleteAge,
      athlete.email,
      athlete.sportOrProgram,
      athlete.teamName,
      athlete.username,
      athlete.youthTrack,
    ]
  );
  const onProfileEnter = useCallback((e: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const half = 144;
    const placement = r.top < 220 ? 'below' : 'above';
    const x = Math.max(
      half + 8,
      Math.min((typeof window !== 'undefined' ? window.innerWidth : 1280) - half - 8, r.left + r.width / 2)
    );
    setProfileHover({ x, y: placement === 'below' ? r.bottom : r.top, placement });
  }, []);
  const onProfileLeave = useCallback(() => setProfileHover(null), []);

  return (
    <>
      <div
        data-athlete-card
        className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60 p-4 transition-all hover:border-white/20"
        style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04)` }}
      >
        {/* Status accent line — stays lit even when acknowledged (monitor view) */}
        <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: meta.line }} />

        {/* Header: identity + status chip */}
        <div className="flex items-start justify-between gap-3">
          <div
            tabIndex={0}
            onMouseEnter={onProfileEnter}
            onMouseLeave={onProfileLeave}
            onFocus={onProfileEnter}
            onBlur={onProfileLeave}
            className="group/athlete-profile flex min-w-0 cursor-help items-center gap-2.5 rounded-xl outline-none focus-visible:ring-1 focus-visible:ring-[#E0FE10]/50"
            aria-label={`Preview ${athlete.displayName}'s profile`}
          >
            <AthleteAvatar src={athlete.profileImageUrl} name={athlete.displayName} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white transition group-hover/athlete-profile:text-[#E0FE10]">{athlete.displayName}</p>
              <p className="truncate text-[11px] text-zinc-500">{lastCheckin}</p>
            </div>
          </div>
          <span
            className="inline-flex flex-none items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: `${meta.dot}1f`, color: meta.text }}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${status === 'escalated' ? 'animate-pulse' : ''}`} style={{ background: meta.dot }} />
            {meta.label}
          </span>
        </div>

        {/* Escalation banner — only for Tier 2/3. Tier 1 (Monitor) is conveyed
            by the status chip alone; no explicit label needed. */}
        {tier >= 2 && (
          <div
            data-escalation
            onMouseEnter={onEscEnter}
            onMouseLeave={onEscLeave}
            className="mt-3 flex cursor-help items-start gap-2 rounded-lg border px-2.5 py-2"
            style={{ borderColor: `${TIER[tier].color}55`, background: `${TIER[tier].color}14` }}
          >
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 flex-none" style={{ color: TIER[tier].color }} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold" style={{ color: TIER[tier].color }}>{TIER[tier].label}</p>
              <p className="text-[11px] leading-4 text-zinc-400">{TIER[tier].pathway}</p>
            </div>
          </div>
        )}

        {/* Mood — 14 days, one square per day, colored by sentiment */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Mood · last 14 days</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: trendColor }}>
              <TrendIcon className="h-3.5 w-3.5" />
              {trend}
            </span>
          </div>
          <MoodStrip
            days={last14}
            loading={readinessDetails === null}
            onEnter={onDayEnter}
            onLeave={onDayLeave}
            hoveredIdx={hover?.idx ?? null}
          />
          <div className="mt-1 flex items-center justify-between text-[9px] font-medium uppercase tracking-wide text-zinc-600">
            <span>14 days ago</span>
            <span className="text-zinc-300">Today ▸</span>
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-[10px] text-zinc-500">
            <Legend color="#10B981" label="Good" />
            <Legend color="#F59E0B" label="Mixed" />
            <Legend color="#EF4444" label="Low" />
            <span className="ml-auto text-zinc-600">▢ no check-in</span>
          </div>
        </div>

        {/* Why + driving themes */}
        <p className="mt-3 text-[13px] leading-5 text-zinc-300">{why}</p>
        {themes.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {themes.map((t) => (
              <span key={t} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-zinc-400">
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.025] p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Four-score read · 14 days</span>
            <span className="text-[9px] font-semibold text-zinc-600">v{scorecardRead?.scorecard.methodologyVersion || '2.0'}</span>
          </div>
          {scorecardRead ? (
            <>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {([
                  ['Coherence', scorecardRead.scorecard.coherence],
                  ['Wellbeing', scorecardRead.scorecard.wellbeing],
                  ['Recovery', scorecardRead.scorecard.recovery],
                  ['Showing Up', scorecardRead.scorecard.adherence],
                ] as const).map(([label, score]) => (
                  <div key={label} className="rounded-md border border-white/[0.07] bg-black/15 px-2 py-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] font-semibold text-zinc-300">{label}</span>
                      <span className="text-sm font-bold text-white">{pulseCheckScoreDisplayLabel(score)}</span>
                    </div>
                    <p className="mt-0.5 text-[9px] text-zinc-600">
                      Calculation coverage {score.evidenceCoveragePercent}% · {score.confidence}
                    </p>
                  </div>
                ))}
              </div>
              {showingUpDays.length > 0 && (
                <div className="mt-2.5 rounded-md border border-white/[0.07] bg-black/15 px-2 py-2">
                  <div className="mb-1.5 flex items-center justify-between text-[9px] font-semibold uppercase tracking-wide text-zinc-500">
                    <span>Showing up</span>
                    <span>Last 14 days</span>
                  </div>
                  <p className="mb-2 text-[9px] leading-4 text-zinc-500">
                    {showingUpSummary.scorable > 0
                      ? `${showingUpSummary.completed} of ${showingUpSummary.scorable} completed = ${showingUpSummary.score}/100`
                      : 'No scorable scheduled check-ins yet'}
                  </p>
                  <div className="flex gap-1">
                    {showingUpDays.map((day) => {
                      const stateMeta = showingUpStateMeta(day.state);
                      const breakdown = showingUpBreakdown(day);
                      return (
                      <span
                        key={day.dateKey}
                        tabIndex={0}
                        role="img"
                        onMouseEnter={(event) => onShowingUpEnter(day, event)}
                        onMouseLeave={onShowingUpLeave}
                        onFocus={(event) => onShowingUpEnter(day, event)}
                        onBlur={onShowingUpLeave}
                        aria-label={`${formatShowingUpDate(day.dateKey)}. ${stateMeta.label}. Scheduled check-in: ${breakdown.checkInLabel}. ${breakdown.reason}`}
                        className="h-3 min-w-0 flex-1 cursor-help rounded-[2px] outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-900"
                        style={showingUpDayStyle(day.state)}
                      />
                      );
                    })}
                  </div>
                  <div className="mt-1 flex justify-between text-[9px] font-semibold text-zinc-600">
                    <span>{showingUpDays[0]?.dateKey.slice(5).replace('-', '/')}</span>
                    <span>{showingUpDays.at(-1)?.dateKey.slice(5).replace('-', '/')}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[8px] text-zinc-500">
                    {(['complete', 'missed', 'pending', 'excused'] as const).map((state) => (
                      <span key={state} className="inline-flex items-center gap-1">
                        <span
                          className="h-1.5 w-1.5 rounded-[1px]"
                          style={{ background: SHOWING_UP_STATE_META[state].background }}
                        />
                        {SHOWING_UP_STATE_META[state].label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="mt-2 text-[10px] leading-4 text-zinc-600">Scorecard evidence is not available yet.</p>
          )}
          {scorecardRead?.coachContext?.mixedSignalSummary && (
            <p className="mt-2 rounded-md border border-amber-300/20 bg-amber-300/[0.06] px-2 py-1.5 text-[10px] leading-4 text-amber-100">
              {scorecardRead.coachContext.mixedSignalSummary}
            </p>
          )}
        </div>

        {/* Device coverage and module activity stay separate from Showing Up. */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-zinc-500">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span className="inline-flex flex-none items-center gap-1">
              <Watch className="h-3.5 w-3.5 flex-none" />
              <span>{deviceSources.length > 1 ? 'Devices' : 'Device'}</span>
            </span>
            {deviceSources.length > 0 ? (
              <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                {deviceSources.map((source) => (
                  <span
                    key={source.key}
                    role="button"
                    tabIndex={0}
                    aria-label={`View ${source.label} device details`}
                    onMouseEnter={(e) => onDeviceEnter(source, e)}
                    onMouseLeave={onDeviceLeave}
                    onFocus={(e) => onDeviceEnter(source, e)}
                    onBlur={onDeviceLeave}
                    className={`inline-flex max-w-[124px] cursor-help items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-4 transition ${deviceBadgeTone(source)}`}
                  >
                    <span className="min-w-0 truncate">{source.label}</span>
                    <span className="opacity-60">·</span>
                    <span className="flex-none">{source.wearCoveragePct}%</span>
                  </span>
                ))}
              </span>
            ) : (
              <span className="text-zinc-500">
                {deviceDataUnavailable
                  ? 'Device data unavailable'
                  : deviceEvidenceState === 'partial'
                    ? 'Device data incomplete'
                    : deviceConnected
                      ? 'Connected integrations · no measured data'
                    : 'No device connected'}
              </span>
            )}
          </span>
          {(modulesDone !== null
            || adherenceStats.moduleAssignedCount > 0
            || adherenceStats.moduleCompletedCount > 0
            || (!demo && readinessAvailability && readinessAvailability.modules !== 'available')) && (
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Mental modules{' '}
              <span className="text-zinc-300">
                {demo
                  ? `${modulesDone ?? 0}/3`
                  : readinessAvailability?.modules === 'unavailable'
                    ? 'Data unavailable'
                    : readinessAvailability?.modules === 'partial'
                      ? adherenceStats.moduleCompletedCount > 0
                        ? `${adherenceStats.moduleCompletedCount} practices completed · partial data`
                        : 'Partial data'
                  : adherenceStats.moduleAssignedCount > 0
                    ? `${adherenceStats.moduleCompletedCount} practices completed`
                    : `${adherenceStats.moduleCompletedCount} practices completed`}
              </span>
              {!demo && adherenceStats.moduleAssignedCount > 0 && (
                <span className="text-zinc-600">· {adherenceStats.moduleAssignedCount} assigned · last 14 days</span>
              )}
            </span>
          )}
        </div>

        {/* Actions — pinned to the bottom so they align across cards of differing height */}
        <div className="mt-auto space-y-2 pt-4">
          {isAttention &&
            (acked ? (
              <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[12px] text-emerald-300">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" /> Acknowledged
                </span>
                <button type="button" onClick={() => setAcked(false)} className="text-emerald-300/70 transition hover:text-emerald-200">
                  Undo
                </button>
              </div>
            ) : (
              <button
                type="button"
                data-acknowledge
                onClick={() => setAcked(true)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-zinc-400 transition hover:bg-white/[0.07] hover:text-zinc-200"
              >
                <Check className="h-3.5 w-3.5" /> I&apos;ve got this — acknowledge
              </button>
            ))}
          <button
            type="button"
            onClick={() => setMessagingOpen(true)}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#E0FE10] px-3 py-2 text-[13px] font-semibold text-black transition hover:brightness-105"
          >
            <MessageCircle className="h-4 w-4" /> {urgent ? 'Check in now' : 'Message'}
          </button>
        </div>
      </div>

      {/* Athlete profile preview */}
      {profileHover && (
        <div
          className="pointer-events-none fixed z-[80]"
          style={{
            left: profileHover.x,
            top: profileHover.y,
            transform:
              profileHover.placement === 'below'
                ? 'translate(-50%, 10px)'
                : 'translate(-50%, calc(-100% - 10px))',
          }}
        >
          <div className="w-72 rounded-xl border border-white/10 bg-zinc-900/[0.98] p-3 shadow-2xl backdrop-blur">
            <div className="flex items-center gap-3 border-b border-white/10 pb-3">
              <AthleteAvatar src={athlete.profileImageUrl} name={athlete.displayName} size="lg" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">{athlete.displayName}</div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} />
                  <span className="truncate text-[11px] font-medium" style={{ color: meta.text }}>
                    {meta.label}
                  </span>
                </div>
              </div>
            </div>
            {profileRows.length > 0 ? (
              <div className="mt-2 space-y-1.5 text-[11px]">
                {profileRows.map((row) => (
                  <div key={row.label} className="flex justify-between gap-3">
                    <span className="flex-none text-zinc-500">{row.label}</span>
                    <span className="min-w-0 truncate text-right text-zinc-200">{row.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[11px] leading-4 text-zinc-500">
                No additional profile details have been added yet.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Device hover detail */}
      {deviceHover && (
        <div
          className="pointer-events-none fixed z-[70]"
          style={{ left: deviceHover.x, top: deviceHover.y, transform: 'translate(-50%, calc(-100% - 10px))' }}
        >
          <div className="w-64 rounded-xl border border-white/10 bg-zinc-900/[0.98] p-3 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
              <span className="min-w-0 truncate text-xs font-semibold text-white">{deviceHover.device.label}</span>
              <span className={`rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold ${deviceSourceTone(deviceHover.device)}`}>
                {deviceHover.device.wearCoveragePct}%
              </span>
            </div>
            <div className="mt-2 space-y-1.5 text-[11px]">
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">Connection</span>
                <span className="text-right text-zinc-200">{demo ? 'Demo signal' : deviceSourceConnectionLabel(deviceHover.device)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">Days with data</span>
                <span className="text-zinc-200">{deviceHover.device.wearDaysCovered}/{deviceHover.device.windowDays}</span>
              </div>
              {!demo && (
                <>
                  <div className="flex justify-between gap-3">
                    <span className="text-zinc-500">Last data</span>
                    <span className="text-right text-zinc-200">{formatDeviceTime(deviceHover.device.lastObservedAt)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-zinc-500">Last sync</span>
                    <span className="text-right text-zinc-200">{formatDeviceTime(deviceHover.device.lastSyncedAt)}</span>
                  </div>
                </>
              )}
              <div className="pt-1">
                <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-600">
                  <span>{deviceHover.device.windowDays} days ago</span>
                  <span>Today</span>
                </div>
                <div className="flex items-center gap-1">
                  {deviceHover.device.dailyPresence.map((present, idx) => (
                    <span
                      key={idx}
                      className="h-2.5 flex-1 rounded-[2px]"
                      style={{
                        background: present ? 'rgba(16,185,129,0.9)' : 'rgba(63,63,70,0.8)',
                      }}
                    />
                  ))}
                </div>
              </div>
              {deviceHover.device.connectionStatus === 'not_connected' && (
                <p className="pt-1 text-[10px] leading-4 text-zinc-500">
                  No connected wearable or health source was found for this athlete.
                </p>
              )}
              {deviceHover.device.connectionStatus !== 'not_connected' && deviceHover.device.wearDaysCovered === 0 && (
                <p className="pt-1 text-[10px] leading-4 text-zinc-500">
                  The source is connected, but no wearable data arrived in this window.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Daily Showing up evidence */}
      {showingUpHover && (() => {
        const stateMeta = showingUpStateMeta(showingUpHover.day.state);
        const breakdown = showingUpBreakdown(showingUpHover.day);
        return (
          <div
            className="pointer-events-none fixed z-[80]"
            style={{
              left: showingUpHover.x,
              top: showingUpHover.y,
              transform: showingUpHover.placement === 'below'
                ? 'translate(-50%, 10px)'
                : 'translate(-50%, calc(-100% - 10px))',
            }}
          >
            <div className="w-[19rem] rounded-lg border border-white/10 bg-zinc-900/[0.98] p-3 shadow-2xl backdrop-blur">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
                <span className="text-xs font-semibold text-white">
                  {formatShowingUpDate(showingUpHover.day.dateKey)}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ color: stateMeta.color, background: stateMeta.background }}
                >
                  {stateMeta.label}
                </span>
              </div>
              <div className="mt-2 space-y-1.5 text-[11px]">
                <div className="flex justify-between gap-4">
                  <span className="text-zinc-500">Scheduled check-in</span>
                  <span className="max-w-[150px] text-right text-zinc-200">{breakdown.checkInLabel}</span>
                </div>
                <div className="border-t border-white/10 pt-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Why this square</div>
                  <p className="mt-1 text-[11px] leading-4 text-zinc-300">{breakdown.reason}</p>
                </div>
                <p className="border-t border-white/10 pt-2 text-[10px] leading-4 text-zinc-500">
                  Showing Up is completed scheduled check-ins divided by scorable scheduled check-ins. Device coverage and module activity are reported separately.
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Per-day hover detail (mood squares + check-in dots share this) */}
      {hover &&
        last14[hover.idx] &&
        (() => {
          const d = last14[hover.idx];
          const c = d.has ? moodColor(d.score) : '#71717a';
          const deviceDay = deviceSummaryForDay(hover.idx);
          const deviceLabelForDay = deviceDay.worn
            ? deviceDay.sourceNames.join(', ')
            : deviceDay.evidenceState === 'unavailable'
              ? 'Unavailable'
              : deviceDay.evidenceState === 'partial'
                ? 'Data incomplete'
                : 'Not worn';
          const deviceTimeLabel = deviceDay.worn
            ? deviceDay.observedSeconds > 0
              ? formatDuration(deviceDay.observedSeconds)
              : 'Recorded'
            : deviceDay.evidenceState === 'available' ? 'Not worn' : deviceLabelForDay;
          const moduleLabel = readinessAvailability?.modules === 'unavailable'
            ? 'Unavailable'
            : readinessAvailability?.modules === 'partial'
              ? d.moduleCompletedCount > 0
                ? `${d.moduleCompletedCount} completed · partial data`
                : 'Data incomplete'
              : d.moduleAssignedCount > 0
                ? `${d.moduleCompletedCount} of ${d.moduleAssignedCount}`
                : d.moduleCompletedCount > 0
                  ? `${d.moduleCompletedCount} completed`
                  : '0 completed';
          const checkInLabel = readinessAvailability?.checkIns === 'unavailable'
            ? 'Unavailable'
            : readinessAvailability?.checkIns === 'partial'
              ? d.checkInCompleted
                ? `${d.checkInCount > 1 ? `Completed (${d.checkInCount})` : 'Completed'} · partial data`
                : 'Data incomplete'
              : d.checkInCompleted
                ? d.checkInCount > 1 ? `Completed (${d.checkInCount})` : 'Completed'
                : 'No check-in';
          const noraChatLabel = readinessAvailability?.nora === 'unavailable'
            ? 'Unavailable'
            : readinessAvailability?.nora === 'partial' && d.noraChatCount === 0
              ? 'Data incomplete'
              : d.noraChatCount > 0
            ? `${d.noraChatCount} chat${d.noraChatCount === 1 ? '' : 's'}`
            : 'No chat';
          const topics = demo ? d.topics : dayTopics[ymd(d.date)] || [];
          return (
            <div
              className="pointer-events-none fixed z-[70]"
              style={{ left: hover.x, top: hover.y, transform: 'translateX(-50%)' }}
            >
              <div className="w-80 rounded-xl border border-white/10 bg-zinc-900/[0.98] p-3 shadow-2xl backdrop-blur">
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                  <span className="text-xs font-semibold text-white">
                    {d.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${c}22`, color: c }}>
                    {d.moodLabel}
                  </span>
                </div>
                <div className="mt-2 space-y-1.5 text-[11px]">
                  {d.has && (
                    <>
                      <div className="flex justify-between gap-3" data-mood-source>
                        <span className="text-zinc-500">Mood source</span>
                        <span className="max-w-[190px] text-right text-zinc-200">
                          {d.moodEvidence.sourceLabel}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-zinc-500">Source reading</span>
                        <span className="max-w-[190px] text-right text-zinc-200">
                          {d.moodEvidence.sourceReadingLabel}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between gap-3">
                    <span className="text-zinc-500">Team check-in</span>
                    <span className={d.checkInCompleted ? 'text-zinc-200' : 'text-zinc-500'}>
                      {checkInLabel}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-zinc-500">Mental modules</span>
                    <span className="text-zinc-200">{moduleLabel}</span>
                  </div>
                  {d.moduleDurationSeconds > 0 && (
                    <div className="flex justify-between gap-3">
                      <span className="text-zinc-500">Mental module time</span>
                      <span className="text-zinc-200">{formatDuration(d.moduleDurationSeconds)}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <span className="text-zinc-500">Device</span>
                    <span className={`max-w-[190px] truncate text-right ${deviceDay.worn ? 'text-emerald-300' : 'text-zinc-400'}`}>
                      {deviceLabelForDay}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-zinc-500">Device time</span>
                    <span className={deviceDay.worn ? 'text-zinc-200' : 'text-zinc-500'}>{deviceTimeLabel}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-zinc-500">Chat with Nora</span>
                    <span className={d.noraChatCount > 0 ? 'text-zinc-200' : 'text-zinc-500'}>{noraChatLabel}</span>
                  </div>
                  {d.noraChatCount > 0 && (
                    <div className="flex justify-between gap-3">
                      <span className="text-zinc-500">Nora messages</span>
                      <span className="text-zinc-200">{d.noraMessageCount}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <span className="text-zinc-500">Chat sentiment</span>
                    <span className={sentimentToneClass(d.noraSentimentScore)}>
                      {readinessAvailability?.nora === 'available'
                        ? sentimentLabel(d.noraSentimentScore)
                        : readinessAvailability?.nora === 'partial' && d.noraSentimentScore !== null
                          ? `${sentimentLabel(d.noraSentimentScore)} · partial data`
                          : readinessAvailability ? 'Unavailable' : 'Loading'}
                    </span>
                  </div>
                  {d.has && (
                    <div className="border-t border-white/10 pt-2" data-mood-explanation>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        Why {d.moodLabel}
                      </div>
                      <p className="mt-1 text-[11px] leading-4 text-zinc-300">
                        {d.moodEvidence.explanation}
                      </p>
                      <p className="mt-1 text-[10px] leading-4 text-emerald-300">
                        {d.moodEvidence.wearableRole}
                      </p>
                    </div>
                  )}
                  {deviceDay.wearNotes.length > 0 && (
                    <p className="pt-1 text-[10px] leading-4 text-zinc-500">
                      {deviceDay.wearNotes.join(' · ')}
                    </p>
                  )}
                  {topics.length > 0 && (
                    <div className="pt-1">
                      <span className="text-zinc-500">Needed support with</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {topics.map((t) => (
                          <span key={t} className="rounded-full border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-zinc-300">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      {/* Escalation hover — what's being done about it */}
      {escHover && tier >= 2 && (
        <div
          className="pointer-events-none fixed z-[70]"
          style={{ left: escHover.x, top: escHover.y, transform: 'translate(-50%, calc(-100% - 10px))' }}
        >
          <div className="w-64 rounded-xl border border-white/10 bg-zinc-900/[0.98] p-3 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
              <span className="text-xs font-semibold" style={{ color: TIER[tier].color }}>{TIER[tier].label}</span>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${TIER[tier].color}22`, color: TIER[tier].color }}>
                Active
              </span>
            </div>
            <div className="mt-2 space-y-2 text-[11px] leading-4">
              <div>
                <span className="text-zinc-500">What this means</span>
                <p className="mt-0.5 text-zinc-300">{TIER[tier].means}</p>
              </div>
              <div>
                <span className="text-zinc-500">Action taken</span>
                <p className="mt-0.5 text-zinc-300">{TIER[tier].action}</p>
              </div>
              <div>
                <span className="text-zinc-500">Common indicators</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {TIER[tier].indicators.map((ind) => (
                    <span key={ind} className="rounded-full border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-zinc-300">
                      {ind}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentUser && (
        <CoachAthleteMessagingModal
          isOpen={messagingOpen}
          onClose={() => setMessagingOpen(false)}
          athleteId={athlete.id}
          athleteName={athlete.displayName}
          coachId={currentUser.id}
          coachName={currentUser.displayName || currentUser.username || 'Coach'}
          teamId={teamId}
          organizationId={organizationId}
        />
      )}
    </>
  );
};

const moodColor = (score: number) => (score >= 0.3 ? '#10B981' : score >= -0.3 ? '#F59E0B' : '#EF4444');

// 14-day mood heatmap: one square per day, colored by sentiment, hollow when
// there was no check-in. Hover any square for that day's detail.
const MoodStrip: React.FC<{
  days: DayDetail[];
  loading?: boolean;
  onEnter: (idx: number, e: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>) => void;
  onLeave: () => void;
  hoveredIdx: number | null;
}> = ({ days, loading, onEnter, onLeave, hoveredIdx }) => {
  if (loading) {
    return <div className="h-5 w-full animate-pulse rounded-md bg-white/5" />;
  }
  const n = days.length;
  return (
    <div className="flex items-center gap-1">
      {days.map((p, i) => {
        const isToday = i === n - 1;
        const hovered = hoveredIdx === i;
        return (
          <span
            key={i}
            data-mood-square
            role="img"
            tabIndex={0}
            aria-label={`${p.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}. ${p.moodLabel}. Mood source: ${p.moodEvidence.sourceLabel}. ${p.moodEvidence.explanation} ${p.moodEvidence.wearableRole}`}
            onMouseEnter={(e) => onEnter(i, e)}
            onMouseLeave={(e) => {
              if (typeof document === 'undefined' || document.activeElement !== e.currentTarget) {
                onLeave();
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              onEnter(i, e);
            }}
            onFocus={(e) => onEnter(i, e)}
            onBlur={onLeave}
            className="h-5 flex-1 cursor-pointer rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            style={{
              background: p.has ? moodColor(p.score) : 'transparent',
              border: p.has ? 'none' : '1px solid rgba(255,255,255,0.12)',
              outline: hovered ? '2px solid rgba(255,255,255,0.9)' : isToday ? '2px solid rgba(255,255,255,0.7)' : 'none',
              outlineOffset: 1.5,
            }}
          />
        );
      })}
    </div>
  );
};

const Legend: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <span className="inline-flex items-center gap-1">
    <span className="h-2 w-2 rounded-[2px]" style={{ background: color }} />
    {label}
  </span>
);

export default AthleteReadinessCard;
