import React from 'react';
import { Activity, ArrowDownUp, ClipboardList, Database, FileJson, MessageSquareText, ShieldCheck } from 'lucide-react';
import {
  BulletList,
  CardGrid,
  DataTable,
  DocHeader,
  InfoCard,
  SectionBlock,
} from './PulseCheckRuntimeDocPrimitives';

const CodeBlock: React.FC<{ code: string }> = ({ code }) => (
  <pre className="overflow-x-auto rounded-2xl border border-zinc-800 bg-black/35 p-4 font-mono text-xs leading-relaxed text-zinc-200">
    {code}
  </pre>
);

const WATCHLIST_SNAPSHOT_PAYLOAD = `POST /athletes/{externalId}/biomarker-snapshots
Authorization: Bearer <clinical bridge api key>
X-Pulse-Integration: true
Content-Type: application/json

{
  "schemaVersion": "clinical.biomarkerSnapshot.v1",
  "snapshotId": "pulse-bio-2026-07-08-user_123",
  "externalId": "pulse-user-123",
  "pulseEscalationId": "esc-789",
  "clinicalCaseId": "ae-case-456",
  "reason": "watchlist_daily_snapshot",
  "capturedAt": "2026-07-08T09:00:00-04:00",
  "window": {
    "startAt": "2026-07-07T00:00:00-04:00",
    "endAt": "2026-07-08T00:00:00-04:00",
    "timezone": "America/New_York"
  },
  "sources": [
    {
      "source": "healthkit",
      "sourceRecordIds": ["hcsr_sleep_20260707", "hcsr_hrv_20260707"],
      "freshness": "current",
      "coverage": "partial"
    },
    {
      "source": "self_report_checkin",
      "sourceRecordIds": ["checkin_20260708_am"],
      "freshness": "current",
      "coverage": "complete"
    }
  ],
  "biomarkers": {
    "sleep": {
      "durationHours": 5.8,
      "qualityLabel": "low",
      "trendVsBaseline": "down",
      "confidence": "medium"
    },
    "recovery": {
      "readinessLabel": "low",
      "hrvMs": 42,
      "restingHeartRateBpm": 63,
      "trendVsBaseline": "down",
      "confidence": "medium"
    },
    "activity": {
      "steps": 4200,
      "trainingLoadLabel": "light",
      "strainLabel": "low",
      "confidence": "low"
    },
    "selfReport": {
      "moodLabel": "strained",
      "stressLabel": "high",
      "energyLabel": "low",
      "sorenessLabel": "moderate",
      "notesSummary": "Athlete reported poor sleep and elevated pressure before practice."
    }
  },
  "pulseInterpretation": {
    "summary": "Sleep and readiness remain below baseline while self-reported stress is high.",
    "riskContext": ["low_sleep", "high_stress", "recovery_downtrend"],
    "recommendedPulseAppState": "protective",
    "clinicalUseNote": "Context only. PulseCheck is not diagnosing or making treatment recommendations."
  },
  "redaction": {
    "rawVendorPayloadIncluded": false,
    "fullConversationIncluded": false,
    "clinicalNotesIncluded": false
  }
}`;

const CHAT_SAMPLE_PAYLOAD = `POST /escalations/{escalationId}/context-samples
Authorization: Bearer <clinical bridge api key>
X-Pulse-Integration: true
Content-Type: application/json

{
  "schemaVersion": "clinical.contextSample.v1",
  "sampleId": "pulse-chat-sample-2026-07-08-esc-789",
  "externalId": "pulse-user-123",
  "pulseEscalationId": "esc-789",
  "clinicalCaseId": "ae-case-456",
  "sampleType": "escalation_relevant_chat_excerpt",
  "createdAt": "2026-07-08T09:03:00-04:00",
  "conversation": {
    "pulseConversationId": "conv-456",
    "windowStartAt": "2026-07-08T08:41:00-04:00",
    "windowEndAt": "2026-07-08T08:58:00-04:00",
    "selectionReason": "messages_triggered_tier_3_classifier",
    "summary": "Athlete described feeling unsafe and unable to calm down. Nora provided crisis resources and escalated."
  },
  "messages": [
    {
      "messageId": "msg-1",
      "role": "athlete",
      "sentAt": "2026-07-08T08:41:20-04:00",
      "content": "<minimum necessary excerpt that triggered escalation>",
      "redactionState": "reviewed"
    },
    {
      "messageId": "msg-2",
      "role": "nora",
      "sentAt": "2026-07-08T08:41:45-04:00",
      "content": "Nora crisis-support response excerpt and resource handoff.",
      "redactionState": "reviewed"
    }
  ],
  "excluded": {
    "fullConversationHistory": true,
    "unrelatedTrainingContent": true,
    "coachPrivateNotes": true
  }
}`;

const CHECKIN_PASS_THROUGH_PAYLOAD = `POST /athletes/{externalId}/check-ins
Authorization: Bearer <clinical bridge api key>
X-Pulse-Integration: true
Content-Type: application/json

{
  "schemaVersion": "clinical.watchlistCheckIn.v1",
  "externalId": "pulse-user-123",
  "clinicalCaseId": "ae-case-456",
  "checkInId": "pulse-checkin-2026-07-08-am",
  "submittedAt": "2026-07-08T09:15:00-04:00",
  "channel": "pulsecheck_app",
  "responses": [
    {
      "questionId": "safety_now",
      "label": "Do you feel physically safe right now?",
      "answerType": "single_choice",
      "answer": "yes"
    },
    {
      "questionId": "support_needed",
      "label": "What support do you need before your next check-in?",
      "answerType": "free_text",
      "answer": "<athlete response passed through to AuntEdna>"
    }
  ],
  "pulseStoragePolicy": {
    "storeResponseContent": false,
    "storeReceiptOnly": true
  }
}`;

const INBOUND_CARE_STATE_PAYLOAD = `GET /athletes/{externalId}/care-state

{
  "success": true,
  "data": {
    "externalId": "pulse-user-123",
    "clinicalCaseId": "ae-case-456",
    "watchList": true,
    "appState": "protective",
    "returnToTrainingStatus": "not_cleared",
    "checkInCadence": {
      "frequency": "daily",
      "nextDueAt": "2026-07-09T09:00:00-04:00",
      "channel": "pulsecheck_app"
    },
    "updatedAt": "2026-07-08T09:05:00-04:00"
  },
  "requestId": "ae-req-123"
}`;

const WEBHOOK_SAMPLE_PAYLOAD = `POST /.netlify/functions/clinical-callback
X-AuntEdna-Signature: sha256=<hmac>
Content-Type: application/json

{
  "event": "watchlist.cleared_for_training",
  "webhookEventId": "ae-webhook-123",
  "clinicalCaseId": "ae-case-456",
  "pulseEscalationId": "esc-789",
  "occurredAt": "2026-07-12T14:30:00-04:00",
  "statusCategory": "cleared_for_training",
  "data": {
    "returnToTrainingStatus": "cleared"
  }
}`;

const outboundRows = [
  ['`POST /athletes`', 'Athlete identity upsert', '`externalId`, display/contact fields, org/team routing metadata', 'Implemented in bridge'],
  ['`POST /escalations`', 'Clinical escalation handoff', 'Escalation id, tier, category, concern summary, selected chat excerpt, callback URL', 'Implemented in bridge'],
  ['`POST /athletes/{id}/biomarker-snapshots`', 'Daily watch-list biomarker snapshot', 'Sleep, recovery, activity, self-report summary, freshness, provenance', 'Needed next'],
  ['`POST /escalations/{id}/context-samples`', 'Additional escalation-relevant chat sample', 'Short selected excerpt + summary; never full history', 'Needed next'],
  ['`POST /athletes/{id}/check-ins`', 'Watch-list check-in pass-through', 'Check-in responses sent to clinical record; PulseCheck stores receipt only', 'Proposed/conditional'],
];

const inboundRows = [
  ['`GET /health`', 'Partner API availability', 'Used by Clinical Test Unit', 'Implemented in bridge'],
  ['`GET /athletes/{id}/status`', 'Coarse athlete/case status', 'Dashboard state; no clinical notes', 'Implemented in bridge'],
  ['`GET /athletes/{id}/care-state`', 'Watch-list/app-state authority', 'Protective state, check-in cadence, return-to-training state', 'Implemented in bridge'],
  ['`POST /escalations/{id}/resolve`', 'Resolve operational escalation state', 'Marks bridge workflow resolved; no clinical documentation crosses back', 'Implemented in bridge'],
  ['`POST /.netlify/functions/clinical-callback`', 'Signed status webhook receiver', 'Operational state events only', 'Implemented in bridge'],
];

const fieldRules = [
  ['`externalId`', 'PulseCheck user id used as the cross-system athlete key.', 'Required on every athlete-scoped call.'],
  ['`clinicalCaseId`', 'Provider case id normalized inside PulseCheck.', 'Required once AuntEdna has created a case. Provider payload may call this `caseId` or `auntEdnaCaseId`; we normalize it.'],
  ['`pulseEscalationId`', 'PulseCheck escalation record id.', 'Required for idempotency and audit.'],
  ['`schemaVersion`', 'Payload contract version.', 'Required for biomarker snapshots, context samples, and check-ins.'],
  ['`sourceRecordIds[]`', 'Pointers to PulseCheck source records used to assemble a summary.', 'Allowed; raw vendor payloads are not sent.'],
  ['`redaction` / `excluded`', 'Explicit proof that full histories and clinical notes are not included.', 'Required for chat/context samples.'],
];

const safetyRules = [
  'Daily watch-list biomarker snapshots should only be sent while AuntEdna marks the athlete as watch-list active.',
  'PulseCheck should send a summary plus provenance, not raw Apple Health, Oura, Polar, HealthKit, or Health Connect payloads.',
  'Chat samples should be selected excerpts tied to the escalation or clinician request. Full Nora history should not be exported.',
  'In-app clinical check-in responses can pass through to AuntEdna, but PulseCheck should store only receipt ids, timestamps, and due/complete state.',
  'Every payload should carry ids and timestamps that make it auditable without making PulseCheck a clinical record system.',
];

const ClinicalBridgePayloadSchemasTab: React.FC = () => (
  <div className="space-y-8">
    <DocHeader
      eyebrow="Clinical Bridge"
      title="Payload Schemas"
      version="Draft v1.0 - July 2026"
      summary="Concrete model structures for the data PulseCheck sends to AuntEdna/MANAS and the operational state PulseCheck expects back. This page covers the escalation handoff, watch-list biomarker snapshots, selected chat/context samples, check-in pass-through, care-state reads, and signed webhooks."
      highlights={[
        {
          title: 'No full histories',
          body: 'PulseCheck sends minimum-necessary summaries, excerpts, and source references. Full chats, raw biometric streams, and clinical notes do not cross by default.',
        },
        {
          title: 'Watch-list snapshots',
          body: 'While an athlete is on the watch list, PulseCheck should send a daily biomarker snapshot or agreed cadence snapshot for clinical context.',
        },
        {
          title: 'Receipts over records',
          body: 'When PulseCheck collects watch-list check-ins, response content passes through to AuntEdna and PulseCheck stores only receipts and workflow state.',
        },
      ]}
    />

    <SectionBlock icon={ArrowDownUp} title="Endpoint Map">
      <CardGrid columns="xl:grid-cols-2">
        <InfoCard
          title="Outbound from PulseCheck"
          accent="amber"
          body={<DataTable columns={['Endpoint', 'Purpose', 'Payload core', 'Status']} rows={outboundRows} />}
        />
        <InfoCard
          title="Inbound or partner-owned state"
          accent="blue"
          body={<DataTable columns={['Endpoint', 'Purpose', 'Payload core', 'Status']} rows={inboundRows} />}
        />
      </CardGrid>
    </SectionBlock>

    <SectionBlock icon={Database} title="Shared Keys And Field Rules">
      <DataTable columns={['Field', 'Meaning', 'Rule']} rows={fieldRules} />
    </SectionBlock>

    <SectionBlock icon={Activity} title="Sample Biomarker Snapshot">
      <p className="text-sm leading-relaxed text-zinc-300">
        This is the model Chai is asking for when an athlete is on the watch list. It is a summary of the current biometric and
        self-report state, with freshness and provenance. It is not a raw health-data dump and it is not a diagnosis.
      </p>
      <CodeBlock code={WATCHLIST_SNAPSHOT_PAYLOAD} />
    </SectionBlock>

    <SectionBlock icon={MessageSquareText} title="Sample Chat Context Package">
      <p className="text-sm leading-relaxed text-zinc-300">
        This is the safe version of “sample chats.” PulseCheck should send a concise summary and selected escalation-relevant
        excerpts, not the full Nora conversation history.
      </p>
      <CodeBlock code={CHAT_SAMPLE_PAYLOAD} />
    </SectionBlock>

    <SectionBlock icon={ClipboardList} title="Watch-List Check-In Pass-Through">
      <p className="text-sm leading-relaxed text-zinc-300">
        If AuntEdna wants the athlete to complete daily check-ins inside the PulseCheck app, the answers should pass through to
        AuntEdna. PulseCheck stores only the receipt, cadence, due state, and completion timestamp.
      </p>
      <CodeBlock code={CHECKIN_PASS_THROUGH_PAYLOAD} />
    </SectionBlock>

    <SectionBlock icon={FileJson} title="Expected Partner Responses">
      <CardGrid columns="xl:grid-cols-2">
        <InfoCard title="Care-state read" accent="green" body={<CodeBlock code={INBOUND_CARE_STATE_PAYLOAD} />} />
        <InfoCard title="Signed webhook event" accent="purple" body={<CodeBlock code={WEBHOOK_SAMPLE_PAYLOAD} />} />
      </CardGrid>
    </SectionBlock>

    <SectionBlock icon={ShieldCheck} title="Boundary Rules">
      <BulletList items={safetyRules} />
    </SectionBlock>
  </div>
);

export default ClinicalBridgePayloadSchemasTab;
