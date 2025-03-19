// components/FullScreenExerciseView.tsx
import React from 'react';
import { Exercise } from '../api/firebase/exercise/types';  
import { User } from '../api/firebase/user';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';

interface FullScreenExerciseViewProps {
  exercise: Exercise;
  user?: User;
  onBack: () => void;
  onProfileClick: () => void;
}

const FullScreenExerciseView: React.FC<FullScreenExerciseViewProps> = ({
  exercise,
  user,
  onBack,
  onProfileClick,
}) => {
  const [showFullCaption, setShowFullCaption] = React.useState(false);
  const [defaultImage, setDefaultImage] = React.useState(false);
  const currentVideo = exercise?.videos?.[0] || null; // Safe check

  if (!exercise || !exercise.videos || exercise.videos.length === 0) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center text-white">
        No video available
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Background Video */}
      <video
        src={currentVideo?.videoURL}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        loop
        muted
        playsInline
      />

      {/* Overlay Content */}
      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div className="pt-12 px-4">
          <button onClick={onBack} className="text-white p-2">
            <ChevronLeftIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom Content */}
        <div className="p-4 bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex space-x-2">
            {/* Profile Image */}
            <button onClick={onProfileClick} className="relative flex-shrink-0">
              {defaultImage ? (
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                  <img src="/profile-image.svg" alt="default profile" className="w-6 h-6" />
                </div>
              ) : (
                <img
                  src={user?.profileImage?.profileImageURL}
                  alt={user?.username}
                  className="w-10 h-10 rounded-full border-2 border-[#E0FE10]"
                  onError={() => setDefaultImage(true)}
                />
              )}
            </button>

            {/* Exercise Info */}
            <div className="flex-1" onClick={() => setShowFullCaption(!showFullCaption)}>
              <div className="text-white">
                <span className="font-bold">{exercise.name}</span>
                {" - "}
                <span>{currentVideo?.caption || exercise.description}</span>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mt-2">
                {exercise.primaryBodyParts.slice(0, 3).map((bodyPart) => (
                  <span key={bodyPart} className="px-2 py-1 bg-white/10 rounded-full text-xs text-white">
                    {bodyPart}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


export default FullScreenExerciseView;