import React from 'react';
import { AlertTriangle, BookOpen, Building2, ClipboardCheck, GraduationCap, Users } from 'lucide-react';
import { BulletList, DataTable, DocHeader, InfoCard, SectionBlock } from './PulseCheckRuntimeDocPrimitives';

type Course = {
  name: string;
  price: string;
  format: string;
  modules: string[];
};

type TrainingTrack = {
  audience: string;
  flagship: Course;
  selfPaced: Course;
};

const PRICING_ROWS: Array<Array<React.ReactNode>> = [
  ['Parent', '$10', '$199 · 2 live sessions + guide', '$79 · self-paced + scenarios'],
  ['Coach', '$10', '$399 · live workshop + cert', '$199 · scenario session'],
  ['Athletic Trainer', '$10', '$399 · live lab + cert*', '$149 · self-paced + scenarios'],
];

const ASSESSMENTS = [
  {
    title: 'Parent — Supporting Your Child Through Sport',
    body: '8 scenarios across stress, communication, identity, warning signs, role boundaries, and safety. Layperson voice ("your child"), growth-framed results.',
    accent: 'green' as const,
  },
  {
    title: 'Coach — Coaching the Mental Game',
    body: '10 scenarios. Coach English (no science-speak). Adds load/readiness + reinforcing the curriculum; keeps team-culture, lane, and escalation.',
    accent: 'blue' as const,
  },
  {
    title: 'Athletic Trainer — Performance Neuroscience Readiness',
    body: '9 scenarios. Clinical register kept. Reframed from "are you a competent AT" to extending clinical expertise into performance neuroscience + mental performance.',
    accent: 'purple' as const,
  },
];

const TRAINING: TrainingTrack[] = [
  {
    audience: 'Parent',
    flagship: {
      name: 'Parent Foundations: The Athlete Brain Under Pressure',
      price: '$199',
      format: '2 live sessions + take-home guide',
      modules: [
        'Session 1 — The athlete brain under pressure: how stress changes performance; separating worth from the scoreboard.',
        'Session 2 — Showing up right: communication that keeps the door open; staying the supporter, not the coach; easing pressure at home.',
        'Take-home guide: what to say / not say, a home-pressure audit, and a "your role vs. the coach\'s" map.',
      ],
    },
    selfPaced: {
      name: 'Recognizing the Signs Before a Crisis',
      price: '$79',
      format: 'self-paced + scenario lab',
      modules: [
        'The signs: eating, sleep, mood, and withdrawal changes that repeat over time.',
        'Watch-and-wait vs. get-help: where the line is and who to call first.',
        'The emergency playbook: the exact steps to have before you need them.',
        'Coming back: supporting a return without making it a test.',
      ],
    },
  },
  {
    audience: 'Coach',
    flagship: {
      name: 'Coaching the Nervous System',
      price: '$399',
      format: '3 live sessions + team language guide → certificate',
      modules: [
        'Session 1 — Nervous system under pressure: arousal/recovery in practice design; reading readiness data.',
        'Session 2 — Building the mental game: confidence/focus as coachable; reinforcing the athlete\'s routine; feedback that builds.',
        'Session 3 — Climate, signs & safety: team contagion, the parent conversation, escalation. Certificate + check.',
        'Team language guide: cue cards, the reset script, and a "your lane" map for staff.',
      ],
    },
    selfPaced: {
      name: 'Coaching the Mind in Practice',
      price: '$199',
      format: 'scenario-based session',
      modules: [
        'Applied reps: reinforcing skills mid-practice, reading the warning signs, the furious-parent boundary, and when to escalate.',
      ],
    },
  },
  {
    audience: 'Athletic Trainer',
    flagship: {
      name: 'Performance Neuroscience for Sports Medicine',
      price: '$399',
      format: 'live applied-neuroscience lab (3 modules) → certificate (CEU once accredited)',
      modules: [
        'Module 1 — Performance neuroscience: arousal regulation, stress-recovery, autonomic balance; HRV/sleep/load as mental-readiness signals.',
        'Module 2 — Mind-body: fear of reinjury, pain-mood loops, return-to-play confidence; reinforcing the curriculum at treatment touchpoints.',
        'Module 3 — Triage, scope & safety: performance vs. clinical triage, scope/collaboration, crisis escalation, documentation.',
      ],
    },
    selfPaced: {
      name: 'Reinforcing the Mental-Performance Curriculum',
      price: '$149',
      format: 'self-paced module + scenario lab',
      modules: [
        'How daily AT touchpoints reinforce (not undercut) the curriculum; triage scenarios; clean handoffs and minimum-necessary documentation.',
      ],
    },
  },
];

function CourseCard({ course, tier }: { course: Course; tier: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{tier}</p>
          <p className="mt-1 text-sm font-semibold text-white">{course.name}</p>
          <p className="mt-1 text-xs text-zinc-500">{course.format}</p>
        </div>
        <span className="rounded-lg bg-purple-500/15 px-2.5 py-1 text-sm font-semibold text-purple-300">{course.price}</span>
      </div>
      <div className="mt-3">
        <BulletList items={course.modules} />
      </div>
    </div>
  );
}

export default function PulseEducationOfferingsTab() {
  return (
    <div className="space-y-8">
      <DocHeader
        eyebrow="Pulse Education"
        title="Readiness Assessments & Training"
        version="v1 · 2026-06"
        summary="Build spec for the Pulse Intelligence Labs education funnel: a paid $10 readiness assessment for parents, coaches, and athletic trainers that doubles as a trailer into audience-matched paid training. The assessment measures readiness; the results teach; the training converts."
        highlights={[
          { title: 'Assessment as trailer', body: 'Each assessment is dual-purpose: it scores readiness AND introduces the value of the paid education it routes into.' },
          { title: '$10 tripwire', body: 'The assessment is priced to qualify buyers and offset acquisition cost, not to make revenue. Its job is conversion.' },
          { title: 'Audience-matched voice', body: 'Parent = plain/warm; Coach = coach English; Athletic Trainer = clinical, reframed toward performance neuroscience.' },
        ]}
      />

      <SectionBlock icon={GraduationCap} title="The model">
        <BulletList
          items={[
            'A paid $10 assessment qualifies the buyer and breaks the first-transaction barrier, then routes them into audience-matched education by weakest domain.',
            'Test-vs-teach gating: answer rationales are hidden during the assessment (so it measures) and revealed in the results review (so it teaches).',
            'A safety backbone (warning signs → escalation) runs through all three audiences — the universal "this is not optional" layer.',
            'B2B site-licensing (a club/school/team enrolling all its parents, coaches, and ATs) is the bigger revenue lever than individual sales.',
          ]}
        />
      </SectionBlock>

      <SectionBlock icon={ClipboardCheck} title="Pricing">
        <DataTable
          columns={['Audience', 'Assessment', 'Flagship (live)', 'Self-paced']}
          rows={PRICING_ROWS}
        />
        <InfoCard
          accent="amber"
          title="* Athletic Trainer tier is gated on CEU/BOC accreditation"
          body="Do not advertise CEU credit until accredited. The $399 AT certificate is anchored to NATA's Secondary School Mental Health Microcredential ($175 member / $500 non-member, 10 CEUs + BOC badge) — it must stay at or below that, and accreditation is the unlock for charging it."
        />
        <InfoCard
          accent="blue"
          title="Why these numbers"
          body="Parents are price-sensitive (market is $15–120); coaches have a free anchor (NFHS mental-wellness, often required) so the paid tier must look visibly deeper; ATs anchor to NATA. Format rule: $200–400 only holds as a live cohort/certification — self-paced caps at ~$50–200."
        />
      </SectionBlock>

      <SectionBlock icon={Users} title="The three assessments">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          {ASSESSMENTS.map((assessment) => (
            <InfoCard key={assessment.title} title={assessment.title} body={assessment.body} accent={assessment.accent} />
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          Source surface: <code className="rounded bg-black/30 px-1.5 py-0.5 text-[11px] text-zinc-300">src/pages/elite-athlete-support-readiness-assessments.tsx</code>
        </p>
      </SectionBlock>

      <SectionBlock icon={BookOpen} title="Training outlines">
        <div className="space-y-5">
          {TRAINING.map((track) => (
            <div key={track.audience} className="space-y-3">
              <p className="text-sm font-semibold text-white">{track.audience}</p>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                <CourseCard course={track.flagship} tier="Flagship (live)" />
                <CourseCard course={track.selfPaced} tier="Self-paced" />
              </div>
            </div>
          ))}
        </div>
      </SectionBlock>

      <SectionBlock icon={Building2} title="Go-to-market">
        <InfoCard
          accent="green"
          title="B2B site-license is the primary revenue path"
          body="A club/school/team paying roughly $250–2,500 per season to enroll its whole support system (parents + coaches + ATs) out-earns one-off consumer sales and is a warmer sell to an athletic department than to an individual. The 'Partner access' nav is the seed of this motion."
        />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Open items">
        <BulletList
          items={[
            'Confirm self-paced second-track prices ($79 / $199 / $149) before launch.',
            'Pursue CEU/BOC accreditation for the Athletic Trainer track to unlock its price.',
            'Decide whether the $10 is credited toward a course (recommended) and whether to gate the full report behind it.',
            'Build the B2B site-license offer and pricing.',
          ]}
        />
      </SectionBlock>
    </div>
  );
}
