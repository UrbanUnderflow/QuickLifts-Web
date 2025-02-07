// src/services/FirebaseStorageService.ts
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { User } from "../../../api/firebase/user";
import { userService } from "../../../api/firebase/user";
import { auth } from "../../../api/firebase/config";

export enum UploadImageType {
  Profile = "profile_images",
  Feedback = "feedback",
  CheckIn = "checkin",
  Meal = "meal",
  GroupChat = "group_chat"
}

export interface UploadResult {
  gsURL: string;
  downloadURL: string;
}

export const enum VideoType {
    Exercise = "exercise",
    Intro = "intro",
    RoundChat = "round-chat"
}

export class FirebaseStorageService {
  private storage = getStorage();

  async uploadVideo(
      file: File, 
      videoType: VideoType = VideoType.Exercise
    ): Promise<UploadResult> {
      // Ensure user is authenticated
      const user = auth.currentUser;
      if (!user) {
        throw new Error("User must be authenticated to upload video");
      }
  
      // Validate file type and size
      const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
      const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  
      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error("Invalid file type. Only MP4, AVI, and QuickTime videos are allowed.");
      }
  
      if (file.size > MAX_FILE_SIZE) {
        throw new Error("File is too large. Maximum size is 100MB.");
      }
  
      // Generate unique filename
      const fileName = `${Date.now()}_${file.name}`;
      const storagePath = `videos/${user.uid}/${fileName}`;
      
      // Create storage reference
      const storageRef = ref(getStorage(), storagePath);
  
      try {
        // Upload the file
        const snapshot = await uploadBytes(storageRef, file);
        
        // Get download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        // Construct GS URL (Google Storage URL)
        const gsURL = `gs://${snapshot.ref.bucket}/${snapshot.ref.fullPath}`;
  
        return { gsURL, downloadURL };
      } catch (error) {
        console.error("Video upload failed", error);
        throw error;
      }
    }

  async uploadImage(
    file: File, 
    imageType: UploadImageType = UploadImageType.Profile
  ): Promise<UploadResult> {
    // Ensure user is authenticated
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User must be authenticated to upload image");
    }

    // Generate unique filename
    const fileName = `${Date.now()}_${file.name}`;
    const storagePath = `${imageType}/${user.uid}/${fileName}`;
    
    // Create storage reference
    const storageRef = ref(this.storage, storagePath);

    try {
      // Upload the file
      const snapshot = await uploadBytes(storageRef, file);
      
      // Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      // Construct GS URL (Google Storage URL)
      const gsURL = `gs://${snapshot.ref.bucket}/${snapshot.ref.fullPath}`;

      // If it's a profile image, update the user
      if (imageType === UploadImageType.Profile) {
        await this.updateUserProfileImage(downloadURL);
      }

      return { gsURL, downloadURL };
    } catch (error) {
      console.error("Image upload failed", error);
      throw error;
    }
  }

  private async updateUserProfileImage(imageURL: string): Promise<void> {
    // Ensure current user exists
    if (!userService.currentUser) {
      throw new Error("No current user found");
    }

    // Create a new User object with updated profile image
    const updatedUser = new User({
      ...userService.currentUser.toDictionary(),
      profileImage: {
        profileImageURL: imageURL,
        imageOffsetWidth: 0,  // You might want to make these configurable
        imageOffsetHeight: 0
      },
      updatedAt: new Date()
    });

    // Update user in Firestore
    await userService.updateUser(updatedUser.id, updatedUser);
  }

  // Optional: Image caching similar to iOS implementation
  private imageCache: Map<string, string> = new Map();

  async fetchImage(url: string): Promise<string> {
    // Check cache first
    if (this.imageCache.has(url)) {
      return this.imageCache.get(url)!;
    }

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const imageURL = URL.createObjectURL(blob);
      
      // Cache the image URL
      this.imageCache.set(url, imageURL);
      
      return imageURL;
    } catch (error) {
      console.error("Image fetch failed", error);
      throw error;
    }
  }
}

// Create a singleton instance
export const firebaseStorageService = new FirebaseStorageService();