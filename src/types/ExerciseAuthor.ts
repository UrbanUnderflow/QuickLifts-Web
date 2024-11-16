// types/ExerciseAuthor.ts
export interface ExerciseAuthor {
  userId: string;
  username: string;
 }
 
 export function fromFirebase(data: any): ExerciseAuthor {
  return {
    userId: data.userId || '',
    username: data.username || ''
  };
 }
 
 export class ExerciseAuthor {
  static fromFirebase(data: any): ExerciseAuthor {
    return fromFirebase(data);
  }
 }