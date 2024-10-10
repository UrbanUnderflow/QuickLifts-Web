import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import SequentialVideoPlayerView from '../components/SequentialVideoPlayerView';
import SweatListCardView from '../components/SweatListCardView';
import WorkoutService from '../services/WorkoutService';
import { ExerciseLog } from '../types/ExerciseLog';
import { Workout } from '../types/Workout';
import { ExerciseReference } from '../types/ExerciseReference';

const WorkoutPreviewer: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);

  const workoutId = searchParams.get('workoutId') || "1039FEC0-E7B6-4F7E-84BC-B89086232B5F";
  const userId = searchParams.get('referralCode') || "Bq6zlqIlSdPUGki6gsv6X9TdVtG3";

  useEffect(() => {
    const fetchWorkout = async () => {
      try {
        setIsLoading(true);
        const [fetchedWorkout, fetchedLogs] = await WorkoutService.sharedInstance.fetchSavedWorkout(userId, workoutId);
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
    fetchWorkout();
  }, [workoutId, userId]);

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

  const handleGetAppClick = () => {
    setShowModal(true);
  };

  const confirmRedirect = () => {
    const workoutId = searchParams.get('workoutId') || "defaultWorkoutId";
    const referralCode = searchParams.get('referralCode') || "defaultReferralCode";
    const linkType = "workoutPreview";
  
    // Construct the deep link URL
    const deepLink = encodeURIComponent(`https://fitwithpulse.ai/workoutPreview?linkType=${linkType}&workoutId=${workoutId}&referralCode=${referralCode}`);
  
    // Firebase Dynamic Links domain
    const dynamicLinkDomain = "https://quicklifts.page.link";
  
    // iOS parameters
    const bundleId = "Tremaine.QuickLifts";
    const appStoreId = "6451497729";
  
    // Full Dynamic Link URL
    const dynamicLink = `${dynamicLinkDomain}/?link=${deepLink}&ibi=${bundleId}&isi=${appStoreId}`;

    const appStoreURL = "https://apps.apple.com/us/app/pulse-the-fitness-collective/id6451497729";

  
    setShowModal(false);
  
    // Redirect to the Dynamic Link
    window.location.href = appStoreURL;
  };

  if (isLoading) {
    return <div className="text-white text-center pt-20">Loading workout...</div>;
  }

  if (error || !workout) {
    return <div className="text-white text-center pt-20">Error loading workout: {error || "Unknown error"}</div>;
  }

  const videoURLs = logs.flatMap(log => log.exercise.videos.map(video => video.videoURL));
  const duration = estimatedDuration(workout.exercises);

  return (
    <div className="relative h-screen bg-black">
      {/* Download banner */}
      <div className="fixed top-0 left-0 right-0 bg-[#E0FE10] text-black py-2 px-4 text-center z-50">
        <p className="font-bold">
          Get more workouts with the Pulse app, as well as full access to this workout!
          <button 
            onClick={handleGetAppClick} 
            className="underline ml-2 font-bold bg-transparent border-none cursor-pointer"
          >
            Get App
          </button>
        </p>
      </div>

      <SequentialVideoPlayerView videoURLs={videoURLs} isMuted={true} ratio="cover" />
      <div className="absolute inset-0 mt-80 overflow-y-auto bg-gradient-to-b from-transparent via-[#192126] via-25% to-[#192126] to-50%">
        <div className="flex flex-col min-h-full p-4 pb-20 pt-12"> {/* Added pt-12 for banner space */}
          <div className="flex-grow">
            <div className="text-center text-white mt-10 mb-1">
              <h2 className="text-2xl font-bold">Your workout for today:</h2>
              <p className="text-xl font-bold text-[#E0FE10]">{workout.title}</p>
            </div>
            {/* Workout stats */}
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
            {/* Exercise list */}
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
      {/* Sticky floating button */}
      <div className="fixed bottom-0 left-0 right-0 p-10 bg-gradient-to-t from-black to-transparent">
      <button
        onClick={() => {
            handleGetAppClick();         
        }}
        className="w-full py-3 bg-[#E0FE10] text-black font-bold rounded-full text-lg"
        >
        Track this Workout
        </button>
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white p-6 rounded-lg max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4">Confirm Download</h2>
            <p className="mb-6">You're about to be redirected to the App Store to download Pulse. Continue?</p>
            <div className="flex justify-end space-x-4">
              <button 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                Cancel
              </button>
              <button 
                onClick={confirmRedirect}
                className="px-4 py-2 bg-[#E0FE10] text-black rounded"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkoutPreviewer;