import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { 
    Users,
    Lock,
    Dumbbell,
    Brain,
    UserCircle,
    Sparkles,
    X,
  } from 'lucide-react';
import { Switch } from '@headlessui/react';

import { userService } from '../api/firebase/user';
import { workoutService } from '../api/firebase/workout/service';
import { exerciseService } from '../api/firebase/exercise/service';
import { Exercise, ExerciseDetail, ExerciseCategory, ExerciseVideo, ExerciseReference, WeightTrainingExercise, CardioExercise } from '../api/firebase/exercise/types';
import { Workout, SweatlistCollection, Challenge, ChallengeStatus, SweatlistIdentifiers, WorkoutStatus } from '../api/firebase/workout/types';
import { StackCard } from '../components/Rounds/StackCard'
import { ExerciseGrid } from '../components/App/ExerciseGrid/ExerciseGrid';
import { MultiUserSelector } from '../components/App/MultiSelectUser/MultiSelectUser';
import { generateId } from '../utils/generateId';
import { useUser } from '../hooks/useUser';

// Type definitions
export enum SweatlistType {
  together = 'together',
  locked = 'locked'
}

interface ViewModel {
  appCoordinator: {
    showFloatingTextfield: (options: {
      title: string;
      theme: string;
      keyboardType: string;
      maxLength?: number;
      minLength?: number;
      returnText: (text: string) => void;
      onDone: (text: string) => void;
      closeMenuDrawer: () => void;
    }) => void;
    closeFloatingMenu: () => void;
    closeModals: () => void;
  };
  
  validateChallengeInput: (
    startDate: Date,
    endDate: Date,
    name: string,
    desc: string,
    type: SweatlistType,
    pin: string
  ) => boolean;

  setChallenge: (
    startDate: Date,
    endDate: Date,
    name: string,
    desc: string,
    type: SweatlistType,
    pin: string,
    restDayPreferences?: {
      includeRestDays: boolean;
      restDays: string[];
      preferences: string[];
    }
  ) => void;
}

interface ChallengeData {
  startDate: Date;
  endDate: Date;
  challengeName: string;
  challengeDesc: string;
  roundType: SweatlistType;
  pinCode: string;
  restDayPreferences?: {
    includeRestDays: boolean;
    restDays: string[];
    preferences: string[];
  };
}

interface MobileChallengeSetupProps {
  setChallengeData: (startDate: Date, endDate: Date, name: string, desc: string, type: SweatlistType, pin: string) => void;
  currentChallengeData: ChallengeData;
  selectedStacks: Workout[];
  setSelectedStacks: (stacks: Workout[] | ((prev: Workout[]) => Workout[])) => void;
  onRemoveStack: (stackId: string) => void;
  viewModel: ViewModel;
}

interface DayPreference {
  day: string;
  isSelected: boolean;
}

