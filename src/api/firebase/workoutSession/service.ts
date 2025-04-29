// workoutSessionService.ts
import { WorkoutSummary, Workout, WorkoutStatus, UserChallenge, PulsePoints } from '../../firebase/workout';
import { 
  ExerciseLog, 
  ExerciseCategory, 
  WeightTrainingExercise, // Renamed from WeightTrainingDetails for clarity
  CardioExercise,       // Renamed from CardioDetails
  MobilityExercise,      // Renamed from MobilityDetails
  Exercise                // Ensure Exercise is imported if needed for type checks
} from '../../firebase/exercise/types'; 
import { User } from '../../firebase/user/types';
import { workoutService } from '../../firebase/workout/service';
import { userService } from '../../firebase/user/service';
import { store } from '../../../redux/store';
import { resetWorkoutState } from '../../../redux/workoutSlice';
import { db } from '../../../api/firebase/config';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { dateToUnixTimestamp, convertFirestoreTimestamp } from '../../../utils/formatDate';

interface CompletedWorkout {
  id: string;
  workoutId: string;
  completedAt: Date; // Changed from number to Date
}

export class WorkoutSessionService {
  private static instance: WorkoutSessionService;
  
  // State management
  private isInProgress: boolean = false;
  private startTime?: Date;
  private currentWorkout?: Workout;
  private currentWorkoutSummary?: WorkoutSummary;
  private suggestedWorkScore?: number;
  completedExercises: ExerciseLog[] = [];

  // Singleton pattern
  static getInstance() {
    if (!WorkoutSessionService.instance) {
      WorkoutSessionService.instance = new WorkoutSessionService();
    }
    return WorkoutSessionService.instance;
  }

  // Helper functions
  private estimateCaloriesBurnedLocally(
    exercises: ExerciseLog[],
    totalDurationSeconds: number, // Renamed for clarity
    userWeightKg: number
  ): number {
    const totalHours = totalDurationSeconds / 3600;
    if (exercises.length === 0 || totalHours <= 0 || userWeightKg <= 0) {
      return 0; // Cannot estimate without necessary data
    }

    let totalCalories = 0.0;
    const durationPerExerciseHours = totalHours / exercises.length;

    for (const exerciseLog of exercises) {
      if (!exerciseLog.exercise) continue; // Skip if exercise data is missing

      const category: ExerciseCategory = exerciseLog.exercise.category as ExerciseCategory || { type: 'weight-training' }; // Provide a default if undefined
      const met = this.getMETValue(category);
      const reps = this.getRepsCompleted(category);
      const weightKg = this.getWeight(category); // Assuming weight is stored in kg

      const exerciseCalories = this.calculateExerciseCalories(
        met,
        durationPerExerciseHours,
        userWeightKg,
        reps,
        weightKg
      );
      
      totalCalories += exerciseCalories;
    }

    return Math.round(totalCalories);
  }

  private getMETValue(category: ExerciseCategory): number {
    const baseMETValues: { [key: string]: number } = {
      'weight-training': 3.5,
      'cardio': 8.0,
      'mobility': 2.5
      // Add other category types if needed
    };

    switch (category.type) {
      case 'weight-training': {
        const details = category.details as WeightTrainingExercise | undefined;
        const baseMET = baseMETValues[category.type] ?? 3.5;
        const weight = details?.weight ?? 0;
        return weight > 0 ? Math.min(baseMET * (1 + (weight / 100)), baseMET * 2.0) : baseMET;
      }
      case 'cardio': {
        const details = category.details as CardioExercise | undefined;
        const bpm = details?.bpm ?? 0;
        if (bpm > 0) {
          if (bpm < 120) return 6.0;
          if (bpm < 140) return 8.0;
          if (bpm < 160) return 10.0;
          if (bpm < 180) return 12.0;
          return 14.0;
        }
        return baseMETValues[category.type] ?? 8.0;
      }
      case 'mobility': {
        const details = category.details as MobilityExercise | undefined;
        const baseMET = baseMETValues[category.type] ?? 2.5; // Use Mobility base MET
        const weight = details?.weight ?? 0;
        return weight > 0 ? Math.min(baseMET * (1 + (weight / 100)), baseMET * 2.0) : baseMET;
      }
      // Add cases for 'pilates', 'stretching', 'calisthenics' if needed
      default:
        return 3.0; // Default MET for unknown categories
    }
  }

