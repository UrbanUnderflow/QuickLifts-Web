#!/usr/bin/env node
/**
 * READ-ONLY probe: tally Macra web-offer funnel by webOffer24hStatus to tell
 * whether ~0% web checkout is a tracking gap or real breakage.
 *
 * Usage: env -u GOOGLE_APPLICATION_CREDENTIALS node scripts/probeMacraWebOfferFunnel.js
 */
const { initializeApp } = require('firebase-admin/app');
const { resolveAdminCredential } = require('./lib/resolveAdminCredential');
const { getFirestore } = require('firebase-admin/firestore');

const PROD = 'quicklifts-dd3f1';

async function run() {
  const app = initializeApp({ credential: resolveAdminCredential(), projectId: PROD }, 'probe-macra-weboffer');
  const db = getFirestore(app);
  console.log(`🎯 ${app.options.projectId}`);

  const snap = await db.collection('users').where('registrationEntryPoint', '==', 'macra').get();
  const statusCounts = {};
  let hasStatus = 0;
  let hasCheckoutStartedAtField = 0;
  let statusCheckoutStarted = 0;

  let clickedCount = 0;
  snap.forEach((doc) => {
    const mes = doc.data().macraEmailSequenceState || {};
    const s = mes.webOffer24hStatus;
    if (s != null) {
      hasStatus += 1;
      statusCounts[s] = (statusCounts[s] || 0) + 1;
      if (s === 'checkout_started') statusCheckoutStarted += 1;
    }
    if (mes.webOffer24hCheckoutStartedAt != null) hasCheckoutStartedAtField += 1;
    if (mes.webOffer24hClickedAt != null) clickedCount += 1;
  });
  console.log(`(nested) webOffer24hClickedAt set: ${clickedCount}`);

  console.log(`\nMacra users: ${snap.size}`);
  console.log(`With webOffer24hStatus: ${hasStatus}`);
  console.log('Status breakdown:');
  Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log(`\nwebOffer24hStatus == 'checkout_started': ${statusCheckoutStarted}`);
  console.log(`docs with webOfferCheckoutStartedAt timestamp field set: ${hasCheckoutStartedAtField}`);
  process.exit(0);
}
run().catch((e) => { console.error('❌', e.message || e); process.exit(1); });
