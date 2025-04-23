// src/services/FirebaseStorageService.ts
import { getStorage, ref, uploadBytes, getDownloadURL, uploadBytesResumable } from "firebase/storage";
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
  exerciseId?: string;
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
      videoType: VideoType = VideoType.Exercise,
      onProgress?: (progress: number) => void,
      exerciseName?: string
    ): Promise<UploadResult> {
      console.log('[DEBUG-STORAGE] Starting uploadVideo method', { 
        fileType: file.type, 
        fileSize: file.size, 
        videoType,
        exerciseName
      });
      
      // Ensure user is authenticated
      const user = auth.currentUser;
      if (!user) {
        console.error('[DEBUG-STORAGE] Authentication error: No current user');
        throw new Error("User must be authenticated to upload video");
      }
      
      console.log('[DEBUG-STORAGE] User authenticated', { 
        uid: user.uid, 
        email: user.email 
      });
  
      // Validate file type and size
      const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
      const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  
      if (!ALLOWED_TYPES.includes(file.type)) {
        console.error('[DEBUG-STORAGE] File type validation error', { 
          fileType: file.type, 
          allowedTypes: ALLOWED_TYPES 
        });
        throw new Error("Invalid file type. Only MP4, AVI, and QuickTime videos are allowed.");
      }
  
      if (file.size > MAX_FILE_SIZE) {
        console.error('[DEBUG-STORAGE] File size validation error', { 
          fileSize: file.size, 
          maxSize: MAX_FILE_SIZE 
        });
        throw new Error("File is too large. Maximum size is 100MB.");
      }
      
      console.log('[DEBUG-STORAGE] File validation passed');
  
      // Generate unique filename
      const fileName = `${Date.now()}_${file.name}`;
      
      // Determine the storage path based on the video type and exercise name
      let storagePath = '';
      if (videoType === VideoType.Exercise && exerciseName) {
        // Format the exercise name for storage path (capitalize first letter of each word)
        const formattedExerciseName = exerciseName.trim()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        
        // Use exercise name for videos folder structure
        storagePath = `videos/${formattedExerciseName}/${fileName}`;
        console.log('[DEBUG-STORAGE] Using exercise name for storage path:', formattedExerciseName);
      } else {
        // Fallback to user ID if no exercise name provided
        storagePath = `videos/${videoType}/${user.uid}/${fileName}`;
        console.log('[DEBUG-STORAGE] Using default storage path (no exercise name provided)');
      }
      
      console.log('[DEBUG-STORAGE] Generated storage path', { 
        fileName, 
        storagePath 
      });
      
      // Create storage reference
      const storageRef = ref(getStorage(), storagePath);
      console.log('[DEBUG-STORAGE] Created storage reference');
  
      try {
        // Create upload task
        console.log('[DEBUG-STORAGE] Creating upload task');
        const uploadTask = uploadBytesResumable(storageRef, file);
        console.log('[DEBUG-STORAGE] Upload task created');
        
        // Add progress listener if callback provided
        if (onProgress) {
          console.log('[DEBUG-STORAGE] Adding progress listener');
          uploadTask.on('state_changed', 
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes);
              console.log(`[DEBUG-STORAGE] Upload progress: ${Math.round(progress * 100)}%`, {
                bytesTransferred: snapshot.bytesTransferred,
                totalBytes: snapshot.totalBytes,
                state: snapshot.state
              });
              onProgress(progress);
            },
            (error) => {
              console.error('[DEBUG-STORAGE] Upload state error:', error);
            }
          );
        }
        
        // Wait for upload to complete
        console.log('[DEBUG-STORAGE] Waiting for upload to complete');
        const snapshot = await uploadTask;
        console.log('[DEBUG-STORAGE] Upload completed', snapshot);
        
        // Get download URL
        console.log('[DEBUG-STORAGE] Getting download URL');
        const downloadURL = await getDownloadURL(snapshot.ref);
        console.log('[DEBUG-STORAGE] Got download URL:', downloadURL);
        
        const gsURL = `gs://${snapshot.ref.bucket}/${snapshot.ref.fullPath}`;
        console.log('[DEBUG-STORAGE] Complete upload result', { gsURL, downloadURL });
  
        return { gsURL, downloadURL };
      } catch (error) {
        console.error("[DEBUG-STORAGE] Video upload failed", error);
        console.error('[DEBUG-STORAGE] Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          name: error instanceof Error ? error.name : 'Unknown error type',
          stack: error instanceof Error ? error.stack : 'No stack trace'
        });
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
    const storageRef = ref(getStorage(), storagePath);

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

  /**
   * Uploads a GIF blob to Firebase Storage
   * @param blob The GIF blob to upload
   * @param storagePath The path in Firebase Storage to upload to
   * @returns Promise that resolves to the upload result
   */
  async uploadGifBlob(
    blob: Blob,
    storagePath: string
  ): Promise<UploadResult> {
    console.log('[DEBUG-STORAGE] Starting uploadGifBlob method', { 
      blobSize: blob.size, 
      storagePath
    });
    
    // Ensure user is authenticated
    const user = auth.currentUser;
    if (!user) {
      console.error('[DEBUG-STORAGE] Authentication error: No current user');
      throw new Error("User must be authenticated to upload GIF");
    }
    
    console.log('[DEBUG-STORAGE] User authenticated', { 
      uid: user.uid, 
      email: user.email 
    });
    
    try {
      // Create a storage reference
      const storageRef = ref(this.storage, storagePath);
      
      // Upload the blob
      console.log('[DEBUG-STORAGE] Uploading GIF blob to', storagePath);
      const snapshot = await uploadBytes(storageRef, blob, {
        contentType: 'image/gif',
        customMetadata: {
          'uploaded-by': user.uid,
          'upload-timestamp': new Date().toISOString()
        }
      });
      
      // Get the download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      console.log('[DEBUG-STORAGE] GIF upload complete', { 
        downloadURL, 
        storagePath 
      });
      
      return {
        gsURL: storagePath,
        downloadURL
      };
    } catch (error) {
      console.error('[DEBUG-STORAGE] Error uploading GIF:', error);
      throw error;
    }
  }

  private async updateUserProfileImage(imageURL: string): Promise<void> {
    // Ensure current user exists
    if (!userService.nonUICurrentUser) {
      throw new Error("No current user found");
    }

    // Create a new User object with updated profile image
    const updatedUser = new User(userService.nonUICurrentUser.id, {
      ...userService.nonUICurrentUser.toDictionary(),
      profileImage: {
        profileImageURL: imageURL,
        imageOffsetWidth: 0,
        imageOffsetHeight: 0
      },
      updatedAt: new Date()
    });

    // Update user in Firestore
    await userService.updateUser(updatedUser.id, updatedUser);
    userService.nonUICurrentUser = updatedUser; // Update cached user
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


// In FirebaseStorageService.ts, update the VideoTrimmerService class

export class VideoTrimmerService {
    trimVideo(
      file: File,
      startTime: number,
      endTime: number,
      onProgress?: (progress: number) => void
    ): Promise<File> {
      return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return reject(new Error("Unable to get canvas context"));
        }
        const chunks: Blob[] = [];
  
        video.src = URL.createObjectURL(file);
  
        video.onloadedmetadata = () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          video.currentTime = startTime;
        };
  
        // Wait until the video has seeked to startTime before starting recording
        video.onseeked = () => {
          const stream = canvas.captureStream();
          const mediaRecorder = new MediaRecorder(stream);
  
          mediaRecorder.ondataavailable = (e: BlobEvent) => {
            if (e.data.size > 0) {
              chunks.push(e.data);
            }
          };
  
          mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: chunks[0]?.type || "video/webm" });
            // Force the file type to "video/webm" so it passes the allowed formats check
            const trimmedFile = new File([blob], file.name, { type: "video/webm" });
            URL.revokeObjectURL(video.src);
            resolve(trimmedFile);
          };
  
          mediaRecorder.start();
          video.play();
  
          video.ontimeupdate = () => {
            if (video.currentTime >= endTime) {
              mediaRecorder.stop();
              video.pause();
            } else {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              if (onProgress) {
                onProgress((video.currentTime - startTime) / (endTime - startTime));
              }
            }
          };
        };
  
        video.onerror = () => {
          reject(new Error("Error loading video"));
        };
      });
    }
  }
  
  

export const videoTrimmerService = new VideoTrimmerService();

// Create a singleton instance
export const firebaseStorageService = new FirebaseStorageService();