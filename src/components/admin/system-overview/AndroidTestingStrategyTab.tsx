import React from 'react';
import { CheckCircle2, Command, Database, ShieldCheck, Smartphone, TestTube2, Wrench } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const POSITION_ROWS = [
  ['Primary Android regression layer', 'Instrumented Compose tests in `app/src/androidTest`', 'Android already has Compose UI and stable `testTag` patterns in some surfaces. We should keep building on native instrumentation instead of forcing Android through a web-only harness.'],
  ['Full-system E2E layer', 'Run `devDebug` against the dev Firebase project', 'This matches the Playwright safety model and keeps write-path automation isolated from production data.'],
  ['Mutation policy', 'Opt-in write suites only', 'Read-only smoke should run by default; invite creation, meal writes, and other mutations should require an explicit write flag or write suite.'],
  ['Cross-platform fixture rule', 'Use a shared `e2e-android-<runId>` namespace', 'Android should follow the same prefix-and-sweep cleanup model the web harness already uses so test artifacts are easy to find and delete.'],
];

const CURRENT_ROWS = [
  ['JVM unit tests', '`app/src/test/java/ai/fitwithpulse/pulse/*`', 'Model + routing coverage exists today, but it does not exercise native UI or Firebase-backed flows.'],
  ['Compose instrumentation', '`app/src/androidTest/java/ai/fitwithpulse/pulse/ui/club/ClubActivationComponentsTest.kt`', 'Current Android instrumentation coverage is focused on club activation component contracts.'],
  ['Scan food instrumentation', '`app/src/androidTest/java/ai/fitwithpulse/pulse/ui/nutrition/ScanFoodScreenTest.kt`', 'The rejected review path now has deterministic native UI coverage for intro, confirmation, error recovery, and result actions.'],
  ['Debug-only test hooks', '`app/src/debug/java/ai/fitwithpulse/pulse/testing/AndroidDebugTestHooks.kt`', 'Android now has a debug-only sign-in + cleanup entry point for dev-Firebase automation runs.'],
  ['Native testability hooks', '`testTag(...)` on club activation surfaces and scan-food actions', 'The repo already has the beginnings of a stable native identifier contract.'],
  ['Coverage gap', 'Harness exists for auth + meal namespace cleanup, but only the first end-to-end flows are wired', 'Android now has the first harness pieces, but broader shared-doc cleanup and more feature flows still need to be added.'],
];

const COMMAND_ROWS = [
  ['Run JVM unit tests', '`./gradlew testDevDebugUnitTest`', 'Fast feedback on pure Kotlin logic and routing behavior.'],
  ['Run all connected Android instrumentation tests', '`./gradlew connectedDevDebugAndroidTest`', 'Runs Compose/Espresso instrumentation against a connected emulator or device.'],
  ['Run a single instrumentation class', '`./gradlew connectedDevDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=ai.fitwithpulse.pulse.ui.club.ClubActivationComponentsTest`', 'Useful while tightening one Android surface at a time.'],
  ['Prepare an emulator for Android smoke runs', '`./scripts/prepare-test-emulator.sh`', 'Stabilizes the emulator before native Android automation starts.'],
  ['Run direct instrumentation without Gradle UTP', '`./scripts/run-android-instrumentation.sh ai.fitwithpulse.pulse.ui.nutrition.ScanFoodScreenTest`', 'Useful when the emulator is healthier with direct APK install + `am instrument` than with `connectedAndroidTest`.'],
  ['Build the automation target', '`./gradlew assembleDevDebug assembleDevDebugAndroidTest`', 'Builds the app and instrumentation APKs for local devices or a future Test Lab job.'],
];

const CONTRACT_ROWS = [
  ['Environment', '`devDebug` only for automation', 'Automated Android runs should force the dev Firebase project the same way Playwright does.'],
  ['Identity', 'Dedicated test account(s)', 'Use seeded Android test users instead of personal accounts so auth state is deterministic and disposable.'],
  ['Data namespace', '`e2e-android-<runId>` prefix on every created record', 'Apply the namespace to emails, invite ids, meal ids, round ids, storage paths, and any searchable labels.'],
  ['Cleanup', 'Prefix sweep at test start and test end', 'If cleanup misses at teardown, the next run should still clear leftovers before creating new fixtures.'],
  ['Selectors', '`testTag` for Compose + `contentDescription` for system controls', 'Compose nodes should be addressable without coordinate taps; UiAutomator should only cover system UI like permissions, camera, and pickers.'],
];

const SUITE_ROWS = [
  ['Auth smoke', 'Launch app, sign in with dev test account, land on home', 'Current'],
  ['Food scan recovery', 'Scan Food -> analyze -> success review or recoverable error -> save/back path', 'Current'],
  ['Food label scan', 'Scan Label -> result -> add meal/history open', 'Next'],
  ['Club activation', 'Join gate, onboarding, intro composer, settings save', 'Current + expand'],
  ['Rounds + deep links', 'Open shared round link, view detail, join if write paths enabled', 'Target'],
  ['Workout execution', 'Start an active workout, complete, and verify summary persistence', 'Target'],
];

const COVERAGE_ROWS = [
  ['App shell + navigation', 'Intro, start screen, auth routing, bottom nav, deep-link entry, startup safety', '15%', '80%', 'We have smoke hooks and some tags, but startup ANR coverage and route regression coverage are still thin.'],
  ['Authentication', 'Sign in, sign up, reset password, auth persistence, seeded test-user entry', '35%', '90%', 'Android has the first auth smoke, but not the full auth matrix or failure-state coverage yet.'],
  ['Nutrition', 'Scan Food, Scan Label, meal save, history, cleanup-safe writes', '30%', '85%', 'Scan Food is now protected; Label scan, meal history, and dev-data write verification are the next must-cover surfaces.'],
  ['Workouts', 'Workout creation, active sessions, completion, summary persistence, history/calendar', '5%', '75%', 'This is the largest surface area in the Android UI tree and the biggest remaining automation gap.'],
  ['Rounds + run rounds', 'Open, join, progress, shared-link/deep-link entry, round detail states', '5%', '70%', 'Round flows are high-value and high-risk, but Android currently has almost no automated regression protection here.'],
  ['Club + social', 'Club activation, onboarding, intro gating, creator settings, chat entry', '25%', '75%', 'Club activation components are covered, but real club detail and posting flows still need native smoke coverage.'],
  ['Profile + settings', 'Profile rendering, edit profile, settings access, privacy/legal access paths', '5%', '60%', 'These are lower-risk than workout execution, but they still need shell-level regression tests.'],
  ['Health + sensors', 'Health Connect, permissions, capture screens, state rendering, recovery paths', '0%', '55%', 'This is the hardest Android-only surface and should be covered after the core business journeys are stable.'],
  ['Payments + subscription', 'Offering load, purchase entry, entitlement state rendering, restore path', '0%', '65%', 'Revenue surfaces need smoke coverage, but only after auth, food, workout, and round flows are stable.'],
];

const COVERAGE_POLICY_ROWS = [
  ['Weighted total Android automation coverage', '12-15%', '72%', 'Current figure is an audit estimate from the repo structure and existing tests, not a JaCoCo export.'],
  ['Critical path coverage', '20%', '95%', 'Critical paths means auth, home shell, scan food, scan label, one workout completion path, one round join/open path, and club activation gates.'],
  ['Release-blocking minimum', 'Not enforced', '55%', 'Below this, Android should be treated as release-risky until smoke coverage is restored.'],
  ['Mutation-safe write coverage', '10%', '80%', 'Write-path tests only count when they run on dev Firebase and prove cleanup of `e2e-android-*` artifacts.'],
];

const RUN_STEPS = [
  {
    title: 'Boot Android automation on dev Firebase only',
    body: 'Treat Android automation the same as Playwright: all automated runs use the dev Firebase environment and never point at production by default.',
    owner: 'Build + QA',
  },
  {
    title: 'Seed a run namespace before any write happens',
    body: 'Generate a run id like `e2e-android-20260314-1530` and attach it to every created identifier so cleanup can sweep by prefix.',
    owner: 'Harness',
  },
  {
    title: 'Keep Compose flows deterministic',
    body: 'Use stable `testTag` contracts for in-app nodes, and only fall back to UiAutomator when Android system UI owns the interaction.',
    owner: 'Android app',
  },
  {
    title: 'Run read-only smoke before write suites',
    body: 'Prove the app launches, authenticates, loads real screens, and navigates correctly before enabling mutation coverage.',
    owner: 'CI + local operator',
  },
  {
    title: 'Sweep prefixed data after every run',
    body: 'Delete prefixed Firestore docs, Auth users, and Storage objects in teardown, then repeat the same sweep at suite start for safety.',
    owner: 'Harness',
  },
];

const AndroidTestingStrategyTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Native Android Testing"
        title="Android Testing Strategy"
        version="Version 1.0 | March 14, 2026"
        summary="Operational artifact for how Pulse should cover Android with native instrumentation and a dev-Firebase end-to-end harness. This page documents the current baseline, the recommended Android E2E contract, and how Android should align with the existing Playwright namespace-and-cleanup model."
        highlights={[
          {
            title: 'Android Needs Its Own First-Class Harness',
            body: 'Playwright and XCUITest are not enough for Android app-review risk, native navigation, camera flows, and permission-handling regressions.',
          },
          {
            title: 'Reuse The Existing Dev-Data Safety Pattern',
            body: 'Android should create namespaced `e2e-android-*` data in the dev Firebase project and clean it up by prefix, exactly like the web harness already does.',
          },
          {
            title: 'Build Around Stable Native Contracts',
            body: 'Compose `testTag` ids should be treated as a test contract so Android automation can reach real screens without brittle coordinate taps.',
          },
          {
            title: 'Coverage Should Be Managed By Product Slice',
            body: 'Android should be audited in sections with explicit percentage targets, not treated as one undifferentiated test bucket.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Native Android testing artifact for instrumentation coverage, dev-database safety rules, and full-system E2E direction."
        sourceOfTruth="This document is authoritative for how Android automation should be run, what environment it should target, and how Android test data should be namespaced and cleaned up."
        masterReference="Use this page when adding Android UI tests, designing the Android E2E harness, or deciding how Android aligns with Playwright and XCUITest."
        relatedDocs={['Playwright Testing Strategy', 'XCUITest Strategy', 'Fit With Pulse Android product handbook']}
      />

      <SectionBlock icon={ShieldCheck} title="Strategic Position">
        <DataTable columns={['Decision Area', 'Recommended Position', 'Why']} rows={POSITION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Smartphone} title="Current Baseline">
        <DataTable columns={['Area', 'Current State', 'What It Means']} rows={CURRENT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Command} title="Run Commands">
        <DataTable columns={['Action', 'Command', 'Use']} rows={COMMAND_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Harness Contract">
        <DataTable columns={['Concern', 'Recommended Contract', 'Why It Matters']} rows={CONTRACT_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Namespace example"
            accent="green"
            body={
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-black/30 p-3 text-xs text-zinc-200">
                {`runId = e2e-android-20260314-1530
email = e2e-android-20260314-1530-athlete@pulse.test
mealId = e2e-android-20260314-1530-meal-001
roundId = e2e-android-20260314-1530-round-001
storagePath = food/e2e-android-20260314-1530/meal-001.jpg`}
              </pre>
            }
          />
          <InfoCard
            title="Cleanup rule"
            accent="amber"
            body={<BulletList items={[
              'Sweep the namespace before the suite starts.',
              'Delete all prefixed records again in teardown.',
              'Fail the run if cleanup leaves persistent test data behind.',
              'Treat cleanup as shared infrastructure, not one-off logic inside each test.',
            ]} />}
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={TestTube2} title="Recommended Suite Inventory">
        <DataTable columns={['Flow', 'Expectation', 'Status']} rows={SUITE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={CheckCircle2} title="Coverage Audit By Section">
        <InfoCard
          title="Audit framing"
          accent="blue"
          body="These percentages are an operating estimate of Android automation coverage by product area as of March 14, 2026. They describe how much of each section is protected by meaningful automated regression coverage, not a compiler-generated line-coverage report."
        />
        <DataTable columns={['Section', 'What Counts', 'Current', 'Target', 'Audit Note']} rows={COVERAGE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Coverage Percentage Policy">
        <DataTable columns={['Coverage Lens', 'Current', 'Target', 'Meaning']} rows={COVERAGE_POLICY_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Recommended sequencing"
            accent="green"
            body={<BulletList items={[
              'First get auth, app shell, and nutrition to target.',
              'Then cover one real workout completion path and one round join/open path.',
              'After that, expand club/social, profile/settings, and subscription.',
              'Leave Health Connect and sensor-heavy flows for a dedicated Android-only pass once emulator stability is solved.',
            ]} />}
          />
          <InfoCard
            title="How Android should report coverage"
            accent="amber"
            body={<BulletList items={[
              'Track both section-level coverage and weighted total coverage.',
              'Treat critical-path coverage as a separate release gate from total coverage.',
              'Do not count write tests unless they prove dev-data cleanup.',
              'Do not count brittle coordinate taps as durable automation coverage.',
            ]} />}
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Wrench} title="How The Android E2E Model Should Work">
        <StepRail steps={RUN_STEPS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="What Android should copy from Playwright"
            accent="blue"
            body={<BulletList items={[
              'Dev Firebase by default for every automated run.',
              'Opt-in write coverage instead of always-on mutations.',
              'Shared namespace prefix for artifact creation and cleanup.',
              'Smoke-first posture before broader write-path coverage.',
            ]} />}
          />
          <InfoCard
            title="What stays Android-specific"
            accent="purple"
            body={<BulletList items={[
              'Camera, gallery picker, and permission prompts need native coverage.',
              'Compose `testTag` contracts should replace coordinate-driven taps.',
              'UiAutomator should only be used where Android system UI is in the way.',
              'Real emulator/device runs matter for Play review-sensitive flows.',
            ]} />}
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={CheckCircle2} title="Practical Next Step">
        <InfoCard
          title="Recommended build order"
          accent="red"
          body={<BulletList items={[
            'Treat the next Android milestone as a coverage audit milestone: get section-level owners, current percentages, and target percentages accepted by the team.',
            'Close the biggest risk gap first by taking App shell, Authentication, and Nutrition to their target percentages before expanding the rest of the app.',
            'After that, take one Workout path and one Round path end to end so critical-path coverage climbs toward the 95% target.',
            'Once the clean Android test AVD is stable, wire these section percentages into a release gate and weekly regression review.',
          ]} />}
        />
      </SectionBlock>
    </div>
  );
};

export default AndroidTestingStrategyTab;
