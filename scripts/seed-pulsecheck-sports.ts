#!/usr/bin/env tsx

/**
 * Seeds code-owned PulseCheck Sports Intelligence policy fields into Firestore.
 *
 * Default mode is a dry diff:
 *   npx tsx scripts/seed-pulsecheck-sports.ts
 *
 * Apply mode writes only code-owned report policy/load model fields:
 *   npx tsx scripts/seed-pulsecheck-sports.ts --apply --project=quicklifts-dev-01
 *
 * Prompting drift is shown in the diff because Nora/Macra policy needs review,
 * but prompting is admin-owned and is preserved unless --include-prompting is
 * passed intentionally.
 */

import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue | undefined };

interface ScriptArgs {
  apply: boolean;
  includePrompting: boolean;
  project: string;
  serviceAccountPath: string;
}

interface SportEntry {
  id: string;
  name?: string;
  positions?: unknown[];
  attributes?: unknown[];
  metrics?: unknown[];
  prompting?: Record<string, unknown>;
  reportPolicy?: Record<string, unknown>;
  [key: string]: unknown;
}

interface SportDiff {
  sportId: string;
  sportName: string;
  status: 'added' | 'changed' | 'unchanged';
  changes: string[];
}

const CONFIG_COLLECTION = 'company-config';
const CONFIG_DOCUMENT = 'pulsecheck-sports';
const AUDIT_COLLECTION = 'pulsecheck-sport-policy-seed-audit';

const placeholderEnv: Record<string, string> = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'seed-script-placeholder',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'seed-script-placeholder.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'seed-script-placeholder',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'seed-script-placeholder.appspot.com',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:seedscript',
};

for (const [key, value] of Object.entries(placeholderEnv)) {
  process.env[key] ||= value;
}

const parseArgs = (argv: string[]): ScriptArgs => {
  const args: ScriptArgs = {
    apply: argv.includes('--apply'),
    includePrompting: argv.includes('--include-prompting'),
    project: process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'quicklifts-dev-01',
    serviceAccountPath: path.join(process.cwd(), 'serviceAccountKey.json'),
  };

  for (const arg of argv) {
    if (arg.startsWith('--project=')) {
      args.project = arg.split('=')[1]?.trim() || args.project;
    }
    if (arg.startsWith('--service-account=')) {
      args.serviceAccountPath = path.resolve(arg.split('=')[1]?.trim() || args.serviceAccountPath);
    }
  }

  return args;
};

const normalizeForCompare = (value: unknown): JsonValue => {
  if (value === undefined) return null;
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForCompare(entry));
  }
  if (typeof value === 'object') {
    const result: Record<string, JsonValue> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const entry = normalizeForCompare((value as Record<string, unknown>)[key]);
      if (entry !== null) {
        result[key] = entry;
      }
    }
    return result;
  }
  return String(value);
};

const stableStringify = (value: unknown) => JSON.stringify(normalizeForCompare(value));

// Recursively strip `undefined` values so Firestore admin SDK does not reject the write.
// Optional schema fields (e.g. loadModel.primitives[].filter) come through as undefined
// when absent; Firestore's serializer requires them to be omitted entirely.
const stripUndefinedDeep = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => stripUndefinedDeep(entry))
      .filter((entry) => entry !== undefined) as unknown as T;
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry === undefined) continue;
    output[key] = stripUndefinedDeep(entry);
  }
  return output as T;
};

const hasChanged = (left: unknown, right: unknown) => stableStringify(left) !== stableStringify(right);

const summarizeFieldChange = (field: string, current: unknown, next: unknown) => {
  if (!current && next) return `${field}: added`;
  if (current && !next) return `${field}: would remove current value`;
  return `${field}: changed`;
};

const buildAdminApp = (args: ScriptArgs) => {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  if (fs.existsSync(args.serviceAccountPath)) {
    return initializeApp({
      projectId: args.project,
      credential: cert(JSON.parse(fs.readFileSync(args.serviceAccountPath, 'utf8'))),
    });
  }

  return initializeApp({
    projectId: args.project,
    credential: applicationDefault(),
  });
};

const loadDefaults = async (): Promise<SportEntry[]> => {
  const module = await import('../src/api/firebase/pulsecheckSportConfig');
  return module.getDefaultPulseCheckSports() as SportEntry[];
};

