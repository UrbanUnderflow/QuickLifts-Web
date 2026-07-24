import React from 'react';
import { Activity, BookOpenCheck, Database, GraduationCap, MessageCircleHeart, Moon, PartyPopper, RefreshCcw, Route, ShieldCheck, Sunrise } from 'lucide-react';
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
        version="v1.2 - Daily state loop + ceremony | July 2026"
        summary="The Junior Track home is a guided daily curriculum with three mental-training lessons, visible pillar progress, bounded Nora guidance, morning and evening check-ins, same-day answer changes, Energy Recalibration, first-encounter teaching moments, and a persistent three-of-three completion ceremony."
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
            title: 'One daily signal record',
            body: 'Morning and evening check-ins share the same athlete-local daily record. Junior biometrics stay silent while authored feeling, training, and pattern evidence remain available to the broader system.',
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
              'activePillarId, completedLessonIds, lastCompletedDate, todayPillarIds, and lastDayCompletionCeremonySeenDate. Per-pillar position is derived from completedLessonIds so the doc cannot drift. One module under every pillar closes the day.',
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
              'Daily check-in record (shared)',
              'Stores the morning answer and reason, revision metadata, nested evening check-in, optional Energy Recalibration outcome, and signal-validation summary.',
            ],
            [
              <code key="align">athlete-state-signal-alignments/{'{uid}'}</code>,
              'Silent pattern memory',
              'Stores per-day self-report/device alignment evidence and aggregate pattern counts. It never grades the junior or replaces the authored feeling.',
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
            body="JuniorCheckInCard asks how the athlete woke up feeling, captures a bounded reason, writes the shared daily record, and restores same-day state from Firestore. It does not assume the athlete is already at practice or in competition."
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

      <SectionBlock icon={Moon} title="Evening Check-In">
        <CardGrid columns="xl:grid-cols-2">
          <InfoCard
            title="Look Back On The Day"
            accent="blue"
            body="The evening card asks how the day went using bounded junior-friendly choices. It is a retrospective signal, not a second morning-readiness score."
          />
          <InfoCard
            title="Training Fits Either Moment"
            accent="green"
            body="The athlete may complete assigned mental training after the morning or evening check-in. Check-in timing does not imply that training must happen at a game, practice, or any specific location."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={RefreshCcw} title="Same-Day Undo And Revision">
        <BulletList
          items={[
            'A counterclockwise change control returns the current morning or evening answer to its bounded choices.',
            'The replacement updates the same athlete-local daily record and increments revision metadata instead of creating a duplicate check-in.',
            'Dependent summaries and signal-alignment evidence use the latest authored answer while preserving enough metadata to audit the change.',
            'The ability to change an answer ends when the athlete-local day resets.',
          ]}
        />
      </SectionBlock>

      <SectionBlock icon={Activity} title="Energy Recalibration">
        <DataTable
          columns={['Stage', 'Junior Behavior']}
          rows={[
            ['Notice the source', 'Ask whether the drained feeling is connected to body, mind, school, or something else.'],
            ['Route silently', 'Available recovery evidence may change the questions, but no raw biometric score or good/bad vital judgment is shown.'],
            ['Check symptoms when needed', 'Use bounded questions for unusual weakness, dizziness, breathing difficulty, chest discomfort, near-fainting, illness, or needing help.'],
            ['Escalate support', 'Concerning symptoms move toward a trusted adult and away from performance coaching.'],
            ['Practice recalibration', 'Use a steady visual point, three easy breaths, and one internal awareness frame.'],
            ['Close honestly', 'Record the practiced response without asking whether a few breaths instantly removed fatigue.'],
          ]}
        />
      </SectionBlock>

      <SectionBlock icon={PartyPopper} title="Three-Of-Three Completion Ceremony">
        <CardGrid columns="xl:grid-cols-2">
          <InfoCard
            title="Completion And Ceremony Are Separate"
            accent="purple"
            body="Completing all three daily pillars sets the day-complete state. The ceremony has its own acknowledgement date so a completed athlete who leaves early still receives the moment later."
          />
          <InfoCard
            title="Home Screen Retry"
            accent="green"
            body="When Home appears, it checks for three completed pillars and an unseen ceremony. The full-screen animation, sound, and haptics trigger until the athlete acknowledges the once-per-day moment."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={GraduationCap} title="iOS Surfaces (PulseCheck repo)">
        <DataTable
          columns={['Surface', 'File', 'Notes']}
          rows={[
            ['Junior Home v2', <code key="h">Views/Junior/JuniorHomeView.swift</code>, 'Morning and evening check-ins, three daily pillar cards, Energy Recalibration launch, progress, and completion-ceremony queue.'],
            ['Lesson Player', <code key="p">Views/Junior/JuniorLessonPlayerView.swift</code>, 'Three-beat container; checkpoint review path; excludes chat-handoff exercises via exerciseRequiresNoraChatHandoff.'],
            ['Lesson Complete', <code key="c">Views/Junior/JuniorLessonCompleteView.swift</code>, 'Streak moment, unit dots, takeaway card, checkpoint continue-or-switch buttons.'],
            ['Check-in card', <code key="ci">Views/Junior/JuniorCheckInCard.swift</code>, 'Morning/evening modes, bounded choices, same-day change control, and shared daily signal record.'],
            ['Energy Recalibration', <code key="er">Views/Junior/JuniorEnergyResetView.swift</code>, 'Awareness, silent recovery routing, symptom follow-up, support branch, and internal recalibration.'],
            ['Services', <code key="s">Services/JuniorCurriculumService.swift, JuniorNoraLessonService.swift</code>, 'Curriculum + progress state hub; conversation open/reply bridge.'],
            ['Screen demos', <code key="d">Views/Admin/ScreenDemoView.swift</code>, 'Junior screens, simulations, and every exercise teaching-moment family for deterministic visual QA.'],
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
              title: 'Seed from /curriculum-outline',
              body: 'Admin-gated page previews all 30 docs grouped by pillar/unit with per-doc seeded status, validates (including the rep-ban), and batch-writes idempotently using the CLIENT Firebase SDK with the signed-in admin account — no server credentials, works on localhost, follows the global prod/dev database selector. Writes are gated by firestore.rules (junior-curriculum is admin-write-only; junior-progress is own-document). CLI fallback: scripts/seedJuniorCurriculum.cjs.',
              owner: 'Ops',
            },
            {
              title: 'Map every lesson to a real module (launch gate)',
              body: 'Each lesson row on /curriculum-outline shows its module status (mapped, missing, chat-handoff, other-category) with a dropdown of junior-safe exercises. There is NO playback fallback: iOS refuses to play unmapped or handoff-mapped lessons. The page header shows "all modules mapped" or the blocked count. Re-seeding preserves manual mappings.',
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
            'Anchor Word continuity: once the athlete chooses a word, that selection is the source of truth for the remaining exercise. The next screen uses the chosen word and does not ask the athlete to choose a word or state again.',
            'Rollout: click "Sync Module Copy" on /curriculum-outline (writes interaction to both sim-modules and mental-exercises), then regenerate narrations on /admin/ai-voice (interaction prompts and feedback lines are pre-generated; retired per-step clips drop out of coverage automatically).',
            'Known gap: the web /mental-training player still renders these modules as prompt steps.',
          ]}
        />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Open Safety Items">
        <BulletList
          items={[
            'Crisis detection is NOT wired into the Nora reply pipeline (recordTier3Escalation has no callers). Junior replies, including checkpoint reflections about feelings, now enter that pipeline. Decide alongside consent work whether a crisis-detection pass gates broad rollout.',
            'Age gating / parental consent does not exist; team-level provisioning (commercialConfig.youthTrack) currently stands in for it. Parked deliberately, tracked in the source spec open questions.',
            'Junior drained/off patterns can launch bounded Energy Recalibration and symptom follow-up. Any future coach notification must preserve minimum-necessary disclosure and the athlete-data framing doctrine.',
            'Android parity (2026-07-13): full junior surface shipped in android/ (PulseCheckJuniorClient + JuniorTrackScreens; REST pattern, remote-only curriculum, bounded choices, three-pillar daily goal). Gap: the four sim engine games are not ported — the five sim-mapped lessons show an honest "not on Android yet" state; porting the engines is the next Android milestone.',
          ]}
        />
      </SectionBlock>
    </div>
  );
}
