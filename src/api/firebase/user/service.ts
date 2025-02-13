import { User, FollowRequest } from './types';
import { Workout } from '../workout';
import { Exercise, ExerciseVideo, ExerciseAuthor, ExerciseLog } from '../exercise/types';
import { ProfileImage } from '../user';

import { doc, getDoc, setDoc, documentId, collection, query, where, getDocs, limit, writeBatch, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject, getStorage } from 'firebase/storage';
import { db } from '../config';

import { store } from '../../../redux/store';
import { setUser } from '../../../redux/userSlice';

class UserService {
  get currentUser(): User | null {
    return store.getState().user.currentUser;
  }

  set currentUser(user: User | null) {
    store.dispatch(setUser(user));
  }

  async fetchUserFromFirestore(userId: string): Promise<User | null> {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return null;
    }

    return new User(userDoc.data());
}

  async updateUser(userId: string, user: User): Promise<void> {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, user.toDictionary(), { merge: true });
  }

  async getUsersByIds(ids: string[]): Promise<User[]> {
    if (!ids.length) return [];
    const users: User[] = [];
    const chunkSize = 10; // Firestore 'in' queries support up to 10 values
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where(documentId(), 'in', chunk));
      const querySnapshot = await getDocs(q);
      querySnapshot.docs.forEach(doc => {
        users.push(new User({ id: doc.id, ...doc.data() }));
      });
    }
    return users;
  }

  async getUserById(userId: string): Promise<User> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }
   
      return new User({
        id: userDoc.id,
        ...userDoc.data()
      });
   
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw error;
    }
   }

   async deleteUserVideo(exerciseId: string): Promise<void> {
    if (!this.currentUser?.id) {
      throw new Error('No user is signed in');
    }
  
    try {
      const exerciseRef = doc(db, 'exercises', exerciseId);
      const exerciseDoc = await getDoc(exerciseRef);
  
      if (exerciseDoc.exists()) {
        const videos = exerciseDoc.data().videos || [];
        
        // Delete video files from storage
        await Promise.all(
          videos.map(async (video: { videoURL?: string, gifURL?: string }) => {
            if (video.videoURL) {
              const videoRef = ref(getStorage(), video.videoURL);
              await deleteObject(videoRef);
            }
            if (video.gifURL) {
              const gifRef = ref(getStorage(), video.gifURL);
              await deleteObject(gifRef);
            }
          })
        );
      }
  
      // Delete exercise document
      await deleteDoc(exerciseRef);
  
    } catch (error) {
      console.error('Error deleting user video:', error);
      throw error;
    }
  }
  
  async deleteStack(stackId: string): Promise<void> {
    if (!this.currentUser?.id) {
      throw new Error('No user is signed in');
    }
  
    try {
      const stackRef = doc(db, 'users', this.currentUser.id, 'MyCreatedWorkouts', stackId);
      
      // Delete associated logs
      const logsRef = collection(stackRef, 'logs');
      const logsSnapshot = await getDocs(logsRef);
      await Promise.all(
        logsSnapshot.docs.map(doc => deleteDoc(doc.ref))
      );
  
      // Delete stack document
      await deleteDoc(stackRef);
  
    } catch (error) {
      console.error('Error deleting stack:', error);
      throw error;
    }
  }

  async createStack(workout: Workout, exerciseLogs?: ExerciseLog[]): Promise<Workout> {
    if (!this.currentUser?.id) {
      throw new Error('No user is signed in.');
    }

    // Reference to the new stack document under the user's MyCreatedWorkouts subcollection
    const userWorkoutRef = doc(
      collection(db, 'users', this.currentUser.id, 'MyCreatedWorkouts'),
      workout.id
    );

    try {
      // Save the workout document
      console.log("Right before we save: " + JSON.stringify(workout.toDictionary()));
      await setDoc(userWorkoutRef, workout.toDictionary());
      console.log('Stack created successfully');

      // If there are exercise logs, save them in a batch to the "logs" subcollection
      if (exerciseLogs && exerciseLogs.length > 0) {
        const batch = writeBatch(db);
        exerciseLogs.forEach((log, index) => {
          // Set the order (index + 1)
          log.order = index + 1;
          const logRef = doc(collection(userWorkoutRef, 'logs'), log.id);
          batch.set(logRef, log.toDictionary());
        });
        await batch.commit();
        console.log('Exercise logs saved successfully');
      }

      // After successful save, return the workout
      return workout;
      
    } catch (error) {
      console.error('Error creating stack:', error);
      throw error;
    }
  }

  async fetchUserStacks(userId?: string): Promise<Workout[]> {
    const currentUserId = userId || this.currentUser?.id;
    
    if (!currentUserId) {
      throw new Error('No user ID provided');
    }
  
    try {
      const stacksRef = collection(db, 'users', currentUserId, 'MyCreatedWorkouts');
      const querySnapshot = await getDocs(stacksRef);
      
      const stacks = await Promise.all(querySnapshot.docs.map(async doc => {
        const stackData = doc.data();
        
        // Fetch logs for this stack
        const logsRef = collection(doc.ref, 'logs');
        const logsSnapshot = await getDocs(logsRef);
        const logs = logsSnapshot.docs.map(logDoc => 
          new ExerciseLog({ id: logDoc.id, ...logDoc.data() })
        );
  
        return new Workout({
          ...stackData,
          id: doc.id,
          logs
        });
      }));
  
      return stacks;
    } catch (error) {
      console.error('Error fetching user stacks:', error);
      throw error;
    }
  }

  async fetchUserVideos(userId?: string): Promise<Exercise[]> {
    // Use current user's ID if no ID is provided
    const currentUserId = userId || this.currentUser?.id;
    
    if (!currentUserId) {
      throw new Error('No user ID provided');
    }
  
    try {
      // Step 1: Fetch user's exercise videos
      const exerciseVideosRef = collection(db, 'exerciseVideos');
      const q = query(exerciseVideosRef, where('userId', '==', currentUserId));
      
      const videoSnapshot = await getDocs(q);
  
      // Group videos by exercise name
      const videosByExerciseName: { [key: string]: ExerciseVideo[] } = {};
  
      videoSnapshot.docs.forEach(doc => {
        const videoData = doc.data();
        const exerciseName = videoData['exercise'] as string;
        
        if (!exerciseName) {
          console.warn(`Exercise name missing for video ${doc.id}`);
          return;
        }
  
        const video = new ExerciseVideo({
          id: doc.id,
          exerciseId: videoData.exerciseId || '',
          username: videoData.username || '',
          userId: videoData.userId || '',
          videoURL: videoData.videoURL || '',
          fileName: videoData.fileName || '',
          exercise: exerciseName,
          profileImage: new ProfileImage(videoData.profileImage || {}),  // Use ProfileImage constructor
          caption: videoData.caption || '',
          gifURL: videoData.gifURL || '',
          thumbnail: videoData.thumbnail || '',
          visibility: videoData.visibility || 'open',
          totalAccountsReached: videoData.totalAccountsReached || 0,
          totalAccountLikes: videoData.totalAccountLikes || 0,
          totalAccountBookmarked: videoData.totalAccountBookmarked || 0,
          totalAccountUsage: videoData.totalAccountUsage || 0,
          isApproved: videoData.isApproved || false,
          liked: videoData.liked || false,
          bookmarked: videoData.bookmarked || false,
          createdAt: videoData.createdAt ? new Date(videoData.createdAt) : new Date(),
          updatedAt: videoData.updatedAt ? new Date(videoData.updatedAt) : new Date()
        });
  
        if (!videosByExerciseName[exerciseName]) {
          videosByExerciseName[exerciseName] = [];
        }
        videosByExerciseName[exerciseName].push(video);
      });
  
      // Step 2: Fetch all exercises
      const exercisesRef = collection(db, 'exercises');
      const exercisesSnapshot = await getDocs(exercisesRef);
  
      // Step 3: Map videos to exercises
      const userExercises: Exercise[] = exercisesSnapshot.docs
        .map(doc => {
          const exerciseData = doc.data();
          const exerciseName = exerciseData.name;
          
          // Create base exercise
          // For the Exercise:
          const exercise = new Exercise({
            id: doc.id,
            name: exerciseName,
            category: exerciseData.category,
            primaryBodyParts: exerciseData.primaryBodyParts || [],
            secondaryBodyParts: exerciseData.secondaryBodyParts || [],
            tags: exerciseData.tags || [],
            description: exerciseData.description || '',
            visibility: exerciseData.visibility || 'limited',
            steps: exerciseData.steps || [],
            videos: videosByExerciseName[exerciseName] || [],
            currentVideoPosition: 0,
            reps: exerciseData.reps || '',
            sets: exerciseData.sets || 0,
            weight: exerciseData.weight || 0,
            author: new ExerciseAuthor({  // Use ExerciseAuthor constructor
              userId: exerciseData.author?.userId || '',
              username: exerciseData.author?.username || ''
            }),
            createdAt: exerciseData.createdAt ? new Date(exerciseData.createdAt) : new Date(),
            updatedAt: exerciseData.updatedAt ? new Date(exerciseData.updatedAt) : new Date()
          });
  
          return exercise;
        })
        .filter(exercise => exercise.videos.length > 0);
  
      return userExercises;
  
    } catch (error) {
      console.error('Error fetching user videos:', error);
      throw error;
    }
  }

  async fetchFollowing(): Promise<FollowRequest[]> {
    const currentUser = this.currentUser;
    if (!currentUser?.id) {
      throw new Error('No user is signed in');
    }
  
    try {
      const followRequestsRef = collection(db, 'followRequests');
      const q = query(
        followRequestsRef, 
        where('fromUser.id', '==', currentUser.id)
      );
  
      const querySnapshot = await getDocs(q);
  
      const followRequests: FollowRequest[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          fromUser: {
            id: data.fromUser?.id || '',
            username: data.fromUser?.username || '',
            displayName: data.fromUser?.displayName || ''
          },
          toUser: {
            id: data.toUser?.id || '',
            username: data.toUser?.username || '',
            displayName: data.toUser?.displayName || ''
          },
          status: data.status || '',
          createdAt: data.createdAt instanceof Date 
            ? data.createdAt 
            : (data.createdAt ? new Date(data.createdAt) : new Date()),
          updatedAt: data.updatedAt instanceof Date 
            ? data.updatedAt 
            : (data.updatedAt ? new Date(data.updatedAt) : new Date())
        } as FollowRequest;
      });
  
      return followRequests;
    } catch (error) {
      console.error('Error fetching following:', error);
      throw error;
    }
  }
  
  async fetchFollowers(): Promise<FollowRequest[]> {
    const currentUser = this.currentUser;
    if (!currentUser?.id) {
      throw new Error('No user is signed in');
    }
  
    try {
      const followRequestsRef = collection(db, 'followRequests');
      const q = query(
        followRequestsRef, 
        where('toUser.id', '==', currentUser.id)
      );
  
      const querySnapshot = await getDocs(q);
  
      const followRequests: FollowRequest[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          fromUser: {
            id: data.fromUser?.id || '',
            username: data.fromUser?.username || '',
            displayName: data.fromUser?.displayName || ''
          },
          toUser: {
            id: data.toUser?.id || '',
            username: data.toUser?.username || '',
            displayName: data.toUser?.displayName || ''
          },
          status: data.status || '',
          createdAt: data.createdAt instanceof Date 
            ? data.createdAt 
            : (data.createdAt ? new Date(data.createdAt) : new Date()),
          updatedAt: data.updatedAt instanceof Date 
            ? data.updatedAt 
            : (data.updatedAt ? new Date(data.updatedAt) : new Date())
        } as FollowRequest;
      });
  
      return followRequests;
    } catch (error) {
      console.error('Error fetching followers:', error);
      throw error;
    }
  }

   /**
   * Fetch user ID by username
   * @param username The username to search for
   * @returns Promise resolving to the user ID or null if not found
   */
   async getUserIdByUsername(username: string): Promise<string | null> {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username), limit(1));
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        return userDoc.id;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching user ID by username:', error);
      return null;
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      const usersRef = collection(db, 'users');
      const querySnapshot = await getDocs(usersRef);
      
      return querySnapshot.docs
        .map(doc => new User({ id: doc.id, ...doc.data() }))
        .filter(user => user.profileImage?.profileImageURL); // Only return users with profile images
        
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }

  // In userService
  async getUserByUsername(username: string): Promise<User | null> {
    try {
      console.log('getUserByUsername - Searching for username:', username);
      
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username));
      
      console.log('getUserByUsername - Executing query...');
      const querySnapshot = await getDocs(q);
      
      console.log('getUserByUsername - Query results:', {
        empty: querySnapshot.empty,
        size: querySnapshot.size,
        docs: querySnapshot.docs.map(doc => ({
          id: doc.id,
          username: doc.data().username,
          data: doc.data()
        }))
      });
      
      if (querySnapshot.empty) {
        console.log('getUserByUsername - No user found');
        return null;
      }

      const userData = querySnapshot.docs[0].data();
      console.log('getUserByUsername - Found user data:', userData);
      
      return new User({ id: querySnapshot.docs[0].id, ...userData });
    } catch (error) {
      console.error('Error fetching user by username:', error);
      throw error;
    }
  }

  async fetchUsersWithVideosUploaded(): Promise<User[]> {
    try {
      // Create a query against the users collection
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('videoCount', '>', 0) // Only fetch users with videos
      );

      const querySnapshot = await getDocs(q);
      
      // Map the documents to User objects
      const users = querySnapshot.docs
      .map(doc => {
            const data = doc.data();
            return new User({ id: doc.id, ...data });
        })
        // Filter out users without profile images
        .filter(user => user.profileImage?.profileImageURL)
        // Shuffle the results
        .sort(() => Math.random() - 0.5);

      return users;
    } catch (error) {
      console.error('Error fetching users with videos:', error);
      return [];
    }
  }
}

export const userService = new UserService();