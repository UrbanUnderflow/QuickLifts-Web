import { CheckCircle } from 'lucide-react';
import {
    Exercise,
  } from '../../../api/firebase/exercise/types';

// ExerciseGrid Component
interface ExerciseGridProps {
  userVideos: Exercise[];
  onSelectVideo: (exercise: Exercise) => void;
  multiSelection?: boolean;
  selectedExercises?: Exercise[];
  onToggleSelection?: (exercise: Exercise) => void;
}

export const ExerciseGrid: React.FC<ExerciseGridProps> = ({
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