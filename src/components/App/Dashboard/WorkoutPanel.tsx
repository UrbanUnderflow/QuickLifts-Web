// src/components/WorkoutPanel/WorkoutPanel.tsx
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Workout, WorkoutStatus } from '../../../api/firebase/workout/types';
import { workoutService } from '../../../api/firebase/workout';
import { Challenge } from '../../../types/Challenge';

interface WorkoutPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

const WorkoutPanel: React.FC<WorkoutPanelProps> = ({ isVisible, onClose }) => {
  // State
  const [currentWorkout, setCurrentWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([]);

  // Fetch data when panel becomes visible
  useEffect(() => {
    if (isVisible) {
      fetchWorkoutData();
      fetchActiveChallenges();
    }
  }, [isVisible]);

  // Data fetching
  const fetchWorkoutData = async () => {
    setLoading(true);
    try {
      const workout = await workoutService.fetchCurrentWorkout();
      setCurrentWorkout(workout);
    } catch (error) {
      console.error('Error fetching workout:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveChallenges = async () => {
    try {
      // TODO: Implement challenge fetching
      setActiveChallenges([]);
    } catch (error) {
      console.error('Error fetching challenges:', error);
    }
  };

  // Action handlers
  const handleGenerateWorkout = async () => {
    // TODO: Show body part selection modal
    console.log('Generate workout');
  };

  const handleStartWorkout = async () => {
    if (!currentWorkout) return;
    
    try {
      await workoutService.startWorkout(currentWorkout.id);
      await fetchWorkoutData(); // Refresh workout data
    } catch (error) {
      console.error('Error starting workout:', error);
    }
  };

  const handleCancelWorkout = async () => {
    if (!currentWorkout) return;

    try {
      await workoutService.cancelWorkout(currentWorkout.id);
      await fetchWorkoutData(); // Refresh workout data
    } catch (error) {
      console.error('Error canceling workout:', error);
    }
  };

  // Render methods
  const renderEmptyState = () => (
    <div className="p-6 bg-zinc-800 rounded-lg">
      <h3 className="text-xl font-bold text-white mb-4">No Workout Planned</h3>
      <p className="text-zinc-400 mb-6">Generate a workout to get started with your fitness journey.</p>
      <button
        onClick={handleGenerateWorkout}
        className="w-full bg-[#E0FE10] text-black font-semibold py-3 px-4 rounded-lg 
          hover:bg-[#c8e60e] transition-colors"
      >
        Generate Workout
      </button>
    </div>
  );

  const renderQueuedWorkout = () => (
    <div className="p-6 bg-zinc-800 rounded-lg">
      <h3 className="text-xl font-bold text-white mb-2">{currentWorkout?.title}</h3>
      <p className="text-zinc-400 mb-6">Your workout is ready to begin.</p>
      <div className="flex gap-4">
        <button
          onClick={handleStartWorkout}
          className="flex-1 bg-[#E0FE10] text-black font-semibold py-3 px-4 rounded-lg 
            hover:bg-[#c8e60e] transition-colors"
        >
          Start Workout
        </button>
        <button
          onClick={handleGenerateWorkout}
          className="flex-1 bg-zinc-700 text-white font-semibold py-3 px-4 rounded-lg 
            hover:bg-zinc-600 transition-colors"
        >
          Swap Workout
        </button>
      </div>
    </div>
  );

  const renderInProgressWorkout = () => (
    <div className="p-6 bg-zinc-800 rounded-lg">
      <h3 className="text-xl font-bold text-white mb-2">{currentWorkout?.title}</h3>
      <div className="mb-6">
        <div className="text-zinc-400">Progress</div>
        {/* Add progress indicator */}
      </div>
      <div className="flex gap-4">
        <button
          onClick={() => {/* TODO: Show workout overview */}}
          className="flex-1 bg-[#E0FE10] text-black font-semibold py-3 px-4 rounded-lg 
            hover:bg-[#c8e60e] transition-colors"
        >
          Continue Workout
        </button>
        <button
          onClick={handleCancelWorkout}
          className="flex-1 bg-red-500 text-white font-semibold py-3 px-4 rounded-lg 
            hover:bg-red-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  const renderActiveChallenges = () => {
    if (activeChallenges.length === 0) return null;

    return (
      <div className="mt-6">
        <h3 className="text-lg font-bold text-white mb-4">Active Challenges</h3>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {activeChallenges.map(challenge => (
            <div 
              key={challenge.id}
              className="flex-shrink-0 w-64 p-4 bg-zinc-800 rounded-lg border border-zinc-700"
            >
              <h4 className="font-bold text-white">{challenge.title}</h4>
              {/* Add challenge details */}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="relative w-full sm:w-[480px] bg-zinc-900 h-full sm:h-auto 
        sm:rounded-xl overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white"
          aria-label="Close panel"
        >
          <X size={24} />
        </button>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-white">Loading...</div>
            </div>
          ) : (
            <>
              {/* Main Content */}
              {!currentWorkout && renderEmptyState()}
              {currentWorkout?.status === WorkoutStatus.QueuedUp && renderQueuedWorkout()}
              {currentWorkout?.status === WorkoutStatus.InProgress && renderInProgressWorkout()}

              {/* Challenges Section */}
              {renderActiveChallenges()}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkoutPanel;