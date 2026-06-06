import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Copy,
  HeartPulse,
  HelpCircle,
  Laptop,
  Loader2,
  MailPlus,
  Map as MapIcon,
  MessageSquareText,
  MonitorCheck,
  RefreshCw,
  Rocket,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  Users2,
  Watch,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { useUser } from '../../hooks/useUser';
import { pulseCheckProvisioningService } from '../../api/firebase/pulsecheckProvisioning/service';
import type {
  PulseCheckOrganization,
  PulseCheckTeam,
  PulseCheckOnboardingTrackerStepId,
  PulseCheckOnboardingTrackerStepStatus,
} from '../../api/firebase/pulsecheckProvisioning/types';
import {
  TEAM_ONBOARDING_TRACKER_STEPS,
  TRACKER_STATUS_OPTIONS,
  getTeamOnboardingStepStatus,
  getTeamOnboardingProgress,
} from '../../api/firebase/pulsecheckProvisioning/onboardingTracker';

type PhaseSection = {
  eyebrow: string;
  title: string;
  owner: string;
  timing: string;
  icon: LucideIcon;
  objective: string;
  actions: string[];
  outputs: string[];
};

type CadenceItem = {
  cadence: string;
  owner: string;
  purpose: string;
  actions: string[];
};

type OnboardingTemplate = {
  id: string;
  title: string;
  audience: string;
  timing: string;
  icon: LucideIcon;
  sections: Array<{
    label: string;
    body: string[];
  }>;
};

const launchReadiness = [
  'The organization, team, and any pilot group are set up in the software, with a clear support contact and a plan for who to call if something feels off.',
  'Every coach and staff member can log in, and each one has the right access for their role. Names match the organization’s real staff list.',
  'You know where the roster is coming from, how athletes will join, what devices they’ll use, and how the room will be set up on launch day.',
  'The coach has been through dashboard training and can read their latest report, work their follow-up list, and explain what PulseCheck can and can’t see.',
  'The first month is on the calendar: the day the weekly report snapshot goes out, and the every-two-weeks check-in with the coach and sponsor.',
];

const currentState = [
  {
    title: 'The coach dashboard',
    status: 'Their home base',
    icon: MonitorCheck,
    copy: 'This is where the coach lives. It already shows team health, the latest report, their follow-up list, the full roster, and a way to drill into any single athlete.',
  },
  {
    title: 'The reports',
    status: 'You lead the read',
    icon: BookOpenCheck,
    copy: 'Nora writes a plain-language report on the team. Coaches won’t know how to read one on their own yet — teaching them a simple, repeatable way to read it is part of your job.',
  },
  {
    title: 'The setup console',
    status: 'Where you build it',
    icon: Building2,
    copy: 'This is where you create the organization, team, pilot group, and invite links, and set billing and support. The six steps below turn that tool into a clear order of operations.',
  },
  {
    title: 'Launch day',
    status: 'The human part',
    icon: Watch,
    copy: 'Handing out devices, getting athletes into the app, the first check-in, syncing wearables, and the first session — this part runs on you and a good checklist, not on software alone.',
  },
];

