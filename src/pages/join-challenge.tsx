import React, { useState } from 'react';
import { useRouter } from 'next/router';

export default function JoinChallengePage() {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleJoinChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      const response = await fetch('https://fitwithpulse.ai/.netlify/functions/join-challenge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          challengeId: 'jaidus-challenge-id' // Replace with actual challenge ID
        })
      });

      if (!response.ok) {
        throw new Error('Failed to join challenge');
      }

      const data = await response.json();
      if (data.success) {
        // Redirect to success page or show success message
        router.push('/challenge-joined');
      } else {
        throw new Error(data.error || 'Failed to join challenge');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join challenge');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Title Section */}
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-white font-['Thunder'] mb-4">
            Join Jaidus's Challenge
          </h1>
          <p className="text-zinc-400 text-lg">
            30 Days of Shared Progress
          </p>
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
            {error && (
              <p className="mt-2 text-red-400 text-sm">{error}</p>
            )}
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