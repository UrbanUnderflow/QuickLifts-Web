import { baselineHealthContext, saveBaselineHealthDecision } from '../../../../lib/questionnaires/cau-health';
import { resolveBaselineConnection } from '../../../../lib/questionnaires/auntedna-connection';
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
    const health = await baselineHealthContext(db, user.uid, assignment);
    active = active && health.eligible;
    const { healthSharingAllowed, healthBaselineEnabled, healthAuthorizationRequired, healthAuthorizationUrl,
      healthAuthorizationDecision, sportName } = health;
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
    const connection = active ? resolveBaselineConnection(health.organizationId, assignment?.teamId, health.organization, assignment) : null;
    const clinicalDeliveryAvailable = Boolean(connection);
    if (req.method === 'GET') return res.json({ required: Boolean(active && !completed), completed, version: VERSION, questionnaireVersion: QUESTIONNAIRE_VERSION,
      available: Boolean(active && enabled), draft: draft || null, skills, healthSharingAllowed, healthBaselineEnabled, healthAuthorizationRequired, healthAuthorizationUrl, healthAuthorizationDecision, healthDocuments: active ? health.healthDocuments : [], healthConsentDecisions: active ? Object.fromEntries(health.healthDocuments.filter(document => health.decisions[document.id]).map(document => [document.id, health.decisions[document.id]])) : {}, submissionSharing: typeof pendingAttempt?.shareHealth === 'boolean' ? pendingAttempt.shareHealth : null, healthCollectionAvailable: clinicalDeliveryAvailable, sportName, questionnaireUrl: 'https://fitwithpulse.ai/PulseCheck/baseline' });
    if (!isCurrentQuestionnaire(req.body)) return res.status(409).json({error:'This questionnaire has changed. Reload the page to continue with the current version.'});
    if (!assignment || !active || !enabled) return res.status(503).json({ error: 'Your questionnaire is not available yet. Please contact your program team.' });
    if (req.body?.action === 'saveHealthDecision') {
      try {
        await saveBaselineHealthDecision(db, user.uid, health, req.body.decisions, () => admin.firestore.FieldValue.serverTimestamp());
        return res.json({ saved: true });
      } catch { return res.status(409).json({ error: 'Your health choice could not be saved. Review the current terms and retry.' }); }
    }
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
    if (healthAuthorizationRequired) return res.status(409).json({ error: 'Review your health authorization and record your choice before submitting.' });
    if (!completedStartingProfile(canonical)) return res.status(400).json({error:'Finish your starting profile before submitting.'});
    if (req.body?.completedSections?.performance !== true || req.body?.completedSections?.health !== true || typeof req.body.shareHealth !== 'boolean') return res.status(400).json({ error: 'Finish both sections before submitting.' });
    // Stable assignment ID and authenticated UID bind retries across web and apps.
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(assignment.submissionId || '')) return res.status(503).json({ error: 'Your questionnaire setup needs review.' });
    const input = applyAdministrativeAnswers({ ...req.body, submissionId: `sp2-${createHash('sha256').update(`${assignment.submissionId}:${QUESTIONNAIRE_VERSION}`).digest('hex')}`, email: user.email || req.body.email }, await deriveAdministrativeAnswers(db,user.uid));
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
      if (!connection) return res.status(503).json({ error: 'The questionnaire connection is not available yet.' });
      await deliverQuestionnaire(input, user.uid, connection, {
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
