import { buildLinearTimeline, type LinearTimeline } from './linearTimeline';
import { createHash } from 'node:crypto';
import type { firestore } from 'firebase-admin';
import { previewPinnedSkillAssignment, type LinearPublishedVersion, type LinearCompletionEvidence, type LinearEnrollment } from './linearPublication';
import type { LinearSkillPin } from './linearSkillTransition';
type LinkedCompletionEvidence = LinearCompletionEvidence & { localDate: string; timezone: string; assignmentId: string; verification: 'authenticated_assignment_response' };
import { evaluateLegacyHandoffCompletion, isPendingLegacyHandoffStarted, type LinearLegacyHandoff } from './linearLegacyHandoff';

export const LINEAR_ROOT = 'pulsecheck-linear-curriculum';
export const linearRuntimeEnabled = () => process.env.LINEAR_CURRICULUM_RUNTIME_ENABLED === 'true';
export interface LinearRuntimeState {
  athleteId: string; optedIn: true; audienceId: string; revision: number;
  enrollment: LinearEnrollment; currentSkill: LinearSkillPin; completedSkillIds: string[]; completedSkillSummaries?: { skillId: string; name: string; versionId: string }[];
  legacyHandoff?: LinearLegacyHandoff;
  legacyReconciliation?: { reviewedAt: number; manifestFingerprint: string; historicalActiveAssignments: unknown[]; historyPolicy: 'preserve'; importedCompletionCount: 0 };
}
export interface LinearRuntimeAssignment {
  id: string; athleteId: string; versionId: string; skillId: string; skillName: string;
  skillType: 'protocol' | 'simulation'; phase: 'learn' | 'practice' | 'use_it';
  sourceDate: string; timezone: string; windowStart: string; windowEnd: string;
  completedDayCount: number; requiredDays: 5; phaseCompletedToday: boolean;
  contentSnapshot: Record<string, unknown>; clientContractVersion: 1;
  issuedAt: number; startedAt?: number; completedAt?: number; requiresCheckIn?: boolean;
  linkedLegacyStatus?: 'started' | 'completed';
}
export type LinearRuntimeResponse = { status: 'legacy' | 'blocked' | 'review_due'; reason?: string; timeline?: LinearTimeline } | { status: 'assignment'; assignment: LinearRuntimeAssignment; timeline?: LinearTimeline } | { status: 'recorded'; qualified: boolean; duplicate: boolean };
export const linearCollection = (db: firestore.Firestore, section: string) => db.collection(LINEAR_ROOT).doc(section).collection('items');
export function linearLocalDate(time: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(time));
  const get = (name: string) => parts.find(p => p.type === name)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
const validId = (id: string) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);
/** Authoritative assignment/ledger transaction. Authentication belongs to the calling handler.
 * Completion is authenticated self-report bound to an issued, started assignment, not sensor proof.
 */
