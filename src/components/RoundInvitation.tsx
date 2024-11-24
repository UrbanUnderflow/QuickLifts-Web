import React, { useState } from 'react';
import { Calendar, Clock, Flag, Users, Play } from 'lucide-react';
import { ChallengeInvitationProps } from '../types/ChallengeTypes';
import ChallengeCTA from './ChallengeCTA';

const formatDate = (dateString: string | Date): string => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString('en-US', { 
    month: 'long',
    day: 'numeric'
  });
};

const getDurationInDays = (startDateString: string | Date, endDateString: string | Date): number => {
  const startDate = typeof startDateString === 'string' ? new Date(startDateString) : startDateString;
  const endDate = typeof endDateString === 'string' ? new Date(endDateString) : endDateString;
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

interface DetailTileProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}

const DetailTile: React.FC<DetailTileProps> = ({ title, value, icon }) => (
  <div className="flex-1 p-4 bg-zinc-900 rounded-xl">
    <div className="flex flex-col items-center gap-2">
      {icon}
      <div className="flex flex-col items-center">
        <span className="text-lg font-semibold text-white">{value}</span>
        <span className="text-sm text-white/70">{title}</span>
      </div>
    </div>
  </div>
);

const VideoPreview: React.FC<{ videoUrl?: string }> = ({ videoUrl }) => {
    const [isPlaying, setIsPlaying] = useState(false);
  
    if (!videoUrl) {
      return (
        <div className="relative bg-black rounded-xl h-48 mb-8 flex items-center justify-center">
          <Play className="w-8 h-8 text-white/90" />
        </div>
      );
    }
  
    return (
      <div className="relative bg-black rounded-xl h-48 mb-8 overflow-hidden">
        <video
          className="w-full h-full object-cover"
          src={videoUrl}
          controls={isPlaying}
          playsInline
          poster={!isPlaying ? undefined : ''}
        >
          Your browser does not support the video tag.
        </video>
        {!isPlaying && (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 cursor-pointer"
            onClick={() => {
              setIsPlaying(true);
              const videoElement = document.querySelector('video');
              if (videoElement) {
                videoElement.play();
              }
            }}
          >
            <Play className="w-8 h-8 text-white/90" />
          </div>
        )}
      </div>
    );
  };

const RoundInvitation: React.FC<ChallengeInvitationProps> = ({ challenge }) => {
  // Ensure we have valid Date objects
  const startDate = new Date(challenge.startDate);
  const endDate = new Date(challenge.endDate);
  
  // Ensure participants is always an array
  const participantsCount = challenge.participants?.length ?? 0;

  console.log('Challenge data:', challenge); // Add this for debugging

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header Section */}
        <div className="text-center space-y-4 mb-8">
          <h2 className="text-lg font-semibold text-white/90">
            You're invited to participate in this Round 🎉
          </h2>
          <h1 className="text-3xl font-bold">{challenge.title}</h1>
          <p className="text-white/70">{challenge.subtitle}</p>
        </div>

        {/* Video Preview */}
        <VideoPreview videoUrl={challenge.introVideoURL} />

        {/* Challenge Details Grid */}
        <div className="grid grid-cols-2 gap-4 mb-12">
          <DetailTile 
            title="Duration" 
            value={`${getDurationInDays(startDate, endDate)} Days`}
            icon={<Calendar className="w-6 h-6 text-[#E0FE10]" />}
          />
          <DetailTile 
            title="Start Date" 
            value={formatDate(startDate)}
            icon={<Clock className="w-6 h-6 text-[#E0FE10]" />}
          />
          <DetailTile 
            title="End Date" 
            value={formatDate(endDate)}
            icon={<Flag className="w-6 h-6 text-[#E0FE10]" />}
          />
          <DetailTile 
            title="Participants" 
            value={participantsCount}
            icon={<Users className="w-6 h-6 text-[#E0FE10]" />}
          />
        </div>

        {/* Add the CTA component */}
        <ChallengeCTA challenge={challenge} />
      </div>
    </div>
  );
};

export default RoundInvitation;