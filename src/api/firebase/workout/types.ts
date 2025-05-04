import { Exercise, ExerciseReference, ExerciseLog, ExerciseAuthor, BodyPart } from '../exercise/types';
import { convertFirestoreTimestamp, dateToUnixTimestamp } from '../../../utils/formatDate';
import { workoutService } from '../workout/service';
import { ShortUser, User } from '../user';

// Helper function to safely convert string to BodyPart enum
function stringToBodyPart(bodyPartString: string): BodyPart {
  // Map the string value to an enum value, case insensitive
  const normalizedString = bodyPartString.toLowerCase();
  
  // Check if the string matches any enum value
  for (const [key, value] of Object.entries(BodyPart)) {
    if (value.toLowerCase() === normalizedString) {
      return value;
    }
  }
  
  // Default fallback
  console.warn(`Unknown body part: "${bodyPartString}", defaulting to Fullbody`);
  return BodyPart.Fullbody;
}

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

export enum WorkoutType {
  UpperBody = 'Upper Body',
  LowerBody = 'Lower Body',
  Core = 'Core',
  FullBody = 'Full Body'
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
  estimatedDuration: number;
 
  constructor(data: any) {
    // For string fields, default to empty string if not provided.
    this.id = data.id !== undefined ? data.id : '';
    this.roundWorkoutId = data.roundWorkoutId !== undefined ? data.roundWorkoutId : '';
    this.title = data.title !== undefined ? data.title : '';
    this.description = data.description !== undefined ? data.description : '';
    this.duration = data.duration !== undefined ? data.duration : 0;
    this.useAuthorContent = data.useAuthorContent !== undefined ? data.useAuthorContent : false;
    this.isCompleted = data.isCompleted !== undefined ? data.isCompleted : false;
    this.workoutStatus = data.workoutStatus !== undefined ? data.workoutStatus : WorkoutStatus.Archived;
    this.workoutRating = data.workoutRating !== undefined ? data.workoutRating : null;
    
    // Use constructors for nested objects
    this.exercises = Array.isArray(data?.exercises) 
      ? data.exercises.map((exercise: any) => {
          if (!exercise?.exercise) return null;
          return new ExerciseReference({
            exercise: new Exercise(exercise.exercise),
            groupId: exercise.groupId
          });
        }).filter(Boolean)
      : [];
        
    this.logs = Array.isArray(data?.logs)
      ? data.logs.map((log: any) => {
          if (!log?.exercise || !Array.isArray(log?.sets)) return null;
          return new ExerciseLog({
            exercise: new Exercise(log.exercise),
            sets: log.sets.map((set: any) => new RepsAndWeightLog(set))
          });
        }).filter(Boolean)
      : [];
    
    // Date handling
    this.startTime = data.startTime ? convertFirestoreTimestamp(data.startTime) : null;
    this.assignedDate = data.assignedDate ? convertFirestoreTimestamp(data.assignedDate) : null;
    this.createdAt = data.createdAt ? convertFirestoreTimestamp(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? convertFirestoreTimestamp(data.updatedAt) : new Date();
    
    this.order = data.order !== undefined ? data.order : null;

    // Author handling
    if (data.author?.username) {
      this.author = data.author.userId;
      workoutService.revertAuthorFormat(this.id, this.author);
    } else {
      this.author = data.author;
    }
    
    this.zone = data.zone !== undefined ? data.zone : BodyZone.FullBody;
    this.estimatedDuration = data.estimatedDuration || 45; // Default to 45 minutes
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

  /**
   * Returns primary body parts used in this workout
   * 
   * NOTE: Using 'any' type assertion to fix build error.
   * The actual data type from Exercise.primaryBodyParts is string[],
   * but the WorkoutSummary expects BodyPart[] enum values.
   * This is a temporary solution to make the build pass.
   */
  fetchPrimaryBodyParts(): BodyPart[] {
    return this.exercises.flatMap(exerciseRef => 
      exerciseRef.exercise.primaryBodyParts.map(part => part as any as BodyPart)
    );
  }

  /**
   * Returns secondary body parts used in this workout
   * 
   * NOTE: Using 'any' type assertion to fix build error.
   * The actual data type from Exercise.secondaryBodyParts is string[],
   * but the WorkoutSummary expects BodyPart[] enum values.
   * This is a temporary solution to make the build pass.
   */
  fetchSecondaryBodyParts(): BodyPart[] {
    return this.exercises.flatMap(exerciseRef => 
      exerciseRef.exercise.secondaryBodyParts.map(part => part as any as BodyPart)
    );
  }

  static estimatedDuration(exercises: ExerciseLog[]): number {
    let totalTimeSeconds = 0;
    let restTimeSeconds = 0;
    let hasScreenTimeExercises = false;

    for (const exerciseLog of exercises) {   
      const exercise = exerciseLog.exercise;
      const screenTime = exercise?.category?.details?.screenTime;

      if (screenTime && screenTime > 0) {
        totalTimeSeconds += screenTime;
        hasScreenTimeExercises = true;
      } else if (exercise?.category?.type === 'cardio') {
        const duration = exercise.category.details?.duration || 0;
        totalTimeSeconds += duration * 60;
      } else {
        totalTimeSeconds += 8 * 60; // 8 minutes
        restTimeSeconds += 60;      // 1 minute rest
      }
    }

    // Only add warmup/cooldown for non-screenTime exercises
    if (!hasScreenTimeExercises) {
      totalTimeSeconds += 10 * 60; // 10 minutes warmup/cooldown
    }

    const totalSeconds = totalTimeSeconds + restTimeSeconds;
    
    // For screenTime exercises, convert to minutes with one decimal place
    if (hasScreenTimeExercises) {
      const minutes = totalSeconds / 60;
      console.log('Final duration in minutes:', minutes);
      return Math.ceil(minutes * 10) / 10; // Round to 1 decimal place
    }
    
    // For non-screenTime exercises, round to nearest 5
    const totalMinutes = Math.round(totalSeconds / 60);
    return Math.round(totalMinutes / 5) * 5;
  }

  static determineWorkoutZone(exercises: ExerciseReference[]): BodyZone {
    const bodyPartsInvolved = new Set<BodyPart>();

    for (const exerciseRef of exercises) {
      for (const bodyPart of exerciseRef.exercise.primaryBodyParts || [exerciseRef.exercise.primaryBodyParts]) {
        bodyPartsInvolved.add(stringToBodyPart(bodyPart));
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
  userId: string;
  roundWorkoutId: string;
  exercises: ExerciseLog[];
  bodyParts: BodyPart[];
  secondaryBodyParts: BodyPart[];
  workoutTitle: string;
  caloriesBurned: number;
  workoutRating?: WorkoutRating | null;
  exercisesCompleted: ExerciseLog[];
  aiInsight: string;
  recommendations: string[];
  gifURLs?: string[];
  recommendedWork?: number;
  pulsePoints: PulsePoints;
  isCompleted: boolean;
  startTime: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date | null;
  duration: number = 0;  // Changed to number to match iOS

  constructor(data: any) {
      this.id = data.id || '';
      this.workoutId = data.workoutId || '';
      this.userId = data.userId || '';
      this.roundWorkoutId = data.roundWorkoutId || '';
      this.exercises = Array.isArray(data.exercises) 
          ? data.exercises.map((ex: any) => new ExerciseLog(ex))
          : [];
      this.bodyParts = Array.isArray(data.bodyParts)
          ? data.bodyParts
          : [];
      this.secondaryBodyParts = Array.isArray(data.secondaryBodyParts)
          ? data.secondaryBodyParts
          : [];
      this.workoutTitle = data.workoutTitle || '';
      this.caloriesBurned = data.caloriesBurned || 0;
      this.workoutRating = data.workoutRating;
      this.exercisesCompleted = Array.isArray(data.exercisesCompleted)
          ? data.exercisesCompleted.map((ex: any) => new ExerciseLog(ex))
          : [];
      this.aiInsight = data.aiInsight || '';
      this.recommendations = Array.isArray(data.recommendations)
          ? data.recommendations
          : [];
      this.gifURLs = data.gifURLs;
      this.recommendedWork = data.recommendedWork;
      this.pulsePoints = data.pulsePoints ? new PulsePoints(data.pulsePoints) : new PulsePoints({});
      this.isCompleted = data.isCompleted || false;
      this.startTime = convertFirestoreTimestamp(data.startTime);
      this.createdAt = convertFirestoreTimestamp(data.createdAt);
      this.updatedAt = convertFirestoreTimestamp(data.updatedAt);
      
      // Handle completedAt similar to iOS
      if (data.completedAt) {
          const completedAtTimestamp = data.completedAt;
          if (completedAtTimestamp === 0) {
              // Set to 72 minutes from createdAt like in iOS
              const completedDate = new Date(this.createdAt);
              completedDate.setMinutes(completedDate.getMinutes() + 72);
              this.completedAt = completedDate;
          } else {
              this.completedAt = convertFirestoreTimestamp(data.completedAt);
          }
      } else {
          this.completedAt = null;
      }

      this.duration = this.calculateDuration();
  }

  private calculateDuration(): number {
      if (!this.completedAt) return 0;
      const durationInSeconds = (this.completedAt.getTime() - this.createdAt.getTime()) / 1000;
      // Round to the nearest minute like in iOS
      return Math.round((durationInSeconds + 30) / 60);
  }

  determineWorkoutType(): string {
      // Create sets of body parts for each category
      const upperBodyParts = new Set([
          BodyPart.Chest,
          BodyPart.Shoulders,
          BodyPart.Biceps,
          BodyPart.Triceps,
          BodyPart.Traps,
          BodyPart.Lats,
          BodyPart.Forearms
      ]);
      const lowerBodyParts = new Set([
          BodyPart.Hamstrings,
          BodyPart.Glutes,
          BodyPart.Quadriceps,
          BodyPart.Calves
      ]);
      const coreParts = new Set([
          BodyPart.Abs,
          BodyPart.Lowerback
      ]);

      // Get all body parts involved in the workout
      const bodyPartsInvolved = new Set<BodyPart>();
      this.exercises.forEach(log => {
          log.exercise.primaryBodyParts.forEach(part => bodyPartsInvolved.add(stringToBodyPart(part)));
      });

      // Check which areas are targeted
      const hasUpperBody = Array.from(bodyPartsInvolved).some(part => upperBodyParts.has(part));
      const hasLowerBody = Array.from(bodyPartsInvolved).some(part => lowerBodyParts.has(part));
      const hasCore = Array.from(bodyPartsInvolved).some(part => coreParts.has(part));

      // Determine workout type using the same logic as iOS
      if ((hasUpperBody && hasLowerBody && hasCore) || (hasUpperBody && hasLowerBody)) {
          return WorkoutType.FullBody;
      } else if (hasUpperBody && hasCore || hasUpperBody) {
          return WorkoutType.UpperBody;
      } else if (hasLowerBody && hasCore || hasLowerBody) {
          return WorkoutType.LowerBody;
      } else if (hasCore) {
          return WorkoutType.Core;
      }
      return WorkoutType.FullBody;  // Default return like iOS
  }

  fetchTotalWeightLifted(user: User): number {
      return this.exercisesCompleted.reduce((total, exercise) => {
          return total + exercise.fetchTotalWeightLifted(user);
      }, 0);
  }

  fetchTotalWorkScore(user: User, workoutId: string | null, workoutSummaries: WorkoutSummary[]): number {
      return this.exercisesCompleted.reduce((total, exercise) => {
          if (exercise.logSubmitted) {
              return total + exercise.calculateWorkScore(user, workoutId, workoutSummaries);
          }
          return total;
      }, 0);
  }

  fetchPreviousWorkScore(user: User, workoutId: string | null, summaries: WorkoutSummary[]): number {
    const currentWorkoutType = this.determineWorkoutType();
    
    // Find the most recent matching summary
    const matchingSummary = summaries
        .filter(s => s.determineWorkoutType() === currentWorkoutType)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .find(s => s.workoutId !== this.workoutId);

    if (matchingSummary) {
        // Fix: Pass summaries as the third argument and use proper addition
        return matchingSummary.exercisesCompleted.reduce((total, exercise) => 
            total + exercise.calculateWorkScore(user, workoutId, summaries), 0); // Start with 0 as initial value
    }

    return 0;
}

  createTotalWorkString(user: User, workoutId: string, workoutSummaries: WorkoutSummary[]): string {
      const totalWork = this.fetchTotalWorkScore(user, workoutId, workoutSummaries);
      return totalWork.toString();
  }

  toDictionary(): { [key: string]: any } {
      const dict: { [key: string]: any } = {
          id: this.id,
          workoutId: this.workoutId,
          userId: this.userId,
          roundWorkoutId: this.roundWorkoutId,
          exercises: this.exercises.map(ex => ex.toDictionary()),
          bodyParts: this.bodyParts,
          secondaryBodyParts: this.secondaryBodyParts,
          workoutTitle: this.workoutTitle,
          caloriesBurned: this.caloriesBurned,
          workoutRating: this.workoutRating?.toString() || '',
          exercisesCompleted: this.exercisesCompleted.map(ex => ex.toDictionary()),
          aiInsight: this.aiInsight,
          recommendations: this.recommendations,
          recommendedWork: this.recommendedWork || '',
          pulsePoints: this.pulsePoints.toDictionary(),
          isCompleted: this.isCompleted,
          startTime: dateToUnixTimestamp(this.startTime),
          createdAt: dateToUnixTimestamp(this.createdAt),
          updatedAt: dateToUnixTimestamp(this.updatedAt),
          completedAt: this.completedAt ? dateToUnixTimestamp(this.completedAt) : 0
      };

      if (this.gifURLs) {
          dict.gifURLs = this.gifURLs;
      }

      return dict;
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
export class SweatlistIdentifiers {
  id: string;
  sweatlistAuthorId: string;
  sweatlistName: string;
  order: number;
  isRest?: boolean;

  constructor(data: any) {
    this.id = data.id || '';
    this.sweatlistAuthorId = data.sweatlistAuthorId || '';
    this.sweatlistName = data.sweatlistName || '';
    this.order = data.order || 0;
    this.isRest = data.isRest || false;
  }

  toDictionary(): { [key: string]: any } {
    return {
      id: this.id,
      sweatlistAuthorId: this.sweatlistAuthorId,
      sweatlistName: this.sweatlistName,
      order: this.order,
      isRest: this.isRest
    };
  }
}

// Enum for sweatlist type matching Swift implementation
export enum SweatlistType {
  Together = 'together',
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
    
    this.sweatlistIds = (data.sweatlistIds || []).map((item: any) => 
      new SweatlistIdentifiers(item)
    );
    // If ownerId is not an array, wrap it in an array.
    if (Array.isArray(data.ownerId)) {
      this.ownerId = data.ownerId;
    } else if (data.ownerId) {
      this.ownerId = [data.ownerId];
    } else {
      this.ownerId = [];
    }
    this.privacy = this.challenge ? SweatlistType.Together : SweatlistType.Locked;
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
      sweatlistIds: this.sweatlistIds.map(item => item.toDictionary()), 
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

export class PulsePoints {
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
  shareBonus: number;
  referralBonus: number;

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
    this.shareBonus = data.shareBonus ?? 0;
    this.referralBonus = data.referralBonus ?? 0;
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
    return this.totalStackPoints + this.totalCommunityPoints + this.cumulativeStreakBonus + this.shareBonus + this.referralBonus;
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
      shareBonus: this.shareBonus,
      referralBonus: this.referralBonus,
      totalStackPoints: this.totalStackPoints,
      totalCommunityPoints: this.totalCommunityPoints,
      totalPoints: this.totalPoints,
    };
  }
}

export class Encouragement {
  fromUser: ShortUser;
  toUser: ShortUser;
  createdAt: Date;
 
  constructor(data: any) {
    // If data is passed as already constructed ShortUser objects
    if (data.fromUser instanceof ShortUser && data.toUser instanceof ShortUser) {
      this.fromUser = data.fromUser;
      this.toUser = data.toUser;
      this.createdAt = data.createdAt instanceof Date ? data.createdAt : new Date();
    } 
    // If data is coming from Firestore/dictionary
    else {
      const fromUserData = data.fromUser || {};
      this.fromUser = new ShortUser(fromUserData);
      
      const toUserData = data.toUser || {};
      this.toUser = new ShortUser(toUserData);
      
      this.createdAt = convertFirestoreTimestamp(data.createdAt);
    }
  }
 
  // Static method to create from separate parameters
  static create(fromUser: ShortUser, toUser: ShortUser, createdAt: Date): Encouragement {
    return new Encouragement({
      fromUser,
      toUser, 
      createdAt
    });
  }
 
  // Convert to dictionary for Firestore
  toDictionary(): { [key: string]: any } {
    return {
      fromUser: this.fromUser.toDictionary(),
      toUser: this.toUser.toDictionary(),
      createdAt: dateToUnixTimestamp(this.createdAt)
    };
  }
 }

// Types for user in challenge
class UserChallenge {
  id: string;
  challenge?: Challenge;
  challengeId: string;
  userId: string;
  fcmToken: string;          // Added
  username: string;
  profileImage?: ProfileImage;
  progress: number;
  referralChain: ReferralChain;  // Changed from referralChains to match iOS
  completedWorkouts: { id: string; workoutId: string; completedAt: Date }[];
  isCompleted: boolean;
  uid: string;               // Added
  location?: UserLocation;
  city: string;
  country?: string;
  timezone?: string;
  joinDate: Date;
  isCurrentlyActive: boolean;  // Added
  createdAt: Date;
  updatedAt: Date;
  lastActive?: Date | null;   // New property for tracking last activity
  pulsePoints: PulsePoints;
  currentStreak: number;
  longestStreak: number;      // Added
  encouragedUsers: Encouragement[];  // Changed from string[] to Encouragement[]
  encouragedByUsers: Encouragement[];  // Changed from string[] to Encouragement[]
  checkIns: CheckIn[];
  hasReceivedShareBonus: boolean;

  constructor(data: any) {
    this.id = data.id;
    this.challenge = data.challenge ? new Challenge(data.challenge) : undefined;
    this.challengeId = data.challengeId || '';
    this.userId = data.userId || '';
    this.fcmToken = data.fcmToken || '';  // Added
    this.username = data.username || '';
    this.profileImage = data.profileImage ? new ProfileImage(data.profileImage) : undefined;
    this.progress = data.progress ?? 0;
    this.referralChain = data.referralChain ? new ReferralChain(data.referralChain) : new ReferralChain({ originalHostId: '', sharedBy: '' });
    this.completedWorkouts = Array.isArray(data.completedWorkouts)
      ? data.completedWorkouts
          .map((cw: any) => ({
            id: cw.id || '',
            workoutId: cw.workoutId || '', // Ensure workoutId is a string, default to empty
            completedAt: convertFirestoreTimestamp(cw.completedAt), // Handle potential null/undefined timestamp
          }))
          .filter((cw: { id: string; workoutId: string; completedAt: Date }) => cw.workoutId !== '') // Filter out those where workoutId ended up empty
      : [];
    this.isCompleted = data.isCompleted ?? false;
    this.uid = data.uid || '';  // Added
    this.location = data.location ? new UserLocation(data.location) : undefined;
    this.city = data.city || '';
    this.country = data.country || '';
    this.timezone = data.timezone || '';
    this.joinDate = convertFirestoreTimestamp(data.joinDate);
    this.isCurrentlyActive = data.isCurrentlyActive ?? false;  // Added
    this.createdAt = convertFirestoreTimestamp(data.createdAt);
    this.updatedAt = convertFirestoreTimestamp(data.updatedAt);
    this.lastActive = data.lastActive ? convertFirestoreTimestamp(data.lastActive) : null;  // Initialize the new property
    this.pulsePoints = data.pulsePoints ? new PulsePoints(data.pulsePoints) : new PulsePoints({});
    this.currentStreak = data.currentStreak ?? 0;
    this.longestStreak = this.calculateLongestStreak();  // Added
    this.encouragedUsers = Array.isArray(data.encouragedUsers)
      ? data.encouragedUsers.map((d: any) => new Encouragement(d))
      : [];
    this.encouragedByUsers = Array.isArray(data.encouragedByUsers)
      ? data.encouragedByUsers.map((d: any) => new Encouragement(d))
      : [];
    this.checkIns = Array.isArray(data.checkIns)
      ? data.checkIns.map((d: any) => new CheckIn(d))
      : [];
    this.hasReceivedShareBonus = data.hasReceivedShareBonus ?? false;
  }

  // Add calculateLongestStreak method
  private calculateLongestStreak(): number {
    if (!this.completedWorkouts.length) return 0;

    let currentStreak = 1;
    let maxStreak = 1;
    const sortedWorkouts = [...this.completedWorkouts].sort(
      (a, b) => a.completedAt.getTime() - b.completedAt.getTime()
    );

    for (let i = 1; i < sortedWorkouts.length; i++) {
      const prevDate = new Date(sortedWorkouts[i - 1].completedAt);
      const currDate = new Date(sortedWorkouts[i].completedAt);
      
      if (this.isNextDay(prevDate, currDate)) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else if (!this.isSameDay(prevDate, currDate)) {
        currentStreak = 1;
      }
    }

    return maxStreak;
  }

  private isNextDay(date1: Date, date2: Date): boolean {
    const nextDay = new Date(date1);
    nextDay.setDate(nextDay.getDate() + 1);
    return this.isSameDay(nextDay, date2);
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  toDictionary(): any {
    return {
      challenge: this.challenge ? this.challenge.toDictionary() : null,
      challengeId: this.challengeId,
      userId: this.userId,
      fcmToken: this.fcmToken,  // Added
      username: this.username,
      profileImage: this.profileImage ? this.profileImage.toDictionary() : null,
      progress: this.progress,
      referralChain: this.referralChain.toDictionary(),  // Changed from referralChains
      completedWorkouts: this.completedWorkouts.map(workout => ({
        ...workout,
        completedAt: dateToUnixTimestamp(workout.completedAt)
      })),
      isCompleted: this.isCompleted,
      uid: this.uid,  // Added
      location: this.location ? this.location.toDictionary() : null,
      city: this.city,
      country: this.country,
      timezone: this.timezone,
      joinDate: dateToUnixTimestamp(this.joinDate),
      isCurrentlyActive: this.isCurrentlyActive,  // Added
      createdAt: dateToUnixTimestamp(this.createdAt),
      updatedAt: dateToUnixTimestamp(this.updatedAt),
      lastActive: this.lastActive ? dateToUnixTimestamp(this.lastActive) : null,  // Include lastActive in serialization
      pulsePoints: this.pulsePoints.toDictionary(),
      currentStreak: this.currentStreak,
      longestStreak: this.longestStreak,  // Added
      encouragedUsers: this.encouragedUsers.map(user => user.toDictionary()),
      encouragedByUsers: this.encouragedByUsers.map(user => user.toDictionary()),
      checkIns: this.checkIns.map(checkIn => checkIn.toDictionary()),
      hasReceivedShareBonus: this.hasReceivedShareBonus
    };
  }
}

// Challenge status enum
enum ChallengeStatus {
  Draft = 'draft',
  Published = 'published',
  Active = 'active',
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
  status: ChallengeStatus;
  introVideos: IntroVideo[];
  privacy: SweatlistType;
  pin?: string;
  startDate: Date;
  ownerId: string[];
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Cohort-related properties
  originalId: string;
  joinWindowEnds: Date;
  minParticipants: number;
  maxParticipants: number;
  allowLateJoins: boolean;
  cohortAuthor: string[];
  pricingInfo: PricingInfo;
  
  // Computed property
  durationInDays: number;
  isChallengeEnded: boolean;

  constructor(data: {
    id: string;
    title: string;
    subtitle: string;
    participants?: UserChallenge[];
    status?: ChallengeStatus;
    introVideos?: IntroVideo[];
    privacy?: SweatlistType;
    pin?: string;
    startDate: Date;
    ownerId: string[];
    endDate: Date;
    createdAt: Date;
    updatedAt: Date;
    originalId?: string;
    joinWindowEnds?: Date;
    minParticipants?: number;
    maxParticipants?: number;
    allowLateJoins?: boolean;
    cohortAuthor?: string[];
    pricingInfo?: PricingInfo;
  }) {
    this.id = data.id;
    this.title = data.title;
    this.subtitle = data.subtitle;
    this.participants = Array.isArray(data.participants) ? data.participants : [];    
    this.status = data.status || ChallengeStatus.Draft;
    this.introVideos = data.introVideos || [];
    this.privacy = data.privacy || SweatlistType.Together;
    this.pin = data.pin;
    this.startDate = convertFirestoreTimestamp(data.startDate);
    this.ownerId = data.ownerId;
    this.endDate = convertFirestoreTimestamp(data.endDate);
    this.createdAt = convertFirestoreTimestamp(data.createdAt);
    this.updatedAt = convertFirestoreTimestamp(data.updatedAt);
    
    this.originalId = data.originalId || data.id;
    this.joinWindowEnds = data.joinWindowEnds || new Date(this.startDate.getTime() + (48 * 3600 * 1000));
    this.minParticipants = data.minParticipants || 1;
    this.maxParticipants = data.maxParticipants || 100;
    this.allowLateJoins = data.allowLateJoins !== undefined ? data.allowLateJoins : true;
    this.cohortAuthor = data.cohortAuthor || [];
    this.pricingInfo = new PricingInfo(data.pricingInfo);

    // Calculate duration and end status after initializing dates
    this.durationInDays = this.calculateDurationInDays();
    this.isChallengeEnded = new Date() > this.endDate;
    
    if (this.isChallengeEnded) {
      this.status = ChallengeStatus.Completed;
    }
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
      pin: this.pin ?? null,
      startDate: dateToUnixTimestamp(this.startDate),
      endDate: dateToUnixTimestamp(this.endDate),
      createdAt: dateToUnixTimestamp(this.createdAt),
      updatedAt: dateToUnixTimestamp(this.updatedAt),
      durationInDays: this.durationInDays,
      introVideos: this.introVideos.map(video => video.toDictionary()),
      pricingInfo: this.pricingInfo.toDictionary(),
      cohortAuthor: this.cohortAuthor,
      isChallengeEnded: this.isChallengeEnded,
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
        })),
        pricingInfo: obj.pricingInfo.toDictionary(),
        cohortAuthor: obj.cohortAuthor,
        durationInDays: obj.durationInDays,
        isChallengeEnded: obj.isChallengeEnded,
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
  ttclid?: string;
}

export type {
  ProfileImage,
  UserLocation,
  ChallengeInvitationProps
};

export { ChallengeStatus, Challenge, UserChallenge };

export class PricingInfo {
  isEnabled: boolean;
  amount: number;
  currency: string;

  constructor(data: any = {}) {
    this.isEnabled = data.isEnabled ?? false;
    this.amount = data.amount ?? 0.0;
    this.currency = data.currency ?? "USD";
  }

  toDictionary(): any {
    return {
      isEnabled: this.isEnabled,
      amount: this.amount,
      currency: this.currency
    };
  }

  static fromDictionary(dict: any): PricingInfo {
    return new PricingInfo(dict || {});
  }
}

// NEW TYPES -------------------------------------------------------------
// These interfaces mirror the Swift structs `ExerciseWeeklyStats` and `WeeklyWorkoutData`
// used on iOS for the round wrap‑up analytics. They will be consumed by the
// web `RoundWrapup` page to render week‑over‑week charts and detailed
// exercise statistics.

/**
 * Aggregate stats for a single exercise (per week)
 */
export interface ExerciseWeeklyStats {
  /** Unique identifier */
  id: string;
  /** Plain name of the exercise */
  exerciseName: string;
  /** Primary muscle group name (human readable – e.g. "Chest") */
  muscleGroup: string;
  /** Total weight lifted for this exercise in the given week */
  totalWeight: number;
  /** Total repetitions performed for this exercise in the given week */
  totalReps: number;
  /** Convenience – totalWeight / totalReps (NaN‑safe) */
  averageLoadPerRep: number;
}

/**
 * Consolidated workout statistics for a single calendar week
 * (Sunday – Saturday) within a challenge/round.
 */
export interface WeeklyWorkoutData {
  /**  ISO string representing week start (00:00:00 of Sunday) */
  weekStartDate: Date;
  /**  ISO string representing week end (23:59:59 of Saturday) */
  weekEndDate: Date;
  /** Number of sets performed */
  totalSets: number;
  /** Number of reps performed */
  totalReps: number;
  /** Aggregate volume = Σ (weight * reps) */
  totalVolume: number;
  /** Aggregate weight (same as totalVolume for now) */
  totalWeight: number;
  /** Counts of how many times each exercise appears */
  exerciseCounts: Record<string, number>;
  /** Volume distribution by muscle group – reps */
  muscleGroupSets: Record<string, number>;
  /** Volume distribution by muscle group – weight */
  muscleGroupWeight: Record<string, number>;
  /** Detailed per‑exercise stats */
  exerciseStats: ExerciseWeeklyStats[];

  /**
   * Convenience label – example "Jan 1‑7". Left for consumer to compute if needed
   * but included here for parity with iOS.
   */
  weekLabel?: string;
}
// ----------------------------------------------------------------------
