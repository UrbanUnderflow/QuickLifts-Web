import type { firestore } from 'firebase-admin';
import { createHash } from 'node:crypto';
import { buildLinearCurriculumCatalog, FIRST_LINEAR_SKILL, type LinearCatalogRecords, type LinearCurriculumEntry } from './linearCurriculum';
import { previewLinearAssignment, type LinearPublishedVersion, type LinearCompletionEvidence } from './linearPublication';
import type { LinearRuntimeState } from './linearRuntimeAdmin';
const root = (db: firestore.Firestore, section: string) => db.collection('pulsecheck-linear-curriculum').doc(section).collection('items');
const published = (v: LinearPublishedVersion | null): v is LinearPublishedVersion => !!v && v.status === 'published' && Array.isArray(v.content?.orderedIds) && Array.isArray(v.skills) && new Set(v.content.orderedIds).size === v.content.orderedIds.length && v.skills.length === v.content.orderedIds.length && v.skills.every((s, i) => s.id === v.content.orderedIds[i]);
export function buildReadonlyLinearPlan(input: { latest: LinearPublishedVersion | null; pinned: LinearPublishedVersion | null; state: LinearRuntimeState | null; catalog: LinearCurriculumEntry[]; fingerprint: string; sourceKind: string; content: Record<string, unknown> | null; evidence?: LinearCompletionEvidence[]; asOf?: string }) {
  const latest = published(input.latest) ? input.latest : null;
  const state = input.state;
  const completedIds = [...new Set(state?.completedSkillIds || [])]; // whole-skill ledger only, never module results
  const completedSet = new Set(completedIds);
  const ordered = latest?.content.orderedIds || [];
  const row = (skill: LinearCurriculumEntry, version: LinearPublishedVersion | null) => ({ id: skill.id, name: skill.name, type: skill.type, ordinal: version?.content.orderedIds.includes(skill.id) ? version.content.orderedIds.indexOf(skill.id) + 1 : null, runtimeReady: version?.runtimeReadySkillIds?.includes(skill.id) === true, readiness: skill.readiness || '' });
  const currentSkill = state ? input.pinned?.skills.find(s => s.id === state.currentSkill.skillId) : latest?.skills.find(s => s.id === ordered[0]) || input.catalog.find(s => s.id === FIRST_LINEAR_SKILL);
  const currentVersion = state ? input.pinned : latest;
  let progress: ReturnType<typeof previewLinearAssignment> | null = null;
  if (state && input.pinned && input.asOf) progress = previewLinearAssignment({ featureEnabled: true, athleteId: state.athleteId, version: input.pinned, enrollment: { ...state.enrollment, versionId: state.currentSkill.versionId }, currentSkill: state.currentSkill, asOf: input.asOf, completions: input.evidence || [] });
  const assignment = progress?.kind === 'assignment' ? progress : null;
  const skillComplete = progress?.kind === 'skill_complete';
  const phaseIds = currentSkill?.type === 'protocol' ? ['learn', 'practice', 'use_it'] : ['practice', 'use_it'];
  const phaseIndex = assignment ? phaseIds.indexOf(assignment.phase) : -1;
  const current = currentSkill && !completedSet.has(currentSkill.id) ? { ...row(currentSkill, currentVersion), versionId: currentVersion?.id || null, phase: assignment?.phase || null, completedDayCount: assignment?.verifiedCompletions ?? null, requiredDays: 5 as const, windowStart: assignment?.windowStart || null, windowEnd: assignment?.windowEnd || null, progressSource: assignment || skillComplete ? 'versioned_ledger' : 'none', boundaryStatus: skillComplete ? 'skill_complete_pending_transition' : assignment?.phaseCompletedToday && assignment.verifiedCompletions >= 5 ? assignment.phase === 'use_it' ? 'next_skill_pending' : 'next_phase_pending' : null, contentSnapshot: input.content, startAvailability: skillComplete ? 'transition_required' : !input.content ? 'content_unavailable' : state ? 'runtime_required' : 'not_enrolled', phases: phaseIds.map((id, index) => ({ id, label: id === 'learn' ? 'Learn it' : id === 'practice' ? 'Practice it' : 'Use it', description: id === 'learn' ? 'Follow the guided technique.' : id === 'practice' ? currentSkill.type === 'protocol' ? 'Practice independently, with the guide available.' : 'Practice through the simulation.' : 'Use the skill at practice and reflect if you want.', status: skillComplete ? 'complete' : phaseIndex < 0 ? 'planned' : index === phaseIndex ? 'current' : index < phaseIndex ? 'complete' : 'upcoming' })) } : null;
  // If a pinned skill was removed, preserve it and preview the latest remaining order from its start.
  const currentIndex = currentSkill ? ordered.indexOf(currentSkill.id) : -1;
  const upcomingIds = ordered.slice(currentIndex >= 0 ? currentIndex + 1 : 0).filter(id => !completedSet.has(id));
  return { status: latest ? 'available' : 'unavailable', reason: latest ? null : 'No persisted published curriculum order is available. A browser-only draft is not an athlete plan.', source: { kind: latest ? input.sourceKind : 'missing_persisted_order', versionId: latest?.id || null, catalogFingerprint: input.fingerprint }, enrolled: !!state, plan: { completed: completedIds.map(id => { const skill = input.pinned?.skills.find(s => s.id === id) || latest?.skills.find(s => s.id === id); return skill ? row(skill, null) : { id, name: state?.completedSkillSummaries?.find(s => s.skillId === id)?.name || id, type: ((state?.completedSkillSummaries?.find(s => s.skillId === id) as { type?: string } | undefined)?.type || null), ordinal: null, runtimeReady: false, readiness: '' }; }), current, upcoming: upcomingIds.slice(0, 10).map(id => row(latest!.skills.find(s => s.id === id)!, latest)), upcomingTotal: upcomingIds.length } };
}
/** Reads only. In particular this must never call runLinearRuntime(today), which can issue/persist assignments. */
export async function readLinearPlan(db: firestore.Firestore, uid: string, now = Date.now()) {
  const names = ['pulsecheck-protocols', 'sim-modules', 'mental-exercises', 'sim-variants', 'pulsecheck-protocol-variants'];
  const [stateDoc, pointer, ...snapshots] = await Promise.all([root(db, 'states').doc(uid).get(), root(db, 'plans').doc('current').get(), ...names.map(name => db.collection(name).get())]);
  const records: LinearCatalogRecords = {};
  snapshots.forEach((s, i) => { records[names[i]] = (s as firestore.QuerySnapshot).docs.map(d => ({ ...d.data(), id: d.id })); });
  const catalog = buildLinearCurriculumCatalog(records);
  const raw = (stateDoc as firestore.DocumentSnapshot).data() as LinearRuntimeState | undefined;
  const state = raw?.athleteId === uid && raw.optedIn === true && raw.enrollment?.athleteId === uid ? raw : null;
  const getVersion = async (id: unknown) => typeof id === 'string' && id && !id.includes('/') ? ((await root(db, 'versions').doc(id).get()).data() as LinearPublishedVersion | undefined) || null : null;
  const audience = state ? (await root(db, 'audiences').doc(state.audienceId).get()).data() : null;
  const audienceVersion = audience?.athleteIds?.includes(uid) ? audience.versionId : null;
  const planData = (pointer as firestore.DocumentSnapshot).data();
  // Display-only order adapter. It is never passed to the progression evaluator or runtime issuer.
  const reviewedPlan = planData?.status === 'reviewed_plan' && typeof planData.catalogFingerprint === 'string' && typeof planData.sourceReviewFingerprint === 'string' && Array.isArray(planData.orderedIds) && Array.isArray(planData.skills)
    ? { id: typeof planData.id === 'string' ? planData.id : `reviewed-plan-${planData.sourceReviewFingerprint}`, status: 'published', publishedAt: planData.reviewedAt || '', content: { orderedIds: planData.orderedIds }, skills: planData.skills, runtimeReadySkillIds: Array.isArray(planData.runtimeReadySkillIds) ? planData.runtimeReadySkillIds : [] } as unknown as LinearPublishedVersion : null;
  const latest = audienceVersion ? await getVersion(audienceVersion) : reviewedPlan || await getVersion(planData?.versionId);
  const pinned = state ? await getVersion(state.currentSkill.versionId) : null;
  const currentId = state?.currentSkill.skillId || latest?.content?.orderedIds[0] || FIRST_LINEAR_SKILL;
  const skill = (state ? pinned?.skills : latest?.skills)?.find(s => s.id === currentId) || catalog.active.find(s => s.id === currentId);
  let content: Record<string, unknown> | null = null;
  if (state && pinned) content = (await root(db, 'versions').doc(pinned.id).collection('content').doc(currentId).get()).data()?.contentSnapshot || null;
  else if (skill) for (const name of ['mental-exercises', 'sim-modules']) { const found = records[name].find(r => r.id === skill.id || skill.aliases.includes(r.id)); if (found) { content = found; break; } }
  const evidence = state ? (await root(db, 'states').doc(uid).collection('completions').get()).docs.map(d => d.data() as LinearCompletionEvidence) : [];
  const asOf = state?.enrollment.timezone ? new Intl.DateTimeFormat('en-CA', { timeZone: state.enrollment.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now) : undefined;
  return buildReadonlyLinearPlan({ latest, pinned, state, catalog: catalog.active, fingerprint: reviewedPlan && !audienceVersion ? planData!.catalogFingerprint : createHash('sha256').update(catalog.fingerprint).digest('hex'), sourceKind: audienceVersion ? 'published_audience' : reviewedPlan ? 'reviewed_plan' : 'published_plan', content, evidence, asOf });
}
