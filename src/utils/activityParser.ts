import { WorkoutSummary } from '../types/WorkoutSummary';
import { Exercise } from '../types/Exercise';
import { FollowRequest } from '../types/FollowRequest';
import { UserActivity, ActivityType } from '../types/Activity';
import { ExerciseLog } from '../types/ExerciseLog';

// utils/activityParser.ts

function generateUniqueId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

export function parseActivityType(
    workoutSummaries: WorkoutSummary[], 
    exerciseVideos: Exercise[], 
    follows: FollowRequest[],
    currentUserId: string
  ): UserActivity[] {
    const activities: UserActivity[] = [];
    
    // Parse workout summaries
    workoutSummaries.forEach(summary => {
      let containsCardio = false;
      let containsWeightTraining = false;
      const cardioExercises: ExerciseLog[] = [];
      const weightLifting: ExerciseLog[] = [];
      
      summary.exercisesCompleted.forEach(log => {
        if (log.exercise.tags.includes('cardio')) {
          cardioExercises.push(log);
          containsCardio = true;
        }
        if (log.exercise.tags.includes('weight-training') || log.exercise.tags.length === 0) {
          weightLifting.push(log);
          containsWeightTraining = true;
        }
      });
  
      if (containsCardio) {
        const caloriesBurned = cardioExercises
          .flatMap(ex => ex.logs)
          .reduce((sum, log) => sum + log.calories, 0);
  
        activities.push({
          id: generateUniqueId(),
          type: ActivityType.Cardio,
          title: "You completed a cardio workout",
          correspondingId: summary.id,
          value: `${caloriesBurned} cals burned`,
          date: summary.updatedAt
        });
      }
  
      if (containsWeightTraining) {
        const totalSets = weightLifting.reduce((sum, ex) => sum + ex.logs.length, 0);
        const totalReps = weightLifting
          .flatMap(ex => ex.logs)
          .reduce((sum, log) => sum + log.reps, 0);
        const averageReps = Math.round(totalReps / totalSets);
  
        activities.push({
          id: generateUniqueId(),
          type: ActivityType.WeightTraining,
          title: "You completed a weight training workout",
          correspondingId: summary.id,
          value: `${summary.exercisesCompleted.length} exercises, ${totalSets} sets, ${averageReps} rep average`,
          date: summary.updatedAt
        });
      }
    });
  
    // Parse exercise videos
    exerciseVideos.forEach(exercise => {
      activities.push({
        id: generateUniqueId(),
        type: ActivityType.ExercisePosted,
        title: "You posted a new exercise",
        correspondingId: exercise.id,
        value: exercise.name,
        date: exercise.createdAt
      });
    });
  
    // Parse follow requests
    follows.forEach(follow => {
      if (follow.toUser.id === currentUserId) {
        activities.push({
          id: generateUniqueId(),
          type: ActivityType.Follower,
          title: "Some members followed you",
          correspondingId: follow.fromUser.id,
          value: follow.fromUser.username,
          date: follow.createdAt
        });
      } else {
        activities.push({
          id: generateUniqueId(),
          type: ActivityType.Following,
          title: "You followed some members",
          correspondingId: follow.fromUser.id,
          value: follow.toUser.username,
          date: follow.createdAt
        });
      }
    });
  
    return activities.sort((a, b) => b.date.getTime() - a.date.getTime());
  }  