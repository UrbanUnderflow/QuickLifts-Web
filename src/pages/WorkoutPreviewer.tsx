import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import SequentialVideoPlayerView from '../components/SequentialVideoPlayerView';
import SweatListCardView from '../components/SweatListCardView';
import WorkoutService from '../services/WorkoutService';
import { ExerciseLog } from '../types/ExerciseLog';
import { Workout } from '../types/Workout';

const WorkoutPreviewer: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const workoutId = searchParams.get('workoutId') || "0D4530EB-5135-4C82-AA55-D85068B75114";
  const userId = searchParams.get('userId') || "Bq6zlqIlSdPUGki6gsv6X9TdVtG3";

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

  if (isLoading) {
    return <div className="text-white text-center pt-20">Loading workout...</div>;
  }

  if (error || !workout) {
    return <div className="text-white text-center pt-20">Error loading workout: {error || "Unknown error"}</div>;
  }

  const videoURLs = logs.flatMap(log => log.exercise.videos.map(video => video.videoURL));

  return (
    <div className="relative h-screen bg-black">
      {/* Download banner */}
      <div className="fixed top-0 left-0 right-0 bg-[#E0FE10] text-black py-2 px-4 text-center z-50">
        <p className="font-bold">
          Download the Pulse app for full access to this workout
          <a href="https://apps.apple.com/us/app/pulse-the-fitness-collective/id6451497729" className="underline ml-2">Get App</a>
        </p>
      </div>

      <SequentialVideoPlayerView videoURLs={videoURLs} isMuted={true} ratio="cover" />
      <div className="absolute inset-0 mt-64 overflow-y-auto bg-gradient-to-b from-transparent via-black to-black">
        <div className="flex flex-col min-h-full p-4 pb-20 pt-12"> {/* Added pt-12 for banner space */}
          <div className="flex-grow">
            <div className="text-center text-white mt-10 mb-1">
              <h2 className="text-2xl font-bold">Your workout for today:</h2>
              <p className="text-xl font-bold text-[#E0FE10]">{workout.zone}</p>
            </div>
            {/* Workout stats */}
            <div className="flex justify-around my-10">
              <div className="text-center">
                <p className="text-3xl font-bold text-[#E0FE10]">{logs.length}</p>
                <p className="text-lg text-white">Exercises</p>
              </div>
              <div className="h-14 w-px bg-white opacity-50"></div>
              <div className="text-center">
                <p className="text-3xl font-bold text-[#E0FE10]">{workout.estimatedDuration()}</p>
                <p className="text-lg text-white">Duration</p>
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
          onClick={() => {console.log("Use Sweatlist clicked")}}
          className="w-full py-3 bg-[#E0FE10] text-black font-bold rounded-lg text-lg"
        >
          Track this Workout
        </button>
      </div>
    </div>
  );
};

export default WorkoutPreviewer;