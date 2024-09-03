// types/Exercise.ts

export interface WeightTrainingExercise {
    reps: string;
    sets: number;
    weight: number;
  }
  
  export interface CardioExercise {
    duration: number;
    bpm: number;
    calories: number;
  }
  
  export type ExerciseCategory = 
    | { type: 'weightTraining', details?: WeightTrainingExercise }
    | { type: 'cardio', details?: CardioExercise };
  
  // Helper functions to mimic Swift enum behavior
  export const ExerciseCategory = {
    weightTraining: (details?: WeightTrainingExercise): ExerciseCategory => ({
      type: 'weightTraining',
      details
    }),
    cardio: (details?: CardioExercise): ExerciseCategory => ({
      type: 'cardio',
      details
    }),
  
    fromIdentifier: (identifier: string): ExerciseCategory | null => {
      switch (identifier) {
        case 'weight-training':
          return ExerciseCategory.weightTraining({
            reps: '12',
            sets: 3,
            weight: 0.0
          });
        case 'cardio':
          return ExerciseCategory.cardio({
            duration: 20,
            bpm: 125,
            calories: 0
          });
        default:
          return null;
      }
    },
  
    identifier: (category: ExerciseCategory): string => {
      switch (category.type) {
        case 'weightTraining':
          return 'weight-training';
        case 'cardio':
          return 'cardio';
      }
    }
  };
  
  // Usage examples:
  // const weightTraining = ExerciseCategory.weightTraining({ reps: '10', sets: 3, weight: 50 });
  // const cardio = ExerciseCategory.cardio({ duration: 30, bpm: 140, calories: 300 });
  // const fromId = ExerciseCategory.fromIdentifier('weight-training');
  // const id = ExerciseCategory.identifier(weightTraining);