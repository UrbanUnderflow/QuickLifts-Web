// src/api/firebase/user/types.ts
import { User } from '../../../types/User';

export interface UserService {
    updateUser: (userId: string, user: User) => Promise<void>;
    fetchUserFromFirestore: (userId: string) => Promise<User>;
}