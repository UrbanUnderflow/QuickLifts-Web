import { User } from '../../../types/User';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config';

class UserService {
  private _currentUser: User | null = null;

  get currentUser(): User | null {
    return this._currentUser;
  }

  set currentUser(user: User | null) {
    this._currentUser = user;
  }

  async fetchUserFromFirestore(userId: string): Promise<User> {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    return User.fromFirebase(userDoc.data());
  }

  async updateUser(userId: string, user: User): Promise<void> {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, user.toFirestore(), { merge: true });
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
          return User.fromFirebase({ id: doc.id, ...data });
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