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
    getDoc,
    setDoc,
  } from 'firebase/firestore';
import { db } from '../config';
import { Exercise } from './types';
import { ExerciseVideo, ExerciseAuthor } from '../../firebase/exercise/types';
import { convertFirestoreTimestamp } from '../../../utils/formatDate';
import { formatExerciseNameForId } from '../../../utils/stringUtils';

class ExerciseService {
    private _allExercises: Exercise[] = [];
    private exerciseCache: Map<string, Exercise> = new Map();
  
    get allExercises(): Exercise[] {
      return this._allExercises;
    }
  
    // Clear the exercise cache to ensure fresh data
    clearCache(): void {
      console.log('[DEBUG-EXERCISE] Clearing exercise cache');
      this._allExercises = [];
      this.exerciseCache.clear();
    }
  
    generateExerciseId(): string {
      const newId = doc(collection(db, 'exercises')).id;
      console.log('[DEBUG-EXERCISE] Generated exercise ID:', newId);
      return newId;
    }
  
    generateExerciseVideoId(): string {
      const newId = doc(collection(db, 'exerciseVideos')).id;
      console.log('[DEBUG-EXERCISE] Generated exercise video ID:', newId);
      return newId;
    }
    
    // Verify if an exercise exists in Firestore by its ID field
    async verifyExerciseExists(exerciseId: string): Promise<boolean> {
      try {
        console.log('[DEBUG-EXERCISE] Verifying if exercise exists by ID:', exerciseId);
        
        // Query for documents with this ID field
        const exercisesRef = collection(db, 'exercises');
        const q = query(exercisesRef, where('id', '==', exerciseId));
        const querySnapshot = await getDocs(q);
        
        const exists = !querySnapshot.empty;
        console.log('[DEBUG-EXERCISE] Exercise verification by ID result:', {
          exists,
          id: exerciseId,
          matchCount: querySnapshot.size
        });
        
        return exists;
      } catch (error) {
        console.error('[DEBUG-EXERCISE] Error verifying exercise by ID:', error);
        return false;
      }
    }
    
    // Verify if an exercise exists in Firestore by name (document ID)
    async verifyExerciseExistsByName(exerciseName: string): Promise<boolean> {
      console.log(`[DEBUG-EXERCISE] Verifying if exercise exists by name: ${exerciseName}`);
      
      // Ensure consistent capitalization
      const formattedName = formatExerciseNameForId(exerciseName);
      
      try {
        const exerciseRef = doc(db, 'exercises', formattedName);
        const exerciseDoc = await getDoc(exerciseRef);
        
        console.log(`[DEBUG-EXERCISE] Exercise verification by name result: {exists: ${exerciseDoc.exists()}, name: '${formattedName.toLowerCase()}', data: ${exerciseDoc.exists() ? 'exists' : 'null'}}`);
        
        return exerciseDoc.exists();
      } catch (error) {
        console.error(`[DEBUG-EXERCISE] Error verifying exercise: ${error}`);
        return false;
      }
    }
    
    // Get an exercise by its name
    async getExerciseByName(exerciseName: string): Promise<Exercise | null> {
      console.log(`[DEBUG-EXERCISE] Getting exercise by name: ${exerciseName}`);
      
      // Ensure consistent capitalization
      const formattedName = formatExerciseNameForId(exerciseName);
      
      try {
        // Check cache first
        if (this.exerciseCache.has(formattedName)) {
          const cachedExercise = this.exerciseCache.get(formattedName);
          console.log(`[DEBUG-EXERCISE] Found exercise in cache: ${formattedName}`);
          return cachedExercise!;
        }
        
        // Use the formatted name as document ID
        const exerciseRef = doc(db, 'exercises', formattedName);
        const exerciseDoc = await getDoc(exerciseRef);
        
        if (!exerciseDoc.exists()) {
          console.log(`[DEBUG-EXERCISE] No exercise found with name: ${formattedName.toLowerCase()}`);
          return null;
        }
        
        const exerciseData = exerciseDoc.data();
        const exercise = new Exercise(exerciseData);
        
        // Cache the result
        this.exerciseCache.set(formattedName, exercise);
        
        return exercise;
      } catch (error) {
        console.error(`[DEBUG-EXERCISE] Error getting exercise by name: ${error}`);
        return null;
      }
    }

    // Helper function for capitalizing exercise names
    private capitalizeExerciseName(name: string): string {
      if (!name) return '';
      // Capitalize each word in the exercise name
      return name
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }

    // Create a new exercise document in Firestore
    async createExercise(exercise: any): Promise<void> {
      console.log(`[DEBUG-EXERCISE] Creating new exercise:`, exercise);
      
      // Ensure consistent capitalization for the exercise name
      const formattedName = formatExerciseNameForId(exercise.name);
      console.log(`[DEBUG-EXERCISE] Capitalized exercise name: ${formattedName}`);
      
      // Use the formatted name as document ID
      console.log(`[DEBUG-EXERCISE] Using exercise name as document ID: ${formattedName}`);
      
      try {
        // Create the exercise document with the name as ID (consistently capitalized)
        const exerciseRef = doc(db, 'exercises', formattedName);
        await setDoc(exerciseRef, { ...exercise, name: formattedName });
        
        console.log(`[DEBUG-EXERCISE] Exercise created successfully with document ID: ${formattedName}`);
        
        // Clear cache after creating
        this.clearCache();
        
      } catch (error) {
        console.error(`[DEBUG-EXERCISE] Error creating exercise: ${error}`);
        throw error;
      }
    }

    // Create a new exercise video document in Firestore
    async createExerciseVideo(video: any): Promise<void> {
      console.log(`[DEBUG-EXERCISE] Creating new exercise video:`, video);
      
      // Ensure consistent capitalization for the exercise name
      const formattedExerciseName = formatExerciseNameForId(video.exercise);
      console.log(`[DEBUG-EXERCISE] Capitalized exercise name in video: ${formattedExerciseName}`);
      
      try {
        // Create the exercise video document
        const exerciseVideoRef = doc(db, 'exerciseVideos', video.id);
        await setDoc(exerciseVideoRef, { ...video, exercise: formattedExerciseName });
        
        console.log(`[DEBUG-EXERCISE] Exercise video created successfully: ${video.id}`);
        console.log(`[DEBUG-EXERCISE] Exercise video linked to exercise document: ${formattedExerciseName}`);
        
        // Clear cache after creating
        this.clearCache();
        
      } catch (error) {
        console.error(`[DEBUG-EXERCISE] Error creating exercise video: ${error}`);
        throw error;
      }
    }
    