const phases: PhaseSection[] = [
  {
    eyebrow: 'Step 1',
    title: 'Intake — learn the team before you build anything',
    owner: 'You (PulseCheck)',
    timing: 'Before setup',
    icon: ClipboardList,
    objective: 'Get the full picture of the organization so you can set them up correctly and walk into launch day with no surprises.',
    actions: [
      'Get the basics: organization name, who’s sponsoring it, whether this is a paid rollout or a pilot, the sport, the team name, the launch date, and who the key people are.',
      'List every adult involved — head coach, assistants, performance staff, athletic trainer, admin sponsor — with their role, email, phone, and the access each one should have.',
      'Nail down the roster: how many athletes, their age range, any parent-consent needs, where the list comes from, and whether they join by a team link or individual invites.',
      'Sort out devices: what athletes already have, what we’re providing, which wearables, charging, pairing, and how the room gets set up on launch day.',
      'Agree on who handles what before anyone is invited: everyday questions, tech problems, looping in a counselor, and what to do if something urgent comes up.',
    ],
    outputs: [
      'A filled-in intake record',
      'A calendar with the three meetings booked',
      'A list of who gets what access',
      'A device count and delivery plan',
      'Clear notes on who to contact for what',
    ],
  },
  {
    eyebrow: 'Step 2',
    title: 'Set them up in the software',
    owner: 'You (PulseCheck)',
    timing: 'Right after intake',
    icon: Building2,
    objective: 'Build the organization, team, and access in the setup console so everything is ready before the first coach call.',
    actions: [
      'Open the setup console and create the organization — display name, legal name, type, the main admin contact, and whether it’s a pilot or a full rollout.',
      'Create the team with its sport, season, status, plan, billing model, roster rules, and who to contact if something needs escalating.',
      'If it’s a pilot or phased rollout, create the pilot and its group. Keep group names simple and obvious, like “Varsity Football, Spring 2026.”',
      'Generate the admin and coach invite links. Click through each one to confirm it drops the person into the right organization, team, and role.',
      'Before the kickoff call, double-check the support contacts, counselor-bridge setting, billing setup, and the team’s preview screens.',
    ],
    outputs: [
      'Organization and team created',
      'Pilot group created (if needed)',
      'Coach and staff invite links ready',
      'A plan for getting athletes in',
      'Setup notes written down',
    ],
  },
  {
    eyebrow: 'Step 3',
    title: 'Meeting 1 — coach kickoff',
    owner: 'You + the head coach',
    timing: '30–45 min',
    icon: MessageSquareText,
    objective: 'Get the coach comfortable — what PulseCheck does, what to expect, and why it’s worth their time — before any hands-on training.',
    actions: [
      'Start with the goal: what does this organization want to learn, how will they know it’s working, and what will PulseCheck keep an eye on the first month?',
      'Walk through who’s who: you, the coach, assistants, athletes, the athletic trainer, the sponsor, and who to contact for help.',
      'Lay out what’s coming: the three meetings, how devices get handed out, how athletes get set up, and what the coach is responsible for once it’s live.',
      'Preview what they’ll see: the dashboard, team trends, reports, their follow-up list, the roster, check-in rates, and mental training activity.',
      'Be clear about the line: PulseCheck helps coaches support their athletes — it is not an emergency service and does not replace the organization’s safety plan.',
    ],
    outputs: [
      'Coach knows the plan',
      'Coach confirms the staff list and launch date',
      'Action items handed out before training',
      'Open questions saved for Meeting 2',
    ],
  },
  {
    eyebrow: 'Step 4',
    title: 'Meeting 2 — dashboard & report training',
    owner: 'You + the coaching staff',
    timing: '60 min',
    icon: Laptop,
    objective: 'Teach coaches to read the dashboard and reports on their own, and turn what they see into the right supportive action.',
    actions: [
      'Open the dashboard together and point out the team summary cards, the current report, the trend wording, and the roster table.',
      'Teach a set reading order for every report: team snapshot, the changes that matter, how much data backs it up, individual flags, suggested follow-up, and what to watch next.',
      'Show what’s worth noticing: a lasting change, a sudden drop-off, missing data, slipping check-ins, signs of fatigue, recovery patterns, and the same follow-up coming up again.',
      'Show what not to read too much into: a single odd day, patchy wearable data, one missed check-in, or a report made before there’s enough data behind it.',
      'Walk through Mental Training — what’s assigned, the practice scenarios, who’s completing them, and why a coach’s response should stay supportive, never a punishment.',
      'Cover what PulseCheck can and can’t see, and exactly when to use the organization’s safety plan versus when PulseCheck staff will follow up separately.',
    ],
    outputs: [
      'Coach can read a report without you narrating it',
      'Coach knows the daily and weekly routine',
      'Coach knows how to talk about follow-ups',
      'Coach confirms the launch-day plan',
    ],
  },
  {
    eyebrow: 'Step 5',
    title: 'Meeting 3 — team launch day',
    owner: 'You + the full team',
    timing: '45–75 min',
    icon: Smartphone,
    objective: 'Get athletes into the app, devices synced, the first check-in done, and the first mental training session run together.',
    actions: [
      'Set the room up first: device stations, charging, QR codes or invite links, a coach table, and someone dedicated to troubleshooting.',
      'Hand out devices, check names, match device IDs where needed, and write down anything missing or that needs replacing.',
      'Walk athletes through it: install the app, make an account, the consent screens, joining the team, basic profile, and turning on notifications.',
      'Pair and sync the wearables. Before anyone leaves, each athlete is either fully connected or on a follow-up list.',
      'Teach daily check-ins: when to do them, what an honest answer looks like, how it helps their coach, and how PulseCheck keeps it private.',
      'Run the first session as a group so athletes get the rhythm before they’re ever asked to do one on their own.',
    ],
    outputs: [
      'Athletes invited and joined',
      'Device sync status recorded',
      'First check-in done by the group',
      'First session done together',
      'Follow-up list for anyone absent or with device trouble',
    ],
  },
  {
    eyebrow: 'Step 6',
    title: 'The first 30 days',
    owner: 'You + coach success',
    timing: 'First 30 days, then ongoing',
    icon: CalendarClock,
    objective: 'Make the organization feel looked after, and keep the data reviews, coach support, and stakeholder updates predictable.',
    actions: [
      'During launch week, check in daily: who’s joined, are devices syncing, are check-ins happening, are reports ready, and is anything stuck?',
      'Send the coach a weekly snapshot: where the team is, how consistent check-ins are, what changed that matters, and what to follow up on.',
      'Every two weeks, meet with the coach and sponsor to go over trends, how it’s being used, open questions, risks, and what to do next.',
      'Keep one shared issue log for devices, access, roster changes, and report questions — so the organization never has to explain the same problem twice.',
      'At 30 days, review the whole thing: usage, coach engagement, athlete completion, device reliability, report quality, and whether they’re ready to grow.',
    ],
    outputs: [
      'Daily launch-week notes',
      'Weekly coach snapshots',
      'Notes and action items every two weeks',
      'An up-to-date issue log',
      'A 30-day review',
    ],
  },
];

