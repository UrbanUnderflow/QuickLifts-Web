import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, getDocs, query, where, getCountFromServer, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { Dumbbell, Activity, Trophy, AlertCircle, RefreshCw, CheckCircle } from 'lucide-react';

// Define a type for the tabs
type TabType = 'moves' | 'workouts' | 'rounds';

const ROOT_SESSIONS_COLLECTION = "workout-sessions"; // Define root collection name
const BATCH_LIMIT = 500; // Firestore batch write limit

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
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncTotalUsers, setSyncTotalUsers] = useState(0);
  const [syncProcessedUsers, setSyncProcessedUsers] = useState(0);
  const [syncTotalSessions, setSyncTotalSessions] = useState(0);
  const [syncStatusText, setSyncStatusText] = useState('');

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
    // Fetch count from the new root collection (will be 0 initially)
    fetchCollectionCount(ROOT_SESSIONS_COLLECTION, 'workouts', [where('isCompleted', '==', true)]); 
  }, [fetchCollectionCount]); // Depend on the memoized function

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  // Manual Sync Logic
  const handleManualSync = async () => {
    if (!window.confirm("This will read all users and their workout sessions, and write them to the root 'workout-sessions' collection. This can be a long and resource-intensive operation. Are you sure you want to proceed?")) {
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0);
    setSyncTotalUsers(0);
    setSyncProcessedUsers(0);
    setSyncTotalSessions(0);
    setSyncStatusText('Starting sync: Fetching users...');
    setToastMessage({ type: 'info', text: 'Manual sync started...' });
    setError(null);

    let currentBatch = writeBatch(db);
    let batchCounter = 0;
    let totalSessionsSynced = 0;

    try {
      // 1. Fetch all user IDs
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(query(usersRef)); // Consider adding select(documentId()) if only IDs are needed initially
      const userIds = usersSnapshot.docs.map(doc => doc.id);
      setSyncTotalUsers(userIds.length);
      setSyncStatusText(`Fetched ${userIds.length} users. Processing workout sessions...`);

      // 2. Iterate through users
      for (let i = 0; i < userIds.length; i++) {
        const userId = userIds[i];
        setSyncProcessedUsers(i + 1);
        setSyncProgress(Math.round(((i + 1) / userIds.length) * 50)); // Progress up to 50% for user processing
        setSyncStatusText(`Processing user ${i + 1}/${userIds.length} (ID: ${userId.substring(0, 5)}...)`);

        // 3. Fetch workoutSessions subcollection for the user
        const sessionsRef = collection(db, 'users', userId, 'workoutSessions');
        const sessionsSnapshot = await getDocs(sessionsRef);

        if (!sessionsSnapshot.empty) {
          // 4. Add each session to the batch
          sessionsSnapshot.docs.forEach(sessionDoc => {
            const sessionId = sessionDoc.id;
            const sessionData = sessionDoc.data();
            const rootSessionRef = doc(db, ROOT_SESSIONS_COLLECTION, sessionId);
            
            // Add userId to the data
            const dataToSync = { 
              ...sessionData,
              userId: userId
            };

            currentBatch.set(rootSessionRef, dataToSync, { merge: true }); // Use merge to handle potential overwrites safely
            batchCounter++;
            totalSessionsSynced++;

            // 5. Commit batch if limit reached
            if (batchCounter >= BATCH_LIMIT) {
              console.log(`Committing batch of ${batchCounter} sessions...`);
              currentBatch.commit(); // Commit the current batch
              currentBatch = writeBatch(db); // Start a new batch
              batchCounter = 0;
              // Optional: Add a small delay to avoid hitting rate limits too hard
              // await new Promise(resolve => setTimeout(resolve, 100)); 
            }
          });
        }
        // Update overall session count after processing each user
        setSyncTotalSessions(totalSessionsSynced);
      }

      // 6. Commit any remaining items in the last batch
      if (batchCounter > 0) {
        console.log(`Committing final batch of ${batchCounter} sessions...`);
        await currentBatch.commit();
      }

      setSyncStatusText(`Sync complete. Processed ${userIds.length} users and synced ${totalSessionsSynced} sessions.`);
      setToastMessage({ type: 'success', text: `Sync finished successfully! ${totalSessionsSynced} sessions synced.` });
      setSyncProgress(100);

      // Refresh the workout count after successful sync
      fetchCollectionCount(ROOT_SESSIONS_COLLECTION, 'workouts', [where('isCompleted', '==', true)]);

    } catch (err) {
      console.error('[Manual Sync] Error:', err);
      setError(`Manual sync failed. ${err instanceof Error ? err.message : 'Unknown error'}`);
      setToastMessage({ type: 'error', text: 'Manual sync failed. Check console for details.' });
      setSyncStatusText(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
              <Activity className="text-[#d7ff00]"/> Total Completed Workouts
            </h3>
            <p className="text-4xl font-bold text-[#d7ff00]">{counts.workouts}</p>
            <div className="mt-4 p-3 bg-blue-900/20 border border-blue-800 rounded-lg text-blue-300 text-sm flex items-center gap-2">
                <AlertCircle className="h-5 w-5 flex-shrink-0"/>
                <span>
                    Note: This count reflects documents in the <code>{ROOT_SESSIONS_COLLECTION}</code> collection where <code>isCompleted</code> is true. Ensure the Cloud Function sync is active or run Manual Sync.
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

          {/* Manual Sync Section */}
          <div className="relative bg-[#1a1e24] rounded-xl p-6 mb-6 shadow-lg border border-blue-800 overflow-hidden">
             <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white mb-1">Manual Workout Sync</h2>
                  <p className="text-sm text-gray-400 max-w-lg">
                    Run this to copy existing workout sessions from all user subcollections to the root <code>{ROOT_SESSIONS_COLLECTION}</code> collection. Use this for initial backfill or if the Cloud Function sync fails. <strong className="text-orange-400">Warning:</strong> May be slow and resource-intensive.
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
                  {isSyncing ? 'Syncing...' : 'Run Manual Sync'}
                </button>
             </div>
             {/* Progress Bar */}
             {isSyncing && (
                <div className="mt-4">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-medium text-blue-300">{syncStatusText}</span>
                        <span className="text-xs font-medium text-[#d7ff00]">{syncProgress}%</span>
                    </div>
                    <div className="w-full bg-[#262a30] rounded-full h-2 mb-1">
                        <div
                        className={`h-2 rounded-full transition-all duration-500 ease-out animated-progress ${error ? 'bg-red-600' : 'bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]'}`}
                        style={{ width: `${syncProgress}%` }}
                        ></div>
                    </div>
                    <div className="text-xs text-gray-400">
                        Users: {syncProcessedUsers}/{syncTotalUsers} | Sessions Synced: {syncTotalSessions}
                    </div>
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