import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  User,
  MessageCircle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  TrendingUp,
  Watch,
  Sparkles,
  ShieldAlert,
  Check,
} from 'lucide-react';
import { coachService, DailySentimentRecord } from '../api/firebase/coach/service';
import CoachAthleteMessagingModal from './CoachAthleteMessagingModal';
import AthleteDetailsModal from './AthleteDetailsModal';
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
}

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
const TIER: Record<number, { label: string; pathway: string; color: string }> = {
  1: { label: 'Tier 1 · Monitor', pathway: "You've been notified — check in when you can.", color: '#3B82F6' },
  2: { label: 'Tier 2 · Elevated risk', pathway: 'Support pathway active, with athlete consent.', color: '#F97316' },
  3: { label: 'Tier 3 · Critical', pathway: 'Urgent — support pathway activated immediately.', color: '#EF4444' },
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
  const [detailsOpen, setDetailsOpen] = useState(false);
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
      // Per-day device/modules/topics are demo-only synth (no real per-day source
      // wired yet); on live they stay empty so the tooltip shows real data only.
      const device = demo && has ? h % 5 !== 0 : false;
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
  }, [history, athlete.id, demo]);

  // Per-day hover tooltip state.
  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null);
  const onDayEnter = useCallback((idx: number, e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const half = 116; // ~half the tooltip width; keep it on screen
    const x = Math.max(half + 8, Math.min((typeof window !== 'undefined' ? window.innerWidth : 1280) - half - 8, r.left + r.width / 2));
    setHover({ idx, x, y: r.top });
  }, []);
  const onDayLeave = useCallback(() => setHover(null), []);

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

  // Device: real (deviceConnected) on live, synth in demo. Modules has no real
  // per-athlete source yet, so it's demo-only (hidden on live).
  const deviceWorn = demo
    ? (athlete.conversationCount ?? 0) > 0 || (athlete.weeklyGoalProgress ?? 0) > 10
    : !!athlete.deviceConnected;
  const modulesDone: number | null = demo
    ? Math.max(0, Math.min(3, Math.round(((athlete.weeklyGoalProgress ?? 0) / 100) * 3)))
    : null;

  const TrendIcon = trend === 'improving' ? ArrowUpRight : trend === 'declining' ? ArrowDownRight : Minus;
  const trendColor = trend === 'improving' ? '#4ade80' : trend === 'declining' ? '#f87171' : '#a1a1aa';

  return (
    <>
      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60 p-4 transition-all hover:border-white/20"
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

        {/* Risk / escalation context — only for athletes who need it */}
        {tier > 0 && (
          <div
            className="mt-3 flex items-start gap-2 rounded-lg border px-2.5 py-2"
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

        {/* Adherence (proxies for now) */}
        <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <Watch className="h-3.5 w-3.5" /> Device {deviceWorn ? <span className="text-zinc-300">✓</span> : <span className="text-zinc-600">—</span>}
          </span>
          {modulesDone !== null && (
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Modules <span className="text-zinc-300">{modulesDone}/3</span>
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 space-y-2">
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
                onClick={() => setAcked(true)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-zinc-400 transition hover:bg-white/[0.07] hover:text-zinc-200"
              >
                <Check className="h-3.5 w-3.5" /> I&apos;ve got this — acknowledge
              </button>
            ))}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] font-medium text-zinc-300 transition hover:bg-white/[0.08]"
            >
              <TrendingUp className="h-4 w-4" /> Details
            </button>
            <button
              type="button"
              onClick={() => setMessagingOpen(true)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#E0FE10] px-3 py-2 text-[13px] font-semibold text-black transition hover:brightness-105"
            >
              <MessageCircle className="h-4 w-4" /> {urgent ? 'Check in now' : 'Message'}
            </button>
          </div>
        </div>
      </div>

      {/* Per-day hover detail (mood squares + check-in dots share this) */}
      {hover &&
        last14[hover.idx] &&
        (() => {
          const d = last14[hover.idx];
          const c = d.has ? moodColor(d.score) : '#71717a';
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
                    {demo && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Device</span>
                          <span className={d.device ? 'text-emerald-300' : 'text-zinc-400'}>{d.device ? 'Worn' : 'Not worn'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Modules</span>
                          <span className="text-zinc-200">{d.modules}/3</span>
                        </div>
                      </>
                    )}
                    {d.topics.length > 0 && (
                      <div className="pt-1">
                        <span className="text-zinc-500">Needed support with</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {d.topics.map((t) => (
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
      <AthleteDetailsModal
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        athleteId={athlete.id}
        athleteName={athlete.displayName}
        onStartMessaging={() => setMessagingOpen(true)}
      />
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