const cadenceItems: CadenceItem[] = [
  {
    cadence: 'Daily during launch week',
    owner: 'PulseCheck admin',
    purpose: 'Catch setup problems before the coach loses trust.',
    actions: [
      'Compare who was invited to who’s actually joined.',
      'Check that devices are syncing and none have gone stale.',
      'Check how many athletes are doing their daily check-in.',
      'Make sure anything safety-related has a clear owner.',
    ],
  },
  {
    cadence: 'Weekly',
    owner: 'Coach success',
    purpose: 'Give the coach a snapshot they can count on and act on.',
    actions: [
      'Read the latest coach report.',
      'Sum up check-in rates, the team trend, what changed, and the top follow-ups.',
      'Send the snapshot to the coach and the PulseCheck owner.',
      'Note any coach questions for the next live check-in.',
    ],
  },
  {
    cadence: 'Every two weeks',
    owner: 'PulseCheck staff',
    purpose: 'Keep the coach, sponsor, and key people on the same page.',
    actions: [
      'Go over usage, report themes, coach actions, device health, and anything still open.',
      'Decide if the team needs more training, a roster cleanup, or device help.',
      'Agree on the focus for the next two weeks.',
      'Update the stakeholder note after the call.',
    ],
  },
  {
    cadence: 'Monthly',
    owner: 'PulseCheck lead',
    purpose: 'Decide if the rollout is healthy, needs a fix, or is ready to grow.',
    actions: [
      'Review the organization’s overall results and any risk themes.',
      'Look at how engaged the coach is and how much athletes are completing.',
      'Confirm report quality and how much effort it’s taking to run.',
      'Write down next steps: expand, renew, or fix.',
    ],
  },
];

const tutorialCoverage = [
  {
    surface: 'Setup console',
    path: '/admin/pulsecheckProvisioning',
    required: [
      'Create the organization',
      'Create the team',
      'Create a pilot group',
      'Make the coach & staff invite links',
      'Set the support and escalation contacts',
    ],
  },
  {
    surface: 'Coach dashboard',
    path: '/coach/dashboard',
    required: [
      'Read the team summary',
      'Find the latest report',
      'Work the follow-up list',
      'Open the roster and a single athlete',
      'Know what PulseCheck can & can’t see',
    ],
  },
  {
    surface: 'Reports',
    path: '/coach/sports-intelligence-reports',
    required: [
      'Open past reports',
      'Read the current one in order',
      'Tell a trend from missing data',
      'Send questions to PulseCheck',
    ],
  },
  {
    surface: 'Mental Training',
    path: '/coach/mentalGames',
    required: [
      'See what’s assigned',
      'See the practice scenarios',
      'Track who’s completed them',
      'Use supportive follow-up language',
    ],
  },
  {
    surface: 'Athlete app',
    path: 'Mobile app',
    required: [
      'Join the team',
      'Do the first check-in',
      'Connect a device',
      'Do the first session',
    ],
  },
];

const escalationPlaybooks = [
  {
    trigger: 'Coach can’t log in',
    response: 'Check their invite, their role, and that they’re on the right organization and team. Confirm the email matches exactly before sending a new invite.',
  },
  {
    trigger: 'Athlete joined the wrong team',
    response: 'Remove the wrong membership, double-check where the roster came from, resend the correct team invite, and note the fix in your launch notes.',
  },
  {
    trigger: 'A device is missing or won’t sync',
    response: 'Check the connection, pairing, battery, permissions, and when it last synced. Only log a hardware swap after the software checks come up empty.',
  },
  {
    trigger: 'Coach is reading too much into one signal',
    response: 'Walk them back to the trend, the context, and how much data is behind it. Use the report reading order before suggesting any conversation with an athlete.',
  },
  {
    trigger: 'Something safety-related comes up',
    response: 'Confirm who owns it, write down the route, and follow the organization’s safety plan. PulseCheck staff never improvise an emergency response.',
  },
];

