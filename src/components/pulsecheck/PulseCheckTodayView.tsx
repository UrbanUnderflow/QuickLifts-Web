import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Brain, CalendarDays, Loader2, ShieldCheck, Sparkles, Target, Waves, Zap, Building2, Users, ChevronRight } from 'lucide-react';
import { pulseCheckProvisioningService } from '../../api/firebase/pulsecheckProvisioning/service';
import type { PulseCheckTeamMembership } from '../../api/firebase/pulsecheckProvisioning/types';
import {
  assignmentOrchestratorService,
  CheckInType,
  completionService,
  PulseCheckDailyAssignmentStatus,
} from '../../api/firebase/mentaltraining';
import type { ExerciseCompletion, PulseCheckDailyAssignment } from '../../api/firebase/mentaltraining/types';
import { useUser, useUserLoading } from '../../hooks/useUser';
import PulseCheckAccessHub, { teamDestinationForMembership } from './PulseCheckAccessHub';

type ReadinessLevel = 'drained' | 'low' | 'okay' | 'solid' | 'locked';

type ReadinessOption = {
  id: ReadinessLevel;
  score: number;
  label: string;
  emoji: string;
  chip: string;
  accentColor: string;
  accentGlow: string;
  response: string;
};

const READINESS_OPTIONS: ReadinessOption[] = [
  {
    id: 'drained',
    score: 1,
    label: 'Drained',
    emoji: '🪫',
    chip: 'Recovery posture',
    accentColor: '#EF4444',
    accentGlow: 'rgba(239,68,68,0.15)',
    response: 'Today stays short. One reset rep, one honest check-in, and let recovery count as training.',
  },
  {
    id: 'low',
    score: 2,
    label: 'Low',
    emoji: '😕',
    chip: 'Stabilize first',
    accentColor: '#F59E0B',
    accentGlow: 'rgba(245,158,11,0.15)',
    response: 'We stay steady today. Nora can help you downshift and keep execution simple before pressure rises.',
  },
  {
    id: 'okay',
    score: 3,
    label: 'Okay',
    emoji: '😐',
    chip: 'Baseline day',
    accentColor: '#FBBF24',
    accentGlow: 'rgba(251,191,36,0.15)',
    response: 'You have enough to build from. Run the standard rep, get honest signal, then decide if you press further.',
  },
  {
    id: 'solid',
    score: 4,
    label: 'Solid',
    emoji: '💪',
    chip: 'Build momentum',
    accentColor: '#10B981',
    accentGlow: 'rgba(16,185,129,0.15)',
    response: 'Good energy today. Use it deliberately and turn it into one focused rep with Nora before you move on.',
  },
  {
    id: 'locked',
    score: 5,
    label: 'Locked In',
    emoji: '🔥',
    chip: 'Prime mode',
    accentColor: '#E0FE10',
    accentGlow: 'rgba(224,254,16,0.15)',
    response: 'This is a pressure-ready day. Nora can help you turn that edge into a sharper, more intentional session.',
  },
];

