import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BellRing,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  LayoutPanelTop,
  Shield,
  Users,
  UserCog,
  Waypoints,
  Workflow,
} from 'lucide-react';

interface CoachPhase {
  id: string;
  number: string;
  label: string;
  icon: React.ElementType;
  accent: string;
  description: string;
  detail: string;
}

const COACH_PHASES: CoachPhase[] = [
  {
    id: 'invite',
    number: '0',
    label: 'Invite and Role Confirmation',
    icon: UserCog,
    accent: '#60a5fa',
    description: 'Coach enters through a role-specific invite tied to a team and optionally a pilot.',
    detail:
      'The system should confirm team context, pilot context when applicable, and the coach’s scoped role before showing any roster information. The coach should not have to guess what they are being invited into or what they can see.',
  },
  {
    id: 'setup',
    number: '1',
    label: 'Initial Setup',
    icon: BookOpen,
    accent: '#a78bfa',
    description: 'Coach configures notifications, visibility scope, and operating preferences.',
    detail:
      'Day-1 setup should establish dashboard defaults, team or unit scope, and notification preferences. This is where the coach learns the three-panel model and understands that support and safety visibility are bounded by permissions.',
  },
  {
    id: 'pilot-context',
    number: '2',
    label: 'Pilot and Cohort Context',
    icon: ClipboardCheck,
    accent: '#34d399',
    description: 'Coach sees what initiative is active and how the roster is grouped.',
    detail:
      'If the team is inside an active pilot, the coach should see pilot objectives, checkpoint cadence, cohort structure, and any study-mode implications without having to inspect admin objects manually.',
  },
  {
    id: 'first-scan',
    number: '3',
    label: 'First Useful Roster Read',
    icon: LayoutPanelTop,
    accent: '#f59e0b',
    description: 'Coach lands on a useful roster overview rather than a blank analytics shell.',
    detail:
      'The first meaningful coach moment should be an immediate scan of who is Green, Yellow, or Red, where protocol demand is concentrating, and whether there are support or safety items requiring attention.',
  },
  {
    id: 'daily-rhythm',
    number: '4',
    label: 'Daily Coaching Rhythm',
    icon: Workflow,
    accent: '#38bdf8',
    description: 'Coach settles into a repeatable loop of scan, adjust, follow up, and review.',
    detail:
      'The dashboard should support pre-practice scan, pre-game scan, athlete follow-up, and support coordination as repeatable operational moves rather than one-off analytics tasks.',
  },
  {
    id: 'support-coordination',
    number: '5',
    label: 'Support Coordination',
    icon: Users,
    accent: '#c084fc',
    description: 'Coach responds to recurring instability without collapsing it into clinical alerting.',
    detail:
      'Persistent-red and protocol-demand patterns should surface the right athletes for human follow-up and staff coordination while staying visibly distinct from escalation-lane safety events.',
  },
  {
    id: 'safety-awareness',
    number: '6',
    label: 'Privacy-Safe Safety Awareness',
    icon: Shield,
    accent: '#fb923c',
    description: 'Coach sees what they need to know when the safety lane is active.',
    detail:
      'The coach should receive privacy-safe escalation visibility, know when safety mode is active, and understand the next action without being exposed to sensitive conversation or clinical detail.',
  },
  {
    id: 'season-loop',
    number: '7',
    label: 'Season and Pilot Review Loop',
    icon: CalendarDays,
    accent: '#facc15',
    description: 'Coach uses the system across pilot checkpoints and the competitive calendar.',
    detail:
      'Over time, the coach should use Pulse Check to review cohort trends, athlete-level movement, checkpoint outcomes, and what happened after interventions. The system should feel like an operating layer across the season, not a one-time dashboard.',
  },
];

const COACH_PRINCIPLES = [
  {
    title: 'Useful on day 1',
    body: 'The coach should land on a roster view that immediately answers what is happening today, not a configuration-heavy analytics shell.',
  },
  {
    title: 'Action before analysis overload',
    body: 'The experience should prioritize who needs adjustment, who needs support, and what changed before exposing deeper trend detail.',
  },
  {
    title: 'Support and safety stay separate',
    body: 'The coach should never have to decode whether a flag is operational support, performance context, or a real safety event.',
  },
  {
    title: 'Permissions shape experience',
    body: 'The coach journey is not generic. What is visible and actionable depends on role scope, pilot status, and visibility permissions.',
  },
];

const DAY_ONE_CHECKLIST = [
  'Confirm team and pilot context.',
  'Confirm role and scoped visibility.',
  'Set notification preferences and unit defaults.',
  'Show one clean roster overview with state, support, and safety separated.',
  'Make the first action obvious: review roster, follow up, or coordinate support.',
];

const DAILY_RHYTHMS = [
  ['Pre-practice scan', 'Check readiness concentration, support flags, and protocol demand before the session starts.'],
  ['Pre-game scan', 'Review readiness concentration, support visibility, and any privacy-safe escalation awareness before competition.'],
  ['Athlete follow-up', 'Open a single athlete to review recent state, assigned work, and trend context.'],
  ['Staff coordination', 'Hand off or coordinate around recurring instability, support flags, or pilot checkpoint follow-up.'],
  ['Checkpoint review', 'Use pilot and cohort context to review midpoint or endpoint movement without losing the athlete-level story.'],
];

