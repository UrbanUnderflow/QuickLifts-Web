import React from 'react';
import { Cloud, Database, KeyRound, Server, ShieldCheck, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const INFRA_ROWS = [
  ['Next.js web app', 'Netlify', 'Primary hosting layer for Fit With Pulse Web/Admin and its admin surfaces.'],
  ['Server routes / runtime APIs', 'Netlify Functions + Next API routes', 'Web-owned server execution for admin workflows, email sends, AI orchestration, and scheduling actions.'],
  ['Core product data', 'Firebase / Firestore', 'Canonical operational store for app data, admin records, and Group Meet request state.'],
  ['Identity', 'Firebase Auth', 'Cross-surface authentication and admin role verification.'],
  ['Media / documents', 'Firebase Storage', 'Binary file storage for uploads, media assets, and exported artifacts.'],
  ['Google-integrated infra secrets', 'Google Cloud Secret Manager', 'Secure home for high-sensitivity machine credentials like the Group Meet Google service-account JSON.'],
  ['Admin meeting infrastructure', 'Google Workspace + Google Calendar API', 'Host final-event creation and Meet conference generation via service account + delegated scheduler identity.'],
  ['Guest calendar import', 'Google OAuth + free/busy access', 'Invite-scoped guest import flow that suggests availability from the guest calendar without exposing private event details.'],
];

const SECRET_ROWS = [
  ['Netlify environment variables', 'Operational app config, API keys, low-to-medium sensitivity values, small runtime toggles', 'Front-end build env, small server-side API credentials, routing flags, cron secrets'],
  ['Google Cloud Secret Manager', 'Large or high-sensitivity server secrets that should not live in repo or Firestore', 'Google service-account JSON blob, future private keys, machine credentials that exceed Netlify env comfort'],
  ['Firestore / Firebase', 'Never use as a secret vault', 'Application data may reference secret ids or secret-backed configuration state, but not the secret material itself'],
  ['Local developer machine', 'Temporary bootstrap only', 'One-off downloaded key files before upload into Secret Manager and safe deletion'],
];

const GROUP_MEET_ROWS = [
  ['Scheduling request + participant state', 'Firestore `groupMeetRequests` + `groupMeetInvites`', 'Operational source of truth for invite links, availability, AI recommendations, and final host choice.'],
  ['Google service-account credential', 'Secret Manager `GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON`', 'Stored as one JSON blob rather than fragmented env vars.'],
  ['Delegated scheduler identity', 'Workspace user `tre@fitwithpulse.ai`', 'Current impersonated calendar owner because `meetings@fitwithpulse.ai` is an alias, not a standalone mailbox.'],
  ['Human-friendly scheduler alias', '`meetings@fitwithpulse.ai` alias', 'Useful for institutional naming, but does not create a separate calendar identity by itself.'],
  ['Meet / Calendar creation', 'Google Calendar API via service account + domain-wide delegation', 'Host picks final block, backend creates or updates the event, Google distributes attendee invites.'],
];

const GROUP_MEET_GUEST_GCAL_ROWS = [
  ['Guest OAuth client', 'Dedicated guest-side Google OAuth app', 'Separate consent boundary from the admin scheduler. Used only for invite-scoped calendar import.'],
  ['Guest OAuth env contract', '`GOOGLE_GUEST_CALENDAR_CLIENT_ID`, `GOOGLE_GUEST_CALENDAR_CLIENT_SECRET`, `GOOGLE_GUEST_CALENDAR_REDIRECT_URI` or Secret Manager secret `GOOGLE_GUEST_CALENDAR_OAUTH_SECRET_NAME`', 'Required for the guest-side connect/import/callback flow. Do not reuse the admin scheduler service-account contract here.'],
  ['Token protection', '`GOOGLE_GUEST_CALENDAR_ENCRYPTION_KEY`, `GOOGLE_GUEST_CALENDAR_ENCRYPTION_SECRET_NAME`, or a combined Secret Manager JSON blob', 'Used to protect invite-scoped OAuth token material or secure references before persistence.'],
  ['Guest import storage', 'Invite-level metadata in Firestore plus server-only credential storage', 'Store connection status, last sync metadata, and secure token references only. Do not store raw event details.'],
  ['Guest import behavior', 'Google free/busy only', 'Import availability suggestions from busy windows; guests still review and save manually.'],
];

const BREVO_ROWS = [
  ['Transactional API key', '`BREVO_MARKETING_KEY` preferred, `BREVO_API_KEY` fallback', 'These are the only approved Brevo key env names across the repo. Shared helpers and working email flows already read this pair.'],
  ['Sender identity', '`BREVO_SENDER_EMAIL` + `BREVO_SENDER_NAME`', 'Optional overrides used by many functions. If omitted, individual flows fall back to hardcoded sender defaults.'],
  ['Current runtime contract', 'Netlify runtime env or local `.env.local`', 'All audited Brevo send helpers currently read plain env vars at runtime; there is no existing Brevo-specific Secret Manager bridge in code today.'],
  ['Cross-machine bootstrap', '`scripts/export-local-machine-setup.cjs`', 'The local machine setup bundle now carries Brevo envs so a new machine can inherit the same email setup instead of silently losing it.'],
  ['Current audit finding', 'Documentation gap previously hid the real source', 'As of Apr 3, 2026, the linked Netlify project `quickliftsapp` exposes only `NODE_VERSION`, and the documented GCP projects `quicklifts-dev-01` / `quicklifts-dd3f1` do not currently hold Brevo secrets in Secret Manager.'],
];

const PRODUCTION_ACCESS_ROWS = [
  [
    'Default local override to check first',
    <code className="text-xs">echo $GOOGLE_APPLICATION_CREDENTIALS</code>,
    <>
      On this machine the common value is{' '}
      <code className="text-xs">~/.config/gcloud/quicklifts-dev-01-firebase-adminsdk.json</code>. That file is dev-only and will
      silently force Firebase Admin calls toward dev or cause production permission confusion if left active.
    </>,
  ],
  [
    'User ADC file for prod-capable gcloud login',
    <code className="text-xs">~/.config/gcloud/application_default_credentials.json</code>,
    'This is the file `applicationDefault()` falls back to when `GOOGLE_APPLICATION_CREDENTIALS` is unset. It uses the signed-in gcloud user account rather than the dev service account file.',
  ],
  [
    'Prod Firestore access pattern',
    <code className="text-xs">env -u GOOGLE_APPLICATION_CREDENTIALS node ...</code>,
    'Use this when you need production Firestore/Auth with your gcloud user access. Pair it with an explicit project id like `quicklifts-dd3f1` so local env state does not accidentally drag the call back to dev.',
  ],
  [
    'Secret inventory lookup',
    <code className="text-xs">gcloud secrets list --project=quicklifts-dd3f1</code>,
    'Use Secret Manager inventory to confirm what production machine credentials exist before hunting through the repo. As of Apr 7, 2026 this was the fastest way to verify prod secret coverage on this machine.',
  ],
  [
    'Netlify reality check',
    <code className="text-xs">./node_modules/.bin/netlify env:list --context production --json</code>,
    'Run this before assuming Netlify holds the live secret you need. The currently linked project on this machine was not the source of production Firebase admin access and only exposed `NODE_VERSION` in production context.',
  ],
  [
    'Local browser/admin bootstrap',
    <code className="text-xs">.playwright/admin-storage-state.json</code>,
    'Useful for local admin UI automation only. Do not confuse Playwright storage state with production infrastructure credentials. It can prove local admin UI auth but not grant direct prod Firestore access.',
  ],
];

const PRODUCTION_ACCESS_STEPS = [
  {
    title: 'Verify which identity is active before touching production',
    body: 'Start with `gcloud auth list` and `gcloud config list`. Confirm whether you are using your human Google account or a local dev service-account file before assuming any production query result is trustworthy.',
    owner: 'Operator',
  },
  {
    title: 'Check and neutralize the dev-only credential override',
    body: 'Run `echo $GOOGLE_APPLICATION_CREDENTIALS`. If it points at `~/.config/gcloud/quicklifts-dev-01-firebase-adminsdk.json`, unset it for production work or prefix commands with `env -u GOOGLE_APPLICATION_CREDENTIALS` so Firebase Admin uses user ADC instead.',
    owner: 'Operator',
  },
  {
    title: 'Use explicit project ids on every production command',
    body: 'When reading or writing production, pass `quicklifts-dd3f1` directly into the admin SDK or `--project=quicklifts-dd3f1` on gcloud commands. Do not trust the shell default project to already be correct.',
    owner: 'Engineering',
  },
  {
    title: 'Check Secret Manager before repo archaeology',
    body: 'Use `gcloud secrets list --project=quicklifts-dd3f1` and `gcloud secrets list --project=quicklifts-dev-01` first. This is faster than digging through the repo when you need to know whether a production credential exists at all.',
    owner: 'Platform + Ops',
  },
  {
    title: 'Treat Netlify link state as informational, not authoritative',
    body: 'Run `netlify status` and `netlify env:list --context production --json` to see what the currently linked site actually exposes. If the linked site is not the live app or only shows minimal env, do not keep debugging the wrong control plane.',
    owner: 'Web Platform',
  },
  {
    title: 'Record the winning access path back into this handbook',
    body: 'Whenever a production incident reveals a new credential location, shell gotcha, or secret-home mismatch, update this page immediately so the next operator can repeat the working path without rediscovery.',
    owner: 'Engineering',
  },
];

const OPERATING_STEPS = [
  {
    title: 'Decide where a new secret belongs before shipping',
    body: 'Ask whether the value is small operational config or a true infrastructure credential. Default small app settings to Netlify env vars and machine-grade secrets to Secret Manager.',
    owner: 'Web Platform',
  },
  {
    title: 'Use one secret blob for machine credentials when possible',
    body: 'Prefer one structured JSON secret in Secret Manager over splitting a credential into many env vars. This reduces drift, avoids env-var limits, and keeps rotation clearer.',
    owner: 'Platform + Ops',
  },
  {
    title: 'Reference the secret from runtime, never from Firestore',
    body: 'App data may store ids, statuses, and operational metadata, but not raw secret material. Firestore should describe workflow state, not act as a vault.',
    owner: 'Engineering',
  },
  {
    title: 'Delete bootstrap key files after secure upload',
    body: 'If a credential is briefly downloaded locally for setup, upload it into Secret Manager, verify access, then remove the file from Downloads and avoid copying it into the repo or chat.',
    owner: 'Operator',
  },
];

export default function InfrastructureSecretsStackTab() {
  return (
    <div className="space-y-8">
      <DocHeader
        eyebrow="Infrastructure Handbook"
        title="Infrastructure & Secrets Stack"
        version="Updated Apr 7, 2026"
        summary="Source-of-truth reference for how Fit With Pulse Web/Admin, Firebase, Netlify, Google Cloud, Google Workspace, and Secret Manager relate to each other operationally, with explicit rules for where sensitive credentials should live. QuickLifts-Web remains the repo/internal lineage name."
        highlights={[
          {
            title: 'Netlify Owns App Runtime',
            body: 'Fit With Pulse Web/Admin and its server-owned workflows still run through the Netlify/Next runtime layer, even when they depend on Google infrastructure or Firebase data.',
          },
          {
            title: 'Firebase Owns Product State',
            body: 'Firestore remains the canonical operational store for app records like Group Meet requests, invites, availability, recommendations, and scheduling outcomes.',
          },
          {
            title: 'Secret Manager Owns High-Sensitivity Machine Secrets',
            body: 'Large or infrastructure-grade credentials such as Google service-account JSON blobs belong in Secret Manager rather than Netlify env vars or Firebase.',
          },
          {
            title: 'Brevo Is Env-Backed Today',
            body: 'Brevo email sends currently depend on `BREVO_MARKETING_KEY` or `BREVO_API_KEY` from runtime env, and that source must be documented and carried forward explicitly.',
          },
          {
            title: 'Guest Google Import Is Separate',
            body: 'Group Meet now has a second Google contract for guest-side calendar import. It uses dedicated guest OAuth envs and invite-scoped token storage, not the admin final-event scheduler setup.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Cross-system infrastructure chapter for the web platform. It explains how hosting, data, identity, external integrations, and secret storage are divided so setup work does not become tribal knowledge."
        sourceOfTruth="This document is authoritative for the current operational relationship between Netlify, Firebase, Google Cloud, Secret Manager, and Google Workspace, including the rule that Firebase is not a secret vault."
        masterReference="Use this page before introducing new production credentials, adding external infrastructure integrations, rotating service-account material, or deciding whether a value belongs in Netlify env vars versus Secret Manager."
        relatedDocs={[
          'Playwright Testing Strategy',
          'Agent Infrastructure Handbook',
          'AuntEdna Integration Strategy',
          'Firestore Index Registry',
        ]}
      />

      <SectionBlock icon={Workflow} title="Current Stack">
        <DataTable columns={['Layer', 'Current System', 'Why It Exists']} rows={INFRA_ROWS} />
      </SectionBlock>

      <SectionBlock icon={KeyRound} title="Secret Storage Policy">
        <DataTable columns={['Storage Location', 'What Belongs There', 'Examples']} rows={SECRET_ROWS} />
        <CardGrid columns="xl:grid-cols-2">
          <InfoCard
            title="Primary Rule"
            accent="green"
            body="If a value can unlock external infrastructure on its own, treat it as a secret and store it in a secret system. If it is merely app configuration, Netlify env vars are still acceptable."
          />
          <InfoCard
            title="Explicit Anti-Pattern"
            accent="red"
            body="Do not store private keys, service-account JSON, refresh tokens, or raw API secrets inside Firestore, Realtime Database, Storage objects, or handbook content."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Cloud} title="Group Meet Scheduling Setup">
        <DataTable columns={['Concern', 'Current Home', 'Notes']} rows={GROUP_MEET_ROWS} />
        <CardGrid columns="xl:grid-cols-2">
          <InfoCard
            title="Service-Account Secret"
            accent="blue"
            body={
              <>
                Current secret name: <code className="text-xs">GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON</code>. The runtime also accepts <code className="text-xs">GROUP_MEET_GOOGLE_SERVICE_ACCOUNT_JSON</code> as an alternate name.
              </>
            }
          />
          <InfoCard
            title="Alias Caveat"
            accent="amber"
            body="Because meetings@fitwithpulse.ai is currently an alias of tre@fitwithpulse.ai, the delegated calendar owner must remain the real mailbox until a standalone scheduler user exists."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={KeyRound} title="Group Meet Guest Calendar Import">
        <DataTable columns={['Concern', 'Canonical Home', 'Notes']} rows={GROUP_MEET_GUEST_GCAL_ROWS} />
        <CardGrid columns="xl:grid-cols-2">
          <InfoCard
            title="Separate Consent Boundary"
            accent="green"
            body="This flow belongs to the public guest invite page and should never inherit the admin scheduler identity, delegated mailbox, or service-account JSON used for final event creation."
          />
          <InfoCard
            title="Privacy Boundary"
            accent="amber"
            body="The guest import flow is free/busy only. It should surface availability suggestions, not raw Google event titles, attendees, locations, or conferencing links."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={KeyRound} title="Brevo Email Credential Contract">
        <DataTable columns={['Concern', 'Canonical Home', 'Notes']} rows={BREVO_ROWS} />
        <CardGrid columns="xl:grid-cols-2">
          <InfoCard
            title="Current Reality"
            accent="amber"
            body="Friends of the Business, Group Meet, welcome emails, and other transactional flows all reuse the same Brevo env pattern. They are not pulling from a hidden alternate key source today."
          />
          <InfoCard
            title="Verification Checklist"
            accent="blue"
            body={
              <>
                Verify the actual runtime source before debugging app code:
                <br />
                <code className="text-xs">./node_modules/.bin/netlify env:list --context all --json</code>
                <br />
                <code className="text-xs">gcloud secrets list --project=quicklifts-dev-01</code>
                <br />
                <code className="text-xs">gcloud secrets list --project=quicklifts-dd3f1</code>
              </>
            }
          />
        </CardGrid>
        <BulletList
          items={[
            'If Brevo works on one machine and fails on another, first compare `BREVO_MARKETING_KEY`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, and `BREVO_SENDER_NAME` before changing application code.',
            'Do not invent new Brevo env names. Shared helpers and handbook docs are standardized on `BREVO_MARKETING_KEY` with `BREVO_API_KEY` as fallback.',
            'If a future decision moves Brevo into Secret Manager, add one documented bridge in shared runtime code and update this handbook at the same time.',
            'Until that bridge exists, local machine bootstrap and Netlify env parity are the operational source of truth for Brevo sends.',
          ]}
        />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Production Access Playbook">
        <DataTable columns={['Concern', 'Where To Look', 'Why It Matters']} rows={PRODUCTION_ACCESS_ROWS} />
        <CardGrid columns="xl:grid-cols-2">
          <InfoCard
            title="Most Common Prod Access Failure"
            accent="amber"
            body={
              <>
                If Firebase Admin code keeps acting like dev or throws production permission errors, check{' '}
                <code className="text-xs">GOOGLE_APPLICATION_CREDENTIALS</code> first. A dev service-account file in that env var will
                override the more useful user ADC path.
              </>
            }
          />
          <InfoCard
            title="Working Prod Query Pattern"
            accent="green"
            body={
              <>
                Production reads on this machine worked with:
                <br />
                <code className="text-xs">env -u GOOGLE_APPLICATION_CREDENTIALS node ...</code>
                <br />
                plus an explicit admin SDK project id of <code className="text-xs">quicklifts-dd3f1</code>.
              </>
            }
          />
        </CardGrid>
        <StepRail steps={PRODUCTION_ACCESS_STEPS} />
      </SectionBlock>

      <SectionBlock icon={Server} title="Runtime Boundary">
        <BulletList
          items={[
            'Netlify/Next server code is the execution layer that reads secrets, talks to OpenAI, sends Brevo email, reads and writes Firestore, and calls the Google Calendar API.',
            'Firestore stores operational state and audit trail for admin workflows such as Group Meet, but it should store references and outcomes rather than the raw secret material itself. Guest Google import should follow the same rule and keep only invite-scoped connection metadata.',
            'Google Workspace provides the human calendar identity; Google Cloud provides the machine credential and Secret Manager; the web app bridges the two.',
          ]}
        />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Operating Discipline">
        <StepRail steps={OPERATING_STEPS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Recommended Environment Surface">
        <CardGrid columns="xl:grid-cols-3">
          <InfoCard
            title="Keep In Netlify Env"
            accent="purple"
            body="Small runtime values like delegated user email, calendar id, organizer email, cron secrets, feature flags, and non-bulky API settings."
          />
          <InfoCard
            title="Keep In Secret Manager"
            accent="green"
            body="Structured machine credentials or any large secret that would create env-var sprawl, especially service-account JSON blobs and future infrastructure keys."
          />
          <InfoCard
            title="Keep Out Of Both Product Data And Repo"
            accent="red"
            body="Raw secrets should never be committed, embedded in handbook content, persisted in Firestore, or left in ad hoc local files after setup is complete."
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
}
