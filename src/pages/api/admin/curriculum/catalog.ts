import type { NextApiRequest, NextApiResponse } from 'next';
import { buildLinearCurriculumCatalog, type LinearCatalogRecords } from '../../../../api/firebase/dailyCurriculum/linearCurriculum';
import { CurriculumApiError, requireCurriculumAdmin, type CurriculumAdminIdentity } from './_auth';

const COLLECTIONS = ['pulsecheck-protocols', 'sim-modules', 'mental-exercises', 'sim-variants', 'pulsecheck-protocol-variants'];
// The sequence editor needs catalog metadata only. No athlete collections,
// practice records, journals, or embedded content are read by this endpoint.
const FIELDS = ['isActive', 'publishStatus', 'label', 'name', 'variantName', 'legacyExerciseId', 'publishedModuleId'];

export const createCurriculumCatalogHandler = (dependencies: {
  authorize?: (req: NextApiRequest) => Promise<CurriculumAdminIdentity>;
} = {}) => async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  try {
    const identity = await (dependencies.authorize || requireCurriculumAdmin)(req);
    const snapshots = await Promise.all(COLLECTIONS.map(name => identity.db.collection(name).select(...FIELDS).get()));
    const records: LinearCatalogRecords = {};
    snapshots.forEach((snapshot, index) => {
      records[COLLECTIONS[index]] = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    });
    return res.status(200).json({
      catalog: { ...buildLinearCurriculumCatalog(records), sourceLabel: 'Current library checked. Drafts stay in this browser.' },
      identity: { uid: identity.uid, email: identity.email, ...(identity.displayName ? { displayName: identity.displayName } : {}), projectId: identity.projectId },
      canEdit: true,
    });
  } catch (error) {
    if (error instanceof CurriculumApiError) return res.status(error.statusCode).json({ error: error.code, message: error.message });
    return res.status(503).json({ error: 'catalog_unavailable', message: 'The curriculum catalog could not be loaded. Try again.' });
  }
};

export default createCurriculumCatalogHandler();
