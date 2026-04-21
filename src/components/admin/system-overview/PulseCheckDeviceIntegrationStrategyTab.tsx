import React from 'react';
import { Activity, Building2, Database, Link2, ShieldCheck, Smartphone, Workflow, FileText, Handshake, Moon } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';
import ArtifactPageLibrary, { ArtifactPageEntry } from './ArtifactPageLibrary';
import PulseCheckDeviceIntegrationPartnershipMatrixTab from './PulseCheckDeviceIntegrationPartnershipMatrixTab';
import PulseCheckOuraCognitiveCorrelationSpecTab from './PulseCheckOuraCognitiveCorrelationSpecTab';
import PulseCheckOuraIntegrationStrategyTab from './PulseCheckOuraIntegrationStrategyTab';
import PulseCheckSchoolWearableBundlePlanTab from './PulseCheckSchoolWearableBundlePlanTab';

const CURRENT_BASELINE_ROWS = [
  ['Apple Watch / HealthKit', 'Platform bridge and permission layer for iOS-first athletes.', 'Current baseline lane for wearable health context.'],
  ['Oura', 'Direct Oura API plus Apple Health fallback when direct consent is unavailable.', 'Current premium recovery lane with dual-path support.'],
];

const INTEGRATION_TAXONOMY_ROWS = [
  ['Consumer wearable', 'Personal device with fitness, sleep, heart-rate, recovery, or training context.', 'Garmin, Oura, Whoop, Polar, Fitbit, COROS'],
  ['Mobile health platform', 'OS-level aggregator or permission layer that mirrors many devices.', 'Apple HealthKit, Samsung Health / Health Connect'],
  ['Biometric / wellness device', 'Body composition, blood pressure, weight, or recovery-adjacent device.', 'Withings'],
  ['Team / enterprise system', 'Club, college, or pro-performance feed with session and workload context.', 'Catapult'],
  ['Ecosystem app', 'No public device API; only bridgeable through another platform.', 'Nike ecosystem'],
];

const WISHLIST_ROWS = [
  ['Tier 1', 'Garmin', 'Best all-around athlete value: training load, sleep, recovery, and broad brand recognition.', 'Partner API / cloud feed when available'],
  ['Tier 1', 'Polar', 'Clean sports-data model and strong training pedigree.', 'Direct API / partner feed'],
  ['Tier 1', 'Withings', 'Biometrics, body composition, sleep, and health-adjacent depth.', 'Direct API'],
  ['Tier 1', 'Samsung Health / Galaxy Watch', 'Android scale plus a strong platform bridge path.', 'Health Connect / Samsung Health SDK'],
  ['Tier 1', 'Catapult', 'Elite team performance data and high-value B2B alliance potential.', 'Enterprise feed / partner integration'],
  ['Tier 2', 'Whoop', 'Recovery-first positioning and strong athlete community.', 'Partner API or platform bridge'],
  ['Tier 2', 'COROS', 'Endurance niche with useful training and activity context.', 'Partner API / cloud feed'],
  ['Tier 2', 'Fitbit', 'Broad consumer reach and legacy sleep/activity coverage.', 'Public API'],
  ['Tier 3', 'Nike ecosystem', 'Brand halo is real, but direct device/API access is weak.', 'Bridge only until a true API exists'],
];

const SOURCE_RECORD_ROWS = [
  ['Garmin daily summary / activity', '`summary_input` / `measurement`', 'Training volume, activity, recovery, sleep, and readiness-like signals.'],
  ['Polar training / HR / sleep', '`measurement` / `session` / `summary_input`', 'Workout context, heart-rate traces, sleep, and recovery inputs.'],
  ['Withings body metrics', '`measurement`', 'Weight, body composition, blood pressure, and related biometrics.'],
  ['Samsung Health / Galaxy Watch mirror', '`summary_input` / `measurement`', 'Android-side health and wearable context mirrored through the platform bridge.'],
  ['Whoop recovery / strain / sleep', '`summary_input` / `measurement`', 'Recovery-first context and daily strain/posture.'],
  ['COROS workouts', '`session` / `measurement`', 'Endurance workouts, activity, and related training context.'],
  ['Fitbit activity / sleep / HR', '`summary_input` / `measurement`', 'Consumer-scale activity, sleep, and heart-rate context.'],
  ['Catapult team session feed', '`session` / `derived_signal`', 'Team or enterprise workload, session, and athlete-load context.'],
  ['Nike ecosystem bridge', '`summary_input`', 'Only if Nike data is mirrored into a supported health platform.'],
];

