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

import { userService } from '../api/firebase/user';
import { workoutService } from '../api/firebase/workout/service';
import { exerciseService } from '../api/firebase/exercise/service';
import { Exercise, ExerciseDetail, ExerciseCategory, ExerciseVideo, ExerciseReference, WeightTrainingExercise, CardioExercise } from '../api/firebase/exercise/types';
import { Workout, SweatlistCollection, Challenge, ChallengeStatus, WorkoutStatus } from '../api/firebase/workout/types';
import { StackCard } from '../components/Rounds/StackCard'
import { ExerciseGrid } from '../components/App/ExerciseGrid/ExerciseGrid';
import { MultiUserSelector } from '../components/App/MultiSelectUser/MultiSelectUser';
import { generateId } from '../utils/generateId';

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
    pin: string
  ) => void;
}

interface ChallengeData {
  startDate: Date;
  endDate: Date;
  challengeName: string;
  challengeDesc: string;
  roundType: SweatlistType;
  pinCode: string;
}

interface MobileChallengeSetupProps {
  setChallengeData: (startDate: Date, endDate: Date, name: string, desc: string, type: SweatlistType, pinCode: string) => void;
  currentChallengeData: ChallengeData;
  selectedStacks: Workout[];
  setSelectedStacks: (stacks: Workout[] | ((prev: Workout[]) => Workout[])) => void;
  onRemoveStack: (stackId: string) => void;
  viewModel: ViewModel;
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
        await workoutService.saveWorkoutSession({
          userId: userService.currentUser?.id || '',
          workout: mappedStacks[0], // Assuming first stack is the main one
          logs: mappedStacks[0].logs || []
        });

      } catch (error) {
        console.error('Error saving challenge:', error);
      }
    };

    return (
      <div>
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
            className="w-full p-3 bg-zinc-900/50 rounded-lg border border-zinc-700/50 
                      text-white placeholder:text-zinc-600
                      focus:border-[#E0FE10] focus:outline-none transition-all"
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
            className="w-full p-3 bg-zinc-900/50 rounded-lg border border-zinc-700/50 
                      text-white placeholder:text-zinc-600 
                      focus:border-[#E0FE10] focus:outline-none transition-all resize-none"
          />
        </div>
  
        {/* Selected Stacks */}
        <div className="mb-8">
          <label className="text-sm text-zinc-400 mb-2 block">Selected Stacks</label>
          {selectedStacks.length === 0 ? (
            <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-700/50 text-center">
              <p className="text-zinc-400">No stacks selected yet</p>
              <p className="text-zinc-500 text-sm mt-1">Select stacks to add them to your round</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedStacks.map((stack) => (
                <div className="border border-zinc-700/50 rounded-lg">
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
              className={`p-4 rounded-lg flex flex-col items-center ${
                roundType === SweatlistType.together 
                  ? "bg-[#E0FE10] text-black" 
                  : "bg-zinc-900/50 border border-zinc-700/50 text-zinc-400"
              }`}
            >
              <Users className="h-5 w-5 mb-2" />
              <span className="font-medium text-sm">Together</span>
              <span className="text-xs mt-1">Train with the community</span>
            </button>
  
            <button
              onClick={() => setChallengeData(startDate, endDate, challengeName, challengeDesc, SweatlistType.locked, pinCode)}
              className={`p-4 rounded-lg flex flex-col items-center ${
                roundType === SweatlistType.locked 
                  ? "bg-[#E0FE10] text-black" 
                  : "bg-zinc-900/50 border border-zinc-700/50 text-zinc-400"
              }`}
            >
              <Lock className="h-5 w-5 mb-2" />
              <span className="font-medium text-sm">Private</span>
              <span className="text-xs mt-1">Invite-only training</span>
            </button>
          </div>
        </div>
  
        {/* Dates */}
        <div className={`mb-20 ${roundType === SweatlistType.locked ? 'mb-4' : 'mb-40'}`}>
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
                className="w-full p-3 rounded-lg bg-zinc-900/50 border border-zinc-700/50 
                        text-white placeholder:text-zinc-600
                        focus:border-[#E0FE10] focus:outline-none transition-all
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
                className="w-full p-3 rounded-lg bg-zinc-900/50 border border-zinc-700/50 
                        text-white placeholder:text-zinc-600
                        focus:border-[#E0FE10] focus:outline-none transition-all
                        [color-scheme:dark]"
              />
            </div>
          </div>
        </div>
  
        {roundType === SweatlistType.locked && (
          <div className="mb-40">
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
              className="w-full p-3 rounded-lg bg-zinc-900/50 border border-zinc-700/50 
                        text-white placeholder:text-zinc-600
                        focus:border-[#E0FE10] focus:outline-none transition-all"
            />
          </div>
        )}
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
            <div className="border border-zinc-700/50 rounded-lg">
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
    // For exclusive creator mode, only look in creator exercises
    const exercisePool = useOnlyCreatorExercises ? creatorExercises : allExercises;
    
    const baseExercise = exercisePool.find(ex => 
      ex.name.toLowerCase() === exerciseData.name.toLowerCase()
    );
  
    if (!baseExercise) return null;
  
    const category: ExerciseCategory = {
      type: 'weight-training',
      details: {
        ...exerciseData.category.details,
        selectedVideo: baseExercise.videos?.[0] || null
      }
    };
  
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

  const handleGenerateAIRound = async () => {
    try {
      setIsGenerating(true);
      setError(null);

      const response = await fetch('/.netlify/functions/generate-workout-round', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mustIncludeExercises: selectedMoves.map(move => move.name),
          userPrompt: aiPromptText,
          preferences: selectedPreferences,
          creatorExercises: selectedCreators.map(async (creatorId) => {
            const exercises = await exerciseService.getExercisesByAuthor(creatorId);
            return exercises;
          }),
          allAvailableExercises: allExercises,
          startDate: challengeData.startDate,
          endDate: challengeData.endDate,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate workout round');
      }

      const generatedRound = await response.json();
      console.log('Generated Round Response:', generatedRound);

      // Handle the generated round data as needed
    } catch (error) {
      console.error('Error in handleGenerateAIRound:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate workout round. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateRound = async () => {
    if (!validateChallengeInput()) return;
  
    try {
      const createdAt = new Date();
      const currentUser = userService.currentUser;
  
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
        updatedAt: createdAt
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
          sweatlistAuthorId: currentUser.id,
          sweatlistName: stack.title,
          order: index + 1
        })),
        ownerId: [currentUser.id],
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

  return (
    
    <div className="h-screen flex justify-center gap-6 bg-zinc-900 p-6">
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
            </div>
          </div>
        </div>
      )}

      {/* Left Panel: Challenge Setup Form */}
      <div className="fixed top-6 right-6 z-10">
        <button
            onClick={() => setIsAIMode(!isAIMode)}
            className="group relative px-4 py-2 rounded-lg bg-black/20 backdrop-blur-sm 
                    border border-zinc-800 hover:border-[#E0FE10]/50 transition-all"
        >
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#E0FE10] via-purple-500 to-[#E0FE10] opacity-20 
                            blur-xl group-hover:opacity-30 transition-opacity" />
            
            <div className="relative flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#E0FE10]" />
            <span className="text-white font-medium">AI Round</span>
            </div>
        </button>
        </div>

        <div className="w-[600px] bg-zinc-800 rounded-xl shadow-xl relative flex flex-col">
        <div className="h-full overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent hover:scrollbar-thumb-zinc-600">
            {isAIMode ? (
            <div className="space-y-6">
                <div>
                <h1 className="text-2xl font-semibold text-white text-center mb-2">Create AI Round</h1>
                <p className="text-zinc-400 text-center text-sm">
                    Describe the type of round that you want to create. For example, a round that focuses on improving 
                    the back and shoulders, or a round that focuses on legs. Be as descriptive as possible for best results.
                </p>
                </div>

                {/* Add Round Title & Subtitle fields */}
                <div>
                  <label className="text-sm text-zinc-400 mb-2 block">Round Title</label>
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
                    placeholder="Name your round"
                    className="w-full p-3 bg-zinc-900/50 rounded-lg border border-zinc-700/50 
                              text-white placeholder:text-zinc-600
                              focus:border-[#E0FE10] focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-sm text-zinc-400 mb-2 block">Round Description</label>
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
                    placeholder="Describe the purpose, or goals of this round(Members will see this)"
                    rows={4}
                    className="w-full p-3 bg-zinc-900/50 rounded-lg border border-zinc-700/50 
                                text-white placeholder:text-zinc-600 
                                focus:border-[#E0FE10] focus:outline-none transition-all resize-none"
                    />
                </div>

                {/* Round Type */}
<div className="mb-8">
  <label className="text-sm text-zinc-400 mb-2 block">Round Type</label>
  <div className="grid grid-cols-2 gap-3">
    <button
      onClick={() => setChallengeData(
        challengeData.startDate,
        challengeData.endDate,
        challengeData.challengeName,
        challengeData.challengeDesc,
        SweatlistType.together,
        challengeData.pinCode
      )}
      className={`p-4 rounded-lg flex flex-col items-center ${
        challengeData.roundType === SweatlistType.together 
          ? "bg-[#E0FE10] text-black" 
          : "bg-zinc-900/50 border border-zinc-700/50 text-zinc-400"
      }`}
    >
      <Users className="h-5 w-5 mb-2" />
      <span className="font-medium text-sm">Together</span>
      <span className="text-xs mt-1">Train with the community</span>
    </button>

    <button
      onClick={() => setChallengeData(
        challengeData.startDate,
        challengeData.endDate,
        challengeData.challengeName,
        challengeData.challengeDesc,
        SweatlistType.locked,
        challengeData.pinCode
      )}
      className={`p-4 rounded-lg flex flex-col items-center ${
        challengeData.roundType === SweatlistType.locked 
          ? "bg-[#E0FE10] text-black" 
          : "bg-zinc-900/50 border border-zinc-700/50 text-zinc-400"
          }`}
        >
          <Lock className="h-5 w-5 mb-2" />
          <span className="font-medium text-sm">Private</span>
          <span className="text-xs mt-1">Invite-only training</span>
        </button>
      </div>
    </div>

    {/* Dates */}
    <div className="mb-8">
      <label className="text-sm text-zinc-400 mb-2 block">Round Dates</label>
      <div className="space-y-2">
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Start Date</label>
          <input
            type="date"
            value={challengeData.startDate.toISOString().split('T')[0]}
            onChange={(e) => setChallengeData(
              new Date(e.target.value),
              challengeData.endDate,
              challengeData.challengeName,
              challengeData.challengeDesc,
              challengeData.roundType,
              challengeData.pinCode
            )}
            className="w-full p-3 rounded-lg bg-zinc-900/50 border border-zinc-700/50 
                    text-white placeholder:text-zinc-600
                    focus:border-[#E0FE10] focus:outline-none transition-all
                    [color-scheme:dark]"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">End Date</label>
          <input
            type="date"
            value={challengeData.endDate.toISOString().split('T')[0]}
            min={challengeData.startDate.toISOString().split('T')[0]}
            onChange={(e) => setChallengeData(
              challengeData.startDate,
              new Date(e.target.value),
              challengeData.challengeName,
              challengeData.challengeDesc,
              challengeData.roundType,
              challengeData.pinCode
            )}
            className="w-full p-3 rounded-lg bg-zinc-900/50 border border-zinc-700/50 
                    text-white placeholder:text-zinc-600
                    focus:border-[#E0FE10] focus:outline-none transition-all
                    [color-scheme:dark]"
          />
        </div>
      </div>
    </div>

    {/* PIN input if Private */}
    {challengeData.roundType === SweatlistType.locked && (
      <div className="mb-8">
        <label className="text-sm text-zinc-400 mb-2 block">PIN Code</label>
        <input
          type="text"
          maxLength={9}
          minLength={9}
          value={challengeData.pinCode}
          onChange={(e) => setChallengeData(
            challengeData.startDate,
            challengeData.endDate,
            challengeData.challengeName,
            challengeData.challengeDesc,
            challengeData.roundType,
            e.target.value
          )}
          placeholder="Set 9-digit PIN"
          className="w-full p-3 rounded-lg bg-zinc-900/50 border border-zinc-700/50 
                    text-white placeholder:text-zinc-600
                    focus:border-[#E0FE10] focus:outline-none transition-all"
        />
      </div>
    )}

                <div>
                <label className="text-sm text-zinc-400 mb-2 block">Round Prompt - AI will use this description create your workout.</label>
                <textarea
                value={aiPromptText}
                onChange={(e) => setAiPromptText(e.target.value)}
                placeholder="E.g., Create a 4-week strength program focused on building muscle in my shoulders and upper back. 
                I want to train 3 times per week with progressive overload. Include compound movements like rows and presses, 
                and isolation work for rear delts and traps. I prefer moderate weight with 8-12 reps for hypertrophy."
                rows={10}
                className="w-full p-3 bg-zinc-900/50 rounded-lg border border-zinc-700/50 
                            text-white placeholder:text-zinc-600 
                            focus:border-[#E0FE10] focus:outline-none transition-all resize-none"
                />
                </div>

                <button
                className="w-full py-4 bg-gradient-to-r from-[#E0FE10] via-purple-500 to-[#E0FE10] 
                            text-black rounded-lg font-semibold hover:opacity-90 transition-opacity"
                onClick={handleGenerateAIRound}
                >
                <div className="flex items-center justify-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    <span>Generate Round</span>
                </div>
                </button>

                <button
                onClick={() => setIsAIMode(false)}
                className="w-full py-2 text-zinc-400 hover:text-white transition-colors text-sm"
                >
                Cancel and return to manual creation
                </button>
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
        
        {/* Only show the create button in non-AI mode */}
        {!isAIMode && (
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-zinc-800 border-t border-zinc-700 rounded-b-xl">
            <button
                className="w-full py-4 bg-[#E0FE10] text-black rounded-lg font-semibold hover:opacity-90 transition-opacity"
                onClick={handleCreateRound}
            >
                Create Round
            </button>
            </div>
        )}
        </div>

        {/* Right Panel: AI Preferences or Stack Selector */}
        <div className="w-[550px] bg-zinc-800 rounded-xl shadow-xl relative flex flex-col">
        {isAIMode ? (
            <>
            {/* Tabs */}
            <div className="px-6 pt-6">
                <div className="flex space-x-1 bg-zinc-900/50 p-1 rounded-lg">
                <button
                    onClick={() => setActiveTab('preferences')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all
                    ${activeTab === 'preferences' 
                        ? 'bg-[#E0FE10] text-black' 
                        : 'text-zinc-400 hover:text-white'}`}
                >
                    <Brain size={16} />
                    <span>AI Preferences</span>
                </button>
                <button
                    onClick={() => setActiveTab('moves')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all
                    ${activeTab === 'moves' 
                        ? 'bg-[#E0FE10] text-black' 
                        : 'text-zinc-400 hover:text-white'}`}
                >
                    <Dumbbell size={16} />
                    <span>Must-Include Moves</span>
                </button>
                <button
                    onClick={() => setActiveTab('creators')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all
                    ${activeTab === 'creators' 
                        ? 'bg-[#E0FE10] text-black' 
                        : 'text-zinc-400 hover:text-white'}`}
                >
                    <UserCircle size={16} />
                    <span>Preferred Creators</span>
                </button>
                </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                {activeTab === 'preferences' && (
                <div className="space-y-4">
                    <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-700/50">
                    <h3 className="font-medium text-white mb-2">AI Preferences</h3>
                    <p className="text-sm text-zinc-400">
                        Additional preferences to help generate your perfect round.
                    </p>
                    </div>
                    
                    {/* Preferences Options */}
                    <div className="space-y-3">
                      <label className="flex items-center bg-zinc-900/30 p-3 rounded-lg cursor-pointer hover:bg-zinc-900/50 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={selectedPreferences.includes("Include rest days")}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPreferences(prev => [...prev, "Include rest days"]);
                            } else {
                              setSelectedPreferences(prev => prev.filter(p => p !== "Include rest days"));
                            }
                          }}
                          className="form-checkbox text-[#E0FE10]" 
                        />
                        <span className="ml-2 text-sm text-zinc-300">Include rest days</span>
                      </label>

                      <label className="flex items-center bg-zinc-900/30 p-3 rounded-lg cursor-pointer hover:bg-zinc-900/50 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={selectedPreferences.includes("Exclusive to selected creators")}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPreferences(prev => [...prev, "Exclusive to selected creators"]);
                            } else {
                              setSelectedPreferences(prev => prev.filter(p => p !== "Exclusive to selected creators"));
                            }
                          }}
                          className="form-checkbox text-[#E0FE10]" 
                        />
                        <span className="ml-2 text-sm text-zinc-300">Exclusive to selected creators</span>
                      </label>
                    </div>
                </div>
                )}

                {activeTab === 'moves' && (
                <div className="space-y-4">
                    <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-700/50">
                      <h3 className="font-medium text-white mb-2">Must-Have Moves</h3>
                      <p className="text-sm text-zinc-400">
                        AI will guarantee these exercises are included in your program
                      </p>
                    </div>

                    <input
                    type="text"
                    placeholder="Search moves to include..."
                    className="w-full p-4 bg-zinc-900 text-white rounded-lg border border-zinc-700 focus:border-[#E0FE10] transition-colors"
                    />
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
                        // This can be the same as onToggleSelection since we're using multiSelection
                        setSelectedMoves(prev => 
                        prev.some(e => e.id === exercise.id)
                            ? prev.filter(e => e.id !== exercise.id)
                            : [...prev, exercise]
                        )
                    }}
                    />
                </div>
                )}

                {activeTab === 'creators' && (
                <div className="space-y-4">
                    <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-700/50">
                      <h3 className="font-medium text-white mb-2">Preferred Creators</h3>
                      <p className="text-sm text-zinc-400">
                        Select trainers whose exercise videos you want to include in your program
                      </p>
                    </div>
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
                )}
            </div>

            {/* Summary Footer */}
            <div className="p-4 border-t border-zinc-700/50 bg-zinc-900/50">
                <div className="flex items-center justify-between text-sm">
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
            // Original Stack Selector Content
            <div className="h-full overflow-y-auto p-6 pb-24 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                <div className="h-full overflow-y-auto p-6 pb-24 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                    <h2 className="text-white text-2xl font-bold mb-4">Your Stacks</h2>
                    <input
                        type="text"
                        placeholder="Search stacks..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-4 bg-zinc-900 text-white rounded-lg border border-zinc-700 focus:border-[#E0FE10] transition-colors mb-4"
                    />
                    {filteredStacks.length === 0 ? (
                        <p className="text-center text-zinc-500">No stacks found</p>
                    ) : (
                        filteredStacksList()
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
    endDate: new Date(new Date().getTime() + 86400 * 1000),
    challengeName: '',
    challengeDesc: '',
    roundType: SweatlistType.together,
    pinCode: '',
  });

  const [selectedStacks, setSelectedStacks] = useState<Workout[]>([]);

  const updateChallengeData = (
    start: Date,
    end: Date,
    name: string,
    desc: string,
    type: SweatlistType,
    pin: string
  ) => {
    setChallengeData({
      startDate: start,
      endDate: end,
      challengeName: name,
      challengeDesc: desc,
      roundType: type,
      pinCode: pin,
    });
  };

  // Mock viewModel for example purposes
  const mockViewModel: ViewModel = {
    appCoordinator: {
      showFloatingTextfield: () => {},
      closeFloatingMenu: () => {},
      closeModals: () => {},
    },
    validateChallengeInput: () => true,
    setChallenge: () => {},
  };

  const handleRemoveStack = (stackId: string) => {
    setSelectedStacks(prev => prev.filter(stack => stack.id !== stackId));
  };

  return (
    <>
      {/* Mobile view */}
      <div className="block lg:hidden">
        {/* Left Panel: Challenge Setup Form */}
        <div className="w-full max-w-[500px] mx-auto bg-zinc-800 -xl relative flex flex-col min-h-screen">
          <div className="h-full overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent hover:scrollbar-thumb-zinc-600">
            <MobileChallengeSetupView
              setChallengeData={updateChallengeData}
              currentChallengeData={challengeData}
              selectedStacks={selectedStacks}
              setSelectedStacks={setSelectedStacks}
              onRemoveStack={handleRemoveStack}
              viewModel={mockViewModel}
            />
          </div>
          
          {/* Fixed Create Round Button */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-zinc-800 border-t border-zinc-700 rounded-b-xl">
            <button
              className="w-full py-4 bg-[#E0FE10] text-black rounded-lg font-semibold hover:opacity-90 transition-opacity"
              onClick={() => {
                if (mockViewModel.validateChallengeInput(
                  challengeData.startDate,
                  challengeData.endDate,
                  challengeData.challengeName,
                  challengeData.challengeDesc,
                  challengeData.roundType,
                  challengeData.pinCode
                )) {
                  mockViewModel.setChallenge(
                    challengeData.startDate,
                    challengeData.endDate,
                    challengeData.challengeName,
                    challengeData.challengeDesc,
                    challengeData.roundType,
                    challengeData.pinCode
                  );
                  mockViewModel.appCoordinator.closeModals();
                }
              }}
            >
              Create Round
            </button>
          </div>
        </div>
      </div>
  
      {/* Desktop view */}
      <div className="hidden lg:block">
        <DesktopChallengeSetupView
          challengeData={challengeData}
          setChallengeData={updateChallengeData}
          viewModel={mockViewModel}
        />
      </div>
    </>
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