import React from 'react';
import { Activity, CalendarClock, Database, HeartHandshake, RefreshCcw, ShieldCheck, Sparkles } from 'lucide-react';
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

const LOOP_STEPS = [
  {
    title: 'Morning check-in',
    body: 'Ask how the athlete woke up feeling and what is contributing to that state. The answer establishes the first self-report signal of the day.',
  },
  {
    title: 'Train when it fits',
    body: 'The three assigned mental-training lessons remain available after the morning or evening check-in. The system does not assume the athlete is at practice or in competition.',
  },
  {
    title: 'Offer recalibration when useful',
    body: 'A drained or low-energy report can launch a bounded Energy Recalibration flow that builds awareness, checks for safety concerns, and teaches an internal reset.',
  },
  {
    title: 'Evening check-in',
    body: 'Ask how the day went using bounded retrospective choices. The evening report becomes the latest same-day feeling signal without deleting the morning context.',
  },
  {
    title: 'Build pattern memory',
    body: 'Persist self-report, training behavior, and silent device-alignment evidence so future guidance can recognize recurring patterns without arguing with the athlete.',
  },
];

const CHECKIN_ROWS = [
  ['Morning', 'How did you wake up feeling?', 'Restedness, energy, mood, and the athlete’s stated reason.', 'May be changed until the athlete-local day resets.'],
  ['Evening', 'How was your day?', 'Retrospective feeling and contributing context.', 'May be changed until the athlete-local day resets.'],
];

const ALIGNMENT_ROWS = [
  ['aligned', 'Self-report and available personal-baseline evidence point in the same direction.', 'Store the agreement as pattern evidence.'],
  ['not_aligned', 'Available evidence points in a different direction from the report.', 'Store the mismatch without invalidating the athlete.'],
  ['mixed', 'Signals disagree with one another or support more than one interpretation.', 'Keep the result uncertain and avoid a simplified conclusion.'],
  ['insufficient_data', 'Recent or baseline evidence is not adequate for comparison.', 'Proceed from self-report and retry after future data arrives.'],
];

const RECALIBRATION_ROWS = [
  ['Source awareness', 'Body, mind, school, or something else, followed by bounded context choices.'],
  ['Signal routing', 'Pro can receive cautious recovery context. Junior biometrics remain silent and affect routing only.'],
  ['Symptom check', 'Ask about unusual weakness, dizziness, breathing difficulty, chest discomfort, near-fainting, illness, or needing help when recovery evidence or answers warrant it.'],
  ['Support branch', 'Urgent or concerning symptoms route toward a trusted adult and away from a performance judgment.'],
  ['Internal reset', 'Use a steady visual point, three easy breaths, and an awareness frame: Name it, Stop fighting it, Get curious, or Keep perspective.'],
  ['Closeout', 'Record what the athlete practiced. Never ask whether three breaths instantly removed fatigue.'],
];

const COHERENCE_ROWS = [
  ['Consistency', 'Days the athlete showed up through a check-in or mental-training activity.', 'Observed days in the rolling window.'],
  ['Follow-through', 'Eligible assigned work completed.', 'Completed assignments divided by eligible assignments, capped at three assignments per day.'],
  ['Feeling Good', 'Days reported as Solid or Locked In.', 'Evening supersedes morning for the same day when both are available.'],
  ['Overall Coherence', 'Average of available controllable metrics.', 'Requires at least three observed days and at least two available component metrics.'],
];

const DATA_ROWS = [
  ['pulsecheck-morning-checkins/{uid}_{day}', 'Morning answer, reason, revisions, nested evening check-in, recalibration outcome, and signal-validation summary.'],
  ['athlete-state-signal-alignments/{uid}/records/{day}_morning_sleep', 'Day-level self-report/device alignment evidence.'],
  ['athlete-state-signal-alignments/{uid}', 'Longitudinal alignment counts and pattern summary.'],
  ['users/{uid}/biomarkerContext/{day}', 'Day-level biomarker context projection used by downstream reasoning.'],
  ['junior-progress/{uid}', 'Daily lesson progress and three-of-three ceremony acknowledgement state.'],
  ['mental-exercise-completions', 'Exercise completion evidence used by follow-through and training history.'],
];

const SAFETY_RULES = [
  'Self-report leads. A wearable can add context but cannot tell the athlete that their feeling is wrong.',
  'Junior athletes do not receive raw biometric grades, “good/bad” vital labels, or device-based permission to ignore symptoms.',
  'Unusual signals trigger more context and symptom questions, not diagnosis.',
  'Urgent symptoms move the experience toward trusted-adult or emergency support according to the safety policy.',
  'Missing device data is not a zero score and does not reduce coherence.',
  'All day boundaries use the athlete’s local day so undo, evening precedence, and ceremony flags reset predictably.',
];

export default function PulseCheckAthleteDailyStateLoopTab() {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="PulseCheck Runtime"
        title="Athlete Daily State Loop"
        version="v1.0 | July 2026"
        summary="The daily-state system joins morning and evening self-report, assigned mental training, optional Energy Recalibration, silent device alignment, controllable progress metrics, and safety-aware follow-up into one athlete-local day."
        highlights={[
          {
            title: 'Awareness Works Anywhere',
            body: 'The loop is designed for morning, evening, school, home, travel, or training. Copy does not assume the athlete is currently in a game or practice.',
          },
          {
            title: 'The Athlete Can Revise Today',
            body: 'Morning and evening answers remain changeable during the same athlete-local day, with revisions preserved instead of creating duplicate daily truths.',
          },
          {
            title: 'Patterns, Not Verdicts',
            body: 'Self-report and device evidence build longitudinal pattern memory. One day never becomes a diagnosis or a judgment.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Cross-surface runtime contract for Today, junior check-ins, Energy Recalibration, profile progress, and silent signal-alignment memory."
        sourceOfTruth="The daily check-in document is the same-day interaction record. Alignment records preserve comparison evidence. Athlete Coherence is the athlete-facing progress projection built from controllable behavior and authored feeling."
        masterReference="Use this document when changing check-in timing, same-day undo, drained-state follow-up, wearable validation, junior biometric framing, or profile progress metrics."
        relatedDocs={[
          'Junior Track Guided Curriculum',
          'Athlete Data Framing Doctrine',
          'Health Context Pipeline',
          'Profile Architecture',
          'State Signal Layer',
        ]}
      />

      <SectionBlock icon={CalendarClock} title="One Athlete-Local Day">
        <StepRail steps={LOOP_STEPS} />
        <DataTable columns={['Moment', 'Prompt Job', 'Signal Captured', 'Revision Rule']} rows={CHECKIN_ROWS} />
      </SectionBlock>

      <SectionBlock icon={RefreshCcw} title="Same-Day Revision Contract">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Replace The Current Answer"
            accent="blue"
            body="Undo returns the check-in card to its bounded choices. Saving again updates the same daily record, increments revision metadata, and recomputes dependent context."
          />
          <InfoCard
            title="Preserve Daily Identity"
            accent="green"
            body="A changed answer is not a second check-in day. Daily metrics, downstream alignment, and UI state must read the latest authored answer while retaining revision history for audit."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Sparkles} title="Energy Recalibration">
        <DataTable columns={['Stage', 'Runtime Behavior']} rows={RECALIBRATION_ROWS} />
        <InfoCard
          title="Teaching Goal"
          accent="purple"
          body="Three breaths are a first act of recalibration. The closeout teaches the athlete to notice what is present and choose a useful inner response; it does not claim the athlete should no longer feel drained."
        />
      </SectionBlock>

      <SectionBlock icon={Activity} title="Silent Device Alignment And Pattern Memory">
        <DataTable columns={['Classification', 'Meaning', 'System Response']} rows={ALIGNMENT_ROWS} />
        <BulletList
          items={[
            'Positive sleep reports include Solid or Locked In with Good sleep.',
            'Negative sleep reports include Drained or Off with Sleep selected as a contributor.',
            'The comparison uses the freshest usable recovery snapshot from today or the recent overnight window plus a personal sleep baseline.',
            'Flat production Fitbit fields and canonical nested domain fields are normalized into the same comparison input.',
            'The athlete does not need to see the validation result for the pattern record to become useful later.',
          ]}
        />
      </SectionBlock>

      <SectionBlock icon={HeartHandshake} title="Athlete Coherence Metrics">
        <DataTable columns={['Metric', 'What It Rewards', 'Computation Rule']} rows={COHERENCE_ROWS} />
        <InfoCard
          title="Why These Are Primary"
          accent="green"
          body="Consistency, follow-through, and honest feeling reports are understandable and directly influenceable. Simulation pillar scores can remain internal evidence or module-level feedback, but they are not the primary grade placed on the athlete."
        />
      </SectionBlock>

      <SectionBlock icon={Database} title="Persistence Contract">
        <DataTable columns={['Record', 'Responsibility']} rows={DATA_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Safety And Framing Rules">
        <InfoCard title="Non-Negotiable Rules" accent="red" body={<BulletList items={SAFETY_RULES} />} />
      </SectionBlock>
    </div>
  );
}