const ROUTING_ROWS = [
  ['1', 'Shared Fit With Pulse training context', 'If available, keep workout context from the consumer fitness stack as the strongest training source. Macra remains the dedicated nutrition source.'],
  ['2', 'Direct vendor API / partner feed', 'Use the native device or vendor feed when available and consented.'],
  ['3', 'Platform bridge', 'Use HealthKit or Health Connect when the device primarily routes through the mobile health platform.'],
  ['4', 'Self-report / check-in context', 'Fill gaps only after device and platform lanes are evaluated.'],
];

const FRESHNESS_ROWS = [
  ['Direct vendor feed', 'Freshness should follow the provider sync marker or latest observation date.', 'Preferred when available.'],
  ['Platform bridge', 'Freshness should reflect the platform sync time plus a source-status check.', 'Acceptable when the device is meant to live inside HealthKit / Health Connect.'],
  ['Enterprise feed', 'Freshness should track session closeout or team sync completion.', 'Use for Catapult and similar systems.'],
  ['No active consent', 'Mark `no_permission` or `disconnected` and do not pretend the source is current.', 'Fail honest, not silent.'],
];

const RISKS_ROWS = [
  ['API availability changes', 'Some vendors require partner approval, membership, or can change access rules.', 'Prefer vendors with stable public docs and build fallback lanes early.'],
  ['Mirror gaps', 'HealthKit / Health Connect mirrors do not always expose every vendor-native field.', 'Use direct APIs where that richness matters.'],
  ['Duplicate signals', 'Steps, calories, and workouts can arrive from multiple sources.', 'Use source precedence and provenance to prevent silent double counting.'],
  ['Consent burden', 'Too many scopes or too many vendors can reduce opt-in.', 'Request minimum useful permissions and phase the rest.'],
  ['Android fragmentation', 'Samsung and Health Connect are powerful but add platform diversity.', 'Treat platform bridges as first-class, but model them explicitly.'],
  ['Niche ecosystems', 'Some brands have strong audience value but weak integration surfaces.', 'Keep a bridge-only lane until the API story improves.'],
];

const ROADMAP_ROWS = [
  ['Phase 1', 'Lock the device taxonomy, source-record mapping, and precedence rules.', 'Prevents one-off adapters from inventing their own shapes.'],
  ['Phase 2', 'Prioritize direct lanes for Garmin, Polar, Withings, and Samsung Health / Galaxy Watch.', 'Covers the most useful technical and alliance value early.'],
  ['Phase 3', 'Add Catapult, Whoop, COROS, and Fitbit as the next expansion tier.', 'Broadens the athlete and team footprint without breaking the contract.'],
  ['Phase 4', 'Keep Nike ecosystem integration bridge-only unless a real vendor API becomes available.', 'Avoids overbuilding on a weak direct path.'],
  ['Phase 5', 'Expose source-health, freshness, and retirement rules in ops tooling.', 'Keeps the integration matrix maintainable.'],
];

const STRATEGIC_CARDS = [
  {
    title: 'Best Technical Fit',
    accent: 'blue' as const,
    body: <BulletList items={['Garmin, Polar, and Withings give us the cleanest blend of signal richness and integration realism.', 'Samsung Health / Health Connect is essential for Android reach.', 'Catapult matters when the customer is a team, not just a single athlete.']} />,
  },
  {
    title: 'Best Alliance Fit',
    accent: 'green' as const,
    body: <BulletList items={['Garmin brings broad consumer trust.', 'Withings opens wellness and biometric adjacency.', 'Catapult opens the strongest enterprise and team-performance lane.']} />,
  },
  {
    title: 'Do Not Overbuild',
    accent: 'amber' as const,
    body: <BulletList items={['Nike ecosystem should stay bridge-only until a true API path appears.', 'Fitbit is valuable, but it should not outrank higher-fidelity training partners.', 'Every new source still has to normalize into the same canonical health-context pipeline.']} />,
  },
];

