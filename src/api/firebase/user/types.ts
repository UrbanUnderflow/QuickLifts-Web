// src/api/firebase/user/types.ts
import { User } from '../../../types/User';

export interface UserService {
    updateUser: (userId: string, user: User) => Promise<void>;
    fetchUserFromFirestore: (userId: string) => Promise<User>;
    fetchUsersWithVideosUploaded: () => Promise<User[]>;
    currentUser: User | null;
}

// types/ProfileImage.ts
export interface ProfileImage {
    profileImageURL: string;
    imageOffsetWidth: number;
    imageOffsetHeight: number;
 }
 
 export function fromFirebase(data: any): ProfileImage {
    return {
        profileImageURL: data.profileImageURL || '',
        imageOffsetWidth: data.imageOffsetWidth || 0,
        imageOffsetHeight: data.imageOffsetHeight || 0
    };
 }
 
 export class ProfileImage {
    static fromFirebase(data: any): ProfileImage {
        return fromFirebase(data);
    }
 }