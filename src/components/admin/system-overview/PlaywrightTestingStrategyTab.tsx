import React from 'react';
import { CheckCircle2, Command, FolderCog, KeyRound, ShieldCheck, TestTube2, Waypoints, Wrench } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const POSITION_ROWS = [
  ['Primary UI regression layer', 'Playwright E2E in the Next app', 'This repo already has a working Playwright harness, admin auth capture flow, and environment-safe defaults.'],
  ['Manual QA role', 'Keep targeted human walkthroughs for role-sensitive flows', 'Provisioning, invite policy, and multi-user onboarding still benefit from visual/manual verification even when smoke tests exist.'],
  ['Write-path policy', 'Opt-in only', 'Invite creation, publish flows, and other mutations should only run when explicit env flags allow them.'],
  ['Canonical doc location', 'System Overview -> Playwright tab', 'The handbook should hold the authoritative testing model, commands, safety rules, and suite inventory.'],
];

const COMMAND_ROWS = [
  ['Install browser', '`npm run test:e2e:install`', 'Installs Chromium for Playwright.'],
  ['Capture admin auth state', '`npm run test:e2e:auth`', 'Opens a browser, lets an admin log in, and saves `.playwright/admin-storage-state.json`.'],
  ['Grant dev admin from saved auth', '`npm run test:e2e:grant-admin`', 'Utility for local/dev admin bootstrap when needed.'],
  ['Run read-only smoke coverage', '`npm run test:e2e:smoke`', 'Runs only tests tagged `@smoke`, keeping the default pass on route/render validation without mutation paths.'],
  ['Run full PulseCheck regression', '`npm run test:e2e:pulsecheck:full`', 'Runs the onboarding/workspace suite and athlete-journey suite together for the full PulseCheck regression pass.'],
  ['Run PulseCheck write-path regression', '`npm run test:e2e:pulsecheck:write`', 'Runs the dev-db write suite with namespaced fixtures and cleanup when `PLAYWRIGHT_ALLOW_WRITE_TESTS=true` is set.'],
  ['List all E2E tests', '`npm run test:e2e -- --list`', 'Confirms suite registration without executing the flows.'],
  ['Run all E2E tests', '`npm run test:e2e`', 'Runs the configured Playwright suite set.'],
  ['Open Playwright UI', '`npm run test:e2e:ui`', 'Useful for local debugging and stepping through flows interactively.'],
];

const ENV_ROWS = [
  ['`PLAYWRIGHT_STORAGE_STATE`', 'Path to saved authenticated browser state', 'Lets suites reuse admin login instead of re-authing every run.'],
  ['`PLAYWRIGHT_REMOTE_LOGIN_TOKEN`', 'Remote-login token fallback', 'Alternative auth path when storage state is not used.'],
  ['`PLAYWRIGHT_ALLOW_WRITE_TESTS=true`', 'Enables mutation paths', 'Required before suites are allowed to create/revoke invites or publish artifacts.'],
  ['`PLAYWRIGHT_E2E_NAMESPACE`', 'Namespace prefix for seeded fixture ids', 'Keeps dev-db write records identifiable and lets cleanup helpers remove the exact test namespace afterward.'],
  ['`PLAYWRIGHT_PULSECHECK_ORG_ID`', 'PulseCheck organization id under test', 'Required for team-specific PulseCheck onboarding/workspace coverage.'],
  ['`PLAYWRIGHT_PULSECHECK_TEAM_ID`', 'PulseCheck team id under test', 'Required for post-activation and workspace path resolution.'],
  ['`PLAYWRIGHT_USE_EXISTING_SERVER=true`', 'Reuse an already-running local app', 'Skips Playwright launching its own dev server when preferred.'],
];

const SUITE_ROWS = [
  ['Variant Registry', '`tests/e2e/registry-build-publish.spec.ts`', 'Registry sync/build/preview/publish smoke with fixture cloning and cleanup.'],
  ['PulseCheck Onboarding + Workspace', '`tests/e2e/pulsecheck-onboarding-workspace.spec.ts`', 'Provisioning, legacy roster migration, post-activation, workspace load, and opt-in onboarding/invite mutation coverage.'],
  ['PulseCheck Athlete Journey', '`tests/e2e/pulsecheck-athlete-journey.spec.ts`', 'Daily check-in, Nora daily assignment creation, Today/Nora shared-task rendering, mental-training launch handoff, session-summary loop, and coach follow-up surfaces.'],
];

const PULSECHECK_ROWS = [
  ['Provisioning surface load', '`/admin/pulsecheckProvisioning` renders internal setup containers and connected provisioning map.', 'Smoke'],
  ['Legacy roster migration load', '`/admin/pulsecheckLegacyRosterMigration` renders the operator review surface for migrating `coachAthletes` into PulseCheck teams.', 'Smoke'],
  ['Post-activation setup load', '`/PulseCheck/post-activation` resolves a live admin handoff context.', 'Smoke'],
  ['Team workspace load', '`/PulseCheck/team-workspace` renders roster, invite controls, and migration-state panels.', 'Smoke'],
  ['Legacy roster migration create-path', 'Seeds an unmapped legacy coach roster, runs migration, and verifies a new PulseCheck organization/team plus athlete memberships are created.', 'Write-path'],
  ['Legacy roster migration existing-team path', 'Seeds a legacy coach roster that already has a PulseCheck team, runs migration, and verifies only the missing athlete is backfilled.', 'Write-path'],
  ['Athlete invite create + revoke', 'Creates a unique athlete invite from the workspace and revokes it in the same run.', 'Write-path'],
  ['Adult invite redemption', 'Creates a coach/staff invite, redeems it in a clean browser context, completes member setup, and confirms the member appears in the team workspace.', 'Write-path'],
  ['Athlete onboarding completion', 'Creates an athlete invite, redeems it in a clean browser context, completes consent/baseline onboarding, and confirms roster readiness in the team workspace.', 'Write-path'],
  ['Athlete daily check-in -> Nora task', 'Redeems a real athlete account, seeds post-baseline runtime state, saves a Today-view readiness check-in, and verifies a Nora daily assignment materializes from the real orchestration path.', 'Write-path'],
  ['Shared assignment surfaces', 'Confirms the same daily assignment renders in Today and Nora chat and launches the same task into Mental Training.', 'Write-path'],
  ['Session summary loop', 'Completes a Nora daily assignment, verifies the assignment lifecycle advances, and confirms the athlete receives a durable session summary plus next-action copy.', 'Write-path'],
  ['Coach follow-up queue', 'Confirms coach dashboard and notification-center surfaces reflect Nora auto-assignment and post-session follow-up artifacts.', 'Write-path'],
  ['Coach same-day intervention', 'Confirms the coach assignments tab can defer the Nora daily assignment and that the assignment state updates accordingly.', 'Write-path'],
  ['Assigned-athlete scope enforcement', 'Creates a scoped coach plus two athletes, assigns only one athlete to that coach, and confirms the coach workspace only shows the granted athlete.', 'Write-path'],
  ['Invite-policy matrix', 'Creates coach and staff recipients, flips the team through each invite-policy mode, and verifies who can create athlete invites in each state.', 'Write-path'],
  ['Revoked invite protection', 'Revokes an athlete invite and confirms the old link resolves to the shared not-found state instead of rendering a redeemable invite.', 'Write-path'],
  ['Target-email mismatch protection', 'Signs in as the wrong adult recipient and confirms a different invite blocks acceptance and requires the matching email.', 'Write-path'],
  ['Admin activation regeneration invalidation', 'Generates two activation links for the same admin recipient and confirms the older link stops resolving while the newest link remains valid.', 'Write-path'],
  ['No-roster visibility enforcement', 'Sets a non-admin adult to `none` roster visibility and confirms their workspace reports zero visible athletes and hides roster data.', 'Write-path'],
];

const MANUAL_ROWS = [
  ['Admin activation', 'Redeem the first PulseCheck admin link in a fresh session and confirm the route lands in post-activation setup.'],
  ['Adult invite redemption', 'Invite a coach or staff member, redeem the link in a second session, and confirm member setup writes the right role/title.'],
  ['Athlete onboarding', 'Redeem an athlete invite in a third session, accept consent, and verify baseline readiness appears in the workspace.'],
  ['Invite policy enforcement', 'Switch team invite policy scenarios and confirm who can or cannot create athlete invites.'],
  ['Assigned athlete scope', 'Set a staff member to assigned visibility and verify only selected athletes are tied to that member.'],
  ['Legacy roster migration QA', 'Confirm the operator page clearly distinguishes new-container migrations from existing-team migrations and that post-migration roster placement matches expectations.'],
  ['Negative invite paths', 'Confirm revoked links, wrong-email invite access, and regenerated admin links all fail cleanly and predictably.'],
];

