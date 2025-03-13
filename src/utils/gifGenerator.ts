import { FirebaseStorageService } from '../api/firebase/storage/service';
import { ref, getStorage, getDownloadURL } from 'firebase/storage';
import GIF from 'gif.js';

interface GifGeneratorOptions {
  width?: number;
  height?: number;
  numFrames?: number;
  quality?: number;
  delay?: number;
  repeat?: number;
}

const defaultOptions: GifGeneratorOptions = {
  width: 320, // Larger size for better quality
  height: 320, // Larger size for better quality
  numFrames: 15, // We'll adjust this based on video duration
  quality: 10, // Lower is better quality (more colors)
  delay: 100, // Milliseconds between frames
  repeat: 0 // 0 means loop forever
};

/**
 * Utility for generating GIFs from videos on the client side
 */
export const gifGenerator = {
  /**
   * Generates a GIF from a video URL and uploads it to Firebase Storage
   * @param videoUrl The URL of the video to generate a GIF from
   * @param exerciseName The name of the exercise (for storage path)
   * @param videoId The ID of the video
   * @param options Optional GIF generation options
   * @returns Promise that resolves to the URL of the generated GIF
   */
  async generateAndUploadGif(
    videoUrl: string,
    exerciseName: string,
    videoId: string,
    options: GifGeneratorOptions = defaultOptions
  ): Promise<string> {
    try {
      console.log('[DEBUG] Starting GIF generation for video:', videoUrl);
      
      // Extract the path from the video URL
      const storage = getStorage();
      const videoPath = decodeURIComponent(videoUrl.split('/o/')[1].split('?')[0]);
      const videoRef = ref(storage, videoPath);
      
      console.log('[DEBUG] Getting download URL for video path:', videoPath);
      const downloadURL = await getDownloadURL(videoRef);
      
      // Use a CORS proxy to access the video
      const corsProxyUrl = this.createCorsProxyUrl(downloadURL);
      
      // Create a video element and properly load the video
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous'; // This is important for CORS
      video.muted = true; // Muted videos can autoplay
      video.autoplay = false; // Disable autoplay
      video.controls = false; // Hide controls
      video.preload = 'auto';
      video.playsInline = true; // Important for mobile
      
      console.log('[DEBUG] Loading video from proxy URL:', corsProxyUrl);
      video.src = corsProxyUrl;
      
      // Append the video to the document but make it invisible
      video.style.position = 'fixed';
      video.style.top = '-9999px';
      video.style.left = '-9999px';
      video.style.opacity = '0.01';
      document.body.appendChild(video);
      
      // Wait for the video to load
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => {
          console.log('[DEBUG] Video loaded successfully, duration:', video.duration, 'seconds');
          resolve();
        };
        video.onerror = (e) => {
          console.error('[DEBUG] Error loading video:', e);
          reject(new Error('Failed to load video'));
        };
        video.load();
      });

      // Calculate optimal number of frames based on video duration
      // Ensure at least 1 frame per second of video, but minimum 8 frames and maximum 30 frames
      const videoDuration = video.duration;
      const calculatedFrames = Math.max(8, Math.min(30, Math.ceil(videoDuration)));
      options.numFrames = options.numFrames || calculatedFrames;
      
      console.log(`[DEBUG] Video duration: ${videoDuration}s. Using ${options.numFrames} frames for GIF`);

      // Generate the GIF
      console.log('[DEBUG] Starting GIF creation with gif.js');
      const gifBlob = await this.createGifFromVideo(video, options);
      
      // Clean up the video element
      document.body.removeChild(video);
      
      // Upload the GIF to Firebase Storage
      const storageService = new FirebaseStorageService();
      const storagePath = `gifs/${exerciseName}/${videoId}.gif`;
      
      console.log('[DEBUG] Uploading GIF to Firebase Storage');
      const uploadResult = await storageService.uploadGifBlob(gifBlob, storagePath);
      console.log('[DEBUG] GIF generated and uploaded successfully:', uploadResult.downloadURL);
      
      return uploadResult.downloadURL;
    } catch (error) {
      console.error('[DEBUG] Error generating and uploading GIF:', error);
      throw error;
    }
  },
  
  /**
   * Creates a CORS proxy URL for accessing videos
   * @param url The original URL to proxy
   * @returns The proxied URL
   */
  createCorsProxyUrl(url: string): string {
    // For development, use our API proxy route
    if (process.env.NODE_ENV === 'development') {
      return `/api/proxy?url=${encodeURIComponent(url)}`;
    }
    
    // For production, return the original URL (assuming CORS is configured)
    return url;
  },
  
  /**
   * Creates a GIF from a video element using gif.js
   * @param video The video element to create a GIF from
   * @param options Optional GIF generation options
   * @returns Promise that resolves to a Blob containing the GIF
   */
  createGifFromVideo(
    video: HTMLVideoElement,
    options: GifGeneratorOptions
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        // Extract dimensions from options or video
        const width = options.width || video.videoWidth || 320;
        const height = options.height || video.videoHeight || 320;
        const frameCount = options.numFrames || 15;
        
        // Create a canvas for frame capture
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;
        
        // Initialize gif.js
        const gif = new GIF({
          workers: 2,
          quality: options.quality || 10,
          width: width,
          height: height,
          workerScript: '/gifjs/gif.worker.js', // Worker script path
          repeat: options.repeat || 0, // 0 = loop forever
          debug: true
        });
        
        // Setup complete handler
        gif.on('finished', (blob: Blob) => {
          console.log('[DEBUG] GIF creation finished, size:', blob.size);
          resolve(blob);
        });
        
        // Setup progress handler
        gif.on('progress', (progress: number) => {
          console.log('[DEBUG] GIF encoding progress:', Math.round(progress * 100), '%');
        });
        
        // Calculate time distribution for frames based on video duration
        const duration = video.duration;
        
        // Determine start and end points - use the full video except the very beginning and end
        const startTime = Math.min(0.5, duration * 0.05); // Start at 0.5s or 5% of duration
        const endTime = Math.max(duration - 0.5, duration * 0.95); // End at 0.5s before end or 95% of duration
        const effectiveDuration = endTime - startTime;
        
        // Store hash values of frames to detect duplicates
        const frameHashes: Set<string> = new Set();
        
        // Simple hash function to check for duplicate frames
        const hashCanvas = (canvas: HTMLCanvasElement): string => {
          // Get a portion of the canvas data to use as a hash
          // Using center portion of the image
          const x = Math.floor(width * 0.4);
          const y = Math.floor(height * 0.4);
          const size = Math.floor(width * 0.2);
          
          const imageData = ctx?.getImageData(x, y, size, size).data;
          if (!imageData) return '';
          
          // Sample every 20th pixel as a hash
          let hash = '';
          for (let i = 0; i < imageData.length; i += 80) {
            hash += imageData[i];
          }
          return hash;
        };
        
        console.log(`[DEBUG] Capturing frames from time ${startTime.toFixed(2)}s to ${endTime.toFixed(2)}s`);
        
        // Function to add a frame at a specific time
        const addFrameAtTime = (time: number, frameIndex: number) => {
          return new Promise<boolean>((resolveFrame) => {
            // Set video time
            video.currentTime = time;
            
            // Wait for the video to seek to the requested time
            const seeked = () => {
              video.removeEventListener('seeked', seeked);
              
              // Draw the video frame to canvas
              ctx.drawImage(video, 0, 0, width, height);
              
              // Check if this frame is a duplicate
              const frameHash = hashCanvas(canvas);
              const isDuplicate = frameHashes.has(frameHash);
              
              if (isDuplicate) {
                console.log(`[DEBUG] Skipping duplicate frame ${frameIndex + 1} at time ${time.toFixed(2)}s`);
                resolveFrame(false);
                return;
              }
              
              // Add the hash to our set
              frameHashes.add(frameHash);
              
              // Add the frame to the GIF
              gif.addFrame(ctx, {
                copy: true,
                delay: options.delay || 100,
                dispose: 2 // Restore to background color
              });
              
              console.log(`[DEBUG] Added frame ${frameIndex + 1}/${frameCount} at time ${time.toFixed(2)}s`);
              resolveFrame(true);
            };
            
            video.addEventListener('seeked', seeked);
          });
        };
        
        // Asynchronous function to capture all frames and render GIF
        const captureFrames = async () => {
          // Ensure video is ready
          await video.play();
          video.pause();
          
          // Calculate frame time interval
          const framesAdded: boolean[] = [];
          
          // Capture frames evenly distributed through the video
          for (let i = 0; i < frameCount; i++) {
            // Calculate frame time position - distribute frames evenly
            // For frame i, position = startTime + (i / (frameCount-1)) * effectiveDuration
            const framePosition = startTime + (effectiveDuration * i / (frameCount - 1));
            
            // Ensure we don't go past the end of the video
            const time = Math.min(framePosition, duration - 0.1);
            
            // Add the frame
            const added = await addFrameAtTime(time, i);
            framesAdded.push(added);
          }
          
          // Check if we have enough frames for a good animation
          const totalFramesAdded = framesAdded.filter(added => added).length;
          console.log(`[DEBUG] Added ${totalFramesAdded} unique frames out of ${frameCount} attempted`);
          
          if (totalFramesAdded < 3) {
            // Try again with different frame selection if we didn't get enough frames
            console.log('[DEBUG] Not enough unique frames, trying alternate frame selection');
            
            // Clear existing frames
            frameHashes.clear();
            
            // Try to capture frames at specific intervals throughout the video
            const interval = Math.max(0.5, duration / 10);
            
            for (let time = 0.5; time < duration - 0.5; time += interval) {
              const frameIndex = Math.floor((time - 0.5) / interval);
              await addFrameAtTime(time, frameIndex);
            }
          }
          
          // Start rendering the GIF
          console.log('[DEBUG] All frames added, rendering GIF...');
          gif.render();
        };
        
        // Start the frame capture process
        captureFrames().catch((error) => {
          console.error('[DEBUG] Error capturing frames:', error);
          reject(error);
        });
        
      } catch (error) {
        console.error('[DEBUG] Error in createGifFromVideo:', error);
        reject(error);
      }
    });
  }
}; 