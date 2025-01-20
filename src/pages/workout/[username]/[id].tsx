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
        const [fetchedWorkout, fetchedLogs] = await workoutService.fetchSavedWorkout(username as string, id as string);

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

  const handleStartWorkout = async () => {
    if (!workout || !logs.length) {
      setError("Unable to start workout");
      return;
    }
  
    try {
      if (userId) {
        // Save the workout session (queue it up)
        const savedWorkout = await workoutService.saveWorkoutSession({
          userId,
          workout,
          logs
        });
    
        console.log("We have queued up saved workout:", savedWorkout);
    
        if (savedWorkout) {
          // Navigate back to the home page
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

  if (isLoading) {
    return <div className="text-white text-center pt-20">Loading workout...</div>;
  }

  if (error || !workout) {
    return <div className="text-white text-center pt-20">Error loading workout: {error || "Unknown error"}</div>;
  }

  const videoURLs = logs
    .filter(log => log.exercise && log.exercise.videos)
    .flatMap(log => log.exercise.videos.map(video => video.videoURL));
  
  const duration = estimatedDuration(workout.exercises);

  return (
    <div className="relative h-screen bg-black">
      <div className="fixed top-0 left-0 right-0 bg-[#E0FE10] text-black py-2 px-4 text-center z-50">
        <p className="font-bold">
          Ready to start your workout!
        </p>
      </div>

      <SequentialVideoPlayerView videoURLs={videoURLs} isMuted={true} ratio="cover" />
      
      <div className="absolute inset-0 mt-80 overflow-y-auto bg-gradient-to-b from-transparent via-[#192126] via-25% to-[#192126] to-50%">
        <div className="flex flex-col min-h-full p-4 pb-20 pt-12">
          <div className="flex-grow">
            <div className="text-center text-white mt-10 mb-1">
              <h2 className="text-2xl font-bold">Your workout for today:</h2>
              <p className="text-xl font-bold text-[#E0FE10]">{workout.title}</p>
            </div>
            
            <div className="flex justify-around my-10">
              <div className="text-center">
                <p className="text-2xl font-bold text-[#E0FE10]">{logs.length}</p>
                <p className="text-m text-white">Exercises</p>
              </div>
              <div className="h-14 w-px bg-white opacity-50"></div>
              <div className="text-center">
                <p className="text-2xl font-bold text-[#E0FE10]">{duration} mins</p>
                <p className="text-m text-white">Duration</p>
              </div>
            </div>
            
            <div className="mt-6 mb-28">
              {logs.map((log) => (
                <SweatListCardView
                  key={log.id}
                  log={log}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <div className="fixed bottom-0 left-0 right-0 p-10 bg-gradient-to-t from-black to-transparent">
        <button
          onClick={handleStartWorkout}
          className="w-full py-3 bg-[#E0FE10] text-black font-bold rounded-full text-lg"
        >
          Start this Workout
        </button>
      </div>

      {error && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white p-6 rounded-lg max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4">Error</h2>
            <p className="mb-6">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="px-4 py-2 bg-[#E0FE10] text-black rounded"
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