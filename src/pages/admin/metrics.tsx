import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, getDocs, query, where, getCountFromServer, writeBatch, doc, orderBy, limit, Timestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../../api/firebase/config'; // Only import db
import { getFunctions, httpsCallable } from 'firebase/functions'; // Import functions specific methods
import { Dumbbell, Activity, Trophy, AlertCircle, RefreshCw, CheckCircle, Calendar, Clock, User, Eye, XCircle, Video, Image as ImageIcon, PlayCircle, Loader2 } from 'lucide-react'; // Added icons
import axios from 'axios';
import debounce from 'lodash.debounce';
import { Exercise, ExerciseVideo } from '../../api/firebase/exercise/types'; // Import Exercise types

// Define a type for the tabs
type TabType = 'moves' | 'workouts' | 'rounds';

const ROOT_SESSIONS_COLLECTION = "workout-sessions"; // Define root collection name
const WORKOUT_SUMMARIES_COLLECTION = "workout-summaries"; // New collection name
const BATCH_LIMIT = 100; // Firestore batch write limit

// Utility function to correctly convert Firestore timestamps
const convertFirestoreTimestamp = (timestamp: any): Date => {
  // If null or undefined, return the current date.
  if (timestamp == null) return new Date();

  // If it's already a Date, return it.
  if (timestamp instanceof Date) return timestamp;
  
  // If it's a Firestore Timestamp with toDate method
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }

  // Convert to number if it's a string (using parseFloat preserves decimals).
  const numTimestamp = typeof timestamp === 'string' ? parseFloat(timestamp) : timestamp;

  // If the timestamp looks like seconds (less than 10 billion), convert to milliseconds.
  if (numTimestamp < 10000000000) {
    return new Date(numTimestamp * 1000);
  }

  // Otherwise, assume it's in milliseconds.
  return new Date(numTimestamp);
};

// Define a simplified interface for our display needs
interface WorkoutSummaryDisplay {
  id: string;
  userId: string;
  username?: string;
  title?: string;
  workoutId?: string;
  startTime?: Date | Timestamp;
  completedAt?: Date | Timestamp;
  duration?: number;
  isCompleted?: boolean;
  exercises?: number;
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

// Define interface for Exercise display (simplified)
interface ExerciseDisplay {
  id: string;
  name: string;
  videoCount?: number; // Add count of associated videos
  // Add other relevant fields if needed
}

// Define interface for ExerciseVideo display (simplified)
interface ExerciseVideoDisplay {
  id: string;
  exerciseId: string;
  videoURL: string;
  thumbnail?: string; // Make thumbnail optional
  username?: string;
  createdAt?: Date | Timestamp;
  // Add other relevant fields if needed
}

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

