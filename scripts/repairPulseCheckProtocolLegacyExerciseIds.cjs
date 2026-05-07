#!/usr/bin/env node
// =============================================================================
// repairPulseCheckProtocolLegacyExerciseIds — audit and fix
// `pulsecheck-protocols` docs whose `label` ↔ `legacyExerciseId` mapping is
// inconsistent, which causes the iOS app to launch the wrong exercise (e.g.
// home shows "4-7-8 Relaxation Breathing" but Box Breathing actually runs
// because the doc's legacyExerciseId field points at `breathing-box`).
//
// Heuristic:
//   1. Build a label → expected legacyExerciseId map from the canonical
//      mental-training exercise library (`pulsecheck-mental-exercises`
//      collection: id + name).
//   2. For each published `pulsecheck-protocols` doc, compare the doc's
//      `legacyExerciseId` against the entry whose name matches the doc's
//      `label` (case-insensitive, whitespace-trimmed).
//   3. Print a diff. With --apply, write the corrected legacyExerciseId.
//
// Usage (audit only — DEFAULT, no writes):
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json \
//     node scripts/repairPulseCheckProtocolLegacyExerciseIds.cjs
//
// Usage (apply fixes):
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json \
//     node scripts/repairPulseCheckProtocolLegacyExerciseIds.cjs --apply
//
//   --project <id>            override target project (default
//                             `quicklifts-dd3f1`)
//   --service-account <path>  override the GOOGLE_APPLICATION_CREDENTIALS
//   --apply                   actually write the fix; otherwise dry-run
//
// Prints a per-doc table:
//   docId, label, currentLegacyExerciseId, suggestedLegacyExerciseId, action
// =============================================================================

const admin = require('firebase-admin');
const path = require('node:path');

const PROTOCOLS_COLLECTION = 'pulsecheck-protocols';
const EXERCISES_COLLECTION = 'pulsecheck-mental-exercises';

function parseArgs(argv) {
  const opts = {
    projectId: process.env.FIREBASE_PROJECT_ID || 'quicklifts-dd3f1',
    serviceAccountPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
    apply: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project') { opts.projectId = argv[++i]; continue; }
    if (a === '--service-account') { opts.serviceAccountPath = argv[++i]; continue; }
    if (a === '--apply') { opts.apply = true; continue; }
    if (a === '-h' || a === '--help') {
      console.log(
        'Usage: GOOGLE_APPLICATION_CREDENTIALS=<path> node scripts/repairPulseCheckProtocolLegacyExerciseIds.cjs [--project <id>] [--apply]'
      );
      process.exit(0);
    }
  }
  return opts;
}

function initAdmin(opts) {
  if (admin.apps.length) return admin.app();
  const init = { projectId: opts.projectId };
  if (opts.serviceAccountPath) {
    const serviceAccount = require(path.resolve(opts.serviceAccountPath));
    init.credential = admin.credential.cert(serviceAccount);
  } else {
    init.credential = admin.credential.applicationDefault();
  }
  return admin.initializeApp(init);
}

function normalize(text) {
  return String(text || '').trim().toLowerCase();
}

async function fetchExerciseLibrary(db) {
  const snap = await db.collection(EXERCISES_COLLECTION).get();
  // name (lowercased) → exercise id
  const byName = new Map();
  snap.docs.forEach((doc) => {
    const data = doc.data() || {};
    const name = normalize(data.name);
    if (!name) return;
    byName.set(name, doc.id);
  });
  return byName;
}

async function fetchProtocols(db) {
  const snap = await db.collection(PROTOCOLS_COLLECTION).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
}

function shouldRepairDoc(protocolDoc, exerciseLibraryByName) {
  const label = protocolDoc.label;
  const currentLegacy = protocolDoc.legacyExerciseId;
  if (!label) {
    return { skip: true, reason: 'no label' };
  }
  const expected = exerciseLibraryByName.get(normalize(label));
  if (!expected) {
    return { skip: true, reason: 'no matching exercise by label' };
  }
  if (normalize(expected) === normalize(currentLegacy)) {
    return { skip: true, reason: 'already correct' };
  }
  return { skip: false, expected };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  initAdmin(opts);
  const db = admin.firestore();

  console.log(`[repair] project=${opts.projectId} mode=${opts.apply ? 'APPLY' : 'DRY-RUN'}`);

  const exerciseLibraryByName = await fetchExerciseLibrary(db);
  console.log(`[repair] loaded ${exerciseLibraryByName.size} exercises from ${EXERCISES_COLLECTION}`);

  const protocols = await fetchProtocols(db);
  console.log(`[repair] loaded ${protocols.length} protocol docs from ${PROTOCOLS_COLLECTION}`);

  const repairs = [];
  const skipped = [];

  for (const proto of protocols) {
    const decision = shouldRepairDoc(proto, exerciseLibraryByName);
    if (decision.skip) {
      skipped.push({ id: proto.id, label: proto.label, reason: decision.reason });
      continue;
    }
    repairs.push({
      id: proto.id,
      label: proto.label,
      current: proto.legacyExerciseId || '(empty)',
      expected: decision.expected,
    });
  }

  if (repairs.length === 0) {
    console.log('[repair] no protocol docs need a fix.');
  } else {
    console.log(`[repair] ${repairs.length} protocol doc(s) have a label ↔ legacyExerciseId mismatch:`);
    for (const r of repairs) {
      console.log(`  - id=${r.id}  label="${r.label}"  current=${r.current}  →  expected=${r.expected}`);
    }
  }

  if (opts.apply && repairs.length > 0) {
    console.log('[repair] applying fixes…');
    const batch = db.batch();
    for (const r of repairs) {
      batch.update(db.collection(PROTOCOLS_COLLECTION).doc(r.id), {
        legacyExerciseId: r.expected,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    console.log(`[repair] updated ${repairs.length} doc(s).`);
  } else if (repairs.length > 0) {
    console.log('[repair] dry-run only. Re-run with --apply to write the fixes.');
  }

  // Show a small sample of skips for sanity.
  if (skipped.length > 0) {
    console.log(`[repair] skipped ${skipped.length} doc(s) (sample):`);
    for (const s of skipped.slice(0, 5)) {
      console.log(`  - id=${s.id}  label="${s.label || '(none)'}"  reason=${s.reason}`);
    }
  }
}

main().catch((err) => {
  console.error('[repair] fatal:', err);
  process.exit(1);
});
