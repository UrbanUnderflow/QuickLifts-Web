import { firebaseStorageService } from '../storage/service';
import { exerciseService } from '../exercise/service';
import { userService } from '../user/service';
import { ExerciseVideo, Exercise } from '../exercise/types';
import { formatExerciseNameForId } from '../../../utils/stringUtils';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../config';

/**
 * Handles video processing operations like generating GIFs from videos
 */
class VideoProcessorService {
  /**
   * Checks if a video needs a GIF and generates one if necessary
   * @param exerciseId The ID of the exercise
   * @param videoId The ID of the video
   */
  async ensureVideoHasGif(exerciseId: string, videoId: string): Promise<boolean> {
    console.log(`[VIDEO-PROCESSOR] Checking if video ${videoId} has a GIF`);
    
    try {
      // Get the video directly from Firestore
      console.log(`[VIDEO-PROCESSOR] Looking up video ${videoId} directly`);
      const videoDoc = await getDoc(doc(db, 'exerciseVideos', videoId));
      
      if (!videoDoc.exists()) {
        console.error(`[VIDEO-PROCESSOR] Video ${videoId} not found in exerciseVideos collection`);
        return false;
      }
      
      // Create ExerciseVideo object from Firestore data
      const videoData = videoDoc.data();
      const video = new ExerciseVideo({
        id: videoId,
        ...videoData
      });
      
      console.log(`[VIDEO-PROCESSOR] Found video ${videoId} with exerciseId: ${videoData.exerciseId}`);
      
      // If it already has a GIF, nothing to do
      if (video.gifURL) {
        console.log(`[VIDEO-PROCESSOR] Video ${videoId} already has a GIF: ${video.gifURL}`);
        return true;
      }
      
      // Get the proper exercise name for the storage path
      // We'll use the value from the exercise field in the video document
      const formattedExerciseName = formatExerciseNameForId(video.exercise);
      console.log(`[VIDEO-PROCESSOR] Using exercise name for storage: ${formattedExerciseName}`);
      
      // Generate GIF using the Netlify function
      console.log(`[VIDEO-PROCESSOR] Generating GIF for video ${videoId}`);
      
      // Call the Netlify function to generate the GIF
      const response = await fetch('/.netlify/functions/process-video-gif', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exerciseId: videoData.exerciseId, // Use the exerciseId from the video document
          videoId,
          exerciseName: formattedExerciseName // Also send the exercise name for storage path
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error(`[VIDEO-PROCESSOR] Error generating GIF:`, errorData);
        return false;
      }
      
      const result = await response.json();
      console.log(`[VIDEO-PROCESSOR] GIF generation result:`, result);
      
      // Return success
      return result.success || false;
    } catch (error) {
      console.error(`[VIDEO-PROCESSOR] Error ensuring video has GIF:`, error);
      return false;
    }
  }
  
  /**
   * Process all videos in the user's library that don't have GIFs
   */
  async processAllUserVideosWithoutGifs(): Promise<void> {
    console.log(`[VIDEO-PROCESSOR] Processing all user videos without GIFs`);
    
    try {
      // Get all user videos
      const exercises = await userService.fetchUserVideos();
      
      // Filter videos without GIFs
      let videosToProcess: { exerciseId: string; videoId: string }[] = [];
      
      exercises.forEach((exercise: Exercise) => {
        exercise.videos.forEach((video: ExerciseVideo) => {
          if (!video.gifURL) {
            videosToProcess.push({
              exerciseId: exercise.id,
              videoId: video.id
            });
          }
        });
      });
      
      console.log(`[VIDEO-PROCESSOR] Found ${videosToProcess.length} videos without GIFs`);
      
      // Process videos in batches to avoid overwhelming the server
      const batchSize = 3;
      for (let i = 0; i < videosToProcess.length; i += batchSize) {
        const batch = videosToProcess.slice(i, i + batchSize);
        
        // Process batch concurrently
        const promises = batch.map(({ exerciseId, videoId }) => 
          this.ensureVideoHasGif(exerciseId, videoId)
        );
        
        await Promise.all(promises);
        
        // Wait a bit between batches to avoid rate limits
        if (i + batchSize < videosToProcess.length) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      console.log(`[VIDEO-PROCESSOR] Finished processing all videos without GIFs`);
    } catch (error) {
      console.error(`[VIDEO-PROCESSOR] Error processing all videos:`, error);
    }
  }
}

export const videoProcessorService = new VideoProcessorService(); 