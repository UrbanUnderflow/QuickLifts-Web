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
interface UserChallenge {
  id: string;
  challenge?: Challenge;
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

class Challenge {
  id: string;
  title: string;
  subtitle: string;
  participants: UserChallenge[];
  durationInDays: number;
  status: ChallengeStatus;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
  introVideoURL?: string;

  constructor(data: {
    id: string;
    title: string;
    subtitle: string;
    participants: UserChallenge[];
    status: ChallengeStatus;
    startDate: Date;
    endDate: Date;
    createdAt: Date;
    updatedAt: Date;
    introVideoURL?: string;
  }) {
    this.id = data.id;
    this.title = data.title;
    this.subtitle = data.subtitle;
    this.participants = data.participants;
    this.status = data.status;
    this.startDate = data.startDate;
    this.endDate = data.endDate;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.introVideoURL = data.introVideoURL;
    this.durationInDays = this.calculateDurationInDays();
  }

  /**
   * Calculates the duration in days between the startDate and endDate.
   * @returns The number of days between the two dates.
   */
  private calculateDurationInDays(): number {
    // Convert dates to timestamps using valueOf()
    const start = this.startDate?.valueOf();
    const end = this.endDate?.valueOf();

    // Ensure converted dates are valid
    if (!start || !end || isNaN(start) || isNaN(end)) {
      throw new Error('Invalid startDate or endDate');
    }

    // Calculate the difference in milliseconds and convert to days
    const durationInMilliseconds = end - start;
    return Math.ceil(durationInMilliseconds / (1000 * 60 * 60 * 24));
  }
}

// Props interface for the component
interface ChallengeInvitationProps {
  challenge: Challenge;
  onClose: () => void;
  onJoinChallenge: (challenge: any) => Promise<void>;
}

export type {
  ProfileImage,
  UserLocation,
  PulsePoints,
  UserChallenge,
  ChallengeInvitationProps
};

export { ChallengeStatus, Challenge };
