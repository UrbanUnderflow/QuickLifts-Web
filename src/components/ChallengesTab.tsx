import React, { useState } from 'react';
import { Challenge } from '../api/firebase/workout/types';
import RoundsFilter, { RoundTab, filterChallenges } from './RoundsFilter';
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
    // Default to Active tab to match iOS pattern
    const [selectedTab, setSelectedTab] = useState<RoundTab>(RoundTab.ACTIVE);
    // Default to Host view to match iOS pattern
    const [isAdminView, setIsAdminView] = useState(true);
    const currentUser = useUser();
    const currentUserId = currentUser?.id || '';

    const filteredChallenges = filterChallenges(activeChallenges, selectedTab);

    // Show empty state if no challenges match the current filter
    if (filteredChallenges.length === 0) {
      let emptyMessage = "No challenges found";
      let emptyDescription = "";

      // Customize empty state message based on current tab
      switch (selectedTab) {
        case RoundTab.ACTIVE:
          emptyMessage = isAdminView ? "No Active Rounds" : "No Active Rounds";
          emptyDescription = isAdminView ? "Create your first round to get started!" : "Join a round to track your progress";
          break;
        case RoundTab.DRAFT:
          emptyMessage = "No Draft Rounds";
          emptyDescription = "Create a round and save it as draft to see it here";
          break;
        case RoundTab.COMPLETED:
          emptyMessage = "No Completed Rounds";
          emptyDescription = "Complete rounds will appear here";
          break;
      }

      return (
        <div className="px-5">
          <RoundsFilter
            selectedTab={selectedTab}
            onTabChange={setSelectedTab}
            isAdminView={isAdminView}
            onToggleView={() => setIsAdminView(!isAdminView)}
          />
          
          <div className="flex flex-col items-center justify-center p-8 mt-6">
            <StarIcon className="w-12 h-12 text-white/20" />
            <h3 className="mt-4 text-white font-medium">{emptyMessage}</h3>
            <p className="mt-2 text-zinc-400 text-sm text-center">{emptyDescription}</p>
          </div>
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

        <div className="mt-6 space-y-4">
          {filteredChallenges.map((challenge: Challenge) => (
            <div 
              key={challenge.id}
              onClick={() => onSelectChallenge(challenge)}
              className="bg-zinc-800 rounded-lg p-4 cursor-pointer hover:bg-zinc-700 transition-colors"
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
