import { Challenge } from '../api/firebase/workout/types';
import { ChallengeCard } from './ChallengeCard';
import { StarIcon } from '@heroicons/react/24/outline';


// components/ChallengesTab.tsx
export interface ChallengesTabProps {
    activeChallenges: Challenge[];
    onSelectChallenge: (challenge: Challenge) => void;
  }
  
export const ChallengesTab: React.FC<ChallengesTabProps> = ({
    activeChallenges,
    onSelectChallenge
  }) => {
    if (activeChallenges.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-8">
          <StarIcon className="w-12 h-12 text-white/20" />
          <h3 className="mt-4 text-white font-medium">No active challenges</h3>
        </div>
      );
    }
  
    return (
      <div className="space-y-4 p-4">
        {activeChallenges.map(challenge => (
          <ChallengeCard
            key={challenge.id}
            title={challenge.title}
            description={challenge.subtitle}
            startDate={challenge.startDate}
            endDate={challenge.endDate}
            isPublished={challenge.status === 'published'}
            onSelect={() => onSelectChallenge(challenge)}
          />
        ))}
      </div>
    );
  };
