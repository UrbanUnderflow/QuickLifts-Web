import React, { useState, useEffect } from 'react';
import { workoutService } from '../../api/firebase/workout/service';
import { Challenge, SweatlistCollection, UserChallenge } from '../../api/firebase/workout/types';

// Instead of importing, we'll use a safer approach with string comparison
// and proper type handling

interface ChallengeUpdate {
  id: string;
  currentStatus: string;
  newStatus: string;
  startDate: string;
  endDate: string;
}

interface CollectionResult {
  updatesApplied: number;
  proposedUpdates: ChallengeUpdate[];
}

interface UpdateResult {
  success: boolean;
  message: string;
  results: {
    sweatlistCollection: CollectionResult;
    userChallengeCollection: CollectionResult;
    timestamp: number;
    testMode: boolean;
  };
}

const ChallengeStatusPage: React.FC = () => {
  const [sweatlistChallenges, setSweatlistChallenges] = useState<SweatlistCollection[]>([]);
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateResult | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChallenges = async () => {
      try {
        setLoading(true);
        
        // Fetch all available collections (which include challenges)
        // Note: This assumes you're logged in as an admin user with access
        const userId = workoutService.currentWorkout?.author || '';
        
        if (userId) {
          const collections = await workoutService.fetchCollections(userId);
          setSweatlistChallenges(collections.filter(c => c.challenge));
          
          // Fetch all user challenges - you might need to adapt this based on your requirements
          const allUserChallenges = await workoutService.fetchUserChallenges();
          setUserChallenges(allUserChallenges);
        }
      } catch (error) {
        console.error('Error fetching challenges:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChallenges();
  }, []);

  const formatDate = (date: Date | number | undefined): string => {
    if (!date) return 'N/A';
    
    const dateObj = typeof date === 'number' 
      ? new Date(date * 1000)  // Convert from Unix timestamp (seconds)
      : new Date(date);
      
    return dateObj.toLocaleString();
  };

  const runChallengeStatusUpdate = async (testMode: boolean = false) => {
    setUpdateLoading(true);
    setUpdateError(null);
    setUpdateResult(null);

    try {
      // Use the dedicated manual trigger function instead of the scheduled one
      const result = await fetch('/.netlify/functions/trigger-challenge-status-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ testMode }),
      });

      // Check content type to determine if it's JSON
      const contentType = result.headers.get('content-type');
      
      if (!result.ok) {
        // Get the error content regardless of type
        const errorContent = await result.text();
        throw new Error(`Server error (${result.status}): ${errorContent}`);
      }
      
      // If it's not JSON, handle the text response
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await result.text();
        setUpdateError(`The server returned a non-JSON response: ${textResponse}`);
        return;
      }
      
      // Parse the JSON response
      const data: UpdateResult = await result.json();
      setUpdateResult(data);
      
      // Refresh the challenges after a successful update
      if (!testMode) {
        const userId = workoutService.currentWorkout?.author || '';
        if (userId) {
          const collections = await workoutService.fetchCollections(userId);
          setSweatlistChallenges(collections.filter(c => c.challenge));
          
          const allUserChallenges = await workoutService.fetchUserChallenges();
          setUserChallenges(allUserChallenges);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setUpdateError(errorMessage);
      console.error('Error running challenge status update:', err);
    } finally {
      setUpdateLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-white">Challenge Status Management</h1>
        
        {/* Action Buttons */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => runChallengeStatusUpdate(true)}
            disabled={updateLoading}
            className={`px-6 py-2 rounded-lg font-bold ${
              updateLoading 
                ? 'bg-gray-500 cursor-not-allowed' 
                : 'bg-yellow-500 text-black hover:bg-yellow-400'
            }`}
          >
            {updateLoading && updateResult?.results.testMode ? 'Testing...' : 'Test Run (No Updates)'}
          </button>

          <button
            onClick={() => runChallengeStatusUpdate(false)}
            disabled={updateLoading}
            className={`px-6 py-2 rounded-lg font-bold ${
              updateLoading 
                ? 'bg-gray-500 cursor-not-allowed' 
                : 'bg-[#E0FE10] text-black hover:bg-[#d4f00f]'
            }`}
          >
            {updateLoading && !updateResult?.results.testMode ? 'Updating...' : 'Run Status Update Job'}
          </button>
        </div>
        
        {/* Update Result */}
        {updateError && (
          <div className="p-4 bg-red-900 text-white rounded-lg mb-8">
            <h2 className="text-lg font-bold mb-2">Error:</h2>
            <pre className="whitespace-pre-wrap break-words">{updateError}</pre>
          </div>
        )}

        {updateResult && (
          <div className="p-4 bg-green-900 text-white rounded-lg mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Update Results</h2>
              {updateResult.results.testMode && (
                <span className="px-2 py-1 bg-yellow-500 text-black text-sm font-bold rounded">
                  Test Mode
                </span>
              )}
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-zinc-300">
                Timestamp: {formatDate(updateResult.results.timestamp)}
              </p>
              <p className="text-sm text-zinc-300">
                Sweatlist Updates: {updateResult.results.sweatlistCollection.updatesApplied}
              </p>
              <p className="text-sm text-zinc-300">
                User Challenge Updates: {updateResult.results.userChallengeCollection.updatesApplied}
              </p>
            </div>
          </div>
        )}
        
        {/* Sweatlist Challenge Tables */}
        <div className="mb-10">
          <h2 className="text-xl font-bold mb-4 text-white">Sweatlist Challenges</h2>
          {loading ? (
            <p className="text-gray-400">Loading challenges...</p>
          ) : sweatlistChallenges.length === 0 ? (
            <p className="text-gray-400">No sweatlist challenges found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-zinc-800 rounded-lg overflow-hidden">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Start Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      End Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Participants
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700">
                  {sweatlistChallenges.map((collection) => (
                    <tr key={collection.id} className="hover:bg-zinc-700">
                      <td className="px-4 py-3 text-sm text-gray-200">
                        {collection.id.substring(0, 8)}...
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-200">
                        {collection.challenge?.title || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          String(collection.challenge?.status) === 'active' ? 'bg-green-700 text-green-100' :
                          String(collection.challenge?.status) === 'completed' ? 'bg-blue-700 text-blue-100' :
                          String(collection.challenge?.status) === 'published' ? 'bg-yellow-700 text-yellow-100' :
                          'bg-gray-700 text-gray-100'
                        }`}>
                          {collection.challenge?.status || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-200">
                        {formatDate(collection.challenge?.startDate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-200">
                        {formatDate(collection.challenge?.endDate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-200">
                        {collection.challenge?.participants?.length || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {/* User Challenge Tables */}
        <div>
          <h2 className="text-xl font-bold mb-4 text-white">User Challenges</h2>
          {loading ? (
            <p className="text-gray-400">Loading user challenges...</p>
          ) : userChallenges.length === 0 ? (
            <p className="text-gray-400">No user challenges found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-zinc-800 rounded-lg overflow-hidden">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Challenge
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Start Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      End Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700">
                  {userChallenges.map((userChallenge) => (
                    <tr key={userChallenge.id} className="hover:bg-zinc-700">
                      <td className="px-4 py-3 text-sm text-gray-200">
                        {userChallenge.id.substring(0, 8)}...
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-200">
                        {userChallenge.username || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-200">
                        {userChallenge.challenge?.title || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          String(userChallenge.challenge?.status) === 'active' ? 'bg-green-700 text-green-100' :
                          String(userChallenge.challenge?.status) === 'completed' ? 'bg-blue-700 text-blue-100' :
                          String(userChallenge.challenge?.status) === 'published' ? 'bg-yellow-700 text-yellow-100' :
                          'bg-gray-700 text-gray-100'
                        }`}>
                          {userChallenge.challenge?.status || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-200">
                        {formatDate(userChallenge.challenge?.startDate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-200">
                        {formatDate(userChallenge.challenge?.endDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChallengeStatusPage; 