  private getRepsCompleted(category: ExerciseCategory): number {
     switch (category.type) {
       case 'weight-training':
       case 'mobility': {
         const details = category.details as WeightTrainingExercise | MobilityExercise | undefined;
         return Array.isArray(details?.reps) 
           ? details.reps.reduce((sum: number, rep: string | number) => sum + (Number(rep) || 0), 0) 
           : 0;
       }
       case 'cardio':
       case 'stretching': // Stretching might not have reps in the same way
       case 'pilates':    // Pilates might focus on duration or qualitative reps
         return 0; 
       case 'calisthenics': {
           const details = category.details as any; // Use specific type if available
           return Array.isArray(details?.reps) 
             ? details.reps.reduce((sum: number, rep: string | number) => sum + (Number(rep) || 0), 0) 
             : 0;
       }
       default:
         return 0;
     }
  }

  private getWeight(category: ExerciseCategory): number {
    switch (category.type) {
      case 'weight-training':
      case 'mobility': { // Mobility might involve weights (e.g., weighted stretches)
        const details = category.details as WeightTrainingExercise | MobilityExercise | undefined;
        return details?.weight ?? 0.0; 
      }
      case 'cardio':
      case 'stretching':
      case 'pilates':
      case 'calisthenics': // Typically bodyweight
        return 0.0;
      default:
        return 0.0;
    }
  }

  private calculateExerciseCalories(
    met: number,
    durationHours: number,
    userWeightKg: number,
    reps: number,
    weightKg: number
  ): number {
    // Base calories from MET calculation
    const metCalories = met * userWeightKg * durationHours;

    // Additional calories from resistance work (only if reps and weight > 0)
    const resistanceCalories = (reps > 0 && weightKg > 0) 
      ? this.calculateResistanceCalories(reps, weightKg, durationHours) 
      : 0;

    return metCalories + resistanceCalories;
  }

  private calculateResistanceCalories(
    reps: number,
    weightKg: number,
    durationHours: number
  ): number {
    const repCalories = reps * weightKg * 0.0005;
    const durationFactor = 1 + (durationHours * 0.5); // Matches iOS logic
    return repCalories * durationFactor;
  }

  private cleanUpWorkoutInProgress() {
    this.isInProgress = false;
    this.startTime = undefined;
    // Reset current workout
    this.currentWorkout = undefined;
    this.currentWorkoutSummary = undefined;
    store.dispatch(resetWorkoutState());

  }

  private async updateWorkoutServices(workoutSummary: WorkoutSummary): Promise<void> {
    try {
      const userId = userService.nonUICurrentUser?.id;
      if (!userId) throw new Error('No authenticated user');
  
      // Save to Firestore using workoutService
      await workoutService.updateWorkoutSummary({
        userId,
        workoutId: workoutSummary.workoutId,
        summary: workoutSummary
      });
    } catch (error) {
      console.error('Error saving workout summary:', error);
      throw error;
    }
  }

  private validateWorkoutState(): 'allEmpty' | 'valid' {
    const isAnyLogSubmitted = this.completedExercises.some(log => log.logSubmitted);
    
    return isAnyLogSubmitted ? 'valid' : 'allEmpty'; 
  }

