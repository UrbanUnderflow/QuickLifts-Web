import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, getDocs, query, orderBy, where, getCountFromServer, doc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { getAuth, getIdToken } from 'firebase/auth';
import { Dumbbell, Video, PlayCircle, RefreshCw, AlertCircle, CheckCircle, Loader2, Eye, XCircle, ImageIcon, Check, X } from 'lucide-react';
import { Exercise, ExerciseVideo } from '../../api/firebase/exercise/types'; // Assuming types are here

// Define interfaces for display (can be expanded)
interface ExerciseDisplay {
  firestoreDocId: string;
  id: string; // This should be the actual exercise ID used for linking
  name: string;
  videoCount?: number;
  // Add other fields from your Exercise class as needed
  category?: string | { type: string; details?: any };
  primaryBodyParts?: string[];
}

interface ExerciseVideoDisplay {
  id: string; // Firestore document ID of the video
  exerciseId: string;
  videoURL: string;
  thumbnail?: string;
  username?: string;
  // Add other fields from your ExerciseVideo class as needed
}

interface ReportedItemDisplay {
  id: string; // Report document ID
  exerciseId?: string;
  exerciseName?: string;
  message?: string;
  reportedBy?: string; // UID
  reporterUsername?: string;
  status?: string;
  videoOwnerUserId?: string;
  videoOwnerUsername?: string;
  videoURL?: string;
  createdAt?: any; // Firestore Timestamp or Date
  updatedAt?: any; // Firestore Timestamp or Date
  videoId?: string; // Added to ensure we have the video's Firestore document ID
}

