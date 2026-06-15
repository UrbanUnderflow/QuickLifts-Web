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
  MessageSquare,
  Send,
  Check,
  X,
  Inbox,
  UserCog,
  Plus,
  Wallet,
  TrendingUp,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Wind,
  Activity,
  Heart,
  BellRing,
  ShieldCheck,
  HeartPulse,
  CheckCircle2,
  Lock,
  ClipboardList,
  Zap,
  TrendingDown,
  Mail,
  CalendarDays,
  Copy,
  Pencil,
  Database,
} from 'lucide-react';
import CoachProtectedRoute from '../../components/CoachProtectedRoute';
import CoachProfileEditModal from '../../components/coach/CoachProfileEditModal';
import AthleteReadinessCard from '../../components/AthleteReadinessCard';
import { escalationRecordsService } from '../../api/firebase/escalation/service';
import { getCategoryLabel, EscalationCategory } from '../../api/firebase/escalation/types';
import {
  loadAthleteDeviceStatuses,
  type AthleteDeviceStatus,
  type AthleteDevicePerSourceStatus,
} from '../../api/firebase/pulsecheckDeviceMonitor';
import { useDispatch } from 'react-redux';
import { useUser } from '../../hooks/useUser';
import { setUser } from '../../redux/userSlice';
import { showToast } from '../../redux/toastSlice';
import { userService, User as UserModel } from '../../api/firebase/user';
import {
  coachService,
  type CoachAthleteCurriculumItem,
  type CoachAthleteCurriculumSnapshot,
} from '../../api/firebase/coach';
import { pulseCheckProvisioningService } from '../../api/firebase/pulsecheckProvisioning/service';
import {
  auth,
  getActiveFirebaseProjectId,
  isLocalFirebaseRuntime,
  isUsingDevFirebase,
  setPreferredFirebaseMode,
} from '../../api/firebase/config';
import { signOut } from 'firebase/auth';
import {
  deriveMembershipAccessFromCapabilities,
  normalizeStaffCapabilities,
} from '../../api/firebase/pulsecheckProvisioning/staffCapabilities';
import { STAFF_PERMISSIONS } from '../../lib/staffPermissions';
import type {
  PulseCheckInviteLink,
  PulseCheckTeamMembership,
  StaffPermission,
} from '../../api/firebase/pulsecheckProvisioning/types';
import {
  listSentSportsIntelligenceReportsForCoach,
  type CoachReportListItem,
} from '../../api/firebase/pulsecheckCoachReportAccess';
import { noraVaultService, NoraVaultEntry } from '../../api/firebase/coach/noraVaultService';
import ScheduleBoard from '../../components/coach/ScheduleBoard';
import NoraDashboardTraining from '../../components/coach/NoraDashboardTraining';
import {
  DEMO_ATHLETES,
  DEMO_ALERTS,
  DEMO_COACH_ID,
  useDemoDashboardMocks,
} from '../../components/coach/demoDashboardData';
import CoachReportView from '../../components/coach-reports/CoachReportView';
import { getDefaultPulseCheckSports } from '../../api/firebase/pulsecheckSportConfig';
import {
  COACH_REPORT_DEMO_EXAMPLES,
  buildDemoCoachSurface,
  getSportColor,
} from '../../api/firebase/pulsecheckSportReportDemos';

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
  // Real-data enrichment (live dashboard). Optional so the demo path can omit them.
  activeEscalationTier?: number;
  deviceCoveragePct?: number;
  deviceConnected?: boolean;
  deviceDailyPresence?: boolean[];
  deviceStatus?: AthleteDeviceStatus;
};

type AthleteProfileHistoryRow = {
  date: string;
  score: number;
  messages: number;
};

type DailyCheckInPoint = {
  date: Date;
  dateKey: string;
  score: number;
  messages: number;
  hasCheckIn: boolean;
};

