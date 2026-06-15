import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  User,
  MessageCircle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Watch,
  Sparkles,
  ShieldAlert,
  Check,
} from 'lucide-react';
import { coachService, DailySentimentRecord } from '../api/firebase/coach/service';
import type { AthleteDeviceStatus } from '../api/firebase/pulsecheckDeviceMonitor';
import CoachAthleteMessagingModal from './CoachAthleteMessagingModal';
import { useUser } from '../hooks/useUser';

// Lean "triage" readiness card: status-led, one-glance trend + why + daily
// check-ins + a clear action. Depth (28-day calendar, raw scores, tooltips)
// lives in View Details.

interface AthleteData {
  id: string;
  displayName: string;
  email: string;
  profileImageUrl?: string;
  lastActiveDate?: Date;
  totalSessions?: number;
  weeklyGoalProgress?: number;
  sentimentScore?: number;
  conversationCount?: number;
  activeEscalationTier?: number;
  deviceCoveragePct?: number;
  deviceConnected?: boolean;
  deviceDailyPresence?: boolean[];
  deviceStatus?: AthleteDeviceStatus;
}

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

const deviceConnectionLabel = (status?: AthleteDeviceStatus): string => {
  if (!status || status.connectionStatus === 'not_connected') return 'Not connected';
  if (status.wearDaysCovered === 0) return 'Connected, waiting for data';
  if (status.connectionStatus === 'stale') return 'Connected, stale';
  return 'Synced';
};

