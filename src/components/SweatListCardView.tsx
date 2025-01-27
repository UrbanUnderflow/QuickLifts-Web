import React, { useEffect } from 'react';
import { ExerciseLog } from '../api/firebase/exercise/types';

interface SweatListCardViewProps {
  key: string;
  log: ExerciseLog;
  gifUrls?: string[];
}

const SweatListCardView: React.FC<SweatListCardViewProps> = ({ log, gifUrls = [] }) => {
  useEffect(() => {
    console.log('Exercise Log:', log);
  console.log('Exercise name:', log.exercise?.name);
  console.log('Sets:', log.exercise?.sets);
  console.log('Reps:', log.exercise?.reps);
  console.log('Videos length:', log.exercise?.videos?.length ?? 0);
  console.log('Current video position:', log.exercise?.currentVideoPosition);

  const currentVideo = log.exercise?.videos?.[log.exercise.currentVideoPosition || 0];
  if (currentVideo) {
    console.log('Current video URL:', currentVideo.videoURL);
  } else {
    console.log('No video available at current position');
  }

    // Log all video URLs for this exercise
    log.exercise?.videos?.forEach((video, index) => {
      console.log(`Video ${index} URL:`, video.videoURL);
    });
  }, [log]);

  const videoUrl = log.exercise?.videos && log.exercise.videos.length > 0
  ? log.exercise.videos[log.exercise.currentVideoPosition || 0]?.videoURL
  : undefined;

  return (
  <div className="flex bg-black-800 bg-opacity-50 rounded-lg h-24 mb-4 overflow-hidden">
    {log.exercise?.videos?.length && videoUrl ? (
      <div className="relative w-24 h-24 overflow-hidden">
        <video
          src={videoUrl}
          className="object-cover w-full h-full"
          muted
          autoPlay
          loop
        />
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-black/60 to-transparent" />
      </div>
    ) : (
      <div className="w-24 h-24 bg-gray-600 flex items-center justify-center">
        <span className="text-white text-xs">No video</span>
      </div>
    )}
    <div className="flex flex-col justify-center ml-4 flex-grow">
      <h3 className="text-lg font-bold text-white">{log.exercise?.name || 'Unknown Exercise'}</h3>
      <p className="text-sm text-[#E0FE10]">
        {`${log.exercise?.sets || 0} sets x ${log.exercise?.reps === "0" ? 12 : (log.exercise?.reps || 12)} reps`}
      </p>
    </div>
  </div>
);
};

export default SweatListCardView;