import { createHash } from 'crypto';
import { resolveSchoolActivationFlow, SCHOOL_ACTIVATION_FLOW_VERSION } from '../../../api/firebase/pulsecheckProvisioning/schoolActivationFlow';
import type { Firestore } from 'firebase-admin/firestore';
import { healthBaselineConsentDocuments, consentCategory, consentDecisionComplete, researchEligible, selectConsentDocumentsForProduct, type ConsentDecisions } from '../../../api/firebase/pulsecheckProvisioning/consentPolicy';
import { mergePulseCheckRequiredConsents, type PulseCheckRequiredConsentDocument } from '../../../api/firebase/pulsecheckProvisioning/types';
import { resolvePilotEnrollmentStatus, resolveTeamMembershipOnboardingStatus } from '../../../api/firebase/pulsecheckProvisioning/accessState';
import { getCompletedBaselineEvidence } from '../../../api/firebase/pulsecheckProvisioning/athleteTaskState';

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const object = (value: any): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const active = (value: Record<string, any>, explicit = false) => (!explicit && !value.status || value.status === 'active') && !value.revokedAt && !value.archivedAt && !value.deletedAt;
const parentConsentStatuses = new Set(['active', 'draft', 'provisioning', 'ready-for-activation']);
const pilotConsentStatuses = new Set(['active', 'draft']);
const consentScopeEligible = (value: Record<string, any>, statuses: Set<string>) => statuses.has(value.status) && !value.revokedAt && !value.archivedAt && !value.deletedAt;
export class ConsentSaveError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
function reject(code: string, message: string, status = 400): never { throw new ConsentSaveError(code, message, status); }
export const canonicalConsentDocuments = (documents: any[]) => (documents || []).map(value => { const doc = object(value); return ({
  id: text(doc.id), title: text(doc.title), body: String(doc.body || ''), version: text(doc.version),
  category: consentCategory(doc as PulseCheckRequiredConsentDocument), studySpecific: doc.studySpecific === true,
}); }).sort((a, b) => a.id.localeCompare(b.id));
const stable = (value: any): string => JSON.stringify(value, (_key, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
  ? Object.keys(entry).sort().reduce((result: any, key) => { result[key] = entry[key]; return result; }, {}) : entry);
const validDocuments = (value: unknown): PulseCheckRequiredConsentDocument[] => Array.isArray(value)
  ? value.filter(doc => doc && text(doc.id) && text(doc.title) && text(doc.body) && text(doc.version)) : [];

export function resolveAtomicConsentDocuments(team: Record<string, any>, pilot: Record<string, any>, brand: string, organization: Record<string, any> = {}) {
  const teamDocs = validDocuments(team.requiredConsents);
  const pilotDocs = mergePulseCheckRequiredConsents(pilot.studyMode === 'research' ? 'research' : 'operational', validDocuments(pilot.requiredConsents));
  const docs = teamDocs.length ? [...teamDocs] : pilotDocs;
  if (teamDocs.length && pilot.studyMode === 'research') {
    for (const doc of pilotDocs.filter(doc => consentCategory(doc) === 'research')) if (!docs.some(existing => existing.id === doc.id)) docs.push(doc);
  }
  return healthBaselineConsentDocuments(selectConsentDocumentsForProduct(docs.filter(doc => consentCategory(doc) !== 'staff'), brand), team, organization, brand);
}

/** The transaction owns configuration validation and every completion write. No delivery occurs here. */
export async function saveAtomicConsent(db: Firestore, uid: string, request: any, timestamp: () => any) {
  const membershipId = text(request?.teamMembershipId);
  if (!membershipId || membershipId.length > 240 || /[\/\x00-\x1f]/.test(membershipId)) reject('INVALID_REQUEST', 'A team membership is required.');
  if (!['progress', 'complete'].includes(request?.action)) reject('INVALID_REQUEST', 'Choose a valid save action.');
  const complete = request.action === 'complete';
  const submitted = object(request.onboarding);
  const profile = object(request.profile);
  const expected = object(request.expectedContext);
  const memberRef = db.collection('pulsecheck-team-memberships').doc(membershipId);
  return db.runTransaction(async tx => {
    const memberSnap = await tx.get(memberRef);
    const closureSnap = await tx.get(db.collection('account-closure-jobs').doc(uid));
    const privateRef = db.collection('pulsecheck-private-users').doc(uid);
    const privateSnap = await tx.get(privateRef);
    const member = memberSnap.data() || {};
    if (closureSnap.exists || !memberSnap.exists || member.userId !== uid || member.role !== 'athlete' || !active(member)) reject('MEMBERSHIP_UNAVAILABLE', 'An active athlete membership is required.', 403);
    const old = object(member.athleteOnboarding);
    const teamId = text(member.teamId), organizationId = text(member.organizationId);
    const pilotId = text(old.targetPilotId), cohortId = text(old.targetCohortId);
    if (!teamId || !organizationId || [teamId, organizationId, pilotId, cohortId].some(id => id.includes('/'))) reject('PROGRAM_UNAVAILABLE', 'Your program could not be verified.', 403);
    const [teamSnap, orgSnap, userSnap, progressSnap] = await Promise.all([
      tx.get(db.collection('pulsecheck-teams').doc(teamId)), tx.get(db.collection('pulsecheck-organizations').doc(organizationId)),
      tx.get(db.collection('users').doc(uid)), tx.get(db.collection('athlete-mental-progress').doc(uid)),
    ]);
    const team = teamSnap.data() || {}, organization = orgSnap.data() || {}, user = userSnap.data() || {};
    if (!teamSnap.exists || !orgSnap.exists || !consentScopeEligible(team, parentConsentStatuses) || !consentScopeEligible(organization, parentConsentStatuses) || team.organizationId !== organizationId
      || !['pulsecheck', 'athleticmind'].includes(organization.productBrand) || user.accountClosureRequestedAt || user.accountClosureStatus) {
      reject('PROGRAM_UNAVAILABLE', 'Your program could not be verified.', 403);
    }
    const pilotSnap = pilotId ? await tx.get(db.collection('pulsecheck-pilots').doc(pilotId)) : null;
    const cohortSnap = cohortId ? await tx.get(db.collection('pulsecheck-pilot-cohorts').doc(cohortId)) : null;
    const pilot = pilotSnap?.data() || {}, cohort = cohortSnap?.data() || {};
    if (pilotId && (!pilotSnap?.exists || !consentScopeEligible(pilot, pilotConsentStatuses) || pilot.organizationId !== organizationId || pilot.teamId !== teamId)) reject('PROGRAM_UNAVAILABLE', 'Your pilot could not be verified.', 403);
    if (cohortId && (!pilotId || !cohortSnap?.exists || !consentScopeEligible(cohort, pilotConsentStatuses) || cohort.pilotId !== pilotId || cohort.teamId !== teamId || cohort.organizationId !== organizationId)) reject('PROGRAM_UNAVAILABLE', 'Your cohort could not be verified.', 403);
    const schoolActivation = resolveSchoolActivationFlow({ productBrand: organization.productBrand, role: member.role });
    const consentOnly = team.status !== 'active' || organization.status !== 'active' || Boolean(pilotId && pilot.status !== 'active') || Boolean(cohortId && cohort.status !== 'active');
    const enrollmentRef = pilotId ? db.collection('pulsecheck-pilot-enrollments').doc(`${pilotId}_${uid}`) : null;
    const enrollmentSnap = enrollmentRef ? await tx.get(enrollmentRef) : null;
    const enrollment = enrollmentSnap?.data() || {};
    if (['withdrawn', 'ended', 'completed'].includes(enrollment.status) || enrollment.revokedAt) reject('ENROLLMENT_ENDED', 'This enrollment has ended.', 403);
    const documents = resolveAtomicConsentDocuments(team, pilot, organization.productBrand, organization);
    if (!documents.some(doc => consentCategory(doc) === 'participation')) reject('PROGRAM_UNAVAILABLE', 'Your participation requirements could not be verified.', 403);
    const currentScope = { organizationId, teamId, pilotId, cohortId, productBrand: organization.productBrand, documents: canonicalConsentDocuments(documents) };
    const expectedScope = { organizationId: text(expected.organizationId), teamId: text(expected.teamId), pilotId: text(expected.pilotId), cohortId: text(expected.cohortId), productBrand: text(expected.productBrand), documents: canonicalConsentDocuments(Array.isArray(expected.documents) ? expected.documents : []) };
    if (stable(currentScope) !== stable(expectedScope)) reject('CONSENT_CONTEXT_CHANGED', 'Your team requirements changed. Reload them before continuing.', 409);

    const decisions: ConsentDecisions = { ...object(old.consentDecisions) } as ConsentDecisions;
    for (const [id, raw] of Object.entries(object(submitted.consentDecisions))) {
      if (stable(raw) === stable(decisions[id])) continue;
      const entry = object(raw), doc = documents.find(doc => doc.id === id);
      if (!doc || entry.version !== doc.version || stable(canonicalConsentDocuments([entry.document || {}])) !== stable(canonicalConsentDocuments([doc]))) reject('CONSENT_CONTEXT_CHANGED', 'The agreement terms changed. Review the current terms.', 409);
      if (!['accepted', 'declined', 'revoked'].includes(entry.decision) || (entry.decision === 'accepted' && !text(entry.signedName))) reject('INVALID_DECISION', 'Record a valid choice and signature for each agreement.');
      if (text(entry.signedName).length > 200) reject('INVALID_DECISION', 'The signature is too long.');
      decisions[id] = { decision: entry.decision, version: doc.version, signedName: text(entry.signedName), decidedAt: text(entry.decidedAt) || new Date().toISOString(), document: doc };
    }
    // Legacy completion is trusted only from the existing record, never new caller-supplied flags.
    const legacyIds = Array.isArray(old.completedConsentIds) ? old.completedConsentIds : [];
    const legacyVersions = object(old.completedConsentVersions);
    const acceptedDocs = documents.filter(doc => decisions[doc.id]?.decision === 'accepted' && consentDecisionComplete(doc, decisions)
      || !decisions[doc.id] && consentDecisionComplete(doc, {}, legacyIds, legacyVersions));
    const ids = acceptedDocs.map(doc => doc.id), versions = Object.fromEntries(acceptedDocs.map(doc => [doc.id, doc.version]));
    const researchStatus = text(submitted.researchConsentStatus) || text(old.researchConsentStatus) || 'not-required';
    if (!['accepted', 'declined', 'pending', 'not-required'].includes(researchStatus)) reject('INVALID_DECISION', 'Choose a valid research decision.');
    const participationComplete = documents.filter(doc => consentCategory(doc) === 'participation').every(doc => consentDecisionComplete(doc, decisions, ids, versions));
    const accepted = submitted.productConsentAccepted === false ? false : participationComplete && (submitted.productConsentAccepted === true || old.productConsentAccepted === true || complete);
    if (complete && (!accepted || !documents.every(doc => consentDecisionComplete(doc, decisions, ids, versions)) || pilot.studyMode === 'research' && !['accepted', 'declined'].includes(researchStatus))) reject('CONSENT_INCOMPLETE', 'Review every current agreement and record your choices.');
    const intake = submitted.intakeResponses === undefined ? object(old.intakeResponses) : object(submitted.intakeResponses);
    const questions = Array.isArray(team.intake?.athlete?.questions) ? team.intake.athlete.questions : [];
    if (!consentOnly && !schoolActivation && complete && questions.some((q: any) => q.required && (intake[q.id] == null || typeof intake[q.id] === 'string' && !intake[q.id].trim() || Array.isArray(intake[q.id]) && !intake[q.id].length))) reject('INTAKE_INCOMPLETE', 'Answer the required team questions before continuing.');
    if (Object.keys(intake).length > 200 || Buffer.byteLength(JSON.stringify(intake)) > 100000) reject('INVALID_REQUEST', 'The answers exceed the supported size.');
    const changed = stable(decisions) !== stable(object(old.consentDecisions));
    const now = timestamp();
    const baselineComplete = getCompletedBaselineEvidence(progressSnap.data() as any).complete || old.baselinePathStatus === 'complete';
    const next = {
      ...old, ...(schoolActivation ? { flowVersion: SCHOOL_ACTIVATION_FLOW_VERSION } : {}), consentPersistenceVersion: 2, requiredConsents: documents, consentDecisions: decisions, completedConsentIds: ids, completedConsentVersions: versions,
      productConsentAccepted: accepted, researchConsentStatus: researchStatus,
      eligibleForResearchDataset: researchEligible(documents, decisions, researchStatus, ids, versions),
      enrollmentMode: researchStatus === 'accepted' ? 'research' : pilotId ? 'pilot' : 'product-only',
      entryOnboardingStep: complete || old.entryOnboardingStep === 'complete' ? 'complete' : ['name', 'consent', 'research-consent', 'starting-point'].includes(submitted.entryOnboardingStep) ? submitted.entryOnboardingStep : old.entryOnboardingStep || 'name',
      entryOnboardingName: text(profile.name || submitted.entryOnboardingName) || text(old.entryOnboardingName),
      baselinePathStatus: baselineComplete ? 'complete' : ['ready', 'started'].includes(old.baselinePathStatus) ? old.baselinePathStatus : complete ? 'ready' : 'pending',
      baselinePathwayId: text(old.baselinePathwayId) || text(submitted.baselinePathwayId),
      ...(accepted && submitted.intakeResponses !== undefined ? { intakeResponses: intake, intakeFormVersion: text(submitted.intakeFormVersion) || text(old.intakeFormVersion) } : {}),
      ...(complete ? { ...(!schoolActivation && questions.length ? { intakeCompletedAt: old.intakeCompletedAt || now } : {}), productConsentAcceptedAt: old.productConsentAcceptedAt || now, productConsentVersion: text(submitted.productConsentVersion) || text(old.productConsentVersion) } : {}),
      ...(['accepted', 'declined'].includes(researchStatus) ? { researchConsentRespondedAt: researchStatus === old.researchConsentStatus ? old.researchConsentRespondedAt || now : now, researchConsentVersion: text(submitted.researchConsentVersion) || text(old.researchConsentVersion) } : {}),
    };
    const onboardingStatus = resolveTeamMembershipOnboardingStatus({ role: 'athlete', athleteOnboarding: next, studyMode: pilot.studyMode || 'operational' });
    const eventId = changed ? createHash('sha256').update(stable({ uid, membershipId, previous: old.lastConsentEventId || object(old.consentDecisions), decisions })).digest('hex') : null;
    if (eventId) tx.create(memberRef.collection('consent-events').doc(eventId), { actorUserId: uid, decisions, recordedAt: now });
    // Setup programs may collect choices, but consent must not activate enrollment or advance onboarding.
    if (consentOnly) {
      const consentFields = {
        consentPersistenceVersion: 2, requiredConsents: documents, consentDecisions: decisions,
        completedConsentIds: ids, completedConsentVersions: versions, productConsentAccepted: accepted,
        researchConsentStatus: researchStatus, eligibleForResearchDataset: false,
        ...(complete ? { productConsentAcceptedAt: next.productConsentAcceptedAt, productConsentVersion: next.productConsentVersion } : {}),
        ...(['accepted', 'declined'].includes(researchStatus) ? { researchConsentRespondedAt: next.researchConsentRespondedAt, researchConsentVersion: next.researchConsentVersion } : {}),
      };
      tx.update(memberRef, { athleteOnboarding: { ...old, ...consentFields, ...(eventId ? { lastConsentEventId: eventId } : {}) }, updatedAt: now });
      if (enrollmentRef && enrollmentSnap?.exists) tx.set(enrollmentRef, { ...consentFields, updatedAt: now }, { merge: true });
      return { success: true, teamMembershipId: membershipId, onboardingStatus: member.onboardingStatus || 'pending', eventId, consentOnly: true };
    }
    tx.update(memberRef, { athleteOnboarding: { ...next, ...(eventId ? { lastConsentEventId: eventId } : {}) }, onboardingStatus, ...(text(profile.phone) ? { phone: text(profile.phone) } : {}), updatedAt: now });
    if (enrollmentRef) tx.set(enrollmentRef, {
      consentPersistenceVersion: 2, organizationId, teamId, pilotId, cohortId, userId: uid, teamMembershipId: membershipId, studyMode: pilot.studyMode || 'operational',
      enrollmentMode: next.enrollmentMode, status: resolvePilotEnrollmentStatus({ athleteOnboarding: next, studyMode: pilot.studyMode || 'operational' }),
      productConsentAccepted: next.productConsentAccepted, productConsentAcceptedAt: next.productConsentAcceptedAt || null,
      productConsentVersion: next.productConsentVersion || '', researchConsentStatus: researchStatus,
      researchConsentVersion: next.researchConsentVersion || '', researchConsentRespondedAt: next.researchConsentRespondedAt || null,
      requiredConsentIds: documents.filter(doc => consentCategory(doc) === 'participation').map(doc => doc.id),
      completedConsentIds: ids, completedConsentVersions: versions, consentDecisions: decisions, eligibleForResearchDataset: next.eligibleForResearchDataset,
      grantedByInviteToken: text(enrollment.grantedByInviteToken || member.grantedByInviteToken), createdAt: enrollment.createdAt || now, updatedAt: now,
    }, { merge: true });
    if (complete) tx.set(db.collection('users').doc(uid), {
      pulseCheckOnboardingComplete: true, updatedAt: now,
      ...(next.entryOnboardingName ? { displayName: next.entryOnboardingName, preferredName: next.entryOnboardingName } : {}),
      ...(!user.sport && text(schoolActivation ? team.sportOrProgram || team.sport || team.sportId : profile.sport) ? { sport: text(schoolActivation ? team.sportOrProgram || team.sport || team.sportId : profile.sport) } : {}),
      ...(!user.dailyReflectionPreferences ? { dailyReflectionPreferences: { enabled: true, time: '20:00', hour: 20, minute: 0, timezone: text(profile.timezone) || 'America/New_York', updatedAt: now } } : {}),
    }, { merge: true });
    if (!privateSnap.exists) tx.create(privateRef, { userId: uid, protected: true, createdAt: now });
    return { success: true, teamMembershipId: membershipId, onboardingStatus, eventId };
  });
}
