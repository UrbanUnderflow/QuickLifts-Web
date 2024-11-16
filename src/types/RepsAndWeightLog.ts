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
