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
      <SequentialVideoPlayerView videoURLs={videoURLs} isMuted={true} ratio="cover" />
      <div className="absolute inset-0 mt-64 overflow-y-auto bg-gradient-to-b from-transparent via-black to-black">
        <div className="flex flex-col mt-24 h-full p-4">
          <div className="flex-grow">
            <div className="text-center text-white mt-10 mb-6">
              <h2 className="text-2xl font-bold">Your workout for today:</h2>
              <p className="text-xl font-bold text-green-400">{workout.zone}</p>
            </div>
            {/* Workout stats */}
            <div className="flex justify-around my-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-400">{logs.length}</p>
                <p className="text-lg text-white">Exercises</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-400">{workout.estimatedDuration()}</p>
                <p className="text-lg text-white">Duration</p>
              </div>
            </div>
            {/* Exercise list */}
            <div className="mt-6">
              {logs.map((log) => (
                <SweatListCardView
                  key={log.id}
                  log={log}
                />
              ))}
            </div>
          </div>
          <div className="mt-auto p-4">
            <button
              onClick={() => {console.log("Use Sweatlist clicked")}}
              className="w-full py-3 bg-green-500 text-black font-bold rounded-lg text-lg"
            >
              Track this Workout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkoutPreviewer;