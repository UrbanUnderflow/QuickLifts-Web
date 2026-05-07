#!/usr/bin/env node

/**
 * Backfill Q8 (Concrete action) into the `noraRubricQuestions`
 * Firestore collection.
 *
 * Context: PulseCheck/Views/Admin/NoraRubricAdmin.swift's
 * NoraRubricService seeds the collection only when empty. Existing
 * tenants that already have Q1-Q7 seeded won't auto-pick up Q8.
 * Re-running is safe: the script skips when an order:7 doc already
 * exists with the matching prompt.
 *
 * Usage:
 *   node scripts/backfillNoraRubricQ8.js
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

// Mirror NoraRubricQuestion.seedQuestions Q8 in
// PulseCheck/Views/Admin/NoraRubricAdmin.swift — keep byte-identical.
const QUESTION = {
  docId: 'q8-concrete-action',
  prompt:
    'Concrete action: can the athlete point to the actual session, pace, constraint, or next move this message changes?',
  rationale:
    "'You've got enough recovery to train clean today,' 'Recovery's workable,' and 'use it cleanly' sound like coaching but don't tell the athlete what to do. Name the session or rep by its real label, name the pace/effort limit, or name the next action. If the line still works for any workout, it's too vague.",
  order: 7,
  enabled: true,
};

async function main() {
  const now = Date.now() / 1000;

  const existingByOrder = await db
    .collection(COLLECTION)
    .where('order', '==', QUESTION.order)
    .limit(1)
    .get();

  if (!existingByOrder.empty) {
    const doc = existingByOrder.docs[0];
    const existingPrompt = (doc.data().prompt || '').trim();
    if (existingPrompt === QUESTION.prompt.trim()) {
      console.log(`  ✓ skip order ${QUESTION.order} — already present (doc: ${doc.id})`);
      process.exit(0);
    }
    console.warn(
      `  ! order ${QUESTION.order} occupied by a different question (doc: ${doc.id}, prompt: "${existingPrompt}"). Leaving in place — resolve manually if intended.`
    );
    process.exit(0);
  }

  const docRef = db.collection(COLLECTION).doc(QUESTION.docId);
  const existing = await docRef.get();
  if (existing.exists) {
    console.log(`  ✓ skip ${QUESTION.docId} — already present`);
    process.exit(0);
  }

  await docRef.set({
    prompt: QUESTION.prompt,
    rationale: QUESTION.rationale,
    order: QUESTION.order,
    enabled: QUESTION.enabled,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`  + wrote ${QUESTION.docId} (order: ${QUESTION.order})`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
