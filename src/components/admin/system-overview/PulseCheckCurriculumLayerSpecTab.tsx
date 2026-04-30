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

const PulseCheckCurriculumLayerSpecTab: React.FC = () => {
  return (
    <div className="text-zinc-100">
      <header className="mb-8 rounded-2xl border border-violet-700/30 bg-gradient-to-br from-violet-950/30 to-indigo-950/30 p-6">
        <p className="text-xs uppercase tracking-wide text-violet-300">PulseCheck · Phase I</p>
        <h2 className="mt-1 text-2xl font-bold">Daily Curriculum Layer</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-300">
          Proactive 1 protocol + 1 simulation per athlete per day, balanced across composure, focus, and decisioning
          pillars. Builds automaticity through spaced repetition. Companion to the reactive Adaptation Framing Layer.
        </p>
      </header>

      <SectionHeader sub="Why this layer exists alongside the reactive Adaptation Framing Layer.">
        Doctrine
      </SectionHeader>
      <div className="space-y-4">
        <Card tone="doctrine" title="Automaticity through spaced repetition">
          <p>
            Box breathing under stress only works if the body has rehearsed it dozens of times under no stress. The same is
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
            day regardless of state. Both share infrastructure (Nora voice, push notifications, iOS surface) but serve
            different purposes.
          </p>
          <p>
            When both fire on the same day, curriculum is the baseline (delivered in the morning) and framing is the
            overlay (delivered when a signal warrants it).
          </p>
        </Card>
        <Card tone="doctrine" title="Athlete Surface Doctrine — what counts as priming">
          <p>
            Per the Athlete Surface Doctrine, athletes never see raw biomarker numbers. Behavioral data — rep counts,
            streaks, pillar balance — IS visible to athletes. It's motivating, not priming. Erlacher et al. 2014 was
            about physiological readouts (REM%, HRV, sleep score), not behavioral counts.
          </p>
        </Card>
      </div>

      <SectionHeader sub="What the engine does, in selection order.">Selection algorithm</SectionHeader>
      <Card title="Six-step daily selection per athlete">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Read curriculum config (default + per-sport pillar weights, frequency targets, engine-enabled flag).</li>
          <li>Read last-30-days completion events from <code className="rounded bg-black/40 px-1">pulsecheck-assignment-events</code>.</li>
          <li>
            Compute reps-by-pillar (composure / focus / decision). Compute target-by-pillar from pillar weights × base
            target. Compute gap = target − actual.
          </li>
          <li>Pick the WORST-GAP pillar — that pillar drives today's selection.</li>
          <li>
            Filter the eligible-asset pool: foundational protocols/sims always eligible; intermediate + advanced require{' '}
            <code className="rounded bg-black/40 px-1">prerequisitePillarReps</code> to be met. Apply variety filter
            (don't repeat in last 2 days). Apply coach overrides (pinned items boost weight; excluded items removed).
          </li>
          <li>
            Pick the under-done item (lowest <code className="rounded bg-black/40 px-1">actualReps / recommendedFrequency</code>{' '}
            ratio). Foundational beats intermediate beats advanced as tiebreaker.
          </li>
        </ol>
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

      <SectionHeader sub="Per-progression-level rep targets.">Frequency targets</SectionHeader>
      <Card title="Defaults (operator-tunable)">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Foundational</strong>: 12 reps / 30 days — building blocks of automaticity (e.g., box breathing, body scan)</li>
          <li><strong>Intermediate</strong>: 8 reps / 30 days — layered skills</li>
          <li><strong>Advanced</strong>: 4 reps / 30 days — situational, not foundational</li>
        </ul>
        <p className="mt-2">
          Per-asset overrides in <code className="rounded bg-black/40 px-1">recommendedFrequencyPer30Days</code> always
          win. Falls back to the level default when absent.
        </p>
      </Card>

      <SectionHeader sub="Notification cadence — three pushes per athlete per day.">Notification model</SectionHeader>
      <Card title="Three pushes per day, athlete-local">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Morning</strong> (default 8am local) — delivers the assignment. Voice: "Today's protocol — 5 min when you wake. Sets the tone."
          </li>
          <li>
            <strong>Midday</strong> (default 1pm local) — sim nudge if uncompleted. Voice: "Quick rep — sharpen your edge for 5 minutes."
          </li>
          <li>
            <strong>Evening</strong> (default 8pm local) — recovery push. Only fires if assignment uncompleted.
          </li>
        </ul>
        <p className="mt-2 text-xs text-zinc-400">
          Phase I Part 1 ships static templates. Phase C swaps these for{' '}
          <code className="rounded bg-black/40 px-1">translateForAthlete()</code> via the Adaptation Framing Layer voice service —
          the static text becomes the seed-fallback.
        </p>
      </Card>

      <SectionHeader sub="Monthly rollup math + what coaches see.">30-day assessment</SectionHeader>
      <Card title="What the assessment computes">
        <ul className="list-disc space-y-1 pl-5">
          <li>Reps completed per pillar in the window</li>
          <li>Target reps per pillar (pillar weight × base target × 3 days/asset/window)</li>
          <li>Gap = target − reps. Worst-gap pillar drives next month's bias.</li>
          <li>Per-protocol + per-sim rep counts vs recommended frequency</li>
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
          Curriculum is the BASELINE (always fires in the morning). Framing is the OVERLAY (fires when a signal warrants
          it). They can both target the same protocol — that's a feature, not a conflict.
        </p>
        <p>
          Example: athlete shows travel-signature circadian disruption.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Curriculum already assigned box breathing this morning (its scheduled foundational rep).</li>
          <li>Framing detects the signal at midday and surfaces a contextual message: "Want to bank that breathing rep early today? Body's running hot." → translates to the same protocol the athlete already has on their plate.</li>
          <li>Coach report shows BOTH signals: curriculum delivered the rep + framing reinforced it. No double-dip rep counting (curriculum's completion event covers both).</li>
        </ul>
        <p>
          Where they pick DIFFERENT protocols, the curriculum's stays primary; framing surfaces the secondary as an
          additive recommendation, not a replacement.
        </p>
      </Card>

      <SectionHeader sub="Cadence + dependencies for Phase I rollout.">Implementation status</SectionHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card title="Phase I Part 1A — Server foundation (this slice)">
          <ul className="list-disc space-y-1 pl-5 text-xs">
            <li>Schema migration on protocols + sims</li>
            <li>Daily Assignment Generator (client-SDK; Part 1B will add admin-SDK adapter for cron)</li>
            <li>30-day assessment service</li>
            <li>Coach override service</li>
            <li>Curriculum config singleton + revision log</li>
          </ul>
        </Card>
        <Card title="Phase I Part 1B/1C — Schedulers, surfaces, voice">
          <ul className="list-disc space-y-1 pl-5 text-xs">
            <li>Admin surface — /admin/curriculumLayer (4 tabs)</li>
            <li>Scheduled functions registered (cron schedules live)</li>
            <li>Static notification templates with TODO(phase-c-voice) markers</li>
            <li>Admin-SDK adapter for cron-time generation (gap)</li>
            <li>iOS today-card display (depends on Phase H)</li>
          </ul>
        </Card>
      </div>
    </div>
  );
};

export default PulseCheckCurriculumLayerSpecTab;
