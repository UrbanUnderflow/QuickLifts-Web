// src/api/firebase/workout/index.ts

export { workoutService } from './service'; 
// If you want to export the singleton instance

// Or if you want to export the class (if you prefer constructing a new instance):
// export { WorkoutService } from './WorkoutService';

export * from './types'; 
// Re-export all the domain types from `types.ts`