import React from 'react';
import { AlertTriangle, GitBranch, KeyRound, Layers3, ListChecks, LockKeyhole, ServerCog, ShieldCheck, Waypoints } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const CURRENT_STATE_ROWS = [
  ['Next API shared helper', '`src/lib/firebase-admin.ts`', 'Already supports `FIREBASE_SERVICE_ACCOUNT`, inline key vars, and split key segments, but only for routes that import it.'],
  ['Netlify dynamic helper', '`netlify/functions/config/firebase.js`', 'Owns PulseCheck dev/prod app selection, but still parses credentials separately and carries its own formatting rules.'],
  ['Netlify service-account helper', '`netlify/functions/utils/getServiceAccount.ts`', 'Supports full service-account JSON plus split keys, but duplicates logic that also exists elsewhere.'],
  ['Route-local bypasses', '`src/pages/api/vision-pro/reset-sounds.ts` and `src/pages/api/audio/run-alerts.ts`', 'Initialize Firebase directly and only look for inline key vars, which caused the Reset Chamber outage.'],
];

const TARGET_COMPONENT_ROWS = [
  ['Canonical credential source', '`src/lib/server/firebase/credential-source.ts`', 'Normalizes env input and resolves the active service-account payload for prod or dev mode.'],
  ['Canonical app registry', '`src/lib/server/firebase/app-registry.ts`', 'Owns all `admin.initializeApp(...)` calls and returns stable named admin apps.'],
  ['Next runtime adapter', '`src/lib/firebase-admin.ts`', 'Thin adapter for `src/pages/api/**`; it should delegate to the shared core rather than owning parsing logic.'],
  ['Netlify runtime adapter', '`netlify/functions/config/firebase.js`', 'Thin adapter for `netlify/functions/**`; it should preserve header-based dev routing while delegating to the shared core.'],
  ['Secret Manager bridge', '`src/lib/secretManager.ts`', 'Should reuse the same credential-source logic instead of reparsing Firebase env vars independently.'],
  ['Guardrail layer', 'CI grep / lint rule', 'Prevents any new route or function from reading raw Firebase credential env vars or calling `admin.initializeApp(...)` directly.'],
];

const ENV_CONTRACT_ROWS = [
  ['`FIREBASE_SERVICE_ACCOUNT`', 'Canonical production secret', 'Full service-account JSON string. This is the preferred long-term server credential surface.'],
  ['`DEV_FIREBASE_SERVICE_ACCOUNT`', 'Canonical dev-project override', 'Full service-account JSON string for the explicit dev Firebase project when local or forced-dev flows need it.'],
  ['Legacy aliases', 'Migration only, resolver-owned', '`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_SECRET_KEY`, `FIREBASE_PRIVATE_KEY_1..4`, and `FIREBASE_SERVICE_ACCOUNT_KEY` remain readable only inside the shared resolver until cleanup is complete.'],
  ['Logging contract', 'Operational trace only', 'Log credential source, runtime, mode, project id, and app name. Never log private keys or full service-account blobs.'],
  ['Explicit non-goal', 'No route-level secret parsing', 'Routes and functions should not know whether credentials came from service-account JSON, split env vars, or a future ADC path.'],
];

const RUNTIME_RULE_ROWS = [
  ['Next API production', 'Use shared resolver + shared app registry', 'Preferred source is `FIREBASE_SERVICE_ACCOUNT`; migration aliases are acceptable only through the resolver.'],
  ['Netlify production', 'Use shared resolver + shared app registry', 'If no valid credential resolves, fail closed with a structured server error instead of silently initializing with only `projectId`.'],
  ['Local development', 'Allow explicit dev-project service account first', 'If `DEV_FIREBASE_SERVICE_ACCOUNT` exists, it wins for forced-dev or local-dev Firebase work.'],
  ['PulseCheck request-scoped dev routing', 'Preserve current forced-dev logic', 'Continue honoring the current localhost / override-header behavior, but let the shared registry decide which named app to return.'],
  ['Future ADC path', 'Add only in the shared resolver', 'If Cloud Run or another Google-hosted runtime is introduced later, ADC should be layered in once, not per route.'],
];

const FILE_SCOPE_ROWS = [
  ['Immediate hotfix route', '`src/pages/api/vision-pro/reset-sounds.ts`', 'Must stop calling `firebase-admin` directly and move to the shared initializer first.'],
  ['Sibling hotspot', '`src/pages/api/audio/run-alerts.ts`', 'Has the same direct-key parsing pattern and should move in the same first pass.'],
  ['Current Next entrypoint', '`src/lib/firebase-admin.ts`', 'Becomes the only approved Firebase Admin import for Next API routes.'],
  ['Current Netlify entrypoint', '`netlify/functions/config/firebase.js`', 'Becomes the only approved Firebase Admin entrypoint for Netlify functions that need request-aware prod/dev switching.'],
  ['Migration utility', '`netlify/functions/utils/getServiceAccount.ts`', 'Should either delegate to the shared resolver or be retired after migration.'],
  ['PulseCheck server functions', '`netlify/functions/submit-pulsecheck-checkin.js` and `netlify/functions/record-pulsecheck-assignment-event.js`', 'Already use the request-aware Netlify helper and should keep that adapter shape after the shared-core cutover.'],
];

const PHASE_STEPS = [
  {
    title: 'Phase 0 - Contract lock',
    body: 'Lock the environment contract around `FIREBASE_SERVICE_ACCOUNT` and `DEV_FIREBASE_SERVICE_ACCOUNT`, define the allowed legacy migration aliases, and document the ban on route-level Firebase Admin initialization.',
    owner: 'Platform architecture',
  },
  {
    title: 'Phase 1 - Shared core extraction',
    body: 'Create the canonical credential-source and app-registry modules, move all normalization and service-account selection logic into them, and make both Next and Netlify adapters delegate to the same core.',
    owner: 'Web platform',
  },
  {
    title: 'Phase 2 - Critical route cutover',
    body: 'Migrate the currently fragile Next API routes, especially Reset Chamber audio and run-alert audio, onto the shared initializer so outages stop being route-specific.',
    owner: 'PulseCheck web runtime',
  },
  {
    title: 'Phase 3 - Next API standardization',
    body: 'Audit all `src/pages/api/**` routes, replace raw `firebase-admin` usage with the shared Next adapter, and remove local private-key formatting logic from the Next layer entirely.',
    owner: 'Web platform',
  },
  {
    title: 'Phase 4 - Netlify function standardization',
    body: 'Migrate Netlify functions away from ad hoc `admin.initializeApp(...)` blocks and onto the Netlify adapter, keeping request-scoped dev/prod switching where required but not duplicating credential parsing.',
    owner: 'Functions and operations',
  },
  {
    title: 'Phase 5 - Guardrails and cleanup',
    body: 'Add CI checks, remove deprecated helper paths, prune legacy env formats when runtime parity is proven, and update onboarding docs so future work cannot reintroduce drift.',
    owner: 'Platform + QA',
  },
];

const PHASE_DETAIL_ROWS = [
  ['0', 'Contract lock', 'Define canonical env vars, migration aliases, app naming, log fields, and fail-closed rules. Update handbook and operator docs before touching runtime code.', 'Spec approved, env contract written, migration rules explicit.'],
  ['1', 'Shared core', 'Create shared credential-source and app-registry modules. Refactor `src/lib/firebase-admin.ts`, `netlify/functions/config/firebase.js`, and `src/lib/secretManager.ts` to consume them.', 'One credential parser and one app registry exist; adapters are thin.'],
  ['2', 'Critical routes', 'Cut over `vision-pro/reset-sounds` and `audio/run-alerts`. Verify these routes no longer read raw Firebase env vars.', 'Reset Chamber and run-alert endpoints resolve credentials the same way as the rest of the app.'],
  ['3', 'Next API audit', 'Search `src/pages/api/**` for `firebase-admin` imports and local `admin.initializeApp(...)`. Replace with the shared Next adapter.', 'No Next API route initializes Firebase Admin directly.'],
  ['4', 'Netlify audit', 'Search `netlify/functions/**` for direct Firebase Admin init. Migrate high-risk functions first, then the rest in batches.', 'Netlify functions use the adapter or an approved wrapper only.'],
  ['5', 'Guardrails', 'Add CI grep checks, runtime logging consistency, migration warnings for legacy env use, and remove obsolete helpers once usage reaches zero.', 'No new bypasses can land, and legacy paths have a removal plan.'],
];

const ACCEPTANCE_CHECKLIST = [
  'No route or function outside the shared registry calls `admin.initializeApp(...)` directly.',
  'No route or function outside the shared resolver reads `FIREBASE_SECRET_KEY`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_SERVICE_ACCOUNT`, or split-key env vars directly.',
  'Netlify production no longer silently falls back to partially initialized Firebase Admin apps when credentials are missing.',
  'Reset Chamber and run-alert audio routes use the exact same credential path as the rest of the server.',
  'The credential source is logged as metadata only and never exposes private-key material.',
  'Migration support for legacy env shapes remains centralized and removable, rather than embedded in dozens of call sites.',
];

const IMPLEMENTATION_TASK_ROWS = [
  ['Create shared credential source', 'Add `src/lib/server/firebase/credential-source.ts` with JSON parsing, newline normalization, legacy env compatibility, and mode selection.'],
  ['Create shared app registry', 'Add `src/lib/server/firebase/app-registry.ts` with stable app names and all Firebase Admin app initialization.'],
  ['Refactor Next adapter', 'Make `src/lib/firebase-admin.ts` a thin wrapper around the shared registry.'],
  ['Refactor Netlify adapter', 'Make `netlify/functions/config/firebase.js` call the shared registry while preserving forced-dev request behavior.'],
  ['Refactor Secret Manager bridge', 'Make `src/lib/secretManager.ts` consume the shared credential source instead of reparsing env vars.'],
  ['Patch critical routes', 'Update `src/pages/api/vision-pro/reset-sounds.ts` and `src/pages/api/audio/run-alerts.ts` to import the shared adapter.'],
  ['Run codebase audit', 'Search for direct `firebase-admin` imports and inline `admin.initializeApp(...)` blocks in `src/pages/api/**` and `netlify/functions/**`.'],
  ['Add CI guardrails', 'Fail builds if direct Firebase env access or `admin.initializeApp(...)` appears outside approved modules.'],
  ['Document operator contract', 'Update handbook and setup docs with canonical env names, migration rules, and log expectations.'],
];

export default function FirebaseAdminCredentialArchitectureTab() {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Platform Credentials"
        title="Firebase Admin Credential Architecture"
        version="Draft v1 | March 29, 2026"
        summary="System design spec for unifying Firebase Admin and Google server credentials across Next API routes and Netlify functions. This artifact locks the environment contract, runtime adapter shape, migration plan, and guardrails required to eliminate route-specific credential drift."
        highlights={[
          {
            title: 'One Credential Contract',
            body: 'Server code should converge on `FIREBASE_SERVICE_ACCOUNT` and `DEV_FIREBASE_SERVICE_ACCOUNT` as the canonical credential surfaces.',
          },
          {
            title: 'One Parsing Layer',
            body: 'The system should have exactly one shared credential resolver, not per-route key formatting logic.',
          },
          {
            title: 'One App Registry',
            body: 'All `admin.initializeApp(...)` calls should live in one shared registry that owns named prod/dev app reuse.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Cross-runtime credential architecture for QuickLifts Web, PulseCheck server routes, and Netlify functions that depend on Firebase Admin, Firestore, Storage, Auth, or other Google server-side APIs."
        sourceOfTruth="This page is the architectural source of truth for how server credentials should be loaded, normalized, and initialized. Route-level secret parsing is considered a bug once this design is adopted."
        masterReference="Use this artifact before touching Firebase Admin initialization, adding a new server route that uses Firestore, rotating service-account format, or deciding whether a new function belongs on the shared adapter."
        relatedDocs={[
          'Infrastructure & Secrets Stack',
          'Firestore Index Registry',
          'Playwright Testing Strategy',
          'PulseCheck Runtime Stack',
        ]}
      />

      <SectionBlock icon={Layers3} title="Why This Exists">
        <DataTable columns={['Current Layer', 'Current Home', 'Current Risk']} rows={CURRENT_STATE_ROWS} />
        <CardGrid columns="xl:grid-cols-2">
          <InfoCard
            title="Observed Failure Mode"
            accent="red"
            body="The Reset Chamber outage happened because one route used a narrower Firebase credential parser than the rest of the system. The credentials likely still existed, but the route could not see the format being used elsewhere."
          />
          <InfoCard
            title="Required Architectural Shift"
            accent="green"
            body="Credential shape should become an implementation detail of one shared resolver. Routes and functions should ask for an admin app, not for env vars."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Waypoints} title="Target Architecture">
        <DataTable columns={['Layer', 'Proposed Home', 'Responsibility']} rows={TARGET_COMPONENT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={LockKeyhole} title="Credential Contract">
        <DataTable columns={['Input', 'Status', 'Rule']} rows={ENV_CONTRACT_ROWS} />
        <BulletList
          items={[
            'Canonical production format is a full service-account JSON blob stored in `FIREBASE_SERVICE_ACCOUNT`.',
            'Canonical dev override format is a full service-account JSON blob stored in `DEV_FIREBASE_SERVICE_ACCOUNT`.',
            'Legacy env formats remain temporarily supported only inside the shared resolver so migration can happen without route-by-route breakage.',
            'Future ADC support, if added, belongs only in the shared resolver and should not leak into route code.',
          ]}
        />
      </SectionBlock>

      <SectionBlock icon={ServerCog} title="Runtime Rules">
        <DataTable columns={['Runtime Context', 'Required Behavior', 'Reason']} rows={RUNTIME_RULE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={GitBranch} title="How This Lives In The Repo">
        <DataTable columns={['Scope', 'File / Surface', 'Role In The New Model']} rows={FILE_SCOPE_ROWS} />
        <CardGrid columns="xl:grid-cols-2">
          <InfoCard
            title="Approved Entry Points"
            accent="blue"
            body="Next API routes should import the Next adapter. Netlify functions should import the Netlify adapter. Shared core modules sit underneath both. Nothing else should initialize Firebase Admin."
          />
          <InfoCard
            title="Adapter Strategy"
            accent="amber"
            body="Two runtime adapters are acceptable because Next and Netlify have different request shapes. Two credential parsers are not acceptable."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ListChecks} title="Implementation Checklist By Phase">
        <StepRail steps={PHASE_STEPS} />
        <DataTable columns={['Phase', 'Goal', 'Detailed Work', 'Exit Criteria']} rows={PHASE_DETAIL_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="End-to-End Task List">
        <DataTable columns={['Task', 'What Needs To Happen']} rows={IMPLEMENTATION_TASK_ROWS} />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Definition Of Done">
        <BulletList items={ACCEPTANCE_CHECKLIST} />
      </SectionBlock>
    </div>
  );
}
