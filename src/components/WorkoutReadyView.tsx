import React, { useState, useEffect } from 'react';
import { Clock, Dumbbell, ChevronRight, XIcon } from 'lucide-react';
import { Workout } from '../api/firebase/workout/types';
import { workoutService } from '../api/firebase/workout/service';
import { useRouter } from 'next/router';
import { RootState } from '../redux/store';
import { ExerciseLog } from '../api/firebase/exercise';
import { useDispatch, useSelector } from 'react-redux';
import { setCurrentWorkout, setCurrentExerciseLogs } from '../redux/workoutSlice';
import { WorkoutSummary } from '../api/firebase/workout/types';

interface WorkoutReadyViewProps {
  workout: Workout;
  exerciseLogs: ExerciseLog[];
  onClose: () => void;
  onStartWorkout?: () => void;
}

const WorkoutReadyView: React.FC<WorkoutReadyViewProps> = ({
  workout,
  exerciseLogs,
  onClose,
  onStartWorkout,
}) => {
  const [showExercises, setShowExercises] = useState(false);
  const router = useRouter();
  const dispatch = useDispatch();
  const userId = useSelector((state: RootState) => state.user.currentUser?.id);
  const currentWorkoutSession = useSelector((state: RootState) => state.workout.currentWorkout);

  const handleStartWorkout = async () => {
    if (onStartWorkout) {
      onStartWorkout();
    }
  };  

  const cancelWorkout = async () => {
    if (!userId || !currentWorkoutSession) {
      console.error('No user ID or current workout session found');
      return;
    }

    try {
      await workoutService.cancelWorkout(
        new Workout(currentWorkoutSession), 
        workoutService.currentWorkoutSummary ? new WorkoutSummary(workoutService.currentWorkoutSummary) : null
      );
      dispatch(setCurrentWorkout(null));
      dispatch(setCurrentExerciseLogs([]));
      console.log('Workout session canceled successfully');
    } catch (error) {
      console.error('Error canceling workout session:', error);
    }
  };

  const InfoCard = ({
    icon,
    title,
    value,
  }: {
    icon: React.ElementType;
    title: string;
    value: string;
  }) => {
    const Icon = icon;
    return (
      <div className="flex items-center bg-zinc-800 rounded-xl p-4">
        <Icon className="text-[#E0FE10] w-6 h-6 mr-4" />
        <div>
          <p className="text-zinc-400 text-sm">{title}</p>
          <p className="text-white font-semibold">{value}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Close Button */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4">
        <button onClick={onClose} className="ml-auto block">
          <XIcon className="text-white w-6 h-6" />
        </button>
      </div>

      <div className="flex-grow container mx-auto px-4 pt-20">
        <div className="text-center mb-8">
          <Dumbbell className="mx-auto text-[#E0FE10] w-20 h-20 mb-4" />
          <h1 className="text-3xl font-bold text-white mb-4">{workout.title}</h1>
          <p className="text-zinc-400 mb-8">
            Once you hit start, your workout will begin. Get ready to crush it! 💪
          </p>
        </div>

        <div className="space-y-4">
          <InfoCard
            icon={Clock}
            title="Estimated Duration"
            value={`${Workout.estimatedDuration(workout.exercises)} min`}
          />

          {/* Exercises Collapsible */}
          <div className="bg-zinc-800 rounded-xl">
            <button
              onClick={() => setShowExercises(!showExercises)}
              className="w-full flex items-center justify-between p-4"
            >
              <div className="flex items-center">
                <Dumbbell className="text-[#E0FE10] w-6 h-6 mr-4" />
                <div>
                  <p className="text-zinc-400 text-sm">Exercise Count</p>
                  <p className="text-white font-semibold">{workout.exercises.length} exercises</p>
                </div>
              </div>
              <ChevronRight
                className={`text-[#E0FE10] transform transition-transform ${showExercises ? 'rotate-90' : ''}`}
              />
            </button>

            {showExercises && (
              <div className="border-t border-zinc-700 p-4">
                {exerciseLogs.map((log, index) => {
                  const exercise = log.exercise;
                  let displayInfo = "";
                  
                  console.log(`Rendering exercise ${index + 1}:`, {
                    name: exercise.name,
                    category: exercise.category,
                    details: exercise.category?.details,
                    screenTime: exercise.category?.details?.screenTime
                  });
                  
                  if (exercise?.category?.details?.screenTime) {
                    const screenTime = exercise.category.details.screenTime;
                    console.log(`Screen time found for ${exercise.name}:`, screenTime);
                    displayInfo = `${screenTime} sec`;
                  } else {
                    console.log(`No screen time for ${exercise.name}, using sets/reps`);
                    displayInfo = `${exercise.sets} sets • ${exercise.reps} reps`;
                  }
                                    
                  return (
                    <div key={log.id} className="flex items-center mb-3 last:mb-0">
                      <div className="bg-zinc-700 rounded-full w-6 h-6 flex items-center justify-center mr-4">
                        <span className="text-zinc-400 text-xs">{index + 1}</span>
                      </div>
                      <div>
                        <p className="text-white">{exercise.name}</p>
                        <p className="text-zinc-400 text-sm">{displayInfo}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>

          <InfoCard icon={Dumbbell} title="Workout Type" value={workout.zone} />
        </div>

        {/* Start Workout Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
          <button onClick={cancelWorkout} className="w-full text-white py-3 rounded-full font-bold text-lg mb-4">
            Cancel
          </button>
          <button onClick={handleStartWorkout} className="w-full bg-[#E0FE10] text-black py-3 rounded-full font-bold text-lg">
            Start Workout
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkoutReadyView;
