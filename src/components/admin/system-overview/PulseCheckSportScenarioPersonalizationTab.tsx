import React from 'react';
import { BadgeCheck, BookOpen, Database, GitBranch, Languages, ShieldCheck, Trophy } from 'lucide-react';
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

const ARCHETYPE_ROWS = [
  ['invasion', 'Football, basketball, soccer, hockey', 'Possession changes, reads, spacing, assignments, and rapid transitions.'],
  ['net_racket', 'Tennis, pickleball, volleyball', 'Points, rallies, serve/return pressure, resets, and opponent momentum.'],
  ['race', 'Swimming, track, cycling, rowing', 'Starts, pacing, splits, lanes, surges, and finishes.'],
  ['judged', 'Gymnastics, diving, figure skating', 'Routines, execution, judging, recovery after visible errors, and presentation.'],
  ['stage', 'Bodybuilding and physique divisions', 'Callouts, prejudging, posing, comparisons, waiting, and show-day presentation.'],
  ['precision', 'Golf, bowling, archery, shooting', 'Setup, target commitment, tempo, misses, and repeatable execution.'],
  ['combat', 'Boxing, wrestling, martial arts', 'Rounds, exchanges, opponent pressure, composure, and tactical adjustment.'],
  ['attempt', 'Weightlifting, powerlifting, field events', 'Attempt selection, setup, single-effort execution, misses, and recovery.'],
  ['general', 'Unknown or unsupported sport context', 'Sport-neutral pressure, preparation, recovery, and response language.'],
];

const RESOLUTION_ROWS = [
  ['1. Team context', 'Use the active team sport when it resolves to a valid catalog entry and is relevant to the launch.'],
  ['2. Athlete profile', 'Use the athlete sport, position, event, or division stored on the profile.'],
  ['3. Catalog mapping', 'Resolve the canonical sport id and its explicit scenario and biometric-insight archetypes.'],
  ['4. Code-owned id map', 'Use reviewed by-id mappings for deliberate exceptions or catalog entries awaiting migrated fields.'],
  ['5. Keyword fallback', 'Use normalized name, position, event, and division keywords only as a compatibility fallback.'],
  ['6. General pack', 'If identity remains unresolved, use the general pack and never pretend personalization occurred.'],
];

const TWO_AXIS_ROWS = [
  ['Scenario archetype', 'Chooses the situations, what-if options, response choices, and sport-native framing used inside a module.', 'Example: Men’s Physique resolves to `stage`.'],
  ['Biometric insight archetype', 'Chooses how recovery, load, physiology, and sport demands are interpreted.', 'A sport may share scenarios with another sport while requiring a different physiological interpretation.'],
];

const VOCABULARY_ROWS = [
  ['Bodybuilding / Men’s Physique', 'competition or show', 'show day', 'pose or present'],
  ['Tennis', 'match', 'match day', 'play the point'],
  ['Football / Basketball / Soccer', 'game', 'game day', 'make the play'],
  ['Swimming / Track', 'meet or race', 'meet day', 'race'],
  ['Golf / Bowling', 'round or tournament', 'competition day', 'take the shot'],
];

const TELEMETRY_ROWS = [
  ['scenarioArchetype', 'Resolved scenario family used by the module.'],
  ['scenarioSportId / scenarioSportName', 'Canonical catalog identity and athlete-facing display name.'],
  ['scenarioSportSource', 'Team, profile, explicit field, code map, keyword fallback, or general.'],
  ['whatIfPicks', 'The athlete-selected situations that shaped the drill.'],
  ['scenarioRoundId', 'The exact sport-specific round presented.'],
  ['responseChoice / responseTiming', 'Bounded answer and timing evidence for the round.'],
  ['physiologySampleRef', 'Optional silent sensor sample reference; raw numbers stay out of junior athlete copy.'],
];

const COVERAGE_GATES = [
  'Every active sport catalog entry must deliberately resolve to both a scenario archetype and a biometric insight archetype.',
  'The TypeScript catalog mapping is canonical; the Swift mirror must match it exactly for ids and archetypes used on-device.',
  'CI fails on orphan mappings, missing active-sport coverage, TypeScript/Swift drift, or a regression in the known-gap count.',
  'Position, event, and division aliases require fixtures. Men’s Physique and other catalog divisions must not depend on broad words like “game.”',
  'A personalized badge appears only when the runtime has a resolved sport identity. General fallback uses a generic Sports Intelligence label.',
];

