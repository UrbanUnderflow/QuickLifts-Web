import React from 'react';
import { UserChallenge } from '../../api/firebase/workout/types';
import { Trophy, User } from 'lucide-react';

interface ParticipantsSectionProps {
  participants: UserChallenge[];
  onParticipantClick?: (participant: UserChallenge) => void;
}

const ParticipantsSection: React.FC<ParticipantsSectionProps> = ({
  participants,
  onParticipantClick
}) => {
  const [previousRanks, setPreviousRanks] = React.useState<number[]>([]);
  const [showAllParticipants, setShowAllParticipants] = React.useState<boolean>(false);

  // Sort participants by total points
  const sortedParticipants = [...participants].sort(
    (a, b) => getTotalPoints(b) - getTotalPoints(a)
  );

  function getTotalPoints(participant: UserChallenge): number {
    const points = participant.pulsePoints;
    return (
      points.baseCompletion +
      points.firstCompletion +
      points.streakBonus +
      points.checkInBonus +
      points.effortRating +
      points.chatParticipation +
      points.locationCheckin +
      points.contentEngagement +
      points.encouragementSent +
      points.encouragementReceived
    );
  }

  React.useEffect(() => {
    setPreviousRanks(sortedParticipants.map((_, index) => index + 1));
  }, [participants.length]);

  const toggleShowAll = () => {
    setShowAllParticipants((prev) => !prev);
  };

  // Show only the top 5 participants by default
  const displayedParticipants = showAllParticipants ? sortedParticipants : sortedParticipants.slice(0, 5);

  return (
    <div className="bg-zinc-800 rounded-xl p-6 mt-6">
      <h2 className="text-lg font-semibold text-white mb-4">Participants</h2>

      <div className="space-y-4">
        {displayedParticipants.map((participant, index) => (
          <div
            key={participant.id}
            onClick={() => onParticipantClick?.(participant)}
            className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg cursor-pointer hover:bg-zinc-800 transition-colors"
          >
            <div className="flex items-center space-x-4">
              {/* Rank & Medal */}
              <div className="flex items-center justify-center w-8">
                {index < 3 ? (
                  <Trophy 
                    className={
                      index === 0 ? "text-yellow-500" :
                      index === 1 ? "text-gray-400" :
                      "text-amber-600"
                    }
                    size={20}
                  />
                ) : (
                  <span className="text-zinc-400">#{index + 1}</span>
                )}
              </div>

              {/* Profile Image or Placeholder */}
              {participant.profileImage?.profileImageURL ? (
                <img
                  src={participant.profileImage.profileImageURL}
                  alt={participant.username}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center">
                  <User className="text-zinc-400" size={20} />
                </div>
              )}

              {/* User Info */}
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-white font-medium">{participant.username}</span>
                </div>
              </div>
            </div>

            {/* Points & Streak */}
            <div className="text-right">
              <div className="text-white font-medium">{getTotalPoints(participant)} pts</div>
              <div className="text-sm text-zinc-400">
                🔥 {participant.currentStreak} day streak
              </div>
            </div>
          </div>
        ))}
      </div>

      {participants.length > 5 && (
        <button
          onClick={toggleShowAll}
          className="mt-4 text-sm text-[#E0FE10] hover:text-gray-400"
        >
          {showAllParticipants ? 'Show less' : `Show all (${participants.length})`}
        </button>
      )}
    </div>
  );
};

export default ParticipantsSection;
