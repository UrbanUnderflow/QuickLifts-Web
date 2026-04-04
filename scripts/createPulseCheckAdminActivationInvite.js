#!/usr/bin/env node

const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
const { issuePulseCheckAdminActivationInvite } = require('../src/lib/server/pulsecheck/provisionOrganizationAndTeam');

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const adminApp = getApps()[0];
const db = getFirestore(adminApp);

function readArg(name, fallback = '') {
  const direct = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3).trim();

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) {
    return String(process.argv[index + 1]).trim();
  }

  return fallback;
}

async function main() {
  const organizationId = readArg('organizationId', 'revival-strength-functional-bodybuilding');
  const teamId = readArg('teamId', 'revival-strength-functional-bodybuilding--persist');
  const targetOwnerName = readArg('name', 'Marcus Filly');
  const targetEmail = readArg('email');
  const expiresInDays = Number.parseInt(readArg('expiresInDays', '14'), 10);
  const baseUrl = readArg('baseUrl', process.env.NEXT_PUBLIC_SITE_URL || 'https://fitwithpulse.ai');

  if (!targetEmail) {
    throw new Error('Usage: node scripts/createPulseCheckAdminActivationInvite.js --email=<confirmed-owner-email> [--name="Marcus Filly"] [--organizationId=...] [--teamId=...] [--expiresInDays=14] [--baseUrl=https://fitwithpulse.ai]');
  }

  const result = await issuePulseCheckAdminActivationInvite({
    adminApp,
    input: {
      actorLabel: 'scripts/createPulseCheckAdminActivationInvite.js',
      organizationId,
      teamId,
      targetOwnerName,
      targetEmail,
      expiresInDays,
      baseUrl,
    },
  });

  const [adminInviteSnap, inviteLinkSnap, organizationSnap, teamSnap] = await Promise.all([
    db.collection('adminActivationInvites').doc(result.inviteId).get(),
    db.collection('pulsecheck-invite-links').doc(result.inviteLinkId).get(),
    db.collection('pulsecheck-organizations').doc(result.organizationId).get(),
    db.collection('pulsecheck-teams').doc(result.teamId).get(),
  ]);

  if (!adminInviteSnap.exists || !inviteLinkSnap.exists) {
    throw new Error('Invite write completed but readback verification failed.');
  }

  console.log(JSON.stringify({
    result,
    adminActivationInvite: adminInviteSnap.data(),
    inviteLink: inviteLinkSnap.data(),
    organization: organizationSnap.data(),
    team: teamSnap.data(),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
