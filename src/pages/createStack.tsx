import React, { useState, useEffect,  } from 'react';
import { useRouter } from 'next/router';

import { CheckCircle, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Exercise,
  ExerciseLog,
  ExerciseDetail,
  ExerciseReference,
} from '../api/firebase/exercise/types';
import { exerciseService } from '../api/firebase/exercise/service';
import { workoutService } from '../api/firebase/workout';
import { userService, User } from '../api/firebase/user';
import {
  WorkoutStatus,
  Workout,
  WorkoutRating,
  BodyZone,
  RepsAndWeightLog,
} from '../api/firebase/workout';
import { ExerciseVideo } from '../api/firebase/exercise/types';

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
  const initialVideos = (initialExerciseDescription?.exercise?.videos || []).map((v: any) =>
    v && (v as ExerciseVideo).exerciseId ? (v as ExerciseVideo) : ExerciseVideo.fromFirebase(v)
  ) || [];

  // State management
  const [expanded, setExpanded] = useState(false);
  const [exerciseName, setExerciseName] = useState(initialExerciseDescription?.exerciseName || '');
  const [exerciseVideos] = useState<ExerciseVideo[]>(initialVideos);
  const [isDumbell, setIsDumbell] = useState(initialExerciseDescription?.isSplit || false);
  const [reps, setReps] = useState(
    initialExerciseDescription?.category?.type === 'weightTraining'
      ? initialExerciseDescription.category.details?.reps.join(',') || ''
      : ''
  );
  const [sets, setSets] = useState(
    initialExerciseDescription?.category?.type === 'weightTraining'
      ? `${initialExerciseDescription.category.details?.sets}` || ''
      : ''
  );
  const [weight, setWeight] = useState(
    initialExerciseDescription?.category?.type === 'weightTraining'
      ? `${initialExerciseDescription.category.details?.weight}` || ''
      : ''
  );
  const [bpm, setBpm] = useState(
    initialExerciseDescription?.category?.type === 'cardio'
      ? `${initialExerciseDescription.category.details?.bpm}` || ''
      : ''
  );
  const [duration, setDuration] = useState(
    initialExerciseDescription?.category?.type === 'cardio'
      ? `${initialExerciseDescription.category.details?.duration}` || ''
      : ''
  );
  const [screenTime, setScreenTime] = useState<number>(
    (initialExerciseDescription?.category?.type === 'weightTraining'
      ? initialExerciseDescription.category.details?.screenTime
      : initialExerciseDescription?.category?.type === 'cardio'
      ? initialExerciseDescription.category.details?.screenTime
      : 0) || 0
  );
  const [isTimedExercise] = useState(
    (initialExerciseDescription?.category?.type === 'weightTraining' &&
      initialExerciseDescription?.category?.details?.screenTime !== 0) ||
    (initialExerciseDescription?.category?.type === 'cardio' &&
      initialExerciseDescription?.category?.details?.screenTime !== 0) ||
    false
  );
  const [selectedVideo, setSelectedVideo] = useState<ExerciseVideo | null>(null);
  const [notes, setNotes] = useState(initialExerciseDescription?.notes || '');
  const [weightLabel] = useState('Weight');
  const [exerciseDetail, setExerciseDetail] = useState<ExerciseDetail | undefined>(
    initialExerciseDescription
  );

  // Update exercise detail and notify parent
  const updateDetail = (updates: Partial<ExerciseDetail>) => {
    const updated = { ...exerciseDetail, ...updates } as ExerciseDetail;
    setExerciseDetail(updated);
    returnExerciseDescription(updated);
  };

  // Field change handlers
  const handleSetsChange = (val: string) => {
    setSets(val);
    if (exerciseDetail && exerciseDetail.category?.type === 'weightTraining') {
      const details = exerciseDetail.category.details || { reps: [], sets: 3, weight: 0.0, screenTime: 0 };
      const updatedDetails = { ...details, sets: parseInt(val, 10) || 3 };
      updateDetail({ category: { type: 'weightTraining', details: updatedDetails } });
    }
  };

  const handleRepsChange = (val: string) => {
    setReps(val);
    if (exerciseDetail && exerciseDetail.category?.type === 'weightTraining') {
      const details = exerciseDetail.category.details || { reps: [], sets: 3, weight: 0.0, screenTime: 0 };
      const updatedDetails = { ...details, reps: val.split(',') };
      updateDetail({ category: { type: 'weightTraining', details: updatedDetails } });
    }
  };

  const handleWeightChange = (val: string) => {
    setWeight(val);
    if (exerciseDetail && exerciseDetail.category?.type === 'weightTraining') {
      const details = exerciseDetail.category.details || { reps: [], sets: 3, weight: 0.0, screenTime: 0 };
      const updatedDetails = { ...details, weight: parseFloat(val) || 0.0 };
      updateDetail({ category: { type: 'weightTraining', details: updatedDetails } });
    }
  };

  const handleBpmChange = (val: string) => {
    setBpm(val);
    if (exerciseDetail && exerciseDetail.category?.type === 'cardio') {
      const details = exerciseDetail.category.details || { duration: 60, bpm: 140, calories: 0, screenTime: 0 };
      const updatedDetails = { ...details, bpm: parseInt(val, 10) || 140 };
      updateDetail({ category: { type: 'cardio', details: updatedDetails } });
    }
  };

  const handleDurationChange = (val: string) => {
    setDuration(val);
    if (exerciseDetail && exerciseDetail.category?.type === 'cardio') {
      const details = exerciseDetail.category.details || { duration: 60, bpm: 140, calories: 0, screenTime: 0 };
      const updatedDetails = { ...details, duration: parseInt(val, 10) || 60 };
      updateDetail({ category: { type: 'cardio', details: updatedDetails } });
    }
  };

  const handleScreenTimeChange = (val: string) => {
    const newTime = parseFloat(val) || 0;
    setScreenTime(newTime);
    if (exerciseDetail) {
      if (exerciseDetail.category?.type === 'weightTraining') {
        const details = exerciseDetail.category.details || { reps: [], sets: 3, weight: 0.0, screenTime: 0 };
        const updatedDetails = { ...details, screenTime: newTime };
        updateDetail({ category: { type: 'weightTraining', details: updatedDetails } });
      } else if (exerciseDetail.category?.type === 'cardio') {
        const details = exerciseDetail.category.details || { duration: 60, bpm: 140, calories: 0, screenTime: 0 };
        const updatedDetails = { ...details, screenTime: newTime };
        updateDetail({ category: { type: 'cardio', details: updatedDetails } });
      }
    }
  };

  const handleNotesChange = (val: string) => {
    setNotes(val);
    updateDetail({ notes: val });
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
          {/* Weight Training Fields */}
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

          {/* Screen Time */}
          <div className="border-t border-zinc-800 pt-4">
            <div className="flex items-center gap-4">
              <label className="text-zinc-400 text-sm">Screen Time (sec)</label>
              <input
                type="number"
                value={screenTime}
                onChange={(e) => handleScreenTimeChange(e.target.value)}
                className="w-32 p-2 rounded-lg bg-zinc-800 text-white border border-zinc-700 focus:border-[#E0FE10] transition-colors"
              />
            </div>
          </div>

          {/* Notes Field */}
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
                        if (exerciseDetail.category?.type === 'weightTraining') {
                          const details = exerciseDetail.category.details || {
                            reps: ['12'],
                            sets: 3,
                            weight: 0,
                            screenTime: 0,
                            selectedVideo: null,
                          };
                          updateDetail({
                            category: {
                              type: 'weightTraining',
                              details: { ...details, selectedVideo: video },
                            },
                          });
                        } else if (exerciseDetail.category?.type === 'cardio') {
                          const details = exerciseDetail.category.details || {
                            duration: 20,
                            bpm: 125,
                            calories: 0,
                            screenTime: 0,
                            selectedVideo: null,
                          };
                          updateDetail({
                            category: {
                              type: 'cardio',
                              details: { ...details, selectedVideo: video },
                            },
                          });
                        }
                      }
                    }}
                    className={`flex-shrink-0 relative rounded-lg overflow-hidden ${
                      selectedVideo?.id === video.id ? 'ring-2 ring-[#E0FE10]' : ''
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

          {/* Dumbbell Toggle */}
          <div className="border-t border-zinc-800 pt-4 flex items-center justify-between">
            <label className="text-zinc-400 text-sm">Exercise uses dumbbells</label>
            <input
              type="checkbox"
              checked={isDumbell}
              onChange={(e) => {
                setIsDumbell(e.target.checked);
                updateDetail({ isSplit: e.target.checked });
              }}
              className="w-5 h-5 accent-[#E0FE10]"
            />
          </div>

{/* Save Button */}
<button
  type="button"
  onClick={() => {
    setExpanded(false);
    returnExerciseDescription(exerciseDetail!);
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

interface UserFilterProps {
  selectedUserId: string | null;
  onUserSelect: (userId: string | null) => void;
}

const UserFilter: React.FC<UserFilterProps> = ({ selectedUserId, onUserSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        // Replace with your actual user fetching logic
        const fetchedUsers = await userService.getAllUsers();
        setUsers(fetchedUsers);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching users:', error);
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedUser = users.find(u => u.id === selectedUserId);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 bg-zinc-800 text-white rounded-lg border border-zinc-700 flex justify-between items-center"
      >
        <span>{selectedUserId ? selectedUser?.username : 'All Users'}</span>
        <ChevronDown className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute mt-2 w-full bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-20">
          <div className="p-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search users..."
              className="w-full p-2 bg-zinc-700 text-white rounded-md"
            />
          </div>

          <div className="max-h-60 overflow-y-auto">
            <button
              onClick={() => {
                onUserSelect(null);
                setIsOpen(false);
              }}
              className={`w-full p-3 text-left hover:bg-zinc-700 ${!selectedUserId ? 'bg-[#E0FE10] text-black' : 'text-white'}`}
            >
              All Users
            </button>
            
            {loading ? (
              <div className="p-3 text-zinc-400">Loading users...</div>
            ) : (
              filteredUsers.map(user => (
                <button
                  key={user.id}
                  onClick={() => {
                    onUserSelect(user.id);
                    setIsOpen(false);
                  }}
                  className={`w-full p-3 text-left hover:bg-zinc-700 ${selectedUserId === user.id ? 'bg-[#E0FE10] text-black' : 'text-white'}`}
                >
                  {user.username}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ExerciseGrid Component
interface ExerciseGridProps {
  userVideos: Exercise[];
  onSelectVideo: (exercise: Exercise) => void;
  multiSelection?: boolean;
  selectedExercises?: Exercise[];
  onToggleSelection?: (exercise: Exercise) => void;
}

const ExerciseGrid: React.FC<ExerciseGridProps> = ({
  userVideos,
  onSelectVideo,
  multiSelection = false,
  selectedExercises = [],
  onToggleSelection,
}) => {

const seenGifUrls = new Set<string>();

const filteredVideos = userVideos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).filter((exercise) => {
  const gifUrl = exercise.videos[0]?.gifURL;
  if (seenGifUrls.has(gifUrl || '')) return false;
    seenGifUrls.add(gifUrl || '');
    return true;
  });

if (filteredVideos.length === 0) {
  return (
    <div className="flex items-center justify-center h-64 text-zinc-500 text-lg">
    No moves available
    </div>
  );
}

return (
<div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4">
{filteredVideos.map((exercise) => {
const isSelected = multiSelection && selectedExercises.some((sel) => sel.id === exercise.id);
return (
<div
  key={`${exercise.id}-${new Date(exercise.createdAt).getTime()}`}
  onClick={() => {
    if (multiSelection && onToggleSelection) {
      onToggleSelection(exercise);
    } else {
      onSelectVideo(exercise);
    }
  }}
  className="relative cursor-pointer group"
>
  <div className="relative rounded-lg overflow-hidden aspect-square">
    <img
      src={exercise.videos[0]?.gifURL}
      alt={exercise.name}
      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
    />
    {multiSelection && isSelected && (
      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
        <CheckCircle className="text-[#E0FE10]" size={32} />
      </div>
    )}
  </div>
  <p className="mt-2 text-white text-sm font-medium truncate">{exercise.name}</p>
</div>
);
})}
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
  setExerciseDetails: (exercises: any[]) => void;
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

// Update DesktopStackView
const DesktopStackView: React.FC<DesktopStackViewProps> = (props) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

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
    setSelectedExercises(props.exerciseDetails.map(detail => detail.exercise));
  }, [props.exerciseDetails]);

  const filteredExercises = allExercises
    .filter(exercise => 
      selectedUserId ? exercise.author.userId === selectedUserId : true
    )
    .filter(exercise =>
      exercise.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const handleToggleSelection = (exercise: Exercise) => {
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
  };

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
const [exerciseDetails, setExerciseDetails] = useState<any[]>([]);
const [useAuthorContent, setUseAuthorContent] = useState(false);
const [isLoading, setIsLoading] = useState(false);
const router = useRouter();


  // Update the formatWorkoutAndInitializeLogs function
async function formatWorkoutAndInitializeLogs(
  exerciseDetails: ExerciseDetail[],
  workoutAuthor?: string
): Promise<{ workout: Workout; exerciseLogs: ExerciseLog[] }> {
  const workId = workoutService.generateId();
  const exerciseReferences: ExerciseReference[] = [];
  const exerciseLogs: ExerciseLog[] = [];

  // Ensure exercise details are valid before processing
  const validExerciseDetails = exerciseDetails.filter(detail => detail?.exercise && detail.exercise.id);

  validExerciseDetails.forEach((detail, index) => {
    // Ensure exercise instance has all required fields
    const exerciseInstance = new Exercise({
      ...detail.exercise,
      id: detail.exercise.id || workoutService.generateId(),
      name: detail.exercise.name || '',
      author: detail.exercise.author || {
        userId: workoutAuthor || 'PulseAI',
        username: workoutAuthor || 'PulseAI'
      },
      description: detail.exercise.description || '',
      category: detail.exercise.category || { type: 'weightTraining', details: null },
      primaryBodyParts: detail.exercise.primaryBodyParts || [],
      secondaryBodyParts: detail.exercise.secondaryBodyParts || [],
      tags: detail.exercise.tags || [],
      videos: detail.exercise.videos || [],
      createdAt: detail.exercise.createdAt || new Date(),
      updatedAt: detail.exercise.updatedAt || new Date()
    });

    // Create exercise reference with required fields
    const exerciseRef: ExerciseReference = {
      exercise: exerciseInstance,
      groupId: detail.groupId || 0
    };
    exerciseReferences.push(exerciseRef);

    // Set default values for exercise parameters
    const category = detail.category?.type === 'weightTraining' ? detail.category : {
      type: 'weightTraining',
      details: { sets: 3, reps: ['12'], weight: 0, screenTime: 0 }
    };

    const sets = category.details?.sets ?? 3;
    const reps = category.details?.reps ?? ['12'];
    const weight = category.details?.weight ?? 0;

    // Create logs for each set with validated data
    const setsLogs = Array.from({ length: sets }, () => 
      new RepsAndWeightLog({
        reps: parseInt(reps[0] || '12', 10),
        weight: weight || 0
      })
    );

    // Create exercise log with validated data
    const exerciseLogId = exerciseService.generateExerciseLogID(
      workId,
      userService.currentUser?.id || 'anonymous'
    );

    const log = new ExerciseLog({
      id: exerciseLogId,
      workoutId: workId,
      userId: userService.currentUser?.id || 'anonymous',
      exercise: exerciseInstance,
      logs: setsLogs,
      feedback: '',
      note: detail.notes || '',
      isSplit: detail.isSplit || false,
      logSubmitted: false,
      logIsEditing: false,
      isCompleted: false,
      order: index + 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: new Date()
    });
    
    exerciseLogs.push(log);
  });

  // Create workout with validated data
  const newWorkout = new Workout({
    id: workId,
    roundWorkoutId: '',
    exercises: exerciseReferences,
    logs: exerciseLogs,
    title: '',
    description: '',
    duration: Workout.estimatedDuration(exerciseReferences) || 0,
    workoutRating: 'none' as WorkoutRating,
    useAuthorContent: false,
    isCompleted: false,
    workoutStatus: 'archived' as WorkoutStatus,
    author: userService.currentUser?.id || 'PulseAI',
    createdAt: new Date(),
    updatedAt: new Date(),
    zone: Workout.determineWorkoutZone(exerciseReferences) || 'full' as BodyZone
  });

  return { workout: newWorkout, exerciseLogs };
}


  const onCreateStack = async () => {
    if (!userService.currentUser?.id) {
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

    try {
      const { workout, exerciseLogs } = await formatWorkoutAndInitializeLogs(
        exerciseDetails,
        userService.currentUser.id
      );

      // Just update the essential fields
      workout.title = stackName.trim();
      workout.description = description.trim();
      workout.useAuthorContent = useAuthorContent;

      await userService.createStack(workout, exerciseLogs);
      router.push(`/workout/${userService.currentUser.username}/${workout.id}`);
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