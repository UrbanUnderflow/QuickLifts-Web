// Types for user profile image
interface ProfileImage {
    profileImageURL: string;
    thumbnailURL?: string;
  }
  
  // Types for location
  interface UserLocation {
    latitude: number;
    longitude: number;
  }
  
  // Types for pulse points
  interface PulsePoints {
    baseCompletion: number;
    firstCompletion: number;
    streakBonus: number;
    checkInBonus: number;
    effortRating: number;
    chatParticipation: number;
    locationCheckin: number;
    contentEngagement: number;
    encouragementSent: number;
    encouragementReceived: number;
  }
  
  // Types for user in challenge
  interface UserTogetherRound {
    id: string;
    challengeId: string;
    userId: string;
    username: string;
    profileImage?: ProfileImage;
    progress: number;
    completedWorkouts: string[];
    isCompleted: boolean;
    location?: UserLocation;
    city: string;
    country?: string;
    timezone?: string;
    joinDate: Date;
    createdAt: Date;
    updatedAt: Date;
    pulsePoints: PulsePoints;
    currentStreak: number;
    encouragedUsers: string[];
    encouragedByUsers: string[];
    checkIns: Date[];
  }
  
  // Challenge status enum
  enum ChallengeStatus {
    Draft = 'draft',
    Published = 'published',
    Completed = 'completed',
    Cancelled = 'cancelled'
  }
  
  // Main challenge interface
  interface TogetherRound {
    id: string;
    title: string;
    subtitle: string;
    participants: UserTogetherRound[];
    status: ChallengeStatus;
    startDate: Date;
    endDate: Date;
    createdAt: Date;
    updatedAt: Date;
  }
  
  // Props interface for the component
  interface ChallengeInvitationProps {
    challenge: {
      id: string;
      title: string;
      subtitle: string;
      status: string;
      startDate: Date;
      endDate: Date;
      createdAt: Date;
      updatedAt: Date;
      participants: any[]; // Define proper participant type
    };
    onClose: () => void;
    onJoinChallenge: (challenge: any) => Promise<void>;
  }
  
  export type {
    ProfileImage,
    UserLocation,
    PulsePoints,
    UserTogetherRound,
    TogetherRound,
    ChallengeInvitationProps
  };
  
  export { ChallengeStatus };