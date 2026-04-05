#!/usr/bin/env node

const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
const { provisionPulseCheckCanaryAdminAccess } = require('../src/lib/server/pulsecheck/provisionOrganizationAndTeam');

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const adminApp = getApps()[0];
const db = getFirestore(adminApp);

async function main() {
  const result = await provisionPulseCheckCanaryAdminAccess({
    adminApp,
    params: {
      actorLabel: 'scripts/seedPulseCheckCanaryAdminHandoff.js',
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
