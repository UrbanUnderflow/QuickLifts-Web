import React from 'react';
import { BookOpenCheck, Database, Flag, GraduationCap, MessageCircleHeart, Route, ShieldCheck, Sunrise } from 'lucide-react';
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

export default function PulseCheckJuniorTrackCurriculumSpecTab() {
  return (
    <div className="space-y-8">
      <DocHeader
        eyebrow="PulseCheck Youth Pathways"
        title="Junior Track Guided Curriculum"
        version="v1.0 - Phases 1 + 2 implemented 2026-07-12"
        summary="The Junior Track home is a Duolingo-style guided curriculum: one daily Today Card, three skill pillars with visible unit progress, a streak, Nora-guided lessons through existing exercise engines, unit checkpoints with a continue-or-switch prompt, and a morning check-in that writes the same mental-state signal as the pro track. Source spec: PulseCheck repo, docs/specs/junior-track-guided-curriculum-spec.md."
        highlights={[
          {
            title: 'Home screen IS the curriculum',
            body: 'The Today Card names the actual next lesson with pillar, duration, and position. Pillar cards show real unit progress dots. No mystery buttons, no fake branches.',
          },
          {
            title: 'Nora guides, never free-chats',
            body: 'Lessons open real Nora conversations through the Phase D orchestrator with scripted openers and probes. Replies flow through the guardrailed nora-athlete-reply path. Direct chat stays closed on youth tracks.',
          },
          {
            title: 'One signal pipe across tracks',
            body: 'The junior morning check-in writes the identical pulsecheck-morning-checkins doc the pro check-in writes, so the curriculum engine, coach reports, and framing layer read junior mental state with zero new plumbing.',
          },
        ]}
      />

      <SectionBlock icon={Route} title="Curriculum Shape">
        <CardGrid>
          <InfoCard
            title="Three pillars"
            accent="green"
            body="Champion Mindset, Mental Performance, Emotional Regulation. Linear within a pillar; the athlete chooses pillars at unit boundaries only (checkpoint prompt), never mid-unit."
          />
          <InfoCard
            title="Units and lessons"
            accent="blue"
            body="2 units per pillar, 4 teaching lessons per unit plus a Nora-guided checkpoint. 24 lessons + 6 checkpoints shipped (roughly 6 weeks of daily use). Lessons are a fixed three-beat ritual: Nora opens, athlete practices via an existing MentalExercise engine, Nora closes with a takeaway cue."
          />
          <InfoCard
            title="Checkpoints"
            accent="amber"
            body="No exercise beat. Unit recap of takeaway cues, a reflection probe answered through the guardrailed reply path, then the continue-or-switch skill picker. Completion mints the unit-complete moment."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Database} title="Data Model">
        <DataTable
          columns={['Store', 'Role', 'Notes']}
          rows={[
            [
              <code key="jc">junior-curriculum/{'{lessonId}'}</code>,
              'Content source of truth',
              'Seeded from scripts/data/junior-curriculum.json (mirrors the iOS bundled seed in PulseCheck/Models/JuniorCurriculum.swift; keep in sync). Read by iOS and by junior-lesson-conversation.',
            ],
            [
              <code key="jp">junior-progress/{'{userId}'}</code>,
              'Per-athlete position',
              'activePillarId, completedLessonIds, lastCompletedDate, todayPillarIds. Per-pillar position is derived from completedLessonIds so the doc cannot drift. Daily goal: one module under EVERY pillar closes the day (todayPillarIds tracks per-day pillar credit; the Today Card cycles pillars with a "2 of 3 today" indicator). Streak stays activity-based.',
            ],
            [
              <code key="st">mental-training-streaks/{'{uid}'}</code>,
              'Streak (reused)',
              'Junior lessons update the shared streak through MentalTrainingService, so history survives a later move to Pro.',
            ],
            [
              <code key="cm">mental-exercise-completions</code>,
              'Completions (reused)',
              'Exercise players record completions as usual; coach reporting sees junior activity for free.',
            ],
            [
              <code key="mc">pulsecheck-morning-checkins/{'{uid}'}_{'{date}'}</code>,
              'Morning check-in (shared)',
              'Same doc and endpoint as pro. Junior card sends junior-voiced opener/probe overrides because server defaults reference the pro two-step slate.',
            ],
          ]}
        />
      </SectionBlock>

      <SectionBlock icon={MessageCircleHeart} title="Nora Integration">
        <BulletList
          items={[
            "Triggers junior-lesson-open, junior-lesson-close (reserved), and junior-unit-checkpoint are registered in CONVERSATION_TRIGGERS and in SYNTHESIZED_CONVERSATION_TRIGGERS (branches are synthesized from the seeded lesson doc, never accepted from the client, so a junior surface can't put words in Nora's mouth).",
            "NO FREE TEXT on junior surfaces: every athlete reply (check-in, lesson probe, checkpoint reflection) is a tap on an app-authored multiple-choice option (probeChoices on the lesson doc). Bounded vocabulary prevents unmonitored crisis disclosures until a crisis-detection pathway exists.",
            'netlify/functions/junior-lesson-conversation.ts opens the conversation: verifies the athlete, enforces the junior/rookie team-track guard via commercialConfig.youthTrack, loads scripts from junior-curriculum, primes the probe to awaiting-reply, and dedupes per athlete per lesson per local day.',
            'The lesson-close beat is the action-delivery turn of the same conversation (the orchestrator state machine already provides it), which is why junior-lesson-close stays reserved.',
            'iOS degrades gracefully: if the function or seed is unavailable, lessons run fully scripted from the bundled seed with no conversation, never blocking training.',
          ]}
        />
      </SectionBlock>

      <SectionBlock icon={Sunrise} title="Morning Check-In and the Biometrics Decision">
        <CardGrid columns="xl:grid-cols-2">
          <InfoCard
            title="Check-in on every track"
            accent="green"
            body="JuniorCheckInCard shows the same five readiness levels as pro, posts record-morning-checkin with junior-voiced overrides, renders Nora's response inline with an optional guardrailed reply, and restores same-day state from Firestore. No Nora inbox deep-link (juniors have no inbox)."
          />
          <InfoCard
            title="No devices/biometrics card"
            accent="red"
            body={
              <>
                <InlineTag label="deliberate" color="red" /> Junior athletes never see readiness percentages or biomarker numbers, the strictest form of the Athlete Surface Doctrine. Wearables still sync in the background for coach visibility. See the Athlete Data Framing Doctrine section for the all-tracks policy.
              </>
            }
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={GraduationCap} title="iOS Surfaces (PulseCheck repo)">
        <DataTable
          columns={['Surface', 'File', 'Notes']}
          rows={[
            ['Junior Home v2', <code key="h">Views/Junior/JuniorHomeView.swift</code>, 'Streak chip, check-in card, Today Card, pillar cards with progress dots, pillar detail sheet with per-pillar CTA, skill picker.'],
            ['Lesson Player', <code key="p">Views/Junior/JuniorLessonPlayerView.swift</code>, 'Three-beat container; checkpoint review path; excludes chat-handoff exercises via exerciseRequiresNoraChatHandoff.'],
            ['Lesson Complete', <code key="c">Views/Junior/JuniorLessonCompleteView.swift</code>, 'Streak moment, unit dots, takeaway card, checkpoint continue-or-switch buttons.'],
            ['Check-in card', <code key="ci">Views/Junior/JuniorCheckInCard.swift</code>, 'Shared signal pipe with junior voice.'],
            ['Services', <code key="s">Services/JuniorCurriculumService.swift, JuniorNoraLessonService.swift</code>, 'Curriculum + progress state hub; conversation open/reply bridge.'],
            ['Screen demos', <code key="d">Views/Admin/ScreenDemoView.swift</code>, 'juniorHome, juniorLessonPlayer, juniorCheckpoint, juniorLessonComplete rows (PIL convention).'],
          ]}
        />
      </SectionBlock>

      <SectionBlock icon={BookOpenCheck} title="Seeding and Operations">
        <StepRail
          steps={[
            {
              title: 'Author content in one place',
              body: 'scripts/data/junior-curriculum.json in QuickLifts-Web is canonical and mirrors the iOS bundled seed. Copy rules: no "rep(s)" in athlete copy, grade 4-5 reading level, every subtitle promise appears in the bullets.',
              owner: 'Content',
            },
            {
              title: 'Seed from /admin/juniorCurriculum',
              body: 'Admin-gated page previews all 30 docs grouped by pillar/unit with per-doc seeded status, validates (including the rep-ban), and batch-writes idempotently using the CLIENT Firebase SDK with the signed-in admin account — no server credentials, works on localhost, follows the global prod/dev database selector. Writes are gated by firestore.rules (junior-curriculum is admin-write-only; junior-progress is own-document). CLI fallback: scripts/seedJuniorCurriculum.cjs.',
              owner: 'Ops',
            },
            {
              title: 'Map every lesson to a real module (launch gate)',
              body: 'Each lesson row on /admin/juniorCurriculum shows its module status (mapped, missing, chat-handoff, other-category) with a dropdown of junior-safe exercises. There is NO playback fallback: iOS refuses to play unmapped or handoff-mapped lessons. The page header shows "all modules mapped" or the blocked count. Re-seeding preserves manual mappings.',
              owner: 'Content + Ops',
            },
            {
              title: 'Verify the conversation path',
              body: 'junior-lesson-conversation 404s unseeded lessons by design; iOS then runs scripted mode for the conversation beats only. Unit tests: tests/unit/junior-lesson-conversation.test.ts.',
              owner: 'Eng',
            },
          ]}
        />
      </SectionBlock>

      <SectionBlock icon={BookOpenCheck} title="Module Interactivity Rebuild (2026-07-13)">
        <DataTable
          columns={['Mechanic', 'Modules', 'How it trains']}
          rows={[
            ['choiceDrill', 'Adversity Response, both Reframes, Process Over Outcome, Growth Mindset', 'Scenario, bounded choices, coaching feedback per pick, optional timed decision window for automaticity.'],
            ['guidedDwell', 'Highlight Reel, Competition Walkthrough, Evidence Journal, Confidence Inventory, Affirmations', 'Pick N chips, then a paced timed dwell on each pick, then a close line.'],
            ['lockedReplay', 'Perfect Execution Replay', 'Scene setup, then N timed mental run-throughs with a "Lock It In" tap at the key moment.'],
          ]}
        />
        <BulletList
          items={[
            'Why: 11 of 26 modules played as passive read-and-tap-Next step lists; 5 junior lessons ran on the 3 passive visualization modules. The interaction config on the module doc replaces that renderer on iOS (InteractiveModuleContent.swift) and Android (JuniorInteractivePlayer).',
            'Every input is a bounded chip, extending the junior no-free-text rule across the pro track for these modules. Modules with an interaction config never route to the Nora chat handoff: the drill is the training.',
            'Rollout: click "Sync Module Copy" on /admin/juniorCurriculum (writes interaction to both sim-modules and mental-exercises), then regenerate narrations on /admin/ai-voice (interaction prompts and feedback lines are pre-generated; retired per-step clips drop out of coverage automatically).',
            'Known gap: the web /mental-training player still renders these modules as prompt steps.',
          ]}
        />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Open Safety Items">
        <BulletList
          items={[
            'Crisis detection is NOT wired into the Nora reply pipeline (recordTier3Escalation has no callers). Junior replies, including checkpoint reflections about feelings, now enter that pipeline. Decide alongside consent work whether a crisis-detection pass gates broad rollout.',
            'Age gating / parental consent does not exist; team-level provisioning (commercialConfig.youthTrack) currently stands in for it. Parked deliberately, tracked in the source spec open questions.',
            'Below-neutral junior check-ins get the same inline treatment as everything else today; pro escalates below-neutral into a focused chat. Candidate follow-up: coach notification for junior drained/off patterns.',
            'Android parity (2026-07-13): full junior surface shipped in android/ (PulseCheckJuniorClient + JuniorTrackScreens; REST pattern, remote-only curriculum, bounded choices, three-pillar daily goal). Gap: the four sim engine games are not ported — the five sim-mapped lessons show an honest "not on Android yet" state; porting the engines is the next Android milestone.',
          ]}
        />
      </SectionBlock>
    </div>
  );
}
