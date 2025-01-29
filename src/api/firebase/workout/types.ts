import { ExerciseReference, ExerciseLog } from '../exercise/types';
import { BodyPart, ExerciseCategory } from '../exercise/types';
import { convertFirestoreTimestamp } from '../../../utils/formatDate';

// src/types/WorkoutTypes.ts
export enum WorkoutStatus {
  QueuedUp = 'queuedUp',
  InProgress = 'inProgress',
  Complete = 'complete',
  Archived = 'archived'
}

// src/types/WorkoutTypes.ts
export enum WorkoutRating {
  TooHard = 'Too Hard',
  TooEasy = 'Too Easy',
  JustRight = 'Just Right'
}


export enum BodyZone {
  LowerBody = "Lower Body",
  UpperBody = "Upper Body",
  FullBody = "Full Body",
  Core = "Core"

}
  
// types/RepsAndWeightLog.ts
export interface RepsAndWeightLog {
  reps: number;
  weight: number;
  leftReps: number;
  leftWeight: number;
  isSplit: boolean;
  isBodyWeight: boolean;
  duration: number;
  calories: number;
  bpm: number;
 }
 
 export function fromFirebase(data: any): RepsAndWeightLog {
  return {
    reps: data.reps || 0,
    weight: data.weight || 0,
    leftReps: data.leftReps || 0,
    leftWeight: data.leftWeight || 0,
    isSplit: data.isSplit || false,
    isBodyWeight: data.isBodyWeight || false,
    duration: data.duration || 0,
    calories: data.calories || 0,
    bpm: data.bpm || 0
  };
 }
 
 export class RepsAndWeightLog {
  static fromFirebase(data: any): RepsAndWeightLog {
    return fromFirebase(data);
  }
 }
  
