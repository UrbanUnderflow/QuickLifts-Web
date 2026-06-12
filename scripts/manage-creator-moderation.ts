/**
 * Manage the creator shadow-ban list (company-config/creator-moderation).
 *
 * Shadow-banned creators are excluded from recommendation/AI-generation
 * surfaces (FWP Movers row, Move of the Day fallback, workout generation)
 * but remain fully searchable and viewable on their profiles.
 *
 * Usage:
 *   npx tsx scripts/manage-creator-moderation.ts                      # show current list
 *   npx tsx scripts/manage-creator-moderation.ts --add=melescot      # diff only
 *   npx tsx scripts/manage-creator-moderation.ts --add=melescot --apply
 *   npx tsx scripts/manage-creator-moderation.ts --remove=melescot --apply
 */

import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const CONFIG_COLLECTION = 'company-config';
const CONFIG_DOCUMENT = 'creator-moderation';

interface ScriptArgs {
  add: string[];
  remove: string[];
  apply: boolean;
  project: string;
  serviceAccountPath: string;
}

const parseArgs = (): ScriptArgs => {
  const args: ScriptArgs = {
    add: [],
    remove: [],
    apply: false,
    project: 'quicklifts-dd3f1',
    serviceAccountPath: path.join(process.cwd(), 'serviceAccountKey.json'),
  };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--apply') args.apply = true;
    else if (arg.startsWith('--add=')) args.add.push(arg.split('=')[1]?.trim().toLowerCase() || '');
    else if (arg.startsWith('--remove=')) args.remove.push(arg.split('=')[1]?.trim().toLowerCase() || '');
    else if (arg.startsWith('--project=')) args.project = arg.split('=')[1]?.trim() || args.project;
    else if (arg.startsWith('--service-account=')) {
      args.serviceAccountPath = path.resolve(arg.split('=')[1]?.trim() || args.serviceAccountPath);
    }
  }
  args.add = args.add.filter(Boolean);
  args.remove = args.remove.filter(Boolean);
  return args;
};

const buildAdminApp = (args: ScriptArgs) => {
  if (getApps().length > 0) return getApps()[0];
  if (fs.existsSync(args.serviceAccountPath)) {
    return initializeApp({
      projectId: args.project,
      credential: cert(JSON.parse(fs.readFileSync(args.serviceAccountPath, 'utf8'))),
    });
  }
  // House resolver: env JSON / ADC / Secret Manager — never a hardcoded key.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { resolveAdminCredential } = require('./lib/resolveAdminCredential');
  return initializeApp({ projectId: args.project, credential: resolveAdminCredential() });
};

const main = async () => {
  const args = parseArgs();
  const db = getFirestore(buildAdminApp(args));
  const ref = db.collection(CONFIG_COLLECTION).doc(CONFIG_DOCUMENT);
  const snapshot = await ref.get();
  const current: string[] = snapshot.exists
    ? ((snapshot.data()?.shadowBannedUsernames as string[]) || []).map((u) => u.toLowerCase())
    : [];

  console.log(`Current shadow-banned creators (${current.length}):`);
  for (const username of current) console.log(`  • ${username}`);

  if (!args.add.length && !args.remove.length) return;

  const next = new Set(current);
  for (const username of args.add) next.add(username);
  for (const username of args.remove) next.delete(username);
  const nextList = [...next].sort();

  console.log('\nAfter change:');
  for (const username of nextList) {
    const marker = !current.includes(username) ? ' (ADDING)' : '';
    console.log(`  • ${username}${marker}`);
  }
  for (const username of args.remove.filter((u) => current.includes(u))) {
    console.log(`  − ${username} (REMOVING)`);
  }

  if (!args.apply) {
    console.log('\nDiff mode only. Re-run with --apply to write.');
    return;
  }

  await ref.set(
    {
      shadowBannedUsernames: nextList,
      updatedAt: Date.now(),
      updatedBy: 'manage-creator-moderation script',
    },
    { merge: true }
  );
  console.log(`\nApplied. ${nextList.length} creators shadow-banned.`);
};

main().catch((error) => {
  console.error('manage-creator-moderation failed:', error);
  process.exit(1);
});