    async fetchExercises(): Promise<void> {
      try {
        console.log('[DEBUG-EXERCISE] Starting fetchExercises method');
        
        // Fetch all exercises
        console.log('[DEBUG-EXERCISE] Fetching exercises from Firestore');
        const exerciseSnapshot = await getDocs(collection(db, 'exercises'));
        console.log(`[DEBUG-EXERCISE] Fetched ${exerciseSnapshot.docs.length} exercises`);

        const exercises: Exercise[] = exerciseSnapshot.docs.map((doc) => {
          // Document ID is now the exercise name, but we still want to use the id field for internal references
          const data = doc.data();
          
          // Ensure the exercise name is capitalized
          const capitalizedName = this.capitalizeExerciseName(data.name || doc.id);
          
          return new Exercise({
            // Use the id field from the document data, not the document ID
            id: data.id || doc.id,
            // Ensure the name is properly capitalized
            name: capitalizedName,
            // Rest of the data
            ...data,
            // Ensure the name is consistent with the document ID
            documentId: doc.id
          });
        });
        
        console.log('[DEBUG-EXERCISE] Mapped exercises data to Exercise objects');
        console.log('[DEBUG-EXERCISE] Sample exercise data:', exercises.slice(0, 2).map(ex => ({
          id: ex.id,
          name: ex.name,
          documentId: ex.documentId,
          category: ex.category
        })));
    
        // Fetch all videos
        console.log('[DEBUG-EXERCISE] Fetching exercise videos from Firestore');
        const videoSnapshot = await getDocs(collection(db, 'exerciseVideos'));
        console.log(`[DEBUG-EXERCISE] Fetched ${videoSnapshot.docs.length} exercise videos`);
        
        const exerciseVideos: ExerciseVideo[] = videoSnapshot.docs.map((doc) => {
          const data = doc.data();
          
          // Ensure exercise name in video is capitalized
          const capitalizedExerciseName = this.capitalizeExerciseName(data.exercise || '');
          
          return new ExerciseVideo({
            id: doc.id,
            ...data,
            // Ensure exercise name is properly capitalized
            exercise: capitalizedExerciseName,
            // Make sure exerciseId is properly set if it's missing or incorrect
            exerciseId: data.exerciseId || data.exercise?.toLowerCase() || ''
          });
        });
        
        console.log('[DEBUG-EXERCISE] Mapped video data to ExerciseVideo objects');
        console.log('[DEBUG-EXERCISE] Sample video data:', exerciseVideos.slice(0, 2).map(video => ({
          id: video.id,
          exerciseId: video.exerciseId,
          exercise: video.exercise,
          videoURL: video.videoURL ? 'Has URL' : 'No URL'
        })));
    
        // Map videos to their corresponding exercises by matching exerciseId to document ID
        console.log('[DEBUG-EXERCISE] Mapping videos to exercises by exerciseId');
        const mappedExercises = exercises.map((exercise) => {
          // Find videos where exerciseId matches the document ID (name) of the exercise
          const videosForExercise = exerciseVideos
            .filter((video) => {
              // Match by the name (document ID) instead of the internal ID field
              // Do case-insensitive matching
              const matchByName = video.exerciseId === exercise.name.toLowerCase();
              const matchByExerciseId = video.exerciseId === exercise.documentId;
              const matchByExerciseName = video.exercise.toLowerCase() === exercise.name.toLowerCase();
              
              if (matchByName || matchByExerciseId || matchByExerciseName) {
                return true;
              }
              
              // Log any potential mismatches for debugging
              if (video.exercise.toLowerCase() === exercise.name.toLowerCase() && 
                  video.exerciseId !== exercise.name.toLowerCase() &&
                  video.exerciseId !== exercise.documentId) {
                console.log(`[DEBUG-EXERCISE] Potential mismatch: Video "${video.id}" has name that matches "${exercise.name}" but exerciseId "${video.exerciseId}" doesn't match documentId "${exercise.documentId}"`);
              }
              
              return false;
            })
            .map((video) => new ExerciseVideo({
              ...video,
              // Ensure exercise name is properly capitalized
              exercise: this.capitalizeExerciseName(video.exercise)
            })); // Ensure proper ExerciseVideo instances
          
          console.log(`[DEBUG-EXERCISE] Exercise "${exercise.name}" matched with ${videosForExercise.length} videos`);
            
          return new Exercise({
            ...exercise, // Keep existing properties
            videos: videosForExercise, // Ensure videos are instances of ExerciseVideo
          });
        });
    
        // Filter out exercises without videos
        this._allExercises = mappedExercises.filter((exercise: Exercise) => exercise.videos.length > 0);
    
        console.log(`[DEBUG-EXERCISE] Final result: ${this._allExercises.length} exercises with videos`);
        console.log('[DEBUG-EXERCISE] Sample from final result:', this._allExercises.slice(0, 3).map(ex => ({
          id: ex.id,
          name: ex.name,
          videoCount: ex.videos.length,
        })));
        
        // console.log(`Fetched ${this._allExercises.length} exercises with videos.`);
        
        // Detailed logging for debugging
        // console.log('Sample exercises:', this._allExercises.slice(0, 5).map(ex => ({
        //   name: ex.name,
        //   videoCount: ex.videos.length,
        //   firstVideoUrl: ex.videos[0]?.videoURL
        // })));
      } catch (error) {
        console.error('[DEBUG-EXERCISE] Error fetching exercises:', error);
        console.error('[DEBUG-EXERCISE] Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          name: error instanceof Error ? error.name : 'Unknown type',
          stack: error instanceof Error ? error.stack : 'No stack trace'
        });
        throw new Error('Failed to fetch exercises.');
      }
    }

    async fetchFeaturedExercisesWithVideos(limit: number = 24): Promise<Exercise[]> {
      try {
        // Fetch all exercises
        const exerciseSnapshot = await getDocs(collection(db, 'exercises'));
        const exercises: Exercise[] = exerciseSnapshot.docs.map((doc) => 
         new Exercise({
            id: doc.id,
            ...doc.data(),
          })
        );
    
        // Fetch all videos
        const videoSnapshot = await getDocs(collection(db, 'exerciseVideos'));
        const exerciseVideos: ExerciseVideo[] = videoSnapshot.docs.map((doc) =>
          new ExerciseVideo({
            id: doc.id,
            ...doc.data(),
          })
        );
    
        // Map videos to exercises and filter for those with GIFs
        const mappedExercises = exercises.map((exerciseData) => {
          // Ensure that each video is properly instantiated as an `ExerciseVideo`
          const videosForExercise = (exerciseVideos
            .filter((video) => video.exercise.toLowerCase() === exerciseData.name.toLowerCase())
            .map((video) => new ExerciseVideo(video))) as ExerciseVideo[];
        

          return new Exercise({
            id: exerciseData.id,
            name: exerciseData.name,
            description: exerciseData.description,
            category: exerciseData.category,
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
            author: new ExerciseAuthor(exerciseData.author || {}),
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
            new ExerciseVideo({
              id: doc.id,
              ...doc.data(),
            })
          );
          
          const exercises: Exercise[] = exerciseSnapshot.docs.map((doc) =>
            new Exercise({ id: doc.id, ...doc.data() })
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