export async function runLinearRuntime(db: firestore.Firestore, input: { athleteId: string; action: 'today' | 'start' | 'complete'; assignmentId?: string; outcome?: string }, options: { enabled?: boolean; now?: number; dryRun?: boolean } = {}): Promise<LinearRuntimeResponse> {
  if (!(options.enabled ?? linearRuntimeEnabled())) return { status: 'legacy' };
  if (!validId(input.athleteId)) throw new Error('Invalid athlete identity');
  if (!['today','start','complete'].includes(input.action)) throw new Error('Invalid action');
  if (input.action !== 'today' && !validId(input.assignmentId || '')) throw new Error('Invalid assignment');
  const now = options.now ?? Date.now();
  const stateRef = linearCollection(db, 'states').doc(input.athleteId);
  return db.runTransaction(async tx => {
    let bridgeWrite: { ref: firestore.DocumentReference; data: LinkedCompletionEvidence; link: LinearLegacyHandoff } | undefined;
    const response = await (async (): Promise<LinearRuntimeResponse> => {
    const stateDoc = await tx.get(stateRef);
    if (!stateDoc.exists) return input.action === 'today' ? { status: 'legacy' } : { status: 'blocked', reason: 'A verified enrollment is required before recording activity.' };
    const state = stateDoc.data() as LinearRuntimeState;
    if (state.athleteId !== input.athleteId || state.optedIn !== true || !state.enrollment.timezone) return { status: 'blocked', reason: 'The explicit enrollment requires review.' };
    const date = linearLocalDate(now, state.enrollment.timezone);
    const completionsRef = stateRef.collection('completions');
    const [pinnedDoc, audienceDoc, ledger, checkInDoc] = await Promise.all([
      tx.get(linearCollection(db, 'versions').doc(state.currentSkill.versionId)),
      tx.get(linearCollection(db, 'audiences').doc(state.audienceId)),
      tx.get(completionsRef.limit(10001)),
      tx.get(db.collection('pulsecheck-morning-checkins').doc(`${input.athleteId}_${date}`)),
    ]);
    if (ledger.size > 10000) return { status: 'blocked', reason: 'Completion history requires an indexed archive review; no progress was reset.' };
    // Both canonical writers share this document. Evening-only records intentionally lack top-level timestamps.
    const checkIn = checkInDoc.data();
    const levels = ['drained', 'low', 'okay', 'solid', 'locked'];
    const checkedIn = checkIn?.athleteUserId === input.athleteId && checkIn?.dayKey === date &&
      (levels.includes(checkIn?.level) || levels.includes(checkIn?.eveningCheckIn?.level));
    const audience = audienceDoc.data();
    const applicable = audience?.athleteIds?.includes(input.athleteId) && typeof audience.versionId === 'string';
    const latestDoc = applicable ? await tx.get(linearCollection(db, 'versions').doc(audience!.versionId)) : null;
    const pinned = pinnedDoc.exists ? pinnedDoc.data() as LinearPublishedVersion : null;
    const latest = latestDoc?.exists ? latestDoc.data() as LinearPublishedVersion : null;
    const evidence = ledger.docs.map(doc => doc.data() as LinearCompletionEvidence);
    const preview = () => previewPinnedSkillAssignment({ featureEnabled: true, athleteId: input.athleteId, enrollment: state.enrollment, currentSkill: state.currentSkill, pinnedVersion: pinned, latestApplicableVersion: latest, completedSkillIds: state.completedSkillIds, asOf: date, completions: evidence });
    let decision = preview();
    const link = state.legacyHandoff;
    let linkedLegacyStatus: 'started' | 'completed' | undefined;
    if (link && link.versionId === state.currentSkill.versionId && link.skillId === state.currentSkill.skillId && link.phase === 'learn') {
      const linkedDoc = await tx.get(db.collection(link.collection).doc(link.assignmentId));
      const linkedData = linkedDoc.data();
      const verified = evaluateLegacyHandoffCompletion(link, linkedData, input.athleteId, now);
      const current = decision.result;
      if (current.kind === 'assignment' && current.phase === 'learn') {
        linkedLegacyStatus = verified.kind === 'completed' ? 'completed' : isPendingLegacyHandoffStarted(link, linkedData, input.athleteId) ? 'started' : undefined;
        if (verified.kind === 'completed' && !ledger.docs.some(doc => doc.id === verified.ledgerId)) {
          const completionDate = linearLocalDate(verified.completedAt, state.enrollment.timezone);
          const completedCheckIn = completionDate === date ? checkIn : (await tx.get(db.collection('pulsecheck-morning-checkins').doc(`${input.athleteId}_${completionDate}`))).data();
          const hasCheckIn = completedCheckIn?.athleteUserId === input.athleteId && completedCheckIn?.dayKey === completionDate && (levels.includes(completedCheckIn?.level) || levels.includes(completedCheckIn?.eveningCheckIn?.level));
          if (hasCheckIn && completionDate >= current.windowStart && completionDate <= current.windowEnd) {
            const imported: LinkedCompletionEvidence = { id: verified.ledgerId, athleteId: input.athleteId, versionId: link.versionId, skillId: link.skillId, phase: 'learn', status: 'completed', completedAt: verified.completedAt, localDate: completionDate, timezone: state.enrollment.timezone, assignmentId: verified.ledgerId, verification: 'authenticated_assignment_response' };
            evidence.push(imported);
            bridgeWrite = { ref: completionsRef.doc(verified.ledgerId), data: imported, link };
            decision = preview();
          }
        }
      }
    }
    const result = decision.result;
    if (input.action !== 'today') {
      if (options.dryRun) return { status: 'blocked', reason: 'Preview requests cannot record activity.' };
      const assignmentRef = stateRef.collection('assignments').doc(input.assignmentId!);
      const [assignedDoc, recordedDoc] = await Promise.all([tx.get(assignmentRef), tx.get(completionsRef.doc(input.assignmentId!))]);
      if (!assignedDoc.exists) return { status: 'blocked', reason: 'This assignment does not belong to this athlete.' };
      const assigned = assignedDoc.data() as LinearRuntimeAssignment;
      if (assigned.athleteId !== input.athleteId) return { status: 'blocked', reason: 'Assignment ownership could not be verified.' };
      if (recordedDoc.exists) return { status: 'recorded', qualified: true, duplicate: true };
      if (!checkedIn) return { status: 'blocked', reason: 'Complete today’s check-in before starting or recording your skill practice.' };
      if (result.kind !== 'assignment' || decision.nextPin || result.versionId !== assigned.versionId || result.skillId !== assigned.skillId || result.phase !== assigned.phase || result.windowStart !== assigned.windowStart || result.phaseCompletedToday) return { status: 'blocked', reason: 'This assignment window has ended. Refresh the current assignment; history is preserved.' };
      if (input.action === 'start') { if (!assigned.startedAt) tx.update(assignmentRef, { startedAt: now }); return { status: 'recorded', qualified: false, duplicate: !!assigned.startedAt }; }
      if (!assigned.startedAt || assigned.startedAt > now) return { status: 'blocked', reason: 'Start this assignment before recording completion.' };
      if (assigned.phase === 'use_it' && !['used','forgot','no_chance'].includes(input.outcome || '')) return { status: 'blocked', reason: 'Choose what happened when you tried to use this skill.' };
      const qualified = assigned.phase !== 'use_it' || input.outcome === 'used';
      tx.update(assignmentRef, { lastResponseAt: now, lastOutcome: input.outcome || 'completed', ...(qualified ? { completedAt: now } : {}) });
      if (qualified) tx.create(completionsRef.doc(input.assignmentId!), { id: input.assignmentId, athleteId: input.athleteId, versionId: assigned.versionId, skillId: assigned.skillId, phase: assigned.phase, status: 'completed', completedAt: now, localDate: date, timezone: state.enrollment.timezone, assignmentId: assigned.id, verification: 'authenticated_assignment_response' });
      if (qualified && link?.status === 'pending' && assigned.versionId === link.versionId && assigned.skillId === link.skillId && assigned.phase === link.phase && assigned.sourceDate === link.sourceDate && assigned.startedAt === link.startedAt) tx.update(stateRef, { legacyHandoff: { ...link, status: 'completed_in_journey', resolvedAt: now, resolvedByAssignmentId: assigned.id } });
      return { status: 'recorded', qualified, duplicate: false };
    }
    const completedSkillIds = decision.completedSkillId ? [...new Set([...state.completedSkillIds, decision.completedSkillId])] : state.completedSkillIds;
    const completedSkillSummaries = [...(state.completedSkillSummaries || [])];
    if (decision.completedSkillId && !completedSkillSummaries.some(item => item.skillId === decision.completedSkillId)) completedSkillSummaries.push({ skillId: decision.completedSkillId, name: pinned?.skills.find(item => item.id === decision.completedSkillId)?.name || decision.completedSkillId, versionId: state.currentSkill.versionId });
    if (result.kind === 'blocked' || result.kind === 'review_due') {
      if (decision.completedSkillId && !state.completedSkillIds.includes(decision.completedSkillId) && !options.dryRun) tx.update(stateRef, { completedSkillIds, completedSkillSummaries, revision: state.revision + 1, updatedAt: now });
      return { status: result.kind, reason: result.reason, timeline: buildLinearTimeline({ completedSkillIds, completedSkillSummaries, currentAssignment: null, pinnedVersion: pinned, latestApplicableVersion: latest }) };
    }
    if (result.kind !== 'assignment') return { status: 'blocked', reason: 'The skill boundary requires review.' };
    const chosenVersion = decision.nextPin ? latest : pinned;
    let contentSnapshot = (chosenVersion as (LinearPublishedVersion & { contentSnapshots?: Record<string, Record<string, unknown>> }) | null)?.contentSnapshots?.[result.skillId];
    if (!contentSnapshot && chosenVersion) { const asset = await tx.get(linearCollection(db, 'versions').doc(chosenVersion.id).collection('content').doc(result.skillId)); contentSnapshot = asset.data()?.contentSnapshot; }
    if (!contentSnapshot || !Object.keys(contentSnapshot).length) return { status: 'blocked', reason: 'The pinned skill content snapshot is unavailable. No replacement was assigned.' };
    const skill = chosenVersion!.skills.find(item => item.id === result.skillId)!;
    const id = createHash('sha256').update([input.athleteId,result.versionId,result.skillId,result.phase,date].join('|')).digest('hex');
    const assignmentRef = stateRef.collection('assignments').doc(id);
    const assignedDoc = await tx.get(assignmentRef);
    const linkedStart = linkedLegacyStatus === 'started' && link?.sourceDate === date && result.phase === 'learn' ? link.startedAt : undefined;
    const assignment: LinearRuntimeAssignment = { id, athleteId: input.athleteId, versionId: result.versionId, skillId: result.skillId, skillName: result.skillName, skillType: skill.type, phase: result.phase, sourceDate: date, timezone: state.enrollment.timezone, windowStart: result.windowStart, windowEnd: result.windowEnd, completedDayCount: result.verifiedCompletions, requiredDays: 5, phaseCompletedToday: result.phaseCompletedToday, contentSnapshot, clientContractVersion: 1, issuedAt: now, requiresCheckIn: !checkedIn, ...(linkedStart ? { startedAt: linkedStart } : {}), ...(linkedLegacyStatus ? { linkedLegacyStatus } : {}) };
    if (decision.nextPin && !options.dryRun) tx.update(stateRef, { currentSkill: decision.nextPin, completedSkillIds, completedSkillSummaries, revision: state.revision + 1, updatedAt: now });
    if (!assignedDoc.exists && !options.dryRun) tx.create(assignmentRef, assignment);
    return { status: 'assignment', timeline: buildLinearTimeline({ completedSkillIds, completedSkillSummaries, currentAssignment: assignment, pinnedVersion: chosenVersion, latestApplicableVersion: latest }), assignment: { ...assignment, ...(assignedDoc.exists ? { issuedAt: assignedDoc.data()!.issuedAt, startedAt: assignedDoc.data()!.startedAt ?? assignment.startedAt, completedAt: assignedDoc.data()!.completedAt } : {}) } };
    })();
    if (bridgeWrite && !options.dryRun) {
      tx.create(bridgeWrite.ref, bridgeWrite.data);
      tx.update(stateRef, { legacyHandoff: { ...bridgeWrite.link, status: 'completed_from_legacy', resolvedAt: now, resolvedByAssignmentId: bridgeWrite.data.assignmentId } });
    }
    return response;
  });
}
