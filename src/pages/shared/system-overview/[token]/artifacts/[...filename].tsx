import type { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async ({ params, req, res }) => {
  const { authorizeSnapshotArtifact, isValidShareToken, isSnapshotArtifactFile } = await import('../../../../../lib/systemOverviewSnapshotArtifacts');
  const { getSystemOverviewShareCookieName } = await import('../../../../../lib/systemOverviewShareAccess');
  const token = typeof params?.token === 'string' ? params.token : '';
  const file = Array.isArray(params?.filename) ? params.filename.join('/') : '';
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (!isValidShareToken(token) || !isSnapshotArtifactFile(file)) return { notFound: true };
  const admin = (await import('../../../../../lib/firebase-admin')).default;
  const share = await admin.firestore().collection('systemOverviewShareLinks').doc(token).get();
  const result = authorizeSnapshotArtifact(share.exists ? share.data() : undefined, token, file, req.cookies[getSystemOverviewShareCookieName(token)]);
  if (result.status === 404) return { notFound: true };
  res.statusCode = result.status;
  if (!result.artifact) { res.end('Unlock this shared document with its passcode first.'); return { props: {} }; }
  res.setHeader('Content-Type', result.artifact.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.split('/').at(-1)}"`);
  res.end(result.artifact.content);
  return { props: {} };
};
export default function SharedSnapshotArtifact() { return null; }
