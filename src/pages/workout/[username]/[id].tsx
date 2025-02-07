import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/router';
import SequentialVideoPlayerView from '../../../components/SequentialVideoPlayerView';
import SweatListCardView from '../../../components/SweatListCardView';
import { workoutService } from '../../../api/firebase/workout/service';
import { ExerciseLog, ExerciseReference } from '../../../api/firebase/exercise/types';
import { Workout } from '../../../api/firebase/workout/types';
import { userService } from '../../../api/firebase/user/service';
import { RootState } from '../../../redux/store';
import { useDispatch } from 'react-redux';
import { setCurrentWorkout, setCurrentExerciseLogs } from '../../../redux/workoutSlice';

const WorkoutPreviewer: React.FC = () => {
  const router = useRouter();
  const { username, id } = router.query;

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const userId = useSelector((state: RootState) => state.user.currentUser?.id);


  useEffect(() => {
    if (!router.isReady || !username || !id) return;

    const fetchWorkoutByUsernameAndId = async () => {
      try {
        // First get the user ID from the username
        const user = await userService.getUserByUsername(username as string);
        
        if (!user) {
          setError("User not found");
          return;
        }

        // Now fetch the workout using the user's ID
        const [fetchedWorkout, fetchedLogs] = await workoutService.fetchSavedWorkout(user.id, id as string);

        if (fetchedWorkout) {
          setWorkout(fetchedWorkout);
          setLogs(fetchedLogs || []);
        } else {
          setError("No workout data returned");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkoutByUsernameAndId();
  }, [router.isReady, username, id]);

  function estimatedDuration(exercises: ExerciseReference[]): number {
    const averageExerciseTime = 8; // Average time per exercise in minutes
    const averageRestTime = 1; // Average rest time between exercises in minutes
    const warmupTime = 5; // Warm-up time in minutes
    const cooldownTime = 5; // Cool-down time in minutes
  
    const totalExerciseTime = exercises.length * averageExerciseTime;
    const totalRestTime = Math.max(0, exercises.length - 1) * averageRestTime; // No rest after last exercise
  
    const estimatedTotalTime = warmupTime + totalExerciseTime + totalRestTime + cooldownTime;
  
    // Round to the nearest multiple of 5
    const roundedTime = Math.round(estimatedTotalTime / 5) * 5;
  
    return roundedTime;
  }
  
  // Inside the component
  const dispatch = useDispatch();
  
  const handleStartWorkout = async () => {
    if (!workout || !logs.length) {
      setError("Unable to start workout");
      return;
    }
  
    try {
      if (userId) {
        // Save workout session in Firestore
        const savedWorkout = await workoutService.saveWorkoutSession({
          userId,
          workout,
          logs
        });
  
        if (savedWorkout) {
          console.log("Queued workout:", savedWorkout);
          console.log("✅ Queued Workout ID:", savedWorkout.id); // 🔥 Logs workout ID

  
          // ✅ Dispatch Redux actions to store workout data
          dispatch(setCurrentWorkout(savedWorkout));
          dispatch(setCurrentExerciseLogs(logs));
  
          // ✅ Navigate back to home, which handles the workout state
          router.push('/');
        } else {
          setError("Failed to save workout session");
        }
      }
    } catch (err) {
      console.error('Error starting workout:', err);
      setError("Failed to start workout");
    }
  };
  

  // Add loading and error state checks with more visibility
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading workout...</div>
      </div>
    );
  }

  if (error || !workout) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">
          Error loading workout: {error || "No workout data available"}
        </div>
      </div>
    );
  }

  const videoURLs = workout.exercises
  .filter(exerciseRef => {
    console.log("Exercise videos:", exerciseRef.exercise.videos);
    return exerciseRef.exercise.videos?.length > 0;
  })
  .flatMap(exerciseRef => exerciseRef.exercise.videos.map(video => video.videoURL))
  .filter(url => url);

  console.log("Filtered video URLs:", videoURLs);
  
  const duration = estimatedDuration(workout.exercises);

  return (
    <div className="relative h-screen bg-black">
      {/* Hero Section */}
      <div className="h-[45vh] relative">
        <div className="absolute inset-0">
          <SequentialVideoPlayerView videoURLs={videoURLs} isMuted={true} ratio="cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black" />
        </div>
        
        <div className="absolute bottom-6 left-0 right-0 px-6">
          <h1 className="text-3xl font-bold text-white mb-2">{workout.title}</h1>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold text-[#E0FE10]">{logs.length}</span>
              <span className="text-sm text-zinc-300">Exercises</span>
            </div>
            <div className="w-px h-6 bg-zinc-700" />
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold text-[#E0FE10]">{duration}</span>
              <span className="text-sm text-zinc-300">Minutes</span>
            </div>
          </div>
        </div>
      </div>
  
      {/* Exercise List */}
      <div className="flex-1 bg-black min-h-[55vh]">
        <div className="px-4 -mt-6">
          <div className="bg-zinc-900/80 backdrop-blur-sm rounded-2xl p-6 border border-zinc-800">
            <div className="divide-y divide-zinc-800">
              {logs.map((log) => (
                <SweatListCardView
                  key={log.id}
                  log={log}
                  gifUrls={log.exercise.videos?.map(video => video.gifURL).filter((url): url is string => !!url) || []}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
  
      {/* Start Button */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/90 to-transparent pt-20">
        <button
          onClick={handleStartWorkout}
          className="w-full py-4 bg-[#E0FE10] text-black font-bold rounded-xl text-lg hover:bg-[#E0FE10]/90 transition-colors"
        >
          Start Workout
        </button>
      </div>
  
      {/* Error Modal */}
      {error && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-6">
          <div className="bg-zinc-900 p-6 rounded-xl max-w-sm w-full border border-zinc-800">
            <h2 className="text-xl font-bold text-white mb-4">Error</h2>
            <p className="text-zinc-400 mb-6">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="w-full py-3 bg-[#E0FE10] text-black rounded-xl font-medium"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkoutPreviewer;