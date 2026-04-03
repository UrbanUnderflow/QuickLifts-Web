import React from 'react';
import { Cloud, Database, KeyRound, Server, ShieldCheck, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const INFRA_ROWS = [
  ['Next.js web app', 'Netlify', 'Primary hosting layer for QuickLifts Web and its admin surfaces.'],
  ['Server routes / runtime APIs', 'Netlify Functions + Next API routes', 'Web-owned server execution for admin workflows, email sends, AI orchestration, and scheduling actions.'],
  ['Core product data', 'Firebase / Firestore', 'Canonical operational store for app data, admin records, and Group Meet request state.'],
  ['Identity', 'Firebase Auth', 'Cross-surface authentication and admin role verification.'],
  ['Media / documents', 'Firebase Storage', 'Binary file storage for uploads, media assets, and exported artifacts.'],
  ['Google-integrated infra secrets', 'Google Cloud Secret Manager', 'Secure home for high-sensitivity machine credentials like the Group Meet Google service-account JSON.'],
  ['External meeting infrastructure', 'Google Workspace + Google Calendar API', 'Scheduler mailbox identity, Calendar event creation, and Meet conference generation.'],
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

const BREVO_ROWS = [
  ['Transactional API key', '`BREVO_MARKETING_KEY` preferred, `BREVO_API_KEY` fallback', 'These are the only approved Brevo key env names across the repo. Shared helpers and working email flows already read this pair.'],
  ['Sender identity', '`BREVO_SENDER_EMAIL` + `BREVO_SENDER_NAME`', 'Optional overrides used by many functions. If omitted, individual flows fall back to hardcoded sender defaults.'],
  ['Current runtime contract', 'Netlify runtime env or local `.env.local`', 'All audited Brevo send helpers currently read plain env vars at runtime; there is no existing Brevo-specific Secret Manager bridge in code today.'],
  ['Cross-machine bootstrap', '`scripts/export-local-machine-setup.cjs`', 'The local machine setup bundle now carries Brevo envs so a new machine can inherit the same email setup instead of silently losing it.'],
  ['Current audit finding', 'Documentation gap previously hid the real source', 'As of Apr 3, 2026, the linked Netlify project `quickliftsapp` exposes only `NODE_VERSION`, and the documented GCP projects `quicklifts-dev-01` / `quicklifts-dd3f1` do not currently hold Brevo secrets in Secret Manager.'],
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
        version="Updated Apr 3, 2026"
        summary="Source-of-truth reference for how QuickLifts Web, Firebase, Netlify, Google Cloud, Google Workspace, and Secret Manager relate to each other operationally, with explicit rules for where sensitive credentials should live."
        highlights={[
          {
            title: 'Netlify Owns App Runtime',
            body: 'QuickLifts Web and its server-owned workflows still run through the Netlify/Next runtime layer, even when they depend on Google infrastructure or Firebase data.',
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

      <SectionBlock icon={Server} title="Runtime Boundary">
        <BulletList
          items={[
            'Netlify/Next server code is the execution layer that reads secrets, talks to OpenAI, sends Brevo email, reads and writes Firestore, and calls the Google Calendar API.',
            'Firestore stores operational state and audit trail for admin workflows such as Group Meet, but it should store references and outcomes rather than the raw secret material itself.',
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