const deriveStatus = (a: AthleteData): StatusKey => {
  const stale = daysSince(a.lastActiveDate);
  if ((a.conversationCount ?? 0) === 0 || stale === null || stale > 7) return 'pending';
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
  device: boolean;
  modules: number;
  topics: string[];
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
const AthleteReadinessCard: React.FC<{ athlete: AthleteData; demo?: boolean }> = ({ athlete, demo }) => {
  const [history, setHistory] = useState<DailySentimentRecord[] | null>(null);
  const [messagingOpen, setMessagingOpen] = useState(false);
  const currentUser = useUser();

  useEffect(() => {
    let cancelled = false;
    coachService
      .getDailySentimentHistory(athlete.id, 28)
      .then((h) => !cancelled && setHistory(h))
      .catch(() => !cancelled && setHistory([]));
    return () => {
      cancelled = true;
    };
  }, [athlete.id]);

  const status = deriveStatus(athlete);
  const meta = STATUS[status];
  const stale = daysSince(athlete.lastActiveDate);

  // Build the last 14 days of readiness detail (most recent last). Per-day
  // device/modules/topics are synthesized in the demo; live wires to real data.
  const last14 = useMemo<DayDetail[]>(() => {
    const byDate = new Map((history ?? []).map((r) => [r.date, r]));
    const out: DayDetail[] = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const rec = byDate.get(ymd(d));
      const has = !!rec && rec.messageCount > 0;
      const score = has ? rec!.sentimentScore : 0;
      const h = hashStr(`${athlete.id}:${ymd(d)}`);
      // Device per-day: real from the device monitor's dailyPresence on live
      // (index aligned oldest→today), synth in demo. Modules/topics stay demo-only
      // synth here; live topics are fetched lazily on hover.
      const di = out.length; // 0 = oldest … 13 = today
      const device = demo ? (has ? h % 5 !== 0 : false) : (athlete.deviceDailyPresence?.[di] ?? false);
      const modules = demo && has ? Math.min(3, score < -0.3 ? h % 2 : 1 + (h % 3)) : 0;
      const moodLabel = !has ? 'No check-in' : score >= 0.3 ? 'Good' : score >= -0.3 ? 'Mixed' : 'Low';
      let topics: string[] = [];
      if (demo && has && score < 0.3) {
        topics = [THEMES_NEG[h % THEMES_NEG.length]];
        if (score < -0.3) topics.push(THEMES_NEG[Math.floor(h / 5) % THEMES_NEG.length]);
        topics = Array.from(new Set(topics));
      }
      out.push({ has, score, date: d, moodLabel, device, modules, topics });
    }
    return out;
  }, [history, athlete.id, demo, athlete.deviceDailyPresence]);

  // Per-day hover tooltip state. On live, the day's themes are fetched lazily
  // from that day's check-in messages (trend-level keywords only).
  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null);
  const [deviceHover, setDeviceHover] = useState<{ x: number; y: number } | null>(null);
  const [dayTopics, setDayTopics] = useState<Record<string, string[]>>({});
  const fetchedDaysRef = useRef<Set<string>>(new Set());
  const onDayEnter = useCallback(
    (idx: number, e: React.MouseEvent) => {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const half = 116; // ~half the tooltip width; keep it on screen
      const x = Math.max(half + 8, Math.min((typeof window !== 'undefined' ? window.innerWidth : 1280) - half - 8, r.left + r.width / 2));
      setHover({ idx, x, y: r.top });
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

  const onDeviceEnter = useCallback((e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const half = 128;
    const x = Math.max(
      half + 8,
      Math.min((typeof window !== 'undefined' ? window.innerWidth : 1280) - half - 8, r.left + r.width / 2)
    );
    setDeviceHover({ x, y: r.top });
  }, []);
  const onDeviceLeave = useCallback(() => setDeviceHover(null), []);

  // Escalation banner hover → shows what's being done about it.
  const [escHover, setEscHover] = useState<{ x: number; y: number } | null>(null);
  const onEscEnter = useCallback((e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setEscHover({ x: r.left + r.width / 2, y: r.top });
  }, []);
  const onEscLeave = useCallback(() => setEscHover(null), []);

  // Last 7 days of check-ins (did they show up?).
  const checkins = useMemo(() => last14.slice(-7).map((d) => d.has), [last14]);
  const checkedCount = checkins.filter(Boolean).length;
  const streak = useMemo(() => {
    let n = 0;
    for (let i = checkins.length - 1; i >= 0; i--) {
      if (checkins[i]) n++;
      else break;
    }
    return n;
  }, [checkins]);

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
      return stale != null ? `No check-in in ${stale} day${stale === 1 ? '' : 's'}` : 'No recent check-in';
    }
    const last7 = last14.slice(-7).filter((d) => d.has);
    const neg = last7.filter((d) => d.score < -0.1).length;
    const pos = last7.filter((d) => d.score >= 0.25).length;
    if (status === 'escalated') return neg ? `${neg} hard day${neg === 1 ? '' : 's'} this week — needs support` : 'Recent distress flagged';
    if (status === 'elevated') return neg ? `${neg} tough day${neg === 1 ? '' : 's'} this week` : 'Mood dipping this week';
    if (status === 'flagged') return 'Mixed week — worth a check-in';
    return pos >= 4 ? 'Consistent and dialed in' : 'Steady this week';
  }, [status, last14, stale]);

  // Risk tier + themes: real on live, synthesized only in the demo.
  const tier = demo ? deriveTier(status, athlete.sentimentScore ?? 0) : athlete.activeEscalationTier ?? 0;
  const themes = useMemo(() => (demo ? deriveThemes(athlete.id, status) : []), [athlete.id, status, demo]);
  const [acked, setAcked] = useState(false);
  const isAttention = status === 'escalated' || status === 'elevated' || status === 'flagged';
  const urgent = status === 'escalated' || status === 'elevated';
  const lastCheckin = useMemo(() => {
    for (let i = last14.length - 1; i >= 0; i--) {
      if (last14[i].has) {
        const ago = last14.length - 1 - i;
        return ago === 0 ? 'Checked in today' : ago === 1 ? 'Checked in yesterday' : `Last check-in ${ago}d ago`;
      }
    }
    return stale != null ? `No check-in · seen ${stale}d ago` : 'No check-ins yet';
  }, [last14, stale]);

  // Device: real connection + wear coverage on live, synthesized in demo.
  // Modules has no real per-athlete source yet, so it's demo-only (hidden on live).
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
  const deviceSummary = demo
    ? `Device ${deviceCoveragePct}%`
    : deviceConnected
    ? `${deviceLabel} · ${deviceCoveragePct}%`
    : 'No device connected';
  const deviceTone = !deviceConnected
    ? 'text-zinc-500'
    : deviceCoveragePct >= 70
    ? 'text-emerald-300'
    : deviceCoveragePct > 0
    ? 'text-amber-300'
    : 'text-zinc-300';
  const modulesDone: number | null = demo
    ? Math.max(0, Math.min(3, Math.round(((athlete.weeklyGoalProgress ?? 0) / 100) * 3)))
    : null;

  const TrendIcon = trend === 'improving' ? ArrowUpRight : trend === 'declining' ? ArrowDownRight : Minus;
  const trendColor = trend === 'improving' ? '#4ade80' : trend === 'declining' ? '#f87171' : '#a1a1aa';

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
          <div className="flex min-w-0 items-center gap-2.5">
            {athlete.profileImageUrl ? (
              <img src={athlete.profileImageUrl} alt={athlete.displayName} className="h-9 w-9 flex-none rounded-full object-cover ring-1 ring-white/10" />
            ) : (
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-zinc-800 ring-1 ring-white/10">
                <User className="h-4 w-4 text-zinc-400" />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{athlete.displayName}</p>
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
            loading={history === null}
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

        {/* Daily check-ins */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Check-ins</span>
          <span className="flex items-center gap-1">
            {last14.slice(-7).map((d, i) => {
              const absIdx = last14.length - 7 + i;
              const on = d.has;
              const isToday = i === 6;
              return (
                <span
                  key={i}
                  data-checkin-dot
                  onMouseEnter={(e) => onDayEnter(absIdx, e)}
                  onMouseLeave={onDayLeave}
                  className="h-2.5 w-2.5 cursor-pointer rounded-[3px]"
                  style={{
                    // Presence is its own dimension (not mood): filled = showed up,
                    // hollow = missed. Neutral so it never reads as a mood color.
                    background: on ? 'rgba(228,228,231,0.85)' : 'transparent',
                    border: on ? 'none' : '1px solid rgba(255,255,255,0.15)',
                    outline: hover?.idx === absIdx ? '1.5px solid rgba(255,255,255,0.85)' : isToday ? '1.5px solid rgba(255,255,255,0.25)' : 'none',
                    outlineOffset: 1,
                  }}
                />
              );
            })}
          </span>
          <span className="ml-auto text-[11px] text-zinc-400">
            {checkedCount}/7{streak > 1 ? <span className="ml-1.5 text-zinc-500">· 🔥{streak}</span> : null}
          </span>
        </div>

        {/* Adherence */}
        <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-500">
          <span
            className="inline-flex max-w-full cursor-help items-center gap-1"
            onMouseEnter={onDeviceEnter}
            onMouseLeave={onDeviceLeave}
          >
            <Watch className="h-3.5 w-3.5 flex-none" />
            <span className="flex-none">Device</span>
            <span className={`truncate ${deviceTone}`}>{deviceSummary}</span>
          </span>
          {modulesDone !== null && (
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Modules <span className="text-zinc-300">{modulesDone}/3</span>
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

      {/* Device hover detail */}
      {deviceHover && (
        <div
          className="pointer-events-none fixed z-[70]"
          style={{ left: deviceHover.x, top: deviceHover.y, transform: 'translate(-50%, calc(-100% - 10px))' }}
        >
          <div className="w-64 rounded-xl border border-white/10 bg-zinc-900/[0.98] p-3 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
              <span className="min-w-0 truncate text-xs font-semibold text-white">{deviceLabel}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${deviceTone} bg-white/[0.05]`}>
                {deviceCoveragePct}%
              </span>
            </div>
            <div className="mt-2 space-y-1.5 text-[11px]">
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">Connection</span>
                <span className="text-right text-zinc-200">{demo ? 'Demo signal' : deviceConnectionLabel(athlete.deviceStatus)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">Days with data</span>
                <span className="text-zinc-200">{deviceDaysCovered}/{deviceWindowDays}</span>
              </div>
              {!demo && (
                <>
                  <div className="flex justify-between gap-3">
                    <span className="text-zinc-500">Last data</span>
                    <span className="text-right text-zinc-200">{formatDeviceTime(athlete.deviceStatus?.lastObservedAt)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-zinc-500">Last sync</span>
                    <span className="text-right text-zinc-200">{formatDeviceTime(athlete.deviceStatus?.lastSyncedAt)}</span>
                  </div>
                </>
              )}
              <div className="pt-1">
                <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-600">
                  <span>{deviceWindowDays} days ago</span>
                  <span>Today</span>
                </div>
                <div className="flex items-center gap-1">
                  {devicePresence.map((present, idx) => (
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
              {!deviceConnected && (
                <p className="pt-1 text-[10px] leading-4 text-zinc-500">
                  No connected wearable or health source was found for this athlete.
                </p>
              )}
              {deviceConnected && deviceDaysCovered === 0 && (
                <p className="pt-1 text-[10px] leading-4 text-zinc-500">
                  The source is connected, but no wearable data arrived in this window.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Per-day hover detail (mood squares + check-in dots share this) */}
      {hover &&
        last14[hover.idx] &&
        (() => {
          const d = last14[hover.idx];
          const c = d.has ? moodColor(d.score) : '#71717a';
          const showDevice = demo || (!!athlete.deviceDailyPresence && athlete.deviceDailyPresence.length > 0);
          const topics = demo ? d.topics : dayTopics[ymd(d.date)] || [];
          return (
            <div
              className="pointer-events-none fixed z-[70]"
              style={{ left: hover.x, top: hover.y, transform: 'translate(-50%, calc(-100% - 10px))' }}
            >
              <div className="w-56 rounded-xl border border-white/10 bg-zinc-900/[0.98] p-3 shadow-2xl backdrop-blur">
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                  <span className="text-xs font-semibold text-white">
                    {d.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${c}22`, color: c }}>
                    {d.moodLabel}
                  </span>
                </div>
                {d.has ? (
                  <div className="mt-2 space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Check-in</span>
                      <span className="text-zinc-200">Completed</span>
                    </div>
                    {showDevice && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Device</span>
                        <span className={d.device ? 'text-emerald-300' : 'text-zinc-400'}>{d.device ? 'Worn' : 'Not worn'}</span>
                      </div>
                    )}
                    {demo && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Modules</span>
                        <span className="text-zinc-200">{d.modules}/3</span>
                      </div>
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
                ) : (
                  <p className="mt-2 text-[11px] text-zinc-500">No check-in this day.</p>
                )}
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
  onEnter: (idx: number, e: React.MouseEvent) => void;
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
            onMouseEnter={(e) => onEnter(i, e)}
            onMouseLeave={onLeave}
            className="h-5 flex-1 cursor-pointer rounded-[3px]"
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
