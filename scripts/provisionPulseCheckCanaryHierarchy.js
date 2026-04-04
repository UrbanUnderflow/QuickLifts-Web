#!/usr/bin/env node

const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
const { provisionPulseCheckOrganizationAndTeam } = require('../src/lib/server/pulsecheck/provisionOrganizationAndTeam');

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const adminApp = getApps()[0];
const db = getFirestore(adminApp);

const payload = {
  actorLabel: 'scripts/provisionPulseCheckCanaryHierarchy.js',
  organization: {
    id: 'revival-strength-functional-bodybuilding',
    displayName: 'Revival Strength / Functional Bodybuilding',
    legalName: 'Revival Strength / Functional Bodybuilding',
    organizationType: 'brand',
    status: 'provisioning',
    primaryCustomerAdminName: 'Marcus Filly',
    primaryCustomerAdminEmail: '',
    defaultStudyPosture: 'operational',
    defaultClinicianBridgeMode: 'optional',
    notes:
      'Canary PulseCheck organization shell for the selected coach-led target. Owner email remains unverified and must be confirmed directly before admin activation is generated or redeemed. Provisioned through the organization-first PulseCheck hierarchy, not the retired legacy coach signup path.',
    implementationMetadata: {
      provisioningPath: 'pulsecheck-hierarchy',
      legacySignupPathUsed: false,
      canaryTarget: true,
      selectedTargetLeadId: 'LEAD-0007',
      selectedTargetEvidenceIds: ['EVID-0004', 'EVID-0005'],
      sourceBriefPath: 'docs/pulsecheck/canary-target-brief.md',
      firstPlannedTeamName: 'Persist',
      ownerContactStatus: 'pending-confirmation',
      provisionedBy: 'scripts/provisionPulseCheckCanaryHierarchy.js',
      notes: 'Hierarchy-owned canary organization shell. Initial admin membership and activation handoff remain pending.',
    },
  },
  team: {
    id: 'revival-strength-functional-bodybuilding--persist',
    displayName: 'Persist',
    teamType: 'brand-athlete-group',
    sportOrProgram: 'Coach-led training program',
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
    notes:
      'Canary PulseCheck team shell for the Persist program under Revival Strength / Functional Bodybuilding. Invite posture allows downstream staff and coach onboarding without PulseCheck repair once the first admin is activated. Clinician routing defaults intentionally inherit the organization optional-bridge posture until a concrete clinician profile is attached.',
    implementationMetadata: {
      provisioningPath: 'pulsecheck-hierarchy',
      legacySignupPathUsed: false,
      canaryTarget: true,
      selectedTargetLeadId: 'LEAD-0007',
      selectedTargetEvidenceIds: ['EVID-0004', 'EVID-0005'],
      sourceBriefPath: 'docs/pulsecheck/canary-target-brief.md',
      routingDefaultsMode: 'organization-default-optional',
      invitePosture: 'admin-staff-and-coaches',
      provisionedBy: 'scripts/provisionPulseCheckCanaryHierarchy.js',
      notes: 'Hierarchy-owned initial canary team shell only. Team admin membership and activation handoff remain pending.',
    },
  },
};

async function main() {
  const result = await provisionPulseCheckOrganizationAndTeam({ adminApp, input: payload });
  const [organizationSnap, teamSnap] = await Promise.all([
    db.collection('pulsecheck-organizations').doc(result.organizationId).get(),
    db.collection('pulsecheck-teams').doc(result.teamId).get(),
  ]);

  if (!organizationSnap.exists || !teamSnap.exists) {
    throw new Error('Provisioning helper completed but readback verification failed.');
  }

  console.log(
    JSON.stringify(
      {
        result,
        organization: organizationSnap.data(),
        team: teamSnap.data(),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
