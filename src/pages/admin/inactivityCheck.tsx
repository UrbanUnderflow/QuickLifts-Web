import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import debounce from 'lodash.debounce';
import { UserChallenge } from '../../api/firebase/workout/types';
import { workoutService } from '../../api/firebase/workout/service';
import { Workout } from '../../api/firebase/workout/types'; // Added Workout type

// CSS for toast animation
const toastAnimation = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .animate-fade-in-up {
    animation: fadeInUp 0.3s ease-out forwards;
  }
`;

interface InactivityCheckResult {
  success: boolean;
  message: string;
  results: {
    userChallengesProcessed: number;
    inactiveUsersFound: number;
    notificationsTriggered: number;
    timestamp: number;
    testMode: boolean;
    simulationMode?: boolean;
    simulatedUpdates?: {
      userId: string;
      username: string;
      challengeId: string;
      challengeTitle?: string;
      lastActive?: Date | null;
      isCurrentlyActive?: boolean;
      id?: string;
    }[];
  };
}

const InactivityCheckPage: React.FC = () => {
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([]);
  const [filteredChallenges, setFilteredChallenges] = useState<UserChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateResult, setUpdateResult] = useState<InactivityCheckResult | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [copiedId, setCopiedId] = useState<string>('');
  const [selectedRecord, setSelectedRecord] = useState<{
    userId: string;
    username: string;
    challengeId: string;
    challengeTitle?: string;
    lastActive?: Date | null;
    id?: string;
  } | null>(null);
  const [inactivatingId, setInactivatingId] = useState<string | null>(null);
  const [inactivateResult, setInactivateResult] = useState<{success: boolean, message: string} | null>(null);
  const [selectedUserChallenge, setSelectedUserChallenge] = useState<UserChallenge | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteResult, setDeleteResult] = useState<{ success: boolean; message: string } | null>(null);

  // State for workout detail modal
  const [isWorkoutDetailModalOpen, setIsWorkoutDetailModalOpen] = useState(false);
  const [selectedWorkoutForDetail, setSelectedWorkoutForDetail] = useState<Workout | null>(null);
  const [isLoadingWorkoutDetail, setIsLoadingWorkoutDetail] = useState(false);
  const [workoutDetailError, setWorkoutDetailError] = useState<string | null>(null);


  // Format date helper function
  const formatDate = (date: Date | number | undefined | null): string => {
    if (!date) return 'nil';
    
    const dateObj = typeof date === 'number' 
      ? new Date(date * 1000)  // Convert from Unix timestamp (seconds)
      : new Date(date);
      
    return dateObj.toLocaleString();
  };

  const deleteUserChallenge = async (id: string) => {
    if (!id) return;
    setDeleteLoading(true);
    setDeleteResult(null);
    try {
      const result = await workoutService.deleteUserChallenge(id);
      setDeleteResult(result);
      if (result.success) {
        // Refresh list and close detail view
        await loadAllUserChallenges();
        setSelectedUserChallenge(null);
      }
    } catch (err) {
      console.error(err);
      setDeleteResult({ success: false, message: (err as Error).message });
    } finally {
      setDeleteLoading(false);
    }
  };
  

  // Copy ID to clipboard and show toast
  const copyToClipboard = (id: string) => {
    navigator.clipboard.writeText(id)
      .then(() => {
        setCopiedId(id);
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 2000); // Hide toast after 2 seconds
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
      });
  };

  // Load all user challenges
  const loadAllUserChallenges = async () => {
    try {
      setLoading(true);
      
      // Use the workoutService method to fetch all user challenges
      // Cast workoutService to any to access the fetchAllUserChallenges method

      const allUserChallenges = await workoutService.fetchAllUserChallenges();

      
      console.log(`Loaded ${allUserChallenges.length} user challenges`);
      console.log('allUserChallenges:', allUserChallenges);
      
      setUserChallenges(allUserChallenges);
      setFilteredChallenges(allUserChallenges);
      setLoading(false);
    } catch (error) {
      console.error('Error loading user challenges:', error);
      setLoading(false);
    }
  };

  // Run the inactivity check job
  const runInactivityCheck = async (testMode: boolean = false, simulationMode: boolean = false) => {
    setUpdateLoading(true);
    setUpdateError(null);
    setUpdateResult(null);

    try {
      // Call the Netlify function to trigger the inactivity check
      const result = await fetch('/.netlify/functions/trigger-workout-inactivity-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ testMode, simulationMode }),
      });

      if (!result.ok) {
        // Get the error content regardless of type
        const errorContent = await result.text();
        throw new Error(`Server error (${result.status}): ${errorContent}`);
      }
      
      // Get the response as text first
      const responseText = await result.text();
      
      // Try to parse it as JSON
      try {
        const data: InactivityCheckResult = JSON.parse(responseText);
        setUpdateResult(data);
        
        // Refresh the user challenges after a successful update
        if (!testMode && !simulationMode) {
          await loadAllUserChallenges();
        }
      } catch (jsonError) {
        // If parsing fails, it's truly not JSON
        setUpdateError(`The server returned a non-JSON response: ${responseText}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setUpdateError(errorMessage);
      console.error('Error running inactivity check:', err);
    } finally {
      setUpdateLoading(false);
    }
  };

  // Load user challenges on mount
  useEffect(() => {
    loadAllUserChallenges();
  }, []);

  // Handle search
  useEffect(() => {
    if (!searchTerm) {
      setFilteredChallenges(userChallenges);
      return;
    }
    
    const lowercaseTerm = searchTerm.toLowerCase();
    const filtered = userChallenges.filter(userChallenge => 
      (userChallenge.id.toLowerCase().includes(lowercaseTerm)) ||
      (userChallenge.username?.toLowerCase().includes(lowercaseTerm)) ||
      (userChallenge.challenge?.title?.toLowerCase().includes(lowercaseTerm))
    );
    
    setFilteredChallenges(filtered);
  }, [searchTerm, userChallenges]);

  const handleSearchChange = debounce((term: string) => {
    setSearchTerm(term);
  }, 300);

  const handleRefresh = () => {
    loadAllUserChallenges();
  };

  // Set a specific user challenge to inactive
  const setUserChallengeInactive = async (userChallengeId: string) => {
    if (!userChallengeId) return;
    
    setInactivatingId(userChallengeId);
    setInactivateResult(null);
    
    try {
      // Call the Netlify function to update this specific user challenge
      const result = await fetch('/.netlify/functions/set-user-challenge-inactive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userChallengeId }),
      });
      
      // Get the response text
      const responseText = await result.text();
      
      // Try to parse as JSON
      try {
        const data = JSON.parse(responseText);
        
        if (data.success) {
          setInactivateResult({
            success: true,
            message: data.message || 'User challenge successfully marked as inactive'
          });
          
          // Refresh the list
          await loadAllUserChallenges();
        } else {
          setInactivateResult({
            success: false,
            message: data.message || 'Failed to mark user challenge as inactive'
          });
        }
      } catch (jsonError) {
        setInactivateResult({
          success: false,
          message: `Failed to parse response: ${responseText}`
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setInactivateResult({
        success: false,
        message: errorMessage
      });
    } finally {
      setInactivatingId(null);
    }
  };

  // Fetch and display workout (stack) details
  const handleViewWorkoutDetails = async (compositeWorkoutId: string) => {
    if (!compositeWorkoutId) return;

    // Parse the compositeWorkoutId to get the original stack ID
    const originalStackId = compositeWorkoutId.split('-')[0];

    if (!originalStackId) {
      console.error('Could not parse originalStackId from:', compositeWorkoutId);
      setWorkoutDetailError('Invalid workout ID format.');
      return;
    }

    setIsLoadingWorkoutDetail(true);
    setWorkoutDetailError(null);
    try {
      const workoutDetails = await workoutService.fetchStackWorkoutDetails(originalStackId);
      if (workoutDetails) {
        setSelectedWorkoutForDetail(workoutDetails);
        setIsWorkoutDetailModalOpen(true);
      } else {
        setWorkoutDetailError(`Workout details not found for ID: ${originalStackId}.`);
      }
    } catch (err) {
      console.error(`Error fetching workout details for ID ${originalStackId}:`, err);
      setWorkoutDetailError(err instanceof Error ? err.message : 'Failed to fetch workout details.');
    } finally {
      setIsLoadingWorkoutDetail(false);
    }
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Workout Inactivity Check | Pulse Admin</title>
        <style>{toastAnimation}</style>
      </Head>
      
      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-8 flex items-center">
            <span className="text-[#d7ff00] mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
              </svg>
            </span>
            Workout Inactivity Check
          </h1>
          
          <div className="relative bg-[#1a1e24] rounded-xl p-6 mb-6 shadow-xl overflow-hidden">
            {/* Top gradient border */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
            
            {/* Left gradient border */}
            <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-500 via-purple-500 to-[#d7ff00]"></div>
            
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4 mb-6">
              <button
                onClick={() => runInactivityCheck(false, true)}
                disabled={updateLoading}
                className={`relative px-4 py-3 rounded-lg font-medium hover:bg-[#2a2f36] transition ${
                  updateLoading 
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                    : 'bg-[#262a30] text-blue-400 border border-blue-800'
                }`}
              >
                <span className="flex items-center">
                  {updateLoading && updateResult?.results.simulationMode ? (
                    <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  {updateLoading && updateResult?.results.simulationMode ? 'Simulating...' : 'Simulation (View Changes Only)'}
                </span>
              </button>

              <button
                onClick={() => runInactivityCheck(true)}
                disabled={updateLoading}
                className={`relative px-4 py-3 rounded-lg font-medium hover:bg-[#2a2f36] transition ${
                  updateLoading 
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                    : 'bg-[#262a30] text-yellow-400 border border-yellow-800'
                }`}
              >
                <span className="flex items-center">
                  {updateLoading && updateResult?.results.testMode && !updateResult?.results.simulationMode ? (
                    <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {updateLoading && updateResult?.results.testMode && !updateResult?.results.simulationMode ? 'Testing...' : 'Test Run (No Notifications)'}
                </span>
              </button>

              <button
                onClick={() => runInactivityCheck(false)}
                disabled={updateLoading}
                className={`relative px-4 py-3 rounded-lg font-medium hover:bg-[#2a2f36] transition ${
                  updateLoading 
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                    : 'bg-[#262a30] text-[#d7ff00] border border-[#616e00]'
                }`}
              >
                <span className="flex items-center">
                  {updateLoading && !updateResult?.results.testMode && !updateResult?.results.simulationMode ? (
                    <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  {updateLoading && !updateResult?.results.testMode && !updateResult?.results.simulationMode ? 'Running...' : 'Run Inactivity Check'}
                </span>
              </button>
            </div>
            
            {/* Update Result */}
            {updateError && (
              <div className="flex flex-col gap-2 text-red-400 mt-4 p-3 bg-red-900/20 rounded-lg relative overflow-hidden mb-6">
                {/* Error message gradient border */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-red-500 to-orange-400"></div>
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-red-500 to-orange-400"></div>
                
                <div className="flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <span className="font-medium">Error during inactivity check:</span>
                    <div className="mt-2">
                      {updateError.includes('non-JSON response:') ? (
                        <div>
                          <div className="text-sm mb-2">The server response format was unexpected. This might be fixable by refreshing the page or trying again.</div>
                          <button 
                            onClick={() => {
                              // Try to extract and parse JSON from the error message
                              try {
                                const match = updateError.match(/non-JSON response: (.*)/);
                                if (match && match[1]) {
                                  const jsonData = JSON.parse(match[1]);
                                  if (jsonData && typeof jsonData === 'object') {
                                    setUpdateError(null);
                                    setUpdateResult(jsonData);
                                  }
                                }
                              } catch (e) {
                                console.error("Couldn't parse JSON from error", e);
                              }
                            }}
                            className="text-blue-400 hover:text-blue-300 text-sm underline"
                          >
                            Try to extract data from response
                          </button>
                        </div>
                      ) : (
                        <span>{updateError}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {updateResult && (
              <div className="flex flex-col gap-2 text-green-400 mt-4 p-3 bg-green-900/20 rounded-lg relative overflow-hidden mb-6">
                {/* Success message gradient border */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-green-500 to-emerald-400"></div>
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-green-500 to-emerald-400"></div>
                
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>

                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span>Inactivity check completed successfully</span>
                      {updateResult.results.testMode && (
                        <span className="px-2 py-1 bg-yellow-900/30 text-yellow-400 rounded-full text-xs font-medium border border-yellow-900">
                          Test Mode
                        </span>
                      )}
                      {updateResult.results.simulationMode && (
                        <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded-full text-xs font-medium border border-blue-900">
                          Simulation Mode
                        </span>
                      )}
                    </div>
                    
                    {/* Summary Cards for statistics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                      <div className="bg-[#1f2328] p-3 rounded-lg border border-gray-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-gray-400 text-xs font-medium">Challenges Processed</div>
                            <div className="text-2xl font-bold text-white mt-1">{updateResult.results.userChallengesProcessed}</div>
                          </div>
                          <div className="bg-indigo-900/30 p-2 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                              <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-[#1f2328] p-3 rounded-lg border border-gray-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-gray-400 text-xs font-medium">Inactive Users Found</div>
                            <div className="text-2xl font-bold text-amber-400 mt-1">{updateResult.results.inactiveUsersFound}</div>
                          </div>
                          <div className="bg-amber-900/30 p-2 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-[#1f2328] p-3 rounded-lg border border-gray-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-gray-400 text-xs font-medium">
                              {updateResult.results.simulationMode 
                                ? "Notifications (If Run)" 
                                : "Notifications Triggered"}
                            </div>
                            <div className="text-2xl font-bold text-[#d7ff00] mt-1">{updateResult.results.notificationsTriggered}</div>
                          </div>
                          <div className="bg-[#3d4500]/30 p-2 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-[#d7ff00]" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-2 text-sm text-right">
                      <span className="text-gray-400">Run on: </span>
                      <span className="text-white">{formatDate(updateResult.results.timestamp)}</span>
                    </div>
                  </div>
                </div>

                {/* Show simulated updates if they exist */}
                {updateResult.results.simulationMode && updateResult.results.simulatedUpdates && updateResult.results.simulatedUpdates.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-white font-medium mb-2">Users that would be marked inactive:</h3>
                    <div className="max-h-60 overflow-y-auto bg-[#1f2328] rounded-lg p-2 border border-gray-700">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-400 border-b border-gray-700">
                            <th className="py-2 px-3 sticky top-0 bg-[#1f2328]">Username</th>
                            <th className="py-2 px-3 sticky top-0 bg-[#1f2328]">Challenge</th>
                            <th className="py-2 px-3 sticky top-0 bg-[#1f2328]">Is Currently Active?</th>
                            <th className="py-2 px-3 sticky top-0 bg-[#1f2328]">Last Active</th>
                            <th className="py-2 px-3 sticky top-0 bg-[#1f2328]">ID</th>
                            <th className="py-2 px-3 sticky top-0 bg-[#1f2328]">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {updateResult.results.simulatedUpdates.map((update, index) => (
                            <tr key={index} className={`border-b border-gray-800 hover:bg-[#262a30] transition-colors ${selectedRecord?.challengeId === update.challengeId ? 'bg-[#1d2b3a]' : ''}`}>
                              <td className="py-2 px-3 text-blue-400">{update.username || 'Unknown'}</td>
                              <td className="py-2 px-3 text-gray-300">{update.challengeTitle || update.challengeId}</td>
                              <td className="py-2 px-3 text-blue-400">{update.isCurrentlyActive == true ? "Active" : 'Not Active'}</td>
                              <td className="py-2 px-3 text-gray-300">
                                {update.lastActive ? formatDate(update.lastActive) : 
                                <span className="px-2 py-1 bg-red-900/30 text-red-400 rounded-full text-xs font-medium border border-red-900">
                                  Never Active
                                </span>}
                              </td>
                              <td className="py-2 px-3">
                                <button
                                  onClick={() => copyToClipboard(update.challengeId)}
                                  className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded-full text-xs font-medium border border-blue-900 hover:bg-blue-800/40 transition-colors flex items-center"
                                  title="Click to copy challenge ID"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                  </svg>
                                  {update.challengeId.substring(0, 6)}...
                                </button>
                              </td>
                              <td className="py-2 px-3">
                                <button
                                  onClick={() => setSelectedRecord(selectedRecord?.challengeId === update.challengeId ? null : {
                                    ...update,
                                    id: update.id
                                  })}
                                  className="px-2 py-1 bg-purple-900/30 text-purple-400 rounded-lg text-xs font-medium border border-purple-900 hover:bg-purple-800/40 transition-colors flex items-center"
                                  title="View record details"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                  </svg>
                                  {selectedRecord?.challengeId === update.challengeId ? 'Hide' : 'View'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Individual Record View */}
                    {selectedRecord && (
                      <div className="mt-4 bg-[#1d2b3a] border border-blue-800 rounded-lg p-4 animate-fade-in-up">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="text-white font-medium">Record Details</h4>
                          <button 
                            onClick={() => setSelectedRecord(null)} 
                            className="text-gray-400 hover:text-white"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <div>
                              <div className="text-gray-400 text-xs">Username</div>
                              <div className="text-blue-400 font-medium">{selectedRecord.username || 'Unknown'}</div>
                            </div>
                            <div>
                              <div className="text-gray-400 text-xs">User ID</div>
                              <div className="text-gray-300 font-mono text-sm">
                                <button 
                                  onClick={() => copyToClipboard(selectedRecord.userId)} 
                                  className="hover:text-blue-400 flex items-center"
                                  title="Copy user ID"
                                >
                                  {selectedRecord.userId}
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <div>
                              <div className="text-gray-400 text-xs">Document ID</div>
                              <div className="text-gray-300 font-mono text-sm">
                                <button 
                                  onClick={() => copyToClipboard(selectedRecord.id || '')} 
                                  className="hover:text-blue-400 flex items-center"
                                  title="Copy document ID"
                                >
                                  {selectedRecord.id || 'Not available'}
                                  {selectedRecord.id && (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                      <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                    </svg>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <div className="text-gray-400 text-xs">Challenge Title</div>
                              <div className="text-gray-300">{selectedRecord.challengeTitle || 'Unknown'}</div>
                            </div>
                            <div>
                              <div className="text-gray-400 text-xs">Challenge ID</div>
                              <div className="text-gray-300 font-mono text-sm">
                                <button 
                                  onClick={() => copyToClipboard(selectedRecord.challengeId)} 
                                  className="hover:text-blue-400 flex items-center"
                                  title="Copy challenge ID"
                                >
                                  {selectedRecord.challengeId}
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <div>
                              <div className="text-gray-400 text-xs">UserChallenge ID</div>
                              <div className="text-gray-300 font-mono text-sm">
                                <button 
                                  onClick={() => copyToClipboard(selectedRecord.id || '')} 
                                  className="hover:text-blue-400 flex items-center"
                                  title="Copy UserChallenge ID"
                                >
                                  {selectedRecord.id}
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4">
                          <div className="text-gray-400 text-xs">Last Active</div>
                          <div className="text-gray-300">
                            {selectedRecord.lastActive ? formatDate(selectedRecord.lastActive) : 
                            <span className="px-2 py-1 bg-red-900/30 text-red-400 rounded-full text-xs font-medium border border-red-900">
                              Never Active
                            </span>}
                          </div>
                        </div>
                        <div className="mt-4 flex justify-between">
                          <div>
                            {inactivateResult && selectedRecord?.id && (
                              <div className={`text-sm rounded-lg px-3 py-1.5 ${
                                inactivateResult.success ? 'bg-green-900/30 text-green-400 border border-green-900' 
                                : 'bg-red-900/30 text-red-400 border border-red-900'
                              }`}>
                                {inactivateResult.message}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                const idToUse = selectedRecord.id || selectedRecord.challengeId;
                                if (idToUse) {
                                  setUserChallengeInactive(idToUse);
                                } else {
                                  setInactivateResult({
                                    success: false,
                                    message: "No valid ID found for this record"
                                  });
                                }
                              }}
                              disabled={!selectedRecord.id || inactivatingId === selectedRecord.id}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center
                                ${!selectedRecord.id ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed' : 
                                  inactivatingId === selectedRecord.id ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed' : 
                                  'bg-red-900/30 text-red-400 border-red-900 hover:bg-red-800/40 transition-colors'}`}
                              title={!selectedRecord.id ? "Document ID not available" : "Set this user challenge to inactive"}
                            >
                              {inactivatingId === selectedRecord.id ? (
                                <>
                                  <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Processing...
                                </>
                              ) : (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                                  </svg>
                                  Set Inactive
                                </>
                              )}
                            </button>
                            <button 
                              onClick={() => copyToClipboard(selectedRecord.challengeId)} 
                              className="px-3 py-1.5 bg-[#262a30] text-[#d7ff00] rounded-lg text-xs font-medium border border-[#616e00] hover:bg-[#2c3137] transition flex items-center"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                              </svg>
                              Copy Challenge ID
                            </button>
                            <button 
                              onClick={() => copyToClipboard(selectedRecord.challengeId)} 
                              className="px-3 py-1.5 bg-[#262a30] text-[#d7ff00] rounded-lg text-xs font-medium border border-[#616e00] hover:bg-[#2c3137] transition flex items-center"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-3 flex justify-between items-center">
                      <span className="text-gray-400 text-sm">
                        Total inactive users: <span className="text-yellow-400 font-medium">{updateResult.results.simulatedUpdates.length}</span>
                      </span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => runInactivityCheck(true)} 
                          className="px-3 py-1.5 bg-yellow-900/30 text-yellow-400 rounded-lg text-xs font-medium border border-yellow-900 hover:bg-yellow-800/30 transition"
                        >
                          Run Test Mode
                        </button>
                        <button 
                          onClick={() => runInactivityCheck(false)} 
                          className="px-3 py-1.5 bg-[#262a30] text-[#d7ff00] rounded-lg text-xs font-medium border border-[#616e00] hover:bg-[#2c3137] transition"
                        >
                          Run Inactivity Check
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Search */}
            <div className="mb-6">
              <label className="block text-gray-300 mb-2 text-sm font-medium">Search User Challenges</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by username, challenge name, or ID"
                  className="w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
                <div className="absolute right-3 top-3">
                  <button
                    onClick={handleRefresh}
                    className="text-gray-400 hover:text-white transition"
                    title="Refresh List"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            
            {/* User Challenge Table */}
            <div className="overflow-x-auto">
              <h2 className="text-xl font-medium mb-4 text-white flex items-center">
                <span className="text-[#d7ff00] mr-2 text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.676 0-5.433-.608-7.812-1.632a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                  </svg>
                </span>
                User Challenges
              </h2>
              
              {loading ? (
                <div className="text-center my-4 text-gray-300">
                  <svg className="animate-spin h-6 w-6 mx-auto mb-2 text-[#d7ff00]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading user challenges...
                </div>
              ) : filteredChallenges.length === 0 ? (
                <div className="flex items-center gap-2 text-gray-400 mt-4 p-3 bg-gray-800/30 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>No user challenges found.</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-[#262a30] rounded-lg overflow-hidden">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="py-3 px-4 text-left text-gray-300 font-medium">ID</th>
                        <th className="py-3 px-4 text-left text-gray-300 font-medium">User ID</th>
                        <th className="py-3 px-4 text-left text-gray-300 font-medium">Challenge</th>
                        <th className="py-3 px-4 text-left text-gray-300 font-medium">Progress</th>
                        <th className="py-3 px-4 text-left text-gray-300 font-medium">Last Active</th>
                        <th className="py-3 px-4 text-left text-gray-300 font-medium">Current Streak</th>
                        <th className="py-3 px-4 text-left text-gray-300 font-medium">Active Status</th>
                        <th className="py-3 px-4 text-left text-gray-300 font-medium">Completed</th>
                        <th className="py-3 px-4 text-left text-gray-300 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                    {filteredChallenges.map((userChallenge) => (
  <React.Fragment key={userChallenge.id}>
    {/* Main row */}
    <tr
      className={`hover:bg-[#2a2f36] transition-colors ${
        selectedUserChallenge?.id === userChallenge.id ? 'bg-[#1d2b3a]' : ''
      }`}
    >
      <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
        <button
          onClick={() => copyToClipboard(userChallenge.id)}
          className="text-blue-400 hover:text-blue-300"
        >
          {userChallenge.id.substring(0, 8)}…
        </button>
      </td>
      <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
        <button
          onClick={() => copyToClipboard(userChallenge.userId)}
          className="text-blue-400 hover:text-blue-300"
          title="Copy User ID"
        >
          {userChallenge.userId.substring(0, 8)}…
        </button>
      </td>
      <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
        {userChallenge.challenge?.title || 'N/A'}
      </td>
      <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
        {Math.round(userChallenge.progress * 100)}%
      </td>
      <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
        {formatDate(userChallenge.lastActive)}
      </td>
      <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
        {userChallenge.currentStreak || 0}
      </td>
      <td className="py-3 px-4 border-b border-gray-700">
        {userChallenge.isCurrentlyActive ? (
          <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded-full text-xs font-medium border border-blue-900">
            Active
          </span>
        ) : (
          <span className="px-2 py-1 bg-red-900/30 text-red-400 rounded-full text-xs font-medium border border-red-900">
            Inactive
          </span>
        )}
      </td>
      <td className="py-3 px-4 border-b border-gray-700">
        {userChallenge.isCompleted ? (
          <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded-full text-xs font-medium border border-green-900">
            Completed
          </span>
        ) : (
          <span className="px-2 py-1 bg-yellow-900/30 text-yellow-400 rounded-full text-xs font-medium border border-yellow-900">
            In Progress
          </span>
        )}
      </td>
      <td className="py-3 px-4 border-b border-gray-700">
        <button
          onClick={() =>
            setSelectedUserChallenge(
              selectedUserChallenge?.id === userChallenge.id
                ? null
                : userChallenge
            )
          }
          className="px-2 py-1 bg-purple-900/30 text-purple-400 rounded-lg text-xs font-medium border border-purple-900 hover:bg-purple-800/40 transition-colors flex items-center"
          title="View details"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3 w-3 mr-1"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
            <path
              fillRule="evenodd"
              d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
              clipRule="evenodd"
            />
          </svg>
          {selectedUserChallenge?.id === userChallenge.id ? 'Hide' : 'View'}
        </button>
      </td>
    </tr>

    {/* Detail row */}
    {selectedUserChallenge?.id === userChallenge.id && (
      <tr className="animate-fade-in-up">
        <td colSpan={9} className="border-b border-blue-800 p-0">
          <div className="bg-[#1d2b3a] border border-blue-800 rounded-lg p-4">
            {/* — Detail Card Markup — */}
            <div className="flex justify-between items-start mb-3">
              <h4 className="text-white font-medium">
                User Challenge Details
              </h4>
              <button
                onClick={() => setSelectedUserChallenge(null)}
                className="text-gray-400 hover:text-white"
                title="Hide details"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">
                  Basic Information
                </h5>
                <div className="space-y-3">
                  <div>
                    <div className="text-gray-400 text-xs">Username</div>
                    <div className="text-blue-400 font-medium">
                      {selectedUserChallenge.username || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">Document ID</div>
                    <div className="text-gray-300 font-mono text-sm">
                      <button
                        onClick={() =>
                          copyToClipboard(selectedUserChallenge.id)
                        }
                        className="hover:text-blue-400 flex items-center"
                        title="Copy document ID"
                      >
                        {selectedUserChallenge.id}
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">User ID</div>
                    <div className="text-gray-300 font-mono text-sm">
                      <button
                        onClick={() =>
                          copyToClipboard(selectedUserChallenge.userId)
                        }
                        className="hover:text-blue-400 flex items-center"
                        title="Copy user ID"
                      >
                        {selectedUserChallenge.userId}
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">Referral Chain</div>
                    <div className="text-gray-300 text-sm space-y-1">
                      {selectedUserChallenge.referralChain && 
                       selectedUserChallenge.referralChain.sharedBy && 
                       selectedUserChallenge.referralChain.sharedBy !== '' ? (
                        <>
                          <div className="flex items-center">
                            <span className="text-gray-400 text-xs mr-2">Shared By:</span>
                            <button
                              onClick={() =>
                                copyToClipboard(selectedUserChallenge.referralChain.sharedBy)
                              }
                              className="hover:text-blue-400 font-mono text-xs flex items-center"
                              title="Copy referrer user ID"
                            >
                              {selectedUserChallenge.referralChain.sharedBy}
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                              </svg>
                            </button>
                          </div>
                          {selectedUserChallenge.referralChain.originalHostId && 
                           selectedUserChallenge.referralChain.originalHostId !== '' && 
                           selectedUserChallenge.referralChain.originalHostId !== selectedUserChallenge.referralChain.sharedBy && (
                            <div className="flex items-center">
                              <span className="text-gray-400 text-xs mr-2">Original Host:</span>
                              <button
                                onClick={() =>
                                  copyToClipboard(selectedUserChallenge.referralChain.originalHostId)
                                }
                                className="hover:text-blue-400 font-mono text-xs flex items-center"
                                title="Copy original host user ID"
                              >
                                {selectedUserChallenge.referralChain.originalHostId}
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                  <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-500 text-xs">Direct join (no referral)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Challenge Info */}
              <div className="space-y-4">
                <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">
                  Challenge Information
                </h5>
                <div className="space-y-3">
                  <div>
                    <div className="text-gray-400 text-xs">
                      Challenge Title
                    </div>
                    <div className="text-gray-300">
                      {selectedUserChallenge.challenge?.title || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">Challenge Subtitle</div>
                    <div className="text-gray-300 text-sm">
                      {selectedUserChallenge.challenge?.subtitle || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">Challenge ID</div>
                    <div className="text-gray-300 font-mono text-sm">
                      <button
                        onClick={() =>
                          copyToClipboard(selectedUserChallenge.challengeId)
                        }
                        className="hover:text-blue-400 flex items-center"
                        title="Copy challenge ID"
                      >
                        {selectedUserChallenge.challengeId}
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">Start Date</div>
                    <div className="text-gray-300 text-sm">
                      {selectedUserChallenge.challenge?.startDate ? 
                        formatDate(selectedUserChallenge.challenge.startDate) : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">End Date</div>
                    <div className="text-gray-300 text-sm font-medium">
                      {selectedUserChallenge.challenge?.endDate ? 
                        formatDate(selectedUserChallenge.challenge.endDate) : 'N/A'}
                    </div>
                    {/* Show if challenge is currently active based on end date */}
                    {selectedUserChallenge.challenge?.endDate && (
                      <div className="mt-1">
                        {new Date(selectedUserChallenge.challenge.endDate) > new Date() ? (
                          <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded-full text-xs font-medium border border-green-900">
                            Challenge Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-red-900/30 text-red-400 rounded-full text-xs font-medium border border-red-900">
                            Challenge Ended
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">Created At</div>
                    <div className="text-gray-300 text-sm">
                      {selectedUserChallenge.challenge?.createdAt ? 
                        formatDate(selectedUserChallenge.challenge.createdAt) : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">Updated At</div>
                    <div className="text-gray-300 text-sm">
                      {selectedUserChallenge.challenge?.updatedAt ? 
                        formatDate(selectedUserChallenge.challenge.updatedAt) : 'N/A'}
                    </div>
                  </div>
                  
                  {/* Debug Section - Raw Date Values */}
                  <div className="pt-3 border-t border-gray-700">
                    <div className="text-gray-400 text-xs mb-2">🔧 Debug: Raw Date Values</div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Start Date (raw):</span>
                        <span className="text-gray-300 font-mono">
                          {selectedUserChallenge.challenge?.startDate ? 
                            JSON.stringify(selectedUserChallenge.challenge.startDate) : 'null'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">End Date (raw):</span>
                        <span className="text-gray-300 font-mono">
                          {selectedUserChallenge.challenge?.endDate ? 
                            JSON.stringify(selectedUserChallenge.challenge.endDate) : 'null'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">End Date Type:</span>
                        <span className="text-gray-300 font-mono">
                          {selectedUserChallenge.challenge?.endDate ? 
                            typeof selectedUserChallenge.challenge.endDate : 'undefined'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">End Date > Now:</span>
                        <span className={`font-mono ${selectedUserChallenge.challenge?.endDate && new Date(selectedUserChallenge.challenge.endDate) > new Date() ? 'text-green-400' : 'text-red-400'}`}>
                          {selectedUserChallenge.challenge?.endDate ? 
                            (new Date(selectedUserChallenge.challenge.endDate) > new Date()).toString() : 'false'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-gray-400 text-xs">
                      User Challenge Status
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      {selectedUserChallenge.isCompleted ? (
                        <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded-full text-xs font-medium border border-green-900">
                          User Completed
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-yellow-900/30 text-yellow-400 rounded-full text-xs font-medium border border-yellow-900">
                          User In Progress
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Info */}
              <div className="space-y-4">
                <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">
                  Progress Information
                </h5>
                <div className="space-y-3">
                  <div>
                    <div className="text-gray-400 text-xs">Progress</div>
                    <div className="mt-1">
                      <div className="h-2 bg-gray-700 rounded-full w-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-[#d7ff00]"
                          style={{
                            width: `${Math.round(
                              selectedUserChallenge.progress * 100
                            )}%`
                          }}
                        />
                      </div>
                      <div className="text-right text-xs mt-1 text-gray-300">
                        {Math.round(
                          selectedUserChallenge.progress * 100
                        )}
                        %
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">Current Streak</div>
                    <div className="text-[#d7ff00] font-medium flex items-center mt-1">
                      {selectedUserChallenge.currentStreak || 0}{' '}
                      {selectedUserChallenge.currentStreak === 1
                        ? 'day'
                        : 'days'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">Longest Streak</div>
                    <div className="text-[#d7ff00] font-medium flex items-center mt-1">
                      {selectedUserChallenge.longestStreak || 0}{' '}
                      {selectedUserChallenge.longestStreak === 1
                        ? 'day'
                        : 'days'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">Last Active</div>
                    <div className="text-gray-300 mt-1">
                      {selectedUserChallenge.lastActive
                        ? formatDate(selectedUserChallenge.lastActive)
                        : (
                          <span className="px-2 py-1 bg-red-900/30 text-red-400 rounded-full text-xs font-medium border border-red-900">
                            Never Active
                          </span>
                        )}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">Active Status</div>
                    <div className="mt-1">
                      {selectedUserChallenge.isCurrentlyActive ? (
                        <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded-full text-xs font-medium border border-blue-900">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-red-900/30 text-red-400 rounded-full text-xs font-medium border border-red-900">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Pulse Points - NEW SECTION */}
              <div className="space-y-4">
                <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">
                  Pulse Points
                </h5>
                <div className="space-y-3">
                  <div>
                    <div className="text-gray-400 text-xs">Total Points</div>
                    <div className="text-[#d7ff00] text-xl font-bold flex items-center mt-1">
                      {selectedUserChallenge.pulsePoints?.totalPoints || 0}
                    </div>
                  </div>
                  
                  {/* Points Breakdown */}
                  <div className="mt-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-xs">Stack Points</span>
                      <span className="text-gray-300 text-xs font-medium">
                        {selectedUserChallenge.pulsePoints?.totalStackPoints || 0}
                      </span>
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-gray-400 text-xs">Community Points</span>
                      <span className="text-gray-300 text-xs font-medium">
                        {selectedUserChallenge.pulsePoints?.totalCommunityPoints || 0}
                      </span>
                    </div>
                  </div>

                  {/* Detailed Points Breakdown */}
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <div className="text-gray-400 text-xs mb-2">Points Breakdown</div>
                    
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Base Completion</span>
                        <span className="text-gray-300">{selectedUserChallenge.pulsePoints?.baseCompletion || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">First Completion</span>
                        <span className="text-gray-300">{selectedUserChallenge.pulsePoints?.firstCompletion || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Streak Bonus</span>
                        <span className="text-gray-300">{selectedUserChallenge.pulsePoints?.streakBonus || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Check-in Bonus</span>
                        <span className="text-gray-300">{selectedUserChallenge.pulsePoints?.checkInBonus || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Effort Rating</span>
                        <span className="text-gray-300">{selectedUserChallenge.pulsePoints?.effortRating || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Chat Participation</span>
                        <span className="text-gray-300">{selectedUserChallenge.pulsePoints?.chatParticipation || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Location Check-in</span>
                        <span className="text-gray-300">{selectedUserChallenge.pulsePoints?.locationCheckin || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Content Engagement</span>
                        <span className="text-gray-300">{selectedUserChallenge.pulsePoints?.contentEngagement || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Encouragement Sent</span>
                        <span className="text-gray-300">{selectedUserChallenge.pulsePoints?.encouragementSent || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Encouragement Received</span>
                        <span className="text-gray-300">{selectedUserChallenge.pulsePoints?.encouragementReceived || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Cumulative Streak</span>
                        <span className="text-gray-300">{selectedUserChallenge.pulsePoints?.cumulativeStreakBonus || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Share Bonus</span>
                        <span className="text-gray-300">{selectedUserChallenge.pulsePoints?.shareBonus || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Referral Bonus</span>
                        <span className="text-gray-300">{selectedUserChallenge.pulsePoints?.referralBonus || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Peer Challenge Bonus</span>
                        <span className="text-gray-300">{selectedUserChallenge.pulsePoints?.peerChallengeBonus || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Completed Workouts - NEW SECTION */}
              <div className="space-y-4 md:col-span-4"> {/* Changed md:col-span-2 to md:col-span-4 to take full width of the 4-column parent grid defined for the detail card sections */}
                <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">
                  Completed Workouts ({selectedUserChallenge.completedWorkouts?.length || 0})
                </h5>
                {selectedUserChallenge.completedWorkouts && selectedUserChallenge.completedWorkouts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {selectedUserChallenge.completedWorkouts.map((workout) => (
                      <div key={workout.id} className="p-3 bg-[#262a30] rounded-lg border border-gray-700 text-xs flex flex-col justify-between aspect-[4/3]">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-gray-300 font-semibold truncate block" title={selectedWorkoutForDetail?.title || workout.workoutId}>
                              {/* Display workout title from detail if available, else ID */}
                              {selectedWorkoutForDetail && selectedWorkoutForDetail.id === workout.workoutId ? selectedWorkoutForDetail.title || workout.workoutId : workout.workoutId}
                            </span>
                            <button
                              onClick={() => handleViewWorkoutDetails(workout.workoutId)}
                              disabled={isLoadingWorkoutDetail && (!selectedWorkoutForDetail || selectedWorkoutForDetail.id !== workout.workoutId)}
                              className="mt-2 w-full px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-medium transition-colors flex items-center justify-center disabled:opacity-50"
                            >
                              {isLoadingWorkoutDetail && (!selectedWorkoutForDetail || selectedWorkoutForDetail.id !== workout.workoutId) ? (
                                <svg className="animate-spin h-4 w-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                </svg>
                              )}
                              View Details
                            </button>
                          </div>
                          <p className="text-blue-400 font-mono text-sm break-all mb-2" title={workout.workoutId}>{workout.workoutId}</p>
                        </div>
                        <div className="text-gray-400 mt-auto text-right">
                          <span className="block text-xs">Completed:</span>
                          <span className="block text-xs">{formatDate(workout.completedAt)}</span>
                        </div>
                         {/* Placeholder for workout title if we fetch it later */}
                        {/* <div className="text-gray-400 mt-1">Title: {workout.title || 'N/A'}</div> */}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm py-4">
                    No completed workouts recorded for this challenge.
                  </div>
                )}
              </div>

            </div>

            {/* Actions */}
            <div className="mt-4 flex justify-end gap-2">
              {/* Delete Button */}
              <button
                onClick={() => deleteUserChallenge(selectedUserChallenge.id)}
                disabled={deleteLoading}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center ${
                  deleteLoading
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-red-600 text-white border-red-700 hover:bg-red-500 transition-colors'
                }`}
              >
                {deleteLoading ? 'Deleting…' : 'Delete'}
              </button>
              <button
                onClick={() =>
                  setUserChallengeInactive(selectedUserChallenge.id)
                }
                disabled={!selectedUserChallenge.isCurrentlyActive}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center ${
                  !selectedUserChallenge.isCurrentlyActive
                    ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed'
                    : 'bg-red-900/30 text-red-400 border-red-900 hover:bg-red-800/40 transition-colors'
                }`}
              >
                Set Inactive
              </button>
              <button
                onClick={() => copyToClipboard(selectedUserChallenge.id)}
                className="px-3 py-1.5 bg-[#262a30] text-[#d7ff00] rounded-lg text-xs font-medium border border-[#616e00] hover:bg-[#2c3137] transition flex items-center"
              >
                Copy ID
              </button>
            </div>
            {/* — End Detail Card — */}
          </div>
        </td>
      </tr>
    )}
  </React.Fragment>
))}
                    </tbody>

                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Workout Detail Modal */}
      {isWorkoutDetailModalOpen && selectedWorkoutForDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[100] animate-fade-in-up">
          <div className="bg-[#1a1e24] rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-indigo-500">
            <div className="flex items-center justify-between p-4 border-b border-gray-700 sticky top-0 bg-[#1a1e24] z-10">
              <h3 className="text-lg font-semibold text-indigo-400 truncate pr-4">{selectedWorkoutForDetail.title || 'Workout Details'}</h3>
              <button 
                onClick={() => {
                  setIsWorkoutDetailModalOpen(false);
                  // Delay clearing selected workout to allow modal fade-out animation
                  setTimeout(() => {
                    setSelectedWorkoutForDetail(null);
                    setWorkoutDetailError(null);
                  }, 300); 
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-grow">
              {workoutDetailError && (
                <div className="mb-4 p-3 bg-red-900/30 text-red-400 rounded-md text-sm">
                  Error: {workoutDetailError}
                </div>
              )}
              <div className="mb-4">
                <h4 className="text-sm text-gray-400 font-medium">ID</h4>
                <p className="text-gray-300 text-sm mt-1 font-mono">{selectedWorkoutForDetail.id}</p>
              </div>
              <div className="mb-4">
                <h4 className="text-sm text-gray-400 font-medium">Description</h4>
                <p className="text-gray-300 text-sm mt-1">{selectedWorkoutForDetail.description || 'No description provided.'}</p>
              </div>

              <div className="mb-4">
                <h4 className="text-sm text-gray-400 font-medium">Zone</h4>
                <p className="text-gray-300 text-sm mt-1">{selectedWorkoutForDetail.zone || 'N/A'}</p>
              </div>

              <div>
                <h4 className="text-sm text-gray-400 font-medium mb-2">Exercises ({selectedWorkoutForDetail.exercises?.length || 0})</h4>
                {selectedWorkoutForDetail.exercises && selectedWorkoutForDetail.exercises.length > 0 ? (
                  <div className="space-y-3">
                    {selectedWorkoutForDetail.exercises.map((exRef, index) => (
                      <div key={exRef.exercise.id || index} className="p-3 bg-[#262a30] rounded-lg border border-gray-700">
                        <h5 className="font-medium text-indigo-400 text-sm">{exRef.exercise.name || 'Unnamed Exercise'}</h5>
                        <p className="text-xs text-gray-400 mt-0.5">Category: {exRef.exercise.category?.type || 'N/A'}</p>
                        {exRef.exercise.category?.type === 'weight-training' && (
                          <div className="text-xs text-gray-300 mt-1">
                            Sets: {exRef.exercise.category.details?.sets ?? 'N/A'}, 
                            Reps: {Array.isArray(exRef.exercise.category.details?.reps) ? exRef.exercise.category.details.reps.join(', ') : (exRef.exercise.category.details?.reps ?? 'N/A')}
                          </div>
                        )}
                        {exRef.exercise.category?.type === 'cardio' && (
                          <div className="text-xs text-gray-300 mt-1">
                            Duration: {exRef.exercise.category.details?.duration ?? 'N/A'} seconds
                          </div>
                        )}
                        {exRef.exercise.videos && exRef.exercise.videos.length > 0 && exRef.exercise.videos[0].videoURL && (
                           <div className="mt-2">
                            <a 
                                href={exRef.exercise.videos[0].videoURL} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:text-blue-300 underline flex items-center"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                </svg>
                                Watch Video
                            </a>
                           </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No exercises listed for this workout.</p>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-700 flex justify-end sticky bottom-0 bg-[#1a1e24] z-10">
              <button
                onClick={() => {
                  setIsWorkoutDetailModalOpen(false);
                  setTimeout(() => {
                    setSelectedWorkoutForDetail(null);
                    setWorkoutDetailError(null);
                  }, 300); 
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastVisible && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white py-2 px-4 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in-up z-50">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>ID <span className="font-mono">{copiedId.substring(0, 8)}...</span> copied to clipboard</span>
        </div>
      )}
    </AdminRouteGuard>
  );
};

export default InactivityCheckPage; 