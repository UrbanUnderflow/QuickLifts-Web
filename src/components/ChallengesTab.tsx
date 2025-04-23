import React, { useState } from 'react';
import { Challenge } from '../api/firebase/workout/types';
import RoundsFilter, { RoundTab, filterChallenges } from './RoundsFilter';
import { userService } from '../api/firebase/user';
import { ChallengeCard } from './ChallengeCard';
import { StarIcon } from '@heroicons/react/24/outline';
import { useUser } from '../hooks/useUser';

// components/ChallengesTab.tsx
export interface ChallengesTabProps {
    activeChallenges: Challenge[];
    onSelectChallenge: (challenge: Challenge) => void;
  }
  
export const ChallengesTab: React.FC<ChallengesTabProps> = ({
    activeChallenges,
    onSelectChallenge
  }) => {
    const [selectedTab, setSelectedTab] = useState<RoundTab>(RoundTab.ALL);
    const [isAdminView, setIsAdminView] = useState(false);
    const currentUser = useUser();
    const currentUserId = currentUser?.id || '';
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const filteredChallenges = filterChallenges(activeChallenges, selectedTab, currentUserId);

    if (filteredChallenges.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-8">
          <StarIcon className="w-12 h-12 text-white/20" />
          <h3 className="mt-4 text-white font-medium">No active challenges</h3>
        </div>
      );
    }
  
    return (
      <div className="px-5">
        <RoundsFilter
          selectedTab={selectedTab}
          onTabChange={setSelectedTab}
          isAdminView={isAdminView}
          onToggleView={() => setIsAdminView(!isAdminView)}
        />

        <div className="mt-6 grid gap-4">
          {filteredChallenges.map((challenge: Challenge) => (
            <div 
              key={challenge.id}
              onClick={() => onSelectChallenge(challenge)}
              className="bg-zinc-800 rounded-lg p-4 cursor-pointer"
            >
              <ChallengeCard
                title={challenge.title}
                description={challenge.subtitle}
                startDate={challenge.startDate}
                endDate={challenge.endDate}
                isPublished={challenge.status === 'published'}
                onSelect={() => onSelectChallenge(challenge)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };
