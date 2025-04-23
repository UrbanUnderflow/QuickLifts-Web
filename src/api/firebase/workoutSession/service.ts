// workoutSessionService.ts
import { WorkoutSummary, Workout, WorkoutStatus, UserChallenge, PulsePoints } from '../../firebase/workout';
import { ExerciseLog } from '../../firebase/exercise';
import { User } from '../../firebase/user';
import { workoutService } from '../../firebase/workout/service';
import { userService } from '../../firebase/user/service';
import { store } from '../../../redux/store';
import { resetWorkoutState } from '../../../redux/workoutSlice';
import { db } from '../../../api/firebase/config';
import { doc, setDoc, writeBatch } from 'firebase/firestore';

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
  private estimateCaloriesBurnedLocally(numberOfExercises: number, duration: number): number {
    const baseCaloriesPerMinute = 5;
    const exerciseMultiplier = 1.1;
    
    const durationInMinutes = Math.min(duration / 60, 60);
    
    return Math.floor(baseCaloriesPerMinute * durationInMinutes * Math.pow(exerciseMultiplier, numberOfExercises));
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
    const allEmpty = this.completedExercises.every(log => 
      log.logs.every(entry => entry.reps === 0 && entry.weight === 0)
    );
    return allEmpty ? 'allEmpty' : 'valid';
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
      
        const duration = endTime.getTime() - startTime.getTime();
        const caloriesBurned = this.estimateCaloriesBurnedLocally(
          workoutSummary.exercisesCompleted.length,
          duration / 1000
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
  
  private async updateChallengeIfNeeded(currentWorkoutSummary: WorkoutSummary, userChallenge: UserChallenge, challengeWorkoutId: string): Promise<WorkoutSummary> {
    if (!userChallenge || !challengeWorkoutId || !currentWorkoutSummary) {
        return currentWorkoutSummary;
    }

    if (!userService.nonUICurrentUser?.id) {
        throw new Error('No user is signed in');
    }

    // Create a new challenge object with all the updated data
    const challengeData = {
        ...userChallenge,
        completedWorkouts: [
            ...userChallenge.completedWorkouts,
            {
                id: `${challengeWorkoutId}-${new Date().getTime()}`,
                workoutId: challengeWorkoutId,
                completedAt: new Date()
            }
        ],
        pulsePoints: {
            ...userChallenge.pulsePoints,
            baseCompletion: userChallenge.pulsePoints.baseCompletion + 100,
            firstCompletion: userChallenge.completedWorkouts.length === 0 ? 
                userChallenge.pulsePoints.firstCompletion + 50 : 
                userChallenge.pulsePoints.firstCompletion,
            streakBonus: 0,
            cumulativeStreakBonus: this.isWorkoutAssignedForToday() ? 
                userChallenge.currentStreak * 25 : 
                userChallenge.pulsePoints.cumulativeStreakBonus
        },
        currentStreak: this.calculateStreak(userChallenge, new Date()),
        isCurrentlyActive: false,
        updatedAt: new Date()
    };

    // Create a new UserChallenge instance with the updated data
    const updatedChallenge = new UserChallenge(challengeData);

    // Update WorkoutSummary with PulsePoints
    const sessionPulsePoints = new PulsePoints({
        baseCompletion: 100,
        firstCompletion: updatedChallenge.completedWorkouts.length === 1 ? 50 : 0,
        streakBonus: 0,
        cumulativeStreakBonus: this.isWorkoutAssignedForToday() ? 
            updatedChallenge.pulsePoints.cumulativeStreakBonus : 0,
        checkInBonus: currentWorkoutSummary.pulsePoints?.checkInBonus ?? 0,
        effortRating: currentWorkoutSummary.pulsePoints?.effortRating ?? 0,
        chatParticipation: currentWorkoutSummary.pulsePoints?.chatParticipation ?? 0,
        locationCheckin: currentWorkoutSummary.pulsePoints?.locationCheckin ?? 0,
        contentEngagement: currentWorkoutSummary.pulsePoints?.contentEngagement ?? 0,
        encouragementSent: currentWorkoutSummary.pulsePoints?.encouragementSent ?? 0,
        encouragementReceived: currentWorkoutSummary.pulsePoints?.encouragementReceived ?? 0
    });

    // Create updated summary with new PulsePoints
    const updatedSummaryData = {
        ...currentWorkoutSummary,
        pulsePoints: sessionPulsePoints
    };

    const updatedSummary = new WorkoutSummary(updatedSummaryData);

    // Save updated summary and challenge using workoutService
    await workoutService.updateWorkoutSummary({
        userId: userService.nonUICurrentUser.id,
        workoutId: challengeWorkoutId,
        summary: updatedSummary
    });

    await workoutService.updateUserChallenge(updatedChallenge);

    return updatedSummary;
}

  
  private calculateStreak(challenge: any, newCompletionDate: Date): number {
    const sortedWorkouts = [...challenge.completedWorkouts].sort(
      (a, b) => a.completedAt.getTime() - b.completedAt.getTime()
    );
  
    let streak = 1;
  
    for (let i = 1; i < sortedWorkouts.length; i++) {
      const previousDate = new Date(sortedWorkouts[i - 1].completedAt);
      const currentDate = new Date(sortedWorkouts[i].completedAt);
  
      if (this.isNextDay(previousDate, currentDate)) {
        streak++;
      } else if (!this.isSameDay(previousDate, currentDate)) {
        streak = 1;
      }
    }
  
    return streak;
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
  
  // Update finalizeWorkoutSummary to include PulsePoints
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
      // Only initialize PulsePoints if there's a challenge
      pulsePoints: userChallenge ? new PulsePoints({}) : undefined
    });
  
    if (userChallenge) {
      // This path includes saving to database within updateChallengeIfNeeded
      updatedSummary = await this.updateChallengeIfNeeded(updatedSummary, userChallenge, challengeWorkoutId);
    } else {
      // Only save to database if there's no challenge (to avoid double-saving)
      await this.updateWorkoutServices(updatedSummary);
    }
  
    // Always update localStorage
    localStorage.setItem('currentWorkoutSummary', JSON.stringify(updatedSummary));
  
    return updatedSummary;
  }

    // Additional helper methods as needed
  private isLogComplete(log: ExerciseLog): boolean {
    return log.logs.some(entry => entry.reps > 0 || entry.weight > 0);
  }
  
}

export const workoutSessionService = WorkoutSessionService.getInstance();