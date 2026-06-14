import React from "react";
import {
  AlertTriangle,
  ClipboardCheck,
  Database,
  Filter,
  GitBranch,
  ListChecks,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import {
  BulletList,
  CardGrid,
  DataTable,
  DocHeader,
  InfoCard,
  RuntimeAlignmentPanel,
  SectionBlock,
  StepRail,
} from "./PulseCheckRuntimeDocPrimitives";

const REVIEW_TRACE_STEPS = [
  {
    title: "Candidate",
    owner: "session_candidates",
    body: "Reviewer starts from a detected Phase J candidate with athlete, team, sport hint, candidate kinds, device window, primitive snapshot, missing context, status, confidence tier, and evidence refs.",
  },
  {
    title: "Context",
    owner: "athlete profile + team schedule + coach inputs",
    body: "Surface the context that shaped interpretation: roster/team, sport profile, planned session, coach observation, device coverage, recent pattern memory, and any unresolved gaps.",
  },
  {
    title: "Prompt",
    owner: "clarification_prompts",
    body: "Show the Nora or operator prompt generated for the candidate, including target, question type, reason, friction bucket, answer options, status, expiry, and suppression reason if no prompt was sent.",
  },
  {
    title: "Answer",
    owner: "context_confirmation_events",
    body: "Display athlete, coach, vendor, system, or operator answers as first-class evidence with actor, disposition, basis, selected session type, parsed context, and confidence impact.",
  },
  {
    title: "Session Record",
    owner: "session_records",
    body: "Compare the final canonical session record against the candidate: final session type, time window, context refs, confirmation ids, audience summaries, confidence tier, and conversion status.",
  },
  {
    title: "Load Contribution",
    owner: "Sport Load Model",
    body: "Expose whether the session contributes to load, which primitives were counted, the sport-specific load band, missing inputs, and whether reviewer action is required before downstream reports use it.",
  },
];

const FILTER_ROWS = [
  [
    "Athlete",
    "athleteUserId, athlete display name, roster number, sport profile.",
    "Find one athlete journey across candidate, prompt, answer, record, and load contribution.",
  ],
  [
    "Team",
    "teamId, team name, sport, pilot cohort.",
    "Batch-review practice windows, schedule mismatches, team majority context, and coach confirmations.",
  ],
  [
    "Date",
    "detectedStartAt, detectedEndAt, createdAt, updatedAt, expiresAt.",
    "Default to the current local training day while allowing replay by candidate window or write time.",
  ],
  [
    "Status",
    "detected, contextualized, needs_clarification, confirmed, converted, dismissed, expired, held_back.",
    "Let operators work queues instead of raw collections: needs review, held back, ready to convert, converted, or dismissed.",
  ],
];

const DATA_DEPENDENCY_ROWS = [
  [
    "`session_candidates`",
    "Candidate identity, status, candidate kinds, primitive snapshot, missing context, evidence refs, confidence tier, and lifecycle timestamps.",
    "Primary queue source and left side of the trace.",
  ],
  [
    "`clarification_prompts`",
    "Prompt target, question type, reason, prompt text, answer options, friction bucket, actor precedence, status, expiry, and answer linkage.",
    "Explains why Nora asked, waited, suppressed, or escalated to review.",
  ],
  [
    "`context_confirmation_events`",
    "Actor, actor role, disposition, confirmation basis, confidence impact, answer, selected session type, parsed context, prompt id, and provenance.",
    "Shows exactly what changed the read and who supplied it.",
  ],
  [
    "`session_records`",
    "Final session type, canonical time window, context refs, confirmation event ids, confidence tier, audience summaries, provenance, and loadContribution.",
    "Right side of the trace and downstream handoff to Sport Load, Nora, readiness, and reports.",
  ],
  [
    "`athlete_session_patterns`",
    "Pattern key, signature, confirmed count, correction count, confidence score, last corrected/confirmed timestamps, and examples.",
    "Provides learning context when a candidate was auto-contextualized or held because the pattern is still weak.",
  ],
];

const OPERATOR_ACTION_ROWS = [
  [
    "Hold",
    "Set candidate/review posture to held_back or needs_clarification and record a review note.",
    "Use when evidence conflicts, provenance is incomplete, the answer would change load or recommendation language, or coach-facing copy would overclaim.",
  ],
  [
    "Confirm",
    "Create or attach an operator context_confirmation_event and allow conversion or record update.",
    "Use when provenance is visible, actor precedence is clear, and the final session record plus load contribution match the evidence trail.",
  ],
  [
    "Dismiss",
    "Create or attach a dismissed confirmation event, suppress downstream conversion, and preserve the reason.",
    "Use for false positives, duplicate sessions, non-training activity, stale candidates, or device noise that should not teach the pattern model.",
  ],
];

const CONFIDENCE_VISIBILITY_ROWS = [
  [
    "Candidate confidence",
    "Show initial tier, source hints, quality flags, missing context, and whether the candidate is allowed to become a coach-facing claim.",
    "Prevents device-only or directional reads from looking stronger than they are.",
  ],
  [
    "Transition reason",
    "Show every tier movement with actor, event id, basis, timestamp, prior tier, next tier, and policy reason.",
    "Makes promotion and degradation reviewable instead of a silent backend decision.",
  ],
  [
    "Provenance bundle",
    "Display source family, source type, source record ids, observedAt, ingestedAt, adapter, confidence hints, rawRef, and quality flags.",
    "Lets operators distinguish clean evidence, partial coverage, stale context, vendor labels, and manual overrides.",
  ],
  [
    "Audience posture",
    "Label whether this record may appear in athlete copy, coach report copy, internal-only debug, or no output.",
    "Keeps visibility aligned with confidence and clinical/performance boundaries.",
  ],
];

const BUILD_GATE_ROWS = [
  [
    "Schema contract available",
    "Phase J collection names, statuses, confidence tiers, actor precedence, and provenance fields are shared with runtime writers.",
    "Required before wiring live Firestore queries.",
  ],
  [
    "Read-only skeleton first",
    "Render static trace sections, filters, provenance, actions, and build gates before any mutation button is enabled.",
    "Current Phase 3 scope.",
  ],
  [
    "Fixture-backed trace",
    "Add deterministic sample candidates that cover confirm, hold, dismiss, missing prompt, weak pattern, duplicate, and load-blocked cases.",
    "Required before live admin review.",
  ],
  [
    "Privileged role gate",
    "Only trusted admin/operator roles can inspect raw provenance, actor metadata, parsed answers, or review notes.",
    "Required before connecting to production data.",
  ],
  [
    "Mutation audit",
    "Hold, confirm, and dismiss write confirmation events or review records with operator id, reason, prior state, next state, and timestamp.",
    "Required before enabling actions.",
  ],
  [
    "Downstream dry run",
    "Preview changes to session_record and loadContribution before writing, including any coach-report eligibility shift.",
    "Required before confirm can update canonical records.",
  ],
];

const REVIEW_STATE_ROWS = [
  [
    "Needs clarification",
    "Candidate has missing context that could materially change classification, load, or recommendation.",
    "Prompt visible, answer missing, no coach-facing claim.",
  ],
  [
    "Needs review",
    "Evidence conflicts, actor precedence is unclear, provenance is incomplete, or confidence transition is blocked.",
    "Operator chooses hold, confirm, or dismiss.",
  ],
  [
    "Ready to convert",
    "Candidate has enough evidence and confirmation to become or update a session_record.",
    "Show proposed record diff and load contribution preview.",
  ],
  [
    "Converted",
    "Session record exists and references the candidate plus confirmation chain.",
    "Trace is read-only unless a correction creates a new confirmation event.",
  ],
  [
    "Dismissed",
    "Candidate is false positive, duplicate, non-training activity, or stale/noisy evidence.",
    "Dismissal reason remains visible and should not train the pattern model as a positive example.",
  ],
];

const PulseCheckPhaseJReviewerDebugSurfaceTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="PulseCheck Sports Intelligence"
        title="Phase J Reviewer / Debug Surface Skeleton"
        version="Phase 3 skeleton | May 1, 2026"
        summary="Admin System Overview spec for the Phase J reviewer surface. This static skeleton defines the queue, trace, provenance, confidence visibility, operator actions, filters, data dependencies, and gates needed before live reviewer tooling connects to Phase J collections."
        highlights={[
          {
            title: "Trace Before Action",
            body: "Every review starts with the full candidate -> context -> prompt -> answer -> session_record -> load contribution path so operators can see how meaning was produced.",
          },
          {
            title: "Confidence Is Visible",
            body: "The surface must show confidence transitions, provenance, actor precedence, and visibility posture before any session becomes coach-facing intelligence.",
          },
          {
            title: "Actions Are Audited",
            body: "Hold, confirm, and dismiss are not UI-only states. They create review evidence and preserve the reason, actor, prior state, next state, and downstream effect.",
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Reviewer/debug specification for Phase J contextual session detection. It is the admin-facing surface that lets trusted operators inspect and eventually act on candidate sessions before they affect canonical records, Sport Load, Nora, readiness, or coach reports."
        sourceOfTruth="This file is a static System Overview skeleton only. Live data remains owned by the Phase J collections and the shared contract; runtime mutation behavior must be implemented behind audited backend writers before the UI can confirm, hold, or dismiss real records."
        masterReference="Use this tab when implementing the reviewer queue, fixture-backed debug trace, Firestore query dependencies, operator mutation contracts, and build gates for Phase J review tooling."
        relatedDocs={[
          "Phase J Session Schema Contract",
          "Contextual Detection Engine",
          "Session Detection + Matching",
          "Sport Load Model",
          "Sports Intelligence Aggregation + Inference Contract",
        ]}
      />

      <SectionBlock icon={Workflow} title="Review Trace Skeleton">
        <StepRail steps={REVIEW_TRACE_STEPS} />
      </SectionBlock>

      <SectionBlock icon={Filter} title="Required Filters">
        <InfoCard
          title="Queue Shape"
          accent="blue"
          body="The reviewer should behave like a work queue, not a collection browser. Athlete, team, date, and status filters are required in the first live version so operators can isolate one athlete journey, one team practice window, one training day, or one review state."
        />
        <DataTable
          columns={["Filter", "Fields", "Reviewer Use"]}
          rows={FILTER_ROWS}
        />
      </SectionBlock>

      <SectionBlock icon={Database} title="Phase J Data Dependencies">
        <DataTable
          columns={["Collection", "Fields Needed", "Surface Role"]}
          rows={DATA_DEPENDENCY_ROWS}
        />
      </SectionBlock>

      <SectionBlock
        icon={ShieldCheck}
        title="Provenance & Confidence Transition Visibility"
      >
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="No Silent Promotion"
            accent="green"
            body="A candidate cannot move from directional or usable into coach-facing language without a visible confirmation path, clean provenance, and a reviewable confidence transition."
          />
          <InfoCard
            title="Degradation Is First-Class"
            accent="amber"
            body="Corrections, stale evidence, missing context, or higher-precedence actor feedback must be shown as explicit confidence degradation, not hidden in a rewritten final record."
          />
        </CardGrid>
        <DataTable
          columns={["Visibility Area", "What To Show", "Why It Matters"]}
          rows={CONFIDENCE_VISIBILITY_ROWS}
        />
      </SectionBlock>

      <SectionBlock icon={ClipboardCheck} title="Operator Actions">
        <DataTable
          columns={["Action", "Expected Write", "When To Use"]}
          rows={OPERATOR_ACTION_ROWS}
        />
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="Hold"
            accent="amber"
            body={
              <BulletList
                items={[
                  "Blocks coach-facing claims.",
                  "Keeps the candidate inspectable.",
                  "Requires a reason and next review posture.",
                ]}
              />
            }
          />
          <InfoCard
            title="Confirm"
            accent="green"
            body={
              <BulletList
                items={[
                  "Creates auditable confirmation evidence.",
                  "Shows proposed session_record diff.",
                  "Shows load contribution before commit.",
                ]}
              />
            }
          />
          <InfoCard
            title="Dismiss"
            accent="red"
            body={
              <BulletList
                items={[
                  "Suppresses conversion.",
                  "Preserves false-positive or duplicate reason.",
                  "Prevents positive pattern learning.",
                ]}
              />
            }
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={GitBranch} title="Review States">
        <DataTable
          columns={["State", "Meaning", "Surface Behavior"]}
          rows={REVIEW_STATE_ROWS}
        />
      </SectionBlock>

      <SectionBlock icon={ListChecks} title="Build Gates">
        <InfoCard
          title="Phase 3 Scope"
          accent="purple"
          body="This deliverable is the static doc skeleton only. The live tab registration, Firestore query wiring, fixture loader, role gate, and mutation handlers remain future work and should be implemented only after the gates below are satisfied."
        />
        <DataTable
          columns={["Gate", "Requirement", "Status"]}
          rows={BUILD_GATE_ROWS}
        />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Open Debug Questions">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Where Does Review State Live?"
            accent="amber"
            body="Confirm whether reviewer state should be stored on session_candidates, a dedicated review overlay collection, or only as context_confirmation_events with operator_review basis."
          />
          <InfoCard
            title="How Much Raw Context Is Visible?"
            accent="red"
            body="Define the exact privileged role boundary before showing raw answer text, voice transcripts, parsed athlete context, rawRef pointers, or clinical-adjacent quality flags."
          />
          <InfoCard
            title="What Is The Dry-Run Contract?"
            accent="blue"
            body="Confirm the backend shape for proposed session_record and loadContribution previews so the UI never recomputes production interpretation locally."
          />
          <InfoCard
            title="What Teaches Pattern Memory?"
            accent="green"
            body="Decide which confirmed, corrected, and dismissed review outcomes are eligible to update athlete_session_patterns and which remain audit-only."
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckPhaseJReviewerDebugSurfaceTab;
