import {
    collection,
    getDocs,
    query,
    orderBy,
    limit,
    startAfter,
    DocumentSnapshot,
  } from 'firebase/firestore';
import { db } from '../config';
import { Exercise } from './types';
import { ExerciseVideo } from '../../../types/ExerciseVideo';

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
        const exerciseVideos: ExerciseVideo[] = videoSnapshot.docs.map((doc) => ({
          id: doc.id,
          exerciseId: doc.data().exerciseId || '',
          username: doc.data().username || '',
          userId: doc.data().userId || '',
          videoURL: doc.data().videoURL || '',
          fileName: doc.data().fileName || '',
          exercise: doc.data().exercise || '',
          profileImage: doc.data().profileImage || { profileImageURL: '' },
          caption: doc.data().caption || '',
          gifURL: doc.data().gifURL || '',
          thumbnail: doc.data().thumbnail || '',
          visibility: doc.data().visibility || 'open',
          totalAccountsReached: doc.data().totalAccountsReached || 0,
          totalAccountLikes: doc.data().totalAccountLikes || 0,
          totalAccountBookmarked: doc.data().totalAccountBookmarked || 0,
          totalAccountUsage: doc.data().totalAccountUsage || 0,
          isApproved: doc.data().isApproved || false,
          liked: doc.data().liked || false,
          bookmarked: doc.data().bookmarked || false,
          createdAt: doc.data().createdAt ? new Date(doc.data().createdAt.seconds * 1000) : new Date(),
          updatedAt: doc.data().updatedAt ? new Date(doc.data().updatedAt.seconds * 1000) : new Date(),
        }));
  
        // Map videos to their corresponding exercises
        const mappedExercises = exercises.map((exercise) => {
          const videosForExercise = exerciseVideos.filter((video) => video.exerciseId === exercise.id);
          return {
            ...exercise,
            videos: videosForExercise,
          };
        });
  
        // Filter out exercises without videos and store them
        this._allExercises = mappedExercises.filter((exercise) => exercise.videos.length > 0);
  
        console.log(`Fetched ${this._allExercises.length} exercises with videos.`);
      } catch (error) {
        console.error('Error fetching exercises:', error);
        throw new Error('Failed to fetch exercises.');
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
          const exerciseVideos: ExerciseVideo[] = videoSnapshot.docs.map((doc) => ({
            id: doc.id,
            exerciseId: doc.data().exerciseId || '',
            username: doc.data().username || '',
            userId: doc.data().userId || '',
            videoURL: doc.data().videoURL || '',
            fileName: doc.data().fileName || '',
            exercise: doc.data().exercise || '',
            profileImage: doc.data().profileImage || { profileImageURL: '' },
            caption: doc.data().caption || '',
            gifURL: doc.data().gifURL || '',
            thumbnail: doc.data().thumbnail || '',
            visibility: doc.data().visibility || 'open',
            totalAccountsReached: doc.data().totalAccountsReached || 0,
            totalAccountLikes: doc.data().totalAccountLikes || 0,
            totalAccountBookmarked: doc.data().totalAccountBookmarked || 0,
            totalAccountUsage: doc.data().totalAccountUsage || 0,
            isApproved: doc.data().isApproved || false,
            liked: doc.data().liked || false,
            bookmarked: doc.data().bookmarked || false,
            createdAt: doc.data().createdAt ? new Date(doc.data().createdAt.seconds * 1000) : new Date(),
            updatedAt: doc.data().updatedAt ? new Date(doc.data().updatedAt.seconds * 1000) : new Date(),
          }));
    
          const exercises: Exercise[] = exerciseSnapshot.docs.map((doc) =>
            Exercise.fromFirebase({ id: doc.id, ...doc.data() })
          );
    
          // Map videos to exercises
          const mappedExercises = exercises.map((exercise) => {
            const videosForExercise = exerciseVideos.filter((video) => video.exerciseId === exercise.id);
            return {
              ...exercise,
              videos: videosForExercise,
            };
          });
    
          // Filter exercises with videos
          const filteredExercises = mappedExercises.filter((exercise) => exercise.videos.length > 0);
    
          // Update the last visible document for pagination
          const lastVisible = exerciseSnapshot.docs[exerciseSnapshot.docs.length - 1];
    
          return { exercises: filteredExercises, lastVisible };
        } catch (error) {
          console.error('Error fetching paginated exercises:', error);
          throw error;
        }
      }
  }
  
  export const exerciseService = new ExerciseService();