// WorkoutClass.ts

 export class Workout {
  id: string;
  collectionId?: string[];
  roundWorkoutId: string;
  exercises: ExerciseReference[];
  challenge?: Challenge;
  logs?: ExerciseLog[];
  title: string;
  description: string;
  duration: number;
  workoutRating?: WorkoutRating;
  useAuthorContent: boolean;
  isCompleted: boolean;
  workoutStatus: WorkoutStatus;
  startTime?: Date;
  order?: number;
  author: string;
  createdAt: Date;
  updatedAt: Date;
  zone: BodyZone;

  constructor(data: Workout) {
    this.id = data.id;
    this.collectionId = data.collectionId;
    this.roundWorkoutId = data.roundWorkoutId;
    this.exercises = data.exercises;
    this.challenge = data.challenge;
    this.logs = data.logs;
    this.title = data.title;
    this.description = data.description;
    this.duration = data.duration;
    this.workoutRating = data.workoutRating;
    this.useAuthorContent = data.useAuthorContent;
    this.isCompleted = data.isCompleted;
    this.workoutStatus = data.workoutStatus;
    this.startTime = data.startTime;
    this.order = data.order;
    this.author = data.author;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.zone = Workout.determineWorkoutZone(data.exercises);
  }

  static estimatedDuration(exercises: ExerciseReference[]): number {
    const warmupTime = 5;
    const cooldownTime = 5;
    let totalExerciseTime = 0;
    let restTime = 0;
    let hasScreenTimeExercises = false;
    
    for (const exerciseRef of exercises) {
      const exercise = exerciseRef.exercise;
      console.groupCollapsed(`Exercise: ${exercise}`);
      
      if (exercise.category.type === 'cardio') {
        const duration = exercise.category.details?.duration || 0;
        console.log('Cardio duration (minutes):', duration);
        totalExerciseTime += duration;
      } else if (exercise.category.type === 'weightTraining') {
        const screenTime = exercise.category.details?.screenTime || 0;
        
        if (screenTime > 0) {
          console.log('Screen time (seconds):', screenTime);
          console.log('Converted to minutes:', Math.floor(screenTime / 60));
          totalExerciseTime += Math.floor(screenTime / 60);
          hasScreenTimeExercises = true;
        } else {
          console.log('Using default timing (8m exercise + 1m rest)');
          totalExerciseTime += 8;
          restTime += 1;
        }
      }
  
      console.log('Current totals:', {
        totalExerciseTime,
        restTime,
        hasScreenTimeExercises
      });
      console.groupEnd();
    }
  
    if (!hasScreenTimeExercises) {
      console.log('Adding warmup/cool-down:', warmupTime + cooldownTime, 'minutes');
      totalExerciseTime += warmupTime + cooldownTime;
    }
  
    const estimatedTotalTime = totalExerciseTime + restTime;
    console.log('Pre-rounded total:', estimatedTotalTime);
  
    let finalEstimate = estimatedTotalTime;
    if (!hasScreenTimeExercises) {
      finalEstimate = Math.round(estimatedTotalTime / 5) * 5;
      console.log('Rounded to nearest 5 minutes:', finalEstimate);
    }
  
    console.log('Final estimated duration:', finalEstimate, 'minutes');
    return finalEstimate;
  }

  static determineWorkoutZone(exercises: ExerciseReference[]): BodyZone {
    const bodyPartsInvolved = new Set<BodyPart>();

    for (const exerciseRef of exercises) {
      for (const bodyPart of exerciseRef.exercise.primaryBodyParts || [exerciseRef.exercise.primaryBodyParts]) {
        bodyPartsInvolved.add(bodyPart as BodyPart);
      }
    }

    const upperBodyParts = new Set([
      BodyPart.Chest,
      BodyPart.Shoulders,
      BodyPart.Biceps,
      BodyPart.Triceps,
      BodyPart.Traps,
      BodyPart.Lats,
      BodyPart.Forearms,
    ]);

    const lowerBodyParts = new Set([
      BodyPart.Hamstrings,
      BodyPart.Glutes,
      BodyPart.Quadriceps,
      BodyPart.Calves,
    ]);

    const coreParts = new Set([BodyPart.Abs, BodyPart.Lowerback]);

    const hasCommonElements = (set1: Set<BodyPart>, set2: Set<BodyPart>): boolean => {
      return Array.from(set1).some((item) => set2.has(item));
    };

    const hasUpperBody = hasCommonElements(bodyPartsInvolved, upperBodyParts);
    const hasLowerBody = hasCommonElements(bodyPartsInvolved, lowerBodyParts);
    const hasCore = hasCommonElements(bodyPartsInvolved, coreParts);

    if ((hasUpperBody && hasLowerBody && hasCore) || (hasUpperBody && hasLowerBody)) {
      return BodyZone.FullBody;
    } else if (hasUpperBody && hasCore || hasUpperBody) {
      return BodyZone.UpperBody;
    } else if (hasLowerBody && hasCore || hasLowerBody) {
      return BodyZone.LowerBody;
    } else if (hasCore) {
      return BodyZone.Core;
    } else {
      return BodyZone.FullBody; // Default case
    }
  }

  static toDictionary(workout: Workout): { [key: string]: any } {
    return {
      id: workout.id,
      collectionId: workout.collectionId,
      roundWorkoutId: workout.roundWorkoutId,
      exercises: workout.exercises,
      challenge: workout.challenge,
      logs: workout.logs,
      title: workout.title,
      description: workout.description,
      duration: workout.duration,
      workoutRating: workout.workoutRating,
      useAuthorContent: workout.useAuthorContent,
      isCompleted: workout.isCompleted,
      workoutStatus: workout.workoutStatus,
      startTime: workout.startTime,
      order: workout.order,
      author: workout.author,
      createdAt: workout.createdAt,
      updatedAt: workout.updatedAt,
      zone: workout.zone,
    };
  }
}

export class WorkoutSummary {
    id: string;
    workoutId: string;
    exercises: ExerciseLog[];
    bodyParts: BodyPart[];
    secondaryBodyParts: BodyPart[];
    workoutTitle: string;
    caloriesBurned: number;
    workoutRating?: WorkoutRating;
    exercisesCompleted: ExerciseLog[];
    aiInsight: string;
    recommendations: string[];
    gifURLs?: string[];
    recommendedWork?: number;
    isCompleted: boolean;
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date | null;
    duration: string;
  
    constructor(data: any) {
      this.id = data.id;
      this.workoutId = data.workoutId;
      this.exercises = data.exercises.map((ex: any) => ExerciseLog.fromFirebase(ex));
      this.bodyParts = data.bodyParts;
      this.secondaryBodyParts = data.secondaryBodyParts;
      this.workoutTitle = data.workoutTitle;
      this.caloriesBurned = data.caloriesBurned;
      this.workoutRating = data.workoutRating;
      this.exercisesCompleted = data.exercisesCompleted.map((ex: any) => ExerciseLog.fromFirebase(ex));
      this.aiInsight = data.aiInsight;
      this.recommendations = data.recommendations;
      this.gifURLs = data.gifURLs;
      this.recommendedWork = data.recommendedWork;
      this.isCompleted = data.isCompleted;
      this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
      this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
      this.completedAt = data.completedAt ? new Date(data.completedAt) : null;
      this.duration = data.duration;
    }
  