type CheckInWindowSummary = {
  days: number;
  checked: number;
  missed: number;
  rate: number;
  state: string;
  toneClass: string;
  detail: string;
  presence: boolean[];
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

const firstNameOf = (name?: string): string => (name ? name.trim().split(/\s+/)[0] : 'Your athlete');

const localDayKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const relativeWhen = (d?: Date): string => {
  const days = daysSince(d);
  if (days === null) return 'recently';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
};

// ---------------------------------------------------------------------------
// Athlete Alerts — Tier 2 (consent-based) + Tier 3 (clinical monitoring)
// ---------------------------------------------------------------------------
//
// Only Tier 2 and Tier 3 escalations reach this board.
//  • Tier 2 (Elevated Risk) is CONSENT-BASED: Nora only offers to notify a staff
//    member who is onboarded on the athlete's team, and the athlete must
//    explicitly choose that person. So a Tier 2 alert lands here only when the
//    athlete picked *this* coach — `notifiedCoachName` is the proof of consent.
//  • Tier 3 (Critical Risk) is MONITORING/AWARENESS: Nora, PulseCheck, and
//    AuntEdna have already initiated the mandatory clinical handoff. The coach
//    isn't being asked to intervene — they're being kept aware, with guardrails.
//
// The shape mirrors the real EscalationRecord fields so the live dashboard maps
// records straight in (see alertsFromEscalationRecords) with no UI changes.

export type AlertActionStatus = 'completed' | 'active' | 'queued';

export type AlertNoraAction = {
  label: string;
  detail: string;
  status: AlertActionStatus;
};

export type AthleteAlert = {
  id: string;
  athleteId: string;
  athleteName: string;
  tier: 2 | 3;
  category: string;                 // coach-safe label, e.g. "Anxiety Indicators"
  flaggedAt?: Date;
  lastCheckIn?: Date;
  summary: string;                  // Nora's coach-facing narrative — no clinical detail
  noraActions: AlertNoraAction[];   // what Nora has already done / queued
  recommendation: string;
  // Tier 2 — consent
  notifiedCoachName?: string;       // the staffer the athlete chose to notify (this coach)
  // Tier 3 — clinical monitoring
  handoffStatus?: 'initiated' | 'connecting' | 'engaged';
  clinicalContact?: string;         // e.g. "the care team" / "Dr. Liz Carter"
  metrics?: { label: string; value: string; flag?: string }[];
};

type StepState = 'done' | 'active' | 'pending';
type AlertStep = { label: string; state: StepState };

// The "what's being done" trail a coach reads at a glance, per tier.
const buildAlertSteps = (a: AthleteAlert): AlertStep[] => {
  const supportActive = a.noraActions.some((n) => n.status === 'active' || n.status === 'queued');
  const supportTouched = a.noraActions.length > 0;
  if (a.tier === 2) {
    return [
      { label: 'Nora flagged it', state: 'done' },
      {
        label: 'In-the-moment support',
        state: supportTouched ? (supportActive ? 'active' : 'done') : 'done',
      },
      { label: 'You were notified', state: a.notifiedCoachName ? 'done' : 'pending' },
    ];
  }
  // Tier 3
  const handoff = a.handoffStatus ?? 'initiated';
  return [
    { label: 'Nora flagged it', state: 'done' },
    { label: 'Support deployed', state: supportTouched ? 'done' : 'done' },
    {
      label: 'Clinical handoff',
      state: handoff === 'engaged' ? 'done' : 'active',
    },
    { label: 'Care team engaged', state: handoff === 'engaged' ? 'done' : 'pending' },
  ];
};

const HANDOFF_LABEL: Record<NonNullable<AthleteAlert['handoffStatus']>, string> = {
  initiated: 'Handoff initiated',
  connecting: 'Connecting care',
  engaged: 'Care team engaged',
};

// Live mapping: turn real EscalationRecords (already filtered to this coach by
// the service query) into coach-safe alerts. Deliberately conservative — no raw
// classification reasoning is shown to coaches; copy stays coach English.
export const alertsFromEscalationRecords = (
  records: Array<{
    id: string;
    userId: string;
    tier: number;
    category: string;
    handoffStatus?: string;
    createdAt?: number;
  }>,
  nameByAthlete: Map<string, string>,
  coachName: string
): AthleteAlert[] =>
  records
    .filter((r) => r.tier === 2 || r.tier === 3)
    .map((r) => {
      const tier = (r.tier === 3 ? 3 : 2) as 2 | 3;
      const name = nameByAthlete.get(r.userId) || 'Athlete';
      const first = firstNameOf(name);
      const flaggedAt = r.createdAt ? new Date(r.createdAt * 1000) : undefined;
      const category = getCategoryLabel(r.category as EscalationCategory);
      if (tier === 2) {
        return {
          id: r.id,
          athleteId: r.userId,
          athleteName: name,
          tier,
          category,
          flaggedAt,
          lastCheckIn: flaggedAt,
          notifiedCoachName: coachName,
          summary: `${first} hit an elevated-concern moment and chose to loop you in. Nora has been supporting them in the conversation.`,
          noraActions: [],
          recommendation: `Check in privately before ${first}'s next session. Keep it supportive — you don't need to reference specifics.`,
        } as AthleteAlert;
      }
      const handoff =
        r.handoffStatus === 'completed'
          ? 'engaged'
          : r.handoffStatus === 'initiated'
          ? 'connecting'
          : 'initiated';
      return {
        id: r.id,
        athleteId: r.userId,
        athleteName: name,
        tier,
        category,
        flaggedAt,
        lastCheckIn: flaggedAt,
        handoffStatus: handoff,
        clinicalContact: 'the care team',
        summary: `${first} is being supported through clinical care. This is beyond coaching scope — Nora and PulseCheck have already connected them with the right help.`,
        noraActions: [],
        recommendation: `No coaching action needed. Avoid discussing performance or availability with ${first} today — the care team has this.`,
      } as AthleteAlert;
    });

// ---------------------------------------------------------------------------
// Mental-readiness curriculum (real PulseCheck assignments/progress)
// ---------------------------------------------------------------------------
// When an athlete is on the clinical watch list (a Tier 3 escalation), the
// assignment surface is AUTO-PAUSED and the athlete is walled off from the
// curriculum — clinical care leads, not self-serve content. The coach sees this
// as a locked, read-only state.

const CURRICULUM_ITEM_META: Record<
  CoachAthleteCurriculumItem['kind'],
  { icon: React.ElementType; color: string }
> = {
  protocol: { icon: Wind, color: '#22D3EE' },
  simulation: { icon: Brain, color: '#8B5CF6' },
  curriculum: { icon: ClipboardList, color: '#E0FE10' },
  program: { icon: Zap, color: '#10B981' },
};

const CURRICULUM_STATUS_LABEL: Record<CoachAthleteCurriculumItem['status'], string> = {
  assigned: 'Assigned',
  'in-progress': 'In progress',
  completed: 'Complete',
  paused: 'Paused',
};

// Sentiment band → coach-friendly mood label + color.
const moodMeta = (score: number): { label: string; color: string } => {
  if (score >= 0.25) return { label: 'Good', color: '#22C55E' };
  if (score >= -0.1) return { label: 'Mixed', color: '#F59E0B' };
  if (score >= -0.4) return { label: 'Low', color: '#F97316' };
  return { label: 'Very low', color: '#EF4444' };
};

type SentimentTrend = 'improving' | 'declining' | 'steady';

// Input is newest-first daily scores; positive delta = improving.
const trendOf = (recentFirst: number[]): SentimentTrend => {
  const scored = recentFirst.filter((v) => v !== 0);
  if (scored.length < 4) return 'steady';
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
  const recent = avg(scored.slice(0, Math.ceil(scored.length / 2)));
  const older = avg(scored.slice(Math.ceil(scored.length / 2)));
  if (recent - older > 0.08) return 'improving';
  if (recent - older < -0.08) return 'declining';
  return 'steady';
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

type InboxThread = {
  id: string;
  name: string;
  initials: string;
  status: StatusKey;
  lastMessage: string;
  ts?: Date;
  unread: boolean;
};

const INBOX_SAMPLES: Record<StatusKey, string> = {
  escalated: "Coach, I've been really in my head before games. Can we talk?",
  elevated: "Haven't been sleeping well this week — feeling pretty drained.",
  flagged: 'Can we find time to talk about my role on Friday?',
  optimal: 'Felt strong at practice today 💪 thanks for the push.',
  pending: 'Hey coach, just checking in.',
};

// Demo-only: synthesize athlete→coach message threads from the roster so the
// Inbox has realistic content for walkthroughs. Real messaging data wires in later.
const buildInboxThreads = (athletes: CoachAthlete[]): InboxThread[] =>
  athletes
    .filter((a) => a.conversationCount > 0)
    .map((a, i) => {
      const status = deriveStatus(a);
      return {
        id: a.id,
        name: a.displayName,
        initials: initialsOf(a.displayName),
        status,
        lastMessage: INBOX_SAMPLES[status],
        ts: a.lastActiveDate,
        unread: status === 'escalated' || status === 'elevated' || i % 6 === 0,
      };
    })
    .sort((x, y) => (y.ts?.getTime() || 0) - (x.ts?.getTime() || 0))
    .slice(0, 14);

type ViewKey =
  | 'home'
  | 'alerts'
  | 'inbox'
  | 'roster'
  | 'staff'
  | 'nora'
  | 'schedule'
  | 'reports'
  | 'earnings'
  | 'settings';

const NAV: { key: ViewKey; label: string; icon: React.ElementType }[] = [
  { key: 'home', label: 'Readiness Dashboard', icon: Home },
  { key: 'alerts', label: 'Athlete Alerts', icon: Flame },
  { key: 'inbox', label: 'Inbox', icon: Inbox },
  { key: 'roster', label: 'Team Roster', icon: Users },
  { key: 'staff', label: 'Staff', icon: UserCog },
  { key: 'nora', label: 'Train Nora', icon: Brain },
  { key: 'schedule', label: 'Schedule', icon: Calendar },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
  { key: 'earnings', label: 'Earnings', icon: Wallet },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
];

const todayLabel = () =>
  new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

interface CoachDashboardShellProps {
  athletes: CoachAthlete[];
  /** Tier 2 (consent) + Tier 3 (clinical) alerts for the Athlete Alerts tab. */
  alerts?: AthleteAlert[];
  loadingAthletes: boolean;
  coachName: string;
  coachEmail?: string;
  coachId?: string;
  /** Optional staff title for the sidebar presence tile (defaults to "Head Coach"). */
  coachTitle?: string;
  /** Bio shown in the profile editor. */
  coachBio?: string;
  /** Profile photo URL for the sidebar presence tile. */
  coachAvatarUrl?: string;
  /** Persist edits made in the profile modal. Omitted in demo (edits stay local). */
  onSaveProfile?: (next: { name: string; email: string; title: string; bio: string; avatarUrl: string }) => Promise<void>;
  isDemo?: boolean;
  /** Earnings tab is shown only when this team has referral kickback on AND the
   *  current user is the configured revenue recipient. */
  earningsEnabled?: boolean;
  revenueSharePct?: number;
  /** The signed-in coach's own staff capabilities — gates which tabs/details are
   *  shown. Defaults to a full set (demo + safe fallback show everything). */
  viewerCapabilities?: StaffPermission[];
}

export const CoachDashboardShell: React.FC<CoachDashboardShellProps> = ({
  athletes,
  alerts = [],
  loadingAthletes,
  coachName,
  coachEmail,
  coachId,
  coachTitle,
  coachBio,
  coachAvatarUrl,
  onSaveProfile,
  isDemo = false,
  earningsEnabled = false,
  revenueSharePct = 0,
  viewerCapabilities = ['admin', 'administrative', 'coaching', 'athletic_trainer'],
}) => {
  const router = useRouter();
  // Demo always shows everything; live gates off the coach's own capabilities.
  // 'admin' is the superuser grant, so it satisfies every capability check.
  const can = useCallback(
    (capability: StaffPermission) =>
      isDemo || viewerCapabilities.includes('admin') || viewerCapabilities.includes(capability),
    [isDemo, viewerCapabilities]
  );
  // athletic_trainer is the medical peek — Tier 3 escalation detail.
  const canSeeTier3 = can('athletic_trainer');
  const [view, setView] = useState<ViewKey>('home');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  // Local mirror of the coach's presence/profile so edits show immediately in the
  // sidebar tile (and demo edits have somewhere to live).
  const [profile, setProfile] = useState({
    name: coachName,
    email: coachEmail || '',
    title: coachTitle || 'Head Coach',
    bio: coachBio || '',
    avatarUrl: coachAvatarUrl || '',
  });
  // Resync from props when they load/change and the editor isn't open.
  useEffect(() => {
    if (!profileOpen) {
      setProfile({
        name: coachName,
        email: coachEmail || '',
        title: coachTitle || 'Head Coach',
        bio: coachBio || '',
        avatarUrl: coachAvatarUrl || '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachName, coachEmail, coachTitle, coachBio, coachAvatarUrl]);

  const handleSaveProfile = useCallback(
    async (next: { name: string; email: string; title: string; bio: string; avatarUrl: string }) => {
      // Demo mode is a no-op: the editor is fully interactive for walkthroughs,
      // but Save changes nothing (no local update, no Firebase write).
      if (isDemo) return;
      setProfile(next); // optimistic — reflect in the sidebar tile right away
      if (onSaveProfile) await onSaveProfile(next);
    },
    [isDemo, onSaveProfile]
  );
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const selectedAthlete = useMemo(
    () => athletes.find((a) => a.id === selectedAthleteId) ?? null,
    [athletes, selectedAthleteId]
  );

  const alertCount = alerts.length;
  const inboxUnread = useMemo(
    () => (isDemo ? buildInboxThreads(athletes).filter((t) => t.unread).length : 0),
    [athletes, isDemo]
  );

  // Capability gating per tab:
  //  • athlete-facing tabs (readiness, roster, inbox, reports) need coaching
  //  • alerts needs coaching OR athletic_trainer (trainers watch escalations)
  //  • staff (invite staff, assign permissions) is admin-only
  //  • schedule / Train Nora need manager (administrative) OR coaching
  //  • earnings keeps its existing revenue-recipient gate; settings is always on
  // (admin satisfies every can() check, so admins see all of the above.)
  const navAllowed = useCallback(
    (key: ViewKey): boolean => {
      switch (key) {
        case 'home':
        case 'roster':
        case 'inbox':
        case 'reports':
          return can('coaching');
        case 'alerts':
          return can('coaching') || can('athletic_trainer');
        case 'staff':
          // Any staff member can view the roster; inviting + editing permissions
          // inside the tab are gated to admins (see StaffSection canInvite).
          return can('coaching') || can('administrative') || can('athletic_trainer');
        case 'schedule':
        case 'nora':
          return can('administrative') || can('coaching');
        case 'earnings':
          return earningsEnabled;
        case 'settings':
          return true;
        default:
          return true;
      }
    },
    [can, earningsEnabled]
  );

  const navItems = useMemo(() => NAV.filter((item) => navAllowed(item.key)), [navAllowed]);

  // If the active tab becomes disallowed (capabilities narrowed after load), land
  // the coach on the first tab they can actually see.
  useEffect(() => {
    if (navItems.length > 0 && !navItems.some((item) => item.key === view)) {
      setView(navItems[0].key);
    }
  }, [navItems, view]);

  const NavList = ({ onPick }: { onPick?: () => void }) => (
    <nav className="flex-1 space-y-0.5">
      {navItems.map((item) => {
        const active = view === item.key;
        const Icon = item.icon;
        const badgeCount =
          item.key === 'alerts' ? alertCount : item.key === 'inbox' ? inboxUnread : 0;
        const badgeTone =
          item.key === 'inbox'
            ? 'bg-[#E0FE10]/15 text-[#E0FE10] border-[#E0FE10]/25'
            : 'bg-red-500/20 text-red-400 border-red-500/25';
        return (
          <button
            key={item.key}
            data-nav={item.key}
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
            {badgeCount > 0 && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold ${badgeTone}`}>
                {badgeCount}
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
        <img
          src="/pulseCheckIcon.png"
          alt="PulseCheck"
          className="w-7 h-7 rounded-lg flex-shrink-0"
        />
        <div className="leading-tight">
          <div className="text-sm font-bold text-white">PulseCheck</div>
          <div className="text-[8px] text-zinc-500 uppercase tracking-widest">Coaching Platform</div>
        </div>
      </div>

      {/* Coach identity — tap to edit profile */}
      <button
        type="button"
        onClick={() => {
          setProfileOpen(true);
          setMobileNavOpen(false);
        }}
        className="w-full flex items-center gap-2.5 px-2 py-3 rounded-xl bg-zinc-800/30 border border-zinc-700/20 mb-5 text-left transition-colors hover:bg-zinc-800/60 hover:border-zinc-600/40"
        aria-label="Edit your profile"
      >
        <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-[#E0FE10]/30 to-green-500/20 border border-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-[#E0FE10]">{initialsOf(profile.name)}</span>
          )}
        </div>
        <div className="leading-tight min-w-0 flex-1">
          <div className="text-xs font-semibold text-white truncate">{profile.name}</div>
          <div className="text-[9px] text-zinc-500 truncate">{profile.title || 'Head Coach'}</div>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
      </button>

      <NavList onPick={() => setMobileNavOpen(false)} />

      <div className="mt-auto pt-3 border-t border-zinc-800/60">
        <button
          onClick={async () => {
            try {
              await signOut(auth);
            } catch (err) {
              console.error('[CoachDashboard] sign out failed', err);
            }
            router.replace('/coach/login');
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-zinc-400 transition-colors hover:bg-zinc-800/40 hover:text-zinc-200"
        >
          <LogOut className="w-4 h-4" />
          <span>Log out</span>
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
                    <HomeSection
                      athletes={athletes}
                      loading={loadingAthletes}
                      isDemo={isDemo}
                      onSelectAthlete={setSelectedAthleteId}
                    />
                  )}
                  {view === 'alerts' && (
                    <AlertsSection alerts={alerts} loading={loadingAthletes} canSeeTier3={canSeeTier3} />
                  )}
                  {view === 'inbox' && <InboxSection athletes={athletes} loading={loadingAthletes} isDemo={isDemo} />}
                  {view === 'roster' && (
                    <div className="space-y-5">
                      <AthleteInviteSection
                        isDemo={isDemo}
                        coachId={coachId}
                        coachName={coachName}
                        coachEmail={coachEmail}
                        canInvite={can('admin') || can('coaching') || can('administrative')}
                        canRevoke={can('admin')}
                      />
                      <RosterSection
                        athletes={athletes}
                        loading={loadingAthletes}
                        onSelectAthlete={setSelectedAthleteId}
                      />
                    </div>
                  )}
                  {view === 'staff' && (
                    <StaffSection
                      isDemo={isDemo}
                      coachName={coachName}
                      coachId={coachId}
                      coachEmail={coachEmail}
                      canInvite={can('admin')}
                    />
                  )}
                  {view === 'nora' && (
                    <TrainNoraSection coachId={coachId} coachName={coachName} athletes={athletes} />
                  )}
                  {view === 'schedule' && <ScheduleSection coachId={coachId} isDemo={isDemo} />}
                  {view === 'reports' && <ReportsSection coachId={coachId} isDemo={isDemo} />}
                  {view === 'earnings' && earningsEnabled && (
                    <EarningsSection athletes={athletes} isDemo={isDemo} revenueSharePct={revenueSharePct} />
                  )}
                  {view === 'settings' && <SettingsSection coachName={coachName} email={coachEmail} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        <AthleteProfileDrawer
          athlete={selectedAthlete}
          alerts={alerts}
          canSeeTier3={canSeeTier3}
          onClose={() => setSelectedAthleteId(null)}
        />

        <CoachProfileEditModal
          isOpen={profileOpen}
          onClose={() => setProfileOpen(false)}
          isDemo={isDemo}
          initial={profile}
          onSave={handleSaveProfile}
        />

        <NoraChatFab coachId={coachId} coachName={coachName} athletes={athletes} />
      </div>
  );
};

const COACH_TRAINING_STATUS_KEY = 'pulsecheck_coach_guided_training_status';

const CoachDashboard: React.FC = () => {
  const currentUser = useUser();
  const dispatch = useDispatch();
  const router = useRouter();
  // Training mode runs the guided walkthrough over demo data on the real
  // dashboard. `null` = undetermined (don't load anything yet); resolves to
  // true on first visit / ?training=1, false once completed.
  const [trainingMode, setTrainingMode] = useState<boolean | null>(null);
  const mockReady = useDemoDashboardMocks(trainingMode === true);
  const [athletes, setAthletes] = useState<CoachAthlete[]>([]);
  const [alerts, setAlerts] = useState<AthleteAlert[]>([]);
  const [loadingAthletes, setLoadingAthletes] = useState(true);
  const [earnings, setEarnings] = useState<{ enabled: boolean; sharePct: number }>({
    enabled: false,
    sharePct: 0,
  });
  // The signed-in coach's own staff capabilities for their active team. Drives
  // feature gating (Reports/insights, Tier-3 detail, Schedule/Train Nora). Starts
  // as all-three so the first paint isn't briefly locked, then narrows once the
  // membership resolves. Falls back to a full set if capabilities can't be read,
  // so we never lock an existing coach out of their own dashboard.
  const [viewerCapabilities, setViewerCapabilities] = useState<StaffPermission[]>([
    'admin',
    'administrative',
    'coaching',
    'athletic_trainer',
  ]);

  // Decide whether to run the guided training: forced via ?training=1 / ?tour=1,
  // or automatically on a coach's first visit (no stored completion).
  useEffect(() => {
    if (!router.isReady || typeof window === 'undefined') return;
    const forced = router.query.training === '1' || router.query.tour === '1';
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(COACH_TRAINING_STATUS_KEY);
    } catch {
      stored = null;
    }
    setTrainingMode(forced || !stored);
  }, [router.isReady, router.query.training, router.query.tour]);

  // Finish/dismiss the walkthrough: persist completion, then flip to real data.
  // Turning trainingMode off tears down the demo mocks (hook cleanup restores the
  // real services) and unblocks the real-data loaders below.
  const finishTraining = useCallback(() => {
    try {
      window.localStorage.setItem(COACH_TRAINING_STATUS_KEY, 'completed');
    } catch {}
    if (currentUser?.id) {
      try {
        void userService
          .updateUser(currentUser.id, {
            coachGuidedTraining: { status: 'completed', completedAt: new Date() },
          } as any)
          .catch(() => {});
      } catch {}
    }
    setTrainingMode(false);
  }, [currentUser?.id]);

  useEffect(() => {
    if (trainingMode !== false) return; // hold real data until training resolves/finishes
    let cancelled = false;
    const load = async () => {
      if (!currentUser?.id) return;
      setLoadingAthletes(true);
      try {
        const list = (await coachService.getConnectedAthletes(currentUser.id)) as CoachAthlete[];
        // Real-data enrichment: active escalation tier + device wear. Both are
        // single batch queries; best-effort so a failure never blocks the board.
        let enriched = list;
        try {
          const [escalations, deviceResult] = await Promise.all([
            escalationRecordsService.getActiveForCoach(currentUser.id).catch(() => []),
            loadAthleteDeviceStatuses(list.map((athlete) => athlete.id)).catch(() => null),
          ]);
          const tierByAthlete = new Map<string, number>();
          for (const r of escalations) {
            const prev = tierByAthlete.get(r.userId) ?? 0;
            if ((r.tier ?? 0) > prev) tierByAthlete.set(r.userId, r.tier ?? 0);
          }
          const deviceByAthlete = new Map<string, AthleteDeviceStatus>();
          for (const s of deviceResult?.statuses || []) {
            deviceByAthlete.set(s.athleteUserId, s);
          }
          enriched = list.map((a) => ({
            ...a,
            activeEscalationTier: tierByAthlete.get(a.id) ?? 0,
            deviceCoveragePct: deviceByAthlete.get(a.id)?.wearCoveragePct,
            deviceConnected: deviceByAthlete.has(a.id)
              ? deviceByAthlete.get(a.id)?.connectionStatus !== 'not_connected'
              : false,
            deviceDailyPresence: deviceByAthlete.get(a.id)?.dailyPresence,
            deviceStatus: deviceByAthlete.get(a.id),
          }));
          // Tier 2/3 alerts for the Athlete Alerts tab. The service query already
          // filters to records where coachId === this coach, so every Tier 2 here
          // reflects the athlete's explicit consent to notify this coach.
          const nameByAthlete = new Map(list.map((a) => [a.id, a.displayName]));
          const coachDisplay = currentUser?.displayName || currentUser?.username || 'you';
          const builtAlerts = alertsFromEscalationRecords(escalations as any, nameByAthlete, coachDisplay);
          if (!cancelled) setAlerts(builtAlerts);
        } catch (enrichErr) {
          console.warn('[CoachDashboard] athlete enrichment failed (non-blocking)', enrichErr);
        }
        if (!cancelled) setAthletes(enriched);
      } catch (err) {
        console.error('[CoachDashboard] failed to load athletes', err);
        if (!cancelled) setAthletes([]);
      } finally {
        if (!cancelled) setLoadingAthletes(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, trainingMode]);

  // Earnings tab is visible only when one of this coach's teams has referral
  // kickback enabled AND this coach is the configured revenue recipient.
  useEffect(() => {
    if (trainingMode !== false) return;
    let cancelled = false;
    const loadEarnings = async () => {
      if (!currentUser?.id) return;
      try {
        const memberships = await pulseCheckProvisioningService.listUserTeamMemberships(currentUser.id);
        for (const membership of memberships) {
          if (membership.role === 'athlete') continue;
          const team = await pulseCheckProvisioningService.getTeam(membership.teamId);
          const cfg = team?.commercialConfig;
          if (cfg?.referralKickbackEnabled && cfg.revenueRecipientUserId === currentUser.id) {
            if (!cancelled) setEarnings({ enabled: true, sharePct: cfg.referralRevenueSharePct || 0 });
            return;
          }
        }
        if (!cancelled) setEarnings({ enabled: false, sharePct: 0 });
      } catch (err) {
        console.error('[CoachDashboard] failed to resolve earnings eligibility', err);
        if (!cancelled) setEarnings({ enabled: false, sharePct: 0 });
      }
    };
    loadEarnings();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, trainingMode]);

  // Resolve the coach's own capabilities from their team membership. Prefer the
  // persisted staffCapabilities; fall back to the legacy role mapping; if nothing
  // resolves, keep the permissive default so existing coaches aren't locked out.
  useEffect(() => {
    if (trainingMode !== false) return;
    let cancelled = false;
    const loadCapabilities = async () => {
      if (!currentUser?.id) return;
      try {
        const memberships = await pulseCheckProvisioningService.listUserTeamMemberships(currentUser.id);
        const own = memberships.find((m) => m.role !== 'athlete');
        if (!own) return; // no staff membership → keep permissive default
        const resolved = own.staffCapabilities?.length
          ? normalizeStaffCapabilities(own.staffCapabilities)
          : capabilitiesFromLegacyRole(own.role);
        // The team-admin role is the org-admin / founder seat — always full access,
        // even on legacy memberships stamped before the admin/manager split (where
        // staffCapabilities may only contain 'administrative').
        const caps =
          own.role === 'team-admin' && !resolved.includes('admin')
            ? (['admin', ...resolved] as StaffPermission[])
            : resolved;
        if (!cancelled && caps.length) setViewerCapabilities(caps);
      } catch (err) {
        console.error('[CoachDashboard] failed to resolve viewer capabilities', err);
      }
    };
    loadCapabilities();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, trainingMode]);

  const coachName = currentUser?.displayName || currentUser?.username || 'Coach';

  // Persist coach profile edits to the user doc and refresh Redux so the change
  // shows everywhere (sidebar tile, etc.) without a reload.
  const handleSaveProfile = useCallback(
    async (next: { name: string; email: string; title: string; bio: string; avatarUrl: string }) => {
      if (!currentUser?.id) return;
      try {
        await userService.updateUser(currentUser.id, {
          displayName: next.name,
          email: next.email,
          coachTitle: next.title,
          bio: next.bio,
          profileImage: {
            ...(currentUser.profileImage?.toDictionary?.() || {}),
            profileImageURL: next.avatarUrl || '',
          },
          updatedAt: new Date(),
        });
        // Keep the Redux currentUser in sync.
        const dict = currentUser.toDictionary();
        dispatch(
          setUser({
            ...dict,
            displayName: next.name,
            email: next.email,
            coachTitle: next.title,
            bio: next.bio,
            profileImage: { ...(dict.profileImage || {}), profileImageURL: next.avatarUrl || '' },
          })
        );
        dispatch(showToast({ message: 'Profile updated', type: 'success' }));
      } catch (err) {
        console.error('[CoachDashboard] failed to save coach profile', err);
        dispatch(showToast({ message: 'Could not save your profile. Please try again.', type: 'error' }));
        throw err;
      }
    },
    [currentUser, dispatch]
  );

  return (
    <CoachProtectedRoute requiresActiveSubscription={false}>
      <Head>
        <title>Coach Dashboard | PulseCheck</title>
      </Head>
      {trainingMode === null ? (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#E0FE10]" />
        </div>
      ) : trainingMode ? (
        // Training mode: walk the coach through the dashboard on demo data, with
        // their real name. Finishing swaps to real data (see finishTraining).
        <>
          <div className="bg-[#150f2b] border-b border-purple-500/30 text-purple-200 text-xs px-4 py-1.5 text-center">
            Training walkthrough — sample data. Finish to load your team.
          </div>
          {mockReady && (
            <CoachDashboardShell
              athletes={DEMO_ATHLETES as any}
              alerts={DEMO_ALERTS}
              loadingAthletes={false}
              coachName={coachName}
              coachEmail={currentUser?.email}
              coachId={DEMO_COACH_ID}
              coachTitle={currentUser?.coachTitle}
              coachBio={currentUser?.bio}
              coachAvatarUrl={currentUser?.profileImage?.profileImageURL}
              onSaveProfile={handleSaveProfile}
              isDemo
              earningsEnabled
              revenueSharePct={20}
            />
          )}
          {mockReady && <NoraDashboardTraining onComplete={finishTraining} />}
        </>
      ) : (
        <CoachDashboardShell
          athletes={athletes}
          alerts={alerts}
          loadingAthletes={loadingAthletes}
          coachName={coachName}
          coachEmail={currentUser?.email}
          coachId={currentUser?.id}
          coachTitle={currentUser?.coachTitle}
          coachBio={currentUser?.bio}
          coachAvatarUrl={currentUser?.profileImage?.profileImageURL}
          onSaveProfile={handleSaveProfile}
          earningsEnabled={earnings.enabled}
          revenueSharePct={earnings.sharePct}
          viewerCapabilities={viewerCapabilities}
        />
      )}
    </CoachProtectedRoute>
  );
};

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

const HomeSection: React.FC<{
  athletes: CoachAthlete[];
  loading: boolean;
  isDemo?: boolean;
  onSelectAthlete: (id: string) => void;
}> = ({ athletes, loading, isDemo, onSelectAthlete }) => {
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

  const adherence = useMemo(() => {
    const total = athletes.length || 1;
    const pct = (n: number) => Math.round((n / total) * 100);
    if (isDemo) {
      // Demo proxies so the walkthrough shows all three bars.
      const checkedIn = athletes.filter((a) => deriveStatus(a) !== 'pending').length;
      const deviceWorn = athletes.filter((a) => a.conversationCount > 0 || (a.weeklyGoalProgress ?? 0) > 0).length;
      const modulesDone = athletes.filter((a) => (a.totalSessions ?? 0) >= 10).length;
      return { checkIn: pct(checkedIn), device: pct(deviceWorn), modules: pct(modulesDone) as number | undefined };
    }
    // Live: real signals only. Check-in = checked in today; device = average wear
    // coverage. Module completion has no batch source yet, so it's omitted rather
    // than faked.
    const checkedInToday = athletes.filter((a) => daysSince(a.lastActiveDate) === 0).length;
    const withDevice = athletes.filter((a) => typeof a.deviceCoveragePct === 'number');
    const device = withDevice.length
      ? Math.round(withDevice.reduce((s, a) => s + (a.deviceCoveragePct || 0), 0) / withDevice.length)
      : 0;
    return { checkIn: pct(checkedInToday), device, modules: undefined as number | undefined };
  }, [athletes, isDemo]);

  return (
    <div className="space-y-6">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile id="tile-total" label="Total Athletes" value={athletes.length} accent />
        <StatTile id="tile-optimal" label="Optimal" value={counts.optimal} dot="bg-green-400" />
        <StatTile id="tile-attention" label="Needs Attention" value={counts.elevated + counts.escalated} dot="bg-orange-400" />
        <AdherenceTile
          id="tile-adherence"
          checkIn={adherence.checkIn}
          device={adherence.device}
          modules={adherence.modules}
          athletes={athletes}
        />
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
            // Click the card body to open the profile, but let the card's own
            // controls (acknowledge / check-in / mood-day hovers) keep working.
            <div
              key={a.id}
              data-athlete-card={a.id}
              role="button"
              tabIndex={0}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('button,a,input,textarea')) return;
                onSelectAthlete(a.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSelectAthlete(a.id);
              }}
              className="cursor-pointer rounded-3xl focus:outline-none focus:ring-1 focus:ring-[#E0FE10]/40"
            >
              <AthleteReadinessCard
                demo={isDemo}
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
                  activeEscalationTier: a.activeEscalationTier,
                  deviceCoveragePct: a.deviceCoveragePct,
                  deviceConnected: a.deviceConnected,
                  deviceDailyPresence: a.deviceDailyPresence,
                  deviceStatus: a.deviceStatus,
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Athlete Alerts
// ---------------------------------------------------------------------------

// The horizontal "what's being done" trail shown on every alert card.
const StepTrail: React.FC<{ steps: AlertStep[]; tone: 'amber' | 'rose' }> = ({ steps, tone }) => {
  const activeColor = tone === 'amber' ? '#F59E0B' : '#A78BFA';
  return (
    <div className="flex items-center">
      {steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        return (
          <React.Fragment key={s.label}>
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0" style={{ width: 78 }}>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{
                  background:
                    s.state === 'done'
                      ? 'rgba(34,197,94,0.16)'
                      : s.state === 'active'
                      ? `${activeColor}22`
                      : 'rgba(113,113,122,0.14)',
                  border:
                    s.state === 'done'
                      ? '1px solid rgba(34,197,94,0.4)'
                      : s.state === 'active'
                      ? `1px solid ${activeColor}66`
                      : '1px solid rgba(113,113,122,0.3)',
                }}
              >
                {s.state === 'done' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                ) : s.state === 'active' ? (
                  <span
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ background: activeColor }}
                  />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-zinc-600" />
                )}
              </div>
              <span
                className={`text-[9px] leading-tight text-center ${
                  s.state === 'pending' ? 'text-zinc-600' : 'text-zinc-400'
                }`}
              >
                {s.label}
              </span>
            </div>
            {!isLast && (
              <div
                className="h-px flex-1 -mt-4"
                style={{
                  background:
                    s.state === 'done'
                      ? 'rgba(34,197,94,0.35)'
                      : 'rgba(113,113,122,0.25)',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const NoraActionRow: React.FC<{ action: AlertNoraAction }> = ({ action }) => {
  const meta =
    action.status === 'completed'
      ? { chip: 'bg-green-500/15 text-green-400 border-green-500/25', label: 'Completed' }
      : action.status === 'active'
      ? { chip: 'bg-[#A78BFA]/15 text-[#A78BFA] border-[#A78BFA]/25', label: 'Active' }
      : { chip: 'bg-zinc-700/40 text-zinc-500 border-zinc-600/30', label: 'Queued' };
  return (
    <div className="flex items-start gap-3 p-2.5 rounded-lg bg-zinc-800/40 border border-zinc-700/30">
      <Sparkle />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-white">{action.label}</div>
        <div className="text-[11px] text-zinc-500 leading-relaxed mt-0.5">{action.detail}</div>
      </div>
      <span className={`text-[9px] px-2 py-0.5 rounded-full border flex-shrink-0 ${meta.chip}`}>
        {meta.label}
      </span>
    </div>
  );
};

const Sparkle: React.FC = () => (
  <div className="w-7 h-7 rounded-lg bg-[#A78BFA]/12 border border-[#A78BFA]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
    <Brain className="w-3.5 h-3.5 text-[#A78BFA]" />
  </div>
);

// ── Tier 2 — consent-based. Lives in the horizontal-scroll lane. ──
const Tier2AlertCard: React.FC<{ alert: AthleteAlert }> = ({ alert }) => {
  const [expanded, setExpanded] = useState(false);
  const first = firstNameOf(alert.athleteName);
  const steps = buildAlertSteps(alert);
  return (
    <div
      className="snap-start flex-shrink-0 w-[340px] rounded-2xl p-5 flex flex-col"
      style={{
        background: 'linear-gradient(135deg, rgba(249,115,22,0.08) 0%, rgba(245,158,11,0.05) 100%)',
        border: '1px solid rgba(249,115,22,0.28)',
      }}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-white truncate">{alert.athleteName}</div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 font-semibold">
              {alert.category}
            </span>
            <span className="text-[10px] text-zinc-500">· {relativeWhen(alert.flaggedAt)}</span>
          </div>
        </div>
      </div>

      {/* Consent — why this alert reached this coach */}
      <div className="flex items-center gap-2 rounded-lg bg-orange-500/8 border border-orange-500/20 px-3 py-2 mb-3">
        <BellRing className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
        <span className="text-[11px] text-zinc-300 leading-snug">
          <span className="text-orange-300 font-medium">{first} chose to notify you</span> about this.
        </span>
      </div>

      <p className="text-sm text-zinc-300 leading-relaxed mb-4">{alert.summary}</p>

      <div className="mb-4">
        <StepTrail steps={steps} tone="amber" />
      </div>

      {/* Expandable: what Nora has already done */}
      {alert.noraActions.length > 0 && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center justify-between w-full text-left mb-2"
          >
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">
              What Nora has done ({alert.noraActions.length})
            </span>
            <ChevronRight
              className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          </button>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-1.5 mb-3">
                  {alert.noraActions.map((n) => (
                    <NoraActionRow key={n.label} action={n} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Recommendation + action */}
      <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/30 p-3 mb-3 mt-auto">
        <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1">
          Recommended next step
        </div>
        <p className="text-xs text-zinc-300 leading-relaxed">{alert.recommendation}</p>
      </div>
      <button className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-[#E0FE10] text-black text-sm font-semibold hover:brightness-95 transition">
        <MessageSquare className="w-4 h-4" /> Message {first}
      </button>
    </div>
  );
};

// ── Tier 3 — clinical monitoring/awareness. Vertical stack. ──
const Tier3MonitorCard: React.FC<{ alert: AthleteAlert }> = ({ alert }) => {
  const [expanded, setExpanded] = useState(false);
  const first = firstNameOf(alert.athleteName);
  const steps = buildAlertSteps(alert);
  const handoffLabel = alert.handoffStatus ? HANDOFF_LABEL[alert.handoffStatus] : 'Handoff initiated';
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'linear-gradient(135deg, rgba(167,139,250,0.08) 0%, rgba(99,102,241,0.05) 100%)',
        border: '1px solid rgba(167,139,250,0.28)',
      }}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-[#A78BFA]/20 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-5 h-5 text-[#A78BFA]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-white">{alert.athleteName}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#A78BFA]/20 text-[#A78BFA] border border-[#A78BFA]/30 font-semibold">
              In clinical care
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] text-zinc-500">{alert.category}</span>
            <span className="text-[10px] text-zinc-600">· flagged {relativeWhen(alert.flaggedAt)}</span>
          </div>
        </div>
        <span className="text-[9px] px-2 py-1 rounded-full bg-green-500/12 text-green-400 border border-green-500/25 font-semibold flex items-center gap-1 flex-shrink-0">
          <HeartPulse className="w-3 h-3" /> {handoffLabel}
        </span>
      </div>

      <p className="text-sm text-zinc-300 leading-relaxed mb-4">{alert.summary}</p>

      <div className="mb-4">
        <StepTrail steps={steps} tone="rose" />
      </div>

      {alert.noraActions.length > 0 && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center justify-between w-full text-left mb-2"
          >
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">
              Care steps taken ({alert.noraActions.length})
            </span>
            <ChevronRight
              className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          </button>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-1.5 mb-3">
                  {alert.noraActions.map((n) => (
                    <NoraActionRow key={n.label} action={n} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Guardrail — this is awareness, not a coaching task */}
      <div className="rounded-xl bg-[#A78BFA]/8 border border-[#A78BFA]/25 p-3 flex items-start gap-2.5">
        <Shield className="w-4 h-4 text-[#A78BFA] flex-shrink-0 mt-0.5" />
        <div>
          <div className="text-[10px] font-semibold text-[#A78BFA] uppercase tracking-wide mb-1">
            Your role right now
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">{alert.recommendation}</p>
        </div>
      </div>
    </div>
  );
};

const AlertsSection: React.FC<{ alerts: AthleteAlert[]; loading: boolean; canSeeTier3?: boolean }> = ({
  alerts,
  loading,
  canSeeTier3 = true,
}) => {
  const tier2 = useMemo(
    () =>
      alerts
        .filter((a) => a.tier === 2)
        .sort((x, y) => (y.flaggedAt?.getTime() ?? 0) - (x.flaggedAt?.getTime() ?? 0)),
    [alerts]
  );
  const tier3 = useMemo(
    () =>
      // Tier 3 detail is the athletic_trainer "medical peek" — hide it entirely
      // for staff without that capability.
      canSeeTier3
        ? alerts
            .filter((a) => a.tier === 3)
            .sort((x, y) => (y.flaggedAt?.getTime() ?? 0) - (x.flaggedAt?.getTime() ?? 0))
        : [],
    [alerts, canSeeTier3]
  );

  if (loading) return <LoadingBlock label="Scanning athlete check-ins…" />;

  // Count only what this viewer can actually see (Tier 3 may be gated off).
  const visibleCount = tier2.length + tier3.length;

  if (visibleCount === 0) {
    return (
      <EmptyBlock
        icon={Flame}
        title="All clear"
        body="No active alerts. Nora surfaces an athlete here only when they ask you to be notified, or when a situation has moved into clinical care."
      />
    );
  }

  return (
    <div className="space-y-8">
      <style jsx>{`
        .alerts-scroll::-webkit-scrollbar {
          height: 6px;
        }
        .alerts-scroll::-webkit-scrollbar-thumb {
          background: rgba(113, 113, 122, 0.35);
          border-radius: 9999px;
        }
        .alerts-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
          Athlete Alerts
        </div>
        <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 font-bold">
          {visibleCount} ACTIVE
        </span>
      </div>

      {/* ── Tier 2 — athletes who asked you to know (consent-based) ── */}
      {tier2.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BellRing className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-semibold text-white">They asked you to know</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/25 font-bold">
              {tier2.length}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mb-3 max-w-2xl">
            Nora detected an elevated-concern moment and these athletes explicitly chose to loop you
            in. A direct, supportive check-in goes a long way.
          </p>
          <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1 snap-x snap-mandatory alerts-scroll">
            {tier2.map((a) => (
              <Tier2AlertCard key={a.id} alert={a} />
            ))}
          </div>
        </div>
      )}

      {/* ── Tier 3 — being handled by clinical care (monitoring) ── */}
      {tier3.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-[#A78BFA]" />
            <h3 className="text-sm font-semibold text-white">Being handled by clinical care</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#A78BFA]/15 text-[#A78BFA] border border-[#A78BFA]/25 font-bold">
              {tier3.length}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mb-3 max-w-2xl">
            Nora, PulseCheck, and AuntEdna have already stepped in for these athletes. This is for
            your awareness — no coaching action needed, just care and discretion.
          </p>
          <div className="space-y-3">
            {tier3.map((a) => (
              <Tier3MonitorCard key={a.id} alert={a} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Inbox — athlete ↔ coach messages
// ---------------------------------------------------------------------------

const InboxSection: React.FC<{ athletes: CoachAthlete[]; loading: boolean; isDemo?: boolean }> = ({
  athletes,
  loading,
  isDemo,
}) => {
  const threads = useMemo(() => (isDemo ? buildInboxThreads(athletes) : []), [athletes, isDemo]);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());

  if (loading) return <LoadingBlock label="Loading your inbox…" />;

  if (threads.length === 0) {
    return (
      <EmptyBlock
        icon={Inbox}
        title="No messages yet"
        body="When athletes message you from the app, their conversations land here — so you can reply and pick up where Nora left off."
      />
    );
  }

  const unreadCount = threads.filter((t) => t.unread && !readIds.has(t.id)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Inbox</div>
        {unreadCount > 0 && (
          <span className="text-[10px] px-2 py-1 rounded-full bg-[#E0FE10]/15 text-[#E0FE10] border border-[#E0FE10]/25 font-bold">
            {unreadCount} UNREAD
          </span>
        )}
      </div>

      <div className="space-y-2">
        {threads.map((t) => {
          const meta = STATUS_META[t.status];
          const unread = t.unread && !readIds.has(t.id);
          const stale = daysSince(t.ts);
          return (
            <button
              key={t.id}
              onClick={() => setReadIds((prev) => new Set(prev).add(t.id))}
              className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${
                unread
                  ? 'bg-zinc-800/60 border-[#E0FE10]/20 hover:bg-zinc-800/80'
                  : 'bg-zinc-800/30 border-zinc-700/30 hover:bg-zinc-800/50'
              }`}
            >
              <div className="relative w-10 h-10 rounded-full bg-zinc-700/40 border border-zinc-600/30 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-zinc-200">{t.initials}</span>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-900 ${meta.dot}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm truncate ${unread ? 'font-bold text-white' : 'font-medium text-zinc-200'}`}>
                    {t.name}
                  </span>
                  {unread && <span className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] flex-shrink-0" />}
                  <span className="ml-auto text-[10px] text-zinc-500 flex-shrink-0">
                    {stale === null ? '' : stale === 0 ? 'Today' : `${stale}d`}
                  </span>
                </div>
                <div className={`text-xs mt-0.5 truncate ${unread ? 'text-zinc-300' : 'text-zinc-500'}`}>
                  {t.lastMessage}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

// What a staffer is allowed to touch. Multi-select — a person can hold several.
//  • admin           → full access: invite staff, assign permissions, every tab
//  • administrative  → "Manager": update the schedule, train Nora (no athlete data)
//  • coaching        → athlete insights, reports, coaching curriculum
//  • athletic_trainer→ the medical peek: Tier 3 escalation detail
// STAFF_PERMISSIONS is the shared single source (src/lib/staffPermissions) used by
// the dashboard invite modal, the coach-onboarding staff step, and admin provisioning.

const PERMISSION_META: Record<StaffPermission, { label: string; icon: React.ElementType }> =
  Object.fromEntries(STAFF_PERMISSIONS.map((p) => [p.key, { label: p.label, icon: p.icon }])) as Record<
    StaffPermission,
    { label: string; icon: React.ElementType }
  >;

// Best-fit role label from the granted permissions (purely cosmetic).
const deriveStaffRole = (perms: StaffPermission[]): string => {
  const has = (p: StaffPermission) => perms.includes(p);
  if (has('admin')) return 'Admin';
  if (has('coaching') && has('athletic_trainer')) return 'Coach / Trainer';
  if (has('athletic_trainer')) return 'Athletic Trainer';
  if (has('coaching')) return 'Coach';
  if (has('administrative')) return 'Manager';
  return 'Staff';
};

type StaffRow = {
  id: string;
  name: string;
  role: string;
  email: string;
  status: 'active' | 'invited';
  permissions: StaffPermission[];
  avatarUrl?: string;
  title?: string; // explicit title (invited rows: the invite's invitedTitle)
  joinedAt?: string; // ISO date the staffer was onboarded (active members)
};

const DEMO_STAFF: StaffRow[] = [
  { id: 's1', name: 'Coach Mayo', role: 'Admin', email: 'coach.mayo@fitwithpulse.ai', status: 'active', joinedAt: '2024-08-15', permissions: ['admin'] },
  { id: 's2', name: 'Dana Reyes', role: 'Assistant Coach', email: 'dana.reyes@example.com', status: 'active', joinedAt: '2025-01-10', permissions: ['coaching'] },
  { id: 's3', name: 'Priya Nair', role: 'Athletic Trainer', email: 'priya.nair@example.com', status: 'active', joinedAt: '2025-09-03', permissions: ['coaching', 'athletic_trainer'] },
  { id: 's4', name: 'Marcus Hill', role: 'Manager', email: 'marcus.hill@example.com', status: 'invited', permissions: ['administrative'] },
];

// Human-readable tenure since onboarding, e.g. "1 yr 9 mo" / "3 mo".
const formatTenure = (joinedAt?: string): string | null => {
  if (!joinedAt) return null;
  const start = new Date(joinedAt);
  if (isNaN(start.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 1) return 'New this month';
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} yr`);
  if (rem > 0) parts.push(`${rem} mo`);
  return parts.join(' ');
};

const formatJoined = (joinedAt?: string): string | null => {
  if (!joinedAt) return null;
  const d = new Date(joinedAt);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

// Best-effort ISO from a Firestore Timestamp / Date / {seconds} shape.
const timestampToIso = (value: unknown): string | undefined => {
  if (!value) return undefined;
  const candidate = value as { toDate?: () => Date; seconds?: number };
  if (typeof candidate.toDate === 'function') return candidate.toDate().toISOString();
  if (typeof candidate.seconds === 'number') return new Date(candidate.seconds * 1000).toISOString();
  if (value instanceof Date) return value.toISOString();
  return undefined;
};

// Display fallback for legacy members/invites that predate staffCapabilities —
// reverse of the derive table so existing rows still show sensible chips.
const capabilitiesFromLegacyRole = (role?: string): StaffPermission[] => {
  switch (role) {
    case 'coach':
      return ['coaching'];
    case 'performance-staff':
    case 'clinician':
      return ['athletic_trainer'];
    case 'support-staff':
      return ['administrative'];
    // team-admin is the org admin (the founder / full-access seat) — map to the new
    // superuser cap so existing admins keep staff management after the split.
    case 'team-admin':
      return ['admin'];
    default:
      return [];
  }
};

// Active rows prefer the member's own user doc (real name + profile photo);
// the membership doc only carries email + title, so without the lookup the
// card falls back to the title ("Head Coach") and an initials placeholder.
const staffRowFromMembership = (m: PulseCheckTeamMembership, user?: UserModel | null): StaffRow => {
  const caps = m.staffCapabilities?.length ? m.staffCapabilities : capabilitiesFromLegacyRole(m.role);
  const displayName = (user?.displayName || user?.username || '').trim();
  const name = displayName || (m.title || '').trim() || (m.email || '').split('@')[0] || 'Staff member';
  return {
    id: m.id,
    name,
    role: (m.title || '').trim() || deriveStaffRole(caps),
    email: m.email || '',
    status: 'active',
    permissions: caps,
    avatarUrl: user?.profileImage?.profileImageURL || undefined,
    title: (m.title || '').trim(),
    joinedAt: timestampToIso(m.grantedAt) || timestampToIso(m.createdAt),
  };
};

const staffRowFromInvite = (link: PulseCheckInviteLink): StaffRow => {
  const caps = link.staffCapabilities?.length ? link.staffCapabilities : capabilitiesFromLegacyRole(link.teamMembershipRole);
  const name = (link.recipientName || '').trim() || (link.targetEmail || '').split('@')[0] || 'Invited member';
  return {
    id: link.id,
    name,
    role: (link.invitedTitle || '').trim() || deriveStaffRole(caps),
    email: link.targetEmail || '',
    status: 'invited',
    permissions: caps,
    avatarUrl: (link.prefilledProfileImageUrl || '').trim() || undefined,
    title: (link.invitedTitle || '').trim(),
  };
};

const DEMO_INVITE_LINK = 'https://fitwithpulse.ai/coach/join/team-demo';

const StaffSection: React.FC<{
  isDemo?: boolean;
  coachName: string;
  coachId?: string;
  coachEmail?: string;
  // Inviting/assigning staff is admin-only. Non-admins can view the roster but
  // never see the invite controls.
  canInvite?: boolean;
}> = ({ isDemo, coachName, coachId, coachEmail, canInvite = true }) => {
  const [staff, setStaff] = useState<StaffRow[]>(isDemo ? DEMO_STAFF : []);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [perms, setPerms] = useState<StaffPermission[]>(['coaching']);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState(DEMO_INVITE_LINK);
  const [busy, setBusy] = useState(false);
  // Per-member permission editing (admin-only). Holds the row being edited.
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [editPerms, setEditPerms] = useState<StaffPermission[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  // Pending-invite profile editing (admin-only). Lets the coach preload name,
  // title, and photo on the invite before the member accepts.
  const [editingInvite, setEditingInvite] = useState<StaffRow | null>(null);
  const [invName, setInvName] = useState('');
  const [invTitle, setInvTitle] = useState('');
  const [invPhotoFile, setInvPhotoFile] = useState<File | null>(null);
  const [invPhotoPreview, setInvPhotoPreview] = useState('');
  const [savingInvite, setSavingInvite] = useState(false);
  // Resolved active-team context for the signed-in coach (live mode only).
  const [team, setTeam] = useState<{
    organizationId: string;
    teamId: string;
    organizationName: string;
    teamName: string;
  } | null>(null);

  // Live load: resolve the coach's active team, then pull real members + pending
  // invites. Demo never touches Firestore.
  const loadStaff = useCallback(async () => {
    if (isDemo || !coachId) return;
    try {
      const memberships = await pulseCheckProvisioningService.listUserTeamMemberships(coachId);
      const own = memberships.find((m) => m.role !== 'athlete');
      if (!own) {
        setStaff([]);
        return;
      }
      const { teamId, organizationId } = own;
      let teamName = 'your team';
      let organizationName = 'your organization';
      try {
        const [t, org] = await Promise.all([
          pulseCheckProvisioningService.getTeam(teamId),
          pulseCheckProvisioningService.getOrganization(organizationId),
        ]);
        teamName = t?.displayName || teamName;
        organizationName = org?.displayName || organizationName;
      } catch {
        /* names are cosmetic; fall back to generic labels */
      }
      setTeam({ organizationId, teamId, organizationName, teamName });

      const [teamMembers, inviteLinks] = await Promise.all([
        pulseCheckProvisioningService.listTeamMemberships(teamId).catch(() => [] as PulseCheckTeamMembership[]),
        pulseCheckProvisioningService.listTeamInviteLinks(teamId).catch(() => [] as PulseCheckInviteLink[]),
      ]);

      const activeMemberships = teamMembers.filter((m) => m.role !== 'athlete');
      // Resolve member identities (display name + photo) from their user docs;
      // on failure fall back to membership-only display.
      let usersById = new Map<string, UserModel>();
      try {
        const memberIds = [...new Set(activeMemberships.map((m) => m.userId).filter(Boolean))];
        const users = await userService.getUsersByIds(memberIds);
        usersById = new Map(users.map((u) => [u.id, u]));
      } catch (err) {
        console.error('[CoachDashboard] failed to resolve staff user profiles', err);
      }
      const activeRows = activeMemberships.map((m) => staffRowFromMembership(m, usersById.get(m.userId) || null));
      const memberEmails = new Set(activeRows.map((r) => r.email.toLowerCase()).filter(Boolean));
      const seenInviteEmails = new Set<string>();
      const pendingRows = inviteLinks
        .filter((l) => l.inviteType === 'team-access' && (l.targetEmail || '').length > 0 && l.status === 'active')
        .map(staffRowFromInvite)
        .filter((r) => {
          const key = r.email.toLowerCase();
          if (!key || memberEmails.has(key) || seenInviteEmails.has(key)) return false;
          seenInviteEmails.add(key);
          return true;
        });

      setStaff([...pendingRows, ...activeRows]);
    } catch (err) {
      console.error('[CoachDashboard] failed to load staff', err);
    }
  }, [coachId, isDemo]);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  const openInvite = () => {
    setPerms(['coaching']);
    setEmail('');
    setName('');
    setTitle('');
    setPhotoFile(null);
    setPhotoPreview('');
    setCopied(false);
    setInviteOpen(true);
  };

  // Upload the optional pre-loaded staff photo (live only), returning its URL.
  const uploadStaffPhoto = async (): Promise<string> => {
    if (!photoFile) return '';
    try {
      const { firebaseStorageService, UploadImageType } = await import('../../api/firebase/storage/service');
      const upload = await firebaseStorageService.uploadImage(photoFile, UploadImageType.Profile, { updateUserProfile: false });
      return upload.downloadURL;
    } catch (err) {
      console.error('[CoachDashboard] staff photo upload failed', err);
      return '';
    }
  };

  const togglePerm = (k: StaffPermission) =>
    setPerms((prev) => (prev.includes(k) ? prev.filter((p) => p !== k) : [...prev, k]));

  // Open the per-member permission editor (admin-only, active members).
  const openEdit = (row: StaffRow) => {
    setEditing(row);
    setEditPerms(row.permissions.length ? [...row.permissions] : ['coaching']);
  };

  // Open the pending-invite profile editor (admin-only, invited members).
  const openEditInvite = (row: StaffRow) => {
    setEditingInvite(row);
    setInvName(row.name);
    setInvTitle(row.title || '');
    setInvPhotoFile(null);
    setInvPhotoPreview(row.avatarUrl || '');
  };

  const saveInviteEdit = async () => {
    if (!editingInvite) return;
    const n = invName.trim();
    if (!n) {
      setToast("Add the staff member's name first.");
      return;
    }

    // Demo: update local state only.
    if (isDemo) {
      setStaff((prev) =>
        prev.map((s) =>
          s.id === editingInvite.id
            ? { ...s, name: n, title: invTitle.trim(), role: invTitle.trim() || s.role, avatarUrl: invPhotoPreview || undefined }
            : s
        )
      );
      setToast(`Updated ${n}'s invite.`);
      setEditingInvite(null);
      return;
    }

    setSavingInvite(true);
    try {
      let prefilledProfileImageUrl: string | undefined;
      if (invPhotoFile) {
        const { firebaseStorageService, UploadImageType } = await import('../../api/firebase/storage/service');
        const upload = await firebaseStorageService.uploadImage(invPhotoFile, UploadImageType.Profile, { updateUserProfile: false });
        prefilledProfileImageUrl = upload.downloadURL;
      }
      await pulseCheckProvisioningService.updateInviteLinkProfile({
        inviteId: editingInvite.id,
        recipientName: n,
        invitedTitle: invTitle.trim(),
        ...(prefilledProfileImageUrl ? { prefilledProfileImageUrl } : {}),
      });
      setToast(`Updated ${n}'s invite — it'll be pre-filled when they accept.`);
      setEditingInvite(null);
      await loadStaff();
    } catch (err) {
      console.error('[CoachDashboard] failed to update staff invite', err);
      setToast('Could not update the invite. Try again.');
    } finally {
      setSavingInvite(false);
    }
  };
  const toggleEditPerm = (k: StaffPermission) =>
    setEditPerms((prev) => (prev.includes(k) ? prev.filter((p) => p !== k) : [...prev, k]));

  const saveEdit = async () => {
    if (!editing || editPerms.length === 0) return;

    // Demo: update local state only.
    if (isDemo) {
      setStaff((prev) =>
        prev.map((s) =>
          s.id === editing.id ? { ...s, permissions: [...editPerms], role: deriveStaffRole(editPerms) } : s
        )
      );
      setToast(`Updated ${editing.name}'s permissions.`);
      setEditing(null);
      return;
    }

    setSavingEdit(true);
    try {
      const derived = deriveMembershipAccessFromCapabilities(editPerms);
      await pulseCheckProvisioningService.updateTeamMembershipAccess({
        teamMembershipId: editing.id,
        staffCapabilities: editPerms,
        rosterVisibilityScope: derived.rosterVisibilityScope,
      });
      setToast(`Updated ${editing.name}'s permissions.`);
      setEditing(null);
      await loadStaff();
    } catch (err) {
      console.error('[CoachDashboard] failed to update staff permissions', err);
      setToast('Could not update permissions. Try again.');
    } finally {
      setSavingEdit(false);
    }
  };

  const copyLink = async () => {
    // Demo: copy the static walkthrough link, no writes.
    if (isDemo) {
      try {
        navigator.clipboard?.writeText(inviteLink);
      } catch {}
      setCopied(true);
      setToast('Invite link copied — the permissions you set travel with it.');
      return;
    }
    if (!team || !coachId) {
      setToast('Still resolving your team — try again in a moment.');
      return;
    }
    setBusy(true);
    try {
      const derived = deriveMembershipAccessFromCapabilities(perms);
      // Reusable (general) link carrying the chosen capabilities — anyone who
      // redeems it joins with those permissions.
      await pulseCheckProvisioningService.createTeamAccessInviteLink({
        organizationId: team.organizationId,
        teamId: team.teamId,
        teamMembershipRole: derived.teamMembershipRole,
        staffCapabilities: perms,
        redemptionMode: 'general',
        createdByUserId: coachId,
        createdByEmail: coachEmail || '',
      });
      const links = await pulseCheckProvisioningService.listTeamInviteLinks(team.teamId);
      const link = links.find(
        (l) =>
          l.inviteType === 'team-access' &&
          !(l.targetEmail || '') &&
          l.status === 'active' &&
          l.teamMembershipRole === derived.teamMembershipRole
      );
      if (link?.activationUrl) {
        setInviteLink(link.activationUrl);
        try {
          navigator.clipboard?.writeText(link.activationUrl);
        } catch {}
        setCopied(true);
        setToast('Invite link copied — the permissions you set travel with it.');
      } else {
        setToast('Created the link but could not read it back. Refresh and try again.');
      }
    } catch (err) {
      console.error('[CoachDashboard] failed to create shareable staff link', err);
      setToast('Could not create the link. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const sendInvite = async () => {
    const e = email.trim();
    const n = name.trim();
    if (!n) {
      setToast("Add the staff member's name first.");
      return;
    }
    if (!e || perms.length === 0) return;

    // Demo: local-state only, no Firestore writes (walkthrough behavior unchanged).
    if (isDemo) {
      setStaff((prev) => [
        {
          id: `inv-${prev.length + 1}-${e}`,
          name: n,
          role: title.trim() || deriveStaffRole(perms),
          email: e,
          status: 'invited',
          permissions: [...perms],
          avatarUrl: photoPreview || undefined,
        },
        ...prev,
      ]);
      setToast(`Invite sent to ${n}.`);
      setInviteOpen(false);
      return;
    }

    if (!team || !coachId) {
      setToast('Still resolving your team — try again in a moment.');
      return;
    }
    setBusy(true);
    try {
      const derived = deriveMembershipAccessFromCapabilities(perms);
      const prefilledProfileImageUrl = await uploadStaffPhoto();
      await pulseCheckProvisioningService.createTeamAccessInviteLink({
        organizationId: team.organizationId,
        teamId: team.teamId,
        teamMembershipRole: derived.teamMembershipRole,
        staffCapabilities: perms,
        redemptionMode: 'single-use',
        targetEmail: e,
        recipientName: n,
        invitedTitle: title.trim(),
        prefilledProfileImageUrl,
        createdByUserId: coachId,
        createdByEmail: coachEmail || '',
      });

      // Resolve the just-created link to get its activation URL + token.
      const links = await pulseCheckProvisioningService.listTeamInviteLinks(team.teamId);
      const link = links.find(
        (l) =>
          l.inviteType === 'team-access' &&
          (l.targetEmail || '').toLowerCase() === e.toLowerCase() &&
          l.status === 'active'
      );

      let emailSent = false;
      if (link?.activationUrl) {
        try {
          const resp = await fetch('/.netlify/functions/send-pulsecheck-team-invite-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toEmail: e,
              activationUrl: link.activationUrl,
              recipientName: n,
              organizationName: team.organizationName,
              teamName: team.teamName,
              title: title.trim(),
              senderName: coachName,
            }),
          });
          const result = await resp.json().catch(() => ({ success: false }));
          emailSent = resp.ok && result?.success === true;
          // Record the send outcome on the invite link + an activity event.
          await pulseCheckProvisioningService.recordAdminActivationEmailResult({
            token: link.token,
            success: emailSent,
            messageId: result?.messageId,
            sentByUserId: coachId,
            sentByEmail: coachEmail || '',
            targetEmail: e,
            organizationId: team.organizationId,
            teamId: team.teamId,
            errorMessage: emailSent ? '' : String(result?.error || 'Send failed'),
          });
        } catch (mailErr) {
          console.error('[CoachDashboard] staff invite email failed', mailErr);
        }
      }

      setToast(
        emailSent
          ? `Invite sent to ${e}.`
          : `Invite created for ${e} — email didn't send, share the link instead.`
      );
      setInviteOpen(false);
      await loadStaff();
    } catch (err) {
      console.error('[CoachDashboard] failed to send staff invite', err);
      setToast('Could not send the invite. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
          Staff {staff.length > 0 && <span className="text-zinc-600">({staff.length})</span>}
        </div>
        {canInvite && (
          <div className="flex items-center gap-2">
            <button
              data-invite-copylink
              onClick={openInvite}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700/50 text-zinc-300 text-sm font-medium hover:bg-zinc-800/40"
            >
              <Link2 className="w-4 h-4" /> Copy link
            </button>
            <button
              data-invite-trigger
              onClick={openInvite}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#E0FE10] text-black text-sm font-semibold hover:brightness-95"
            >
              <Plus className="w-4 h-4" /> Invite member
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div className="text-xs text-[#E0FE10] bg-[#E0FE10]/10 border border-[#E0FE10]/25 rounded-lg px-3 py-2">
          {toast}
        </div>
      )}

      {/* Invite modal — set permissions before the invitation goes out */}
      <AnimatePresence>
        {inviteOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setInviteOpen(false)} />
            <motion.div
              data-invite-modal
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-700/50 bg-[#0d0d12] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
                <div>
                  <div className="text-base font-semibold text-white">Invite a staff member</div>
                  <div className="text-xs text-zinc-500">Choose what they can access, then send.</div>
                </div>
                <button
                  onClick={() => setInviteOpen(false)}
                  className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                {/* Who you're inviting — photo (optional) + name (required) + title (optional) */}
                <div className="flex items-center gap-3">
                  <label className="relative flex h-14 w-14 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-zinc-700/50 bg-zinc-800/40 hover:border-[#E0FE10]/40">
                    {photoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoPreview} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-zinc-500" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setPhotoFile(f);
                        setPhotoPreview(f ? URL.createObjectURL(f) : '');
                      }}
                    />
                  </label>
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Name (required)"
                      className="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#E0FE10]/40"
                    />
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Title (optional) — e.g. Associate Head Coach"
                      className="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#E0FE10]/40"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-zinc-600">
                  Photo &amp; title are optional and appear pre-filled when they join — they can change them. Name preloads their welcome email.
                </p>

                {/* Permissions */}
                <div data-invite-perms className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Permissions
                  </div>
                  {STAFF_PERMISSIONS.map((p) => {
                    const on = perms.includes(p.key);
                    const Icon = p.icon;
                    return (
                      <button
                        key={p.key}
                        data-perm={p.key}
                        onClick={() => togglePerm(p.key)}
                        className={`w-full flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                          on
                            ? 'border-[#E0FE10]/40 bg-[#E0FE10]/[0.06]'
                            : 'border-zinc-700/40 bg-zinc-800/30 hover:border-zinc-600/60'
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border ${
                            on ? 'border-[#E0FE10] bg-[#E0FE10] text-black' : 'border-zinc-600'
                          }`}
                        >
                          {on && <Check className="h-3.5 w-3.5" />}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-sm font-medium text-white">
                            <Icon className="h-3.5 w-3.5 text-[#E0FE10]/80" />
                            {p.label}
                          </span>
                          <span className="mt-0.5 block text-xs text-zinc-500">{p.blurb}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Email invite */}
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Invite by email
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') sendInvite();
                      }}
                      placeholder="staff@school.edu"
                      className="flex-1 bg-zinc-900/60 border border-zinc-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#E0FE10]/40"
                    />
                    <button
                      onClick={sendInvite}
                      disabled={!email.trim() || !name.trim() || perms.length === 0 || busy}
                      className="px-4 py-2 rounded-lg bg-[#E0FE10] text-black text-sm font-semibold hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {busy ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </div>

                {/* Copy link */}
                <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-700/40 bg-zinc-800/30 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-zinc-300">Or share a link</div>
                    <div className="truncate text-[11px] text-zinc-600">{inviteLink}</div>
                  </div>
                  <button
                    data-invite-copy
                    onClick={copyLink}
                    disabled={busy}
                    className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-zinc-700/50 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-[#E0FE10]" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied' : busy ? 'Creating…' : 'Copy link'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {editing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditing(null)} />
            <motion.div
              data-edit-perms-modal
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-700/50 bg-[#0d0d12] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
                <div>
                  <div className="text-base font-semibold text-white">Edit permissions</div>
                  <div className="text-xs text-zinc-500">{editing.name}{editing.role ? ` · ${editing.role}` : ''}</div>
                </div>
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Permissions
                  </div>
                  {STAFF_PERMISSIONS.map((p) => {
                    const on = editPerms.includes(p.key);
                    const Icon = p.icon;
                    return (
                      <button
                        key={p.key}
                        onClick={() => toggleEditPerm(p.key)}
                        className={`w-full flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                          on
                            ? 'border-[#E0FE10]/40 bg-[#E0FE10]/[0.06]'
                            : 'border-zinc-700/40 bg-zinc-800/30 hover:border-zinc-600/60'
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border ${
                            on ? 'border-[#E0FE10] bg-[#E0FE10] text-black' : 'border-zinc-600'
                          }`}
                        >
                          {on && <Check className="h-3.5 w-3.5" />}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-sm font-medium text-white">
                            <Icon className="h-3.5 w-3.5 text-[#E0FE10]/80" />
                            {p.label}
                          </span>
                          <span className="mt-0.5 block text-xs text-zinc-500">{p.blurb}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => setEditing(null)}
                    className="px-4 py-2 rounded-lg border border-zinc-700/50 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={editPerms.length === 0 || savingEdit}
                    className="px-4 py-2 rounded-lg bg-[#E0FE10] text-black text-sm font-semibold hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {savingEdit ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Pending-invite profile editor — preload photo/name/title before acceptance */}
        {editingInvite && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditingInvite(null)} />
            <motion.div
              data-edit-invite-modal
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-700/50 bg-[#0d0d12] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
                <div>
                  <div className="text-base font-semibold text-white">Edit invite profile</div>
                  <div className="text-xs text-zinc-500">{editingInvite.email || editingInvite.name}</div>
                </div>
                <button
                  onClick={() => setEditingInvite(null)}
                  className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                <div className="flex items-center gap-3">
                  <label className="relative flex h-14 w-14 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-zinc-700/50 bg-zinc-800/40 hover:border-[#E0FE10]/40">
                    {invPhotoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={invPhotoPreview} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-zinc-500" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setInvPhotoFile(f);
                        if (f) setInvPhotoPreview(URL.createObjectURL(f));
                      }}
                    />
                  </label>
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      value={invName}
                      onChange={(e) => setInvName(e.target.value)}
                      placeholder="Name (required)"
                      className="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#E0FE10]/40"
                    />
                    <input
                      value={invTitle}
                      onChange={(e) => setInvTitle(e.target.value)}
                      placeholder="Title (optional) — e.g. Associate Head Coach"
                      className="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#E0FE10]/40"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-zinc-600">
                  These pre-fill their profile when they accept the invite — they can change them later.
                </p>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => setEditingInvite(null)}
                    className="px-4 py-2 rounded-lg border border-zinc-700/50 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveInviteEdit}
                    disabled={!invName.trim() || savingInvite}
                    className="px-4 py-2 rounded-lg bg-[#E0FE10] text-black text-sm font-semibold hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {savingInvite ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {staff.length === 0 ? (
        <EmptyBlock
          icon={UserCog}
          title="No staff yet"
          body="Invite assistant coaches, trainers, and performance staff to help run the team. They'll get access based on the role you assign."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {staff.map((s) => {
            const tenure = formatTenure(s.joinedAt);
            const joined = formatJoined(s.joinedAt);
            return (
              <div
                key={s.id}
                data-staff-card
                className="relative flex flex-col p-4 rounded-2xl bg-zinc-800/40 border border-zinc-700/30 hover:border-zinc-600/50 transition-colors"
              >
                {/* Status badge — top right */}
                <span
                  className={`absolute top-3 right-3 text-[10px] px-2 py-1 rounded-full border font-semibold ${
                    s.status === 'active'
                      ? 'bg-green-500/15 text-green-400 border-green-500/25'
                      : 'bg-amber-500/15 text-amber-400 border-amber-500/25'
                  }`}
                >
                  {s.status === 'active' ? 'Active' : 'Invited'}
                </span>

                {/* Header: avatar + name + role */}
                <div className="flex items-center gap-3">
                  {s.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.avatarUrl}
                      alt={s.name}
                      className="w-14 h-14 rounded-full object-cover border border-[#E0FE10]/20 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#E0FE10]/25 to-green-500/15 border border-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-base font-bold text-[#E0FE10]">{initialsOf(s.name)}</span>
                    </div>
                  )}
                  <div className="min-w-0 pr-14">
                    <div className="text-base font-semibold text-white truncate">{s.name}</div>
                    <div className="text-xs font-medium text-[#E0FE10]/80 truncate">{s.role}</div>
                  </div>
                </div>

                {/* Details */}
                <div className="mt-4 space-y-2 border-t border-zinc-700/30 pt-3">
                  <div className="flex items-center gap-2 text-xs text-zinc-400 min-w-0">
                    <Mail className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                    <span className="truncate">{s.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <CalendarDays className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                    {s.status === 'active' && tenure ? (
                      <span>
                        {tenure} on platform
                        {joined && <span className="text-zinc-600"> · since {joined}</span>}
                      </span>
                    ) : (
                      <span className="text-zinc-500">Awaiting acceptance</span>
                    )}
                  </div>
                  {s.permissions.length > 0 && (
                    <div data-staff-perms className="flex flex-wrap gap-1.5 pt-0.5">
                      {s.permissions.map((p) => {
                        const meta = PERMISSION_META[p];
                        const Icon = meta.icon;
                        return (
                          <span
                            key={p}
                            className="inline-flex items-center gap-1 rounded-full border border-zinc-700/50 bg-zinc-900/50 px-2 py-0.5 text-[10px] font-medium text-zinc-300"
                          >
                            <Icon className="h-3 w-3 text-[#E0FE10]/70" />
                            {meta.label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {canInvite && s.status === 'active' && (
                    <button
                      onClick={() => openEdit(s)}
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[#E0FE10]/80 transition-colors hover:text-[#E0FE10]"
                    >
                      <Pencil className="h-3 w-3" /> Edit permissions
                    </button>
                  )}
                  {canInvite && s.status === 'invited' && (
                    <button
                      onClick={() => openEditInvite(s)}
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[#E0FE10]/80 transition-colors hover:text-[#E0FE10]"
                    >
                      <Pencil className="h-3 w-3" /> Edit profile
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Athlete Profile — slide-over drawer opened from the roster
// ---------------------------------------------------------------------------

const Sparkline: React.FC<{ values: number[]; color: string }> = ({ values, color }) => {
  if (values.length < 2) {
    return <div className="h-12 flex items-center text-[11px] text-zinc-600">Not enough data yet</div>;
  }
  const w = 280;
  const h = 48;
  const pad = 4;
  const min = -1;
  const max = 1;
  const pts = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
      const y = pad + (1 - (v - min) / (max - min)) * (h - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-12">
      <line x1={pad} x2={w - pad} y1={h / 2} y2={h / 2} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
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

const deviceConnectionLabel = (status?: AthleteDeviceStatus): string => {
  if (!status || status.connectionStatus === 'not_connected') return 'Not connected';
  if (status.wearDaysCovered === 0) return 'Connected, waiting for data';
  if (status.connectionStatus === 'stale') return 'Connected, stale';
  return 'Synced';
};

const deviceToneClass = (status?: AthleteDeviceStatus): string => {
  if (!status || status.connectionStatus === 'not_connected') return 'text-zinc-500';
  if (status.wearCoveragePct >= 70) return 'text-emerald-300';
  if (status.wearCoveragePct > 0) return 'text-amber-300';
  return 'text-zinc-300';
};

const DevicePresenceStrip: React.FC<{ presence?: boolean[]; compact?: boolean }> = ({ presence, compact }) => {
  const days = presence && presence.length > 0 ? presence : Array.from({ length: 14 }, () => false);
  return (
    <div className="flex items-center gap-1">
      {days.map((present, idx) => (
        <span
          key={idx}
          className={`${compact ? 'h-2' : 'h-3'} flex-1 rounded-[2px]`}
          style={{ background: present ? 'rgba(16,185,129,0.9)' : 'rgba(63,63,70,0.85)' }}
        />
      ))}
    </div>
  );
};

// Per-source variants of the tone/label helpers above, so each connected
// wearable on an athlete renders its own coverage + freshness + status chip.
const deviceSourceToneClass = (device: AthleteDevicePerSourceStatus): string => {
  if (device.connectionStatus === 'not_connected') return 'text-zinc-500';
  if (device.connectionStatus === 'stale') return 'text-amber-300';
  if (device.wearCoveragePct >= 70) return 'text-emerald-300';
  if (device.wearCoveragePct > 0) return 'text-emerald-300';
  return 'text-zinc-300';
};

const deviceSourceChipLabel = (device: AthleteDevicePerSourceStatus): string => {
  if (device.connectionStatus === 'synced') return 'Synced';
  if (device.connectionStatus === 'stale') {
    return device.wearCoveragePct === 0 ? 'Connected · waiting for data' : 'Stale · no recent data';
  }
  return 'Not connected';
};

const deviceSourceChipTone = (device: AthleteDevicePerSourceStatus): string => {
  if (device.connectionStatus === 'synced') return 'text-emerald-300';
  if (device.connectionStatus === 'stale') {
    return device.wearCoveragePct === 0 ? 'text-zinc-400' : 'text-amber-300';
  }
  return 'text-zinc-500';
};

const DeviceSourceCard: React.FC<{ device: AthleteDevicePerSourceStatus }> = ({ device }) => (
  <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-white truncate">{device.label}</div>
        <div className="text-[10px] text-zinc-500 mt-0.5">
          {device.wearDaysCovered}/{device.windowDays} days with wearable data
        </div>
        <span className={`mt-1 inline-block text-[10px] font-semibold ${deviceSourceChipTone(device)}`}>
          {deviceSourceChipLabel(device)}
        </span>
      </div>
      <div className="text-right">
        <div className={`text-lg font-bold ${deviceSourceToneClass(device)}`}>{device.wearCoveragePct}%</div>
        <div className="text-[10px] uppercase tracking-wide text-zinc-600">coverage</div>
      </div>
    </div>

    <div className="mt-3">
      <div className="flex items-center justify-between text-[10px] text-zinc-600 mb-1">
        <span>{device.windowDays} days ago</span>
        <span>Today</span>
      </div>
      <DevicePresenceStrip presence={device.dailyPresence} />
    </div>

    <div className="grid grid-cols-2 gap-3 mt-3">
      <ProfileStat label="Last data" value={formatDeviceTime(device.lastObservedAt)} />
      <ProfileStat label="Last sync" value={formatDeviceTime(device.lastSyncedAt)} />
    </div>
  </div>
);

const ProfileStat: React.FC<{ label: string; value: React.ReactNode; sub?: string; color?: string }> = ({
  label,
  value,
  sub,
  color,
}) => (
  <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3">
    <div className="text-lg font-bold text-white" style={color ? { color } : undefined}>
      {value}
    </div>
    <div className="text-[10px] text-zinc-500 uppercase tracking-wide mt-0.5">{label}</div>
    {sub && <div className="text-[10px] text-zinc-600 mt-0.5">{sub}</div>}
  </div>
);

type CurriculumAdherenceState = 'new' | 'due' | 'on-track' | 'behind' | 'completed' | 'paused' | 'assigned';

const CURRICULUM_ADHERENCE_META: Record<
  CurriculumAdherenceState,
  { label: string; color: string; bg: string; border: string; action: string }
> = {
  new: {
    label: 'New today',
    color: '#E0FE10',
    bg: 'rgba(224,254,16,0.10)',
    border: 'rgba(224,254,16,0.24)',
    action: 'No nudge yet',
  },
  due: {
    label: 'Due today',
    color: '#E0FE10',
    bg: 'rgba(224,254,16,0.10)',
    border: 'rgba(224,254,16,0.24)',
    action: 'Check tomorrow',
  },
  'on-track': {
    label: 'On track',
    color: '#22C55E',
    bg: 'rgba(34,197,94,0.10)',
    border: 'rgba(34,197,94,0.24)',
    action: 'No action',
  },
  behind: {
    label: 'Behind',
    color: '#F97316',
    bg: 'rgba(249,115,22,0.12)',
    border: 'rgba(249,115,22,0.28)',
    action: 'Nudge today',
  },
  completed: {
    label: 'Completed',
    color: '#22C55E',
    bg: 'rgba(34,197,94,0.10)',
    border: 'rgba(34,197,94,0.24)',
    action: 'Celebrate',
  },
  paused: {
    label: 'Paused',
    color: '#A78BFA',
    bg: 'rgba(167,139,250,0.10)',
    border: 'rgba(167,139,250,0.24)',
    action: 'No action',
  },
  assigned: {
    label: 'Assigned',
    color: '#A1A1AA',
    bg: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.10)',
    action: 'Watch',
  },
};

const plural = (count: number, singular: string, pluralLabel = `${singular}s`) =>
  `${count} ${count === 1 ? singular : pluralLabel}`;

const shortDate = (date?: Date): string =>
  date && Number.isFinite(date.getTime())
    ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

const isToday = (date?: Date): boolean => !!date && daysSince(date) === 0;

const buildDailyCheckInPoints = (rows: AthleteProfileHistoryRow[], days = 30): DailyCheckInPoint[] => {
  const byDate = new Map(rows.filter((row) => row.date).map((row) => [row.date, row]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    const dateKey = localDayKey(date);
    const row = byDate.get(dateKey);
    const messages = Math.max(0, Number(row?.messages ?? 0));
    return {
      date,
      dateKey,
      score: row?.score ?? 0,
      messages,
      hasCheckIn: messages > 0,
    };
  });
};

const summarizeCheckInWindow = (daily: DailyCheckInPoint[], days: number): CheckInWindowSummary => {
  const window = daily.slice(0, days);
  const checked = window.filter((day) => day.hasCheckIn).length;
  const missed = Math.max(0, days - checked);
  const rate = Math.round((checked / Math.max(1, days)) * 100);
  const latestMiss = window.find((day) => !day.hasCheckIn);
  const state =
    checked >= days
      ? 'On track'
      : checked >= Math.ceil(days * 0.75)
      ? 'Mostly steady'
      : checked > 0
      ? 'Needs nudge'
      : 'No check-ins';
  const toneClass =
    checked >= days
      ? 'text-emerald-300'
      : checked >= Math.ceil(days * 0.75)
      ? 'text-[#E0FE10]'
      : checked > 0
      ? 'text-orange-300'
      : 'text-zinc-500';
  const latestMissLabel = latestMiss
    ? isToday(latestMiss.date)
      ? 'today'
      : shortDate(latestMiss.date)
    : '';
  const detail =
    missed === 0
      ? `No missed days in last ${days}`
      : `${plural(missed, 'missed day')} in last ${days}${latestMissLabel ? `; latest ${latestMissLabel}` : ''}`;

  return {
    days,
    checked,
    missed,
    rate,
    state,
    toneClass,
    detail,
    presence: window.map((day) => day.hasCheckIn),
  };
};

const deriveCurriculumAdherence = (item: CoachAthleteCurriculumItem) => {
  const completedCount = Math.max(0, item.completedCount ?? (item.status === 'completed' ? 1 : 0));
  const targetCount = Math.max(0, item.targetCount ?? 0);
  const expectedCount = Math.max(0, item.expectedCount ?? 0);
  const missedCount = Math.max(0, item.missedCount ?? 0);
  const progressPct = targetCount > 0
    ? Math.max(0, Math.min(100, Math.round((completedCount / targetCount) * 100)))
    : Math.max(0, Math.min(100, Math.round(item.progressPct || 0)));

  let state: CurriculumAdherenceState = 'assigned';
  if (item.status === 'completed') state = 'completed';
  else if (item.status === 'paused') state = 'paused';
  else if (missedCount > 0) state = 'behind';
  else if ((item.assignedAt && isToday(item.assignedAt)) && completedCount === 0) state = 'new';
  else if (item.dueToday || isToday(item.dueAt)) state = 'due';
  else if (completedCount > 0 || item.status === 'in-progress') state = 'on-track';

  const meta = CURRICULUM_ADHERENCE_META[state];
  const countText = targetCount > 0
    ? `${completedCount} of ${targetCount} practices completed`
    : CURRICULUM_STATUS_LABEL[item.status];
  const assignedText = item.assignedAt ? `assigned ${isToday(item.assignedAt) ? 'today' : shortDate(item.assignedAt)}` : '';
  const dueText = item.dueAt ? `due ${isToday(item.dueAt) ? 'today' : shortDate(item.dueAt)}` : item.dueToday ? 'due today' : '';
  const expectedText = expectedCount > 0 ? `expected ${expectedCount} by now` : '';
  const expectedSentence = expectedText ? `${expectedText.charAt(0).toUpperCase()}${expectedText.slice(1)}.` : '';
  const missedText = missedCount > 0 ? `${plural(missedCount, 'missed practice', 'missed practices')}` : 'no missed work yet';
  const remainingText = typeof item.daysRemaining === 'number' && item.daysRemaining > 0 ? `${plural(item.daysRemaining, 'day')} left` : '';

  const evidence = [countText, assignedText, dueText, state === 'behind' ? expectedText : remainingText || missedText]
    .filter(Boolean)
    .join(' · ');

  const explanation =
    state === 'behind'
      ? `${missedText}. ${expectedSentence}`.trim()
      : state === 'new'
      ? 'Assigned today; no missed work yet.'
      : state === 'due'
      ? 'Due today; do not count it as missed yet.'
      : state === 'on-track'
      ? 'Meeting the expected pace.'
      : state === 'completed'
      ? 'Finished this assignment.'
      : state === 'paused'
      ? 'Paused while care or curriculum routing changes.'
      : 'Assigned; waiting for the next completed practice.';

  return { state, meta, progressPct, completedCount, targetCount, expectedCount, missedCount, evidence, explanation };
};

const AdherencePill: React.FC<{ label: string; color: string; bg: string; border: string }> = ({ label, color, bg, border }) => (
  <span
    className="flex-shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold"
    style={{ color, background: bg, border: `1px solid ${border}` }}
  >
    {label}
  </span>
);

const CheckInWindowRow: React.FC<{ summary: CheckInWindowSummary }> = ({ summary }) => (
  <div className="rounded-md border border-white/5 bg-white/[0.03] px-2 py-1.5">
    <div className="flex items-center justify-between gap-2 text-[10px]">
      <span className="font-medium text-zinc-400">Last {summary.days} days</span>
      <span className="font-semibold text-white">
        {summary.checked}/{summary.days} <span className="text-zinc-600">·</span>{' '}
        <span className={summary.missed > 0 ? 'text-orange-300' : 'text-emerald-300'}>
          {summary.missed === 0 ? 'no missed days' : `${summary.missed} missed`}
        </span>
      </span>
    </div>
    <div
      className="mt-1.5 flex gap-0.5"
      aria-label={`${summary.checked} check-ins in the last ${summary.days} days`}
      title={summary.detail}
    >
      {[...summary.presence].reverse().map((hasCheckIn, index) => (
        <span
          key={`${summary.days}-${index}`}
          className={`h-1.5 min-w-0 flex-1 rounded-full ${hasCheckIn ? 'bg-emerald-400/80' : 'bg-zinc-700/70'}`}
        />
      ))}
    </div>
  </div>
);

const AthleteProfileDrawer: React.FC<{
  athlete: CoachAthlete | null;
  alerts: AthleteAlert[];
  canSeeTier3?: boolean;
  onClose: () => void;
}> = ({ athlete, alerts, canSeeTier3 = true, onClose }) => {
  const [history, setHistory] = useState<AthleteProfileHistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [curriculumSnapshot, setCurriculumSnapshot] = useState<CoachAthleteCurriculumSnapshot | null>(null);
  const [loadingCurriculum, setLoadingCurriculum] = useState(false);

  useEffect(() => {
    if (!athlete) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    setLoadingHistory(true);
    setHistory([]);
    coachService
      .getDailySentimentHistory(athlete.id, 30)
      .then((rows: any[]) => {
        if (cancelled) return;
        // Service returns available rows newest-first; the drawer normalizes
        // those rows into a true 30-day calendar window below.
        setHistory(
          rows.map((r) => ({
            date: String(r.date || ''),
            score: r.sentimentScore ?? 0,
            messages: r.messageCount ?? 0,
          }))
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [athlete?.id]);

  useEffect(() => {
    if (!athlete) {
      setCurriculumSnapshot(null);
      return;
    }
    let cancelled = false;
    setLoadingCurriculum(true);
    setCurriculumSnapshot(null);
    coachService
      .getAthleteCurriculumSnapshot(athlete.id)
      .then((snapshot) => {
        if (!cancelled) setCurriculumSnapshot(snapshot);
      })
      .catch(() => {
        if (!cancelled) setCurriculumSnapshot(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingCurriculum(false);
      });
    return () => {
      cancelled = true;
    };
  }, [athlete?.id]);

  // Lock body scroll + ESC to close while open.
  useEffect(() => {
    if (!athlete) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [athlete, onClose]);

  // Tier 3 detail is the athletic_trainer medical peek; without that capability
  // the drawer shows none of the clinical-watch banner or care detail.
  const tier3 =
    athlete && canSeeTier3 ? alerts.find((a) => a.athleteId === athlete.id && a.tier === 3) : undefined;
  const tier2 = athlete ? alerts.find((a) => a.athleteId === athlete.id && a.tier === 2) : undefined;
  const walledOff = !!tier3;

  const status = athlete ? deriveStatus(athlete) : 'pending';
  const mood = moodMeta(athlete?.sentimentScore ?? 0);
  const dailyCheckInHistory = useMemo(() => buildDailyCheckInPoints(history, 30), [history]);
  const checkInWindows = useMemo(
    () => [7, 14, 30].map((days) => summarizeCheckInWindow(dailyCheckInHistory, days)),
    [dailyCheckInHistory]
  );
  const checkInLast7 = checkInWindows[0] ?? summarizeCheckInWindow(dailyCheckInHistory, 7);
  const checkInLast14 = checkInWindows[1] ?? summarizeCheckInWindow(dailyCheckInHistory, 14);
  const checkInLast30 = checkInWindows[2] ?? summarizeCheckInWindow(dailyCheckInHistory, 30);
  const latestCheckInDay = dailyCheckInHistory.find((day) => day.hasCheckIn);
  const latestCheckInRelative = latestCheckInDay ? relativeWhen(latestCheckInDay.date) : '';
  const latestCheckInStat = latestCheckInDay
    ? isToday(latestCheckInDay.date)
      ? 'Today'
      : latestCheckInRelative
    : 'No data';
  const latestCheckInAction = latestCheckInDay
    ? isToday(latestCheckInDay.date)
      ? 'Checked in today'
      : `Checked in ${latestCheckInRelative}`
    : 'No check-ins in last 30 days';
  const recentScores = dailyCheckInHistory.slice(0, 28).map((h) => (h.hasCheckIn ? h.score : 0));
  const trend = trendOf(recentScores);
  const checkinsLast7 = checkInLast7.checked;
  const curriculum = curriculumSnapshot?.items || [];
  const completedModules = curriculumSnapshot?.completedCount ?? curriculum.filter((c) => c.status === 'completed').length;
  const totalModules = curriculumSnapshot?.totalCount ?? curriculum.length;
  const deviceStatus = athlete?.deviceStatus;
  const deviceConnected = deviceStatus ? deviceStatus.connectionStatus !== 'not_connected' : !!athlete?.deviceConnected;
  const deviceCoveragePct = deviceStatus?.wearCoveragePct ?? athlete?.deviceCoveragePct ?? 0;
  const deviceDaysCovered = deviceStatus?.wearDaysCovered ?? athlete?.deviceDailyPresence?.filter(Boolean).length ?? 0;
  const deviceWindowDays = deviceStatus?.windowDays ?? athlete?.deviceDailyPresence?.length ?? 14;
  const deviceList = deviceStatus?.devices ?? [];

  const trendMeta: Record<SentimentTrend, { label: string; color: string; icon: React.ElementType }> = {
    improving: { label: 'Improving', color: '#22C55E', icon: TrendingUp },
    declining: { label: 'Declining', color: '#F97316', icon: TrendingDown },
    steady: { label: 'Steady', color: '#A1A1AA', icon: Activity },
  };
  const TrendIcon = trendMeta[trend].icon;
  const first = firstNameOf(athlete?.displayName);
  const curriculumAdherence = useMemo(
    () => curriculum.map((item) => ({ item, adherence: deriveCurriculumAdherence(item) })),
    [curriculum]
  );
  const activeCurriculumAdherence = curriculumAdherence.filter(
    ({ item }) => item.status !== 'completed' && item.status !== 'paused'
  );
  const curriculumBehindCount = curriculumAdherence.filter(({ adherence }) => adherence.state === 'behind').length;
  const curriculumDueTodayCount = curriculumAdherence.filter(({ adherence }) => adherence.state === 'due' || adherence.state === 'new').length;
  const curriculumStartedCount = curriculumAdherence.filter(
    ({ adherence, item }) => adherence.completedCount > 0 || item.status === 'in-progress' || item.status === 'completed'
  ).length;
  const curriculumSnapshotLabel = loadingCurriculum
    ? 'Loading'
    : curriculum.length === 0
    ? 'No active work'
    : curriculumBehindCount > 0
    ? `${curriculumBehindCount} behind`
    : curriculumDueTodayCount > 0
    ? `${curriculumDueTodayCount} due today`
    : 'On track';
  const curriculumSnapshotSub = loadingCurriculum
    ? 'Reading assignments'
    : curriculum.length === 0
    ? 'No assigned curriculum'
    : `${curriculumStartedCount}/${curriculum.length} started`;
  const checkinState = checkInLast7.state;
  const deviceSnapshotLabel = deviceConnected
    ? deviceDaysCovered > 0
      ? `${deviceCoveragePct}% coverage`
      : 'Connected, no data'
    : 'Not connected';
  const deviceSnapshotSub = deviceConnected
    ? `${deviceDaysCovered}/${deviceWindowDays} days with data`
    : 'Ask about setup';

  return (
    <AnimatePresence>
      {athlete && (
        <motion.div
          className="fixed inset-0 z-50 flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

          {/* Panel */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="relative w-full max-w-xl h-full overflow-y-auto border-l border-zinc-800/70"
            style={{ background: 'linear-gradient(180deg, #111113 0%, #0a0a0b 100%)' }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 px-6 py-4 border-b border-zinc-800/60 bg-[#111113]/90 backdrop-blur flex items-start gap-3">
              {athlete.profileImageUrl ? (
                <img
                  src={athlete.profileImageUrl}
                  alt={athlete.displayName}
                  className="h-12 w-12 rounded-full object-cover ring-1 ring-white/10 flex-shrink-0"
                />
              ) : (
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold text-zinc-200 ring-1 ring-white/10">
                  {initialsOf(athlete.displayName)}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-lg font-bold text-white truncate">{athlete.displayName}</div>
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 truncate">
                  <Mail className="w-3 h-3" /> {athlete.email}
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition flex-shrink-0"
                aria-label="Close profile"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Walled-off / watch-list banner (Tier 3) */}
              {walledOff && (
                <div className="rounded-2xl p-4 border" style={{ background: 'rgba(167,139,250,0.08)', borderColor: 'rgba(167,139,250,0.35)' }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Lock className="w-4 h-4 text-[#A78BFA]" />
                    <span className="text-sm font-bold text-white">On clinical watch list</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#A78BFA]/20 text-[#A78BFA] border border-[#A78BFA]/30 font-bold uppercase tracking-wide">
                      Curriculum paused
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    A Tier 3 escalation automatically placed {first} on the watch list. Self-guided
                    PulseCheck modules are paused while clinical care leads
                    {tier3?.clinicalContact ? ` (${tier3.clinicalContact})` : ''}. Your role is awareness
                    and discretion — no coaching action needed.
                  </p>
                </div>
              )}

              {/* Two distinct signals: readiness (sentiment) + care (escalation) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1.5">Readiness signal</div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${STATUS_META[status].dot}`} />
                    <span className={`text-sm font-semibold ${STATUS_META[status].text}`}>
                      {STATUS_META[status].label}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-600 mt-1">From recent check-in sentiment</div>
                </div>
                <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1.5">Care &amp; escalation</div>
                  {walledOff ? (
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#A78BFA]" />
                      <span className="text-sm font-semibold text-[#A78BFA]">In clinical care</span>
                    </div>
                  ) : tier2 ? (
                    <div className="flex items-center gap-2">
                      <BellRing className="w-3.5 h-3.5 text-orange-400" />
                      <span className="text-sm font-semibold text-orange-400">Tier 2 — notified you</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-sm font-semibold text-green-400">No active escalation</span>
                    </div>
                  )}
                  <div className="text-[10px] text-zinc-600 mt-1">Authoritative care state</div>
                </div>
              </div>

              {/* Sentiment / mood trend */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Mood · last 28 days</h3>
                  <span className="flex items-center gap-1 text-xs font-medium" style={{ color: trendMeta[trend].color }}>
                    <TrendIcon className="w-3.5 h-3.5" /> {trendMeta[trend].label}
                  </span>
                </div>
                <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3">
                  {loadingHistory ? (
                    <div className="h-12 flex items-center text-[11px] text-zinc-600">Loading trend…</div>
                  ) : (
                    <Sparkline values={[...recentScores].reverse()} color={mood.color} />
                  )}
                  <div className="flex items-center justify-between text-[10px] text-zinc-600 mt-1">
                    <span>28 days ago</span>
                    <span>Today ▸</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <ProfileStat label="Current mood" value={mood.label} color={mood.color} />
                  <ProfileStat label="Check-ins" value={`${checkinsLast7}/7`} sub="last 7 days" />
                  <ProfileStat label="Conversations" value={athlete.conversationCount} />
                </div>
              </div>

              {/* Check-in / engagement stats */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Engagement</h3>
                <div className="grid grid-cols-3 gap-3">
                  <ProfileStat label="Sessions" value={athlete.totalSessions} />
                  <ProfileStat label="7-day rate" value={`${checkInLast7.rate}%`} />
                  <ProfileStat
                    label="Last check-in"
                    value={latestCheckInStat}
                  />
                </div>
              </div>

              {/* Adherence snapshot */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Adherence snapshot</h3>
                <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="rounded-lg bg-black/20 border border-white/5 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase tracking-wide text-zinc-500">Check-ins</span>
                        <span className={`text-[10px] font-semibold ${checkInLast7.toneClass}`}>
                          {checkinState}
                        </span>
                      </div>
                      <div className="mt-1 text-sm font-bold text-white">{checkinsLast7}/7</div>
                      <div className="mt-0.5 text-[10px] text-zinc-500">
                        {checkInLast7.detail}
                      </div>
                      <div className="mt-2 space-y-1.5">
                        <CheckInWindowRow summary={checkInLast7} />
                        <CheckInWindowRow summary={checkInLast14} />
                        <CheckInWindowRow summary={checkInLast30} />
                      </div>
                    </div>
                    <div className="rounded-lg bg-black/20 border border-white/5 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase tracking-wide text-zinc-500">Curriculum</span>
                        <span className={`text-[10px] font-semibold ${curriculumBehindCount > 0 ? 'text-orange-300' : curriculumDueTodayCount > 0 ? 'text-[#E0FE10]' : 'text-emerald-300'}`}>
                          {curriculumSnapshotLabel}
                        </span>
                      </div>
                      <div className="mt-1 text-sm font-bold text-white">
                        {loadingCurriculum ? '—' : `${completedModules}/${totalModules || 0}`}
                      </div>
                      <div className="mt-0.5 text-[10px] text-zinc-500">{curriculumSnapshotSub}</div>
                    </div>
                    <div className="rounded-lg bg-black/20 border border-white/5 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase tracking-wide text-zinc-500">Device</span>
                        <span className={`text-[10px] font-semibold ${deviceConnected ? deviceToneClass(deviceStatus) : 'text-zinc-500'}`}>
                          {deviceSnapshotLabel}
                        </span>
                      </div>
                      <div className="mt-1 text-sm font-bold text-white">{deviceDaysCovered}/{deviceWindowDays}</div>
                      <div className="mt-0.5 text-[10px] text-zinc-500">{deviceSnapshotSub}</div>
                    </div>
                    <div className="rounded-lg bg-black/20 border border-white/5 p-2.5">
                      <div className="text-[10px] uppercase tracking-wide text-zinc-500">Last action</div>
                      <div className="mt-1 text-sm font-bold text-white">
                        {latestCheckInAction}
                      </div>
                      <div className="mt-0.5 text-[10px] text-zinc-500">
                        {curriculumBehindCount > 0 ? 'Curriculum nudge recommended' : 'No urgent adherence action'}
                      </div>
                    </div>
                  </div>
                  {activeCurriculumAdherence.length > 0 && (
                    <div className="rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-2 text-[10px] leading-4 text-zinc-400">
                      Curriculum read: {curriculumBehindCount > 0
                        ? `${plural(curriculumBehindCount, 'assignment')} behind expected pace.`
                        : curriculumDueTodayCount > 0
                        ? `${plural(curriculumDueTodayCount, 'assignment')} due today; not missed yet.`
                        : 'assigned work is on pace.'}
                    </div>
                  )}
                </div>
              </div>

              {/* Device adherence — one card per connected source */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Device adherence</h3>
                  <span className={`text-[10px] font-semibold ${deviceToneClass(deviceStatus)}`}>
                    {deviceList.length > 0
                      ? deviceList.length === 1
                        ? deviceConnectionLabel(deviceStatus)
                        : `${deviceList.length} sources`
                      : 'Not connected'}
                  </span>
                </div>
                {deviceList.length > 0 ? (
                  <div className="space-y-3">
                    {deviceList.map((device) => (
                      <DeviceSourceCard key={device.sourceFamily} device={device} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3">
                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                      No connected wearable or health source was found for {first}.
                    </p>
                  </div>
                )}
              </div>

              {/* Care detail — what's being done (Tier 2 or Tier 3) */}
              {(tier3 || tier2) && (
                <div>
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                    {tier3 ? 'Care steps taken' : 'What Nora has done'}
                  </h3>
                  <div className="space-y-1.5">
                    {(tier3 ?? tier2)!.noraActions.map((n) => (
                      <NoraActionRow key={n.label} action={n} />
                    ))}
                  </div>
                </div>
              )}

              {/* Mental readiness curriculum */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    Mental readiness curriculum
                  </h3>
                  {walledOff ? (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#A78BFA]/15 text-[#A78BFA] border border-[#A78BFA]/25 font-semibold flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Paused
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-500">
                      {loadingCurriculum
                        ? 'Loading...'
                        : totalModules > 0
                        ? `${completedModules}/${totalModules} completed`
                        : 'No active work'}
                    </span>
                  )}
                </div>
                <div className={`space-y-2 ${walledOff ? 'opacity-50 pointer-events-none select-none' : ''}`}>
                  {loadingCurriculum ? (
                    <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3 text-xs text-zinc-500">
                      Loading real assignments...
                    </div>
                  ) : curriculum.length === 0 ? (
                    <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3 text-xs text-zinc-500">
                      No PulseCheck curriculum assignments are active for {first} yet.
                    </div>
                  ) : (
                    curriculumAdherence.map(({ item, adherence }) => {
                      const meta = CURRICULUM_ITEM_META[item.kind];
                      const Icon = meta.icon;
                      const effectiveStatus = walledOff ? 'paused' : item.status;
                      const pct = adherence.progressPct;
                      const statusMeta = walledOff ? CURRICULUM_ADHERENCE_META.paused : adherence.meta;
                      return (
                        <div
                          key={`${item.source}:${item.id}`}
                          className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: `${meta.color}15` }}
                            >
                              <Icon className="w-4 h-4" style={{ color: meta.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-white truncate">{item.title}</div>
                                  <div className="mt-0.5 text-[10px] text-zinc-500 truncate">
                                    {item.detail || CURRICULUM_STATUS_LABEL[item.status]}
                                  </div>
                                </div>
                                <AdherencePill
                                  label={walledOff ? 'Paused' : statusMeta.label}
                                  color={statusMeta.color}
                                  bg={statusMeta.bg}
                                  border={statusMeta.border}
                                />
                              </div>

                              <div className="mt-2 rounded-lg bg-black/20 border border-white/5 px-2.5 py-2">
                                <div className="text-[11px] font-medium text-zinc-200">{adherence.evidence}</div>
                                <div className="mt-1 text-[10px] leading-4 text-zinc-500">{adherence.explanation}</div>
                                {adherence.targetCount > 0 && (
                                  <div className="mt-2">
                                    <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-600">
                                      <span>Completed practices</span>
                                      <span>{adherence.completedCount}/{adherence.targetCount}</span>
                                    </div>
                                    <div className="h-1.5 bg-zinc-700/50 rounded-full overflow-hidden">
                                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: statusMeta.color }} />
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="mt-2 flex items-center justify-between gap-3 text-[10px]">
                                <span className="text-zinc-500">
                                  Coach action: <span className="font-semibold text-zinc-300">{statusMeta.action}</span>
                                </span>
                                <span className="text-zinc-600">
                                  {effectiveStatus === 'completed' ? 'Finished' : pct > 0 ? `${pct}%` : CURRICULUM_STATUS_LABEL[effectiveStatus]}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {walledOff && (
                  <p className="text-[10px] text-zinc-600 mt-2 leading-relaxed">
                    Assignments resume automatically once {first} is cleared from clinical care.
                  </p>
                )}
              </div>

              {/* Footer actions */}
              <div className="pt-1">
                {walledOff ? (
                  <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3 text-center text-xs text-zinc-500">
                    Messaging routes through the care team while {first} is on the watch list.
                  </div>
                ) : (
                  <button className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-[#E0FE10] text-black text-sm font-semibold hover:brightness-95 transition">
                    <MessageSquare className="w-4 h-4" /> Message {first}
                  </button>
                )}
              </div>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ---------------------------------------------------------------------------
// Team Roster
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Athletes — invite control + pending invites (rendered above the roster table).
// Athletes onboard via a team-access invite link with role 'athlete'; this is
// the coach-facing entry point on the dashboard. Gated to Admin/Coach/Manager.
// ---------------------------------------------------------------------------
type AthleteInviteRow = {
  id: string;
  name: string;
  email: string;
  activationUrl: string;
  // Invite token — used to record the email-send result on resend.
  token: string;
  // Pre-filled avatar shown on the invite + carried into their profile on join.
  avatarUrl?: string;
};

const DEMO_ATHLETE_INVITES: AthleteInviteRow[] = [
  {
    id: 'demo-ath-1',
    name: 'Jordan Lee',
    email: 'jordan.lee@school.edu',
    activationUrl: 'https://fitwithpulse.ai/PulseCheck/team-invite/demo-athlete-1',
    token: 'demo-athlete-1',
  },
];

const AthleteInviteSection: React.FC<{
  isDemo?: boolean;
  coachId?: string;
  coachName?: string;
  coachEmail?: string;
  // Inviting athletes is allowed for Admin, Coach, and Manager capabilities.
  canInvite?: boolean;
  // Revoking a pending invite is admin-only.
  canRevoke?: boolean;
}> = ({ isDemo, coachId, coachName = '', coachEmail, canInvite = false, canRevoke = false }) => {
  const [invites, setInvites] = useState<AthleteInviteRow[]>(isDemo ? DEMO_ATHLETE_INVITES : []);
  const [loadingInvites, setLoadingInvites] = useState(!isDemo);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  // Opt-in: email this coach when the athlete accepts. hello@fitwithpulse.ai is
  // always notified regardless; this just CCs the inviting coach.
  const [notifyOnAccept, setNotifyOnAccept] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState('https://fitwithpulse.ai/PulseCheck/team-invite/demo-athlete');
  const [busy, setBusy] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  // Edit-invite modal: tweak a pending athlete's name + pre-filled profile photo.
  const [editingInvite, setEditingInvite] = useState<AthleteInviteRow | null>(null);
  const [invName, setInvName] = useState('');
  const [invPhotoFile, setInvPhotoFile] = useState<File | null>(null);
  const [invPhotoPreview, setInvPhotoPreview] = useState<string | null>(null);
  const [savingInvite, setSavingInvite] = useState(false);
  const [team, setTeam] = useState<{
    organizationId: string;
    teamId: string;
    organizationName: string;
    teamName: string;
  } | null>(null);

  // Live: resolve the coach's active team, then pull active athlete invite links.
  const loadInvites = useCallback(async () => {
    if (isDemo || !coachId) {
      setLoadingInvites(false);
      return;
    }
    setLoadingInvites(true);
    try {
      const memberships = await pulseCheckProvisioningService.listUserTeamMemberships(coachId);
      const own = memberships.find((m) => m.role !== 'athlete');
      if (!own) {
        setInvites([]);
        return;
      }
      const { teamId, organizationId } = own;
      let teamName = 'your team';
      let organizationName = 'your organization';
      try {
        const [t, org] = await Promise.all([
          pulseCheckProvisioningService.getTeam(teamId),
          pulseCheckProvisioningService.getOrganization(organizationId),
        ]);
        teamName = t?.displayName || teamName;
        organizationName = org?.displayName || organizationName;
      } catch {
        /* names are cosmetic */
      }
      setTeam({ organizationId, teamId, organizationName, teamName });

      const links = await pulseCheckProvisioningService
        .listTeamInviteLinks(teamId)
        .catch(() => [] as PulseCheckInviteLink[]);
      const rows = links
        .filter(
          (l) => l.inviteType === 'team-access' && l.teamMembershipRole === 'athlete' && l.status === 'active'
        )
        .map((l) => ({
          id: l.id,
          name: (l.recipientName || '').trim() || (l.targetEmail || '').split('@')[0] || 'Invited athlete',
          email: l.targetEmail || '',
          activationUrl: l.activationUrl,
          token: l.token,
          avatarUrl: (l.prefilledProfileImageUrl || '').trim() || undefined,
        }));
      setInvites(rows);
    } catch (err) {
      console.error('[CoachDashboard] failed to load athlete invites', err);
    } finally {
      setLoadingInvites(false);
    }
  }, [coachId, isDemo]);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  const openInvite = () => {
    setName('');
    setEmail('');
    setNotifyOnAccept(false);
    setCopied(false);
    setInviteOpen(true);
  };

  // Create + copy a reusable athlete link (anyone who redeems joins as an athlete).
  const copyLink = async () => {
    if (isDemo) {
      try {
        navigator.clipboard?.writeText(inviteLink);
      } catch {}
      setCopied(true);
      setToast('Athlete invite link copied.');
      return;
    }
    if (!team || !coachId) {
      setToast('Still resolving your team — try again in a moment.');
      return;
    }
    setBusy(true);
    try {
      await pulseCheckProvisioningService.createTeamAccessInviteLink({
        organizationId: team.organizationId,
        teamId: team.teamId,
        teamMembershipRole: 'athlete',
        redemptionMode: 'general',
        createdByUserId: coachId,
        createdByEmail: coachEmail || '',
      });
      const links = await pulseCheckProvisioningService.listTeamInviteLinks(team.teamId);
      const link = links.find(
        (l) =>
          l.inviteType === 'team-access' &&
          l.teamMembershipRole === 'athlete' &&
          !(l.targetEmail || '') &&
          l.status === 'active'
      );
      if (link?.activationUrl) {
        setInviteLink(link.activationUrl);
        try {
          navigator.clipboard?.writeText(link.activationUrl);
        } catch {}
        setCopied(true);
        setToast('Athlete invite link copied — share it with your team.');
        await loadInvites();
      } else {
        setToast('Created the link but could not read it back. Refresh and try again.');
      }
    } catch (err) {
      console.error('[CoachDashboard] failed to create shareable athlete link', err);
      setToast('Could not create the link. Try again.');
    } finally {
      setBusy(false);
    }
  };

  // Email a single-use athlete invite (mirrors the staff send + email flow).
  const sendInvite = async () => {
    const e = email.trim();
    const n = name.trim();
    if (!n) {
      setToast("Add the athlete's name first.");
      return;
    }
    if (!e) return;

    if (isDemo) {
      setInvites((prev) => [
        { id: `demo-${prev.length + 1}-${e}`, name: n, email: e, activationUrl: inviteLink, token: `demo-${e}` },
        ...prev,
      ]);
      setToast(`Invite sent to ${n}.`);
      setInviteOpen(false);
      return;
    }
    if (!team || !coachId) {
      setToast('Still resolving your team — try again in a moment.');
      return;
    }
    setBusy(true);
    try {
      await pulseCheckProvisioningService.createTeamAccessInviteLink({
        organizationId: team.organizationId,
        teamId: team.teamId,
        teamMembershipRole: 'athlete',
        redemptionMode: 'single-use',
        targetEmail: e,
        recipientName: n,
        createdByUserId: coachId,
        createdByEmail: coachEmail || '',
        createdByName: coachName,
        notifyCoachOnAccept: notifyOnAccept,
      });

      const links = await pulseCheckProvisioningService.listTeamInviteLinks(team.teamId);
      const link = links.find(
        (l) =>
          l.inviteType === 'team-access' &&
          l.teamMembershipRole === 'athlete' &&
          (l.targetEmail || '').toLowerCase() === e.toLowerCase() &&
          l.status === 'active'
      );

      let emailSent = false;
      if (link?.activationUrl) {
        try {
          // Athlete-specific, app-first email template (distinct from staff invite).
          const resp = await fetch('/.netlify/functions/send-pulsecheck-athlete-invite-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toEmail: e,
              activationUrl: link.activationUrl,
              recipientName: n,
              organizationName: team.organizationName,
              teamName: team.teamName,
              senderName: coachName,
            }),
          });
          const result = await resp.json().catch(() => ({ success: false }));
          emailSent = resp.ok && result?.success === true;
          await pulseCheckProvisioningService.recordAdminActivationEmailResult({
            token: link.token,
            success: emailSent,
            messageId: result?.messageId,
            sentByUserId: coachId,
            sentByEmail: coachEmail || '',
            targetEmail: e,
            organizationId: team.organizationId,
            teamId: team.teamId,
            errorMessage: emailSent ? '' : String(result?.error || 'Send failed'),
          });
        } catch (mailErr) {
          console.error('[CoachDashboard] athlete invite email failed', mailErr);
        }
      }

      setToast(
        emailSent
          ? `Invite sent to ${e}.`
          : `Invite created for ${e} — email didn't send, share the link instead.`
      );
      setInviteOpen(false);
      await loadInvites();
    } catch (err) {
      console.error('[CoachDashboard] failed to send athlete invite', err);
      setToast('Could not send the invite. Try again.');
    } finally {
      setBusy(false);
    }
  };

  // Re-send the athlete invite email for an existing pending invite. Reuses the
  // already-created link (no new link minted) and mirrors sendInvite's email +
  // result-recording flow so the activation funnel stays accurate.
  const resendInvite = async (row: AthleteInviteRow) => {
    const e = row.email.trim();
    if (!e) {
      setToast(`${row.name}'s invite has no email on file — share the link instead.`);
      return;
    }
    if (isDemo) {
      setToast(`Invite re-sent to ${e}.`);
      return;
    }
    if (!team || !coachId) {
      setToast('Still resolving your team — try again in a moment.');
      return;
    }
    setResendingId(row.id);
    try {
      let emailSent = false;
      // Athlete-specific, app-first email template (distinct from staff invite).
      const resp = await fetch('/.netlify/functions/send-pulsecheck-athlete-invite-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: e,
          activationUrl: row.activationUrl,
          recipientName: row.name,
          organizationName: team.organizationName,
          teamName: team.teamName,
          senderName: coachName,
        }),
      });
      const result = await resp.json().catch(() => ({ success: false }));
      emailSent = resp.ok && result?.success === true;
      await pulseCheckProvisioningService.recordAdminActivationEmailResult({
        token: row.token,
        success: emailSent,
        messageId: result?.messageId,
        sentByUserId: coachId,
        sentByEmail: coachEmail || '',
        targetEmail: e,
        organizationId: team.organizationId,
        teamId: team.teamId,
        errorMessage: emailSent ? '' : String(result?.error || 'Send failed'),
      });
      setToast(
        emailSent
          ? `Invite re-sent to ${e}.`
          : `Couldn't re-send to ${e} — share the link instead.`
      );
    } catch (err) {
      console.error('[CoachDashboard] failed to resend athlete invite', err);
      setToast('Could not re-send the invite. Try again.');
    } finally {
      setResendingId(null);
    }
  };

  // Open the edit modal pre-loaded with the invite's current name + photo.
  const openEditInvite = (row: AthleteInviteRow) => {
    setEditingInvite(row);
    setInvName(row.name);
    setInvPhotoFile(null);
    setInvPhotoPreview(row.avatarUrl || null);
  };

  // Persist name + (optional) new photo onto the existing invite link. The photo
  // is uploaded to storage and stored as prefilledProfileImageUrl, which pre-fills
  // the athlete's profile when they accept — same field staff invites use.
  const saveInviteEdit = async () => {
    if (!editingInvite) return;
    const n = invName.trim();
    if (!n) {
      setToast("Add the athlete's name first.");
      return;
    }
    if (isDemo) {
      setInvites((prev) =>
        prev.map((i) =>
          i.id === editingInvite.id ? { ...i, name: n, avatarUrl: invPhotoPreview || i.avatarUrl } : i
        )
      );
      setToast(`Updated ${n}'s invite.`);
      setEditingInvite(null);
      return;
    }
    setSavingInvite(true);
    try {
      let prefilledProfileImageUrl: string | undefined;
      if (invPhotoFile) {
        const { firebaseStorageService, UploadImageType } = await import('../../api/firebase/storage/service');
        const upload = await firebaseStorageService.uploadImage(invPhotoFile, UploadImageType.Profile, {
          updateUserProfile: false,
        });
        prefilledProfileImageUrl = upload.downloadURL;
      }
      await pulseCheckProvisioningService.updateInviteLinkProfile({
        inviteId: editingInvite.id,
        recipientName: n,
        ...(prefilledProfileImageUrl ? { prefilledProfileImageUrl } : {}),
      });
      setToast(`Updated ${n}'s invite.`);
      setEditingInvite(null);
      await loadInvites();
    } catch (err) {
      console.error('[CoachDashboard] failed to update athlete invite', err);
      setToast('Could not save changes. Try again.');
    } finally {
      setSavingInvite(false);
    }
  };

  const revokeInvite = async (row: AthleteInviteRow) => {
    if (isDemo) {
      setInvites((prev) => prev.filter((i) => i.id !== row.id));
      setToast(`Revoked ${row.name}'s invite.`);
      return;
    }
    setRevokingId(row.id);
    try {
      await pulseCheckProvisioningService.revokeInviteLink(row.id);
      setToast(`Revoked ${row.name}'s invite.`);
      await loadInvites();
    } catch (err) {
      console.error('[CoachDashboard] failed to revoke athlete invite', err);
      setToast('Could not revoke the invite. Try again.');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
          Invite athletes {invites.length > 0 && <span className="text-zinc-600">({invites.length} pending)</span>}
        </div>
        {canInvite && (
          <div className="flex items-center gap-2">
            <button
              onClick={copyLink}
              disabled={busy}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700/50 text-zinc-300 text-sm font-medium hover:bg-zinc-800/40 disabled:opacity-40"
            >
              <Link2 className="w-4 h-4" /> Copy link
            </button>
            <button
              onClick={openInvite}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#E0FE10] text-black text-sm font-semibold hover:brightness-95"
            >
              <Plus className="w-4 h-4" /> Invite athlete
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div className="text-xs text-[#E0FE10] bg-[#E0FE10]/10 border border-[#E0FE10]/25 rounded-lg px-3 py-2">
          {toast}
        </div>
      )}

      {/* Pending athlete invites — disappear from here once the athlete onboards. */}
      {!loadingInvites && invites.length > 0 && (
        <div className="rounded-xl border border-zinc-700/30 divide-y divide-zinc-800/50 overflow-hidden">
          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 px-3 py-2.5">
              <button
                type="button"
                onClick={() => canInvite && openEditInvite(inv)}
                disabled={!canInvite}
                title={canInvite ? 'Edit invite profile' : undefined}
                className="group flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
              >
                <span className="flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-[11px] font-semibold text-zinc-300 ring-1 ring-white/10">
                  {inv.avatarUrl ? (
                    <img src={inv.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initialsOf(inv.name)
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white truncate group-hover:text-[#E0FE10]">{inv.name}</span>
                    <span className="text-[10px] uppercase tracking-wide text-amber-400/80 border border-amber-400/30 rounded-full px-1.5 py-0.5">
                      Invited
                    </span>
                    {canInvite && (
                      <Pencil className="h-3 w-3 flex-none text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100" />
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-500 truncate">{inv.email || inv.activationUrl}</div>
                </div>
              </button>
              {canInvite && inv.email && (
                <button
                  onClick={() => resendInvite(inv)}
                  disabled={resendingId === inv.id}
                  className="flex flex-none items-center gap-1.5 rounded-lg border border-zinc-700/50 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
                >
                  <Mail className="h-3.5 w-3.5" /> {resendingId === inv.id ? 'Sending…' : 'Resend'}
                </button>
              )}
              <button
                onClick={() => {
                  try {
                    navigator.clipboard?.writeText(inv.activationUrl);
                  } catch {}
                  setToast(`Copied ${inv.name}'s invite link.`);
                }}
                className="flex flex-none items-center gap-1.5 rounded-lg border border-zinc-700/50 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
              >
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
              {canRevoke && (
                <button
                  onClick={() => revokeInvite(inv)}
                  disabled={revokingId === inv.id}
                  className="flex flex-none items-center gap-1.5 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" /> {revokingId === inv.id ? 'Revoking…' : 'Revoke'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Invite modal — athlete name (required) + email (optional) */}
      <AnimatePresence>
        {inviteOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setInviteOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-700/50 bg-[#0d0d12] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
                <div>
                  <div className="text-base font-semibold text-white">Invite an athlete</div>
                  <div className="text-xs text-zinc-500">They’ll get a link to join the team and onboard.</div>
                </div>
                <button
                  onClick={() => setInviteOpen(false)}
                  className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                <div className="space-y-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Athlete name (required)"
                    className="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#E0FE10]/40"
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Invite by email
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') sendInvite();
                      }}
                      placeholder="athlete@school.edu"
                      className="flex-1 bg-zinc-900/60 border border-zinc-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#E0FE10]/40"
                    />
                    <button
                      onClick={sendInvite}
                      disabled={!email.trim() || !name.trim() || busy}
                      className="px-4 py-2 rounded-lg bg-[#E0FE10] text-black text-sm font-semibold hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {busy ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-600">
                    Athletes get set up in the PulseCheck app. Email is optional — you can share a link instead.
                  </p>
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={notifyOnAccept}
                    onChange={(e) => setNotifyOnAccept(e.target.checked)}
                    className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-zinc-600 bg-zinc-900 text-[#E0FE10] accent-[#E0FE10] focus:outline-none focus:ring-1 focus:ring-[#E0FE10]/40"
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-zinc-200">Email me when this athlete accepts</span>
                    <span className="block text-[11px] text-zinc-600">Otherwise only our team is notified.</span>
                  </span>
                </label>

                <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-700/40 bg-zinc-800/30 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-zinc-300">Or share a link</div>
                    <div className="truncate text-[11px] text-zinc-600">{inviteLink}</div>
                  </div>
                  <button
                    onClick={copyLink}
                    disabled={busy}
                    className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-zinc-700/50 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-[#E0FE10]" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied' : busy ? 'Creating…' : 'Copy link'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit-invite modal — update a pending athlete's name + pre-filled photo. */}
      <AnimatePresence>
        {editingInvite && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditingInvite(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-700/50 bg-[#0d0d12] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
                <div>
                  <div className="text-base font-semibold text-white">Edit athlete invite</div>
                  <div className="text-xs text-zinc-500">{editingInvite.email || editingInvite.name}</div>
                </div>
                <button
                  onClick={() => setEditingInvite(null)}
                  className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                <div className="flex items-center gap-3">
                  <label className="relative flex h-14 w-14 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-zinc-700/50 bg-zinc-800/40 hover:border-[#E0FE10]/40">
                    {invPhotoPreview ? (
                      <img src={invPhotoPreview} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-zinc-500" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setInvPhotoFile(f);
                        if (f) setInvPhotoPreview(URL.createObjectURL(f));
                      }}
                    />
                  </label>
                  <div className="min-w-0 flex-1">
                    <input
                      value={invName}
                      onChange={(e) => setInvName(e.target.value)}
                      placeholder="Athlete name (required)"
                      className="w-full bg-zinc-900/60 border border-zinc-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#E0FE10]/40"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-zinc-600">
                  These pre-fill the athlete's profile when they accept the invite — they can change them later.
                </p>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => setEditingInvite(null)}
                    className="px-4 py-2 rounded-lg border border-zinc-700/50 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveInviteEdit}
                    disabled={!invName.trim() || savingInvite}
                    className="px-4 py-2 rounded-lg bg-[#E0FE10] text-black text-sm font-semibold hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {savingInvite ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const RosterSection: React.FC<{
  athletes: CoachAthlete[];
  loading: boolean;
  onSelectAthlete: (id: string) => void;
}> = ({ athletes, loading, onSelectAthlete }) => {
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

  // "Checked in today" = athletes whose last Nora check-in was today.
  const checkedInToday = athletes.filter((a) => daysSince(a.lastActiveDate) === 0).length;
  const pct = athletes.length ? Math.round((checkedInToday / athletes.length) * 100) : 0;

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
          <span className="text-white font-bold">{checkedInToday}</span>/{athletes.length} checked in today
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
          <div className="text-right">Last Check-in</div>
        </div>
        <div className="max-h-[520px] overflow-y-auto">
          {rows.map(({ a, status }, i) => {
            const stale = daysSince(a.lastActiveDate);
            return (
              <motion.div
                key={a.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectAthlete(a.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectAthlete(a.id);
                  }
                }}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.4) }}
                className="grid grid-cols-[1fr_110px_90px] sm:grid-cols-[1fr_1fr_120px] gap-0 items-center px-3 py-2.5 border-b border-zinc-800/50 text-sm hover:bg-zinc-800/40 cursor-pointer focus:outline-none focus:bg-zinc-800/50"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {a.profileImageUrl ? (
                    <img
                      src={a.profileImageUrl}
                      alt={a.displayName}
                      className="h-8 w-8 flex-none rounded-full object-cover ring-1 ring-white/10"
                    />
                  ) : (
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-zinc-800 text-[11px] font-semibold text-zinc-300 ring-1 ring-white/10">
                      {initialsOf(a.displayName)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="font-medium text-white truncate">{a.displayName}</div>
                    <div className="text-[11px] text-zinc-500 truncate">{a.email}</div>
                  </div>
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

const TrainNoraSection: React.FC<{
  coachId?: string;
  coachName?: string;
  athletes?: CoachAthlete[];
}> = ({ coachId, coachName, athletes = [] }) => {
  const [entries, setEntries] = useState<NoraVaultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState<{ name: string; pct: number } | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
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
      <div data-nora-explainer className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/8 to-blue-500/5 p-5">
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
          data-nora-chat
          onClick={() => setChatOpen((o) => !o)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
            chatOpen
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
              : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:brightness-110'
          }`}
        >
          <MessageSquare className="w-4 h-4" /> Chat with Nora
        </button>
        <button
          data-nora-upload
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#E0FE10] text-black text-sm font-semibold hover:brightness-95"
        >
          <UploadCloud className="w-4 h-4" /> Upload files
        </button>
        <button
          data-nora-note
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

      {/* Chat with Nora */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <NoraChatPanel
              coachId={coachId}
              coachName={coachName}
              athletes={athletes}
              onClose={() => setChatOpen(false)}
              onNoteSaved={refresh}
            />
          </motion.div>
        )}
      </AnimatePresence>

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
        data-nora-dropzone
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
// Nora chat (train + insight)
// ---------------------------------------------------------------------------

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  savedNote?: { id: string; title: string; category?: string | null } | null;
};

const CHAT_SUGGESTIONS = [
  'How is the team doing this week?',
  'Who should I check on?',
  'Remember: team meeting moved to 8 AM Mondays.',
];

const NoraChatPanel: React.FC<{
  coachId?: string;
  coachName?: string;
  athletes: CoachAthlete[];
  onClose: () => void;
  onNoteSaved: () => void;
}> = ({ coachId, coachName, athletes, onClose, onNoteSaved }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const digest = useMemo(
    () =>
      athletes.map((a) => ({
        id: a.id,
        displayName: a.displayName,
        status: deriveStatus(a),
        sentimentScore: a.sentimentScore,
        conversationCount: a.conversationCount,
        totalSessions: a.totalSessions,
        lastActiveDays: daysSince(a.lastActiveDate),
      })),
    [athletes]
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending || !coachId) return;
    setChatError(null);
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    const next: ChatMessage = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, next]);
    setInput('');
    setSending(true);
    try {
      const res = await fetch('/api/pulsecheck/functions/coach-nora-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId,
          coachName,
          message: trimmed,
          history,
          athletes: digest,
        }),
      });
      if (!res.ok) throw new Error(`Nora is unavailable right now (${res.status}).`);
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply || '…', savedNote: data.savedNote || null },
      ]);
      if (data.savedNote) onNoteSaved();
    } catch (err: any) {
      setChatError(err?.message || 'Something went wrong reaching Nora.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-purple-500/25 bg-[#0d0d1a]/95 backdrop-blur-xl shadow-[0_24px_70px_rgba(0,0,0,0.55)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-purple-500/15">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Brain className="w-4 h-4 text-purple-400" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-white">Chat with Nora</div>
            <div className="text-[10px] text-zinc-500">
              Train her live, or ask about your athletes
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60"
          aria-label="Close chat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Thread */}
      <div ref={scrollRef} className="max-h-[360px] overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400 leading-relaxed">
              Tell me something to remember — like a schedule change or a team policy — and I&apos;ll
              add it to the vault. Or ask how your athletes are doing; I talk with them every day.
            </p>
            <div className="flex flex-wrap gap-2">
              {CHAT_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-[11px] px-2.5 py-1.5 rounded-full bg-zinc-800/60 border border-zinc-700/40 text-zinc-300 hover:border-purple-500/40 hover:text-purple-300 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-[#E0FE10] text-black'
                  : 'bg-zinc-800/70 border border-zinc-700/40 text-zinc-100'
              }`}
            >
              <div className="whitespace-pre-wrap">{m.content}</div>
              {m.savedNote && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-purple-300 bg-purple-500/15 border border-purple-500/25 rounded-lg px-2 py-1">
                  <Check className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">Added to vault: {m.savedNote.title}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-zinc-800/70 border border-zinc-700/40 rounded-2xl px-3.5 py-2.5">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" />
              </div>
            </div>
          </div>
        )}
      </div>

      {chatError && (
        <div className="px-4 pb-2 text-[11px] text-red-400">{chatError}</div>
      )}

      {/* Composer */}
      <div className="flex items-end gap-2 px-4 py-3 border-t border-purple-500/15">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Message Nora… (e.g. “Remember the bus leaves at 6 AM Saturday.”)"
          rows={1}
          className="flex-1 resize-none bg-zinc-900/60 border border-zinc-700/40 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/40 max-h-32"
        />
        <button
          onClick={() => send(input)}
          disabled={sending || !input.trim()}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white disabled:opacity-40 hover:brightness-110 transition flex-shrink-0"
          aria-label="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Floating "Ask Nora" bubble — persistent chat entry point, bottom-left so it
// never collides with the bottom-right training card. Opens the same Nora chat
// panel in a popover.
// ---------------------------------------------------------------------------

const NoraChatFab: React.FC<{
  coachId?: string;
  coachName?: string;
  athletes: CoachAthlete[];
}> = ({ coachId, coachName, athletes }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-24 left-5 z-[58] w-[370px] max-w-[calc(100vw-2.5rem)]"
          >
            <NoraChatPanel
              coachId={coachId}
              coachName={coachName}
              athletes={athletes}
              onClose={() => setOpen(false)}
              onNoteSaved={() => {}}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        data-nora-chat-fab
        onClick={() => setOpen((o) => !o)}
        aria-label="Ask Nora"
        className="fixed bottom-5 left-5 z-[58] flex items-center gap-2.5 rounded-full border border-purple-400/30 bg-[#0d0d1a]/90 py-2 pl-2 pr-4 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur transition-colors hover:border-purple-400/60"
      >
        <span className="relative flex h-8 w-8 flex-none items-center justify-center">
          <span
            className="h-8 w-8 rounded-full"
            style={{
              background:
                'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.55), #a78bfa 45%, #6d28d9 100%)',
              boxShadow: '0 0 14px rgba(167,139,250,0.5)',
            }}
          />
          {!open && (
            <span
              className="absolute inset-0 animate-ping rounded-full opacity-40"
              style={{ background: 'rgba(167,139,250,0.5)' }}
            />
          )}
        </span>
        <span className="text-sm font-semibold text-white">{open ? 'Close' : 'Ask Nora'}</span>
      </button>
    </>
  );
};

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

// Shared row chrome for a delivered-report list item (demo + live).
const ReportRow: React.FC<{
  onClick: () => void;
  accent: string;
  title: string;
  isLatest?: boolean;
  cadenceLabel?: string;
  meta: React.ReactNode;
}> = ({ onClick, accent, title, isLatest, cadenceLabel, meta }) => (
  <button
    data-report-row
    onClick={onClick}
    className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-zinc-900/50 p-4 text-left transition hover:-translate-y-0.5 hover:border-zinc-600 hover:bg-zinc-900/80"
  >
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
      style={{ background: `${accent}1f`, color: accent }}
    >
      <FileText className="h-5 w-5" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-white">{title}</span>
        {isLatest && (
          <span className="rounded-full border border-[#E0FE10]/20 bg-[#E0FE10]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#E0FE10]">
            Latest
          </span>
        )}
        {cadenceLabel && (
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
            {cadenceLabel}
          </span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">{meta}</div>
    </div>
    <ArrowRight className="h-4 w-4 shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-zinc-300" />
  </button>
);

const ReportsArchiveHeader: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div>
    <div className="text-lg font-bold text-white">Reports</div>
    <p className="text-sm text-zinc-400 mt-1 max-w-2xl leading-relaxed">{children}</p>
  </div>
);

// --- Demo archive -----------------------------------------------------------
// A coach's Reports tab is the archive of every report delivered to *their* team —
// one team, one sport, weekly or daily per their provisioning. The demo coach is set
// to a weekly read; we synthesize a believable delivery history and render the full
// report inline on click so a coach can be walked through how to read one. (Live
// archives load from Firestore — see ReportsSection below.)
const DEMO_REPORT_SPORT_ID = 'basketball';
// Institution + team for the demo coach's archive. Mirrors a provisioned team
// (organization · team) so the report header reads natively. The sport icon is
// resolved from the SportConfiguration lookup, not hardcoded.
const DEMO_REPORT_ORG_NAME = 'The Athletic Mind Council';
const DEMO_REPORT_TEAM_NAME = "Men's Basketball";

type DemoDeliveredReport = {
  id: string;
  weekLabel: string;
  deliveredAt: Date;
  deliveredLabel: string;
  adherencePct: number;
  followUps: number;
  isLatest: boolean;
};

const buildDemoDeliveredReports = (): DemoDeliveredReport[] => {
  const fmtDay = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const fmtFull = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  // Anchor on the most recent Sunday so deliveries read like a real weekly cadence.
  const anchor = new Date();
  anchor.setHours(0, 0, 0, 0);
  anchor.setDate(anchor.getDate() - anchor.getDay());
  return Array.from({ length: 10 }).map((_, i) => {
    const deliveredAt = new Date(anchor);
    deliveredAt.setDate(anchor.getDate() - i * 7);
    const weekEnd = new Date(deliveredAt);
    weekEnd.setDate(deliveredAt.getDate() - 1);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    return {
      id: `demo-weekly-${i}`,
      weekLabel: `Week of ${fmtDay(weekStart)} – ${fmtDay(weekEnd)}, ${weekEnd.getFullYear()}`,
      deliveredAt,
      deliveredLabel: fmtFull(deliveredAt),
      adherencePct: Math.round((0.84 - (i % 4) * 0.04) * 100),
      followUps: i % 3,
      isLatest: i === 0,
    };
  });
};

const DemoReportsArchive: React.FC = () => {
  const reports = useMemo(buildDemoDeliveredReports, []);
  const sport = useMemo(
    () => getDefaultPulseCheckSports().find((s) => s.id === DEMO_REPORT_SPORT_ID),
    [],
  );
  const demo = COACH_REPORT_DEMO_EXAMPLES[DEMO_REPORT_SPORT_ID];
  const accent = getSportColor(DEMO_REPORT_SPORT_ID).primary;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(() => reports.find((r) => r.id === selectedId) || null, [reports, selectedId]);

  if (selected && sport && demo) {
    const surface = buildDemoCoachSurface(demo, sport, selected.deliveredLabel);
    // Make the opened report match the row the coach clicked, and read as this
    // coach's own team. Shallow-clone the adherence block so we never mutate the
    // shared fixture.
    surface.meta.weekLabel = selected.weekLabel;
    surface.meta.organizationName = DEMO_REPORT_ORG_NAME;
    surface.meta.teamName = DEMO_REPORT_TEAM_NAME;
    surface.adherence = { ...surface.adherence, overallAdherencePct: selected.adherencePct / 100 };
    // Bleed the dashboard content padding so the report fills the view natively.
    return (
      <div className="-mx-4 -mt-6 sm:-mx-6">
        <div className="px-4 pb-3 pt-4 sm:px-6">
          <button
            onClick={() => setSelectedId(null)}
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            All reports
          </button>
        </div>
        <CoachReportView embedded report={surface} sport={sport} generatedAtLabel={selected.deliveredLabel} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ReportsArchiveHeader>
        Every Sports Intelligence report delivered to your team, newest first. Your team is on a{' '}
        <span className="font-medium text-zinc-200">weekly</span> read — cadence (weekly or daily) is set during
        onboarding. Open any report to see the full read.
      </ReportsArchiveHeader>

      <div className="grid gap-3">
        {reports.map((r) => (
          <ReportRow
            key={r.id}
            onClick={() => setSelectedId(r.id)}
            accent={accent}
            title={r.weekLabel}
            isLatest={r.isLatest}
            cadenceLabel="Weekly"
            meta={(
              <>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Delivered {r.deliveredLabel}
                </span>
                <span>{r.adherencePct}% adherence</span>
                <span>{r.followUps === 0 ? 'No follow-ups' : `${r.followUps} follow-up${r.followUps > 1 ? 's' : ''}`}</span>
              </>
            )}
          />
        ))}
      </div>
    </div>
  );
};

const formatDeliveredDate = (d?: Date) =>
  d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date pending';

const ReportsSection: React.FC<{ coachId?: string; isDemo?: boolean }> = ({ coachId, isDemo }) => {
  const router = useRouter();
  const [reports, setReports] = useState<CoachReportListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (isDemo || !coachId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    listSentSportsIntelligenceReportsForCoach(coachId)
      .then((rs) => {
        if (!cancelled) setReports(rs);
      })
      .catch(() => {
        if (!cancelled) setReports([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [coachId, isDemo]);

  // Demo dashboards have no live archive — synthesize a delivery history instead.
  if (isDemo) return <DemoReportsArchive />;

  if (loading) return <LoadingBlock label="Loading reports…" />;

  if (reports.length === 0) {
    return (
      <EmptyBlock
        icon={BarChart3}
        title="No reports yet"
        body="Every Sports Intelligence report delivered to your team will appear here, newest first."
      />
    );
  }

  return (
    <div className="space-y-5">
      <ReportsArchiveHeader>
        Every Sports Intelligence report delivered to your team, newest first. Open any report to see the full read.
      </ReportsArchiveHeader>

      <div className="grid gap-3">
        {reports.map((report, index) => (
          <ReportRow
            key={`${report.teamId}-${report.reportId}`}
            onClick={() => router.push(report.href)}
            accent="#E0FE10"
            title={report.weekLabel || report.title || 'Sports Intelligence Report'}
            isLatest={index === 0}
            meta={(
              <>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Delivered{' '}
                  {formatDeliveredDate(report.sentAt || report.publishedAt || report.generatedAt)}
                </span>
                {typeof report.adherence?.overallAdherencePct === 'number' && (
                  <span>{Math.round(report.adherence.overallAdherencePct)}% adherence</span>
                )}
                {report.teamName && <span className="text-zinc-600">{report.teamName}</span>}
              </>
            )}
          />
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Earnings — referral kickback (revenue recipient only)
// ---------------------------------------------------------------------------

const PRO_PRICE = 4.99;

type Conversion = {
  id: string;
  name: string;
  initials: string;
  plan: string;
  monthly: number;
  cut: number;
  date: Date;
};

const EarningsSection: React.FC<{ athletes: CoachAthlete[]; isDemo?: boolean; revenueSharePct?: number }> = ({
  athletes,
  isDemo,
  revenueSharePct = 0,
}) => {
  // Demo defaults to a 20% share if provisioning hasn't set one, so the tab demonstrates real numbers.
  const share = isDemo && !revenueSharePct ? 20 : revenueSharePct;
  const fmt = (n: number) => `$${n.toFixed(2)}`;

  const conversions = useMemo<Conversion[]>(() => {
    if (!isDemo) return [];
    return athletes
      .filter((a) => a.conversationCount > 0 && deriveStatus(a) !== 'pending')
      .filter((_, i) => i % 2 === 0)
      .slice(0, 8)
      .map((a, i) => ({
        id: a.id,
        name: a.displayName,
        initials: initialsOf(a.displayName),
        plan: 'Pulse Pro',
        monthly: PRO_PRICE,
        cut: +(PRO_PRICE * (share / 100)).toFixed(2),
        date: new Date(Date.now() - (i * 4 + 1) * 86400000),
      }));
  }, [athletes, isDemo, share]);

  const monthlyKickback = useMemo(() => conversions.reduce((sum, c) => sum + c.cut, 0), [conversions]);
  const lifetime = +(monthlyKickback * 6.5).toFixed(2);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#E0FE10]/20 bg-gradient-to-br from-[#E0FE10]/8 to-green-500/5 p-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-[#E0FE10]/15 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-[#E0FE10]" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Earnings</div>
            <div className="text-xs text-zinc-500">Your referral kickback from athlete-paid conversions</div>
          </div>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">
          When an athlete you invited subscribes to a paid plan,{' '}
          <span className="text-[#E0FE10] font-medium">{share}%</span> of their subscription routes back to you.
          Earnings update as athletes convert and renew.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="This month" value={fmt(monthlyKickback)} accent />
        <StatTile label="Lifetime" value={fmt(lifetime)} />
        <StatTile label="Converted referrals" value={conversions.length} dot="bg-green-400" />
        <StatTile label="Revenue share" value={`${share}%`} />
      </div>

      <div>
        <div className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Recent conversions</div>
        {conversions.length === 0 ? (
          <EmptyBlock
            icon={TrendingUp}
            title="No conversions yet"
            body="When athletes you invited subscribe to a paid plan, their conversions and your kickback show up here."
          />
        ) : (
          <div className="space-y-2">
            {conversions.map((c) => {
              const stale = daysSince(c.date);
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/30"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E0FE10]/25 to-green-500/15 border border-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-[#E0FE10]">{c.initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{c.name}</div>
                    <div className="text-xs text-zinc-500">
                      {c.plan} · {fmt(c.monthly)}/mo · {stale === 0 ? 'today' : `${stale}d ago`}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-[#E0FE10]">+{fmt(c.cut)}</div>
                    <div className="text-[10px] text-zinc-500">/mo</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Library / Schedule / Settings (lean but functional shells)
// ---------------------------------------------------------------------------

const ScheduleSection: React.FC<{ coachId?: string; isDemo?: boolean }> = ({ coachId, isDemo }) => (
  <ScheduleBoard coachId={coachId} isDemo={isDemo} />
);

const LocalFirebaseEnvironmentPanel: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [isLocal, setIsLocal] = useState(false);
  const [isDev, setIsDev] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [switchingTo, setSwitchingTo] = useState<'dev' | 'prod' | null>(null);

  useEffect(() => {
    const local = isLocalFirebaseRuntime();
    setMounted(true);
    setIsLocal(local);
    if (local) {
      setIsDev(isUsingDevFirebase());
      setProjectId(getActiveFirebaseProjectId());
    }
  }, []);

  if (!mounted || !isLocal) return null;

  const selectMode = (nextIsDev: boolean) => {
    if (nextIsDev === isDev || switchingTo) return;
    const nextMode = nextIsDev ? 'dev' : 'prod';
    setPreferredFirebaseMode(nextIsDev);
    setIsDev(nextIsDev);
    setProjectId(getActiveFirebaseProjectId());
    setSwitchingTo(nextMode);
    window.setTimeout(() => window.location.reload(), 250);
  };

  const optionClass = (selected: boolean, tone: 'dev' | 'prod') =>
    [
      'h-9 flex-1 rounded-md px-3 text-xs font-semibold transition border',
      selected
        ? tone === 'dev'
          ? 'bg-amber-400/18 border-amber-300/40 text-amber-100'
          : 'bg-emerald-400/18 border-emerald-300/40 text-emerald-100'
        : 'bg-transparent border-transparent text-zinc-400 hover:text-white hover:bg-white/5',
    ].join(' ');

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Database className="h-4 w-4 text-[#E0FE10]" />
            <span>Firebase environment</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
              Local
            </span>
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            Project <span className="font-mono text-zinc-300">{projectId || '—'}</span>
          </div>
        </div>

        <div className="flex w-full max-w-sm items-center gap-1 rounded-lg border border-white/10 bg-black/25 p-1">
          <button
            type="button"
            aria-pressed={isDev}
            disabled={!!switchingTo}
            onClick={() => selectMode(true)}
            className={optionClass(isDev, 'dev')}
          >
            Development
          </button>
          <button
            type="button"
            aria-pressed={!isDev}
            disabled={!!switchingTo}
            onClick={() => selectMode(false)}
            className={optionClass(!isDev, 'prod')}
          >
            Production
          </button>
        </div>
      </div>

      {switchingTo && (
        <div className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          <span>Reloading into {switchingTo === 'dev' ? 'development' : 'production'}...</span>
        </div>
      )}
    </div>
  );
};

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
    <LocalFirebaseEnvironmentPanel />
  </div>
);

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------

const StatTile: React.FC<{ label: string; value: number | string; accent?: boolean; dot?: string; id?: string }> = ({
  label,
  value,
  accent,
  dot,
  id,
}) => (
  <div id={id} className="rounded-xl bg-zinc-900/50 border border-white/5 p-4">
    <div className="flex items-center gap-2 mb-1">
      {dot && <span className={`w-2 h-2 rounded-full ${dot}`} />}
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
    <div className={`text-2xl font-bold ${accent ? 'text-[#E0FE10]' : 'text-white'}`}>{value}</div>
  </div>
);

// Adherence — are athletes actually doing what they're supposed to? Tracks
// check-ins, device wear, and module (simulation + protocol) completion.
// NOTE: check-in % is derived from real status; device & module % currently use
// activity proxies until per-athlete device/module telemetry is wired in.
const AdherenceTile: React.FC<{
  id?: string;
  checkIn: number;
  device: number;
  modules?: number;
  athletes?: CoachAthlete[];
}> = ({ id, checkIn, device, modules, athletes = [] }) => {
  const rows: { label: string; value: number }[] = [
    { label: 'Checked in', value: checkIn },
    { label: 'Device worn', value: device },
    ...(modules !== undefined ? [{ label: 'Modules done', value: modules }] : []),
  ];
  const overall = Math.round(rows.reduce((s, r) => s + r.value, 0) / rows.length);
  const deviceStatuses = athletes.map((athlete) => ({
    athlete,
    status: athlete.deviceStatus,
  }));
  const connectedCount = deviceStatuses.filter(({ status }) => status && status.connectionStatus !== 'not_connected').length;
  const withDataCount = deviceStatuses.filter(({ status }) => (status?.wearDaysCovered ?? 0) > 0).length;
  const staleCount = deviceStatuses.filter(({ status }) => status?.connectionStatus === 'stale').length;
  const sortedDeviceStatuses = [...deviceStatuses].sort((left, right) => {
    const leftPct = left.status?.wearCoveragePct ?? -1;
    const rightPct = right.status?.wearCoveragePct ?? -1;
    return leftPct - rightPct;
  });
  return (
    <div id={id} className="group relative rounded-xl bg-zinc-900/50 border border-white/5 p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full bg-[#E0FE10]" />
        <span className="text-xs text-zinc-500">Adherence</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-white">{overall}</span>
        <span className="text-sm font-semibold text-zinc-500">%</span>
      </div>
      <div className="mt-2 space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            <span className="w-[68px] flex-none text-[10px] uppercase tracking-wide text-zinc-500">{r.label}</span>
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-700/40">
              <span className="block h-full rounded-full bg-[#E0FE10]/70" style={{ width: `${r.value}%` }} />
            </span>
            <span className="w-7 flex-none text-right text-[10px] font-medium text-zinc-400">{r.value}%</span>
          </div>
        ))}
      </div>
      {athletes.length > 0 && (
        <div className="pointer-events-none absolute right-0 top-full z-40 mt-2 w-80 rounded-xl border border-white/10 bg-zinc-950/95 p-3 opacity-0 shadow-2xl backdrop-blur transition group-hover:opacity-100">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
            <div>
              <div className="text-xs font-semibold text-white">Device adherence</div>
              <div className="text-[10px] text-zinc-500">Visible athletes, last 14 days</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-white">{device}%</div>
              <div className="text-[10px] text-zinc-600">avg coverage</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 py-2">
            <MetricTile label="Connected" value={`${connectedCount}/${athletes.length}`} />
            <MetricTile label="With data" value={`${withDataCount}/${athletes.length}`} />
            <MetricTile label="Stale" value={staleCount} />
          </div>

          <div className="space-y-2">
            {sortedDeviceStatuses.slice(0, 6).map(({ athlete, status }) => {
              const label = status?.currentDeviceLabel || 'No device';
              const pct = status?.wearCoveragePct ?? athlete.deviceCoveragePct ?? 0;
              return (
                <div key={athlete.id} className="rounded-lg border border-white/5 bg-white/[0.03] p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-semibold text-zinc-200">{athlete.displayName}</div>
                      <div className="truncate text-[10px] text-zinc-500">
                        {label} · {deviceConnectionLabel(status)}
                      </div>
                    </div>
                    <div className={`text-[11px] font-bold ${deviceToneClass(status)}`}>{pct}%</div>
                  </div>
                  <div className="mt-1.5">
                    <DevicePresenceStrip presence={status?.dailyPresence || athlete.deviceDailyPresence} compact />
                  </div>
                </div>
              );
            })}
            {sortedDeviceStatuses.length > 6 && (
              <div className="text-center text-[10px] text-zinc-500">
                +{sortedDeviceStatuses.length - 6} more athletes
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

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

export default CoachDashboard;
