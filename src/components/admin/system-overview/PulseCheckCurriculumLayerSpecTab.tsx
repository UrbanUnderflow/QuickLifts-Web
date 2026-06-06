import React from 'react';

// =============================================================================
// PulseCheckCurriculumLayerSpecTab — System Overview spec for the Daily
// Curriculum Layer (Phase I).
//
// Mirror of PulseCheckSportsIntelligenceLayerSpecTab. Documents the proactive
// counterpart to the Adaptation Framing Layer. Read-only architecture reference.
// =============================================================================

const SectionHeader: React.FC<{ children: React.ReactNode; sub?: string }> = ({ children, sub }) => (
  <div className="mb-4 mt-8 first:mt-0">
    <h3 className="text-lg font-semibold text-zinc-100">{children}</h3>
    {sub && <p className="mt-1 text-sm text-zinc-400">{sub}</p>}
  </div>
);

const Card: React.FC<{ title: string; children: React.ReactNode; tone?: 'neutral' | 'doctrine' | 'warn' }> = ({
  title,
  children,
  tone = 'neutral',
}) => (
  <div
    className={`rounded-2xl border p-5 ${
      tone === 'doctrine'
        ? 'border-violet-700/40 bg-violet-950/20'
        : tone === 'warn'
          ? 'border-amber-700/40 bg-amber-950/20'
          : 'border-zinc-800 bg-zinc-950/40'
    }`}
  >
    <h4 className="mb-2 text-sm font-semibold text-zinc-100">{title}</h4>
    <div className="space-y-2 text-sm text-zinc-300">{children}</div>
  </div>
);

const SIX_SLOT_ROWS = [
  ['Protocol slot 1', 'Regulation', 'State downshift, breath control, emotional control, or recovery posture.'],
  ['Protocol slot 2', 'Priming', 'Focus cue, activation, visualization, confidence, or pre-performance readiness.'],
  ['Protocol slot 3', 'Mental regulation or bridge skill', 'Cognitive reframing, box breathing, visualization, or a sport-specific protocol family that best fits the athlete.'],
  ['Simulation slot 1', 'Primary skill', 'The main skill Nora is building, such as reset speed, selective attention, inhibition, or endurance.'],
  ['Simulation slot 2', 'Transfer skill', 'A related sim family that prevents overfitting to one pattern.'],
  ['Simulation slot 3', 'Assessment or pressure variation', 'A measurable sharpening lane used for progress checks or controlled stressor exposure.'],
];

const SLOT_STATE_ROWS = [
  ['active', 'Part of the athlete current toolkit and eligible for daily materialization.'],
  ['maintenance', 'Graduated from the active learning lane but still available for periodic refresh or competition support.'],
  ['cooldown', 'Temporarily withheld because it was overused, produced poor response, or needs more time before another exposure.'],
  ['needs_coach_review', 'Held for staff review because safety, readiness, or response evidence is ambiguous.'],
  ['graduated', 'Mastered enough to leave the six active slots; Nora backfills the open slot from the next eligible candidate.'],
];

const MASTERY_ROWS = [
  ['Protocol mastery', 'Completion consistency, technique quality, athlete-reported state shift, downstream sim quality, freshness, and protocol responsiveness confidence.'],
  ['Simulation mastery', 'Score stability, reduced degradation, clean recovery after errors, modifier tolerance, valid session count, and lower variability across repeated exposures.'],
  ['Rotation rule', 'When a slot graduates, Nora archives the rationale, moves the item to maintenance, and promotes the next eligible protocol or sim that fits the same development goal.'],
  ['No silent churn', 'The athlete and coach should be able to see why a slot stayed, graduated, or was replaced.'],
];

const IMPLEMENTATION_GAP_ROWS = [
  ['Implemented now', 'DailyTask, TrainingPlan, PlanStep, protocol registry, sim registry, protocol responsiveness, assignment events, and a daily curriculum generator that writes one protocol plus one simulation.'],
  ['Not implemented yet', 'A durable six-slot curriculum slate with exactly three protocol slots and three simulation slots, slot-level mastery, graduation, maintenance, and automatic backfill.'],
  ['Spec path', 'Add a curriculum slate model that TrainingPlan owns as programming truth; materialize date-bound DailyTask records from that slate or from real-time Nora routing.'],
  ['Migration path', 'Keep the existing daily pair generator as a compatibility path until the slate generator, mastery evaluator, and athlete surfaces are wired.'],
];

