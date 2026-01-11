import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, getDocs, query, orderBy, where, getCountFromServer, doc, updateDoc, serverTimestamp, writeBatch, deleteDoc, getDoc } from 'firebase/firestore';
import { db, storage } from '../../api/firebase/config';
import { ref as storageRef, deleteObject, getMetadata } from 'firebase/storage';
import { getAuth, getIdToken } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Dumbbell, Video, PlayCircle, RefreshCw, AlertCircle, CheckCircle, Loader2, Eye, XCircle, ImageIcon, Check, X, Search, Filter, Trash2, Copy, Sparkles, ArrowUpDown, ChevronDown } from 'lucide-react';
import { convertFirestoreTimestamp } from '../../utils/formatDate';
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
  createdAt?: any; // Firestore Timestamp or Date for sorting
}

interface ExerciseVideoDisplay {
  id: string; // Firestore document ID of the video
  exerciseId: string;
  videoURL: string;
  thumbnail?: string;
  gifURL?: string;
  username?: string;
  createdAt?: any; // Firestore Timestamp or Date
  // Add other fields from your ExerciseVideo class as needed
  fileSizeBytes?: number;
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
  const [activeSubTab, setActiveSubTab] = useState<'allMoves' | 'reportedContent' | 'videoAudit' | 'missingGifs'>('allMoves');
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
  const [settingMOTDForVideo, setSettingMOTDForVideo] = useState<string | null>(null);
  const [updatingItems, setUpdatingItems] = useState<{[reportId: string]: boolean}>({});

  // Search states
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState('');
  const [reportSearchTerm, setReportSearchTerm] = useState('');
  const [videoSearchTerm, setVideoSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [bodyPartFilter, setBodyPartFilter] = useState('');
  // Sort state
  const [sortOption, setSortOption] = useState<'name-asc' | 'name-desc' | 'date-newest' | 'date-oldest'>('name-asc');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  // Available options for dropdowns
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableBodyParts, setAvailableBodyParts] = useState<string[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showBodyPartDropdown, setShowBodyPartDropdown] = useState(false);
  // Creator filter (multi-select)
  const [allCreators, setAllCreators] = useState<string[]>([]);
  const [selectedCreators, setSelectedCreators] = useState<string[]>([]);
  const [creatorSearch, setCreatorSearch] = useState('');
  const [exerciseCreatorsMap, setExerciseCreatorsMap] = useState<Record<string, Set<string>>>({});

  // Video audit states
  const [allVideos, setAllVideos] = useState<ExerciseVideoDisplay[]>([]);
  const [filteredAllVideos, setFilteredAllVideos] = useState<ExerciseVideoDisplay[]>([]);
  const [loadingAllVideos, setLoadingAllVideos] = useState(true);
  const [orphanedVideos, setOrphanedVideos] = useState<ExerciseVideoDisplay[]>([]);
  const [allVideoSearchTerm, setAllVideoSearchTerm] = useState('');
  const [showOrphanedOnly, setShowOrphanedOnly] = useState(false);
  const [showMissingGifOnly, setShowMissingGifOnly] = useState(false);
  const [deletingVideos, setDeletingVideos] = useState<{[videoId: string]: boolean}>({});
  const [deletingExercises, setDeletingExercises] = useState<{[exerciseId: string]: boolean}>({});
  const [generatingGif, setGeneratingGif] = useState<{[videoId: string]: boolean}>({});
  const [normalizingVideos, setNormalizingVideos] = useState<{[videoId: string]: boolean}>({});
  const [inferringBodyParts, setInferringBodyParts] = useState(false);
  const [inferredBodyParts, setInferredBodyParts] = useState<string[] | null>(null);

  // Show/hide toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Extract unique categories and body parts from exercises
  useEffect(() => {
    const categories = new Set<string>();
    const bodyParts = new Set<string>();

    exercises.forEach(exercise => {
      // Extract category
      if (exercise.category) {
        const category = typeof exercise.category === 'string' 
          ? exercise.category 
          : (exercise.category as { id?: string; type?: string })?.id || 
            (exercise.category as { id?: string; type?: string })?.type || '';
        if (category) {
          categories.add(category);
        }
      }

      // Extract body parts
      if (exercise.primaryBodyParts && Array.isArray(exercise.primaryBodyParts)) {
        exercise.primaryBodyParts.forEach(part => {
          if (part && typeof part === 'string') {
            bodyParts.add(part);
          }
        });
      }
    });

    setAvailableCategories(Array.from(categories).sort());
    setAvailableBodyParts(Array.from(bodyParts).sort());
  }, [exercises]);

  // Filter and sort exercises based on search term, category, body part, and sort option
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

    // Filter by selected creators (exercise must have at least one video from any selected creator)
    if (selectedCreators.length > 0) {
      const selectedLower = selectedCreators.map(c => c.toLowerCase());
      filtered = filtered.filter(ex => {
        const creators = exerciseCreatorsMap[ex.id];
        if (!creators || creators.size === 0) return false;
        // case-insensitive intersection
        for (const c of creators) {
          if (selectedLower.includes((c || '').toLowerCase())) return true;
        }
        return false;
      });
    }