  private async updateWorkoutSession(
    workout: Workout,
    exerciseLogs: ExerciseLog[],
    workoutId: string
  ): Promise<void> {
    try {
      const userId = userService.nonUICurrentUser?.id;
      if (!userId) {
        throw new Error('No authenticated user');
      }

      const workoutRef = doc(db, 'users', userId, 'workoutSessions', workoutId);

      // Update workout with timestamps from logs
      const newWorkout = new Workout({
        ...workout,
        createdAt: exerciseLogs[0]?.createdAt ?? new Date(),
        updatedAt: exerciseLogs[0]?.updatedAt ?? new Date()
      });

      this.currentWorkout = newWorkout;

      // Update the workout session document
      await setDoc(workoutRef, newWorkout.toDictionary());
      console.log(`Workout session updated successfully at user - ${userId} -> workoutsession: ${newWorkout.id}`);

      // Update all logs within the workout session
      const batch = writeBatch(db);
      
      exerciseLogs.forEach(log => {
        const logRef = doc(workoutRef, 'logs', log.id);
        batch.set(logRef, log.toDictionary());
      });

      await batch.commit();
      console.log('Exercise logs updated successfully');

    } catch (error) {
      console.error('Error updating workout session:', error);
      throw new Error('Failed to update workout session');
    }
  }
  
  // Main functions
  async endWorkout(
    user: User, 
    workout: Workout, 
    userChallenge: UserChallenge | null,
    startTime: Date, 
    endTime: Date
  ): Promise<{ status: WorkoutStatus; workoutSummary?: WorkoutSummary }> {
    this.currentWorkout = workout;
    const workoutState = this.validateWorkoutState();
  
    try {
      let result;
      switch (workoutState) {
        case 'allEmpty':
          if (this.completedExercises.some(log => log.logSubmitted)) {
            result = await this.processWorkoutCompletion(user, userChallenge, startTime, endTime);
          } else {
            throw new Error("No logs submitted");
          }
          break;
        case 'valid':
          result = await this.processWorkoutCompletion(user, userChallenge, startTime, endTime);
          break;
      }

      // Update the workout session with completed status
      const updatedWorkout = new Workout({
        ...workout,
        workoutStatus: WorkoutStatus.Complete,
        isCompleted: true,
        completedAt: endTime
      });

      await this.updateWorkoutSession(
        updatedWorkout,
        this.completedExercises,
        workout.id
      );

      // Clear the workout session state
      this.cleanUpWorkoutInProgress();

      return result;
    } catch (error) {
      throw error;
    }
  }
  
    // Then also update processWorkoutCompletion to handle null userChallenge
    private async processWorkoutCompletion(
        user: User,
        userChallenge: UserChallenge | null,
        startTime: Date,
        endTime: Date
      ): Promise<{ status: WorkoutStatus; workoutSummary?: WorkoutSummary }> {
        if (!this.currentWorkout) {
          throw new Error("No current workout");
        }
      
        const suggestedWorkScore = this.currentWorkoutSummary?.recommendedWork ?? 0;
        const workoutSummary = this.createWorkoutSummary(
          user,
          this.currentWorkout,
          suggestedWorkScore,
          startTime,
          endTime
        );
      
        const durationSeconds = (endTime.getTime() - startTime.getTime()) / 1000; // Duration in seconds
        // *** UPDATE: Use user's weight and completed exercises for estimation ***
        const userWeightKg = user.bodyWeight?.length > 0 ? user.bodyWeight[user.bodyWeight.length - 1].newWeight : 70; // Default to 70kg if not available
        const caloriesBurned = this.estimateCaloriesBurnedLocally(
          workoutSummary.exercisesCompleted, // Pass completed logs
          durationSeconds,                   // Pass duration in seconds
          userWeightKg                       // Pass user weight in kg
        );
      
        const finalSummary = await this.finalizeWorkoutSummary(
          workoutSummary,
          userChallenge,
          this.currentWorkout.roundWorkoutId,
          caloriesBurned,
          startTime,
          endTime
        );
      
        return {
          status: WorkoutStatus.Complete,
          workoutSummary: finalSummary
        };
      }
  
