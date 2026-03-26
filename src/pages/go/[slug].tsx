import { GetServerSideProps } from 'next';
import Head from 'next/head';
import admin from '../../lib/firebase-admin';
import { resolveShortLinkDestination } from '../../lib/shortLinks';

const ShortLinkFallbackPage = () => (
  <>
    <Head>
      <title>Redirecting...</title>
    </Head>
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#000', color: '#fff' }}>
      Redirecting...
    </div>
  </>
);

export const getServerSideProps: GetServerSideProps = async ({ params, req, res }) => {
  const slugParam = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const slug = String(slugParam || '').toLowerCase().trim();

  if (!slug) {
    return { notFound: true };
  }

  try {
    const docRef = admin.firestore().collection('shortLinks').doc(slug);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { notFound: true };
    }

    const data = docSnap.data() as {
      destinationUrl?: string;
      isActive?: boolean;
    } | undefined;

    if (!data?.destinationUrl || data.isActive === false) {
      return { notFound: true };
    }

    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : forwardedProto || (req.headers.host?.includes('localhost') ? 'http' : 'https');
    const requestOrigin = `${protocol}://${req.headers.host}`;
    const destination = resolveShortLinkDestination(data.destinationUrl, requestOrigin);

    await docRef.set(
      {
        clickCount: admin.firestore.FieldValue.increment(1),
        lastClickedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      redirect: {
        destination,
        permanent: false,
      },
    };
  } catch (error) {
    console.error('[short-links] redirect failed', error);
    return { notFound: true };
  }
};

export default ShortLinkFallbackPage;