const RUN_STEPS = [
  {
    title: 'Capture authenticated admin state once',
    body: 'Run the auth capture command, sign in as an admin, and save the reusable browser session to `.playwright/admin-storage-state.json`.',
    owner: 'Local operator',
  },
  {
    title: 'Provide environment-target ids',
    body: 'Set the PulseCheck org id and team id environment variables so the suites target the real container under test.',
    owner: 'Local operator',
  },
  {
    title: 'Run smoke coverage first',
    body: 'Execute the read-only PulseCheck suite before enabling write paths so route wiring and workspace rendering are validated safely.',
    owner: 'Playwright',
  },
  {
    title: 'Enable write tests only when intentional',
    body: 'Set `PLAYWRIGHT_ALLOW_WRITE_TESTS=true` only when you explicitly want invite creation or similar mutations to run.',
    owner: 'Local operator',
  },
  {
    title: 'Pair automation with manual role testing',
    body: 'Use the automated suite for regression coverage, then manually validate multi-user, role-sensitive, and design-sensitive flows.',
    owner: 'Product + Engineering',
  },
];

const PlaywrightTestingStrategyTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Playwright Testing"
        title="Playwright Testing Strategy"
        version="Version 1.0 | March 11, 2026"
        summary="Operational testing artifact for how this repo uses Playwright for authenticated UI regression coverage, safe write-path testing, and PulseCheck onboarding/workspace validation. This page defines the harness model, commands, environment variables, current suites, and where manual QA still matters."
        highlights={[
          {
            title: 'Use The Existing Harness',
            body: 'The repo already has Playwright config, admin auth capture, and test commands. Extend that harness instead of inventing a parallel UI-testing setup.',
          },
          {
            title: 'PulseCheck Coverage Is Now First-Class',
            body: 'PulseCheck provisioning, onboarding, workspace, and the athlete daily rhythm should live beside the Variant Registry suite as canonical E2E surfaces.',
          },
          {
            title: 'Write Paths Stay Intentional',
            body: 'Mutating tests should remain opt-in through environment flags so local and CI runs do not accidentally create or publish records.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Testing operations artifact for authenticated Playwright coverage, regression strategy, and safe mutation policy across admin and PulseCheck surfaces."
        sourceOfTruth="This document is authoritative for how Playwright should be run in this repo, which environment controls matter, and what the current canonical suites cover."
        masterReference="Use this page when adding new UI regression tests, running PulseCheck onboarding checks, or deciding whether a flow belongs in Playwright, manual QA, or both."
        relatedDocs={['Variant Registry', 'Team & Pilot Onboarding', 'Permissions & Visibility', 'Coach Dashboard IA']}
      />

      <SectionBlock icon={ShieldCheck} title="Strategic Position">
        <DataTable columns={['Decision Area', 'Recommended Position', 'Why']} rows={POSITION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Command} title="Core Commands">
        <DataTable columns={['Action', 'Command', 'Use']} rows={COMMAND_ROWS} />
      </SectionBlock>

      <SectionBlock icon={KeyRound} title="Environment Controls">
        <DataTable columns={['Variable', 'Purpose', 'Why It Matters']} rows={ENV_ROWS} />
      </SectionBlock>

      <SectionBlock icon={TestTube2} title="Current Suite Inventory">
        <DataTable columns={['Suite', 'Path', 'Coverage']} rows={SUITE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Waypoints} title="PulseCheck Coverage Map">
        <DataTable columns={['Flow', 'Expectation', 'Mode']} rows={PULSECHECK_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Wrench} title="How To Run The PulseCheck Suite">
        <StepRail steps={RUN_STEPS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Read-Only Smoke Run"
            accent="blue"
            body={
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-black/30 p-3 text-xs text-zinc-200">
                {`PLAYWRIGHT_STORAGE_STATE=/absolute/path/to/admin-storage-state.json
PLAYWRIGHT_PULSECHECK_ORG_ID=<org-id>
PLAYWRIGHT_PULSECHECK_TEAM_ID=<team-id>
npm run test:e2e:smoke -- tests/e2e/pulsecheck-onboarding-workspace.spec.ts`}
              </pre>
            }
          />
          <InfoCard
            title="Opt-In Write Run"
            accent="amber"
            body={
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-black/30 p-3 text-xs text-zinc-200">
                {`PLAYWRIGHT_STORAGE_STATE=/absolute/path/to/admin-storage-state.json
PLAYWRIGHT_PULSECHECK_ORG_ID=<org-id>
PLAYWRIGHT_PULSECHECK_TEAM_ID=<team-id>
PLAYWRIGHT_ALLOW_WRITE_TESTS=true
npm run test:e2e -- tests/e2e/pulsecheck-onboarding-workspace.spec.ts`}
              </pre>
            }
          />
          <InfoCard
            title="Athlete Journey Regression Run"
            accent="green"
            body={
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-black/30 p-3 text-xs text-zinc-200">
                {`PLAYWRIGHT_STORAGE_STATE=/absolute/path/to/admin-storage-state.json
PLAYWRIGHT_PULSECHECK_ORG_ID=<org-id>
PLAYWRIGHT_PULSECHECK_TEAM_ID=<team-id>
PLAYWRIGHT_ALLOW_WRITE_TESTS=true
npm run test:e2e -- tests/e2e/pulsecheck-athlete-journey.spec.ts`}
              </pre>
            }
          />
          <InfoCard
            title="Full PulseCheck Regression"
            accent="amber"
            body={
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-black/30 p-3 text-xs text-zinc-200">
                {`PLAYWRIGHT_STORAGE_STATE=/absolute/path/to/admin-storage-state.json
PLAYWRIGHT_PULSECHECK_ORG_ID=<org-id>
PLAYWRIGHT_PULSECHECK_TEAM_ID=<team-id>
PLAYWRIGHT_ALLOW_WRITE_TESTS=true
npm run test:e2e:pulsecheck:full`}
              </pre>
            }
          />
          <InfoCard
            title="PulseCheck Write Path"
            accent="rose"
            body={
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-black/30 p-3 text-xs text-zinc-200">
                {`PLAYWRIGHT_STORAGE_STATE=/absolute/path/to/admin-storage-state.json
PLAYWRIGHT_PULSECHECK_ORG_ID=<org-id>
PLAYWRIGHT_PULSECHECK_TEAM_ID=<team-id>
PLAYWRIGHT_E2E_NAMESPACE=e2e-pulsecheck
PLAYWRIGHT_ALLOW_WRITE_TESTS=true
npm run test:e2e:pulsecheck:write`}
              </pre>
            }
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={CheckCircle2} title="Manual QA Still Required">
        <DataTable columns={['Manual Check', 'What To Confirm']} rows={MANUAL_ROWS} />
        <InfoCard
          title="Boundary Rule"
          accent="red"
          body="Playwright should protect the core route and mutation paths, but role-sensitive behavior, multi-user handoff quality, and visual trust/readability still need manual validation before we call a rollout solid."
        />
      </SectionBlock>

      <SectionBlock icon={FolderCog} title="Operating Rules">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Keep Tests Close To Real Surfaces"
            accent="green"
            body={<BulletList items={[
              'Admin/internal flows belong in the admin-authenticated harness.',
              'Customer-facing PulseCheck flows should target the real `/PulseCheck/*` routes.',
              'Legacy `/coach/*` should only get new tests when it still carries transitional production value.',
            ]} />}
          />
          <InfoCard
            title="Prefer Safe Defaults"
            accent="purple"
            body={<BulletList items={[
              'Default to smoke coverage before mutation coverage.',
              'Use stable ids and explicit env vars for PulseCheck teams under test.',
              'For write-path runs, use a visible `PLAYWRIGHT_E2E_NAMESPACE` so seeded dev-db records are easy to identify and clean.',
              'Revoke or clean up transient invite artifacts when a write-path test creates them.',
            ]} />}
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PlaywrightTestingStrategyTab;
