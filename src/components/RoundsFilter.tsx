import React from 'react';
import { Challenge, ChallengeStatus, SweatlistCollection } from '../api/firebase/workout/types';
import { UserTogetherRoundCollection } from '../types/UserTogetherRoundCollection';

// Simplified enum to match iOS structure
export enum RoundTab {
  ACTIVE = 'Active',
  DRAFT = 'Draft', 
  COMPLETED = 'Completed',
}

interface TabIconProps {
  tab: RoundTab;
  isSelected: boolean;
}

interface RoundsFilterProps {
  selectedTab: RoundTab;
  onTabChange: (tab: RoundTab) => void;
  isAdminView: boolean;
  onToggleView: () => void;
}

// Icon component for each tab - simplified to match iOS
const TabIcon: React.FC<TabIconProps> = ({ tab, isSelected }) => {
  const color = isSelected ? "#E0FE10" : "#9CA3AF";
  
  switch (tab) {
    case RoundTab.ACTIVE:
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 5V19L19 12L8 5Z" fill={color} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case RoundTab.DRAFT:
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L15.09 8.26L22 9L17 14L18.18 21L12 17.77L5.82 21L7 14L2 9L8.91 8.26L12 2Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case RoundTab.COMPLETED:
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 6L9 17L4 12" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    default:
      return null;
  }
};

const RoundsFilter: React.FC<RoundsFilterProps> = ({ 
  selectedTab, 
  onTabChange, 
  isAdminView, 
  onToggleView 
}) => {
  // Only show Draft tab if user is in Admin/Host view
  const visibleTabs = isAdminView 
    ? [RoundTab.ACTIVE, RoundTab.DRAFT, RoundTab.COMPLETED]
    : [RoundTab.ACTIVE, RoundTab.COMPLETED];

  return (
    <div className="flex flex-col space-y-4">
      {/* Host/Participant toggle - styled to match iOS */}
      <div className="flex justify-center items-center space-x-4">
        <button
          onClick={() => onToggleView()}
          className={`text-sm font-medium transition-colors ${
            isAdminView ? 'text-[#E0FE10] font-semibold' : 'text-zinc-400'
          }`}
        >
          Host
        </button>
        
        <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full opacity-30"></div>
        
        <button
          onClick={() => onToggleView()}
          className={`text-sm font-medium transition-colors ${
            !isAdminView ? 'text-[#E0FE10] font-semibold' : 'text-zinc-400'
          }`}
        >
          Participant
        </button>
      </div>
      
      {/* Simplified tab filters - styled to match iOS design */}
      <div className="bg-zinc-800 rounded-lg overflow-hidden">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, 1fr)` }}>
          {visibleTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`py-3 px-4 flex flex-col items-center justify-center space-y-2 transition-all duration-200 ${
                selectedTab === tab 
                  ? 'bg-[#E0FE10]/10' 
                  : 'hover:bg-zinc-700/50'
              }`}
            >
              <TabIcon tab={tab} isSelected={selectedTab === tab} />
              <span className={`text-xs font-medium ${
                selectedTab === tab ? 'text-[#E0FE10]' : 'text-zinc-400'
              }`}>
                {tab}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Updated helper functions for simplified filtering
export const filterRounds = (
  rounds: SweatlistCollection[], 
  tab: RoundTab
): SweatlistCollection[] => {
  const now = new Date();
  
  switch (tab) {
    case RoundTab.ACTIVE:
      return rounds.filter(round => 
        (round.challenge?.status === ChallengeStatus.Published || 
         round.challenge?.status === ChallengeStatus.Active) && 
        (round.challenge?.endDate ?? new Date(0)) > now
      );
      
    case RoundTab.DRAFT:
      return rounds.filter(round => 
        round.challenge?.status === ChallengeStatus.Draft
      );
      
    case RoundTab.COMPLETED:
      return rounds.filter(round => 
        (round.challenge?.endDate ?? new Date(0)) < now && 
        round.challenge?.status !== ChallengeStatus.Draft
      );
      
    default:
      return rounds;
  }
};

export const filterUserRounds = (
  userRounds: UserTogetherRoundCollection[],
  tab: RoundTab
): UserTogetherRoundCollection[] => {
  const now = new Date();
  
  switch (tab) {
    case RoundTab.ACTIVE:
      return userRounds.filter(userRound => 
        (userRound.collection.challenge?.status === ChallengeStatus.Published ||
         userRound.collection.challenge?.status === ChallengeStatus.Active) &&
        userRound.collection.challenge?.endDate && 
        userRound.collection.challenge.endDate > now && 
        !userRound.isCompleted
      );
      
    case RoundTab.DRAFT:
      return userRounds.filter(userRound => 
        userRound.collection.challenge?.status === ChallengeStatus.Draft
      );
      
    case RoundTab.COMPLETED:
      return userRounds.filter(userRound => 
        (userRound.collection.challenge?.endDate && 
         userRound.collection.challenge.endDate < now) || 
        userRound.isCompleted
      );
      
    default:
      return userRounds;
  }
};

export const filterChallenges = (
  challenges: Challenge[], 
  tab: RoundTab
): Challenge[] => {
  const now = new Date();
  
  switch (tab) {
    case RoundTab.ACTIVE:
      return challenges.filter(challenge => 
        (challenge.status === ChallengeStatus.Published || 
         challenge.status === ChallengeStatus.Active) && 
        challenge.endDate > now
      );
      
    case RoundTab.DRAFT:
      return challenges.filter(challenge => 
        challenge.status === ChallengeStatus.Draft
      );
      
    case RoundTab.COMPLETED:
      return challenges.filter(challenge => 
        challenge.endDate < now && 
        challenge.status !== ChallengeStatus.Draft
      );
      
    default:
      return challenges;
  }
};

export default RoundsFilter;