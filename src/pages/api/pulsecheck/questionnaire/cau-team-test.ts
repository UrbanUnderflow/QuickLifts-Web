import { deriveAdministrativeAnswers, applyAdministrativeAnswers } from '../../../../lib/questionnaires/cau-derived';
import { saveSkills } from '../../../../lib/questionnaires/cau-skills';
import { retainedPrivateCopy } from '../../../../lib/questionnaires/cau-retention';
import { savePerformanceDraft } from '../../../../lib/questionnaires/cau-performance-draft';
import type { NextApiRequest, NextApiResponse } from 'next';
import { createHash, timingSafeEqual } from 'crypto';
import { COLLECTION, VERSION, splitSubmission } from '../../../../lib/questionnaires/cau';
import { deliverQuestionnaire } from '../../../../lib/questionnaires/cau-delivery';

export const config = { api: { bodyParser: { sizeLimit: '128kb' } } };
const digest = (value: string) => createHash('sha256').update(value).digest();
function publicReceipt(record: any) {
  if (!record?.auntEdna) return null;
  return { externalId: record.externalId, submissionId: record.submissionId, ...record.auntEdna };
}
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!['GET', 'POST'].includes(req.method || '')) { res.setHeader('Allow', 'GET, POST'); return res.status(405).end(); }
  const invite = req.headers['x-questionnaire-test'];
  const expected = process.env.CAU_TEAM_TEST_INVITE;
  const campaign = process.env.CAU_TEAM_TEST_CAMPAIGN;
  const expiry = Date.parse(process.env.CAU_TEAM_TEST_EXPIRES_AT || '');
  if (!expected || !campaign || !/^[a-zA-Z0-9_-]{1,60}$/.test(campaign) || !Number.isFinite(expiry) || expiry <= Date.now()) {
    return res.status(503).json({error:'This team test is closed. Ask your test coordinator for the current link.'});
  }
  if (typeof invite !== 'string' || !timingSafeEqual(new Uint8Array(digest(invite)), new Uint8Array(digest(expected)))) return res.status(403).json({error:'Open the complete team test link to continue.'});
  const bearer = req.headers.authorization;
  if (!bearer?.startsWith('Bearer ')) return res.status(401).json({error:'Sign in to PulseCheck to continue.'});
  const apiKey = process.env.AUNTEDNA_PARTNER_TEST_KEY;
  if (!apiKey?.startsWith('ae_pk_test_')) return res.status(503).json({error:'The sandbox connection is not ready.'});
  try {
    const { default: admin, getFirebaseAdminApp } = await import('../../../../lib/firebase-admin');
    const app = getFirebaseAdminApp(false); // Existing PulseCheck accounts, sandbox destination only.
    let user;
    try { user = await admin.auth(app).verifyIdToken(bearer.slice(7), true); }
    catch { return res.status(401).json({error:'Sign in to PulseCheck again to continue.'}); }
    const tester = digest(`${campaign}:${user.uid}`).toString('hex').slice(0,32);
    const externalId = `sandbox-pulse-${tester}`, submissionId = `team-test-${campaign}-${tester}`;
    const collection = admin.firestore(app).collection(COLLECTION);
    const recordRef = collection.doc(`sandbox_${campaign}_${tester}`);
    const existing = await recordRef.get();
    const draftRef = collection.doc(`sandbox_draft_${campaign}_${tester}`);
    const draft = (await draftRef.get()).data();
    const skillsRef = collection.doc(`sandbox_skills_${campaign}_${tester}`);
    const skills = (await skillsRef.get()).data() || null;
    const complete = existing.exists && skills?.completed === true;
    const resumedDraft = existing.exists ? {version:VERSION,revision:draft?.revision || 0,name:draft?.name || 'Tester',position:0,completed:true,answers:Object.fromEntries(Object.entries(existing.data()?.fields || {}).filter(([,field]:any)=>field.state==='local').map(([id,field]:any)=>[id,field.value]))} : draft || null;
    if (req.method === 'GET') return res.json({available:true,completed:complete,questionnaireSubmitted:existing.exists,required:false,healthSharingAllowed:true,version:VERSION,skills,draft:complete ? null : resumedDraft,receipt:publicReceipt(existing.data())});
    if (['saveSkillsDraft','completeSkills'].includes(req.body?.action)) {
      if (!existing.exists && !draft?.completed) return res.status(400).json({error:'Complete your performance questions first.'});
      try {const savedSkills=await saveSkills(admin.firestore(app),skillsRef,req.body,user.uid,req.body.action==='completeSkills');return res.json({skills:savedSkills,completed:existing.exists && savedSkills.completed,receipt:publicReceipt(existing.data())});}
      catch {return res.status(409).json({error:'Skills could not be saved. Retry, or reopen if another tab changed your progress.'});}
    }
    if (existing.exists) return complete ? res.json({saved:true,completed:true,receipt:publicReceipt(existing.data())}) : res.status(400).json({error:'Complete the new skills activities. Your previous answers are already saved.'});
    if (req.body?.action === 'savePerformanceDraft') {
      try { const draft = await savePerformanceDraft(admin.firestore(app), draftRef, req.body.draft, user.uid); return res.json({draft}); }
      catch { return res.status(409).json({error:'Progress could not be saved. Retry, or reopen this questionnaire if another tab changed it.'}); }
    }
    if (!skills?.completed) return res.status(400).json({error:'Finish your skills activities before submitting.'});
    if (req.body?.completedSections?.health !== true || req.body?.completedSections?.performance !== true || req.body?.shareHealth !== true) {
      return res.status(400).json({error:'Complete both sections and submit both to finish.'});
    }
    // Never send the tester's real account name or email to the sandbox clinic.
    const input = applyAdministrativeAnswers({...req.body,submissionId,name:`Sandbox tester ${tester.slice(0,8)}`,email:`sandbox-${tester}@example.com`}, await deriveAdministrativeAnswers(admin.firestore(app),user.uid));
    let split;
    try { split = splitSubmission(input); } catch { return res.status(400).json({error:'Please check your answers before submitting.'}); }
    const db = admin.firestore(app), attemptRef = collection.doc(`sandbox_attempt_${campaign}_${tester}`);
    const attempt = await db.runTransaction(async tx => {
      const current = await tx.get(attemptRef);
      if (current.exists) return current.data()!;
      const pending = {ownerUid:user.uid, campaign, environment:'SANDBOX',pulseCheck:split.pulseCheck};
      tx.create(attemptRef,pending); return pending;
    });
    const record = await deliverQuestionnaire(input,externalId,{apiKey,environment:'test',universityCode:'SANDBOX'}, {
      get:async()=>{const doc=await recordRef.get();return doc.exists?doc.data() as any:null;},
      create:async(_id,mirror)=> db.runTransaction(async tx=>{
        const current=await tx.get(recordRef);if(current.exists)return current.data() as any;
        const stored={...mirror,skillsBaseline:skills.result,...retainedPrivateCopy(input,true),administrativeMetadata:{...input.administrativeMetadata,firstPerformanceSaveAt:draft?.startedAt || null},fields:attempt.pulseCheck.fields,ownerUid:user.uid,campaign,environment:'SANDBOX',recordedAt:admin.firestore.FieldValue.serverTimestamp()};
        tx.create(recordRef,stored);return stored;
      }),
    });
    return res.json({saved:true,completed:true,receipt:publicReceipt(record)});
  } catch {
    // Provider errors may echo clinical answers. Never log or return those bodies.
    return res.status(503).json({error:'We could not confirm both saves. Keep your answers on this page and retry.'});
  }
}
