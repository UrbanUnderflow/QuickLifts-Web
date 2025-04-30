import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { workoutService } from '../../api/firebase/workout/service';
import { SweatlistCollection, UserChallenge } from '../../api/firebase/workout/types';
import debounce from 'lodash.debounce';

// CSS for toast animation (copied from inactivityCheck)
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
    timestamp: number;
    testMode: boolean;
  };
}

const ChallengeStatusPage: React.FC = () => {
  const [sweatlistChallenges, setSweatlistChallenges] = useState<SweatlistCollection[]>([]);
  const [filteredChallenges, setFilteredChallenges] = useState<SweatlistCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateResult | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChallenge, setSelectedChallenge] = useState<SweatlistCollection | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [copiedId, setCopiedId] = useState<string>('');

  useEffect(() => {
    const fetchAdminChallenges = async () => {
      try {
        setLoading(true);
        // Fetch all admin collections using the new service function
        const collections = await workoutService.fetchAllAdminCollections();
        setSweatlistChallenges(collections);
        setFilteredChallenges(collections);
      } catch (error) {
        console.error('Error fetching admin challenges:', error);
        // Optionally set an error state here to display to the user
      } finally {
        setLoading(false);
      }
    };

    fetchAdminChallenges();
  }, []); // Empty dependency array means this runs once on mount

  useEffect(() => {
    if (!searchTerm) {
      setFilteredChallenges(sweatlistChallenges);
      return;
    }
    
    const lowercaseTerm = searchTerm.toLowerCase();
    const filtered = sweatlistChallenges.filter(collection => 
      (collection.id.toLowerCase().includes(lowercaseTerm)) ||
      (collection.challenge?.title?.toLowerCase().includes(lowercaseTerm)) ||
      (collection.challenge?.status?.toLowerCase().includes(lowercaseTerm))
    );
    
    setFilteredChallenges(filtered);
  }, [searchTerm, sweatlistChallenges]);

  const handleSearchChange = debounce((term: string) => {
    setSearchTerm(term);
  }, 300);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      const collections = await workoutService.fetchAllAdminCollections();
      setSweatlistChallenges(collections);
      setFilteredChallenges(collections);
      setSearchTerm('');
      const searchInput = document.getElementById('challenge-search') as HTMLInputElement;
      if (searchInput) searchInput.value = '';
    } catch (error) {
      console.error('Error refreshing admin challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (id: string) => {
    if (!id) return;
    navigator.clipboard.writeText(id)
      .then(() => {
        setCopiedId(id);
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
      });
  };

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

      // Refresh the sweatlist challenges after a successful update
      if (!testMode) {
        // Re-fetch data to reflect changes using the admin function
        setLoading(true); // Show loading indicator while refreshing
        try {
          const collections = await workoutService.fetchAllAdminCollections();
          setSweatlistChallenges(collections);
          setFilteredChallenges(collections);
        } catch (refreshError) {
           console.error('Error refreshing admin challenges:', refreshError);
           setUpdateError('Update successful, but failed to refresh challenge list.');
        } finally {
          setLoading(false);
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
    <AdminRouteGuard>
      <Head>
        <title>Challenge Status Management | Pulse Admin</title>
        <style>{toastAnimation}</style>
      </Head>
      
      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-8 flex items-center">
            <span className="text-[#d7ff00] mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                <path d="M11.7 2.805a.75.75 0 01.6 0A60.65 60.65 0 0122.83 8.72a.75.75 0 01-.231 1.337 49.949 49.949 0 00-9.902 3.912l-.003.002-.34.18a.75.75 0 01-.707 0A50.009 50.009 0 007.5 12.174v-.224c0-.131.067-.248.172-.311a54.614 54.614 0 014.653-2.52.75.75 0 00-.65-1.352 56.129 56.129 0 00-4.78 2.589 1.858 1.858 0 00-.859 1.228 49.803 49.803 0 00-4.634-1.527.75.75 0 01-.231-1.337A60.653 60.653 0 0111.7 2.805z" />
                <path d="M13.06 15.473a48.45 48.45 0 017.666-3.282c.134 1.414.22 2.843.255 4.285a.75.75 0 01-.46.71 47.878 47.878 0 00-8.105 4.342.75.75 0 01-.832 0 47.877 47.877 0 00-8.104-4.342.75.75 0 01-.461-.71c.035-1.442.121-2.87.255-4.286A48.4 48.4 0 016 13.18v1.27a1.5 1.5 0 00-.14 2.508c-.09.38-.222.753-.397 1.11.452.213.901.434 1.346.661a6.729 6.729 0 00.551-1.608 1.5 1.5 0 00.14-2.67v-.645a48.549 48.549 0 013.44 1.668 2.25 2.25 0 002.12 0z" />
                <path d="M4.462 19.462c.42-.419.753-.89 1-1.394.453.213.902.434 1.347.661a6.743 6.743 0 01-1.286 1.794.75.75 0 11-1.06-1.06z" />
              </svg>
            </span>
            Challenge Status Management
          </h1>
          
          <div className="relative bg-[#1a1e24] rounded-xl p-6 mb-6 shadow-xl overflow-hidden">
            {/* Top gradient border */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
            
            {/* Left gradient border */}
            <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-500 via-purple-500 to-[#d7ff00]"></div>
            
            {/* Action Buttons */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => runChallengeStatusUpdate(true)}
                disabled={updateLoading}
                className={`relative px-4 py-3 rounded-lg font-medium hover:bg-[#2a2f36] transition ${
                  updateLoading
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-[#262a30] text-yellow-400 border border-yellow-800'
                }`}
              >
                <span className="flex items-center">
                  {updateLoading && updateResult?.results.testMode ? (
                    <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {updateLoading && updateResult?.results.testMode ? 'Testing...' : 'Test Run (No Updates)'}
                </span>
              </button>

              <button
                onClick={() => runChallengeStatusUpdate(false)}
                disabled={updateLoading}
                className={`relative px-4 py-3 rounded-lg font-medium hover:bg-[#2a2f36] transition ${
                  updateLoading
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-[#262a30] text-[#d7ff00] border border-[#616e00]'
                }`}
              >
                <span className="flex items-center">
                  {updateLoading && !(updateResult?.results.testMode ?? true) ? (
                    <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  {updateLoading && !(updateResult?.results.testMode ?? true) ? 'Updating...' : 'Run Status Update Job'}
                </span>
              </button>
            </div>
            
            {/* Update Result */}
            {updateError && (
              <div className="flex items-center gap-2 text-red-400 mt-4 p-3 bg-red-900/20 rounded-lg relative overflow-hidden mb-6">
                {/* Error message gradient border */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-red-500 to-orange-400"></div>
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-red-500 to-orange-400"></div>
                
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{updateError}</span>
              </div>
            )}

            {updateResult && (
              <div className="flex items-center gap-2 text-green-400 mt-4 p-3 bg-green-900/20 rounded-lg relative overflow-hidden mb-6">
                {/* Success message gradient border */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-green-500 to-emerald-400"></div>
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-green-500 to-emerald-400"></div>
                
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span>Status update completed successfully</span>
                    {updateResult.results.testMode && (
                      <span className="px-2 py-1 bg-yellow-900/30 text-yellow-400 rounded-full text-xs font-medium border border-yellow-900">
                        Test Mode
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-2 text-sm">
                    <p>Timestamp: {formatDate(updateResult.results.timestamp)}</p>
                    <p>Sweatlist Updates: {updateResult.results.sweatlistCollection.updatesApplied}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Search Input - Added */}
            <div className="mb-6">
              <label htmlFor="challenge-search" className="block text-gray-300 mb-2 text-sm font-medium">Search Challenges</label>
              <div className="relative">
                <input
                  id="challenge-search"
                  type="text"
                  placeholder="Search by ID, title, or status"
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

            {/* Sweatlist Challenge Tables */}
            <div className="mb-8">
              <h2 className="text-xl font-medium mb-4 text-white flex items-center">
                <span className="text-[#d7ff00] mr-2 text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                  </svg>
                </span>
                Sweatlist Challenges
              </h2>
              
              {loading ? (
                <div className="text-center my-4 text-gray-300">
                  <svg className="animate-spin h-6 w-6 mx-auto mb-2 text-[#d7ff00]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading challenges...
                </div>
              ) : sweatlistChallenges.length === 0 ? (
                <div className="flex items-center gap-2 text-gray-400 mt-4 p-3 bg-gray-800/30 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>No sweatlist challenges found matching your criteria.</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-[#262a30] rounded-lg overflow-hidden">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="py-3 px-4 text-left text-gray-300 font-medium">ID</th>
                        <th className="py-3 px-4 text-left text-gray-300 font-medium">Title</th>
                        <th className="py-3 px-4 text-left text-gray-300 font-medium">Status</th>
                        <th className="py-3 px-4 text-left text-gray-300 font-medium">Start Date</th>
                        <th className="py-3 px-4 text-left text-gray-300 font-medium">End Date</th>
                        <th className="py-3 px-4 text-left text-gray-300 font-medium">Participants</th>
                        <th className="py-3 px-4 text-left text-gray-300 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredChallenges.map((collection) => (
                        <React.Fragment key={collection.id}>
                          <tr 
                            className={`hover:bg-[#2a2f36] transition-colors ${ 
                             selectedChallenge?.id === collection.id ? 'bg-[#1d2b3a]' : '' 
                            }`} 
                          >
                            <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
                              <button 
                                onClick={() => copyToClipboard(collection.id)} 
                                className="text-blue-400 hover:text-blue-300 flex items-center" 
                                title="Copy Collection ID" 
                              >
                                {collection.id.substring(0, 8)}...
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1 opacity-60" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                  <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                </svg>
                              </button>
                            </td>
                            <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
                              {collection.challenge?.title || 'N/A'}
                            </td>
                            <td className="py-3 px-4 border-b border-gray-700">
                              {String(collection.challenge?.status) === 'active' ? (
                                <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded-full text-xs font-medium border border-green-900">
                                  Active
                                </span>
                              ) : String(collection.challenge?.status) === 'completed' ? (
                                <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded-full text-xs font-medium border border-blue-900">
                                  Completed
                                </span>
                              ) : String(collection.challenge?.status) === 'published' ? (
                                <span className="px-2 py-1 bg-yellow-900/30 text-yellow-400 rounded-full text-xs font-medium border border-yellow-900">
                                  Published
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-gray-900/30 text-gray-400 rounded-full text-xs font-medium border border-gray-700">
                                  {collection.challenge?.status || 'N/A'}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
                              {formatDate(collection.challenge?.startDate)}
                            </td>
                            <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
                              {formatDate(collection.challenge?.endDate)}
                            </td>
                            <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
                              {collection.challenge?.participants?.length || 0}
                            </td>
                            <td className="py-3 px-4 border-b border-gray-700">
                              <button
                                onClick={() => setSelectedChallenge(selectedChallenge?.id === collection.id ? null : collection)}
                                className="px-2 py-1 bg-purple-900/30 text-purple-400 rounded-lg text-xs font-medium border border-purple-900 hover:bg-purple-800/40 transition-colors flex items-center"
                                title="View details"
                              >
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                </svg>
                                {selectedChallenge?.id === collection.id ? 'Hide' : 'View'}
                              </button>
                            </td>
                          </tr>
                          {selectedChallenge?.id === collection.id && (
                            <tr className="animate-fade-in-up">
                              <td colSpan={7} className="border-b border-blue-800 p-0">
                                <div className="bg-[#1d2b3a] border border-blue-800 rounded-lg p-4">
                                  <div className="flex justify-between items-start mb-3">
                                    <h4 className="text-white font-medium">Challenge Details</h4>
                                    <button 
                                      onClick={() => setSelectedChallenge(null)} 
                                      className="text-gray-400 hover:text-white"
                                      title="Hide details"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                      </svg>
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-4">
                                      <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">Basic Info</h5>
                                      <div className="space-y-3">
                                        <div>
                                          <div className="text-gray-400 text-xs">Collection ID</div>
                                          <div className="text-gray-300 font-mono text-sm break-all">{selectedChallenge.id}</div>
                                        </div>
                                        <div>
                                          <div className="text-gray-400 text-xs">Owner ID(s)</div>
                                          <div className="text-gray-300 font-mono text-sm break-all">{Array.isArray(selectedChallenge.ownerId) ? selectedChallenge.ownerId.join(', ') : selectedChallenge.ownerId}</div>
                                        </div>
                                        <div>
                                          <div className="text-gray-400 text-xs">Created At</div>
                                          <div className="text-gray-300 text-sm">{formatDate(selectedChallenge.createdAt)}</div>
                                        </div>
                                         <div>
                                          <div className="text-gray-400 text-xs">Updated At</div>
                                          <div className="text-gray-300 text-sm">{formatDate(selectedChallenge.updatedAt)}</div>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="space-y-4">
                                       <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">Challenge Details</h5>
                                       <div className="space-y-3">
                                         <div>
                                          <div className="text-gray-400 text-xs">Title</div>
                                          <div className="text-white font-medium">{selectedChallenge.challenge?.title || 'N/A'}</div>
                                        </div>
                                        <div>
                                          <div className="text-gray-400 text-xs">Subtitle</div>
                                          <div className="text-gray-300 text-sm">{selectedChallenge.challenge?.subtitle || 'N/A'}</div>
                                        </div>
                                         <div>
                                          <div className="text-gray-400 text-xs">Status</div>
                                          <div className="text-gray-300 text-sm mt-1">
                                            {String(selectedChallenge.challenge?.status) === 'active' ? (
                                              <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded-full text-xs font-medium border border-green-900">Active</span>
                                            ) : String(selectedChallenge.challenge?.status) === 'completed' ? (
                                              <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded-full text-xs font-medium border border-blue-900">Completed</span>
                                            ) : String(selectedChallenge.challenge?.status) === 'published' ? (
                                              <span className="px-2 py-1 bg-yellow-900/30 text-yellow-400 rounded-full text-xs font-medium border border-yellow-900">Published</span>
                                            ) : (
                                              <span className="px-2 py-1 bg-gray-900/30 text-gray-400 rounded-full text-xs font-medium border border-gray-700">{selectedChallenge.challenge?.status || 'N/A'}</span>
                                            )}
                                          </div>
                                        </div>
                                       </div>
                                    </div>
                                    <div className="space-y-4">
                                      <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">Timeline & Participants</h5>
                                      <div className="space-y-3">
                                        <div>
                                          <div className="text-gray-400 text-xs">Start Date</div>
                                          <div className="text-gray-300 text-sm">{formatDate(selectedChallenge.challenge?.startDate)}</div>
                                        </div>
                                        <div>
                                          <div className="text-gray-400 text-xs">End Date</div>
                                          <div className="text-gray-300 text-sm">{formatDate(selectedChallenge.challenge?.endDate)}</div>
                                        </div>
                                        <div>
                                          <div className="text-gray-400 text-xs">Participants</div>
                                          <div className="text-gray-300 text-sm">{selectedChallenge.challenge?.participants?.length || 0}</div>
                                        </div>
                                         {selectedChallenge.challenge?.cohortAuthor && (
                                           <div>
                                             <div className="text-gray-400 text-xs">Cohort Author(s)</div>
                                             <div className="text-gray-300 font-mono text-sm break-all">{selectedChallenge.challenge.cohortAuthor.join(', ')}</div>
                                           </div>
                                         )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Sweatlists Included Section */}
                                  <div className="mt-6">
                                    <h5 className="text-gray-400 text-sm font-medium mb-3 border-b border-gray-700 pb-1">Sweatlists Included</h5>
                                    {selectedChallenge.sweatlistIds && selectedChallenge.sweatlistIds.length > 0 ? (
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {selectedChallenge.sweatlistIds.map((sweatlist: { id: string; sweatlistName: string }, index: number) => (
                                          <div
                                            key={`${sweatlist.id}-${index}`}
                                            className="p-3 rounded-lg border bg-[#262a30] border-gray-700"
                                          >
                                            <div className="flex items-start gap-2">
                                              <div className="h-5 w-5 rounded-full flex items-center justify-center text-xs font-medium bg-gray-700 text-gray-300 flex-shrink-0">
                                                {index + 1}
                                              </div>
                                              <div>
                                                <div className="font-medium text-gray-200 break-all">
                                                  {sweatlist.sweatlistName || 'Unnamed Sweatlist'}
                                                </div>
                                                <div className="text-xs text-gray-400 mt-1 font-mono break-all">
                                                  ID: {sweatlist.id || 'N/A'}-{index}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 text-gray-400 mt-4 p-3 bg-gray-800/30 rounded-lg text-sm">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>No Sweatlists associated with this challenge.</span>
                                      </div>
                                    )}
                                  </div>
                                  {/* End Sweatlists Included Section */}

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

export default ChallengeStatusPage; 