    static fromFirebase(data: any): WorkoutSummary {
      return new WorkoutSummary({
        id: data.id || '',
        workoutId: data.workoutId || '',
        exercises: data.exercises || [],
        bodyParts: data.bodyParts || [],
        secondaryBodyParts: data.secondaryBodyParts || [],
        workoutTitle: data.workoutTitle || '',
        caloriesBurned: data.caloriesBurned || 0,
        workoutRating: data.workoutRating,
        exercisesCompleted: data.exercisesCompleted || [],
        aiInsight: data.aiInsight || '',
        recommendations: data.recommendations || [],
        gifURLs: data.gifURLs || [],
        recommendedWork: data.recommendedWork,
        isCompleted: data.isCompleted || false,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        completedAt: data.completedAt,
        duration: data.duration || ''
      });
    }
}

export interface WorkoutService {
  fetchCurrentWorkout: () => Promise<Workout | null>;
  generateWorkout: (bodyParts: BodyZone[]) => Promise<Workout>;
  startWorkout: (workoutId: string) => Promise<void>;
  cancelWorkout: (workoutId: string) => Promise<void>;
  completeWorkout: (workoutId: string, rating?: WorkoutRating) => Promise<void>;
  fetchCurrentWorkoutSession: () => Promise<{
    workout: Workout | null;
    logs: ExerciseLog[] | null;
  }>;
  swapWorkout: (oldWorkoutId: string, newBodyParts: BodyZone[]) => Promise<Workout>;
  updateWorkoutStatus: (workoutId: string, status: WorkoutStatus) => Promise<void>;
  logExercise: (workoutId: string, exerciseLog: ExerciseLog) => Promise<void>;
  getWorkoutLogs: (workoutId: string) => Promise<ExerciseLog[]>;
  cancelCurrentWorkout: () => Promise<void>;
  getCurrentWorkoutStatus: () => Promise<WorkoutStatus>;
  saveWorkout: (workout: Workout) => Promise<void>;
}

// SweatlistIdentifiers type
export interface SweatlistIdentifiers {
  id: string;
  sweatlistAuthorId: string;
  sweatlistName: string;
  order: number;
}

// Enum for sweatlist type matching Swift implementation
export enum SweatlistType {
  Together = 'together',
  Solo = 'solo',
  Locked = 'locked'
}

export interface ReferralChain {
  originalHostId: string;
  shares: string[];
 }

