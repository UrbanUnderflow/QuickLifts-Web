import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDownToLine,
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
  Clock,
  Copy,
  HeartPulse,
  HelpCircle,
  Laptop,
  Loader2,
  Mail,
  MailPlus,
  Map as MapIcon,
  MessageSquareText,
  MonitorCheck,
  Pencil,
  RefreshCw,
  Rocket,
  Search,
  ShieldCheck,
  SkipForward,
  Smartphone,
  Sparkles,
  Target,
  Users2,
  Watch,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { useDispatch } from 'react-redux';
import { useUser } from '../../hooks/useUser';
import { showToast } from '../../redux/toastSlice';
import { pulseCheckProvisioningService } from '../../api/firebase/pulsecheckProvisioning/service';
import type {
  PulseCheckOrganization,
  PulseCheckTeam,
  PulseCheckTeamMembership,
  PulseCheckPilot,
  PulseCheckPilotCohort,
  PulseCheckOnboardingTrackerStepId,
  PulseCheckOnboardingTrackerStepStatus,
  PulseCheckOnboardingTrackerState,
  PulseCheckReportCadence,
} from '../../api/firebase/pulsecheckProvisioning/types';
import {
  TEAM_ONBOARDING_TRACKER_STEPS,
  TRACKER_STATUS_OPTIONS,
  getTeamOnboardingStepStatus,
  getTeamOnboardingProgress,
} from '../../api/firebase/pulsecheckProvisioning/onboardingTracker';
import { pulsecheckCoachReportService } from '../../api/firebase/pulsecheckCoachReports';
import type { StoredCoachReport } from '../../api/firebase/pulsecheckCoachReports';

type PhaseSection = {
  eyebrow: string;
  short: string;
  title: string;
  owner: string;
  timing: string;
  icon: LucideIcon;
  summary: string;
  objective: string;
  actions: Array<{ lead: string; detail: string }>;
  outputs: string[];
  cta?: { label: string; href: string };
  preview?: 'intake';
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
    copy: 'This is where you create the organization, team, pilot group, and invite links, and set billing and support. The ten steps below turn that tool into a clear order of operations.',
  },
  {
    title: 'Launch day',
    status: 'The human part',
    icon: Watch,
    copy: 'Handing out devices, getting athletes into the app, the first check-in, syncing wearables, and the first session — this part runs on you and a good checklist, not on software alone.',
  },
];

