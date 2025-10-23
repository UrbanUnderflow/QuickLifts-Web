// remote-login.tsx
// Page to handle remote login authentication for admin impersonation

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../api/firebase/config';
import Head from 'next/head';

const RemoteLogin: React.FC = () => {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Authenticating...');
  const [userInfo, setUserInfo] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    const handleRemoteLogin = async () => {
      try {
        const { token, userId, email } = router.query;

        if (!token || !userId || !email) {
          throw new Error('Missing required parameters');
        }

        setUserInfo({ id: userId as string, email: email as string });

        // Sign in with the custom token
        const userCredential = await signInWithCustomToken(auth, token as string);
        const user = userCredential.user;

        console.log('[RemoteLogin] Successfully authenticated as:', {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName
        });

        setStatus('success');
        setMessage(`Successfully logged in as ${email}`);

        // Redirect to web app after a short delay
        setTimeout(() => {
          router.push('/');
        }, 2000);

      } catch (error) {
        console.error('[RemoteLogin] Authentication failed:', error);
        setStatus('error');
        setMessage(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    if (router.isReady) {
      handleRemoteLogin();
    }
  }, [router]);

  return (
    <>
      <Head>
        <title>Remote Login - Pulse</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="mb-6">
              {status === 'loading' && (
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
              )}
              {status === 'success' && (
                <div className="rounded-full h-12 w-12 bg-green-500 flex items-center justify-center mx-auto">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              {status === 'error' && (
                <div className="rounded-full h-12 w-12 bg-red-500 flex items-center justify-center mx-auto">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
            </div>

            <h1 className="text-2xl font-bold text-white mb-4">
              {status === 'loading' && 'Remote Login'}
              {status === 'success' && 'Login Successful'}
              {status === 'error' && 'Login Failed'}
            </h1>

            <p className="text-gray-300 mb-6">{message}</p>

            {userInfo && (
              <div className="bg-gray-700 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Impersonating:</h3>
                <p className="text-white font-mono text-sm">{userInfo.email}</p>
                <p className="text-gray-400 text-xs mt-1">ID: {userInfo.id}</p>
              </div>
            )}

            {status === 'success' && (
              <p className="text-sm text-gray-400">
                Redirecting to web app...
              </p>
            )}

            {status === 'error' && (
              <div className="space-y-4">
                <button
                  onClick={() => window.close()}
                  className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Close Tab
                </button>
                <button
                  onClick={() => router.push('/admin/users')}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Back to Admin Panel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default RemoteLogin;
