import React from 'react';
import { Activity, AlertTriangle, ClipboardList, Database, Link2, ShieldCheck, Smartphone, Workflow } from 'lucide-react';
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

// -----------------------------------------------------------------------------
// Fitbit / Google Health Implementation Checklist
//
// Pulse Check is the first implementation target. Fit With Pulse should consume
// the same connector, model vocabulary, status states, and UI primitives after
// the Pulse Check path proves the contract.
// -----------------------------------------------------------------------------

const EXTERNAL_CONTRACT_ROWS = [
  ['Primary API', 'Google Health API', 'Use this as the forward path. Do not start with the legacy Fitbit Web API because Google is migrating Fitbit integrations onto the Google Health API.'],
  ['Device target', 'Google Fitbit Air first, broader Fitbit family later', 'Model Fitbit Air as a post-sync wearable source that writes normalized records after the device syncs through Google Health.'],
  ['Transport', 'OAuth REST plus webhooks', 'OAuth establishes user consent. Webhooks notify Pulse when subscribed data changes, then the server pulls updated data.'],
  ['Runtime boundary', 'Post-sync context only', 'Fitbit devices do not communicate directly with third-party services, so Fitbit Air should not be treated as a live sensor source.'],
  ['Launch dependency', 'Google app verification and production OAuth', 'The user-facing connector should remain behind a feature flag until verification, scope approval, and webhook endpoint validation are complete.'],
];

const SCOPE_ROWS = [
  ['activity_and_fitness.readonly', 'Steps, distance, active energy, active minutes, active zone minutes, exercise sessions, heart-rate zone time, VO2-related activity metrics.', 'Required for Fit With Pulse and Pulse Check activity/training context.'],
  ['health_metrics_and_measurements.readonly', 'Heart rate, HRV, resting heart rate, oxygen saturation, respiratory rate, sleep temperature derivations, weight, body fat where present.', 'Required for Pulse Check recovery, biometrics, and correlation work.'],
  ['sleep.readonly', 'Sleep sessions and sleep-stage context.', 'Required for Pulse Check recovery and readiness interpretation.'],
  ['profile.readonly', 'Google Health profile identity details.', 'Optional; only use if account matching or support workflows need it.'],
  ['location.readonly', 'GPS location attached to exercise.', 'Later phase only. Do not request by default unless product value requires route-level workout context.'],
];

const MODEL_ROWS = [
  ['Device registry', 'Add `fitbit_air` or `fitbit` as a registry family with `oauth-webhook`, `oauth-pkce`, and `liveStreamingSupported: false`.', 'Keeps capability checks, support views, and Phase J expectations honest.'],
  ['Source family', 'Add `fitbit` to `HealthContextSourceFamily` and map it to a canonical snapshot source id.', 'All Fitbit Air records should enter the same HCSR and snapshot pipeline as Oura, Polar, and Apple Health.'],
  ['Source types', '`fitbit_sleep`, `fitbit_activity`, `fitbit_training`, `fitbit_biometrics`, `fitbit_summary`.', 'Namespaced source types preserve adapter ownership without leaking raw Google Health payloads into consumers.'],
  ['Registry data types', 'Add missing capability labels such as `oxygen_saturation`, `respiratory_rate`, `active_minutes`, `active_zone_minutes`, and `vo2_max` if needed.', 'Fitbit Air exposes useful recovery and activity primitives that are not fully represented by the current registry enum.'],
  ['Connection collection', 'Prefer a product-shareable connection record such as `health-provider-connections/{userId}_google_health`.', 'Pulse Check can ship first while Fit With Pulse later reuses the same token posture and status vocabulary.'],
  ['Source status', 'Write `health-context-source-status/{userId}_fitbit` with lifecycle, last attempted sync, last successful sync, last observed record, and last error fields.', 'Nora, admin tooling, and Fit With Pulse need the same source-health read.'],
];

const SOURCE_RECORD_ROWS = [
  ['Recovery', 'Sleep duration, sleep stages, HRV, resting heart rate, SpO2, respiratory rate, sleep temperature derivation.', '`sourceFamily: fitbit`, `domain: recovery`, confidence `stable` only when fresh and complete.'],
  ['Activity', 'Steps, distance, active energy, active minutes, active zone minutes, sedentary periods, heart-rate-zone time.', '`domain: activity`; daily rollups are evidence, not live session truth.'],
  ['Training', 'Exercise sessions, auto-detected workouts, app-started workouts, duration, calories, heart-rate zone summaries.', '`domain: training`; use for post-hoc reconciliation after Fit With Pulse or Apple Watch source truth.'],
  ['Biometrics', 'Heart-rate samples, HRV samples, oxygen saturation samples, respiratory rate, VO2-related metrics, weight/body fat if a scale is connected.', '`domain: biometrics`; keep scale-derived fields optional and provenance-labeled.'],
  ['Summary', 'Connector freshness, available data families, derived readiness inputs.', '`domain: summary`; do not store Google or Fitbit coaching language as Pulse product truth.'],
];

