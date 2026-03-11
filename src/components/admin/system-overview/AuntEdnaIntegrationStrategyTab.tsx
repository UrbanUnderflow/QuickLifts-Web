import React from 'react';
import { BellRing, Database, Link2, PhoneCall, Server, ShieldCheck, Stethoscope, Waypoints, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const POSITION_ROWS = [
  ['Primary runtime contract', 'Service-to-service HTTP APIs plus signed webhooks', 'Live escalation routing and clinical handoff need deterministic backend contracts, not model-mediated tool invocation.'],
  ['Optional operator tooling layer', 'MCP server on top of AuntEdna APIs', 'Good fit for internal admin lookup, support tooling, and AI-assisted ops without becoming the runtime dependency for urgent care actions.'],
  ['Source of truth for clinical workflows', 'AuntEdna', 'Clinical triage state, appointment actions, crisis pathway outcomes, and clinician-side workflow should remain authoritative in AuntEdna.'],
  ['Source of truth for team routing configuration', 'PulseCheck plus linked AuntEdna profile ids', 'PulseCheck owns which org, team, or athlete points to which AuntEdna profile.'],
];

const ATHLETE_ACTION_ROWS = [
  ['Athlete escalation screen', 'Acknowledge they are open to connecting with a clinical expert.', 'PulseCheck records consent intent, timestamps it, and submits the initial handoff package to AuntEdna.'],
  ['AuntEdna follow-up triage', 'Provide any additional intake answers AuntEdna requires.', 'PulseCheck either redirects into AuntEdna-hosted triage or exchanges additional triage payloads over API.'],
  ['Clinical contact pathway', 'Receive clinician outreach, booking options, or crisis intervention.', 'AuntEdna runs the downstream care action and notifies PulseCheck of status changes.'],
];

const CLINICAL_ACTION_ROWS = [
  ['Text messaging to clinical expert', 'AuntEdna should expose an action to notify or message the assigned clinician lane.', 'Used when the case should immediately alert a campus or partner expert.'],
  ['Book appointment with clinical expert', 'AuntEdna should expose scheduling or appointment-creation capability.', 'Lets the handoff become a concrete follow-up instead of a passive alert.'],
  ['Invoke crisis pathway', 'AuntEdna should expose an explicit crisis action endpoint plus status updates.', 'Must be auditable and high-priority because it changes the operating mode immediately.'],
];

const API_ROWS = [
  ['GET /clinician-profiles?search=', 'Search existing clinician profiles or provider pools by name, org, or email.', 'Needed for the team clinical profile search UI in PulseCheck.'],
  ['GET /clinician-profiles/:id', 'Resolve a saved AuntEdna profile id into display-safe routing metadata.', 'Needed for validation, hydration, and stale-link checking.'],
  ['POST /clinician-profiles', 'Create a new clinician profile or routing profile in AuntEdna.', 'Needed for the PulseCheck provisioning form to make real profile creation calls.'],
  ['POST /clinician-profiles/:id/onboarding-link', 'Generate a clinician onboarding link or activation link in AuntEdna.', 'Needed so PulseCheck can email the clinician that their AuntEdna profile is ready to be set up.'],
  ['POST /escalations', 'Create the initial clinical handoff record from PulseCheck.', 'Payload should include athlete identity, team context, routing ids, summary, and risk metadata.'],
  ['POST /escalations/:id/opt-in', 'Record the athlete opt-in to clinical connection.', 'Makes the opt-in event explicit and auditable.'],
  ['POST /escalations/:id/triage-response', 'Submit additional triage answers after AuntEdna requests more context.', 'Supports the urgent-care style follow-up exchange.'],
  ['POST /escalations/:id/message-clinician', 'Trigger clinician outreach or clinician text messaging.', 'Supports the campus clinical expert notification lane.'],
  ['POST /escalations/:id/appointments', 'Create or request a clinical appointment.', 'Supports booking with a clinician from the handoff path.'],
  ['POST /escalations/:id/crisis-pathway', 'Escalate into AuntEdna crisis handling.', 'High-severity operation requiring explicit response semantics.'],
  ['GET /escalations/:id', 'Read current handoff status without exposing clinical notes into PulseCheck.', 'Needed for dashboard state and reconciliation.'],
];

const WEBHOOK_ROWS = [
  ['clinician.onboarding-link.created', 'AuntEdna created a valid onboarding link for a synced clinician profile.', 'PulseCheck can send or confirm the setup email and update local sync state.'],
  ['escalation.created', 'AuntEdna accepted the case and created the clinical handoff record.', 'PulseCheck marks the case as successfully handed off.'],
  ['athlete.opted_in', 'Opt-in was recorded inside AuntEdna.', 'PulseCheck updates the escalation timeline.'],
  ['triage.requested', 'AuntEdna needs additional athlete intake data.', 'PulseCheck prompts the athlete or staff for the next triage step.'],
  ['clinician.assigned', 'A clinician, group, or provider lane has been assigned.', 'PulseCheck stores limited routing metadata only.'],
  ['appointment.booked', 'A clinical appointment exists.', 'PulseCheck can display operational follow-up state without storing clinical details.'],
  ['crisis.invoked', 'Crisis pathway was triggered.', 'PulseCheck immediately reflects the safety state and suppresses inappropriate performance interactions.'],
  ['case.resolved', 'Clinical workflow is complete or shifted to ongoing care.', 'PulseCheck updates status and can relax acute handoff banners.'],
];

const CALLING_ROWS = [
  ['POST /clinical-calls', 'AuntEdna requests a clinician welfare-check call for a PulseCheck athlete.', 'Creates the call request, identifies the athlete, and chooses the routing path.'],
  ['POST /clinical-calls/:id/cancel', 'AuntEdna cancels a pending welfare-check call.', 'Lets the upstream clinical team stop a call before connection.'],
  ['POST /clinical-calls/:id/status', 'Call provider or PulseCheck updates call lifecycle state.', 'Tracks ringing, accepted, declined, missed, failed, and ended states.'],
  ['Webhook: call.accepted / call.missed / call.ended', 'PulseCheck reports call outcomes back to AuntEdna.', 'Keeps the clinical team synchronized without polling the app directly.'],
];

const CACHE_ROWS = [
  ['pulsecheck-auntedna-clinician-profiles', 'externalProfileId, displayName, organizationName, email, profileType, source, lastSyncedAt', 'Local lookup directory plus the initial bones of the future AuntEdna account handoff. This should give AuntEdna enough identity and routing context to continue onboarding after sync.'],
  ['pulsecheck-team-clinician-links', 'teamId, defaultClinicianProfileId, linkedByUserId, linkedAt', 'Fast resolution of the team default route plus audit history.'],
  ['pulsecheck-athlete-clinician-overrides', 'teamId, athleteId, clinicianProfileId, reasonTag?, updatedAt', 'Optional athlete-level provider override that falls back to team default when absent.'],
  ['pulsecheck-escalation-handoffs', 'pulseEscalationId, auntEdnaEscalationId, status, optedInAt, lastWebhookAt', 'Operational mirror of the handoff lifecycle for PulseCheck dashboards and retry logic.'],
];

const CREATE_SYNC_STEPS = [
  {
    title: 'Save a local pending clinician profile record first',
    body: 'When PulseCheck creates a clinician profile from its own form, write a local routing directory record immediately so the UI has a stable object to render and audit. This local record should also act as the initial AuntEdna handoff skeleton.',
    owner: 'PulseCheck',
  },
  {
    title: 'Call AuntEdna create-profile API',
    body: 'Send the profile creation request to AuntEdna and wait for the authoritative external profile id plus any canonical labels.',
    owner: 'PulseCheck -> AuntEdna',
  },
  {
    title: 'Upsert the local mirror with the authoritative AuntEdna id',
    body: 'Replace pending state with the real external id and canonical display metadata, then attach it to the team or athlete routing object.',
    owner: 'PulseCheck',
  },
  {
    title: 'Hand clinicians into AuntEdna through SSO-based onboarding',
    body: 'Once the profile is synced, PulseCheck should request an AuntEdna onboarding link, email the clinician that their AuntEdna profile is ready to be set up, and then hand them into AuntEdna through a single sign-on onboarding flow.',
    owner: 'PulseCheck + AuntEdna',
  },
  {
    title: 'Refresh over webhook or scheduled reconciliation',
    body: 'Profile labels and routing metadata should stay fresh via webhook updates where available, or a periodic reconciliation job otherwise.',
    owner: 'PulseCheck + AuntEdna',
  },
];

const ROUTING_ROWS = [
  ['1', 'athleteClinicianOverrideId', 'If an athlete has a specific provider, that provider wins for that athlete.'],
  ['2', 'team.defaultClinicianProfileId', 'Default route for everyone on the team when no individual override exists.'],
  ['3', 'organization default or implementation fallback', 'Used only if team routing is missing during setup or migration.'],
  ['4', 'internal fail-safe queue', 'If no valid AuntEdna route exists, fail closed into a monitored internal queue instead of silently dropping the case.'],
];

const PHASE_ROWS = [
  ['Phase 1', 'Profile search/read/create APIs plus the local PulseCheck clinician-profile directory mirror.'],
  ['Phase 2', 'Clinician onboarding-link generation plus setup-email handoff so newly created clinician profiles can finish onboarding inside AuntEdna.'],
  ['Phase 3', 'Team default clinician linkage and athlete override objects with deterministic fallback resolution.'],
  ['Phase 4', 'Escalation creation, opt-in recording, and handoff-status polling or webhook receipt.'],
  ['Phase 5', 'Appointment booking, clinician messaging, and crisis-pathway actions.'],
  ['Phase 6', 'Optional MCP server for operator tooling, AI-assisted lookup, and support workflows on top of the stable APIs.'],
  ['Phase 7', 'Real-time clinician welfare-check calling inside PulseCheck using a dedicated calling provider plus AuntEdna call-control APIs.'],
];

const AuntEdnaIntegrationStrategyTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="AuntEdna Integration"
        title="AuntEdna Integration Strategy"
        version="Version 1.0 | March 11, 2026"
        summary="Integration-layer artifact for how PulseCheck should connect to AuntEdna for clinician routing, escalation handoff, and clinical profile provisioning. This page defines the runtime contract, the local mirror model PulseCheck should keep, the API surface AuntEdna needs to expose, and where MCP fits without becoming the live escalation dependency."
        highlights={[
          {
            title: 'APIs First, MCP Second',
            body: 'Production escalation routing should run on deterministic APIs and webhooks. MCP can sit on top as an operator tooling layer, not the runtime backbone.',
          },
          {
            title: 'Keep a Local Routing Mirror',
            body: 'PulseCheck should store a local directory of AuntEdna clinician profiles and linkage records so labels, search results, and routing lookups do not depend on live fetches every time.',
          },
          {
            title: 'Clinical Source of Truth Stays External',
            body: 'PulseCheck should mirror routing metadata and handoff state, but AuntEdna remains the source of truth for clinical workflow details, care actions, and clinician-owned outcomes.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Integration architecture artifact for the boundary between PulseCheck safety workflows and AuntEdna clinical operations."
        sourceOfTruth="This document is authoritative for the API-layer relationship, local mirror strategy, routing resolution order, and the distinction between PulseCheck-owned routing metadata and AuntEdna-owned clinical workflow state."
        masterReference="Use this page when designing clinician-profile provisioning, team-to-clinician linking, athlete overrides, handoff APIs, and the event contract between PulseCheck and AuntEdna."
        relatedDocs={[
          'Escalation Integration Spec v1.1',
          'Team & Pilot Onboarding v1.2',
          'Permissions & Visibility',
          'Coach Dashboard IA',
        ]}
      />

      <SectionBlock icon={Link2} title="Strategic Position">
        <DataTable columns={['Decision Area', 'Recommended Position', 'Why']} rows={POSITION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Urgent-Care Style Handoff Model">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard title="Athlete-Side Actions" accent="blue" body={<DataTable columns={['Step', 'Action', 'System Behavior']} rows={ATHLETE_ACTION_ROWS} />} />
          <InfoCard title="Clinical-Team Actions" accent="green" body={<DataTable columns={['Capability', 'Needed AuntEdna Action', 'Why It Matters']} rows={CLINICAL_ACTION_ROWS} />} />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Server} title="Required AuntEdna API Surface">
        <DataTable columns={['Endpoint', 'Purpose', 'Why PulseCheck Needs It']} rows={API_ROWS} />
      </SectionBlock>

      <SectionBlock icon={BellRing} title="Required AuntEdna Webhooks">
        <DataTable columns={['Webhook Event', 'Meaning', 'Expected PulseCheck Reaction']} rows={WEBHOOK_ROWS} />
      </SectionBlock>

      <SectionBlock icon={PhoneCall} title="Real-Time Welfare Check Calling">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Recommended Position"
            accent="blue"
            body="If AuntEdna clinicians need to call athletes through the PulseCheck app, treat that as a dedicated call-control integration. AuntEdna should request the call, PulseCheck should orchestrate the athlete-side in-app experience, and a calling provider should handle the live media session."
          />
          <InfoCard
            title="Why It Is Late-Phase"
            accent="amber"
            body="Calling introduces real-time media, incoming-call UX, push notifications, provider dependencies, and mobile OS requirements. It should come after routing, handoff, booking, and crisis actions are already stable."
          />
        </CardGrid>
        <div className="mt-4">
          <DataTable columns={['Endpoint / Event', 'Purpose', 'Why It Exists']} rows={CALLING_ROWS} />
        </div>
        <CardGrid columns="md:grid-cols-3">
          <InfoCard title="Provider Layer" accent="green" body="Use a dedicated calling stack such as Twilio Voice, Agora, Stream, or another real-time provider rather than trying to carry live calling over the basic AuntEdna API alone." />
          <InfoCard title="PulseCheck Responsibilities" accent="purple" body="Incoming call UI, athlete authentication, push notifications, accept/decline flow, and call state write-back should live on the PulseCheck side." />
          <InfoCard title="AuntEdna Responsibilities" accent="red" body="The clinician-side system should initiate, cancel, and monitor the welfare-check request, while remaining the source of truth for the clinical reason and operator actions." />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Database} title="PulseCheck-Side Mirror and Cache Model">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard title="Recommended Local Objects" accent="purple" body={<DataTable columns={['Collection / Object', 'Minimum Fields', 'Purpose']} rows={CACHE_ROWS} />} />
          <InfoCard
            title="Boundary Rule"
            accent="amber"
            body={
              <BulletList
                items={[
                  'Store only routing metadata, labels, linkage ids, sync timestamps, and operational handoff state.',
                  'Treat the local clinician profile as the initial bones of the future AuntEdna account handoff, not as the completed clinical account itself.',
                  'Do not treat PulseCheck as the source of truth for clinical notes, clinician-only triage content, or protected care documentation.',
                  'Use AuntEdna external ids as the anchor for every local mirror object.',
                ]}
              />
            }
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Stethoscope} title="Create and Link Flow for Clinician Profiles">
        <StepRail steps={CREATE_SYNC_STEPS} />
      </SectionBlock>

      <SectionBlock icon={Waypoints} title="Routing Resolution Order">
        <DataTable columns={['Priority', 'Routing Source', 'Rule']} rows={ROUTING_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="MCP Role">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard title="Good MCP Uses" accent="green" body="Operator lookup tools, support dashboards, admin-assisted profile search, and AI workflows that need structured AuntEdna access." />
          <InfoCard title="Bad MCP Use" accent="red" body="Primary live escalation transport. A safety-critical handoff should not depend on a model-driven tool protocol as its only runtime contract." />
          <InfoCard title="Clean Pattern" accent="blue" body="Build stable AuntEdna APIs first, then expose selected capabilities through an MCP server for internal tooling if that helps operations." />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Implementation Sequence">
        <DataTable columns={['Phase', 'Goal']} rows={PHASE_ROWS} />
      </SectionBlock>
    </div>
  );
};

export default AuntEdnaIntegrationStrategyTab;
