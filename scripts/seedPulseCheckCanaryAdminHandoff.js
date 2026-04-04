#!/usr/bin/env node

const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
const { seedInitialPulseCheckAdminHandoff } = require('../src/lib/server/pulsecheck/provisionOrganizationAndTeam');

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const adminApp = getApps()[0];
const db = getFirestore(adminApp);

async function main() {
  const result = await seedInitialPulseCheckAdminHandoff({
    adminApp,
    input: {
      actorLabel: 'scripts/seedPulseCheckCanaryAdminHandoff.js',
      organizationId: 'revival-strength-functional-bodybuilding',
      teamId: 'revival-strength-functional-bodybuilding--persist',
      handoffKey: 'marcus-filly',
      targetOwnerName: 'Marcus Filly',
      targetOwnerEmail: '',
      sourceBriefPath: 'docs/pulsecheck/canary-target-brief.md',
      selectedTargetLeadId: 'LEAD-0007',
      selectedTargetEvidenceIds: ['EVID-0004', 'EVID-0005'],
      notes: 'Reserved initial admin handoff artifact before activation. Owner email remains unverified until direct confirmation.',
    },
  });

  const [organizationMembershipSnap, teamMembershipSnap] = await Promise.all([
    db.collection('pulsecheck-organization-memberships').doc(result.organizationMembershipId).get(),
    db.collection('pulsecheck-team-memberships').doc(result.teamMembershipId).get(),
  ]);

  if (!organizationMembershipSnap.exists || !teamMembershipSnap.exists) {
    throw new Error('Admin handoff seed completed but membership readback verification failed.');
  }

  console.log(
    JSON.stringify(
      {
        result,
        organizationMembership: organizationMembershipSnap.data(),
        teamMembership: teamMembershipSnap.data(),
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