  // State for workout summaries
  const [workoutSummaries, setWorkoutSummaries] = useState<WorkoutSummaryDisplay[]>([]);
  const [filteredWorkoutSummaries, setFilteredWorkoutSummaries] = useState<WorkoutSummaryDisplay[]>([]);
  const [loadingWorkoutSummaries, setLoadingWorkoutSummaries] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorkoutSummary, setSelectedWorkoutSummary] = useState<WorkoutSummaryDisplay | null>(null);

  // State for Moves Tab
  const [exercises, setExercises] = useState<ExerciseDisplay[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseDisplay | null>(null);
  const [exerciseVideos, setExerciseVideos] = useState<ExerciseVideoDisplay[]>([]);
  const [loadingExerciseVideos, setLoadingExerciseVideos] = useState(false);
  const [generatingThumbnails, setGeneratingThumbnails] = useState(false);
  const [generationStatusText, setGenerationStatusText] = useState('');
  const [thumbnailCounts, setThumbnailCounts] = useState({ total: 0, withThumbnail: 0 });
  const [loadingThumbnailCounts, setLoadingThumbnailCounts] = useState(true);

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
    console.log(`[Metrics] Entering fetchCollectionCount for ${tab}...`);
    try {
      setLoading(prev => ({ ...prev, [tab]: true }));
      setError(null);
      const collRef = collection(db, collectionName);
      const q = query(collRef, ...queryConstraints);
      console.log(`[Metrics] Executing query for ${collectionName}...`);
      const snapshot = await getCountFromServer(q);
      console.log(`[Metrics] Count query completed for ${collectionName}. Count: ${snapshot.data().count}`);
      setCounts(prev => ({ ...prev, [tab]: snapshot.data().count }));
    } catch (err) {
      console.error(`[Metrics] Error fetching count for ${collectionName}:`, err);
      setError(`Failed to load count for ${tab}. ${err instanceof Error ? err.message : 'Unknown error'}`);
      setCounts(prev => ({ ...prev, [tab]: 0 }));
    } finally {
      console.log(`[Metrics] Entering finally block for fetchCollectionCount (${tab}).`);
      setLoading(prev => ({ ...prev, [tab]: false }));
    }
  }, []); // Empty dependency array

  // Fetch workout summaries
  const fetchWorkoutSummaries = useCallback(async () => {
    console.log('[Metrics] Entering fetchWorkoutSummaries...');
    try {
      setLoadingWorkoutSummaries(true); // Use specific loading state
      setLoading(prev => ({ ...prev, workouts: true })); // Also set general tab loading
      const workoutSummariesRef = collection(db, WORKOUT_SUMMARIES_COLLECTION);
      const q = query(workoutSummariesRef, orderBy('createdAt', 'desc')); 
      console.log('[Metrics] Executing query for workout summaries...');
      const snapshot = await getDocs(q);
      console.log(`[Metrics] Workout summaries query completed. Snapshot size: ${snapshot.size}`);
      
      const summaries = snapshot.docs.map(doc => {
        const data = doc.data();
        const processedData = {
          ...data,
          id: doc.id,
          startTime: data.startTime,
          completedAt: data.completedAt,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        };
        return processedData;
      }) as WorkoutSummaryDisplay[];
      
      setWorkoutSummaries(summaries);
      setFilteredWorkoutSummaries(summaries);
      setCounts(prev => ({ ...prev, workouts: summaries.length }));
      console.log(`[Metrics] Fetched ${summaries.length} workout summaries`);
    } catch (err) {
      console.error(`[Metrics] Error fetching workout summaries:`, err);
      setError(`Failed to load workout summaries. ${err instanceof Error ? err.message : 'Unknown error'}`);
      setWorkoutSummaries([]);
      setFilteredWorkoutSummaries([]);
    } finally {
      console.log('[Metrics] Entering fetchWorkoutSummaries finally block.');
      setLoadingWorkoutSummaries(false);
      setLoading(prev => ({ ...prev, workouts: false }));
    }
  }, []); // Empty dependency array

  // Filter workout summaries based on search term
  const filterWorkoutSummaries = useCallback((term: string) => {
    if (!term.trim()) {
      setFilteredWorkoutSummaries(workoutSummaries);
      return;
    }
    
    const lowerTerm = term.toLowerCase();
    const filtered = workoutSummaries.filter(summary => 
      (summary.title?.toLowerCase().includes(lowerTerm)) || 
      (summary.username?.toLowerCase().includes(lowerTerm)) || 
      (summary.userId?.toLowerCase().includes(lowerTerm)) ||
      (summary.id?.toLowerCase().includes(lowerTerm))
    );
    
    setFilteredWorkoutSummaries(filtered);
  }, [workoutSummaries]);

  // Handle search input with debounce
  const handleSearchChange = useMemo(() => {
    return debounce((value: string) => {
      setSearchTerm(value);
      filterWorkoutSummaries(value);
    }, 300);
  }, [filterWorkoutSummaries]);

  // Fetch Thumbnail Counts (Real-time)
  // Renamed from fetchThumbnailCounts to setupThumbnailListener for clarity
  const setupThumbnailListener = useCallback(() => {
    console.log('[Metrics] Setting up thumbnail counts listener...');
    setLoadingThumbnailCounts(true);
    const videosRef = collection(db, 'exerciseVideos');

    // Return the unsubscribe function for cleanup
    const unsubscribe = onSnapshot(videosRef, (snapshot) => {
      console.log(`[Metrics] Thumbnail listener received update. Documents: ${snapshot.size}`);
      let total = 0;
      let withThumbnail = 0;

      snapshot.forEach(doc => {
        total++;
        if (doc.data()?.thumbnail) {
          withThumbnail++;
        }
      });

      setThumbnailCounts({ total, withThumbnail });
      // Set loading to false only after the first snapshot is processed
      if (loadingThumbnailCounts) {
          setLoadingThumbnailCounts(false);
      }
      console.log(`[Metrics] Realtime Thumbnail Counts: ${withThumbnail} / ${total}`);

    }, (err) => { // Add error handling for the listener itself
        console.error('[Metrics] Error in thumbnail counts listener:', err);
        setError(prev => prev ? `${prev} | Listener error for thumbnail counts.` : 'Listener error for thumbnail counts.');
        setThumbnailCounts({ total: 0, withThumbnail: 0 });
        setLoadingThumbnailCounts(false); // Stop loading on error
    });

    return unsubscribe; // Return the cleanup function

  }, [loadingThumbnailCounts]); // Dependency ensures we only set loading false once

  // Fetch initial counts/data & Setup Listener
  useEffect(() => {
    console.log('[Metrics] useEffect for initial fetch & listener setup running...');
    fetchExercises();
    fetchCollectionCount('sweatlist-collection', 'rounds');
    fetchWorkoutSummaries();
    
    // Setup the real-time listener and get the unsubscribe function
    const unsubscribeThumbnails = setupThumbnailListener();

    // Cleanup function to unsubscribe when component unmounts
    return () => {
      console.log('[Metrics] Cleaning up thumbnail listener...');
      unsubscribeThumbnails(); 
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, []); // Run only on mount

  const handleTabChange = (tab: TabType) => {
    console.log(`[Metrics] Changing tab to: ${tab}`);
    setActiveTab(tab);
    setSelectedExercise(null);
    setExerciseVideos([]);
    setSelectedWorkoutSummary(null); // Also reset workout summary selection
    setSearchTerm(''); // Reset search term on tab change
    if (tab === 'workouts') {
        filterWorkoutSummaries(''); // Ensure workout filter is reset
    }
  };

  // Format date helper function
  const formatDate = (date: any): string => {
    if (!date) return 'Not available';
    
    try {
      // Convert to proper Date object using our utility
      const convertedDate = convertFirestoreTimestamp(date);
      return convertedDate.toLocaleString();
    } catch (error) {
      console.error('Error formatting date:', error, date);
      return 'Invalid date';
    }
  };

  // Format duration in minutes to hours and minutes
  const formatDuration = (durationInMinutes: number): string => {
    if (!durationInMinutes) return '0m';
    
    const hours = Math.floor(durationInMinutes / 60);
    const minutes = durationInMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Format duration in minutes to hours with decimal places (for stats display)
  const formatDurationHours = (durationInMinutes: number): string => {
    if (!durationInMinutes) return '0';
    
    const hours = durationInMinutes / 60;
    return `${hours.toFixed(1)}`;
  };

  // Render workout summary details
  const renderWorkoutSummaryDetails = (summary: WorkoutSummaryDisplay) => {
    return (
      <div className="bg-[#1d2b3a] border-t border-blue-800 animate-fade-in-up p-4">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-[#d7ff00]" />
            <div>
              <h4 className="text-lg font-medium text-white">{summary.title || 'Untitled Workout'}</h4>
              <p className="text-gray-400 text-sm">
                {summary.startTime 
                  ? formatDate(summary.startTime) 
                  : 'Unknown Date'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedWorkoutSummary(null)}
            className="p-1 text-gray-400 hover:text-gray-200 transition"
            title="Close details"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1: Basic Information */}
          <div className="space-y-4">
            <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">Workout Information</h5>
            <div className="space-y-3">
              <div>
                <div className="text-gray-400 text-xs">ID</div>
                <div className="text-gray-300 font-mono text-sm break-all">{summary.id}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Original Workout ID</div>
                <div className="text-gray-300 font-mono text-sm break-all">{summary.workoutId || 'N/A'}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Completed</div>
                <div className="mt-1">
                  {summary.isCompleted ? (
                    <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded-full text-xs font-medium border border-green-900">
                      Completed
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-orange-900/30 text-orange-400 rounded-full text-xs font-medium border border-orange-900">
                      Incomplete
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Column 2: User Information */}
          <div className="space-y-4">
            <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">User Information</h5>
            <div className="space-y-3">
              <div>
                <div className="text-gray-400 text-xs">Username</div>
                <div className="text-gray-300">{summary.username || 'Unknown User'}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">User ID</div>
                <div className="text-gray-300 font-mono text-sm break-all">{summary.userId || 'N/A'}</div>
              </div>
            </div>
          </div>
          
          {/* Column 3: Time Information */}
          <div className="space-y-4">
            <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">Time Information</h5>
            <div className="space-y-3">
              <div>
                <div className="text-gray-400 text-xs">Start Time</div>
                <div className="text-gray-300">{formatDate(summary.startTime)}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Completion Time</div>
                <div className="text-gray-300">{formatDate(summary.completedAt)}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Duration</div>
                <div className="text-gray-300">{formatDuration(summary.duration || 0)}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Created At</div>
                <div className="text-gray-300">{formatDate(summary.createdAt)}</div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setSelectedWorkoutSummary(null)}
            className="px-3 py-1.5 bg-gray-700/30 text-gray-300 rounded-lg text-xs font-medium border border-gray-700 hover:bg-gray-700/50 transition flex items-center"
          >
            <XCircle className="h-4 w-4 mr-1" />
            Close
          </button>
        </div>
      </div>
    );
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
          
          // Refresh both collections after successful sync
          fetchCollectionCount(ROOT_SESSIONS_COLLECTION, 'workouts');
          fetchWorkoutSummaries(); // Also get the new workout summaries
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

  // Calculate workout statistics
  const calculateWorkoutStats = () => {
    if (!workoutSummaries || workoutSummaries.length === 0) {
      return {
        totalDuration: 0,
        avgDuration: 0,
        totalUsers: new Set().size,
        avgExercises: 0
      };
    }

    // Calculate duration based on timestamps, max 2 hours per workout
    const calculateWorkoutDuration = (summary: WorkoutSummaryDisplay): number => {
      // If there's a duration field, use it as a fallback
      if (summary.duration) return Math.min(summary.duration, 120);
      
      // Otherwise calculate from timestamps
      if (!summary.startTime || !summary.completedAt) return 0;
      
      try {
        // Convert both timestamps to proper Date objects using our utility
        const startTime = convertFirestoreTimestamp(summary.startTime);
        const endTime = convertFirestoreTimestamp(summary.completedAt);
        
        // Calculate duration in minutes
        const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
        
        // Cap at 2 hours (120 minutes) like iOS does
        return Math.min(Math.max(0, durationMinutes), 120);
      } catch (error) {
        console.error('Error calculating duration:', error, { 
          startTime: summary.startTime, 
          completedAt: summary.completedAt 
        });
        return 0;
      }
    };

    // Calculate durations for all workouts
    const durations = workoutSummaries.map(summary => calculateWorkoutDuration(summary));
    const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
    
    // Filter out zero-duration workouts for average calculation
    const nonZeroDurations = durations.filter(duration => duration > 0);
    const avgDuration = nonZeroDurations.length > 0 ? totalDuration / nonZeroDurations.length : 0;
      
    const userSet = new Set(workoutSummaries.map(summary => summary.userId));
    const totalExercises = workoutSummaries.reduce((sum, summary) => sum + (summary.exercises || 0), 0);
    
    return {
      totalDuration,
      avgDuration,
      totalUsers: userSet.size,
      avgExercises: totalExercises / workoutSummaries.length
    };
  };

  // Memoize stats calculation
  const workoutStats = useMemo(() => calculateWorkoutStats(), [workoutSummaries]);

  // Fetch Exercises
  const fetchExercises = useCallback(async () => {
    console.log('[Metrics] Entering fetchExercises...');
    try {
      setLoading(prev => ({ ...prev, moves: true }));
      const exercisesRef = collection(db, 'exercises');
      const q = query(exercisesRef, orderBy('name'));
      console.log('[Metrics] Executing query for exercises...');
      const snapshot = await getDocs(q);
      console.log(`[Metrics] Query completed. Snapshot size: ${snapshot.size}`);

      if (snapshot.empty) {
        console.log('[Metrics] Snapshot is empty for exercises.');
        setExercises([]);
        setCounts(prev => ({ ...prev, moves: 0 }));
        // Removed setLoading false here, handled in finally
        return;
      }

      const fetchedExercises = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          firestoreDocId: doc.id, // Keep the Firestore document ID if needed, maybe for keys
          id: data.id || doc.id, // *** Use the 'id' field from the data, fallback to doc.id if missing ***
          name: data.name || 'Unnamed Exercise',
        }
      }) as ExerciseDisplay[]; // Adjust ExerciseDisplay interface if firestoreDocId is added
      
      console.log('[Metrics] Data mapped before setExercises:', fetchedExercises);
      setExercises(fetchedExercises);
      console.log('[Metrics] Exercises state set in fetchExercises.');
      setCounts(prev => ({ ...prev, moves: fetchedExercises.length }));
      console.log(`[Metrics] Finished setting state in fetchExercises.`);
    } catch (err) {
      console.error(`[Metrics] Error inside fetchExercises try block:`, err);
      setError(`Failed to load exercises. ${err instanceof Error ? err.message : 'Unknown error'}`);
      setExercises([]);
    } finally {
      console.log('[Metrics] Entering fetchExercises finally block.');
      setLoading(prev => ({ ...prev, moves: false })); // Ensure loading is always set to false
    }
  }, []); // Empty dependency array

  // Fetch Exercise Videos
  const fetchExerciseVideos = useCallback(async (exerciseId: string) => {
    // Log the ID received by the function
    console.log(`[Metrics] fetchExerciseVideos called with ID: ${exerciseId}`); 
    if (!exerciseId) {
        console.warn('[Metrics] fetchExerciseVideos called with invalid or missing exerciseId.');
        return;
    }
    console.log(`[Metrics] Fetching videos for exercise: ${exerciseId}`);
    try {
      setLoadingExerciseVideos(true);
      setExerciseVideos([]);
      const videosRef = collection(db, 'exerciseVideos');
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
              createdAt: data.createdAt ? convertFirestoreTimestamp(data.createdAt) : undefined,
          };
      }) as ExerciseVideoDisplay[];

      setExerciseVideos(fetchedVideos);
      console.log(`[Metrics] Fetched ${fetchedVideos.length} videos for exercise ${exerciseId}`);
      
      setExercises(prev => prev.map(ex => 
         ex.id === exerciseId ? { ...ex, videoCount: fetchedVideos.length } : ex
      ));

    } catch (err) {
      console.error(`[Metrics] Error fetching videos for exercise ${exerciseId}:`, err);
      setToastMessage({ type: 'error', text: `Failed to load videos. ${err instanceof Error ? err.message : ''}`});
      setExerciseVideos([]);
    } finally {
        console.log(`[Metrics] Finished fetching videos for exercise: ${exerciseId}`);
        setLoadingExerciseVideos(false); // Ensure loading state is reset
    }
  }, []); // Empty dependency array

  // Handle Manual Thumbnail Generation
  const handleGenerateThumbnails = async () => {
    if (!window.confirm("This will trigger a server-side function to find and generate missing thumbnails for all Exercise Videos. This might take a while depending on the number of videos. Continue?")) {
      return;
    }
    setGeneratingThumbnails(true);
    setGenerationStatusText('Starting thumbnail generation...');
    setToastMessage({ type: 'info', text: 'Manual thumbnail generation initiated...' });

    try {
      const functionsInstance = getFunctions();
      const generateMissingThumbnailsCallable = httpsCallable(functionsInstance, 'generateMissingThumbnails');
      console.log("[Metrics] Calling 'generateMissingThumbnails' function...");
      const result = await generateMissingThumbnailsCallable();
      const data = result.data as { success: boolean; message: string; processedCount: number; errorCount: number; skippedCount: number, errors: any[] };
      
      console.log("[Metrics] 'generateMissingThumbnails' function result:", data);

      if (data.success) {
          setGenerationStatusText(data.message || 'Generation complete.');
          setToastMessage({ type: 'success', text: data.message });
          if (selectedExercise) {
              fetchExerciseVideos(selectedExercise.id);
          }
      } else {
          throw new Error(data.message || 'Thumbnail generation function reported failure.');
      }

    } catch (err) {
        console.error('[Metrics] Error calling generateMissingThumbnails function:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error during thumbnail generation.';
        setGenerationStatusText(`Error: ${errorMessage}`);
        setToastMessage({ type: 'error', text: `Thumbnail generation failed: ${errorMessage}` });
    } finally {
        setGeneratingThumbnails(false);
    }
  };

  // Render Exercise Videos Modal/Section
  const renderExerciseVideoDetails = () => {
    if (!selectedExercise) return null;

    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in-up">
        <div className="bg-[#1a1e24] rounded-xl p-6 shadow-xl border border-[#d7ff00]/30 max-w-4xl w-full max-h-[90vh] flex flex-col">
          {/* Header */}
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

          {/* Content Area */}
          <div className="flex-grow overflow-y-auto pr-2"> {/* Scrollable area */}
            {loadingExerciseVideos ? (
              <div className="flex justify-center items-center py-10">
                 <Loader2 className="h-8 w-8 text-[#d7ff00] animate-spin" />
              </div>
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
                      {/* Play button overlay */}
                      <a href={video.videoURL && !video.videoURL.startsWith('gs://') ? video.videoURL : '#'} target="_blank" rel="noopener noreferrer" className={`absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${!video.videoURL || video.videoURL.startsWith('gs://') ? 'cursor-not-allowed' : ''}`} title={video.videoURL && !video.videoURL.startsWith('gs://') ? 'Watch video' : 'Video URL not public'}>
                        <PlayCircle className="h-12 w-12 text-white/80" />
                      </a>
                    </div>
                    <div className="p-3">
                      <p className="text-xs text-gray-400 mb-1">Uploaded by: {video.username || 'Unknown'}</p>
                      <p className="text-xs text-gray-500 font-mono break-all" title={video.id}>ID: {video.id.substring(0, 12)}...</p>
                      {video.createdAt && (
                         <p className="text-xs text-gray-500 mt-1">Date: {formatDate(video.createdAt)}</p>
                      )}
                      {!video.thumbnail && <p className="text-xs text-orange-400 mt-1 italic">Thumbnail pending</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

           {/* Footer/Actions */}
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

  const renderTabContent = () => {
    if (loading[activeTab] && activeTab !== 'moves' && activeTab !== 'workouts') {
      return (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 text-[#d7ff00] animate-spin" />
        </div>
      );
    }

    if (error && !['moves', 'workouts'].includes(activeTab)) {
        return (
            <div className="bg-red-900/20 p-4 rounded-lg border border-red-800 text-red-300 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p>{error}</p>
            </div>
        );
    }

    switch (activeTab) {
      case 'moves':
        console.log('[Metrics] Rendering Moves tab, exercises state:', exercises, 'loading:', loading.moves);
        return (
          <div className="space-y-6">
            {/* Summary Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Total Moves Card */}
              <div className="p-6 bg-[#262a30] rounded-lg border border-gray-700 flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-semibold mb-2 flex items-center gap-2 text-white">
                     <Dumbbell className="text-[#d7ff00]"/> Total Unique Moves
                  </h3>
                  {loading.moves ? (
                     <div className="h-10 w-24 bg-gray-700 rounded animate-pulse"></div>
                  ) : (
                     <p className="text-4xl font-bold text-[#d7ff00]">{counts.moves}</p>
                  )}
                </div>
              </div>

              {/* Thumbnail Count Card */}
              <div className="p-6 bg-[#262a30] rounded-lg border border-gray-700 flex justify-between items-start">
                <div>
                    <h3 className="text-xl font-semibold mb-2 flex items-center gap-2 text-white">
                        <ImageIcon className="text-[#d7ff00]"/> Video Thumbnails
                    </h3>
                    {loadingThumbnailCounts ? (
                        <div className="h-10 w-32 bg-gray-700 rounded animate-pulse"></div>
                    ) : (
                        <p className="text-4xl font-bold text-[#d7ff00]">
                            {thumbnailCounts.withThumbnail} / {thumbnailCounts.total}
                        </p>
                    )}
                    {!loadingThumbnailCounts && <p className="text-xs text-gray-400 mt-1">Videos with thumbnails / Total videos</p>}
                </div>
              </div>
            </div>

            {/* Manual Thumbnail Generation Button moved below cards */}
            <div className="p-4 bg-[#262a30] rounded-lg border border-gray-700 flex justify-between items-center flex-wrap gap-4">
               <p className="text-sm text-gray-300">Manual Thumbnail Generation:</p>
               <div className="text-right">
                  <button 
                     onClick={handleGenerateThumbnails}
                     disabled={generatingThumbnails}
                     className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm ${generatingThumbnails ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-purple-700/80 hover:bg-purple-600/80 text-white'}`}
                     title="Scan all videos and generate missing thumbnails (Queued)"
                  >
                     {generatingThumbnails ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                     ) : (
                        <ImageIcon className="h-4 w-4" /> // Changed from RefreshCw for consistency
                     )}
                     {generatingThumbnails ? 'Queueing...' : 'Queue Missing Thumbnails'} 
                     {/* Note: This button now triggers the queuing function */}
                  </button>
                  {generatingThumbnails && <p className="text-xs text-purple-300 mt-1 italic animate-pulse">{generationStatusText || 'Processing request...'}</p>}
                  {!generatingThumbnails && generationStatusText && <p className="text-xs text-gray-400 mt-1">{generationStatusText}</p>}
               </div>
            </div>

            {/* Exercise List Table */} 
            {loading.moves ? (
               <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 text-[#d7ff00] animate-spin" /></div>
            ) : error ? ( // Show specific error for moves if fetch failed
                <div className="bg-red-900/20 p-4 rounded-lg border border-red-800 text-red-300 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <p>{error}</p>
                </div>
            ) : exercises.length === 0 ? (
               <div className="bg-[#262a30] p-6 rounded-lg border border-gray-700 text-center">
                  <p className="text-gray-400">No exercises found.</p>
               </div>
            ) : (
               <div className="overflow-x-auto">
                  <table className="min-w-full bg-[#262a30] rounded-lg overflow-hidden">
                     <thead>
                        <tr className="border-b border-gray-700">
                           <th className="py-3 px-4 text-left text-gray-300 font-medium">Name</th>
                           <th className="py-3 px-4 text-left text-gray-300 font-medium">ID</th>
                           <th className="py-3 px-4 text-center text-gray-300 font-medium">Videos</th>
                        </tr>
                     </thead>
                     <tbody>
                        {exercises.map((exercise) => (
                           <tr key={exercise.id} className="hover:bg-[#2a2f36] transition-colors">
                              <td className="py-3 px-4 border-b border-gray-700 text-white">{exercise.name}</td>
                              <td className="py-3 px-4 border-b border-gray-700 text-gray-400 font-mono text-xs">{exercise.id}</td>
                              <td className="py-3 px-4 border-b border-gray-700 text-center">
                                 <button
                                    onClick={() => {
                                        console.log('[Metrics] View button clicked for exercise:', exercise);
                                        setSelectedExercise(exercise);
                                        fetchExerciseVideos(exercise.id);
                                    }}
                                    className="px-2 py-1 rounded-lg text-xs font-medium border bg-blue-900/30 text-blue-400 border-blue-900 hover:bg-blue-800/40 transition-colors flex items-center mx-auto gap-1"
                                    title="View associated videos"
                                 >
                                    <Video className="h-3 w-3" />
                                    View
                                    {typeof exercise.videoCount === 'number' && (
                                       <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-gray-700 text-gray-300">
                                          {exercise.videoCount}
                                       </span>
                                    )} 
                                 </button>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            )}
          </div>
        );
      case 'workouts':
        return (
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="p-6 bg-[#262a30] rounded-lg border border-gray-700">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
                <Activity className="text-[#d7ff00]"/> Total Workout Summaries
              </h3>
              <p className="text-4xl font-bold text-[#d7ff00]">{counts.workouts}</p>
              <div className="mt-4 p-3 bg-blue-900/20 border border-blue-800 rounded-lg text-blue-300 text-sm flex items-center gap-2">
                <AlertCircle className="h-5 w-5 flex-shrink-0"/>
                <span>
                  This count reflects completed workouts from the <code>{WORKOUT_SUMMARIES_COLLECTION}</code> collection.
                </span>
              </div>
            </div>
            
            {/* Stats Cards */}
            {!loadingWorkoutSummaries && workoutSummaries.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-[#262a30] p-4 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-900/30 rounded-lg">
                      <Clock className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Total Duration</div>
                      <div className="text-xl font-bold text-white">{formatDurationHours(workoutStats.totalDuration)} hours</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-[#262a30] p-4 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-900/30 rounded-lg">
                      <Clock className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Average Duration</div>
                      <div className="text-xl font-bold text-white">{formatDurationHours(workoutStats.avgDuration)} hours</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-[#262a30] p-4 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-900/30 rounded-lg">
                      <User className="h-5 w-5 text-green-400" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Unique Users</div>
                      <div className="text-xl font-bold text-white">{workoutStats.totalUsers}</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-[#262a30] p-4 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-900/30 rounded-lg">
                      <Dumbbell className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Avg. Exercises</div>
                      <div className="text-xl font-bold text-white">{Math.round(workoutStats.avgExercises)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Search Input */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by title, username, user ID..."
                  className="w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilteredWorkoutSummaries(workoutSummaries);
                  fetchWorkoutSummaries(); // Refresh data
                }}
                className="bg-[#262a30] hover:bg-[#2a2f36] text-white px-4 py-3 rounded-lg font-medium transition flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </button>
            </div>
            
            {/* Workout Summaries Table */}
            {loadingWorkoutSummaries ? (
              <div className="flex justify-center items-center py-10">
                <svg className="animate-spin h-8 w-8 text-[#d7ff00]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : filteredWorkoutSummaries.length === 0 ? (
              <div className="bg-[#262a30] p-6 rounded-lg border border-gray-700 text-center">
                <p className="text-gray-400">No workout summaries found matching your search criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-[#262a30] rounded-lg overflow-hidden">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="py-3 px-4 text-left text-gray-300 font-medium">Title</th>
                      <th className="py-3 px-4 text-left text-gray-300 font-medium">Username</th>
                      <th className="py-3 px-4 text-left text-gray-300 font-medium">User ID</th>
                      <th className="py-3 px-4 text-left text-gray-300 font-medium">Date</th>
                      <th className="py-3 px-4 text-left text-gray-300 font-medium">Duration</th>
                      <th className="py-3 px-4 text-left text-gray-300 font-medium">Exercises</th>
                      <th className="py-3 px-4 text-center text-gray-300 font-medium">View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWorkoutSummaries.map((summary) => (
                      <React.Fragment key={summary.id}>
                        <tr className={`hover:bg-[#2a2f36] transition-colors ${selectedWorkoutSummary?.id === summary.id ? 'bg-[#1d2b3a]' : ''}`}>
                          <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
                            {summary.title || 'Untitled Workout'}
                          </td>
                          <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
                            {summary.username || 'Unknown User'}
                          </td>
                          <td className="py-3 px-4 border-b border-gray-700 text-gray-300 font-mono text-xs">
                            {summary.userId ? summary.userId.substring(0, 8) + '...' : 'N/A'}
                          </td>
                          <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
                            {summary.startTime ? formatDate(summary.startTime) : 'N/A'}
                          </td>
                          <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
                            {formatDuration(summary.duration || 0)}
                          </td>
                          <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
                            {summary.exercises || 0}
                          </td>
                          <td className="py-3 px-4 border-b border-gray-700 text-center">
                            <button
                              onClick={() => setSelectedWorkoutSummary(selectedWorkoutSummary?.id === summary.id ? null : summary)}
                              className={`px-2 py-1 rounded-lg text-xs font-medium border hover:bg-blue-800/40 transition-colors flex items-center mx-auto ${
                                selectedWorkoutSummary?.id === summary.id 
                                  ? 'bg-blue-800/50 text-blue-300 border-blue-900' 
                                  : 'bg-blue-900/30 text-blue-400 border-blue-900'
                              }`}
                              title="View workout details"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              {selectedWorkoutSummary?.id === summary.id ? 'Hide' : 'View'}
                            </button>
                          </td>
                        </tr>
                        {selectedWorkoutSummary?.id === summary.id && (
                          <tr>
                            <td colSpan={7} className="p-0 border-b border-gray-700">
                              {renderWorkoutSummaryDetails(summary)}
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
                    Run this to trigger a background function that syncs workout data between collections. Updates <code>{ROOT_SESSIONS_COLLECTION}</code> and <code>{WORKOUT_SUMMARIES_COLLECTION}</code>.
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

      {/* Exercise Videos Modal */} 
      {selectedExercise && renderExerciseVideoDetails()}

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