import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';

import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Exercise,
  ExerciseDetail,
  WeightTrainingExercise,
  CardioExercise,
} from '../api/firebase/exercise/types';
import { exerciseService } from '../api/firebase/exercise/service';
import { workoutService } from '../api/firebase/workout';
import { userService } from '../api/firebase/user';

import { ExerciseVideo } from '../api/firebase/exercise/types';
import { UserFilter } from '../components/App/UserFilter/UserFilter';
import { ExerciseGrid } from '../components/App/ExerciseGrid/ExerciseGrid';
import { useUser } from '../hooks/useUser';


// CreateWorkoutExerciseCardView Component
interface CreateWorkoutExerciseCardViewProps {
  appCoordinator: any;
  exerciseDescription?: ExerciseDetail;
  workoutCaregory?: ExerciseDetail['category'];
  returnExerciseDescription: (exerciseDetail: ExerciseDetail) => void;
}

const CreateWorkoutExerciseCardView: React.FC<CreateWorkoutExerciseCardViewProps> = ({
  appCoordinator,
  exerciseDescription: initialExerciseDescription,
  workoutCaregory: initialWorkoutCaregory,
  returnExerciseDescription,
}) => {
  // Convert initial videos
  const initialVideos =
    (initialExerciseDescription?.exercise?.videos || []).map((v: any) =>
      v && (v as ExerciseVideo).exerciseId ? (v as ExerciseVideo) : new ExerciseVideo(v)
    ) || [];

  // Local state management
  const [expanded, setExpanded] = useState(false);
  const [exerciseName, setExerciseName] = useState(
    initialExerciseDescription?.exerciseName || ''
  );
  const [exerciseVideos] = useState<ExerciseVideo[]>(initialVideos);
  const [isDumbell, setIsDumbell] = useState(initialExerciseDescription?.isSplit || false);

  // For weight training fields
  const [reps, setReps] = useState(
    initialExerciseDescription?.category?.type === 'weight-training'
      ? Array.isArray(initialExerciseDescription.category?.details?.reps)
        ? initialExerciseDescription.category.details.reps.join(',')
        : ''
      : ''
  );
  const [sets, setSets] = useState(
    initialExerciseDescription?.category?.type === 'weight-training'
      ? `${initialExerciseDescription.category?.details?.sets}` || ''
      : ''
  );
  const [weight, setWeight] = useState(
    initialExerciseDescription?.category?.type === 'weight-training'
      ? `${initialExerciseDescription.category?.details?.weight}` || ''
      : ''
  );
  // For screenTime, use a string so the field can be cleared.
  const [screenTime, setScreenTime] = useState<string>(
    initialExerciseDescription?.category?.details?.screenTime !== undefined
      ? initialExerciseDescription.category?.details.screenTime.toString()
      : ''
  );
  const [selectedVideo, setSelectedVideo] = useState<ExerciseVideo | null>(null);
  const [notes, setNotes] = useState(initialExerciseDescription?.notes || '');
  const [weightLabel] = useState('Weight');
  const [exerciseDetail, setExerciseDetail] = useState<ExerciseDetail | undefined>(
    initialExerciseDescription
  );

  // Our exerciseMode state: 'tracking' for weight training details,
  // 'screentime' for cardio details.
  const [exerciseMode, setExerciseMode] = useState<'tracking' | 'screentime'>(
    initialExerciseDescription?.category?.type === 'cardio' ? 'screentime' : 'tracking'
  );

  // Separate update functions:
  const updateWeightTrainingDetail = (updatedDetails: WeightTrainingExercise) => {
    if (!exerciseDetail) return;
    const newDetailData = {
      ...exerciseDetail,
      category: {
        ...exerciseDetail.category,
        type: 'weight-training',
        details: updatedDetails,
      },
    };
    const newDetail = new ExerciseDetail(newDetailData);
    setExerciseDetail(newDetail);
    returnExerciseDescription(newDetail);
  };

  const updateCardioDetail = (updatedDetails: CardioExercise) => {
    if (!exerciseDetail) return;
    const newDetailData = {
      ...exerciseDetail,
      category: {
        ...exerciseDetail.category,
        type: 'cardio',
        details: updatedDetails,
      },
    };
    const newDetail = new ExerciseDetail(newDetailData);
    setExerciseDetail(newDetail);
    returnExerciseDescription(newDetail);
  };

  // Handlers for weight training fields
  const handleSetsChange = (val: string) => {
    setSets(val);
    if (!exerciseDetail) return;
    if (exerciseDetail.category?.type === 'weight-training') {
      const details =
        (exerciseDetail.category?.details as WeightTrainingExercise) || {
          reps: [],
          sets: 3,
          weight: 0,
          screenTime: 0,
          selectedVideo: null,
        };
      const updatedDetails: WeightTrainingExercise = {
        ...details,
        sets: parseInt(val, 10) || 3,
      };
      updateWeightTrainingDetail(updatedDetails);
    } else {
      console.error("Sets update not applicable for non-weightTraining type.");
    }
  };

  const handleRepsChange = (val: string) => {
    setReps(val);
    if (!exerciseDetail) return;
    if (exerciseDetail.category?.type === 'weight-training') {
      const details =
        (exerciseDetail.category?.details as WeightTrainingExercise) || {
          reps: [],
          sets: 3,
          weight: 0,
          screenTime: 0,
          selectedVideo: null,
        };
      const updatedDetails: WeightTrainingExercise = {
        ...details,
        reps: val.split(','),
      };
      updateWeightTrainingDetail(updatedDetails);
    } else {
      console.error("Reps update not applicable for non-weightTraining type.");
    }
  };

  const handleWeightChange = (val: string) => {
    setWeight(val);
    if (!exerciseDetail) return;
    if (exerciseDetail.category?.type === 'weight-training') {
      const details =
        (exerciseDetail.category?.details as WeightTrainingExercise) || {
          reps: [],
          sets: 3,
          weight: 0,
          screenTime: 0,
          selectedVideo: null,
        };
      const updatedDetails: WeightTrainingExercise = {
        ...details,
        weight: parseFloat(val) || 0,
      };
      updateWeightTrainingDetail(updatedDetails);
    } else {
      console.warn("Weight change not applicable for non-weightTraining type.");
    }
  };

  // Handler for screenTime (applies to both categories)
  const handleScreenTimeChange = (val: string) => {
    setScreenTime(val);
    if (!exerciseDetail) return;
    const newTime = parseFloat(val);
    if (exerciseDetail.category?.type === 'cardio') {
      const details = {
        ...(exerciseDetail.category?.details as CardioExercise || {
          duration: 60,
          bpm: 140,
          calories: 0,
          screenTime: 0,
          selectedVideo: null,
        }),
        screenTime: !isNaN(newTime) ? newTime : 0,
      };
      updateCardioDetail(details);
    } else if (exerciseDetail.category?.type === 'weight-training') {
      const details = {
        ...(exerciseDetail.category?.details as WeightTrainingExercise || {
          reps: ['12'],
          sets: 3,
          weight: 0,
          screenTime: 0,
          selectedVideo: null,
        }),
        screenTime: !isNaN(newTime) ? newTime : 0,
      };
      updateWeightTrainingDetail(details);
    }
  };

  const handleNotesChange = (val: string) => {
    setNotes(val);
    if (!exerciseDetail) return;
    const updatedDetail = new ExerciseDetail({
      ...exerciseDetail,
      notes: val,
    });
    setExerciseDetail(updatedDetail);
    returnExerciseDescription(updatedDetail);
  };


  return (
    <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800 my-2">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">{exerciseName}</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-zinc-400 hover:text-white transition-colors flex items-center gap-2"
        >
          {expanded ? (
            <>
              <span>Collapse</span>
              <ChevronUp size={20} />
            </>
          ) : (
            <>
              <span>{notes ? 'Edit Details' : 'Add Details'}</span>
              <ChevronDown size={20} />
            </>
          )}
        </button>
      </div>
      {expanded && (
        <form className="mt-4 space-y-6">
          {/* Toggle buttons for mode */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setExerciseMode('tracking')}
              className={`px-4 py-2 rounded ${exerciseMode === 'tracking'
                  ? 'bg-[#E0FE10] text-black'
                  : 'bg-zinc-800 text-white'
                }`}
            >
              Tracking
            </button>
            <button
              type="button"
              onClick={() => setExerciseMode('screentime')}
              className={`px-4 py-2 rounded ${exerciseMode === 'screentime'
                  ? 'bg-[#E0FE10] text-black'
                  : 'bg-zinc-800 text-white'
                }`}
            >
              Screentime
            </button>
          </div>
          {/* Conditional rendering based on exerciseMode */}
          {exerciseMode === 'tracking' && (
            <div className="border-t border-zinc-800 pt-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-zinc-400 text-sm block mb-2">Sets</label>
                  <input
                    type="number"
                    value={sets}
                    onChange={(e) => handleSetsChange(e.target.value)}
                    className="w-full p-2 rounded-lg bg-zinc-800 text-white border border-zinc-700 focus:border-[#E0FE10] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 text-sm block mb-2">Reps</label>
                  <input
                    type="text"
                    value={reps}
                    onChange={(e) => handleRepsChange(e.target.value)}
                    className="w-full p-2 rounded-lg bg-zinc-800 text-white border border-zinc-700 focus:border-[#E0FE10] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 text-sm block mb-2">{weightLabel}</label>
                  <input
                    type="text"
                    value={weight}
                    onChange={(e) => handleWeightChange(e.target.value)}
                    className="w-full p-2 rounded-lg bg-zinc-800 text-white border border-zinc-700 focus:border-[#E0FE10] transition-colors"
                  />
                </div>
              </div>
            </div>
          )}
          {exerciseMode === 'screentime' && (
            <div className="border-t border-zinc-800 pt-4">
              <div className="flex items-center gap-4">
                <label className="text-zinc-400 text-sm">Screen Time (sec)</label>
                <input
                  type="text"
                  value={screenTime}
                  onChange={(e) => handleScreenTimeChange(e.target.value)}
                  className="w-32 p-2 rounded-lg bg-zinc-800 text-white border border-zinc-700 focus:border-[#E0FE10] transition-colors"
                  inputMode="numeric"
                />
              </div>
            </div>
          )}
          <div className="border-t border-zinc-800 pt-4">
            <label className="text-zinc-400 text-sm block mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              className="w-full p-3 rounded-lg bg-zinc-800 text-white border border-zinc-700 focus:border-[#E0FE10] transition-colors h-24 resize-none"
              placeholder="Add notes for this exercise..."
            />
          </div>
          {/* Video Selection */}
          {exerciseVideos.length > 0 && (
            <div className="border-t border-zinc-800 pt-4">
              <label className="text-zinc-400 text-sm block mb-2">Select Video</label>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {exerciseVideos.map((video) => (
                  <button
                    key={video.id}
                    type="button"
                    onClick={() => {
                      setSelectedVideo(video);
                      if (exerciseDetail) {
                        if (exerciseMode === 'tracking') {
                          const details =
                            (exerciseDetail.category?.details as WeightTrainingExercise) || {
                              reps: ['12'],
                              sets: 3,
                              weight: 0,
                              screenTime: 0,
                              selectedVideo: null,
                            };
                          updateWeightTrainingDetail({ ...details, selectedVideo: video });
                        } else if (exerciseMode === 'screentime') {
                          if (exerciseDetail.category?.type === 'cardio') {
                            let details: CardioExercise =
                              (exerciseDetail.category?.details as CardioExercise) ?? {
                                duration: 20,
                                bpm: 125,
                                calories: 0,
                                screenTime: 0,
                                selectedVideo: null,
                              };
                            updateCardioDetail(details);
                          } else {
                            let details: WeightTrainingExercise =
                              (exerciseDetail.category?.details as WeightTrainingExercise) ?? {
                                reps: ['12'],
                                sets: 3,
                                weight: 0,
                                screenTime: 0,
                                selectedVideo: null,
                              };
                            updateWeightTrainingDetail(details);
                          }
                        }
                      }
                    }}
                    className={`flex-shrink-0 relative rounded-lg overflow-hidden ${selectedVideo?.id === video.id ? 'ring-2 ring-[#E0FE10]' : ''
                      }`}
                  >
                    <img
                      src={video.gifURL || '/placeholder.gif'}
                      alt="Exercise preview"
                      className="w-20 h-20 object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="border-t border-zinc-800 pt-4 flex items-center justify-between">
            <label className="text-zinc-400 text-sm">Exercise uses dumbbells</label>
            <input
              type="checkbox"
              checked={isDumbell}
              onChange={(e) => {
                const isChecked = e.target.checked;
                setIsDumbell(isChecked);
                if (exerciseDetail) {
                  const updatedDetail = { ...exerciseDetail, isSplit: isChecked };
                  setExerciseDetail(new ExerciseDetail(updatedDetail));
                  returnExerciseDescription(new ExerciseDetail(updatedDetail));
                }
              }}
              className="w-5 h-5 accent-[#E0FE10]"
            />

          </div>
          <button
            type="button"
            onClick={() => {
              if (!exerciseDetail) return;

              const screenTimeValue = parseFloat(screenTime) || 0;
              
              console.log("Exercise detail type:", exerciseDetail);
              // Create the category details based on the current exercise type
              const categoryDetails = exerciseDetail.exercise.category?.type === 'cardio' 
                ? {
                    duration: (exerciseDetail.category?.details as CardioExercise)?.duration || 60,
                    bpm: (exerciseDetail.category?.details as CardioExercise)?.bpm || 140,
                    calories: (exerciseDetail.category?.details as CardioExercise)?.calories || 0,
                    screenTime: screenTimeValue,
                    selectedVideo: selectedVideo
                  }
                : {
                    reps: reps.split(',').filter(r => r.trim()).length ? reps.split(',').filter(r => r.trim()) : ['12'],
                    sets: parseInt(sets) || 3,
                    weight: parseFloat(weight) || 0,
                    screenTime: screenTimeValue,
                    selectedVideo: selectedVideo
                  };

              console.log("Category details:", categoryDetails);
              // Create the final exercise detail with explicit category structure
              const finalExerciseDetail = new ExerciseDetail({
                ...exerciseDetail,
                category: {
                  type: exerciseDetail.category?.type || 'weight-training',
                  details: categoryDetails
                },
                notes: notes,
                isSplit: isDumbell,
                exercise: exerciseDetail.exercise,
                exerciseName: exerciseDetail.exerciseName
              });

              console.log('Saving exercise detail with screenTime:', screenTimeValue, finalExerciseDetail);
              setExpanded(false);
              returnExerciseDescription(finalExerciseDetail);
            }}
            className="w-full py-3 bg-[#E0FE10] text-black rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            Save Details
          </button>

        </form>
      )}
    </div>
  );
};

// MobileStackView Component
interface MobileStackViewProps {
  stackName: string;
  setStackName: (name: string) => void;
  description: string;
  setDescription: (desc: string) => void;
  exerciseDetails: any[];
  setExerciseDetails: (exercises: ExerciseDetail[]) => void;
  useAuthorContent: boolean;
  setUseAuthorContent: (value: boolean) => void;
  onCreateStack: () => void;
  hideAddMoveButton?: boolean;
}

const MobileStackView: React.FC<MobileStackViewProps> = ({
  stackName,
  setStackName,
  description,
  setDescription,
  exerciseDetails,
  setExerciseDetails,
  useAuthorContent,
  setUseAuthorContent,
  onCreateStack,
  hideAddMoveButton = false,
}) => {
  return (
    <div className="min-h-screen bg-zinc-900">
      {/* Header */}
      <div className="relative h-40 bg-zinc-800">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-900"></div>
        <div className="absolute bottom-6 left-6">
          <h1 className="text-3xl font-bold text-white">Create Stack</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 space-y-6">
        <div className="space-y-4">
          <input
            type="text"
            value={stackName}
            onChange={(e) => setStackName(e.target.value)}
            placeholder="Stack Name"
            className="w-full p-4 bg-zinc-800 text-white rounded-lg border border-zinc-700 focus:border-[#E0FE10] transition-colors"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Stack Description"
            className="w-full p-4 bg-zinc-800 text-white rounded-lg border border-zinc-700 focus:border-[#E0FE10] transition-colors h-32 resize-none"
          />

          <div className="flex items-center space-x-3 bg-zinc-800 p-4 rounded-lg">
            <input
              type="checkbox"
              checked={useAuthorContent}
              onChange={() => setUseAuthorContent(!useAuthorContent)}
              className="w-5 h-5 accent-[#E0FE10]"
            />
            <span className="text-zinc-300">Use my fitness content exclusively</span>
          </div>
        </div>

        {/* Exercise List */}
        <div className="space-y-4">
          {exerciseDetails.map((ex, index) => (
            <div key={ex.exercise.id} className="bg-zinc-800 rounded-lg p-4">
              <CreateWorkoutExerciseCardView
                appCoordinator={null}
                exerciseDescription={ex}
                workoutCaregory={ex.category}
                returnExerciseDescription={(newDetail) => {
                  const updated = [...exerciseDetails];
                  updated[index] = newDetail;
                  setExerciseDetails(updated);
                }}
              />
              <button
                onClick={() => {
                  const updated = exerciseDetails.filter(detail => detail.exercise.id !== ex.exercise.id);
                  setExerciseDetails(updated);
                }}
                className="mt-2 flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors"
              >
                <Trash2 size={16} />
                <span>Remove</span>
              </button>
            </div>
            
          ))}
        </div>

        {!hideAddMoveButton && (
          <button
            className="flex items-center justify-center gap-2 w-full py-4 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors"
          >
            <Plus size={20} />
            <span>Add Move</span>
          </button>
        )}

        {/* Create Stack Button */}
        <button
          onClick={onCreateStack}
          className="w-full py-4 bg-[#E0FE10] text-black rounded-lg font-semibold hover:opacity-90 transition-opacity"
        >
          Create Stack
        </button>
      </div>
    </div>
  );
};

// DesktopStackView Component
interface DesktopStackViewProps {
  stackName: string;
  setStackName: (name: string) => void;
  description: string;
  setDescription: (desc: string) => void;
  exerciseDetails: any[];
  setExerciseDetails: (exercises: any[]) => void;
  useAuthorContent: boolean;
  setUseAuthorContent: (value: boolean) => void;
  onCreateStack: () => void;
}

const DesktopStackView: React.FC<DesktopStackViewProps> = (props) => {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);

  // Fetch all exercises
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

  // Update selected exercises when exercise details change
  useEffect(() => {
    setSelectedExercises(props.exerciseDetails.map(detail => detail.exercise));
  }, [props.exerciseDetails]);

  // Filter exercises based on search and selected user
  useEffect(() => {
    const filtered = allExercises
      .filter(exercise =>
        selectedUserId ? exercise.author.userId === selectedUserId : true
      )
      .filter(exercise =>
        exercise.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    setFilteredExercises(filtered);
  }, [allExercises, selectedUserId, searchTerm]);

  const handleToggleSelection = useCallback((exercise: Exercise) => {
    setSelectedExercises((prevSelected) => {
      const alreadySelected = prevSelected.some((ex) => ex.id === exercise.id);

      if (alreadySelected) {
        const updatedSelected = prevSelected.filter((ex) => ex.id !== exercise.id);
        const updatedExerciseDetails = props.exerciseDetails.filter(
          (ex: any) => ex.exercise.id !== exercise.id
        );
        props.setExerciseDetails(updatedExerciseDetails);
        return updatedSelected;
      } else {
        const updatedSelected = [...prevSelected, exercise];
        const updatedExerciseDetails = [
          ...props.exerciseDetails,
          { exerciseName: exercise.name, notes: '', exercise },
        ];
        props.setExerciseDetails(updatedExerciseDetails);
        return updatedSelected;
      }
    });
  }, [props.exerciseDetails, props.setExerciseDetails]);

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 overflow-y-auto bg-zinc-900 border-r border-zinc-800">
        <MobileStackView {...props} hideAddMoveButton={true} />
      </div>
      <div className="flex-1 bg-zinc-900 p-6 overflow-y-auto">
        <div className="sticky top-0 bg-zinc-900 pb-4 z-10 space-y-4">
          <UserFilter
            selectedUserId={selectedUserId}
            onUserSelect={setSelectedUserId}
          />
          <input
            type="text"
            placeholder="Search moves..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-4 bg-zinc-800 text-white rounded-lg border border-zinc-700 focus:border-[#E0FE10] transition-colors"
          />
        </div>
        <ExerciseGrid
          userVideos={filteredExercises}
          multiSelection={true}
          selectedExercises={selectedExercises}
          onToggleSelection={handleToggleSelection}
          onSelectVideo={handleToggleSelection}
        />
      </div>
    </div>
  );
};

// CreateStackPage Component
const CreateStackPage: React.FC = () => {
  const [stackName, setStackName] = useState('');
  const [description, setDescription] = useState('');
  const [exerciseDetails, setExerciseDetails] = useState<ExerciseDetail[]>([]);
  const [useAuthorContent, setUseAuthorContent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const currentUser = useUser();

  const onCreateStack = async () => {
    if (!currentUser?.id) {
      console.error('No user ID found');
      return;
    }

    if (!stackName.trim()) {
      console.error('Stack name is required');
      return;
    }

    if (exerciseDetails.length === 0) {
      console.error('At least one exercise is required');
      return;
    }

    setIsLoading(true);

    console.log("Exercise details before creating workout:", exerciseDetails);
    try {
      const { workout, exerciseLogs } = await workoutService.formatWorkoutAndInitializeLogs(
        exerciseDetails,
        currentUser.id
      );

      // Just update the essential fields
      workout.title = stackName.trim();
      workout.description = description.trim();
      workout.useAuthorContent = useAuthorContent;

      console.log("Here are the final logs:", exerciseLogs);

      await userService.createStack(workout, exerciseLogs);
      router.push(`/workout/${currentUser.username}/${workout.id}`);
    } catch (error) {
      console.error('Error creating stack:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Mobile view */}
      <div className="lg:hidden">
        <MobileStackView
          stackName={stackName}
          setStackName={setStackName}
          description={description}
          setDescription={setDescription}
          exerciseDetails={exerciseDetails}
          setExerciseDetails={setExerciseDetails}
          useAuthorContent={useAuthorContent}
          setUseAuthorContent={setUseAuthorContent}
          onCreateStack={onCreateStack}
        />
      </div>

      {/* Desktop view */}
      <div className="hidden lg:block">
        <DesktopStackView
          stackName={stackName}
          setStackName={setStackName}
          description={description}
          setDescription={setDescription}
          exerciseDetails={exerciseDetails}
          setExerciseDetails={setExerciseDetails}
          useAuthorContent={useAuthorContent}
          setUseAuthorContent={setUseAuthorContent}
          onCreateStack={onCreateStack}
        />
      </div>

      {isLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 p-6 rounded-lg">
            <p className="text-white">Creating your Stack...</p>
          </div>
        </div>
      )}
    </>
  );
};

export default CreateStackPage;