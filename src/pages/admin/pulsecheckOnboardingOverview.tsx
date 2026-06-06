import React, { useState } from 'react';
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
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Copy,
  HeartPulse,
  HelpCircle,
  Laptop,
  MailPlus,
  Map,
  MessageSquareText,
  MonitorCheck,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  Users2,
  Watch,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';

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
  'Organization, team, pilot, cohort, support route, and escalation posture are configured in provisioning.',
  'Coach and adult staff access is active, role-scoped, and verified against the school staff list.',
  'Roster source, athlete invite path, device inventory, and launch-day room plan are confirmed.',
  'Coach has completed dashboard training and can explain the latest report, follow-up queue, and safety visibility boundaries.',
  'PulseCheck staff has the monitoring calendar, weekly report snapshot day, and stakeholder meeting series scheduled for every two weeks.',
];

const currentState = [
  {
    title: 'Coach dashboard is useful for launch',
    status: 'Ready now',
    icon: MonitorCheck,
    copy: 'The coach home already exposes team health, latest Sports Intelligence reporting, coach follow-up items, roster visibility, and athlete drill-down paths.',
  },
  {
    title: 'Report training needs a guided layer',
    status: 'Needs structure',
    icon: BookOpenCheck,
    copy: 'Nora coach reports are present, but coaches need a repeatable reading script, glossary, and in-product walkthrough so training is not dependent on a live call alone.',
  },
  {
    title: 'Provisioning exists but needs a playbook',
    status: 'Now covered here',
    icon: Building2,
    copy: 'The admin console can create organizations, teams, pilots, cohorts, invite links, commercial settings, and support routes. This page turns that tooling into an operating sequence.',
  },
  {
    title: 'Team rollout still depends on human orchestration',
    status: 'Process critical',
    icon: Watch,
    copy: 'Device delivery, athlete app setup, first check-in, device sync, and first protocol session need a launch-day checklist owned by PulseCheck staff.',
  },
];