// Main SweatlistCollection interface
export class SweatlistCollection {
  id: string;
  title: string;
  subtitle: string;
  challenge?: Challenge;
  publishedStatus?: boolean;
  participants: string[];
  sweatlistIds: SweatlistIdentifiers[];
  ownerId: string;
  privacy: SweatlistType;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: any) {
    this.id = data.id;
    this.title = data.title || '';
    this.subtitle = data.subtitle || '';
    this.challenge = data.challenge ? new Challenge(data.challenge) : undefined;
    this.sweatlistIds = (data.sweatlistIds || []).map((item: any) => ({
      id: item.id || '',
      sweatlistAuthorId: item.sweatlistAuthorId || '',
      sweatlistName: item.sweatlistName || '',
      order: item.order || 0,
    }));
    this.ownerId = data.ownerId || '';
    this.privacy = data.challenge ? SweatlistType.Together : SweatlistType.Solo;
    this.participants = (data.participants || []).map((participant: any) => participant || '');
    this.createdAt = convertFirestoreTimestamp(data.createdAt);
    this.updatedAt = convertFirestoreTimestamp(data.updatedAt);
  }

  static fromFirestore(data: any): SweatlistCollection {
    return new SweatlistCollection(data);
  }

  toDictionary(): any {
    return {
      id: this.id,
      title: this.title,
      subtitle: this.subtitle,
      challenge: this.challenge ? this.challenge.toDictionary() : null,
      sweatlistIds: this.sweatlistIds.map(item => ({
        id: item.id,
        sweatlistAuthorId: item.sweatlistAuthorId,
        order: item.order
      })),
      ownerId: this.ownerId,
      privacy: this.privacy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toRESTDictionary(): any {
    return {
      fields: {
        id: { stringValue: this.id },
        title: { stringValue: this.title },
        subtitle: { stringValue: this.subtitle },
        ownerId: { stringValue: this.ownerId },
        sweatlistIds: {
          arrayValue: {
            values: this.sweatlistIds.map(item => ({
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
        createdAt: { doubleValue: this.createdAt.getTime() },
        updatedAt: { doubleValue: this.updatedAt.getTime() }
      }
    };
  }

  isPublished(): boolean {
    if (!this.challenge) return false;
    return this.challenge.status === ChallengeStatus.Published;
  }
}

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
  referralChains: ReferralChain;
  completedWorkouts: { 
    id: string; 
    workoutId: string;
    completedAt: number;
  }[];
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

// types.ts (or appropriate location)
export class IntroVideo {
  id: string;
  userId: string;
  videoUrl: string;

  constructor(data: {
    id: string;
    userId: string;
    videoUrl: string;
  }) {
    this.id = data.id;
    this.userId = data.userId;
    this.videoUrl = data.videoUrl;
  }

  static fromFirebase(data: any): IntroVideo {
    return new IntroVideo({
      id: data.id || '',
      userId: data.userId || '',
      videoUrl: data.videoUrl || ''
    });
  }

  toDictionary(): { [key: string]: any } {
    return {
      id: this.id,
      userId: this.userId,
      videoUrl: this.videoUrl
    };
  }
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
  introVideos: IntroVideo[];

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
    introVideos?: IntroVideo[];
  }) {
    this.id = data.id;
    this.title = data.title;
    this.subtitle = data.subtitle;
    this.participants = data.participants;
    this.status = data.status;
    this.startDate = convertFirestoreTimestamp(data.startDate);
    this.endDate = convertFirestoreTimestamp(data.endDate);
    this.createdAt = convertFirestoreTimestamp(data.createdAt);
    this.updatedAt = convertFirestoreTimestamp(data.updatedAt);
    this.introVideos = data.introVideos || [];
    this.durationInDays = this.calculateDurationInDays();
  }

    toDictionary(): any {
      return {
        id: this.id,
        title: this.title,
        subtitle: this.subtitle,
        participants: this.participants.map(participant => ({
          id: participant.id,
          challengeId: participant.challengeId,
          userId: participant.userId,
          username: participant.username,
          profileImage: participant.profileImage,
          progress: participant.progress,
          completedWorkouts: participant.completedWorkouts,
          isCompleted: participant.isCompleted,
          location: participant.location,
          city: participant.city,
          country: participant.country,
          timezone: participant.timezone,
          joinDate: participant.joinDate,
          createdAt: participant.createdAt,
          updatedAt: participant.updatedAt,
          pulsePoints: participant.pulsePoints,
          currentStreak: participant.currentStreak,
          encouragedUsers: participant.encouragedUsers,
          encouragedByUsers: participant.encouragedByUsers,
          checkIns: participant.checkIns
        })),
        status: this.status,
        startDate: this.startDate,
        endDate: this.endDate,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
        durationInDays: this.durationInDays,
        introVideos: this.introVideos.map(video => ({
          id: video.id,
          userId: video.userId,
          videoUrl: video.videoUrl
        })),
      };
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

  static toFirestoreObject(obj: any): any {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }
    
      if (obj instanceof Date) {
        return obj;
      }
    
      if (Array.isArray(obj)) {
        return obj.map(item => this.toFirestoreObject(item));
      }
    
      if (obj instanceof Challenge) {
        return {
          id: obj.id,
          title: obj.title,
          subtitle: obj.subtitle,
          participants: obj.participants,
          status: obj.status,
          startDate: obj.startDate,
          endDate: obj.endDate,
          createdAt: obj.createdAt,
          updatedAt: obj.updatedAt,
          introVideos: obj.introVideos.map(video => ({
            id: video.id,
            userId: video.userId,
            videoUrl: video.videoUrl
          }))
        };
      }
    
      const plainObject: {[key: string]: any} = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          plainObject[key] = this.toFirestoreObject(obj[key]);
        }
      }
      return plainObject;
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