const onboardingTemplates: OnboardingTemplate[] = [
  {
    id: 'coach-kickoff',
    title: 'Coach Kickoff Template',
    audience: 'Head coach and admin sponsor',
    timing: 'Meeting 1',
    icon: MessageSquareText,
    sections: [
      {
        label: 'Agenda',
        body: [
          'Confirm the goal, launch date, who’s on the team, and what they want to learn in the first month.',
          'Go over the roles on both sides, support contacts, and where PulseCheck’s responsibility ends.',
          'Preview the dashboard, reports, daily check-ins, mental training, device hand-out, and the next two meetings.',
        ],
      },
      {
        label: 'Closeout',
        body: [
          'Confirm the staff list, rough roster size, device plan, and the date for dashboard training.',
          'Capture open questions and assign a PulseCheck owner before you hang up.',
        ],
      },
    ],
  },
  {
    id: 'dashboard-training',
    title: 'Dashboard Training Template',
    audience: 'Coaches and support staff',
    timing: 'Meeting 2',
    icon: Laptop,
    sections: [
      {
        label: 'Reading Order',
        body: [
          'Team snapshot first, then the changes that matter, how much data backs them, individual flags, suggested follow-up, and what to watch next.',
          'Then the follow-up list, what PulseCheck can and can’t see, the roster drill-down, past reports, and Mental Training activity.',
        ],
      },
      {
        label: 'Training Standards',
        body: [
          'Notice lasting changes, missing data, slipping check-ins, fatigue signs, recovery patterns, and repeat follow-up themes.',
          'Don’t over-read one odd day, patchy wearable data, a single missed check-in, or a report made before there’s enough data.',
        ],
      },
    ],
  },
  {
    id: 'team-rollout',
    title: 'Team Rollout Template',
    audience: 'The full team',
    timing: 'Meeting 3',
    icon: Smartphone,
    sections: [
      {
        label: 'Room Plan',
        body: [
          'Set up device stations, charging, QR codes or invite links, a coach table, and a dedicated troubleshooting spot.',
          'Hand out devices, confirm names, note anything missing, and match device IDs where needed.',
        ],
      },
      {
        label: 'Athlete Flow',
        body: [
          'Walk through install, account, consent, joining the team, basic profile, notifications, and wearable sync.',
          'Do the first check-in and first session with PulseCheck staff in the room.',
        ],
      },
    ],
  },
  {
    id: 'weekly-snapshot',
    title: 'Weekly Coach Snapshot Template',
    audience: 'Coach and PulseCheck owner',
    timing: 'Weekly after launch',
    icon: ClipboardCheck,
    sections: [
      {
        label: 'Snapshot Fields',
        body: [
          'Sum up where the team is, how consistent check-ins are, what changed, who needs a supportive follow-up, any device or data gaps, and what you’d suggest the coach do.',
          'Name any questions the coach asked and who at PulseCheck is following up.',
        ],
      },
      {
        label: 'Send Standard',
        body: [
          'Keep it short enough to read between sessions.',
          'Structure it as: the trend, how much data backs it, and the supportive next step.',
        ],
      },
    ],
  },
  {
    id: 'stakeholder-check-in',
    title: 'Stakeholder Check-In Template',
    audience: 'Coach, sponsor, and key people',
    timing: 'Every two weeks',
    icon: CalendarClock,
    sections: [
      {
        label: 'Review',
        body: [
          'Go over usage, coach engagement, athlete completion, report quality, device reliability, open issues, and any safety or support routing concerns.',
          'Decide if the team needs more training, a roster cleanup, device help, or a new focus.',
        ],
      },
      {
        label: 'Decision Log',
        body: [
          'Write down the decisions needed, the next two-week focus, an owner for each item, and the date of the next check-in.',
        ],
      },
    ],
  },
];

const formatTemplateForClipboard = (template: OnboardingTemplate) =>
  [
    template.title,
    `Audience: ${template.audience}`,
    `Timing: ${template.timing}`,
    '',
    ...template.sections.flatMap((section) => [
      section.label,
      ...section.body.map((item) => `- ${item}`),
      '',
    ]),
  ].join('\n').trim();

type DashboardFilter = 'all' | 'active' | 'blocked' | 'live';