const phases: PhaseSection[] = [
  {
    eyebrow: 'Phase 0',
    title: 'School Intake And Deployment Readiness',
    owner: 'PulseCheck admin',
    timing: 'Before provisioning',
    icon: ClipboardList,
    objective: 'Collect the operating context required to create the school correctly and avoid launch-day ambiguity.',
    actions: [
      'Confirm school name, legal entity, primary sponsor, billing or pilot posture, sport, team name, launch window, and stakeholder list.',
      'Collect adult staff names, roles, emails, phone numbers, and permission expectations for head coach, assistants, performance staff, athletic trainer, and admin sponsor.',
      'Confirm roster estimate, athlete age range, guardianship or consent requirements, roster import source, and whether athletes join by team invite link or direct invitation.',
      'Confirm device plan: existing athlete devices, PulseCheck-provided devices, wearable models, charging needs, pairing requirements, and room setup for delivery day.',
      'Define support and escalation routes before anyone is invited: operational support, technical support, clinician bridge mode, and urgent safety visibility boundaries.',
    ],
    outputs: [
      'Completed onboarding intake record',
      'Launch calendar with the three onboarding meetings',
      'Staff access map',
      'Device inventory and delivery plan',
      'Support and escalation routing notes',
    ],
  },
  {
    eyebrow: 'Phase 1',
    title: 'Provision Organization, Team, Pilot, And Access',
    owner: 'PulseCheck admin',
    timing: 'Immediately after intake',
    icon: Building2,
    objective: 'Create the canonical PulseCheck hierarchy and make the school launch-ready before coach training begins.',
    actions: [
      'Open PulseCheck Provisioning and create the organization using the school display name, legal name, organization type, primary customer admin, and study posture.',
      'Create the operating team with sport, season label, team status, plan status, commercial model, roster policy, and escalation route.',
      'Create the pilot and cohort when the deployment is part of a pilot, study, or phased rollout. Keep cohort names plain, such as Varsity Football Spring 2026.',
      'Generate admin activation and coach invite paths. Verify that each invite routes adults into the correct organization, team, and role.',
      'Review support contacts, clinician bridge mode, commercial configuration, and team preview assets before the kickoff meeting.',
    ],
    outputs: [
      'Organization and team created',
      'Pilot and cohort created where applicable',
      'Adult invite links ready',
      'Team invite or roster import plan ready',
      'Provisioning notes updated',
    ],
  },
  {
    eyebrow: 'Meeting 1',
    title: 'Coach Kickoff And Soft Training',
    owner: 'PulseCheck staff with head coach',
    timing: '30 to 45 minutes',
    icon: MessageSquareText,
    objective: 'Align expectations, explain the rollout, and give the coach enough context to trust the system before deeper dashboard training.',
    actions: [
      'Start with the deployment goal: what the school wants to learn, how success will be measured, and what PulseCheck will monitor during the first month.',
      'Walk through roles: PulseCheck admin, coach, assistants, athletes, athletic trainer, stakeholder sponsor, and support contacts.',
      'Explain the three-meeting sequence, device delivery plan, athlete onboarding flow, and the coach responsibility after launch.',
      'Preview what the coach will see: dashboard, team trends, Nora coach reports, follow-up queue, athlete roster, check-in adherence, and mental training activity.',
      'Name boundaries clearly: PulseCheck supports coaching decisions and wellness visibility, but it is not an emergency response service and does not replace school safety protocols.',
    ],
    outputs: [
      'Coach knows the rollout plan',
      'Coach confirms staff list and team launch date',
      'Action items assigned before dashboard training',
      'Open questions captured for Meeting 2',
    ],
  },
  {
    eyebrow: 'Meeting 2',
    title: 'Coach Dashboard And Nora Report Training',
    owner: 'PulseCheck staff with coach group',
    timing: '60 minutes',
    icon: Laptop,
    objective: 'Train coaches to read the dashboard, interpret Nora reports, and turn insights into appropriate coach action.',
    actions: [
      'Open the coach dashboard and orient the coach to team summary cards, current report state, trend language, and the roster table.',
      'Teach the report reading order: team snapshot, notable shifts, adherence context, athlete-level flags, suggested coach follow-up, and what to watch next.',
      'Explain what to look for: sustained change, sudden drop-off, missing data, check-in drift, training fatigue signals, recovery patterns, and repeated coach follow-up themes.',
      'Explain what not to over-read: one isolated day, incomplete wearable data, a single missed check-in, or a report generated before enough coverage exists.',
      'Walk through Mental Training: assigned protocols, simulations, completion status, athlete engagement, and how coach actions should stay supportive rather than punitive.',
      'Review safety visibility and escalation language so coaches know when to use school protocols and when PulseCheck staff will separately follow up.',
    ],
    outputs: [
      'Coach can read a report without PulseCheck staff narrating it',
      'Coach knows the daily and weekly operating routine',
      'Coach understands follow-up language',
      'Coach confirms team rollout agenda',
    ],
  },
  {
    eyebrow: 'Meeting 3',
    title: 'Team Launch, Devices, Check-Ins, Protocols, And Simulations',
    owner: 'PulseCheck staff with full team',
    timing: '45 to 75 minutes',
    icon: Smartphone,
    objective: 'Get athletes into the app, sync devices, complete first check-in, and run the first mental training experience together.',
    actions: [
      'Prepare the room with device stations, charging, QR codes or invite links, coach support table, and a staffed troubleshooting lane.',
      'Deliver devices, confirm athlete names, match device IDs where needed, and document any missing or replacement hardware.',
      'Guide athletes through app install, account creation, consent or acknowledgment screens, team join, profile basics, and notification permissions.',
      'Pair and sync wearables. Confirm that each athlete reaches a healthy device state or is logged for follow-up before leaving the room.',
      'Train the team on daily check-ins: when to complete them, what honest input looks like, how data helps the coach, and how PulseCheck handles privacy.',
      'Run the first protocol and simulation as a group so athletes understand the rhythm before they are asked to complete future assignments on their own.',
    ],
    outputs: [
      'Athletes invited and joined',
      'Device sync status recorded',
      'First check-in completed by the launch group',
      'First protocol or simulation completed',
      'Follow-up list for absent athletes and device issues',
    ],
  },
  {
    eyebrow: 'Phase 4',
    title: 'Post-Launch Monitoring And Stakeholder Cadence',
    owner: 'PulseCheck admin and coach success',
    timing: 'First 30 days, then ongoing',
    icon: CalendarClock,
    objective: 'Make the school feel supported while keeping data review, coach enablement, and stakeholder visibility predictable.',
    actions: [
      'Perform a daily operational check during launch week: invite completion, device sync health, check-in coverage, report readiness, and open support issues.',
      'Send weekly coach report snapshots with the latest team state, adherence context, meaningful changes, and recommended coach follow-up.',
      'Hold coach and stakeholder check-ins every two weeks with PulseCheck staff to review trends, adoption, questions, risks, and next operating decisions.',
      'Maintain a shared issue log for devices, access, roster changes, report questions, and support follow-up so the school never has to restate the same problem.',
      'Run a 30-day review covering adoption, coach usage, athlete completion, device reliability, report quality, and whether the deployment is ready to expand.',
    ],
    outputs: [
      'Daily launch health notes',
      'Weekly coach report snapshots',
      'Meeting notes and action items every two weeks',
      'Updated issue log',
      '30-day readiness review',
    ],
  },
];

