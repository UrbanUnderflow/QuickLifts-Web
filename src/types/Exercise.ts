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


