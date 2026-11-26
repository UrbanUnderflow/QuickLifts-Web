import type { NextApiRequest, NextApiResponse } from 'next';
import { FieldValue } from 'firebase-admin/firestore';
import juniorSeed from '../../../../../scripts/data/junior-curriculum.json';
import { SEEDED_EXERCISES } from '../../../../api/firebase/mentaltraining/exerciseSeed';
import { exerciseToFirestore } from '../../../../api/firebase/mentaltraining/types';
import { validateCurriculumConfig, type CurriculumConfig } from '../../../../api/firebase/dailyCurriculum/types';
import { CurriculumApiError, requireCurriculumAdmin, type CurriculumAdminIdentity } from './_auth';

export const config = { api: { bodyParser: { sizeLimit: '256kb' } } };
const CONFIG = 'pulsecheck-curriculum-config/current';
const CONTENT_COLLECTIONS = new Set(['junior-curriculum', 'mental-exercises', 'sim-modules', 'pulsecheck-protocols']);
const READ_COLLECTIONS = new Set([...CONTENT_COLLECTIONS, 'curriculum-notes']);
const ID = /^[A-Za-z0-9_-]{1,160}$/;
const CAP = 1000;
const seedById = new Map(juniorSeed.map(lesson => [lesson.id, lesson]));
type Data = Record<string, unknown>;
type Write = { kind: 'set' | 'update' | 'add'; path: string; data: Data; merge?: boolean };
const fail = (message: string, status = 400, code = 'invalid_workspace_request'): never => { throw new CurriculumApiError(status, code, message); };
const object = (value: unknown): value is Data => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const keys = (data: Data, allowed: string[]) => { if (Object.keys(data).some(key => !allowed.includes(key))) fail('This operation contains unsupported fields.'); };
const text = (value: unknown, max: number, empty = false): value is string => typeof value === 'string' && value.length <= max && (empty || value.trim().length > 0);
const same = (left: unknown, right: unknown): boolean => {
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : object(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value;
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
};
const documentPath = (value: unknown) => {
  if (typeof value !== 'string') fail('Choose a curriculum document.');
  const [collection, id, ...rest] = (value as string).split('/');
  if (rest.length || !ID.test(id || '') || (!READ_COLLECTIONS.has(collection) && value !== CONFIG)) fail('This document is outside the curriculum workspace.', 403, 'path_forbidden');
  return { path: value as string, collection, id };
};

/** Timestamp markers keep the transport JSON-only without losing note dates. */
export const serializeCurriculumValue = (value: unknown): unknown => {
  if (value instanceof Date) return { __curriculumTimestampMillis: value.getTime() };
  if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') return { __curriculumTimestampMillis: (value as { toMillis: () => number }).toMillis() };
  if (Array.isArray(value)) return value.map(serializeCurriculumValue);
  if (object(value)) return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, serializeCurriculumValue(item)]));
  return value;
};
const clean = (value: unknown): any => Array.isArray(value) ? value.map(clean) : object(value) ? Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, clean(item)])) : value;
const displayName = (identity: CurriculumAdminIdentity) => identity.displayName || identity.email.split('@')[0] || 'Curriculum admin';
const safeModule = (data: Data | undefined) => {
  if (!data || data.isActive !== true) return false;
  const exercise = object(data.exerciseConfig) ? data.exerciseConfig : {};
  const inner = object(exercise.config) ? exercise.config : {};
  const type = String(exercise.type || '').toLowerCase();
  const subtype = String(inner.type || '').trim().toLowerCase();
  return !(type === 'mindset' && (inner.journalRequired === true || ['reframe', 'growth_mindset'].includes(subtype)))
    && !(type === 'confidence' && ['evidence_journal', 'inventory', 'affirmations'].includes(subtype));
};

