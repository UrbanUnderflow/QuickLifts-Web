import { defaultInstitutionPolicy, validateInstitutionPolicy, type InstitutionOnboardingPolicy } from './policy';
export const policyRoot = (db: FirebaseFirestore.Firestore) => db.collection('pulsecheck-restricted-questionnaire-submissions').doc('institution-onboarding-v1');
export function validOrganizationId(id: unknown): id is string { return typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id); }
export async function readActiveInstitutionPolicy(db: FirebaseFirestore.Firestore, organizationId: string, transaction?: FirebaseFirestore.Transaction): Promise<InstitutionOnboardingPolicy> {
  // Activation requires a separate reviewed release. Drafts never enforce access.
  if (process.env.INSTITUTION_ONBOARDING_ENFORCEMENT_ENABLED !== 'true') return defaultInstitutionPolicy;
  if (!validOrganizationId(organizationId)) throw Error('Invalid institution.');
  const ref=policyRoot(db).collection('active').doc(organizationId);
  const snapshot=transaction ? await transaction.get(ref) : await ref.get();
  return snapshot.exists ? validateInstitutionPolicy(snapshot.data()?.policy) : defaultInstitutionPolicy;
}
