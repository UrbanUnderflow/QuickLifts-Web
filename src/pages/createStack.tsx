import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';

import { Plus, Trash2, ChevronDown, ChevronUp, ArrowLeft, Layers, Search, Check, X } from 'lucide-react';
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
  onRemove?: () => void;
}

const CreateWorkoutExerciseCardView: React.FC<CreateWorkoutExerciseCardViewProps> = ({
  appCoordinator: _appCoordinator,
  exerciseDescription: initialExerciseDescription,
  workoutCaregory: _initialWorkoutCaregory,
  returnExerciseDescription,
  onRemove,
}) => {
  // Convert initial videos
  const initialVideos =
    (initialExerciseDescription?.exercise?.videos || []).map((v: any) =>
      v && (v as ExerciseVideo).exerciseId ? (v as ExerciseVideo) : new ExerciseVideo(v)
    ) || [];

  // Local state management
  const [expanded, setExpanded] = useState(false);
  const [exerciseName, _setExerciseName] = useState(
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
    <div className="bg-zinc-800/50 rounded-xl border border-zinc-700/50 overflow-hidden">
      <div 
        className="flex justify-between items-center p-4 cursor-pointer hover:bg-zinc-800/80 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <Layers className="w-5 h-5 text-orange-400" />
          </div>
          <h3 className="text-base font-medium text-white">{exerciseName}</h3>
        </div>
        <div className="flex items-center gap-2">
          {onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
              title="Remove move"
              aria-label="Remove move"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            type="button"
            className="text-zinc-400 hover:text-white transition-colors flex items-center gap-2 text-sm px-2 py-1"
            aria-label={expanded ? 'Collapse move details' : 'Configure move details'}
          >
            {expanded ? (
              <>
                <span className="hidden sm:inline">Collapse</span>
                <ChevronUp size={18} />
              </>
            ) : (
              <>
                <span className="hidden sm:inline">{notes ? 'Edit' : 'Configure'}</span>
                <ChevronDown size={18} />
              </>
            )}
          </button>
        </div>
      </div>
      {expanded && (
        <form className="p-4 pt-0 space-y-5 border-t border-zinc-700/50">
          {/* Toggle buttons for mode */}
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={() => setExerciseMode('tracking')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${exerciseMode === 'tracking'
                  ? 'bg-[#E0FE10] text-black'
                  : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-700'
                }`}
            >
              Tracking
            </button>
            <button
              type="button"
              onClick={() => setExerciseMode('screentime')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${exerciseMode === 'screentime'
                  ? 'bg-[#E0FE10] text-black'
                  : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-700'
                }`}
            >
              Screentime
            </button>
          </div>
          {/* Conditional rendering based on exerciseMode */}
          {exerciseMode === 'tracking' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-zinc-400 text-xs block mb-1.5">Sets</label>
                <input
                  type="number"
                  value={sets}
                  onChange={(e) => handleSetsChange(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-zinc-900/50 text-white border border-zinc-700 focus:border-[#E0FE10] focus:outline-none transition-colors text-sm"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs block mb-1.5">Reps</label>
                <input
                  type="text"
                  value={reps}
                  onChange={(e) => handleRepsChange(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-zinc-900/50 text-white border border-zinc-700 focus:border-[#E0FE10] focus:outline-none transition-colors text-sm"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs block mb-1.5">{weightLabel}</label>
                <input
                  type="text"
                  value={weight}
                  onChange={(e) => handleWeightChange(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-zinc-900/50 text-white border border-zinc-700 focus:border-[#E0FE10] focus:outline-none transition-colors text-sm"
                />
              </div>
            </div>
          )}
          {exerciseMode === 'screentime' && (
            <div className="flex items-center gap-3">
              <label className="text-zinc-400 text-sm">Screen Time (sec)</label>
              <input
                type="text"
                value={screenTime}
                onChange={(e) => handleScreenTimeChange(e.target.value)}
                className="w-24 p-2.5 rounded-lg bg-zinc-900/50 text-white border border-zinc-700 focus:border-[#E0FE10] focus:outline-none transition-colors text-sm"
                inputMode="numeric"
              />
            </div>
          )}
          <div>
            <label className="text-zinc-400 text-xs block mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              className="w-full p-3 rounded-lg bg-zinc-900/50 text-white border border-zinc-700 focus:border-[#E0FE10] focus:outline-none transition-colors h-20 resize-none text-sm"
              placeholder="Add notes for this exercise..."
            />
          </div>
          {/* Video Selection */}
          {exerciseVideos.length > 0 && (
            <div>
              <label className="text-zinc-400 text-xs block mb-2">Select Video</label>
              <div className="flex gap-3 overflow-x-auto pb-2">
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
                    className={`flex-shrink-0 relative rounded-lg overflow-hidden transition-all ${selectedVideo?.id === video.id ? 'ring-2 ring-[#E0FE10] scale-105' : 'hover:scale-105'
                      }`}
                  >
                    <img
                      src={video.gifURL || '/placeholder.gif'}
                      alt="Exercise preview"
                      className="w-16 h-16 object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between py-2">
            <label className="text-zinc-400 text-sm">Uses dumbbells (split tracking)</label>
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
              className="w-5 h-5 accent-[#E0FE10] rounded"
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
            className="w-full py-2.5 bg-[#E0FE10] text-black rounded-lg font-medium text-sm hover:bg-[#d4f00e] transition-colors"
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
  const router = useRouter();
  const [isMovePickerOpen, setIsMovePickerOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);

  // Fetch all exercises for move picker (mobile)
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

  // Keep selection in sync with configured exerciseDetails
  useEffect(() => {
    setSelectedExercises(exerciseDetails.map((detail: any) => detail.exercise));
  }, [exerciseDetails]);

  // Filter exercises based on search and selected user
  useEffect(() => {
    const filtered = allExercises
      .filter(exercise => (selectedUserId ? exercise.author.userId === selectedUserId : true))
      .filter(exercise => exercise.name.toLowerCase().includes(searchTerm.toLowerCase()));
    setFilteredExercises(filtered);
  }, [allExercises, selectedUserId, searchTerm]);

  const handleToggleSelection = useCallback((exercise: Exercise) => {
    setSelectedExercises((prevSelected) => {
      const alreadySelected = prevSelected.some((ex) => ex.id === exercise.id);

      if (alreadySelected) {
        const updatedSelected = prevSelected.filter((ex) => ex.id !== exercise.id);
        const updatedExerciseDetails = exerciseDetails.filter(
          (ex: any) => ex.exercise.id !== exercise.id
        );
        setExerciseDetails(updatedExerciseDetails);
        return updatedSelected;
      }

      const updatedSelected = [...prevSelected, exercise];
      const updatedExerciseDetails = [
        ...exerciseDetails,
        { exerciseName: exercise.name, notes: '', exercise },
      ];
      setExerciseDetails(updatedExerciseDetails);
      return updatedSelected;
    });
  }, [exerciseDetails, setExerciseDetails]);
  
  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-black/80 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="px-6 py-4">
          <button
            onClick={() => router.push('/create')}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group mb-4"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm">Back to Creator Studio</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/30 flex items-center justify-center">
              <Layers className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Create Movelist</h1>
              <p className="text-zinc-500 text-sm">Build a workout from your moves</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 space-y-6">
        {/* Form Fields */}
        <div className="space-y-4">
          <div>
            <label className="text-zinc-400 text-sm block mb-2">Movelist Name</label>
            <input
              type="text"
              value={stackName}
              onChange={(e) => setStackName(e.target.value)}
              placeholder="e.g., Upper Body Blast"
              className="w-full p-4 bg-zinc-900/50 text-white rounded-xl border border-zinc-800 focus:border-orange-500/50 focus:outline-none transition-colors placeholder:text-zinc-600"
            />
          </div>

          <div>
            <label className="text-zinc-400 text-sm block mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your movelist..."
              className="w-full p-4 bg-zinc-900/50 text-white rounded-xl border border-zinc-800 focus:border-orange-500/50 focus:outline-none transition-colors h-24 resize-none placeholder:text-zinc-600"
            />
          </div>

          <label className="flex items-center gap-3 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors">
            <input
              type="checkbox"
              checked={useAuthorContent}
              onChange={() => setUseAuthorContent(!useAuthorContent)}
              className="w-5 h-5 accent-[#E0FE10] rounded"
            />
            <span className="text-zinc-300 text-sm">Use my fitness content exclusively</span>
          </label>
        </div>

        {/* Selected Moves */}
        {exerciseDetails.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold">Selected Moves</h2>
              <span className="text-zinc-500 text-sm">{exerciseDetails.length} move{exerciseDetails.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-2">
              {exerciseDetails.map((ex, index) => (
                <div key={ex.exercise.id}>
                  <CreateWorkoutExerciseCardView
                    appCoordinator={null}
                    exerciseDescription={ex}
                    workoutCaregory={ex.category}
                    returnExerciseDescription={(newDetail) => {
                      const updated = [...exerciseDetails];
                      updated[index] = newDetail;
                      setExerciseDetails(updated);
                    }}
                    onRemove={() => {
                      const updated = exerciseDetails.filter(detail => detail.exercise.id !== ex.exercise.id);
                      setExerciseDetails(updated);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {exerciseDetails.length === 0 && (
          <div className="text-center py-12 px-6">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Layers className="w-8 h-8 text-zinc-600" />
            </div>
            <h3 className="text-white font-medium mb-2">No moves selected</h3>
            <p className="text-zinc-500 text-sm">Select moves from the library to build your movelist</p>
          </div>
        )}

        {!hideAddMoveButton && (
          <button
            type="button"
            onClick={() => setIsMovePickerOpen(true)}
            className="flex items-center justify-center gap-2 w-full py-4 bg-zinc-900/50 text-zinc-300 rounded-xl border border-zinc-800 border-dashed hover:bg-zinc-900 hover:border-zinc-700 transition-colors"
          >
            <Plus size={20} />
            <span>Add Move</span>
          </button>
        )}

        {/* Create Button */}
        <button
          onClick={onCreateStack}
          disabled={!stackName.trim() || exerciseDetails.length === 0}
          className="w-full py-4 bg-[#E0FE10] text-black rounded-xl font-semibold hover:bg-[#d4f00e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Create Movelist
        </button>
      </div>

      {/* Mobile Move Picker Modal */}
      {isMovePickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
          <div className="absolute inset-0 flex flex-col">
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-zinc-800/50 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-white font-semibold">Move Library</h2>
                  <p className="text-zinc-500 text-xs">{filteredExercises.length} moves</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMovePickerOpen(false)}
                  className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                  aria-label="Close move library"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <UserFilter selectedUserId={selectedUserId} onUserSelect={setSelectedUserId} />
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search moves..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-zinc-900/50 text-white rounded-xl border border-zinc-800 focus:border-orange-500/50 focus:outline-none transition-colors placeholder:text-zinc-600"
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <ExerciseGrid
                userVideos={filteredExercises}
                multiSelection={true}
                selectedExercises={selectedExercises}
                onToggleSelection={handleToggleSelection}
                onSelectVideo={handleToggleSelection}
              />
              <div className="h-24" />
            </div>

            <div className="sticky bottom-0 z-10 bg-black/80 backdrop-blur-xl border-t border-zinc-800/50 px-6 py-4">
              <button
                type="button"
                onClick={() => setIsMovePickerOpen(false)}
                className="w-full py-3 bg-[#E0FE10] text-black rounded-xl font-semibold hover:bg-[#d4f00e] transition-colors"
              >
                Done ({selectedExercises.length})
              </button>
            </div>
          </div>
        </div>
      )}
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
  const router = useRouter();
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
    <div className="min-h-screen flex bg-black">
      {/* Left Panel - Movelist Builder */}
      <div className="w-[480px] flex-shrink-0 border-r border-zinc-800/50 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-black/80 backdrop-blur-xl border-b border-zinc-800/50">
          <div className="px-6 py-4">
            <button
              onClick={() => router.push('/create')}
              className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group mb-4"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm">Back to Creator Studio</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/30 flex items-center justify-center">
                <Layers className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Create Movelist</h1>
                <p className="text-zinc-500 text-sm">Build a workout from your moves</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="text-zinc-400 text-sm block mb-2">Movelist Name</label>
              <input
                type="text"
                value={props.stackName}
                onChange={(e) => props.setStackName(e.target.value)}
                placeholder="e.g., Upper Body Blast"
                className="w-full p-4 bg-zinc-900/50 text-white rounded-xl border border-zinc-800 focus:border-orange-500/50 focus:outline-none transition-colors placeholder:text-zinc-600"
              />
            </div>

            <div>
              <label className="text-zinc-400 text-sm block mb-2">Description</label>
              <textarea
                value={props.description}
                onChange={(e) => props.setDescription(e.target.value)}
                placeholder="Describe your movelist..."
                className="w-full p-4 bg-zinc-900/50 text-white rounded-xl border border-zinc-800 focus:border-orange-500/50 focus:outline-none transition-colors h-20 resize-none placeholder:text-zinc-600"
              />
            </div>

            <label className="flex items-center gap-3 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors">
              <input
                type="checkbox"
                checked={props.useAuthorContent}
                onChange={() => props.setUseAuthorContent(!props.useAuthorContent)}
                className="w-5 h-5 accent-[#E0FE10] rounded"
              />
              <span className="text-zinc-300 text-sm">Use my fitness content exclusively</span>
            </label>
          </div>

          {/* Selected Moves */}
          {props.exerciseDetails.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-white font-semibold">Selected Moves</h2>
                <span className="text-zinc-500 text-sm">{props.exerciseDetails.length} move{props.exerciseDetails.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2">
                {props.exerciseDetails.map((ex, index) => (
                  <div key={ex.exercise.id}>
                    <CreateWorkoutExerciseCardView
                      appCoordinator={null}
                      exerciseDescription={ex}
                      workoutCaregory={ex.category}
                      returnExerciseDescription={(newDetail) => {
                        const updated = [...props.exerciseDetails];
                        updated[index] = newDetail;
                        props.setExerciseDetails(updated);
                      }}
                      onRemove={() => {
                        const updated = props.exerciseDetails.filter(detail => detail.exercise.id !== ex.exercise.id);
                        props.setExerciseDetails(updated);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {props.exerciseDetails.length === 0 && (
            <div className="text-center py-8 px-6">
              <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-3">
                <Layers className="w-7 h-7 text-zinc-600" />
              </div>
              <h3 className="text-white font-medium mb-1">No moves selected</h3>
              <p className="text-zinc-500 text-sm">Click on moves from the library →</p>
            </div>
          )}

          {/* Create Button */}
          <button
            onClick={props.onCreateStack}
            disabled={!props.stackName.trim() || props.exerciseDetails.length === 0}
            className="w-full py-4 bg-[#E0FE10] text-black rounded-xl font-semibold hover:bg-[#d4f00e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Movelist
          </button>
        </div>
      </div>

      {/* Right Panel - Move Library */}
      <div className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-zinc-800/50 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Move Library</h2>
            <span className="text-zinc-500 text-sm">{filteredExercises.length} moves</span>
          </div>
          <UserFilter
            selectedUserId={selectedUserId}
            onUserSelect={setSelectedUserId}
          />
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search moves..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-zinc-900/50 text-white rounded-xl border border-zinc-800 focus:border-orange-500/50 focus:outline-none transition-colors placeholder:text-zinc-600"
            />
          </div>
        </div>
        <div className="p-6">
          <ExerciseGrid
            userVideos={filteredExercises}
            multiSelection={true}
            selectedExercises={selectedExercises}
            onToggleSelection={handleToggleSelection}
            onSelectVideo={handleToggleSelection}
          />
        </div>
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl text-center">
            <div className="w-12 h-12 border-4 border-[#E0FE10] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white font-medium">Creating your Movelist...</p>
          </div>
        </div>
      )}
    </>
  );
};

export default CreateStackPage;