const PulseCheckCurriculumLayerSpecTab: React.FC = () => {
  return (
    <div className="text-zinc-100">
      <header className="mb-8 rounded-2xl border border-violet-700/30 bg-gradient-to-br from-violet-950/30 to-indigo-950/30 p-6">
        <p className="text-xs uppercase tracking-wide text-violet-300">PulseCheck · Phase I</p>
        <h2 className="mt-1 text-2xl font-bold">Daily Curriculum Layer</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-300">
          Proactive six-exercise toolkit per athlete: three protocol slots for mental regulation and three simulation
          slots for mental sharpening. Nora materializes daily work from that slate, graduates items when mastery evidence
          is strong enough, and backfills the open slot with the next eligible exercise.
        </p>
      </header>

      <SectionHeader sub="Why this layer exists alongside the reactive Adaptation Framing Layer.">
        Doctrine
      </SectionHeader>
      <div className="space-y-4">
        <Card tone="doctrine" title="Automaticity through spaced repetition">
          <p>
            Box breathing under stress only works if the body has rehearsed it many times under no stress. The same is
            true of decisioning drills, composure protocols, and every other mental skill. Reactive-only assignment fails
            because the athlete has never practiced the response — protocol becomes one more thing to manage instead of a
            learned response. Daily proactive curriculum is the gym for the mind.
          </p>
        </Card>
        <Card tone="doctrine" title="Two layers, one snapshot">
          <p>
            <strong>Adaptation Framing Layer (Phases B/C/D/E/G)</strong> — translates physiological signals into
            athlete-safe guidance, in Nora's voice, when state changes.
          </p>
          <p>
            <strong>Daily Curriculum Layer (Phase I, this layer)</strong> — schedules + tracks proactive practice every
            day from the athlete six-slot toolkit. Both share infrastructure (Nora voice, push notifications, iOS surface)
            but serve different purposes.
          </p>
          <p>
            When both fire on the same day, curriculum is the standing baseline and real-time Nora routing is the overlay
            that responds to the current conversation, sport-performance device signals, and coach context.
          </p>
        </Card>
        <Card tone="doctrine" title="Athlete Surface Doctrine — what counts as priming">
          <p>
            Per the Athlete Surface Doctrine, athletes never see raw biomarker numbers. Behavioral data — completion counts,
            streaks, pillar balance — IS visible to athletes. It's motivating, not priming. Erlacher et al. 2014 was
            about physiological readouts (REM%, HRV, sleep score), not behavioral counts.
          </p>
        </Card>
      </div>

      <SectionHeader sub="The product contract the curriculum engine should satisfy.">Six-Exercise Active Slate</SectionHeader>
      <Card title="Standing toolkit per athlete">
        <p>
          The curriculum layer should keep six exercises in flight at all times: three protocols and three simulations.
          The athlete is not learning a new thing only on competition day; they are building a familiar toolkit through
          daily exposure so the body and mind already know what to do under pressure.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/70 text-zinc-400">
              <tr>
                <th className="px-3 py-2 font-medium">Slot</th>
                <th className="px-3 py-2 font-medium">Lane</th>
                <th className="px-3 py-2 font-medium">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {SIX_SLOT_ROWS.map(([slot, lane, purpose]) => (
                <tr key={slot} className="border-t border-zinc-800">
                  <td className="px-3 py-2 text-zinc-100">{slot}</td>
                  <td className="px-3 py-2 text-zinc-300">{lane}</td>
                  <td className="px-3 py-2 text-zinc-400">{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <SectionHeader sub="How the standing toolkit advances without random daily churn.">Mastery And Rotation</SectionHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Slot states">
          <ul className="list-disc space-y-1 pl-5">
            {SLOT_STATE_ROWS.map(([state, meaning]) => (
              <li key={state}><strong>{state}</strong>: {meaning}</li>
            ))}
          </ul>
        </Card>
        <Card title="Mastery evidence">
          <ul className="list-disc space-y-1 pl-5">
            {MASTERY_ROWS.map(([label, meaning]) => (
              <li key={label}><strong>{label}</strong>: {meaning}</li>
            ))}
          </ul>
        </Card>
      </div>

      <SectionHeader sub="How daily work is selected from the six active slots.">Selection model</SectionHeader>
      <Card title="Target selection flow per athlete">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Read the active curriculum slate from the athlete primary TrainingPlan or a dedicated curriculum-slate document.</li>
          <li>Read last-30-days completion events, protocol responsiveness, sim performance, state snapshots, coach constraints, and current sport context.</li>
          <li>Compute progress and freshness for each active slot, then decide which protocol or simulation is due today.</li>
          <li>Materialize the date-bound DailyTask from the selected slot, preserving slate id, slot id, mastery status, and why this item is still active.</li>
          <li>If a slot has graduated, move it to maintenance and backfill the open protocol or sim slot from the eligible registry.</li>
          <li>Keep real-time Nora chat assignments separate unless Nora intentionally replaces or supplements today work based on current state.</li>
        </ol>
      </Card>

      <SectionHeader sub="What exists today and what still needs to be implemented.">Runtime audit</SectionHeader>
      <Card tone="warn" title="Implementation gap">
        <ul className="list-disc space-y-1 pl-5">
          {IMPLEMENTATION_GAP_ROWS.map(([label, detail]) => (
            <li key={label}><strong>{label}</strong>: {detail}</li>
          ))}
        </ul>
      </Card>

      <SectionHeader sub="Where the curriculum layer reads from and writes to.">Architecture</SectionHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Reuses (existing collections)">
          <ul className="list-disc space-y-1 pl-5">
            <li><code className="rounded bg-black/40 px-1">pulsecheck-protocols</code> — protocol library (extended schema)</li>
            <li><code className="rounded bg-black/40 px-1">sim-modules</code> — sim library (extended schema)</li>
            <li>
              <code className="rounded bg-black/40 px-1">pulsecheck-daily-assignments</code> — same lifecycle states as
              coach-authored or Nora-authored. Curriculum-engine writes use{' '}
              <code className="rounded bg-black/40 px-1">assignedBy: 'curriculum-engine'</code>.
            </li>
            <li><code className="rounded bg-black/40 px-1">pulsecheck-assignment-events</code> — completion + lifecycle log</li>
            <li><code className="rounded bg-black/40 px-1">pulsecheck-team-memberships</code> — athlete enumeration</li>
          </ul>
        </Card>
        <Card title="Owns (new collections)">
          <ul className="list-disc space-y-1 pl-5">
            <li><code className="rounded bg-black/40 px-1">pulsecheck-curriculum-config</code> — singleton config (id=current)</li>
            <li><code className="rounded bg-black/40 px-1">pulsecheck-curriculum-assessments</code> — monthly per-athlete rollup</li>
            <li><code className="rounded bg-black/40 px-1">pulsecheck-curriculum-overrides</code> — coach pin/exclude</li>
            <li><code className="rounded bg-black/40 px-1">pulsecheck-curriculum-generation-traces</code> — generator audit</li>
            <li><code className="rounded bg-black/40 px-1">pulsecheck-curriculum-slates</code> — planned six-slot source-of-truth when not embedded on TrainingPlan</li>
          </ul>
        </Card>
      </div>

      <SectionHeader sub="Composure / focus / decisioning + per-sport overrides.">Pillar model</SectionHeader>
      <Card title="Pillar weights">
        <p>
          The default is equal — composure 33 / focus 33 / decision 33. The engine normalizes the sum, so values do not
          need to add to 100. Per-sport overrides take precedence (e.g., basketball weighting decision higher).
          Operator-tunable from <code className="rounded bg-black/40 px-1">/admin/curriculumLayer</code> Pillar tab.
        </p>
        <p className="mt-2">
          Pillar tagging on protocols comes from a new field{' '}
          <code className="rounded bg-black/40 px-1">cognitivePillar</code>. Sims already store pillar at{' '}
          <code className="rounded bg-black/40 px-1">taxonomy.primaryPillar</code> — the engine reads either path.
        </p>
      </Card>

      <SectionHeader sub="Per-progression-level practice exposure targets.">Frequency targets</SectionHeader>
      <Card title="Defaults (operator-tunable)">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Foundational</strong>: 12 practice exposures / 30 days — building blocks of automaticity (e.g., box breathing, body scan)</li>
          <li><strong>Intermediate</strong>: 8 practice exposures / 30 days — layered skills</li>
          <li><strong>Advanced</strong>: 4 practice exposures / 30 days — situational, not foundational</li>
        </ul>
        <p className="mt-2">
          Per-asset overrides in <code className="rounded bg-black/40 px-1">recommendedFrequencyPer30Days</code> always
          win. Falls back to the level default when absent.
        </p>
      </Card>

      <SectionHeader sub="Athlete-facing transparency for repeated sims and protocols.">
        Assignment intent contract
      </SectionHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card tone="doctrine" title="Same by design, never mystery repetition">
          <p>
            Curriculum-engine daily assignments must persist a{' '}
            <code className="rounded bg-black/40 px-1">curriculumIntent</code> object onto the daily assignment. The
            object is the athlete-safe explanation layer: why this today, whether repetition is intentional, practice progress,
            progression criteria, reassessment timing, and next likely step.
          </p>
          <p>
            The Today screen, Nora chat, Training Room, and iOS Today card should render this object when present rather
            than inventing local explanation copy. If an older assignment does not have this object yet, athlete surfaces
            should still show the fallback intent summary from the DailyTask rationale, active plan, and recent-history
            context so the assignment never feels random.
          </p>
        </Card>
        <Card title="Minimum visible fields">
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Badge</strong>: <code className="rounded bg-black/40 px-1">Same by design</code> or planned exposure.</li>
            <li><strong>Sequence</strong>: planned exposure X of Y in the active curriculum window.</li>
            <li><strong>Why this today</strong>: actual sim/protocol name + driving pillar gap.</li>
            <li><strong>How you move on</strong>: planned exposure count, steady-completion threshold, or mastery score.</li>
            <li><strong>What is next</strong>: likely progression or repeat decision.</li>
          </ul>
          <p>
            Home and Training Room must show this summary high on the page: "why this is assigned", "how long", and
            "when you move on" should be visible before the athlete launches the practice item.
          </p>
        </Card>
      </div>
      <Card title="Stored contract shape">
        <pre className="overflow-x-auto rounded-xl bg-black/40 p-4 text-xs text-zinc-300">{`curriculumIntent: {
  version: 'v1',
  source: 'curriculum-engine',
  badgeLabel: 'Same by design',
  focusName: 'Decision control foundational plan',
  whyThisToday: 'Fakeout Brake Point is queued because decision control has the biggest practice gap...',
  sequenceLabel: 'Practice exposure 4 of 7',
  progressionCriteria: 'Move forward after 7 planned exposures or 3 steady completions in a row.',
  nextLikelyStep: 'Nora will either progress the pressure or move you to the next decision-control sim.'
}`}</pre>
      </Card>

      <SectionHeader sub="Notification cadence — three pushes per athlete per day.">Notification model</SectionHeader>
      <Card title="Three pushes per day, athlete-local">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Morning</strong> (default 8am local) — delivers the assignment. Voice: "Today's protocol — 5 min when you wake. Sets the tone."
          </li>
          <li>
            <strong>Midday</strong> (default 1pm local) — sim nudge if uncompleted. Voice: "Quick practice — sharpen your edge for 5 minutes."
          </li>
          <li>
            <strong>Evening</strong> (default 8pm local) — recovery push. Only fires if assignment uncompleted.
          </li>
        </ul>
        <p className="mt-2 text-xs text-zinc-400">
          Current reminder scheduler ships static templates. A future pass should swap these for{' '}
          <code className="rounded bg-black/40 px-1">translateForAthlete()</code> via the Adaptation Framing Layer voice service —
          the static text becomes the seed-fallback.
        </p>
      </Card>

      <SectionHeader sub="Monthly rollup math + what coaches see.">30-day assessment</SectionHeader>
      <Card title="What the assessment computes">
        <ul className="list-disc space-y-1 pl-5">
          <li>Practice exposures completed per pillar in the window</li>
          <li>Target exposure count per pillar (pillar weight × base target × active slot plan)</li>
          <li>Gap = target − actual. Worst-gap pillar drives next month's bias.</li>
          <li>Per-protocol + per-sim completion counts vs recommended frequency</li>
          <li>Adherence rate (assigned vs completed)</li>
          <li>Longest consecutive-day streak</li>
          <li>Reviewer note in coach voice (no biomarkers, behavioral framing only)</li>
        </ul>
        <p className="mt-2">
          The cron runs on the 1st of each month UTC. Manual backfill available via{' '}
          <code className="rounded bg-black/40 px-1">/scheduled-curriculum-assessment?force=1&backfillMonths=N</code>.
        </p>
      </Card>

      <SectionHeader sub="Coach can pin or exclude items per athlete per month.">Coach overrides</SectionHeader>
      <Card title="Four override types">
        <ul className="list-disc space-y-1 pl-5">
          <li><code className="rounded bg-black/40 px-1">pin-protocol</code> / <code className="rounded bg-black/40 px-1">pin-simulation</code> — engine assigns this when the day's pillar matches</li>
          <li><code className="rounded bg-black/40 px-1">exclude-protocol</code> / <code className="rounded bg-black/40 px-1">exclude-simulation</code> — engine never selects for this athlete during the window</li>
        </ul>
        <p className="mt-2">
          Doc id format: <code className="rounded bg-black/40 px-1">{`{athleteUserId}_{yyyy-mm}_{overrideKey}`}</code>. Auto-expires at month end.
        </p>
      </Card>

      <SectionHeader sub="When state-driven framing and proactive curriculum collide.">Doctrine intersection with Adaptation Framing</SectionHeader>
      <Card tone="warn" title="Two messages, one inbox — who wins?">
        <p>
          Curriculum is the baseline toolkit. Real-time Nora chat is the overlay that responds when the athlete, device
          state, or coach context suggests the standing plan is not the right next action in this moment. They can both
          target the same protocol — that's a feature, not a conflict.
        </p>
        <p>
          Example: athlete shows travel-signature circadian disruption.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Curriculum already has box breathing in one of the athlete protocol slots.</li>
          <li>Framing detects the signal at midday and surfaces a contextual message: "Want to bank that breathing practice early today? Body's running hot." → translates to the same protocol the athlete already has on their plate.</li>
          <li>Coach report shows BOTH signals: curriculum delivered the planned work + framing reinforced it. Completion counting remains tied to one DailyTask event.</li>
        </ul>
        <p>
          Where they pick DIFFERENT protocols, the curriculum's stays primary; framing surfaces the secondary as an
          additive recommendation, not a replacement.
        </p>
      </Card>

      <SectionHeader sub="Cadence + dependencies for Phase I rollout.">Implementation status</SectionHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card title="Server foundation — live">
          <ul className="list-disc space-y-1 pl-5 text-xs">
            <li>Schema migration on protocols + sims</li>
            <li>Daily Assignment Generator client-SDK path for the current one-protocol plus one-simulation compatibility model</li>
            <li>30-day assessment service</li>
            <li>Coach override service</li>
            <li>Curriculum config singleton + revision log</li>
            <li>Admin surface at <code className="rounded bg-black/40 px-1">/admin/curriculumLayer</code></li>
          </ul>
        </Card>
        <Card title="Schedulers, surfaces, voice — partial">
          <ul className="list-disc space-y-1 pl-5 text-xs">
            <li>Scheduled functions are registered for assignment, reminder, and monthly assessment sweeps.</li>
            <li>Assignment and assessment schedulers currently enumerate eligible athletes and log intended work while the admin-SDK adapter is pending.</li>
            <li>Reminder scheduler can send static midday / evening templates for existing curriculum-engine assignments.</li>
            <li>iOS has <code className="rounded bg-black/40 px-1">DailyCurriculumReader</code>, a read-only listener for today's curriculum-engine protocol and sim assignments.</li>
            <li>Six-slot slate storage, mastery graduation, backfill, and athlete-facing toolkit views remain TODO.</li>
            <li>Phase C voice integration for curriculum reminders remains TODO.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
};

export default PulseCheckCurriculumLayerSpecTab;
