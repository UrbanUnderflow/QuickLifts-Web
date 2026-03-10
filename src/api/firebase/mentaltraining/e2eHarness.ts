import {
  collection,
  deleteDoc,
  doc,
  documentId,
  endAt,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  startAt,
} from 'firebase/firestore';

import type { Firestore } from 'firebase/firestore';

import { SIM_MODULES_COLLECTION, SIM_VARIANTS_COLLECTION } from './collections';

const E2E_HISTORY_COLLECTION = 'history';

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sanitizeNamespace(namespace: string) {
  const normalized = slugify(namespace || 'e2e-registry');
  return normalized || 'e2e-registry';
}

function buildPrefix(namespace: string) {
  return `${sanitizeNamespace(namespace)}-`;
}

function buildFixtureName(sourceName: string) {
  return `[E2E] ${sourceName}`;
}

function buildNamespacedId(namespace: string, sourceId: string) {
  return `${buildPrefix(namespace)}${sourceId}`;
}

async function listPrefixedDocIds(db: Firestore, collectionName: string, prefix: string) {
  const snap = await getDocs(
    query(
      collection(db, collectionName),
      orderBy(documentId()),
      startAt(prefix),
      endAt(`${prefix}\uf8ff`)
    )
  );

  return snap.docs.map((entry) => entry.id);
}

async function deleteVariantHistory(db: Firestore, variantId: string) {
  const historySnap = await getDocs(collection(db, SIM_VARIANTS_COLLECTION, variantId, E2E_HISTORY_COLLECTION));
  await Promise.all(historySnap.docs.map((entry) => deleteDoc(entry.ref)));
}

async function cleanupRegistryFixtures(db: Firestore, namespace: string) {
  const prefix = buildPrefix(namespace);

  const [moduleIds, variantIds] = await Promise.all([
    listPrefixedDocIds(db, SIM_MODULES_COLLECTION, prefix),
    listPrefixedDocIds(db, SIM_VARIANTS_COLLECTION, prefix),
  ]);

  await Promise.all(moduleIds.map((id) => deleteDoc(doc(db, SIM_MODULES_COLLECTION, id))));

  for (const variantId of variantIds) {
    await deleteVariantHistory(db, variantId);
    await deleteDoc(doc(db, SIM_VARIANTS_COLLECTION, variantId));
  }

  return {
    namespace: sanitizeNamespace(namespace),
    deletedModules: moduleIds.length,
    deletedVariants: variantIds.length,
  };
}

async function findVariantByName(db: Firestore, sourceName: string) {
  const snap = await getDocs(collection(db, SIM_VARIANTS_COLLECTION));
  const match = snap.docs.find((entry) => entry.data()?.name === sourceName);
  if (!match) {
    throw new Error(`Unable to find sim-variant named "${sourceName}" for E2E fixture cloning.`);
  }
  return match;
}

async function cloneVariantFixtureByName(db: Firestore, sourceName: string, namespace: string) {
  const sourceDoc = await findVariantByName(db, sourceName);
  const sourceData = sourceDoc.data() || {};
  const fixtureId = buildNamespacedId(namespace, sourceDoc.id);
  const fixtureModuleId = buildNamespacedId(namespace, sourceData?.moduleDraft?.moduleId || sourceDoc.id);
  const fixtureName = buildFixtureName(sourceData?.name || sourceName);
  const now = Date.now();

  const fixtureData = {
    ...sourceData,
    name: fixtureName,
    moduleDraft: {
      ...(sourceData.moduleDraft || {}),
      moduleId: fixtureModuleId,
      name: fixtureName,
    },
    publishedModuleId: null,
    publishedAt: null,
    publishedSnapshot: null,
    buildArtifact: null,
    buildMeta: null,
    buildStatus: 'not_built',
    syncStatus: 'in_sync',
    sourceFingerprint: null,
    lastBuiltFingerprint: null,
    lastPublishedFingerprint: null,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, SIM_VARIANTS_COLLECTION, fixtureId), fixtureData);

  return {
    namespace: sanitizeNamespace(namespace),
    sourceVariantId: sourceDoc.id,
    variantId: fixtureId,
    variantName: fixtureName,
    moduleId: fixtureModuleId,
  };
}

export interface PulseE2EHarness {
  ensureAdminRecord: (email: string) => Promise<{
    email: string;
    existed: boolean;
  }>;
  cleanupRegistryFixtures: (namespace: string) => Promise<{
    namespace: string;
    deletedModules: number;
    deletedVariants: number;
  }>;
  cloneVariantFixtureByName: (
    sourceName: string,
    namespace: string
  ) => Promise<{
    namespace: string;
    sourceVariantId: string;
    variantId: string;
    variantName: string;
    moduleId: string;
  }>;
  inspectVariant: (variantId: string) => Promise<Record<string, any> | null>;
}

declare global {
  interface Window {
    __pulseE2E?: PulseE2EHarness;
  }
}

export function installPulseE2EHarness(db: Firestore) {
  if (typeof window === 'undefined') return;
  if (window.__pulseE2E) return;

  window.__pulseE2E = {
    ensureAdminRecord: async (email: string) => {
      const normalizedEmail = (email || '').trim().toLowerCase();
      if (!normalizedEmail) {
        throw new Error('An email is required to create or verify a dev admin record.');
      }

      const adminRef = doc(db, 'admin', normalizedEmail);
      const existing = await getDoc(adminRef);

      if (!existing.exists()) {
        await setDoc(adminRef, {
          email: normalizedEmail,
          createdAt: Date.now(),
          addedBy: 'admin-function',
          permissions: ['all'],
          source: 'playwright-e2e-harness',
        });
      } else {
        const existingData = existing.data() || {};
        await setDoc(adminRef, {
          ...existingData,
          email: normalizedEmail,
          addedBy: existingData.addedBy || 'admin-function',
          permissions: Array.isArray(existingData.permissions) && existingData.permissions.length > 0
            ? existingData.permissions
            : ['all'],
          source: existingData.source || 'playwright-e2e-harness',
        }, { merge: true });
      }

      return {
        email: normalizedEmail,
        existed: existing.exists(),
      };
    },
    cleanupRegistryFixtures: (namespace: string) => cleanupRegistryFixtures(db, namespace),
    cloneVariantFixtureByName: (sourceName: string, namespace: string) =>
      cloneVariantFixtureByName(db, sourceName, namespace),
    inspectVariant: async (variantId: string) => {
      const snap = await getDoc(doc(db, SIM_VARIANTS_COLLECTION, variantId));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },
  };
}
