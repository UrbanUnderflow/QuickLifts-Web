import {
    collection,
    getDocs,
    query,
    orderBy,
    limit,
    startAfter,
    DocumentSnapshot,
    doc,
    where,
  } from 'firebase/firestore';
import { db } from '../config';
import { Exercise } from './types';
import { ExerciseVideo, ExerciseAuthor } from '../../firebase/exercise/types';
import { convertFirestoreTimestamp } from '../../../utils/formatDate';

class ExerciseService {
    private _allExercises: Exercise[] = [];
  
    get allExercises(): Exercise[] {
      return this._allExercises;
    }
  
    async fetchExercises(): Promise<void> {
      try {
        // Fetch all exercises
        const exerciseSnapshot = await getDocs(collection(db, 'exercises'));
        const exercises: Exercise[] = exerciseSnapshot.docs.map((doc) => Exercise.fromFirebase({
          id: doc.id,
          ...doc.data(),
        }));
    
        // Fetch all videos
        const videoSnapshot = await getDocs(collection(db, 'exerciseVideos'));
        const exerciseVideos: ExerciseVideo[] = videoSnapshot.docs.map((doc) =>
          ExerciseVideo.fromFirebase({
            id: doc.id,
            ...doc.data(),
          })
        );
    
        // Map videos to their corresponding exercises by name
        const mappedExercises = exercises.map((exercise) => {
          const videosForExercise = exerciseVideos
            .filter((video) => video.exercise.toLowerCase() === exercise.name.toLowerCase())
            .map((video) => ExerciseVideo.fromFirebase(video)); // Ensure proper ExerciseVideo instances
        
          return new Exercise({
            ...exercise, // Keep existing properties
            videos: videosForExercise, // Ensure videos are instances of ExerciseVideo
          });
        });
    
        // Filter out exercises without videos
        this._allExercises = mappedExercises.filter((exercise: Exercise) => exercise.videos.length > 0);
    
        // console.log(`Fetched ${this._allExercises.length} exercises with videos.`);
        
        // Detailed logging for debugging
        // console.log('Sample exercises:', this._allExercises.slice(0, 5).map(ex => ({
        //   name: ex.name,
        //   videoCount: ex.videos.length,
        //   firstVideoUrl: ex.videos[0]?.videoURL
        // })));
      } catch (error) {
        console.error('Error fetching exercises:', error);
        throw new Error('Failed to fetch exercises.');
      }
    }

    async fetchFeaturedExercisesWithVideos(limit: number = 24): Promise<Exercise[]> {
      try {
        // Fetch all exercises
        const exerciseSnapshot = await getDocs(collection(db, 'exercises'));
        const exercises: Exercise[] = exerciseSnapshot.docs.map((doc) => 
          Exercise.fromFirebase({
            id: doc.id,
            ...doc.data(),
          })
        );
    
        // Fetch all videos
        const videoSnapshot = await getDocs(collection(db, 'exerciseVideos'));
        const exerciseVideos: ExerciseVideo[] = videoSnapshot.docs.map((doc) =>
          ExerciseVideo.fromFirebase({
            id: doc.id,
            ...doc.data(),
          })
        );
    
        // Map videos to exercises and filter for those with GIFs
        const mappedExercises = exercises.map((exerciseData) => {
          // Ensure that each video is properly instantiated as an `ExerciseVideo`
          const videosForExercise = (exerciseVideos
            .filter((video) => video.exercise.toLowerCase() === exerciseData.name.toLowerCase())
            .map((video) => ExerciseVideo.fromFirebase(video))) as ExerciseVideo[];
        
          return new Exercise({
            id: exerciseData.id,
            name: exerciseData.name,
            description: exerciseData.description,
            category: exerciseData.category || {}, // Ensure proper category handling
            primaryBodyParts: exerciseData.primaryBodyParts || [],
            secondaryBodyParts: exerciseData.secondaryBodyParts || [],
            tags: exerciseData.tags || [],
            videos: videosForExercise, // Attach properly mapped videos
            steps: exerciseData.steps || [],
            visibility: exerciseData.visibility || 'live',
            currentVideoPosition: exerciseData.currentVideoPosition || 0,
            sets: exerciseData.sets || 0,
            reps: exerciseData.reps || '',
            weight: exerciseData.weight || 0,
            author: ExerciseAuthor.fromFirebase(exerciseData.author || {}),
            createdAt: convertFirestoreTimestamp(exerciseData.createdAt),
            updatedAt: convertFirestoreTimestamp(exerciseData.updatedAt),
          });
        });
        
    
        // Shuffle and limit results
        const shuffledExercises = mappedExercises
          .sort(() => Math.random() - 0.5)
          .slice(0, limit);
    
        return shuffledExercises;
      } catch (error) {
        console.error('Error fetching featured exercises:', error);
        return [];
      }
    }

    async getExercisesByAuthor(userId: string): Promise<Exercise[]> {
      try {
        // Query exerciseVideos collection instead
        const videosRef = collection(db, 'exerciseVideos');
        const q = query(videosRef, where('userId', '==', userId));
        const querySnapshot = await getDocs(q);
        
        // Create a Set to store unique exercise names
        const uniqueExerciseNames = new Set<string>();
        
        // Collect all unique exercise names from the videos
        querySnapshot.forEach((doc) => {
          const videoData = doc.data();
          if (videoData.exerciseName) {
            uniqueExerciseNames.add(videoData.exerciseName);
          }
        });
  
        // Convert to array and create Exercise objects
        const exercises = Array.from(uniqueExerciseNames).map(name => {
          return new Exercise({
            id: name, // Using name as ID since we just need unique identifiers
            name: name,
            author: { userId: userId }
            // Add other required Exercise properties as needed
          });
        });
        
        return exercises;
      } catch (error) {
        console.error('Error fetching exercises by author:', error);
        return [];
      }
    }

    async fetchPaginatedExercises(
        lastDoc: DocumentSnapshot | null = null,
        pageSize: number = 15
      ): Promise<{ exercises: Exercise[]; lastVisible: DocumentSnapshot | null }> {
        try {
          // Query for exercises with pagination
          let exerciseQuery = query(
            collection(db, 'exercises'),
            orderBy('createdAt', 'desc'),
            limit(pageSize)
          );
    
          if (lastDoc) {
            exerciseQuery = query(exerciseQuery, startAfter(lastDoc));
          }
    
          const exerciseSnapshot = await getDocs(exerciseQuery);
    
          if (exerciseSnapshot.empty) {
            return { exercises: [], lastVisible: null };
          }
    
          // Fetch exercise videos separately
          const videoSnapshot = await getDocs(collection(db, 'exerciseVideos'));
          const exerciseVideos: ExerciseVideo[] = videoSnapshot.docs.map((doc) =>
            ExerciseVideo.fromFirebase({
              id: doc.id,
              ...doc.data(),
            })
          );
          
          const exercises: Exercise[] = exerciseSnapshot.docs.map((doc) =>
            Exercise.fromFirebase({ id: doc.id, ...doc.data() })
          );
          
          // Map videos to exercises and ensure correct instantiation
          const mappedExercises: Exercise[] = exercises.map((exerciseData) => {
            const videosForExercise = exerciseVideos.filter((video) => video.exerciseId === exerciseData.id);
          
            return new Exercise({
              ...exerciseData, // Copy existing properties
              videos: videosForExercise, // Assign filtered videos
            });
          });
          
          // Filter exercises with videos
          const filteredExercises: Exercise[] = mappedExercises.filter((exercise) => exercise.videos.length > 0);
          
          // Update the last visible document for pagination
          const lastVisible = exerciseSnapshot.docs.length > 0 ? exerciseSnapshot.docs[exerciseSnapshot.docs.length - 1] : null;
          
          return { exercises: filteredExercises, lastVisible };
          
        } catch (error) {
          console.error('Error fetching paginated exercises:', error);
          throw error;
        }
      }

      generateExerciseLogID(workoutId: string, userId: string): string {
        // Create a document reference in the logs subcollection of the workout,
        // then return its generated ID.
        return doc(
          collection(db, 'users', userId, 'MyCreatedWorkouts', workoutId, 'logs')
        ).id;
      }
  }
  
  export const exerciseService = new ExerciseService();