const partOfDay = (date: Date) => {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const longDate = (date: Date) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(date);

const todayDateKey = () => new Date().toISOString().split('T')[0];

const shortDateTime = (timestamp: number) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(
    new Date(timestamp)
  );

const relativeUpdateLabel = (timestamp: number) => {
  const now = new Date();
  const then = new Date(timestamp);
  const sameDay = now.toDateString() === then.toDateString();

  if (sameDay) {
    return `Today · ${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(then)}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (yesterday.toDateString() === then.toDateString()) {
    return `Yesterday · ${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(then)}`;
  }

  return shortDateTime(timestamp);
};

const humanizeAssignmentLabel = (value?: string | null) => {
  if (!value) return 'Nora task';
  return value.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
};

const assignmentStatusLabel = (status: PulseCheckDailyAssignmentStatus) => {
  switch (status) {
    case PulseCheckDailyAssignmentStatus.Assigned:
      return 'Assigned';
    case PulseCheckDailyAssignmentStatus.Viewed:
      return 'Viewed';
    case PulseCheckDailyAssignmentStatus.Started:
      return 'Started';
    case PulseCheckDailyAssignmentStatus.Completed:
      return 'Completed';
    case PulseCheckDailyAssignmentStatus.Overridden:
      return 'Coach adjusted';
    case PulseCheckDailyAssignmentStatus.Deferred:
      return 'Deferred';
    case PulseCheckDailyAssignmentStatus.Superseded:
      return 'Superseded';
    default:
      return 'Assigned';
  }
};

const assignmentActionLabel = (assignment: PulseCheckDailyAssignment | null) => {
  if (!assignment) return 'No Nora task yet';
  if (assignment.actionType === 'defer') return 'Pause for today';
  if (assignment.simSpecId) return humanizeAssignmentLabel(assignment.simSpecId);
  if (assignment.legacyExerciseId) return humanizeAssignmentLabel(assignment.legacyExerciseId);
  if (assignment.sessionType) return humanizeAssignmentLabel(assignment.sessionType);
  return assignment.actionType === 'lighter_sim' ? 'Lighter sim' : 'Sim';
};

const isLaunchableAssignment = (assignment: PulseCheckDailyAssignment | null) =>
  Boolean(
    assignment &&
      assignment.actionType !== 'defer' &&
      (
        assignment.status === PulseCheckDailyAssignmentStatus.Assigned ||
        assignment.status === PulseCheckDailyAssignmentStatus.Viewed ||
        assignment.status === PulseCheckDailyAssignmentStatus.Started
      )
  );

const membershipPriority = (membership: PulseCheckTeamMembership) => {
  switch (membership.role) {
    case 'team-admin':
      return 0;
    case 'coach':
      return 1;
    case 'performance-staff':
      return 2;
    case 'support-staff':
      return 3;
    case 'athlete':
      return 4;
    default:
      return 5;
  }
};

// ─────────────────────────────────────────────────────────
// GLASS CARD COMPONENT — Chromatic Glass design language
// ─────────────────────────────────────────────────────────
const GlassCard: React.FC<{
  children: React.ReactNode;
  accentColor?: string;
  delay?: number;
  className?: string;
  hoverLift?: boolean;
  onClick?: () => void;
}> = ({ children, accentColor = '#E0FE10', delay = 0, className = '', hoverLift = true, onClick }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={hoverLift ? { y: -4, scale: 1.01 } : undefined}
      className={`relative group ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {/* Chromatic glow background — only on hover */}
      <div
        className="absolute -inset-1 rounded-[28px] blur-xl opacity-0 group-hover:opacity-30 transition-all duration-700"
        style={{ background: `linear-gradient(135deg, ${accentColor}40, transparent 60%)` }}
      />

      {/* Glass surface */}
      <div
        className="relative rounded-[28px] overflow-hidden backdrop-blur-xl border border-white/[0.08]"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
          boxShadow: `0 20px 80px rgba(0,0,0,0.35), 0 1px 0 inset rgba(255,255,255,0.06)`,
        }}
      >
        {/* Chromatic reflection line at top */}
        <div
          className="absolute top-0 left-0 right-0 h-[1px] opacity-50"
          style={{ background: `linear-gradient(90deg, transparent 10%, ${accentColor}60, transparent 90%)` }}
        />

        {/* Inner highlight gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent pointer-events-none" />

        {children}
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────
// FLOATING ORB — background ambience
// ─────────────────────────────────────────────────────────
const FloatingOrb: React.FC<{
  color: string;
  size: number;
  position: React.CSSProperties;
  delay?: number;
}> = ({ color, size, position, delay = 0 }) => (
  <motion.div
    className="absolute rounded-full blur-3xl pointer-events-none"
    style={{
      backgroundColor: color,
      width: size,
      height: size,
      ...position,
    }}
    animate={{
      scale: [1, 1.15, 1],
      opacity: [0.18, 0.3, 0.18],
    }}
    transition={{
      duration: 10,
      repeat: Infinity,
      delay,
      ease: 'easeInOut',
    }}
  />
);

// ─────────────────────────────────────────────────────────
// STAT TILE — small metric cards
// ─────────────────────────────────────────────────────────
const StatTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  accentColor: string;
  delay?: number;
}> = ({ icon, label, value, accentColor, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    className="relative group"
  >
    <div
      className="rounded-2xl border border-white/[0.06] p-4 backdrop-blur-sm transition-all duration-300 hover:border-white/[0.12]"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
        boxShadow: `0 8px 32px rgba(0,0,0,0.3)`,
      }}
    >
      <div
        className="mb-3 inline-flex rounded-xl p-2.5 border"
        style={{
          borderColor: `${accentColor}25`,
          background: `${accentColor}10`,
        }}
      >
        {icon}
      </div>
      <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-medium">{label}</p>
      <p className="mt-1.5 text-lg font-semibold text-white">{value}</p>
    </div>
  </motion.div>
);

interface PulseCheckTodayViewProps {
  onOpenNora: () => void;
}

export default function PulseCheckTodayView({ onOpenNora }: PulseCheckTodayViewProps) {
  const currentUser = useUser();
  const currentUserLoading = useUserLoading();
  const [memberships, setMemberships] = useState<PulseCheckTeamMembership[]>([]);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [selectedReadiness, setSelectedReadiness] = useState<ReadinessLevel | null>(null);
  const [checkInLoading, setCheckInLoading] = useState(true);
  const [checkInSaving, setCheckInSaving] = useState(false);
  const [todaysCheckInAt, setTodaysCheckInAt] = useState<number | null>(null);
  const [currentDailyAssignment, setCurrentDailyAssignment] = useState<PulseCheckDailyAssignment | null>(null);
  const [assignmentLoading, setAssignmentLoading] = useState(true);
  const [latestCompletion, setLatestCompletion] = useState<ExerciseCompletion | null>(null);
  const [recentSessionHistory, setRecentSessionHistory] = useState<ExerciseCompletion[]>([]);

  const refreshTodayAssignment = async (userId: string) => {
    const assignment = await assignmentOrchestratorService.getForAthleteOnDate(userId, todayDateKey());
    setCurrentDailyAssignment(assignment);
    return assignment;
  };

  useEffect(() => {
    if (currentUserLoading) return;
    if (!currentUser?.id) {
      setMembershipLoading(false);
      setMemberships([]);
      return;
    }

    let active = true;
    setMembershipLoading(true);

    pulseCheckProvisioningService
      .listUserTeamMemberships(currentUser.id)
      .then((nextMemberships) => {
        if (active) {
          setMemberships(nextMemberships);
        }
      })
      .catch((error) => {
        console.error('[PulseCheck today] Failed to load team memberships:', error);
        if (active) {
          setMemberships([]);
        }
      })
      .finally(() => {
        if (active) {
          setMembershipLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [currentUser?.id, currentUserLoading]);

  useEffect(() => {
    if (currentUserLoading) return;
    if (!currentUser?.id) {
      setCurrentDailyAssignment(null);
      setAssignmentLoading(false);
      return;
    }

    let active = true;
    setAssignmentLoading(true);

    assignmentOrchestratorService
      .getForAthleteOnDate(currentUser.id, todayDateKey())
      .then((assignment) => {
        if (active) {
          setCurrentDailyAssignment(assignment);
        }
      })
      .catch((error) => {
        console.error('[PulseCheck today] Failed to load today assignment:', error);
        if (active) {
          setCurrentDailyAssignment(null);
        }
      })
      .finally(() => {
        if (active) {
          setAssignmentLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [currentUser?.id, currentUserLoading]);

  useEffect(() => {
    if (currentUserLoading) return;
    if (!currentUser?.id) {
      setSelectedReadiness(null);
      setTodaysCheckInAt(null);
      setCheckInLoading(false);
      return;
    }

    let active = true;
    setCheckInLoading(true);

    completionService
      .getTodaysCheckIns(currentUser.id)
      .then((checkIns) => {
        if (!active) return;
        const latestCheckIn = [...checkIns].sort((left, right) => right.createdAt - left.createdAt)[0] || null;
        if (!latestCheckIn) {
          setSelectedReadiness(null);
          setTodaysCheckInAt(null);
          return;
        }

        const matchingOption = READINESS_OPTIONS.find((option) => option.score === latestCheckIn.readinessScore) || null;
        setSelectedReadiness(matchingOption?.id || null);
        setTodaysCheckInAt(latestCheckIn.createdAt || null);
      })
      .catch((error) => {
        console.error('[PulseCheck today] Failed to load today check-in:', error);
        if (active) {
          setSelectedReadiness(null);
          setTodaysCheckInAt(null);
        }
      })
      .finally(() => {
        if (active) {
          setCheckInLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [currentUser?.id, currentUserLoading]);

  useEffect(() => {
    if (currentUserLoading) return;
    if (!currentUser?.id) {
      setLatestCompletion(null);
      return;
    }

    let active = true;

    completionService
      .getLatestCompletion(currentUser.id)
      .then((completion) => {
        if (active) {
          setLatestCompletion(completion);
        }
      })
      .catch((error) => {
        console.error('[PulseCheck today] Failed to load latest session summary:', error);
        if (active) {
          setLatestCompletion(null);
        }
      });

    return () => {
      active = false;
    };
  }, [currentUser?.id, currentUserLoading]);

  useEffect(() => {
    if (currentUserLoading) return;
    if (!currentUser?.id) {
      setRecentSessionHistory([]);
      return;
    }

    let active = true;

    completionService
      .getCompletions(currentUser.id, 4)
      .then((completions) => {
        if (active) {
          setRecentSessionHistory(completions.filter((completion) => completion.sessionSummary));
        }
      })
      .catch((error) => {
        console.error('[PulseCheck today] Failed to load session history:', error);
        if (active) {
          setRecentSessionHistory([]);
        }
      });

    return () => {
      active = false;
    };
  }, [currentUser?.id, currentUserLoading, latestCompletion?.id]);

  const greetingName =
    (currentUser as any)?.preferredName ||
    currentUser?.displayName ||
    currentUser?.username ||
    'Athlete';

  const selectedReadinessOption = useMemo(
    () => READINESS_OPTIONS.find((option) => option.id === selectedReadiness) || null,
    [selectedReadiness]
  );

  const primaryMembership = useMemo(() => {
    return [...memberships].sort((left, right) => membershipPriority(left) - membershipPriority(right))[0] || null;
  }, [memberships]);

  const primaryDestination = primaryMembership ? teamDestinationForMembership(primaryMembership) : null;

  const handleSelectReadiness = (option: ReadinessOption) => {
    if (!currentUser?.id || checkInSaving) return;

    setSelectedReadiness(option.id);
    setCheckInSaving(true);

    completionService
      .recordCheckIn({
        userId: currentUser.id,
        type: CheckInType.Morning,
        readinessScore: option.score,
        moodWord: option.label,
        notes: 'PulseCheck web Today daily check-in',
      })
      .then(() => {
        setTodaysCheckInAt(Date.now());
        return refreshTodayAssignment(currentUser.id);
      })
      .catch((error) => {
        console.error('[PulseCheck today] Failed to save daily check-in:', error);
        setSelectedReadiness(null);
        setTodaysCheckInAt(null);
        setCurrentDailyAssignment(null);
      })
      .finally(() => {
        setCheckInSaving(false);
      });
  };

  const handleOpenNoraWithAssignment = async () => {
    try {
      if (currentDailyAssignment?.id) {
        await assignmentOrchestratorService.markViewed(currentDailyAssignment.id);
        const refreshed = await assignmentOrchestratorService.getById(currentDailyAssignment.id);
        setCurrentDailyAssignment(refreshed);
      }
    } catch (error) {
      console.error('[PulseCheck today] Failed to mark daily assignment viewed:', error);
    } finally {
      onOpenNora();
    }
  };

  const handleJumpToAccessHub = () => {
    if (typeof window === 'undefined') return;
    document.getElementById('pulsecheck-access-hub-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const orgCount = new Set(memberships.map((m) => m.organizationId)).size;
  const canLaunchTodayTask = isLaunchableAssignment(currentDailyAssignment);
  const readinessStatusCopy = checkInLoading
    ? 'Checking whether today already has a saved check-in.'
    : selectedReadiness
      ? `Saved${todaysCheckInAt ? ` · ${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(todaysCheckInAt))}` : ''}${assignmentLoading ? ' · building today\'s task' : currentDailyAssignment ? ` · ${assignmentStatusLabel(currentDailyAssignment.status)}` : ''}`
      : 'Not completed yet';

  return (
    <div className="relative h-full overflow-y-auto" style={{ background: '#0a0a0b' }}>
      {/* ── BACKGROUND LAYER ── ambient floating orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <FloatingOrb color="#E0FE10" size={500} position={{ top: '-8%', left: '-6%' }} delay={0} />
        <FloatingOrb color="#3B82F6" size={400} position={{ top: '30%', right: '-8%' }} delay={3} />
        <FloatingOrb color="#8B5CF6" size={350} position={{ bottom: '5%', left: '15%' }} delay={5} />
        <FloatingOrb color="#EF4444" size={250} position={{ bottom: '-5%', right: '25%' }} delay={7} />

        {/* Noise texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=\")",
          }}
        />
      </div>

      {/* ── CONTENT LAYER ── */}
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-6 p-5 md:p-8">
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            HERO SECTION — greeting + stats
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <GlassCard accentColor="#E0FE10" delay={0.1} hoverLift={false}>
          <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.3fr)_340px] lg:p-8">
            {/* Left: Greeting */}
            <div className="space-y-5">
              {/* Today pill badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5"
                style={{
                  background: 'rgba(224,254,16,0.1)',
                  border: '1px solid rgba(224,254,16,0.25)',
                }}
              >
                <Sparkles className="h-3.5 w-3.5 text-[#E0FE10]" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#E0FE10]">
                  Today
                </span>
              </motion.div>

              <div className="space-y-3">
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-sm font-medium text-zinc-400"
                >
                  {partOfDay(new Date())}
                </motion.p>

                <motion.h2
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.6 }}
                  className="text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-[2.6rem] leading-[1.15]"
                >
                  {greetingName},{' '}
                  <span className="bg-gradient-to-r from-[#E0FE10] via-[#3B82F6]/80 to-[#8B5CF6]/60 bg-clip-text text-transparent">
                    this is your command center.
                  </span>
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="max-w-2xl text-[15px] leading-7 text-zinc-400"
                >
                  Orient to the day, check your mental readiness, and decide whether the next move is Nora or your team workspace.
                </motion.p>
              </div>
            </div>

            {/* Right: Stat tiles */}
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <StatTile
                icon={<CalendarDays className="h-4.5 w-4.5 text-[#E0FE10]" />}
                label="Today"
                value={longDate(new Date())}
                accentColor="#E0FE10"
                delay={0.4}
              />
              <StatTile
                icon={<Building2 className="h-4.5 w-4.5 text-[#3B82F6]" />}
                label="Organizations"
                value={membershipLoading ? '...' : String(orgCount)}
                accentColor="#3B82F6"
                delay={0.5}
              />
              <StatTile
                icon={<Users className="h-4.5 w-4.5 text-[#8B5CF6]" />}
                label="Teams"
                value={membershipLoading ? '...' : String(memberships.length)}
                accentColor="#8B5CF6"
                delay={0.6}
              />
            </div>
          </div>
        </GlassCard>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            READINESS + NORA + QUICK ACTIONS SECTION
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
          <div className="space-y-6">
            {/* ── READINESS CHECK-IN ── */}
            <GlassCard accentColor="#8B5CF6" delay={0.2} hoverLift={false}>
              <div className="p-6 lg:p-7">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5 mb-3">
                      <div
                        className="inline-flex rounded-xl p-2.5 border"
                        style={{
                          borderColor: 'rgba(139,92,246,0.25)',
                          background: 'rgba(139,92,246,0.1)',
                        }}
                      >
                        <Waves className="h-4.5 w-4.5 text-[#8B5CF6]" />
                      </div>
                      <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-medium">
                        Readiness Check-In
                      </p>
                    </div>
                    <h3 className="text-2xl font-bold text-white">Where is your head at today?</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                      Use one honest signal to set the tone. This is a real daily task now, and your answer becomes part of your PulseCheck profile signal.
                    </p>
                  </div>
                </div>

                <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-medium">Daily Task Status</p>
                    <p className="mt-1 text-sm text-zinc-300">{readinessStatusCopy}</p>
                  </div>
                  {checkInSaving ? <Loader2 className="h-4.5 w-4.5 animate-spin text-[#8B5CF6]" /> : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {READINESS_OPTIONS.map((option, idx) => {
                    const isSelected = option.id === selectedReadiness;
                    return (
                      <motion.button
                        key={option.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + idx * 0.06, duration: 0.5 }}
                        whileHover={{ y: -3, scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        type="button"
                        onClick={() => handleSelectReadiness(option)}
                        disabled={checkInSaving}
                        className="relative rounded-2xl p-4 text-left transition-all duration-300"
                        style={{
                          background: isSelected
                            ? `linear-gradient(135deg, ${option.accentColor}14, ${option.accentColor}06)`
                            : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${isSelected ? `${option.accentColor}40` : 'rgba(255,255,255,0.06)'}`,
                          boxShadow: isSelected
                            ? `0 8px 32px ${option.accentGlow}, 0 0 0 1px ${option.accentColor}15`
                            : '0 4px 16px rgba(0,0,0,0.2)',
                        }}
                      >
                        {/* Selection glow */}
                        {isSelected && (
                          <motion.div
                            layoutId="readiness-glow"
                            className="absolute -inset-[1px] rounded-2xl"
                            style={{
                              background: `linear-gradient(135deg, ${option.accentColor}20, transparent 50%)`,
                            }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                          />
                        )}
                        <div className="relative">
                          <div className="mb-3 text-3xl">{option.emoji}</div>
                          <p className="text-[15px] font-semibold text-white">{option.label}</p>
                          <p className="mt-1.5 text-xs text-zinc-500">{option.chip}</p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </GlassCard>

            {latestCompletion?.sessionSummary ? (
              <GlassCard accentColor="#10B981" delay={0.26} hoverLift={false}>
                <div className="p-6">
                  <div className="mb-5 flex items-center gap-3">
                    <div
                      className="inline-flex rounded-xl p-2.5 border"
                      style={{
                        borderColor: 'rgba(16,185,129,0.25)',
                        background: 'rgba(16,185,129,0.1)',
                      }}
                    >
                      <ShieldCheck className="h-4.5 w-4.5 text-[#10B981]" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-medium">Latest Session Update</p>
                      <h3 className="text-xl font-bold text-white">{latestCompletion.sessionSummary.athleteHeadline}</h3>
                    </div>
                  </div>

                  <p className="text-sm leading-7 text-zinc-300">
                    {latestCompletion.sessionSummary.athleteBody}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-300">
                      Completed {latestCompletion.sessionSummary.completedActionLabel}
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-300">
                      Next up {latestCompletion.sessionSummary.nextActionLabel}
                    </div>
                    {latestCompletion.sessionSummary.targetSkills.slice(0, 2).map((skill) => (
                      <div
                        key={skill}
                        className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-300"
                      >
                        {skill}
                      </div>
                    ))}
                  </div>

                  {latestCompletion.sessionSummary.programChanged ? (
                    <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                      <p className="text-sm font-semibold text-white">If you want, Nora can walk you through this shift.</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        Your latest rep changed what comes next. Open Nora if you want a plain-language read on why the focus moved and how to approach the next session.
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenNoraWithAssignment}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#E0FE10]/25 bg-[#E0FE10]/10 px-4 py-3 text-sm font-semibold text-[#E0FE10] transition hover:border-[#E0FE10]/40 hover:bg-[#E0FE10]/15"
                      >
                        Ask Nora About The Shift
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </GlassCard>
            ) : null}

            {recentSessionHistory.length > 1 ? (
              <GlassCard accentColor="#3B82F6" delay={0.28} hoverLift={false}>
                <div className="p-6">
                  <div className="mb-5 flex items-center gap-3">
                    <div
                      className="inline-flex rounded-xl p-2.5 border"
                      style={{
                        borderColor: 'rgba(59,130,246,0.25)',
                        background: 'rgba(59,130,246,0.1)',
                      }}
                    >
                      <CalendarDays className="h-4.5 w-4.5 text-[#3B82F6]" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-medium">What Changed Recently</p>
                      <h3 className="text-xl font-bold text-white">Your last few Pulse Check updates</h3>
                    </div>
                  </div>

                  <p className="text-sm leading-7 text-zinc-400">
                    This gives you the short version of what the last few reps changed, so today never feels disconnected from yesterday.
                  </p>

                  <div className="mt-5 space-y-3">
                    {recentSessionHistory.slice(0, 3).map((completion) => (
                      <div key={completion.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-white">
                            {completion.sessionSummary?.athleteHeadline || completion.exerciseName}
                          </p>
                          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                            {relativeUpdateLabel(completion.completedAt)}
                          </p>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-zinc-400">
                          {completion.sessionSummary?.athleteBody}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </GlassCard>
            ) : null}

            {/* ── NORA BRIEFING + QUICK ACTIONS ROW ── */}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
              {/* Nora Briefing Card */}
              <GlassCard
                accentColor={selectedReadinessOption?.accentColor || '#E0FE10'}
                delay={0.3}
                hoverLift={false}
              >
                <div className="p-6">
                  {/* Accent glow behind icon */}
                  <div className="relative">
                    <div
                      className="absolute -top-4 -left-4 w-24 h-24 rounded-full blur-2xl opacity-20"
                      style={{
                        backgroundColor: selectedReadinessOption?.accentColor || '#E0FE10',
                      }}
                    />
                  </div>

                  <div className="mb-5 flex items-center gap-3">
                    <div
                      className="inline-flex rounded-xl p-2.5 border relative"
                      style={{
                        borderColor: `${selectedReadinessOption?.accentColor || '#E0FE10'}25`,
                        background: `${selectedReadinessOption?.accentColor || '#E0FE10'}10`,
                      }}
                    >
                      <Brain className="h-4.5 w-4.5" style={{ color: selectedReadinessOption?.accentColor || '#E0FE10' }} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-medium">Nora Briefing</p>
                      <h3 className="text-xl font-bold text-white">
                        {currentDailyAssignment ? assignmentActionLabel(currentDailyAssignment) : selectedReadinessOption ? `${selectedReadinessOption.label} day` : 'No readiness signal yet'}
                      </h3>
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.p
                      key={selectedReadinessOption?.id || 'none'}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.35 }}
                      className="text-sm leading-7 text-zinc-300"
                    >
                      {currentDailyAssignment
                        ? currentDailyAssignment.rationale || 'This is the task Nora built from your latest readiness signal.'
                        : selectedReadinessOption
                        ? selectedReadinessOption.response
                        : 'Start with one honest readiness tap above. Once you do, this card becomes Nora\'s read on the right posture for today and saves today\'s check-in to your profile.'}
                    </motion.p>
                  </AnimatePresence>

                  {currentDailyAssignment ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-300">
                        {assignmentStatusLabel(currentDailyAssignment.status)}
                      </div>
                      {currentDailyAssignment.readinessBand ? (
                        <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-300">
                          {currentDailyAssignment.readinessBand} readiness
                        </div>
                      ) : null}
                      {currentDailyAssignment.durationSeconds ? (
                        <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-300">
                          {Math.max(1, Math.round(currentDailyAssignment.durationSeconds / 60))} min
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <motion.button
                    type="button"
                    onClick={handleOpenNoraWithAssignment}
                    whileHover={{ scale: 1.03, y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    className="mt-6 inline-flex items-center gap-2.5 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-300"
                    style={{
                      background: 'rgba(224,254,16,0.12)',
                      border: '1px solid rgba(224,254,16,0.3)',
                      color: '#E0FE10',
                    }}
                  >
                    <Sparkles className="h-4 w-4" />
                    {currentDailyAssignment ? 'Open today\'s Nora task' : 'Talk to Nora'}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </motion.button>

                  {canLaunchTodayTask && currentDailyAssignment ? (
                    <Link
                      href={`/mental-training?dailyAssignmentId=${encodeURIComponent(currentDailyAssignment.id)}`}
                      className="mt-3 inline-flex items-center gap-2.5 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-300 border border-[#3B82F6]/25 bg-[#3B82F6]/10 text-[#93C5FD] hover:border-[#3B82F6]/40 hover:bg-[#3B82F6]/15"
                    >
                      <Target className="h-4 w-4" />
                      Start today&apos;s task
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </div>
              </GlassCard>

              {/* Quick Actions Card */}
              <GlassCard accentColor="#3B82F6" delay={0.4} hoverLift={false}>
                <div className="p-6">
                  <div className="mb-5 flex items-center gap-3">
                    <div
                      className="inline-flex rounded-xl p-2.5 border"
                      style={{
                        borderColor: 'rgba(59,130,246,0.25)',
                        background: 'rgba(59,130,246,0.1)',
                      }}
                    >
                      <Zap className="h-4.5 w-4.5 text-[#3B82F6]" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-medium">Quick Actions</p>
                      <h3 className="text-xl font-bold text-white">Next right move</h3>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {/* Open Nora action */}
                    <motion.button
                      type="button"
                      onClick={handleOpenNoraWithAssignment}
                      whileHover={{ x: 4 }}
                      className="flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left transition-all duration-300 border border-white/[0.06] hover:border-[#E0FE10]/20 group"
                      style={{ background: 'rgba(255,255,255,0.02)' }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#E0FE10]/10 flex items-center justify-center border border-[#E0FE10]/20">
                          <Sparkles className="h-3.5 w-3.5 text-[#E0FE10]" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{currentDailyAssignment ? 'Open today\'s Nora task' : 'Open Nora'}</p>
                          <p className="text-xs text-zinc-500">
                            {currentDailyAssignment ? assignmentActionLabel(currentDailyAssignment) : 'Go straight into the chat view'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-[#E0FE10] transition-colors" />
                    </motion.button>

                    {canLaunchTodayTask && currentDailyAssignment ? (
                      <Link
                        href={`/mental-training?dailyAssignmentId=${encodeURIComponent(currentDailyAssignment.id)}`}
                        className="flex items-center justify-between rounded-xl px-4 py-3.5 transition-all duration-300 border border-white/[0.06] hover:border-[#3B82F6]/20 group"
                        style={{ background: 'rgba(255,255,255,0.02)' }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center border border-[#3B82F6]/20">
                            <Target className="h-3.5 w-3.5 text-[#3B82F6]" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">Start today&apos;s task</p>
                            <p className="text-xs text-zinc-500">{assignmentActionLabel(currentDailyAssignment)}</p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-[#3B82F6] transition-colors" />
                      </Link>
                    ) : null}

                    {/* Team workspace / Access hub action */}
                    {primaryDestination ? (
                      <Link
                        href={primaryDestination.destinationHref}
                        className="flex items-center justify-between rounded-xl px-4 py-3.5 transition-all duration-300 border border-white/[0.06] hover:border-[#3B82F6]/20 group"
                        style={{ background: 'rgba(255,255,255,0.02)' }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center border border-[#3B82F6]/20">
                            <Target className="h-3.5 w-3.5 text-[#3B82F6]" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{primaryDestination.destinationLabel}</p>
                            <p className="text-xs text-zinc-500">{primaryDestination.nextStepLabel}</p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-[#3B82F6] transition-colors" />
                      </Link>
                    ) : (
                      <motion.button
                        type="button"
                        onClick={handleJumpToAccessHub}
                        whileHover={{ x: 4 }}
                        className="flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left transition-all duration-300 border border-white/[0.06] hover:border-[#8B5CF6]/20 group"
                        style={{ background: 'rgba(255,255,255,0.02)' }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center border border-[#8B5CF6]/20">
                            <ShieldCheck className="h-3.5 w-3.5 text-[#8B5CF6]" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">Review access hub</p>
                            <p className="text-xs text-zinc-500">Organizations and teams</p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-[#8B5CF6] transition-colors" />
                      </motion.button>
                    )}
                  </div>

                  {/* Today flow — numbered steps */}
                  <div
                    className="mt-5 rounded-xl p-4 border border-white/[0.05]"
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                  >
                    <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-medium mb-3">
                      Today in PulseCheck
                    </p>
                    <div className="space-y-3 text-sm text-zinc-400">
                      {[
                        'Check your readiness so the day starts with signal.',
                        primaryDestination
                          ? 'Open the right team surface for setup or rollout context.'
                          : 'Review the access hub for organizations and teams.',
                        'Use Nora as the conversation layer, not the entire home screen.',
                      ].map((step, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <span
                            className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                            style={{
                              background: 'rgba(224,254,16,0.08)',
                              border: '1px solid rgba(224,254,16,0.2)',
                              color: '#E0FE10',
                            }}
                          >
                            {idx + 1}
                          </span>
                          <p className="leading-relaxed">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              RIGHT COLUMN — Access Hub + Status
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="space-y-6">
            {/* Access Hub */}
            <motion.section
              id="pulsecheck-access-hub-panel"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="relative overflow-hidden rounded-[28px] backdrop-blur-xl border border-white/[0.08]"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
                boxShadow: '0 20px 80px rgba(0,0,0,0.35), 0 1px 0 inset rgba(255,255,255,0.06)',
              }}
            >
              {/* Chromatic top line */}
              <div
                className="absolute top-0 left-0 right-0 h-[1px] opacity-50"
                style={{ background: 'linear-gradient(90deg, transparent 10%, rgba(224,254,16,0.5), transparent 90%)' }}
              />
              <PulseCheckAccessHub />
            </motion.section>

            {/* Workspace Status */}
            <GlassCard
              accentColor={memberships.length > 0 ? '#10B981' : '#F59E0B'}
              delay={0.6}
              hoverLift={false}
            >
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div
                    className="inline-flex rounded-xl p-2.5 border"
                    style={{
                      borderColor: memberships.length > 0 ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)',
                      background: memberships.length > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                    }}
                  >
                    {membershipLoading ? (
                      <Loader2 className="h-4.5 w-4.5 animate-spin text-[#E0FE10]" />
                    ) : (
                      <ShieldCheck
                        className="h-4.5 w-4.5"
                        style={{ color: memberships.length > 0 ? '#10B981' : '#F59E0B' }}
                      />
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-medium">
                      Workspace Status
                    </p>
                    <h3 className="text-lg font-bold text-white">
                      {membershipLoading
                        ? 'Checking your access'
                        : memberships.length > 0
                        ? 'Workspace routes available'
                        : 'Waiting on team access'}
                    </h3>
                  </div>
                </div>

                {/* Status indicator bar */}
                <div className="mt-4 mb-3 h-1 rounded-full overflow-hidden bg-white/[0.04]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: membershipLoading ? '45%' : memberships.length > 0 ? '100%' : '15%',
                    }}
                    transition={{ duration: 1.2, ease: 'easeOut', delay: 0.8 }}
                    className="h-full rounded-full"
                    style={{
                      background: membershipLoading
                        ? 'linear-gradient(90deg, #E0FE10, #3B82F6)'
                        : memberships.length > 0
                        ? 'linear-gradient(90deg, #10B981, #E0FE10)'
                        : 'linear-gradient(90deg, #F59E0B, #EF4444)',
                    }}
                  />
                </div>

                <p className="text-sm leading-7 text-zinc-400">
                  {membershipLoading
                    ? 'Loading your organizations and teams...'
                    : memberships.length > 0
                    ? 'Your access hub is live. Use it to enter the right team workspace.'
                    : 'This account needs a team invite or organization assignment before the workspace opens.'}
                </p>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}
