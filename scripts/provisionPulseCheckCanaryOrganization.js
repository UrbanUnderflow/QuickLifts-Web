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

const ORGANIZATION_ID = 'revival-strength-functional-bodybuilding';
const ORGANIZATIONS_COLLECTION = 'pulsecheck-organizations';
const SOURCE_BRIEF_PATH = 'docs/pulsecheck/canary-target-brief.md';

const organizationPayload = {
  displayName: 'Revival Strength / Functional Bodybuilding',
  legalName: 'Revival Strength / Functional Bodybuilding',
  organizationType: 'brand',
  invitePreviewImageUrl: '',
  status: 'provisioning',
  legacySource: null,
  legacyCoachId: '',
  implementationOwnerUserId: '',
  implementationOwnerEmail: '',
  primaryCustomerAdminName: 'Marcus Filly',
  primaryCustomerAdminEmail: '',
  additionalAdminContacts: [],
  defaultStudyPosture: 'operational',
  defaultClinicianBridgeMode: 'optional',
  notes: [
    'Canary PulseCheck organization shell for the selected coach-led target.',
    'Owner email remains unverified and must be confirmed directly before admin activation is generated or redeemed.',
    'Provisioned through the organization-first PulseCheck hierarchy, not the retired legacy coach signup path.',
  ].join(' '),
  implementationMetadata: {
    provisioningPath: 'pulsecheck-hierarchy',
    legacySignupPathUsed: false,
    canaryTarget: true,
    selectedTargetLeadId: 'LEAD-0007',
    selectedTargetEvidenceIds: ['EVID-0004', 'EVID-0005'],
    sourceBriefPath: SOURCE_BRIEF_PATH,
    firstPlannedTeamName: 'Persist',
    ownerContactStatus: 'pending-confirmation',
    provisionedBy: 'scripts/provisionPulseCheckCanaryOrganization.js',
    provisionedAt: FieldValue.serverTimestamp(),
    notes: 'Step 1 org shell only. Initial team, admin membership, and activation handoff remain pending.',
  },
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
};

async function main() {
  const organizationRef = db.collection(ORGANIZATIONS_COLLECTION).doc(ORGANIZATION_ID);
  const existing = await organizationRef.get();

  if (existing.exists) {
    console.error(`Refusing to overwrite existing organization: ${ORGANIZATION_ID}`);
    process.exit(1);
  }

  await organizationRef.set(organizationPayload, { merge: false });

  const created = await organizationRef.get();
  if (!created.exists) {
    throw new Error('Organization write reported success but document was not found on readback.');
  }

  const data = created.data() || {};
  const summary = {
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
