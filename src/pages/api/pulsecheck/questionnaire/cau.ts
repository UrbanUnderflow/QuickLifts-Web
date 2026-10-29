import { resolveSchoolActivationFlow, SCHOOL_ACTIVATION_FLOW_VERSION } from '../../../../api/firebase/pulsecheckProvisioning/schoolActivationFlow';
import { baselineHealthContext, saveBaselineHealthDecision } from '../../../../lib/questionnaires/cau-health';
import { resolveBaselineConnection } from '../../../../lib/questionnaires/auntedna-connection';
import { baselineCompletionUrl } from '../../../../lib/questionnaires/baseline-completion-url';
import { assertMemberSignIn } from '../../../../lib/server/auth/program-sign-in';
import { resolveStandardBaselineAssignment } from '../../../../lib/questionnaires/standard-assignment';
import { resolveTeamBaselineReview, teamBaselinePrefill, teamBaselineRecordId, teamBaselineReviewId } from '../../../../lib/questionnaires/team-baseline-review';
import { createHash } from 'crypto';
import { deriveAdministrativeAnswers, applyAdministrativeAnswers } from '../../../../lib/questionnaires/cau-derived';
import { completedStartingProfile, saveSkills, validateSkillsDraft } from '../../../../lib/questionnaires/cau-skills';
import { retainedPrivateCopy, liveRetentionEnabled } from '../../../../lib/questionnaires/cau-retention';
import { savePerformanceDraft } from '../../../../lib/questionnaires/cau-performance-draft';
import type { NextApiRequest, NextApiResponse } from 'next';
import { normalizeNativeProductBrand } from '../../../../utils/pulsecheckAppDistribution';
import { COLLECTION, VERSION, QUESTIONNAIRE_VERSION, PREVIOUS_QUESTIONNAIRE_VERSION, PREVIOUS_QUESTIONNAIRE_VERSIONS, isCurrentQuestionnaire, baselineRecordId, baselineComplete, splitSubmission } from '../../../../lib/questionnaires/cau';
import { healthBackupId, prepareHealthBackup, processHealthBackup, readHealthBackup } from '../../../../lib/questionnaires/cau-backups';
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
    try { await assertMemberSignIn(db, user); } catch (error) { return res.status(403).json({ error: error instanceof Error ? error.message : 'Use your program sign-in method.' }); }
    // Assignments are provisioned by trusted administrators, never by the client.
    const existingAssignment = (await collection.doc(`assignment_${user.uid}`).get()).data();
    let assignment = await resolveStandardBaselineAssignment(db, user.uid, existingAssignment);
    let active = assignment?.kind === 'assignment' && assignment.enabled === true && assignment.version === VERSION && (typeof assignment.teamId === 'string' && assignment.teamId.length > 0 || assignment.scope === 'individual');
    const enabled = process.env.ATHLETE_BASELINE_ENABLED !== 'false';
    const originalRecordRef = collection.doc(baselineRecordId(user.uid));
    const existing = await originalRecordRef.get();
    const legacy = await collection.doc(`baseline_${user.uid}_${VERSION}`).get();
    // Completed historical baselines remain completed; unfinished drafts start in a separate namespace.
    const previous = await Promise.all(PREVIOUS_QUESTIONNAIRE_VERSIONS.map(version => collection.doc(`baseline_${user.uid}_${version}`).get()));
    const historicalSnapshots = [existing, legacy, ...previous];
    const previouslyCompleted = historicalSnapshots.some(snapshot => baselineComplete(snapshot.data(), user.uid));
    const canonical = enabled ? (await db.collection('athlete-mental-progress').doc(user.uid).get()).data()?.mentalSkillsBaseline : null;
    const teamReview = await resolveTeamBaselineReview(db, user.uid, existingAssignment, previouslyCompleted, canonical);
    if (teamReview) { assignment = teamReview; active = true; }
    const reviewId = teamReview?.reviewId || '';
    const recordRef = reviewId ? collection.doc(teamBaselineRecordId(reviewId)) : originalRecordRef;
    const completed = !reviewId && previouslyCompleted;
    if (req.method === 'POST' && String(req.body?.reviewId || '') !== reviewId) return res.status(409).json({ error: 'Your team baseline has changed. Reopen the baseline to review the current team.' });
    const namespace = `${user.uid}_${QUESTIONNAIRE_VERSION}${reviewId ? `_${reviewId}` : ''}`;
    const health = await baselineHealthContext(db, user.uid, assignment);
    active = active && health.eligible;
    const { healthSharingAllowed, healthBaselineEnabled, healthAuthorizationRequired, healthAuthorizationUrl,
      healthAuthorizationDecision, sportName } = health;
    const draftRef = collection.doc(`performance_draft_${namespace}`);
    let draft = active && enabled && !completed ? (await draftRef.get()).data() : null;
    if (!reviewId && !draft && active && enabled && !completed) {
      const old = (await collection.doc(`performance_draft_${user.uid}_${PREVIOUS_QUESTIONNAIRE_VERSION}`).get()).data();
      if (old?.version === PREVIOUS_QUESTIONNAIRE_VERSION && typeof old.name === 'string') {
        draft = {flowVersion:4,version:QUESTIONNAIRE_VERSION,name:old.name,ownerUid:user.uid,
          answers:old.answers?.['cau-starting-point-46'] ? {'cau-starting-point-46':old.answers['cau-starting-point-46']} : {},
          position:0,completed:old.completed === true,revision:0,migratedFrom:PREVIOUS_QUESTIONNAIRE_VERSION};
      }
    }
    const skillsRef = collection.doc(`skills_draft_${namespace}`);
    let savedSkills = active && enabled ? (await skillsRef.get()).data() : null;
    if (!reviewId && !savedSkills && active && enabled && !completed) {
      const old = (await collection.doc(`skills_draft_${user.uid}_${PREVIOUS_QUESTIONNAIRE_VERSION}`).get()).data();
      if (old?.draft) {
        try { savedSkills = {version:2,revision:0,completed:false,draft:validateSkillsDraft(old.draft),migratedFrom:PREVIOUS_QUESTIONNAIRE_VERSION}; }
        catch { /* Malformed old progress is not silently reinterpreted. */ }
      }
    }
    const priorTeamRecords = reviewId && active ? (await collection.where('externalId', '==', user.uid).get()).docs
      .map(snapshot => snapshot.data()).filter(record => baselineComplete(record, user.uid)) : [];
    const prefill = reviewId ? teamBaselinePrefill([...priorTeamRecords, ...historicalSnapshots.map(snapshot => snapshot.data()).filter(record => baselineComplete(record, user.uid))], teamReview.previousStartingProfile || canonical) : null;
    const skills = reviewId ? savedSkills || (prefill?.skillsDraft ? {completed:true,draft:prefill.skillsDraft,result:canonical,reused:true,revision:0} : null)
      : completedStartingProfile(canonical) ? {completed:true,result:canonical,reused:true} : savedSkills ? {...savedSkills,completed:false} : null;
    const pendingAttempt = active && !completed ? (await collection.doc(`attempt_${namespace}`).get()).data() : null;
    const connection = active ? resolveBaselineConnection(health.organizationId, assignment?.teamId, health.organization, assignment) : null;
    const clinicalDeliveryAvailable = Boolean(connection);
    const healthBackupAvailable = Boolean(active && enabled && healthSharingAllowed);
    const currentRecord = reviewId ? (await recordRef.get()).data() : existing.data();
    // A historical original record never verifies delivery for another team review.
    const currentReceiptScope = Boolean(reviewId && currentRecord?.reviewId===reviewId);
    const priorBackupId = currentReceiptScope ? currentRecord?.healthBackupId : null;
    const selectedBackup = typeof priorBackupId === 'string' ? await readHealthBackup(db, priorBackupId).catch(() => null) : null;
    const priorBackup = selectedBackup?.athleteId===user.uid ? selectedBackup : null;
    const healthReceipt = (backup: any) => backup ? {backupId:backup.id,healthStorage:backup.deliveryStatus==='verified'?'auntedna_verified':'pulse_private_backup',providerVerified:backup.deliveryStatus==='verified'} : null;
    if (req.method === 'GET') return res.json({ required: Boolean(active && !completed), completed, version: VERSION, questionnaireVersion: QUESTIONNAIRE_VERSION,
      reviewId: reviewId || null, teamName: teamReview?.teamName || null, prefill,
      productBrand: normalizeNativeProductBrand(health.organization?.productBrand),
      ...(health.eligible && !health.individual && resolveSchoolActivationFlow({ productBrand: health.organization?.productBrand, role: health.member?.role }) ? { onboardingFlowVersion: SCHOOL_ACTIVATION_FLOW_VERSION } : {}),
      teamWorkspaceUrl: active && assignment?.teamId && health.organizationId ? `/PulseCheck/team-workspace?organizationId=${encodeURIComponent(health.organizationId)}&teamId=${encodeURIComponent(assignment.teamId)}` : null,
      available: Boolean(active && enabled), draft: draft || null, skills, healthSharingAllowed, healthBaselineEnabled, healthAuthorizationRequired, healthAuthorizationUrl, healthAuthorizationDecision, healthDocuments: active ? health.healthDocuments : [], healthConsentDecisions: active ? Object.fromEntries(health.healthDocuments.filter(document => health.decisions[document.id]).map(document => [document.id, health.decisions[document.id]])) : {}, submissionSharing: typeof pendingAttempt?.shareHealth === 'boolean' ? pendingAttempt.shareHealth : null, healthCollectionAvailable: healthBackupAvailable, healthBackupAvailable, providerDeliveryAvailable: clinicalDeliveryAvailable, receipt: healthReceipt(priorBackup), sportName, questionnaireUrl: 'https://fitwithpulse.ai/PulseCheck/baseline' });
    if (!isCurrentQuestionnaire(req.body)) return res.status(409).json({error:'This questionnaire has changed. Reload the page to continue with the current version.'});
    if (!assignment || !active || !enabled) return res.status(503).json({ error: 'Your questionnaire is not available yet. Please contact your program team.' });
    if (req.body?.action === 'saveHealthDecision') {
      try {
        await saveBaselineHealthDecision(db, user.uid, health, req.body.decisions, () => admin.firestore.FieldValue.serverTimestamp());
        return res.json({ saved: true });
      } catch { return res.status(409).json({ error: 'Your health choice could not be saved. Review the current terms and retry.' }); }
    }
    if (completed) return res.json({ saved: true, completed: true, receipt: healthReceipt(priorBackup) });
    if (['saveSkillsDraft','completeSkills'].includes(req.body?.action)) {
      if (!reviewId && completedStartingProfile(canonical)) return res.json({skills});
      if (!draft?.completed && !(reviewId && prefill?.performanceQuestionsComplete)) return res.status(400).json({error:'Complete your performance questions first.'});
      try {
        const saved = await saveSkills(db,skillsRef,req.body,user.uid,req.body.action==='completeSkills',sportName,Boolean(reviewId));
        if (saved.completed) {
          const response = await fetch(baselineCompletionUrl(), {
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
    if (!completedStartingProfile(canonical) && !(reviewId && savedSkills?.completed)) return res.status(400).json({error:'Finish your starting profile before submitting.'});
    if (reviewId && req.body.acceptPrefilled !== true) return res.status(400).json({ error: 'Review and confirm your answers for this team before submitting.' });
    if (req.body?.completedSections?.performance !== true || req.body?.completedSections?.health !== true || typeof req.body.shareHealth !== 'boolean') return res.status(400).json({ error: 'Finish both sections before submitting.' });
    // Stable assignment ID and authenticated UID bind retries across web and apps.
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(assignment.submissionId || '')) return res.status(503).json({ error: 'Your questionnaire setup needs review.' });
    const input = applyAdministrativeAnswers({ ...req.body, submissionId: `sp2-${createHash('sha256').update(`${assignment.submissionId}:${QUESTIONNAIRE_VERSION}`).digest('hex')}`, email: user.email || req.body.email }, await deriveAdministrativeAnswers(db,user.uid));
    let split;
    try { split = splitSubmission(input); } catch { return res.status(400).json({ error: 'Please check your answers before submitting.' }); }
    if (req.body.shareHealth !== false && !healthSharingAllowed) return res.status(403).json({ error: 'Review your health-sharing authorization, or complete performance only.' });
    const attemptRef = collection.doc(`attempt_${namespace}`);
    const shareHealth = req.body.shareHealth !== false;
    const existingAttempt = (await attemptRef.get()).data();
    const attempt = existingAttempt || { externalId:user.uid,submissionId:input.submissionId,shareHealth,pulseCheck:split.pulseCheck };
    if (attempt.externalId !== user.uid || attempt.submissionId !== input.submissionId || attempt.shareHealth !== shareHealth || JSON.stringify(attempt.pulseCheck)!==JSON.stringify(split.pulseCheck)) {
      return res.status(409).json({ error: 'A submission is already in progress. Keep the same sharing choice and press Submit answers to retry.' });
    }
    const create = async (_id: string, mirror: any) => db.runTransaction(async tx => {
      const current = await tx.get(recordRef);
      if (current.exists) return current.data() as any;
      const reserved = await tx.get(attemptRef);
      if (reserved.exists && (reserved.data()?.externalId!==user.uid || reserved.data()?.submissionId!==input.submissionId || reserved.data()?.shareHealth!==shareHealth)) throw Error('Submission reservation changed.');
      if (reviewId) {
        const membership = (await tx.get(db.collection('pulsecheck-team-memberships').doc(assignment.teamMembershipId))).data();
        if (membership?.userId !== user.uid || membership.status !== 'active' || membership.revokedAt || membership.archivedAt || membership.deletedAt
          || teamBaselineReviewId(user.uid, assignment.teamMembershipId, membership) !== reviewId) throw Error('Team join changed.');
      }
      const original = reviewId ? await tx.get(originalRecordRef) : null;
      const backup = shareHealth ? await prepareHealthBackup(db, tx, {uid:user.uid,input,assignment,recordIds:[recordRef.id,...(reviewId && !original?.exists ? [originalRecordRef.id] : [])]}) : null;
      const value = { ...mirror, ...retainedPrivateCopy(input, liveRetentionEnabled(assignment, process.env.CAU_PRIVATE_RETENTION_ENABLED)), administrativeMetadata:{...input.administrativeMetadata,firstPerformanceSaveAt:draft?.startedAt || null}, fields: attempt.pulseCheck.fields, identity: attempt.pulseCheck.identity, recordedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(reviewId ? {reviewId, teamId:assignment.teamId, teamMembershipId:assignment.teamMembershipId, reviewedAt:new Date().toISOString(), reviewedBy:user.uid, acceptedPrefilled:true, startingProfile:savedSkills?.result || canonical, prefillSourceSubmissionId:prefill?.sourceSubmissionId || null} : {}) };
      if (!reserved.exists) tx.create(attemptRef, attempt);
      if (backup?.create) tx.create(backup.reference, backup.record);
      tx.create(recordRef, value);
      if (reviewId && !original?.exists) tx.create(originalRecordRef, value);
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
      const backupId = healthBackupId(user.uid, input.submissionId);
      const mirror = {...split.pulseCheck,externalId:user.uid,status:'complete',healthBackupId:backupId,
        healthDelivery:{status:'pending'},auntEdnaReferences:Object.fromEntries(Object.entries(split.pulseCheck.auntEdnaReferences)
          .map(([id,reference]:[string,any])=>[id,{...reference,state:'backup'}]))};
      await create(input.submissionId, mirror);
      // The private backup is already durable. Provider delay never turns a saved baseline into a false failure.
      let backup;
      try { backup = await processHealthBackup(db, backupId, user.uid); }
      catch { backup = await readHealthBackup(db, backupId); }
      return res.json({saved:true,completed:true,receipt:healthReceipt(backup)});
    }
    return res.json({ saved: true, completed: true });
  } catch (error) {
    // Deliberately no request or provider-body logging.
    return res.status(error instanceof PartnerError && !error.retryable ? 502 : 503).json({
      error: 'We could not confirm your submission. Keep this page open and retry with the same answers.',
    });
  }
}