export default function PulseCheckSportScenarioPersonalizationTab() {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="PulseCheck Sports Intelligence"
        title="Sport Scenario Personalization"
        version="v1.0 | July 2026"
        summary="Source-of-truth contract for turning a canonical athlete sport, position, event, or division into sport-native exercise scenarios, event language, athlete-facing personalization labels, and traceable completion evidence."
        highlights={[
          {
            title: 'Catalog Identity Comes First',
            body: 'The sport catalog owns identity. Scenario copy never guesses from a generic “athlete” label when a canonical sport or division is available.',
          },
          {
            title: 'Two Archetype Axes',
            body: 'Scenario selection and biometric interpretation are related but separate decisions. They must be resolved and tested independently.',
          },
          {
            title: 'The Badge Must Be Earned',
            body: '“Personalized for {sport}” appears only when the module actually uses the resolved sport pack and vocabulary.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Athlete-facing personalization contract beneath the broader Sports Intelligence Layer."
        sourceOfTruth="The TypeScript sport catalog and archetype maps own cross-platform identity coverage. The iOS mirror owns offline runtime parity. Scenario packs own module situations and choices; event vocabulary owns sport-native nouns and verbs."
        masterReference="Use this document when adding a sport, position, event, division, scenario pack, Sports Intelligence badge, or sport-specific phrase. Do not hard-code a new “game,” “play,” or “competition” branch inside an individual screen."
        relatedDocs={[
          'Sports Intelligence Layer',
          'Aggregation + Inference Contract',
          'Athlete Data Framing Doctrine',
          'Junior Track Guided Curriculum',
          'Exercise Teaching Moments',
        ]}
      />

      <SectionBlock icon={GitBranch} title="Identity Resolution And Launch Precedence">
        <StepRail steps={RESOLUTION_ROWS.map(([title, body]) => ({ title, body }))} />
        <InfoCard
          title="Resolution Invariant"
          accent="red"
          body="A display label and a scenario pack must come from the same resolved identity. Showing “Men’s Physique” while rendering a football “first play” scenario is a contract failure."
        />
      </SectionBlock>

      <SectionBlock icon={Trophy} title="Scenario Archetype Registry">
        <DataTable columns={['Archetype', 'Representative Sports', 'Scenario Language']} rows={ARCHETYPE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={BookOpen} title="Two Independent Sports Intelligence Axes">
        <DataTable columns={['Axis', 'Purpose', 'Example']} rows={TWO_AXIS_ROWS} />
        <InfoCard
          title="Why The Split Matters"
          accent="blue"
          body="A sport’s pressure situations and its physiological demands do not always group the same way. Keeping both axes explicit prevents scenario convenience from silently changing recovery or load reasoning."
        />
      </SectionBlock>

      <SectionBlock icon={Languages} title="Sport-Native Event Vocabulary">
        <DataTable columns={['Sport Context', 'Event', 'Event Day', 'Action']} rows={VOCABULARY_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Personalize Generic Stored Copy"
            accent="green"
            body="Runtime vocabulary may convert “a big game coming up,” “pre-game,” or “next play” into the resolved sport’s event language before display."
          />
          <InfoCard
            title="Protect General Mental Language"
            accent="amber"
            body="Do not rewrite phrases such as “mental game,” “game plan,” or other non-event uses. Replacement is phrase-aware, not a global word swap."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={BadgeCheck} title="Athlete-Facing Badge Contract">
        <DataTable
          columns={['Runtime State', 'Badge', 'Required Behavior']}
          rows={[
            ['Resolved sport pack', 'Personalized for {sport}', 'Use the sport-specific situations, choices, event vocabulary, and telemetry.'],
            ['Scenario-capable but unresolved', 'Sports Intelligence scenarios', 'Use the general pack without claiming sport-level tuning.'],
            ['Not a Sports Intelligence module', 'No badge', 'Do not add the badge as decoration.'],
          ]}
        />
        <BulletList
          items={[
            'Show the badge on module cards, detail/introduction surfaces, and scenario rounds where Sports Intelligence is active.',
            'Use the catalog display name, including division names such as Men’s Physique.',
            'A badge is a visible explanation of real runtime behavior, not a marketing tag.',
          ]}
        />
      </SectionBlock>

      <SectionBlock icon={Database} title="Completion Evidence And Physiology">
        <DataTable columns={['Field', 'Meaning']} rows={TELEMETRY_ROWS} />
        <InfoCard
          title="Silent Physiology Rule"
          accent="purple"
          body="A scenario may sample live heart-rate context to support later pattern learning. The immediate athlete response stays about felt experience and the trained response. Junior surfaces do not grade or expose raw biometric numbers."
        />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Catalog Coverage And Release Gates">
        <InfoCard title="Required CI And QA Checks" accent="green" body={<BulletList items={COVERAGE_GATES} />} />
      </SectionBlock>
    </div>
  );
}