  private createWorkoutSummary(
    user: User,
    workout: Workout,
    suggestedWorkScore: number,
    startTime: Date,
    endTime: Date
  ): WorkoutSummary {
    const logs = this.completedExercises.filter(
      log => log.logSubmitted && this.isLogComplete(log)
    );
  
    // Create the data object that matches our constructor
    const summaryData = {
      id: workout.id,
      workoutId: workout.id,
      exercises: this.completedExercises,
      bodyParts: workout.fetchPrimaryBodyParts(),
      secondaryBodyParts: workout.fetchSecondaryBodyParts(),
      workoutTitle: workout.title,
      caloriesBurned: 0,
      workoutRating: undefined,
      exercisesCompleted: logs,
      aiInsight: '', // Initialize with empty string
      recommendations: [], // Initialize with empty array
      gifURLs: undefined,
      recommendedWork: suggestedWorkScore,
      isCompleted: true,
      createdAt: startTime,
      updatedAt: new Date(),
      completedAt: endTime,
      duration: this.calculateDuration(startTime, endTime)
    };
  
    // Use the constructor to create the WorkoutSummary instance
    return new WorkoutSummary(summaryData);
  }
  
  private calculateDuration(startTime: Date, endTime: Date): string {
    const durationInMillis = endTime.getTime() - startTime.getTime();
    const minutes = Math.floor(durationInMillis / (1000 * 60));
    return `${minutes} min`;
  }
  
  private isWorkoutAssignedForToday(): boolean {
    if (!this.currentWorkout?.assignedDate) {
      return false;
    }
  
    const today = new Date();
    const assignedDate = new Date(this.currentWorkout.assignedDate);
  
    return (
      assignedDate.getFullYear() === today.getFullYear() &&
      assignedDate.getMonth() === today.getMonth() &&
      assignedDate.getDate() === today.getDate()
    );
  }
  
  private async updateChallengeIfNeeded(
    currentWorkoutSummary: WorkoutSummary,
    userChallenge: UserChallenge | null,
    challengeWorkoutId: string 
  ): Promise<WorkoutSummary> {
    if (!userChallenge || !this.currentWorkout) {
      console.log("[updateChallengeIfNeeded] No userChallenge or currentWorkout, skipping update.");
      return currentWorkoutSummary; 
    }

    let updatedChallenge = { ...userChallenge }; 
    const completionDate = new Date();
    const newId = `${challengeWorkoutId}-${completionDate.getTime()}`;

    const newCompletedWorkout: CompletedWorkout = {
      id: newId,
      workoutId: challengeWorkoutId, 
      completedAt: completionDate, 
    };
    
    if (!Array.isArray(updatedChallenge.completedWorkouts)) {
      updatedChallenge.completedWorkouts = [];
    }
    updatedChallenge.completedWorkouts.push(newCompletedWorkout);

    if (!updatedChallenge.pulsePoints) {
        updatedChallenge.pulsePoints = new PulsePoints({}); 
    }
    if (!currentWorkoutSummary.pulsePoints) {
        updatedChallenge.pulsePoints = new PulsePoints({}); 
    }

    // --- Point Calculation Logic ---
    const baseCompletionPoints = 100;
    let firstCompletionPoints = 0;
    let newCumulativeStreakBonus = 0;

    updatedChallenge.pulsePoints.baseCompletion += baseCompletionPoints; 

    if (updatedChallenge.completedWorkouts.length === 1) {
      firstCompletionPoints = 50;
      updatedChallenge.pulsePoints.firstCompletion += firstCompletionPoints;
    }

    const currentStreak = this.calculateStreak(updatedChallenge as UserChallenge, completionDate);
    updatedChallenge.currentStreak = currentStreak; 
    
    const dailyStreakPoints = currentStreak * 25; 

    const assignedDate = this.currentWorkout.assignedDate; 
    const isAssignedToday = assignedDate ? this.isSameDay(assignedDate, completionDate) : false;

    if (isAssignedToday) {
      newCumulativeStreakBonus = dailyStreakPoints;
      updatedChallenge.pulsePoints.cumulativeStreakBonus = newCumulativeStreakBonus;
    }

    updatedChallenge.pulsePoints.streakBonus = 0; 
    
    const sessionPulsePoints = new PulsePoints({
      ...currentWorkoutSummary.pulsePoints?.toDictionary(),
      baseCompletion: baseCompletionPoints,
      firstCompletion: firstCompletionPoints,
      streakBonus: 0, 
      cumulativeStreakBonus: isAssignedToday ? newCumulativeStreakBonus : 0, 
    });

    let updatedSummary = new WorkoutSummary({ 
        ...currentWorkoutSummary.toDictionary(),
        pulsePoints: sessionPulsePoints.toDictionary() 
    }); 

    updatedChallenge.isCurrentlyActive = false;

    // --- Save Updated Challenge --- 
    try {
        await workoutService.updateUserChallenge(updatedChallenge as any); 
        console.log("[updateChallengeIfNeeded] User challenge updated successfully.");
    } catch (error) {
        console.error("[updateChallengeIfNeeded] Error updating user challenge:", error);
    }

    console.log("[updateChallengeIfNeeded] Updated summary points:", updatedSummary.pulsePoints);
    return updatedSummary; 
  }

