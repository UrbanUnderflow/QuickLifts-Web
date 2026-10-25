import type { NextApiRequest, NextApiResponse } from 'next';
import { requireCurriculumAdmin } from '../curriculum/_auth';
import { defaultInstitutionPolicy, validateInstitutionPolicy } from '../../../../lib/institutionOnboarding/policy';
import { policyRoot, validOrganizationId } from '../../../../lib/institutionOnboarding/server';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control','private, no-store');
  if (!['GET','POST'].includes(req.method || '')) return res.status(405).end();
  try {
    // Existing same-project, revoked-token, verified-email admin allowlist guard.
    const {db,uid}=await requireCurriculumAdmin(req);
    const organizationId=req.method==='GET'?req.query.organizationId:req.body?.organizationId;
    if (!validOrganizationId(organizationId)) return res.status(400).json({error:'Choose an institution.'});
    const org=await db.collection('pulsecheck-organizations').doc(organizationId).get();
    if (!org.exists || ['deleted','purged','archived'].includes(org.data()?.status)) return res.status(404).json({error:'Institution unavailable.'});
    const ref=policyRoot(db).collection('drafts').doc(organizationId);
    if (req.method==='GET') { const draft=await ref.get();return res.json({policy:draft.exists?validateInstitutionPolicy(draft.data()?.policy):defaultInstitutionPolicy,status:'draft',writesEnabled:process.env.INSTITUTION_ONBOARDING_DRAFT_WRITES_ENABLED==='true'}); }
    if (process.env.INSTITUTION_ONBOARDING_DRAFT_WRITES_ENABLED!=='true') return res.status(503).json({error:'Policy draft saving is disabled for this release.'});
    const policy=validateInstitutionPolicy(req.body?.policy);
    await ref.set({policy,updatedBy:uid,updatedAtMs:Date.now()});
    return res.json({policy,status:'draft'});
  } catch(error) { return res.status((error as any)?.statusCode || 400).json({error:error instanceof Error?error.message:'Unable to load onboarding policy.'}); }
}
