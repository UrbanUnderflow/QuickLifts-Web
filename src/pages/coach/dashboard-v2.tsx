import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Flame,
  Users,
  Brain,
  Calendar,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  Shield,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Link2,
  Trash2,
  UploadCloud,
  StickyNote,
  RefreshCw,
} from 'lucide-react';
import CoachProtectedRoute from '../../components/CoachProtectedRoute';
import AthleteCard from '../../components/AthleteCard';
import { useUser } from '../../hooks/useUser';
import { coachService } from '../../api/firebase/coach';
import {
  getLatestSportsIntelligenceReportForCoach,
  type CoachReportListItem,
} from '../../api/firebase/pulsecheckCoachReportAccess';
import { noraVaultService, NoraVaultEntry } from '../../api/firebase/coach/noraVaultService';

type CoachAthlete = {
  id: string;
  displayName: string;
  email: string;
  profileImageUrl?: string;
  lastActiveDate?: Date;
  conversationCount: number;
  totalSessions: number;
  weeklyGoalProgress: number;
  sentimentScore: number;
};

type StatusKey = 'optimal' | 'flagged' | 'elevated' | 'escalated' | 'pending';

const STATUS_META: Record<StatusKey, { dot: string; text: string; label: string }> = {
  optimal: { dot: 'bg-green-400', text: 'text-green-400/90', label: 'Optimal' },
  flagged: { dot: 'bg-amber-400', text: 'text-amber-400/90', label: 'Flagged' },
  elevated: { dot: 'bg-orange-400', text: 'text-orange-400/90', label: 'Elevated' },
  escalated: { dot: 'bg-red-400 animate-pulse', text: 'text-red-400/90', label: 'Escalated' },
  pending: { dot: 'bg-zinc-600', text: 'text-zinc-500', label: 'Pending check-in' },
};

const daysSince = (d?: Date): number | null => {
  if (!d || isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
};

const deriveStatus = (a: CoachAthlete): StatusKey => {
  const stale = daysSince(a.lastActiveDate);
  if (a.conversationCount === 0 || stale === null || stale > 7) return 'pending';
  const s = a.sentimentScore ?? 0;
  if (s >= 0.25) return 'optimal';
  if (s >= -0.1) return 'flagged';
  if (s >= -0.4) return 'elevated';
  return 'escalated';
};

const initialsOf = (name?: string): string => {
  if (!name) return 'C';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'C';
};

type ViewKey =
  | 'home'
  | 'alerts'
  | 'roster'
  | 'nora'
  | 'schedule'
  | 'reports'
  | 'settings';

const NAV: { key: ViewKey; label: string; icon: React.ElementType }[] = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'alerts', label: 'Athlete Alerts', icon: Flame },
  { key: 'roster', label: 'Team Roster', icon: Users },
  { key: 'nora', label: 'Train Nora', icon: Brain },
  { key: 'schedule', label: 'Schedule', icon: Calendar },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
];

const todayLabel = () =>
  new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

interface CoachDashboardShellProps {
  athletes: CoachAthlete[];
  loadingAthletes: boolean;
  coachName: string;
  coachEmail?: string;
  coachId?: string;
}