const cadenceItems: CadenceItem[] = [
  {
    cadence: 'Daily during launch week',
    owner: 'PulseCheck admin',
    purpose: 'Catch setup problems before the coach loses trust.',
    actions: [
      'Review invited versus joined athletes.',
      'Check device sync status and stale source status.',
      'Check daily check-in coverage.',
      'Confirm any safety visibility items have a documented owner.',
    ],
  },
  {
    cadence: 'Weekly',
    owner: 'Coach success',
    purpose: 'Give the coach a predictable snapshot they can act on.',
    actions: [
      'Review the latest Nora coach report.',
      'Summarize adherence, team trend, notable shifts, and follow-up priorities.',
      'Send the snapshot to the coach and internal PulseCheck owner.',
      'Record coach questions for the next live check-in.',
    ],
  },
  {
    cadence: 'Every two weeks',
    owner: 'PulseCheck staff',
    purpose: 'Keep the coach, sponsor, and key stakeholders aligned.',
    actions: [
      'Review adoption, report themes, coach actions, device health, and unresolved issues.',
      'Decide whether the team needs more training, roster cleanup, or device support.',
      'Confirm next two-week focus.',
      'Update the stakeholder note after the call.',
    ],
  },
  {
    cadence: 'Monthly',
    owner: 'PulseCheck lead',
    purpose: 'Decide whether the deployment is healthy, needs adjustment, or is ready to expand.',
    actions: [
      'Review school-level outcomes and risk themes.',
      'Evaluate coach engagement and athlete completion patterns.',
      'Confirm reporting quality and operational load.',
      'Document expansion, renewal, or remediation next steps.',
    ],
  },
];

const tutorialCoverage = [
  {
    surface: 'Admin Provisioning',
    path: '/admin/pulsecheckProvisioning',
    required: [
      'Create organization',
      'Create team',
      'Create pilot and cohort',
      'Generate adult invite links',
      'Confirm support route and escalation posture',
    ],
  },
  {
    surface: 'Coach Dashboard',
    path: '/coach/dashboard',
    required: [
      'Read team summary',
      'Find latest report',
      'Use coach follow-up queue',
      'Review roster and athlete drill-down',
      'Understand safety visibility boundaries',
    ],
  },
  {
    surface: 'Sports Intelligence Reports',
    path: '/coach/sports-intelligence-reports',
    required: [
      'Open report archive',
      'Read current report in order',
      'Separate trend from missing data',
      'Share questions with PulseCheck staff',
    ],
  },
  {
    surface: 'Mental Training Operations',
    path: '/coach/mentalGames',
    required: [
      'Review assigned protocols',
      'Review simulations',
      'Track completion status',
      'Use supportive follow-up language',
    ],
  },
  {
    surface: 'Athlete App Launch',
    path: 'Mobile app',
    required: [
      'Join team',
      'Complete first check-in',
      'Connect device',
      'Complete first protocol',
      'Complete first simulation',
    ],
  },
];

const escalationPlaybooks = [
  {
    trigger: 'Coach cannot access dashboard',
    response: 'Verify adult invite, role, organization membership, team membership, and email casing before sending a new invite.',
  },
  {
    trigger: 'Athlete joined wrong team',
    response: 'Remove incorrect membership, confirm roster source, resend the correct team invite, and document the correction in launch notes.',
  },
  {
    trigger: 'Device is missing or stale',
    response: 'Check source status, pairing state, battery, permission settings, and last sync time. Log hardware replacement only after software checks fail.',
  },
  {
    trigger: 'Coach over-interprets a single signal',
    response: 'Redirect the coach to trend, context, and coverage. Use the report reading order before recommending any athlete conversation.',
  },
  {
    trigger: 'Safety visibility item appears',
    response: 'Confirm ownership, document the route, and follow the school-approved protocol. PulseCheck staff should not improvise emergency handling.',
  },
];

const onboardingTemplates: OnboardingTemplate[] = [
  {
    id: 'coach-kickoff',
    title: 'Coach Kickoff Template',
    audience: 'Head coach and school admin sponsor',
    timing: 'Meeting 1',
    icon: MessageSquareText,
    sections: [
      {
        label: 'Agenda',
        body: [
          'Confirm the deployment goal, launch date, team scope, and what the school wants to learn in the first month.',
          'Review PulseCheck roles, school roles, support contacts, and escalation boundaries.',
          'Preview the coach dashboard, Nora reports, daily check-ins, mental training, device delivery, and the next two meetings.',
        ],
      },
      {
        label: 'Closeout',
        body: [
          'Confirm staff list, athlete roster estimate, device plan, and dashboard training date.',
          'Capture open questions and assign a PulseCheck owner before leaving the call.',
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
          'Start with the team snapshot, then meaningful shifts, adherence context, athlete-level flags, suggested coach follow-up, and next-watch items.',
          'Review the coach follow-up queue, safety visibility boundaries, roster drill-down, report archive, and Mental Training activity.',
        ],
      },
      {
        label: 'Training Standards',
        body: [
          'Look for sustained changes, missing data, check-in drift, training fatigue signals, recovery patterns, and repeated follow-up themes.',
          'Do not over-read one isolated day, incomplete wearable data, a single missed check-in, or a report generated before coverage is strong.',
        ],
      },
    ],
  },
  {
    id: 'team-rollout',
    title: 'Team Rollout Template',
    audience: 'Full team',
    timing: 'Meeting 3',
    icon: Smartphone,
    sections: [
      {
        label: 'Room Plan',
        body: [
          'Prepare device stations, charging, QR codes or invite links, coach support table, and a staffed troubleshooting lane.',
          'Deliver devices, confirm athlete names, document missing hardware, and match device IDs where needed.',
        ],
      },
      {
        label: 'Athlete Flow',
        body: [
          'Guide app install, account creation, consent, team join, profile basics, notification permissions, and wearable sync.',
          'Complete the first check-in and first protocol or simulation with PulseCheck staff present.',
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
          'Summarize team state, adherence coverage, meaningful changes, athletes needing supportive follow-up, device or data gaps, and recommended coach actions.',
          'Name any questions the coach asked and the PulseCheck owner responsible for follow-up.',
        ],
      },
      {
        label: 'Send Standard',
        body: [
          'Keep the note short enough for a coach to read between sessions.',
          'Use trend, coverage, and supportive next action as the structure.',
        ],
      },
    ],
  },
  {
    id: 'stakeholder-check-in',
    title: 'Stakeholder Check-In Template',
    audience: 'Coach, sponsor, and key stakeholders',
    timing: 'Every two weeks',
    icon: CalendarClock,
    sections: [
      {
        label: 'Review',
        body: [
          'Review adoption, coach usage, athlete completion, report quality, device reliability, unresolved issues, and safety or support routing concerns.',
          'Decide whether the team needs more training, roster cleanup, device support, or a revised operating focus.',
        ],
      },
      {
        label: 'Decision Log',
        body: [
          'Document decisions needed, next two-week focus, owner for each action item, and the date of the next check-in.',
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

const PulseCheckOnboardingOverviewPage: React.FC = () => {
  const [activeTemplateId, setActiveTemplateId] = useState(onboardingTemplates[0].id);
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);
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
                  <Map className="h-3.5 w-3.5" />
                  PulseCheck Admin Playbook
                </div>
                <h1 className="max-w-4xl text-3xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
                  New-school onboarding from kickoff to monitored launch
                </h1>
                <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">
                  This is the internal operating guide for provisioning schools, inviting and training coaches, launching athletes and devices, and maintaining the reporting cadence after rollout.
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
                    <p className="text-sm font-semibold text-white">Launch-ready definition</p>
                    <p className="text-xs text-slate-400">Use this before Meeting 3.</p>
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
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00d4aa]">Operating Flow</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Provisioning, training, launch, and monitoring</h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-slate-400">
                These phases should be completed in order. If a phase is skipped, the coach dashboard may work technically while still feeling confusing operationally.
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
                  <h2 className="text-xl font-semibold text-white">How to read Nora coach reports</h2>
                </div>
              </div>

              <div className="space-y-4 text-sm leading-6 text-slate-300">
                <p>
                  Train coaches to read reports in the same order every time: team snapshot, meaningful shifts, adherence context, athlete-level flags, coach follow-up, and next-watch items.
                </p>
                <p>
                  The coach should ask three questions before acting: Is there enough coverage? Is this a trend or a single data point? What supportive action is appropriate for this athlete or team?
                </p>
                <p>
                  PulseCheck staff should model the language coaches can use with athletes. The tone should be curious, specific, and supportive, not punitive or diagnostic.
                </p>
              </div>

              <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Coach Action Standard</p>
                <p className="text-sm leading-6 text-slate-300">
                  A report should end with a clear coaching move: observe, check in, adjust training conversation, ask PulseCheck staff a question, or escalate through the school-approved route.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0d1119] p-5 sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#60a5fa]/30 bg-[#60a5fa]/10 text-[#60a5fa]">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#60a5fa]">UI Walkthrough Coverage</p>
                  <h2 className="text-xl font-semibold text-white">Training moments the product should cover</h2>
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
                        Walkthrough scope
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
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00d4aa]">Monitoring Cadence</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">After launch, keep the rhythm visible</h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-slate-400">
                The first month should feel closely held. Coaches need predictable snapshots, and stakeholders need evidence that the deployment is being managed.
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
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00d4aa]">Admin Data Checklist</p>
                  <h2 className="text-xl font-semibold text-white">Records to verify before launch</h2>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  'Organization record',
                  'Team record',
                  'Pilot and cohort records',
                  'Adult memberships',
                  'Coach invite links',
                  'Athlete invite or roster import plan',
                  'Device inventory',
                  'Health source status',
                  'Daily check-in coverage',
                  'Mental training assignments',
                  'Coach report snapshots',
                  'Escalation and support notes',
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
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00d4aa]">Admin Templates</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Copy-ready onboarding agendas</h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-slate-400">
                Use these as operating notes for calls, weekly snapshots, and stakeholder follow-ups. Keep the source of truth in the tracker and issue log.
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
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00d4aa]">Next Product Work</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Turn the playbook into in-product training</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  {
                    icon: MailPlus,
                    title: 'Invite checklist',
                    copy: 'Show invite status, missing adults, and launch readiness directly in provisioning.',
                  },
                  {
                    icon: HeartPulse,
                    title: 'Coach walkthrough',
                    copy: 'Add a guided tour for dashboard summary, Nora report reading, follow-up queue, and roster drill-down.',
                  },
                  {
                    icon: Users2,
                    title: 'Launch-day mode',
                    copy: 'Track athlete join state, device sync state, first check-in, and first protocol completion in one room view.',
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
