#!/usr/bin/env node

const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();
const COLLECTION = 'brandCampaigns';
const DOC_ID = 'gymshark-tier1-test-campaign';

async function main() {
  const now = new Date();
  const activeFrom = new Date(now.getTime() - 60 * 60 * 1000);
  const activeTo = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const payload = {
    brandName: 'Gymshark',
    logoUrl: 'https://cdn.brandfetch.io/idmJd-8IqD/w/400/h/400/theme/dark/logo.png?c=1bxid64Mup7aczewSAYMX&t=1748367601307',
    campaignTitle: 'Gymshark Summer Strength Drop — Test Campaign',
    ctaText: 'Open the co-branded challenge',
    ctaLink: '/partners/brands/gymshark',
    activeFrom: Timestamp.fromDate(activeFrom),
    activeTo: Timestamp.fromDate(activeTo),
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
    testMode: true,
    notes: 'Internal tier-1 test fixture for BrandCampaignBanner verification. Not evidence of a live external partnership.',
  };

  await db.collection(COLLECTION).doc(DOC_ID).set(payload, { merge: true });

  const snap = await db.collection(COLLECTION).doc(DOC_ID).get();
  if (!snap.exists) {
    throw new Error('Seed write completed but readback verification failed.');
  }

  const data = snap.data() || {};
  console.log(JSON.stringify({ id: snap.id, ...data }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
