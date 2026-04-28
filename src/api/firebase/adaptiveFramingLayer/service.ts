import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config';
import {
  ADAPTIVE_FRAMING_SCALE_COLLECTION,
  ADAPTIVE_FRAMING_SCALE_DOCUMENT_ID,
  AdaptiveFramingScale,
  CONVERSATION_TREE_COLLECTION,
  ConversationBranch,
  ConversationTrigger,
  OFF_LIMITS_CONFIG_COLLECTION,
  OFF_LIMITS_CONFIG_DOCUMENT_ID,
  OffLimitsConfig,
  TRANSLATION_TABLE_COLLECTION,
  TRANSLATION_DOMAINS,
  TranslationDomain,
  TranslationRow,
  VoiceReviewStatus,
  stripUndefinedDeep,
  validateAdaptiveFramingScale,
  validateConversationBranch,
  validateOffLimitsConfig,
  validateTranslationRow,
} from './types';

// ---------------------------------------------------------------------------
// Translation Table CRUD
// ---------------------------------------------------------------------------

const buildTranslationRowId = (domain: TranslationDomain, state: string) =>
  `${domain}-${state}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');

const normalizeTranslationRow = (raw: unknown): TranslationRow | null => {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<TranslationRow>;
  if (!value.id || !value.domain || !value.state) return null;

  return {
    id: String(value.id),
    domain: value.domain,
    state: String(value.state),
    athletePhrasing: String(value.athletePhrasing ?? ''),
    requiredActionVerbs: Array.isArray(value.requiredActionVerbs)
      ? value.requiredActionVerbs.map(String)
      : [],
    forbiddenTokens: Array.isArray(value.forbiddenTokens)
      ? value.forbiddenTokens.map(String)
      : [],
    voiceReviewStatus: (value.voiceReviewStatus ?? 'seed-pending-review') as VoiceReviewStatus,
    revisionId: String(value.revisionId ?? ''),
    createdBy: String(value.createdBy ?? ''),
    notes: typeof value.notes === 'string' ? value.notes : undefined,
    createdAt: value.createdAt ?? null,
    updatedAt: value.updatedAt ?? null,
    archivedAt: value.archivedAt ?? null,
  };
};

export const getTranslationRow = async (
  domain: TranslationDomain,
  state: string,
): Promise<TranslationRow | null> => {
  const id = buildTranslationRowId(domain, state);
  const snap = await getDoc(doc(db, TRANSLATION_TABLE_COLLECTION, id));
  if (!snap.exists()) return null;
  return normalizeTranslationRow({ id: snap.id, ...snap.data() });
};

export const listTranslationRowsForDomain = async (
  domain: TranslationDomain,
  options: { includeArchived?: boolean } = {},
): Promise<TranslationRow[]> => {
  const colRef = collection(db, TRANSLATION_TABLE_COLLECTION);
  const snap = await getDocs(query(colRef, where('domain', '==', domain)));
  const rows = snap.docs
    .map((d) => normalizeTranslationRow({ id: d.id, ...d.data() }))
    .filter((row): row is TranslationRow => row !== null);
  return options.includeArchived ? rows : rows.filter((row) => !row.archivedAt);
};

export const listTranslationRows = async (
  options: { includeArchived?: boolean } = {},
): Promise<TranslationRow[]> => {
  const colRef = collection(db, TRANSLATION_TABLE_COLLECTION);
  const snap = await getDocs(colRef);
  const rows = snap.docs
    .map((d) => normalizeTranslationRow({ id: d.id, ...d.data() }))
    .filter((row): row is TranslationRow => row !== null);
  return options.includeArchived ? rows : rows.filter((row) => !row.archivedAt);
};

export interface UpsertTranslationRowInput {
  domain: TranslationDomain;
  state: string;
  athletePhrasing: string;
  requiredActionVerbs?: string[];
  forbiddenTokens?: string[];
  voiceReviewStatus?: VoiceReviewStatus;
  revisionId: string;
  createdBy: string;
  notes?: string;
  offLimitsConfig?: Pick<OffLimitsConfig, 'forbiddenMarkers' | 'forbiddenPhrasePatterns' | 'numericValueRules'>;
}

export const upsertTranslationRow = async (
  input: UpsertTranslationRowInput,
): Promise<TranslationRow> => {
  if (!TRANSLATION_DOMAINS.includes(input.domain)) {
    throw new Error(`Unknown translation domain: ${input.domain}`);
  }

  const id = buildTranslationRowId(input.domain, input.state);
  const row: TranslationRow = {
    id,
    domain: input.domain,
    state: input.state,
    athletePhrasing: input.athletePhrasing,
    requiredActionVerbs: input.requiredActionVerbs ?? [],
    forbiddenTokens: input.forbiddenTokens ?? [],
    voiceReviewStatus: input.voiceReviewStatus ?? 'seed-pending-review',
    revisionId: input.revisionId,
    createdBy: input.createdBy,
    notes: input.notes,
  };

  const validation = validateTranslationRow(row, input.offLimitsConfig);
  if (!validation.ok) {
    throw new Error(
      `Invalid translation row: ${validation.issues.map((i) => `${i.field}: ${i.message}`).join('; ')}`,
    );
  }

  const docRef = doc(db, TRANSLATION_TABLE_COLLECTION, id);
  const existing = await getDoc(docRef);

  await setDoc(
    docRef,
    stripUndefinedDeep({
      ...row,
      createdAt: existing.exists() ? existing.data()?.createdAt ?? serverTimestamp() : serverTimestamp(),
      updatedAt: serverTimestamp(),
      archivedAt: existing.exists() ? existing.data()?.archivedAt ?? null : null,
    }),
    { merge: true },
  );

  return row;
};

export const archiveTranslationRow = async (
  domain: TranslationDomain,
  state: string,
): Promise<void> => {
  const id = buildTranslationRowId(domain, state);
  await setDoc(
    doc(db, TRANSLATION_TABLE_COLLECTION, id),
    stripUndefinedDeep({
      archivedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    { merge: true },
  );
};

// ---------------------------------------------------------------------------
// Conversation Tree CRUD
// ---------------------------------------------------------------------------

const normalizeConversationBranch = (raw: unknown): ConversationBranch | null => {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<ConversationBranch>;
  if (!value.id || !value.trigger || !value.opener || !value.probe || !value.actionDelivery) {
    return null;
  }
  return {
    id: String(value.id),
    trigger: value.trigger as ConversationTrigger,
    description: String(value.description ?? ''),
    opener: value.opener,
    probe: value.probe,
    actionDelivery: value.actionDelivery,
    revisionId: String(value.revisionId ?? ''),
    createdBy: String(value.createdBy ?? ''),
    createdAt: value.createdAt ?? null,
    updatedAt: value.updatedAt ?? null,
    archivedAt: value.archivedAt ?? null,
  };
};

export const getConversationBranch = async (
  trigger: ConversationTrigger,
): Promise<ConversationBranch | null> => {
  const snap = await getDoc(doc(db, CONVERSATION_TREE_COLLECTION, trigger));
  if (!snap.exists()) return null;
  return normalizeConversationBranch({ id: snap.id, ...snap.data() });
};

export const listConversationBranches = async (
  options: { includeArchived?: boolean } = {},
): Promise<ConversationBranch[]> => {
  const snap = await getDocs(collection(db, CONVERSATION_TREE_COLLECTION));
  const branches = snap.docs
    .map((d) => normalizeConversationBranch({ id: d.id, ...d.data() }))
    .filter((branch): branch is ConversationBranch => branch !== null);
  return options.includeArchived ? branches : branches.filter((branch) => !branch.archivedAt);
};

export const upsertConversationBranch = async (
  branch: ConversationBranch,
): Promise<ConversationBranch> => {
  const validation = validateConversationBranch(branch);
  if (!validation.ok) {
    throw new Error(
      `Invalid conversation branch: ${validation.issues.map((i) => `${i.field}: ${i.message}`).join('; ')}`,
    );
  }

  const docRef = doc(db, CONVERSATION_TREE_COLLECTION, branch.id);
  const existing = await getDoc(docRef);

  await setDoc(
    docRef,
    stripUndefinedDeep({
      ...branch,
      createdAt: existing.exists() ? existing.data()?.createdAt ?? serverTimestamp() : serverTimestamp(),
      updatedAt: serverTimestamp(),
      archivedAt: existing.exists() ? existing.data()?.archivedAt ?? null : null,
    }),
    { merge: true },
  );

  return branch;
};

export const archiveConversationBranch = async (
  trigger: ConversationTrigger,
): Promise<void> => {
  await setDoc(
    doc(db, CONVERSATION_TREE_COLLECTION, trigger),
    stripUndefinedDeep({
      archivedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    { merge: true },
  );
};

// ---------------------------------------------------------------------------
// Adaptive Framing Scale (singleton)
// ---------------------------------------------------------------------------

export const getAdaptiveFramingScale = async (): Promise<AdaptiveFramingScale | null> => {
  const snap = await getDoc(
    doc(db, ADAPTIVE_FRAMING_SCALE_COLLECTION, ADAPTIVE_FRAMING_SCALE_DOCUMENT_ID),
  );
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<AdaptiveFramingScale, 'id'>) };
};

export const upsertAdaptiveFramingScale = async (
  scale: AdaptiveFramingScale,
): Promise<AdaptiveFramingScale> => {
  const validation = validateAdaptiveFramingScale(scale);
  if (!validation.ok) {
    throw new Error(
      `Invalid adaptive framing scale: ${validation.issues.map((i) => `${i.field}: ${i.message}`).join('; ')}`,
    );
  }

  const docRef = doc(
    db,
    ADAPTIVE_FRAMING_SCALE_COLLECTION,
    ADAPTIVE_FRAMING_SCALE_DOCUMENT_ID,
  );
  const existing = await getDoc(docRef);

  await setDoc(
    docRef,
    stripUndefinedDeep({
      ...scale,
      createdAt: existing.exists() ? existing.data()?.createdAt ?? serverTimestamp() : serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    { merge: true },
  );

  return scale;
};

// ---------------------------------------------------------------------------
// Off-Limits Config (singleton)
// ---------------------------------------------------------------------------

export const getOffLimitsConfig = async (): Promise<OffLimitsConfig | null> => {
  const snap = await getDoc(doc(db, OFF_LIMITS_CONFIG_COLLECTION, OFF_LIMITS_CONFIG_DOCUMENT_ID));
  if (!snap.exists()) return null;
  return { id: snap.id as typeof OFF_LIMITS_CONFIG_DOCUMENT_ID, ...(snap.data() as Omit<OffLimitsConfig, 'id'>) };
};

export const upsertOffLimitsConfig = async (
  config: OffLimitsConfig,
): Promise<OffLimitsConfig> => {
  const validation = validateOffLimitsConfig(config);
  if (!validation.ok) {
    throw new Error(
      `Invalid off-limits config: ${validation.issues.map((i) => `${i.field}: ${i.message}`).join('; ')}`,
    );
  }

  await setDoc(
    doc(db, OFF_LIMITS_CONFIG_COLLECTION, OFF_LIMITS_CONFIG_DOCUMENT_ID),
    stripUndefinedDeep({
      ...config,
      updatedAt: serverTimestamp(),
    }),
    { merge: true },
  );

  return config;
};
