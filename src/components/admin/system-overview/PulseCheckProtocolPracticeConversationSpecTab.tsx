import React from 'react';
import {
  Bot,
  CheckSquare,
  ClipboardList,
  Database,
  MessageCircleMore,
  Mic,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const EXPERIENCE_ROWS = [
  ['Teach', 'Nora introduces the protocol, explains the mechanism, models the target language, and gives the member a felt-sense frame for what they are about to do.', 'The member reaches the final instructional step with clear expectations and hears the Nora-selected voice + protocol cue package.'],
  ['Practice Conversation', 'After the teaching layer, Nora opens a live guided exchange where the athlete has to answer, rehearse, or perform the technique instead of passively consuming slides.', 'The member completes the required protocol turns or explicit fallback path, producing enough signal to judge whether they actually applied the technique.'],
  ['Evaluate', 'Nora closes the session with protocol-specific feedback, confidence language, and a quick summary of what was strong versus what needs work next rep.', 'The session stores a lightweight scorecard, the member gets clear feedback, and runtime evidence can update from something richer than completion alone.'],
];

const STATE_ROWS = [
  ['protocol-intro', 'Play protocol cue and entrance animation before spoken instruction begins.'],
  ['teach', 'Run the bounded instruction sequence with Nora narration and manual pacing where needed.'],
  ['practice-intro', 'Transition from learning mode into application mode so the user understands they now need to respond.'],
  ['practice-turn', 'Show Nora prompt, capture user response by text or microphone, and store the turn payload.'],
  ['practice-feedback', 'Nora offers quick mid-loop coaching, encouragement, or correction before the next turn.'],
  ['evaluation', 'Nora summarizes performance against the protocol rubric and returns a practice scorecard.'],
  ['completion', 'Collect final self-report and close the assignment with audit-friendly outcome data.'],
];

const TURN_ROWS = [
  ['Prompt type', 'Examples', 'Why It Exists'],
  ['State labeling', '“Tell me what your body is doing right now.”', 'Confirms the user can perceive the current signal rather than skipping straight to affirmation.'],
  ['Technique application', '“Now say the reframe in your own words.”', 'Tests whether the user can actively perform the protocol rather than only repeat Nora.'],
  ['Embodied rehearsal', '“Say your competition-ready line out loud.”', 'Moves the intervention closer to an actual rep or competitive moment.'],
  ['Reflective check', '“What changed in your body after that?”', 'Lets Nora assess whether the intervention actually shifted the target bottleneck.'],
];

const SCORECARD_ROWS = [
  ['Signal awareness', 'Did the athlete identify the relevant body/state cues the protocol is designed to work on?'],
  ['Technique fidelity', 'Did the response match the intended mechanism of the protocol rather than generic self-talk?'],
  ['Language quality', 'Did the athlete use target words, framing, and posture aligned to the technique?'],
  ['Shift quality', 'Did the athlete report or demonstrate a meaningful movement toward the desired state?'],
  ['Coachability', 'Did the athlete respond to Nora feedback and improve across turns?'],
];

const STORAGE_ROWS = [
  ['Practice session record', 'New assignment-linked object capturing teach completion, practice start/end, mode, and final evaluation summary.'],
  ['Turn records', 'Each Nora prompt and athlete response with timestamps, modality, transcript, and any evaluator notes.'],
  ['Evaluation scorecard', 'Protocol-specific rubric scores, strengths, misses, and next-step recommendation.'],
  ['Assignment audit trace', 'Persist the protocol family, variant, runtime record, published revision id, and practice outcome summary together.'],
  ['Evidence bridge', 'Feed practice results into protocol evidence and athlete responsiveness without replacing assignment-event truth.'],
];

const FALLBACK_ROWS = [
  ['Microphone unavailable', 'Allow typed responses and continue the conversation flow without blocking completion.'],
  ['Speech recognition fails', 'Keep Nora voice active but surface transcript retry + manual text input.'],
  ['TTS unavailable', 'Pause the conversation and degrade to on-screen Nora copy rather than skipping the practice layer.'],
  ['User wants shorter mode', 'Allow a reduced-turn guided rep, but still require at least one applied response before evaluation.'],
  ['Safety / distress signal appears', 'Exit the protocol-practice flow and route back into the bounded Nora support or defer lane.'],
];

const IMPLEMENTATION_STEPS = [
  {
    title: 'Introduce a new practice-conversation runtime state',
    body: 'Teach should no longer fall directly into completion. Add a stateful handoff from instruction mode into a practice session that can run multiple Nora/athlete turns.',
    owner: 'Exercise player + protocol runtime',
  },
  {
    title: 'Define protocol-specific conversation scripts',
    body: 'Each protocol needs a structured practice brief: opening Nora prompt, follow-up prompts, rubric hooks, and what counts as an acceptable applied response.',
    owner: 'Protocol specs + runtime content',
  },
  {
    title: 'Ship text-first responses',
    body: 'Launch the practice layer with text input as the guaranteed fallback, then add microphone capture and transcript assist without making voice a hard blocker.',
    owner: 'Web + iOS execution surfaces',
  },
  {
    title: 'Persist practice audit and evaluation',
    body: 'Store session turns, final rubric scores, and assignment-linked outcome summary so the registry, evidence dashboard, and review surfaces can learn from the interaction.',
    owner: 'Firestore schema + services',
  },
  {
    title: 'Connect evaluation into evidence and responsiveness',
    body: 'Practice quality should inform protocol evidence and athlete responsiveness carefully, with freshness and confidence rules that remain subordinate to state safety.',
    owner: 'Evidence + responsiveness services',
  },
];

const CHECKLIST_ROWS = [
  ['P0', 'Player state machine', 'Add `practice-intro`, `practice-turn`, `practice-feedback`, and `evaluation` states after teach.'],
  ['P0', 'Protocol content contract', 'Create a locked spec shape for protocol-practice prompts, allowed input modes, rubric dimensions, and closeout messaging.'],
  ['P0', 'Text response UI', 'Ship text-entry turns in web preview/runtime so practice works even before microphone capture is perfect.'],
  ['P0', 'Evaluation summary', 'Nora must return a protocol-specific end summary instead of jumping straight from last instruction to completion.'],
  ['P0', 'Assignment trace', 'Persist practice-session metadata, turns, and rubric result under the assignment audit trace.'],
  ['P1', 'Voice capture', 'Add microphone capture plus transcript review to the practice conversation flow.'],
  ['P1', 'Protocol scoring service', 'Centralize evaluation heuristics so web/iOS/admin all read the same rubric outcome model.'],
  ['P1', 'Registry visibility', 'Show practice-conversation readiness and evidence posture in the Protocol Registry and evidence dashboard.'],
  ['P1', 'Coach/operator review', 'Expose practice transcript summary and evaluation scorecard in assignment audit review surfaces.'],
  ['P1', 'QA matrix', 'Add Playwright and platform tests for teach -> practice -> evaluate success, fallback, and error cases.'],
  ['P2', 'Adaptive follow-ups', 'Let Nora choose bounded follow-up prompts based on the athlete response while staying inside a protocol-safe prompt set.'],
  ['P2', 'Voice-quality signals', 'Optionally score pace, confidence, or hesitancy when microphone capture is strong enough to trust.'],
];

const PulseCheckProtocolPracticeConversationSpecTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Runtime"
        title="Protocol Practice Conversation Spec"
        version="Version 0.1 | March 18, 2026"
        summary="Design and runtime contract for turning protocols into a two-stage experience: Nora first teaches the technique, then actively coaches the member through a bounded practice conversation that proves they can apply it. This artifact exists because a protocol should not end the moment Nora finishes explaining it."
        highlights={[
          {
            title: 'Not Just Instruction',
            body: 'A protocol is incomplete if the member only hears the technique and never has to perform it.',
          },
          {
            title: 'Practice Is Bounded',
            body: 'This is not open-ended chat. Nora stays inside a protocol-specific conversation frame with fixed goals and guardrails.',
          },
          {
            title: 'Evaluation Must Persist',
            body: 'Completion alone is weak evidence. The system should store whether the member actually applied the technique well.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Runtime artifact for the second half of protocol execution. It defines how a protocol transitions from narrated instruction into live applied practice, how Nora should guide the turns, and what evaluation data must survive into assignment truth."
        sourceOfTruth="This document is authoritative for the teach -> practice -> evaluate layer of protocol execution, the state machine needed to support it, and the minimum implementation shape required before protocol practice should be considered complete."
        masterReference="Use Protocol Registry for family/variant/runtime lineage, Nora Assignment Rules for routing into a protocol, and this page for what happens once a protocol actually starts."
        relatedDocs={[
          'Protocol Registry',
          'Protocol Authoring Workflow',
          'Protocol Evidence Dashboard',
          'Protocol Revision & Audit Trace',
          'Nora Assignment Rules',
        ]}
      />

      <SectionBlock icon={Sparkles} title="Experience Model">
        <DataTable columns={['Layer', 'What Nora Does', 'Success Condition']} rows={EXPERIENCE_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Why This Exists"
            accent="blue"
            body="The current flow behaves like an instructional slideshow. The protocol-practice layer makes Nora behave more like a coach who teaches, then asks the member to actually perform the mental skill."
          />
          <InfoCard
            title="Member Promise"
            accent="green"
            body="When a protocol ends, the member should feel like they practiced something with Nora, not just listened to it."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Runtime State Machine">
        <DataTable columns={['State', 'Required Behavior']} rows={STATE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={MessageCircleMore} title="Conversation Turn Design">
        <DataTable columns={TURN_ROWS[0] as string[]} rows={TURN_ROWS.slice(1)} />
        <InfoCard
          title="Bounded Conversation Rule"
          accent="amber"
          body={
            <BulletList
              items={[
                'Nora should not drift into general wellness chat while a protocol practice session is in progress.',
                'Every turn must map to the protocol mechanism, target bottleneck, or evaluation rubric.',
                'If the member goes off-path, Nora should gently redirect or exit into the appropriate bounded support lane.',
              ]}
            />
          }
        />
      </SectionBlock>

      <SectionBlock icon={Bot} title="Input Modes And Guidance Posture">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="Text First"
            accent="purple"
            body="Text input should be the guaranteed baseline so the practice layer works in preview, web, and low-permission contexts immediately."
          />
          <InfoCard
            title="Voice Next"
            accent="blue"
            body="Microphone capture should layer on top once browser and platform support are stable enough to avoid making practice fragile."
          />
          <InfoCard
            title="Nora Always Leads"
            accent="green"
            body="Even when the member types, Nora should still use her configured voice for prompts, corrections, and final evaluation where playback is available."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ClipboardList} title="Evaluation Scorecard">
        <DataTable columns={['Rubric Dimension', 'What Nora Should Judge']} rows={SCORECARD_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Good Output"
            accent="green"
            body="Nora should end with a short scorecard that names what the athlete did well, what missed the protocol target, and what to do on the next rep."
          />
          <InfoCard
            title="Bad Output"
            accent="red"
            body="A generic 'great job' closeout is not enough. The evaluation must be traceable back to the actual protocol mechanism and the user response."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Database} title="Persistence And Audit">
        <DataTable columns={['Artifact', 'Required Persistence']} rows={STORAGE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Mic} title="Fallbacks And Guardrails">
        <DataTable columns={['Case', 'Required Behavior']} rows={FALLBACK_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Implementation Path">
        <StepRail steps={IMPLEMENTATION_STEPS} />
      </SectionBlock>

      <SectionBlock icon={CheckSquare} title="Implementation Checklist">
        <DataTable columns={['Priority', 'Workstream', 'Definition Of Done']} rows={CHECKLIST_ROWS} />
      </SectionBlock>
    </div>
  );
};

export default PulseCheckProtocolPracticeConversationSpecTab;
