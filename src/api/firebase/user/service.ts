import { User, FollowRequest } from './types';
import { Workout } from '../workout';
import { Exercise, ExerciseVideo, ExerciseAuthor, ExerciseLog } from '../exercise/types';
import { ProfileImage, SubscriptionType } from '../user';

import { doc, getDoc, setDoc, documentId, collection, query, where, getDocs, limit, writeBatch, deleteDoc, addDoc } from 'firebase/firestore';
import { ref, deleteObject, getStorage } from 'firebase/storage';
import { db } from '../config';

import { store } from '../../../redux/store';
import { setUser } from '../../../redux/userSlice';

class UserService {
  get nonUICurrentUser(): User | null {
    const userDict = store.getState().user.currentUser;
    return User.fromDictionary(userDict);
  }

  set nonUICurrentUser(user: User | null) {
    store.dispatch(setUser(user ? user.toDictionary() : null));
  }

  async fetchUserFromFirestore(userId: string): Promise<User | null> {
    console.log('fetchUserFromFirestore called for userId:', userId);
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      console.log(`User document not found for userId: ${userId}`);
      return null;
    }

    const userData = userDoc.data();
    
    // Log full user data for debugging
    console.log('Raw user data structure:', userData);
    
    // Special handling for creator object 
    if (userData.creator) {
      // Log the raw creator object structure and key values
      console.log('Raw creator object keys:', userData.creator);
      
      // Specifically check for the stripeAccountId
      const rawStripeAccountId = userData.creator.stripeAccountId;
      console.log(`Raw stripeAccountId in Firestore: ${rawStripeAccountId} (${typeof rawStripeAccountId})`);
      
      // Ensure we preserve the stripeAccountId exactly as it comes from Firestore
      if (rawStripeAccountId) {
        console.log('★ Found valid stripeAccountId in Firestore:', rawStripeAccountId);
      } else {
        console.log('✖ No stripeAccountId found in Firestore');
      }
    } else {
      console.log('No creator object found in user data');
    }

