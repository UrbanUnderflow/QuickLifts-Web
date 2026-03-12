import React from 'react';
import { CheckCircle2, Command, Layers3, ShieldCheck, Smartphone, TestTube2, Wrench } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const POSITION_ROWS = [
  ['Primary native iOS regression layer', 'XCUITest in the existing `QuickLiftsUITests` target', 'We already have the test target, and the new club activation flow now exposes stable accessibility ids for native automation.'],
  ['Launch strategy', 'Split between deterministic mock runs and live diagnostics runs', 'Regression tests should stay stable on mock data, while production investigations should use an explicit live harness instead of overloading the same suite.'],
  ['Fixture policy', 'Mock Wunna Run Club with activation enabled at launch', 'This keeps onboarding and intro tests stable while still exercising the real club detail surface.'],
  ['Manual QA role', 'Keep device walkthroughs for visual trust and gesture quality', 'Modal layering, chat readability, and creator confidence still need human review alongside automation.'],
];

const COMMAND_ROWS = [
  ['Open the test target in Xcode', '`QuickLiftsUITests`', 'Use for local iteration and screenshot-friendly debugging.'],
  ['Run the whole UI suite from CLI', '`xcodebuild test -scheme QuickLifts -destination \"platform=iOS Simulator,name=iPhone 16\" -only-testing:QuickLiftsUITests`', 'Runs the deterministic club activation suite without relying on manual navigation.'],
  ['Run a single club test', '`xcodebuild test -scheme QuickLifts -destination \"platform=iOS Simulator,name=iPhone 16\" -only-testing:QuickLiftsUITests/QuickLiftsUITests/testClubActivationFlowCompletesIntroFromComposer`', 'Useful when tightening one interaction at a time.'],
  ['Run live club diagnostics on a selected project', '`QL_XCUITEST_FIREBASE_ENV=production QL_XCUITEST_ALLOW_PRODUCTION=1 QL_XCUITEST_LIVE_CLUB_ID=<clubId> xcodebuild test -scheme QuickLifts -destination \"platform=iOS Simulator,name=iPhone 16\" -only-testing:QuickLiftsUITests/QuickLiftsUITests/testClubActivationLiveDiagnosticsOpensRequestedClub`', 'Opens a real club through the app and lets the activation logs explain the current member state.'],
];

const SCENARIO_ROWS = [
  ['Launch environment', '`QL_UI_TEST_SCENARIO=club_activation`', 'App bootstraps a UI-test user, opens the mock club, and injects activation config before the first screen is asserted.'],
  ['Firebase environment', '`QL_FIREBASE_ENV=dev`', 'Native UI tests explicitly select the dev Firebase plist so test traffic stays isolated from production data.'],
  ['Viewer identity', '`tremaine.grant@gmail.com` mock-access tester', 'This email is allowed to view the mock club and to use host simulation mode inside the club detail screen.'],
  ['Club fixture', '`mock_club_wunna_run`', 'The deterministic launch path opens the mock Wunna Run Club directly.'],
  ['Activation fixture', 'Onboarding + intro required + manual pairing enabled', 'The launch helper turns on the activation layer so tests can hit the full creator-club flow immediately.'],
  ['Live diagnostics override', '`QL_UI_TEST_SCENARIO=club_activation_live` + `QL_UI_TEST_CLUB_ID=<clubId>`', 'The app skips mock bootstrapping, loads a real club by id, and keeps the investigation focused on logs and UI state instead of fixture resets.'],
];

const SUITE_ROWS = [
  ['Join triggers onboarding', '`testClubActivationJoinShowsRequiredOnboarding`', 'Verifies the member join action routes directly into the required activation sheet.'],
  ['Onboarding to intro composer', '`testClubActivationFlowCompletesIntroFromComposer`', 'Covers question selection, onboarding completion, intro prompt, composer modal, and successful intro send.'],
  ['Host settings entry point', '`testCreatorCanOpenActivationSettingsFromHostMode`', 'Verifies testers can simulate host access and reach the native club activation settings UI.'],
  ['Live diagnostics opener', '`testClubActivationLiveDiagnosticsOpensRequestedClub`', 'Read-only diagnostics harness for opening a real club on dev or production and asserting the activation state snapshot without the mock fixture.'],
];

const IDENTIFIER_ROWS = [
  ['Join flow', '`club-join-button`, `club-activation-onboarding-sheet`, `club-activation-complete-button`', 'Covers entry into the activation sequence and onboarding completion.'],
  ['Intro flow', '`club-intro-prompt-introduce-button`, `club-intro-composer-sheet`, `club-intro-composer-send-button`', 'Supports reliable intro gating and modal-composer automation.'],
  ['Host controls', '`club-toolbar-menu-button`, `club-edit-activation-enabled-toggle`, `club-edit-matching-mode-manual`', 'Makes the native creator setup path addressable without brittle coordinate taps.'],
  ['Diagnostics surface', '`club-activation-diagnostics-root`, `club-activation-diagnostics-canPostToClubChat`, `club-message-text-field`', 'Gives live XCUITests a read-only assertion layer so failures include the actual activation state and composer visibility.'],
];

const RUN_STEPS = [
  {
    title: 'Launch into the mock club scenario',
    body: 'Use the UI-test launch environment so the app opens directly into the mock club detail flow with activation already enabled.',
    owner: 'QuickLiftsApp',
  },
  {
    title: 'Assert the join and onboarding path first',
    body: 'Keep the first test focused on the required onboarding sheet appearing immediately after join so regressions are easy to localize.',
    owner: 'XCUITest',
  },
  {
    title: 'Cover intro and host setup as separate tests',
    body: 'Keep the intro-composer path and host-settings path independent so failures tell us whether member activation or creator tooling regressed.',
    owner: 'XCUITest',
  },
  {
    title: 'Pair automation with manual device review',
    body: 'After the suite passes, still confirm feed spacing, modal presentation feel, and chat readability on a real device or simulator session.',
    owner: 'Product + iOS',
  },
];

const MANUAL_ROWS = [
  ['Pinned intro gate readability', 'Confirm the last chat message is not covered by the `Intro Required` card when the feed is near the bottom.'],
  ['Intro copy quality', 'Make sure the host template actually helps the member write an intro rather than feeling robotic or too long.'],
  ['Host confidence', 'Confirm the creator can discover `Club Activation` in `Edit Club` without guidance and understands what each toggle changes.'],
];

const XCUITestingStrategyTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Native iOS Testing"
        title="XCUITest Strategy"
        version="Version 1.0 | March 12, 2026"
        summary="Operational artifact for how Pulse should cover native iOS club activation with XCUITest. This page documents the deterministic launch model, current club activation suite, accessibility-id policy, and where manual QA still matters."
        highlights={[
          {
            title: 'Deterministic native entry point',
            body: 'The suite launches directly into the mock club activation scenario instead of depending on login, search, or deep-link setup every run.',
          },
          {
            title: 'Built around real club surfaces',
            body: 'Tests target `ClubDetailView`, the native onboarding sheet, the intro composer modal, and the iOS `Edit Club` activation UI.',
          },
          {
            title: 'Manual QA still has a job',
            body: 'Automation protects routing and interaction correctness, while visual trust and pacing still need a human pass.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Native iOS testing artifact for creator-club activation coverage, launch strategy, and testability standards."
        sourceOfTruth="This document is authoritative for how XCUITests should reach the club activation flow, which scenarios are currently covered, and which identifiers are expected to remain stable."
        masterReference="Use this page when adding or debugging iOS UI tests for club onboarding, intro gating, or creator activation settings."
        relatedDocs={['Club Activation Architecture', 'Playwright Testing Strategy', 'QuickLifts iOS product handbook']}
      />

      <SectionBlock icon={ShieldCheck} title="Strategic Position">
        <DataTable columns={['Decision Area', 'Recommended Position', 'Why']} rows={POSITION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Command} title="Run Commands">
        <DataTable columns={['Action', 'Command / Target', 'Use']} rows={COMMAND_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Layers3} title="Deterministic Launch Scenario">
        <DataTable columns={['Fixture Area', 'Current Setup', 'Purpose']} rows={SCENARIO_ROWS} />
      </SectionBlock>

      <SectionBlock icon={TestTube2} title="Current Suite Inventory">
        <DataTable columns={['Flow', 'Test', 'Coverage']} rows={SUITE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Smartphone} title="Accessibility Identifier Contract">
        <DataTable columns={['Surface', 'Key identifiers', 'Why they exist']} rows={IDENTIFIER_ROWS} />
        <InfoCard
          title="Stability rule"
          accent="blue"
          body="Treat these identifiers as test contract, not incidental view details. If we rename or remove them, the associated XCUITests and this artifact should be updated in the same change."
        />
      </SectionBlock>

      <SectionBlock icon={Wrench} title="How To Use The Native Suite">
        <StepRail steps={RUN_STEPS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="What the launch helper does"
            accent="green"
            body={<BulletList items={[
              'Creates a UI-test user with mock-club access.',
              'Resets mock club state for a clean run.',
              'Configures Firebase from the bundled dev plist when the UI test asks for the dev environment.',
              'Applies club activation config to the mock club.',
              'Opens club detail directly so the test starts from the actual feature surface.',
              'Exposes a read-only activation diagnostics snapshot to XCUITest when diagnostics mode is enabled.',
            ]} />}
          />
          <InfoCard
            title="Current boundary"
            accent="amber"
            body={<BulletList items={[
              'The first XCUITests focus on onboarding, intro, and host entry points.',
              'Live diagnostics on production should stay read-only and require explicit env opt-in.',
              'Pairing workflows and safety-report flows are not yet covered natively.',
              'Android still needs its own equivalent instrumentation strategy.',
            ]} />}
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={CheckCircle2} title="Manual QA Still Required">
        <DataTable columns={['Manual Check', 'What To Confirm']} rows={MANUAL_ROWS} />
      </SectionBlock>
    </div>
  );
};

export default XCUITestingStrategyTab;
