import React from 'react';
import { Challenge, ChallengeStatus, SweatlistCollection, SweatlistType } from '../api/firebase/workout/types';
import { UserTogetherRoundCollection } from '../types/UserTogetherRoundCollection';

export enum RoundTab {
  ALL = 'All',
  TOGETHER = 'Together',
  PRIVATE = 'Private',
  DRAFT = 'Draft',
  COMPLETED = 'Completed',
}

type TabIconProps = {
  tab: RoundTab;
  isSelected: boolean;
};

// Icon component for each tab
const TabIcon: React.FC<TabIconProps> = ({ tab, isSelected }) => {
  const color = isSelected ? "#E0FE10" : "#FFFFFF";
  
  switch (tab) {
    case RoundTab.ALL:
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 6H20M4 12H20M4 18H20" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case RoundTab.TOGETHER:
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 20H22V18C22 16.3431 20.6569 15 19 15C18.0444 15 17.1931 15.4468 16.6438 16.1429M17 20H7M17 20V18C17 17.3 16.8993 16.6311 16.6438 16.1429M7 20H2V18C2 16.3431 3.34315 15 5 15C5.95561 15 6.80686 15.4468 7.35625 16.1429M7 20V18C7 17.3 7.10074 16.6311 7.35625 16.1429M7.35625 16.1429C8.0935 14.301 9.89482 13 12 13C14.1052 13 15.9065 14.301 16.6438 16.1429M15 7C15 8.65685 13.6569 10 12 10C10.3431 10 9 8.65685 9 7C9 5.34315 10.3431 4 12 4C13.6569 4 15 5.34315 15 7ZM21 10C21 11.1046 20.1046 12 19 12C17.8954 12 17 11.1046 17 10C17 8.89543 17.8954 8 19 8C20.1046 8 21 8.89543 21 10ZM7 10C7 11.1046 6.10457 12 5 12C3.89543 12 3 11.1046 3 10C3 8.89543 3.89543 8 5 8C6.10457 8 7 8.89543 7 10Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case RoundTab.PRIVATE:
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 8V6C16 3.79086 14.2091 2 12 2C9.79086 2 8 3.79086 8 6V8M7 13L12 18L17 13M12 18V12" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M5 10H19C20.1046 10 21 10.8954 21 12V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V12C3 10.8954 3.89543 10 5 10Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case RoundTab.DRAFT:
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5M12 12H15M12 16H15M9 12H9.01M9 16H9.01" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case RoundTab.COMPLETED:
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    default:
      return null;
  }
};

interface RoundsFilterProps {
  selectedTab: RoundTab;
  onTabChange: (tab: RoundTab) => void;
  isAdminView: boolean;
  onToggleView: () => void;
}

const RoundsFilter: React.FC<RoundsFilterProps> = ({ 
  selectedTab, 
  onTabChange, 
  isAdminView, 
  onToggleView 
}) => {
  return (
    <div className="flex flex-col space-y-4">
      {/* Admin/Participant toggle */}
      <div className="flex justify-center items-center space-x-4">
        <button
          onClick={() => onToggleView()}
          className={`text-sm font-medium transition-colors ${isAdminView ? 'text-[#E0FE10] font-bold' : 'text-zinc-400'}`}
        >
          Admin
        </button>
        
        <div className="w-1 h-1 bg-zinc-600 rounded-full"></div>
        
        <button
          onClick={() => onToggleView()}
          className={`text-sm font-medium transition-colors ${!isAdminView ? 'text-[#E0FE10] font-bold' : 'text-zinc-400'}`}
        >
          Participant
        </button>
      </div>
      
      {/* Tab filters */}
      <div className="bg-zinc-800 rounded-lg grid grid-cols-5 w-full">
        {Object.values(RoundTab).map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`py-3 flex flex-col items-center justify-center space-y-2 transition-colors ${
              selectedTab === tab ? 'bg-[#E0FE10]/10' : ''
            }`}
          >
            <TabIcon tab={tab} isSelected={selectedTab === tab} />
            <span className={`text-xs ${selectedTab === tab ? 'text-[#E0FE10]' : 'text-zinc-400'}`}>
              {tab}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

// Helper functions for filtering rounds
export const filterRounds = (
  rounds: SweatlistCollection[], 
  tab: RoundTab,
  currentUserId: string
): SweatlistCollection[] => {
  const now = new Date();
  
  switch (tab) {
    case RoundTab.ALL:
      return rounds;
      
    case RoundTab.TOGETHER:
      return rounds.filter(round => 
        (round.challenge?.status === ChallengeStatus.Published) && 
        !!round.pin // Private rounds have a pin
      );
      
    case RoundTab.PRIVATE:
      return rounds.filter(round => 
        (round.challenge?.status === ChallengeStatus.Published) && 
        round.pin // Private rounds have a pin
      );
      
    case RoundTab.DRAFT:
      return rounds.filter(round => 
        round.challenge?.status === 'draft'
      );
      
    case RoundTab.COMPLETED:
      return rounds.filter(round => 
        (round.challenge?.endDate ?? new Date(0)) < now && 
        round.challenge?.status !== 'draft'
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
    case RoundTab.ALL:
      return userRounds;
      
    case RoundTab.TOGETHER:
      return userRounds.filter(userRound => 
        (userRound.collection.challenge?.status === ChallengeStatus.Published) && 
        !userRound.collection.pin
      );
      
    case RoundTab.PRIVATE:
      return userRounds.filter(userRound => 
        (userRound.collection.challenge?.status === ChallengeStatus.Published) && 
        !!userRound.collection.pin
      );
      
    case RoundTab.DRAFT:
      return userRounds.filter(userRound => 
        userRound.collection.challenge?.status === 'draft'
      );
      
    case RoundTab.COMPLETED:
      return userRounds.filter(userRound => 
        userRound.collection.challenge?.endDate && 
        userRound.collection.challenge.endDate < now && 
        userRound.collection.challenge.status !== 'draft'
      );
      
    default:
      return userRounds;
  }
};

export const filterChallenges = (
  challenges: Challenge[], 
  tab: RoundTab,
  currentUserId: string
): Challenge[] => {
  const now = new Date();
  
  switch (tab) {
    case RoundTab.ALL:
      return challenges;
      
    case RoundTab.TOGETHER:
      return challenges.filter(challenge => 
        challenge.status === ChallengeStatus.Published && 
        challenge.privacy == SweatlistType.Together
      );
      
    case RoundTab.PRIVATE:
      return challenges.filter(challenge => 
        challenge.status === ChallengeStatus.Published && 
        challenge.privacy == SweatlistType.Locked
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