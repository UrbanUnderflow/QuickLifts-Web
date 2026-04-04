#!/usr/bin/env node

const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
const { provisionPulseCheckCanaryOrganizationAndTeam } = require('../src/lib/server/pulsecheck/provisionOrganizationAndTeam');

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const adminApp = getApps()[0];
const db = getFirestore(adminApp);

async function main() {
  const result = await provisionPulseCheckCanaryOrganizationAndTeam({
    adminApp,
    params: {
      actorLabel: 'scripts/provisionPulseCheckCanaryHierarchy.js',
    },
  });
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
