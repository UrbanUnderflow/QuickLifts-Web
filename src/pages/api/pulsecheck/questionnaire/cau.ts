import { deriveAdministrativeAnswers, applyAdministrativeAnswers } from '../../../../lib/questionnaires/cau-derived';
import { saveSkills } from '../../../../lib/questionnaires/cau-skills';
import { retainedPrivateCopy, liveRetentionEnabled } from '../../../../lib/questionnaires/cau-retention';
import { savePerformanceDraft } from '../../../../lib/questionnaires/cau-performance-draft';
import type { NextApiRequest, NextApiResponse } from 'next';
import { COLLECTION, VERSION, splitSubmission } from '../../../../lib/questionnaires/cau';
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
    const assignment = (await collection.doc(`assignment_${user.uid}`).get()).data();
    let active = assignment?.kind === 'assignment' && assignment.enabled === true && assignment.version === VERSION && typeof assignment.teamId === 'string' && assignment.teamId.length > 0;
    const enabled = process.env.CAU_QUESTIONNAIRE_COLLECTION_ENABLED === 'true';
    const recordRef = collection.doc(`baseline_${user.uid}_${VERSION}`);
    const existing = await recordRef.get();
    const completed = existing.exists && existing.data()?.status === 'complete' && existing.data()?.externalId === user.uid;
    let healthSharingAllowed = false;
    if (active && assignment?.teamId) {
      const memberRef = db.collection('pulsecheck-team-memberships').doc(`${assignment.teamId}_${user.uid}`);
      const [memberSnap, teamSnap, evidence] = await Promise.all([
        memberRef.get(), db.collection('pulsecheck-teams').doc(assignment.teamId).get(),
        memberRef.collection('consent-events').orderBy('recordedAt', 'desc').limit(1).get(),
      ]);
      const member = memberSnap.data(), latest = evidence.docs[0]?.data();
      active = member?.status === 'active' && !member.revokedAt;
      const documents = teamSnap.data()?.requiredConsents || member?.athleteOnboarding?.requiredConsents || [];
      const healthDocs = documents.filter((d: any) => d.category === 'health_authorization');
      const accepts = (decisions: any) => healthDocs.every((d: any) => {
        const entry = decisions?.[d.id];
        return entry?.decision === 'accepted' && entry.version === d.version && entry.document?.body === d.body &&
          entry.document?.category === 'health_authorization' && Boolean(entry.signedName?.trim()) &&
          (!entry.expiresAt || Date.parse(entry.expiresAt) > Date.now());
      });
      healthSharingAllowed = member?.status === 'active' && !member.revokedAt && latest?.actorUserId === user.uid &&
        healthDocs.length > 0 && accepts(member?.athleteOnboarding?.consentDecisions) && accepts(latest?.decisions);
    }
    const draftRef = collection.doc(`performance_draft_${user.uid}_${VERSION}`);
    const draft = active && enabled && !completed ? (await draftRef.get()).data() : null;
    const skillsRef = collection.doc(`skills_draft_${user.uid}_${VERSION}`);
    const savedSkills = active && enabled ? (await skillsRef.get()).data() : null;
    const canonical = active && enabled ? (await db.collection('athlete-mental-progress').doc(user.uid).get()).data()?.mentalSkillsBaseline : null;
    const skills = canonical?.version === 5 ? {completed:true,result:canonical,reused:true} : savedSkills ? {...savedSkills,completed:false} : null;
    if (req.method === 'GET') return res.json({ required: Boolean(active && enabled && !completed), completed, version: VERSION,
      available: Boolean(active && enabled), draft: draft || null, skills, healthSharingAllowed, questionnaireUrl: 'https://fitwithpulse.ai/PulseCheck/questionnaire/cau' });
    if (!assignment || !active || !enabled) return res.status(503).json({ error: 'Your questionnaire is not available yet. Please contact your program team.' });
    if (completed) return res.json({ saved: true, completed: true });
    if (['saveSkillsDraft','completeSkills'].includes(req.body?.action)) {
      if (canonical?.version === 5) return res.json({skills});
      if (!draft?.completed) return res.status(400).json({error:'Complete your performance questions first.'});
      try {
        const saved = await saveSkills(db,skillsRef,req.body,user.uid,req.body.action==='completeSkills');
        if (saved.completed) {
          const response = await fetch('https://fitwithpulse.ai/.netlify/functions/complete-pulsecheck-baseline', {
            method:'POST',redirect:'error',signal:AbortSignal.timeout(35000),
            headers:{'Content-Type':'application/json',Authorization:bearer,'X-PulseCheck-Firebase-Mode':req.headers['x-pulsecheck-firebase-mode']==='dev'?'dev':'prod'},
            body:JSON.stringify({userId:user.uid,mentalSkillsBaseline:saved.result,assessmentNeeded:false,source:'consolidated-cau-baseline'})
          });
          if (!response.ok) throw Error('Canonical save failed.');
        }
        return res.json({skills:saved});
      } catch {return res.status(503).json({error:'Skills completion could not be confirmed. Retry to finish saving.'});}
    }
    if (req.body?.action === 'savePerformanceDraft') {
      try { const draft = await savePerformanceDraft(db, draftRef, req.body.draft, user.uid); return res.json({draft}); }
      catch { return res.status(409).json({error:'Progress could not be saved. Retry, or reopen this questionnaire if another tab changed it.'}); }
    }
    if (canonical?.version !== 5) return res.status(400).json({error:'Finish your skills activities before submitting.'});
    if (req.body?.completedSections?.performance !== true || req.body?.completedSections?.health !== true || typeof req.body.shareHealth !== 'boolean') return res.status(400).json({ error: 'Finish both sections before submitting.' });
    // Stable assignment ID and authenticated UID bind retries across web and apps.
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(assignment.submissionId || '')) return res.status(503).json({ error: 'Your questionnaire setup needs review.' });
    const input = applyAdministrativeAnswers({ ...req.body, submissionId: assignment.submissionId, email: user.email || req.body.email }, await deriveAdministrativeAnswers(db,user.uid));
    let split;
    try { split = splitSubmission(input); } catch { return res.status(400).json({ error: 'Please check your answers before submitting.' }); }
    if (req.body.shareHealth !== false && !healthSharingAllowed) return res.status(403).json({ error: 'Review your health-sharing authorization, or complete performance only.' });
    const attemptRef = collection.doc(`attempt_${user.uid}_${VERSION}`);
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
      return res.status(409).json({ error: 'A submission is already in progress. Retry it with the same sharing choice.' });
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
          questionId: id, questionnaireVersion: VERSION, custodian: 'auntEDNA', state: 'not_shared',
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
