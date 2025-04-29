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
  creator: Creator | null;
  subscriptionType: SubscriptionType;
  subscriptionPlatform: SubscriptionPlatform;
  referrer?: string;
  isCurrentlyActive: boolean;
  videoCount: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(id: string, data: any) {    
    this.id = id;
    this.displayName = data.displayName || '';
    this.email = data.email;
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
    
    // Create the Creator instance
    if (data.creator) {
      this.creator = new Creator(data.creator);
    } else {
      this.creator = null;
    }
    
    this.subscriptionType = data.subscriptionType || SubscriptionType.unsubscribed;
    this.subscriptionPlatform = data.subscriptionPlatform || SubscriptionPlatform.Web;
    this.referrer = data.referrer || '';
    this.isCurrentlyActive = data.isCurrentlyActive || false;
    this.videoCount = data.videoCount || 0;

    this.createdAt = convertFirestoreTimestamp(data.createdAt) || null;

    this.updatedAt = convertFirestoreTimestamp(data.updatedAt) || null;
  }

  static fromDictionary(dict: Record<string, any> | null): User | null {
    if (!dict) return null;
    
    // Convert timestamps back to Date objects
    const processedData = {
      ...dict,
      birthdate: dict.birthdate ? new Date(dict.birthdate * 1000) : null,
      createdAt: dict.createdAt ? new Date(dict.createdAt * 1000) : null,
      updatedAt: dict.updatedAt ? new Date(dict.updatedAt * 1000) : null,
      // Convert any nested objects that need special handling
      profileImage: dict.profileImage ? new ProfileImage(dict.profileImage) : null,
      bodyWeight: Array.isArray(dict.bodyWeight) 
        ? dict.bodyWeight.map((weight: any) => new BodyWeight(weight))
        : [],
    };

    return new User(dict.id, processedData);
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
      bodyWeight: this.bodyWeight.map(bw => (typeof bw.toDictionary === 'function' ? bw.toDictionary() : bw)),
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
 
 export enum StripeOnboardingStatus {
   Parseending = 'incomplete',
   Complete = 'complete',
   NotStarted = 'notStarted'
 }
 
 export enum ContentCreatorType {
   FitnessEnthusiast = 'fitness enthusiast',
   PersonalTrainer = 'personal trainer',
   FitnessInfluencer = 'fitness influencer',
   InterestedInBecomingAThoughtLeader = 'interested in becoming a thought leader'
 }
 
 export enum FitnessCreatorWhy {
   ShareKnowledge = 'share knowledge',
   BuildAFollowing = 'build a following',
   BuildPersonalBrand = 'build personal brand',
   EarnIncome = 'earn income'
 }
 
 export interface BiometricDocSignature {
   id: string;
   deviceIdentifier: string;
   faceMapHash: string;
   timestamp: Date;
   docType: string;
 }
 
 export class Creator {
   id: string;
   instagramHandle: string;
   twitterHandle: string;
   youtubeUrl: string;
   type: ContentCreatorType[];
   why: FitnessCreatorWhy[];
   onboardingPayoutState: string;
   onboardingExpirationDate?: Date;
   onboardingLink?: string;
   onboardingStatus: StripeOnboardingStatus;
   stripeAccountId?: string;
   isTrainer: boolean;
   digitalSignatures?: BiometricDocSignature[];
   additionalFeedback: string;
   acceptGeneralTerms: boolean;
   acceptSweatEquityPartnership: boolean;
   acceptCodeOfConduct: boolean;
   acceptExecutiveTerms: boolean;
   createdAt: Date;
   updatedAt: Date;

   constructor(data: any) {     
     this.id = data.id || '';
     this.instagramHandle = data.instagramHandle || '';
     this.twitterHandle = data.twitterHandle || '';
     this.youtubeUrl = data.youtubeUrl || '';
     this.type = Array.isArray(data.type) 
       ? data.type.map((t: string) => ContentCreatorType[t as keyof typeof ContentCreatorType])
       : [];
     this.why = Array.isArray(data.why)
       ? data.why.map((w: string) => FitnessCreatorWhy[w as keyof typeof FitnessCreatorWhy])
       : [];
     this.onboardingPayoutState = data.onboardingPayoutState || '';
     this.onboardingExpirationDate = convertFirestoreTimestamp(data.onboardingExpirationDate);
     this.onboardingLink = data.onboardingLink;
     this.onboardingStatus = data.onboardingStatus || StripeOnboardingStatus.NotStarted;
     
     // Add explicit check for stripeAccountId
     this.stripeAccountId = data.stripeAccountId || undefined;
     
     this.isTrainer = data.isTrainer || false;
     this.digitalSignatures = data.digitalSignatures || [];
     this.additionalFeedback = data.additionalFeedback || '';
     this.acceptGeneralTerms = data.acceptGeneralTerms || false;
     this.acceptSweatEquityPartnership = data.acceptSweatEquityPartnership || false;
     this.acceptCodeOfConduct = data.acceptCodeOfConduct || false;
     this.acceptExecutiveTerms = data.acceptExecutiveTerms || false;
     this.createdAt = convertFirestoreTimestamp(data.createdAt) || new Date();
     this.updatedAt = convertFirestoreTimestamp(data.updatedAt) || new Date();
     
   }

   toDictionary(): Record<string, any> {
     return {
       id: this.id,
       instagramHandle: this.instagramHandle,
       twitterHandle: this.twitterHandle,
       youtubeUrl: this.youtubeUrl,
       type: this.type,
       why: this.why,
       onboardingPayoutState: this.onboardingPayoutState,
       onboardingExpirationDate: this.onboardingExpirationDate ? dateToUnixTimestamp(this.onboardingExpirationDate) : null,
       onboardingLink: this.onboardingLink,
       onboardingStatus: this.onboardingStatus,
       stripeAccountId: this.stripeAccountId,
       isTrainer: this.isTrainer,
       digitalSignatures: this.digitalSignatures,
       additionalFeedback: this.additionalFeedback,
       acceptGeneralTerms: this.acceptGeneralTerms,
       acceptSweatEquityPartnership: this.acceptSweatEquityPartnership,
       acceptCodeOfConduct: this.acceptCodeOfConduct,
       acceptExecutiveTerms: this.acceptExecutiveTerms,
       createdAt: dateToUnixTimestamp(this.createdAt),
       updatedAt: dateToUnixTimestamp(this.updatedAt)
     };
   }

   static fromDictionary(dict: Record<string, any> | null): Creator | null {
     if (!dict) return null;
     return new Creator(dict);
   }
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

// Add this class definition
export class Subscription {
    id: string; // Firestore document ID, potentially same as stripeSubscriptionId
    userId: string;
    subscriptionType: SubscriptionType;
    platform: SubscriptionPlatform;
    stripeSubscriptionId?: string; // Store the link to Stripe Subscription
    stripeCustomerId?: string;     // Store the link to Stripe Customer
    createdAt: Date;
    updatedAt: Date;

    constructor(id: string, data: any) {
        this.id = id;
        this.userId = data.userId;
        this.subscriptionType = data.subscriptionType || SubscriptionType.unsubscribed;
        this.platform = data.platform || SubscriptionPlatform.Web; // Default could be web or based on context
        this.stripeSubscriptionId = data.stripeSubscriptionId;
        this.stripeCustomerId = data.stripeCustomerId;
        this.createdAt = convertFirestoreTimestamp(data.createdAt) || new Date();
        this.updatedAt = convertFirestoreTimestamp(data.updatedAt) || new Date();
    }

    static fromDictionary(dict: Record<string, any> | null): Subscription | null {
        if (!dict || !dict.id || !dict.userId) return null; // Need id and userId
        // Assuming convertFirestoreTimestamp handles potential timestamp formats from Firestore
        const processedData = {
            ...dict,
            createdAt: convertFirestoreTimestamp(dict.createdAt) || new Date(),
            updatedAt: convertFirestoreTimestamp(dict.updatedAt) || new Date(),
        };
        return new Subscription(dict.id, processedData);
    }

    toDictionary(): Record<string, any> {
        return {
            userId: this.userId,
            subscriptionType: this.subscriptionType,
            platform: this.platform,
            stripeSubscriptionId: this.stripeSubscriptionId,
            stripeCustomerId: this.stripeCustomerId,
            createdAt: dateToUnixTimestamp(this.createdAt),
            updatedAt: dateToUnixTimestamp(this.updatedAt),
        };
    }
}