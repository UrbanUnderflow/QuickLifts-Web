import { ExerciseReference, ExerciseLog, ExerciseAuthor } from '../exercise/types';
import { BodyPart, ExerciseCategory } from '../exercise/types';
import { convertFirestoreTimestamp, dateToUnixTimestamp } from '../../../utils/formatDate';
import { workoutService } from '../workout/service';

export class CheckIn {
  id: string;
  userId: string;
  workoutId: string;
  photoUrl: string;
  videoUrl: string;
  createdAt: Date;

  constructor(data: any) {
    this.id = data.id || '';
    this.userId = data.userId || '';
    this.workoutId = data.workoutId || '';
    this.photoUrl = data.photoUrl || '';
    this.videoUrl = data.videoUrl || '';
    // If createdAt is a Unix timestamp in seconds, convert it to a Date
    this.createdAt = data.createdAt
      ? (typeof data.createdAt === 'number'
          ? new Date(data.createdAt * 1000)
          : new Date(data.createdAt))
      : new Date();
  }

  toDictionary(): { [key: string]: any } {
    return {
      id: this.id,
      userId: this.userId,
      workoutId: this.workoutId,
      photoUrl: this.photoUrl,
      videoUrl: this.videoUrl,
      createdAt: dateToUnixTimestamp(this.createdAt)
    };
  }
}

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
  
export class RepsAndWeightLog {
  reps: number;
  weight: number;
  leftReps: number;
  leftWeight: number;
  isSplit: boolean;
  isBodyWeight: boolean;
  duration: number;
  calories: number;
  bpm: number;

  constructor(data: any) {
    this.reps = data.reps || 0;
    this.weight = data.weight || 0;
    this.leftReps = data.leftReps || 0;
    this.leftWeight = data.leftWeight || 0;
    this.isSplit = data.isSplit || false;
    this.isBodyWeight = data.isBodyWeight || false;
    this.duration = data.duration || 0;
    this.calories = data.calories || 0;
    this.bpm = data.bpm || 0;
  }

  toDictionary(): { [key: string]: any } {
    return {
      reps: this.reps,
      weight: this.weight,
      leftReps: this.leftReps,
      leftWeight: this.leftWeight,
      isSplit: this.isSplit,
      isBodyWeight: this.isBodyWeight,
      duration: this.duration,
      calories: this.calories,
      bpm: this.bpm
    };
  }
}

// WorkoutClass.ts

export class Workout {
  id: string;
  collectionId?: string[] | null;
  roundWorkoutId: string;
  exercises: ExerciseReference[];
  challenge?: Challenge | null;
  logs?: ExerciseLog[] | null;
  title: string;
  description: string;
  duration: number;
  workoutRating?: WorkoutRating | null;
  useAuthorContent: boolean;
  isCompleted: boolean;
  workoutStatus: WorkoutStatus;
  startTime?: Date | null;
  order?: number | null;
  author: string;
  assignedDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  zone: BodyZone;
 
