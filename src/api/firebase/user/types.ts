// src/api/firebase/user/types.ts
import { convertFirestoreTimestamp, dateToUnixTimestamp } from '../../../utils/formatDate';

export interface UserService {
    updateUser: (userId: string, user: User) => Promise<void>;
    fetchUserFromFirestore: (userId: string) => Promise<User>;
    fetchUsersWithVideosUploaded: () => Promise<User[]>;
    currentUser: User | null;
}

// Add to existing interfaces
export interface FollowRequest {
  fromUser: {
    id: string;
    username: string;
    displayName: string;
  };
  toUser: {
    id: string;
    username: string;
    displayName: string;
  };
  status: string;
  createdAt: Date;
  updatedAt: Date
}

export class ProfileImage {
  profileImageURL: string;
  imageOffsetWidth: number;
  imageOffsetHeight: number;

  constructor(data: any) {
    this.profileImageURL = data.profileImageURL || '';
    this.imageOffsetWidth = data.imageOffsetWidth || 0;
    this.imageOffsetHeight = data.imageOffsetHeight || 0;
  }

  toDictionary(): { [key: string]: any } {
    return {
      profileImageURL: this.profileImageURL,
      imageOffsetWidth: this.imageOffsetWidth,
      imageOffsetHeight: this.imageOffsetHeight
    };
  }
}

