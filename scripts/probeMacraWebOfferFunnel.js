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
  let lane = 0;
  let clickedIntoFn = 0; // passed signature + user found (webOffer24hClickedAt written)
  let sessions = 0; // Stripe session created
  let checkoutStarted = 0;
  let converted = 0;
  const stallStatuses = {}; // terminal status among clickers who never reached checkout_started

  snap.forEach((doc) => {
    const d = doc.data();
    const mes = d.macraEmailSequenceState || {};
    const s = mes.webOffer24hStatus;
    if (s == null) return;
    lane += 1;
    statusCounts[s] = (statusCounts[s] || 0) + 1;

    const didClick = mes.webOffer24hClickedAt != null;
    const didCheckout = mes.webOffer24hCheckoutStartedAt != null;
    const didConvert =
      mes.webOffer24hConvertedAt != null ||
      mes.webOffer24hPaidAt != null ||
      d.webOfferConvertedAt != null ||
      d.webOfferPaidAt != null;

    if (didClick) clickedIntoFn += 1;
    if (mes.webOffer24hCheckoutSessionId) sessions += 1;
    if (didCheckout) checkoutStarted += 1;
    if (didConvert) converted += 1;
    if (didClick && !didCheckout) stallStatuses[s] = (stallStatuses[s] || 0) + 1;
  });

  const pct = (n) => (lane ? `${((n / lane) * 100).toFixed(1)}%` : '—');

  console.log(`\nMacra users: ${snap.size}`);
  console.log(`\n=== WEB-OFFER FUNNEL (lane = ${lane}) ===`);
  console.log(`  reached checkout fn (clicked): ${clickedIntoFn}  (${pct(clickedIntoFn)})`);
  console.log(`  → Stripe session created:      ${sessions}`);
  console.log(`  → checkout_started:            ${checkoutStarted}  (${pct(checkoutStarted)})`);
  console.log(`  → converted / paid:            ${converted}`);

  console.log(`\n=== latest status breakdown ===`);
  Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  console.log(`\n=== clicked but NOT checkout_started — where they stall ===`);
  const stallEntries = Object.entries(stallStatuses).sort((a, b) => b[1] - a[1]);
  if (!stallEntries.length) console.log('  (none)');
  else stallEntries.forEach(([k, v]) => console.log(`  stuck at "${k}": ${v}`));
  process.exit(0);
}
run().catch((e) => { console.error('❌', e.message || e); process.exit(1); });
