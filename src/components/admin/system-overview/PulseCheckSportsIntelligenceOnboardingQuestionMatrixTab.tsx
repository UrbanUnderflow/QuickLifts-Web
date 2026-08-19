import React from 'react';
import { AlertTriangle, ClipboardList, Smartphone, ShieldCheck } from 'lucide-react';
import {
  BulletList,
  DataTable,
  DocHeader,
  InfoCard,
  InlineTag,
  RuntimeAlignmentPanel,
  SectionBlock,
} from './PulseCheckRuntimeDocPrimitives';

type Verdict = 'cut' | 'dup' | 'review' | 'fix' | 'keep';

interface FieldRow {
  field: string;
  scope: string;
  type: string;
  verdict: Verdict;
  why: string;
}

interface SportMatrixEntry {
  name: string;
  emoji: string;
  sportId: string;
  positions: string;
  rows: FieldRow[];
}

const VERDICT_COLOR: Record<Verdict, 'purple' | 'blue' | 'green' | 'amber' | 'red'> = {
  cut: 'red',
  dup: 'blue',
  review: 'amber',
  fix: 'purple',
  keep: 'green',
};

const VERDICT_LABEL: Record<Verdict, string> = {
  cut: 'Cut',
  dup: 'Duplicate',
  review: 'Review',
  fix: 'Fix',
  keep: 'Keep',
};

function VerdictCell({ verdict }: { verdict: Verdict }) {
  if (verdict === 'keep') {
    return <span className="text-zinc-600">—</span>;
  }
  return <InlineTag label={VERDICT_LABEL[verdict]} color={VERDICT_COLOR[verdict]} />;
}

