import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { workoutService } from '../../src/api/firebase/workout/service';
import { userService } from '../../src/api/firebase/user';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../src/api/firebase/config';
import SignInModal from '../../src/components/SignInModal'; 
// ^ Adjust the import path if needed

export default function JoinChallengePage() {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Track if user is signed in
  const [isSignedIn, setIsSignedIn] = useState(false);
  // Control whether to show the sign-in modal
  const [isSignInModalVisible, setIsSignInModalVisible] = useState(false);

  const router = useRouter();

  /**
   * Monitor auth changes just like you do in HomeContent.
   * If there's a user, fetch Firestore user data & set it.
   * If not, set `isSignedIn` to false & show the SignInModal.
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const firestoreUser = await userService.fetchUserFromFirestore(user.uid);
          userService.currentUser = firestoreUser;
          console.log('User data fetched and set:', firestoreUser);
          setIsSignedIn(true);
          setIsSignInModalVisible(false);
        } catch (err) {
          console.error('Error fetching user data:', err);
          setError('Error loading user data');
        }
      } else {
        userService.currentUser = null;
        setIsSignedIn(false);
        setIsSignInModalVisible(true);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleJoinChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      await workoutService.joinChallenge({
        username,
        // Hardcoded ID for Jaidus’s challenge
        challengeId: 'cevWHBlBk7VobANRUsmC',
      });

      // If successful, redirect or show success:
      router.push('/challenge-joined');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to join challenge');
    } finally {
      setIsLoading(false);
    }
  };

  // If user is NOT signed in, show SignInModal
  if (!isSignedIn) {
    return (
      <SignInModal
        isVisible={isSignInModalVisible}
        onClose={() => setIsSignInModalVisible(false)}
        onSignInSuccess={(user) => {
          console.log('Sign-in successful:', user);
          setIsSignedIn(true);
          setIsSignInModalVisible(false);
        }}
        onSignInError={(error) => {
          console.error('Sign-in error:', error);
          alert('Sign-in failed. Please try again.');
        }}
        onSignUpSuccess={(user) => {
          console.log('Sign-up successful:', user);
          setIsSignedIn(true);
          setIsSignInModalVisible(false);
        }}
        onSignUpError={(error) => {
          console.error('Sign-up error:', error);
          alert('Sign-up failed. Please try again.');
        }}
        onQuizComplete={() => {
          console.log('Quiz completed successfully');
        }}
        onQuizSkipped={() => {
          console.log('Quiz skipped');
        }}
      />
    );
  }

  // Otherwise, let them join the challenge
  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Title Section */}
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-white font-['Thunder'] mb-4">
            Join Jaidus's Challenge
          </h1>
          <p className="text-zinc-400 text-lg">30 Days of Shared Progress</p>
        </div>

        {/* Form */}
        <form onSubmit={handleJoinChallenge} className="mt-8 space-y-6">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-zinc-300 mb-2 font-['HK Grotesk']"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white
                placeholder-zinc-400 focus:outline-none focus:border-[#E0FE10] focus:ring-1
                focus:ring-[#E0FE10] transition-colors"
              placeholder="Enter your username"
            />
            {error && <p className="mt-2 text-red-400 text-sm">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full bg-[#E0FE10] text-black font-semibold py-4 px-4 rounded-lg
              hover:bg-[#c8e60e] transition-colors font-['HK Grotesk'] flex items-center justify-center
              ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Join Challenge'
            )}
          </button>
        </form>

        {/* Back Link */}
        <div className="text-center mt-4">
          <button
            onClick={() => router.back()}
            className="text-zinc-400 hover:text-[#E0FE10] transition-colors text-sm"
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}

