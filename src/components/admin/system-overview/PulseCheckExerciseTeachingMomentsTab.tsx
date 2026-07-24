import React from 'react';
import { AudioLines, BookOpenCheck, Database, Gauge, Play, ShieldCheck, Sparkles } from 'lucide-react';
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

const FAMILY_ROWS = [
  ['Breathing', 'How slower rhythmic breathing coordinates breath and cardiovascular rhythm.', 'Expanding and settling air-flow motion; outlined wind/breath icon.'],
  ['Visualization', 'How vivid mental rehearsal activates movement planning and makes cues and responses more familiar.', 'A scene forms in layers, then the athlete rehearses pressure, adjustment, and finish.'],
  ['Attention', 'How choosing one signal reduces distraction and improves the next decision.', 'Competing cues narrow toward one usable target.'],
  ['Body awareness', 'How noticing tension, posture, and sensation creates earlier choice points.', 'A body map reveals signals without labeling them good or bad.'],
  ['Mental reset', 'How a short deliberate action interrupts carryover from the previous moment.', 'Noise clears and a new focal point becomes available.'],
  ['Decision-making', 'How recognizing the cue before committing supports cleaner choices under time pressure.', 'Information arrives, a window opens, and commitment follows the valid cue.'],
  ['Reframing', 'How changing the meaning assigned to an event changes the response available next.', 'One situation rotates through more useful interpretations.'],
  ['Process focus', 'How controllable actions give attention a concrete job.', 'Outcome imagery recedes while the next controllable step comes forward.'],
  ['Reflection', 'How looking back reveals which thoughts, choices, and environments helped during the day.', 'Moments connect into a simple pattern the athlete can recognize.'],
  ['Affirmations', 'How believable repeated language can direct attention and reinforce chosen behavior.', 'Words pair with posture, breath, and a specific action.'],
  ['Confident posture', 'How posture changes breathing space, visual field, and readiness to act.', 'The figure moves from collapsed to open and steady.'],
];

const JOURNEY_STEPS = [
  {
    title: 'Discover',
    body: 'Introduce one concrete idea through narration, caption-sized copy, and family-specific motion. The athlete should understand what is happening in the body or mind.',
  },
  {
    title: 'See It',
    body: 'Animate the cause-and-effect relationship. The visual should teach the concept rather than decorate a paragraph.',
  },
  {
    title: 'Try It',
    body: 'Let the athlete perform a small version of the skill. The final scene automatically hands off into the assigned exercise.',
  },
];

const FIRST_SEEN_ROWS = [
  ['Gate key', 'User id + teaching family + content version.'],
  ['When evaluated', 'When the athlete enters an exercise, before the exercise player begins.'],
  ['Exercise history', 'Prior completion of an exercise does not mark its teaching family as seen.'],
  ['Completion', 'Mark seen after the teaching journey completes or the athlete deliberately skips it.'],
  ['Persistence', 'Write local progress for immediate reliability and Firestore `mental-training-education-progress/{userId}` for cross-device continuity.'],
  ['Versioning', 'A materially revised teaching journey receives a new version and may be shown again.'],
];

const NARRATION_ROWS = [
  ['Prepare current scene', 'Load the full current narration clip before scene playback begins.'],
  ['Warm remaining scenes', 'Start loading the remaining clips concurrently after the moment opens.'],
  ['Caption timing', 'Reveal concise caption beats in sync with prepared narration duration.'],
  ['Automatic advance', 'Advance when narration and the minimum visual beat complete; no Next button is required.'],
  ['Fallback', 'If a clip cannot load, keep the visual/caption journey usable and advance with deterministic timing.'],
  ['Accessibility', 'Respect reduced motion, allow narration mute, and keep captions available.'],
];

const COPY_RULES = [
  'Write to a smart middle-school athlete: concrete words, short cause-and-effect explanations, and no unexplained system terms.',
  'Say exactly what changes in the body, attention, imagination, or behavior. Avoid phrases such as “prepare the pathway” or “strengthen your state.”',
  'Do not use negation-led constructions such as “it is not X, it is Y.” State the intended truth directly.',
  'Blend science and meaning without making supernatural, medical, or guaranteed-performance claims.',
  'Use spirituality as agency, coherence, intention, imagination, and chosen attention—not as biometric certainty.',
  'Mental rehearsal strengthens physical preparation. Explain what the imagination trains and keep physical practice in the full training picture.',
  'Captions are beats in a journey, not a static wall of reading.',
];