  constructor(data: any) {
    // For string fields, default to empty string if not provided.
    this.id = data.id !== undefined ? data.id : '';
    this.roundWorkoutId = data.roundWorkoutId !== undefined ? data.roundWorkoutId : '';
    this.title = data.title !== undefined ? data.title : '';
    this.description = data.description !== undefined ? data.description : '';
    
    // For numeric fields, default to 0.
    this.duration = data.duration !== undefined ? data.duration : 0;
    
    // For boolean fields, default to false.
    this.useAuthorContent = data.useAuthorContent !== undefined ? data.useAuthorContent : false;
    this.isCompleted = data.isCompleted !== undefined ? data.isCompleted : false;
    
    // For enum fields (workoutStatus, workoutRating), you can either default to a specific value or null.
    this.workoutStatus = data.workoutStatus !== undefined ? data.workoutStatus : WorkoutStatus.Archived;
    this.workoutRating = data.workoutRating !== undefined ? data.workoutRating : null;
    
    // For arrays, default to an empty array.
    this.exercises = data.exercises !== undefined ? data.exercises : [];
    
    // For optional objects, default to null if missing.
    this.challenge = data.challenge !== undefined ? data.challenge : null;
    this.logs = data.logs !== undefined ? data.logs : null;
    this.collectionId = data.collectionId !== undefined ? data.collectionId : null;
    
    // For dates, if the field exists and is a Date, use it; otherwise default to null (or new Date() for createdAt/updatedAt)
    this.startTime = data.startTime ? convertFirestoreTimestamp(data.startTime) : null;
    this.assignedDate = data.assignedDate ? convertFirestoreTimestamp(data.assignedDate) : null;
    this.createdAt = data.createdAt ? convertFirestoreTimestamp(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? convertFirestoreTimestamp(data.updatedAt) : new Date();
    
    // For order, default to null if not provided.
    this.order = data.order !== undefined ? data.order : null;

    // In Workout constructor:
    if (data.author?.username) {
      this.author = data.author.userId;
      workoutService.revertAuthorFormat(this.id, this.author);
    } else {
      this.author = data.author
    }
    // For zone, default to FullBody (or any other default you prefer)
    this.zone = data.zone !== undefined ? data.zone : BodyZone.FullBody;
  }

  get isTimedWorkout(): boolean {
    if (!this.logs) return false;
    return this.logs.some(log => {
      if (log.exercise.category.type === 'weight-training') {
        return log.exercise.category.details?.screenTime !== 0;
      } else if (log.exercise.category.type === 'cardio') {
        return log.exercise.category.details?.screenTime !== 0;
      }
      return false;
    });
  }

  fetchPrimaryBodyParts(): BodyPart[] {
    return this.exercises.flatMap(exerciseRef => exerciseRef.exercise.primaryBodyParts);
  }

  fetchSecondaryBodyParts(): BodyPart[] {
    return this.exercises.flatMap(exerciseRef => exerciseRef.exercise.secondaryBodyParts);
  }

  static estimatedDuration(exercises: ExerciseLog[]): number {
    const warmupTimeSeconds = 5 * 60;  // 5 minutes in seconds
    const cooldownTimeSeconds = 5 * 60; // 5 minutes in seconds
    let totalTimeSeconds = 0;
    let restTimeSeconds = 0;
    let hasScreenTimeExercises = false;

    
    for (const exerciseLog of exercises) {   
      var exercise = exerciseLog.exercise
      if (exercise?.category?.type === 'cardio') {
        const duration = exercise.category.details?.duration || 0;
        console.log('Cardio duration (minutes):', duration);
        totalTimeSeconds += duration * 60; // Convert minutes to seconds
      } else {
        const screenTime = exercise?.category?.details?.screenTime || 0;
        console.log("The screentime is: ", screenTime);
        if (screenTime > 0) {
          console.log('Screen time (seconds):', screenTime);
          totalTimeSeconds += screenTime; // Already in seconds
          hasScreenTimeExercises = true;
        } else {
          console.log('Using default timing (8m exercise + 1m rest)');
          totalTimeSeconds += 8 * 60; // 8 minutes in seconds
          restTimeSeconds += 60;      // 1 minute in seconds
        }
      }
  
      console.log('Current totals (in seconds):', {
        totalTimeSeconds,
        restTimeSeconds,
        hasScreenTimeExercises
      });
      console.groupEnd();
    }
  
    if (!hasScreenTimeExercises) {
      console.log('Adding warmup/cool-down:', 
        (warmupTimeSeconds + cooldownTimeSeconds) / 60, 'minutes');
      totalTimeSeconds += warmupTimeSeconds + cooldownTimeSeconds;
    }
  
    const totalSeconds = totalTimeSeconds + restTimeSeconds;
    console.log('Pre-rounded total (seconds):', totalSeconds);
  
    let finalEstimate: number;
    if (!hasScreenTimeExercises) {
      // Convert to minutes and round to nearest 5
      const totalMinutes = totalSeconds / 60;
      finalEstimate = Math.round(totalMinutes / 5) * 5;
      console.log('Rounded to nearest 5 minutes:', finalEstimate);
    } else {
      // Convert to minutes, rounding up to nearest minute
      finalEstimate = Math.ceil(totalSeconds / 60);
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
      return BodyZone.FullBody;
    }
  }

  private findUndefinedValues(obj: any, path: string = ''): string[] {
    const undefinedPaths: string[] = [];

    function recursiveCheck(current: any, currentPath: string) {
      if (current === undefined) {
        undefinedPaths.push(currentPath);
        return;
      }

      if (current === null || typeof current !== 'object') {
        return;
      }

      if (Array.isArray(current)) {
        current.forEach((item, index) => {
          recursiveCheck(item, `${currentPath}[${index}]`);
        });
        return;
      }

      Object.entries(current).forEach(([key, value]) => {
        const newPath = currentPath ? `${currentPath}.${key}` : key;
        if (value === undefined) {
          undefinedPaths.push(newPath);
        } else {
          recursiveCheck(value, newPath);
        }
      });
    }

    recursiveCheck(obj, path);
    return undefinedPaths;
  }

  private checkForUndefined(data: any, label: string = 'Data'): boolean {
    const undefinedPaths = this.findUndefinedValues(data);
    if (undefinedPaths.length > 0) {
      console.error(`🚨 Found undefined values in ${label}:`);
      undefinedPaths.forEach(path => {
        console.error(`  - ${path}`);
      });
      return false;
    }
    return true;
  }

  toDictionary(): { [key: string]: any } {
    const data: { [key: string]: any } = {
      id: this.id,
      exercises: this.exercises.map(ex => ({
        exercise: ex.exercise.toDictionary(),
        groupId: ex.groupId
      })),
      logs: this.logs ? this.logs.map(log => log.toDictionary()) : [],
      title: this.title,
      description: this.description,
      zone: this.zone,
      duration: this.duration,
      workoutRating: this.workoutRating,
      useAuthorContent: this.useAuthorContent,
      isCompleted: this.isCompleted,
      workoutStatus: this.workoutStatus,
      author: this.author, // Just save the ID
      createdAt: dateToUnixTimestamp(this.createdAt),
      updatedAt: dateToUnixTimestamp(this.updatedAt),
      assignedDate: this.assignedDate ? dateToUnixTimestamp(this.assignedDate) : null,
      startTime: this.startTime ? dateToUnixTimestamp(this.startTime) : null,
      order: this.order || null,
      collectionId: this.collectionId || null,
      challenge: this.challenge || null
    };

    // Validate data before returning
    if (!this.checkForUndefined(data, 'Workout Dictionary')) {
      throw new Error('Workout contains undefined values');
    }

    return data;
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
      this.exercises = data.exercises.map((ex: any) => new ExerciseLog(ex));
      this.bodyParts = data.bodyParts;
      this.secondaryBodyParts = data.secondaryBodyParts;
      this.workoutTitle = data.workoutTitle;
      this.caloriesBurned = data.caloriesBurned;
      this.workoutRating = data.workoutRating;
      this.exercisesCompleted = data.exercisesCompleted.map((ex: any) => new ExerciseLog(ex));
      this.aiInsight = data.aiInsight;
      this.recommendations = data.recommendations;
      this.gifURLs = data.gifURLs;
      this.recommendedWork = data.recommendedWork;
      this.isCompleted = data.isCompleted;
      this.createdAt = data.createdAt ? convertFirestoreTimestamp(data.createdAt) : new Date();
      this.updatedAt = data.updatedAt ? convertFirestoreTimestamp(data.updatedAt) : new Date();
      this.completedAt = data.completedAt ? convertFirestoreTimestamp(data.completedAt) : null;
      this.duration = data.duration;
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

export class ReferralChain {
  originalHostId: string;
  sharedBy: string;

  constructor(data: any) {
    this.originalHostId = data.originalHostId || '';
    this.sharedBy = data.sharedBy || '';
  }

  toDictionary(): any {
    return {
      originalHostId: this.originalHostId,
      sharedBy: this.sharedBy,
    };
  }

  static fromFirestore(data: any): ReferralChain {
    return new ReferralChain(data);
  }
}


// Main SweatlistCollection interface
export class SweatlistCollection {
  id: string;
  title: string;
  subtitle: string;
  pin: string | null;
  challenge?: Challenge | null;
  publishedStatus?: boolean;
  participants: string[];
  sweatlistIds: SweatlistIdentifiers[];
  ownerId: string[]; // Updated to be an array
  privacy: SweatlistType;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: any) {
    this.id = data.id;
    this.title = data.title || '';
    this.subtitle = data.subtitle || '';
    this.pin = data.pin || null;
    this.challenge = data.challenge ? new Challenge(data.challenge) : null;
    this.sweatlistIds = (data.sweatlistIds || []).map((item: any) => ({
      id: item.id || '',
      sweatlistAuthorId: item.sweatlistAuthorId || '',
      sweatlistName: item.sweatlistName || '',
      order: item.order || 0,
    }));
    // If ownerId is not an array, wrap it in an array.
    if (Array.isArray(data.ownerId)) {
      this.ownerId = data.ownerId;
    } else if (data.ownerId) {
      this.ownerId = [data.ownerId];
    } else {
      this.ownerId = [];
    }
    this.privacy = this.challenge ? SweatlistType.Together : SweatlistType.Solo;
    this.participants = (data.participants || []).map((participant: any) => participant || '');
    this.createdAt = convertFirestoreTimestamp(data.createdAt);
    this.updatedAt = convertFirestoreTimestamp(data.updatedAt);
  }

  toDictionary(): any {
    return {
      id: this.id,
      title: this.title,
      subtitle: this.subtitle,
      pin: this.pin,
      challenge: this.challenge ? this.challenge.toDictionary() : null,
      sweatlistIds: this.sweatlistIds.map(item => ({
        id: item.id,
        sweatlistAuthorId: item.sweatlistAuthorId,
        order: item.order
      })),
      ownerId: this.ownerId, // Updated to be an array
      privacy: this.privacy,
      createdAt: dateToUnixTimestamp(this.createdAt),
      updatedAt: dateToUnixTimestamp(this.updatedAt)
    };
  }

  isPublished(): boolean {
    if (!this.challenge) return false;
    return this.challenge.status === ChallengeStatus.Published;
  }
}

class ProfileImage {
  profileImageURL: string;
  thumbnailURL?: string;

  constructor(data: any) {
    this.profileImageURL = data.profileImageURL || '';
    this.thumbnailURL = data.thumbnailURL || '';
  }

  toDictionary(): any {
    return {
      profileImageURL: this.profileImageURL,
      thumbnailURL: this.thumbnailURL || null,
    };
  }

  static fromFirestore(data: any): ProfileImage {
    return new ProfileImage(data);
  }
}

class UserLocation {
  latitude: number;
  longitude: number;

  constructor(data: any) {
    this.latitude = data.latitude || 0;
    this.longitude = data.longitude || 0;
  }

  toDictionary(): any {
    return {
      latitude: this.latitude,
      longitude: this.longitude,
    };
  }

  static fromFirestore(data: any): UserLocation {
    return new UserLocation(data);
  }
}

class PulsePoints {
  baseCompletion: number;      // e.g. 100 points
  firstCompletion: number;     // e.g. 50 points
  streakBonus: number;         // e.g. 25 points per day
  checkInBonus: number;        // e.g. 25 points
  effortRating: number;        // e.g. 10 points
  chatParticipation: number;   // e.g. 25 points
  locationCheckin: number;     // e.g. 25 points
  contentEngagement: number;   // e.g. 10 points per interaction
  encouragementSent: number;   // e.g. 15 points per unique user
  encouragementReceived: number; // e.g. 10 points per unique user
  cumulativeStreakBonus: number;

  constructor(data: any) {
    this.baseCompletion = data.baseCompletion ?? 0;
    this.firstCompletion = data.firstCompletion ?? 0;
    this.streakBonus = data.streakBonus ?? 0;
    this.checkInBonus = data.checkInBonus ?? 0;
    this.effortRating = data.effortRating ?? 0;
    this.chatParticipation = data.chatParticipation ?? 0;
    this.locationCheckin = data.locationCheckin ?? 0;
    this.contentEngagement = data.contentEngagement ?? 0;
    this.encouragementSent = data.encouragementSent ?? 0;
    this.encouragementReceived = data.encouragementReceived ?? 0;
    this.cumulativeStreakBonus = data.cumulativeStreakBonus ?? 0;
  }

  get totalStackPoints(): number {
    return (
      this.baseCompletion +
      this.firstCompletion +
      this.streakBonus +
      this.checkInBonus +
      this.effortRating
    );
  }

  get totalCommunityPoints(): number {
    return (
      this.chatParticipation +
      this.locationCheckin +
      this.contentEngagement +
      this.encouragementSent +
      this.encouragementReceived
    );
  }

  get totalPoints(): number {
    return this.totalStackPoints + this.totalCommunityPoints + this.cumulativeStreakBonus;
  }

  toDictionary(): any {
    return {
      baseCompletion: this.baseCompletion,
      firstCompletion: this.firstCompletion,
      streakBonus: this.streakBonus,
      checkInBonus: this.checkInBonus,
      effortRating: this.effortRating,
      chatParticipation: this.chatParticipation,
      locationCheckin: this.locationCheckin,
      contentEngagement: this.contentEngagement,
      encouragementSent: this.encouragementSent,
      encouragementReceived: this.encouragementReceived,
      cumulativeStreakBonus: this.cumulativeStreakBonus,
      totalStackPoints: this.totalStackPoints,
      totalCommunityPoints: this.totalCommunityPoints,
      totalPoints: this.totalPoints,
    };
  }

  static fromFirestore(data: any): PulsePoints {
    return new PulsePoints(data);
  }
}


// Types for user in challenge
class UserChallenge {
  id: string;
  challenge?: Challenge;
  challengeId: string;
  userId: string;
  username: string;
  profileImage?: ProfileImage;
  progress: number;
  referralChains: ReferralChain;
  completedWorkouts: { id: string; workoutId: string; completedAt: number }[];
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
  checkIns: CheckIn[];

  constructor(data: any) {
    this.id = data.id;
    this.challenge = data.challenge ? new Challenge(data.challenge) : undefined;
    this.challengeId = data.challengeId || '';
    this.userId = data.userId || '';
    this.username = data.username || '';
    this.profileImage = data.profileImage ? new ProfileImage(data.profileImage) : undefined;
    this.progress = data.progress ?? 0;
    this.referralChains = data.referralChains ? new ReferralChain(data.referralChains) : new ReferralChain({ originalHostId: '', sharedBy: '' });
    this.completedWorkouts = Array.isArray(data.completedWorkouts)
    ? data.completedWorkouts.map((cw: any) => ({
        id: cw.id || '',
        workoutId: cw.workoutId || '',
        completedAt: convertFirestoreTimestamp(cw.completedAt),  // Use convertFirestoreTimestamp here
      }))
    : [];
    this.isCompleted = data.isCompleted ?? false;
    this.location = data.location ? new UserLocation(data.location) : undefined;
    this.city = data.city || '';
    this.country = data.country || '';
    this.timezone = data.timezone || '';
    this.joinDate = convertFirestoreTimestamp(data.joinDate);
    this.createdAt = convertFirestoreTimestamp(data.createdAt);
    this.updatedAt = convertFirestoreTimestamp(data.updatedAt);
    this.pulsePoints = data.pulsePoints ? new PulsePoints(data.pulsePoints) : new PulsePoints({});
    this.currentStreak = data.currentStreak ?? 0;
    this.encouragedUsers = Array.isArray(data.encouragedUsers) ? data.encouragedUsers : [];
    this.encouragedByUsers = Array.isArray(data.encouragedByUsers) ? data.encouragedByUsers : [];
    this.checkIns = Array.isArray(data.checkIns)
    ? data.checkIns.map((d: any) => new CheckIn(d))
    : [];  }

  // Optionally, you can add a static method to create an instance from Firestore data
  static fromFirestore(id: string, data: any): UserChallenge {
    return new UserChallenge(data);
  }

  // Optionally, add a method to convert to a plain dictionary (for saving to Firestore)
  toDictionary(): any {
    return {
      challenge: this.challenge ? this.challenge.toDictionary() : null,
      challengeId: this.challengeId,
      userId: this.userId,
      username: this.username,
      profileImage: this.profileImage ? this.profileImage.toDictionary() : null,
      progress: this.progress,
      referralChains: this.referralChains ? this.referralChains.toDictionary() : {},
      completedWorkouts: this.completedWorkouts.map(workout => ({
        ...workout,
        completedAt: Math.floor(new Date(workout.completedAt).getTime() / 1000)
      })),
      isCompleted: this.isCompleted,
      location: this.location ? this.location.toDictionary() : null,
      city: this.city,
      country: this.country,
      timezone: this.timezone,
      joinDate: dateToUnixTimestamp(this.joinDate),
      createdAt: dateToUnixTimestamp(this.createdAt),
      updatedAt: dateToUnixTimestamp(this.updatedAt),
      pulsePoints: this.pulsePoints ? this.pulsePoints.toDictionary() : {},
      currentStreak: this.currentStreak,
      encouragedUsers: this.encouragedUsers,
      encouragedByUsers: this.encouragedByUsers,
      checkIns: this.checkIns.map(checkIn => checkIn.toDictionary()),
    };
  }
}

// Challenge status enum
enum ChallengeStatus {
  Draft = 'draft',
  Published = 'published',
  Completed = 'completed',
  Cancelled = 'cancelled'
}
export interface IntroVideo {
  id: string;
  userId: string;
  videoUrl: string;
  toDictionary(): any;
}

export class IntroVideo implements IntroVideo {
  id: string;
  userId: string;
  videoUrl: string;

  constructor(data: { id: string; userId: string; videoUrl: string; }) {
    this.id = data.id;
    this.userId = data.userId;
    this.videoUrl = data.videoUrl;
  }

  toDictionary(): any {
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
    participants?: UserChallenge[]; // make optional in case it's missing
    status: ChallengeStatus;
    startDate: Date;
    endDate: Date;
    createdAt: Date;
    updatedAt: Date;
    introVideos?: IntroVideo[];
    introVideoURL?: string; // Add this for backwards compatibility
  }) {
    this.id = data.id;
    this.title = data.title;
    this.subtitle = data.subtitle;
    // Use an empty array if participants is missing.
    this.participants = Array.isArray(data.participants) ? data.participants : [];
    this.status = data.status;

    console.log("Challenge start date", convertFirestoreTimestamp(data.startDate));
    this.startDate = convertFirestoreTimestamp(data.startDate);
    this.endDate = convertFirestoreTimestamp(data.endDate);
    this.createdAt = convertFirestoreTimestamp(data.createdAt);
    this.updatedAt = convertFirestoreTimestamp(data.updatedAt);

    // Handle both old and new format for intro videos.
    if (Array.isArray(data.introVideos)) {
      this.introVideos = data.introVideos.map(video => new IntroVideo(video));
    } else if (data.introVideoURL && Array.isArray(data.participants) && data.participants.length > 0) {
      this.introVideos = [
        new IntroVideo({
          id: '1',
          userId: data.participants[0].userId,
          videoUrl: data.introVideoURL
        })
      ];
    } else {
      this.introVideos = [];
    }

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
      startDate: dateToUnixTimestamp(this.startDate),
      endDate: dateToUnixTimestamp(this.endDate),
      createdAt: dateToUnixTimestamp(this.createdAt),
      updatedAt: dateToUnixTimestamp(this.updatedAt),
      durationInDays: this.durationInDays,
      introVideos: this.introVideos.map(video => video.toDictionary())
    };
  }

  /**
   * Calculates the duration in days between the startDate and endDate.
   * @returns The number of days between the two dates.
   */
  private calculateDurationInDays(): number {
    const start = this.startDate?.valueOf();
    const end = this.endDate?.valueOf();

    if (!start || !end || isNaN(start) || isNaN(end)) {
      throw new Error('Invalid startDate or endDate');
    }

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

    const plainObject: { [key: string]: any } = {};
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
  ChallengeInvitationProps
};

export { ChallengeStatus, Challenge, UserChallenge };
