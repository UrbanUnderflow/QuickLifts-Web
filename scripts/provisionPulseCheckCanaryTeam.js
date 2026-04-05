#!/usr/bin/env node

const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

const ORGANIZATIONS_COLLECTION = 'pulsecheck-organizations';
const TEAMS_COLLECTION = 'pulsecheck-teams';
const ORGANIZATION_ID = 'revival-strength-functional-bodybuilding';
const TEAM_ID = 'revival-strength-functional-bodybuilding--persist';
const SOURCE_BRIEF_PATH = 'docs/pulsecheck/canary-target-brief.md';

const teamPayload = {
  organizationId: ORGANIZATION_ID,
  displayName: 'Persist',
  teamType: 'brand-athlete-group',
  sportOrProgram: 'Coach-led training program',
  invitePreviewImageUrl: '',
  legacySource: null,
  legacyCoachId: '',
  siteLabel: 'Functional Bodybuilding / Persist',
  defaultAdminName: 'Marcus Filly',
  defaultAdminEmail: '',
  status: 'provisioning',
  defaultInvitePolicy: 'admin-staff-and-coaches',
  commercialConfig: {
    commercialModel: 'athlete-pay',
    teamPlanStatus: 'inactive',
    referralKickbackEnabled: false,
    referralRevenueSharePct: 0,
    revenueRecipientRole: 'team-admin',
    revenueRecipientUserId: '',
    billingOwnerUserId: '',
    billingCustomerId: '',
    teamPlanActivatedAt: null,
    teamPlanExpiresAt: null,
  },
  defaultClinicianProfileId: '',
  defaultClinicianExternalProfileId: '',
  defaultClinicianProfileName: '',
  defaultClinicianProfileType: 'group',
  defaultClinicianProfileSource: 'pulsecheck-local',
  implementationMetadata: {
    provisioningPath: 'pulsecheck-hierarchy',
    legacySignupPathUsed: false,
    canaryTarget: true,
    selectedTargetLeadId: 'LEAD-0007',
    selectedTargetEvidenceIds: ['EVID-0004', 'EVID-0005'],
    sourceBriefPath: SOURCE_BRIEF_PATH,
    routingDefaultsMode: 'organization-default-optional',
    invitePosture: 'admin-staff-and-coaches',
    provisionedBy: 'scripts/provisionPulseCheckCanaryTeam.js',
    provisionedAt: FieldValue.serverTimestamp(),
    notes: 'Initial canary team shell only. Team admin membership and activation handoff remain pending.',
  },
  notes: [
    'Canary PulseCheck team shell for the Persist program under Revival Strength / Functional Bodybuilding.',
    'Invite posture allows downstream staff and coach onboarding without PulseCheck repair once the first admin is activated.',
    'Clinician routing defaults intentionally inherit the organization optional-bridge posture until a concrete clinician profile is attached.',
  ].join(' '),
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
};

async function main() {
  const organizationRef = db.collection(ORGANIZATIONS_COLLECTION).doc(ORGANIZATION_ID);
  const teamRef = db.collection(TEAMS_COLLECTION).doc(TEAM_ID);

  const [organizationSnap, teamSnap] = await Promise.all([organizationRef.get(), teamRef.get()]);

  if (!organizationSnap.exists) {
    throw new Error(`Required organization does not exist: ${ORGANIZATION_ID}`);
  }

  if (teamSnap.exists) {
    console.error(`Refusing to overwrite existing team: ${TEAM_ID}`);
    process.exit(1);
  }

  await teamRef.set(teamPayload, { merge: false });

  const created = await teamRef.get();
  if (!created.exists) {
    throw new Error('Team write reported success but document was not found on readback.');
  }

  const data = created.data() || {};
  const summary = {
    id: created.id,
    organizationId: data.organizationId,
    displayName: data.displayName,
    teamType: data.teamType,
    sportOrProgram: data.sportOrProgram,
    status: data.status,
    defaultInvitePolicy: data.defaultInvitePolicy,
    siteLabel: data.siteLabel,
    defaultClinicianProfileId: data.defaultClinicianProfileId,
    defaultClinicianProfileSource: data.defaultClinicianProfileSource,
    implementationMetadata: data.implementationMetadata,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