export class User {
  id: string;
  displayName: string;
  email: string;
  username: string;
  homeGym?: Gym;
  encouragement?: Encouragement[];
  birthdate?: Date;
  gender?: Gender;
  selfDisclosedGender?: string;
  height?: UserHeight;
  location?: Location;
  bio: string;
  fcmToken?: string;
  workoutBuddy?: string;
  workoutBuddyUser?: ShortUser;
  additionalGoals: string;
  blockedUsers: string[];
  level: UserLevel = UserLevel.Novice;
  goal: WorkoutGoal[];
  bodyWeight: BodyWeight[];
  macros: Record<string, MacroRecommendations>;
  profileImage: ProfileImage;
  registrationComplete: boolean;
  creator?: Creator;
  subscriptionType: SubscriptionType;
  subscriptionPlatform: SubscriptionPlatform;
  referrer?: string;
  isCurrentlyActive: boolean;
  videoCount: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: any) {
    this.id = data.id || '';
    this.displayName = data.displayName || '';
    this.email = data.email || '';
    this.username = data.username || '';
    this.homeGym = data.homeGym || null;
    this.encouragement = data.encouragement || [];
    this.birthdate = convertFirestoreTimestamp(data.birthdate) || null;
    this.gender = data.gender || null;
    this.selfDisclosedGender = data.selfDisclosedGender || '';
    this.height = data.height || null;
    this.location = data.location || null;
    this.bio = data.bio || '';
    this.fcmToken = data.fcmToken || '';
    this.workoutBuddy = data.workoutBuddy || '';
    this.workoutBuddyUser = data.workoutBuddyUser || null;
    this.additionalGoals = data.additionalGoals || '';
    this.blockedUsers = data.blockedUsers || [];
    this.level = data.level || UserLevel.Novice;
    this.goal = data.goal || [];
    this.bodyWeight = Array.isArray(data.bodyWeight)
      ? data.bodyWeight.map((weight: any) => new BodyWeight(weight))
      : [];
    this.macros = data.macros || {};
    this.profileImage = new ProfileImage(data.profileImage || {});
    this.registrationComplete = data.registrationComplete || false;
    this.creator = data.creator || null;
    this.subscriptionType = data.subscriptionType || SubscriptionType.unsubscribed;
    this.subscriptionPlatform = data.subscriptionPlatform || SubscriptionPlatform.Web;
    this.referrer = data.referrer || '';
    this.isCurrentlyActive = data.isCurrentlyActive || false;
    this.videoCount = data.videoCount || 0;
    this.createdAt = convertFirestoreTimestamp(data.createdAt) || null;
    this.updatedAt = convertFirestoreTimestamp(data.updatedAt) || null;
  }

  toDictionary(): Record<string, any> {
    const userDict: Record<string, any> = {
      id: this.id,
      displayName: this.displayName,
      email: this.email,
      username: this.username,
      homeGym: this.homeGym,
      encouragement: this.encouragement,
      birthdate: this.birthdate ? dateToUnixTimestamp(this.birthdate) : null,
      gender: this.gender,
      selfDisclosedGender: this.selfDisclosedGender,
      height: this.height,
      location: this.location,
      bio: this.bio,
      fcmToken: this.fcmToken,
      workoutBuddy: this.workoutBuddy,
      workoutBuddyUser: this.workoutBuddyUser,
      additionalGoals: this.additionalGoals,
      blockedUsers: this.blockedUsers,
      level: this.level,
      goal: this.goal,
      bodyWeight: this.bodyWeight,
      macros: this.macros,
      profileImage: this.profileImage.toDictionary(),
      registrationComplete: this.registrationComplete,
      creator: this.creator,
      subscriptionType: this.subscriptionType,
      subscriptionPlatform: this.subscriptionPlatform,
      referrer: this.referrer,
      isCurrentlyActive: this.isCurrentlyActive,
      videoCount: this.videoCount,
      createdAt: dateToUnixTimestamp(this.createdAt),
      updatedAt: dateToUnixTimestamp(this.updatedAt),
    };

    return userDict;
  }

  toShortUser(): ShortUser {
    return new ShortUser({
      id: this.id,
      displayName: this.displayName,
      email: this.email, 
      fcmToken: this.fcmToken,
      username: this.username,
      level: this.level,
      videoCount: this.videoCount,
      profileImage: this.profileImage
    })
   }
}
 
 export interface MacroRecommendations {
   calories: number;
   protein: number;
   carbs: number;
   fat: number;
 }
 
 export enum SubscriptionType {
   unsubscribed = "Unsubscribed",
   beta = "Beta User",
   monthly = "Monthly Subscriber",
   annual = "Annual Subscriber",
   sweatEquityPartner = "Sweat Equity Partner",
   executivePartner = "Executive Partner",
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
 
 export class ShortUser {
  id: string;
  displayName: string;
  email: string;
  fcmToken?: string | null;
  username: string;
  level: UserLevel;
  videoCount: number;
  profileImage: ProfileImage;

  constructor(data: any) {
    this.id = data.id || '';
    this.displayName = data.displayName || '';
    this.email = data.email || '';
    this.fcmToken = data.fcmToken || null;
    this.username = data.username || '';
    this.level = data.level || UserLevel.Novice;
    this.videoCount = data.videoCount || 0;
    this.profileImage = data.profileImage ? new ProfileImage(data.profileImage) : new ProfileImage({});
  }

  // Static factory method to create from Firestore data
  static fromFirestore(data: any): ShortUser {
    return new ShortUser(data);
  }

  // Convert to dictionary for Firestore
  toDictionary(): { [key: string]: any } {
    return {
      id: this.id,
      displayName: this.displayName,
      email: this.email,
      fcmToken: this.fcmToken,
      username: this.username,
      level: this.level,
      videoCount: this.videoCount,
      profileImage: this.profileImage.toDictionary()
    };
  }

  // Helper method to create from User object
  static fromUser(user: User): ShortUser {
    return new ShortUser({
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      fcmToken: user.fcmToken,
      username: user.username,
      level: user.level,
      videoCount: user.videoCount,
      profileImage: user.profileImage
    });
  }
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
   Web = "web",
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

 export class BodyWeight {
    id: string;
    oldWeight: number;
    newWeight: number;
    frontUrl?: string;
    backUrl?: string;
    sideUrl?: string;
    createdAt: Date;
    updatedAt: Date;
  
    constructor(data: Partial<BodyWeight>) {
      const now = Date.now() / 1000;
      this.id = data.id || crypto.randomUUID();
      this.oldWeight = data.oldWeight || 0;
      this.newWeight = data.newWeight || 0;
      this.frontUrl = data.frontUrl || "";
      this.backUrl = data.backUrl || "";
      this.sideUrl = data.sideUrl || "";
      this.createdAt = convertFirestoreTimestamp(data.createdAt);
      this.updatedAt = convertFirestoreTimestamp(data.updatedAt);
    }
  
    toDictionary(): Record<string, any> {
      return {
        oldWeight: this.oldWeight,
        newWeight: this.newWeight,
        frontUrl: this.frontUrl,
        backUrl: this.backUrl,
        sideUrl: this.sideUrl,
        createdAt: dateToUnixTimestamp(this.createdAt),
        updatedAt: dateToUnixTimestamp(this.updatedAt)
      };
    }
  }