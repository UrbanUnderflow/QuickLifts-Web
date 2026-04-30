// Phase C — Adaptive Framing Layer translation audit log.
//
// Every call to translateForAthlete (production path) writes one document
// here. Schema captures full provenance so Phase G's Nora Guard admin surface
// can render history, filter by guardrail violations, and spot-check Claude
// vs. seed output. PII redaction is Phase G's job — store plain text now.
//
// Errors are warn-and-swallow: logging must never break translation.

import type { app as adminApp } from 'firebase-admin';
import * as admin from 'firebase-admin';
import type { TranslationDomain, ValidationIssue, VoiceReviewStatus } from './types';
import { stripUndefinedDeep } from './types';

export const TRANSLATION_LOG_COLLECTION = 'pulsecheck-nora-translation-log';

export type TranslationFallbackReason =
  | 'guardrail-violation'
  | 'anthropic-error'
  | 'row-missing';

export type TranslationProviderUsed = 'anthropic' | 'fallback-seed';

export interface TranslationLogEntry {
  athleteUserId: string;
  signal: Record<string, unknown>;
  domain: TranslationDomain | string;
  state: string;
  providerUsed: TranslationProviderUsed;
  fallbackTriggered: boolean;
  fallbackReason?: TranslationFallbackReason;
  guardrailViolations: ValidationIssue[];
  finalPhrasing: string;
  claudeOutputRaw?: string;
  seedPhrasing?: string;
  voiceReviewStatus?: VoiceReviewStatus;
  translationRowRevision?: string;
  modelUsed?: string;
  errorMessage?: string;
  additionalContext?: Record<string, string>;
}

export interface LogTranslationDeps {
  firestore?: admin.firestore.Firestore;
}

const resolveFirestore = (deps?: LogTranslationDeps): admin.firestore.Firestore | null => {
  if (deps?.firestore) return deps.firestore;
  try {
    return admin.firestore();
  } catch {
    return null;
  }
};

export const logTranslation = async (
  entry: TranslationLogEntry,
  deps?: LogTranslationDeps,
): Promise<void> => {
  const db = resolveFirestore(deps);
  if (!db) {
    console.warn('[translation-log] No Firestore instance available — skipping log write.');
    return;
  }

  try {
    await db.collection(TRANSLATION_LOG_COLLECTION).add(
      stripUndefinedDeep({
        ...entry,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      }),
    );
  } catch (err) {
    console.warn('[translation-log] Log write failed:', err);
  }
};

// Convenience: pass the admin App (e.g. from getFirebaseAdminApp(forceDevFirebase))
// when the caller needs to target a specific project.
export const logTranslationWithApp = async (
  entry: TranslationLogEntry,
  app: adminApp.App,
): Promise<void> => {
  await logTranslation(entry, { firestore: app.firestore() });
};
