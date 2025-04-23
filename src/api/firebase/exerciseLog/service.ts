import { Firestore, collection, doc, setDoc } from 'firebase/firestore';
import { ExerciseLog } from '../exercise/types';
import { Workout } from '../../firebase/workout';
import { userService } from '../user';
import { db } from '../config';

class ExerciseLogService {
    private _allLogs: ExerciseLog[] = [];

    // Getter for all logs
    get allLogs(): ExerciseLog[] {
        return this._allLogs;
    }

    // Setter for all logs
    set allLogs(logs: ExerciseLog[]) {
        this._allLogs = logs;
    }

    async updateExerciseLog(log: ExerciseLog, workout: Workout): Promise<void> {
        const userId = userService.nonUICurrentUser?.id || 'anonymous';
        
        if (!userId) {
            return;
        }

        // Create references to the workout and log documents
        const workoutRef = doc(
            collection(db, "users", userId, "workoutSessions"), 
            workout.id
        );

        // Update the workout's updatedAt timestamp
        const updatedWorkoutDate = {
            ...workout,
            updatedAt: new Date()
        };

        const updatedWorkout = new Workout(updatedWorkoutDate);

        try {
            // Update the workout document
            await setDoc(workoutRef, updatedWorkout.toDictionary());
            console.log("Workout document updated successfully");

            // Create reference to the log document
            const logRef = doc(
                collection(workoutRef, "logs"), 
                log.id
            );

            // Update the log document
            await setDoc(logRef, log.toDictionary());
            console.log("Exercise log document updated successfully");
        } catch (error) {
            console.error("Error updating exercise log:", error);
            throw error;
        }
    }

    // Helper method to convert Firestore data to ExerciseLog
    private convertToExerciseLog(data: any): ExerciseLog {
        return new ExerciseLog(data);
    }

    // Method to clear all logs (useful for cleanup)
    clearLogs(): void {
        this._allLogs = [];
    }
}

// Export a single instance, matching the pattern used in UserService
export const exerciseLogService = new ExerciseLogService();