function validateWrite(value: unknown): Write {
  if (!object(value)) fail('Choose a supported curriculum change.');
  const write = value as Data;
  keys(write, ['kind', 'path', 'data', 'merge']);
  if (!['set', 'update', 'add'].includes(String(write.kind)) || !object(write.data)) fail('Choose a supported curriculum change.');
  if (write.merge !== undefined && typeof write.merge !== 'boolean') fail('Merge must be a boolean.');
  const data = write.data as Data;
  if (write.kind === 'add') {
    if (write.path !== 'curriculum-notes' || write.merge !== undefined) fail('Only curriculum notes can be added.', 403, 'write_forbidden');
    keys(data, ['trackId', 'targetId', 'targetLabel', 'kind', 'body', 'status', 'authorUid', 'authorName', 'authorEmail', 'createdAt', 'updatedAt']);
    if (!['rookie', 'junior', 'pro'].includes(String(data.trackId)) || !['update', 'issue', 'idea'].includes(String(data.kind)) || data.status !== 'open' || !text(data.targetId, 200) || !text(data.targetLabel, 500) || !text(data.body, 12000)) fail('Enter a valid curriculum note.');
  } else {
    const target = documentPath(write.path);
    if (target.collection === 'curriculum-notes') {
      if (write.kind !== 'update' || write.merge !== undefined) fail('Existing notes support status changes only.', 403, 'write_forbidden');
      keys(data, ['status', 'updatedAt', 'resolvedAt', 'resolvedByUid', 'resolvedByName']);
      if (!['open', 'resolved'].includes(String(data.status))) fail('Choose a valid note status.');
    } else if (target.collection === 'junior-curriculum') {
      if (write.kind !== 'set' || write.merge !== true || !seedById.has(target.id)) fail('Choose a bundled junior lesson and preserve its existing fields.', 403, 'write_forbidden');
      if ('seededBy' in data) {
        const { id: _id, ...seed } = seedById.get(target.id)!;
        keys(data, [...Object.keys(seed), 'updatedAt', 'seededBy']);
        for (const [field, value] of Object.entries(seed)) if (field !== 'exerciseId' && !same(data[field], value)) fail('The bundled lesson changed. Reload before seeding.', 409, 'seed_changed');
      } else {
        keys(data, ['exerciseId', 'exerciseMappedBy', 'updatedAt']);
        if (!text(data.exerciseId, 160) || !ID.test(data.exerciseId)) fail('Choose a valid module mapping.');
      }
    } else if (target.path === CONFIG) {
      if (write.kind !== 'set' || write.merge !== false) fail('Curriculum settings require a complete validated revision.');
      keys(data, ['id', 'defaultPillarWeights', 'pillarWeightsBySport', 'frequencyTargetsByLevel', 'notificationCadence', 'engineEnabled', 'revisionId', 'revisionLog', 'createdAt', 'updatedAt']);
      if (data.id !== 'current' || typeof data.engineEnabled !== 'boolean' || !text(data.revisionId, 100) || !Array.isArray(data.revisionLog) || data.revisionLog.length < 1 || data.revisionLog.length > 50) fail('Choose a valid curriculum settings revision.');
      const weights = (value: unknown) => {
        if (!object(value)) fail('Pillar weights are required.');
        keys(value as Data, ['composure', 'focus', 'decision']);
        if (!['composure', 'focus', 'decision'].every(key => typeof (value as Data)[key] === 'number' && Number.isFinite((value as Data)[key]) && Number((value as Data)[key]) >= 0)) fail('Pillar weights must be finite non-negative numbers.');
      };
      weights(data.defaultPillarWeights);
      if (data.pillarWeightsBySport !== undefined) {
        if (!object(data.pillarWeightsBySport) || Object.keys(data.pillarWeightsBySport).length > 200) fail('Choose valid sport overrides.');
        for (const [sport, value] of Object.entries(data.pillarWeightsBySport as Data)) { if (!ID.test(sport)) fail('Choose a valid sport.'); weights(value); }
      }
      if (!object(data.frequencyTargetsByLevel) || !object(data.notificationCadence)) fail('Frequency targets and notification cadence are required.');
      keys(data.frequencyTargetsByLevel as Data, ['foundational', 'intermediate', 'advanced']);
      keys(data.notificationCadence as Data, ['morningHourLocal', 'middayHourLocal', 'eveningHourLocal']);
      for (const revision of data.revisionLog as unknown[]) {
        if (!object(revision)) fail('Choose a valid settings revision log.');
        keys(revision as Data, ['revisionId', 'changedAt', 'changedByUserId', 'summary']);
        if (!text((revision as Data).revisionId, 100) || !text((revision as Data).summary, 2000)) fail('Choose a valid settings revision summary.');
      }
      const validation = validateCurriculumConfig(data as unknown as CurriculumConfig);
      if (!validation.ok) fail(validation.issues.map(issue => `${issue.field}: ${issue.message}`).join('; '));
    } else fail('Catalog content can only be synced from the server seed.', 403, 'write_forbidden');
  }
  return write as unknown as Write;
}

