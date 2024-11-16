import { ExerciseVideo } from "./ExerciseVideo";
import { BodyPart } from "./BodyPart";
import { ExerciseAuthor } from "./ExerciseAuthor";
import { ExerciseCategory } from "./ExerciseCategory";

export interface Exercise {
    id: string;
    name: string;
    description: string;
    category: ExerciseCategory;
    primaryBodyParts: BodyPart[];
    secondaryBodyParts: BodyPart[];
    tags: string[];
    videos: ExerciseVideo[];
    steps: string[];
    visibility: string[];
    currentVideoPosition: number;
    sets: number;
    reps: string;
    weight: number;
    author: ExerciseAuthor;
    createdAt: Date
    updatedAt: Date
  }

  export function fromFirebase(data: any): Exercise {
    return {
      id: data.id || '',
      name: data.name || '',
      description: data.description || '',
      category: data.category as ExerciseCategory,
      primaryBodyParts: (data.primaryBodyParts || []) as BodyPart[],
      secondaryBodyParts: (data.secondaryBodyParts || []) as BodyPart[],
      tags: data.tags || [],
      videos: (data.videos || []).map((video: any) => ExerciseVideo.fromFirebase(video)),
      steps: data.steps || [],
      visibility: data.visibility || [],
      currentVideoPosition: data.currentVideoPosition || 0,
      sets: data.sets || 0,
      reps: data.reps || '',
      weight: data.weight || 0,
      author: ExerciseAuthor.fromFirebase(data.author || {}),
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date()
    };
   }
   
   export class Exercise {
    static fromFirebase(data: any): Exercise {
      return fromFirebase(data);
    }
   }


