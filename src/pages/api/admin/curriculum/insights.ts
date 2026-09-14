import type { NextApiRequest, NextApiResponse } from 'next';
import { requireCurriculumAdmin, CurriculumApiError } from './_auth';
import { buildModuleInsights, type InsightAssignment, type InsightEvent, type InsightCompletion, type ModuleInsight } from '../../../../api/firebase/dailyCurriculum/moduleInsights';
import seed from '../../../../api/firebase/dailyCurriculum/linearCurriculumSeed.json';

const CAP = 5000;
const ASSIGNMENT_FIELDS = ['athleteId', 'protocolVariantId', 'protocolId', 'simSpecId', 'legacyExerciseId', 'startedAt', 'completedAt'];
const LINEAR_FIELDS = ['athleteId', 'skillId', 'versionId', 'phase', 'startedAt', 'completedAt'];
const EVENT_FIELDS = ['assignmentId', 'athleteId', 'eventType', 'eventAt'];
const COMPLETION_FIELDS = ['userId', 'exerciseId', 'dailyAssignmentId', 'completedAt', 'helpfulnessRating'];
export interface InsightsResponse {
  status: 'complete' | 'partial' | 'unavailable';
  window: { start: number; end: number };
  modules: ModuleInsight[];
  coverage: { assignments: number; events: number; completions: number; unresolvedLinks: number };
  warnings: string[];
}
export function parseInsightWindow(start: unknown, end: unknown) {
  const parse = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value) ? Date.parse(value) : NaN;
  const from = parse(start), to = parse(end);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to || to - from > 93 * 86400000) {
    throw new CurriculumApiError(400, 'invalid_window', 'Choose a valid activity window of at most 93 days.');
  }
  return { start: from, end: to };
}
/** Server-only projection reads. Callers must authorize before calling this function. */
export async function collectModuleInsights(db: FirebaseFirestore.Firestore, window: { start: number; end: number }): Promise<InsightsResponse> {
  const response: InsightsResponse = { status: 'complete', window, modules: [], coverage: { assignments: 0, events: 0, completions: 0, unresolvedLinks: 0 }, warnings: [
    'Starts require observed start evidence; legacy completions may have no independently recorded start.',
    'Repeat use means completed practice sessions in this window, not use during sport.',
    'Follow-on assessment completion is unavailable because module-linked eligibility is not defined.',
    'Historical source coverage may differ between periods; helpfulness is optional self-report.',
    'Session and repeat counts require an explicit daily-assignment link. Unlinked completion records, including their ratings, are excluded to prevent double counting.',
  ] };
  const range = async (query: FirebaseFirestore.Query, field: string, fields: string[]) => {
    try { return await query.where(field, '>=', window.start).where(field, '<', window.end).select(...fields).limit(CAP + 1).get(); }
    catch (error) {
      const failure = error as { code?: unknown; message?: string };
      if (![9, 'failed-precondition', 'FAILED_PRECONDITION'].includes(failure.code as never) || !/index/i.test(failure.message || '')) throw error;
      // Scan the entire projected source only when its complete history fits the cap.
      // Never filter a capped scan first: doing so could disguise missing records as zero activity.
      const all = await query.select(...fields).limit(CAP + 1).get();
      response.warnings.push(`The ${field} index is unavailable; used a bounded complete-history projection scan.`);
      if (all.size > CAP) return all;
      const docs = all.docs.filter(doc => { const value = doc.data()[field]; return typeof value === 'number' && Number.isFinite(value) && value >= window.start && value < window.end; });
      return { size: docs.length, docs };
    }
  };
  const [started, completed, eventDocs, completionDocs, linearStarted, linearCompleted] = await Promise.all([
    range(db.collection('pulsecheck-daily-assignments'), 'startedAt', ASSIGNMENT_FIELDS),
    range(db.collection('pulsecheck-daily-assignments'), 'completedAt', ASSIGNMENT_FIELDS),
    range(db.collection('pulsecheck-assignment-events'), 'eventAt', EVENT_FIELDS),
    range(db.collectionGroup('completions'), 'completedAt', COMPLETION_FIELDS),
    range(db.collectionGroup('assignments'), 'startedAt', LINEAR_FIELDS),
    range(db.collectionGroup('assignments'), 'completedAt', LINEAR_FIELDS),
  ]);
  if ([started, completed, eventDocs, completionDocs, linearStarted, linearCompleted].some(s => s.size > CAP)) {
    response.status = 'partial'; response.warnings.push('A source exceeded the safe read limit. Narrow the date window; no aggregates are shown.'); return response;
  }
  const assignments = new Map<string, InsightAssignment>();
  for (const doc of [...started.docs, ...completed.docs]) assignments.set(doc.id, { ...doc.data(), id: doc.id } as InsightAssignment);
  const events = eventDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as InsightEvent));
  const completions: InsightCompletion[] = [];
  for (const doc of completionDocs.docs) {
    const parts = doc.ref.path.split('/');
    const data = doc.data();
    if (parts.length !== 4 || parts[0] !== 'sim-completions' || parts[2] !== 'completions' || data.userId !== parts[1]) continue;
    completions.push({ ...data, id: doc.id } as InsightCompletion);
  }
  const ids = new Set([...events.map(e => e.assignmentId), ...completions.map(c => c.dailyAssignmentId)].filter((id): id is string => typeof id === 'string' && !!id && !assignments.has(id)));
  if (ids.size > CAP) {
    response.status = 'partial'; response.warnings.push('Linked assignments exceeded the safe read limit. Narrow the date window; no aggregates are shown.'); return response;
  }
  const validIds = [...ids].filter(id => !id.includes('/'));
  response.coverage.unresolvedLinks += ids.size - validIds.length;
  // A projection mask prevents fetching rationale, conversation turns, and completion summaries.
  for (let offset = 0; offset < validIds.length; offset += 100) {
    const refs = validIds.slice(offset, offset + 100).map(id => db.collection('pulsecheck-daily-assignments').doc(id));
    const docs = await db.getAll(...refs, { fieldMask: ASSIGNMENT_FIELDS });
    for (const doc of docs) {
      if (doc.exists) assignments.set(doc.id, { ...doc.data(), id: doc.id } as InsightAssignment);
      else response.coverage.unresolvedLinks++;
    }
  }
  // Protected linear runtime assignments have their own namespace; never collide with legacy IDs.
  for (const doc of [...linearStarted.docs, ...linearCompleted.docs]) {
    const parts = doc.ref.path.split('/');
    const data = doc.data();
    if (parts.length !== 6 || parts[0] !== 'pulsecheck-linear-curriculum' || parts[1] !== 'states' || parts[2] !== 'items' || parts[4] !== 'assignments' || data.athleteId !== parts[3] || typeof data.skillId !== 'string' || !data.skillId) continue;
    assignments.set(doc.ref.path, { id: doc.ref.path, athleteId: data.athleteId, moduleId: data.skillId, startedAt: data.startedAt, completedAt: data.completedAt });
  }
  response.coverage.assignments = assignments.size;
  response.coverage.events = events.length;
  response.coverage.completions = completions.length;
  const unlinked = completions.filter(c => !c.dailyAssignmentId).length;
  if (unlinked) response.warnings.push(`${unlinked} unlinked completion records were excluded from session counts and helpfulness.`);
  const aliasMap: Record<string, string> = {};
  for (const row of seed.active) {
    for (const alias of [row.id, ...row.aliases]) aliasMap[alias] = row.id;
    for (const ref of row.sourceRefs) if (ref.startsWith('pulsecheck-protocol-variants/')) aliasMap[ref.slice('pulsecheck-protocol-variants/'.length)] = row.id;
  }
  response.modules = buildModuleInsights({ assignments: [...assignments.values()], events, completions, window, aliasMap });
  if (response.coverage.unresolvedLinks) response.warnings.push('Some activity could not be linked to an assignment and was excluded.');
  return response;
}
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  try {
    const { db } = await requireCurriculumAdmin(req);
    const window = parseInsightWindow(req.query.start, req.query.end);
    return res.status(200).json(await collectModuleInsights(db, window));
  } catch (error) {
    if (error instanceof CurriculumApiError) return res.status(error.statusCode).json({ error: error.message });
    return res.status(503).json({ status: 'unavailable', modules: [], warnings: ['Module activity could not be read completely. No aggregates are shown.'] });
  }
}