const PRECEDENCE_ROWS = [
  ['Training', 'Fit With Pulse > Apple Health > Polar > Garmin/Whoop/Fitbit > Oura > self-report', 'Fitbit can validate or enrich workouts after sync, but it should not outrank app-native or live workout lanes.'],
  ['Recovery', 'Polar > Oura > Fitbit > Apple Health > self-report', 'Fitbit Air can be a strong sleep and recovery source, but Oura/Polar remain higher-fidelity direct recovery lanes in the current strategy.'],
  ['Activity', 'Apple Health > Polar/Garmin > Fitbit > Oura > self-report', 'Fitbit is good for consumer-scale activity context; Apple Health remains the strongest platform bridge on iOS.'],
  ['Biometrics', 'Apple Health > Fitbit > Polar/Oura > coach-entered', 'Fitbit health metrics are useful when fresh, but source status and permissions must decide whether they can be trusted.'],
  ['Summary', 'Oura/Polar > Fitbit > Apple Health > Fit With Pulse/Macra', 'Fitbit summary should be one input into Pulse interpretation, not an alternate coaching layer.'],
];

const BACKEND_CHECKLIST_ROWS = [
  ['External setup', 'Create Google Cloud project configuration, OAuth client, redirect URI, consent screen, app verification path, and webhook subscriber endpoint.', 'Production OAuth can start and callback can complete in a verified environment.'],
  ['Shared utilities', 'Add `google-health-utils` with OAuth state, token exchange/refresh, error normalization, health user identity lookup, and scoped API client helpers.', 'Matches the Oura/Polar pattern while using Google identity and Google Health endpoints.'],
  ['Auth routes', 'Add auth-start, callback, status, disconnect, and token-refresh-safe helpers for Google Health.', 'Pulse Check UI can connect, inspect, refresh, and disconnect the Fitbit lane.'],
  ['Sync route', 'Add `google-health-sync` to query the approved data types for a requested date/window and normalize into HCSR records.', 'Manual refresh and scheduled refresh produce deterministic records.'],
  ['Webhook route', 'Add `google-health-webhook` with endpoint verification, authorization check, signature verification, immediate 204 response, and async sync enqueue.', 'Pulse can receive updates without polling every connected athlete blindly.'],
  ['Scheduler fallback', 'Add an end-of-day scheduled sync for connected users in case webhooks arrive late, are retried, or a user opens the app after a stale period.', 'Fitbit freshness can recover even if webhook delivery is imperfect.'],
  ['Status writer', 'Update source status on connect, no-data, stale, sync success, sync error, revoked consent, and disconnect.', 'Nora and UI do not have to guess why Fitbit data is missing.'],
];

const PULSECHECK_UI_ROWS = [
  ['Connection page', 'Create `/PulseCheck/fitbit` using the Oura page pattern: status, connect, refresh, disconnect, last sync, scopes granted, and support-safe error states.', 'Athletes can manage Fitbit Air from the Pulse Check device surface.'],
  ['Member setup', 'Add Fitbit Air as a recovery/activity option after Apple Health, Polar, and Oura; explain that it syncs after the Google Health app receives data.', 'Pulse Check onboarding sets correct expectations before consent.'],
  ['Device settings card', 'Add a shared Fitbit card with connected, waiting for data, stale, needs reconnect, and disconnected states.', 'The same component can later mount inside Fit With Pulse.'],
  ['Biometric brief', 'Show Fitbit as a contributing source in the recovery/activity cards with freshness and confidence labels.', 'Nora and athlete views can explain what Fitbit contributed without overclaiming.'],
  ['Coach/admin views', 'Expose Fitbit source health in pilot dashboard, athlete detail, health-context debug surfaces, and operator source-status panels.', 'Support and coaches can see whether missing context is consent, sync, freshness, or payload coverage.'],
  ['Copy guardrail', 'Use value-first language: connect Fitbit Air to bring sleep, heart-rate, and activity context into Pulse Check.', 'Avoid API-centric language and avoid claiming live workout capture from Fitbit Air.'],
];

