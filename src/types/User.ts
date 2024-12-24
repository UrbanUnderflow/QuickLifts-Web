// types/User.ts
import { BodyWeight } from './BodyWeight';
import { ProfileImage } from '../api/firebase/user/types';

export class User {
  id: string;
  displayName: string;
  email: string;
  username: string;
  bio?: string;
  profileImage: ProfileImage;
  followerCount: number;
  followingCount: number;
  bodyWeight: BodyWeight[];
  workoutCount: number;
  creator?: {
    type?: string[];
    instagramHandle?: string;
    twitterHandle?: string;
    youtubeUrl?: string;
    acceptCodeOfConduct?: boolean;
    acceptExecutiveTerms?: boolean;
    acceptGeneralTerms?: boolean;
    acceptSweatEquityPartnership?: boolean;
    onboardingStatus?: string;
    onboardingLink?: string;
    onboardingExpirationDate?: number;
  };
  createdAt: Date;
  updatedAt: Date;

  constructor(data: any) {
    this.id = data.id || '';
    this.displayName = data.displayName || '';
    this.email = data.email || '';
    this.username = data.username || '';
    this.bio = data.bio || '';
    this.profileImage = ProfileImage.fromFirebase(data.profileImage || {});
    this.followerCount = data.followerCount || 0;
    this.followingCount = data.followingCount || 0;
    this.bodyWeight = Array.isArray(data.bodyWeight)
      ? data.bodyWeight.map((weight: any) => User.fromFirebase(weight))
      : [];
    this.workoutCount = data.workoutCount || 0;
    this.creator = {
      type: data.creator?.type || [],
      instagramHandle: data.creator?.instagramHandle || '',
      twitterHandle: data.creator?.twitterHandle || '',
      youtubeUrl: data.creator?.youtubeUrl || '',
      acceptCodeOfConduct: data.creator?.acceptCodeOfConduct || false,
      acceptExecutiveTerms: data.creator?.acceptExecutiveTerms || false,
      acceptGeneralTerms: data.creator?.acceptGeneralTerms || false,
      acceptSweatEquityPartnership: data.creator?.acceptSweatEquityPartnership || false,
      onboardingStatus: data.creator?.onboardingStatus || '',
      onboardingLink: data.creator?.onboardingLink || '',
      onboardingExpirationDate: data.creator?.onboardingExpirationDate || 0
    };
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  static fromFirebase(data: any): User {
    return new User({
      id: data.id || '',
      displayName: data.displayName || '',
      username: data.username || '',
      bio: data.bio || '',
      profileImage: data.profileImage || {},
      followerCount: data.followerCount || 0,
      followingCount: data.followingCount || 0,
      bodyWeight: data.bodyWeight || [],
      workoutCount: data.workoutCount || 0,
      creator: data.creator || {},
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
  }

  toFirestore(): Record<string, any> {
    return {
      id: this.id,
      displayName: this.displayName,
      username: this.username,
      bio: this.bio,
      profileImage: this.profileImage,
      followerCount: this.followerCount,
      followingCount: this.followingCount,
      bodyWeight: this.bodyWeight,
      workoutCount: this.workoutCount,
      creator: this.creator,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

export interface MacroRecommendations {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export enum SubscriptionType {
  Unsubscribed = "Unsubscribed",
  Beta = "Beta User",
  Monthly = "Monthly Subscriber",
  Annual = "Annual Subscriber",
  SweatEquityPartner = "Sweat Equity Partner",
  ExecutivePartner = "Executive Partner",
}

export enum UserLevel {
  Novice = "novice",
  Intermediate = "intermediate",
  Expert = "expert",
}

export enum WorkoutGoal {
  LoseWeight = "Lose weight",
  GainWeight = "Gain muscle mass",
  ToneUp = "Tone up",
  GeneralFitness = "General Fitness",
}

export interface UserHeight {
  feet: number;
  inches: number;
}

export interface ShortUser {
  id: string;
  displayName: string;
  email: string;
  fcmToken?: string | null;
  username: string;
  level: UserLevel;
  videoCount: number;
  profileImage: ProfileImage;
}

export enum Gender {
  Woman = "woman",
  Man = "man",
  SelfDescribe = "I'd rather self describe",
}

export interface Encouragement {
  fromUser: ShortUser;
  toUser: ShortUser;
  createdAt: Date;
}


export interface Gym {
  id: string;
  name: string;
  address: string;
  location: { latitude: number; longitude: number };
}

export enum SubscriptionPlatform {
  iOS = "ios",
  Android = "android",
}

export interface Creator {
  id: string;
  instagramHandle?: string;
  twitterHandle?: string;
  youtubeUrl?: string;
  type?: ContentCreatorType[];
  why?: FitnessCreatorWhy[];
  onboardingPayoutState?: OnboardingPayoutState;
  onboardingStatus?: OnboardingStatus;
  isTrainer?: boolean;
  digitalSignatures?: string[];
  additionalFeedback?: string;
  acceptGeneralTerms?: boolean;
  acceptSweatEquityPartnership?: boolean;
  acceptCodeOfConduct?: boolean;
  acceptExecutiveTerms?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export enum ContentCreatorType {
  PersonalTrainer = "personal_trainer",
  FitnessEnthusiast = "fitness_enthusiast",
}

export enum FitnessCreatorWhy {
  InspireOthers = "inspire_others",
  BuildCommunity = "build_community",
}

export enum OnboardingPayoutState {
  Introduction = "introduction",
  InProgress = "in_progress",
  Complete = "complete",
}

export enum OnboardingStatus {
  NotStarted = "not_started",
  InProgress = "in_progress",
  Completed = "completed",
}