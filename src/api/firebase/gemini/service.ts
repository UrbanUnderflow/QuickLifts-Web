// services/GeminiService.ts
import { Exercise } from '../exercise';
import { db } from '../config';
import { collection, addDoc, getDoc, DocumentReference } from 'firebase/firestore';

interface GeneratedExercise {
  name: string;
  sets: number;
  reps: string[];
  category: {
    type: 'weightTraining';
    details: {
      sets: number;
      reps: string[];
      weight: number;
      screenTime: number;
    };
  };
}

interface GeneratedStack {
  title: string;
  description: string;
  exercises: GeneratedExercise[];
}

interface GeneratedRoundResponse {
  stacks: GeneratedStack[];
}

export class GeminiService {
  private static instance: GeminiService;
  
  private constructor() {}

  public static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  private async sendPrompt(prompt: string): Promise<string> {
    try {
      const generateRef = await addDoc(collection(db, 'generate'), {
        prompt: prompt
      });
  
      console.log('Generated prompt document ID:', generateRef.id);
      const response = await this.fetchOutputWithRetry(generateRef, 30, 2000);
      return response;
    } catch (error) {
      console.error('Error sending prompt:', error);
      throw error;
    }
  }

  private async fetchOutputWithRetry(
    docRef: DocumentReference,
    attempts: number,
    delay: number
  ): Promise<string> {
    if (attempts === 0) {
      throw new Error('Max retry attempts reached');
    }

    const snapshot = await getDoc(docRef);
    const data = snapshot.data();

    if (data?.output) {
      return data.output;
    }

    await new Promise(resolve => setTimeout(resolve, delay));
    return this.fetchOutputWithRetry(docRef, attempts - 1, delay);
  }

  async generateRound(
    mustIncludeExercises: string[],
    userPrompt: string,
    preferences: string[],
    creatorExercises: Exercise[],
    allAvailableExercises: Exercise[],
    startDate: Date,
    endDate: Date
  ): Promise<GeneratedRoundResponse> {
    // Calculate the number of workouts based on date range
    const numberOfWorkouts = this.calculateNumberOfWorkouts(startDate, endDate);
    
    // Combine all available exercises
    const mustIncludeList = mustIncludeExercises.join(", ");
    const creatorExerciseList = creatorExercises.map(ex => ex.name).join(", ");
    const allExerciseList = allAvailableExercises.map(ex => ex.name).join(", ");
    
    const prompt = `
You are a JSON-generating fitness AI. Return PURE JSON only.

PROGRAM REQUIREMENTS:
- ${numberOfWorkouts} total workouts from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}
- 4-5 exercises per workout (no more than 5)
- Use only exercises from these lists:
  Must include: ${mustIncludeList}
  Prefer creator exercises: ${creatorExerciseList}
  Other available: ${allExerciseList}

USER PREFERENCES:
${userPrompt}
${preferences.join("\n")}

RESPONSE FORMAT:
{
  "stacks": [
    {
      "title": "Workout Title",
      "description": "Brief description",
      "exercises": [
        {
          "name": "Exercise Name",
          "category": {
            "type": "weightTraining",
            "details": {
              "sets": 3,
              "reps": ["8","10"],
              "weight": 0,
              "screenTime": 0
            }
          }
        }
      ]
    }
  ]
}

RULES:
- Return ONLY valid JSON
- No comments or markdown
- Exactly ${numberOfWorkouts} stacks
- Only use listed exercises
- Keep descriptions under 100 characters`;

    console.log("Generating program with", numberOfWorkouts, "workouts");
    
    try {
      const response = await this.sendPrompt(prompt);

      // Clean and sanitize the response
      let jsonString = response
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/&quot;/g, '"')
        .replace(/\n/g, '')
        .replace(/\r/g, '')
        .replace(/\t/g, '')
        .replace(/\\/g, '')
        .trim();

      if (!jsonString.startsWith('{') || !jsonString.endsWith('}')) {
        throw new Error('Invalid JSON structure');
      }

      try {
        const parsedResponse = JSON.parse(jsonString);
        
        if (!parsedResponse.stacks || !Array.isArray(parsedResponse.stacks)) {
          throw new Error('Invalid response structure - missing stacks array');
        }

        // Verify we got the correct number of workouts
        if (parsedResponse.stacks.length !== numberOfWorkouts) {
          throw new Error(`Expected ${numberOfWorkouts} stacks, but got ${parsedResponse.stacks.length}`);
        }

        parsedResponse.stacks.forEach((stack: any, index: number) => {
          if (!stack.title || !stack.description || !Array.isArray(stack.exercises)) {
            throw new Error(`Invalid stack structure at index ${index}`);
          }
          stack.exercises.forEach((exercise: any, exIndex: number) => {
            if (!exercise.name || !exercise.category?.details?.reps) {
              throw new Error(`Invalid exercise structure at stack ${index}, exercise ${exIndex}`);
            }
          });
        });

        return parsedResponse;
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.error('Raw Response:', response);
        console.error('Cleaned Response:', jsonString);
        throw new Error('Failed to parse AI response');
      }
    } catch (error) {
      console.error('Generation Error:', error);
      throw new Error('Failed to generate workout round');
    }
  }

  private calculateNumberOfWorkouts(startDate: Date, endDate: Date): number {
    // Calculate the difference in days
    const msPerDay = 1000 * 60 * 60 * 24;
    const diffInMs = endDate.getTime() - startDate.getTime();
    const days = Math.ceil(diffInMs / msPerDay);
    
    // Add 1 to include both start and end dates
    return days + 1;
  }

}

export default GeminiService;