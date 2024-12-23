import { User } from '../../../types/User';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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
}

export const userService = new UserService();