const MoveManagement: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'allMoves' | 'reportedContent'>('allMoves');
  const [exercises, setExercises] = useState<ExerciseDisplay[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [totalVideoCount, setTotalVideoCount] = useState<number>(0);
  const [loadingTotalVideoCount, setLoadingTotalVideoCount] = useState(true);
  
  const [reportedItems, setReportedItems] = useState<ReportedItemDisplay[]>([]);
  const [loadingReportedItems, setLoadingReportedItems] = useState(true);
  const [pendingReportsCount, setPendingReportsCount] = useState<number>(0);
  const [loadingPendingReportsCount, setLoadingPendingReportsCount] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

  const [selectedExercise, setSelectedExercise] = useState<ExerciseDisplay | null>(null);
  const [exerciseVideos, setExerciseVideos] = useState<ExerciseVideoDisplay[]>([]);
  const [loadingExerciseVideos, setLoadingExerciseVideos] = useState(false);

  const [isTriggeringMOTD, setIsTriggeringMOTD] = useState(false);
  const [updatingItems, setUpdatingItems] = useState<{[reportId: string]: boolean}>({});

  // Show/hide toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const fetchExercises = useCallback(async () => {
    console.log('[MoveManagement] Fetching exercises...');
    setLoadingExercises(true);
    setError(null);
    try {
      const exercisesRef = collection(db, 'exercises');
      const q = query(exercisesRef, orderBy('name'));
      const snapshot = await getDocs(q);
      
      const fetchedExercises = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('[MoveManagement] Fetched exercise:', data);
        return {
          firestoreDocId: doc.id,
          id: data.id || doc.id, // Use field 'id' if present, else Firestore doc ID
          name: data.name || 'Unnamed Exercise',
          category: data.category, // Keep original category structure
          primaryBodyParts: data.primaryBodyParts || [],
          // videoCount will be fetched on demand or pre-calculated if needed
        } as ExerciseDisplay;
      });

      setExercises(fetchedExercises);
      console.log(`[MoveManagement] Fetched ${fetchedExercises.length} exercises.`);
    } catch (err) {
      console.error('[MoveManagement] Error fetching exercises:', err);
      setError(`Failed to load exercises. ${err instanceof Error ? err.message : 'Unknown error'}`);
      setExercises([]);
    } finally {
      setLoadingExercises(false);
    }
  }, []);

  const fetchTotalVideoCount = useCallback(async () => {
    console.log('[MoveManagement] Fetching total video count...');
    setLoadingTotalVideoCount(true);
    try {
      const videosRef = collection(db, 'exerciseVideos');
      const snapshot = await getCountFromServer(videosRef);
      setTotalVideoCount(snapshot.data().count);
      console.log(`[MoveManagement] Total video count: ${snapshot.data().count}`);
    } catch (err) {
      console.error('[MoveManagement] Error fetching total video count:', err);
      // setError(`Failed to load total video count. ${err instanceof Error ? err.message : 'Unknown error'}`); 
      // Decide if this error should be prominently displayed or just logged
      setTotalVideoCount(0);
    } finally {
      setLoadingTotalVideoCount(false);
    }
  }, []);

  const fetchReportedExercises = useCallback(async () => {
    console.log('[MoveManagement] Fetching reported exercises...');
    setLoadingReportedItems(true);
    setLoadingPendingReportsCount(true);
    try {
      const reportsRef = collection(db, 'reported-exercises');
      const q = query(reportsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      let pendingCount = 0;
      const fetchedItems = snapshot.docs.map(doc => {
        const data = doc.data();
        if (data.status === 'pending') {
          pendingCount++;
        }
        return {
          id: doc.id,
          ...data,
          videoId: data.videoId, // Explicitly map videoId if it exists in the Firestore document
        } as ReportedItemDisplay;
      });
      setReportedItems(fetchedItems);
      setPendingReportsCount(pendingCount);
      console.log(`[MoveManagement] Fetched ${fetchedItems.length} reported items, ${pendingCount} pending.`);
    } catch (err) {
      console.error('[MoveManagement] Error fetching reported exercises:', err);
      setError(prev => prev ? `${prev} | Failed to load reported content.` : `Failed to load reported content. ${err instanceof Error ? err.message : 'Unknown error'}`);
      setReportedItems([]);
      setPendingReportsCount(0);
    } finally {
      setLoadingReportedItems(false);
      setLoadingPendingReportsCount(false);
    }
  }, []);

  useEffect(() => {
    fetchExercises();
    fetchTotalVideoCount();
    fetchReportedExercises();
  }, [fetchExercises, fetchTotalVideoCount, fetchReportedExercises]);

  const fetchExerciseVideos = useCallback(async (exerciseId: string) => {
    if (!exerciseId) {
        console.warn('[MoveManagement] fetchExerciseVideos called with invalid exerciseId.');
        setExerciseVideos([]);
        return;
    }
    console.log(`[MoveManagement] Fetching videos for exercise ID: ${exerciseId}`);
    setLoadingExerciseVideos(true);
    try {
      const videosRef = collection(db, 'exerciseVideos');
      // Ensure the field name in 'where' matches your Firestore data for linking videos to exercises
      const q = query(videosRef, where('exerciseId', '==', exerciseId), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const fetchedVideos = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
              id: doc.id,
              exerciseId: data.exerciseId,
              videoURL: data.videoURL,
              thumbnail: data.thumbnail,
              username: data.username,
              // Add createdAt or other fields if needed
          } as ExerciseVideoDisplay;
      });
      setExerciseVideos(fetchedVideos);
      // Update video count on the exercise display object
      setExercises(prevExercises => prevExercises.map(ex => 
        ex.id === exerciseId ? { ...ex, videoCount: fetchedVideos.length } : ex
      ));
      console.log(`[MoveManagement] Fetched ${fetchedVideos.length} videos for exercise ${exerciseId}.`);
    } catch (err) {
      console.error(`[MoveManagement] Error fetching videos for exercise ${exerciseId}:`, err);
      setToastMessage({ type: 'error', text: `Failed to load videos. ${err instanceof Error ? err.message : ''}`});
      setExerciseVideos([]);
    } finally {
      setLoadingExerciseVideos(false);
    }
  }, []);

  const handleTriggerMoveOfTheDay = async () => {
    if (!window.confirm("Are you sure you want to manually set today's Move of the Day? This will overwrite any existing selection for today.")) {
      return;
    }
    setIsTriggeringMOTD(true);
    setToastMessage({ type: 'info', text: 'Setting Move of the Day...' });
    
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("No authenticated user found. Please sign in again.");
      }
      const idToken = await getIdToken(currentUser);

      console.log("[MoveManagement] Calling Netlify function 'manualTriggerMoveOfTheDay'...");
      const response = await fetch('/.netlify/functions/manualTriggerMoveOfTheDay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        // body: JSON.stringify({}), // No body needed for this specific function as per current design
      });

      const data = await response.json();
      console.log("[MoveManagement] Netlify function 'manualTriggerMoveOfTheDay' result:", data);

      if (response.ok && data.success) {
        setToastMessage({ type: 'success', text: data.message || data.details?.message || 'Move of the Day set successfully!' });
      } else {
        throw new Error(data.message || data.error || 'Failed to set Move of the Day via Netlify function.');
      }
    } catch (err) {
      console.error('[MoveManagement] Error triggering Move of the Day via Netlify:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error.';
      setToastMessage({ type: 'error', text: `Failed to set Move of the Day: ${errorMessage}` });
    } finally {
      setIsTriggeringMOTD(false);
    }
  };

  const handleMarkAsComplete = async (reportId: string) => {
    setUpdatingItems(prev => ({ ...prev, [reportId]: true }));
    setToastMessage({ type: 'info', text: 'Updating report status...' });
    try {
      const reportRef = doc(db, 'reported-exercises', reportId);
      await updateDoc(reportRef, {
        status: 'completed',
        updatedAt: serverTimestamp(),
      });

      setReportedItems(prevItems =>
        prevItems.map(item =>
          item.id === reportId ? { ...item, status: 'completed', updatedAt: new Date() } : item
        )
      );
      // Re-calculate pending reports count
      setPendingReportsCount(prev => prev > 0 ? prev -1 : 0);

      setToastMessage({ type: 'success', text: 'Report status updated to completed.' });
    } catch (err) {
      console.error('[MoveManagement] Error marking report as complete:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error.';
      setToastMessage({ type: 'error', text: `Failed to update report: ${errorMessage}` });
    } finally {
      setUpdatingItems(prev => ({ ...prev, [reportId]: false }));
    }
  };

  const handleRejectContent = async (reportId: string, videoId?: string) => {
    if (!videoId) {
      setToastMessage({ type: 'error', text: 'Video ID not found for this report. Cannot hide video. Marking report as complete only.' });
      await handleMarkAsComplete(reportId); // Mark report as complete anyway
      return;
    }

    setUpdatingItems(prev => ({ ...prev, [reportId]: true }));
    setToastMessage({ type: 'info', text: 'Rejecting content and updating report...' });
    try {
      const batch = writeBatch(db);

      // 1. Update report status
      const reportRef = doc(db, 'reported-exercises', reportId);
      batch.update(reportRef, {
        status: 'completed',
        updatedAt: serverTimestamp(),
      });

      // 2. Update video visibility
      const videoRef = doc(db, 'exerciseVideos', videoId);
      batch.update(videoRef, {
        visibility: 'rejected', // This type was added to ExerciseVideoVisibility
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      setReportedItems(prevItems =>
        prevItems.map(item =>
          item.id === reportId ? { ...item, status: 'completed', updatedAt: new Date() } : item
        )
      );
      // Re-calculate pending reports count
      setPendingReportsCount(prev => prev > 0 ? prev -1 : 0);
      
      setToastMessage({ type: 'success', text: 'Content hidden and report marked as completed.' });
    } catch (err) {
      console.error('[MoveManagement] Error rejecting content:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error.';
      setToastMessage({ type: 'error', text: `Failed to reject content: ${errorMessage}` });
    } finally {
      setUpdatingItems(prev => ({ ...prev, [reportId]: false }));
    }
  };

  // Format date helper (if needed for video timestamps etc.)
  const formatDate = (dateValue: any): string => {
    if (!dateValue) return 'N/A';
    try {
        const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
        if (date instanceof Date && !isNaN(date.getTime())) {
            return date.toLocaleString();
        }
        return 'Invalid Date';
    } catch (e) {
        return 'Invalid Date';
    }
  };

  // Render Exercise Videos Modal/Section (similar to metrics.tsx)
  const renderExerciseVideoDetails = () => {
    if (!selectedExercise) return null;

    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in-up">
        <div className="bg-[#1a1e24] rounded-xl p-6 shadow-xl border border-[#d7ff00]/30 max-w-4xl w-full max-h-[90vh] flex flex-col">
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
               <Video className="h-6 w-6 text-[#d7ff00]" />
               <div>
                  <h3 className="text-xl font-semibold text-white">Videos for: {selectedExercise.name}</h3>
                  <p className="text-sm text-gray-400">({exerciseVideos.length} video{exerciseVideos.length !== 1 ? 's' : ''} found)</p>
               </div>
            </div>
            <button
              onClick={() => setSelectedExercise(null)} // Close modal
              className="p-1 text-gray-400 hover:text-white transition"
              title="Close video view"
            >
              <XCircle className="h-6 w-6" />
            </button>
          </div>
          <div className="flex-grow overflow-y-auto pr-2">
            {loadingExerciseVideos ? (
              <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 text-[#d7ff00] animate-spin" /></div>
            ) : exerciseVideos.length === 0 ? (
               <div className="text-center py-10 text-gray-400">
                  <Video className="h-10 w-10 mx-auto mb-3 text-gray-600" />
                  <p>No videos found for this exercise.</p>
               </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {exerciseVideos.map(video => (
                  <div key={video.id} className="bg-[#262a30] rounded-lg overflow-hidden border border-gray-700 group">
                    <div className="aspect-video bg-black relative flex items-center justify-center">
                      {video.thumbnail ? (
                        <img src={video.thumbnail} alt={`Thumbnail for ${selectedExercise.name}`} className="object-cover w-full h-full transition-transform group-hover:scale-105" />
                      ) : (
                        <div className="text-gray-500 flex flex-col items-center">
                           <ImageIcon className="h-10 w-10 mb-1" />
                           <span className="text-xs">No thumbnail</span>
                        </div>
                      )}
                      <a href={video.videoURL && !video.videoURL.startsWith('gs://') ? video.videoURL : '#'} target="_blank" rel="noopener noreferrer" className={`absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${!video.videoURL || video.videoURL.startsWith('gs://') ? 'cursor-not-allowed' : ''}`} title={video.videoURL && !video.videoURL.startsWith('gs://') ? 'Watch video' : 'Video URL not public'}>
                        <PlayCircle className="h-12 w-12 text-white/80" />
                      </a>
                    </div>
                    <div className="p-3">
                      <p className="text-xs text-gray-400 mb-1">Uploaded by: {video.username || 'Unknown'}</p>
                      <p className="text-xs text-gray-500 font-mono break-all" title={video.id}>ID: {video.id.substring(0, 12)}...</p>
                      {/* Add date if available: <p className="text-xs text-gray-500 mt-1">Date: {formatDate(video.createdAt)}</p> */} 
                      {!video.thumbnail && <p className="text-xs text-orange-400 mt-1 italic">Thumbnail pending</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
           <div className="mt-6 pt-4 border-t border-gray-700 flex justify-end">
              <button
                onClick={() => setSelectedExercise(null)} // Close modal
                className="px-4 py-2 bg-gray-700/30 text-gray-300 rounded-lg text-sm font-medium border border-gray-700 hover:bg-gray-700/50 transition flex items-center"
              >
                Close
              </button>
           </div>
        </div>
      </div>
    );
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Move Management | Pulse Admin</title>
        <style>{`
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          .animate-fade-in-up { animation: fadeInUp 0.3s ease-out forwards; }
        `}</style>
      </Head>

      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold flex items-center">
              <Dumbbell className="text-[#d7ff00] mr-3 h-7 w-7" />
              Move Management
            </h1>
            <button
              onClick={handleTriggerMoveOfTheDay}
              disabled={isTriggeringMOTD}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm ${isTriggeringMOTD ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-green-700/80 hover:bg-green-600/80 text-white'}`}
              title="Manually select and set today's Move of the Day"
            >
              {isTriggeringMOTD ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {isTriggeringMOTD ? 'Setting MOTD...' : 'Set Today\'s Move'
              }
            </button>
          </div>

          {/* Metric Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Total Unique Exercises Card */}
            <div className="p-6 bg-[#262a30] rounded-xl border border-gray-700 shadow-lg">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-gray-300">
                <Dumbbell className="text-[#d7ff00] h-5 w-5"/> Total Unique Exercises
              </h3>
              {loadingExercises ? (
                <div className="h-10 w-24 bg-gray-700 rounded animate-pulse"></div>
              ) : (
                <p className="text-4xl font-bold text-[#d7ff00]">{exercises.length}</p>
              )}
            </div>

            {/* Total Videos Card */}
            <div className="p-6 bg-[#262a30] rounded-xl border border-gray-700 shadow-lg">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-gray-300">
                <Video className="text-[#d7ff00] h-5 w-5" /> Total Videos
              </h3>
              {loadingTotalVideoCount ? (
                <div className="h-10 w-24 bg-gray-700 rounded animate-pulse"></div>
              ) : (
                <p className="text-4xl font-bold text-[#d7ff00]">{totalVideoCount}</p>
              )}
            </div>

            {/* Pending Reports Card */}
            <div className="p-6 bg-[#262a30] rounded-xl border border-gray-700 shadow-lg md:col-span-1"> {/* Spans 1 col on md, default for others*/}
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-gray-300">
                <AlertCircle className="text-orange-400 h-5 w-5" /> Pending Reports
              </h3>
              {loadingPendingReportsCount ? (
                <div className="h-10 w-24 bg-gray-700 rounded animate-pulse"></div>
              ) : (
                <p className="text-4xl font-bold text-orange-400">{pendingReportsCount}</p>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mb-6 border-b border-gray-700 flex space-x-1">
            <button 
              onClick={() => setActiveSubTab('allMoves')}
              className={`py-2 px-4 text-sm font-medium transition-colors rounded-t-md flex items-center gap-2 ${activeSubTab === 'allMoves' ? 'bg-[#262a30] text-[#d7ff00] border-x border-t border-gray-700' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'}`}
            >
              <Dumbbell className="h-4 w-4" /> All Exercises
            </button>
            <button 
              onClick={() => setActiveSubTab('reportedContent')}
              className={`py-2 px-4 text-sm font-medium transition-colors rounded-t-md flex items-center gap-2 ${activeSubTab === 'reportedContent' ? 'bg-[#262a30] text-[#d7ff00] border-x border-t border-gray-700' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'}`}
            >
              <AlertCircle className="h-4 w-4" /> Reported Content
              { !loadingPendingReportsCount && pendingReportsCount > 0 && (
                <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-orange-500/80 text-white font-semibold">
                  {pendingReportsCount}
                </span>
              )}
            </button>
          </div>

          {error && (
            <div className="bg-red-900/20 p-4 rounded-lg border border-red-800 text-red-300 flex items-center gap-3 mb-6">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p>{error}</p>
            </div>
          )}

          {/* Conditional Table Rendering */}
          {activeSubTab === 'allMoves' && (
            loadingExercises ? (
              <div className="flex justify-center items-center py-20"><Loader2 className="h-10 w-10 text-[#d7ff00] animate-spin" /></div>
            ) : exercises.length === 0 && !error ? (
              <div className="bg-[#1a1e24] p-8 rounded-lg border border-gray-700 text-center">
                <Dumbbell className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400 text-lg">No exercises found in the database.</p>
              </div>
            ) : (
              <div className="overflow-x-auto bg-[#1a1e24] rounded-xl shadow-xl border border-gray-800 rounded-t-none"> {/* Remove top rounding if tab is active */}
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="py-3 px-5 text-left text-xs text-gray-400 font-semibold uppercase tracking-wider">Name</th>
                      <th className="py-3 px-5 text-left text-xs text-gray-400 font-semibold uppercase tracking-wider">Category</th>
                      <th className="py-3 px-5 text-left text-xs text-gray-400 font-semibold uppercase tracking-wider">Primary Body Parts</th>
                      <th className="py-3 px-5 text-center text-xs text-gray-400 font-semibold uppercase tracking-wider">Videos</th>
                      <th className="py-3 px-5 text-left text-xs text-gray-400 font-semibold uppercase tracking-wider">Exercise ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {exercises.map((exercise) => (
                      <tr key={exercise.firestoreDocId} className="hover:bg-[#20252c] transition-colors">
                        <td className="py-4 px-5 text-sm text-white font-medium">{exercise.name}</td>
                        <td className="py-4 px-5 text-sm text-gray-300">
                          {typeof exercise.category === 'string' 
                            ? exercise.category 
                            : (exercise.category as { id?: string })?.id || 'N/A'} 
                        </td>
                        <td className="py-4 px-5 text-sm text-gray-300">
                          {exercise.primaryBodyParts && exercise.primaryBodyParts.length > 0 
                            ? exercise.primaryBodyParts.join(', ')
                            : 'N/A'}
                        </td>
                        <td className="py-4 px-5 text-center">
                          <button
                            onClick={() => {
                              setSelectedExercise(exercise);
                              fetchExerciseVideos(exercise.id); // Use the correct ID field for querying videos
                            }}
                            className="px-2.5 py-1.5 rounded-md text-xs font-medium border bg-blue-900/40 text-blue-300 border-blue-800 hover:bg-blue-800/60 transition-colors flex items-center mx-auto gap-1.5"
                            title="View associated videos"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                            {typeof exercise.videoCount === 'number' && (
                              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${exercise.videoCount > 0 ? 'bg-green-700/50 text-green-300' : 'bg-gray-600 text-gray-300'}`}>
                                {exercise.videoCount}
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="py-4 px-5 text-xs text-gray-500 font-mono">{exercise.id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeSubTab === 'reportedContent' && (
            loadingReportedItems ? (
              <div className="flex justify-center items-center py-20"><Loader2 className="h-10 w-10 text-[#d7ff00] animate-spin" /></div>
            ) : reportedItems.length === 0 && !error ? (
              <div className="bg-[#1a1e24] p-8 rounded-lg border border-gray-700 text-center rounded-t-none">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400 text-lg">No reported content found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto bg-[#1a1e24] rounded-xl shadow-xl border border-gray-800 rounded-t-none">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="py-3 px-5 text-left text-xs text-gray-400 font-semibold uppercase tracking-wider">Exercise Name</th>
                      <th className="py-3 px-5 text-left text-xs text-gray-400 font-semibold uppercase tracking-wider">Reported By</th>
                      <th className="py-3 px-5 text-left text-xs text-gray-400 font-semibold uppercase tracking-wider">Reason</th>
                      <th className="py-3 px-5 text-left text-xs text-gray-400 font-semibold uppercase tracking-wider">Status</th>
                      <th className="py-3 px-5 text-left text-xs text-gray-400 font-semibold uppercase tracking-wider">Date Reported</th>
                      <th className="py-3 px-5 text-left text-xs text-gray-400 font-semibold uppercase tracking-wider">Video Owner</th>
                      <th className="py-3 px-5 text-center text-xs text-gray-400 font-semibold uppercase tracking-wider">Video</th>
                      <th className="py-3 px-5 text-center text-xs text-gray-400 font-semibold uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {reportedItems.map((item) => (
                      <tr key={item.id} className={`hover:bg-[#20252c] transition-colors ${item.status === 'pending' ? 'bg-orange-800/10' : ''}`}>
                        <td className="py-4 px-5 text-sm text-white font-medium">{item.exerciseName || 'N/A'}</td>
                        <td className="py-4 px-5 text-sm text-gray-300">{item.reporterUsername || item.reportedBy || 'N/A'}</td>
                        <td className="py-4 px-5 text-sm text-gray-300 truncate max-w-xs" title={item.message}>{item.message || 'N/A'}</td>
                        <td className="py-4 px-5 text-sm">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${item.status === 'pending' ? 'bg-orange-500/80 text-white' : item.status === 'resolved' ? 'bg-green-500/80 text-white' : 'bg-gray-500/80 text-gray-100'}`}>
                            {item.status || 'N/A'}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-sm text-gray-400">{item.createdAt ? formatDate(item.createdAt) : 'N/A'}</td>
                        <td className="py-4 px-5 text-sm text-gray-300">{item.videoOwnerUsername || item.videoOwnerUserId || 'N/A'}</td>
                        <td className="py-4 px-5 text-center">
                          {item.videoURL ? (
                            <a href={item.videoURL} target="_blank" rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-md text-xs font-medium border bg-blue-900/40 text-blue-300 border-blue-800 hover:bg-blue-800/60 transition-colors flex items-center mx-auto gap-1.5"
                            >
                              <PlayCircle className="h-3.5 w-3.5" /> View Video
                            </a>
                          ) : (
                            <span className="text-xs text-gray-500">No URL</span>
                          )}
                        </td>
                        <td className="py-4 px-5 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => handleMarkAsComplete(item.id)}
                              disabled={updatingItems[item.id] || item.status === 'completed'}
                              className={`p-1.5 rounded-md transition-colors ${
                                updatingItems[item.id]
                                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                  : item.status === 'completed' 
                                    ? 'bg-green-700/30 text-green-500 cursor-not-allowed'
                                    : 'bg-green-700/80 hover:bg-green-600/80 text-white'
                              }`}
                              title={item.status === 'completed' ? "Report already completed" : "Mark as completed"}
                            >
                              {updatingItems[item.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => handleRejectContent(item.id, item.videoId)}
                              disabled={updatingItems[item.id] || item.status === 'completed'}
                              className={`p-1.5 rounded-md transition-colors ${
                                updatingItems[item.id]
                                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                  : item.status === 'completed' 
                                    ? 'bg-red-700/30 text-red-500 cursor-not-allowed' 
                                    : 'bg-red-700/80 hover:bg-red-600/80 text-white'
                              }`}
                              title={item.status === 'completed' ? "Report already completed (Content rejection should be done before marking complete if needed)" : "Hide video & mark report as completed"}
                            >
                              {updatingItems[item.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>

      {/* Exercise Videos Modal */} 
      {selectedExercise && renderExerciseVideoDetails()}

      {/* Toast Notification */} 
      {toastMessage && (
        <div className={`fixed bottom-5 right-5 py-2.5 px-5 rounded-lg shadow-xl flex items-center gap-2.5 animate-fade-in-up z-[100] ${ 
          toastMessage.type === 'success' 
            ? 'bg-green-700/95 border border-green-600 text-white'
            : toastMessage.type === 'error'
              ? 'bg-red-700/95 border border-red-600 text-white'
              : 'bg-blue-700/95 border border-blue-600 text-white'
        }`}>
          {toastMessage.type === 'success' ? (
            <CheckCircle className="h-5 w-5" />
          ) : toastMessage.type === 'error' ? (
            <AlertCircle className="h-5 w-5" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"> <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" /> </svg>
          )}
          <span className="text-sm font-medium">{toastMessage.text}</span>
        </div>
      )}
    </AdminRouteGuard>
  );
};

export default MoveManagement; 