const buildDiff = (currentSports: SportEntry[], defaultSports: SportEntry[]): SportDiff[] => {
  const currentById = new Map(currentSports.map((sport) => [String(sport.id), sport]));

  return defaultSports.map((defaultSport) => {
    const sportId = String(defaultSport.id);
    const current = currentById.get(sportId);
    const changes: string[] = [];

    if (!current) {
      return {
        sportId,
        sportName: defaultSport.name || sportId,
        status: 'added',
        changes: ['sport missing in Firestore; will preserve code defaults for the full sport entry'],
      };
    }

    if (hasChanged(current.reportPolicy, defaultSport.reportPolicy)) {
      changes.push(summarizeFieldChange('reportPolicy', current.reportPolicy, defaultSport.reportPolicy));
    }

    const currentLoadModel = (current.reportPolicy || {}).loadModel;
    const nextLoadModel = (defaultSport.reportPolicy || {}).loadModel;
    if (hasChanged(currentLoadModel, nextLoadModel)) {
      changes.push(summarizeFieldChange('reportPolicy.loadModel', currentLoadModel, nextLoadModel));
    }

    if (hasChanged(current.prompting, defaultSport.prompting)) {
      changes.push('prompting: changed (diff only; preserved unless --include-prompting is passed)');
    }

    return {
      sportId,
      sportName: current.name || defaultSport.name || sportId,
      status: changes.length > 0 ? 'changed' : 'unchanged',
      changes,
    };
  });
};

const mergeSports = (currentSports: SportEntry[], defaultSports: SportEntry[], args: ScriptArgs): SportEntry[] => {
  const currentById = new Map(currentSports.map((sport) => [String(sport.id), sport]));
  const defaultById = new Map(defaultSports.map((sport) => [String(sport.id), sport]));
  const merged: SportEntry[] = [];

  for (const defaultSport of defaultSports) {
    const current = currentById.get(String(defaultSport.id));
    if (!current) {
      merged.push(defaultSport);
      continue;
    }

    merged.push({
      ...current,
      reportPolicy: defaultSport.reportPolicy,
      ...(args.includePrompting ? { prompting: defaultSport.prompting } : {}),
    });
  }

  for (const currentSport of currentSports) {
    if (!defaultById.has(String(currentSport.id))) {
      merged.push(currentSport);
    }
  }

  return merged;
};

const printDiff = (diff: SportDiff[]) => {
  const changed = diff.filter((entry) => entry.status !== 'unchanged');

  if (changed.length === 0) {
    console.log('No Sports Intelligence policy drift found.');
    return;
  }

  console.log(`Sports Intelligence policy drift (${changed.length} sport${changed.length === 1 ? '' : 's'}):`);
  for (const entry of changed) {
    console.log(`\n- ${entry.sportName} (${entry.sportId})`);
    for (const change of entry.changes) {
      console.log(`  • ${change}`);
    }
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const defaultSports = await loadDefaults();
  const app = buildAdminApp(args);
  const db = getFirestore(app);
  const configRef = db.collection(CONFIG_COLLECTION).doc(CONFIG_DOCUMENT);
  const configSnap = await configRef.get();
  const currentSports = configSnap.exists && Array.isArray(configSnap.data()?.sports)
    ? (configSnap.data()?.sports as SportEntry[])
    : [];

  const diff = buildDiff(currentSports, defaultSports);
  printDiff(diff);

  if (!args.apply) {
    console.log('\nDiff mode only. Re-run with --apply to write reportPolicy/loadModel defaults.');
    return;
  }

  const nextSports = mergeSports(currentSports, defaultSports, args);
  const sportsForWrite = stripUndefinedDeep(nextSports);
  await configRef.set(
    {
      sports: sportsForWrite,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBySource: 'seed-pulsecheck-sports',
      updatedByUid: 'system-script',
      seedMetadata: {
        project: args.project,
        includePrompting: args.includePrompting,
        defaultSportCount: defaultSports.length,
        changedSportCount: diff.filter((entry) => entry.status !== 'unchanged').length,
        appliedAt: FieldValue.serverTimestamp(),
      },
    },
    { merge: true },
  );

  await db.collection(AUDIT_COLLECTION).add({
    project: args.project,
    includePrompting: args.includePrompting,
    changedSports: diff.filter((entry) => entry.status !== 'unchanged'),
    createdAt: FieldValue.serverTimestamp(),
    source: 'scripts/seed-pulsecheck-sports.ts',
  });

  console.log(`\nApplied Sports Intelligence policy defaults for ${defaultSports.length} configured sports.`);
  console.log(args.includePrompting
    ? 'Prompting was included because --include-prompting was passed.'
    : 'Prompting was preserved; only reportPolicy/loadModel was written.');
};

main().catch((error) => {
  console.error('[seed-pulsecheck-sports] Failed:', error);
  process.exitCode = 1;
});
