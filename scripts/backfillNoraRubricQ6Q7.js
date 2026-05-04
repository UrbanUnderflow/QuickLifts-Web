#!/usr/bin/env node

/**
 * Backfill Q6 (No mystery pronouns) and Q7 (Show the trade) into the
 * `noraRubricQuestions` Firestore collection.
 *
 * Context: PulseCheck/Views/Admin/NoraRubricAdmin.swift's NoraRubricService
 * seeds the collection only when empty. Existing tenants already have the
 * 5 originals seeded and won't auto-pick up the two new questions added
 * to seedQuestions on 2026-05-03. This script writes the two new docs
 * idempotently — re-running is safe (it skips when an order:5 / order:6
 * doc already exists with the matching prompt).
 *
 * Usage:
 *   node scripts/backfillNoraRubricQ6Q7.js
 *
 * Requires: serviceAccountKey.json at the repo root.
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
const app = initializeApp({ credential: cert(require(serviceAccountPath)) });
const db = getFirestore(app);

const COLLECTION = 'noraRubricQuestions';

// Mirror NoraRubricQuestion.seedQuestions Q6 + Q7 in
// PulseCheck/Views/Admin/NoraRubricAdmin.swift — keep byte-identical.
const NEW_QUESTIONS = [
  {
    docId: 'q6-no-mystery-pronouns',
    prompt:
      "No mystery pronouns: if I delete every 'it / that / this / them / the [thing]', can the athlete still know what I'm talking about?",
    rationale:
      "Pronouns without a named antecedent in the same message leave the athlete guessing. 'That energy', 'the rep', 'I'll match it' are fog. Name the state back, name the session by its actual label, name the data — then pronouns are fine. The athlete tapping an emoji or card is not an antecedent; name it back.",
    order: 5,
    enabled: true,
  },
  {
    docId: 'q7-show-the-trade',
    prompt:
      "Show the trade: if I'm asking the athlete a question, does the message also show what I'll do with the answer?",
    rationale:
      "'Where's that energy coming from?' without 'so I can pick a calmer rep or a harder one' is therapy-speak. Coaches ask questions to make a decision — show the decision. If you can't name what changes based on the answer, the question is extractive and doesn't belong.",
    order: 6,
    enabled: true,
  },
];

async function main() {
  const now = Date.now() / 1000;
  let written = 0;
  let skipped = 0;

  for (const q of NEW_QUESTIONS) {
    // Skip if any doc already exists at this order with the same prompt
    // (handles the case where someone added Q6/Q7 manually via the admin
    // view with a different docId).
    const existingByOrder = await db
      .collection(COLLECTION)
      .where('order', '==', q.order)
      .limit(1)
      .get();

    if (!existingByOrder.empty) {
      const doc = existingByOrder.docs[0];
      const existingPrompt = (doc.data().prompt || '').trim();
      if (existingPrompt === q.prompt.trim()) {
        console.log(`  ✓ skip order ${q.order} — already present (doc: ${doc.id})`);
        skipped += 1;
        continue;
      }
      console.warn(
        `  ! order ${q.order} occupied by a different question (doc: ${doc.id}, prompt: "${existingPrompt}"). Leaving in place — resolve manually if intended.`
      );
      skipped += 1;
      continue;
    }

    // Also defend against re-running with the same docId (idempotent).
    const docRef = db.collection(COLLECTION).doc(q.docId);
    const existing = await docRef.get();
    if (existing.exists) {
      console.log(`  ✓ skip ${q.docId} — already present`);
      skipped += 1;
      continue;
    }

    await docRef.set({
      prompt: q.prompt,
      rationale: q.rationale,
      order: q.order,
      enabled: q.enabled,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`  + wrote ${q.docId} (order: ${q.order})`);
    written += 1;
  }

  console.log(`\nDone. Wrote ${written}, skipped ${skipped}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
