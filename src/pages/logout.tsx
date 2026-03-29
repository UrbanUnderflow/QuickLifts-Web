import { useEffect, useMemo, useState } from 'react';
import type { GetServerSideProps } from 'next';

type LogoutPageProps = {
  redirectUrl: string;
};

export const getServerSideProps: GetServerSideProps<LogoutPageProps> = async (context) => {
  const redirect = typeof context.query.redirect === 'string' ? context.query.redirect : '';
  const redirectUrl = redirect
    ? `/login?redirect=${encodeURIComponent(redirect)}&switchAccount=true`
    : '/login';

  return {
    props: {
      redirectUrl,
    },
  };
};

export default function LogoutPage({ redirectUrl }: LogoutPageProps) {
  const [message, setMessage] = useState('Please wait while we sign you out and redirect you.');

  const destination = useMemo(() => redirectUrl || '/login', [redirectUrl]);

  useEffect(() => {
    let isCancelled = false;

    const signOutWithSharedConfig = async () => {
      try {
        const [{ auth }, authModule] = await Promise.all([
          import('../api/firebase/config'),
          import('firebase/auth'),
        ]);

        await authModule.signOut(auth);
      } catch (error) {
        console.error('Error signing out:', error);
        if (!isCancelled) {
          setMessage('We hit a small issue signing you out, but we are redirecting you now.');
        }
      } finally {
        if (!isCancelled) {
          window.location.replace(destination);
        }
      }
    };

    signOutWithSharedConfig();

    return () => {
      isCancelled = true;
    };
  }, [destination]);

  return (
    <div
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        margin: 0,
        padding: 20,
        background: '#0a0a0a',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <h1>Signing Out...</h1>
        <div
          style={{
            border: '2px solid #333',
            borderTop: '2px solid #E0FE10',
            borderRadius: '50%',
            width: 40,
            height: 40,
            animation: 'spin 1s linear infinite',
            margin: '20px auto',
          }}
        />
        <p>{message}</p>
        <style jsx>{`
          @keyframes spin {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    </div>
  );
}
