import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, getDocs, query, where, getCountFromServer, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { Dumbbell, Activity, Trophy, AlertCircle, RefreshCw, CheckCircle } from 'lucide-react';
import axios from 'axios'; // Import axios

// Define a type for the tabs
type TabType = 'moves' | 'workouts' | 'rounds';

const ROOT_SESSIONS_COLLECTION = "workout-sessions"; // Define root collection name
const BATCH_LIMIT = 100; // Firestore batch write limit

const MetricsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('moves');
  const [loading, setLoading] = useState<Record<TabType, boolean>>({
    moves: true,
    workouts: true,
    rounds: true,
  });
  const [counts, setCounts] = useState<Record<TabType, number>>({
    moves: 0,
    workouts: 0, // Placeholder initially, updated after sync/fetch
    rounds: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

  // State for manual sync
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState('');
  const [syncError, setSyncError] = useState<string | null>(null);

  // Show/hide toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 5000); // Show toast for 5 seconds
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Fetch count for a given collection
  const fetchCollectionCount = useCallback(async (collectionName: string, tab: TabType, queryConstraints: any[] = []) => {
    try {
      setLoading(prev => ({ ...prev, [tab]: true }));
      setError(null);
      const collRef = collection(db, collectionName);
      const q = query(collRef, ...queryConstraints); // Apply constraints if provided
      const snapshot = await getCountFromServer(q);
      setCounts(prev => ({ ...prev, [tab]: snapshot.data().count }));
      console.log(`[Metrics] Fetched count for ${collectionName}: ${snapshot.data().count}`);
    } catch (err) {
      console.error(`[Metrics] Error fetching count for ${collectionName}:`, err);
      setError(`Failed to load count for ${tab}. ${err instanceof Error ? err.message : 'Unknown error'}`);
      setCounts(prev => ({ ...prev, [tab]: 0 })); // Reset count on error
    } finally {
      setLoading(prev => ({ ...prev, [tab]: false }));
    }
  }, []); // No dependencies needed if db is stable

  // Fetch initial counts
  useEffect(() => {
    fetchCollectionCount('exercises', 'moves');
    fetchCollectionCount('sweatlist-collection', 'rounds');
    // Fetch count from the new root collection - REMOVED isCompleted filter
    fetchCollectionCount(ROOT_SESSIONS_COLLECTION, 'workouts'); 
  }, [fetchCollectionCount]); // Depend on the memoized function

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  // Manual Sync Logic - UPDATED TO CALL NETLIFY FUNCTION
  const handleManualSync = async () => {
    if (!window.confirm("This will trigger a server-side function to sync all workout sessions. This may take some time (up to 15 mins) depending on data volume. Are you sure?")) {
      return;
    }

    setIsSyncing(true);
    setSyncStatusText('Initiating server-side sync...');
    setToastMessage({ type: 'info', text: 'Manual sync requested...' });
    setSyncError(null);

    try {
      console.log("Calling Netlify Function: /.netlify/functions/manual-sync-sessions");

      // --- Call the Netlify Function --- 
      const response = await axios.post('/.netlify/functions/manual-sync-sessions', {}); // Send empty body

      // --- Process Response --- 
      // The Netlify function (as written) attempts to run synchronously and return the final result.
      let resultData = response.data; // Axios wraps response in 'data'
      console.log("Netlify Function response:", resultData);

      if (resultData.success) {
          const message = resultData.message || `Sync finished successfully!`;
          setSyncStatusText(message);
          setToastMessage({ type: 'success', text: message });
          // Refresh counts ONLY if sync completed successfully
          fetchCollectionCount(ROOT_SESSIONS_COLLECTION, 'workouts');
      } else {
           // If the function returns a structured error like { success: false, error: '...' }
           const errorMessage = resultData.error || 'Netlify function reported failure.';
           throw new Error(errorMessage); // Throw to be caught below
      }

    } catch (err: any) {
        console.error('[Manual Sync Call - Netlify] Error:', err);
        let errorMessage = 'Unknown error';
        let statusCode = 500;

         if (axios.isAxiosError(err)) { // Check if it's an Axios error
             statusCode = err.response?.status || 500;
             // Try to get error message from Netlify function's response body
             errorMessage = err.response?.data?.error || err.message || 'Request failed';
             if (statusCode === 409) { // Conflict - Lock held
                 errorMessage = "Sync process is already running. Please wait.";
             }
         } else if (err instanceof Error) { // Standard JS error
             errorMessage = err.message;
         }

        setSyncError(`Manual sync failed: ${errorMessage}`);
        setToastMessage({ type: 'error', text: `Manual sync failed. ${errorMessage}` });
        setSyncStatusText(`Sync failed: ${errorMessage}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const renderTabContent = () => {
    if (loading[activeTab]) {
      return (
        <div className="flex justify-center items-center py-10">
          <svg className="animate-spin h-8 w-8 text-[#d7ff00]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      );
    }

    if (error && activeTab !== 'workouts') { // Don't show generic error for workouts yet
        return (
            <div className="bg-red-900/20 p-4 rounded-lg border border-red-800 text-red-300 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p>{error}</p>
            </div>
        );
    }

    switch (activeTab) {
      case 'moves':
        return (
          <div className="p-6 bg-[#262a30] rounded-lg border border-gray-700">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
              <Dumbbell className="text-[#d7ff00]"/> Total Unique Moves (Exercises)
            </h3>
            <p className="text-4xl font-bold text-[#d7ff00]">{counts.moves}</p>
            {/* TODO: Add table/list of exercises */}
            <p className="text-gray-400 mt-4 text-sm italic">Exercise list/table coming soon...</p>
          </div>
        );
      case 'workouts':
        return (
          <div className="p-6 bg-[#262a30] rounded-lg border border-gray-700">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
              <Activity className="text-[#d7ff00]"/> Total Workout Sessions (All)
            </h3>
            <p className="text-4xl font-bold text-[#d7ff00]">{counts.workouts}</p>
            <div className="mt-4 p-3 bg-blue-900/20 border border-blue-800 rounded-lg text-blue-300 text-sm flex items-center gap-2">
                <AlertCircle className="h-5 w-5 flex-shrink-0"/>
                <span>
                    Note: This count reflects all documents in the <code>{ROOT_SESSIONS_COLLECTION}</code> collection. Ensure the Cloud Function sync is active or run Manual Sync for accuracy.
                </span>
            </div>
            {/* TODO: Add table/list of workouts from flatWorkoutSessions */}
            <p className="text-gray-400 mt-4 text-sm italic">Workout list/table coming soon...</p>
          </div>
        );
      case 'rounds':
        return (
          <div className="p-6 bg-[#262a30] rounded-lg border border-gray-700">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
              <Trophy className="text-[#d7ff00]"/> Total Rounds (Sweatlists)
            </h3>
            <p className="text-4xl font-bold text-[#d7ff00]">{counts.rounds}</p>
            {/* TODO: Add table/list of rounds/sweatlists */}
            <p className="text-gray-400 mt-4 text-sm italic">Rounds/Sweatlist list/table coming soon...</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Metrics Dashboard | Pulse Admin</title>
        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in-up { animation: fadeInUp 0.3s ease-out forwards; }
          @keyframes progressAnimation { from { background-position: 0 0; } to { background-position: 50px 50px; } }
          .animated-progress { background-size: 50px 50px; background-image: linear-gradient( 45deg, rgba(255, 255, 255, 0.15) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0.15) 75%, transparent 75%, transparent ); animation: progressAnimation 1.5s linear infinite; }
        `}</style>
      </Head>

      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-8 flex items-center">
            <span className="text-[#d7ff00] mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                <path fillRule="evenodd" d="M2.25 13.5a8.25 8.25 0 018.25-8.25.75.75 0 01.75.75v6.75H18a.75.75 0 01.75.75 8.25 8.25 0 01-16.5 0z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M12.75 3a.75.75 0 01.75-.75 8.25 8.25 0 018.25 8.25.75.75 0 01-.75.75h-7.5a.75.75 0 01-.75-.75V3z" clipRule="evenodd" />
              </svg>
            </span>
            Metrics Dashboard
          </h1>

          {/* Manual Sync Section - UPDATED UI FEEDBACK */}
          <div className="relative bg-[#1a1e24] rounded-xl p-6 mb-6 shadow-lg border border-blue-800 overflow-hidden">
             <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white mb-1">Manual Workout Sync (Server-Side)</h2>
                  <p className="text-sm text-gray-400 max-w-lg">
                    Run this to trigger a background function that copies existing workout sessions to the root <code>{ROOT_SESSIONS_COLLECTION}</code> collection.
                  </p>
                </div>
                <button
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm ${isSyncing ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-blue-700/80 hover:bg-blue-600/80 text-white'}`}
                >
                  {isSyncing ? (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {isSyncing ? 'Sync Running...' : 'Run Manual Sync'}
                </button>
             </div>
             {/* Simplified Progress Feedback */}
             {isSyncing && (
                <div className="mt-4">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-medium text-blue-300">{syncStatusText}</span>
                         {/* Generic spinner */}
                         <svg className="animate-spin h-4 w-4 text-[#d7ff00]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                         </svg>
                    </div>
                    {/* Removed detailed progress bar */}
                </div>
             )}
              {/* Display error if sync failed */}
             {!isSyncing && syncError && (
                 <div className="mt-4 bg-red-900/20 p-3 rounded-lg border border-red-800 text-red-300 flex items-center gap-2 text-sm">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <span>Sync Error: {syncError}</span>
                 </div>
             )}
          </div>

          <div className="relative bg-[#1a1e24] rounded-xl p-6 mb-6 shadow-xl overflow-hidden">
            {/* Gradient Border */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
            <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-500 via-purple-500 to-[#d7ff00]"></div>

            {/* Tabs */}
            <div className="flex border-b border-gray-700 mb-6">
              {(['moves', 'workouts', 'rounds'] as TabType[]).map((tab) => (
                <button
                  key={tab}
                  className={`py-2 px-4 mr-2 font-medium text-sm transition-colors relative flex items-center gap-2 ${
                    activeTab === tab
                      ? 'text-[#d7ff00]'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  onClick={() => handleTabChange(tab)}
                >
                  {tab === 'moves' && <Dumbbell className="h-4 w-4" />}
                  {tab === 'workouts' && <Activity className="h-4 w-4" />}
                  {tab === 'rounds' && <Trophy className="h-4 w-4" />}
                  <span className="capitalize">{tab}</span>
                  {/* Display count in tab */}
                  {!loading[tab] && (
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                        activeTab === tab ? 'bg-[#d7ff00]/10 text-[#d7ff00]' : 'bg-gray-800 text-gray-300'
                    }`}>
                      {counts[tab]}
                    </span>
                  )}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="animate-fade-in-up">
                {renderTabContent()}
            </div>
          </div>
        </div>
      </div>

       {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-4 right-4 py-2 px-4 rounded-lg shadow-xl flex items-center gap-2 animate-fade-in-up z-50 ${ 
          toastMessage.type === 'success' 
            ? 'bg-green-800/90 border border-green-700 text-white' 
            : toastMessage.type === 'error'
              ? 'bg-red-800/90 border border-red-700 text-white'
              : 'bg-blue-800/90 border border-blue-700 text-white'
        }`}> 
          {toastMessage.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-green-300" />
          ) : toastMessage.type === 'error' ? (
            <AlertCircle className="h-5 w-5 text-red-300" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-300" viewBox="0 0 20 20" fill="currentColor"> <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" /> </svg>
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

    </AdminRouteGuard>
  );
};

export default MetricsDashboard; 