const DEVICE_LANES = [
  {
    title: 'Direct Vendor Lane',
    body: 'Use the device or vendor cloud API directly when the platform provides one and the consent model supports stable sync.',
    owner: 'Device connector layer',
  },
  {
    title: 'Platform Bridge Lane',
    body: 'Use HealthKit or Health Connect when the device is primarily meant to be consumed through the phone OS health stack.',
    owner: 'Mobile platform layer',
  },
  {
    title: 'Enterprise Feed Lane',
    body: 'Use team / club / pro systems like Catapult as workload and session feeds, then normalize them into the same athlete snapshot.',
    owner: 'Enterprise integrations',
  },
  {
    title: 'Bridge-Only Lane',
    body: 'If a vendor has no stable public integration path, keep it as a mirrored or secondary source rather than a first-class adapter.',
    owner: 'Strategy gate',
  },
];

const RUN_SOURCE_HIERARCHY_ROWS = [
  ['1', 'Apple Watch live workout lane', 'Primary live source for heart rate, calories, pace, distance, and workout-state truth when a watch workout is active or mirrored into the run session.', 'This is the preferred wearable runtime whenever the athlete has an Apple Watch available.'],
  ['2', 'Oura ring wearable lane', 'Secondary source for biometrics, workout-window validation, calorie and exertion reconciliation, and post-run enrichment when Apple Watch is not active.', 'Oura can strengthen heart-rate and workout-context confidence, but it should not own GPS pace or route distance.'],
  ['3', 'Phone-led RunTrackingService lane', 'Fallback source for session timer, GPS route, outdoor pace, outdoor distance, treadmill estimation, and algorithm calories when no stronger wearable signal is active.', 'This is the honest fallback when the athlete does not have a live wearable source in play.'],
];

const RUN_METRIC_OWNERSHIP_ROWS = [
  ['Workout state', 'App session plus Apple Watch when active', 'The app still owns the user-facing run state, but Apple Watch becomes the strongest proof that the workout is truly live.'],
  ['Outdoor route / GPS distance', 'Apple Watch first, phone GPS fallback', 'Oura does not replace GPS ownership for route or live pace.'],
  ['Treadmill distance', 'Apple Watch first, phone motion fallback, then manual confirmation', 'If the phone is not on-body, the runtime should not fabricate precise treadmill distance from weak motion.'],
  ['Calories burned', 'Apple Watch first, Oura-assisted reconciliation second, algorithm fallback third', 'Use Oura to refine confidence and fill biometrics gaps when watch data is unavailable, but keep manual estimation as the floor.'],
  ['Heart rate / exertion', 'Apple Watch first, Oura second, none if unavailable', 'Oura is valuable for exertion and workout-window enrichment when the athlete is ring-only.'],
  ['Recovery context after the run', 'Oura / HealthKit / PulseCheck health-context pipeline', 'This should continue flowing into the broader readiness and recovery system after session closeout.'],
];

const RUN_GUARDRAIL_ROWS = [
  ['Phone-led run shows no meaningful movement', 'After 45 seconds of low movement, send a loud reminder that the phone needs to be on the athlete’s body for accurate phone-led tracking.', 'Keeps treadmill and pocket-free runs from silently degrading into bad distance and pace data.'],
  ['Run appears to still be active after the athlete stops moving', 'After 150 seconds of low movement, send a second reminder and show an in-app modal asking whether to end the run.', 'Prevents forgotten active runs from inflating duration and calories.'],
  ['Custom reminder voice assets', 'Generate long-form spoken reminders in the admin voice console, then export the chosen files into the iOS app bundle.', 'Current runtime still uses the bundled alert sound until the custom files are swapped in.'],
];

