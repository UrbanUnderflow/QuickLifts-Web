/**
 * Exercise Library Service
 * 
 * Manages the mental exercise library including CRUD operations
 * and provides seeded exercise templates.
 */

import { db } from '../config';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import {
  MentalExercise,
  ExerciseCategory,
  ExerciseDifficulty,
  exerciseFromFirestore,
  exerciseToFirestore,
} from './types';
import { SIM_MODULES_COLLECTION } from './collections';

import { SEEDED_EXERCISES } from './exerciseSeed';
export { SEEDED_EXERCISES } from './exerciseSeed';

const COLLECTION = SIM_MODULES_COLLECTION;

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function shouldFallbackToSeededLibrary(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return (
    message.includes('requires an index')
    || message.includes('code=failed-precondition')
    || message.includes('code=unavailable')
    || message.includes('Could not reach Cloud Firestore backend')
  );
}

function getSeededExercises() {
  return SEEDED_EXERCISES
    .filter((exercise) => exercise.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function isLaunchablePublishedExercise(exercise: MentalExercise | null | undefined): exercise is MentalExercise {
  return Boolean(
    exercise
    && exercise.isActive
    && hasNonEmptyString(exercise.id)
    && hasNonEmptyString(exercise.publishedFingerprint)
    && exercise.syncStatus === 'in_sync'
    && exercise.buildArtifact
    && hasNonEmptyString(exercise.buildArtifact.sourceFingerprint)
    && hasNonEmptyString(exercise.engineKey || exercise.buildArtifact.engineKey)
    && exercise.runtimeConfig
    && typeof exercise.runtimeConfig === 'object'
    && exercise.variantSource
    && typeof exercise.variantSource.publishedAt === 'number'
    && Number.isFinite(exercise.variantSource.publishedAt)
  );
}

// ============================================================================
// SERVICE
// ============================================================================

export const simModuleLibraryService = {
  /**
   * Get all active exercises
   */
  async getAll(): Promise<MentalExercise[]> {
    try {
      const q = query(
        collection(db, COLLECTION),
        where('isActive', '==', true),
        orderBy('sortOrder', 'asc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => exerciseFromFirestore(d.id, d.data()));
    } catch (error) {
      if (!shouldFallbackToSeededLibrary(error)) {
        throw error;
      }

      console.warn('[exerciseLibraryService] Falling back to seeded exercise library for getAll:', error);
      return getSeededExercises();
    }
  },

  /**
   * Get exercises by category
   */
  async getByCategory(category: ExerciseCategory): Promise<MentalExercise[]> {
    try {
      const q = query(
        collection(db, COLLECTION),
        where('category', '==', category),
        where('isActive', '==', true),
        orderBy('sortOrder', 'asc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => exerciseFromFirestore(d.id, d.data()));
    } catch (error) {
      if (!shouldFallbackToSeededLibrary(error)) {
        throw error;
      }

      console.warn('[exerciseLibraryService] Falling back to seeded exercise library for getByCategory:', error);
      return getSeededExercises().filter((exercise) => exercise.category === category);
    }
  },

  /**
   * Get a single exercise by ID
   */
  async getById(id: string): Promise<MentalExercise | null> {
    const docRef = doc(db, COLLECTION, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return SEEDED_EXERCISES.find((exercise) => exercise.id === id) || null;
    }
    return exerciseFromFirestore(snap.id, snap.data());
  },

  async getBySimSpecId(simSpecId: string): Promise<MentalExercise | null> {
    try {
      const q = query(
        collection(db, COLLECTION),
        where('simSpecId', '==', simSpecId)
      );
      const snap = await getDocs(q);
      const docSnap = snap.docs
        .map((entry) => exerciseFromFirestore(entry.id, entry.data()))
        .filter((exercise) => exercise.isActive)
        .sort((left, right) => left.sortOrder - right.sortOrder)[0];
      if (!docSnap) return null;
      return docSnap;
    } catch (error) {
      if (!shouldFallbackToSeededLibrary(error)) {
        throw error;
      }

      console.warn('[exerciseLibraryService] Falling back to seeded exercise library for getBySimSpecId:', error);
      return getSeededExercises().find((exercise) => exercise.simSpecId === simSpecId) || null;
    }
  },

  async getPublishedById(id: string): Promise<MentalExercise | null> {
    const exercise = await this.getById(id);
    return isLaunchablePublishedExercise(exercise) ? exercise : null;
  },

  async getPublishedBySimSpecId(simSpecId: string): Promise<MentalExercise | null> {
    const exercise = await this.getBySimSpecId(simSpecId);
    return isLaunchablePublishedExercise(exercise) ? exercise : null;
  },

  /**
   * Get exercises best for a specific use case
   */
  async getBestFor(useCase: string): Promise<MentalExercise[]> {
    try {
      const q = query(
        collection(db, COLLECTION),
        where('bestFor', 'array-contains', useCase),
        where('isActive', '==', true)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => exerciseFromFirestore(d.id, d.data()));
    } catch (error) {
      if (!shouldFallbackToSeededLibrary(error)) {
        throw error;
      }

      console.warn('[exerciseLibraryService] Falling back to seeded exercise library for getBestFor:', error);
      return getSeededExercises().filter((exercise) => exercise.bestFor.includes(useCase));
    }
  },

  /**
   * Create or update an exercise
   */
  async save(exercise: MentalExercise): Promise<void> {
    const docRef = doc(db, COLLECTION, exercise.id);
    await setDoc(docRef, exerciseToFirestore(exercise), { merge: true });
  },

  /**
   * Soft delete an exercise (set isActive to false)
   */
  async deactivate(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, { isActive: false, updatedAt: Date.now() });
  },

  /**
   * Hard delete an exercise
   */
  async delete(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  },

  /**
   * Push the SEEDED_EXERCISES content (names, descriptions, instructions,
   * prompts, configs, and sport content packs) onto EXISTING library docs. seedExercises() only
   * creates missing docs, so copy fixes in the seed never reach prod
   * without this. Merge-writes so runtime-added fields survive.
   */
  async syncSeededCopy(): Promise<{ updated: number }> {
    const batch = writeBatch(db);
    let updated = 0;
    for (const exercise of SEEDED_EXERCISES) {
      const payload = exerciseToFirestore(exercise);
      // Write BOTH collections: iOS resolves from the legacy
      // mental-exercises collection first, then sim-modules.
      batch.set(doc(db, COLLECTION, exercise.id), payload, { merge: true });
      batch.set(doc(db, 'mental-exercises', exercise.id), payload, { merge: true });
      updated++;
    }
    await batch.commit();
    return { updated };
  },

  /**
   * Seed the exercise library with default exercises
   */
  async seedExercises(): Promise<{ created: number; skipped: number }> {
    const existing = await this.getAll();
    const existingIds = new Set(existing.map(e => e.id));

    const batch = writeBatch(db);
    let created = 0;
    let skipped = 0;

    for (const exercise of SEEDED_EXERCISES) {
      if (existingIds.has(exercise.id)) {
        skipped++;
        continue;
      }
      const docRef = doc(db, COLLECTION, exercise.id);
      batch.set(docRef, exerciseToFirestore(exercise));
      created++;
    }

    if (created > 0) {
      await batch.commit();
    }

    return { created, skipped };
  },

  /**
   * Get quick exercises (under 5 minutes)
   */
  async getQuickExercises(): Promise<MentalExercise[]> {
    const all = await this.getAll();
    return all.filter(e => e.durationMinutes <= 5);
  },

  /**
   * Get exercises by difficulty
   */
  async getByDifficulty(difficulty: ExerciseDifficulty): Promise<MentalExercise[]> {
    try {
      const q = query(
        collection(db, COLLECTION),
        where('difficulty', '==', difficulty),
        where('isActive', '==', true),
        orderBy('sortOrder', 'asc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => exerciseFromFirestore(d.id, d.data()));
    } catch (error) {
      if (!shouldFallbackToSeededLibrary(error)) {
        throw error;
      }

      console.warn('[exerciseLibraryService] Falling back to seeded exercise library for getByDifficulty:', error);
      return getSeededExercises().filter((exercise) => exercise.difficulty === difficulty);
    }
  },
};

export const exerciseLibraryService = simModuleLibraryService;
