import React from 'react';
import { Calendar, Clock, Flag, Users, Play } from 'lucide-react';
import { 
  ChallengeInvitationProps, 
} from '../types/ChallengeTypes';
import ChallengeCTA from './ChallengeCTA';

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { 
    month: 'long',
    day: 'numeric'
  });
};

const getDurationInDays = (startDate: Date, endDate: Date): number => {
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

const RoundInvitation: React.FC<ChallengeInvitationProps> = ({ 
  challenge, 
}) => {

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Close Button */}
      {/* <button 
        onClick={onClose}
        className="absolute top-6 left-6 p-2 hover:bg-zinc-800 rounded-full transition-colors"
      >
        <X className="w-6 h-6" />
      </button> */}

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
        <div className="relative bg-black rounded-xl h-48 mb-8 flex items-center justify-center">
          <Play className="w-8 h-8 text-white/90" />
        </div>

        {/* Challenge Details Grid */}
        <div className="grid grid-cols-2 gap-4 mb-12">
          <DetailTile 
            title="Duration" 
            value={`${getDurationInDays(challenge.startDate, challenge.endDate)} Days`}
            icon={<Calendar className="w-6 h-6 text-[#E0FE10]" />}
          />
          <DetailTile 
            title="Start Date" 
            value={formatDate(challenge.startDate)}
            icon={<Clock className="w-6 h-6 text-[#E0FE10]" />}
          />
          <DetailTile 
            title="End Date" 
            value={formatDate(challenge.endDate)}
            icon={<Flag className="w-6 h-6 text-[#E0FE10]" />}
          />
          <DetailTile 
            title="Participants" 
            value={challenge.participants.length}
            icon={<Users className="w-6 h-6 text-[#E0FE10]" />}
          />
        </div>

        {/* Add the new CTA component */}
        <ChallengeCTA challenge={challenge} />
      </div>
    </div>
  );
};

export default RoundInvitation;