const RUN_SYSTEM_COMPONENT_ROWS = [
  ['Run session controller', 'Owns start, pause, resume, end, and the user-visible state of the run.', 'The app experience should always have one authoritative session state even if multiple sensors contribute data.'],
  ['Source arbitration layer', 'Chooses which live or post-run source has authority for each metric domain.', 'This layer applies the Apple Watch > Oura enrichment > phone fallback hierarchy.'],
  ['Live metric collectors', 'Read GPS, motion, workout, and biometric signals from the currently active source set.', 'These collectors should remain source-aware so the runtime can explain provenance.'],
  ['Reconciliation and enrichment layer', 'Merges Oura and other late-arriving signals into the finished run window.', 'This is where calorie confidence, exertion confidence, and workout-window validation should improve after the run.'],
  ['Guardrail and attention layer', 'Detects low-confidence tracking conditions and prompts the athlete when the session needs intervention.', 'Examples include phone-not-on-body detection and stale active-run reminders.'],
  ['Canonical run record writer', 'Persists the final run with metric provenance, confidence, and source annotations.', 'Downstream analytics and coaching layers should consume one normalized run record, not raw device payloads.'],
];

const RUN_DECISION_INPUT_ROWS = [
  ['Is an Apple Watch workout available for this session?', 'If yes, Apple Watch becomes the strongest live metrics source.'],
  ['Is the athlete wearing an Oura ring with available sync data?', 'If yes and Apple Watch is absent, Oura can enrich biometrics and validate the run window.'],
  ['Is the phone producing trustworthy on-body GPS or motion?', 'If yes, the phone runtime can own the fallback lane for pace, distance, and timer continuity.'],
  ['Is the run indoor or outdoor?', 'This determines whether GPS, motion, or manual confirmation should dominate the distance model.'],
  ['Has movement confidence degraded during the session?', 'If yes, the app should warn the athlete and lower confidence instead of silently overclaiming precision.'],
];

const RUN_CANONICAL_OUTPUT_ROWS = [
  ['Session lifecycle', 'Start time, pause segments, resume segments, end time, total elapsed duration', 'App session controller'],
  ['Distance and pace', 'Outdoor route distance, live pace, splits, treadmill confidence or manual confirmation', 'Apple Watch first, phone fallback'],
  ['Energy and biometrics', 'Calories, heart rate, exertion confidence, workout-window validation', 'Apple Watch first, Oura second, algorithm fallback'],
  ['Source provenance', 'Primary source, secondary enrichment source, fallback reason, freshness markers', 'Source arbitration layer'],
  ['Confidence flags', 'Low-motion warning, phone-off-body suspicion, stale-run intervention, mirrored-data state', 'Guardrail layer'],
  ['Health-context handoff', 'Recovery and readiness inputs that flow into PulseCheck after session closeout', 'Oura / HealthKit / canonical health-context pipeline'],
];

