// types/Exercise.ts
import { ExerciseVideo } from "./ExerciseVideo";
import { BodyPart } from "./BodyPart";
import { ExerciseAuthor } from "./ExerciseAuthor";
import { ExerciseCategory } from "./ExerciseCategory";

export type ExerciseVisibility = 'open' | 'private' | 'followers';

export class Exercise {
  id: string;
  name: string;
  description: string;
  category: ExerciseCategory;
  primaryBodyParts: BodyPart[];
  secondaryBodyParts: BodyPart[];
  tags: string[];
  videos: ExerciseVideo[];
  steps: string[];
  visibility: ExerciseVisibility;
  currentVideoPosition: number;
  sets: number;
  reps: string;
  weight: number;
  author: ExerciseAuthor;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: any) {
    this.id = data.id || '';
    this.name = data.name || '';
    this.description = data.description || '';
    this.category = data.category as ExerciseCategory;
    this.primaryBodyParts = (data.primaryBodyParts || []) as BodyPart[];
    this.secondaryBodyParts = (data.secondaryBodyParts || []) as BodyPart[];
    this.tags = data.tags || [];
    this.videos = (data.videos || []).map((video: any) => ExerciseVideo.fromFirebase(video));
    this.steps = data.steps || [];
    this.visibility = data.visibility || [];
    this.currentVideoPosition = data.currentVideoPosition || 0;
    this.sets = data.sets || 0;
    this.reps = data.reps || '';
    this.weight = data.weight || 0;
    this.author = ExerciseAuthor.fromFirebase(data.author || {});
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  static fromFirebase(data: any): Exercise {
    return new Exercise({
      id: data.id || '',
      name: data.name || '',
      description: data.description || '',
      category: data.category || {},
      primaryBodyParts: data.primaryBodyParts || [],
      secondaryBodyParts: data.secondaryBodyParts || [],
      tags: data.tags || [],
      videos: data.videos || [],
      steps: data.steps || [],
      visibility: data.visibility || [],
      currentVideoPosition: data.currentVideoPosition || 0,
      sets: data.sets || 0,
      reps: data.reps || '',
      weight: data.weight || 0,
      author: data.author || {},
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
  }
}
