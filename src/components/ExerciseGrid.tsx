// ExerciseGrid.tsx
import React, { useEffect, useState } from 'react';
import { Exercise } from '../api/firebase/exercise/types';
import VideoCard from './VideoCard';

interface ExerciseGridProps {
  userVideos: Exercise[];
  onSelectVideo: (exercise: Exercise) => void;
  multiSelection?: boolean;
  selectedExercises: Exercise[];
  onToggleSelection?: (exercise: Exercise) => void;
}

const ExerciseGrid: React.FC<ExerciseGridProps> = ({ userVideos, onSelectVideo, multiSelection, selectedExercises, onToggleSelection }) => {
  const [showAllVideos, setShowAllVideos] = useState(false);
  
  // Log all user videos we receive
  useEffect(() => {
    console.log('[DEBUG-EXERCISE-GRID] Received user videos:', userVideos.length);
    console.log('[DEBUG-EXERCISE-GRID] Video details:', userVideos.map(v => ({
      id: v.id,
      name: v.name,
      videoCount: v.videos.length,
      videos: v.videos.map(vid => ({ id: vid.id, exercise: vid.exercise }))
    })));
    
    // Check for our specific video
    const targetExercise = userVideos.find(ex => 
      ex.videos.some(v => v.id === 'UYpNnfGmw9xyPA6dOv2D')
    );
    
    if (targetExercise) {
      console.log('[DEBUG-EXERCISE-GRID] Found target video in exercise:', targetExercise.name);
    } else {
      console.log('[DEBUG-EXERCISE-GRID] Target video not found in any exercise');
    }
    
  }, [userVideos]);

  const seenGifUrls = new Set<string>();
  const seenVideoIds = new Set<string>();

  // Log filtering process
  console.log('[DEBUG-EXERCISE-GRID] Before filtering:', userVideos.length);

  // Create a more comprehensive filtered list that shows each unique video
  const createFilteredVideos = () => {
    if (showAllVideos) {
      // Create a flattened list of all unique videos
      const allVideos: { exercise: Exercise, videoIndex: number }[] = [];
      
      userVideos.forEach(exercise => {
        exercise.videos.forEach((video, videoIndex) => {
          // Only add if we haven't seen this video ID before
          if (!seenVideoIds.has(video.id)) {
            seenVideoIds.add(video.id);
            allVideos.push({ 
              exercise: new Exercise({
                ...exercise,
                videos: [video] // Only include this specific video
              }), 
              videoIndex 
            });
          }
        });
      });
      
      console.log(`[DEBUG-EXERCISE-GRID] Showing all unique videos: ${allVideos.length}`);
      
      // Sort by date
      return allVideos
        .sort((a, b) => {
          const dateA = new Date(a.exercise.videos[0]?.createdAt || 0);
          const dateB = new Date(b.exercise.videos[0]?.createdAt || 0);
          return dateB.getTime() - dateA.getTime();
        })
        .map(item => item.exercise);
    }
    
    // Regular filtering (original logic)
    return userVideos
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter(exercise => {
        // Log each exercise being processed
        console.log(`[DEBUG-EXERCISE-GRID] Processing exercise: ${exercise.name}, video count: ${exercise.videos.length}, first video ID: ${exercise.videos[0]?.id}`);
        
        // If no GIF URL, still show it
        const gifUrl = exercise.videos[0]?.gifURL;
        if (!gifUrl) {
          console.log(`[DEBUG-EXERCISE-GRID] No GIF URL for exercise: ${exercise.name}, showing anyway`);
          // Allow videos without GIFs to show up
          return true;
        }
        
        // Check if this GIF URL has been seen before
        if (seenGifUrls.has(gifUrl)) {
          console.log(`[DEBUG-EXERCISE-GRID] Duplicate GIF URL for exercise: ${exercise.name}, filtering out`);
          
          // If this is the video we're specifically looking for, log it and show it anyway
          if (exercise.videos.some(v => v.id === 'UYpNnfGmw9xyPA6dOv2D')) {
            console.log(`[DEBUG-EXERCISE-GRID] This is our target video! Showing it anyway`);
            return true;
          }
          
          return false;
        }
        
        seenGifUrls.add(gifUrl);
        console.log(`[DEBUG-EXERCISE-GRID] Adding exercise to filtered list: ${exercise.name}`);
        return true;
      });
  };

  const filteredVideos = createFilteredVideos();
  console.log('[DEBUG-EXERCISE-GRID] After filtering:', filteredVideos.length);

  if (filteredVideos.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>No exercises performed yet</p>
        <p className="mt-2 text-sm">Debug info: Received {userVideos.length} videos before filtering</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <div className="text-sm text-zinc-400">
          Showing {filteredVideos.length} of {userVideos.reduce((total, ex) => total + ex.videos.length, 0)} videos
        </div>
        <button 
          onClick={() => setShowAllVideos(!showAllVideos)}
          className="text-sm bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1 rounded-md"
        >
          {showAllVideos ? 'Group by Exercise' : 'Show All Videos'}
        </button>
      </div>
      
      <div className="p-4">
        <div className="grid grid-cols-3 gap-4">
          {filteredVideos.map((exercise, index) => (
            <VideoCard
              key={`${exercise.id}-${exercise.videos[0]?.id || index}`}
              gifUrl={exercise.videos[0]?.gifURL}
              exerciseName={exercise.name}
              onClick={() => {
                console.log('[DEBUG-EXERCISE-GRID] Clicked on exercise:', exercise.name);
                onSelectVideo(exercise);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ExerciseGrid;
