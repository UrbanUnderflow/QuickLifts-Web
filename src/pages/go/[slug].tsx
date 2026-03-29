import React, { useEffect, useState } from 'react';
import { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import Head from 'next/head';
import { resolveShortLinkDestination } from '../../lib/shortLinks';

type ShortLinkFallbackPageProps = {
  slug: string | null;
};

const ShortLinkFallbackPage = ({
  slug,
}: InferGetServerSidePropsType<typeof getServerSideProps>) => {
  const [status, setStatus] = useState<'redirecting' | 'missing'>('redirecting');

  useEffect(() => {
    if (!slug) {
      setStatus('missing');
      return;
    }

    const loadShortLink = async () => {
      try {
        const [{ doc, getDoc }, { db }] = await Promise.all([
          import('firebase/firestore'),
          import('../../api/firebase/config'),
        ]);
        const docSnap = await getDoc(doc(db, 'shortLinks', slug));

        if (!docSnap.exists()) {
          setStatus('missing');
          return;
        }

        const data = docSnap.data() as {
          destinationUrl?: string;
          isActive?: boolean;
        } | undefined;

        if (!data?.destinationUrl || data.isActive === false) {
          setStatus('missing');
          return;
        }

        const destination = resolveShortLinkDestination(
          data.destinationUrl,
          window.location.origin
        );

        window.location.replace(destination);
      } catch (error) {
        console.error('[short-links] client redirect fallback failed', error);
        setStatus('missing');
      }
    };

    void loadShortLink();
  }, [slug]);

  return (
    <>
      <Head>
        <title>{status === 'redirecting' ? 'Redirecting...' : 'Short Link Not Found'}</title>
      </Head>
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#000', color: '#fff', padding: '24px' }}>
        <div style={{ textAlign: 'center', maxWidth: '560px' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, marginBottom: '12px' }}>
            {status === 'redirecting' ? 'Redirecting...' : 'Short Link Not Found'}
          </div>
          <div style={{ color: '#a1a1aa', lineHeight: 1.6 }}>
            {status === 'redirecting'
              ? 'We are opening your destination now.'
              : 'This short link is missing, inactive, or could not be resolved in the current environment.'}
          </div>
        </div>
      </div>
    </>
  );
};

export const getServerSideProps: GetServerSideProps<ShortLinkFallbackPageProps> = async ({ params, req }) => {
  const slugParam = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const slug = String(slugParam || '').toLowerCase().trim();

  if (!slug) {
    return {
      props: {
        slug: null,
      },
    };
  }

  try {
    const admin = (await import('../../lib/firebase-admin')).default;
    const docRef = admin.firestore().collection('shortLinks').doc(slug);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return {
        props: {
          slug,
        },
      };
    }

    const data = docSnap.data() as {
      destinationUrl?: string;
      isActive?: boolean;
    } | undefined;

    if (!data?.destinationUrl || data.isActive === false) {
      return {
        props: {
          slug,
        },
      };
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
    return {
      props: {
        slug,
      },
    };
  }
};

export default ShortLinkFallbackPage;