const RUN_E2E_CHECKLIST_ROWS = [
  ['Foundation', 'Define a formal run-source enum and provenance model for Apple Watch, Oura, and phone fallback.', 'Every saved run can declare primary source, secondary source, fallback reason, and confidence state.'],
  ['Foundation', 'Create the source arbitration layer that decides who owns each metric domain.', 'The runtime can choose Apple Watch, Oura enrichment, or phone fallback without scattering precedence logic.'],
  ['Session Runtime', 'Refactor the run start flow so one canonical session controller opens every run.', 'App-started runs no longer bypass wearable arbitration or create source-specific session paths.'],
  ['Session Runtime', 'Promote Apple Watch to the live metrics source when a watch workout path is available.', 'App-started runs can use watch heart rate, calories, pace, and distance without requiring a separate watch-first user action.'],
  ['Session Runtime', 'Keep RunTrackingService as the explicit fallback lane for no-watch scenarios.', 'Phone-led runs still work reliably when no wearable source is available.'],
  ['Oura Layer', 'Implement Oura run-window reconciliation for ring-only sessions.', 'Completed runs can pull Oura biometrics, workout-window evidence, and calorie or exertion refinement without pretending Oura owns GPS.'],
  ['Oura Layer', 'Define Oura freshness and delay handling rules.', 'The runtime knows when Oura enrichment is ready, stale, partial, or unavailable.'],
  ['Indoor / Treadmill', 'Add low-confidence treadmill handling when the phone is off-body.', 'The app warns the athlete, lowers confidence, and requests confirmation instead of inventing precise treadmill distance.'],
  ['Guardrails', 'Ship phone-off-body detection and still-active-run intervention as productized runtime rules.', 'Users are warned during bad tracking states and can close mistaken active sessions cleanly.'],
  ['Voice + Notifications', 'Bundle branded spoken reminder sounds generated from the admin voice console into the iOS app.', 'Run alerts use the customer-facing voice assets instead of the temporary generic alert sound.'],
  ['Persistence', 'Expand the canonical run record with provenance, confidence, reconciliation, and intervention fields.', 'Downstream analytics, coaching, and recap surfaces can explain where each metric came from.'],
  ['Health Context', 'Write post-run recovery and readiness handoff logic into the health-context pipeline.', 'Run completion can influence PulseCheck context with honest source labeling.'],
  ['UX', 'Update active run, summary, and device settings surfaces to explain source ownership and confidence clearly.', 'Athletes can tell whether a run used Apple Watch, Oura enrichment, or phone fallback.'],
  ['Ops', 'Add operator visibility for source health, stale wearable links, reconciliation failures, and low-confidence sessions.', 'The team can support failures without digging through raw logs.'],
  ['QA', 'Create end-to-end test scenarios for outdoor, treadmill, Apple Watch, Oura-only, dual-device, and no-device runs.', 'The full hierarchy is validated under realistic session conditions before release.'],
  ['Launch', 'Define release gating, rollout sequence, analytics success criteria, and post-launch monitoring.', 'The system ships with measurable quality thresholds instead of a blind rollout.'],
];

const RUN_RELEASE_GATES = [
  'Apple Watch app-started runs correctly promote the watch to the strongest live source whenever the watch path is available.',
  'Oura-only runs preserve phone-led route and pace while successfully enriching calories, exertion, or workout-window confidence after closeout.',
  'Phone-off-body and stale-run reminders trigger at the intended thresholds and never silently trap the user in a bad session.',
  'Saved runs expose enough provenance for summary UI, support workflows, and downstream analytics to explain the source of truth.',
  'Indoor, outdoor, low-connectivity, and delayed-sync scenarios all fail honest instead of producing silent false precision.',
];

const RUN_SESSION_LIFECYCLE = [
  {
    title: 'Session Start',
    body: 'When the athlete taps start, the runtime opens one canonical run session, inspects available wearable and device sources, and chooses the initial live-source posture for the run.',
    owner: 'Run session controller',
  },
  {
    title: 'Live Tracking',
    body: 'During the run, Apple Watch should own live workout metrics when present. If the watch is not active, the phone runtime owns pace and distance while Oura remains a secondary biometric and validation lane.',
    owner: 'Source arbitration layer',
  },
  {
    title: 'Guardrail Evaluation',
    body: 'The runtime continuously checks movement confidence and active-run plausibility. If the phone appears to be off-body or the run looks unintentionally left on, the athlete is prompted to correct the session.',
    owner: 'Guardrail layer',
  },
  {
    title: 'Session Closeout',
    body: 'When the athlete ends the run, the system finalizes live metrics, records the primary source, and preserves any guardrail or confidence flags that occurred during the session.',
    owner: 'Canonical run writer',
  },
  {
    title: 'Post-Run Reconciliation',
    body: 'After closeout, Oura and other delayed signals can enrich the completed run window to improve calorie confidence, exertion understanding, and recovery-context handoff without rewriting source provenance dishonestly.',
    owner: 'Reconciliation layer',
  },
];

const DeviceIntegrationStrategyOverviewDoc: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Health Context"
        title="Device Integration Strategy"
        version="Version 0.1 | March 17, 2026"
        summary="Operating reference for how Pulse Check should integrate wearables, platform bridges, and elite performance systems. The goal is to keep device integrations source-aware, freshness-aware, and normalized into the same canonical athlete-context pipeline instead of creating one-off adapters."
        highlights={[
          {
            title: 'One Pipeline',
            body: 'Every device or platform should normalize into the same source-record and snapshot system before Nora or coach surfaces consume it.',
          },
          {
            title: 'Direct Then Bridge',
            body: 'Prefer direct vendor APIs where available, but treat HealthKit and Health Connect as first-class platform lanes rather than second-class fallbacks.',
          },
          {
            title: 'Alliance-Aware',
            body: 'The wishlist should balance data quality with strategic partnerships, not just consumer volume.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Strategy artifact for deciding which device and platform integrations Pulse Check should pursue, how they should be classified, and how they should feed the canonical athlete-context pipeline."
        sourceOfTruth="This page is the reference for wearable, platform, and team-system integrations. It explains the integration taxonomy, wishlist tiers, routing rules, and why the same canonical contract must absorb every source."
        masterReference="Use this page when scoping new device work, deciding whether a vendor belongs on the roadmap, or checking how a vendor should map into source records and snapshots."
        relatedDocs={[
          'Health Context Architecture',
          'Athlete Context Snapshot Spec',
          'Health Context Source Record Spec',
          'Health Context Snapshot Assembler Spec',
          'Health Context Persistence & Storage Spec',
          'Health Context Operational Orchestration Spec',
          'Oura Integration Strategy',
        ]}
      />

      <SectionBlock icon={Activity} title="Current Baseline">
        <DataTable columns={['Lane', 'Current Role', 'Notes']} rows={CURRENT_BASELINE_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Important Boundary"
            accent="blue"
            body="Fit With Pulse still matters as the shared consumer training-context source, and Macra matters as the nutrition source, but neither is a device integration. This document focuses on devices and platforms that can feed the same canonical health-context pipeline."
          />
          <InfoCard
            title="Current Strength"
            accent="green"
            body="Apple Watch / HealthKit and Oura already give PulseCheck a real starting point: one platform bridge lane and one dual-path recovery lane. The next step is expanding that model into a broader device system."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Database} title="Integration Taxonomy">
        <DataTable columns={['Class', 'What It Means', 'Examples']} rows={INTEGRATION_TAXONOMY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Wishlist And Partnership Priorities">
        <DataTable columns={['Tier', 'Target', 'Why It Belongs', 'Preferred Path']} rows={WISHLIST_ROWS} />
        <CardGrid columns="md:grid-cols-3">
          {STRATEGIC_CARDS.map((card) => (
            <InfoCard key={card.title} title={card.title} accent={card.accent} body={card.body} />
          ))}
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Link2} title="Source-Record Mapping">
        <DataTable columns={['Source', 'Canonical Record Type', 'Primary Payload']} rows={SOURCE_RECORD_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Routing And Freshness">
        <DataTable columns={['Priority', 'Lane', 'Rule']} rows={ROUTING_ROWS} />
        <div className="mt-4">
          <DataTable columns={['Source State', 'Meaning', 'Runtime Rule']} rows={FRESHNESS_ROWS} />
        </div>
      </SectionBlock>

      <SectionBlock icon={Database} title="Device Integration Lanes">
        <DataTable columns={['Lane', 'When To Use It', 'Owner']} rows={DEVICE_LANES.map((lane) => [lane.title, lane.body, lane.owner])} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Key Risks">
        <DataTable columns={['Risk', 'Impact', 'Mitigation']} rows={RISKS_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Rollout Recommendation">
        <DataTable columns={['Phase', 'Scope', 'Why']} rows={ROADMAP_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Suggested First Wave"
            accent="green"
            body="If we optimize for both technology and alliance value, the first wave should be Garmin, Polar, Withings, and Samsung Health / Galaxy Watch, with Catapult added for enterprise and team accounts."
          />
          <InfoCard
            title="Strategy Rule"
            accent="amber"
            body="No matter how many vendors we add, every one of them should land in the same canonical health-context pipeline. That is what keeps PulseCheck from becoming a pile of isolated device adapters."
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

const RunWearableSourceOfTruthDoc: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Run Runtime"
        title="Run Wearable System Outline"
        version="Version 0.1 | March 18, 2026"
        summary="System outline for how Pulse Check should run active workout tracking across Apple Watch, Oura, and phone-led fallback logic. This document defines the run-session architecture, source hierarchy, metric ownership rules, safeguard behaviors, and the canonical output shape the runtime should produce."
        highlights={[
          {
            title: 'Apple Watch Wins Live',
            body: 'If an Apple Watch is available for the active workout, it should outrank every other runtime source for live biometrics and workout truth.',
          },
          {
            title: 'Oura Enriches And Validates',
            body: 'Oura should strengthen calorie, exertion, and workout-window confidence when watch data is absent, but it should not pretend to own GPS pace or route distance.',
          },
          {
            title: 'Manual Tracking Is The Floor',
            body: 'RunTrackingService remains the explicit fallback when no stronger wearable signal is active, and the app should fail honest when confidence drops.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="System design artifact for active run sessions inside Fit With Pulse and Pulse Check. It explains which runtime components exist, how source arbitration should work, which metrics belong to which device lane, and how guardrails preserve session quality."
        sourceOfTruth="This page is the outline document for the run wearable system. Use it whenever we implement or revise run-session logic involving Apple Watch, Oura, phone-led tracking, confidence rules, or the final canonical run record."
        masterReference="Use this page when building the run session controller, source arbitration layer, reconciliation layer, guardrail behaviors, and the canonical run persistence flow."
        relatedDocs={[
          'Device Integration Strategy',
          'Oura Integration Strategy',
          'Health Context Architecture',
          'Health Context Operational Orchestration Spec',
          'AI Voice Console',
        ]}
      />

      <SectionBlock icon={Database} title="System Components">
        <DataTable columns={['Component', 'Responsibility', 'System Rule']} rows={RUN_SYSTEM_COMPONENT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Run Session Lifecycle">
        <StepRail steps={RUN_SESSION_LIFECYCLE} />
      </SectionBlock>

      <SectionBlock icon={Link2} title="Source Arbitration Inputs">
        <DataTable columns={['Decision Input', 'Why It Matters']} rows={RUN_DECISION_INPUT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Activity} title="Run Source Hierarchy">
        <DataTable columns={['Priority', 'Runtime Source', 'What It Owns', 'Rule']} rows={RUN_SOURCE_HIERARCHY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Metric Ownership Boundaries">
        <DataTable columns={['Metric', 'Preferred Owner', 'Boundary Rule']} rows={RUN_METRIC_OWNERSHIP_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Architecture Rule"
            accent="blue"
            body="Do not treat Oura as a live GPS replacement. If the athlete only has the ring, Pulse Check should still use the phone-led run runtime for route and pace while Oura strengthens the biometrics and session-confidence layer."
          />
          <InfoCard
            title="Honest Degradation"
            accent="amber"
            body="If the phone is sitting on a treadmill or otherwise not on-body, the app should warn the athlete and lower confidence rather than inventing precise distance from weak motion."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Smartphone} title="Run Guardrails And Reminders">
        <DataTable columns={['Condition', 'Runtime Behavior', 'Why It Exists']} rows={RUN_GUARDRAIL_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Canonical Run Outputs">
        <DataTable columns={['Output Domain', 'What Must Be Persisted', 'Primary Owner']} rows={RUN_CANONICAL_OUTPUT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="End-To-End Completion Checklist">
        <DataTable columns={['Workstream', 'What Must Be Completed', 'Definition Of Complete']} rows={RUN_E2E_CHECKLIST_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Build Order"
            accent="blue"
            body="Start with the source model and arbitration layer, then wire session runtime promotion, then add Oura reconciliation, then harden the UX and ops layers. That keeps the implementation sequence aligned with the system architecture instead of stacking ad hoc patches."
          />
          <InfoCard
            title="Release Gates"
            accent="green"
            body={<BulletList items={RUN_RELEASE_GATES} />}
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Decision Rules">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="If Apple Watch Is Active"
            accent="green"
            body={<BulletList items={['Use Apple Watch as the strongest live workout source.', 'Let the phone remain the control surface and UI host.', 'Treat Oura as additional context only if it later helps with recovery or validation.']} />}
          />
          <InfoCard
            title="If Only Oura Is Active"
            accent="blue"
            body={<BulletList items={['Use RunTrackingService for timer, pace, and distance.', 'Use Oura for workout-window validation, biometrics enrichment, and calorie or exertion reconciliation.', 'Do not overclaim live distance precision from the ring alone.']} />}
          />
          <InfoCard
            title="If No Wearable Is Active"
            accent="amber"
            body={<BulletList items={['Fall back to the manual phone-led runtime.', 'Warn the athlete if the phone does not appear to be on-body.', 'Prefer low-confidence UX over silently bad data.']} />}
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

const DEVICE_INTEGRATION_PAGES: ArtifactPageEntry[] = [
  {
    id: 'device-integration-strategy',
    label: 'Device Integration Strategy',
    subtitle: 'Cross-device taxonomy, wishlist priorities, routing, and rollout guidance.',
    icon: FileText,
    accent: '#c084fc',
    render: () => <DeviceIntegrationStrategyOverviewDoc />,
  },
  {
    id: 'device-partnership-matrix',
    label: 'Partnership Matrix',
    subtitle: 'Which vendors fit data access, platform, enterprise, or brand-only partnership shapes.',
    icon: Handshake,
    accent: '#38bdf8',
    render: () => <PulseCheckDeviceIntegrationPartnershipMatrixTab />,
  },
  {
    id: 'oura-integration-strategy',
    label: 'Oura Integration Strategy',
    subtitle: 'Direct Oura lane, HealthKit fallback, merge rules, and rollout recommendation.',
    icon: Moon,
    accent: '#22c55e',
    render: () => <PulseCheckOuraIntegrationStrategyTab />,
  },
  {
    id: 'oura-cognitive-correlation-spec',
    label: 'Oura Cognitive Correlation Spec',
    subtitle: 'First source-specific child spec for feeding Oura physiology into the broader correlation engine.',
    icon: Database,
    accent: '#34d399',
    render: () => <PulseCheckOuraCognitiveCorrelationSpecTab />,
  },
  {
    id: 'run-wearable-source-of-truth',
    label: 'Run Source Of Truth',
    subtitle: 'Apple Watch precedence, Oura enrichment, phone fallback, and run safeguard rules.',
    icon: Activity,
    accent: '#14b8a6',
    render: () => <RunWearableSourceOfTruthDoc />,
  },
  {
    id: 'school-wearable-bundle-plan',
    label: 'School Bundle Plan',
    subtitle: 'Bundled school offer, OEM shortlist, and current FDA, Bluetooth, and FCC posture.',
    icon: Building2,
    accent: '#f97316',
    render: () => <PulseCheckSchoolWearableBundlePlanTab />,
  },
];

const PulseCheckDeviceIntegrationStrategyTab: React.FC = () => {
  return (
    <ArtifactPageLibrary
      eyebrow="Pulse Check · Device & Wearable Integrations"
      title="Device & Wearable Integrations Library"
      summary="Integration parent artifact with internal pages for device strategy, run source-of-truth rules, partnership prioritization, and the Oura-specific connector lane."
      entries={DEVICE_INTEGRATION_PAGES}
    />
  );
};

export default PulseCheckDeviceIntegrationStrategyTab;
