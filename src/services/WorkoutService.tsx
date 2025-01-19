// WorkoutService.ts

import axios from 'axios';
import { BodyZone } from '../types/BodyZone';
import { Exercise, 
        ExerciseVideo, 
        ExerciseLog, 
        ExerciseComment, 
        ExerciseCategory,
        ExerciseReference, 
        ExerciseAuthor } from '../api/firebase/exercise/types';
import { Workout, WorkoutRating, RepsAndWeightLog, WorkoutStatus } from '../api/firebase/workout/types';
import { BodyPart } from '../api/firebase/exercise';
import { ProfileImage } from '../api/firebase/user/types';
import { SweatlistCollection, SweatlistType } from '../types/SweatlistCollection';
import { Challenge, UserChallenge, ChallengeStatus } from '../types/ChallengeTypes';


class WorkoutService {
  private static instance: WorkoutService;

  private constructor() {
    console.log('WorkoutService instance created');
  }

  public static get sharedInstance(): WorkoutService {
    if (!WorkoutService.instance) {
      WorkoutService.instance = new WorkoutService();
    }
    return WorkoutService.instance;
  }

  public async fetchSavedWorkout(userId: string, workoutId: string): Promise<[Workout | null, ExerciseLog[] | null]> {
    console.log(`Fetching saved workout. UserID: ${userId}, WorkoutID: ${workoutId}`);
    
    const baseURL = "https://firestore.googleapis.com/v1/projects/quicklifts-dd3f1/databases/(default)/documents";
    const workoutURL = `${baseURL}/users/${userId}/MyCreatedWorkouts/${workoutId}`;
    
    try {
      const workoutResponse = await axios.get(workoutURL);
      
      if (workoutResponse.status !== 200) {
        console.error('Error response from server:', workoutResponse.status, workoutResponse.statusText);
        return [null, null];
      }

      const workoutData = workoutResponse.data.fields;

      const workout = this.parseWorkout(workoutData);

      // Fetch exercise logs
      const logsURL = `${baseURL}/users/${userId}/MyCreatedWorkouts/${workoutId}/logs`;
      const logsResponse = await axios.get(logsURL);

      if (logsResponse.status !== 200) {
        return [workout, null];
      }

      const logsData = logsResponse.data.documents || [];

      const logs = logsData.map((doc: any) => this.parseExerciseLog(doc.fields));

      return [workout, logs];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', error.response?.data);
      }
      return [null, null];
    }
  }

  public async fetchCollectionWithSweatLists(collectionId: string): Promise<{ collection: any, sweatLists: any[] }> {    
    const baseURL = "https://firestore.googleapis.com/v1/projects/quicklifts-dd3f1/databases/(default)/documents";
    const collectionURL = `${baseURL}/sweatlist-collection/${collectionId}`;
    
    try {
      // Fetch the collection details
      const collectionResponse = await axios.get(collectionURL);
      
      if (collectionResponse.status !== 200) {
        console.error('Error response from server:', collectionResponse.status, collectionResponse.statusText);
        throw new Error('Failed to fetch collection');
      }
  
      // Parse collection data
      const collectionData = collectionResponse.data.fields;

      const collection = this.parseCollection(collectionData);
      console.log(collection)
  
      // Prepare to fetch sweat lists (workouts) by sweatlistIds in the collection
      const sweatLists: Workout[] = [];
      for (const sweatlistIdentifier of collection.sweatlistIds) {
        // For each sweatlistId, fetch the saved workout (sweat list)
        try {
          const [workout] = await this.fetchSavedWorkout(sweatlistIdentifier.sweatlistAuthorId, sweatlistIdentifier.id); // Only care about the workout, not logs here
          if (workout) {
            sweatLists.push(workout);
          }
        } catch (error) {
          console.error(`Error fetching workout with ID ${sweatlistIdentifier.id}:`, error);
        }
      }
  
      return { collection, sweatLists };
  
    } catch (error) {
      console.error('Error fetching collection with sweat lists:', error);
      throw error;
    }
  }
  
  private parseCollection(fields: any): SweatlistCollection {
    const id = fields.id?.stringValue || '';
    const title = fields.title?.stringValue || '';
    const subtitle = fields.subtitle?.stringValue || '';
  
    // Parse challenge if it exists
    const challenge = fields.challenge?.mapValue?.fields ? 
      this.parseChallenge(fields.challenge.mapValue.fields) : 
      undefined;
  
    // Parse the sweatlistIds
    const sweatlistIdsArray = fields.sweatlistIds?.arrayValue?.values || [];
    const sweatlistIds = sweatlistIdsArray.map((item: any) => ({
      id: item.mapValue?.fields?.id?.stringValue || '',
      sweatlistAuthorId: item.mapValue?.fields?.sweatlistAuthorId?.stringValue || '',
      order: parseInt(item.mapValue?.fields?.order?.integerValue || '0')
    }));
  
    const ownerId = fields.ownerId?.stringValue || '';
    const createdAtTimestamp = parseFloat(fields.createdAt?.doubleValue || '0');
    const updatedAtTimestamp = parseFloat(fields.updatedAt?.doubleValue || '0');
  
    // Determine privacy based on challenge presence
    let privacy: SweatlistType;
    if (challenge) {
      privacy = SweatlistType.Together;
    } else {
      privacy = fields.privacy?.stringValue as SweatlistType || SweatlistType.Solo;
    }
  
    return {
      id,
      title,
      subtitle,
      challenge,
      sweatlistIds,
      ownerId,
      privacy,
      createdAt: new Date(createdAtTimestamp * 1000),
      updatedAt: new Date(updatedAtTimestamp * 1000)
    };
  }

  // Add this helper method to parse challenges
  private parseChallenge(fields: any): Challenge | undefined {
    if (!fields) return undefined;
  
    // Convert status string to enum
    const statusString = fields.status?.stringValue || 'draft';
    const status = statusString as ChallengeStatus;
  
    // Parse the participants array
    const participants = this.parseParticipants(fields.participants?.arrayValue?.values || []);
  
    // Parse startDate, endDate, createdAt, and updatedAt from timestamps
    const startDate = new Date(parseFloat(fields.startDate?.doubleValue || '0') * 1000);
    const endDate = new Date(parseFloat(fields.endDate?.doubleValue || '0') * 1000);
    const createdAt = new Date(parseFloat(fields.createdAt?.doubleValue || '0') * 1000);
    const updatedAt = new Date(parseFloat(fields.updatedAt?.doubleValue || '0') * 1000);
  
    // Return a new Challenge instance
    return new Challenge({
      id: fields.id?.stringValue || '',
      title: fields.title?.stringValue || '',
      subtitle: fields.subtitle?.stringValue || '',
      status,
      participants,
      startDate,
      endDate,
      createdAt,
      updatedAt,
      introVideoURL: fields.introVideoURL?.stringValue || undefined, // Optional property
    });
  }
  

  // Add this helper method to parse participants
  private parseParticipants(participants: any[]): UserChallenge[] {
    return participants.map(participant => {
      const fields = participant.mapValue?.fields || {};
      
      return {
        id: fields.id?.stringValue || '',
        challengeId: fields.challengeId?.stringValue || '',
        userId: fields.userId?.stringValue || '',
        username: fields.username?.stringValue || '',
        profileImage: this.parseProfileImage(fields.profileImage?.mapValue?.fields || {}),
        progress: parseFloat(fields.progress?.doubleValue || '0'),
        completedWorkouts: fields.completedWorkouts?.arrayValue?.values?.map((w: any) => w.stringValue) || [],
        isCompleted: fields.isCompleted?.booleanValue || false,
        location: fields.location ? {
          latitude: parseFloat(fields.location.mapValue?.fields?.latitude?.doubleValue || '0'),
          longitude: parseFloat(fields.location.mapValue?.fields?.longitude?.doubleValue || '0')
        } : undefined,
        city: fields.city?.stringValue || '',
        country: fields.country?.stringValue,
        timezone: fields.timezone?.stringValue,
        joinDate: new Date(parseFloat(fields.joinDate?.doubleValue || '0') * 1000),
        createdAt: new Date(parseFloat(fields.createdAt?.doubleValue || '0') * 1000),
        updatedAt: new Date(parseFloat(fields.updatedAt?.doubleValue || '0') * 1000),
        pulsePoints: {
          baseCompletion: parseFloat(fields.pulsePoints?.mapValue?.fields?.baseCompletion?.doubleValue || '0'),
          firstCompletion: parseFloat(fields.pulsePoints?.mapValue?.fields?.firstCompletion?.doubleValue || '0'),
          streakBonus: parseFloat(fields.pulsePoints?.mapValue?.fields?.streakBonus?.doubleValue || '0'),
          checkInBonus: parseFloat(fields.pulsePoints?.mapValue?.fields?.checkInBonus?.doubleValue || '0'),
          effortRating: parseFloat(fields.pulsePoints?.mapValue?.fields?.effortRating?.doubleValue || '0'),
          chatParticipation: parseFloat(fields.pulsePoints?.mapValue?.fields?.chatParticipation?.doubleValue || '0'),
          locationCheckin: parseFloat(fields.pulsePoints?.mapValue?.fields?.locationCheckin?.doubleValue || '0'),
          contentEngagement: parseFloat(fields.pulsePoints?.mapValue?.fields?.contentEngagement?.doubleValue || '0'),
          encouragementSent: parseFloat(fields.pulsePoints?.mapValue?.fields?.encouragementSent?.doubleValue || '0'),
          encouragementReceived: parseFloat(fields.pulsePoints?.mapValue?.fields?.encouragementReceived?.doubleValue || '0')
        },
        currentStreak: parseInt(fields.currentStreak?.integerValue || '0'),
        encouragedUsers: fields.encouragedUsers?.arrayValue?.values?.map((u: any) => u.stringValue) || [],
        encouragedByUsers: fields.encouragedByUsers?.arrayValue?.values?.map((u: any) => u.stringValue) || [],
        checkIns: (fields.checkIns?.arrayValue?.values || []).map((timestamp: any) => 
          new Date(parseFloat(timestamp.doubleValue || '0') * 1000)
        )
      };
    });
  }
  
  private parseWorkout(fields: any): Workout {
    const exercisesArray = fields.exercises?.arrayValue?.values || [];
    const exercises: ExerciseReference[] = exercisesArray.map((exerciseData: any) => {
        const exerciseFields = exerciseData.mapValue?.fields?.exercise?.mapValue?.fields || {};
        return {
            exercise: this.parseExercise(exerciseFields),
            groupId: parseInt(exerciseData.mapValue?.fields?.groupId?.integerValue || '0')
        };
    });

    const logsArray = fields.logs?.arrayValue?.values || [];
    const logs: ExerciseLog[] = logsArray.map((logData: any) => {
        return this.parseExerciseLog(logData.mapValue?.fields || {});
    });

    // Create a new Workout instance with the parsed data
    return new Workout({
        id: fields.id?.stringValue || '',
        collectionId: fields.collectionId?.arrayValue?.values?.map((id: any) => id.stringValue) || [],
        roundWorkoutId: fields.roundWorkoutId?.stringValue || '',
        exercises: exercises,
        challenge: fields.challenge?.mapValue?.fields 
            ? this.parseChallenge(fields.challenge.mapValue.fields) 
            : undefined,
        logs: logs,
        title: fields.title?.stringValue || '',
        description: fields.description?.stringValue || '',
        duration: parseInt(fields.duration?.integerValue || '0'),
        workoutRating: fields.workoutRating?.stringValue as WorkoutRating,
        useAuthorContent: fields.useAuthorContent?.booleanValue || false,
        isCompleted: fields.isCompleted?.booleanValue || false,
        workoutStatus: fields.workoutStatus?.stringValue as WorkoutStatus || WorkoutStatus.QueuedUp,
        startTime: fields.startTime?.timestampValue 
            ? new Date(fields.startTime.timestampValue) 
            : undefined,
        order: parseInt(fields.order?.integerValue || '0'),
        author: fields.author?.stringValue || '',
        createdAt: new Date(parseFloat(fields.createdAt?.doubleValue || '0') * 1000),
        updatedAt: new Date(parseFloat(fields.updatedAt?.doubleValue || '0') * 1000),
        zone: fields.zone?.stringValue as BodyZone || BodyZone.FullBody,
        estimatedDuration: () => parseInt(fields.duration?.integerValue || '0'),
        determineWorkoutZone: () => fields.zone?.stringValue as BodyZone || BodyZone.FullBody,
        toDictionary: () => ({})
    } as Workout);
}

  private parseExerciseLog(fields: any): ExerciseLog {
    const id = fields.id?.stringValue || '';
    const workoutId = fields.workoutId?.stringValue || '';
    const userId = fields.userId?.stringValue || '';
    const feedback = fields.feedback?.stringValue || '';
    const note = fields.note?.stringValue || '';
    const recommendedWeight = fields.recommendedWeight?.stringValue;
    const isSplit = fields.isSplit?.booleanValue || false;
    const isBodyWeight = fields.isBodyWeight?.booleanValue || false;
    const logSubmitted = fields.logSubmitted?.booleanValue || false;
    const logIsEditing = fields.logIsEditing?.booleanValue || false;
    const isCompleted = fields.isCompleted?.booleanValue || false;
    const createdAtTimestamp = parseFloat(fields.createdAt?.doubleValue || '0');
    const updatedAtTimestamp = parseFloat(fields.updatedAt?.doubleValue || '0');

    const exercise = this.parseExercise(fields.exercise?.mapValue?.fields || {});

    const logsArray = fields.log?.arrayValue?.values || [];
    const logs: RepsAndWeightLog[] = logsArray.map((logData: any) => {
      const logFields = logData.mapValue?.fields || {};
      return {
        reps: parseInt(logFields.reps?.integerValue || '0'),
        weight: parseFloat(logFields.weight?.doubleValue || '0'),
        leftReps: parseInt(logFields.leftReps?.integerValue || '0'),
        leftWeight: parseFloat(logFields.leftWeight?.doubleValue || '0'),
        isSplit: logFields.isSplit?.booleanValue || false,
        isBodyWeight: logFields.isBodyWeight?.booleanValue || false,
        isCompleted: logFields.isCompleted?.booleanValue || false,
        duration: parseInt(logFields.duration?.integerValue || '0'),
        calories: parseInt(logFields.calories?.integerValue || '0'),
        bpm: parseInt(logFields.bpm?.integerValue || '0')
      };
    });

    return {
      id,
      workoutId,
      userId,
      exercise,
      logs,
      feedback,
      note,
      recommendedWeight,
      isSplit,
      isBodyWeight,
      logSubmitted,
      logIsEditing,
      isCompleted,
      createdAt: new Date(createdAtTimestamp * 1000),
      updatedAt: new Date(updatedAtTimestamp * 1000)
    };
  }

  private parseExercise(fields: any): Exercise {
    // Implement this method based on your Swift parseExercise function
    // This is a simplified version, you may need to add more details
    return {
      id: fields.id?.stringValue || '',
      name: fields.name?.stringValue || '',
      category: this.parseExerciseCategory(fields.category?.mapValue?.fields || {}),
      primaryBodyParts: this.parseBodyParts(fields.primaryBodyParts),
      secondaryBodyParts: this.parseBodyParts(fields.secondaryBodyParts),
      tags: fields.tags?.arrayValue?.values?.map((tag: any) => tag.stringValue) || [],
      description: fields.description?.stringValue || '',
      visibility: fields.visibility?.arrayValue?.values?.map((v: any) => v.stringValue) || [],
      steps: fields.steps?.arrayValue?.values?.map((step: any) => step.stringValue) || [],
      videos: this.parseVideos(fields.videos),
      currentVideoPosition: parseInt(fields.currentVideoPosition?.integerValue || '0'),
      reps: fields.reps?.stringValue || '',
      sets: parseInt(fields.sets?.integerValue || '0'),
      weight: parseFloat(fields.weight?.doubleValue || '0'),
      
      author: this.parseExerciseAuthor(fields.author?.mapValue?.fields || {}),
      createdAt: new Date(parseFloat(fields.createdAt?.doubleValue || '0') * 1000),
      updatedAt: new Date(parseFloat(fields.updatedAt?.doubleValue || '0') * 1000)
    };
  }

  private parseExerciseCategory(fields: any): ExerciseCategory {
    const categoryId = fields.id?.stringValue || '';
    if (categoryId === 'cardio') {
      return {
        type: 'cardio',
        details: {
          duration: parseInt(fields.duration?.integerValue || '0'),
          bpm: parseInt(fields.bpm?.integerValue || '0'),
          calories: parseInt(fields.calories?.integerValue || '0'),
          screenTime: parseInt(fields.screenTime?.integerValue || '0'),
          selectedVideo: this.parseExerciseVideo(fields.selectedVideo?.mapValue?.fields)  
        }
      };
    } else {
      return {
        type: 'weightTraining',
        details: {
          reps: fields.reps?.stringValue || '',
          sets: parseInt(fields.sets?.integerValue || '0'),
          weight: parseFloat(fields.weight?.doubleValue || '0'),
          screenTime: parseInt(fields.screenTime?.integerValue || '0'),
          selectedVideo: this.parseExerciseVideo(fields.selectedVideo?.mapValue?.fields)
        }
      };
    }
  }

  private parseBodyParts(bodyPartsField: any): BodyPart[] {
    const bodyPartsArray = bodyPartsField?.arrayValue?.values || [];
    return bodyPartsArray.map((part: any) => part.stringValue as BodyPart);
  }

  private parseVideos(videosField: any): ExerciseVideo[] {
    const videosArray = videosField?.arrayValue?.values || [];
    return videosArray.map((videoData: any) => this.parseExerciseVideo(videoData.mapValue?.fields || {}));
  }
  
  private parseExerciseVideo(fields: any): ExerciseVideo {
    return {
      id: fields.id?.stringValue || '',
      exerciseId: fields.exerciseId?.stringValue || '',
      username: fields.username?.stringValue || '',
      userId: fields.userId?.stringValue || '',
      videoURL: fields.videoURL?.stringValue || '',
      fileName: fields.fileName?.stringValue || '',
      exercise: fields.exercise?.stringValue || '',
      profileImage: this.parseProfileImage(fields.profileImage?.mapValue?.fields || {}),
      caption: fields.caption?.stringValue || '',
      gifURL: fields.gifURL?.stringValue || '',
      thumbnail: fields.thumbnail?.stringValue || '',
      visibility: fields.visibility?.stringValue || 'open',
      totalAccountsReached: parseInt(fields.totalAccountsReached?.integerValue || '0'),
      totalAccountLikes: parseInt(fields.totalAccountLikes?.integerValue || '0'),
      totalAccountBookmarked: parseInt(fields.totalAccountBookmarked?.integerValue || '0'),
      totalAccountUsage: parseInt(fields.totalAccountUsage?.integerValue || '0'),
      isApproved: fields.isApproved?.booleanValue || false,
      liked: fields.liked?.booleanValue,
      bookmarked: fields.bookmarked?.booleanValue,
      createdAt: new Date(parseFloat(fields.createdAt?.doubleValue || '0') * 1000),
      updatedAt: new Date(parseFloat(fields.updatedAt?.doubleValue || '0') * 1000)
    };
  }
  
  private parseProfileImage(fields: any): ProfileImage {
    return {
      profileImageURL: fields.profileImageURL?.stringValue || '',
      imageOffsetWidth: parseFloat(fields.imageOffsetWidth?.doubleValue || '0'),
      imageOffsetHeight: parseFloat(fields.imageOffsetHeight?.doubleValue || '0')
    };
  }
  
  private parseComments(commentsField: any): Comment[] {
    const commentsArray = commentsField?.arrayValue?.values || [];
    return commentsArray.map((commentData: any) => this.parseComment(commentData.mapValue?.fields || {}));
  }
  
  private parseComment(fields: any): ExerciseComment {
    return {
      id: fields.id?.stringValue || '',
      username: fields.username?.stringValue || '',
      text: fields.text?.stringValue || '',
      createdAt: new Date(parseFloat(fields.createdAt?.doubleValue || '0') * 1000),
      updatedAt: new Date(parseFloat(fields.updatedAt?.doubleValue || '0') * 1000)
    };
  }

  private parseExerciseAuthor(fields: any): ExerciseAuthor {
    return {
      userId: fields.userId?.stringValue || '',
      username: fields.username?.stringValue || ''
    };
  }
}

export default WorkoutService;