  private calculateStreak(challenge: UserChallenge, newCompletionDate: Date): number {
    const completedWorkouts = Array.isArray(challenge.completedWorkouts) ? challenge.completedWorkouts : [];
    if (completedWorkouts.length === 0) return 1; 
    
    // *** FIX: Map directly to Date objects, assuming cw.completedAt is compatible ***
    const sortedDates = completedWorkouts
      .map((cw: CompletedWorkout) => convertFirestoreTimestamp(cw.completedAt)) // convertFirestoreTimestamp should handle potential Timestamps
      .filter((date): date is Date => date instanceof Date) // Ensure conversion resulted in a Date
      .sort((a, b) => a.getTime() - b.getTime()); 

    sortedDates.push(newCompletionDate);

    let currentStreak = 0;
    if (sortedDates.length > 0) {
        currentStreak = 1; 
    }

    for (let i = sortedDates.length - 2; i >= 0; i--) {
      const previousDate = sortedDates[i];
      const currentDate = sortedDates[i + 1];

      if (this.isNextDay(previousDate, currentDate)) {
        currentStreak++;
      } else if (!this.isSameDay(previousDate, currentDate)) {
        break; 
      }
    }

    console.log(`[calculateStreak] Calculated streak: ${currentStreak}`);
    return currentStreak;
  }

  private isNextDay(date1: Date, date2: Date): boolean {
    const nextDay = new Date(date1);
    nextDay.setDate(date1.getDate() + 1);
    return this.isSameDay(nextDay, date2);
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  private async finalizeWorkoutSummary(
    workoutSummary: WorkoutSummary,
    userChallenge: UserChallenge | null,
    challengeWorkoutId: string,
    calories: number,
    startTime: Date,
    endTime: Date
  ): Promise<WorkoutSummary> {
    let updatedSummary = new WorkoutSummary({
      ...workoutSummary,
      caloriesBurned: calories,
      isCompleted: true,
      startTime,
      completedAt: endTime,
      exercisesCompleted: this.completedExercises.filter(log => log.logSubmitted),
      pulsePoints: userChallenge ? new PulsePoints({}) : undefined
    });
  
    if (userChallenge) {
      updatedSummary = await this.updateChallengeIfNeeded(updatedSummary, userChallenge, challengeWorkoutId);
    } else {
      await this.updateWorkoutServices(updatedSummary);
    }
  
    localStorage.setItem('currentWorkoutSummary', JSON.stringify(updatedSummary));
  
    return updatedSummary;
  }

    // Additional helper methods as needed
  private isLogComplete(log: ExerciseLog): boolean {
    return log.logs.some(entry => entry.reps > 0 || entry.weight > 0);
  }
  
}

export const workoutSessionService = WorkoutSessionService.getInstance();