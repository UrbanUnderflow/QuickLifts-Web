import { healthBaselineConsentDocuments } from '../../../../api/firebase/pulsecheckProvisioning/consentPolicy';
import { isHealthBaselineEnabled } from '../../../../api/firebase/pulsecheckProvisioning/healthBaselinePolicy';
import { hasCompletedEntryOnboarding, hasCompletedRequiredConsents } from '../../../../api/firebase/pulsecheckProvisioning/accessState';
import { resolveStandardBaselineAssignment } from '../../../../lib/questionnaires/standard-assignment';
import { createHash } from 'crypto';
import { deriveAdministrativeAnswers, applyAdministrativeAnswers } from '../../../../lib/questionnaires/cau-derived';
import { completedStartingProfile, saveSkills, validateSkillsDraft } from '../../../../lib/questionnaires/cau-skills';
import { retainedPrivateCopy, liveRetentionEnabled } from '../../../../lib/questionnaires/cau-retention';
import { savePerformanceDraft } from '../../../../lib/questionnaires/cau-performance-draft';
import type { NextApiRequest, NextApiResponse } from 'next';
import { COLLECTION, VERSION, QUESTIONNAIRE_VERSION, PREVIOUS_QUESTIONNAIRE_VERSION, PREVIOUS_QUESTIONNAIRE_VERSIONS, isCurrentQuestionnaire, baselineRecordId, baselineComplete, splitSubmission } from '../../../../lib/questionnaires/cau';
import { deliverQuestionnaire } from '../../../../lib/questionnaires/cau-delivery';
import { PartnerError } from '../../../../lib/questionnaires/auntedna-partner';