const SPORTS: SportMatrixEntry[] = [
  {
    name: 'Basketball', emoji: '🏀', sportId: 'basketball',
    positions: 'Point Guard, Shooting Guard, Small Forward, Power Forward, Center',
    rows: [
      { field: 'Competitive Level', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Season Phase', scope: 'season', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Primary Role Demand', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Performance Focus', scope: 'athlete', type: 'multiSelect', verdict: 'keep', why: '' },
      { field: 'Movement Demand', scope: 'athlete', type: 'multiSelect', verdict: 'keep', why: '' },
      { field: 'Current Load Pattern', scope: 'recovery', type: 'singleSelect', verdict: 'keep', why: '' },
    ],
  },
  {
    name: 'Soccer', emoji: '⚽', sportId: 'soccer',
    positions: 'Goalkeeper, Defender, Midfielder, Forward',
    rows: [
      { field: 'Competitive Level', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Season Phase', scope: 'season', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Tactical Demand', scope: 'athlete', type: 'multiSelect', verdict: 'keep', why: '' },
      { field: 'Dominant Foot', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Performance Focus', scope: 'athlete', type: 'multiSelect', verdict: 'keep', why: '' },
      { field: 'Match Load Pattern', scope: 'recovery', type: 'singleSelect', verdict: 'keep', why: '' },
    ],
  },
  {
    name: 'Football', emoji: '🏈', sportId: 'football',
    positions: 'Quarterback, Running Back, Wide Receiver, Tight End, Offensive Line, Defensive Line, Linebacker, Cornerback, Safety, Kicker',
    rows: [
      { field: 'Competitive Level', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Season Phase', scope: 'season', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Primary Unit', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: 'Offense / Defense / Special Teams — distinct from position' },
      { field: 'Contact Load', scope: 'recovery', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Performance Focus', scope: 'athlete', type: 'multiSelect', verdict: 'keep', why: '' },
      { field: 'Body Composition Goal', scope: 'nutrition', type: 'singleSelect', verdict: 'cut', why: 'Removed 2026-08-18 — macro/food question, same pattern as Bodybuilding' },
    ],
  },
  {
    name: 'Baseball', emoji: '⚾', sportId: 'baseball',
    positions: 'Pitcher, Catcher, First Base, Second Base, Third Base, Shortstop, Left Field, Center Field, Right Field',
    rows: [
      { field: 'Competitive Level', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Season Phase', scope: 'season', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Role Type', scope: 'athlete', type: 'singleSelect', verdict: 'review', why: 'Pitcher / Catcher / Position Player — a coarser re-ask of Position' },
      { field: 'Throw / Hit Handedness', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Throwing Volume Phase', scope: 'recovery', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Performance Focus', scope: 'athlete', type: 'multiSelect', verdict: 'keep', why: '' },
    ],
  },
  {
    name: 'Softball', emoji: '🥎', sportId: 'softball',
    positions: 'Pitcher, Catcher, First Base, Second Base, Third Base, Shortstop, Outfield',
    rows: [
      { field: 'Competitive Level', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Season Phase', scope: 'season', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Role Type', scope: 'athlete', type: 'singleSelect', verdict: 'review', why: 'Same coarser re-ask of Position as Baseball' },
      { field: 'Offensive Style', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Throwing Volume Phase', scope: 'recovery', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Performance Focus', scope: 'athlete', type: 'multiSelect', verdict: 'keep', why: '' },
    ],
  },
  {
    name: 'Volleyball', emoji: '🏐', sportId: 'volleyball',
    positions: 'Setter, Outside Hitter, Middle Blocker, Opposite Hitter, Libero',
    rows: [
      { field: 'Competitive Level', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Season Phase', scope: 'season', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Rotation Role', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: 'Six-Rotation / Front Row / Back Row — distinct from position' },
      { field: 'Jump Load Phase', scope: 'recovery', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Performance Focus', scope: 'athlete', type: 'multiSelect', verdict: 'keep', why: '' },
      { field: 'Movement Demand', scope: 'athlete', type: 'multiSelect', verdict: 'keep', why: '' },
    ],
  },
  {
    name: 'Tennis', emoji: '🎾', sportId: 'tennis',
    positions: 'Singles, Doubles',
    rows: [
      { field: 'Competitive Level', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Match Format', scope: 'competition', type: 'singleSelect', verdict: 'dup', why: 'Options are literally Singles / Doubles / Both — re-asks Position. Position step suppressed 2026-08-18.' },
      { field: 'Court Surface', scope: 'competition', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Playing Style', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Schedule Density', scope: 'recovery', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Performance Focus', scope: 'athlete', type: 'multiSelect', verdict: 'keep', why: '' },
    ],
  },
  {
    name: 'Swimming', emoji: '🏊', sportId: 'swimming',
    positions: 'Freestyle, Backstroke, Breaststroke, Butterfly, Individual Medley',
    rows: [
      { field: 'Competitive Level', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Primary Stroke', scope: 'athlete', type: 'singleSelect', verdict: 'dup', why: 'Same five strokes as Position, plus one extra option. Position step suppressed 2026-08-18.' },
      { field: 'Event Distance', scope: 'competition', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Training Phase', scope: 'season', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Performance Focus', scope: 'athlete', type: 'multiSelect', verdict: 'keep', why: '' },
      { field: 'Dryland Load', scope: 'recovery', type: 'singleSelect', verdict: 'keep', why: '' },
    ],
  },
  {
    name: 'Track & Field', emoji: '🏃', sportId: 'track-field',
    positions: 'Sprinter, Middle Distance, Long Distance, Jumper, Thrower, Hurdler',
    rows: [
      { field: 'Competitive Level', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Event Group', scope: 'competition', type: 'singleSelect', verdict: 'dup', why: 'Required. Re-asks the same event family as Position with different labels. Position step suppressed 2026-08-18.' },
      { field: 'Primary Event', scope: 'competition', type: 'text', verdict: 'dup', why: 'Free-text third ask of the same thing ("100m, Long Jump…")' },
      { field: 'Training Phase', scope: 'season', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Performance Focus', scope: 'athlete', type: 'multiSelect', verdict: 'keep', why: '' },
      { field: 'Load Sensitivity', scope: 'recovery', type: 'singleSelect', verdict: 'keep', why: '' },
    ],
  },
  {
    name: 'Wrestling', emoji: '🤼', sportId: 'wrestling',
    positions: 'Individual — position step doesn’t render',
    rows: [
      { field: 'Competitive Level', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Style', scope: 'competition', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Weight Class', scope: 'competition', type: 'text', verdict: 'keep', why: 'Competition category, not a nutrition question' },
      { field: 'Weight Cut Status', scope: 'nutrition', type: 'singleSelect', verdict: 'cut', why: 'Removed 2026-08-18 — "Aggressive Cut / Small Cut", same pattern as Bodybuilding' },
      { field: 'Performance Focus', scope: 'athlete', type: 'multiSelect', verdict: 'keep', why: '' },
      { field: 'Training Load Pattern', scope: 'recovery', type: 'singleSelect', verdict: 'keep', why: '' },
    ],
  },
  {
    name: 'CrossFit', emoji: '🏋️', sportId: 'crossfit',
    positions: 'Individual — position step doesn’t render',
    rows: [
      { field: 'Competitive Level', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Competition Format', scope: 'competition', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Athlete Bias', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Primary Limiter', scope: 'athlete', type: 'multiSelect', verdict: 'keep', why: '' },
      { field: 'Training Load Pattern', scope: 'recovery', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Nutrition Priority', scope: 'nutrition', type: 'singleSelect', verdict: 'cut', why: 'Removed 2026-08-18 — "Body Composition / Performance Fueling", same pattern' },
    ],
  },
  {
    name: 'Golf', emoji: '⛳', sportId: 'golf',
    positions: 'Individual — position step doesn’t render',
    rows: [
      { field: 'Competitive Level', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Handedness', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Playing Context', scope: 'competition', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Course Demand', scope: 'competition', type: 'multiSelect', verdict: 'keep', why: '' },
      { field: 'Performance Focus', scope: 'athlete', type: 'multiSelect', verdict: 'keep', why: '' },
      { field: 'Physical Load Context', scope: 'recovery', type: 'singleSelect', verdict: 'keep', why: '' },
    ],
  },
  {
    name: 'Bowling', emoji: '🎳', sportId: 'bowling',
    positions: 'Anchor, Leadoff, Middle Lineup, Baker Rotation, Individual',
    rows: [
      { field: 'Competitive Level', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Season Phase', scope: 'season', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Lineup Role', scope: 'athlete', type: 'singleSelect', verdict: 'dup', why: 'Identical five options as Position, asked again verbatim. Position step suppressed 2026-08-18.' },
      { field: 'Lane Condition', scope: 'competition', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Performance Focus', scope: 'athlete', type: 'multiSelect', verdict: 'keep', why: '' },
      { field: 'Tournament Load', scope: 'recovery', type: 'singleSelect', verdict: 'keep', why: '' },
    ],
  },
  {
    name: 'Lacrosse', emoji: '🥍', sportId: 'lacrosse',
    positions: 'Attack, Midfield, Defense, Goalkeeper',
    rows: [
      { field: 'Competitive Level', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Season Phase', scope: 'season', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Dominant Stick Hand', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Phase Role', scope: 'athlete', type: 'singleSelect', verdict: 'review', why: '7-option role list overlapping Position at finer grain' },
      { field: 'Performance Focus', scope: 'athlete', type: 'multiSelect', verdict: 'keep', why: '' },
      { field: 'Contact Load', scope: 'recovery', type: 'singleSelect', verdict: 'keep', why: '' },
    ],
  },
  {
    name: 'Hockey', emoji: '🏒', sportId: 'hockey',
    positions: 'Forward, Defenseman, Goalie',
    rows: [
      { field: 'Competitive Level', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Season Phase', scope: 'season', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Shot Hand', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Usage Role', scope: 'athlete', type: 'singleSelect', verdict: 'review', why: 'Overlaps Position (includes Goalie Starter / Backup)' },
      { field: 'Performance Focus', scope: 'athlete', type: 'multiSelect', verdict: 'keep', why: '' },
      { field: 'Contact Load', scope: 'recovery', type: 'singleSelect', verdict: 'keep', why: '' },
    ],
  },
  {
    name: 'Gymnastics', emoji: '🤸', sportId: 'gymnastics',
    positions: 'Individual — position step doesn’t render',
    rows: [
      { field: 'Competitive Level', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Discipline', scope: 'competition', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Apparatus Focus', scope: 'competition', type: 'multiSelect', verdict: 'keep', why: '' },
      { field: 'Skill Stage', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Performance Focus', scope: 'athlete', type: 'multiSelect', verdict: 'keep', why: '' },
      { field: 'Recovery Sensitivity', scope: 'recovery', type: 'singleSelect', verdict: 'keep', why: '' },
    ],
  },
  {
    name: 'Bodybuilding / Physique', emoji: '🏆', sportId: 'bodybuilding-physique',
    positions: 'Men’s Physique, Classic Physique, Bodybuilding, Bikini, Figure, Wellness, Fitness',
    rows: [
      { field: 'Division', scope: 'competition', type: 'singleSelect', verdict: 'dup', why: 'Identical seven options as Position. Position step suppressed 2026-08-18 — this is the screen that started the audit.' },
      { field: 'Competition Date', scope: 'competition', type: 'date', verdict: 'fix', why: 'Fixed 2026-08-18 — set required: false, and NoraOnboardingView now renders a real native DatePicker instead of a plain text field.' },
      { field: 'Prep Phase', scope: 'season', type: 'singleSelect', verdict: 'keep', why: 'Required, but only asked once — legitimate' },
      { field: 'Food Variance Tolerance', scope: 'nutrition', type: 'singleSelect', verdict: 'cut', why: 'Removed 2026-08-18 — macro/food question' },
      { field: 'Approved Carb Sources', scope: 'nutrition', type: 'multiSelect', verdict: 'cut', why: 'Removed 2026-08-18 — macro/food question' },
      { field: 'Coach Macros Locked', scope: 'nutrition', type: 'boolean', verdict: 'cut', why: 'Removed 2026-08-18 — macro/food question' },
      { field: 'Posing Priority', scope: 'competition', type: 'multiSelect', verdict: 'keep', why: 'Kept — genuinely competition prep, not nutrition. Already multiSelect (a competitor can be working several mandatories at once).' },
      { field: 'Cardio Load', scope: 'recovery', type: 'singleSelect', verdict: 'fix', why: 'Re-scoped 2026-08-18 from nutrition → recovery — it’s a training-load question, not food, so it stays, just correctly tagged.' },
    ],
  },
  {
    name: 'Other', emoji: '🏅', sportId: 'other',
    positions: 'Individual — position step doesn’t render',
    rows: [
      { field: 'Sport / Discipline Detail', scope: 'athlete', type: 'text', verdict: 'keep', why: '' },
      { field: 'Competitive Level', scope: 'athlete', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Season Phase', scope: 'season', type: 'singleSelect', verdict: 'keep', why: '' },
      { field: 'Performance Focus', scope: 'athlete', type: 'multiSelect', verdict: 'keep', why: '' },
      { field: 'Movement Demand', scope: 'athlete', type: 'multiSelect', verdict: 'keep', why: '' },
      { field: 'Training Load Pattern', scope: 'recovery', type: 'singleSelect', verdict: 'keep', why: '' },
    ],
  },
];

const PulseCheckSportsIntelligenceOnboardingQuestionMatrixTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Sports Intelligence — iOS only"
        title="Onboarding Question Matrix"
        version="Audited 2026-08-18"
        summary="Every sport-specific onboarding field across all 18 configured sports, on iOS — read against one rule: the sport-specific step asks about the sport, the athlete's role in it, and where they are in their season — nothing about food, macros, or body composition, and nothing the position picker already asked one screen earlier. This matrix is iOS-only because the per-sport attribute system it audits doesn't exist on Android; see Platform Coverage below before assuming any row here applies there."
        highlights={[
          {
            title: '6 nutrition fields cut (iOS)',
            body: 'Food and macro fields living inside the iOS sport-specific step, across Football, Wrestling, CrossFit, and Bodybuilding / Physique — not just the one screen that started this audit.',
          },
          {
            title: '5 sports asked Position twice (iOS)',
            body: 'Bodybuilding, Bowling, Swimming, Tennis, and Track & Field each had a sport-specific field re-asking what the generic Position picker already collected. The generic step is now suppressed for these five; the question lives once, in Sport Details.',
          },
          {
            title: 'Android has none of this to fix',
            body: 'Android onboarding has no per-sport attribute model at all — just two freeform text fields, "Sport" and "Position or role", for every sport. No nutrition fields, no duplicate-position bug, no date picker, because none of the underlying mechanism exists there yet.',
          },
        ]}
      />

      <InfoCard
        title="Legend"
        accent="blue"
        body={
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="flex items-center gap-2"><InlineTag label="Cut" color="red" /> nutrition / macro content, removed</span>
            <span className="flex items-center gap-2"><InlineTag label="Duplicate" color="blue" /> re-asked the position picker</span>
            <span className="flex items-center gap-2"><InlineTag label="Review" color="amber" /> borderline, unresolved</span>
            <span className="flex items-center gap-2"><InlineTag label="Fix" color="purple" /> UI or required-flag bug</span>
            <span className="flex items-center gap-2 text-zinc-500"><span className="text-zinc-600">—</span> legitimate sport-specific detail</span>
          </div>
        }
      />

      <RuntimeAlignmentPanel
        role="Field-level audit of the iOS athlete-facing sport-specific onboarding step (NoraOnboardingView.swift → sportSpecificFieldsSection). Not a spec for new behavior — a record of what each sport currently asks and why, on the one platform where this mechanism exists."
        sourceOfTruth="Source of truth for iOS onboarding field content is `company-config/pulsecheck-sports`, edited via the admin console at `/admin/pulsecheckSportConfiguration` — never this page. This tab documents state as of the audit date; re-verify against the live document and PulseCheckSportConfigurationService.swift before trusting a row on this page as current. Android has no equivalent source of truth to verify against — see Platform Coverage below."
        masterReference="Sport configuration schema, edit ownership split, and the code-owned vs. admin-owned field boundary are defined in the Sports Intelligence Layer spec."
        relatedDocs={['Sports Intelligence Layer', 'Sport Scenario Personalization']}
      />

      <SectionBlock icon={Smartphone} title="Platform Coverage — Read This Before Trusting Any Row Below">
        <InfoCard
          title="This Matrix Is iOS-Only. Verified 2026-08-18."
          accent="red"
          body={
            <div className="space-y-3">
              <p>
                Android (`/Users/tremainegrant/Documents/GitHub/PulseCheck/android`) has no equivalent of the
                iOS <code className="rounded bg-black/30 px-1 py-0.5 text-zinc-200">SportAttributeDefinition</code> /{' '}
                <code className="rounded bg-black/30 px-1 py-0.5 text-zinc-200">SportOption</code> system. There is no bundled
                sport-attribute JSON, no per-sport positions/attributes/metrics/prompting model, and no runtime read of{' '}
                <code className="rounded bg-black/30 px-1 py-0.5 text-zinc-200">company-config/pulsecheck-sports</code> anywhere in
                the Android module — confirmed by exhaustive grep, not absence of search effort.
              </p>
              <p>
                Android&apos;s onboarding (<code className="rounded bg-black/30 px-1 py-0.5 text-zinc-200">OnboardingScreen</code>,
                MainActivity.kt:8272) is a fixed 5-step Compose form. Step 2 asks two freeform text fields — &quot;Sport&quot;
                (placeholder: &quot;Basketball, soccer, track...&quot;) and &quot;Position or role&quot; (placeholder: &quot;Guard,
                striker, sprinter...&quot;) — unconditionally, for every sport, with no picker, no per-sport option list, and no
                skip logic. Both write to the same underlying Firestore fields iOS uses (
                <code className="rounded bg-black/30 px-1 py-0.5 text-zinc-200">PulseCheckStoryUpdate</code>: sport, position,
                primaryMentalChallenge, primaryPerformanceGoal — a source comment even says &quot;these fields match the profile
                story iOS saves for Nora&quot;), but only that shared baseline. None of the six nutrition attributes, the
                Competition Date field, Cardio Load, or the five Position-duplicate sports exist as concepts on Android — not
                because they were fixed there, but because the whole per-sport attribute mechanism was never built there.
              </p>
              <p className="font-medium text-zinc-200">
                Practical read: nothing in this matrix, and nothing the 2026-08-18 iOS/Firestore cleanup touched, changes anything
                about the Android app. If Android later gains sport-specific onboarding, it needs its own audit against this same
                standard — don&apos;t assume parity from this page.
              </p>
            </div>
          }
        />
      </SectionBlock>

      <SectionBlock icon={ClipboardList} title="Full Field Matrix — 18 Sports (iOS)">
        <div className="space-y-6">
          {SPORTS.map((sport) => (
            <div key={sport.sportId}>
              <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-sm font-semibold text-white">
                  {sport.emoji} {sport.name}
                </p>
                <p className="font-mono text-xs text-zinc-500">
                  Position: {sport.positions}
                </p>
              </div>
              <DataTable
                columns={['Field', 'Scope', 'Type', 'Verdict', 'Why']}
                rows={sport.rows.map((row) => [
                  <span className="font-medium text-white">{row.field}</span>,
                  <span className="font-mono text-xs">{row.scope}</span>,
                  <span className="font-mono text-xs">{row.type}</span>,
                  <VerdictCell verdict={row.verdict} />,
                  <span className="text-xs text-zinc-400">{row.why}</span>,
                ])}
              />
            </div>
          ))}
        </div>
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Why This Drifts Back If You Only Edit Code">
        <InfoCard
          title="Two-Layer Config, One Winner"
          accent="amber"
          body={
            <BulletList
              items={[
                'The app reads sport config from Firestore (`company-config/pulsecheck-sports`) first, and only falls back to the bundled JSON in PulseCheckSportConfigurationService.swift if that fetch fails.',
                'Attributes and positions are admin-owned: edited live through `/admin/pulsecheckSportConfiguration`, not deployed from code. `scripts/seed-pulsecheck-sports.ts` deliberately never overwrites them — admin UI edits always win over code defaults.',
                'A fix in `pulsecheckSportConfig.ts` or the Swift bundled fallback only protects a fresh seed or an offline fallback. It does not change what a phone with a live Firestore connection shows today.',
                'To change what athletes see right now, edit the live document through the admin console, or run a scoped one-off patch script against it (see `scripts/cleanup-pulsecheck-onboarding-nutrition-fields.ts` for the pattern used on 2026-08-18).',
              ]}
            />
          }
        />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Standing Rule">
        <InfoCard
          title="What The Sport-Specific Step Is For"
          accent="green"
          body="Ask about the sport: discipline, event, division, role, season phase, and competition logistics. Never ask about food, macros, body composition, or anything nutrition-scoped — that belongs to Macra, not PulseCheck onboarding. And never ask the same thing twice — if a sport-specific attribute already captures what the generic Position picker would ask (an exact or near-exact duplicate option set), suppress the generic step for that sport rather than asking both. This rule is enforced on iOS today because iOS is the only platform with a per-sport attribute mechanism to enforce it on. It's the standard Android onboarding should be held to if/when it builds the same capability — not evidence Android already meets it."
        />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckSportsIntelligenceOnboardingQuestionMatrixTab;
