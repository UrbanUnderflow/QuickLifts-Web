#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { resolveAdminCredential } = require('./lib/resolveAdminCredential');
const { buildMacraOperatingRead, renderMacraOperatingReadMarkdown } = require('./lib/macraOpsRead');

function parseArgs(argv) {
  return argv.reduce((acc, arg) => {
    if (arg === '--write') acc.write = true;
    if (arg === '--json') acc.json = true;
    if (arg.startsWith('--date=')) acc.dateKey = arg.slice('--date='.length);
    if (arg.startsWith('--out=')) acc.outPath = arg.slice('--out='.length);
    return acc;
  }, { write: false, json: false, dateKey: '', outPath: '' });
}

function initDb() {
  const app = getApps()[0] || initializeApp({ credential: resolveAdminCredential() }, `macra-ops-read-${Date.now()}`);
  return getFirestore(app);
}

async function writeRead(db, read, markdown, outPath) {
  const artifactPath = outPath || path.join('docs', 'ops', `macra-operating-read-${read.targetDate}.md`);
  const absolutePath = path.resolve(process.cwd(), artifactPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, markdown, 'utf8');

  await db.collection('macra-operating-reads').doc(read.targetDate).set({
    ...read,
    artifactPath,
    writtenAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await db.collection('agent-commands').add({
    from: 'nora',
    to: 'admin',
    type: 'chat',
    content: `${read.operatorSummary}\n\nAction: ${read.action}\n\nNext: ${read.recommendedNextSteps[0] || 'No next step recorded.'}`,
    proactiveType: read.action === 'refresh_data_first' ? 'warning' : 'finding',
    operatorEvent: read.action === 'refresh_data_first' ? 'data-blocker' : 'macra-operating-read',
    operatorPriority: read.action === 'refresh_data_first' ? 'urgent' : 'update',
    operatorSummary: read.operatorSummary,
    evidenceRefs: [artifactPath, 'macra-operating-reads/' + read.targetDate],
    artifactUrls: [artifactPath],
    missionId: 'macra-growth-ops',
    status: 'completed',
    createdAt: FieldValue.serverTimestamp(),
    completedAt: FieldValue.serverTimestamp(),
  });

  return artifactPath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = initDb();
  const read = await buildMacraOperatingRead(db, { dateKey: args.dateKey || undefined });
  const markdown = renderMacraOperatingReadMarkdown(read);

  if (args.write) {
    const artifactPath = await writeRead(db, read, markdown, args.outPath);
    console.log(`Wrote ${artifactPath}`);
    console.log(`Stored macra-operating-reads/${read.targetDate}`);
  }

  if (args.json) {
    console.log(JSON.stringify(read, null, 2));
  } else {
    console.log(markdown);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