const QA_ROWS = [
  ['First-seen behavior', 'Reset progress and verify every family appears before its first matching exercise.'],
  ['Automatic progression', 'Verify all three scenes advance without taps and hand off once.'],
  ['Narration latency', 'Measure first audio start and inter-scene gaps with cold and warm cache.'],
  ['Visual identity', 'Confirm each family has motion that explains its concept and uses the shared outline icon style.'],
  ['Junior copy', 'Review every caption aloud for concrete language and smart-middle-school comprehension.'],
  ['Accessibility', 'Test VoiceOver, captions, mute, Reduce Motion, and interruption/resume behavior.'],
  ['Screen Demo', 'Expose every teaching family in the demo gallery without modifying production first-seen state.'],
];

export default function PulseCheckExerciseTeachingMomentsTab() {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="PulseCheck EdTech"
        title="Exercise Teaching Moments"
        version="v1.0 | July 2026"
        summary="First-encounter learning journeys that teach why an exercise matters before asking the athlete to perform it. Each family uses narration, caption-sized language, explanatory motion, a small interaction, and an automatic handoff into training."
        highlights={[
          {
            title: 'Teach Before Repeating',
            body: 'A new exercise family earns a teaching moment even when the athlete has completed a related exercise before.',
          },
          {
            title: 'A Journey, Not A Rubric',
            body: 'Discover, See It, and Try It move automatically. The athlete experiences the idea instead of reading one static wall of text.',
          },
          {
            title: 'Science In Junior Language',
            body: 'Every explanation names the actual body or attention effect in language a smart middle-school athlete can understand.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Education layer between exercise selection and exercise playback."
        sourceOfTruth="The teaching-family registry owns classification and content version. The progress store owns first-seen state. The journey view owns narration, captions, motion, timing, accessibility, and handoff."
        masterReference="Use this page when adding a new exercise type, changing first-seen behavior, creating teaching narration, or reviewing whether an educational moment is interactive and age-appropriate."
        relatedDocs={[
          'Junior Track Guided Curriculum',
          'System Design & Language',
          'Simulation Taxonomy',
          'Sport Scenario Personalization',
          'Athlete Daily State Loop',
        ]}
      />

      <SectionBlock icon={BookOpenCheck} title="Teaching Family Matrix">
        <DataTable columns={['Family', 'Core Teaching Idea', 'Visual Journey']} rows={FAMILY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Play} title="Three-Scene Learning Journey">
        <StepRail steps={JOURNEY_STEPS} />
        <InfoCard
          title="Automatic Handoff"
          accent="green"
          body="The final scene enters the exercise automatically after its narration and practice beat finish. A visible skip or close control may remain, but routine progression does not depend on a Next button."
        />
      </SectionBlock>

      <SectionBlock icon={Database} title="First-Seen And Versioning Contract">
        <DataTable columns={['Rule', 'Required Behavior']} rows={FIRST_SEEN_ROWS} />
      </SectionBlock>

      <SectionBlock icon={AudioLines} title="Narration And Caption Performance">
        <DataTable columns={['Stage', 'Optimization Contract']} rows={NARRATION_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="No Dead Air"
            accent="blue"
            body="The scene should not become visible and then wait on an unprepared narration request. Prepare the current clip first and warm the rest of the journey concurrently."
          />
          <InfoCard
            title="Captions Carry The Lesson"
            accent="purple"
            body="Captions remain useful with audio muted and appear as short synchronized thoughts. They do not duplicate a long essay beneath the animation."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Sparkles} title="Copy And Meaning Standard">
        <InfoCard title="Junior Teaching Voice" accent="amber" body={<BulletList items={COPY_RULES} />} />
      </SectionBlock>

      <SectionBlock icon={Gauge} title="Visual QA And Screen Demo">
        <DataTable columns={['Test Area', 'Acceptance Check']} rows={QA_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Claims Boundary">
        <InfoCard
          title="Evidence-Aware Inspiration"
          accent="red"
          body="Teaching moments may describe coherence, rehearsal, attention, intention, and imagination in motivating language. They must avoid guarantees, diagnosis, claims that thought replaces physical preparation, or claims that a short exercise instantly removes fatigue."
        />
      </SectionBlock>
    </div>
  );
}
