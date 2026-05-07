#!/usr/bin/env node

/**
 * Backfill conversation-level Nora rubric questions into Firestore.
 *
 * Q9: No repetitive dialogue
 * Q10: Decision rationale before assignment
 *
 * Re-running is safe: each question is skipped when its order is already
 * occupied by the matching prompt.
 *
 * Usage:
 *   node scripts/backfillNoraRubricQ9Q10.js
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

const QUESTIONS = [
  {
    docId: 'q9-no-repetitive-dialogue',
    prompt:
      'No repetitive dialogue: am I adding new signal instead of repeating the same headspace, energy, confidence, or readiness read?',
    rationale:
      "If Nora already said the athlete is in a solid headspace, the next turn cannot say the same thing again with slightly different adjectives. Use the athlete's new details to advance the decision, name the constraint, or ask for the missing signal.",
    order: 8,
    enabled: true,
  },
  {
    docId: 'q10-decision-rationale',
    prompt:
      'Decision rationale: before I assign a sim/protocol/exercise, did I explain why this choice fits this moment?',
    rationale:
      "'Let's start Visual Disruption Reset right here' is abrupt because the athlete cannot see the bridge. Say what in the conversation, readiness data, sport context, or prep timeline led to that assignment, then surface the card.",
    order: 9,
    enabled: true,
  },
];

async function writeQuestion(question, now) {
  const existingByOrder = await db
    .collection(COLLECTION)
    .where('order', '==', question.order)
    .limit(1)
    .get();

  if (!existingByOrder.empty) {
    const doc = existingByOrder.docs[0];
    const existingPrompt = (doc.data().prompt || '').trim();
    if (existingPrompt === question.prompt.trim()) {
      console.log(`  ✓ skip order ${question.order} — already present (doc: ${doc.id})`);
      return;
    }
    console.warn(
      `  ! order ${question.order} occupied by a different question (doc: ${doc.id}, prompt: "${existingPrompt}"). Leaving in place — resolve manually if intended.`,
    );
    return;
  }

  const docRef = db.collection(COLLECTION).doc(question.docId);
  const existing = await docRef.get();
  if (existing.exists) {
    console.log(`  ✓ skip ${question.docId} — already present`);
    return;
  }

  await docRef.set({
    prompt: question.prompt,
    rationale: question.rationale,
    order: question.order,
    enabled: question.enabled,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`  + wrote ${question.docId} (order: ${question.order})`);
}

async function main() {
  const now = Date.now() / 1000;
  for (const question of QUESTIONS) {
    await writeQuestion(question, now);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
