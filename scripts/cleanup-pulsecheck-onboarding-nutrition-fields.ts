#!/usr/bin/env tsx

/**
 * One-off patch: removes nutrition/macro questions from the PulseCheck
 * sport-specific onboarding step, and fixes the Bodybuilding / Physique
 * Competition Date field (was required, had no real date picker in the app;
 * the app-side date picker landed separately in NoraOnboardingView.swift).
 *
 * This is NOT the general seed script (scripts/seed-pulsecheck-sports.ts).
 * That script intentionally never touches `attributes` — admin console edits
 * to attributes/positions always win over code defaults. This script exists
 * because those admin-owned attributes are exactly what needs a surgical fix
 * here, and it edits only the six named fields below. Every other sport,
 * attribute, metric, position list, prompting string, and report policy in
 * the live document is left byte-for-byte untouched.
 *
 * Default mode is a dry diff:
 *   npx tsx scripts/cleanup-pulsecheck-onboarding-nutrition-fields.ts
 *
 * Apply mode writes the changes:
 *   npx tsx scripts/cleanup-pulsecheck-onboarding-nutrition-fields.ts --apply --project=quicklifts-dev-01
 */

import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue | undefined };

interface ScriptArgs {
  apply: boolean;
  project: string;
  serviceAccountPath: string;
}

interface AttributeEntry {
  id?: string;
  key?: string;
  label?: string;
  scope?: string;
  required?: boolean;
  [key: string]: unknown;
}

interface SportEntry {
  id: string;
  name?: string;
  attributes?: AttributeEntry[];
  [key: string]: unknown;
}

const CONFIG_COLLECTION = 'company-config';
const CONFIG_DOCUMENT = 'pulsecheck-sports';
const AUDIT_COLLECTION = 'pulsecheck-sport-policy-seed-audit';

// sportId -> attribute keys to remove outright (nutrition/macro onboarding questions).
const NUTRITION_KEYS_TO_REMOVE: Record<string, string[]> = {
  football: ['bodyCompositionGoal'],
  wrestling: ['weightCutStatus'],
  crossfit: ['nutritionPriority'],
  'bodybuilding-physique': ['foodVarianceTolerance', 'approvedCarbSources', 'coachMacrosLocked'],
};

// sportId + attribute key -> field patches (not removals).
const FIELD_PATCHES: Record<string, Record<string, Partial<AttributeEntry>>> = {
  'bodybuilding-physique': {
    competitionDate: {
      required: false,
      label: 'Do you know your next competition date?',
    },
    cardioLoad: {
      scope: 'recovery',
    },
  },
};

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

interface PlannedChange {
  sportId: string;
  sportName: string;
  description: string;
}

const applyPatches = (sports: SportEntry[]): { nextSports: SportEntry[]; changes: PlannedChange[] } => {
  const changes: PlannedChange[] = [];

  const nextSports = sports.map((sport) => {
    const sportId = String(sport.id);
    const removeKeys = new Set(NUTRITION_KEYS_TO_REMOVE[sportId] ?? []);
    const patches = FIELD_PATCHES[sportId] ?? {};

    if (removeKeys.size === 0 && Object.keys(patches).length === 0) {
      return sport;
    }

    const currentAttributes = Array.isArray(sport.attributes) ? sport.attributes : [];
    const sportName = sport.name || sportId;

    const nextAttributes = currentAttributes
      .filter((attribute) => {
        const key = String(attribute.key ?? '');
        if (removeKeys.has(key)) {
          changes.push({ sportId, sportName, description: `remove attribute "${attribute.label ?? key}" (${key})` });
          return false;
        }
        return true;
      })
      .map((attribute) => {
        const key = String(attribute.key ?? '');
        const patch = patches[key];
        if (!patch) return attribute;

        const patchedFields = Object.entries(patch).filter(([field, nextValue]) => attribute[field] !== nextValue);
        if (patchedFields.length === 0) return attribute;

        for (const [field, nextValue] of patchedFields) {
          changes.push({
            sportId,
            sportName,
            description: `set ${key}.${field}: ${JSON.stringify(attribute[field])} -> ${JSON.stringify(nextValue)}`,
          });
        }

        return { ...attribute, ...patch };
      });

    return { ...sport, attributes: nextAttributes };
  });

  return { nextSports, changes };
};

const stripUndefinedDeep = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefinedDeep(entry)).filter((entry) => entry !== undefined) as unknown as T;
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

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const app = buildAdminApp(args);
  const db = getFirestore(app);
  const configRef = db.collection(CONFIG_COLLECTION).doc(CONFIG_DOCUMENT);
  const configSnap = await configRef.get();

  if (!configSnap.exists) {
    console.log(`No document at ${CONFIG_COLLECTION}/${CONFIG_DOCUMENT} — nothing to patch.`);
    return;
  }

  const currentSports = (Array.isArray(configSnap.data()?.sports) ? configSnap.data()?.sports : []) as SportEntry[];
  const { nextSports, changes } = applyPatches(currentSports);

  if (changes.length === 0) {
    console.log('No matching fields found — nothing to patch (may already be clean).');
    return;
  }

  console.log(`Planned changes (${changes.length}):`);
  for (const change of changes) {
    console.log(`  - [${change.sportName}] ${change.description}`);
  }

  if (!args.apply) {
    console.log('\nDiff mode only. Re-run with --apply to write these changes.');
    return;
  }

  await configRef.set(
    {
      sports: stripUndefinedDeep(nextSports),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBySource: 'cleanup-pulsecheck-onboarding-nutrition-fields',
      updatedByUid: 'system-script',
    },
    { merge: true },
  );

  await db.collection(AUDIT_COLLECTION).add({
    project: args.project,
    changes,
    createdAt: FieldValue.serverTimestamp(),
    source: 'scripts/cleanup-pulsecheck-onboarding-nutrition-fields.ts',
  });

  console.log(`\nApplied ${changes.length} change(s) to ${CONFIG_COLLECTION}/${CONFIG_DOCUMENT}.`);
};

main().catch((error) => {
  console.error('[cleanup-pulsecheck-onboarding-nutrition-fields] Failed:', error);
  process.exitCode = 1;
});
