import { Challenge, 
        UserChallenge,
        ChallengeStatus,
       } from './ChallengeTypes';

import { SweatlistIdentifiers } from './SweatlistIdentifiers';

// Enum for sweatlist type matching Swift implementation
export enum SweatlistType {
  Together = 'together',
  Solo = 'solo',
  Locked = 'locked'
}

// Main SweatlistCollection interface
export interface SweatlistCollection {
  id: string;
  title: string;
  subtitle: string;
  challenge?: Challenge;  // Optional challenge
  publishedStatus?: boolean;  // Computed property based on challenge status
  participants: string[];
  sweatlistIds: SweatlistIdentifiers[];
  ownerId: string;
  privacy: SweatlistType;
  createdAt: Date;
  updatedAt: Date;
}

// Helper function to convert Firestore data to SweatlistCollection
export function convertToSweatlistCollection(id: string, data: any): SweatlistCollection {
  return {
    id,
    title: data.title || '',
    subtitle: data.subtitle || '',
    challenge: data.challenge ? convertToTogetherRound(data.challenge) : undefined,
    sweatlistIds: (data.sweatlistIds || []).map((item: any) => ({
      id: item.id || '',
      sweatlistAuthorId: item.sweatlistAuthorId || '',
      order: item.order || 0,
    })),
    ownerId: data.ownerId || '',
    // Set privacy based on challenge presence, matching Swift logic
    privacy: data.challenge ? SweatlistType.Together : SweatlistType.Solo,
    participants: (data.participants || []).map((participant: any) => participant || ''), // Include participants
    createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
  };
}

// Helper function to convert SweatlistCollection to Firestore data
export function convertToFirestore(collection: SweatlistCollection): any {
  return {
    id: collection.id,
    title: collection.title,
    subtitle: collection.subtitle,
    challenge: collection.challenge ? convertChallengeToFirestore(collection.challenge) : null,
    sweatlistIds: collection.sweatlistIds.map(item => ({
      id: item.id,
      sweatlistAuthorId: item.sweatlistAuthorId,
      order: item.order
    })),
    ownerId: collection.ownerId,
    privacy: collection.privacy,
    createdAt: collection.createdAt.getTime(),
    updatedAt: collection.updatedAt.getTime()
  };
}

// Helper function to match Swift's REST dictionary conversion
export function convertToRESTDictionary(collection: SweatlistCollection): any {
  return {
    fields: {
      id: { stringValue: collection.id },
      title: { stringValue: collection.title },
      subtitle: { stringValue: collection.subtitle },
      ownerId: { stringValue: collection.ownerId },
      sweatlistIds: {
        arrayValue: {
          values: collection.sweatlistIds.map(item => ({
            mapValue: {
              fields: {
                id: { stringValue: item.id },
                sweatlistAuthorId: { stringValue: item.sweatlistAuthorId },
                order: { integerValue: item.order }
              }
            }
          }))
        }
      },
      createdAt: { doubleValue: collection.createdAt.getTime() },
      updatedAt: { doubleValue: collection.updatedAt.getTime() }
    }
  };
}

// Utility function to check if a collection is published
export function isCollectionPublished(collection: SweatlistCollection): boolean {
  if (!collection.challenge) return false;
  return collection.challenge.status === ChallengeStatus.Published;
}

// Convert Firestore data to TogetherRound
export function convertToTogetherRound(data: any): Challenge {
  return new Challenge({
    id: data.id || '',
    title: data.title || '',
    subtitle: data.subtitle || '',
    participants: Array.isArray(data.participants) 
      ? data.participants.map((p: any) => convertToUserTogetherRound(p))
      : [],
    status: data.status as ChallengeStatus || ChallengeStatus.Draft,
    startDate: data.startDate ? new Date(data.startDate) : new Date(),
    endDate: data.endDate ? new Date(data.endDate) : new Date(),
    createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
    introVideoURL: data.introVideoURL || undefined,
  });
}

