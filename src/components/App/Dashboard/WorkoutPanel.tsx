import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Workout, WorkoutStatus } from '../../../api/firebase/workout/types';
import { Challenge } from '../../../types/Challenge';
import WorkoutTypeSelector from '../../../components/App/Dashboard/WorkoutTypeSelector';

interface WorkoutPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

const WorkoutPanel: React.FC<WorkoutPanelProps> = ({ isVisible, onClose }) => {
  const [currentWorkout, setCurrentWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([]);

  useEffect(() => {
    if (isVisible) {
      fetchWorkoutData();
      fetchActiveChallenges();
    }
  }, [isVisible]);

  const fetchWorkoutData = async () => {
    setLoading(true);
    try {
      const workout = null;
      setCurrentWorkout(workout);
    } catch (error) {
      console.error('Error fetching workout:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveChallenges = async () => {
    try {
      setActiveChallenges([]);
    } catch (error) {
      console.error('Error fetching challenges:', error);
    }
  };

  const [showWorkoutTypeSelector, setShowWorkoutTypeSelector] = useState(false);

  const handleGenerateWorkout = () => {
    setShowWorkoutTypeSelector(true);
  };

  const handleCreateWorkout = (selectedParts: string[]) => {
    console.log('Creating workout with parts:', selectedParts);
    setShowWorkoutTypeSelector(false);
    // TODO: Generate workout logic
  };

  const handleStartWorkout = async () => {
    if (!currentWorkout) return;
    try {
      await fetchWorkoutData();
    } catch (error) {
      console.error('Error starting workout:', error);
    }
  };

  const renderEmptyState = () => (
    <div className="h-full bg-[#E0FE10] p-8 flex flex-col">
      <button onClick={onClose} className="self-end mb-6">
        <X size={24} className="text-black" />
      </button>
      
      <h3 className="text-4xl font-bold text-black mb-4">
        You don't have your workout for today yet.
      </h3>
      
      <div className="mt-8">
        <button
          onClick={handleGenerateWorkout}
          className="flex items-center text-lg font-medium text-black"
        >
          Get a workout
          <svg className="ml-2 w-6 h-6" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14m-7-7l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {activeChallenges.length > 0 && (
        <div className="mt-auto pt-8">
          <div className="bg-black/10 rounded-full py-3 px-6 inline-flex items-center gap-2">
            <span className="text-black">Swipe to see</span>
            <span className="font-bold text-black">{activeChallenges.length} Active Rounds</span>
            <svg className="w-4 h-4 text-black" viewBox="0 0 24 24" fill="none">
              <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      )}
    </div>
  );

  if (!isVisible) return null;

  if (showWorkoutTypeSelector) {
    return (
      <WorkoutTypeSelector
        onClose={() => setShowWorkoutTypeSelector(false)}
        onCreateWorkout={handleCreateWorkout}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch">
      <div className="relative w-full bg-[#E0FE10] h-full overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-black">Loading...</div>
          </div>
        ) : (
          renderEmptyState()
        )}
      </div>
    </div>
  );
};

export default WorkoutPanel;