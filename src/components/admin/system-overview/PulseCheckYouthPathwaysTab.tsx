import React from 'react';
import { BookOpenCheck, GraduationCap, Home, LockKeyhole, Route, ShieldCheck } from 'lucide-react';
import {
  BulletList,
  CardGrid,
  DataTable,
  DocHeader,
  InfoCard,
  InlineTag,
  SectionBlock,
  StepRail,
} from './PulseCheckRuntimeDocPrimitives';

export default function PulseCheckYouthPathwaysTab() {
  return (
    <div className="space-y-8">
      <DocHeader
        eyebrow="PulseCheck Youth Pathways"
        title="Junior, Rookie, and Home Team System Overview"
        version="v0.1 - provisional build contract"
        summary="Youth Pathways convert PulseCheck from an open-ended Nora chat product into a guided mental-readiness learning path. Junior is the default B2C posture; Pro is an explicit governed/institutional configuration for deployments that can support direct Nora chat, escalation, compliance, and human-support workflows."
        highlights={[
          {
            title: 'Junior by default',
            body: 'Missing, unknown, or consumer-side youthTrack values land in Junior so the product stays guided and direct Nora chat remains closed.',
          },
          {
            title: 'Junior/Rookie remove chat',
            body: 'Youth tracks use Nora as a scripted guide inside lessons and check-ins, not as an open conversational surface.',
          },
          {
            title: 'Pro is explicit',
            body: 'Commercial config youthTrack=pro means the current Nora inbox and direct chat surfaces are available for governed partners.',
          },
        ]}
      />

      <SectionBlock icon={Route} title="Track Routing">
        <CardGrid>
          <InfoCard
            title="Junior"
            accent="green"
            body={
              <>
                <InlineTag label="default" color="green" /> B2C pathway with guided mental readiness lessons, structured reflections, skill practice, and no open-ended Nora chat.
              </>
            }
          />
          <InfoCard
            title="Rookie"
            accent="amber"
            body={
              <>
                <InlineTag label="youth-first" color="amber" /> Younger-athlete pathway with parent co-account expectations, lighter copy, shorter sessions, and stronger guardian consent requirements.
              </>
            }
          />
          <InfoCard
            title="Pro"
            accent="blue"
            body={
              <>
                <InlineTag label="governed" color="blue" /> Institutional experience with Today, direct Nora chat, Nora inbox, mental training, profile, and existing escalation behavior.
              </>
            }
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={BookOpenCheck} title="Guided Learning Model">
        <StepRail
          steps={[
            {
              title: 'Daily readiness check-in',
              body: 'Athlete chooses from bounded emotional, energy, focus, and confidence prompts. Nora reflects in scripted language and routes the athlete into the next lesson or regulation rep.',
              owner: 'Athlete app',
            },
            {
              title: 'Champion mindset lesson',
              body: 'Short teach-and-practice cards build identity, confidence, attention, recovery, leadership, and self-talk skills using age-matched language.',
              owner: 'Curriculum',
            },
            {
              title: 'Mental performance rep',
              body: 'Breathing, visualization, reset, focus, and reflection exercises are scored on completion and learning progress, never on readiness risk.',
              owner: 'Training runtime',
            },
            {
              title: 'Home Team digest',
              body: 'Parents receive weekly patterns, coaching tips, and support education without access to free-form athlete messages or private transcript content.',
              owner: 'Parent layer',
            },
          ]}
        />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Safety And Privacy Contract">
        <DataTable
          columns={['Area', 'Junior/Rookie rule', 'Implementation note']}
          rows={[
            ['Open Nora chat', 'Removed', 'Replace the Today chat surface with guided home, hide Nora inbox, and suppress deep links into chat.'],
            ['Nora role', 'Scripted guide', 'Nora can narrate lessons, reflect bounded answers, and deliver safety-approved education.'],
            ['Gamification', 'Training reps only', 'Streaks, XP, badges, and levels attach to lesson/practice completion rather than readiness scores.'],
            ['Parent visibility', 'Patterns, not transcripts', 'Home Team sees themes and education, not raw check-in answers or Nora conversation logs.'],
            ['Under 13', 'Parent co-account required', 'Rookie requires verifiable parental consent before release readiness.'],
            ['Escalation', 'Legal review before ship', 'Minor escalation copy, routing, and guardian notification rules remain launch-gated.'],
          ]}
        />
      </SectionBlock>

      <SectionBlock icon={GraduationCap} title="Track Curriculum">
        <CardGrid>
          <InfoCard
            title="Champion Mindset"
            body={<BulletList items={['Confidence after mistakes', 'Effort identity', 'Self-talk scripts', 'Leadership and team habits']} />}
          />
          <InfoCard
            title="Mental Performance Skills"
            body={<BulletList items={['Focus reset', 'Pressure routines', 'Visualization', 'Pre-game and post-game reflection']} />}
          />
          <InfoCard
            title="Emotional Regulation"
            body={<BulletList items={['Name the feeling', 'Breathing reps', 'Body signals', 'Ask-for-support pathways']} />}
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Home} title="Home Team Layer">
        <InfoCard
          title="Parent and guardian product boundary"
          accent="green"
          body="Home Team is not a surveillance dashboard. It should teach parents what their athlete is practicing, surface week-over-week themes, and suggest supportive language while keeping the athlete's private reflections protected."
        />
      </SectionBlock>

      <SectionBlock icon={LockKeyhole} title="Current Implementation Hook">
        <InfoCard
          title="Provisioning source of truth"
          accent="blue"
          body="Team Commercial Config now carries commercialConfig.youthTrack. Web, iOS, and Android treat missing or invalid values as Junior. Operators must explicitly choose Pro for governed school, institution, or AuntEDNA-supported deployments that can carry the direct-chat and escalation posture."
        />
      </SectionBlock>
    </div>
  );
}