export const config = { api: { bodyParser: { sizeLimit: '128kb' } } };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!['GET', 'POST'].includes(req.method || '')) { res.setHeader('Allow', 'GET, POST'); return res.status(405).end(); }
  const bearer = req.headers.authorization;
  if (!bearer?.startsWith('Bearer ')) return res.status(401).json({ error: 'Sign in to PulseCheck to continue.' });
  try {
    const { default: admin, getFirebaseAdminApp } = await import('../../../../lib/firebase-admin');
    const app = getFirebaseAdminApp(req.headers['x-pulsecheck-firebase-mode'] === 'dev');
    let user;
    try { user = await admin.auth(app).verifyIdToken(bearer.slice(7), true); }
    catch { return res.status(401).json({ error: 'Sign in to PulseCheck again to continue.' }); }
    const db = admin.firestore(app), collection = db.collection(COLLECTION);
    // Assignments are provisioned by trusted administrators, never by the client.
    const existingAssignment = (await collection.doc(`assignment_${user.uid}`).get()).data();
    const assignment = await resolveStandardBaselineAssignment(db, user.uid, existingAssignment);
    let active = assignment?.kind === 'assignment' && assignment.enabled === true && assignment.version === VERSION && (typeof assignment.teamId === 'string' && assignment.teamId.length > 0 || assignment.scope === 'individual');
    const enabled = process.env.ATHLETE_BASELINE_ENABLED !== 'false';
    const recordRef = collection.doc(baselineRecordId(user.uid));
    const existing = await recordRef.get();
    const legacy = await collection.doc(`baseline_${user.uid}_${VERSION}`).get();
    // Completed historical baselines remain completed; unfinished drafts start in a separate namespace.
    const previous = await Promise.all(PREVIOUS_QUESTIONNAIRE_VERSIONS.map(version => collection.doc(`baseline_${user.uid}_${version}`).get()));
    const completed = [existing, legacy, ...previous].some(snapshot => baselineComplete(snapshot.data(), user.uid));
    let healthSharingAllowed = false;
    let healthBaselineEnabled = true;
    let healthAuthorizationRequired = false;
    let healthAuthorizationUrl: string | null = null;
    let healthAuthorizationDecision: 'accepted' | 'declined' | 'revoked' | 'pending' | 'disabled' = 'pending';
    let sportName = 'Sport';
    if (active && assignment?.scope === 'individual') {
      const profile = (await db.collection('users').doc(user.uid).get()).data();
      sportName = typeof profile?.sport === 'string' && profile.sport.trim() ? profile.sport.trim().slice(0,120) : 'Sport';
    }
    if (active && assignment?.teamId) {
      const memberRef = db.collection('pulsecheck-team-memberships').doc(assignment.teamMembershipId || `${assignment.teamId}_${user.uid}`);
      const [memberSnap, teamSnap, evidence] = await Promise.all([
        memberRef.get(), db.collection('pulsecheck-teams').doc(assignment.teamId).get(),
        memberRef.collection('consent-events').orderBy('recordedAt', 'desc').limit(1).get(),
      ]);
      const member = memberSnap.data(), latest = evidence.docs[0]?.data();
      const team = teamSnap.data();
      const organizationId = team?.organizationId || member?.organizationId;
      const organization = typeof organizationId === 'string' && organizationId
        ? (await db.collection('pulsecheck-organizations').doc(organizationId).get()).data() : null;
      healthBaselineEnabled = isHealthBaselineEnabled(team, organization);
      const provisionedSport = team?.sportOrProgram;
      if (typeof provisionedSport === 'string' && provisionedSport.trim()) sportName = provisionedSport.trim().slice(0, 120);
      active = member?.status === 'active' && !member.revokedAt;
      const documents = teamSnap.data()?.requiredConsents || member?.athleteOnboarding?.requiredConsents || [];
      const onboarding = member?.athleteOnboarding;
      // Existing clients also poll this endpoint before onboarding. Never put the survey ahead of consent.
      active = active && (!onboarding?.entryOnboardingStep || hasCompletedEntryOnboarding(onboarding))
        && onboarding?.productConsentAccepted !== false
        && hasCompletedRequiredConsents({...onboarding,requiredConsents:documents.filter((document: any) => document.category !== 'health_authorization')});
      // A newly introduced optional health decision must not erase the baseline requirement.
      // Entry eligibility above still uses the already-provisioned required documents.
      const authorizationDocuments = healthBaselineConsentDocuments(documents, team, organization, organization?.productBrand);
      const healthDocs = authorizationDocuments.filter((d: any) => d.category === 'health_authorization');
      const accepts = (decisions: any) => healthDocs.every((d: any) => {
        const entry = decisions?.[d.id];
        return entry?.decision === 'accepted' && entry.version === d.version && entry.document?.body === d.body &&
          entry.document?.category === 'health_authorization' && Boolean(entry.signedName?.trim()) &&
          (!entry.expiresAt || Date.parse(entry.expiresAt) > Date.now());
      });
      healthSharingAllowed = healthBaselineEnabled && member?.status === 'active' && !member.revokedAt && latest?.actorUserId === user.uid &&
        healthDocs.length > 0 && accepts(member?.athleteOnboarding?.consentDecisions) && accepts(latest?.decisions);
      const validDecline = (doc: any, decisions: any) => {
        const entry = decisions?.[doc.id];
        return entry && ['declined', 'revoked'].includes(entry.decision) && entry.version === doc.version
          && entry.document?.body === doc.body && entry.document?.category === 'health_authorization';
      };
      const declined = healthDocs.find((doc: any) => latest?.actorUserId === user.uid
        && validDecline(doc, onboarding?.consentDecisions) && validDecline(doc, latest?.decisions)
        && onboarding?.consentDecisions?.[doc.id]?.decision === latest?.decisions?.[doc.id]?.decision);
      healthAuthorizationDecision = !healthBaselineEnabled ? 'disabled' : healthSharingAllowed ? 'accepted'
        : declined ? onboarding.consentDecisions[declined.id].decision : 'pending';
      healthAuthorizationRequired = healthBaselineEnabled && healthAuthorizationDecision === 'pending';
      if (typeof organizationId === 'string' && organizationId && typeof assignment.teamId === 'string') {
        healthAuthorizationUrl = `/PulseCheck/athlete-onboarding?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(assignment.teamId)}`;
      }
    }
    const draftRef = collection.doc(`performance_draft_${user.uid}_${QUESTIONNAIRE_VERSION}`);
    let draft = active && enabled && !completed ? (await draftRef.get()).data() : null;
    if (!draft && active && enabled && !completed) {
      const old = (await collection.doc(`performance_draft_${user.uid}_${PREVIOUS_QUESTIONNAIRE_VERSION}`).get()).data();
      if (old?.version === PREVIOUS_QUESTIONNAIRE_VERSION && typeof old.name === 'string') {
        draft = {flowVersion:4,version:QUESTIONNAIRE_VERSION,name:old.name,ownerUid:user.uid,
          answers:old.answers?.['cau-starting-point-46'] ? {'cau-starting-point-46':old.answers['cau-starting-point-46']} : {},
          position:0,completed:old.completed === true,revision:0,migratedFrom:PREVIOUS_QUESTIONNAIRE_VERSION};
      }
    }
    const skillsRef = collection.doc(`skills_draft_${user.uid}_${QUESTIONNAIRE_VERSION}`);
    let savedSkills = active && enabled ? (await skillsRef.get()).data() : null;
    if (!savedSkills && active && enabled && !completed) {
      const old = (await collection.doc(`skills_draft_${user.uid}_${PREVIOUS_QUESTIONNAIRE_VERSION}`).get()).data();
      if (old?.draft) {
        try { savedSkills = {version:2,revision:0,completed:false,draft:validateSkillsDraft(old.draft),migratedFrom:PREVIOUS_QUESTIONNAIRE_VERSION}; }
        catch { /* Malformed old progress is not silently reinterpreted. */ }
      }
    }
    const canonical = active && enabled ? (await db.collection('athlete-mental-progress').doc(user.uid).get()).data()?.mentalSkillsBaseline : null;
    const skills = completedStartingProfile(canonical) ? {completed:true,result:canonical,reused:true} : savedSkills ? {...savedSkills,completed:false} : null;
    const pendingAttempt = active && !completed ? (await collection.doc(`attempt_${user.uid}_${QUESTIONNAIRE_VERSION}`).get()).data() : null;
    const clinicalDeliveryAvailable = assignment?.environment === 'test'
      ? assignment.universityCode === 'SANDBOX' && Boolean(process.env.AUNTEDNA_PARTNER_TEST_KEY?.startsWith('ae_pk_test_'))
      : assignment?.environment === 'live' && assignment.universityCode === 'CAU' && Boolean(process.env.AUNTEDNA_PARTNER_LIVE_KEY?.startsWith('ae_pk_live_'));
    if (req.method === 'GET') return res.json({ required: Boolean(active && !completed), completed, version: VERSION, questionnaireVersion: QUESTIONNAIRE_VERSION,
      available: Boolean(active && enabled), draft: draft || null, skills, healthSharingAllowed, healthBaselineEnabled, healthAuthorizationRequired, healthAuthorizationUrl, healthAuthorizationDecision, submissionSharing: typeof pendingAttempt?.shareHealth === 'boolean' ? pendingAttempt.shareHealth : null, healthCollectionAvailable: clinicalDeliveryAvailable, sportName, questionnaireUrl: 'https://fitwithpulse.ai/PulseCheck/baseline' });
    if (!isCurrentQuestionnaire(req.body)) return res.status(409).json({error:'This questionnaire has changed. Reload the page to continue with the current version.'});
    if (!assignment || !active || !enabled) return res.status(503).json({ error: 'Your questionnaire is not available yet. Please contact your program team.' });
    if (completed) return res.json({ saved: true, completed: true });
    if (['saveSkillsDraft','completeSkills'].includes(req.body?.action)) {
      if (completedStartingProfile(canonical)) return res.json({skills});
      if (!draft?.completed) return res.status(400).json({error:'Complete your performance questions first.'});
      try {
        const saved = await saveSkills(db,skillsRef,req.body,user.uid,req.body.action==='completeSkills',sportName);
        if (saved.completed) {
          const response = await fetch('https://fitwithpulse.ai/.netlify/functions/complete-pulsecheck-baseline', {
            method:'POST',redirect:'error',signal:AbortSignal.timeout(35000),
            headers:{'Content-Type':'application/json',Authorization:bearer,'X-PulseCheck-Firebase-Mode':req.headers['x-pulsecheck-firebase-mode']==='dev'?'dev':'prod'},
            body:JSON.stringify({userId:user.uid,mentalSkillsBaseline:saved.result,assessmentNeeded:false,source:'consolidated-athlete-baseline'})
          });
          if (!response.ok) throw Error('Canonical save failed.');
        }
        return res.json({skills:saved});
      } catch {return res.status(503).json({error:'Starting profile completion could not be confirmed. Retry to finish saving.'});}
    }
    if (req.body?.action === 'savePerformanceDraft') {
      try { const draft = await savePerformanceDraft(db, draftRef, req.body.draft, user.uid); return res.json({draft}); }
      catch { return res.status(409).json({error:'Progress could not be saved. Retry, or reopen this questionnaire if another tab changed it.'}); }
    }
    if (!completedStartingProfile(canonical)) return res.status(400).json({error:'Finish your starting profile before submitting.'});
    if (req.body?.completedSections?.performance !== true || req.body?.completedSections?.health !== true || typeof req.body.shareHealth !== 'boolean') return res.status(400).json({ error: 'Finish both sections before submitting.' });
    // Stable assignment ID and authenticated UID bind retries across web and apps.
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(assignment.submissionId || '')) return res.status(503).json({ error: 'Your questionnaire setup needs review.' });
    const input = applyAdministrativeAnswers({ ...req.body, submissionId: `sp2-${createHash('sha256').update(assignment.submissionId).digest('hex')}`, email: user.email || req.body.email }, await deriveAdministrativeAnswers(db,user.uid));
    let split;
    try { split = splitSubmission(input); } catch { return res.status(400).json({ error: 'Please check your answers before submitting.' }); }
    if (req.body.shareHealth !== false && (!healthSharingAllowed || !clinicalDeliveryAvailable)) return res.status(403).json({ error: 'Review your health-sharing authorization, or complete performance only.' });
    const attemptRef = collection.doc(`attempt_${user.uid}_${QUESTIONNAIRE_VERSION}`);
    const shareHealth = req.body.shareHealth !== false;
    const attempt = await db.runTransaction(async tx => {
      const current = await tx.get(attemptRef);
      if (current.exists) return current.data()!;
      const value = { externalId: user.uid, submissionId: input.submissionId, shareHealth, pulseCheck: split.pulseCheck };
      // Only the non-clinical snapshot is reserved. No clinical answers or hashes.
      tx.create(attemptRef, value);
      return value;
    });
    if (attempt.externalId !== user.uid || attempt.submissionId !== input.submissionId || attempt.shareHealth !== shareHealth) {
      return res.status(409).json({ error: 'A submission is already in progress. Keep the same sharing choice and press Submit answers to retry.' });
    }
    const create = async (_id: string, mirror: any) => db.runTransaction(async tx => {
      const current = await tx.get(recordRef);
      if (current.exists) return current.data() as any;
      tx.create(recordRef, { ...mirror, ...retainedPrivateCopy(input, liveRetentionEnabled(assignment, process.env.CAU_PRIVATE_RETENTION_ENABLED)), administrativeMetadata:{...input.administrativeMetadata,firstPerformanceSaveAt:draft?.startedAt || null}, fields: attempt.pulseCheck.fields, identity: attempt.pulseCheck.identity, recordedAt: admin.firestore.FieldValue.serverTimestamp() });
      return mirror;
    });
    if (req.body.shareHealth === false) {
      // Completing the requirement does not require health disclosure.
      const mirror = { ...split.pulseCheck, externalId: user.uid, status: 'complete',
        auntEdnaReferences: Object.fromEntries(Object.keys(split.pulseCheck.auntEdnaReferences).map(id => [id, {
          questionId: id, questionnaireVersion: QUESTIONNAIRE_VERSION, custodian: 'auntEDNA', state: 'not_shared',
        }])) };
      await create(input.submissionId, mirror);
    } else {
      if (!healthSharingAllowed) return res.status(403).json({ error: 'Review your health-sharing authorization, or complete performance only.' });
      const environment = assignment.environment;
      if (environment !== 'test' && environment !== 'live') return res.status(503).json({ error: 'Your questionnaire setup needs review.' });
      const apiKey = environment === 'test' ? process.env.AUNTEDNA_PARTNER_TEST_KEY : process.env.AUNTEDNA_PARTNER_LIVE_KEY;
      if (!apiKey) return res.status(503).json({ error: 'The questionnaire connection is not available yet.' });
      await deliverQuestionnaire(input, user.uid, { environment, apiKey, universityCode: assignment.universityCode }, {
        get: async () => { const doc = await recordRef.get(); return doc.exists ? doc.data() as any : null; }, create,
      });
    }
    return res.json({ saved: true, completed: true });
  } catch (error) {
    // Deliberately no request or provider-body logging.
    return res.status(error instanceof PartnerError && !error.retryable ? 502 : 503).json({
      error: 'We could not confirm your submission. Keep this page open and retry with the same answers.',
    });
  }
}
