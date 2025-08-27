import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, getDocs, query, orderBy, where, getCountFromServer, doc, updateDoc, serverTimestamp, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { getAuth, getIdToken } from 'firebase/auth';
import { Dumbbell, Video, PlayCircle, RefreshCw, AlertCircle, CheckCircle, Loader2, Eye, XCircle, ImageIcon, Check, X, Search, Filter, Trash2, Copy } from 'lucide-react';
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
  createdAt?: any; // Firestore Timestamp or Date
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
  const [activeSubTab, setActiveSubTab] = useState<'allMoves' | 'reportedContent' | 'videoAudit'>('allMoves');
  const [exercises, setExercises] = useState<ExerciseDisplay[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<ExerciseDisplay[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [totalVideoCount, setTotalVideoCount] = useState<number>(0);
  const [loadingTotalVideoCount, setLoadingTotalVideoCount] = useState(true);
  
  const [reportedItems, setReportedItems] = useState<ReportedItemDisplay[]>([]);
  const [filteredReportedItems, setFilteredReportedItems] = useState<ReportedItemDisplay[]>([]);
  const [loadingReportedItems, setLoadingReportedItems] = useState(true);
  const [pendingReportsCount, setPendingReportsCount] = useState<number>(0);
  const [loadingPendingReportsCount, setLoadingPendingReportsCount] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

  const [selectedExercise, setSelectedExercise] = useState<ExerciseDisplay | null>(null);
  const [exerciseVideos, setExerciseVideos] = useState<ExerciseVideoDisplay[]>([]);
  const [filteredExerciseVideos, setFilteredExerciseVideos] = useState<ExerciseVideoDisplay[]>([]);
  const [loadingExerciseVideos, setLoadingExerciseVideos] = useState(false);

  const [isTriggeringMOTD, setIsTriggeringMOTD] = useState(false);
  const [updatingItems, setUpdatingItems] = useState<{[reportId: string]: boolean}>({});

  // Search states
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState('');
  const [reportSearchTerm, setReportSearchTerm] = useState('');
  const [videoSearchTerm, setVideoSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [bodyPartFilter, setBodyPartFilter] = useState('');

  // Video audit states
  const [allVideos, setAllVideos] = useState<ExerciseVideoDisplay[]>([]);
  const [filteredAllVideos, setFilteredAllVideos] = useState<ExerciseVideoDisplay[]>([]);
  const [loadingAllVideos, setLoadingAllVideos] = useState(true);
  const [orphanedVideos, setOrphanedVideos] = useState<ExerciseVideoDisplay[]>([]);
  const [allVideoSearchTerm, setAllVideoSearchTerm] = useState('');
  const [showOrphanedOnly, setShowOrphanedOnly] = useState(false);
  const [deletingVideos, setDeletingVideos] = useState<{[videoId: string]: boolean}>({});

  // Show/hide toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Filter exercises based on search term, category, and body part
  useEffect(() => {
    let filtered = exercises;

    if (exerciseSearchTerm) {
      filtered = filtered.filter(exercise =>
        exercise.name.toLowerCase().includes(exerciseSearchTerm.toLowerCase()) ||
        exercise.id.toLowerCase().includes(exerciseSearchTerm.toLowerCase())
      );
    }

    if (categoryFilter) {
      filtered = filtered.filter(exercise => {
        const category = typeof exercise.category === 'string' 
          ? exercise.category 
          : (exercise.category as { id?: string })?.id || '';
        return category.toLowerCase().includes(categoryFilter.toLowerCase());
      });
    }

    if (bodyPartFilter) {
      filtered = filtered.filter(exercise =>
        exercise.primaryBodyParts?.some(part =>
          part.toLowerCase().includes(bodyPartFilter.toLowerCase())
        )
      );
    }

    setFilteredExercises(filtered);
  }, [exercises, exerciseSearchTerm, categoryFilter, bodyPartFilter]);

  // Filter reported items based on search term
  useEffect(() => {
    let filtered = reportedItems;

    if (reportSearchTerm) {
      filtered = filtered.filter(item =>
        (item.exerciseName?.toLowerCase().includes(reportSearchTerm.toLowerCase())) ||
        (item.reporterUsername?.toLowerCase().includes(reportSearchTerm.toLowerCase())) ||
        (item.videoOwnerUsername?.toLowerCase().includes(reportSearchTerm.toLowerCase())) ||
        (item.message?.toLowerCase().includes(reportSearchTerm.toLowerCase()))
      );
    }

    setFilteredReportedItems(filtered);
  }, [reportedItems, reportSearchTerm]);

  // Filter exercise videos based on search term
  useEffect(() => {
    let filtered = exerciseVideos;

    if (videoSearchTerm) {
      filtered = filtered.filter(video =>
        (video.username?.toLowerCase().includes(videoSearchTerm.toLowerCase())) ||
        (video.id.toLowerCase().includes(videoSearchTerm.toLowerCase()))
      );
    }

    setFilteredExerciseVideos(filtered);
  }, [exerciseVideos, videoSearchTerm]);

  // Filter all videos based on search term and orphaned filter
  useEffect(() => {
    let filtered = allVideos;

    if (showOrphanedOnly) {
      filtered = orphanedVideos;
    }

    if (allVideoSearchTerm) {
      filtered = filtered.filter(video =>
        (video.username?.toLowerCase().includes(allVideoSearchTerm.toLowerCase())) ||
        (video.id.toLowerCase().includes(allVideoSearchTerm.toLowerCase())) ||
        (video.exerciseId?.toLowerCase().includes(allVideoSearchTerm.toLowerCase()))
      );
    }

    setFilteredAllVideos(filtered);
  }, [allVideos, orphanedVideos, allVideoSearchTerm, showOrphanedOnly]);

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
      setFilteredExercises(fetchedExercises);
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
      setFilteredReportedItems(fetchedItems);
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

  const fetchAllVideos = useCallback(async () => {
    console.log('[MoveManagement] Fetching all videos for audit...');
    setLoadingAllVideos(true);
    try {
      const videosRef = collection(db, 'exerciseVideos');
      const q = query(videosRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const fetchedVideos = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          exerciseId: data.exerciseId,
          videoURL: data.videoURL,
          thumbnail: data.thumbnail,
          username: data.username,
          createdAt: data.createdAt,
          // Add other fields as needed
        } as ExerciseVideoDisplay;
      });

      setAllVideos(fetchedVideos);
      setFilteredAllVideos(fetchedVideos);

      // Detect orphaned videos (videos without corresponding exercises)
      const exerciseIds = new Set(exercises.map(ex => ex.id));
      const orphaned = fetchedVideos.filter(video => 
        video.exerciseId && !exerciseIds.has(video.exerciseId)
      );
      setOrphanedVideos(orphaned);

      console.log(`[MoveManagement] Fetched ${fetchedVideos.length} videos, ${orphaned.length} orphaned.`);
    } catch (err) {
      console.error('[MoveManagement] Error fetching all videos:', err);
      setError(prev => prev ? `${prev} | Failed to load videos for audit.` : `Failed to load videos for audit. ${err instanceof Error ? err.message : 'Unknown error'}`);
      setAllVideos([]);
      setFilteredAllVideos([]);
      setOrphanedVideos([]);
    } finally {
      setLoadingAllVideos(false);
    }
  }, [exercises]);

  useEffect(() => {
    fetchExercises();
    fetchTotalVideoCount();
    fetchReportedExercises();
  }, [fetchExercises, fetchTotalVideoCount, fetchReportedExercises]);

  // Fetch all videos when exercises are loaded (for orphan detection)
  useEffect(() => {
    if (exercises.length > 0) {
      fetchAllVideos();
    }
  }, [exercises, fetchAllVideos]);

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
              createdAt: data.createdAt,
              // Add other fields if needed
          } as ExerciseVideoDisplay;
      });
      setExerciseVideos(fetchedVideos);
      setFilteredExerciseVideos(fetchedVideos);
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

  const handleDeleteVideo = async (videoId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this video? This action cannot be undone.")) {
      return;
    }

    setDeletingVideos(prev => ({ ...prev, [videoId]: true }));
    setToastMessage({ type: 'info', text: 'Deleting video...' });
    
    try {
      const videoRef = doc(db, 'exerciseVideos', videoId);
      await deleteDoc(videoRef);

      // Remove from all video states
      setAllVideos(prevVideos => prevVideos.filter(video => video.id !== videoId));
      setFilteredAllVideos(prevVideos => prevVideos.filter(video => video.id !== videoId));
      setOrphanedVideos(prevVideos => prevVideos.filter(video => video.id !== videoId));

      // Update total video count
      setTotalVideoCount(prev => Math.max(0, prev - 1));

      setToastMessage({ type: 'success', text: 'Video deleted successfully.' });
    } catch (err) {
      console.error('[MoveManagement] Error deleting video:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error.';
      setToastMessage({ type: 'error', text: `Failed to delete video: ${errorMessage}` });
    } finally {
      setDeletingVideos(prev => ({ ...prev, [videoId]: false }));
    }
  };

  const handleCopyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToastMessage({ type: 'success', text: `${label} copied to clipboard!` });
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      setToastMessage({ type: 'error', text: `Failed to copy ${label.toLowerCase()}` });
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
                  <p className="text-sm text-gray-400">({filteredExerciseVideos.length} of {exerciseVideos.length} video{exerciseVideos.length !== 1 ? 's' : ''} shown)</p>
               </div>
            </div>
            <button
              onClick={() => {
                setSelectedExercise(null);
                setVideoSearchTerm(''); // Clear video search when closing modal
              }}
              className="p-1 text-gray-400 hover:text-white transition"
              title="Close video view"
            >
              <XCircle className="h-6 w-6" />
            </button>
          </div>
          
          {/* Video Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search videos by username or ID..."
                value={videoSearchTerm}
                onChange={(e) => setVideoSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] focus:border-transparent text-sm"
              />
            </div>
          </div>
          
          <div className="flex-grow overflow-y-auto pr-2">
            {loadingExerciseVideos ? (
              <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 text-[#d7ff00] animate-spin" /></div>
            ) : filteredExerciseVideos.length === 0 && exerciseVideos.length === 0 ? (
               <div className="text-center py-10 text-gray-400">
                  <Video className="h-10 w-10 mx-auto mb-3 text-gray-600" />
                  <p>No videos found for this exercise.</p>
               </div>
            ) : filteredExerciseVideos.length === 0 && exerciseVideos.length > 0 ? (
               <div className="text-center py-10 text-gray-400">
                  <Search className="h-10 w-10 mx-auto mb-3 text-gray-600" />
                  <p>No videos match your search criteria.</p>
                  <p className="text-gray-500 text-sm mt-2">Try adjusting your search terms.</p>
               </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredExerciseVideos.map(video => (
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
                      <p className="text-xs text-gray-400 mb-2">Uploaded by: {video.username || 'Unknown'}</p>
                      <div className="mb-2">
                        <p className="text-xs text-gray-500 mb-1">Video ID:</p>
                        <div className="flex items-center gap-2 p-2 bg-[#1a1e24] rounded border border-gray-600">
                          <p className="text-xs text-gray-300 font-mono flex-1 break-all">{video.id}</p>
                          <button
                            onClick={() => handleCopyToClipboard(video.id, 'Video ID')}
                            className="p-1 text-gray-400 hover:text-[#d7ff00] transition-colors flex-shrink-0"
                            title="Copy video ID"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
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
                onClick={() => {
                  setSelectedExercise(null);
                  setVideoSearchTerm(''); // Clear video search when closing modal
                }}
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
        <title>Exercise Database | Pulse Admin</title>
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
              Exercise Database
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

          {/* Search and Filter Section */}
          <div className="mb-6 p-4 bg-[#262a30] rounded-xl border border-gray-700">
            {activeSubTab === 'allMoves' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <Search className="h-5 w-5 text-[#d7ff00]" />
                  <h3 className="text-lg font-semibold text-white">Search & Filter Exercises</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Search by Name or ID</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Enter exercise name or ID..."
                        value={exerciseSearchTerm}
                        onChange={(e) => setExerciseSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-[#1a1e24] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Filter by Category</label>
                    <div className="relative">
                      <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Enter category..."
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-[#1a1e24] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Filter by Body Part</label>
                    <div className="relative">
                      <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Enter body part..."
                        value={bodyPartFilter}
                        onChange={(e) => setBodyPartFilter(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-[#1a1e24] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
                {(exerciseSearchTerm || categoryFilter || bodyPartFilter) && (
                  <div className="flex items-center justify-between pt-2 border-t border-gray-600">
                    <p className="text-sm text-gray-400">
                      Showing {filteredExercises.length} of {exercises.length} exercises
                    </p>
                    <button
                      onClick={() => {
                        setExerciseSearchTerm('');
                        setCategoryFilter('');
                        setBodyPartFilter('');
                      }}
                      className="text-sm text-[#d7ff00] hover:text-[#b8d400] transition-colors"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            ) : activeSubTab === 'reportedContent' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <Search className="h-5 w-5 text-[#d7ff00]" />
                  <h3 className="text-lg font-semibold text-white">Search Reported Content</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Search Reports</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search by exercise name, reporter, video owner, or reason..."
                        value={reportSearchTerm}
                        onChange={(e) => setReportSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-[#1a1e24] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
                {reportSearchTerm && (
                  <div className="flex items-center justify-between pt-2 border-t border-gray-600">
                    <p className="text-sm text-gray-400">
                      Showing {filteredReportedItems.length} of {reportedItems.length} reports
                    </p>
                    <button
                      onClick={() => setReportSearchTerm('')}
                      className="text-sm text-[#d7ff00] hover:text-[#b8d400] transition-colors"
                    >
                      Clear search
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <Search className="h-5 w-5 text-[#d7ff00]" />
                  <h3 className="text-lg font-semibold text-white">Search & Filter Videos</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Search Videos</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search by username, video ID, or exercise ID..."
                        value={allVideoSearchTerm}
                        onChange={(e) => setAllVideoSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-[#1a1e24] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Filter Options</label>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="showOrphanedOnly"
                        checked={showOrphanedOnly}
                        onChange={(e) => setShowOrphanedOnly(e.target.checked)}
                        className="mr-2 h-4 w-4 text-[#d7ff00] bg-[#1a1e24] border-gray-600 rounded focus:ring-[#d7ff00] focus:ring-2"
                      />
                      <label htmlFor="showOrphanedOnly" className="text-sm text-gray-300">
                        Show orphaned videos only ({orphanedVideos.length})
                      </label>
                    </div>
                  </div>
                </div>
                {(allVideoSearchTerm || showOrphanedOnly) && (
                  <div className="flex items-center justify-between pt-2 border-t border-gray-600">
                    <p className="text-sm text-gray-400">
                      Showing {filteredAllVideos.length} of {allVideos.length} videos
                    </p>
                    <button
                      onClick={() => {
                        setAllVideoSearchTerm('');
                        setShowOrphanedOnly(false);
                      }}
                      className="text-sm text-[#d7ff00] hover:text-[#b8d400] transition-colors"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            )}
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
            <button 
              onClick={() => setActiveSubTab('videoAudit')}
              className={`py-2 px-4 text-sm font-medium transition-colors rounded-t-md flex items-center gap-2 ${activeSubTab === 'videoAudit' ? 'bg-[#262a30] text-[#d7ff00] border-x border-t border-gray-700' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'}`}
            >
              <Video className="h-4 w-4" /> Video Audit
              { !loadingAllVideos && orphanedVideos.length > 0 && (
                <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-red-500/80 text-white font-semibold">
                  {orphanedVideos.length}
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
            ) : filteredExercises.length === 0 && exercises.length === 0 && !error ? (
              <div className="bg-[#1a1e24] p-8 rounded-lg border border-gray-700 text-center">
                <Dumbbell className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400 text-lg">No exercises found in the database.</p>
              </div>
            ) : filteredExercises.length === 0 && exercises.length > 0 ? (
              <div className="bg-[#1a1e24] p-8 rounded-lg border border-gray-700 text-center">
                <Search className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400 text-lg">No exercises match your search criteria.</p>
                <p className="text-gray-500 text-sm mt-2">Try adjusting your search terms or filters.</p>
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
                    {filteredExercises.map((exercise) => (
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
            ) : filteredReportedItems.length === 0 && reportedItems.length === 0 && !error ? (
              <div className="bg-[#1a1e24] p-8 rounded-lg border border-gray-700 text-center rounded-t-none">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400 text-lg">No reported content found.</p>
              </div>
            ) : filteredReportedItems.length === 0 && reportedItems.length > 0 ? (
              <div className="bg-[#1a1e24] p-8 rounded-lg border border-gray-700 text-center rounded-t-none">
                <Search className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400 text-lg">No reports match your search criteria.</p>
                <p className="text-gray-500 text-sm mt-2">Try adjusting your search terms.</p>
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
                    {filteredReportedItems.map((item) => (
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

          {activeSubTab === 'videoAudit' && (
            loadingAllVideos ? (
              <div className="flex justify-center items-center py-20"><Loader2 className="h-10 w-10 text-[#d7ff00] animate-spin" /></div>
            ) : filteredAllVideos.length === 0 && allVideos.length === 0 && !error ? (
              <div className="bg-[#1a1e24] p-8 rounded-lg border border-gray-700 text-center rounded-t-none">
                <Video className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400 text-lg">No videos found in the database.</p>
              </div>
            ) : filteredAllVideos.length === 0 && allVideos.length > 0 ? (
              <div className="bg-[#1a1e24] p-8 rounded-lg border border-gray-700 text-center rounded-t-none">
                <Search className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400 text-lg">No videos match your search criteria.</p>
                <p className="text-gray-500 text-sm mt-2">Try adjusting your search terms or filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto bg-[#1a1e24] rounded-xl shadow-xl border border-gray-800 rounded-t-none">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="py-3 px-5 text-left text-xs text-gray-400 font-semibold uppercase tracking-wider">Thumbnail</th>
                      <th className="py-3 px-5 text-left text-xs text-gray-400 font-semibold uppercase tracking-wider">Video ID</th>
                      <th className="py-3 px-5 text-left text-xs text-gray-400 font-semibold uppercase tracking-wider">Exercise ID</th>
                      <th className="py-3 px-5 text-left text-xs text-gray-400 font-semibold uppercase tracking-wider">Username</th>
                      <th className="py-3 px-5 text-left text-xs text-gray-400 font-semibold uppercase tracking-wider">Status</th>
                      <th className="py-3 px-5 text-left text-xs text-gray-400 font-semibold uppercase tracking-wider">Created At</th>
                      <th className="py-3 px-5 text-center text-xs text-gray-400 font-semibold uppercase tracking-wider">Video</th>
                      <th className="py-3 px-5 text-center text-xs text-gray-400 font-semibold uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {filteredAllVideos.map((video) => {
                      const isOrphaned = orphanedVideos.some(orphan => orphan.id === video.id);
                      return (
                        <tr key={video.id} className={`hover:bg-[#20252c] transition-colors ${isOrphaned ? 'bg-red-800/10' : ''}`}>
                          <td className="py-4 px-5">
                            <div className="w-16 h-12 bg-black rounded flex items-center justify-center overflow-hidden">
                              {video.thumbnail ? (
                                <img src={video.thumbnail} alt="Video thumbnail" className="object-cover w-full h-full" />
                              ) : (
                                <ImageIcon className="h-6 w-6 text-gray-500" />
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-300 font-mono">{video.id.substring(0, 12)}...</span>
                              <button
                                onClick={() => handleCopyToClipboard(video.id, 'Video ID')}
                                className="p-1 text-gray-400 hover:text-[#d7ff00] transition-colors"
                                title={`Copy full video ID: ${video.id}`}
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                          <td className="py-4 px-5">
                            {video.exerciseId ? (
                              <div className="flex items-center gap-2">
                                <span className={`text-sm ${isOrphaned ? 'text-red-400' : 'text-gray-300'}`}>
                                  {video.exerciseId}
                                </span>
                                <button
                                  onClick={() => handleCopyToClipboard(video.exerciseId, 'Exercise ID')}
                                  className="p-1 text-gray-400 hover:text-[#d7ff00] transition-colors"
                                  title={`Copy exercise ID: ${video.exerciseId}`}
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-500 text-sm">N/A</span>
                            )}
                          </td>
                          <td className="py-4 px-5 text-sm text-gray-300">{video.username || 'N/A'}</td>
                          <td className="py-4 px-5 text-sm">
                            {isOrphaned ? (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-500/80 text-white">
                                Orphaned
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-500/80 text-white">
                                Linked
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-5 text-sm text-gray-400">{video.createdAt ? formatDate(video.createdAt) : 'N/A'}</td>
                          <td className="py-4 px-5 text-center">
                            {video.videoURL ? (
                              <a href={video.videoURL} target="_blank" rel="noopener noreferrer"
                                className="px-2.5 py-1.5 rounded-md text-xs font-medium border bg-blue-900/40 text-blue-300 border-blue-800 hover:bg-blue-800/60 transition-colors flex items-center mx-auto gap-1.5"
                              >
                                <PlayCircle className="h-3.5 w-3.5" /> View
                              </a>
                            ) : (
                              <span className="text-xs text-gray-500">No URL</span>
                            )}
                          </td>
                          <td className="py-4 px-5 text-center">
                            <button
                              onClick={() => handleDeleteVideo(video.id)}
                              disabled={deletingVideos[video.id]}
                              className={`p-1.5 rounded-md transition-colors ${
                                deletingVideos[video.id]
                                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                  : 'bg-red-700/80 hover:bg-red-600/80 text-white'
                              }`}
                              title="Delete video permanently"
                            >
                              {deletingVideos[video.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
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