export const createCurriculumWorkspaceHandler = (dependencies: {
  authorize?: (req: NextApiRequest) => Promise<CurriculumAdminIdentity>;
  now?: () => number;
  timestamp?: () => unknown;
} = {}) => async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'method_not_allowed' }); }
  try {
    if (!/^application\/json(?:;|$)/i.test(String(req.headers['content-type'] || ''))) fail('Use JSON for curriculum requests.', 415, 'json_required');
    const identity = await (dependencies.authorize || requireCurriculumAdmin)(req);
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!object(body) || Buffer.byteLength(JSON.stringify(body)) > 256 * 1024) fail('Choose a bounded curriculum request.');
    const db = identity.db;
    if (body.action === 'getDoc') {
      keys(body, ['action', 'path']);
      const target = documentPath(body.path);
      const snapshot = await db.doc(target.path).get();
      return res.status(200).json({ id: snapshot.id, exists: snapshot.exists, data: snapshot.exists ? serializeCurriculumValue(snapshot.data()) : null });
    }
    if (body.action === 'getDocs') {
      keys(body, ['action', 'collection', 'filters', 'limit']);
      if (typeof body.collection !== 'string' || !READ_COLLECTIONS.has(body.collection)) fail('This collection is outside the curriculum workspace.', 403, 'path_forbidden');
      const filters = body.filters ?? [];
      if (!Array.isArray(filters) || filters.length > 1) fail('Choose a supported curriculum filter.');
      let query: FirebaseFirestore.Query = db.collection(body.collection);
      for (const filter of filters) {
        if (!object(filter)) fail('Choose a supported curriculum filter.');
        keys(filter, ['field', 'operator', 'value']);
        if (filter.field !== 'isActive' || filter.operator !== '==' || typeof filter.value !== 'boolean' || !['mental-exercises', 'sim-modules', 'pulsecheck-protocols'].includes(body.collection)) fail('Choose a supported curriculum filter.');
        query = query.where('isActive', '==', filter.value);
      }
      const limit = body.limit === undefined ? CAP : Number(body.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > CAP || (body.limit !== undefined && typeof body.limit !== 'number')) fail('Choose a valid curriculum read limit.');
      const snapshot = await query.limit(limit + (body.limit === undefined ? 1 : 0)).get();
      if (body.limit === undefined && snapshot.size > CAP) fail('This curriculum collection exceeds the read limit.', 409, 'read_limit');
      return res.status(200).json({ docs: snapshot.docs.map(doc => ({ id: doc.id, data: serializeCurriculumValue(doc.data()) })) });
    }
    if (body.action === 'syncSeededCopy') {
      keys(body, ['action']);
      const batch = db.batch();
      for (const exercise of SEEDED_EXERCISES) {
        const payload = clean(exerciseToFirestore(exercise));
        batch.set(db.doc(`sim-modules/${exercise.id}`), payload, { merge: true });
        batch.set(db.doc(`mental-exercises/${exercise.id}`), payload, { merge: true });
      }
      await batch.commit();
      return res.status(200).json({ updated: SEEDED_EXERCISES.length });
    }
    if (body.action !== 'commit') fail('Choose a supported curriculum operation.');
    keys(body, ['action', 'writes']);
    if (!Array.isArray(body.writes) || !body.writes.length || body.writes.length > 100) fail('Commit between 1 and 100 curriculum changes.');
    const writes: Write[] = (body.writes as unknown[]).map(validateWrite);
    const refs = writes.map(write => write.kind === 'add' ? db.collection('curriculum-notes').doc() : db.doc(write.path));
    if (new Set(refs.map(ref => ref.path)).size !== refs.length) fail('A document may only appear once in a curriculum change.');
    const now = (dependencies.now || Date.now)();
    const timestamp = dependencies.timestamp || (() => FieldValue.serverTimestamp());
    await db.runTransaction(async transaction => {
      const current = await Promise.all(refs.map(ref => transaction.get(ref)));
      const moduleIds = new Set<string>();
      writes.forEach((write, index) => {
        if (!write.path.startsWith('junior-curriculum/')) return;
        if ('seededBy' in write.data) {
          const mapped = current[index].data()?.exerciseId;
          if (typeof mapped === 'string' && ID.test(mapped)) moduleIds.add(mapped);
        } else moduleIds.add(String(write.data.exerciseId));
      });
      const modules = new Map<string, Data>();
      await Promise.all([...moduleIds].map(async id => {
        const snapshot = await transaction.get(db.doc(`mental-exercises/${id}`));
        if (snapshot.exists) modules.set(id, snapshot.data()!);
      }));
      const planned = writes.map((write, index) => {
        const previous = current[index].data();
        if (write.kind === 'add') return {
          ...write.data, authorUid: identity.uid, authorEmail: identity.email, authorName: displayName(identity), createdAt: timestamp(), updatedAt: timestamp(),
        };
        if (write.path.startsWith('curriculum-notes/')) {
          if (!current[index].exists) fail('The curriculum note no longer exists.', 409, 'note_changed');
          return { status: write.data.status, updatedAt: timestamp(), resolvedAt: write.data.status === 'resolved' ? timestamp() : null, resolvedByUid: write.data.status === 'resolved' ? identity.uid : null, resolvedByName: write.data.status === 'resolved' ? displayName(identity) : null };
        }
        if (write.path.startsWith('junior-curriculum/')) {
          if ('seededBy' in write.data) {
            const { id: _id, ...seed } = seedById.get(refs[index].id)!;
            const mapped = previous?.exerciseId;
            return { ...seed, exerciseId: typeof mapped === 'string' && modules.get(mapped)?.isActive === true ? mapped : seed.exerciseId, updatedAt: now, seededBy: `curriculum-outline (${identity.email})` };
          }
          if (!current[index].exists || !safeModule(modules.get(String(write.data.exerciseId)))) fail('Choose an active junior-safe module for an existing lesson.', 409, 'mapping_unavailable');
          return { exerciseId: write.data.exerciseId, updatedAt: now, exerciseMappedBy: `curriculum-outline (${identity.email})` };
        }
        const log = write.data.revisionLog as Data[];
        if (log.at(-1)?.revisionId !== write.data.revisionId || (previous && (log.at(-2)?.revisionId !== previous.revisionId || write.data.revisionId === previous.revisionId))) fail('Settings changed. Reload before saving.', 409, 'config_changed');
        if (!same(write.data.pillarWeightsBySport || {}, previous?.pillarWeightsBySport || {})) fail('Sport overrides are view only in this workspace.', 403, 'write_forbidden');
        return { ...write.data, createdAt: previous?.createdAt ?? now, updatedAt: now, revisionLog: [...(Array.isArray(previous?.revisionLog) ? previous.revisionLog : []), { revisionId: write.data.revisionId, changedAt: now, changedByUserId: identity.uid, summary: log.at(-1)!.summary }].slice(-50) };
      });
      planned.forEach((data, index) => {
        if (writes[index].kind === 'add') transaction.create(refs[index], data);
        else if (writes[index].kind === 'update') transaction.update(refs[index], data);
        else transaction.set(refs[index], data, { merge: writes[index].merge === true });
      });
    });
    return res.status(200).json({ ids: refs.map(ref => ref.id) });
  } catch (error) {
    if (error instanceof CurriculumApiError) return res.status(error.statusCode).json({ error: error.code, message: error.message });
    if (error instanceof SyntaxError) return res.status(400).json({ error: 'invalid_json', message: 'Choose a valid JSON curriculum request.' });
    return res.status(503).json({ error: 'workspace_unavailable', message: 'The curriculum operation could not be completed. Reload before trying again.' });
  }
};

export default createCurriculumWorkspaceHandler();
