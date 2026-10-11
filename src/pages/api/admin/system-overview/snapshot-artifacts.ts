import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminRequest } from './share-links/_auth';
import { isSnapshotArtifactFile, loadSnapshotArtifacts } from '../../../../lib/systemOverviewSnapshotArtifacts';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!await requireAdminRequest(req)) return res.status(401).json({ error: 'Unauthorized' });
  const file = typeof req.query.file === 'string' ? req.query.file : '';
  if (file && !isSnapshotArtifactFile(file)) return res.status(404).json({ error: 'Artifact not found.' });
  const artifacts = await loadSnapshotArtifacts();
  if (!file) return res.status(200).json({ artifacts });
  const artifact = artifacts.find(item => item.name === file)!;
  return res.status(200).json({ file: artifact.name, content: artifact.content, contentType: artifact.contentType });
}