const VISIBILITY_LAYERS = [
  ['Performance layer', 'What is the athlete training and how are they performing over time?'],
  ['Support layer', 'Who is repeatedly unstable and may need follow-up or lower programming aggressiveness?'],
  ['Safety layer', 'Is there a privacy-safe escalation state requiring awareness or workflow action?'],
];

function CoachPhaseCard({
  phase,
  expanded,
  onToggle,
}: {
  phase: CoachPhase;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = phase.icon;

  return (
    <div
      className="overflow-hidden rounded-xl border transition-all duration-200"
      style={{
        background: expanded ? `linear-gradient(135deg, ${phase.accent}12, ${phase.accent}06)` : 'rgba(255,255,255,0.02)',
        borderColor: expanded ? `${phase.accent}45` : 'rgba(63,63,70,0.6)',
      }}
    >
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
          style={{
            background: expanded ? `${phase.accent}22` : 'rgba(255,255,255,0.05)',
            color: expanded ? phase.accent : '#71717a',
          }}
        >
          {phase.number}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{phase.label}</p>
          <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-500">{phase.description}</p>
        </div>
        <Icon className="h-4 w-4 shrink-0" style={{ color: expanded ? phase.accent : '#52525b' }} />
        {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" /> : <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="mt-1 border-t border-zinc-800/60 px-4 pb-4 pt-2 text-sm leading-relaxed text-zinc-300">
              {phase.detail}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const CoachJourneyTab: React.FC = () => {
  const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>('invite');

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <BellRing className="h-4 w-4 text-emerald-400" />
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
            Pulse Check · Coach Experience
          </p>
        </div>
        <h2 className="text-xl font-semibold text-white">Coach User Journey</h2>
        <p className="mt-1 max-w-3xl text-sm text-zinc-400">
          Recommended entry, setup, daily operating flow, and long-term rhythm for coaches using Pulse Check as a team and pilot operating surface.
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.07] p-5">
        <div className="flex items-start gap-3">
          <Workflow className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <div>
            <p className="mb-1 text-sm font-semibold text-white">Purpose</p>
            <p className="text-sm leading-relaxed text-zinc-300">
              The coach journey should feel like a guided operating layer, not like a generic analytics dashboard. The coach needs a useful roster read quickly, a clear sense of what action to take next, and privacy-safe visibility into support and safety lanes.
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-200">Core Journey Principles</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {COACH_PRINCIPLES.map((principle) => (
            <div key={principle.title} className="rounded-xl border border-zinc-800 bg-[#090f1c] p-4">
              <p className="text-sm font-semibold text-white">{principle.title}</p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">{principle.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-200">Journey Phases</h3>
        <div className="space-y-2">
          {COACH_PHASES.map((phase) => (
            <CoachPhaseCard
              key={phase.id}
              phase={phase}
              expanded={expandedPhaseId === phase.id}
              onToggle={() => setExpandedPhaseId((prev) => (prev === phase.id ? null : phase.id))}
            />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.07] p-5">
        <div className="flex items-start gap-3">
          <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-purple-400" />
          <div>
            <p className="mb-1 text-sm font-semibold text-white">Day 1 Coach Checklist</p>
            <div className="space-y-2">
              {DAY_ONE_CHECKLIST.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <p className="text-sm text-zinc-300">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-200">Daily and Weekly Operating Rhythm</h3>
        <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
            {['Scan roster', '->', 'Adjust plan', '->', 'Follow up', '->', 'Coordinate support', '->', 'Review trends'].map((item, index) =>
              item === '->' ? (
                <span key={index} className="font-bold text-zinc-600">-&gt;</span>
              ) : (
                <span key={item} className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 font-semibold text-emerald-300">
                  {item}
                </span>
              )
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            {DAILY_RHYTHMS.map(([title, body]) => (
              <div key={title} className="rounded-xl border border-zinc-800 bg-black/20 p-3">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-200">What the Coach Should Experience as Separate Layers</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {VISIBILITY_LAYERS.map(([title, body], index) => (
            <div key={title} className="rounded-xl border border-zinc-800 bg-[#090f1c] p-4">
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">{body}</p>
              <p className="mt-3 text-[10px] uppercase tracking-wide text-zinc-600">Layer {index + 1}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-[#090f1c] p-4">
          <div className="flex items-center gap-2">
            <Waypoints className="h-4 w-4 text-sky-400" />
            <p className="text-sm font-semibold text-white">How It Connects to Onboarding</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            The coach journey begins after team and pilot context are created. It depends on role-specific invite links, pilot and cohort truth, and the permission model being settled before any roster data is shown.
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-[#090f1c] p-4">
          <div className="flex items-center gap-2">
            <LayoutPanelTop className="h-4 w-4 text-purple-400" />
            <p className="text-sm font-semibold text-white">How It Connects to Dashboard IA</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            The dashboard IA defines the structure of the coach surface. This journey artifact defines how that surface should feel over time: setup, first useful read, daily rhythm, support coordination, and privacy-safe escalation awareness.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-sky-500/5 p-6">
        <h3 className="mb-2 text-sm font-semibold text-white">Summary</h3>
        <p className="text-sm leading-relaxed text-zinc-300">
          The coach journey should not feel like logging into a reporting tool. It should feel like entering a team operating layer that quickly clarifies who is ready, who needs adjustment, who needs support, and what requires privacy-safe awareness. That is the coach experience most likely to drive real use during pilots and across a season.
        </p>
      </div>
    </div>
  );
};

export default CoachJourneyTab;
