import React from 'react';
import {
  Bell,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  MessageSquareQuote,
  ShieldCheck,
  Target,
  Waypoints,
} from 'lucide-react';
import {
  BulletList,
  CardGrid,
  DataTable,
  DocHeader,
  InfoCard,
  RuntimeAlignmentPanel,
  SectionBlock,
  StepRail,
} from './PulseCheckRuntimeDocPrimitives';

const PRINCIPLE_ROWS = [
  [
    'Performance pact, not compliance',
    'Pulse Check should frame adherence as the athlete choosing a daily edge for better control, confidence, pattern recognition, and performance under pressure.',
    'Onboarding, reminder copy, completion closeout, pilot recap.',
  ],
  [
    'Private room by default',
    'Nora must feel like a protected one-on-one space. Adherence cannot be built on fear that coaches will see sensitive content.',
    'Onboarding, check-in, chat, coach dashboard, reports.',
  ],
  [
    'One obvious next action',
    'Every athlete session should answer in under three seconds: am I done today, or what one action closes today?',
    'Today, Nora launch routing, Training Room, notification taps.',
  ],
  [
    'Adaptive rescue without shame',
    'Late, missed, or partial days should trigger supportive rescue options and short versions, not guilt-heavy streak warnings.',
    'Notification orchestration, Today task state, recovery flows.',
  ],
  [
    'Completion must feel rewarding',
    'Finishing should close the loop with visible progress, Nora insight, next appointment, and the sense that the daily signal mattered.',
    'Exercise completion, Today closed state, profile progress.',
  ],
  [
    'Measurement follows the behavior loop',
    'The pilot dashboard should report the same adherence state the athlete experiences: expected day, check-in, task, closure, rescue, miss, or excusal.',
    'Pilot dashboard, rollups, event schema, ops alerts.',
  ],
];

const LITERATURE_ROWS = [
  [
    'COM-B / Behavior Change Wheel',
    'Behavior requires capability, opportunity, and motivation.',
    'Make the daily task tiny, put it in the athlete rhythm, and keep the performance reason visible.',
  ],
  [
    'Fogg Behavior Model',
    'Behavior happens when motivation, ability, and prompt converge.',
    'Pair high-ability one-tap flows with state-aware prompts and inspirational performance copy.',
  ],
  [
    'Implementation intentions',
    'When/where/how commitments improve follow-through.',
    'Capture the athlete pact as: after this moment, in this place, I complete Pulse Check.',
  ],
  [
    'Self-Determination Theory',
    'Autonomy, competence, and relatedness sustain motivation.',
    'Use choice, progress proof, and Nora trust instead of surveillance or coercion.',
  ],
  [
    'Persuasive Systems Design',
    'Reduction, tunneling, reminders, personalization, trust, and social support improve digital behavior support.',
    'Reduce the day to one path, personalize nudges, and keep credibility/privacy explicit.',
  ],
  [
    'Just-in-Time Adaptive Interventions',
    'Support is strongest when timing, state, and need are matched.',
    'Trigger nudges based on unfinished adherence state, not only a fixed daily clock.',
  ],
  [
    'Self-monitoring plus feedback',
    'Tracking works better when paired with feedback and a next action.',
    'Every check-in should return a Nora read, a current task, or a completion insight.',
  ],
  [
    'Habit formation research',
    'Repeated behavior in a stable context builds automaticity over time.',
    'Use the same daily moment, recurring appointment, and predictable closure state during the pilot.',
  ],
];

const PRIVACY_ROWS = [
  [
    'Raw reflections',
    'Nora does not show coaches raw reflections, journal content, chat transcripts, or private narrative answers.',
    'Private by default. Athlete can explicitly share selected content only through a dedicated share action.',
  ],
  [
    'Mental health disclosures',
    'Nora does not show coaches mental health disclosures or sensitive emotional content through adherence, readiness, or coach dashboard features.',
    'Escalation workflows remain separate, consent-aware, and minimum-necessary.',
  ],
  [
    'Sleep and biometrics',
    'Nora does not show coaches exact sleep details, wearable values, or sensitive biometric context by default.',
    'Coach-facing views may use privacy-safe bands or aggregate coverage only when permitted.',
  ],
  [
    'Adherence visibility',
    'Coach will not receive private content because an athlete completes, misses, or rescues a day.',
    'Coach-facing adherence should be completion status, aggregate trend, or operational follow-up signal only.',
  ],
  [
    'Athlete trust copy',
    'The product must repeatedly tell the athlete what stays private and why Pulse Check asks them to show up daily.',
    'Show privacy reassurance during onboarding, check-in, chat entry, and completion closeout.',
  ],
];