const STEP_STATUS_UI: Record<PulseCheckOnboardingTrackerStepStatus, { dot: string; badge: string; label: string }> = {
  complete: { dot: 'bg-emerald-400', badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300', label: 'Done' },
  'in-progress': { dot: 'bg-amber-400', badge: 'border-amber-400/30 bg-amber-400/10 text-amber-300', label: 'Working' },
  blocked: { dot: 'bg-rose-400', badge: 'border-rose-400/30 bg-rose-400/10 text-rose-300', label: 'Needs help' },
  pending: { dot: 'bg-slate-600', badge: 'border-white/10 bg-white/[0.05] text-slate-400', label: 'Not started' },
};

const getTeamNextStepLabel = (team: PulseCheckTeam): string => {
  const next = TEAM_ONBOARDING_TRACKER_STEPS.find(
    (step) => getTeamOnboardingStepStatus(team, step.id) !== 'complete'
  );
  return next ? next.label : 'Fully onboarded';
};

const PulseCheckOnboardingOverviewPage: React.FC = () => {
  const [activeTemplateId, setActiveTemplateId] = useState(onboardingTemplates[0].id);
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);

  const currentUser = useUser();
  const [organizations, setOrganizations] = useState<PulseCheckOrganization[]>([]);
  const [teams, setTeams] = useState<PulseCheckTeam[]>([]);
  const [boardLoading, setBoardLoading] = useState(true);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [savingStepKey, setSavingStepKey] = useState<string | null>(null);
  const [expandedTeamIds, setExpandedTeamIds] = useState<Set<string>>(() => new Set());
  const [boardFilter, setBoardFilter] = useState<DashboardFilter>('all');
  const [boardSearch, setBoardSearch] = useState('');

  const loadBoard = useCallback(async () => {
    setBoardLoading(true);
    setBoardError(null);
    try {
      const [orgs, allTeams] = await Promise.all([
        pulseCheckProvisioningService.listOrganizations(),
        pulseCheckProvisioningService.listTeams(),
      ]);
      setOrganizations(orgs);
      setTeams(allTeams);
    } catch (error) {
      console.error('[PulseCheckOnboardingOverview] Failed to load onboarding board:', error);
      setBoardError('Could not load the onboarding board. Refresh to try again.');
    } finally {
      setBoardLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  const toggleTeamExpanded = (teamId: string) => {
    setExpandedTeamIds((current) => {
      const next = new Set(current);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  };

  const handleStepStatusChange = async (
    team: PulseCheckTeam,
    stepId: PulseCheckOnboardingTrackerStepId,
    status: PulseCheckOnboardingTrackerStepStatus
  ) => {
    const savingKey = `${team.id}:${stepId}`;
    const currentTracker = team.implementationMetadata?.onboardingTracker || {};
    const currentStep = currentTracker.steps?.[stepId] || {
      status: 'pending' as PulseCheckOnboardingTrackerStepStatus,
    };

    setSavingStepKey(savingKey);
    setBoardError(null);

    // Optimistic local update so the board reacts instantly.
    setTeams((current) =>
      current.map((item) => {
        if (item.id !== team.id) return item;
        const meta = item.implementationMetadata ?? {
          provisioningPath: 'pulsecheck-hierarchy' as const,
          legacySignupPathUsed: false,
          canaryTarget: false,
        };
        const tracker = meta.onboardingTracker || {};
        return {
          ...item,
          implementationMetadata: {
            ...meta,
            onboardingTracker: {
              ...tracker,
              steps: {
                ...(tracker.steps || {}),
                [stepId]: { ...(tracker.steps?.[stepId] || {}), status },
              },
            },
          },
        };
      })
    );

    try {
      await pulseCheckProvisioningService.updateTeamOnboardingTracker({
        teamId: team.id,
        onboardingTracker: {
          ...currentTracker,
          steps: {
            ...(currentTracker.steps || {}),
            [stepId]: {
              ...currentStep,
              status,
              updatedByUserId: currentUser?.id || '',
              updatedByEmail: currentUser?.email || '',
            },
          },
        },
        updatedByUserId: currentUser?.id || '',
        updatedByEmail: currentUser?.email || '',
      });
    } catch (error) {
      console.error('[PulseCheckOnboardingOverview] Failed to update onboarding step:', error);
      setBoardError(`Could not save ${team.displayName}. Refreshing the latest data.`);
      await loadBoard();
    } finally {
      setSavingStepKey((current) => (current === savingKey ? null : current));
    }
  };

  const organizationsById = useMemo(() => {
    const map = new Map<string, PulseCheckOrganization>();
    organizations.forEach((org) => map.set(org.id, org));
    return map;
  }, [organizations]);

  const boardSummary = useMemo(() => {
    let live = 0;
    let needsHelp = 0;
    let inFlight = 0;
    teams.forEach((team) => {
      const progress = getTeamOnboardingProgress(team);
      if (progress.blockedCount > 0) needsHelp += 1;
      if (progress.completedCount === progress.totalCount) live += 1;
      else if (progress.completedCount > 0 || progress.inProgressCount > 0) inFlight += 1;
    });
    return { total: teams.length, live, needsHelp, inFlight };
  }, [teams]);

  const filteredTeams = useMemo(() => {
    const query = boardSearch.trim().toLowerCase();
    return teams.filter((team) => {
      const progress = getTeamOnboardingProgress(team);
      const isLive = progress.completedCount === progress.totalCount;
      if (boardFilter === 'live' && !isLive) return false;
      if (boardFilter === 'blocked' && progress.blockedCount === 0) return false;
      if (boardFilter === 'active' && (isLive || progress.completedCount + progress.inProgressCount === 0)) return false;
      if (query) {
        const org = organizationsById.get(team.organizationId);
        const haystack = `${team.displayName} ${team.sportOrProgram || ''} ${org?.displayName || ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [teams, boardFilter, boardSearch, organizationsById]);

  const groupedBoard = useMemo(() => {
    const groups = new Map<string, { org: PulseCheckOrganization | undefined; teams: PulseCheckTeam[] }>();
    filteredTeams.forEach((team) => {
      const key = team.organizationId || 'unassigned';
      if (!groups.has(key)) {
        groups.set(key, { org: organizationsById.get(team.organizationId), teams: [] });
      }
      groups.get(key)!.teams.push(team);
    });
    return Array.from(groups.entries()).map(([key, value]) => ({ key, ...value }));
  }, [filteredTeams, organizationsById]);

  const boardFilters: Array<{ id: DashboardFilter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: boardSummary.total },
    { id: 'active', label: 'In progress', count: boardSummary.inFlight },
    { id: 'blocked', label: 'Needs help', count: boardSummary.needsHelp },
    { id: 'live', label: 'Live', count: boardSummary.live },
  ];

  const activeTemplate = onboardingTemplates.find((template) => template.id === activeTemplateId) || onboardingTemplates[0];
  const ActiveTemplateIcon = activeTemplate.icon;
  const handleCopyTemplate = async (template: OnboardingTemplate) => {
    try {
      await navigator.clipboard.writeText(formatTemplateForClipboard(template));
      setCopiedTemplateId(template.id);
      window.setTimeout(() => setCopiedTemplateId((current) => (current === template.id ? null : current)), 1800);
    } catch (error) {
      console.error('[PulseCheckOnboardingOverview] Failed to copy onboarding template:', error);
    }
  };

  return (
    <AdminRouteGuard>
      <div className="min-h-screen bg-[#06080d] text-white">
        <Head>
          <title>PulseCheck Onboarding Playbook | Pulse Admin</title>
          <meta name="robots" content="noindex,nofollow" />
        </Head>

        <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10">
          <section className="overflow-hidden rounded-[18px] border border-white/10 bg-[#10141d]">
            <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.15fr_0.85fr] lg:p-10">
              <div>
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#00d4aa]/30 bg-[#00d4aa]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#00d4aa]">
                  <MapIcon className="h-3.5 w-3.5" />
                  Onboarding Playbook · PulseCheck Staff
                </div>
                <h1 className="max-w-4xl text-3xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
                  How we bring a new team onto PulseCheck
                </h1>
                <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">
                  Your end-to-end guide to onboarding any organization — a school, a pro team, or a single team. It walks you through the whole journey: the first intake call, setting the team up in the software, the three meetings with the coach and athletes, and how we stay close for the first 30 days. If you can follow these steps, you can run a rollout.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    href="/admin/pulsecheckProvisioning"
                    className="inline-flex items-center gap-2 rounded-lg bg-[#00d4aa] px-4 py-2.5 text-sm font-semibold text-[#06100e] transition hover:brightness-110"
                  >
                    Open Provisioning
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/admin/systemOverview"
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]"
                  >
                    System Overview
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[#00d4aa]">
                    <BadgeCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Is the team ready to launch?</p>
                    <p className="text-xs text-slate-400">Run through this before launch day.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {launchReadiness.map((item) => (
                    <div key={item} className="flex gap-3 text-sm leading-6 text-slate-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#00d4aa]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ===== Live birds-eye dashboard ===== */}
          <section className="rounded-2xl border border-white/10 bg-[#0d1119] p-5 sm:p-7">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00d4aa]">Live Dashboard</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Where every team stands right now</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Every team you’re onboarding and exactly which of the ten steps they’re on. Change a status here and it saves straight to that team. The full playbook — what each step means and how to run it — is below.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadBoard()}
                disabled={boardLoading}
                className="inline-flex items-center gap-2 self-start rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07] disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${boardLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Teams onboarding', value: boardSummary.total, icon: Users2, tone: 'text-[#00d4aa]' },
                { label: 'In progress', value: boardSummary.inFlight, icon: CalendarClock, tone: 'text-amber-300' },
                { label: 'Needs help', value: boardSummary.needsHelp, icon: AlertTriangle, tone: 'text-rose-300' },
                { label: 'Live', value: boardSummary.live, icon: Rocket, tone: 'text-emerald-300' },
              ].map((tile) => {
                const Icon = tile.icon;
                return (
                  <div key={tile.label} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{tile.label}</span>
                      <Icon className={`h-4 w-4 ${tile.tone}`} />
                    </div>
                    <p className="mt-3 text-3xl font-semibold text-white">{tile.value}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {boardFilters.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setBoardFilter(filter.id)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      boardFilter === filter.id
                        ? 'border-[#00d4aa]/40 bg-[#00d4aa]/10 text-[#00d4aa]'
                        : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                    }`}
                  >
                    {filter.label}
                    <span className="rounded-full bg-black/30 px-1.5 py-0.5 text-[10px] text-slate-400">{filter.count}</span>
                  </button>
                ))}
              </div>
              <div className="relative sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={boardSearch}
                  onChange={(event) => setBoardSearch(event.target.value)}
                  placeholder="Search team or organization"
                  className="w-full rounded-lg border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-[#00d4aa]/40 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6">
              {boardError ? (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  {boardError}
                </div>
              ) : null}

              {boardLoading ? (
                <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] py-16 text-sm text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin text-[#00d4aa]" />
                  Loading the board…
                </div>
              ) : groupedBoard.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-16 text-center">
                  <p className="text-sm font-semibold text-white">No teams match this view</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {teams.length === 0
                      ? 'Once you provision a team, it shows up here with its onboarding progress.'
                      : 'Try a different filter or clear the search.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {groupedBoard.map((group) => (
                    <div key={group.key}>
                      <div className="mb-3 flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-500" />
                        <h3 className="text-sm font-semibold text-white">{group.org?.displayName || 'Unassigned organization'}</h3>
                        <span className="text-xs text-slate-500">· {group.teams.length} {group.teams.length === 1 ? 'team' : 'teams'}</span>
                      </div>
                      <div className="space-y-3">
                        {group.teams.map((team) => {
                          const progress = getTeamOnboardingProgress(team);
                          const isLive = progress.completedCount === progress.totalCount;
                          const expanded = expandedTeamIds.has(team.id);
                          return (
                            <article key={team.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
                              <button
                                type="button"
                                onClick={() => toggleTeamExpanded(team.id)}
                                className="flex w-full flex-col gap-4 p-4 text-left transition hover:bg-white/[0.02] lg:flex-row lg:items-center"
                              >
                                <div className="min-w-0 lg:w-64 lg:flex-shrink-0">
                                  <div className="flex items-center gap-2">
                                    <h4 className="truncate text-base font-semibold text-white">{team.displayName}</h4>
                                    {progress.blockedCount > 0 ? (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                                        <AlertTriangle className="h-3 w-3" />
                                        {progress.blockedCount}
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-0.5 truncate text-xs text-slate-500">
                                    {team.sportOrProgram || team.teamType || 'Team'}
                                  </p>
                                  <p className="mt-1 truncate text-xs text-slate-400">
                                    {isLive ? (
                                      <span className="text-emerald-300">Fully onboarded</span>
                                    ) : (
                                      <>Next: {getTeamNextStepLabel(team)}</>
                                    )}
                                  </p>
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1">
                                    {TEAM_ONBOARDING_TRACKER_STEPS.map((step) => {
                                      const status = getTeamOnboardingStepStatus(team, step.id);
                                      return (
                                        <span
                                          key={step.id}
                                          title={`${step.label} — ${STEP_STATUS_UI[status].label}`}
                                          className={`h-1.5 flex-1 rounded-full ${STEP_STATUS_UI[status].dot}`}
                                        />
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 lg:w-36 lg:flex-shrink-0 lg:justify-end">
                                  <span className="text-sm font-semibold text-white">
                                    {progress.completedCount}/{progress.totalCount}
                                  </span>
                                  <ChevronDown className={`h-4 w-4 text-slate-400 transition ${expanded ? 'rotate-180' : ''}`} />
                                </div>
                              </button>

                              {expanded ? (
                                <div className="border-t border-white/10 bg-black/20 p-4">
                                  <div className="grid gap-2">
                                    {TEAM_ONBOARDING_TRACKER_STEPS.map((step, index) => {
                                      const status = getTeamOnboardingStepStatus(team, step.id);
                                      const saving = savingStepKey === `${team.id}:${step.id}`;
                                      return (
                                        <div
                                          key={step.id}
                                          className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                          <div className="flex min-w-0 items-start gap-3">
                                            <span className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${STEP_STATUS_UI[status].dot}`} />
                                            <div className="min-w-0">
                                              <p className="text-sm font-medium text-white">
                                                <span className="text-slate-500">{index + 1}. </span>
                                                {step.label}
                                              </p>
                                              <p className="text-xs text-slate-500">{step.meeting} · {step.owner}</p>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2 sm:flex-shrink-0">
                                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#00d4aa]" /> : null}
                                            <span className={`hidden rounded-full border px-2.5 py-1 text-[10px] font-semibold sm:inline ${STEP_STATUS_UI[status].badge}`}>
                                              {STEP_STATUS_UI[status].label}
                                            </span>
                                            <select
                                              value={status}
                                              disabled={saving}
                                              onChange={(event) =>
                                                void handleStepStatusChange(
                                                  team,
                                                  step.id,
                                                  event.target.value as PulseCheckOnboardingTrackerStepStatus
                                                )
                                              }
                                              className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs text-white focus:border-[#00d4aa]/40 focus:outline-none disabled:opacity-60"
                                            >
                                              {TRACKER_STATUS_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                  {option.label}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div className="mt-3 flex justify-end">
                                    <Link
                                      href="/admin/pulsecheckProvisioning"
                                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00d4aa] hover:underline"
                                    >
                                      Open in Provisioning
                                      <ArrowRight className="h-3.5 w-3.5" />
                                    </Link>
                                  </div>
                                </div>
                              ) : null}
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8 flex items-center gap-3 border-t border-white/10 pt-6 text-xs text-slate-500">
              <BookOpenCheck className="h-4 w-4" />
              Below: the full playbook — what each step means and how to run it.
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {currentState.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#00d4aa]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                      {item.status}
                    </span>
                  </div>
                  <h2 className="text-base font-semibold text-white">{item.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{item.copy}</p>
                </article>
              );
            })}
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#0d1119] p-5 sm:p-7">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00d4aa]">The Six Steps</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">From first call to a steady rhythm</h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-slate-400">
                Do these in order. Skip one and the software might still technically work — but the rollout will feel confusing and shaky to the coach.
              </p>
            </div>

            <div className="space-y-4">
              {phases.map((phase) => {
                const Icon = phase.icon;
                return (
                  <article key={phase.title} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                    <div className="flex flex-col gap-5 lg:flex-row">
                      <div className="lg:w-72 lg:flex-shrink-0">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[#00d4aa]">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00d4aa]">{phase.eyebrow}</p>
                            <p className="mt-1 text-sm text-slate-400">{phase.timing}</p>
                          </div>
                        </div>
                        <h3 className="mt-4 text-xl font-semibold leading-tight text-white">{phase.title}</h3>
                        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
                          <span className="text-slate-500">Owner: </span>
                          {phase.owner}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-6 text-slate-300">{phase.objective}</p>
                        <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
                          <div>
                            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Required Steps</p>
                            <div className="space-y-3">
                              {phase.actions.map((action) => (
                                <div key={action} className="flex gap-3 text-sm leading-6 text-slate-300">
                                  <ChevronRight className="mt-1 h-4 w-4 flex-shrink-0 text-[#00d4aa]" />
                                  <span>{action}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Outputs</p>
                            <div className="space-y-2">
                              {phase.outputs.map((output) => (
                                <div key={output} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-300">
                                  {output}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border border-white/10 bg-[#0d1119] p-5 sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#f5a623]/30 bg-[#f5a623]/10 text-[#f5a623]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f5a623]">Coach Training Script</p>
                  <h2 className="text-xl font-semibold text-white">How to teach a coach to read a report</h2>
                </div>
              </div>

              <div className="space-y-4 text-sm leading-6 text-slate-300">
                <p>
                  Teach every coach to read a report the same way each time: team snapshot, the changes that matter, how much data backs it up, individual flags, who to follow up with, and what to watch next.
                </p>
                <p>
                  Before they act, have them ask three questions: Is there enough data here to trust it? Is this a real trend or just one data point? And what’s a supportive next step for this athlete or team?
                </p>
                <p>
                  Model the language a coach can actually use with an athlete. Keep it curious, specific, and supportive — never punishing, never a diagnosis.
                </p>
              </div>

              <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Every report ends with a next move</p>
                <p className="text-sm leading-6 text-slate-300">
                  Keep watching, check in with the athlete, adjust a training conversation, ask PulseCheck a question, or escalate through the organization’s safety plan.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0d1119] p-5 sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#60a5fa]/30 bg-[#60a5fa]/10 text-[#60a5fa]">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#60a5fa]">In The Software</p>
                  <h2 className="text-xl font-semibold text-white">Where each part happens on screen</h2>
                </div>
              </div>

              <div className="space-y-3">
                {tutorialCoverage.map((item) => (
                  <div key={item.surface} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-white">{item.surface}</h3>
                        <p className="text-xs text-slate-500">{item.path}</p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                        What to show
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.required.map((step) => (
                        <span key={step} className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-slate-300">
                          {step}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#0d1119] p-5 sm:p-7">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00d4aa]">The First Month & Beyond</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">After launch, keep the rhythm going</h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-slate-400">
                The first month should feel hands-on. Coaches need a snapshot they can count on, and sponsors need to see the rollout is being actively managed.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-4">
              {cadenceItems.map((item) => (
                <article key={item.cadence} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-[#00d4aa]">
                    <CalendarClock className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold text-white">{item.cadence}</h3>
                  <p className="mt-1 text-xs text-slate-500">{item.owner}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{item.purpose}</p>
                  <div className="mt-4 space-y-2">
                    {item.actions.map((action) => (
                      <div key={action} className="flex gap-2 text-sm leading-5 text-slate-400">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#00d4aa]" />
                        <span>{action}</span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-2xl border border-white/10 bg-[#0d1119] p-5 sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[#00d4aa]">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00d4aa]">Pre-Launch Checklist</p>
                  <h2 className="text-xl font-semibold text-white">What to double-check before launch</h2>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  'Organization created',
                  'Team created',
                  'Pilot group created (if needed)',
                  'Coach & staff access',
                  'Coach invite links',
                  'Athlete invites or roster import',
                  'Device list',
                  'Device & data connection status',
                  'Daily check-in coverage',
                  'Mental training assigned',
                  'Saved coach reports',
                  'Support & escalation contacts',
                ].map((record) => (
                  <div key={record} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-3 text-sm text-slate-300">
                    <ShieldCheck className="h-4 w-4 flex-shrink-0 text-[#00d4aa]" />
                    {record}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0d1119] p-5 sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#fb7185]/30 bg-[#fb7185]/10 text-[#fb7185]">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#fb7185]">Support Playbooks</p>
                  <h2 className="text-xl font-semibold text-white">Common launch issues</h2>
                </div>
              </div>

              <div className="space-y-3">
                {escalationPlaybooks.map((item) => (
                  <div key={item.trigger} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                    <div className="flex gap-3">
                      <HelpCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#fb7185]" />
                      <div>
                        <h3 className="text-sm font-semibold text-white">{item.trigger}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-400">{item.response}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#0d1119] p-5 sm:p-7">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00d4aa]">Ready-To-Use Templates</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Copy-and-go agendas for every call</h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-slate-400">
                Grab these for calls, weekly snapshots, and stakeholder follow-ups. The real source of truth still lives in your tracker and issue log.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="grid gap-2">
                {onboardingTemplates.map((template) => {
                  const Icon = template.icon;
                  const active = template.id === activeTemplate.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setActiveTemplateId(template.id)}
                      className={`rounded-xl border p-4 text-left transition ${
                        active
                          ? 'border-[#00d4aa]/40 bg-[#00d4aa]/10'
                          : 'border-white/10 bg-white/[0.025] hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${active ? 'border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[#00d4aa]' : 'border-white/10 bg-black/20 text-slate-400'}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">{template.title}</h3>
                          <p className="mt-1 text-xs text-slate-500">{template.timing} · {template.audience}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[#00d4aa]">
                      <ActiveTemplateIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00d4aa]">{activeTemplate.timing}</p>
                      <h3 className="mt-1 text-xl font-semibold text-white">{activeTemplate.title}</h3>
                      <p className="mt-2 text-sm text-slate-400">{activeTemplate.audience}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopyTemplate(activeTemplate)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#00d4aa] px-4 py-2.5 text-sm font-semibold text-[#06100e] transition hover:brightness-110"
                  >
                    {copiedTemplateId === activeTemplate.id ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiedTemplateId === activeTemplate.id ? 'Copied' : 'Copy Template'}
                  </button>
                </div>

                <div className="mt-6 grid gap-4">
                  {activeTemplate.sections.map((section) => (
                    <div key={section.label} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                      <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{section.label}</h4>
                      <div className="mt-3 space-y-3">
                        {section.body.map((item) => (
                          <div key={item} className="flex gap-3 text-sm leading-6 text-slate-300">
                            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#00d4aa]" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#10141d] p-5 sm:p-7">
            <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00d4aa]">Coming Soon</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Building this playbook right into the app</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  {
                    icon: MailPlus,
                    title: 'Invite checklist',
                    copy: 'See invite status, who’s still missing, and whether the team is ready — right inside the setup console.',
                  },
                  {
                    icon: HeartPulse,
                    title: 'Coach walkthrough',
                    copy: 'A guided tour built into the dashboard for the team summary, reading a report, the follow-up list, and the roster.',
                  },
                  {
                    icon: Users2,
                    title: 'Launch-day mode',
                    copy: 'One room-view that tracks who’s joined, device sync, the first check-in, and the first session as they happen.',
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                      <Icon className="h-5 w-5 text-[#00d4aa]" />
                      <h3 className="mt-3 text-sm font-semibold text-white">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{item.copy}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </main>
      </div>
    </AdminRouteGuard>
  );
};

export default PulseCheckOnboardingOverviewPage;
