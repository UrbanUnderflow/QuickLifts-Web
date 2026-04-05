#!/usr/bin/env node

const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const {
  provisionPulseCheckCanaryOrganization,
} = require('../src/lib/server/pulsecheck/provisionOrganizationAndTeam');

const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const adminApp = getApps()[0];
const db = getFirestore(adminApp);

async function main() {
  const result = await provisionPulseCheckCanaryOrganization({
    adminApp,
    params: {
      actorLabel: 'scripts/provisionPulseCheckCanaryOrganization.js',
    },
  });

  const created = await db.collection('pulsecheck-organizations').doc(result.organizationId).get();
  if (!created.exists) {
    throw new Error('Organization provisioner completed but document was not found on readback.');
  }

  const data = created.data() || {};
  const summary = {
    result,
    id: created.id,
    displayName: data.displayName,
    status: data.status,
    organizationType: data.organizationType,
    primaryCustomerAdminName: data.primaryCustomerAdminName,
    defaultStudyPosture: data.defaultStudyPosture,
    defaultClinicianBridgeMode: data.defaultClinicianBridgeMode,
    legacySource: data.legacySource ?? null,
    implementationMetadata: data.implementationMetadata,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