// Convert TogetherRound to Firestore format
export function convertChallengeToFirestore(challenge: Challenge): any {
  return {
    id: challenge.id,
    title: challenge.title,
    subtitle: challenge.subtitle,
    participants: challenge.participants.map(participant => ({
      id: participant.id,
      challengeId: participant.challengeId,
      userId: participant.userId,
      username: participant.username,
      profileImage: participant.profileImage ? {
        profileImageURL: participant.profileImage.profileImageURL,
        thumbnailURL: participant.profileImage.thumbnailURL
      } : null,
      progress: participant.progress,
      completedWorkouts: participant.completedWorkouts,
      isCompleted: participant.isCompleted,
      location: participant.location ? {
        latitude: participant.location.latitude,
        longitude: participant.location.longitude
      } : null,
      city: participant.city,
      country: participant.country,
      timezone: participant.timezone,
      joinDate: participant.joinDate.getTime(),
      createdAt: participant.createdAt.getTime(),
      updatedAt: participant.updatedAt.getTime(),
      pulsePoints: {
        baseCompletion: participant.pulsePoints.baseCompletion,
        firstCompletion: participant.pulsePoints.firstCompletion,
        streakBonus: participant.pulsePoints.streakBonus,
        checkInBonus: participant.pulsePoints.checkInBonus,
        effortRating: participant.pulsePoints.effortRating,
        chatParticipation: participant.pulsePoints.chatParticipation,
        locationCheckin: participant.pulsePoints.locationCheckin,
        contentEngagement: participant.pulsePoints.contentEngagement,
        encouragementSent: participant.pulsePoints.encouragementSent,
        encouragementReceived: participant.pulsePoints.encouragementReceived
      },
      currentStreak: participant.currentStreak,
      encouragedUsers: participant.encouragedUsers,
      encouragedByUsers: participant.encouragedByUsers,
      checkIns: participant.checkIns.map(date => date.getTime())
    })),
    status: challenge.status,
    startDate: challenge.startDate.getTime(),
    endDate: challenge.endDate.getTime(),
    createdAt: challenge.createdAt.getTime(),
    updatedAt: challenge.updatedAt.getTime()
  };
}

// Helper function to convert Firestore data to UserTogetherRound
function convertToUserTogetherRound(data: any): UserChallenge {
  return {
    id: data.id || '',
    challengeId: data.challengeId || '',
    userId: data.userId || '',
    username: data.username || '',
    profileImage: data.profileImage ? {
      profileImageURL: data.profileImage.profileImageURL,
      thumbnailURL: data.profileImage.thumbnailURL
    } : undefined,
    progress: data.progress || 0,
    completedWorkouts: data.completedWorkouts || [],
    isCompleted: data.isCompleted || false,
    location: data.location ? {
      latitude: data.location.latitude,
      longitude: data.location.longitude
    } : undefined,
    city: data.city || '',
    country: data.country,
    timezone: data.timezone,
    joinDate: new Date(data.joinDate),
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
    pulsePoints: {
      baseCompletion: data.pulsePoints?.baseCompletion || 0,
      firstCompletion: data.pulsePoints?.firstCompletion || 0,
      streakBonus: data.pulsePoints?.streakBonus || 0,
      checkInBonus: data.pulsePoints?.checkInBonus || 0,
      effortRating: data.pulsePoints?.effortRating || 0,
      chatParticipation: data.pulsePoints?.chatParticipation || 0,
      locationCheckin: data.pulsePoints?.locationCheckin || 0,
      contentEngagement: data.pulsePoints?.contentEngagement || 0,
      encouragementSent: data.pulsePoints?.encouragementSent || 0,
      encouragementReceived: data.pulsePoints?.encouragementReceived || 0
    },
    currentStreak: data.currentStreak || 0,
    encouragedUsers: data.encouragedUsers || [],
    encouragedByUsers: data.encouragedByUsers || [],
    checkIns: (data.checkIns || []).map((timestamp: number) => new Date(timestamp))
  };
}