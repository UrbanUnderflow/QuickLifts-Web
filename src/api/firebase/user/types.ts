// src/api/firebase/user/types.ts

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

// types/ProfileImage.ts
export interface ProfileImage {
    profileImageURL: string;
    imageOffsetWidth: number;
    imageOffsetHeight: number;
 }
 
 export function fromFirebase(data: any): ProfileImage {
    return {
        profileImageURL: data.profileImageURL || '',
        imageOffsetWidth: data.imageOffsetWidth || 0,
        imageOffsetHeight: data.imageOffsetHeight || 0
    };
 }
 
 export class ProfileImage {
    static fromFirebase(data: any): ProfileImage {
        return fromFirebase(data);
    }
 }

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
   fcmToken?: string;
   level: UserLevel = UserLevel.Novice;
   videoCount: number = 0;
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
     this.fcmToken = data.fcmToken || '';
      this.level = data.level || UserLevel.Novice;
      this.videoCount = data.videoCount || 0;
     this.followerCount = data.followerCount || 0;
     this.followingCount = data.followingCount || 0;
     this.bodyWeight = Array.isArray(data.bodyWeight)
        ? data.bodyWeight.map((weight: any) => BodyWeight.fromFirebase(weight))
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
     // Update existing properties
    this.bodyWeight = Array.isArray(data.bodyWeight)
    ? data.bodyWeight.map((weight: any) => BodyWeight.fromFirebase(weight))
    : [];
     this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
     this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
   }
 
   static toShortUser(user: User): ShortUser {
    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      username: user.username,
      level: user.level || UserLevel.Novice, // You might want to add a 'level' property to the User class if it doesn't exist
      videoCount: user.workoutCount, // Assuming workoutCount is equivalent to videoCount
      profileImage: user.profileImage,
      fcmToken: user.fcmToken // Add this property to the User class if it doesn't exist
    }
  };

   static fromFirebase(data: any): User {
    return new User({
      id: data.id || '',
      displayName: data.displayName || '',
      username: data.username || '',
      bio: data.bio || '',
      profileImage: data.profileImage || {},
      followerCount: data.followerCount || 0,
      followingCount: data.followingCount || 0,
      bodyWeight: Array.isArray(data.bodyWeight) 
        ? data.bodyWeight.map((weight: any) => BodyWeight.fromFirebase(weight))
        : [],
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

 export class BodyWeight {
    id: string;
    oldWeight: number;
    newWeight: number;
    frontUrl?: string;
    backUrl?: string;
    sideUrl?: string;
    createdAt: number;
    updatedAt: number;
  
    constructor(data: Partial<BodyWeight>) {
      const now = Date.now() / 1000;
      this.id = data.id || crypto.randomUUID();
      this.oldWeight = data.oldWeight || 0;
      this.newWeight = data.newWeight || 0;
      this.frontUrl = data.frontUrl || "";
      this.backUrl = data.backUrl || "";
      this.sideUrl = data.sideUrl || "";
      this.createdAt = data.createdAt || now;
      this.updatedAt = data.updatedAt || now;
    }
  
    static fromFirebase(data: any): BodyWeight {
      return new BodyWeight({
        id: data.id || crypto.randomUUID(),
        oldWeight: data.oldWeight || 0,
        newWeight: data.newWeight || 0,
        frontUrl: data.frontUrl || "",
        backUrl: data.backUrl || "",
        sideUrl: data.sideUrl || "",
        createdAt: data.createdAt || 0,
        updatedAt: data.updatedAt || 0
      });
    }
  
    toFirestore(): Record<string, any> {
      return {
        oldWeight: this.oldWeight,
        newWeight: this.newWeight,
        frontUrl: this.frontUrl,
        backUrl: this.backUrl,
        sideUrl: this.sideUrl,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
      };
    }
  }