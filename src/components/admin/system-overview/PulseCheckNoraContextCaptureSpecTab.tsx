import React from 'react';
import {
  Calendar,
  ClipboardList,
  FileText,
  Mic,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import {
  BulletList,
  CardGrid,
  DataTable,
  DocHeader,
  InfoCard,
  RuntimeAlignmentPanel,
  SectionBlock,
} from './PulseCheckRuntimeDocPrimitives';

// ──────────────────────────────────────────────────────────────────────────────
// Nora Context Capture Spec
//
// Coach-facing input layer. Athlete enters nothing on training data; coach
// spends ~5 minutes per week on three lightweight inputs (schedule upload,
// workout-plan upload, voice memo) and Nora structures the rest. The device
// already sees what happened on the field; this layer tells us what was
// supposed to happen so the system can interpret the device data correctly.
//
// Coach-visible copy in this spec uses coach voice — not science-speak — so
// downstream implementations copy the right tone into the product.
// ──────────────────────────────────────────────────────────────────────────────

const INPUT_MODES = [
  [
    'Schedule upload',
    'PDF, .ics, Google Calendar share, photo of a whiteboard',
    'One-time, refresh whenever it changes',
    'Season calendar — practice / lift / film / travel / competition. Once this is in, every device-detected session can be matched to a scheduled event.',
  ],
  [
    'Practice plan upload',
    'PDF, picture of a whiteboard, Excel sheet, Google Doc',
    'When the plan changes (usually weekly)',
    'The week\'s prescribed training so the system can compare what was done to what was prescribed (e.g. "executed 4 of the 6 prescribed reps").',
  ],
  [
    'Voice memo',
    'Hold-to-talk in the Nora app, anywhere from 10 seconds to a couple minutes',
    'Whenever something matters — usually 1–3 a week',
    'Coach\'s ambient observations: how practice felt, who looked off, what they installed, what changed. Replaces the practice-log a coach would otherwise have to type.',
  ],
];

const COACH_BURDEN = [
  ['Athlete', 'Wears the device. Checks in with Nora once a day. That\'s it.'],
  ['Coach', '~5 minutes per week — drop the schedule once, drop a practice plan when it changes, leave the occasional voice memo on the way to the car.'],
  ['Nothing else', 'No reps logged. No counts entered. No sliders. No forms. The device sees what happened; the schedule and voice tell us what was supposed to happen.'],
];

const STRUCTURED_RECORDS = [
  ['team_schedule_event', '{ teamId, sportId, kind: practice|lift|film|travel|competition, startsAt, endsAt, location?, opponent?, source: upload|voice|calendar_sync, sourceFreshness }', 'Backbone record matching device activity to intent. One per scheduled item.'],
  ['prescribed_session', '{ teamId, sportId, sessionEventId, blocks[]: { kind, target, count, intensity, restSec, notes }, source: pdf_upload|voice|whiteboard_photo, parserConfidence }', 'The prescribed structure of a single training session. Compared against the device-detected session to flag execution gaps.'],
  ['coach_observation', '{ teamId, coachUserId, recordedAt, transcript, extracted: { athleteFlags[], topicTags[], tempoFlag?, freeText }, voiceMemoUrl?, source: voice|text }', 'Ambient coaching context from voice memos and quick notes. Tagged so the report can pull "Coach said Davis looked tired Tuesday" into the Tuesday session record.'],
  ['team_calendar_artifact', '{ teamId, sourceUrl, sourceType: pdf|ics|gcal|photo, parsedAt, eventCount, parserConfidence, raw? }', 'The original upload kept for re-parse + audit; structured events fan out into team_schedule_event.'],
];

const INTAKE_CHANNELS = [
  ['Nora app — coach surface', 'Drop file, paste link, hold-to-talk', 'Primary daily channel; everything funnels through here'],
  ['Email forward', 'coach@team-id.pulse.ai forwarder for AD-emailed schedules', 'Catches the AD\'s schedule emails without coach forwarding manually'],
  ['Calendar sync', 'Google / Outlook / iCloud OAuth one-time connect', 'Continuous schedule sync — no re-uploading'],
  ['Whiteboard photo', 'Photograph of the practice plan whiteboard', 'Vision-OCR pipeline → prescribed_session'],
  ['Pulse iOS share extension', 'Share-to-Nora from any app (PDF, photo, etc.)', 'Cuts friction for the AD-emailed PDF case'],
];

const PARSER_PIPELINE = [
  ['PDF / Doc parser', 'pdf-parse + table extraction → workout_plan_extractor LLM call → prescribed_session blocks', 'Works for typed practice plans and AD calendars'],
  ['Whiteboard / photo OCR', 'Apple Vision text recognition → workout_plan_extractor LLM call → prescribed_session blocks', 'Confidence drops one tier when source is photo; coach gets a soft confirm prompt'],
  ['Calendar sync (.ics / Google / Outlook)', 'Standard ICS/CalDAV reader → team_schedule_event', 'No LLM needed; deterministic'],
  ['Voice memo', 'Whisper transcription → coach_observation_extractor LLM call → coach_observation with tagged athletes / topics / flags', 'Athletes are matched to roster, topics are matched to the sport\'s focus list'],
];

const COACH_LANGUAGE_EXAMPLES = [
  ['When schedule context is missing for a session', '"We saw Tuesday\'s session on the device but don\'t have a practice plan for it. Drop one and we\'ll lock in a tighter read."'],
  ['When voice memo couldn\'t identify an athlete', '"Quick check — when you said \'Smith\', did you mean M. Smith or D. Smith?"'],
  ['When the upload looks low-confidence', '"Got the practice plan — does this look right? [parsed preview] You can fix anything in 10 seconds."'],
  ['When we have full context', '"This week\'s read is at full confidence — schedule, plan, and your notes are all in."'],
  ['When asking the coach to fill a one-time gap', '"We don\'t have your competition schedule yet. Drop the season calendar and you\'re set for the year — Nora will keep it fresh."'],
];

const PRIVACY_RULES = [
  ['Athlete-private content from Nora check-ins', 'Never enters team_schedule_event, prescribed_session, or coach_observation. Aggregate sentiment only — same rule as the rest of the system.'],
  ['Voice memo retention', 'Audio retained for 90 days for re-transcription if needed; transcripts retained per team data agreement. Coach can delete any voice memo at any time.'],
  ['Coach observations about athletes', 'Visible only to coaching staff with team access. Athletes do not see coach_observation transcripts. Athletes can request a redacted summary if they ask.'],
  ['Vendor / device data', 'Schedule and observation records carry sport context and athlete tags but no biometric data — biometrics live in the Health Context Source Record only.'],
];

const FAILURE_MODES = [
  [
    'Coach uploads a low-resolution photo of the whiteboard',
    'OCR confidence drops; Nora shows the parsed structure and asks "does this look right?" with a 1-tap edit. If the coach skips, the prescribed_session is stored at directional confidence and the report flags the practice as "device-derived only" without prescribed comparison.',
  ],
  [
    'Coach forgets to upload the schedule for a stretch',
    'Device sessions still get detected and classified by activity pattern (interval session vs. easy day vs. game). Confidence drops one tier. The reviewer screen shows a small nudge: "Drop the schedule and we\'ll tighten the read." No blocking.',
  ],
  [
    'Voice memo references an athlete by nickname not in the roster',
    'Nora asks the coach once: "When you said \'Wheels\', do you mean P. Whitman?" Saves the alias to roster_aliases for next time.',
  ],
  [
    'Two coaches both upload conflicting practice plans',
    'Latest upload wins, prior plan is archived. Conflict is shown on the reviewer screen so the coaching staff can resolve. Athletes see no disruption.',
  ],
  [
    'Calendar sync drifts (event moved in the AD\'s calendar)',
    'Continuous sync re-fetches; the moved event updates team_schedule_event with a sourceFreshness bump. Already-matched device activity rebinds on the next aggregation pass.',
  ],
];

const EXIT_CRITERIA = [
  'Coach can drop a season schedule (PDF, .ics, photo, or Google share) and it produces team_schedule_event records with sport context within 30 seconds.',
  'Coach can drop a weekly practice plan (PDF, photo, or doc) and it produces prescribed_session blocks the system can compare device activity against.',
  'Coach can leave a 30-second voice memo and Nora produces a coach_observation tagged to the right athletes and the right session, in coach voice — not transcribed verbatim.',
  'When schedule or plan is missing for a detected session, the reviewer surface shows a coach-voice nudge ("drop the practice plan and we\'ll tighten the read"), never a science-speak status.',
  'Athlete-private Nora content is provably never propagated into team_schedule_event, prescribed_session, or coach_observation.',
  'Coach can correct a parsed upload in one tap (the parsed preview is editable) and the correction trains future parses.',
];

const PulseCheckNoraContextCaptureSpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Sports Intelligence"
        title="Nora Context Capture"
        version="Version 0.1 | April 25, 2026"
        summary="Coach-facing input layer for the Sports Intelligence pipeline. The athlete wears the device; the coach spends ~5 minutes per week on three lightweight inputs (schedule upload, practice plan upload, voice memo). Nora structures the rest. This is the spec for what those inputs are, how they get parsed, what records they produce, and how the system communicates back to the coach in coach voice — never science-speak."
        highlights={[
          {
            title: 'Coach Burden ≈ Zero',
            body: 'No reps logged, no counts entered, no sliders, no forms. Drop the schedule once, drop a plan when it changes, leave a voice memo when something matters.',
          },
          {
            title: 'Device Sees What Happened',
            body: 'The device handles all training-data capture. Nora\'s job is only to capture intent and context — what was supposed to happen, who was where, what mattered.',
          },
          {
            title: 'Coach Voice Always',
            body: 'When the system needs more context or has uneven coverage, it asks in coach voice ("drop the practice plan and we\'ll tighten the read") — never in science-speak.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Coach-facing context-capture layer that produces structured intent records (schedule, prescribed session, coach observation) so the Sports Intelligence pipeline can interpret device activity against what the coach actually planned and observed."
        sourceOfTruth="This page owns the input modes, the structured records they produce, the parser pipeline, and the coach-voice rules for missing-context nudges. The Aggregation + Inference Contract owns how those records combine with device data."
        masterReference="Records land in Firestore under `teams/{teamId}/scheduleEvents`, `teams/{teamId}/prescribedSessions`, `teams/{teamId}/coachObservations`, and `teams/{teamId}/calendarArtifacts`. Coach intake surfaces are the Nora app, an email forwarder, calendar sync, and the iOS share extension."
        relatedDocs={[
          'Sports Intelligence Layer',
          'Aggregation + Inference Contract',
          'Session Detection + Matching',
          'Sport Load Model',
          'Coach Journey',
          'Nora Coaching Context',
        ]}
      />

      <SectionBlock icon={Workflow} title="Three Input Modes — Everything Else Is Inferred">
        <DataTable
          columns={['Input', 'Format', 'Cadence', 'What It Becomes']}
          rows={INPUT_MODES}
        />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Burden Allocation">
        <DataTable columns={['Who', 'What They Do']} rows={COACH_BURDEN} />
      </SectionBlock>

      <SectionBlock icon={ClipboardList} title="Structured Records (Firestore)">
        <DataTable
          columns={['Record', 'Shape', 'Purpose']}
          rows={STRUCTURED_RECORDS}
        />
      </SectionBlock>

      <SectionBlock icon={Calendar} title="Intake Channels">
        <DataTable
          columns={['Channel', 'How It Works', 'Why It Matters']}
          rows={INTAKE_CHANNELS}
        />
      </SectionBlock>

      <SectionBlock icon={FileText} title="Parser Pipeline">
        <DataTable
          columns={['Surface', 'How It\'s Parsed', 'Notes']}
          rows={PARSER_PIPELINE}
        />
        <InfoCard
          title="Parsing Trust Model"
          accent="blue"
          body={
            <BulletList
              items={[
                'Calendar sync (.ics, Google, Outlook) is deterministic — full confidence by default.',
                'Typed-PDF parsing is high confidence; Nora shows a 1-tap parsed preview to the coach for the first plan of a new format and learns the team\'s template after that.',
                'Whiteboard photo + handwriting drops one confidence tier and always gets a parsed preview the coach can edit in 10 seconds.',
                'Voice memos always show a transcript card before saving, with athletes already matched against the roster — coach can fix the wrong-athlete edge case in one tap.',
                'Every parse failure is silent for the athlete and surfaces only on the coach\'s reviewer screen, in coach voice.',
              ]}
            />
          }
        />
      </SectionBlock>

      <SectionBlock icon={Mic} title="Voice Memo as the Primary Ambient Channel">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Why Voice"
            accent="green"
            body={'A coach\'s coaching cycle is verbal — they\'re already talking on the practice floor, in the film room, on the bus. A 15-second voice memo on the way to the car after practice gives Nora three or four pieces of structured context in less time than typing one sentence. Voice fits the coach\'s existing workflow; forms don\'t.'}
          />
          <InfoCard
            title="What Nora Extracts"
            accent="purple"
            body={
              <BulletList
                items={[
                  'Athlete tags — names matched against the roster (with one-tap confirm for nicknames or last-name-only references).',
                  'Topic tags — what was installed, what was emphasized, what felt off.',
                  'Tempo flags — "lighter day", "harder than usual", "felt sluggish across the group".',
                  'Free-text trace — the original transcript stays on the coach_observation for the coach to scan later.',
                ]}
              />
            }
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="What The System Says Back — Coach Voice Examples">
        <InfoCard
          title="Translation Rule"
          accent="amber"
          body={'Anywhere the system would otherwise output a status like "confidence is emerging" or "context missing", it instead speaks in coach voice — what we\'re reading, what would tighten the read, what to drop in. Coaches don\'t care about confidence tiers; they care about "is this a good read or not, and what would make it better."'}
        />
        <DataTable
          columns={['Situation', 'What The System Says (Coach Voice)']}
          rows={COACH_LANGUAGE_EXAMPLES}
        />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Privacy + Boundary Rules">
        <DataTable columns={['Rule', 'Why']} rows={PRIVACY_RULES} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Failure Modes (What Breaks, What We Do)">
        <DataTable columns={['Situation', 'How It\'s Handled']} rows={FAILURE_MODES} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Build Exit Criteria">
        <InfoCard
          title="Done When"
          accent="green"
          body={<BulletList items={EXIT_CRITERIA} />}
        />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckNoraContextCaptureSpecTab;
