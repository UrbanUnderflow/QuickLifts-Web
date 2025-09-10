import React, { useState } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { workoutService } from '../../api/firebase/workout/service';
import { userService } from '../../api/firebase/user/service';
import { UserChallenge } from '../../api/firebase/workout/types';
import { User } from '../../api/firebase/user/types';
import { Search, Bug, CheckCircle, AlertCircle, Loader, RefreshCw } from 'lucide-react';
import { convertFirestoreTimestamp } from '../../utils/formatDate';

const DebugUserChallenge: React.FC = () => {
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Search for user
  const searchUser = async () => {
    if (!userSearchTerm.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const allUsers = await userService.getAllUsers();
      const user = allUsers.find(u => 
        u.username?.toLowerCase() === userSearchTerm.toLowerCase() ||
        u.email?.toLowerCase() === userSearchTerm.toLowerCase()
      );

      if (user) {
        setSelectedUser(user);
        await debugUserChallenges(user.id);
      } else {
        setError('User not found');
        setSelectedUser(null);
        setUserChallenges([]);
        setDebugInfo(null);
      }
    } catch (err) {
      setError('Error searching for user');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Debug user challenges
  const debugUserChallenges = async (userId: string) => {
    try {
      // Fetch user challenges using the same method as the dashboard
      const challenges = await workoutService.fetchUserChallengesByUserId(userId);
      setUserChallenges(challenges);

      // Create debug information
      const debug = {
        totalChallenges: challenges.length,
        challengesWithChallenge: challenges.filter(uc => uc.challenge).length,
        challengesWithoutChallenge: challenges.filter(uc => !uc.challenge).length,
        activeByFilter: challenges.filter(uc => {
          if (!uc.challenge || uc.isCompleted) return false;
          
          // Handle different date formats
          let convertedEndDate = null;
          if (typeof uc.challenge.endDate === 'string') {
            convertedEndDate = new Date(uc.challenge.endDate);
          } else if (typeof uc.challenge.endDate === 'number') {
            convertedEndDate = convertFirestoreTimestamp(uc.challenge.endDate);
          } else if (uc.challenge.endDate instanceof Date) {
            convertedEndDate = uc.challenge.endDate;
          } else {
            convertedEndDate = convertFirestoreTimestamp(uc.challenge.endDate);
          }
          
          return convertedEndDate && convertedEndDate > new Date();
        }).length,
        completedChallenges: challenges.filter(uc => uc.isCompleted).length,
        expiredChallenges: challenges.filter(uc => {
          if (!uc.challenge) return false;
          
          // Handle different date formats
          let convertedEndDate = null;
          if (typeof uc.challenge.endDate === 'string') {
            convertedEndDate = new Date(uc.challenge.endDate);
          } else if (typeof uc.challenge.endDate === 'number') {
            convertedEndDate = convertFirestoreTimestamp(uc.challenge.endDate);
          } else if (uc.challenge.endDate instanceof Date) {
            convertedEndDate = uc.challenge.endDate;
          } else {
            convertedEndDate = convertFirestoreTimestamp(uc.challenge.endDate);
          }
          
          return convertedEndDate && convertedEndDate <= new Date();
        }).length,
        challengeDetails: challenges.map(uc => {
          // Handle different date formats - could be Unix timestamp, ISO string, or Date object
          let convertedEndDate = null;
          if (uc.challenge?.endDate) {
            if (typeof uc.challenge.endDate === 'string') {
              // If it's a string, it's likely an ISO string
              convertedEndDate = new Date(uc.challenge.endDate);
            } else if (typeof uc.challenge.endDate === 'number') {
              // If it's a number, use our conversion function
              convertedEndDate = convertFirestoreTimestamp(uc.challenge.endDate);
            } else if (uc.challenge.endDate instanceof Date) {
              // If it's already a Date object
              convertedEndDate = uc.challenge.endDate;
            } else {
              // Fallback to our conversion function
              convertedEndDate = convertFirestoreTimestamp(uc.challenge.endDate);
            }
          }
          
          return {
            id: uc.id,
            challengeId: uc.challengeId,
            hasChallenge: !!uc.challenge,
            challengeTitle: uc.challenge?.title || 'NO CHALLENGE OBJECT',
            endDate: convertedEndDate ? convertedEndDate.toISOString() : 'NO END DATE',
            endDateRaw: uc.challenge?.endDate || 'NO RAW DATE', // Show raw value for debugging
            endDateType: uc.challenge?.endDate ? typeof uc.challenge.endDate : 'undefined',
            isEndDateFuture: convertedEndDate ? convertedEndDate > new Date() : false,
            isCompleted: uc.isCompleted,
            joinDate: convertFirestoreTimestamp(uc.joinDate).toISOString(),
            createdAt: convertFirestoreTimestamp(uc.createdAt).toISOString(),
            updatedAt: convertFirestoreTimestamp(uc.updatedAt).toISOString(),
            passesFilter: uc.challenge && convertedEndDate && convertedEndDate > new Date() && !uc.isCompleted
          };
        })
      };

      setDebugInfo(debug);
    } catch (err) {
      setError('Error fetching user challenges');
      console.error(err);
    }
  };

  // Refresh user challenges
  const refreshChallenges = () => {
    if (selectedUser) {
      debugUserChallenges(selectedUser.id);
    }
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Debug User Challenge - Pulse Admin</title>
      </Head>

      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center mb-8">
            <Bug className="text-[#d7ff00] mr-3 w-7 h-7" />
            <h1 className="text-2xl font-bold">Debug User Challenge Issues</h1>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-600/30 rounded-lg flex items-center">
              <AlertCircle className="w-5 h-5 text-red-400 mr-3" />
              <span className="text-red-400">{error}</span>
            </div>
          )}

          {/* User Search */}
          <div className="bg-[#1a1d23] rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Search User</h2>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Enter username or email..."
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchUser()}
                className="flex-1 px-4 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#d7ff00]"
              />
              <button
                onClick={searchUser}
                disabled={loading || !userSearchTerm.trim()}
                className="px-6 py-2 bg-[#d7ff00] text-black font-medium rounded-lg hover:bg-[#c8e60e] disabled:bg-gray-600 disabled:text-gray-400"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Selected User Info */}
          {selectedUser && (
            <div className="bg-[#1a1d23] rounded-lg p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">User Information</h2>
                <button
                  onClick={refreshChallenges}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-gray-400">Username</p>
                  <p className="font-medium">{selectedUser.username}</p>
                </div>
                <div>
                  <p className="text-gray-400">Email</p>
                  <p className="font-medium">{selectedUser.email}</p>
                </div>
                <div>
                  <p className="text-gray-400">User ID</p>
                  <p className="font-medium text-xs">{selectedUser.id}</p>
                </div>
              </div>
            </div>
          )}

          {/* Debug Summary */}
          {debugInfo && (
            <div className="bg-[#1a1d23] rounded-lg p-6 mb-8">
              <h2 className="text-lg font-semibold mb-4">Debug Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-[#262a30] p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-[#d7ff00]">{debugInfo.totalChallenges}</p>
                  <p className="text-sm text-gray-400">Total Challenges</p>
                </div>
                <div className="bg-[#262a30] p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-400">{debugInfo.activeByFilter}</p>
                  <p className="text-sm text-gray-400">Should Show Active</p>
                </div>
                <div className="bg-[#262a30] p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-400">{debugInfo.challengesWithChallenge}</p>
                  <p className="text-sm text-gray-400">With Challenge Object</p>
                </div>
                <div className="bg-[#262a30] p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-400">{debugInfo.challengesWithoutChallenge}</p>
                  <p className="text-sm text-gray-400">Missing Challenge Object</p>
                </div>
              </div>

              {/* Filter Analysis */}
              <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4">
                <h3 className="font-medium text-yellow-400 mb-2">Dashboard Filter Analysis:</h3>
                <p className="text-sm text-yellow-300">
                  The dashboard shows active rounds using: <code>round.challenge && new Date(round.challenge.endDate) > new Date() && !round.isCompleted</code>
                </p>
                <p className="text-sm text-yellow-300 mt-2">
                  <strong>Expected Active Rounds:</strong> {debugInfo.activeByFilter} 
                  {debugInfo.activeByFilter === 0 && debugInfo.totalChallenges > 0 && (
                    <span className="text-red-400"> ← This is why "No Active Rounds" is showing!</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Detailed Challenge List */}
          {debugInfo && debugInfo.challengeDetails.length > 0 && (
            <div className="bg-[#1a1d23] rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Challenge Details</h2>
              <div className="space-y-4">
                {debugInfo.challengeDetails.map((challenge: any, index: number) => (
                  <div 
                    key={challenge.id} 
                    className={`p-4 rounded-lg border ${
                      challenge.passesFilter 
                        ? 'bg-green-900/20 border-green-600/30' 
                        : 'bg-red-900/20 border-red-600/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">
                        {challenge.challengeTitle}
                        {challenge.passesFilter ? (
                          <CheckCircle className="inline w-4 h-4 text-green-400 ml-2" />
                        ) : (
                          <AlertCircle className="inline w-4 h-4 text-red-400 ml-2" />
                        )}
                      </h3>
                      <span className={`text-xs px-2 py-1 rounded ${
                        challenge.passesFilter ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                      }`}>
                        {challenge.passesFilter ? 'SHOULD SHOW' : 'FILTERED OUT'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Challenge ID</p>
                        <p className="font-mono text-xs">{challenge.challengeId}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Has Challenge Object</p>
                        <p className={challenge.hasChallenge ? 'text-green-400' : 'text-red-400'}>
                          {challenge.hasChallenge ? 'YES' : 'NO'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">End Date</p>
                        <p className={challenge.isEndDateFuture ? 'text-green-400' : 'text-red-400'}>
                          {challenge.endDate !== 'NO END DATE' 
                            ? new Date(challenge.endDate).toLocaleDateString()
                            : 'NO END DATE'
                          }
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Is Completed</p>
                        <p className={challenge.isCompleted ? 'text-red-400' : 'text-green-400'}>
                          {challenge.isCompleted ? 'YES' : 'NO'}
                        </p>
                      </div>
                    </div>

                    {/* Debug Info - Raw Date Values */}
                    <div className="mt-4 p-3 bg-gray-800/50 rounded border border-gray-600">
                      <p className="text-gray-400 text-xs font-medium mb-2">🔧 Debug: Raw Date Values</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-gray-400">Raw End Date:</span>
                          <p className="text-gray-300 font-mono break-all">{JSON.stringify(challenge.endDateRaw)}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Date Type:</span>
                          <p className="text-gray-300 font-mono">{challenge.endDateType}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Is Future:</span>
                          <p className={`font-mono ${challenge.isEndDateFuture ? 'text-green-400' : 'text-red-400'}`}>
                            {challenge.isEndDateFuture.toString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Failure Reasons */}
                    {!challenge.passesFilter && (
                      <div className="mt-3 p-3 bg-red-900/30 rounded border border-red-600/50">
                        <p className="text-red-300 text-sm font-medium">Why this is filtered out:</p>
                        <ul className="text-red-300 text-sm mt-1 space-y-1">
                          {!challenge.hasChallenge && <li>• Missing challenge object</li>}
                          {challenge.hasChallenge && !challenge.isEndDateFuture && <li>• Challenge has ended</li>}
                          {challenge.hasChallenge && challenge.isCompleted && <li>• Challenge is marked as completed</li>}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default DebugUserChallenge;