// These ten phases mirror TEAM_ONBOARDING_TRACKER_STEPS (the live dashboard's
// source of truth) one-to-one and in the same order, so the playbook card and
// the dashboard never drift on step count, naming, or sequence.
const phases: PhaseSection[] = [
  {
    eyebrow: 'Step 1',
    short: 'Create org & team',
    title: 'Create the organization & team',
    owner: 'You (PulseCheck)',
    timing: 'Before kickoff',
    icon: Building2,
    summary: 'Stand up the organization, team, and access in the setup console so everything’s ready before the first coach call.',
    objective: 'Build the organization, team, and — when the rollout uses them — the pilot and cohort, so everything is ready before the first coach call.',
    actions: [
      { lead: 'Create the organization', detail: 'Display name, legal name, type, the main admin contact, and whether it’s a pilot or a full rollout.' },
      { lead: 'Create the team', detail: 'Sport, season, status, plan, billing model, roster rules, and who to contact if something needs escalating.' },
      { lead: 'Add a pilot group (if needed)', detail: 'For a pilot or phased rollout. Keep names obvious, like “Varsity Football, Spring 2026.”' },
      { lead: 'Generate invite links', detail: 'Admin and coach links. Click each one to confirm it drops the person into the right organization, team, and role.' },
      { lead: 'Double-check before kickoff', detail: 'Support contacts, counselor-bridge setting, billing setup, and the team’s preview screens.' },
    ],
    outputs: [
      'Organization and team created',
      'Pilot group created (if needed)',
      'Coach and staff invite links ready',
      'A plan for getting athletes in',
      'Setup notes written down',
    ],
    cta: { label: 'Open Provisioning Dashboard', href: '/admin/pulsecheckProvisioning' },
  },
  {
    eyebrow: 'Step 2',
    short: 'Intake',
    title: 'Intake — confirm the team before launch',
    owner: 'You (PulseCheck)',
    timing: 'Before kickoff',
    icon: ClipboardList,
    summary: 'Confirm everything about the team on paper — sponsor, staff, roster, launch date, support route, and devices — so there are no surprises.',
    objective: 'Get the full picture of the organization so you can set them up correctly and walk into launch day with no surprises.',
    actions: [
      { lead: 'Get the basics', detail: 'Organization name, who’s sponsoring it, paid rollout or pilot, the sport, team name, launch date, and the key people.' },
      { lead: 'List every adult', detail: 'Head coach, assistants, performance staff, athletic trainer, admin sponsor — with role, email, phone, and the access each one needs.' },
      { lead: 'Nail down the roster', detail: 'How many athletes, their age range, any parent-consent needs, where the list comes from, and whether they join by team link or individual invites.' },
      { lead: 'Sort out devices', detail: 'What athletes already have, what we’re providing, which wearables, charging, pairing, and how the room gets set up.' },
      { lead: 'Agree on who handles what', detail: 'Everyday questions, tech problems, looping in a counselor, and what to do if something urgent comes up.' },
    ],
    outputs: [
      'A filled-in intake record',
      'A calendar with the three meetings booked',
      'A list of who gets what access',
      'A device count and delivery plan',
      'Clear notes on who to contact for what',
    ],
    preview: 'intake',
  },
  {
    eyebrow: 'Step 3',
    short: 'Kickoff',
    title: 'Meeting 1 — coach kickoff',
    owner: 'You + the head coach',
    timing: 'Meeting 1 · 30–45 min',
    icon: MessageSquareText,
    summary: 'Get the coach comfortable with what PulseCheck does before any hands-on training.',
    objective: 'Get the coach comfortable — what PulseCheck does, what to expect, and why it’s worth their time — before any hands-on training.',
    actions: [
      { lead: 'Start with the goal', detail: 'What the organization wants to learn, how they’ll know it’s working, and what PulseCheck watches the first month.' },
      { lead: 'Walk through who’s who', detail: 'You, the coach, assistants, athletes, the athletic trainer, the sponsor, and who to contact for help.' },
      { lead: 'Lay out what’s coming', detail: 'The three meetings, how devices get handed out, how athletes get set up, and what the coach owns once it’s live.' },
      { lead: 'Preview the dashboard', detail: 'Team trends, reports, their follow-up list, the roster, check-in rates, and mental training activity.' },
      { lead: 'Be clear about the line', detail: 'PulseCheck helps coaches support athletes — it’s not an emergency service and doesn’t replace the safety plan.' },
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
    short: 'Training',
    title: 'Meeting 2 — dashboard & report training',
    owner: 'You + the coaching staff',
    timing: 'Meeting 2 · 60 min',
    icon: Laptop,
    summary: 'Teach coaches to read the dashboard and reports on their own, then act on what they see.',
    objective: 'Teach coaches to read the dashboard and reports on their own, and turn what they see into the right supportive action.',
    actions: [
      { lead: 'Tour the dashboard together', detail: 'Team summary cards, the current report, the trend wording, and the roster table.' },
      { lead: 'Teach one reading order', detail: 'Team snapshot, the changes that matter, how much data backs it, individual flags, suggested follow-up, what to watch next.' },
      { lead: 'Show what’s worth noticing', detail: 'A lasting change, a sudden drop-off, missing data, slipping check-ins, fatigue, recovery patterns, and repeat follow-ups.' },
      { lead: 'Show what not to over-read', detail: 'A single odd day, patchy wearable data, one missed check-in, or a report made before there’s enough data.' },
      { lead: 'Walk through Mental Training', detail: 'What’s assigned, the practice scenarios, who’s completing them, and why a coach’s response stays supportive — never a punishment.' },
      { lead: 'Cover what PulseCheck can’t see', detail: 'And exactly when to use the safety plan versus when PulseCheck staff follow up separately.' },
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
    short: 'Launch plan',
    title: 'Meeting 3 — book and plan launch day',
    owner: 'You + the head coach',
    timing: 'Meeting 3',
    icon: ClipboardCheck,
    summary: 'Lock the room plan, invite flow, delivery support, and athlete agenda so launch day runs clean.',
    objective: 'Have the room plan, invite flow, delivery support, troubleshooting, and athlete agenda ready for launch day.',
    actions: [
      { lead: 'Plan the room', detail: 'Device stations, charging, QR codes or invite links, a coach table, and someone on troubleshooting.' },
      { lead: 'Confirm the invite flow', detail: 'Team link or individual invites — and test one end to end so athletes land in the right team and role.' },
      { lead: 'Line up delivery support', detail: 'Who’s on troubleshooting, where backup devices are, and how anything urgent gets escalated.' },
      { lead: 'Write the athlete agenda', detail: 'The order launch day runs in — devices, setup, first check-in, first session — so nothing gets missed.' },
      { lead: 'Confirm the date and time', detail: 'Lock launch day on the calendar with the coach and everyone who needs to be in the room.' },
    ],
    outputs: [
      'Room and station plan ready',
      'Invite flow tested end to end',
      'Delivery support assigned',
      'Athlete agenda written',
      'Launch day booked on the calendar',
    ],
  },
  {
    eyebrow: 'Step 6',
    short: 'Devices',
    title: 'Devices synced',
    owner: 'You + the full team',
    timing: 'Launch day',
    icon: Watch,
    summary: 'Hand out devices, pair wearables, and reconcile the count so every athlete is connected or logged for follow-up.',
    objective: 'Reconcile the device count and get every athlete connected or on a clear follow-up list.',
    actions: [
      { lead: 'Hand out devices', detail: 'Check names, match device IDs where needed, and note anything missing or that needs replacing.' },
      { lead: 'Walk athletes through setup', detail: 'Install the app, make an account, consent screens, join the team, basic profile, and notifications.' },
      { lead: 'Pair and sync wearables', detail: 'Before anyone leaves, each athlete is either fully connected or on a follow-up list.' },
      { lead: 'Reconcile the count', detail: 'Devices handed out versus the roster — record every gap so none slip through.' },
    ],
    outputs: [
      'Devices handed out and matched',
      'Wearables paired and syncing',
      'Device sync status recorded',
      'Follow-up list for anyone absent or with device trouble',
    ],
  },
  {
    eyebrow: 'Step 7',
    short: 'First check-in',
    title: 'First check-in done',
    owner: 'Coach + athletes',
    timing: 'Launch day',
    icon: HeartPulse,
    summary: 'Athletes finish the first check-in and know when honest daily input is expected.',
    objective: 'Get the group through the first check-in and set the expectation for honest daily input.',
    actions: [
      { lead: 'Teach daily check-ins', detail: 'When to do them, what an honest answer looks like, how it helps their coach, and how PulseCheck keeps it private.' },
      { lead: 'Run the first check-in together', detail: 'As a group, so everyone gets the rhythm before they ever do one on their own.' },
      { lead: 'Set the daily expectation', detail: 'When check-ins are due and what consistency should look like week to week.' },
    ],
    outputs: [
      'First check-in done by the group',
      'Athletes know the daily routine',
      'Check-in expectations set',
    ],
  },
  {
    eyebrow: 'Step 8',
    short: 'First session',
    title: 'First mental training session done',
    owner: 'Coach + athletes',
    timing: 'Launch day',
    icon: Sparkles,
    summary: 'Athletes finish the first mental training session with PulseCheck staff in the room.',
    objective: 'Run the first mental training session together so athletes get the rhythm before doing one on their own.',
    actions: [
      { lead: 'Run the first session together', detail: 'As a group, with PulseCheck staff present to answer questions in the moment.' },
      { lead: 'Show what’s assigned', detail: 'The practice scenarios, who’s completing them, and where athletes find the next one.' },
      { lead: 'Frame the coach’s role', detail: 'A coach’s response to sessions stays supportive — never a punishment for what shows up.' },
    ],
    outputs: [
      'First session done together',
      'Athletes know how sessions work',
      'Coach knows how to talk about sessions',
    ],
  },
  {
    eyebrow: 'Step 9',
    short: 'Weekly snapshot',
    title: 'Weekly snapshot live',
    owner: 'You + coach success',
    timing: 'Post-launch',
    icon: BookOpenCheck,
    summary: 'The weekly report day, its owner, and how it reaches the coach are all set.',
    objective: 'Make the weekly report predictable — a set day, a clear owner, and a known delivery route to the coach.',
    actions: [
      { lead: 'Check in daily during launch week', detail: 'Who’s joined, are devices syncing, are check-ins happening, are reports ready, is anything stuck?' },
      { lead: 'Set the weekly snapshot', detail: 'Where the team is, how consistent check-ins are, what changed that matters, and what to follow up on.' },
      { lead: 'Confirm the day and owner', detail: 'Which day the snapshot goes out and exactly who is responsible for sending it.' },
      { lead: 'Confirm how it reaches the coach', detail: 'Email or dashboard — and that the coach can actually read it on their own.' },
    ],
    outputs: [
      'Daily launch-week notes',
      'Weekly snapshot scheduled',
      'Owner and delivery route set',
      'Coach can read the report on their own',
    ],
  },
  {
    eyebrow: 'Step 10',
    short: 'Stakeholder cadence',
    title: 'Stakeholder check-ins set',
    owner: 'You (PulseCheck)',
    timing: 'Post-launch',
    icon: CalendarClock,
    summary: 'Coach and sponsor check-ins are booked every two weeks with an owner and an action log.',
    objective: 'Keep coach and sponsor updates predictable — with an owner and a shared action log — and run a 30-day review.',
    actions: [
      { lead: 'Meet every two weeks', detail: 'With the coach and sponsor — trends, usage, open questions, risks, and what to do next.' },
      { lead: 'Keep one shared issue log', detail: 'Devices, access, roster changes, report questions — so no one explains the same problem twice.' },
      { lead: 'Run a 30-day review', detail: 'Usage, coach engagement, athlete completion, device reliability, report quality, and readiness to grow.' },
    ],
    outputs: [
      'Check-ins booked every two weeks',
      'An owner and action log in place',
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

// Generic step -> action registry. Any tracker step can grow action buttons here;
// today the intake step carries the athlete + coach intake actions.
const STEP_ACTIONS: Partial<Record<PulseCheckOnboardingTrackerStepId, Array<{ kind: 'athlete' | 'coach'; label: string }>>> = {
  intake: [
    { kind: 'athlete', label: 'Athlete intake' },
    { kind: 'coach', label: 'Coach intake' },
  ],
};

// Single-event meeting steps get a date picker + calendar/email actions.
const MEETING_STEP_TITLES: Partial<Record<PulseCheckOnboardingTrackerStepId, string>> = {
  'coach-kickoff': 'Meeting 1 — Coach kickoff',
  'dashboard-training': 'Meeting 2 — Dashboard & report training',
  'team-rollout': 'Meeting 3 — Team launch day',
  'stakeholder-cadence': 'Stakeholder check-in — first',
};

// Launch-day activity steps run in the live Launch-Day Mode room view.
const LAUNCH_DAY_STEP_IDS = new Set<PulseCheckOnboardingTrackerStepId>(['first-check-in', 'first-training']);

const icsStamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

const isoToLocalInput = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const buildMeetingGoogleUrl = (opts: { title: string; details: string; startISO: string; endISO: string }) => {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.title,
    dates: `${icsStamp(opts.startISO)}/${icsStamp(opts.endISO)}`,
    details: opts.details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

const buildMeetingIcs = (opts: { title: string; details: string; startISO: string; endISO: string }) => {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pulse Intelligence Labs//PulseCheck//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:pulsecheck-${icsStamp(opts.startISO)}-${Math.random().toString(36).slice(2, 8)}@fitwithpulse.ai`,
    `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART:${icsStamp(opts.startISO)}`,
    `DTEND:${icsStamp(opts.endISO)}`,
    `SUMMARY:${esc(opts.title)}`,
    `DESCRIPTION:${esc(opts.details)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
};

const downloadIcsFile = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// Step 9 (weekly snapshot) report config helpers.
const REPORT_CADENCE_OFFSET_DAYS: Record<PulseCheckReportCadence, number> = { weekly: 7, daily: 2 };
const REPORT_RECIPIENT_ROLES = new Set<string>(['team-admin', 'coach', 'performance-staff']);

type ReportDeliveryRecipient = {
  email: string;
  role?: string | null;
  status: string;
  ok?: boolean;
  date?: string | null;
  skipped?: boolean;
  messageId?: string | null;
};
type ReportDeliveryStatus = {
  deliveryStatus: string;
  sentAt?: unknown;
  sentCount?: number;
  recipients: ReportDeliveryRecipient[];
};

// Brevo event name -> coach-readable label.
const DELIVERY_LABEL: Record<string, string> = {
  requests: 'Accepted',
  delivered: 'Delivered',
  opened: 'Opened',
  clicks: 'Clicked',
  deferred: 'Deferred',
  sent: 'Sent',
  pending: 'Pending',
  skipped: 'Skipped',
  unknown: 'Unknown',
  hardBounces: 'Bounced',
  softBounces: 'Soft bounce',
  blocked: 'Blocked',
  spam: 'Spam',
  invalid: 'Invalid',
  error: 'Error',
  unsubscribed: 'Unsubscribed',
};
type DeliveryTone = 'good' | 'bad' | 'pending';
const DELIVERY_BADGE: Record<DeliveryTone, string> = {
  good: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  bad: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
  pending: 'border-white/10 bg-white/[0.05] text-slate-400',
};
const deliveryTone = (recipient: ReportDeliveryRecipient): DeliveryTone => {
  if (recipient.skipped) return 'pending';
  if (recipient.ok === false) return 'bad';
  if (['delivered', 'opened', 'clicks'].includes(recipient.status)) return 'good';
  return 'pending';
};

const formatShortDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const addDaysISO = (iso: string, days: number): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

const toISOFromTimestamp = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const anyVal = value as { toDate?: () => Date; seconds?: number };
  if (typeof anyVal.toDate === 'function') {
    try {
      return anyVal.toDate().toISOString();
    } catch {
      return '';
    }
  }
  if (typeof anyVal.seconds === 'number') return new Date(anyVal.seconds * 1000).toISOString();
  return '';
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
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(() => new Set([0]));

  const togglePhase = useCallback((index: number) => {
    setExpandedPhases((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const openPhase = useCallback((index: number) => {
    setExpandedPhases((current) => {
      const next = new Set(current);
      next.add(index);
      return next;
    });
    if (typeof document !== 'undefined') {
      window.requestAnimationFrame(() => {
        document.getElementById(`playbook-step-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, []);

  const currentUser = useUser();
  const dispatch = useDispatch();
  const [savingDueKey, setSavingDueKey] = useState<string | null>(null);
  const [emailingInviteKey, setEmailingInviteKey] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<PulseCheckOrganization[]>([]);
  const [teams, setTeams] = useState<PulseCheckTeam[]>([]);
  const [pilots, setPilots] = useState<PulseCheckPilot[]>([]);
  const [cohorts, setCohorts] = useState<PulseCheckPilotCohort[]>([]);
  const [boardLoading, setBoardLoading] = useState(true);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [savingStepKey, setSavingStepKey] = useState<string | null>(null);
  const [expandedTeamIds, setExpandedTeamIds] = useState<Set<string>>(() => new Set());
  const [boardFilter, setBoardFilter] = useState<DashboardFilter>('all');
  const [boardSearch, setBoardSearch] = useState('');
  const [membershipsByTeam, setMembershipsByTeam] = useState<Record<string, PulseCheckTeamMembership[]>>({});
  const [membershipsLoading, setMembershipsLoading] = useState<Record<string, boolean>>({});
  const [copiedActionKey, setCopiedActionKey] = useState<string | null>(null);
  // Step 9 — weekly snapshot report config + delivery.
  const [firstReportByTeam, setFirstReportByTeam] = useState<Record<string, StoredCoachReport | null>>({});
  const [firstReportLoading, setFirstReportLoading] = useState<Record<string, boolean>>({});
  const [deliveryByKey, setDeliveryByKey] = useState<Record<string, ReportDeliveryStatus>>({});
  const [deliveryLoadingKey, setDeliveryLoadingKey] = useState<string | null>(null);
  const [recipientDraft, setRecipientDraft] = useState<Record<string, string>>({});
  const [savingTrackerKey, setSavingTrackerKey] = useState<string | null>(null);

  // ── Nora voice walkthrough (plays on landing → "Begin" modal → scroll) ──
  const introAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const introStartedRef = React.useRef(false);
  const [introPlaying, setIntroPlaying] = useState(false);
  const [showBeginModal, setShowBeginModal] = useState(false);
  // Glowing "Skip Training" button — shows when Nora starts, fades out ~8s later.
  const [showSkipButton, setShowSkipButton] = useState(false);
  const [skipHiding, setSkipHiding] = useState(false);
  // Second beat: Nora narrates the live dashboard, then cues the scroll to the
  // ten-step playbook below.
  const dashboardAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const [dashboardNarrating, setDashboardNarrating] = useState(false);
  // Third beat: Nora walks Step 1 (provisioning); fourth beat: Step 2 (intake).
  const step1AudioRef = React.useRef<HTMLAudioElement | null>(null);
  const step2AudioRef = React.useRef<HTMLAudioElement | null>(null);
  const step1StartedRef = React.useRef(false);
  const step2StartedRef = React.useRef(false);
  const [step1Narrating, setStep1Narrating] = useState(false);
  const [step2Narrating, setStep2Narrating] = useState(false);
  // Fifth beat: Nora centers the three meeting cards (Steps 3–5) and gives the
  // overview of the three onboarding meetings.
  const meetingsAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const meetingsStartedRef = React.useRef(false);
  const [meetingsNarrating, setMeetingsNarrating] = useState(false);
  // Final beat: launch day → post-launch (Steps 6–10). Nora scrolls through the
  // five cards as she narrates each.
  const launchAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const launchStartedRef = React.useRef(false);
  const launchWaypointRef = React.useRef(0);
  const [launchNarrating, setLaunchNarrating] = useState(false);
  // When Nora says "click the … button", center that step's button and flash a
  // highlight ring for a few seconds.
  const ctaCueFiredRef = React.useRef<Set<number>>(new Set());
  const [highlightedCtaIndex, setHighlightedCtaIndex] = useState<number | null>(null);

  const highlightStepCta = useCallback((index: number) => {
    if (typeof document === 'undefined') return;
    document
      .getElementById(`playbook-cta-${index}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedCtaIndex(index);
    window.setTimeout(() => setHighlightedCtaIndex((cur) => (cur === index ? null : cur)), 5000);
  }, []);

  // Fire a step's CTA cue `lead` seconds before its clip ends — right as the
  // "just click…" line begins.
  const makeCtaCue = useCallback(
    (index: number, lead: number) => (e: React.SyntheticEvent<HTMLAudioElement>) => {
      const a = e.currentTarget;
      if (ctaCueFiredRef.current.has(index)) return;
      if (!a.duration || !Number.isFinite(a.duration)) return;
      if (a.duration - a.currentTime <= lead) {
        ctaCueFiredRef.current.add(index);
        highlightStepCta(index);
      }
    },
    [highlightStepCta]
  );
  const handleStep1TimeUpdate = useMemo(() => makeCtaCue(0, 9.5), [makeCtaCue]);
  const handleStep2TimeUpdate = useMemo(() => makeCtaCue(1, 6.5), [makeCtaCue]);

  // Expand a step's card and play its narration clip (once).
  const startStepNarration = useCallback(
    (
      index: number,
      audioRef: React.MutableRefObject<HTMLAudioElement | null>,
      startedRef: React.MutableRefObject<boolean>,
      setNarrating: (v: boolean) => void
    ) => {
      if (startedRef.current) return;
      startedRef.current = true;
      ctaCueFiredRef.current.delete(index);
      setExpandedPhases((current) => {
        const next = new Set(current);
        next.add(index);
        return next;
      });
      const audio = audioRef.current;
      if (!audio) return;
      try {
        audio.currentTime = 0;
        const played = audio.play();
        if (played && typeof played.then === 'function') {
          played.then(() => setNarrating(true)).catch(() => setNarrating(false));
        }
      } catch {
        setNarrating(false);
      }
    },
    []
  );

  const startStep1Narration = useCallback(
    () => startStepNarration(0, step1AudioRef, step1StartedRef, setStep1Narrating),
    [startStepNarration]
  );

  // Step 1 done (or skipped) → scroll to Step 2 and narrate it.
  const goToStep2 = useCallback(() => {
    if (typeof document === 'undefined') return;
    document.getElementById('playbook-step-1')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(
      () => startStepNarration(1, step2AudioRef, step2StartedRef, setStep2Narrating),
      1000
    );
  }, [startStepNarration]);

  const finishStep1 = useCallback(() => {
    const audio = step1AudioRef.current;
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    }
    setStep1Narrating(false);
    goToStep2();
  }, [goToStep2]);

  // Play the three-meetings overview without expanding any single card.
  const startMeetingsNarration = useCallback(() => {
    if (meetingsStartedRef.current) return;
    meetingsStartedRef.current = true;
    const audio = meetingsAudioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = 0;
      const played = audio.play();
      if (played && typeof played.then === 'function') {
        played.then(() => setMeetingsNarrating(true)).catch(() => setMeetingsNarrating(false));
      }
    } catch {
      setMeetingsNarrating(false);
    }
  }, []);

  // Step 2 done (or skipped) → center the three meeting cards and narrate them.
  const goToMeetings = useCallback(() => {
    if (typeof document === 'undefined') return;
    // Center on the middle card (Step 4) so the trio sits in the viewport.
    document.getElementById('playbook-step-3')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(startMeetingsNarration, 1000);
  }, [startMeetingsNarration]);

  const finishStep2 = useCallback(() => {
    const audio = step2AudioRef.current;
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    }
    setStep2Narrating(false);
    goToMeetings();
  }, [goToMeetings]);

  // Scroll waypoints (0-based playbook step index) keyed to a fraction of the
  // launch clip, so the right card is centered as Nora reaches it.
  const launchWaypoints = useMemo(
    () => [
      { frac: 0.3, idx: 6 }, // Step 7 — first check-in
      { frac: 0.48, idx: 7 }, // Step 8 — first session (baseline / sim / protocol)
      { frac: 0.7, idx: 8 }, // Step 9 — weekly snapshot (first report)
      { frac: 0.87, idx: 9 }, // Step 10 — stakeholder check-ins (first coach check-in)
    ],
    []
  );

  const handleLaunchTimeUpdate = useCallback(
    (e: React.SyntheticEvent<HTMLAudioElement>) => {
      const a = e.currentTarget;
      if (!a.duration || !Number.isFinite(a.duration)) return;
      while (
        launchWaypointRef.current < launchWaypoints.length &&
        a.currentTime >= a.duration * launchWaypoints[launchWaypointRef.current].frac
      ) {
        const wp = launchWaypoints[launchWaypointRef.current];
        document
          .getElementById(`playbook-step-${wp.idx}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        launchWaypointRef.current += 1;
      }
    },
    [launchWaypoints]
  );

  const startLaunchNarration = useCallback(() => {
    if (launchStartedRef.current) return;
    launchStartedRef.current = true;
    launchWaypointRef.current = 0;
    const audio = launchAudioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = 0;
      const played = audio.play();
      if (played && typeof played.then === 'function') {
        played.then(() => setLaunchNarrating(true)).catch(() => setLaunchNarrating(false));
      }
    } catch {
      setLaunchNarrating(false);
    }
  }, []);

  // Meetings overview done (or skipped) → center the launch-day cards and narrate.
  const goToLaunch = useCallback(() => {
    if (typeof document === 'undefined') return;
    document.getElementById('playbook-step-5')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(startLaunchNarration, 1000);
  }, [startLaunchNarration]);

  const finishMeetings = useCallback(() => {
    const audio = meetingsAudioRef.current;
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    }
    setMeetingsNarrating(false);
    goToLaunch();
  }, [goToLaunch]);

  const finishLaunch = useCallback(() => {
    const audio = launchAudioRef.current;
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    }
    setLaunchNarrating(false);
  }, []);

  const stopWalkthroughAudio = useCallback(() => {
    [introAudioRef, dashboardAudioRef, step1AudioRef, step2AudioRef, meetingsAudioRef, launchAudioRef].forEach((ref) => {
      const audio = ref.current;
      if (!audio) return;
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    });
    setIntroPlaying(false);
    setDashboardNarrating(false);
    setStep1Narrating(false);
    setStep2Narrating(false);
    setMeetingsNarrating(false);
    setLaunchNarrating(false);
    setShowBeginModal(false);
    setShowSkipButton(false);
    setSkipHiding(false);
    setHighlightedCtaIndex(null);
  }, []);

  const replayNoraTraining = useCallback(() => {
    stopWalkthroughAudio();
    introStartedRef.current = false;
    step1StartedRef.current = false;
    step2StartedRef.current = false;
    meetingsStartedRef.current = false;
    launchStartedRef.current = false;
    launchWaypointRef.current = 0;
    ctaCueFiredRef.current.clear();
    setExpandedPhases(new Set([0]));

    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem('pulsecheck-onboarding-intro', 'done');
      } catch {}
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    const audio = introAudioRef.current;
    if (!audio) {
      setShowBeginModal(true);
      return;
    }
    try {
      introStartedRef.current = true;
      audio.currentTime = 0;
      const played = audio.play();
      if (played && typeof played.then === 'function') {
        played.then(() => setIntroPlaying(true)).catch(() => setShowBeginModal(true));
      } else {
        setIntroPlaying(true);
      }
    } catch {
      setShowBeginModal(true);
    }
  }, [stopWalkthroughAudio]);

  const advanceToTenSteps = useCallback(() => {
    const audio = dashboardAudioRef.current;
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    }
    setDashboardNarrating(false);
    if (typeof document !== 'undefined') {
      window.requestAnimationFrame(() => {
        document.getElementById('ten-steps')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      // Let the scroll settle, then have Nora pick up with Step 1.
      window.setTimeout(startStep1Narration, 1100);
    }
  }, [startStep1Narration]);

  useEffect(() => {
    if (!introPlaying) {
      setShowSkipButton(false);
      setSkipHiding(false);
      return;
    }
    setShowSkipButton(true);
    setSkipHiding(false);
    const fadeTimer = window.setTimeout(() => setSkipHiding(true), 7600);
    const hideTimer = window.setTimeout(() => setShowSkipButton(false), 8000);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [introPlaying]);

  // Reveal the "Begin" modal once Nora finishes (or the user skips).
  const finishIntro = useCallback(() => {
    const audio = introAudioRef.current;
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    }
    setIntroPlaying(false);
    setShowBeginModal(true);
  }, []);

  // Begin → close modal, scroll to the live dashboard, and let Nora narrate it.
  // When her dashboard line finishes (or the operator skips), we scroll down to
  // the ten-step playbook.
  const beginWalkthrough = useCallback(() => {
    setShowBeginModal(false);
    if (typeof document !== 'undefined') {
      window.requestAnimationFrame(() => {
        document
          .getElementById('live-dashboard')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    // Play synchronously inside the click handler to keep the user gesture so
    // autoplay isn't blocked.
    const audio = dashboardAudioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = 0;
      const played = audio.play();
      if (played && typeof played.then === 'function') {
        played.then(() => setDashboardNarrating(true)).catch(() => advanceToTenSteps());
      }
    } catch {
      advanceToTenSteps();
    }
  }, [advanceToTenSteps]);

  // On landing, try to autoplay Nora. Browsers block unmuted audio without a
  // gesture, so fall back to the first pointer/key/scroll anywhere on the page.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Only run the intro once per browser session so revisits aren't noisy.
    let alreadyPlayed = false;
    try {
      alreadyPlayed = window.sessionStorage.getItem('pulsecheck-onboarding-intro') === 'done';
    } catch {}
    if (alreadyPlayed) return;

    const markPlayed = () => {
      try {
        window.sessionStorage.setItem('pulsecheck-onboarding-intro', 'done');
      } catch {}
    };

    const start = () => {
      if (introStartedRef.current) return;
      const audio = introAudioRef.current;
      if (!audio) return;
      introStartedRef.current = true;
      markPlayed();
      audio.currentTime = 0;
      audio
        .play()
        .then(() => setIntroPlaying(true))
        .catch(() => {
          // Playback rejected even after a gesture — skip straight to the modal.
          setShowBeginModal(true);
        });
    };

    // Attempt immediately (works on same-origin nav / recent interaction).
    const immediate = window.setTimeout(() => {
      const audio = introAudioRef.current;
      if (!audio || introStartedRef.current) return;
      audio.currentTime = 0;
      audio
        .play()
        .then(() => {
          introStartedRef.current = true;
          markPlayed();
          setIntroPlaying(true);
        })
        .catch(() => undefined); // blocked → wait for a gesture below
    }, 200);

    const events: Array<keyof WindowEventMap> = [
      'pointerdown',
      'touchstart',
      'keydown',
      'scroll',
      'wheel',
    ];
    events.forEach((ev) => window.addEventListener(ev, start, { once: true, passive: true }));

    return () => {
      window.clearTimeout(immediate);
      events.forEach((ev) => window.removeEventListener(ev, start));
    };
  }, []);

  const loadFirstReport = useCallback(async (teamId: string) => {
    setFirstReportLoading((current) => ({ ...current, [teamId]: true }));
    try {
      const report = await pulsecheckCoachReportService.getFirstReportForTeam(teamId);
      setFirstReportByTeam((current) => ({ ...current, [teamId]: report }));
    } catch (error) {
      console.error('[PulseCheckOnboardingOverview] Failed to load first report:', error);
      setFirstReportByTeam((current) => ({ ...current, [teamId]: null }));
    } finally {
      setFirstReportLoading((current) => {
        const next = { ...current };
        delete next[teamId];
        return next;
      });
    }
  }, []);

  const loadTeamMemberships = useCallback(async (teamId: string) => {
    setMembershipsLoading((current) => ({ ...current, [teamId]: true }));
    try {
      const members = await pulseCheckProvisioningService.listTeamMemberships(teamId);
      setMembershipsByTeam((current) => ({ ...current, [teamId]: members }));
    } catch (error) {
      console.error('[PulseCheckOnboardingOverview] Failed to load team memberships:', error);
    } finally {
      setMembershipsLoading((current) => {
        const next = { ...current };
        delete next[teamId];
        return next;
      });
    }
  }, []);

  const copyActionLink = (key: string, url: string) => {
    void navigator.clipboard.writeText(url).then(() => {
      setCopiedActionKey(key);
      window.setTimeout(() => setCopiedActionKey((current) => (current === key ? null : current)), 1800);
    }).catch((error) => {
      console.error('[PulseCheckOnboardingOverview] Failed to copy link:', error);
    });
  };

  const loadBoard = useCallback(async () => {
    setBoardLoading(true);
    setBoardError(null);
    try {
      const [orgs, allTeams, allPilots, allCohorts] = await Promise.all([
        pulseCheckProvisioningService.listOrganizations(),
        pulseCheckProvisioningService.listTeams(),
        pulseCheckProvisioningService.listPilots(),
        pulseCheckProvisioningService.listPilotCohorts(),
      ]);
      setOrganizations(orgs);
      setTeams(allTeams);
      setPilots(allPilots);
      setCohorts(allCohorts);
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

  // Lazily load memberships for expanded teams (for live intake completion counts).
  useEffect(() => {
    expandedTeamIds.forEach((teamId) => {
      if (!membershipsByTeam[teamId] && !membershipsLoading[teamId]) {
        void loadTeamMemberships(teamId);
      }
    });
  }, [expandedTeamIds, membershipsByTeam, membershipsLoading, loadTeamMemberships]);

  // Lazily load the first coach report for expanded teams (for step 9 delivery status).
  useEffect(() => {
    expandedTeamIds.forEach((teamId) => {
      if (firstReportByTeam[teamId] === undefined && !firstReportLoading[teamId]) {
        void loadFirstReport(teamId);
      }
    });
  }, [expandedTeamIds, firstReportByTeam, firstReportLoading, loadFirstReport]);

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

  const getStepDueDate = (team: PulseCheckTeam, stepId: PulseCheckOnboardingTrackerStepId): string =>
    team.implementationMetadata?.onboardingTracker?.steps?.[stepId]?.dueDate || '';

  const handleStepDueDateChange = async (
    team: PulseCheckTeam,
    stepId: PulseCheckOnboardingTrackerStepId,
    dueDate: string
  ) => {
    const savingKey = `${team.id}:${stepId}:date`;
    const currentTracker = team.implementationMetadata?.onboardingTracker || {};
    const currentStep = currentTracker.steps?.[stepId] || { status: 'pending' as PulseCheckOnboardingTrackerStepStatus };
    setSavingDueKey(savingKey);
    setBoardError(null);

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
              steps: { ...(tracker.steps || {}), [stepId]: { ...(tracker.steps?.[stepId] || { status: 'pending' }), dueDate } },
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
            [stepId]: { ...currentStep, dueDate, updatedByUserId: currentUser?.id || '', updatedByEmail: currentUser?.email || '' },
          },
        },
        updatedByUserId: currentUser?.id || '',
        updatedByEmail: currentUser?.email || '',
      });
    } catch (error) {
      console.error('[PulseCheckOnboardingOverview] Failed to save meeting date:', error);
      setBoardError('Could not save the meeting date. Refreshing the latest data.');
      await loadBoard();
    } finally {
      setSavingDueKey((current) => (current === savingKey ? null : current));
    }
  };

  const handleEmailMeetingInvite = async (
    team: PulseCheckTeam,
    stepId: PulseCheckOnboardingTrackerStepId,
    title: string,
    startISO: string
  ) => {
    const toEmail = team.defaultAdminEmail || '';
    if (!toEmail || !startISO) return;
    const key = `${team.id}:${stepId}`;
    setEmailingInviteKey(key);
    try {
      const orgName = organizationsById.get(team.organizationId)?.displayName || '';
      const response = await fetch('/.netlify/functions/send-pulsecheck-meeting-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail,
          toName: team.defaultAdminName || '',
          meetingTitle: title,
          startISO,
          teamName: team.displayName,
          organizationName: orgName,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result?.success) {
        dispatch(showToast({ message: `Calendar invite emailed to ${toEmail}.`, type: 'success', duration: 2800 }));
      } else {
        dispatch(showToast({ message: result?.error || 'Could not email the invite.', type: 'error', duration: 3200 }));
      }
    } catch (error) {
      console.error('[PulseCheckOnboardingOverview] Failed to email meeting invite:', error);
      dispatch(showToast({ message: 'Could not email the invite.', type: 'error', duration: 3200 }));
    } finally {
      setEmailingInviteKey((current) => (current === key ? null : current));
    }
  };

  // Patch tracker-level (non-step) fields like report cadence and recipient list.
  const updateTrackerFields = async (
    team: PulseCheckTeam,
    patch: Partial<PulseCheckOnboardingTrackerState>,
    savingKey: string
  ) => {
    const currentTracker = team.implementationMetadata?.onboardingTracker || {};
    setSavingTrackerKey(savingKey);
    setBoardError(null);

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
          implementationMetadata: { ...meta, onboardingTracker: { ...tracker, ...patch } },
        };
      })
    );

    try {
      await pulseCheckProvisioningService.updateTeamOnboardingTracker({
        teamId: team.id,
        onboardingTracker: { ...currentTracker, ...patch },
        updatedByUserId: currentUser?.id || '',
        updatedByEmail: currentUser?.email || '',
      });
    } catch (error) {
      console.error('[PulseCheckOnboardingOverview] Failed to save report settings:', error);
      setBoardError('Could not save the report settings. Refreshing the latest data.');
      await loadBoard();
    } finally {
      setSavingTrackerKey((current) => (current === savingKey ? null : current));
    }
  };

  const getReportRecipients = (team: PulseCheckTeam): string[] =>
    team.implementationMetadata?.onboardingTracker?.reportRecipientEmails || [];

  const handleReportCadenceChange = (team: PulseCheckTeam, cadence: PulseCheckReportCadence) =>
    void updateTrackerFields(team, { reportCadence: cadence }, `${team.id}:cadence`);

  const handleAddReportRecipient = (team: PulseCheckTeam) => {
    const draft = (recipientDraft[team.id] || '').trim().toLowerCase();
    if (!draft) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft)) {
      dispatch(showToast({ message: 'Enter a valid email address.', type: 'error', duration: 2600 }));
      return;
    }
    const existing = getReportRecipients(team);
    if (existing.some((email) => email.toLowerCase() === draft)) {
      setRecipientDraft((current) => ({ ...current, [team.id]: '' }));
      return;
    }
    setRecipientDraft((current) => ({ ...current, [team.id]: '' }));
    void updateTrackerFields(team, { reportRecipientEmails: [...existing, draft] }, `${team.id}:recipients`);
  };

  const handleRemoveReportRecipient = (team: PulseCheckTeam, email: string) => {
    const existing = getReportRecipients(team);
    void updateTrackerFields(
      team,
      { reportRecipientEmails: existing.filter((entry) => entry !== email) },
      `${team.id}:recipients`
    );
  };

  const handleCheckDeliveryStatus = async (team: PulseCheckTeam, reportId: string) => {
    const key = `${team.id}:${reportId}`;
    setDeliveryLoadingKey(key);
    try {
      const response = await fetch('/.netlify/functions/pulsecheck-report-delivery-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: team.id, reportId }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result?.success) {
        setDeliveryByKey((current) => ({ ...current, [key]: result as ReportDeliveryStatus }));
      } else {
        dispatch(showToast({ message: result?.error || 'Could not check delivery status.', type: 'error', duration: 3000 }));
      }
    } catch (error) {
      console.error('[PulseCheckOnboardingOverview] Failed to check delivery status:', error);
      dispatch(showToast({ message: 'Could not check delivery status.', type: 'error', duration: 3000 }));
    } finally {
      setDeliveryLoadingKey((current) => (current === key ? null : current));
    }
  };

  const organizationsById = useMemo(() => {
    const map = new Map<string, PulseCheckOrganization>();
    organizations.forEach((org) => map.set(org.id, org));
    return map;
  }, [organizations]);

  const teamIdsWithPilot = useMemo(() => new Set(pilots.map((pilot) => pilot.teamId)), [pilots]);
  const teamIdsWithCohort = useMemo(() => new Set(cohorts.map((cohort) => cohort.teamId)), [cohorts]);

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

        {/* Nora walkthrough audio — analyser-free, plays the scripted lines. */}
        <audio
          ref={introAudioRef}
          src="/audio/nora/nora-onboarding-intro.mp3"
          preload="auto"
          playsInline
          onPlay={() => setIntroPlaying(true)}
          onEnded={finishIntro}
          onError={() => {
            setIntroPlaying(false);
            setShowBeginModal(true);
          }}
        />
        <audio
          ref={dashboardAudioRef}
          src="/audio/nora/nora-onboarding-dashboard.mp3"
          preload="auto"
          playsInline
          onPlay={() => setDashboardNarrating(true)}
          onEnded={advanceToTenSteps}
          onError={advanceToTenSteps}
        />
        <audio
          ref={step1AudioRef}
          src="/audio/nora/nora-onboarding-step1.mp3"
          preload="auto"
          playsInline
          onPlay={() => setStep1Narrating(true)}
          onTimeUpdate={handleStep1TimeUpdate}
          onEnded={finishStep1}
          onError={finishStep1}
        />
        <audio
          ref={step2AudioRef}
          src="/audio/nora/nora-onboarding-step2.mp3"
          preload="auto"
          playsInline
          onPlay={() => setStep2Narrating(true)}
          onTimeUpdate={handleStep2TimeUpdate}
          onEnded={finishStep2}
          onError={finishStep2}
        />
        <audio
          ref={meetingsAudioRef}
          src="/audio/nora/nora-onboarding-meetings.mp3"
          preload="auto"
          playsInline
          onPlay={() => setMeetingsNarrating(true)}
          onEnded={finishMeetings}
          onError={finishMeetings}
        />
        <audio
          ref={launchAudioRef}
          src="/audio/nora/nora-onboarding-launch.mp3"
          preload="auto"
          playsInline
          onPlay={() => setLaunchNarrating(true)}
          onTimeUpdate={handleLaunchTimeUpdate}
          onEnded={finishLaunch}
          onError={finishLaunch}
        />

        {/* Shared styles for the glowing, pulsating skip buttons. */}
        <style>{`
          @keyframes pcSkipPulse {
            0%, 100% {
              box-shadow: 0 0 18px 2px rgba(0,212,170,0.45), 0 0 0 0 rgba(0,212,170,0.55);
              transform: scale(1);
            }
            50% {
              box-shadow: 0 0 36px 9px rgba(0,212,170,0.8), 0 0 0 9px rgba(0,212,170,0);
              transform: scale(1.06);
            }
          }
          @keyframes pcSkipIn {
            from { opacity: 0; transform: translateY(14px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .pc-skip-wrap {
            animation: pcSkipIn 0.45s cubic-bezier(0.16,1,0.3,1) both;
            transition: opacity 0.4s ease, transform 0.4s ease;
          }
          .pc-skip-wrap.pc-skip-out {
            opacity: 0;
            transform: translateY(14px);
          }
          .pc-skip-btn {
            animation: pcSkipPulse 1.5s ease-in-out infinite;
          }
          @keyframes pcCtaHighlight {
            0%, 100% { box-shadow: 0 0 0 0 rgba(0,212,170,0), 0 0 18px rgba(0,212,170,0.35); }
            50% { box-shadow: 0 0 0 6px rgba(0,212,170,0.5), 0 0 36px rgba(0,212,170,0.85); }
          }
          .pc-cta-highlight {
            animation: pcCtaHighlight 1s ease-in-out infinite;
            outline: 2px solid rgba(0,212,170,0.95);
            outline-offset: 3px;
          }
        `}</style>

        {/* Glowing "Skip Training" button — appears when Nora starts the intro
            and fades out after ~8s so repeat visitors can bail fast. */}
        {showSkipButton && (
          <div className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center">
            <div className={`pc-skip-wrap pointer-events-auto ${skipHiding ? 'pc-skip-out' : ''}`}>
              <button
                type="button"
                onClick={finishIntro}
                className="pc-skip-btn inline-flex items-center gap-2 rounded-full bg-[#00d4aa] px-6 py-3 text-sm font-bold text-[#06100e]"
              >
                <SkipForward className="h-4 w-4" />
                Skip Training
              </button>
            </div>
          </div>
        )}

        {/* Glowing "Skip to the steps" button — shown while Nora narrates the
            live dashboard so the operator can jump straight to the ten steps. */}
        {dashboardNarrating && (
          <div className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center">
            <div className="pc-skip-wrap pointer-events-auto">
              <button
                type="button"
                onClick={advanceToTenSteps}
                className="pc-skip-btn inline-flex items-center gap-2 rounded-full bg-[#00d4aa] px-6 py-3 text-sm font-bold text-[#06100e]"
              >
                <SkipForward className="h-4 w-4" />
                Skip to the steps
              </button>
            </div>
          </div>
        )}

        {/* Glowing skip button — shown while Nora narrates Step 1 (provisioning). */}
        {step1Narrating && (
          <div className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center">
            <div className="pc-skip-wrap pointer-events-auto">
              <button
                type="button"
                onClick={finishStep1}
                className="pc-skip-btn inline-flex items-center gap-2 rounded-full bg-[#00d4aa] px-6 py-3 text-sm font-bold text-[#06100e]"
              >
                <SkipForward className="h-4 w-4" />
                Skip step
              </button>
            </div>
          </div>
        )}

        {/* Glowing skip button — shown while Nora narrates Step 2 (intake). */}
        {step2Narrating && (
          <div className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center">
            <div className="pc-skip-wrap pointer-events-auto">
              <button
                type="button"
                onClick={finishStep2}
                className="pc-skip-btn inline-flex items-center gap-2 rounded-full bg-[#00d4aa] px-6 py-3 text-sm font-bold text-[#06100e]"
              >
                <SkipForward className="h-4 w-4" />
                Skip step
              </button>
            </div>
          </div>
        )}

        {/* Glowing skip button — shown while Nora gives the three-meetings overview. */}
        {meetingsNarrating && (
          <div className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center">
            <div className="pc-skip-wrap pointer-events-auto">
              <button
                type="button"
                onClick={finishMeetings}
                className="pc-skip-btn inline-flex items-center gap-2 rounded-full bg-[#00d4aa] px-6 py-3 text-sm font-bold text-[#06100e]"
              >
                <SkipForward className="h-4 w-4" />
                Skip section
              </button>
            </div>
          </div>
        )}

        {/* Glowing skip button — shown while Nora narrates launch day → post-launch. */}
        {launchNarrating && (
          <div className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center">
            <div className="pc-skip-wrap pointer-events-auto">
              <button
                type="button"
                onClick={finishLaunch}
                className="pc-skip-btn inline-flex items-center gap-2 rounded-full bg-[#00d4aa] px-6 py-3 text-sm font-bold text-[#06100e]"
              >
                <SkipForward className="h-4 w-4" />
                Skip section
              </button>
            </div>
          </div>
        )}

        {/* "Begin" modal — appears once Nora finishes (or staff skips). */}
        {showBeginModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#00d4aa]/20 bg-[#0d1119] p-7 text-center shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#00d4aa]/30 bg-[#00d4aa]/10">
                <Sparkles className="h-7 w-7 text-[#00d4aa]" />
              </div>
              <h3 className="text-xl font-semibold tracking-tight text-white">Ready to begin?</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Let's start where every team you're onboarding stands right now. I'll take you to the live dashboard.
              </p>
              <button
                type="button"
                onClick={beginWalkthrough}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#00d4aa] px-4 py-3 text-sm font-semibold text-[#06100e] transition hover:brightness-110"
              >
                Begin
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

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
                  <button
                    type="button"
                    onClick={replayNoraTraining}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#00d4aa]/25 bg-[#00d4aa]/10 px-4 py-2.5 text-sm font-semibold text-[#8ff5dd] transition hover:border-[#00d4aa]/40 hover:bg-[#00d4aa]/15"
                  >
                    Replay Nora training
                    <RefreshCw className="h-4 w-4" />
                  </button>
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
          <section id="live-dashboard" className="scroll-mt-6 rounded-2xl border border-white/10 bg-[#0d1119] p-5 sm:p-7">
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
                                          className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
                                        >
                                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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

                                          {step.id === 'provisioning' ? (
                                            <div className="mt-3 flex flex-col gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-end sm:justify-between">
                                              <div className="flex items-end gap-2">
                                                {[
                                                  { label: 'Org', done: true },
                                                  { label: 'Team', done: true },
                                                  { label: 'Pilot', done: teamIdsWithPilot.has(team.id) },
                                                  { label: 'Cohort', done: teamIdsWithCohort.has(team.id) },
                                                ].map((seg) => (
                                                  <div key={seg.label} className="flex flex-col items-center gap-1">
                                                    <span className={`h-1.5 w-12 rounded-full ${seg.done ? 'bg-emerald-400' : 'bg-white/10'}`} />
                                                    <span className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${seg.done ? 'text-slate-300' : 'text-slate-600'}`}>
                                                      {seg.label}
                                                    </span>
                                                  </div>
                                                ))}
                                              </div>
                                              <Link
                                                href={`/admin/pulsecheckProvisioning?focusOrg=${encodeURIComponent(team.organizationId)}&focusTeam=${encodeURIComponent(team.id)}`}
                                                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#00d4aa]/30 bg-[#00d4aa]/10 px-3 py-1.5 text-xs font-semibold text-[#00d4aa] transition hover:bg-[#00d4aa]/20"
                                              >
                                                Open Provisioning
                                                <ArrowRight className="h-3.5 w-3.5" />
                                              </Link>
                                            </div>
                                          ) : null}

                                          {step.id === 'device-sync' ? (
                                            <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
                                              <p className="text-[11px] text-slate-400">
                                                Track which device each athlete has synced and how consistently they&apos;re wearing it.
                                              </p>
                                              <Link
                                                href={`/admin/pulsecheckDeviceDashboard?focusOrg=${encodeURIComponent(team.organizationId)}&focusTeam=${encodeURIComponent(team.id)}`}
                                                className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#00d4aa]/30 bg-[#00d4aa]/10 px-3 py-1.5 text-xs font-semibold text-[#00d4aa] transition hover:bg-[#00d4aa]/20"
                                              >
                                                <Smartphone className="h-3.5 w-3.5" />
                                                Open Device Dashboard
                                                <ArrowRight className="h-3.5 w-3.5" />
                                              </Link>
                                            </div>
                                          ) : null}

                                          {MEETING_STEP_TITLES[step.id] ? (() => {
                                            const due = getStepDueDate(team, step.id);
                                            const title = `${MEETING_STEP_TITLES[step.id]} · ${team.displayName}`;
                                            const details = step.description;
                                            const endISO = due ? new Date(new Date(due).getTime() + 60 * 60 * 1000).toISOString() : '';
                                            const emailing = emailingInviteKey === `${team.id}:${step.id}`;
                                            const savingDate = savingDueKey === `${team.id}:${step.id}:date`;
                                            const btnClass = 'inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/[0.07] disabled:opacity-40';
                                            return (
                                              <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
                                                <label className="flex items-center gap-2 text-xs text-slate-400">
                                                  <span>Scheduled</span>
                                                  <input
                                                    type="datetime-local"
                                                    value={isoToLocalInput(due)}
                                                    onChange={(event) => void handleStepDueDateChange(team, step.id, event.target.value ? new Date(event.target.value).toISOString() : '')}
                                                    className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs text-white focus:border-[#00d4aa]/40 focus:outline-none"
                                                  />
                                                  {savingDate ? <Loader2 className="h-3 w-3 animate-spin text-[#00d4aa]" /> : null}
                                                </label>
                                                <div className="flex flex-wrap items-center gap-2">
                                                  <button type="button" className={btnClass} disabled={!due} onClick={() => window.open(buildMeetingGoogleUrl({ title, details, startISO: due, endISO }), '_blank', 'noopener')}>
                                                    <CalendarClock className="h-3.5 w-3.5" /> Google
                                                  </button>
                                                  <button type="button" className={btnClass} disabled={!due} onClick={() => downloadIcsFile('pulsecheck-meeting.ics', buildMeetingIcs({ title, details, startISO: due, endISO }))}>
                                                    <ArrowDownToLine className="h-3.5 w-3.5" /> .ics
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#00d4aa]/30 bg-[#00d4aa]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#00d4aa] transition hover:bg-[#00d4aa]/20 disabled:opacity-40"
                                                    disabled={!due || !team.defaultAdminEmail || emailing}
                                                    title={!team.defaultAdminEmail ? 'Add an admin email on the team to email the invite' : undefined}
                                                    onClick={() => void handleEmailMeetingInvite(team, step.id, title, due)}
                                                  >
                                                    {emailing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MailPlus className="h-3.5 w-3.5" />}
                                                    Email coach
                                                  </button>
                                                </div>
                                              </div>
                                            );
                                          })() : null}

                                          {step.id === 'weekly-snapshot' ? (() => {
                                            const tracker = team.implementationMetadata?.onboardingTracker;
                                            const cadence: PulseCheckReportCadence = tracker?.reportCadence || 'weekly';
                                            const launchISO = getStepDueDate(team, 'team-rollout') || tracker?.launchTargetDate || '';
                                            const expectedISO = launchISO ? addDaysISO(launchISO, REPORT_CADENCE_OFFSET_DAYS[cadence]) : '';
                                            const savingCadence = savingTrackerKey === `${team.id}:cadence`;
                                            const savingRecipients = savingTrackerKey === `${team.id}:recipients`;
                                            const report = firstReportByTeam[team.id];
                                            const loadingReport = !!firstReportLoading[team.id];
                                            const addOns = getReportRecipients(team);
                                            const members = membershipsByTeam[team.id];
                                            const derived = (members || []).filter((member) => REPORT_RECIPIENT_ROLES.has(member.role));
                                            const deliveryKey = report ? `${team.id}:${report.id}` : '';
                                            const delivery = deliveryKey ? deliveryByKey[deliveryKey] : undefined;
                                            const checkingDelivery = deliveryLoadingKey === deliveryKey;
                                            const chipBtn = 'inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/[0.07] disabled:opacity-40';
                                            const reportSentCount = report?.emailDelivery?.sentCount ?? report?.sentTo?.length ?? 0;
                                            return (
                                              <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                  <label className="flex items-center gap-2 text-xs text-slate-400">
                                                    <span>Report cadence</span>
                                                    <select
                                                      value={cadence}
                                                      disabled={savingCadence}
                                                      onChange={(event) => handleReportCadenceChange(team, event.target.value as PulseCheckReportCadence)}
                                                      className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs text-white focus:border-[#00d4aa]/40 focus:outline-none disabled:opacity-60"
                                                    >
                                                      <option value="weekly">Weekly</option>
                                                      <option value="daily">Daily</option>
                                                    </select>
                                                    {savingCadence ? <Loader2 className="h-3 w-3 animate-spin text-[#00d4aa]" /> : null}
                                                  </label>
                                                  <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                                                    {expectedISO ? (
                                                      <span>
                                                        First report expected <span className="font-semibold text-slate-200">{formatShortDate(expectedISO)}</span>
                                                        {' · '}{cadence === 'daily' ? 'then daily' : 'then weekly'}
                                                      </span>
                                                    ) : (
                                                      <span>Set Meeting 3 (launch day) to project the first report date</span>
                                                    )}
                                                  </p>
                                                </div>

                                                <div className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                                                  <div className="flex items-center justify-between gap-2">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">First report delivery</p>
                                                    {report ? (
                                                      <button type="button" className={chipBtn} disabled={checkingDelivery} onClick={() => void handleCheckDeliveryStatus(team, report.id)}>
                                                        {checkingDelivery ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                                        Check delivery
                                                      </button>
                                                    ) : null}
                                                  </div>
                                                  <div className="mt-2 text-xs">
                                                    {loadingReport ? (
                                                      <span className="flex items-center gap-1.5 text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Looking for the first report…</span>
                                                    ) : !report ? (
                                                      <span className="text-slate-400">No report generated yet.{expectedISO ? ` Expected by ${formatShortDate(expectedISO)}.` : ''}</span>
                                                    ) : (() => {
                                                      const ds = report.deliveryStatus || (report.reviewStatus === 'sent' ? 'sent' : 'not_sent');
                                                      const sentAtISO = toISOFromTimestamp(report.sentAt);
                                                      if (ds === 'sent') {
                                                        return (
                                                          <span className="flex items-center gap-1.5 text-emerald-300">
                                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                                            Delivered{sentAtISO ? ` ${formatShortDate(sentAtISO)}` : ''} to {reportSentCount} recipient{reportSentCount === 1 ? '' : 's'}
                                                          </span>
                                                        );
                                                      }
                                                      if (ds === 'failed') {
                                                        return (
                                                          <span className="flex items-center gap-1.5 text-rose-300">
                                                            <XCircle className="h-3.5 w-3.5" />
                                                            Send failed{report.lastEmailError ? ` — ${report.lastEmailError}` : ''}
                                                          </span>
                                                        );
                                                      }
                                                      return (
                                                        <span className="flex items-center gap-1.5 text-amber-300">
                                                          <Clock className="h-3.5 w-3.5" /> Draft ready · not sent yet
                                                        </span>
                                                      );
                                                    })()}
                                                  </div>
                                                  {delivery && delivery.recipients?.length ? (
                                                    <ul className="mt-2 space-y-1 border-t border-white/10 pt-2">
                                                      {delivery.recipients.map((recipient) => (
                                                        <li key={`${recipient.email}:${recipient.messageId || ''}`} className="flex items-center justify-between gap-2 text-[11px]">
                                                          <span className="truncate text-slate-300">{recipient.email}</span>
                                                          <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${DELIVERY_BADGE[deliveryTone(recipient)]}`}>
                                                            {DELIVERY_LABEL[recipient.status] || recipient.status}
                                                          </span>
                                                        </li>
                                                      ))}
                                                    </ul>
                                                  ) : null}
                                                </div>

                                                <div className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                                                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Who the report goes to</p>
                                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {!members ? (
                                                      <span className="text-[11px] text-slate-500">{membershipsLoading[team.id] ? 'Loading team…' : 'Expand to load team recipients'}</span>
                                                    ) : derived.length === 0 ? (
                                                      <span className="text-[11px] text-slate-500">No coach or staff on the roster yet</span>
                                                    ) : (
                                                      derived.map((member) => (
                                                        <span key={member.id} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-slate-300">
                                                          {member.email || member.title || member.role}
                                                          <span className="text-slate-500">· {member.role}</span>
                                                        </span>
                                                      ))
                                                    )}
                                                  </div>
                                                  <p className="mt-3 text-[11px] text-slate-500">Add-on recipients (merged with the team list above when reports send):</p>
                                                  {addOns.length ? (
                                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                      {addOns.map((email) => (
                                                        <span key={email} className="inline-flex items-center gap-1 rounded-full border border-[#00d4aa]/30 bg-[#00d4aa]/10 px-2 py-0.5 text-[11px] text-[#00d4aa]">
                                                          <Mail className="h-3 w-3" />
                                                          {email}
                                                          <button type="button" onClick={() => handleRemoveReportRecipient(team, email)} className="ml-0.5 text-[#00d4aa]/70 transition hover:text-[#00d4aa]">
                                                            <XCircle className="h-3 w-3" />
                                                          </button>
                                                        </span>
                                                      ))}
                                                    </div>
                                                  ) : null}
                                                  <div className="mt-2 flex items-center gap-2">
                                                    <input
                                                      type="email"
                                                      placeholder="add email…"
                                                      value={recipientDraft[team.id] || ''}
                                                      onChange={(event) => setRecipientDraft((current) => ({ ...current, [team.id]: event.target.value }))}
                                                      onKeyDown={(event) => {
                                                        if (event.key === 'Enter') {
                                                          event.preventDefault();
                                                          handleAddReportRecipient(team);
                                                        }
                                                      }}
                                                      className="flex-1 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs text-white focus:border-[#00d4aa]/40 focus:outline-none"
                                                    />
                                                    <button type="button" className={chipBtn} disabled={savingRecipients} onClick={() => handleAddReportRecipient(team)}>
                                                      {savingRecipients ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MailPlus className="h-3.5 w-3.5" />}
                                                      Add
                                                    </button>
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })() : null}

                                          {LAUNCH_DAY_STEP_IDS.has(step.id) ? (() => {
                                            const members = membershipsByTeam[team.id];
                                            const loadingMembers = !!membershipsLoading[team.id];
                                            let readout: string;
                                            if (step.id === 'first-training') {
                                              if (!members) {
                                                readout = loadingMembers ? 'First session · counting…' : 'Run the first session with the team on launch day.';
                                              } else {
                                                const athletes = members.filter((member) => member.role === 'athlete');
                                                const done = athletes.filter((member) => member.athleteOnboarding?.baselinePathStatus === 'complete').length;
                                                readout = `First session · ${done}/${athletes.length} athletes done`;
                                              }
                                            } else {
                                              readout = 'Run the first check-in with the team on launch day.';
                                            }
                                            return (
                                              <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
                                                <p className="text-xs text-slate-400">{readout}</p>
                                                <Link
                                                  href={`/PulseCheck/team-workspace?organizationId=${encodeURIComponent(team.organizationId)}&teamId=${encodeURIComponent(team.id)}&mode=launch-day`}
                                                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#00d4aa]/30 bg-[#00d4aa]/10 px-3 py-1.5 text-xs font-semibold text-[#00d4aa] transition hover:bg-[#00d4aa]/20"
                                                >
                                                  Open Launch-Day Mode
                                                  <ArrowRight className="h-3.5 w-3.5" />
                                                </Link>
                                              </div>
                                            );
                                          })() : null}

                                          {STEP_ACTIONS[step.id] ? (
                                            <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                                              {STEP_ACTIONS[step.id]!.map((action) => {
                                                const questions = action.kind === 'athlete'
                                                  ? team.intake?.athlete?.questions
                                                  : team.intake?.coach?.questions;
                                                const configuredCount = questions?.length || 0;
                                                const members = membershipsByTeam[team.id];
                                                const loadingMembers = !!membershipsLoading[team.id];
                                                let completion: string;
                                                if (!members) {
                                                  completion = loadingMembers ? 'counting…' : '—';
                                                } else if (action.kind === 'athlete') {
                                                  const athletes = members.filter((member) => member.role === 'athlete');
                                                  const done = athletes.filter((member) => Object.keys(member.athleteOnboarding?.intakeResponses || {}).length > 0).length;
                                                  completion = `${done}/${athletes.length} done`;
                                                } else {
                                                  const adults = members.filter((member) => member.role !== 'athlete');
                                                  const done = adults.filter((member) => Object.keys(member.coachIntakeResponses || {}).length > 0).length;
                                                  completion = `${done}/${adults.length} done`;
                                                }
                                                const path = action.kind === 'athlete' ? '/PulseCheck/athlete-onboarding' : '/PulseCheck/post-activation';
                                                const relative = `${path}?organizationId=${encodeURIComponent(team.organizationId)}&teamId=${encodeURIComponent(team.id)}`;
                                                const copyKey = `${team.id}:${action.kind}`;
                                                return (
                                                  <div key={action.kind} className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/20 p-2.5 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="min-w-0">
                                                      <p className="text-xs font-semibold text-white">{action.label}</p>
                                                      <p className="text-[11px] text-slate-400">
                                                        {configuredCount > 0 ? `${configuredCount} question${configuredCount === 1 ? '' : 's'}` : 'Not set up'}
                                                        {' · '}
                                                        {completion}
                                                      </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                      <button
                                                        type="button"
                                                        onClick={() => copyActionLink(copyKey, `${window.location.origin}${relative}`)}
                                                        disabled={configuredCount === 0}
                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/[0.07] disabled:opacity-40"
                                                      >
                                                        {copiedActionKey === copyKey ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                                                        {copiedActionKey === copyKey ? 'Copied' : 'Copy link'}
                                                      </button>
                                                      <Link
                                                        href={`/admin/pulsecheckProvisioning?focusOrg=${encodeURIComponent(team.organizationId)}&focusTeam=${encodeURIComponent(team.id)}&focusIntake=${action.kind}`}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-[#00d4aa]/30 bg-[#00d4aa]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#00d4aa] transition hover:bg-[#00d4aa]/20"
                                                      >
                                                        {configuredCount > 0 ? 'Edit' : 'Set up'}
                                                        <ArrowRight className="h-3 w-3" />
                                                      </Link>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          ) : null}
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

          <section id="ten-steps" className="scroll-mt-6 rounded-2xl border border-white/10 bg-[#0d1119] p-5 sm:p-7">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00d4aa]">The Ten Steps</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">From first call to a steady rhythm</h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-slate-400">
                Do these in order. Tap a step to see exactly what it means and how to run it.
              </p>
            </div>

            {/* At-a-glance stepper — jump straight to any step */}
            <div className="mb-4 flex flex-wrap gap-2">
              {phases.map((phase, index) => (
                <button
                  key={phase.title}
                  type="button"
                  onClick={() => openPhase(index)}
                  className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.025] py-1.5 pl-1.5 pr-3 text-xs font-medium text-slate-300 transition hover:border-[#00d4aa]/40 hover:bg-[#00d4aa]/10 hover:text-white"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#00d4aa]/15 text-[10px] font-semibold text-[#00d4aa]">
                    {index + 1}
                  </span>
                  {phase.short}
                </button>
              ))}
            </div>

            <div className="mb-3 flex items-center justify-end">
              <button
                type="button"
                onClick={() =>
                  setExpandedPhases((current) =>
                    current.size === phases.length ? new Set() : new Set(phases.map((_, index) => index))
                  )
                }
                className="text-xs font-medium text-slate-400 transition hover:text-[#00d4aa]"
              >
                {expandedPhases.size === phases.length ? 'Collapse all' : 'Expand all'}
              </button>
            </div>

            <div className="space-y-3">
              {phases.map((phase, index) => {
                const Icon = phase.icon;
                const open = expandedPhases.has(index);
                return (
                  <article
                    key={phase.title}
                    id={`playbook-step-${index}`}
                    className={`scroll-mt-24 overflow-hidden rounded-2xl border transition ${
                      open ? 'border-[#00d4aa]/30 bg-white/[0.03]' : 'border-white/10 bg-white/[0.02]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => togglePhase(index)}
                      className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-white/[0.025] sm:p-5"
                    >
                      <span className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[#00d4aa]">
                        <Icon className="h-5 w-5" />
                        <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#00d4aa] text-[11px] font-bold text-[#06100e]">
                          {index + 1}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#00d4aa]">{phase.eyebrow}</span>
                          <span className="text-[11px] text-slate-500">· {phase.timing}</span>
                        </div>
                        <h3 className="mt-0.5 text-base font-semibold leading-tight text-white sm:text-lg">{phase.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-400">{phase.summary}</p>
                      </div>
                      <ChevronDown
                        className={`h-5 w-5 flex-shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180 text-[#00d4aa]' : ''}`}
                      />
                    </button>

                    {open && (
                      <div className="border-t border-white/10 px-4 pb-5 pt-4 sm:px-5">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-slate-300">
                            <span className="text-slate-500">Owner</span>
                            <span className="font-medium text-white">{phase.owner}</span>
                          </div>
                          {phase.cta && (
                            <Link
                              id={`playbook-cta-${index}`}
                              href={phase.cta.href}
                              className={`inline-flex items-center gap-2 rounded-lg bg-[#00d4aa] px-4 py-2.5 text-sm font-semibold text-[#06100e] shadow-[0_0_20px_rgba(0,212,170,0.35)] transition hover:brightness-110 ${
                                highlightedCtaIndex === index ? 'pc-cta-highlight' : ''
                              }`}
                            >
                              {phase.cta.label}
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          )}
                        </div>
                        <div className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
                          <div>
                            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Required Steps</p>
                            <div className="space-y-2.5">
                              {phase.actions.map((action) => (
                                <div key={action.lead} className="flex gap-3 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
                                  <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#00d4aa]" />
                                  <p className="text-sm leading-6 text-slate-400">
                                    <span className="font-semibold text-white">{action.lead}.</span> {action.detail}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">You’ll walk away with</p>
                            <div className="space-y-2">
                              {phase.outputs.map((output) => (
                                <div key={output} className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-300">
                                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#00d4aa]" />
                                  <span>{output}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        {phase.preview === 'intake' && (
                          <div className="mt-5">
                            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Where you’ll edit it</p>
                            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5">
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[#00d4aa]">
                                    <ClipboardList className="h-4 w-4" />
                                  </span>
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#00d4aa]">Provisioning console</p>
                                    <p className="text-sm font-semibold text-white">Intake Surveys · Varsity Football</p>
                                  </div>
                                </div>
                                <span
                                  id={`playbook-cta-${index}`}
                                  className={`inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-slate-200 ${
                                    highlightedCtaIndex === index ? 'pc-cta-highlight' : ''
                                  }`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Edit
                                </span>
                              </div>
                              <div className="space-y-2">
                                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs leading-5 text-slate-400">
                                  <span className="text-slate-500">Athlete · Q1 · </span>
                                  On a scale of 1–10, how mentally ready do you feel heading into this season?
                                </div>
                                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs leading-5 text-slate-400">
                                  <span className="text-slate-500">Coach · Q1 · </span>
                                  What does a great season look like for this team?
                                </div>
                                <div className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs leading-5 text-slate-400">
                                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#00d4aa]" />
                                  <span>
                                    <span className="text-slate-500">Consent form · </span>
                                    Operational v1 — signature required before launch
                                  </span>
                                </div>
                              </div>
                              <p className="mt-3 text-[11px] leading-5 text-slate-500">
                                Preview — this is how the intake appears in the provisioning console once your org &amp; team are created. The default questions and consent forms are ready to go; tap <span className="font-medium text-slate-300">Edit</span> to tailor them.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
