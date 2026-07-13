#!/usr/bin/env node
// =============================================================================
// seedJuniorCurriculum — seeds the `junior-curriculum` Firestore collection
// from scripts/data/junior-curriculum.json.
//
// Content source of truth for the PulseCheck Junior Track guided curriculum
// (PulseCheck repo: docs/specs/junior-track-guided-curriculum-spec.md). The
// JSON mirrors the iOS bundled seed (PulseCheck/Models/JuniorCurriculum.swift);
// keep the two in sync when editing lesson copy.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json \
//     node scripts/seedJuniorCurriculum.cjs [--project <id>] [--dry-run]
//
//   (default project is prod `quicklifts-dd3f1`)
//
// Idempotent: writes with { merge: true }, so re-running updates copy in
// place without touching athlete progress (which lives in junior-progress).
// =============================================================================

const admin = require('firebase-admin');
const path = require('node:path');
const fs = require('node:fs');

function parseArgs(argv) {
  const opts = {
    projectId: process.env.FIREBASE_PROJECT_ID || 'quicklifts-dd3f1',
    serviceAccountPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project') { opts.projectId = argv[++i]; continue; }
    if (a === '--service-account') { opts.serviceAccountPath = argv[++i]; continue; }
    if (a === '--dry-run') { opts.dryRun = true; continue; }
    if (a === '-h' || a === '--help') {
      console.log('Usage: GOOGLE_APPLICATION_CREDENTIALS=<path> node scripts/seedJuniorCurriculum.cjs [--project <id>] [--dry-run]');
      process.exit(0);
    }
  }
  return opts;
}

function initAdmin(opts) {
  if (admin.apps.length) return admin.app();
  const init = { projectId: opts.projectId };
  if (opts.serviceAccountPath) {
    init.credential = admin.credential.cert(require(path.resolve(opts.serviceAccountPath)));
  } else {
    init.credential = admin.credential.applicationDefault();
  }
  return admin.initializeApp(init);
}

function validateLesson(lesson) {
  const problems = [];
  const requiredStrings = ['id', 'pillarId', 'unitTitle', 'title', 'exerciseCategory', 'noraOpener', 'noraProbe', 'takeawayCue', 'kind'];
  for (const key of requiredStrings) {
    if (typeof lesson[key] !== 'string' || (key !== 'exerciseId' && lesson[key].trim() === '')) {
      problems.push(`missing/empty ${key}`);
    }
  }
  if (!/^[a-z0-9-]{3,64}$/.test(lesson.id || '')) problems.push('id must be kebab-case (matches junior-lesson-conversation LESSON_ID_PATTERN)');
  if (!['lesson', 'checkpoint'].includes(lesson.kind)) problems.push(`bad kind: ${lesson.kind}`);
  if (!['champion-mindset', 'mental-performance', 'emotional-regulation'].includes(lesson.pillarId)) problems.push(`bad pillarId: ${lesson.pillarId}`);
  if (!Number.isInteger(lesson.unitIndex) || !Number.isInteger(lesson.lessonIndex)) problems.push('unitIndex/lessonIndex must be integers');
  if (!Number.isInteger(lesson.durationMinutes) || lesson.durationMinutes < 1) problems.push('durationMinutes must be a positive integer');
  // AGENTS.md athlete-copy rule from the PulseCheck repo: never "rep(s)".
  const copy = `${lesson.title} ${lesson.noraOpener} ${lesson.noraProbe} ${lesson.takeawayCue}`;
  if (/\brep(s|etition|etitions)?\b/i.test(copy)) problems.push('athlete copy contains banned word "rep"');
  return problems;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const dataPath = path.resolve(__dirname, 'data', 'junior-curriculum.json');
  const lessons = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  if (!Array.isArray(lessons) || lessons.length === 0) {
    console.error('No lessons found in', dataPath);
    process.exit(1);
  }

  let failed = false;
  const seenIds = new Set();
  for (const lesson of lessons) {
    const problems = validateLesson(lesson);
    if (seenIds.has(lesson.id)) problems.push('duplicate id');
    seenIds.add(lesson.id);
    if (problems.length) {
      failed = true;
      console.error(`✗ ${lesson.id || '(no id)'}: ${problems.join('; ')}`);
    }
  }
  if (failed) {
    console.error('Validation failed — nothing written.');
    process.exit(1);
  }

  console.log(`Validated ${lessons.length} curriculum docs (${lessons.filter((l) => l.kind === 'checkpoint').length} checkpoints).`);
  if (opts.dryRun) {
    console.log('Dry run — no writes.');
    return;
  }

  initAdmin(opts);
  const db = admin.firestore();
  const batch = db.batch();
  const now = Date.now();
  for (const lesson of lessons) {
    const { id, ...fields } = lesson;
    batch.set(db.collection('junior-curriculum').doc(id), { ...fields, updatedAt: now }, { merge: true });
  }
  await batch.commit();
  console.log(`Seeded ${lessons.length} docs into junior-curriculum (project ${opts.projectId}).`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