export const CoachDashboardShell: React.FC<CoachDashboardShellProps> = ({
  athletes,
  loadingAthletes,
  coachName,
  coachEmail,
  coachId,
}) => {
  const router = useRouter();
  const [view, setView] = useState<ViewKey>('home');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const alertCount = useMemo(
    () => athletes.filter((a) => ['elevated', 'escalated'].includes(deriveStatus(a))).length,
    [athletes]
  );

  const NavList = ({ onPick }: { onPick?: () => void }) => (
    <nav className="flex-1 space-y-0.5">
      {NAV.map((item) => {
        const active = view === item.key;
        const Icon = item.icon;
        const showBadge = item.key === 'alerts' && alertCount > 0;
        return (
          <button
            key={item.key}
            onClick={() => {
              setView(item.key);
              onPick?.();
            }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
              active
                ? 'bg-[#E0FE10]/10 text-[#E0FE10] font-medium'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left">{item.label}</span>
            {showBadge && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/25 font-bold">
                {alertCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  const Sidebar = (
    <div className="flex flex-col h-full py-4 px-3">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-2 mb-5">
        <div className="w-7 h-7 rounded-lg bg-[#E0FE10]/15 flex items-center justify-center flex-shrink-0">
          <Shield className="w-4 h-4 text-[#E0FE10]" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-white">PulseCheck</div>
          <div className="text-[8px] text-zinc-500 uppercase tracking-widest">Coaching Platform</div>
        </div>
      </div>

      {/* Coach identity */}
      <div className="flex items-center gap-2.5 px-2 py-3 rounded-xl bg-zinc-800/30 border border-zinc-700/20 mb-5">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#E0FE10]/30 to-green-500/20 border border-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-[#E0FE10]">{initialsOf(coachName)}</span>
        </div>
        <div className="leading-tight min-w-0">
          <div className="text-xs font-semibold text-white truncate">{coachName}</div>
          <div className="text-[9px] text-zinc-500">Head Coach</div>
        </div>
      </div>

      <NavList onPick={() => setMobileNavOpen(false)} />

      <div className="mt-auto pt-3 border-t border-zinc-800/60">
        <button
          onClick={() => router.push('/')}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-zinc-600 hover:text-zinc-400"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
      <div
        className="min-h-screen text-white"
        style={{
          background:
            'linear-gradient(180deg, rgba(17,17,19,0.98) 0%, rgba(10,10,11,1) 100%)',
        }}
      >
        <div className="flex min-h-screen">
          {/* Desktop sidebar */}
          <aside className="hidden md:flex w-[240px] flex-shrink-0 border-r border-zinc-800/60 flex-col">
            {Sidebar}
          </aside>

          {/* Mobile slide-over */}
          <AnimatePresence>
            {mobileNavOpen && (
              <div className="fixed inset-0 z-50 md:hidden">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/60"
                  onClick={() => setMobileNavOpen(false)}
                />
                <motion.div
                  initial={{ x: -260 }}
                  animate={{ x: 0 }}
                  exit={{ x: -260 }}
                  transition={{ type: 'tween', duration: 0.2 }}
                  className="absolute top-0 left-0 h-full w-[260px] bg-zinc-900 border-r border-zinc-800"
                >
                  {Sidebar}
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Main */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/5 backdrop-blur-xl bg-zinc-900/20">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileNavOpen(true)}
                  className="md:hidden w-9 h-9 rounded-lg bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center"
                  aria-label="Open navigation"
                >
                  <Users className="w-4 h-4 text-zinc-300" />
                </button>
                <div>
                  <div className="text-sm font-bold text-white capitalize">
                    {NAV.find((n) => n.key === view)?.label}
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                    Coach Dashboard
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-zinc-500">{todayLabel()}</div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={view}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }}
                >
                  {view === 'home' && (
                    <HomeSection athletes={athletes} loading={loadingAthletes} />
                  )}
                  {view === 'alerts' && <AlertsSection athletes={athletes} loading={loadingAthletes} />}
                  {view === 'roster' && <RosterSection athletes={athletes} loading={loadingAthletes} />}
                  {view === 'nora' && <TrainNoraSection coachId={coachId} />}
                  {view === 'schedule' && <ScheduleSection />}
                  {view === 'reports' && <ReportsSection coachId={coachId} />}
                  {view === 'settings' && <SettingsSection coachName={coachName} email={coachEmail} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
  );
};

const CoachDashboardV2: React.FC = () => {
  const currentUser = useUser();
  const [athletes, setAthletes] = useState<CoachAthlete[]>([]);
  const [loadingAthletes, setLoadingAthletes] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!currentUser?.id) return;
      setLoadingAthletes(true);
      try {
        const list = await coachService.getConnectedAthletes(currentUser.id);
        if (!cancelled) setAthletes(list as CoachAthlete[]);
      } catch (err) {
        console.error('[dashboard-v2] failed to load athletes', err);
        if (!cancelled) setAthletes([]);
      } finally {
        if (!cancelled) setLoadingAthletes(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  const coachName = currentUser?.displayName || currentUser?.username || 'Coach';

  return (
    <CoachProtectedRoute requiresActiveSubscription={false}>
      <Head>
        <title>Coach Dashboard | PulseCheck</title>
      </Head>
      <CoachDashboardShell
        athletes={athletes}
        loadingAthletes={loadingAthletes}
        coachName={coachName}
        coachEmail={currentUser?.email}
        coachId={currentUser?.id}
      />
    </CoachProtectedRoute>
  );
};

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

const HomeSection: React.FC<{ athletes: CoachAthlete[]; loading: boolean }> = ({
  athletes,
  loading,
}) => {
  const counts = useMemo(() => {
    const c: Record<StatusKey, number> = {
      optimal: 0,
      flagged: 0,
      elevated: 0,
      escalated: 0,
      pending: 0,
    };
    athletes.forEach((a) => {
      c[deriveStatus(a)]++;
    });
    return c;
  }, [athletes]);

  return (
    <div className="space-y-6">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Total Athletes" value={athletes.length} accent />
        <StatTile label="Optimal" value={counts.optimal} dot="bg-green-400" />
        <StatTile label="Needs Attention" value={counts.elevated + counts.escalated} dot="bg-orange-400" />
        <StatTile label="Pending Check-In" value={counts.pending} dot="bg-zinc-500" />
      </div>

      {loading ? (
        <LoadingBlock label="Loading your athletes…" />
      ) : athletes.length === 0 ? (
        <EmptyBlock
          icon={Users}
          title="No connected athletes yet"
          body="Athletes who join through your invite link will appear here with their check-ins and 28-day mood cycle."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {athletes.map((a) => (
            <AthleteCard
              key={a.id}
              athlete={{
                id: a.id,
                displayName: a.displayName,
                email: a.email,
                profileImageUrl: a.profileImageUrl,
                conversationCount: a.conversationCount,
                totalSessions: a.totalSessions,
                weeklyGoalProgress: a.weeklyGoalProgress,
                sentimentScore: a.sentimentScore,
                lastActiveDate: a.lastActiveDate,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Athlete Alerts
// ---------------------------------------------------------------------------

const AlertsSection: React.FC<{ athletes: CoachAthlete[]; loading: boolean }> = ({
  athletes,
  loading,
}) => {
  const flagged = useMemo(
    () =>
      athletes
        .map((a) => ({ a, status: deriveStatus(a) }))
        .filter(({ status }) => status === 'elevated' || status === 'escalated')
        .sort((x, y) => (x.a.sentimentScore ?? 0) - (y.a.sentimentScore ?? 0)),
    [athletes]
  );

  if (loading) return <LoadingBlock label="Scanning athlete check-ins…" />;

  if (flagged.length === 0) {
    return (
      <EmptyBlock
        icon={Flame}
        title="All clear"
        body="No athletes are showing elevated or escalated signals right now. Alerts surface automatically when sentiment drops or a check-in flags concern."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
          Athlete Alerts
        </div>
        <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 font-bold">
          {flagged.length} ACTIVE
        </span>
      </div>

      {flagged.map(({ a, status }) => {
        const isCritical = status === 'escalated';
        const stale = daysSince(a.lastActiveDate);
        return (
          <div
            key={a.id}
            className="rounded-2xl overflow-hidden p-5"
            style={{
              background: isCritical
                ? 'linear-gradient(135deg, rgba(239,68,68,0.10) 0%, rgba(185,28,28,0.06) 100%)'
                : 'linear-gradient(135deg, rgba(249,115,22,0.08) 0%, rgba(239,68,68,0.05) 100%)',
              border: isCritical
                ? '1px solid rgba(239,68,68,0.35)'
                : '1px solid rgba(249,115,22,0.25)',
            }}
          >
            <div className="flex items-start gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isCritical ? 'bg-red-500/20' : 'bg-orange-500/20'
                }`}
              >
                <AlertTriangle className={`w-5 h-5 ${isCritical ? 'text-red-400' : 'text-orange-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white">Nora Alert — {a.displayName}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      isCritical
                        ? 'bg-red-500/20 text-red-400 border-red-500/30'
                        : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                    }`}
                  >
                    {STATUS_META[status].label}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  Last check-in {stale === null ? 'unknown' : stale === 0 ? 'today' : `${stale}d ago`}
                </div>
              </div>
            </div>

            <p className="text-sm text-zinc-300 leading-relaxed mb-4">
              {a.displayName}&apos;s recent sentiment is trending{' '}
              <span className={isCritical ? 'text-red-400 font-semibold' : 'text-orange-400 font-semibold'}>
                {isCritical ? 'sharply negative' : 'downward'}
              </span>
              . Reach out to check in before their next session.
            </p>

            <div className="grid grid-cols-3 gap-3">
              <MetricTile label="Mood" value={a.sentimentScore?.toFixed(2) ?? '—'} />
              <MetricTile label="Conversations" value={a.conversationCount} />
              <MetricTile label="Sessions" value={a.totalSessions} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Team Roster
// ---------------------------------------------------------------------------

const RosterSection: React.FC<{ athletes: CoachAthlete[]; loading: boolean }> = ({
  athletes,
  loading,
}) => {
  const rows = useMemo(
    () =>
      athletes
        .map((a) => ({ a, status: deriveStatus(a) }))
        .sort((x, y) => (x.a.sentimentScore ?? 0) - (y.a.sentimentScore ?? 0)),
    [athletes]
  );

  const counts = useMemo(() => {
    const c: Record<StatusKey, number> = {
      optimal: 0,
      flagged: 0,
      elevated: 0,
      escalated: 0,
      pending: 0,
    };
    rows.forEach(({ status }) => c[status]++);
    return c;
  }, [rows]);

  const checkedIn = athletes.length - counts.pending;
  const pct = athletes.length ? Math.round((checkedIn / athletes.length) * 100) : 0;

  if (loading) return <LoadingBlock label="Building team roster…" />;

  if (athletes.length === 0) {
    return (
      <EmptyBlock
        icon={Users}
        title="No athletes on the roster"
        body="Connected athletes appear here with a live status read derived from their most recent check-ins."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
          Team Status Overview — All Athletes
        </div>
        <div className="flex items-center gap-3 text-[11px] flex-wrap">
          {(['optimal', 'flagged', 'elevated', 'escalated', 'pending'] as StatusKey[]).map((k) => (
            <span key={k} className="flex items-center gap-1 text-zinc-400">
              <span className={`w-2 h-2 rounded-full inline-block ${STATUS_META[k].dot}`} />
              {counts[k]} {STATUS_META[k].label}
            </span>
          ))}
        </div>
      </div>

      {/* Progress */}
      <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3 flex items-center gap-4">
        <div className="text-sm text-zinc-300 whitespace-nowrap">
          <span className="text-white font-bold">{checkedIn}</span>/{athletes.length} checked in
        </div>
        <div className="flex-1 h-2 bg-zinc-700/50 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #22C55E, #E0FE10)' }}
          />
        </div>
        <div className="text-xs text-zinc-500">{pct}%</div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-700/30 overflow-hidden">
        <div className="grid grid-cols-[1fr_110px_90px] sm:grid-cols-[1fr_1fr_120px] gap-0 bg-zinc-800/60 border-b border-zinc-700/30 px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wide">
          <div>Player</div>
          <div>Status</div>
          <div className="text-right">Last Active</div>
        </div>
        <div className="max-h-[520px] overflow-y-auto">
          {rows.map(({ a, status }, i) => {
            const stale = daysSince(a.lastActiveDate);
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.4) }}
                className="grid grid-cols-[1fr_110px_90px] sm:grid-cols-[1fr_1fr_120px] gap-0 items-center px-3 py-2.5 border-b border-zinc-800/50 text-sm hover:bg-zinc-800/40"
              >
                <div className="min-w-0">
                  <div className="font-medium text-white truncate">{a.displayName}</div>
                  <div className="text-[11px] text-zinc-500 truncate">{a.email}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_META[status].dot}`} />
                  <span className={`text-xs truncate ${STATUS_META[status].text}`}>
                    {STATUS_META[status].label}
                  </span>
                </div>
                <div className="text-right text-zinc-500 text-xs">
                  {stale === null ? '—' : stale === 0 ? 'Today' : `${stale}d ago`}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Train Nora — knowledge vault
// ---------------------------------------------------------------------------

const TrainNoraSection: React.FC<{ coachId?: string }> = ({ coachId }) => {
  const [entries, setEntries] = useState<NoraVaultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState<{ name: string; pct: number } | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteCategory, setNoteCategory] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    if (!coachId) return;
    setLoading(true);
    try {
      setEntries(await noraVaultService.getEntries(coachId));
    } catch (err) {
      console.error('[train-nora] load failed', err);
    } finally {
      setLoading(false);
    }
  }, [coachId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleFiles = async (files: FileList | File[]) => {
    if (!coachId) return;
    setError(null);
    const arr = Array.from(files);
    for (const file of arr) {
      if (file.size > 25 * 1024 * 1024) {
        setError(`"${file.name}" is larger than 25MB and was skipped.`);
        continue;
      }
      try {
        setUploading({ name: file.name, pct: 0 });
        await noraVaultService.addFile(coachId, file, {
          onProgress: (pct) => setUploading({ name: file.name, pct }),
        });
      } catch (err: any) {
        console.error('[train-nora] upload failed', err);
        setError(err?.message || `Failed to upload "${file.name}".`);
      }
    }
    setUploading(null);
    await refresh();
  };

  const saveNote = async () => {
    if (!coachId || (!noteBody.trim() && !noteTitle.trim())) return;
    try {
      await noraVaultService.addNote(coachId, {
        title: noteTitle,
        content: noteBody,
        category: noteCategory.trim() || undefined,
      });
      setNoteTitle('');
      setNoteBody('');
      setNoteCategory('');
      setNoteOpen(false);
      await refresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to save note.');
    }
  };

  const remove = async (entry: NoraVaultEntry) => {
    try {
      await noraVaultService.deleteEntry(entry);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    } catch (err) {
      console.error('[train-nora] delete failed', err);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header / explainer */}
      <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/8 to-blue-500/5 p-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Brain className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Train Nora</div>
            <div className="text-xs text-zinc-500">Your team&apos;s knowledge vault</div>
          </div>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">
          Drop in files, images, links, and notes — schedules, playbooks, policies, meeting times.
          Anything you add here becomes context Nora can draw on, so an athlete can ask{' '}
          <span className="text-purple-400 font-medium">&ldquo;what time is the team meeting?&rdquo;</span>{' '}
          and Nora answers from what you&apos;ve shared.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#E0FE10] text-black text-sm font-semibold hover:brightness-95"
        >
          <UploadCloud className="w-4 h-4" /> Upload files
        </button>
        <button
          onClick={() => setNoteOpen((o) => !o)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/40 text-zinc-200 text-sm hover:bg-zinc-700/60"
        >
          <StickyNote className="w-4 h-4" /> Add note
        </button>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/40 border border-zinc-700/30 text-zinc-400 text-sm hover:text-zinc-200"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Note composer */}
      <AnimatePresence>
        {noteOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-4 space-y-3">
              <input
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Title (e.g. Practice schedule)"
                className="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#E0FE10]/40"
              />
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="What should Nora know? e.g. Team meeting is every Monday at 7:00 AM in the film room. Practice starts at 3:30 PM."
                rows={4}
                className="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#E0FE10]/40 resize-y"
              />
              <div className="flex items-center gap-2">
                <input
                  value={noteCategory}
                  onChange={(e) => setNoteCategory(e.target.value)}
                  placeholder="Category (optional)"
                  className="flex-1 bg-zinc-900/60 border border-zinc-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#E0FE10]/40"
                />
                <button
                  onClick={saveNote}
                  className="px-4 py-2 rounded-lg bg-[#E0FE10] text-black text-sm font-semibold hover:brightness-95"
                >
                  Save
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-[#E0FE10]/60 bg-[#E0FE10]/5'
            : 'border-zinc-700/50 hover:border-zinc-600/60 bg-zinc-800/20'
        }`}
      >
        <UploadCloud className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
        <div className="text-sm text-zinc-300">
          {uploading ? (
            <span>
              Uploading <span className="text-[#E0FE10]">{uploading.name}</span> — {uploading.pct}%
            </span>
          ) : (
            <>
              Drag &amp; drop files or images here, or <span className="text-[#E0FE10]">browse</span>
            </>
          )}
        </div>
        <div className="text-[11px] text-zinc-600 mt-1">PDFs, docs, images — up to 25MB each</div>
        {uploading && (
          <div className="mt-3 max-w-xs mx-auto h-1.5 bg-zinc-700/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#E0FE10] transition-all"
              style={{ width: `${uploading.pct}%` }}
            />
          </div>
        )}
      </div>

      {/* Vault contents */}
      <div>
        <div className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
          Vault Contents {entries.length > 0 && <span className="text-zinc-600">({entries.length})</span>}
        </div>
        {loading ? (
          <LoadingBlock label="Loading the vault…" />
        ) : entries.length === 0 ? (
          <div className="text-sm text-zinc-500 rounded-xl border border-zinc-800/60 bg-zinc-800/20 p-6 text-center">
            Nothing here yet. Add your first note or file to start training Nora.
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <VaultRow key={e.id} entry={e} onDelete={() => remove(e)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const VaultRow: React.FC<{ entry: NoraVaultEntry; onDelete: () => void }> = ({ entry, onDelete }) => {
  const Icon =
    entry.type === 'image' ? ImageIcon : entry.type === 'link' ? Link2 : entry.type === 'note' ? FileText : FileText;
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/30 hover:bg-zinc-800/60 transition-colors group">
      <div className="w-9 h-9 rounded-lg bg-purple-500/15 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-purple-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">{entry.title}</span>
          {entry.category && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-700/50 text-zinc-400 border border-zinc-600/30">
              {entry.category}
            </span>
          )}
        </div>
        {entry.content && (
          <div className="text-xs text-zinc-500 leading-relaxed mt-0.5 line-clamp-2">{entry.content}</div>
        )}
        {entry.downloadUrl && (
          <a
            href={entry.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[#E0FE10] hover:underline mt-1 inline-block"
            onClick={(ev) => ev.stopPropagation()}
          >
            {entry.fileName || 'Open file'}
          </a>
        )}
      </div>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 flex-shrink-0"
        aria-label="Delete entry"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

const ReportsSection: React.FC<{ coachId?: string }> = ({ coachId }) => {
  const router = useRouter();
  const [report, setReport] = useState<CoachReportListItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!coachId) return;
    setLoading(true);
    getLatestSportsIntelligenceReportForCoach(coachId)
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch(() => {
        if (!cancelled) setReport(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [coachId]);

  if (loading) return <LoadingBlock label="Loading reports…" />;

  if (!report) {
    return (
      <EmptyBlock
        icon={BarChart3}
        title="No reports yet"
        body="Your latest Sports Intelligence report will appear here once it's generated for your team."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
        Latest Sports Intelligence Report
      </div>
      <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-lg font-bold text-white">{report.title || 'Sports Intelligence Report'}</div>
            <div className="text-sm text-zinc-400 mt-1">
              {[report.teamName, report.weekLabel].filter(Boolean).join(' • ')}
            </div>
          </div>
          {typeof report.adherence?.overallAdherencePct === 'number' && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-[#E0FE10]/10 text-[#E0FE10] border border-[#E0FE10]/20 font-medium">
              {Math.round(report.adherence.overallAdherencePct)}% adherence
            </span>
          )}
        </div>
        {report.href && (
          <button
            onClick={() => router.push(report.href)}
            className="mt-4 px-4 py-2 rounded-lg bg-[#E0FE10] text-black text-sm font-semibold hover:brightness-95"
          >
            Open report
          </button>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Library / Schedule / Settings (lean but functional shells)
// ---------------------------------------------------------------------------

const ScheduleSection: React.FC = () => (
  <EmptyBlock
    icon={Calendar}
    title="Schedule"
    body="Add team events, practices, and meetings here. Tip: the same details you add in Train Nora (e.g. meeting times) are what Nora uses to answer athlete questions."
  />
);

const SettingsSection: React.FC<{ coachName: string; email?: string }> = ({ coachName, email }) => (
  <div className="space-y-4">
    <div className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Settings</div>
    <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <div className="text-xs text-zinc-500 mb-1">Coach name</div>
        <div className="bg-zinc-800/60 rounded-lg px-3 py-2 text-sm">{coachName}</div>
      </div>
      <div>
        <div className="text-xs text-zinc-500 mb-1">Email</div>
        <div className="bg-zinc-800/60 rounded-lg px-3 py-2 text-sm break-all">{email || '—'}</div>
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------

const StatTile: React.FC<{ label: string; value: number; accent?: boolean; dot?: string }> = ({
  label,
  value,
  accent,
  dot,
}) => (
  <div className="rounded-xl bg-zinc-900/50 border border-white/5 p-4">
    <div className="flex items-center gap-2 mb-1">
      {dot && <span className={`w-2 h-2 rounded-full ${dot}`} />}
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
    <div className={`text-2xl font-bold ${accent ? 'text-[#E0FE10]' : 'text-white'}`}>{value}</div>
  </div>
);

const MetricTile: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3 text-center">
    <div className="text-sm font-bold text-white">{value}</div>
    <div className="text-[10px] text-zinc-500 uppercase tracking-wide mt-0.5">{label}</div>
  </div>
);

const LoadingBlock: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-3 text-zinc-500 text-sm py-10 justify-center">
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#E0FE10]" />
    {label}
  </div>
);

const EmptyBlock: React.FC<{ icon: React.ElementType; title: string; body: string }> = ({
  icon: Icon,
  title,
  body,
}) => (
  <div className="rounded-2xl border border-zinc-800/60 bg-zinc-800/20 p-10 text-center max-w-xl mx-auto">
    <div className="w-12 h-12 rounded-xl bg-zinc-800/60 flex items-center justify-center mx-auto mb-3">
      <Icon className="w-6 h-6 text-zinc-500" />
    </div>
    <div className="text-base font-semibold text-white mb-1">{title}</div>
    <div className="text-sm text-zinc-500 leading-relaxed">{body}</div>
  </div>
);

export default CoachDashboardV2;
