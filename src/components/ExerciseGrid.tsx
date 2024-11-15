// ExerciseGrid.tsx
import React from 'react';
import { Exercise } from '../types/Exercise';
import VideoCard from './VideoCard';

interface ExerciseGridProps {
  userVideos: Exercise[];
  onSelectVideo: (exercise: Exercise) => void;
}

const ExerciseGrid: React.FC<ExerciseGridProps> = ({ userVideos, onSelectVideo }) => {
  const seenGifUrls = new Set<string>();

  const filteredVideos = userVideos
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .filter(exercise => {
      const gifUrl = exercise.videos[0]?.gifURL;
      if (seenGifUrls.has(gifUrl || '')) {
        return false;
      }
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
        {filteredVideos.map((exercise) => (
          <VideoCard
            key={exercise.id}
            gifUrl={exercise.videos[0]?.gifURL}
            exerciseName={exercise.name}
            onClick={() => onSelectVideo(exercise)}
          />
        ))}
      </div>
    </div>
  );
};

export default ExerciseGrid;