const SURFACE_ROWS = [
  [
    'Onboarding',
    'Add an athlete pact step with inspirational performance framing, daily moment capture, reminder time, and privacy reassurance.',
    'Fields: pactAcceptedAt, adherenceCueType, adherenceCueLabel, reminderTime, privacyAcknowledgedAt.',
  ],
  [
    'Today / Nora',
    'Keep one primary CTA that changes with state: Check in, Start today, Finish today, Today closed.',
    'Use the canonical athlete-day adherence state rather than independent surface logic.',
  ],
  [
    'Notifications',
    'Replace static-only daily reminders with state-aware nudges: pre-commitment moment, open-day rescue, started-not-finished rescue, and closeout.',
    'Notification copy must be supportive, performance-grounded, and privacy-safe.',
  ],
  [
    'Completion closeout',
    'After check-in plus assigned task completion, show Today closed, the performance reason, progress made, Nora insight, and next appointment.',
    'Completion should feel like confidence earned, not a dismissed task.',
  ],
  [
    'Miss recovery',
    'Offer short version, grace pass, late close window, and comeback language so one miss does not collapse motivation.',
    'Track rescued days separately from missed days for product learning.',
  ],
  [
    'Pilot dashboard',
    'Add an Adherence Orchestrator panel for expected days, closed days, check-in-only days, task-only days, rescued days, missed days, excused days, and at-risk athletes.',
    'Dashboard reads rollups; it does not infer private content or expose Nora conversation detail.',
  ],
];

const ATHLETE_COPY_ROWS = [
  [
    'Pact headline',
    'Make the pact with yourself.',
    'Use when the athlete commits during onboarding or reminder setup.',
  ],
  [
    'Pact body',
    "Give Nora two minutes a day. She will help you connect sleep, stress, readiness, and mental reps into a clearer performance picture. Your commitment is to show up daily. Nora's commitment is to help you perform with more control, confidence, and awareness.",
    "Anchor adherence to the athlete's outcome, not to admin compliance.",
  ],
  [
    'Privacy reassurance',
    'This space is yours. Nora does not show coaches raw reflections, mental health disclosures, chat transcripts, or private sleep details. Your team may see that you completed Pulse Check, but not the personal details you share here.',
    'Use in onboarding, chat entry, and settings.',
  ],
  [
    'Moment reminder',
    "You picked after practice. Give Nora the two-minute read so today's rep matches where your body and mind actually are.",
    'Use when a moment-based reminder fires.',
  ],
  [
    'Rescue nudge',
    'Today is still open. Run the short version and close the loop before the day gets away from you.',
    'Use when check-in or task is still incomplete.',
  ],
  [
    'Completion closeout',
    'Today is closed. Nora logged your check-in and your rep privately. Tomorrow, you build from here.',
    'Use after the adherence day is fully complete.',
  ],
];

const ADHERENCE_STATE_ROWS = [
  ['expected', 'Athlete is active for the pilot day and should have a check-in plus assigned task unless excused.'],
  ['checked_in', 'Daily readiness check-in completed, but assigned task is not yet complete.'],
  ['task_started', 'Assigned task opened or started, but completion has not been recorded.'],
  ['closed', 'Daily check-in and assigned task are both complete. This is the primary success state.'],
  ['rescued', 'The day closed after a rescue nudge, short version, late window, or comeback flow.'],
  ['missed', 'Expected active athlete-day ended without both required pieces complete.'],
  ['excused', 'Day excluded from adherence denominator because of pause, hold, rest/no-task day, or approved operational exception.'],
];

const IMPLEMENTATION_STEPS = [
  {
    title: 'Lock the athlete pact in onboarding',
    body: 'Add performance-centered pact copy, moment capture, privacy acknowledgement, and reminder setup before the athlete exits onboarding.',
    owner: 'iOS + web onboarding',
  },
  {
    title: 'Create the athlete-day adherence state model',
    body: 'Persist one canonical state per athlete per pilot day so Today, Nora, notifications, and dashboard cards read the same truth.',
    owner: 'Backend + data model',
  },
  {
    title: 'Route every entry point to the next incomplete step',
    body: 'Notification taps, app launches, Today, Nora, and Training Room should all resolve to the current next action rather than competing surfaces.',
    owner: 'iOS + web surfaces',
  },
  {
    title: 'Ship adaptive rescue nudges',
    body: 'Trigger reminders from adherence state and athlete moment context, including started-not-finished and late short-version flows.',
    owner: 'Notifications + functions',
  },
  {
    title: 'Add completion closeout',
    body: 'After the day closes, show the athlete proof that the signal mattered: private log, Nora insight, progress, and next appointment.',
    owner: 'Nora + mental training',
  },
  {
    title: 'Add dashboard orchestrator',
    body: 'Expose expected, closed, rescued, missed, excused, check-in-only, and task-only counts without exposing private Nora content.',
    owner: 'Pilot dashboard',
  },
];

const DONE_RULES = [
  'Athlete can explain why daily adherence helps performance after onboarding.',
  'Athlete can also explain what Nora does not show coaches.',
  'Every day has exactly one visible next action until the day is closed.',
  'Notification copy never uses shame, surveillance, or punishment framing.',
  'Completion creates a clear closed state with progress and next appointment.',
  'Dashboard adherence metrics match the athlete-day state model exactly.',
  'Coach-facing dashboards do not expose raw reflections, mental health disclosures, chat transcripts, or exact sleep details.',
];

const PulseCheckAdherencePsychologySpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Pilot"
        title="Adherence Psychology Spec"
        version="Version 1.0 | May 6, 2026"
        summary="Product psychology contract for making Pulse Check adherence feel like a private performance pact the athlete makes for their own benefit. This artifact defines the motivational framing, privacy posture, daily loop, rescue mechanics, copy rules, and pilot-dashboard state model required to make adherence the first success metric of the pilot."
        highlights={[
          {
            title: 'Adherence Is the Athlete Edge',
            body: 'The app should never frame daily use as homework. It is a two-minute performance habit that helps Nora see patterns and train the athlete before pressure arrives.',
          },
          {
            title: 'Trust Is the Floor',
            body: 'Nora does not show coaches raw reflections, mental health disclosures, chat transcripts, or private sleep detail. Athletes must see that boundary early and often.',
          },
          {
            title: 'Closed Day Is the Product Loop',
            body: 'The daily loop is complete only when check-in and assigned task are both done, the athlete sees closure, and the dashboard records the correct athlete-day state.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        sectionLabel="Pilot Alignment"
        role="Canonical product psychology and UX contract for Pulse Check pilot adherence."
        sourceOfTruth="This document is authoritative for adherence framing, privacy-safe athlete copy, daily-loop mechanics, rescue nudges, completion closeout, and dashboard adherence-state language."
        masterReference="Use this page when implementing onboarding pact copy, reminder strategy, Today/Nora next-action routing, completion closeouts, missed-day recovery, or the pilot dashboard adherence orchestrator."
        relatedDocs={[
          'Pilot Outcome Metrics Contract',
          'Daily Task + Training Plan Alignment',
          'Permissions & Visibility Model',
          'Team & Pilot Onboarding',
          'Coach Dashboard Information Architecture',
        ]}
      />

      <SectionBlock icon={Target} title="Locked Psychology Principles">
        <DataTable columns={['Principle', 'Rule', 'Primary Surfaces']} rows={PRINCIPLE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Brain} title="Evidence-Backed Design Basis">
        <DataTable columns={['Literature', 'Core Idea', 'Pulse Check Application']} rows={LITERATURE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Privacy and Trust Contract">
        <DataTable columns={['Data / Moment', 'Athlete-Facing Promise', 'Operating Rule']} rows={PRIVACY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Waypoints} title="Surface Requirements">
        <DataTable columns={['Surface', 'Required Behavior', 'Implementation Notes']} rows={SURFACE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={MessageSquareQuote} title="Athlete Copy Library">
        <DataTable columns={['Moment', 'Approved Copy Direction', 'Use']} rows={ATHLETE_COPY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={CheckCircle2} title="Athlete-Day Adherence State Model">
        <DataTable columns={['State', 'Meaning']} rows={ADHERENCE_STATE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Bell} title="Nudge Rules">
        <CardGrid columns="md:grid-cols-2 xl:grid-cols-3">
          <InfoCard
            title="Moment-Based First Prompt"
            accent="blue"
            body="The first reminder should reference the athlete's chosen rhythm when possible, such as after practice, after film, after lift, after dinner, or before bed."
          />
          <InfoCard
            title="State-Aware Rescue"
            accent="amber"
            body="If check-in is done but the task is not, the nudge should say exactly that. If the task started but did not finish, offer resume or short closeout."
          />
          <InfoCard
            title="No Shame Copy"
            accent="green"
            body="Avoid language that implies punishment, coach judgment, or failure. Rescue copy should make the next action feel doable and performance-relevant."
          />
          <InfoCard
            title="Privacy Reinforcement"
            accent="purple"
            body="Reminder and closeout copy can say Nora logs the day privately. Do not imply coach review of private content."
          />
          <InfoCard
            title="Short Version Exists"
            accent="blue"
            body="Late-day rescue should provide a minimum viable rep so an athlete can preserve the habit even on chaotic days."
          />
          <InfoCard
            title="Suppression Still Matters"
            accent="red"
            body="Operational holds, escalation holds, pause states, and no-task days should suppress adherence pressure and move the day to excused when appropriate."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ClipboardCheck} title="Implementation Sequence">
        <StepRail steps={IMPLEMENTATION_STEPS} />
      </SectionBlock>

      <SectionBlock icon={CheckCircle2} title="Definition of Done">
        <InfoCard title="Adherence Psychology Launch Gate" accent="green" body={<BulletList items={DONE_RULES} />} />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckAdherencePsychologySpecTab;
