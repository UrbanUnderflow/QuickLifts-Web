import React from 'react';
import { AlertTriangle, GitBranch, KeyRound, Layers3, ListChecks, LockKeyhole, ServerCog, ShieldCheck, Waypoints } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const CURRENT_STATE_ROWS = [
  ['Next API shared helper', '`src/lib/firebase-admin.ts`', 'The helper resolves credentials correctly in code, but Netlify production `Next.js Server Handler` was observed not receiving the Firebase server env vars at all.'],
  ['Netlify dynamic helper', '`netlify/functions/config/firebase.js`', 'Now delegates to the shared registry and is the currently proven production-safe Firebase runtime on Netlify.'],
  ['Bridged Next API runtime', '`netlify/functions/firebase-next-api.ts`', 'Executes original Firebase-backed Next API handlers on the validated Netlify function runtime while preserving the public `/api/*` URL shape.'],
  ['Netlify service-account helper', '`netlify/functions/utils/getServiceAccount.ts`', 'Compatibility wrapper for function flows that still need a typed helper surface; it now resolves through the shared core.'],
  ['Mitigated audio APIs', '`/api/vision-pro/reset-sounds` and `/api/audio/run-alerts`', 'Both public routes now redirect to Netlify functions, which restored Nora audio in production without changing the public API shape.'],
];

const PRODUCTION_AUDIT_ROWS = [
  ['Confirmed live runtime behavior', '`Next.js Server Handler`', 'A live production request logged `hasSecretKey=false`, `hasClientEmail=false`, and `hasProjectId=false` for the Firebase envs.'],
  ['Routes now mitigated', '`36` Firebase-backed Next API routes', 'The current audit shows the entire discovered Firebase-backed Next API route set is now behind either dedicated Netlify-function redirects or the shared `firebase-next-api` bridge.'],
  ['Dedicated public route cutovers', '`2` public audio APIs', '`/api/vision-pro/reset-sounds` and `/api/audio/run-alerts` now bypass the Next runtime and run as dedicated Netlify functions.'],
  ['Proxy risk now mitigated', '`/api/pulsecheck/functions/[name]`', 'The shared PulseCheck proxy previously loaded Netlify function modules inside Next. It now forwards supported calls to `/.netlify/functions/*` upstream instead.'],
  ['Remaining credential-runtime risk', '`0` audited routes', 'The current audit no longer has Firebase-backed Next API routes still exposed to the raw Netlify Next runtime credential failure.'],
  ['Audit artifact', '`docs/firebase-next-api-runtime-audit.md`', 'Tracks the current route inventory, confirmed production finding, and migration order for the remaining Next API routes.'],
];

const TARGET_COMPONENT_ROWS = [
  ['Canonical credential source', '`src/lib/server/firebase/credential-source.ts`', 'Normalizes env input and resolves the active Firebase Admin credential payload for prod or dev mode.'],
  ['Canonical app registry', '`src/lib/server/firebase/app-registry.ts`', 'Owns all `admin.initializeApp(...)` calls and returns stable named admin apps.'],
  ['Next runtime adapter', '`src/lib/firebase-admin.ts`', 'Still the shared wrapper for Next code, but Firebase-backed production routes should flow through either the shared bridge or an explicit Netlify-function redirect.'],
  ['Netlify runtime adapter', '`netlify/functions/config/firebase.js`', 'Thin adapter for `netlify/functions/**`; this is the currently validated production surface for Firebase-backed APIs on Netlify.'],
  ['Next bridge adapter', '`netlify/functions/firebase-next-api.ts`', 'Converts Netlify events into Next-style requests so existing Firebase-backed Next handlers can execute on the validated function runtime.'],
  ['Secret Manager bridge', '`src/lib/secretManager.ts`', 'Should reuse the same credential-source logic instead of reparsing Firebase env vars independently.'],
  ['Guardrail layer', 'CI grep / lint rule', 'Prevents any new route or function from reading raw Firebase credential env vars or calling `admin.initializeApp(...)` directly.'],
];

const ENV_CONTRACT_ROWS = [
  ['`FIREBASE_SECRET_KEY` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PROJECT_ID`', 'Canonical Netlify production contract', 'Compact Firebase Admin credential surface that fits Netlify constraints and is already present in production.'],
  ['`FIREBASE_SERVICE_ACCOUNT`', 'Optional alternate canonical secret', 'Full service-account JSON string for runtimes that can comfortably store it, but not required for the current Netlify deployment model.'],
  ['`DEV_FIREBASE_SERVICE_ACCOUNT`', 'Explicit dev-project override', 'Full service-account JSON string for the explicit dev Firebase project when local or forced-dev flows need it.'],
  ['Legacy aliases', 'Migration only, resolver-owned', '`FIREBASE_PRIVATE_KEY`, `FIREBASE_PRIVATE_KEY_1..4`, and `FIREBASE_SERVICE_ACCOUNT_KEY` remain readable only inside the shared resolver until cleanup is complete.'],
  ['Logging contract', 'Operational trace only', 'Log credential source, runtime, mode, project id, and app name. Never log private keys or full service-account blobs.'],
  ['Explicit non-goal', 'No route-level secret parsing', 'Routes and functions should not know whether credentials came from service-account JSON, split env vars, or a future ADC path.'],
];

const RUNTIME_RULE_ROWS = [
  ['Next API on current Netlify production', 'Do not expose Firebase-backed routes directly on the raw Next runtime', 'The live `Next.js Server Handler` was observed missing all Firebase server env vars during a real production request.'],
  ['Netlify production functions', 'Use shared resolver + shared app registry', 'This is the validated production runtime for Firebase-backed APIs on the current stack. Fail closed if no valid credential resolves.'],
  ['Bridged Firebase Next APIs', 'Run through `firebase-next-api` or a dedicated function redirect', 'This preserves public route shape while keeping execution on the validated Netlify function runtime.'],
  ['Local development', 'Allow explicit dev-project service account first', 'If `DEV_FIREBASE_SERVICE_ACCOUNT` exists, it wins for forced-dev or local-dev Firebase work.'],
  ['PulseCheck request-scoped dev routing', 'Preserve current forced-dev logic', 'Continue honoring the current localhost / override-header behavior, but let the shared registry decide which named app to return.'],
  ['Future ADC path', 'Add only in the shared resolver', 'If Cloud Run or another Google-hosted runtime is introduced later, ADC should be layered in once, not per route.'],
];

const FILE_SCOPE_ROWS = [
  ['Mitigated public route', '`netlify/functions/vision-pro-reset-sounds.js`', 'Owns the production-safe Firebase-backed implementation behind `/api/vision-pro/reset-sounds`.'],
  ['Mitigated sibling route', '`netlify/functions/audio-run-alerts.js`', 'Owns the production-safe Firebase-backed implementation behind `/api/audio/run-alerts`.'],
  ['Shared bridge route', '`netlify/functions/firebase-next-api.ts`', 'Covers the remaining Firebase-backed Next API families that need public `/api/*` continuity without raw Next-runtime execution.'],
  ['Current Next entrypoint', '`src/lib/firebase-admin.ts`', 'Becomes the only approved Firebase Admin import for Next API routes.'],
  ['Current Netlify entrypoint', '`netlify/functions/config/firebase.js`', 'Becomes the only approved Firebase Admin entrypoint for Netlify functions that need request-aware prod/dev switching.'],
  ['Migration utility', '`netlify/functions/utils/getServiceAccount.ts`', 'Should either delegate to the shared resolver or be retired after migration.'],
  ['Route audit artifact', '`docs/firebase-next-api-runtime-audit.md`', 'Records the fully mitigated route inventory, the bridge/redirect strategy, and the live probe expectations for ongoing verification.'],
];