const MobileChallengeSetupView: React.FC<MobileChallengeSetupProps> = ({
    setChallengeData,
    currentChallengeData,
    selectedStacks,
    setSelectedStacks,
    onRemoveStack,
    viewModel,
  }) => {
    const {
      startDate,
      endDate,
      challengeName,
      challengeDesc,
      roundType,
      pinCode,
    } = currentChallengeData;
  
    // Refs for different sections
    const roundTypeRef = useRef<HTMLDivElement>(null);
    const pinCodeRef = useRef<HTMLInputElement>(null);
  
    // Date formatter
    const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });
  
    // Effect to scroll when round type changes to locked
    useEffect(() => {
      if (roundType === SweatlistType.locked) {
        // Slight delay to ensure DOM is updated
        setTimeout(() => {
          if (pinCodeRef.current) {
            pinCodeRef.current.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
          }
        }, 100);
      }
    }, [roundType]);
  
    const handleStackSelection = (stack: Workout) => {
      // Ensure proper mapping of exercise details when selecting stacks
      const mappedExercises = stack.exercises?.map(exercise => {
        const categoryType = exercise.exercise.category?.type || 'weight-training';
        const categoryDetails = exercise.exercise.category?.details;
        const isWeightTraining = categoryType === 'weight-training';

        return new ExerciseDetail({
          exercise: exercise.exercise,
          category: {
            type: categoryType,
            details: isWeightTraining 
              ? {
                  sets: (categoryDetails as WeightTrainingExercise)?.sets || 3,
                  reps: (categoryDetails as WeightTrainingExercise)?.reps || ['12'],
                  weight: (categoryDetails as WeightTrainingExercise)?.weight || 0,
                  screenTime: categoryDetails?.screenTime || 0,
                  selectedVideo: categoryDetails?.selectedVideo 
                    ? new ExerciseVideo(categoryDetails.selectedVideo)
                    : null
                }
              : {
                  duration: (categoryDetails as CardioExercise)?.duration || 60,
                  bpm: (categoryDetails as CardioExercise)?.bpm || 140,
                  calories: (categoryDetails as CardioExercise)?.calories || 0,
                  screenTime: categoryDetails?.screenTime || 0,
                  selectedVideo: categoryDetails?.selectedVideo 
                    ? new ExerciseVideo(categoryDetails.selectedVideo)
                    : null
                }
          }
        });
      }) || [];

      const updatedStack = new Workout({
        ...stack,
        exercises: mappedExercises
      });

      setChallengeData(
        startDate,
        endDate,
        challengeName,
        challengeDesc,
        roundType,
        pinCode
      );

      setSelectedStacks(prev => [...prev, updatedStack]);
    };

    const handleRemoveStack = (stackId: string) => {
      onRemoveStack(stackId);
    };

    // When saving/updating the challenge
    const handleSaveChallenge = async () => {
      if (!currentChallengeData) return;

      try {
        // Ensure all stacks have properly mapped exercise details
        const mappedStacks = selectedStacks.map(stack => {
          const mappedExercises = stack.exercises?.map(exercise => {
            const categoryType = exercise.exercise.category?.type || 'weight-training';
            const categoryDetails = exercise.exercise.category?.details;
            const isWeightTraining = categoryType === 'weight-training';

            return new ExerciseDetail({
              exercise: exercise.exercise,
              category: {
                type: categoryType,
                details: isWeightTraining 
                  ? {
                      sets: (categoryDetails as WeightTrainingExercise)?.sets || 3,
                      reps: (categoryDetails as WeightTrainingExercise)?.reps || ['12'],
                      weight: (categoryDetails as WeightTrainingExercise)?.weight || 0,
                      screenTime: categoryDetails?.screenTime || 0,
                      selectedVideo: categoryDetails?.selectedVideo 
                        ? new ExerciseVideo(categoryDetails.selectedVideo)
                        : null
                    }
                  : {
                      duration: (categoryDetails as CardioExercise)?.duration || 60,
                      bpm: (categoryDetails as CardioExercise)?.bpm || 140,
                      calories: (categoryDetails as CardioExercise)?.calories || 0,
                      screenTime: categoryDetails?.screenTime || 0,
                      selectedVideo: categoryDetails?.selectedVideo 
                        ? new ExerciseVideo(categoryDetails.selectedVideo)
                        : null
                    }
              }
            });
          }) || [];

          return new Workout({
            ...stack,
            exercises: mappedExercises
          });
        });

        // Update challenge data with properly mapped stacks
        setChallengeData(
          currentChallengeData.startDate,
          currentChallengeData.endDate,
          currentChallengeData.challengeName,
          currentChallengeData.challengeDesc,
          currentChallengeData.roundType,
          currentChallengeData.pinCode
        );

        // Save to Firebase with properly mapped data
        const currentUser = useUser();
        await workoutService.saveWorkoutSession({
          userId: currentUser?.id || '',
          workout: mappedStacks[0], // Assuming first stack is the main one
          logs: mappedStacks[0].logs || []
        });

      } catch (error) {
        console.error('Error saving challenge:', error);
      }
    };

    const [activeTab, setActiveTab] = useState('preferences');
    const [includeRestDays, setIncludeRestDays] = useState(false);
    const [selectedPreferences, setSelectedPreferences] = useState<string[]>([]);
    const [restDayPreferences, setRestDayPreferences] = useState<DayPreference[]>([
      { day: 'Monday', isSelected: false },
      { day: 'Tuesday', isSelected: false },
      { day: 'Wednesday', isSelected: false },
      { day: 'Thursday', isSelected: false },
      { day: 'Friday', isSelected: false },
      { day: 'Saturday', isSelected: false },
      { day: 'Sunday', isSelected: false },
    ]);

    const handleIncludeRestDaysChange = (checked: boolean) => {
      setIncludeRestDays(checked);
      if (!checked) {
        // Clear rest day selections when toggled off
        setRestDayPreferences(prev => prev.map(p => ({ ...p, isSelected: false })));
        // Remove any rest day preferences from the selected preferences
        setSelectedPreferences(prev => 
          prev.filter(p => !p.includes('Schedule rest days'))
        );
      }
    };

    const handleRestDayPreferencesChange = (updatedDay: string) => {
      setRestDayPreferences(prev => {
        const newPreferences = prev.map(p =>
          p.day === updatedDay ? { ...p, isSelected: !p.isSelected } : p
        );
        
        // Get selected days
        const selectedDays = newPreferences
          .filter(p => p.isSelected)
          .map(p => p.day)
          .join(', ');

        // Update preferences array with rest day instruction
        if (selectedDays.length > 0 && includeRestDays) {
          const restDayPrompt = `Schedule rest days on ${selectedDays} throughout the program duration. Ensure these days align with the program's start date ${startDate.toLocaleDateString()} and end date ${endDate.toLocaleDateString()}.`;
          
          setSelectedPreferences(prev => {
            const prefsWithoutRest = prev.filter(p => !p.includes('Schedule rest days'));
            return [...prefsWithoutRest, restDayPrompt];
          });
        } else {
          setSelectedPreferences(prev => 
            prev.filter(p => !p.includes('Schedule rest days'))
          );
        }

        return newPreferences;
      });
    };

    return (
      <div className="relative h-full">
        <h1 className="text-2xl font-semibold text-white text-center mb-2">Create a Round</h1>
        <p className="text-zinc-400 text-center text-sm mb-8">
          Rounds are structured training programs that guide you through a series of Stacks over time.
        </p>
  
        {/* Round Name */}
        <div className="mb-6">
          <label className="text-sm text-zinc-400 mb-2 block">Round Name</label>
          <input
            type="text"
            value={challengeName}
            onChange={(e) => setChallengeData(
              startDate, 
              endDate, 
              e.target.value, 
              challengeDesc, 
              roundType, 
              pinCode
            )}
            placeholder="Add a name for your round"
            className="w-full p-3 bg-[#262a30] border border-gray-700 rounded-lg 
                      text-white placeholder-gray-500
                      focus:outline-none focus:ring-2 focus:ring-[#E0FE10] transition-all"
          />
        </div>
  
        {/* Description */}
        <div className="mb-8">
          <label className="text-sm text-zinc-400 mb-2 block">Description</label>
          <textarea
            value={challengeDesc}
            onChange={(e) => setChallengeData(
              startDate, 
              endDate, 
              challengeName, 
              e.target.value, 
              roundType, 
              pinCode
            )}
            placeholder="Add a description for your round"
            rows={3}
            className="w-full p-3 bg-[#262a30] border border-gray-700 rounded-lg 
                      text-white placeholder-gray-500
                      focus:outline-none focus:ring-2 focus:ring-[#E0FE10] transition-all resize-none"
          />
        </div>
  
        {/* Selected Stacks */}
        <div className="mb-8">
          <label className="text-sm text-zinc-400 mb-2 block">Selected Stacks</label>
          {selectedStacks.length === 0 ? (
            <div className="p-4 rounded-lg bg-[#262a30] border border-gray-700 text-center">
              <p className="text-zinc-400">No stacks selected yet</p>
              <p className="text-zinc-500 text-sm mt-1">Select stacks to add them to your round</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedStacks.map((stack) => (
                <div className="border border-gray-700 rounded-lg bg-[#1a1e24] overflow-hidden"> 
                    <StackCard
                    key={stack.roundWorkoutId || stack.id}
                    workout={stack}
                    gifUrls={stack.exercises?.map(ex => ex.exercise?.videos?.[0]?.gifURL || '') || []}
                    isChallengeEnabled={false}
                    onPrimaryAction={() => handleStackSelection(stack)}
                    />
                </div>
              ))}
            </div>
          )}
        </div>
  
        {/* Round Type */}
        <div ref={roundTypeRef} className="mb-8">
          <label className="text-sm text-zinc-400 mb-2 block">Round Type</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setChallengeData(startDate, endDate, challengeName, challengeDesc, SweatlistType.together, pinCode)}
              className={`p-4 rounded-lg flex flex-col items-center transition-colors ${
                roundType === SweatlistType.together 
                  ? "bg-[#E0FE10] text-black" 
                  : "bg-[#262a30] border border-gray-700 text-gray-300 hover:bg-[#2a2f36]"
              }`}
            >
              <Users className="h-5 w-5 mb-2" />
              <span className="font-medium text-sm">Together</span>
              <span className="text-xs mt-1">Train with the community</span>
            </button>
  
            <button
              onClick={() => setChallengeData(startDate, endDate, challengeName, challengeDesc, SweatlistType.locked, pinCode)}
              className={`p-4 rounded-lg flex flex-col items-center transition-colors ${
                roundType === SweatlistType.locked 
                  ? "bg-[#E0FE10] text-black" 
                  : "bg-[#262a30] border border-gray-700 text-gray-300 hover:bg-[#2a2f36]"
              }`}
            >
              <Lock className="h-5 w-5 mb-2" />
              <span className="font-medium text-sm">Private</span>
              <span className="text-xs mt-1">Invite-only training</span>
            </button>
          </div>
        </div>
  
        {/* Dates */}
        <div className={`mb-8 ${roundType === SweatlistType.locked ? 'pb-0' : 'pb-32'}`}> 
          <label className="text-sm text-zinc-400 mb-2 block">Round Dates</label>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Start Date</label>
              <input
                type="date"
                value={startDate.toISOString().split('T')[0]}
                onChange={(e) => setChallengeData(
                  new Date(e.target.value),
                  endDate,
                  challengeName,
                  challengeDesc,
                  roundType,
                  pinCode
                )}
                className="w-full p-3 rounded-lg bg-[#262a30] border border-gray-700 
                        text-white placeholder-gray-500
                        focus:outline-none focus:ring-2 focus:ring-[#E0FE10] transition-all
                        [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">End Date</label>
              <input
                type="date"
                value={endDate.toISOString().split('T')[0]}
                min={startDate.toISOString().split('T')[0]}
                onChange={(e) => setChallengeData(
                  startDate,
                  new Date(e.target.value),
                  challengeName,
                  challengeDesc,
                  roundType,
                  pinCode
                )}
                className="w-full p-3 rounded-lg bg-[#262a30] border border-gray-700 
                        text-white placeholder-gray-500
                        focus:outline-none focus:ring-2 focus:ring-[#E0FE10] transition-all
                        [color-scheme:dark]"
              />
            </div>
          </div>
        </div>
  
        {roundType === SweatlistType.locked && (
          <div className="mb-32"> 
            <label htmlFor="pinCode" className="text-sm text-zinc-400 mb-2 block">PIN Code</label>
            <input
              ref={pinCodeRef}
              id="pinCode"
              type="text"
              maxLength={9}
              minLength={9}
              value={pinCode}
              onChange={(e) => setChallengeData(
                startDate,
                endDate,
                challengeName,
                challengeDesc,
                roundType,
                e.target.value
              )}
              placeholder="Set 9-digit PIN"
              className="w-full p-3 rounded-lg bg-[#262a30] border border-gray-700 
                        text-white placeholder-gray-500
                        focus:outline-none focus:ring-2 focus:ring-[#E0FE10] transition-all"
            />
          </div>
        )}

        <div className="space-y-4 mb-32"> 
            <div className="bg-[#262a30] rounded-lg p-4 border border-gray-700">
              <h3 className="font-medium text-white mb-2">Workout Preferences</h3>
              <p className="text-sm text-zinc-400 mb-4">
                Select your preferences for this program
              </p>
              <div className="grid grid-cols-2 gap-2">
                {selectedPreferences.map((preference: string) => (
                  <button
                    key={preference}
                    onClick={() => {
                      setSelectedPreferences(prev =>
                        prev.includes(preference)
                          ? prev.filter(p => p !== preference)
                          : [...prev, preference]
                      );
                    }}
                    className={`p-3 rounded-lg text-sm font-medium transition-colors border ${
                      selectedPreferences.includes(preference)
                        ? 'bg-[#E0FE10] text-black border-[#E0FE10]'
                        : 'bg-[#1a1e24] text-gray-300 border-gray-600 hover:bg-[#2a2f36]'
                    }`}
                  >
                    {preference}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="bg-[#262a30] rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-medium text-white">Rest Days</h3>
                  <p className="text-sm text-zinc-400">Include specific rest days in your program</p>
                </div>
                <Switch
                  checked={includeRestDays}
                  onChange={handleIncludeRestDaysChange}
                  className={`${
                    includeRestDays ? 'bg-[#E0FE10]' : 'bg-gray-600'
                  } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75`}
                >
                  <span className="sr-only">Include rest days</span>
                  <span
                    aria-hidden="true"
                    className={`${
                      includeRestDays ? 'translate-x-6' : 'translate-x-1'
                    } inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out`}
                  />
                </Switch>
              </div>

              {includeRestDays && (
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {restDayPreferences.map((pref) => (
                    <button
                      key={pref.day}
                      onClick={() => handleRestDayPreferencesChange(pref.day)}
                      className={`p-3 rounded-lg text-sm font-medium transition-colors border ${
                        pref.isSelected
                          ? 'bg-[#E0FE10] text-black border-[#E0FE10]'
                          : 'bg-[#1a1e24] text-gray-300 border-gray-600 hover:bg-[#2a2f36]'
                      }`}
                    >
                      {pref.day}
                    </button>
                  ))}
                </div>
              )}
            </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#1a1e24] border-t border-gray-700 max-w-[500px] mx-auto">
          <button
            className="w-full py-3 bg-[#E0FE10] text-black rounded-lg font-semibold hover:opacity-90 transition-opacity"
            onClick={() => {
              const selectedRestDays = includeRestDays
                ? restDayPreferences
                    .filter(pref => pref.isSelected)
                    .map(pref => pref.day)
                : [];

              if (viewModel.validateChallengeInput(
                startDate,
                endDate,
                challengeName,
                challengeDesc,
                roundType,
                pinCode
              )) {
                viewModel.setChallenge(
                  startDate,
                  endDate,
                  challengeName,
                  challengeDesc,
                  roundType,
                  pinCode,
                  {
                    includeRestDays,
                    restDays: selectedRestDays,
                    preferences: selectedPreferences
                  }
                );
                viewModel.appCoordinator.closeModals();
              }
            }}
          >
            Create Round
          </button>
        </div>
      </div>
    );
  };

interface DesktopChallengeSetupProps {
  challengeData: ChallengeData;
  setChallengeData: (
    start: Date,
    end: Date,
    name: string,
    desc: string,
    type: SweatlistType,
    pin: string
  ) => void;
  viewModel: ViewModel;
}

// In the DesktopChallengeSetupView component
const DesktopChallengeSetupView: React.FC<DesktopChallengeSetupProps> = ({
    challengeData,
    setChallengeData,
    viewModel,
  }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [allStacks, setAllStacks] = useState<Workout[]>([]);
    const [selectedStacks, setSelectedStacks] = useState<Workout[]>([]);
    const [isAIMode, setIsAIMode] = useState(false);
    const [loading, setLoading] = useState(true);
    const currentUser = useUser();

    const preferences = [
      "Exclusive to selected creators",
      "Use stacks I've created/saved in my library",
      "Create unique stacks for each day.",
    ];

    // Add these states in DesktopChallengeSetupView
    const [aiPromptText, setAiPromptText] = useState('');
    const [selectedPreferences, setSelectedPreferences] = useState<string[]>([]);

    const [activeTab, setActiveTab] = useState<'preferences' | 'moves' | 'creators'>('preferences');
    const [selectedCreators, setSelectedCreators] = useState<string[]>([]);
    const [selectedMoves, setSelectedMoves] = useState<Exercise[]>([]);
    const [allExercises, setAllExercises] = useState<Exercise[]>([]);

    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generationProgress, setGenerationProgress] = useState('');

    const router = useRouter();
    
    const filteredStacksList = () => (
        <div className="space-y-4">
          {filteredStacks.map((stack) => (
            <div className="border border-gray-700 rounded-lg bg-[#262a30] overflow-hidden">
            <StackCard
                key={stack.id}
                workout={stack}
                gifUrls={stack.exercises?.map(ex => ex.exercise?.videos?.[0]?.gifURL || '') || []}
                isChallengeEnabled={false}
                onPrimaryAction={() => handleStackSelect(stack)}
            />
            </div>
            ))}

        </div>
      );

    useEffect(() => {
        const fetchData = async () => {
            try {
            await exerciseService.fetchExercises();
            setAllExercises(exerciseService.allExercises);
            } catch (error) {
            console.error('Error fetching exercises:', error);
            }
        };
        fetchData();
    }, []);
  
    useEffect(() => {
      const fetchStacks = async () => {
        try {
          // Use the actual userService instead of mock data
          const stacks = await userService.fetchUserStacks();
          setAllStacks(stacks);
        } catch (error) {
          console.error('Error fetching stacks:', error);
        }
      };
      fetchStacks();
    }, []);

  const filteredStacks = allStacks.filter((stack) =>
    stack.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStackSelect = (stack: Workout) => {
    setSelectedStacks((prev: Workout[]) => {
      // First check if we already have this stack
      if (prev.some(s => s.id === stack.id)) {
        // Get all stacks with the same ID
        const sameStacks = prev.filter(s => s.id === stack.id);
        const newStack = new Workout({
          ...stack,
          roundWorkoutId: `${stack.id}-${sameStacks.length + 1}`
        });
        return [...prev, newStack];
      } else {
        // First instance of this stack
        const newStack = new Workout({
          ...stack,
          roundWorkoutId: stack.id
        });
        return [...prev, newStack];
      }
    });
  };

  const generateUniqueWorkoutIds = (stacks: Workout[]): Workout[] => {
    return stacks.map((stack, index) => {
      // Create a new Workout instance with the updated roundWorkoutId
      const updatedWorkout = new Workout({
        ...stack,
        roundWorkoutId: index === 0 ? stack.id : `${stack.id}-${index + 1}`
      });
      return updatedWorkout;
    });
  };

  const handleRemoveStack = (stackId: string) => {
    setSelectedStacks((prev: Workout[]) => {
      // Filter out the stack to remove
      const updatedStacks = prev.filter(s => s.roundWorkoutId !== stackId);
      
      // Reindex the remaining stacks
      return updatedStacks.map((stack, index) => 
        new Workout({
          ...stack,
          roundWorkoutId: index === 0 ? stack.id : `${stack.id}-${index + 1}`
        })
      );
    });
  };

  const validateChallengeInput = (): boolean => {
    if (challengeData.challengeName.trim().length === 0) {
    //   toast({
    //     title: "Error",
    //     description: "Round needs a name before you can create it",
    //     variant: "destructive"
    //   });
      return false;
    }

    if (challengeData.challengeDesc.trim().length === 0) {
    //   toast({
    //     title: "Error",
    //     description: "Round needs a description before you can create it",
    //     variant: "destructive"
    //   });
      return false;
    }

    if (challengeData.endDate <= challengeData.startDate) {
    //   toast({
    //     title: "Error",
    //     description: "Round start date needs to be before the end date",
    //     variant: "destructive"
    //   });
      return false;
    }

    if (challengeData.roundType === SweatlistType.locked && challengeData.pinCode.length !== 9) {
    //   toast({
    //     title: "Error",
    //     description: "Private rounds require a 9-digit PIN",
    //     variant: "destructive"
    //   });
      return false;
    }

    if (selectedStacks.length === 0) {
    //   toast({
    //     title: "Error",
    //     description: "Please select at least one stack for your round",
    //     variant: "destructive"
    //   });
      return false;
    }

    return true;
  };

  // Helper function to find complete exercise data and preferred creator video
  const enrichExerciseData = (
    exerciseData: any,
    allExercises: Exercise[],
    creatorExercises: Exercise[],
    useOnlyCreatorExercises: boolean
  ): ExerciseDetail | null => {
    const exercisePool = useOnlyCreatorExercises ? creatorExercises : allExercises;
    
    const baseExercise = exercisePool.find(ex => 
      ex.name.toLowerCase() === exerciseData.name.toLowerCase()
    );
  
    if (!baseExercise) return null;
  
    const category = exerciseData.category.type === 'weight-training' 
      ? ExerciseCategory.weightTraining({
          reps: exerciseData.category.details.reps || ['10'],
          sets: exerciseData.category.details.sets || 3,
          weight: exerciseData.category.details.weight || 0,
          screenTime: exerciseData.category.details.screenTime || 60,
          selectedVideo: baseExercise.videos?.[0] || null
        })
      : ExerciseCategory.cardio({
          duration: exerciseData.category.details.duration || 60,
          bpm: exerciseData.category.details.bpm || 0,
          calories: exerciseData.category.details.calories || 0,
          screenTime: exerciseData.category.details.screenTime || 60,
          selectedVideo: baseExercise.videos?.[0] || null
        });
  
    return new ExerciseDetail({
      id: generateId(),
      exercise: baseExercise,
      exerciseName: exerciseData.name,
      isMissing: false,
      groupId: 0,
      category: category,
      notes: '',
      isSplit: false,
      closestMatch: []
    });
  };

  const filterExercisesByCreators = (exercises: Exercise[], selectedCreatorIds: string[]) => {
    return exercises.filter(exercise => 
      exercise.videos?.some(video => selectedCreatorIds.includes(video.userId))
    );
  };

  const handleGenerateAIRound = async () => {
    try {
      setIsGenerating(true);
      setError(null);
  
      // Get all exercises
      let availableExercises = allExercises;

      // If "Exclusive to selected creators" is selected, filter exercises
      if (selectedPreferences.includes("Exclusive to selected creators")) {
        availableExercises = filterExercisesByCreators(allExercises, selectedCreators);
        
        if (availableExercises.length === 0) {
          throw new Error("No exercises found from selected creators. Please select different creators or disable exclusive creator content.");
        }
      }
      console.log("selectedCreators are: ", selectedCreators);
      console.log("Available exercises after creator filtering:", availableExercises.length);

      console.log("the must indluded exercsies are: ", selectedMoves.map(move => move.name));
      console.log("the must indluded exercsies are: ", selectedPreferences);
      console.log("the must all creators: ", availableExercises);
      console.log("the must all available exercises: ", allExercises);
      console.log("the must start date: ", challengeData.startDate);
      console.log("the must end date: ", challengeData.endDate);


      // Use availableExercises instead of allExercises in your AI generation logic
      const response = await fetch('/api/generateRound', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mustIncludeExercises: selectedMoves.map(move => move.name),
          userPrompt: aiPromptText,
          preferences: selectedPreferences,
          availableExercises,
          startDate: challengeData.startDate,
          endDate: challengeData.endDate,
        }),
      });
  
      if (!response.ok) {
        throw new Error('Failed to generate workout round');
      }
  
      const generatedResponse = await response.json();
      const generatedRound = generatedResponse.choices[0].message.content;

      // Clean up the response string as a safety measure
      let cleanedResponse = generatedRound
        .replace(/^```json\n/, '')
        .replace(/\n```$/, '')
        .trim();

      let parsedRound;
      try {
        parsedRound = JSON.parse(cleanedResponse);
      } catch (error) {
        console.error('Error parsing AI response:', error);
        console.log('Raw response:', generatedRound);
        console.log('Cleaned response:', cleanedResponse);
        throw new Error('Failed to parse AI response');
      }
  
      console.log('Generated round data:', parsedRound);
      const createdStacks = [];
      const sweatlistIds = [];
      let currentOrder = 0;

      for (const stackData of parsedRound.stacks) {
        currentOrder++;
        
        if (stackData.title.toLowerCase() === "rest") {
          // Just create the SweatlistIdentifier for rest days
          sweatlistIds.push(new SweatlistIdentifiers({
            id: "rest-" + generateId(),
            sweatlistAuthorId: currentUser?.id || '',
            sweatlistName: "Rest",
            order: currentOrder,
            isRest: true
          }));
          continue;
        }

        // Regular workout processing
        try {
          const useOnlyCreatorExercises = selectedPreferences.includes("Creator videos only");
          
          const enrichedExercises = stackData.exercises
            .map((ex: ExerciseReference) => {
              try {
                return enrichExerciseData(ex, allExercises, availableExercises, useOnlyCreatorExercises);
              } catch (error) {
                console.warn(`Skipping exercise ${ex.exercise.name}: ${error}`);
                return null;
              }
            })
            .filter((exercise: ExerciseDetail | null): exercise is ExerciseDetail => exercise !== null);

          if (enrichedExercises.length > 0) {
            const { workout, exerciseLogs } = await workoutService.formatWorkoutAndInitializeLogs(
              enrichedExercises,
              currentUser?.id
            );

            workout.title = stackData.title;
            workout.description = `${stackData.description} (${enrichedExercises.length} exercises)`;
            workout.workoutStatus = WorkoutStatus.Archived;

            const createdStack = await userService.createStack(workout, exerciseLogs);
            
            if (createdStack) {
              createdStacks.push(createdStack);
              sweatlistIds.push(new SweatlistIdentifiers({
                id: createdStack.id,
                sweatlistAuthorId: currentUser?.id || '',
                sweatlistName: createdStack.title,
                order: currentOrder,
                isRest: false
              }));
            }
          }
        } catch (error) {
          console.error('Error creating stack:', stackData.title, error);
          continue;
        }
      }

      if (createdStacks.length === 0) {
        throw new Error('No stacks were successfully created');
      }
  
      // Create the round with the collected stacks
      const createdAt = new Date();
  
      if (!currentUser?.id) {
        throw new Error("No user logged in");
      }
  
      // Create challenge object
      const challenge = new Challenge({
        id: "",
        title: challengeData.challengeName,
        subtitle: challengeData.challengeDesc,
        participants: [],
        status: ChallengeStatus.Draft,
        startDate: challengeData.startDate,
        endDate: challengeData.endDate,
        createdAt,
        updatedAt: createdAt,
        ownerId: [currentUser?.id || '']
      });
  
      // Create the collection with all sweatlistIds
      const collection = new SweatlistCollection({
        id: "",
        title: challengeData.challengeName,
        subtitle: challengeData.challengeDesc,
        pin: challengeData.pinCode,
        challenge,
        sweatlistIds: sweatlistIds,
        ownerId: [currentUser?.id || ''],
        participants: [],
        privacy: challengeData.roundType,
        createdAt,
        updatedAt: createdAt
      });
  
      const updatedCollection = await workoutService.updateCollection(collection);
      if (updatedCollection) {
        router.push(`/round/${updatedCollection.id}`);
      }
  
    } catch (error) {
      console.error('Error in handleGenerateAIRound:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate workout round';
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateRound = async () => {
    if (!validateChallengeInput()) return;
  
    try {
      const createdAt = new Date();
  
      if (!currentUser?.id) {
        throw new Error("No user logged in");
      }
  
      // Create challenge object
      const challenge = new Challenge({
        id: "",
        title: challengeData.challengeName,
        subtitle: challengeData.challengeDesc,
        participants: [],
        status: ChallengeStatus.Draft,
        startDate: challengeData.startDate,
        endDate: challengeData.endDate,
        createdAt,
        updatedAt: createdAt,
        ownerId: [currentUser?.id || '']
      });
  
      // Create SweatlistCollection with proper structure
      const collection = new SweatlistCollection({
        id: "",
        title: challengeData.challengeName,
        subtitle: challengeData.challengeDesc,
        pin: challengeData.pinCode,
        challenge,
        sweatlistIds: selectedStacks.map((stack, index) => ({
          id: stack.id,
          sweatlistAuthorId: currentUser?.id || '',
          sweatlistName: stack.title,
          order: index + 1
        })),
        ownerId: [currentUser?.id || ''],
        participants: [],
        privacy: challengeData.roundType === SweatlistType.locked ? 
                 SweatlistType.locked : 
                 SweatlistType.together,
        createdAt,
        updatedAt: createdAt
      });
  
      // Update collection in Firestore
      const updatedCollection = await workoutService.updateCollection(collection);
      
      console.log("The collection is: ", updatedCollection);
      if (updatedCollection) {  
        router.push(`/round/${updatedCollection.id}`);
      }
    } catch (error) {
      console.error('Error creating round:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate workout round. Please try again.';
      setError(errorMessage);
    }
  };

  const [currentStage, setCurrentStage] = useState(0);
  const [currentExercise, setCurrentExercise] = useState('');
  const [fadeState, setFadeState] = useState('fade-in');

  const stages = [
    "Analyzing moves...",
    "Optimizing workout flow...",
    "Structuring your program...",
    "Almost there..."
  ];

  useEffect(() => {
    if (!isGenerating) return;

    let stageTimeout: NodeJS.Timeout;
    
    // Function to handle stage progression
    const progressStage = () => {
      setFadeState('fade-out');
      setTimeout(() => {
        setCurrentStage(prev => {
          const nextStage = prev + 1;
          // If we're moving to the last stage, don't set up next timeout
          if (nextStage === stages.length - 1) {
            return nextStage;
          }
          // Set up next stage transition
          stageTimeout = setTimeout(progressStage, 10000); // 10 seconds per stage
          return nextStage;
        });
        setFadeState('fade-in');
      }, 500);
    };

    // Start with first stage
    stageTimeout = setTimeout(progressStage, 10000); // First stage lasts 10 seconds

    // Continuously rotate through exercises throughout the entire loading process
    const exerciseInterval = setInterval(() => {
      if (allExercises.length > 0) {
        setFadeState('fade-out');
        setTimeout(() => {
          setCurrentExercise(allExercises[Math.floor(Math.random() * allExercises.length)].name);
          setFadeState('fade-in');
        }, 500);
      }
    }, 2000); // Change exercise every 2 seconds

    return () => {
      clearTimeout(stageTimeout);
      clearInterval(exerciseInterval);
    };
  }, [isGenerating, allExercises]);

  const [includeRestDays, setIncludeRestDays] = useState(false);
  const [restDayPreferences, setRestDayPreferences] = useState<DayPreference[]>([
    { day: 'Monday', isSelected: false },
    { day: 'Tuesday', isSelected: false },
    { day: 'Wednesday', isSelected: false },
    { day: 'Thursday', isSelected: false },
    { day: 'Friday', isSelected: false },
    { day: 'Saturday', isSelected: false },
    { day: 'Sunday', isSelected: false },
  ]);

  const handleRestDayPreferencesChange = (updatedDay: string) => {
    setRestDayPreferences(prev => {
      const newPreferences = prev.map(p =>
        p.day === updatedDay ? { ...p, isSelected: !p.isSelected } : p
      );
      
      // Get selected days
      const selectedDays = newPreferences
        .filter(p => p.isSelected)
        .map(p => p.day)
        .join(', ');

      // Update preferences array with rest day instruction
      if (selectedDays.length > 0 && includeRestDays) {
        const restDayPrompt = `Schedule rest days on ${selectedDays} throughout the program duration. Ensure these days align with the program's start date ${challengeData.startDate.toLocaleDateString()} and end date ${challengeData.endDate.toLocaleDateString()}.`;
        
        setSelectedPreferences(prev => {
          const prefsWithoutRest = prev.filter(p => !p.includes('Schedule rest days'));
          return [...prefsWithoutRest, restDayPrompt];
        });
      } else {
        setSelectedPreferences(prev => 
          prev.filter(p => !p.includes('Schedule rest days'))
        );
      }

      return newPreferences;
    });
  };

  const handleIncludeRestDaysChange = (checked: boolean) => {
    setIncludeRestDays(checked);
    if (!checked) {
      // Clear rest day selections when toggled off
      setRestDayPreferences(prev => prev.map(p => ({ ...p, isSelected: false })));
      // Remove any rest day preferences from the selected preferences
      setSelectedPreferences(prev => 
        prev.filter(p => !p.includes('Schedule rest days'))
      );
    }
  };

  return (
    
    <div className="h-screen flex flex-col lg:flex-row justify-center gap-6 bg-[#111417] p-6 text-white">
      {error && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 p-8 rounded-2xl shadow-xl max-w-md w-full mx-4">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <X className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="text-xl font-semibold text-white">Generation Failed</h3>
              <p className="text-zinc-400 text-center">
                {error}
              </p>
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => setError(null)}
                  className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setError(null);
                    handleGenerateAIRound();
                  }}
                  className="flex-1 px-4 py-2 bg-[#E0FE10] hover:bg-[#E0FE10]/90 text-black rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isGenerating && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 p-8 rounded-2xl shadow-xl max-w-md w-full mx-4">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E0FE10]" />
              <h3 className="text-xl font-semibold text-white">Generating Round</h3>
              <p className="text-zinc-400 text-center">
                Creating your personalized training program using AI. This may take a moment...
              </p>
              <div className={`text-[#E0FE10] text-lg loading-text-ready ${fadeState === 'fade-in' ? 'loading-text-visible' : 'loading-text-hidden'}`}>
                {stages[currentStage]}
              </div>
              {currentExercise && (
                <div className={`text-zinc-400 text-sm italic loading-text-ready ${fadeState === 'fade-in' ? 'loading-text-visible' : 'loading-text-hidden'}`}>
                  {currentExercise}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Mode Toggle Button */}
      <div className="fixed top-6 right-6 z-10">
        <button
            onClick={() => setIsAIMode(!isAIMode)}
            className="group relative px-4 py-2 rounded-lg bg-[#1a1e24]/80 backdrop-blur-sm 
                    border border-gray-700 hover:border-[#E0FE10]/50 transition-all shadow-lg"
        >
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#E0FE10] via-purple-500 to-[#E0FE10] opacity-10 
                            blur-lg group-hover:opacity-20 transition-opacity" />
            
            <div className="relative flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#E0FE10]" />
            <span className="text-white font-medium text-sm">AI Round</span>
            </div>
        </button>
      </div>

      {/* Left Panel: Challenge Setup Form */}
      <div className="w-full lg:w-[600px] bg-[#1a1e24] rounded-xl shadow-xl relative flex flex-col overflow-hidden border border-gray-800">
        {/* Optional Gradient Border */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#E0FE10] via-purple-500 to-blue-500 opacity-50"></div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent hover:scrollbar-thumb-gray-600">
            {isAIMode ? (
            <div className="space-y-6 pb-20">
                <div>
                    <h1 className="text-2xl font-semibold text-white text-center mb-2">Create AI Round</h1>
                    <p className="text-zinc-400 text-center text-sm">
                        Describe the type of round you want. Be descriptive for best results.
                    </p>
                </div>

                {/* Round Title */}
                <div>
                  <label className="text-sm text-gray-300 mb-2 block">Round Title</label>
                  <input
                    type="text"
                    value={challengeData.challengeName}
                    onChange={(e) => setChallengeData(
                      challengeData.startDate,
                      challengeData.endDate,
                      e.target.value,
                      challengeData.challengeDesc,
                      challengeData.roundType,
                      challengeData.pinCode
                    )}
                    placeholder="Name your AI-generated round"
                    className="w-full p-3 bg-[#262a30] border border-gray-700 rounded-lg 
                              text-white placeholder-gray-500
                              focus:outline-none focus:ring-2 focus:ring-[#E0FE10] transition-all"
                  />
                </div>

                {/* Round Description */}
                <div>
                  <label className="text-sm text-gray-300 mb-2 block">Round Description</label>
                  <textarea
                    value={challengeData.challengeDesc}
                    onChange={(e) => setChallengeData(
                      challengeData.startDate,
                      challengeData.endDate,
                      challengeData.challengeName,
                      e.target.value,
                      challengeData.roundType,
                      challengeData.pinCode
                    )}
                    placeholder="Describe the purpose or goals (Members will see this)"
                    rows={3}
                    className="w-full p-3 bg-[#262a30] border border-gray-700 rounded-lg 
                                text-white placeholder-gray-500 
                                focus:outline-none focus:ring-2 focus:ring-[#E0FE10] transition-all resize-none"
                  />
                </div>

                {/* Round Type */}
                <div className="mb-6">
                    <label className="text-sm text-gray-300 mb-2 block">Round Type</label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                        onClick={() => setChallengeData(
                            challengeData.startDate, challengeData.endDate, challengeData.challengeName,
                            challengeData.challengeDesc, SweatlistType.together, challengeData.pinCode
                        )}
                        className={`p-4 rounded-lg flex flex-col items-center transition-colors ${
                            challengeData.roundType === SweatlistType.together 
                            ? "bg-[#E0FE10] text-black" 
                            : "bg-[#262a30] border border-gray-700 text-gray-300 hover:bg-[#2a2f36]"
                        }`}
                        >
                        <Users className="h-5 w-5 mb-2" />
                        <span className="font-medium text-sm">Together</span>
                        <span className="text-xs mt-1 opacity-80">Train with the community</span>
                        </button>

                        <button
                        onClick={() => setChallengeData(
                            challengeData.startDate, challengeData.endDate, challengeData.challengeName,
                            challengeData.challengeDesc, SweatlistType.locked, challengeData.pinCode
                        )}
                         className={`p-4 rounded-lg flex flex-col items-center transition-colors ${
                            challengeData.roundType === SweatlistType.locked 
                            ? "bg-[#E0FE10] text-black" 
                            : "bg-[#262a30] border border-gray-700 text-gray-300 hover:bg-[#2a2f36]"
                        }`}
                        >
                        <Lock className="h-5 w-5 mb-2" />
                        <span className="font-medium text-sm">Private</span>
                        <span className="text-xs mt-1 opacity-80">Invite-only training</span>
                        </button>
                    </div>
                </div>

                {/* Dates */}
                <div className="mb-6">
                    <label className="text-sm text-gray-300 mb-2 block">Round Dates</label>
                    <div className="space-y-2">
                        <div>
                        <label className="text-xs text-gray-400 block mb-1">Start Date</label>
                        <input
                            type="date"
                            value={challengeData.startDate.toISOString().split('T')[0]}
                            onChange={(e) => setChallengeData(
                                new Date(e.target.value), challengeData.endDate, challengeData.challengeName,
                                challengeData.challengeDesc, challengeData.roundType, challengeData.pinCode
                            )}
                            className="w-full p-3 rounded-lg bg-[#262a30] border border-gray-700 
                                    text-white placeholder-gray-500
                                    focus:outline-none focus:ring-2 focus:ring-[#E0FE10] transition-all
                                    [color-scheme:dark]"
                        />
                        </div>
                        <div>
                        <label className="text-xs text-gray-400 block mb-1">End Date</label>
                        <input
                            type="date"
                            value={challengeData.endDate.toISOString().split('T')[0]}
                            min={challengeData.startDate.toISOString().split('T')[0]}
                            onChange={(e) => setChallengeData(
                                challengeData.startDate, new Date(e.target.value), challengeData.challengeName,
                                challengeData.challengeDesc, challengeData.roundType, challengeData.pinCode
                            )}
                            className="w-full p-3 rounded-lg bg-[#262a30] border border-gray-700 
                                    text-white placeholder-gray-500
                                    focus:outline-none focus:ring-2 focus:ring-[#E0FE10] transition-all
                                    [color-scheme:dark]"
                        />
                        </div>
                    </div>
                </div>

                {/* PIN input if Private */}
                {challengeData.roundType === SweatlistType.locked && (
                    <div className="mb-6">
                        <label className="text-sm text-gray-300 mb-2 block">PIN Code</label>
                        <input
                            type="text"
                            maxLength={9}
                            minLength={9}
                            value={challengeData.pinCode}
                            onChange={(e) => setChallengeData(
                                challengeData.startDate, challengeData.endDate, challengeData.challengeName,
                                challengeData.challengeDesc, challengeData.roundType, e.target.value
                            )}
                            placeholder="Set 9-digit PIN"
                            className="w-full p-3 rounded-lg bg-[#262a30] border border-gray-700 
                                        text-white placeholder-gray-500
                                        focus:outline-none focus:ring-2 focus:ring-[#E0FE10] transition-all"
                        />
                    </div>
                )}
                
                {/* AI Prompt */}
                <div>
                    <label className="text-sm text-gray-300 mb-2 block">Round Prompt</label>
                    <textarea
                        value={aiPromptText}
                        onChange={(e) => setAiPromptText(e.target.value)}
                        placeholder="E.g., Create a 4-week strength program focused on building muscle..."
                        rows={8}
                        className="w-full p-3 bg-[#262a30] border border-gray-700 rounded-lg 
                                    text-white placeholder-gray-500 
                                    focus:outline-none focus:ring-2 focus:ring-[#E0FE10] transition-all resize-none"
                    />
                </div>
                
                {/* Sticky Footer Buttons */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#1a1e24] border-t border-gray-700 space-y-2">
                    <button
                        className="w-full py-3 bg-gradient-to-r from-[#E0FE10] via-purple-500 to-[#E0FE10] 
                                    text-black rounded-lg font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                        onClick={handleGenerateAIRound}
                        disabled={isGenerating}
                    >
                        {isGenerating ? (
                             <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                        ) : (
                            <Sparkles className="w-5 h-5" />
                        )}
                        <span>{isGenerating ? 'Generating...' : 'Generate AI Round'}</span>
                    </button>
                    <button
                        onClick={() => setIsAIMode(false)}
                        className="w-full py-2 text-zinc-400 hover:text-white transition-colors text-sm"
                    >
                        Cancel and return to manual creation
                    </button>
                </div>
            </div>
            ) : (
            <MobileChallengeSetupView
                setChallengeData={setChallengeData}
                currentChallengeData={challengeData}
                selectedStacks={selectedStacks}
                setSelectedStacks={setSelectedStacks}
                onRemoveStack={handleRemoveStack}
                viewModel={viewModel}
            />
            )}
        </div>
        
        {/* Manual Mode Create Button (Fixed Footer) */}
        {!isAIMode && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#1a1e24] border-t border-gray-700">
                <button
                    className="w-full py-3 bg-[#E0FE10] text-black rounded-lg font-semibold hover:opacity-90 transition-opacity"
                    onClick={handleCreateRound}
                >
                    Create Round
                </button>
            </div>
        )}
        </div>

        {/* Right Panel: AI Preferences or Stack Selector */}
        <div className="w-full lg:w-[550px] bg-[#1a1e24] rounded-xl shadow-xl relative flex flex-col overflow-hidden border border-gray-800">
        {/* Optional Gradient Border */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#E0FE10] via-purple-500 to-blue-500 opacity-50"></div>
        {isAIMode ? (
            // AI Preferences Side Panel
            <>
            {/* Tabs */}
            <div className="px-4 pt-4">
                 {/* Updated tab styles */}
                <div className="flex space-x-1 bg-[#262a30] p-1 rounded-lg border border-gray-700">
                <button
                    onClick={() => setActiveTab('preferences')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        activeTab === 'preferences' ? 'bg-[#E0FE10] text-black shadow-sm' : 'text-gray-400 hover:text-white hover:bg-[#2a2f36]'
                    }`}
                >
                    <Brain size={14} />
                    <span>AI Preferences</span>
                </button>
                <button
                    onClick={() => setActiveTab('moves')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        activeTab === 'moves' ? 'bg-[#E0FE10] text-black shadow-sm' : 'text-gray-400 hover:text-white hover:bg-[#2a2f36]'
                    }`}
                >
                    <Dumbbell size={14} />
                    <span>Must-Include Moves</span>
                </button>
                <button
                    onClick={() => setActiveTab('creators')}
                     className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        activeTab === 'creators' ? 'bg-[#E0FE10] text-black shadow-sm' : 'text-gray-400 hover:text-white hover:bg-[#2a2f36]'
                    }`}
                >
                    <UserCircle size={14} />
                    <span>Preferred Creators</span>
                </button>
                </div>
            </div>

            {/* Tab Content */}
             {/* Reduced padding */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
            {activeTab === 'preferences' && (
              <div className="space-y-4">
                {/* Header card */}
                <div className="bg-[#262a30] rounded-lg p-4 border border-gray-700">
                  <h3 className="font-medium text-white mb-1">AI Preferences</h3>
                  <p className="text-sm text-zinc-400">
                    Refine the AI generation process.
                  </p>
                </div>
                
                {/* Rest Days Section */}
                <div className="bg-[#262a30] rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-medium text-white">Rest Days</h3>
                          <p className="text-sm text-zinc-400">Include specific rest days</p>
                        </div>
                        <Switch
                          checked={includeRestDays}
                          onChange={handleIncludeRestDaysChange}
                           className={`${
                            includeRestDays ? 'bg-[#E0FE10]' : 'bg-gray-600'
                          } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75`}
                        >
                           <span className="sr-only">Include rest days</span>
                          <span
                            aria-hidden="true"
                            className={`${
                              includeRestDays ? 'translate-x-6' : 'translate-x-1'
                            } inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out`}
                          />
                        </Switch>
                      </div>

                      {includeRestDays && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
                          {restDayPreferences.map((pref) => (
                            <button
                              key={pref.day}
                              onClick={() => handleRestDayPreferencesChange(pref.day)}
                              className={`p-2 rounded-lg text-xs font-medium transition-colors border ${
                                pref.isSelected
                                  ? 'bg-[#E0FE10] text-black border-[#E0FE10]'
                                  : 'bg-[#1a1e24] text-gray-300 border-gray-600 hover:bg-[#2a2f36]'
                              }`}
                            >
                              {pref.day}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                
                {/* Preferences Options */}
                <div className="space-y-3">
                  {preferences.map((preference) => (
                    <label 
                      key={preference}
                      className="flex items-center bg-[#262a30] p-3 rounded-lg cursor-pointer hover:bg-[#2a2f36] transition-colors border border-gray-700"
                    >
                      <input 
                        type="checkbox" 
                        checked={selectedPreferences.includes(preference)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPreferences(prev => [...prev, preference]);
                          } else {
                            setSelectedPreferences(prev => prev.filter(p => p !== preference));
                          }
                        }}
                        className="form-checkbox h-4 w-4 text-[#E0FE10] bg-gray-700 border-gray-600 rounded focus:ring-[#E0FE10] focus:ring-offset-0" 
                      />
                      <span className="ml-3 text-sm text-gray-300">{preference}</span>
                    </label>
                  ))}
                </div>
                </div>
                )}

                {activeTab === 'moves' && (
                <div className="space-y-4">
                    {/* Header card */}
                    <div className="bg-[#262a30] rounded-lg p-4 border border-gray-700">
                      <h3 className="font-medium text-white mb-1">Must-Have Moves</h3>
                      <p className="text-sm text-zinc-400">
                        Guarantee these exercises are included.
                      </p>
                    </div>
                    
                    {/* Search Input */}
                    <input
                        type="text"
                        placeholder="Search moves to include..."
                        className="w-full p-3 bg-[#262a30] text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#E0FE10] transition-colors placeholder-gray-500"
                    />
                    {/* Exercise Grid */}
                    <div className="bg-[#262a30] rounded-lg border border-gray-700 p-2">
                        <ExerciseGrid
                            userVideos={allExercises}
                            multiSelection={true}
                            selectedExercises={selectedMoves}
                            onToggleSelection={(exercise) => {
                                setSelectedMoves(prev => 
                                prev.some(e => e.id === exercise.id)
                                    ? prev.filter(e => e.id !== exercise.id)
                                    : [...prev, exercise]
                                )
                            }}
                            onSelectVideo={(exercise) => {
                                setSelectedMoves(prev => 
                                prev.some(e => e.id === exercise.id)
                                    ? prev.filter(e => e.id !== exercise.id)
                                    : [...prev, exercise]
                                )
                            }}
                        />
                    </div>
                </div>
                )}

                {activeTab === 'creators' && (
                <div className="space-y-4">
                     {/* Header card */}
                    <div className="bg-[#262a30] rounded-lg p-4 border border-gray-700">
                      <h3 className="font-medium text-white mb-1">Preferred Creators</h3>
                      <p className="text-sm text-zinc-400">
                        Include videos from these trainers.
                      </p>
                    </div>
                    {/* Multi User Selector - Assume internal styling is acceptable or needs separate update */}
                     <div className="bg-[#262a30] rounded-lg border border-gray-700 p-4">
                        <MultiUserSelector
                            selectedUserIds={selectedCreators}
                            onUserSelect={(userId) => {
                                setSelectedCreators(prev => [...prev, userId]);
                            }}
                            onUserRemove={(userId) => {
                                setSelectedCreators(prev => prev.filter(id => id !== userId));
                            }}
                        />
                     </div>
                </div>
                )}
            </div>

            {/* Summary Footer */}
            <div className="p-3 border-t border-gray-700 bg-[#262a30]">
                <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">
                    {selectedMoves.length} moves selected
                </span>
                <span className="text-zinc-400">
                    {selectedCreators.length} creators selected
                </span>
                </div>
            </div>
            </>
        ) : (
            // Manual Stack Selector Content
            <div className="flex flex-col h-full">
                <div className="p-4">
                    <h2 className="text-white text-xl font-semibold mb-3">Select Stacks</h2>
                    <input
                        type="text"
                        placeholder="Search your stacks..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-3 bg-[#262a30] text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#E0FE10] transition-colors placeholder-gray-500 mb-4"
                    />
                 </div>
                 {/* Scrollable list area */}
                 <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                    {loading ? (
                         <p className="text-center text-zinc-400">Loading stacks...</p>
                    ): filteredStacks.length === 0 ? (
                        <p className="text-center text-zinc-500 mt-4">No stacks found matching your search.</p>
                    ) : (
                       <div className="space-y-3">
                          {filteredStacks.map((stack) => (
                             <div key={stack.id} className="border border-gray-700 rounded-lg bg-[#262a30] overflow-hidden">
                                <StackCard
                                    workout={stack}
                                    gifUrls={stack.exercises?.map(ex => ex.exercise?.videos?.[0]?.gifURL || '') || []}
                                    isChallengeEnabled={false}
                                    onPrimaryAction={() => handleStackSelect(stack)}
                                />
                             </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}
        </div>
    </div>
  );
};

const CreateRoundPage: React.FC = () => {
  const [challengeData, setChallengeData] = useState<ChallengeData>({
    startDate: new Date(),
    endDate: new Date(new Date().getTime() + 7 * 86400 * 1000), // Default to 1 week later
    challengeName: '',
    challengeDesc: '',
    roundType: SweatlistType.together,
    pinCode: '',
    // Initialize restDayPreferences here if needed for Mobile view consistency
    restDayPreferences: { 
      includeRestDays: false, 
      restDays: [], 
      preferences: [] 
    },
  });

  const [selectedStacks, setSelectedStacks] = useState<Workout[]>([]);

  // Combine update logic
  const updateChallengeData = (
    start: Date,
    end: Date,
    name: string,
    desc: string,
    type: SweatlistType,
    pin: string,
    restPrefs?: { includeRestDays: boolean; restDays: string[]; preferences: string[] }
  ) => {
    setChallengeData(prev => ({
      ...prev, // Keep existing state like restDayPreferences unless explicitly updated
      startDate: start,
      endDate: end,
      challengeName: name,
      challengeDesc: desc,
      roundType: type,
      pinCode: pin,
      // Update restDayPreferences only if provided
      ...(restPrefs && { restDayPreferences: restPrefs }), 
    }));
  };
  
  // Mock viewModel for example purposes
  const mockViewModel: ViewModel = {
    appCoordinator: {
      showFloatingTextfield: () => {},
      closeFloatingMenu: () => {},
      closeModals: () => { console.log("Close Modals Called"); },
    },
    validateChallengeInput: (start, end, name, desc, type, pin) => {
      // Basic validation example
      if (!name.trim()) { console.error("Validation: Name required"); return false; }
      if (!desc.trim()) { console.error("Validation: Desc required"); return false; }
      if (end <= start) { console.error("Validation: End date before start"); return false; }
      if (type === SweatlistType.locked && pin.length !== 9) { console.error("Validation: Invalid PIN"); return false; }
      // Add check for selected stacks if needed in mobile context
      // if (selectedStacks.length === 0) { console.error("Validation: No stacks selected"); return false;}
      console.log("Validation Passed");
      return true;
    },
    setChallenge: (start, end, name, desc, type, pin, restPrefs) => {
       console.log("Set Challenge Called:", { start, end, name, desc, type, pin, restPrefs });
       // Here you would typically navigate or show success
    },
  };

  const handleRemoveStack = (stackId: string) => {
    setSelectedStacks((prev: Workout[]) => {
      // Filter out the stack to remove
      const updatedStacks = prev.filter(s => s.roundWorkoutId !== stackId);
      
      // Reindex the remaining stacks
      return updatedStacks.map((stack, index) => 
        new Workout({
          ...stack,
          roundWorkoutId: index === 0 ? stack.id : `${stack.id}-${index + 1}`
        })
      );
    });
  };

  return (
     // Apply base background and text color
    <div className="min-h-screen bg-[#111417] text-white"> 
      {/* Mobile view */}
      <div className="block lg:hidden">
        {/* Container matches admin style */}
        <div className="w-full max-w-[500px] mx-auto bg-[#1a1e24] relative flex flex-col min-h-screen border-x border-gray-800">
           {/* Scrollable content area */}
           <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent hover:scrollbar-thumb-gray-600">
             {/* Mobile setup component */}
            <MobileChallengeSetupView
              setChallengeData={updateChallengeData} // Pass combined updater
              currentChallengeData={challengeData}
              selectedStacks={selectedStacks}
              setSelectedStacks={setSelectedStacks}
              onRemoveStack={handleRemoveStack}
              viewModel={mockViewModel}
            />
          </div>
          
          {/* Fixed Create Round Button area is handled inside MobileChallengeSetupView now */}
        </div>
      </div>
  
      {/* Desktop view */}
      <div className="hidden lg:block">
        {/* Desktop setup component already has its own layout */}
        <DesktopChallengeSetupView
          challengeData={challengeData}
          setChallengeData={updateChallengeData} // Pass combined updater
          viewModel={mockViewModel}
        />
      </div>
    </div>
  );
};

// Export types and components
export type {
  Workout,
  ViewModel,
  ChallengeData,
  MobileChallengeSetupProps,
  DesktopChallengeSetupProps,
};

export {
  MobileChallengeSetupView,
  DesktopChallengeSetupView,
};

export default CreateRoundPage;