const FIT_WITH_PULSE_PORT_ROWS = [
  ['Shared service wrapper', 'Extract a product-neutral Google Health integration service that accepts product context: `pulsecheck` or `fit_with_pulse`.', 'Pulse Check ships first, Fit With Pulse ports without duplicating provider code.'],
  ['Shared UI primitives', 'Create reusable device cards, status badges, connect/disconnect buttons, scope summary, stale-state banners, and refresh controls.', 'Keeps parity with the Polar pattern and prevents copy drift.'],
  ['Product projections', 'Pulse Check reads recovery/cognition context; Fit With Pulse reads activity, training reconciliation, and workout enrichment.', 'Same HCSR records, different product projections.'],
  ['Routing parity', 'Fit With Pulse should not build a second Fitbit adapter. It should read the same connection record, source status, and normalized source records.', 'One connector, two products, clean parity.'],
  ['Rollout sequence', 'Ship Pulse Check beta, validate sync quality and UI states, then mount the shared card into Fit With Pulse device settings and workout recap surfaces.', 'Avoids copying a half-proven integration into both products.'],
];

const TEST_ROWS = [
  ['OAuth runtime tests', 'Mock start, callback, denied consent, expired state, token refresh, and disconnect.', 'Connection lifecycle is reliable before user-facing launch.'],
  ['Sync shape tests', 'Use fixture payloads for sleep, activity, exercise, heart rate, HRV, oxygen saturation, respiratory rate, and missing-data cases.', 'Every fixture writes deterministic HCSR ids, dedupe keys, domains, source types, and provenance.'],
  ['Webhook tests', 'Verify endpoint challenge, authorization failure, signature success/failure, duplicate notification idempotency, and async enqueue behavior.', 'Webhook delivery is secure and repeat-safe.'],
  ['Assembler tests', 'Add Fitbit records into domain precedence tests for recovery, activity, training, biometrics, and summary.', 'Fitbit data wins only where the contract says it should.'],
  ['UI state tests', 'Cover disconnected, connected waiting for data, connected synced, stale, error, revoked consent, partial scopes, and refresh-in-progress.', 'Athlete and admin surfaces render the same state vocabulary.'],
  ['Parity tests', 'Mount the shared connector primitives in a Fit With Pulse test harness after Pulse Check is stable.', 'Future product parity can be checked without duplicating assertions.'],
];

const RELEASE_GATE_ROWS = [
  ['Contract gate', 'Fitbit appears in registry, HCSR family types, snapshot mapping, source status, and System Overview docs.', 'No hidden one-off provider path.'],
  ['External gate', 'Google Health API app verification is approved and webhook endpoint verification passes in production.', 'The connector can run outside local mocks.'],
  ['Data gate', 'At least one real Fitbit Air account produces sleep, activity, biometrics, and exercise records with expected freshness behavior.', 'The adapter works with real sync cadence and partial data.'],
  ['Safety gate', 'No Pulse Check or Fit With Pulse surface claims Fitbit Air is live source-of-truth for active workouts.', 'The product fails honest around post-sync data.'],
  ['Ops gate', 'Support can inspect connection status, scopes, health user id mapping, last sync, last observed record, webhook receipts, and adapter errors.', 'The team can debug without raw Google console spelunking.'],
  ['Parity gate', 'Fit With Pulse consumes the same shared connector after Pulse Check beta, with no duplicate Fitbit-specific auth or sync code.', 'Long-term maintenance stays sane.'],
];

const BUILD_ORDER_STEPS = [
  {
    title: 'Lock The Pulse Check Contract',
    owner: 'Pulse Check platform',
    body: 'Add Fitbit to the device registry, HCSR source family, source-status vocabulary, snapshot source mapping, and domain precedence before building UI or connector code.',
  },
  {
    title: 'Build Google Health Connector Internals',
    owner: 'Backend / Netlify functions',
    body: 'Implement OAuth, token refresh, health user id mapping, status, disconnect, sync, webhook receiver, and scheduled fallback using a product-neutral connector shape.',
  },
  {
    title: 'Normalize Fitbit Records',
    owner: 'Health-context ingestion',
    body: 'Map Google Health data types into recovery, activity, training, biometrics, and summary HCSR records with deterministic ids, source provenance, and no consumer-facing copy.',
  },
  {
    title: 'Ship Pulse Check UI First',
    owner: 'Pulse Check web + mobile',
    body: 'Add connection, setup, health-context, coach/admin, stale-state, and support surfaces using reusable device components and shared provider constants.',
  },
  {
    title: 'Validate With Real Sync Cadence',
    owner: 'QA + operations',
    body: 'Run real-account checks for delayed sync, no-data, partial scopes, revoked consent, duplicate webhooks, stale records, and source-precedence behavior.',
  },
  {
    title: 'Port To Fit With Pulse',
    owner: 'Fit With Pulse product',
    body: 'Mount the same connector cards and service wrapper in Fit With Pulse device settings and training recap surfaces, changing only the product-specific projection of the normalized records.',
  },
];

const PulseCheckFitbitIntegrationChecklistTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Device Integrations"
        title="Fitbit / Google Health Implementation Checklist"
        version="Version 0.1 | June 1, 2026"
        summary="End-to-end checklist for adding Google Fitbit Air and the broader Fitbit lane into Pulse Check first, then porting the same connector, model vocabulary, and UI primitives into Fit With Pulse so both products stay in parity like the Polar integration."
        highlights={[
          {
            title: 'Pulse Check First',
            body: 'Build the full Fitbit lane in Pulse Check first because recovery, sleep, and cognitive-state context are the clearest product fit.',
          },
          {
            title: 'One Connector',
            body: 'Use Google Health as a shared provider boundary. Fit With Pulse should port the proven connector instead of creating a second Fitbit implementation.',
          },
          {
            title: 'Post-Sync Truth',
            body: 'Fitbit Air should enrich training, recovery, and biometrics after sync. It should not be positioned as a live active-workout source.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Implementation control checklist for adding Fitbit Air through the Google Health API while preserving Pulse Check and Fit With Pulse device parity."
        sourceOfTruth="This page owns the end-to-end Fitbit implementation sequence: external Google setup, canonical models, source records, sync, webhooks, Pulse Check UI, Fit With Pulse porting, testing, and release gates."
        masterReference="Use this checklist before writing Fitbit connector code or product UI. If an implementation conflicts with this page, update the architecture contract first."
        relatedDocs={[
          'Device Integration Strategy',
          'Device Registry',
          'Health Context Source Record Spec',
          'Health Context Snapshot Assembler Spec',
          'Oura Integration Strategy',
          'Run Source Of Truth',
          'Fit With Pulse iOS product handbook',
        ]}
      />

      <SectionBlock icon={Link2} title="External API Contract">
        <DataTable columns={['Area', 'Decision', 'Implementation Rule']} rows={EXTERNAL_CONTRACT_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Use Google Health, Not Legacy Fitbit"
            accent="amber"
            body="The implementation should use the Google Health API path from the start. The legacy Fitbit API can be documented only as migration context, not as the new production build target."
          />
          <InfoCard
            title="Direct Device Boundary"
            accent="blue"
            body="Fitbit Air is a strong passive wearable, but the device syncs through the Google Health app before third-party services receive data. That makes it a post-sync source in Pulse architecture."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Consent And Scopes">
        <DataTable columns={['Scope', 'Data Coverage', 'Pulse Rule']} rows={SCOPE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Models And Registry">
        <DataTable columns={['Layer', 'Checklist Item', 'Done State']} rows={MODEL_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Activity} title="Source-Record Mapping">
        <DataTable columns={['Domain', 'Fitbit Payload Inputs', 'Canonical Write Rule']} rows={SOURCE_RECORD_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Source Precedence">
        <DataTable columns={['Domain', 'Recommended Order', 'Why']} rows={PRECEDENCE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ClipboardList} title="Backend Checklist">
        <DataTable columns={['Workstream', 'Checklist Item', 'Done State']} rows={BACKEND_CHECKLIST_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Smartphone} title="Pulse Check UI Checklist">
        <DataTable columns={['Surface', 'Checklist Item', 'Done State']} rows={PULSECHECK_UI_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Smartphone} title="Fit With Pulse Porting Checklist">
        <DataTable columns={['Parity Layer', 'Checklist Item', 'Done State']} rows={FIT_WITH_PULSE_PORT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Build Order">
        <StepRail steps={BUILD_ORDER_STEPS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Testing Checklist">
        <DataTable columns={['Test Area', 'Checklist Item', 'Done State']} rows={TEST_ROWS} />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Release Gates">
        <DataTable columns={['Gate', 'Requirement', 'Why It Matters']} rows={RELEASE_GATE_ROWS} />
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="Keep The Claims Clean"
            accent="red"
            body={<BulletList items={['No live workout-source claims for Fitbit Air.', 'No Google Health Coach language copied into Pulse surfaces.', 'No medical or diagnostic positioning.']} />}
          />
          <InfoCard
            title="Keep The Pipe Shared"
            accent="green"
            body={<BulletList items={['Pulse Check owns the first implementation.', 'Fit With Pulse ports shared connector components.', 'Both products read the same normalized records.']} />}
          />
          <InfoCard
            title="Keep Ops Visible"
            accent="blue"
            body={<BulletList items={['Connection state is inspectable.', 'Webhook receipts are inspectable.', 'Sync freshness is visible to support and admin tools.']} />}
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckFitbitIntegrationChecklistTab;
