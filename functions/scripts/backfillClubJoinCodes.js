/**
 * One-shot backfill: assign a unique 6-char `joinCode` to every club doc
 * that doesn't already have one. Uses an alphabet that excludes visually
 * confusable characters (no 0, 1, I, L, O).
 *
 * Run from `QuickLifts-Web/functions`:
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
 *     node scripts/backfillClubJoinCodes.js
 *
 * Or pass `--dry-run` to print proposed assignments without writing.
 *
 * The script is idempotent — clubs that already have a non-empty joinCode
 * are skipped.
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789".split("");
const DEFAULT_LENGTH = 6;
const MAX_RETRIES_AT_LENGTH = 4;

function randomCode(length = DEFAULT_LENGTH) {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

async function isCodeFree(code, claimedThisRun) {
  if (claimedThisRun.has(code)) return false;
  const snap = await db
    .collection("clubs")
    .where("joinCode", "==", code)
    .limit(1)
    .get();
  return snap.empty;
}

async function generateUniqueCode(claimedThisRun) {
  let length = DEFAULT_LENGTH;
  let attempts = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = randomCode(length);
    // eslint-disable-next-line no-await-in-loop
    if (await isCodeFree(candidate, claimedThisRun)) {
      claimedThisRun.add(candidate);
      return candidate;
    }
    attempts += 1;
    if (attempts >= MAX_RETRIES_AT_LENGTH) {
      length += 2;
      attempts = 0;
    }
  }
}

async function run() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`[backfillClubJoinCodes] starting${dryRun ? " (dry run)" : ""}`);

  const snap = await db.collection("clubs").get();
  console.log(`[backfillClubJoinCodes] inspecting ${snap.size} clubs`);

  // Track codes already in use plus codes claimed during this run so we
  // never hand out the same code twice in a single batch.
  const claimed = new Set();
  snap.forEach((doc) => {
    const existing = (doc.data().joinCode || "").trim().toUpperCase();
    if (existing) claimed.add(existing);
  });

  let assigned = 0;
  let skipped = 0;
  const writes = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    const existing = (data.joinCode || "").trim().toUpperCase();
    if (existing) {
      skipped += 1;
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const code = await generateUniqueCode(claimed);
    console.log(
      `[backfillClubJoinCodes] ${doc.id} (${data.name || "<unnamed>"}) -> ${code}`
    );
    if (!dryRun) {
      writes.push(
        doc.ref.update({
          joinCode: code,
          updatedAt: Date.now() / 1000,
        })
      );
    }
    assigned += 1;
  }

  if (!dryRun) {
    await Promise.all(writes);
  }

  console.log(
    `[backfillClubJoinCodes] done. assigned=${assigned} skipped=${skipped} total=${snap.size}`
  );
}

run().catch((err) => {
  console.error("[backfillClubJoinCodes] failed:", err);
  process.exit(1);
});