    return new User(userId, userData);
  }

  async updateUser(userId: string, user: User): Promise<void> {
    const userRef = doc(db, 'users', userId);
    const userData = user.toDictionary();
    console.log(`[UserService Update] Updating user ${userId} with data:`, JSON.parse(JSON.stringify(userData)));
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
        users.push(new User(doc.id, { id: doc.id, ...doc.data() }));
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
   
      return new User(userDoc.id, {
        id: userDoc.id,
        ...userDoc.data()
      });
   
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw error;
    }
   }

   async deleteUserVideo(exerciseId: string): Promise<void> {
    if (!this.nonUICurrentUser?.id) {
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
    if (!this.nonUICurrentUser?.id) {
      throw new Error('No user is signed in');
    }
  
    try {
      const stackRef = doc(db, 'users', this.nonUICurrentUser.id, 'MyCreatedWorkouts', stackId);
      
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

  async getBetaUserAccess(email: string, user: User): Promise<boolean> {
    try {
      console.log('Starting getBetaUser check:', { 
        email,
        currentUserId: user.id,
        environment: process.env.NODE_ENV,
        currentSubscription: user.subscriptionType,
        timestamp: new Date().toISOString()
      });

      const betaRef = collection(db, 'beta');
      const betaQuery = query(betaRef, where('email', '==', email.toLowerCase()));
      const querySnapshot = await getDocs(betaQuery);

      console.log('Beta query results:', {
        found: !querySnapshot.empty,
        email: email.toLowerCase(),
        documentsCount: querySnapshot.size,
        timestamp: new Date().toISOString()
      });

      if (querySnapshot.empty) {
        return false;
      }

      const document = querySnapshot.docs[0];
      const isApproved = document.data()?.isApproved as boolean;

      console.log('Beta document data:', {
        isApproved,
        documentId: document.id,
        fullData: document.data()
      });

      if (!this.nonUICurrentUser) {
        console.log('No current user found');
        return false;
      }

      if (isApproved) {
        if (this.nonUICurrentUser.subscriptionType != SubscriptionType.unsubscribed) {
          console.log('User already subscribed:', {
            currentType: user.subscriptionType,
            action: 'no change needed'
          });
          return true;
        }
        
        console.log('Upgrading user to beta:', {
          user: user,
          fromType: this.nonUICurrentUser.subscriptionType,
          toType: SubscriptionType.beta
        });

        const updatedUser = new User(user.id, {
          ...user,
          subscriptionType: SubscriptionType.beta
        });
        
        await this.updateUser(user.id, updatedUser);
        console.log('Successfully upgraded user to beta');
      } else {
        if (user.subscriptionType == SubscriptionType.beta) {
          console.log('Downgrading beta user:', {
            fromType: user.subscriptionType,
            toType: SubscriptionType.unsubscribed
          });
          
          const updatedUser = new User(user.id, {
            ...user,
            subscriptionType: SubscriptionType.unsubscribed
          });
          
          await this.updateUser(user.id, updatedUser);
          console.log('Successfully downgraded user from beta');
        } else {
          console.log('No subscription change needed:', {
            currentType: user.subscriptionType,
            betaStatus: 'not approved'
          });
        }
      }

      return isApproved || false;
    } catch (error) {
      console.error('Error in getBetaUser:', {
        error,
        email,
        userId: user.id,
        timestamp: new Date().toISOString()
      });
      return false;
    }
  }

  async createStack(workout: Workout, exerciseLogs?: ExerciseLog[]): Promise<Workout> {
    if (!this.nonUICurrentUser?.id) {
      throw new Error('No user is signed in.');
    }

    // Reference to the new stack document under the user's MyCreatedWorkouts subcollection
    const userWorkoutRef = doc(
      collection(db, 'users', this.nonUICurrentUser.id, 'MyCreatedWorkouts'),
      workout.id
    );

    try {
      // Save the workout document
      await setDoc(userWorkoutRef, workout.toDictionary());
      console.log('Stack created successfully');

      // // If there are exercise logs, save them in a batch to the "logs" subcollection
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
    const currentUserId = userId || this.nonUICurrentUser?.id;
    
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
        console.log("log data:", logsSnapshot.docs.map(logDoc => logDoc.data()));

        const logs = logsSnapshot.docs.map(logDoc => 
          new ExerciseLog({ id: logDoc.id, ...logDoc.data() })
        );
  
        console.log("logs after construction:", logs);

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
    const currentUserId = userId || this.nonUICurrentUser?.id;
    
    if (!currentUserId) {
      throw new Error('No user ID provided');
    }
  
    try {
      // Step 1: Fetch user's exercise videos
      const exerciseVideosRef = collection(db, 'exerciseVideos');
      console.log("[DEBUG-PROFILE] Fetching videos for user ID:", currentUserId);
      const q = query(exerciseVideosRef, where('userId', '==', currentUserId));
      
      const videoSnapshot = await getDocs(q);
      console.log(`[DEBUG-PROFILE] Found ${videoSnapshot.size} videos for user`);

      // Check for our specific video ID
      console.log("[DEBUG-PROFILE] Looking for video with ID: UYpNnfGmw9xyPA6dOv2D");
      const targetVideoExists = videoSnapshot.docs.some(doc => doc.id === "UYpNnfGmw9xyPA6dOv2D");
      console.log(`[DEBUG-PROFILE] Target video exists in query results: ${targetVideoExists}`);

      // List all video IDs for debugging
      console.log("[DEBUG-PROFILE] All video IDs in query results:", videoSnapshot.docs.map(doc => doc.id));
  
      // Group videos by exercise name
      const videosByExerciseName: { [key: string]: ExerciseVideo[] } = {};
  
      videoSnapshot.docs.forEach(doc => {
        const videoData = doc.data();
        const exerciseName = videoData['exercise'] as string;
        
        if (!exerciseName) {
          console.warn(`Exercise name missing for video ${doc.id}`);
          return;
        }

        console.log(`[DEBUG-PROFILE] Processing video ${doc.id}:`, {
          exerciseName: exerciseName,
          exerciseId: videoData.exerciseId || '',
          userId: videoData.userId || '',
        });
        
        // Special logging for Hangs videos to debug the issue
        if (exerciseName === 'Hangs') {
          console.log(`[DEBUG-PROFILE] Found Hangs video: ${doc.id} with exerciseId: ${videoData.exerciseId || 'none'}`);
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
          
          // Check if we have videos for this exercise name
          const hasVideos = videosByExerciseName[exerciseName]?.length > 0;
          console.log(`[DEBUG-PROFILE] Checking exercise "${exerciseName}" - has videos: ${hasVideos ? 'yes' : 'no'}`);
          
          // IMPORTANT: If the document ID doesn't match the exercise name (lowercase), find videos by document ID too
          const exerciseDocId = doc.id.toLowerCase();
          const exerciseNameLower = exerciseName.toLowerCase();
          
          // Log document ID vs name
          console.log(`[DEBUG-PROFILE] Exercise document ID: "${exerciseDocId}", name: "${exerciseName}" (lower: "${exerciseNameLower}")`);
          
          // If they don't match, look for videos by document ID too
          let videosForThisExercise = videosByExerciseName[exerciseName] || [];
          
          if (exerciseDocId !== exerciseNameLower && videosByExerciseName[exerciseDocId]) {
            console.log(`[DEBUG-PROFILE] Found ${videosByExerciseName[exerciseDocId].length} additional videos by document ID`);
            videosForThisExercise = [...videosForThisExercise, ...videosByExerciseName[exerciseDocId]];
          }
          
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
            videos: videosForThisExercise,
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
        .filter(exercise => {
          const hasVideos = exercise.videos.length > 0;
          console.log(`[DEBUG-PROFILE] Filtering exercise "${exercise.name}" - has videos: ${hasVideos ? 'yes' : 'no'}, video count: ${exercise.videos.length}`);
          return hasVideos;
        });
  
      console.log(`[DEBUG-PROFILE] Final user exercises count: ${userExercises.length}`);
      console.log("[DEBUG-PROFILE] Final exercises:", userExercises.map(ex => ({
        id: ex.id,
        name: ex.name,
        videoCount: ex.videos.length,
        videoIds: ex.videos.map(v => v.id)
      })));

      return userExercises;
  
    } catch (error) {
      console.error('Error fetching user videos:', error);
      throw error;
    }
  }

  async fetchFollowing(): Promise<FollowRequest[]> {
    const currentUser = this.nonUICurrentUser;
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
    const currentUser = this.nonUICurrentUser;
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
        .map(doc => new User(doc.id, { id: doc.id, ...doc.data() }))
        .filter(user => user.profileImage?.profileImageURL); // Only return users with profile images
        
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }

  // In userService
  async getUserByUsername(username: string): Promise<User | null> {
    try {      
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username));
      
      const querySnapshot = await getDocs(q);
            
      if (querySnapshot.empty) {
        return null;
      }

      const userData = querySnapshot.docs[0].data();
      
      return new User(querySnapshot.docs[0].id, { id: querySnapshot.docs[0].id, ...userData });
    } catch (error) {
      throw error;
    }
  }

  async fetchFeaturedUsers(): Promise<User[]> {
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
            return new User(doc.id, { id: doc.id, ...data });
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

  async queryUsers(searchQuery: string): Promise<User[]> {
    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('username', '>=', searchQuery.toLowerCase()),
        where('username', '<=', searchQuery.toLowerCase() + '\uf8ff'),
        limit(10)
      );

      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs
        .map(doc => new User(doc.id, { id: doc.id, ...doc.data() }))
        .filter(user => user.profileImage?.profileImageURL); // Only return users with profile images
        
    } catch (error) {
      console.error('Error querying users:', error);
      return [];
    }
  }

  /**
   * Check if a user has purchased a specific challenge
   * @param userId The ID of the user to check
   * @param challengeId The ID of the challenge to check
   * @returns Promise resolving to an object with hasPurchased flag and payment details if found
   */
  async hasUserPurchasedChallenge(userId: string, challengeId: string): Promise<{
    hasPurchased: boolean;
    payment?: {
      id: string;
      purchaseDate: string | null;
      amount: number;
    };
  }> {
    if (!userId || !challengeId) {
      console.warn('hasUserPurchasedChallenge called with missing parameters', { userId, challengeId });
      return { hasPurchased: false };
    }
    
    try {
      console.log(`==================== PAYMENT CHECK ====================`);
      console.log(`Checking if user ${userId} has purchased challenge ${challengeId}`);
      
      // Convert timestamp for Unix timestamps or Firestore timestamps
      const convertTimestamp = (timestamp: any): string | null => {
        if (!timestamp) return null;
        
        // If it's a number (Unix timestamp), convert it
        if (typeof timestamp === 'number') {
          return new Date(timestamp * 1000).toISOString();
        }
        
        // If it has a toDate method (Firestore Timestamp)
        if (timestamp && typeof timestamp.toDate === 'function') {
          return timestamp.toDate().toISOString();
        }
        
        // If it's a Firestore serialized timestamp with _seconds
        if (timestamp && timestamp._seconds) {
          return new Date(timestamp._seconds * 1000).toISOString();
        }
        
        // Handle already converted date
        if (timestamp instanceof Date) {
          return timestamp.toISOString();
        }
        
        // Handle string timestamp
        if (typeof timestamp === 'string') {
          try {
            return new Date(timestamp).toISOString();
          } catch (e) {
            return timestamp;
          }
        }
        
        return null;
      };
      
      // First, let's log all payments for this user
      const allUserPaymentsRef = collection(db, 'payments');
      const allUserPaymentsQuery = query(
        allUserPaymentsRef,
        where('buyerId', '==', userId),
      );
      
      const allUserPaymentsSnapshot = await getDocs(allUserPaymentsQuery);
      console.log(`Found ${allUserPaymentsSnapshot.size} total payments for user ${userId}`);
      
      allUserPaymentsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`Payment ${doc.id}:`, {
          challengeId: data.challengeId,
          amount: data.amount,
          status: data.status,
          buyerId: data.buyerId,
          ownerId: data.ownerId,
          createdAt: convertTimestamp(data.createdAt),
          rawCreatedAt: data.createdAt ? 
            { type: typeof data.createdAt, value: JSON.stringify(data.createdAt) } : null
        });
      });
      
      // Simple check: Does this user have ANY payment for this challenge?
      const matchingPayment = allUserPaymentsSnapshot.docs.find(
        doc => doc.data().challengeId === challengeId
      );
      
      const hasPurchased = !!matchingPayment;
      
      console.log(`RESULT: User ${userId} has ${hasPurchased ? '' : 'NOT '}purchased challenge ${challengeId}`);
      
      if (hasPurchased) {
        const paymentData = matchingPayment.data();
        console.log('Found matching payment:', paymentData);
        
        return {
          hasPurchased: true,
          payment: {
            id: matchingPayment.id,
            purchaseDate: convertTimestamp(paymentData.createdAt),
            amount: paymentData.amount || 0
          }
        };
      }
      
      console.log(`==================== PAYMENT CHECK COMPLETE ====================`);
      return { hasPurchased: false };
    } catch (error) {
      console.error('Error checking if user has purchased challenge:', error);
      return { hasPurchased: false };
    }
  }

  /**
   * Saves the Pulse Programming application form data to the beta collection
   * @param formData The form data to save
   * @returns Promise resolving to success status
   */
  async saveApplicationForm(formData: {
    name: string;
    email: string;
    role: {
      trainer: boolean;
      enthusiast: boolean;
      coach: boolean;
      fitnessInstructor: boolean;
    };
    primaryUse: string;
    useCases: {
      oneOnOneCoaching: boolean;
      communityRounds: boolean;
      personalPrograms: boolean;
    };
    clientCount: string;
    yearsExperience: string;
    longTermGoal: string;
    isCertified: boolean;
    certificationName?: string;
    applyForFoundingCoaches: boolean;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const docData = {
        ...formData,
        submittedAt: new Date(),
        status: 'pending'
      };

      const docRef = await addDoc(collection(db, 'beta-applications'), docData);
      console.log('Application saved with ID:', docRef.id);
      
      return {
        success: true,
        message: 'Application submitted successfully'
      };
    } catch (error) {
      console.error('Error saving application:', error);
      return {
        success: false,
        message: 'Failed to submit application'
      };
    }
  }

  // UserDataCard methods for AI programming context
  async fetchAllUserDataCards(): Promise<any[]> {
    try {
      console.log('Fetching all user data cards from Firestore...');
      const dataCardsRef = collection(db, 'user-datacards');
      const querySnapshot = await getDocs(dataCardsRef);
      
      const dataCards: any[] = [];
      querySnapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        dataCards.push(data);
      });

      console.log(`Fetched ${dataCards.length} user data cards from Firestore`);
      return dataCards;
    } catch (error) {
      console.error('Error fetching user data cards:', error);
      throw error;
    }
  }

  async createUserDataCard(dataCard: any): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'user-datacards'), {
        ...dataCard,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('User data card created with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error creating user data card:', error);
      throw error;
    }
  }

  async updateUserDataCard(cardId: string, dataCard: any): Promise<void> {
    try {
      const cardRef = doc(db, 'user-datacards', cardId);
      await setDoc(cardRef, {
        ...dataCard,
        updatedAt: new Date()
      }, { merge: true });
      console.log('User data card updated:', cardId);
    } catch (error) {
      console.error('Error updating user data card:', error);
      throw error;
    }
  }

  /**
   * Updates staff onboarding progress for a user
   * @param userId The user ID
   * @param progress The onboarding progress data
   */
  async updateStaffOnboardingProgress(userId: string, progress: any): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      const updateData = {
        staffOnboardingProgress: {
          ...progress,
          startedAt: progress.startedAt || new Date(),
        },
        updatedAt: new Date()
      };
      
      await setDoc(userRef, updateData, { merge: true });
      console.log('Staff onboarding progress updated for user:', userId);
    } catch (error) {
      console.error('Error updating staff onboarding progress:', error);
      throw error;
    }
  }

  /**
   * Marks terms as accepted for staff onboarding
   * @param userId The user ID
   */
  async acceptStaffOnboardingTerms(userId: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      const updateData = {
        'staffOnboardingProgress.termsAcceptedAt': new Date(),
        updatedAt: new Date()
      };
      
      await setDoc(userRef, updateData, { merge: true });
      console.log('Staff onboarding terms accepted for user:', userId);
    } catch (error) {
      console.error('Error accepting staff onboarding terms:', error);
      throw error;
    }
  }

  /**
   * Marks staff onboarding as complete
   * @param userId The user ID
   */
  async completeStaffOnboarding(userId: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      const updateData = {
        'staffOnboardingProgress.completedAt': new Date(),
        updatedAt: new Date()
      };
      
      await setDoc(userRef, updateData, { merge: true });
      console.log('Staff onboarding completed for user:', userId);
    } catch (error) {
      console.error('Error completing staff onboarding:', error);
      throw error;
    }
  }
}

export const userService = new UserService();