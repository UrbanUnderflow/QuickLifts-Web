import React, { useState, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import {
  Exercise,
  ExerciseLog,
  ExerciseDetail,
  ExerciseReference,
} from '../api/firebase/exercise/types';
import { exerciseService } from '../api/firebase/exercise/service';
import { workoutService } from '../api/firebase/workout';
import { userService } from '../api/firebase/user/service';
import {
  WorkoutStatus,
  Workout,
  WorkoutRating,
  BodyZone,
  RepsAndWeightLog,
} from '../api/firebase/workout';

// ------------------------------------------------------------------
// New Component: ExerciseDetailCard
// ------------------------------------------------------------------
interface ExerciseDetailCardProps {
  detail: any; // Replace with your ExerciseDetail type if available.
  onUpdate: (newDetail: any) => void;
}

const ExerciseDetailCard: React.FC<ExerciseDetailCardProps> = ({ detail, onUpdate }) => {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(detail.notes || '');

  const handleSave = () => {
    // Pass the updated detail back to parent.
    onUpdate({ ...detail, notes });
    setExpanded(false);
  };

  return (
    <div className="p-3 mb-2 bg-gray-800 rounded">
      <div className="flex justify-between items-center">
        <h3 className="font-bold">{detail.exerciseName}</h3>
        <button onClick={() => setExpanded(!expanded)} className="text-blue-400">
          {expanded ? 'Collapse' : notes ? 'Edit Details' : 'Add Details'}
        </button>
      </div>
      {expanded && (
        <div className="mt-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-2 bg-gray-700 rounded outline-none"
            placeholder="Enter details here..."
          />
          <button onClick={handleSave} className="mt-2 bg-green-600 px-3 py-1 rounded">
            Save
          </button>
        </div>
      )}
      {!expanded && !notes && (
        <p className="text-sm text-gray-400">Add Details</p>
      )}
      {!expanded && notes && (
        <p className="text-sm text-gray-400">{notes}</p>
      )}
    </div>
  );
};

// ------------------------------------------------------------------
// ExerciseGrid Component with multiSelection support
// ------------------------------------------------------------------
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

  const filteredVideos = userVideos
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .filter((exercise) => {
      const gifUrl = exercise.videos[0]?.gifURL;
      if (seenGifUrls.has(gifUrl || '')) return false;
      seenGifUrls.add(gifUrl || '');
      return true;
    });

  if (filteredVideos.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        No exercises performed yet
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-3 gap-4">
        {filteredVideos.map((exercise) => {
          const isSelected =
            multiSelection &&
            selectedExercises.some((sel) => sel.id === exercise.id);
          return (
            <div
              key={exercise.id}
              onClick={() => {
                if (multiSelection && onToggleSelection) {
                  onToggleSelection(exercise);
                } else {
                  onSelectVideo(exercise);
                }
              }}
              className="relative cursor-pointer"
            >
              <img
                src={exercise.videos[0]?.gifURL}
                alt={exercise.name}
                className="w-full h-24 object-cover rounded"
              />
              {multiSelection && isSelected && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded">
                  <CheckCircle size={32} className="text-white" />
                </div>
              )}
              <p className="mt-2 text-center text-sm text-white">
                {exercise.name}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// MobileStackView Component (Left Panel)
// ------------------------------------------------------------------
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
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="relative h-48 w-full">
        <img
          src="/path/to/header-image.jpg"
          alt="Header"
          className="object-cover w-full h-full"
        />
        <div className="absolute inset-0 bg-black opacity-50" />
        <div className="absolute top-16 left-4">
          <h1 className="text-3xl font-bold">New Stack</h1>
        </div>
      </div>
      {/* Stack Name & Description */}
      <div className="p-4">
        <input
          type="text"
          value={stackName}
          onChange={(e) => setStackName(e.target.value)}
          placeholder="Add Stack Name"
          className="w-full p-3 mb-4 bg-gray-800 rounded outline-none"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Tap to edit Stack description"
          className="w-full p-3 mb-4 bg-gray-800 rounded outline-none h-40"
        />
        {/* Toggle for using author content */}
        <div className="flex items-center mb-4">
          <input
            type="checkbox"
            checked={useAuthorContent}
            onChange={() => setUseAuthorContent(!useAuthorContent)}
            className="mr-2"
          />
          <span>Use my fitness content exclusively for this Stack.</span>
        </div>
        {/* List of Added Moves (using ExerciseDetailCard) */}
        <div>
          {exerciseDetails.map((ex, index) => (
            <ExerciseDetailCard
              key={index}
              detail={ex}
              onUpdate={(newDetail) => {
                const updated = [...exerciseDetails];
                updated[index] = newDetail;
                setExerciseDetails(updated);
              }}
            />
          ))}
        </div>
        {/* Conditionally render Add Move button */}
        {!hideAddMoveButton && (
          <button
            className="w-full py-3 mt-4 bg-blue-600 rounded"
            onClick={() => {
              // Open modal or navigate to add exercise screen
            }}
          >
            Add a Move
          </button>
        )}
      </div>
      {/* Create Stack Button */}
      <div className="p-4">
        <button
          className="w-full py-3 bg-green-600 rounded"
          onClick={onCreateStack}
        >
          Create Stack
        </button>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// DesktopStackView Component
// ------------------------------------------------------------------
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
  const [searchTerm, setSearchTerm] = useState('');
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);

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

  const filteredExercises = allExercises.filter((exercise) =>
    exercise.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleSelection = (exercise: Exercise) => {
    setSelectedExercises((prevSelected) => {
      const alreadySelected = prevSelected.some((ex) => ex.id === exercise.id);
      let updatedSelected: Exercise[];
      if (alreadySelected) {
        updatedSelected = prevSelected.filter((ex) => ex.id !== exercise.id);
        props.setExerciseDetails(
          props.exerciseDetails.filter((ex: any) => ex.exercise.id !== exercise.id)
        );
      } else {
        updatedSelected = [...prevSelected, exercise];
        props.setExerciseDetails([
          ...props.exerciseDetails,
          { exerciseName: exercise.name, notes: '', exercise },
        ]);
      }
      return updatedSelected;
    });
  };

  return (
    <div className="min-h-screen flex w-full">
      {/* Left panel: MobileStackView showing added moves */}
      <div className="flex-1 overflow-y-auto bg-gray-900">
        <MobileStackView {...props} hideAddMoveButton={true} />
      </div>
      {/* Right panel: Search bar and ExerciseGrid with multi-selection */}
      <div className="flex-1 bg-gray-800 p-6 overflow-y-auto flex flex-col">
        <input
          type="text"
          placeholder="Search moves..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 mb-4 bg-gray-700 rounded outline-none"
        />
        <div className="flex-1">
          <ExerciseGrid
            userVideos={filteredExercises}
            multiSelection={true}
            selectedExercises={selectedExercises}
            onToggleSelection={handleToggleSelection}
            onSelectVideo={(exercise: Exercise) => {
              // In multi-selection mode, toggle selection.
              handleToggleSelection(exercise);
            }}
          />
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// CreateStackPage (Parent Component)
// ------------------------------------------------------------------
const CreateStackPage: React.FC = () => {
  const [stackName, setStackName] = useState('');
  const [description, setDescription] = useState('');
  const [exerciseDetails, setExerciseDetails] = useState<any[]>([]);
  const [useAuthorContent, setUseAuthorContent] = useState(false);

  // This function builds a new Workout instance along with its associated ExerciseLog instances.
  async function formatWorkoutAndInitializeLogs(
    exerciseDetails: ExerciseDetail[],
    workoutAuthor?: string
  ): Promise<{ workout: Workout; exerciseLogs: ExerciseLog[] }> {
    const workId = workoutService.generateId();

    const exerciseReferences: ExerciseReference[] = [];
    const exerciseLogs: ExerciseLog[] = [];

    exerciseDetails.forEach((detail, index) => {
      const exerciseRef: ExerciseReference = {
        exercise: detail.exercise,
        groupId: detail.groupId,
      };
      exerciseReferences.push(exerciseRef);

      let sets = 3;
      let reps: string[] = ['12'];
      let weight = 0.0;
      if (detail.category.type === 'weightTraining') {
        sets = detail.category.details?.sets ?? 3;
        reps = detail.category.details?.reps ?? ['12'];
        weight = detail.category.details?.weight ?? 0.0;
      }

      const setsLogs = Array.from({ length: sets }, () =>
        new RepsAndWeightLog({ reps: parseInt(reps[0] || '12', 10), weight })
      );

      const exerciseLogId = exerciseService.generateExerciseLogID(
        workId,
        useAuthorContent ? userService.currentUser?.id || '' : ''
      );

      const dbEx = detail.exercise;
      const exerciseForLog = new Exercise({
        id: dbEx.id,
        name: dbEx.name,
        category: dbEx.category,
        primaryBodyParts: dbEx.primaryBodyParts,
        secondaryBodyParts: dbEx.secondaryBodyParts,
        tags: dbEx.tags,
        description: dbEx.description,
        steps: dbEx.steps,
        videos: dbEx.videos,
        currentVideoPosition: dbEx.currentVideoPosition,
        reps: reps[reps.length - 1] || '12',
        sets: sets,
        weight: weight,
        author: dbEx.author,
        createdAt: dbEx.createdAt,
        updatedAt: dbEx.updatedAt,
      });

      const log = new ExerciseLog({
        id: exerciseLogId,
        workoutId: workId,
        userId: userService.currentUser?.id || '',
        exercise: exerciseForLog,
        logs: setsLogs,
        feedback: '',
        note: detail.notes,
        isSplit: detail.isSplit,
        logSubmitted: false,
        logIsEditing: false,
        isCompleted: false,
        order: index + 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
      });

      exerciseLogs.push(log);
    });

    const newWorkout = new Workout({
      id: workId,
      roundWorkoutId: '',
      exercises: exerciseReferences,
      logs: exerciseLogs,
      title: '',
      description: '',
      duration: 60,
      workoutRating: 'none' as WorkoutRating,
      useAuthorContent: false,
      isCompleted: false,
      workoutStatus: 'archived',
      author: userService.currentUser?.id || 'PulseAI',
      createdAt: new Date(),
      updatedAt: new Date(),
      zone: 'FullBody' as BodyZone,
    });

    return { workout: newWorkout, exerciseLogs };
  }

  const onCreateStack = async () => {
    if (!userService.currentUser?.id) {
      return;
    }
    try {
      const { workout, exerciseLogs } = await formatWorkoutAndInitializeLogs(
        exerciseDetails,
        userService.currentUser?.id
      );
      workout.title = stackName;
      workout.description = description;
      workout.useAuthorContent = useAuthorContent;
      await userService.createStack(workout, exerciseLogs);
      console.log('Stack created successfully');
      // Optionally reset state or navigate away.
    } catch (error) {
      console.error('Error creating stack:', error);
    }
  };

  return (
    <>
      {/* Mobile view */}
      <div className="block lg:hidden">
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
      <div className="hidden lg:flex min-h-screen">
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
    </>
  );
};

export default CreateStackPage;