const PHASE_STEPS = [
  {
    title: 'Phase 0 - Contract lock',
    body: 'Lock the environment contract around the compact Netlify Firebase admin surface (`FIREBASE_SECRET_KEY`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PROJECT_ID`), define the allowed legacy migration aliases, and document the ban on route-level Firebase Admin initialization.',
    owner: 'Platform architecture',
  },
  {
    title: 'Phase 1 - Shared core extraction',
    body: 'Create the canonical credential-source and app-registry modules, move all normalization and service-account selection logic into them, and make both Next and Netlify adapters delegate to the same core.',
    owner: 'Web platform',
  },
  {
    title: 'Phase 2 - Critical route cutover',
    body: 'Move the confirmed broken public audio APIs onto Netlify functions behind `/api/*` redirects so outages stop depending on the Netlify Next runtime.',
    owner: 'PulseCheck web runtime',
  },
  {
    title: 'Phase 3 - Next API standardization',
    body: 'Audit all `src/pages/api/**` routes and move Firebase-backed families behind either the shared `firebase-next-api` bridge or dedicated Netlify-function redirects.',
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
  ['0', 'Contract lock', 'Define canonical Netlify env vars, migration aliases, app naming, log fields, and fail-closed rules. Update handbook and operator docs before touching runtime code.', 'Spec approved, env contract written, migration rules explicit.'],
  ['1', 'Shared core', 'Create shared credential-source and app-registry modules. Refactor `src/lib/firebase-admin.ts`, `netlify/functions/config/firebase.js`, and `src/lib/secretManager.ts` to consume them.', 'One credential parser and one app registry exist; adapters are thin.'],
  ['2', 'Critical routes', 'Cut over `vision-pro/reset-sounds` and `audio/run-alerts` to Netlify functions behind redirects. Verify the public URLs still work and Nora audio loads live.', 'Reset Chamber and run-alert endpoints resolve credentials on the validated Netlify function runtime.'],
  ['3', 'Next API audit', 'Search `src/pages/api/**` for Firebase-backed routes still running on the Netlify Next runtime. Redirect them behind the shared bridge or dedicated functions.', 'Audited Firebase-backed Next API routes no longer execute directly on the raw Next runtime in production.'],
  ['4', 'Netlify audit', 'Search `netlify/functions/**` for direct Firebase Admin init. Migrate high-risk functions first, then the rest in batches.', 'Netlify functions use the adapter or an approved wrapper only.'],
  ['5', 'Guardrails', 'Add CI grep checks, runtime logging consistency, migration warnings for legacy env use, and remove obsolete helpers once usage reaches zero.', 'No new bypasses can land, and legacy paths have a removal plan.'],
];

const ACCEPTANCE_CHECKLIST = [
  'No route or function outside the shared registry calls `admin.initializeApp(...)` directly.',
  'No route or function outside the shared resolver reads `FIREBASE_SECRET_KEY`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_SERVICE_ACCOUNT`, or split-key env vars directly.',
  'Netlify production no longer silently falls back to partially initialized Firebase Admin apps when credentials are missing.',
  'Firebase-backed public audio routes keep their `/api/*` URLs while executing on the validated Netlify function runtime.',
  'No new Firebase-backed Next API route ships on Netlify without either a redirect to a Netlify function or explicit runtime validation.',
  'The credential source is logged as metadata only and never exposes private-key material.',
  'Migration support for legacy env shapes remains centralized and removable, rather than embedded in dozens of call sites.',
];

const IMPLEMENTATION_TASK_ROWS = [
  ['Create shared credential source', 'Add `src/lib/server/firebase/credential-source.ts` with JSON parsing, newline normalization, legacy env compatibility, and mode selection.'],
  ['Create shared app registry', 'Add `src/lib/server/firebase/app-registry.ts` with stable app names and all Firebase Admin app initialization.'],
  ['Refactor Next adapter', 'Make `src/lib/firebase-admin.ts` a thin wrapper around the shared registry.'],
  ['Refactor Netlify adapter', 'Make `netlify/functions/config/firebase.js` call the shared registry while preserving forced-dev request behavior.'],
  ['Refactor Secret Manager bridge', 'Make `src/lib/secretManager.ts` consume the shared credential source instead of reparsing env vars.'],
  ['Patch critical routes', 'Update `src/pages/api/vision-pro/reset-sounds.ts` and `src/pages/api/audio/run-alerts.ts` to import the shared adapter and route them through dedicated Netlify functions.'],
  ['Bridge route families', 'Keep Firebase-backed Next API families reachable via `/api/*` while redirecting them to `netlify/functions/firebase-next-api.ts`.'],
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
            body: 'Server code should converge on the shared compact Netlify contract (`FIREBASE_SECRET_KEY`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PROJECT_ID`) with optional service-account JSON support kept inside the resolver only.',
          },
          {
            title: 'One Parsing Layer',
            body: 'The system should have exactly one shared credential resolver, not per-route key formatting logic.',
          },
          {
            title: 'One App Registry',
            body: 'All `admin.initializeApp(...)` calls should live in one shared registry that owns named prod/dev app reuse.',
          },
          {
            title: 'One Production Runtime',
            body: 'Firebase-backed production APIs should execute on Netlify functions, either directly or through the shared `firebase-next-api` bridge.',
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
            body="The original Reset Chamber outage started as credential drift, but the live Netlify incident showed a broader risk: `Next.js Server Handler` did not receive the Firebase server env vars at all for production requests."
          />
          <InfoCard
            title="Required Architectural Shift"
            accent="green"
            body="Credential shape should remain an implementation detail of one shared resolver, and Firebase-backed public APIs on Netlify should execute on the validated function runtime behind redirects or the shared bridge."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Production Runtime Audit">
        <DataTable columns={['Finding', 'Surface', 'What We Know']} rows={PRODUCTION_AUDIT_ROWS} />
      <BulletList
          items={[
            'The production-safe pattern is now proven live for the Nora audio endpoints.',
            'The audit script `npm run audit:firebase-next-api` now reports zero remaining audited routes still exposed to the raw Netlify Next runtime.',
            'The route-by-route inventory, bridge strategy, and live probe notes live in `docs/firebase-next-api-runtime-audit.md`.',
            'Representative live smoke probes now exist in `npm run probe:firebase-next-api:live` to catch any return of the old credential failure signature.',
            'The current production model no longer depends on inline env injection for Firebase-backed Next API routes; the bridge and dedicated Netlify functions are the deployment-safe path.',
          ]}
        />
      </SectionBlock>

      <SectionBlock icon={Waypoints} title="Target Architecture">
        <DataTable columns={['Layer', 'Proposed Home', 'Responsibility']} rows={TARGET_COMPONENT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={LockKeyhole} title="Credential Contract">
        <DataTable columns={['Input', 'Status', 'Rule']} rows={ENV_CONTRACT_ROWS} />
        <BulletList
          items={[
            'Canonical Netlify production format is the compact three-variable contract: `FIREBASE_SECRET_KEY`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PROJECT_ID`.',
            'Full service-account JSON remains supported in the shared resolver, but it is optional on the current Netlify stack.',
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
            body="Next API routes can keep their existing handler code, but Firebase-backed production traffic should reach them through the shared bridge or a dedicated Netlify-function redirect. Shared core modules sit underneath both."
          />
          <InfoCard
            title="Adapter Strategy"
            accent="amber"
            body="Two runtime adapters are acceptable because Next and Netlify have different request shapes. The bridge exists to keep the public API shape while still executing on the validated function runtime. Two credential parsers are not acceptable."
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
