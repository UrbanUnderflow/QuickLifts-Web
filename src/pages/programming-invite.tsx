import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '../hooks/useUser';
import { adminMethods } from '../api/firebase/admin/methods';
import Head from 'next/head';
import Link from 'next/link';

const ProgrammingInvitePage = () => {
  const router = useRouter();
  const currentUser = useUser();
  
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyHadAccess, setAlreadyHadAccess] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

  // Function to start countdown and redirect
  const startRedirectCountdown = (seconds: number) => {
    setRedirectCountdown(seconds);
    
    const interval = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          router.push('/programming');
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    const handleInvite = async () => {
      try {
        setLoading(true);
        
        // Check if user is authenticated
        if (!currentUser?.email) {
          // Redirect to sign in with return URL
          router.push(`/auth/signin?redirect=${encodeURIComponent(router.asPath)}`);
          return;
        }

        // Check if user already has access
        const existingAccess = await adminMethods.checkProgrammingAccess(currentUser.email);
        
        if (existingAccess && existingAccess.status === 'active') {
          setAlreadyHadAccess(true);
          setSuccess(true);
          console.log('✅ User already has programming access');
          // Start countdown and redirect
          startRedirectCountdown(3);
          return;
        }

        // Grant access by creating/updating programming-access record
        const result = await grantProgrammingAccess(currentUser);
        
        if (result.success) {
          setSuccess(true);
          setAlreadyHadAccess(false);
          console.log('✅ Programming access granted successfully');
          // Start countdown and redirect
          startRedirectCountdown(4);
        } else {
          setError(result.error || 'Failed to grant access');
        }
        
      } catch (err) {
        console.error('Error processing invite:', err);
        setError('An unexpected error occurred. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    // Only process invite if user is available (authenticated or redirect handled)
    if (currentUser !== undefined) {
      handleInvite();
    }
  }, [currentUser, router]);

  // Function to grant programming access using existing system
  const grantProgrammingAccess = async (user: any) => {
    try {
      const accessData = {
        email: user.email.toLowerCase(),
        username: user.username || user.displayName || user.email,
        userId: user.id,
        name: user.displayName || user.username || 'Unknown',
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        approvedAt: new Date(),
        approvedBy: 'invite-link',
        // Add some default values for invite-based access
        role: {
          trainer: false,
          enthusiast: true,
          coach: false,
          fitnessInstructor: false,
        },
        primaryUse: 'Personal fitness',
        useCases: {
          oneOnOneCoaching: false,
          communityRounds: true,
          personalPrograms: true,
        },
      };

      // Call our existing API to create the access record
      const response = await fetch('/api/admin/create-programming-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(accessData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to grant access');
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error granting programming access:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to grant access' };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <Head>
          <title>Processing Invite - Pulse Programming</title>
        </Head>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E0FE10] mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-white mb-2">Processing your invite...</h2>
          <p className="text-zinc-400">Please wait while we grant you access to Pulse Programming.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <Head>
          <title>Invite Error - Pulse Programming</title>
        </Head>
        <div className="max-w-md mx-auto text-center bg-zinc-800 p-8 rounded-lg border border-zinc-700">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Invite Error</h2>
          <p className="text-zinc-400 mb-6">{error}</p>
          <Link href="/programming" className="inline-block bg-[#E0FE10] text-black px-6 py-2 rounded-lg font-semibold hover:bg-[#E0FE10]/90 transition-colors">
            Try Programming Page
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <Head>
          <title>Welcome to Pulse Programming!</title>
        </Head>
        <div className="max-w-md mx-auto text-center bg-zinc-800 p-8 rounded-lg border border-zinc-700">
          <div className="w-16 h-16 bg-[#E0FE10]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#E0FE10]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            {alreadyHadAccess ? "Welcome Back!" : "Welcome to Pulse Programming!"}
          </h2>
          <p className="text-zinc-400 mb-6">
            {alreadyHadAccess 
              ? "You already have programming access. Redirecting to the programming application..."
              : "Your programming access has been activated! You can now create personalized workout programs. Redirecting to the application..."
            }
          </p>
          <div className="flex items-center justify-center mb-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#E0FE10]"></div>
            <span className="ml-2 text-zinc-400 text-sm">
              Redirecting{redirectCountdown ? ` in ${redirectCountdown}s` : '...'}
            </span>
          </div>
          <div className="space-y-3">
            <Link href="/programming" className="block bg-[#E0FE10] text-black px-6 py-3 rounded-lg font-semibold hover:bg-[#E0FE10]/90 transition-colors">
              Go to Programming Now
            </Link>
            <Link href="/" className="block text-zinc-400 hover:text-white transition-colors">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default ProgrammingInvitePage; 