import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { X, Check } from 'lucide-react';
import { exerciseService } from '../../../api/firebase/exercise/service';
import { workoutService } from '../../../api/firebase/workout/service';
import { userService } from '../../../api/firebase/user';
import { ExerciseDetail } from '../../../api/firebase/exercise/types';

interface WorkoutTypeSelectorProps {
  onClose: () => void;
  onCreateWorkout: (selectedParts: string[]) => void;
}

const WorkoutTypeSelector: React.FC<WorkoutTypeSelectorProps> = ({
  onClose,
  onCreateWorkout,
}) => {
  const [selectedParts, setSelectedParts] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const router = useRouter();

  const toggleBodyPart = (id: string) => {
    setSelectedParts(prev => 
      prev.includes(id) 
        ? prev.filter(p => p !== id)
        : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 sm:px-6">
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-none bg-zinc-900 min-h-screen sm:h-auto sm:max-h-[80vh] sm:max-w-4xl lg:max-w-5xl sm:rounded-3xl">
        <div className="p-6 pb-2">
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center"
          >
            <X className="text-white" size={20} />
          </button>
          
          <div className="mt-6 mb-2 max-w-2xl mx-0 sm:mx-auto">
            <h1 className="text-3xl sm:text-4xl font-bold text-white text-left sm:text-center">
              Choose the body parts you want to workout.
            </h1>
            <p className="mt-2 text-zinc-400 text-base sm:text-lg text-left sm:text-center">
              You can choose multiple body parts
            </p>
          </div>
        </div>

        <div className="flex-1 p-6 pb-28 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto max-w-5xl mx-auto scrollbar-hide">
        <BodyPartButton
          id="body-parts/bicep"
          name="Biceps"
          isSelected={selectedParts.includes('body-parts/bicep')}
          onToggle={toggleBodyPart}
        />
        <BodyPartButton
          id="body-parts/tricep"
          name="Triceps" 
          isSelected={selectedParts.includes('body-parts/tricep')}
          onToggle={toggleBodyPart}
        />
        <BodyPartButton
          id="body-parts/chest"
          name="Chest"
          isSelected={selectedParts.includes('body-parts/chest')}
          onToggle={toggleBodyPart}
        />
        <BodyPartButton
          id="body-parts/calves"
          name="Calves"
          isSelected={selectedParts.includes('body-parts/calves')}
          onToggle={toggleBodyPart}
        />
        <BodyPartButton
          id="body-parts/abs"
          name="Abs"
          isSelected={selectedParts.includes('body-parts/abs')}
          onToggle={toggleBodyPart}
        />
        <BodyPartButton
          id="body-parts/hamstrings"
          name="Hamstrings"
          isSelected={selectedParts.includes('body-parts/hamstrings')}
          onToggle={toggleBodyPart}
        />
        <BodyPartButton
          id="body-parts/back"
          name="Back"
          isSelected={selectedParts.includes('body-parts/back')}
          onToggle={toggleBodyPart}
        />
        <BodyPartButton
          id="body-parts/deltoids"
          name="Deltoids"
          isSelected={selectedParts.includes('body-parts/deltoids')}
          onToggle={toggleBodyPart}
        />
        <BodyPartButton
          id="body-parts/glutes"
          name="Glutes"
          isSelected={selectedParts.includes('body-parts/glutes')}
          onToggle={toggleBodyPart}
        />
        <BodyPartButton
          id="body-parts/lats"
          name="Lats"
          isSelected={selectedParts.includes('body-parts/lats')}
          onToggle={toggleBodyPart}
        />
        <BodyPartButton
          id="body-parts/lowerback"
          name="Lower Back"
          isSelected={selectedParts.includes('body-parts/lowerback')}
          onToggle={toggleBodyPart}
        />
        <BodyPartButton
          id="body-parts/quadriceps"
          name="Quadriceps"
          isSelected={selectedParts.includes('body-parts/quadriceps')}
          onToggle={toggleBodyPart}
        />
        <BodyPartButton
          id="body-parts/rhomboids"
          name="Rhomboids"
          isSelected={selectedParts.includes('body-parts/rhomboids')}
          onToggle={toggleBodyPart}
        />
        </div>

        {selectedParts.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-zinc-900/90 backdrop-blur-sm border-t border-zinc-800">
            <div className="max-w-6xl mx-auto">
              <button
                onClick={async () => {
                  if (isGenerating) return;
                  try {
                    setIsGenerating(true);
                    
                    // Map selected IDs like "body-parts/bicep" -> "bicep"
                    const bodyParts = selectedParts.map(p => p.replace('body-parts/', ''));

                    // Resolve current user early for goal + session
                    const currentUser = userService.nonUICurrentUser;
                    if (!currentUser?.id || !currentUser.username) {
                      console.error('No signed-in user found when generating workout');
                      setIsGenerating(false);
                      return;
                    }

                    // Ensure we have exercises loaded (with videos) similar to iOS
                    await exerciseService.fetchExercises();
                    const allExercises = exerciseService.allExercises || [];

                    // Normalize selected body parts and handle "back" expansion like iOS
                    const normalizedBodyParts = bodyParts.flatMap(part => {
                      const p = part.toLowerCase();
                      if (p === 'back') {
                        return ['lats', 'traps', 'rhomboids'];
                      }
                      return [p];
                    });

                    // Filter exercises whose primary body parts intersect with the selected set
                    let filtered = allExercises.filter(ex => {
                      const primary = (ex.primaryBodyParts || []).map(bp => bp.toLowerCase());
                      return primary.some(bp => normalizedBodyParts.includes(bp));
                    });

                    // Fallback: if nothing matches, allow AI to pick from all exercises
                    if (!filtered.length) {
                      console.warn('No exercises found for selected body parts via primaryBodyParts; falling back to all exercises');
                      filtered = allExercises;
                    }

                    // Build the text lists for the Netlify AI function
                    const exerciseList = filtered.map(ex => ex.name);
                    const allExerciseNames = allExercises.map(ex => ex.name);

                    const goalString =
                      Array.isArray(currentUser.goal) && currentUser.goal.length
                        ? `${currentUser.goal.join(', ')}${
                            currentUser.additionalGoals ? ` and ${currentUser.additionalGoals}` : ''
                          }`
                        : currentUser.additionalGoals || '';

                    // Call Netlify function to generate grouped exercise names, mirroring iOS GPTService
                    const response = await fetch('/.netlify/functions/generate-workout-from-body-parts', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        bodyPartsInput: bodyParts.map(bp => bp.toLowerCase()),
                        exerciseList,
                        allExercises: allExerciseNames,
                        predefinedExercises: [],
                        goal: goalString,
                      }),
                    });

                    let groups: string[][] = [];

                    if (response.ok) {
                      const data = await response.json();
                      groups = (data && Array.isArray(data.groups) ? data.groups : []) as string[][];
                    } else {
                      console.error('AI workout generation function returned error', await response.text());
                    }

                    // Map AI-selected exercise names back to Exercise objects
                    const nameToExercise = new Map(
                      allExercises.map(ex => [ex.name.toLowerCase().trim(), ex])
                    );

                    let exerciseDetails: ExerciseDetail[] = [];

                    if (groups.length) {
                      groups.forEach((group, groupIndex) => {
                        group.forEach(name => {
                          const key = String(name || '').toLowerCase().trim();
                          const match =
                            nameToExercise.get(key) ||
                            allExercises.find(ex => ex.name.toLowerCase().trim() === key);

                          if (match) {
                            exerciseDetails.push(new ExerciseDetail({
                              exercise: match,
                              exerciseName: match.name,
                              category: match.category,
                              notes: '',
                              isSplit: false,
                              isMissing: false,
                              groupId: groupIndex,
                              exerciseLogId: undefined,
                            }));
                          }
                        });
                      });
                    }

                    // Fallback: if AI output couldn't be mapped, just use filtered exercises
                    if (!exerciseDetails.length) {
                      console.warn('AI response could not be mapped to exercises; falling back to filtered list');
                      exerciseDetails = filtered.slice(0, 6).map((ex, index) => new ExerciseDetail({
                        exercise: ex,
                        exerciseName: ex.name,
                        category: ex.category,
                        notes: '',
                        isSplit: false,
                        isMissing: false,
                        groupId: Math.floor(index / 2),
                        exerciseLogId: undefined,
                      }));
                    }

                    const { workout, exerciseLogs } = await workoutService.formatWorkoutAndInitializeLogs(
                      exerciseDetails
                    );

                    // Give workout a similar title to iOS
                    const titleBodyParts = bodyParts.join(' & ') || 'Full Body';
                    workout.title = `Pulse AI: ${titleBodyParts} Workout`;

                    // Save as a user stack (MyCreatedWorkouts) like other web-generated workouts
                    try {
                      await userService.createStack(workout, exerciseLogs);
                    } catch (stackErr) {
                      console.error('Failed to create stack for generated workout:', stackErr);
                      setIsGenerating(false);
                      return;
                    }

                    // Navigate to workout preview page which loads from MyCreatedWorkouts
                    onCreateWorkout(selectedParts);
                    onClose();
                    router.push(
                      `/workout/${encodeURIComponent(currentUser.username)}/${encodeURIComponent(
                        workout.id
                      )}`
                    );
                  } catch (err) {
                    console.error('Error generating workout from body parts:', err);
                  } finally {
                    setIsGenerating(false);
                  }
                }}
                className="w-full py-4 rounded-full bg-[#E0FE10] text-black font-semibold text-lg disabled:opacity-60"
                disabled={isGenerating}
              >
                {isGenerating ? 'Creating workout...' : 'Create workout'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkoutTypeSelector;

interface BodyPartButtonProps {
  id: string;
  name: string;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

const BodyPartButton: React.FC<BodyPartButtonProps> = ({
  id,
  name,
  isSelected,
  onToggle,
}) => {
  return (
    <button
      onClick={() => onToggle(id)}
      className={`relative aspect-square rounded-2xl bg-zinc-800/50 flex flex-col items-center justify-end
        ${isSelected ? 'ring-2 ring-[#E0FE10]' : ''}
        max-w-[250px] w-full mx-auto`}
    >
      <img 
        src={`${id}.svg`}
        alt={name}
        className="w-full h-full object-contain opacity-75"
      />
      
      {isSelected && (
        <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-[#E0FE10] flex items-center justify-center">
          <Check className="text-black" size={16} />
        </div>
      )}
    </button>
  );
};

