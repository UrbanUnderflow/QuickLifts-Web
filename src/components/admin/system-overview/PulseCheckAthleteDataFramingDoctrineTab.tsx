import React from 'react';
import { Eye, Layers, MessageSquareWarning, Ruler, Scale, ShieldCheck } from 'lucide-react';
import {
  BulletList,
  CardGrid,
  DataTable,
  DocHeader,
  InfoCard,
  InlineTag,
  SectionBlock,
} from './PulseCheckRuntimeDocPrimitives';

export default function PulseCheckAthleteDataFramingDoctrineTab() {
  return (
    <div className="space-y-8">
      <DocHeader
        eyebrow="PulseCheck Data Policy"
        title="Athlete Data Framing Doctrine (All Tracks)"
        version="v1.0 draft - decided 2026-07-12"
        summary="The athlete should feel known, not measured. Raw biometrics and readiness scores live with coaches; biometrics plus the sports intelligence layer silently steer each athlete's day; data reaches the athlete only as body literacy, trajectory, and controllable next moves. This extends the Athlete Surface Doctrine (PERFORMANCE_PRIMING_MARKERS) from Nora conversations to every athlete-facing surface on every track. Source spec: PulseCheck repo, docs/specs/athlete-data-framing-doctrine-spec.md."
        highlights={[
          {
            title: 'The WHOOP veto (why)',
            body: 'College athletes told their coach they could not practice because WHOOP said they were not recovered. A population-normed consumer score outranked the athlete\'s felt sense and the coach\'s judgment. PulseCheck exists to produce the opposite outcome.',
          },
          {
            title: 'Sports intel earns the stance',
            body: 'Consumer scores cannot tell a track athlete from a golfer from a casual gym member. The sports intelligence layer contextualizes load by sport, season, and history, which is what makes number-free guidance credible instead of evasive.',
          },
          {
            title: 'One doctrine, a register dial',
            body: 'Junior and Pro get the same three layers and the same red lines. What changes is voice register (grade 4-5 versus training-literate) and raw-data access (never for juniors; deliberate non-default view for adults).',
          },
        ]}
      />

      <SectionBlock icon={Layers} title="The Three Layers">
        <DataTable
          columns={['Layer', 'Who sees it', 'What it is']}
          rows={[
            ['1. Numbers', 'Coaches and clinicians only', 'Full biometric fidelity on coach surfaces, unchanged. The teacher\'s gradebook.'],
            ['2. Steering', 'Nobody, directly', 'Biometrics + sports intel silently shape session selection, Nora\'s tone, and load-aware copy ("calm one today, on purpose"). The athlete experiences "Nora gets me," not surveillance.'],
            ['3. Teaching', 'The athlete, in language', 'Body-literacy conversations connecting what the athlete feels (check-in) to what their body did, always as trajectory plus one controllable next move, never as a score.'],
          ]}
        />
      </SectionBlock>

      <SectionBlock icon={Ruler} title="The Teacher-Lens Rules (anti-diminishment)">
        <BulletList
          items={[
            'Trajectory, never snapshots: "recharging faster than last month," never "recovery is low."',
            'Data picks strategy, never grades identity: every signal resolves to what we practice today.',
            'Self-report leads, sensor confirms: the check-in is the first witness, the biometric the second; disagreement is a curiosity-framed teaching moment that trains the athlete to outgrow the wearable.',
            'Every insight ships with one controllable action (sleep, breathing, effort choice). Controllability is the antidote to diminishment.',
            'Hard patterns get a human: persistent concerning trends prepare the coach for a conversation; the app never delivers them alone.',
          ]}
        />
      </SectionBlock>

      <SectionBlock icon={MessageSquareWarning} title="The Hierarchy Nora Actively Teaches">
        <CardGrid columns="xl:grid-cols-2">
          <InfoCard
            title="Rank order"
            accent="purple"
            body="Felt sense + coach judgment + sport context OUTRANK any consumer score. Nora encodes this everywhere: data informs how we train today, not whether we train. Load adjustments happen through the plan and the coach, never through athlete self-diagnosis off a dashboard."
          />
          <InfoCard
            title="Same message, two registers"
            accent="blue"
            body={
              <>
                <p><InlineTag label="junior" color="green" /> "Your body's still recharging. Today's training is a calm one on purpose."</p>
                <p className="mt-2"><InlineTag label="pro" color="blue" /> "Yesterday ran your load high and your recharge came up short. Today is built for skill density, not intensity, on purpose."</p>
              </>
            }
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Eye} title="Surface Rules by Track">
        <DataTable
          columns={['', 'Junior (MS/HS)', 'Pro (college+)']}
          rows={[
            ['Raw numbers', 'Never, no exceptions', 'Not on any default surface; reachable behind a deliberate "show raw data" action, presented with sport-context framing, never as a gatekeeping score'],
            ['Readiness %', 'Never exists', 'Removed from athlete surfaces entirely; readiness is a coach-side concept'],
            ['Trend talk', 'Growth stories at checkpoints only', 'Trajectory framing available on request in Nora conversations'],
            ['Device card', 'Absent', 'Connection status stays; numbers row and Ready % replaced by one sports-intel-informed narrative line through framing-layer guardrails'],
            ['Coach surfaces', 'Full fidelity, unchanged', 'Full fidelity, unchanged'],
          ]}
        />
      </SectionBlock>

      <SectionBlock icon={Scale} title="Status and Migration">
        <BulletList
          items={[
            'Junior surfaces already comply (shipped 2026-07-12 with the Junior Track guided curriculum: no device card, check-in as the athlete\'s data voice).',
            'Nora conversations already comply on all tracks (adaptive framing layer + guardrails).',
            'Pro home (NoraDailyView) device card is the migration to finish: it predates the doctrine and still shows HR/HRV/RHR numbers and a Ready % badge.',
            'Measurement: coach reports of "the app said I can\'t practice" incidents toward zero; check-in completion rates; raw-data view open rate (expect low and declining); wearable-connected athlete retention through the numbers removal.',
          ]}
        />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Open Questions (review with Bobby)">
        <BulletList
          items={[
            'Rollout: big-bang pro surface change or A/B the narrative card first?',
            'Does "show raw data" survive review at all, or does even a one-tap-deep path undermine the stance? (Doctrine works without it; recommendation is keep it for adults to avoid paternalism churn.)',
            'In-app explanation for existing pros: a Nora message explaining the philosophy may itself build trust.',
            'Sports-intel coverage: which sports have load models good enough to power the narrative line at launch, and fallback copy for the rest.',
          ]}
        />
      </SectionBlock>
    </div>
  );
}