    // Helper function to get valid date timestamp (returns 0 for invalid/missing dates)
    const getValidDateTimestamp = (createdAt: any): number => {
      if (!createdAt || createdAt === 0 || createdAt === '0') return 0;
      try {
        const date = convertFirestoreTimestamp(createdAt);
        // Check if date is valid and not suspiciously old (before 2000 = likely invalid)
        if (date instanceof Date && !isNaN(date.getTime()) && date.getFullYear() >= 2000) {
          return date.getTime();
        }
        return 0;
      } catch {
        return 0;
      }
    };

    // Sort exercises based on sort option
    const sorted = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'date-newest': {
          const dateA = getValidDateTimestamp(a.createdAt);
          const dateB = getValidDateTimestamp(b.createdAt);
          // Push exercises without valid dates to the end
          if (dateA === 0 && dateB === 0) return 0;
          if (dateA === 0) return 1;
          if (dateB === 0) return -1;
          return dateB - dateA; // Newest first
        }
        case 'date-oldest': {
          const dateA = getValidDateTimestamp(a.createdAt);
          const dateB = getValidDateTimestamp(b.createdAt);
          // Push exercises without valid dates to the end
          if (dateA === 0 && dateB === 0) return 0;
          if (dateA === 0) return 1;
          if (dateB === 0) return -1;
          return dateA - dateB; // Oldest first
        }
        default:
          return 0;
      }
    });

    setFilteredExercises(sorted);
  }, [exercises, exerciseSearchTerm, categoryFilter, bodyPartFilter, selectedCreators, exerciseCreatorsMap, sortOption]);

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

  // Filter all videos based on search term, orphaned filter, and missing GIF filter
  useEffect(() => {
    let filtered = allVideos;

    if (showOrphanedOnly) {
      filtered = orphanedVideos;
    }

    if (showMissingGifOnly) {
      filtered = filtered.filter(video => !video.gifURL);
    }

    if (allVideoSearchTerm) {
      filtered = filtered.filter(video =>
        (video.username?.toLowerCase().includes(allVideoSearchTerm.toLowerCase())) ||
        (video.id.toLowerCase().includes(allVideoSearchTerm.toLowerCase())) ||
        (video.exerciseId?.toLowerCase().includes(allVideoSearchTerm.toLowerCase()))
      );
    }

    setFilteredAllVideos(filtered);
  }, [allVideos, orphanedVideos, allVideoSearchTerm, showOrphanedOnly, showMissingGifOnly]);

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
          createdAt: data.createdAt, // Store createdAt for sorting
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
          gifURL: data.gifURL,
          videoURL: data.videoURL,
          thumbnail: data.thumbnail,
          username: data.username,
          createdAt: data.createdAt,
          // Add other fields as needed
        } as ExerciseVideoDisplay;
      });

      setAllVideos(fetchedVideos);
      setFilteredAllVideos(fetchedVideos);

      // Build creators index for exercise filter
      const map: Record<string, Set<string>> = {};
      const creatorsSet = new Set<string>();
      for (const v of fetchedVideos) {
        if (!v.exerciseId) continue;
        if (!map[v.exerciseId]) map[v.exerciseId] = new Set<string>();
        const uname = (v.username || '').trim();
        if (uname) {
          map[v.exerciseId].add(uname);
          creatorsSet.add(uname);
        }
      }
      setExerciseCreatorsMap(map);
      setAllCreators(Array.from(creatorsSet).sort((a, b) => a.localeCompare(b)));

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
      const baseVideos = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
              id: doc.id,
              gifURL: data.gifURL,
              exerciseId: data.exerciseId,
              videoURL: data.videoURL,
              thumbnail: data.thumbnail,
              username: data.username,
              createdAt: data.createdAt,
          } as ExerciseVideoDisplay;
      });

      // Best-effort: fetch file sizes from Storage metadata; fallback to HEAD content-length
      const enriched = await Promise.all(
        baseVideos.map(async (v) => {
          try {
            if (v.videoURL && typeof v.videoURL === 'string') {
              // Try Storage metadata (works when using gs:// path or storage path)
              try {
                const ref = storageRef(storage, v.videoURL);
                const metadata = await getMetadata(ref);
                if (typeof metadata.size === 'number') {
                  return { ...v, fileSizeBytes: metadata.size };
                }
              } catch (_) { /* fall through to HEAD */ }

              // Fallback: HEAD request if it's a public https URL
              if (v.videoURL.startsWith('http')) {
                const len = await fetchContentLength(v.videoURL);
                if (typeof len === 'number') {
                  return { ...v, fileSizeBytes: len };
                }
              }
            }
          } catch (e) {
            console.warn('[MoveManagement] Failed to load metadata for', v.id, e);
          }
          return v;
        })
      );

      setExerciseVideos(enriched);
      setFilteredExerciseVideos(enriched);
      // Update video count on the exercise display object
      setExercises(prevExercises => prevExercises.map(ex => 
        ex.id === exerciseId ? { ...ex, videoCount: enriched.length } : ex
      ));
      console.log(`[MoveManagement] Fetched ${enriched.length} videos for exercise ${exerciseId}.`);
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

  const handleSetMoveOfTheDayForVideo = async (exerciseId: string, videoId: string) => {
    if (!exerciseId || !videoId) {
      setToastMessage({ type: 'error', text: 'Missing exerciseId or videoId' });
      return;
    }
    if (!window.confirm('Set this video as today\'s Move of the Day? This will overwrite the current selection.')) return;
    setSettingMOTDForVideo(videoId);
    setToastMessage({ type: 'info', text: 'Setting Move of the Day...' });
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Not signed in');
      const idToken = await getIdToken(currentUser);
      const response = await fetch('/.netlify/functions/manualTriggerMoveOfTheDay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ exerciseId, videoId })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || data.message || 'Failed');
      setToastMessage({ type: 'success', text: data.details?.message || 'Move of the Day updated' });
    } catch (e: any) {
      setToastMessage({ type: 'error', text: `Failed to set Move of the Day: ${e?.message || 'Unknown error'}` });
    } finally {
      setSettingMOTDForVideo(null);
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

      // Fetch video document to get storage URLs/paths
      const videoSnap = await getDoc(videoRef);
      const data: any = videoSnap.exists() ? videoSnap.data() : {};

      // Helper to delete storage object if URL/path is present
      const tryDeleteStorage = async (urlOrPath?: string) => {
        try {
          if (urlOrPath && typeof urlOrPath === 'string' && urlOrPath.trim().length > 0) {
            const ref = storageRef(storage, urlOrPath);
            await deleteObject(ref);
          }
        } catch (e) {
          // Best-effort: log but do not block deletion
          console.warn('[MoveManagement] Failed to delete storage object:', urlOrPath, e);
        }
      };

      // Attempt to delete original, trimmed, gif/thumbnail assets
      await Promise.all([
        tryDeleteStorage(data.originalVideoStoragePath || data.originalVideoUrl),
        tryDeleteStorage(data.videoURL),
        tryDeleteStorage(data.gifURL || data.thumbnail)
      ]);

      // Finally delete the Firestore doc
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

  const handleDeleteExercise = async (exercise: ExerciseDisplay) => {
    if (!window.confirm(`Delete exercise "${exercise.name}" and ALL of its videos? This cannot be undone.`)) {
      return;
    }

    setDeletingExercises(prev => ({ ...prev, [exercise.firestoreDocId]: true }));
    setToastMessage({ type: 'info', text: 'Deleting exercise and related videos...' });

    try {
      // 1) Query all videos linked to this exercise
      const videosRef = collection(db, 'exerciseVideos');
      const q = query(videosRef, where('exerciseId', '==', exercise.id));
      const snapshot = await getDocs(q);

      // 2) Delete each video's storage + doc
      const deletePromises: Promise<any>[] = [];
      snapshot.forEach(d => {
        deletePromises.push(handleDeleteVideo(d.id));
      });
      await Promise.all(deletePromises);

      // 3) Delete the exercise document itself
      const exerciseRef = doc(db, 'exercises', exercise.firestoreDocId);
      await deleteDoc(exerciseRef);

      // 4) Update local state
      setExercises(prev => prev.filter(ex => ex.firestoreDocId !== exercise.firestoreDocId));
      setFilteredExercises(prev => prev.filter(ex => ex.firestoreDocId !== exercise.firestoreDocId));

      setToastMessage({ type: 'success', text: 'Exercise and all related videos deleted.' });
    } catch (err) {
      console.error('[MoveManagement] Error deleting exercise:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error.';
      setToastMessage({ type: 'error', text: `Failed to delete exercise: ${errorMessage}` });
    } finally {
      setDeletingExercises(prev => ({ ...prev, [exercise.firestoreDocId]: false }));
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

  const handleGenerateGifForVideo = async (videoId: string) => {
    if (!videoId) return;

    if (!window.confirm("Generate (or regenerate) a GIF preview for this video? This may take up to a minute.")) {
      return;
    }

    setGeneratingGif(prev => ({ ...prev, [videoId]: true }));
    setToastMessage({ type: 'info', text: 'Generating GIF for this specific video...' });

    try {
      const functionsInstance = getFunctions();
      const generateGifCallable = httpsCallable(functionsInstance, 'generateGifForExerciseVideo');
      console.log('[MoveManagement] Calling generateGifForExerciseVideo for video:', videoId);
      const result = await generateGifCallable({ videoId });
      const data = result.data as { success?: boolean; gifUrl?: string | null; gifURL?: string | null; thumbnailUrl?: string | null; thumbnail?: string | null; message?: string; error?: string };

      console.log('[MoveManagement] generateGifForExerciseVideo result:', data);

      if (!data || data.success === false) {
        throw new Error(data?.message || data?.error || 'GIF generation function reported failure.');
      }

      const gifUrl = data.gifUrl ?? data.gifURL ?? null;
      const thumbnailUrl = data.thumbnailUrl ?? data.thumbnail ?? null;

      // Optimistically update local state so UI reflects new URLs without reload
      setExerciseVideos(prev =>
        prev.map(v =>
          v.id === videoId
            ? {
                ...v,
                gifURL: (gifUrl ?? undefined) || v.gifURL,
                thumbnail: (thumbnailUrl ?? undefined) || v.thumbnail,
              }
            : v
        )
      );
      setFilteredExerciseVideos(prev =>
        prev.map(v =>
          v.id === videoId
            ? {
                ...v,
                gifURL: (gifUrl ?? undefined) || v.gifURL,
                thumbnail: (thumbnailUrl ?? undefined) || v.thumbnail,
              }
            : v
        )
      );

      setToastMessage({
        type: 'success',
        text: gifUrl
          ? 'GIF generated for this video.'
          : 'Thumbnail updated for this video (GIF may not have been generated).',
      });
    } catch (err) {
      console.error('[MoveManagement] Error generating GIF for video:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error during GIF generation.';
      setToastMessage({ type: 'error', text: `GIF generation failed: ${errorMessage}` });
    } finally {
      setGeneratingGif(prev => ({ ...prev, [videoId]: false }));
    }
  };

  const handleNormalizeVideoToMp4 = async (video: ExerciseVideoDisplay) => {
    if (!video?.id) return;

    if (!window.confirm("Set this video's backing file name to .mp4 and update its URL on the ExerciseVideo document? This will copy the file in Storage and may delete the old .webm object.")) {
      return;
    }

    setNormalizingVideos(prev => ({ ...prev, [video.id]: true }));
    setToastMessage({ type: 'info', text: 'Normalizing video file to .mp4...' });

    try {
      const functionsInstance = getFunctions();
      const normalizeCallable = httpsCallable(functionsInstance, 'normalizeExerciseVideoToMp4');
      console.log('[MoveManagement] Calling normalizeExerciseVideoToMp4 for video:', video.id);
      const result = await normalizeCallable({ videoId: video.id });
      const data = result.data as {
        success?: boolean;
        videoURL?: string;
        storagePath?: string;
        message?: string;
        error?: string;
        alreadyMp4?: boolean;
      };

      console.log('[MoveManagement] normalizeExerciseVideoToMp4 result:', data);

      if (!data || data.success === false) {
        throw new Error(data?.message || data?.error || 'Normalization function reported failure.');
      }

      const newUrl = data.videoURL || video.videoURL;

      if (newUrl) {
        setExerciseVideos(prev =>
          prev.map(v =>
            v.id === video.id
              ? {
                  ...v,
                  videoURL: newUrl,
                }
              : v
          )
        );
        setFilteredExerciseVideos(prev =>
          prev.map(v =>
            v.id === video.id
              ? {
                  ...v,
                  videoURL: newUrl,
                }
              : v
          )
        );
      }

      setToastMessage({
        type: 'success',
        text: data.alreadyMp4
          ? 'Video was already using an .mp4 file name.'
          : 'Video file renamed to .mp4 and URL updated.',
      });
    } catch (err) {
      console.error('[MoveManagement] Error normalizing video to mp4:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error during normalization.';
      setToastMessage({ type: 'error', text: `Set as MP4 failed: ${errorMessage}` });
    } finally {
      setNormalizingVideos(prev => ({ ...prev, [video.id]: false }));
    }
  };

  const handleInferBodyParts = async (exercise: ExerciseDisplay, thumbnailUrl?: string) => {
    if (!exercise?.name) {
      setToastMessage({ type: 'error', text: 'Exercise name is required for inference' });
      return;
    }

    setInferringBodyParts(true);
    setInferredBodyParts(null);
    setToastMessage({ type: 'info', text: 'AI is analyzing exercise to infer body parts...' });

    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Not signed in');
      const idToken = await getIdToken(currentUser);

      const response = await fetch('/.netlify/functions/inferExerciseBodyParts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          exerciseId: exercise.firestoreDocId,
          exerciseName: exercise.name,
          thumbnailUrl: thumbnailUrl || null,
          autoUpdate: true, // Automatically update the document
        }),
      });

      const data = await response.json();
      console.log('[MoveManagement] inferExerciseBodyParts result:', data);

      if (data.success && data.bodyParts) {
        setInferredBodyParts(data.bodyParts);
        
        // Update local state to reflect the change
        setExercises(prev => prev.map(ex => 
          ex.firestoreDocId === exercise.firestoreDocId 
            ? { ...ex, primaryBodyParts: data.bodyParts }
            : ex
        ));
        setFilteredExercises(prev => prev.map(ex => 
          ex.firestoreDocId === exercise.firestoreDocId 
            ? { ...ex, primaryBodyParts: data.bodyParts }
            : ex
        ));
        if (selectedExercise?.firestoreDocId === exercise.firestoreDocId) {
          setSelectedExercise({ ...selectedExercise, primaryBodyParts: data.bodyParts });
        }

        setToastMessage({ 
          type: 'success', 
          text: data.updated 
            ? `Body parts updated: ${data.bodyParts.join(', ')}`
            : `Suggested body parts: ${data.bodyParts.join(', ')}`
        });
      } else {
        setToastMessage({ 
          type: 'error', 
          text: data.message || 'Failed to infer body parts' 
        });
      }
    } catch (error: any) {
      console.error('[MoveManagement] Error inferring body parts:', error);
      setToastMessage({ type: 'error', text: `Failed to infer body parts: ${error?.message || 'Unknown error'}` });
    } finally {
      setInferringBodyParts(false);
    }
  };

  // Format date helper - uses convertFirestoreTimestamp to handle seconds vs milliseconds
  const formatDate = (dateValue: any): string => {
    if (!dateValue) return 'N/A';
    
    // Handle explicit 0 values (iOS defaults missing createdAt to 0.0, which results in 1970 dates)
    if (dateValue === 0 || dateValue === '0' || dateValue === 0.0) return 'N/A';
    
    try {
        // Use the utility function that properly handles:
        // - Firestore Timestamp objects (with .toDate())
        // - Unix timestamps in seconds (< 10 billion)
        // - Unix timestamps in milliseconds
        // - Already converted Date objects
        const date = convertFirestoreTimestamp(dateValue);
        if (date instanceof Date && !isNaN(date.getTime())) {
            // Check if the date is suspiciously old (before year 2000)
            // This catches cases where iOS defaulted to 0.0 (Jan 1, 1970)
            if (date.getFullYear() < 2000) {
                return 'N/A';
            }
            return date.toLocaleString();
        }
        return 'Invalid Date';
    } catch (e) {
        return 'Invalid Date';
    }
  };

  // Human-readable bytes formatter
  const formatBytes = (bytes?: number): string => {
    if (bytes == null || isNaN(bytes)) return '—';
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
  };

  // Attempt to read Content-Length via HEAD for public URLs
  const fetchContentLength = async (url?: string): Promise<number | undefined> => {
    if (!url || typeof url !== 'string') return undefined;
    try {
      const res = await fetch(url, { method: 'HEAD' });
      const len = res.headers.get('content-length');
      if (len) {
        const parsed = parseInt(len, 10);
        if (!isNaN(parsed)) return parsed;
      }
    } catch (e) {
      // ignore; best-effort fallback only
    }
    return undefined;
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
                  {selectedExercise.primaryBodyParts && selectedExercise.primaryBodyParts.length > 0 ? (
                    <p className="text-xs text-green-400 mt-1">
                      Body parts: {selectedExercise.primaryBodyParts.join(', ')}
                    </p>
                  ) : (
                    <p className="text-xs text-orange-400 mt-1">No body parts assigned</p>
                  )}
               </div>
            </div>
            <div className="flex items-center gap-2">
              {/* AI Infer Body Parts Button */}
              <button
                onClick={() => {
                  // Use the first video's thumbnail if available
                  const thumbnail = exerciseVideos[0]?.thumbnail;
                  handleInferBodyParts(selectedExercise, thumbnail);
                }}
                disabled={inferringBodyParts}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  inferringBodyParts
                    ? 'bg-purple-900/30 text-purple-400 cursor-wait'
                    : 'bg-purple-900/50 text-purple-200 border border-purple-700 hover:bg-purple-800/70'
                }`}
                title="Use AI to infer and update the primary body parts for this exercise"
              >
                {inferringBodyParts ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Inferring...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Infer Body Parts
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setSelectedExercise(null);
                  setVideoSearchTerm(''); // Clear video search when closing modal
                  setInferredBodyParts(null); // Clear inferred body parts
                }}
                className="p-1 text-gray-400 hover:text-white transition"
                title="Close video view"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
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
                      <p className="text-xs text-gray-400 mb-2">File size: {formatBytes(video.fileSizeBytes)}</p>
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
                      <div className="mb-2">
                        <p className="text-xs text-gray-500 mb-1">GIF URL:</p>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 p-2 bg-[#1a1e24] rounded border border-gray-600">
                            <p className="text-xs text-gray-300 font-mono flex-1 break-all">
                              {video.gifURL || 'No GIF URL set'}
                            </p>
                            {video.gifURL ? (
                              <button
                                onClick={() => handleCopyToClipboard(video.gifURL || '', 'GIF URL')}
                                className="p-1 text-gray-400 hover:text-[#d7ff00] transition-colors flex-shrink-0"
                                title="Copy GIF URL"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            ) : null}
                          </div>
                          {!video.gifURL && (
                            <button
                              onClick={() => handleGenerateGifForVideo(video.id)}
                              disabled={!!generatingGif[video.id]}
                              className={`inline-flex items-center justify-center px-2.5 py-1.5 rounded-md text-[11px] font-medium border transition-colors ${
                                generatingGif[video.id]
                                  ? 'bg-gray-700/60 text-gray-400 border-gray-600 cursor-wait'
                                  : 'bg-purple-900/50 text-purple-200 border-purple-700 hover:bg-purple-800/70'
                              }`}
                              title="Manually generate a GIF preview for this video"
                            >
                              {generatingGif[video.id] ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Generating GIF...
                                </>
                              ) : (
                                'Generate GIF'
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mb-2">
                        <p className="text-xs text-gray-500 mb-1">Video URL:</p>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 p-2 bg-[#1a1e24] rounded border border-gray-600">
                            <p className="text-xs text-gray-300 font-mono flex-1 break-all">
                              {video.videoURL || 'No video URL set'}
                            </p>
                            {video.videoURL && (
                              <button
                                onClick={() => handleCopyToClipboard(video.videoURL || '', 'Video URL')}
                                className="p-1 text-gray-400 hover:text-[#d7ff00] transition-colors flex-shrink-0"
                                title="Copy video URL"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                          {video.videoURL && video.videoURL.includes('.webm') && (
                            <button
                              onClick={() => handleNormalizeVideoToMp4(video)}
                              disabled={!!normalizingVideos[video.id]}
                              className={`inline-flex items-center justify-center px-2.5 py-1.5 rounded-md text-[11px] font-medium border transition-colors ${
                                normalizingVideos[video.id]
                                  ? 'bg-gray-700/60 text-gray-400 border-gray-600 cursor-wait'
                                  : 'bg-indigo-900/50 text-indigo-200 border-indigo-700 hover:bg-indigo-800/70'
                              }`}
                              title="Rename backing file to .mp4 and update ExerciseVideo URL"
                            >
                              {normalizingVideos[video.id] ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Setting as MP4...
                                </>
                              ) : (
                                'Set as MP4'
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mb-2">
                        <p className="text-xs text-gray-500 mb-1">Thumbnail URL:</p>
                        <div className="flex items-center gap-2 p-2 bg-[#1a1e24] rounded border border-gray-600">
                          <p className="text-xs text-gray-300 font-mono flex-1 break-all">
                            {video.thumbnail || 'No thumbnail URL set'}
                          </p>
                          {video.thumbnail && (
                            <button
                              onClick={() => handleCopyToClipboard(video.thumbnail || '', 'Thumbnail URL')}
                              className="p-1 text-gray-400 hover:text-[#d7ff00] transition-colors flex-shrink-0"
                              title="Copy thumbnail URL"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Add date if available: <p className="text-xs text-gray-500 mt-1">Date: {formatDate(video.createdAt)}</p> */} 
                      {!video.thumbnail && (
                        <div className="mt-2 flex items-center gap-2">
                          <p className="text-xs text-orange-400 italic">Thumbnail pending</p>
                          <button
                            onClick={() => handleGenerateGifForVideo(video.id)}
                            disabled={!!generatingGif[video.id]}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                              generatingGif[video.id]
                                ? 'bg-gray-700/50 text-gray-400 cursor-wait'
                                : 'bg-orange-900/40 text-orange-300 border border-orange-800 hover:bg-orange-800/60'
                            }`}
                            title="Generate thumbnail and GIF for this video"
                          >
                            {generatingGif[video.id] ? (
                              <>
                                <Loader2 className="h-3 w-3 inline mr-1 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3 w-3 inline mr-1" />
                                Generate Thumbnail
                              </>
                            )}
                          </button>
                        </div>
                      )}
                      <div className="mt-3">
                        <button
                          onClick={() => handleSetMoveOfTheDayForVideo(video.exerciseId, video.id)}
                          disabled={settingMOTDForVideo === video.id}
                          className={`w-full px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${settingMOTDForVideo === video.id ? 'bg-gray-700/50 text-gray-400 border-gray-700 cursor-wait' : 'bg-green-900/40 text-green-300 border-green-800 hover:bg-green-800/60'}`}
                          title="Set this as today\'s Move of the Day"
                        >
                          {settingMOTDForVideo === video.id ? 'Setting...' : 'Set Move of the Day'}
                        </button>
                      </div>
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
                  setInferredBodyParts(null); // Clear inferred body parts
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                      <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                      <input
                        type="text"
                        placeholder="Enter category..."
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        onFocus={() => setShowCategoryDropdown(true)}
                        onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 200)}
                        className="w-full pl-10 pr-4 py-2 bg-[#1a1e24] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] focus:border-transparent"
                      />
                      {/* Category dropdown */}
                      {(showCategoryDropdown || categoryFilter) && (
                        <div className="absolute z-20 mt-1 w-full bg-[#1a1e24] border border-gray-700 rounded-lg max-h-40 overflow-y-auto shadow-lg">
                          {availableCategories
                            .filter(cat => 
                              !categoryFilter || 
                              cat.toLowerCase().includes(categoryFilter.toLowerCase())
                            )
                            .slice(0, 20)
                            .map(cat => (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => {
                                  setCategoryFilter(cat);
                                  setShowCategoryDropdown(false);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-[#262a30] focus:bg-[#262a30] focus:outline-none"
                              >
                                {cat}
                              </button>
                            ))}
                          {availableCategories.filter(cat => 
                            !categoryFilter || 
                            cat.toLowerCase().includes(categoryFilter.toLowerCase())
                          ).length === 0 && (
                            <div className="px-3 py-2 text-sm text-gray-500">No categories found</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Filter by Body Part</label>
                    <div className="relative">
                      <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                      <input
                        type="text"
                        placeholder="Enter body part..."
                        value={bodyPartFilter}
                        onChange={(e) => setBodyPartFilter(e.target.value)}
                        onFocus={() => setShowBodyPartDropdown(true)}
                        onBlur={() => setTimeout(() => setShowBodyPartDropdown(false), 200)}
                        className="w-full pl-10 pr-4 py-2 bg-[#1a1e24] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] focus:border-transparent"
                      />
                      {/* Body part dropdown */}
                      {(showBodyPartDropdown || bodyPartFilter) && (
                        <div className="absolute z-20 mt-1 w-full bg-[#1a1e24] border border-gray-700 rounded-lg max-h-40 overflow-y-auto shadow-lg">
                          {availableBodyParts
                            .filter(part => 
                              !bodyPartFilter || 
                              part.toLowerCase().includes(bodyPartFilter.toLowerCase())
                            )
                            .slice(0, 20)
                            .map(part => (
                              <button
                                key={part}
                                type="button"
                                onClick={() => {
                                  setBodyPartFilter(part);
                                  setShowBodyPartDropdown(false);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-[#262a30] focus:bg-[#262a30] focus:outline-none"
                              >
                                {part}
                              </button>
                            ))}
                          {availableBodyParts.filter(part => 
                            !bodyPartFilter || 
                            part.toLowerCase().includes(bodyPartFilter.toLowerCase())
                          ).length === 0 && (
                            <div className="px-3 py-2 text-sm text-gray-500">No body parts found</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Filter by Creator</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search creators..."
                        value={creatorSearch}
                        onChange={(e) => setCreatorSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-[#1a1e24] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] focus:border-transparent"
                      />
                      {/* Suggestion dropdown */}
                      {creatorSearch && (
                        <div className="absolute z-10 mt-1 w-full bg-[#1a1e24] border border-gray-700 rounded-lg max-h-40 overflow-y-auto">
                          {allCreators
                            .filter(c => c.toLowerCase().includes(creatorSearch.toLowerCase()))
                            .filter(c => !selectedCreators.includes(c))
                            .slice(0, 20)
                            .map(c => (
                              <button
                                key={c}
                                onClick={() => {
                                  setSelectedCreators(prev => [...prev, c]);
                                  setCreatorSearch('');
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-[#262a30]"
                              >
                                {c}
                              </button>
                            ))}
                          {allCreators.filter(c => c.toLowerCase().includes(creatorSearch.toLowerCase())).length === 0 && (
                            <div className="px-3 py-2 text-sm text-gray-500">No creators found</div>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Selected chips */}
                    {selectedCreators.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedCreators.map(c => (
                          <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-blue-900/40 text-blue-300 border border-blue-800">
                            {c}
                            <button
                              onClick={() => setSelectedCreators(prev => prev.filter(x => x !== c))}
                              className="hover:text-[#d7ff00]"
                              title="Remove"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Sort Dropdown */}
                <div className="mt-4 pt-4 border-t border-gray-600">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <ArrowUpDown className="h-4 w-4 text-[#d7ff00]" />
                      <span className="text-sm font-medium text-gray-300">Sort by:</span>
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => setShowSortDropdown(!showSortDropdown)}
                        className="flex items-center gap-2 px-4 py-2 bg-[#1a1e24] border border-gray-600 rounded-lg text-white hover:border-[#d7ff00] transition-colors focus:outline-none focus:ring-2 focus:ring-[#d7ff00] focus:border-transparent"
                      >
                        <span>
                          {sortOption === 'name-asc' && 'Name (A-Z)'}
                          {sortOption === 'name-desc' && 'Name (Z-A)'}
                          {sortOption === 'date-newest' && 'Date (Newest)'}
                          {sortOption === 'date-oldest' && 'Date (Oldest)'}
                        </span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
                      </button>
                      {showSortDropdown && (
                        <div className="absolute z-20 mt-1 w-48 bg-[#1a1e24] border border-gray-700 rounded-lg overflow-hidden shadow-lg">
                          <button
                            onClick={() => { setSortOption('name-asc'); setShowSortDropdown(false); }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-[#262a30] transition-colors ${sortOption === 'name-asc' ? 'text-[#d7ff00] bg-[#262a30]' : 'text-gray-200'}`}
                          >
                            Name (A-Z)
                          </button>
                          <button
                            onClick={() => { setSortOption('name-desc'); setShowSortDropdown(false); }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-[#262a30] transition-colors ${sortOption === 'name-desc' ? 'text-[#d7ff00] bg-[#262a30]' : 'text-gray-200'}`}
                          >
                            Name (Z-A)
                          </button>
                          <button
                            onClick={() => { setSortOption('date-newest'); setShowSortDropdown(false); }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-[#262a30] transition-colors ${sortOption === 'date-newest' ? 'text-[#d7ff00] bg-[#262a30]' : 'text-gray-200'}`}
                          >
                            Date (Newest)
                          </button>
                          <button
                            onClick={() => { setSortOption('date-oldest'); setShowSortDropdown(false); }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-[#262a30] transition-colors ${sortOption === 'date-oldest' ? 'text-[#d7ff00] bg-[#262a30]' : 'text-gray-200'}`}
                          >
                            Date (Oldest)
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {(exerciseSearchTerm || categoryFilter || bodyPartFilter || selectedCreators.length > 0) && (
                  <div className="flex items-center justify-between pt-2 border-t border-gray-600">
                    <p className="text-sm text-gray-400">
                      Showing {filteredExercises.length} of {exercises.length} exercises
                    </p>
                    <button
                      onClick={() => {
                        setExerciseSearchTerm('');
                        setCategoryFilter('');
                        setBodyPartFilter('');
                        setSelectedCreators([]);
                        setCreatorSearch('');
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
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
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
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="showMissingGifOnly"
                          checked={showMissingGifOnly}
                          onChange={(e) => setShowMissingGifOnly(e.target.checked)}
                          className="mr-2 h-4 w-4 text-[#d7ff00] bg-[#1a1e24] border-gray-600 rounded focus:ring-[#d7ff00] focus:ring-2"
                        />
                        <label htmlFor="showMissingGifOnly" className="text-sm text-gray-300">
                          Show videos without GIFs ({allVideos.filter(video => !video.gifURL).length})
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                {(allVideoSearchTerm || showOrphanedOnly || showMissingGifOnly) && (
                  <div className="flex items-center justify-between pt-2 border-t border-gray-600">
                    <p className="text-sm text-gray-400">
                      Showing {filteredAllVideos.length} of {allVideos.length} videos
                    </p>
                    <button
                      onClick={() => {
                        setAllVideoSearchTerm('');
                        setShowOrphanedOnly(false);
                        setShowMissingGifOnly(false);
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
              onClick={() => {
                setActiveSubTab('allMoves');
                setShowMissingGifOnly(false);
              }}
              className={`py-2 px-4 text-sm font-medium transition-colors rounded-t-md flex items-center gap-2 ${activeSubTab === 'allMoves' ? 'bg-[#262a30] text-[#d7ff00] border-x border-t border-gray-700' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'}`}
            >
              <Dumbbell className="h-4 w-4" /> All Exercises
            </button>
            <button 
              onClick={() => {
                setActiveSubTab('reportedContent');
                setShowMissingGifOnly(false);
              }}
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
              onClick={() => {
                setActiveSubTab('videoAudit');
                setShowMissingGifOnly(false);
              }}
              className={`py-2 px-4 text-sm font-medium transition-colors rounded-t-md flex items-center gap-2 ${activeSubTab === 'videoAudit' ? 'bg-[#262a30] text-[#d7ff00] border-x border-t border-gray-700' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'}`}
            >
              <Video className="h-4 w-4" /> Video Audit
              { !loadingAllVideos && orphanedVideos.length > 0 && (
                <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-red-500/80 text-white font-semibold">
                  {orphanedVideos.length}
                </span>
              )}
            </button>
            <button 
              onClick={() => {
                setActiveSubTab('missingGifs');
                setShowMissingGifOnly(true);
              }}
              className={`py-2 px-4 text-sm font-medium transition-colors rounded-t-md flex items-center gap-2 ${activeSubTab === 'missingGifs' ? 'bg-[#262a30] text-[#d7ff00] border-x border-t border-gray-700' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'}`}
            >
              <ImageIcon className="h-4 w-4" /> Missing GIFs
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
                      <th className="py-3 px-5 text-left text-xs text-gray-400 font-semibold uppercase tracking-wider">Created At</th>
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
                        <td className="py-4 px-5 text-sm text-gray-400">
                          {exercise.createdAt ? formatDate(exercise.createdAt) : 'N/A'}
                        </td>
                        <td className="py-4 px-5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedExercise(exercise);
                                fetchExerciseVideos(exercise.id); // Use the correct ID field for querying videos
                              }}
                              className="px-2.5 py-1.5 rounded-md text-xs font-medium border bg-blue-900/40 text-blue-300 border-blue-800 hover:bg-blue-800/60 transition-colors flex items-center gap-1.5"
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
                            <button
                              onClick={() => handleDeleteExercise(exercise)}
                              disabled={!!deletingExercises[exercise.firestoreDocId]}
                              className={`px-2.5 py-1.5 rounded-md text-xs font-medium border ${deletingExercises[exercise.firestoreDocId] ? 'bg-gray-700/50 text-gray-400 border-gray-700 cursor-not-allowed' : 'bg-red-900/40 text-red-300 border-red-800 hover:bg-red-800/60'} transition-colors`}
                              title="Delete exercise and all videos"
                            >
                              {deletingExercises[exercise.firestoreDocId] ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
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

          {(activeSubTab === 'videoAudit' || activeSubTab === 'missingGifs') && (
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
                              <button
                                type="button"
                                onClick={() => {
                                  if (video.exerciseId) {
                                    const exercise = exercises.find(ex => ex.id === video.exerciseId);
                                    
                                    if (exercise) {
                                      setSelectedExercise(exercise);
                                      fetchExerciseVideos(exercise.id);
                                    } else {
                                      // Fallback: open raw video in new tab if we can't resolve the exercise
                                      window.open(video.videoURL, '_blank', 'noopener,noreferrer');
                                    }
                                  } else {
                                    // No exerciseId, open raw video
                                    window.open(video.videoURL, '_blank', 'noopener,noreferrer');
                                  }
                                }}
                                className="px-2.5 py-1.5 rounded-md text-xs font-medium border bg-blue-900/40 text-blue-300 border-blue-800 hover:bg-blue-800/60 transition-colors flex items-center mx-auto gap-1.5"
                              >
                                <PlayCircle className="h-3.5 w-3.5" /> View
                              </button>
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