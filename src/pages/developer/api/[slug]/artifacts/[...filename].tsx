import type { GetServerSideProps } from 'next';
export const getServerSideProps: GetServerSideProps = async ({ params, req, res }) => {
  const { isDeveloperDocSlug, developerArtifactAllowed, developerDocsAuthorized, developerDocsCookieName, loadDeveloperDocArtifact } = await import('../../../../../lib/developerDocsServer');
  const slug = params?.slug; const file = Array.isArray(params?.filename) ? params.filename.join('/') : '';
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (!isDeveloperDocSlug(slug) || !developerArtifactAllowed(slug, file)) return { notFound: true };
  if (!developerDocsAuthorized(slug, req.cookies[developerDocsCookieName(slug)])) { res.statusCode = 401; res.end('Enter the document password first.'); return { props: {} }; }
  const artifact = await loadDeveloperDocArtifact(slug, file);
  res.setHeader('Content-Type', artifact.contentType); res.setHeader('Content-Disposition', `attachment; filename="${file.split('/').at(-1)}"`);
  res.end(artifact.content); return { props: {} };
};
export default function DeveloperArtifactDownload() { return null; }
