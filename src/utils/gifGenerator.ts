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
  numFrames: 10, // Default number of frames
  quality: 10, // Lower is better quality (more colors)
  delay: 200, // 200ms delay per frame (5fps)
  repeat: 0   // Loop forever
};

export const gifGenerator = {
  async generateAndUploadGif(
    videoUrl: string,
    exerciseName: string,
    videoId: string,
    options: GifGeneratorOptions = defaultOptions
  ): Promise<string> {
    try {
      console.log('[DEBUG] Starting GIF generation for video:', videoUrl);
      console.log('[DEBUG] Options:', JSON.stringify(options));
      
      // Extract the path from the video URL
      const storage = getStorage();
      const videoPath = decodeURIComponent(videoUrl.split('/o/')[1].split('?')[0]);
      console.log('[DEBUG] Extracted video path:', videoPath);
      
      const videoRef = ref(storage, videoPath);
      
      console.log('[DEBUG] Getting download URL for video path');
      const downloadURL = await getDownloadURL(videoRef);
      console.log('[DEBUG] Got download URL:', downloadURL);
      
      // Use a CORS proxy to access the video
      const corsProxyUrl = this.createCorsProxyUrl(downloadURL);
      console.log('[DEBUG] Created CORS proxy URL:', corsProxyUrl);
      
      // Create a video element
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.autoplay = false;
      video.controls = false;
      video.preload = 'auto';
      video.playsInline = true;
      
      // Add event listeners before setting src
      video.addEventListener('error', (e) => {
        console.error('[DEBUG] Video error event:', e);
        if (video.error) {
          console.error('[DEBUG] Video error code:', video.error.code);
          console.error('[DEBUG] Video error message:', video.error.message);
        }
      });
      
      console.log('[DEBUG] Setting video src:', corsProxyUrl);
      video.src = corsProxyUrl;
      
      // Append the video to the document but make it invisible
      video.style.position = 'fixed';
      video.style.top = '-9999px';
      video.style.left = '-9999px';
      video.style.opacity = '0.01';
      document.body.appendChild(video);
      console.log('[DEBUG] Video element appended to document');
      
      // Wait for the video to load
      console.log('[DEBUG] Waiting for video to load (metadata and data)');
      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          console.warn('[DEBUG] Video load timeout after 15 seconds');
          if (video.readyState >= 2) {
            console.log('[DEBUG] Video has enough data to continue despite timeout');
            resolve();
          } else {
            reject(new Error(`Video load timeout. readyState: ${video.readyState}`));
          }
        }, 15000);
        
        video.onloadedmetadata = () => {
          console.log('[DEBUG] Video metadata loaded, duration:', video.duration, 'seconds, dimensions:', video.videoWidth, 'x', video.videoHeight);
          video.onloadeddata = () => {
            clearTimeout(timeoutId);
            console.log('[DEBUG] Video data loaded successfully');
            resolve();
          };
        };
        
        video.onerror = (e) => {
          clearTimeout(timeoutId);
          console.error('[DEBUG] Error loading video:', e);
          console.error('[DEBUG] Video error details:', video.error);
          reject(new Error(`Failed to load video: ${video.error?.message || 'Unknown error'}`));
        };
        
        video.load();
      });
      
      // Generate the GIF
      console.log('[DEBUG] Starting GIF creation with gif.js');
      console.log('[DEBUG] Video state before GIF creation - readyState:', video.readyState, 'duration:', video.duration);
      const gifBlob = await this.createGifFromVideo(video, options);
      console.log('[DEBUG] GIF creation completed, blob size:', gifBlob.size);
      
      // Clean up the video element
      document.body.removeChild(video);
      
      // Upload the GIF to Firebase Storage
      const storageService = new FirebaseStorageService();
      const storagePath = `gifs/${exerciseName}/${videoId}.gif`;
      
      console.log('[DEBUG] Uploading GIF to Firebase Storage at path:', storagePath);
      const uploadResult = await storageService.uploadGifBlob(gifBlob, storagePath);
      console.log('[DEBUG] GIF generated and uploaded successfully:', uploadResult.downloadURL);
      
      return uploadResult.downloadURL;
    } catch (error) {
      console.error('[DEBUG] Error generating and uploading GIF:', error);
      if (error instanceof Error) {
        console.error('[DEBUG] Error name:', error.name);
        console.error('[DEBUG] Error message:', error.message);
        console.error('[DEBUG] Error stack:', error.stack);
      }
      throw error;
    }
  },
  
  createCorsProxyUrl(url: string): string {
    if (process.env.NODE_ENV === 'development') {
      return `/api/proxy?url=${encodeURIComponent(url)}`;
    }
    return url;
  },
  
  createGifFromVideo(
    video: HTMLVideoElement,
    options: GifGeneratorOptions
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        // Log detailed information about the video
        console.log('[DEBUG] Video element info:', {
          readyState: video.readyState,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          duration: video.duration,
          paused: video.paused,
          ended: video.ended,
          currentSrc: video.currentSrc,
          crossOrigin: video.crossOrigin,
          error: video.error,
        });

        // Extract dimensions from options or video
        const width = options.width || video.videoWidth || 320;
        const height = options.height || video.videoHeight || 320;
        const frameCount = options.numFrames || 10;
        
        console.log(`[DEBUG] Creating GIF with dimensions ${width}x${height}, ${frameCount} frames`);
        
        // Create a canvas for frame capture
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Initialize gif.js
        const gif = new GIF({
          workers: 2,
          quality: options.quality || 10,
          width: width,
          height: height,
          workerScript: '/gifjs/gif.worker.js',
          repeat: options.repeat || 0,
          debug: true
        });
        
        // Setup handlers
        gif.on('finished', (blob: Blob) => {
          console.log('[DEBUG] GIF creation finished, size:', blob.size);
          resolve(blob);
        });
        
        gif.on('progress', (progress: number) => {
          console.log('[DEBUG] GIF encoding progress:', Math.round(progress * 100), '%');
        });
        
        // Track captured frames and total frames
        let capturedFrames = 0;
        let framesToCapture = Math.min(frameCount, 24); // Limit to reasonable number
        
        // New approach: Capture frames sequentially by playing the video
        // Instead of trying to seek (which isn't working), we'll use the timeupdate event
        const attemptCapture = async () => {
          try {
            // First reset the video
            video.pause();
            video.currentTime = 0;
            await new Promise(r => setTimeout(r, 500)); // Give time to update
            
            console.log('[DEBUG] Starting sequential frame capture');
            
            // Calculate frame times
            const duration = video.duration;
            if (isNaN(duration) || duration <= 0) {
              throw new Error(`Invalid video duration: ${duration}`);
            }
            
            console.log(`[DEBUG] Video duration: ${duration} seconds`);
            
            // Create an array of frames to capture - evenly distributed through the video
            const frameTimes: number[] = [];
            
            // For very short videos, adjust number of frames
            const actualFrameCount = duration < 3 ? 
              Math.min(5, Math.max(3, framesToCapture)) : 
              framesToCapture;
            
            // Skip the first and last 10% for better quality frames
            const startTime = Math.min(0.5, duration * 0.1);
            const endTime = Math.max(duration - 0.5, duration * 0.9);
            const effectiveDuration = endTime - startTime;
            
            for (let i = 0; i < actualFrameCount; i++) {
              const time = startTime + (i * effectiveDuration / Math.max(1, actualFrameCount - 1));
              frameTimes.push(Math.min(time, duration - 0.1));
            }
            
            console.log(`[DEBUG] Planned capture times: ${frameTimes.map(t => t.toFixed(2)).join(', ')}`);
            
            // Alternative approach #1: Capture in series using a player and the timeupdate event
            const captureNextFrame = (index: number) => {
              if (index >= frameTimes.length) {
                console.log(`[DEBUG] Finished capturing all ${capturedFrames} frames`);
                if (capturedFrames > 0) {
                  console.log('[DEBUG] Rendering GIF...');
                  gif.render();
                } else {
                  reject(new Error('Failed to capture any frames'));
                }
                return;
              }
              
              const targetTime = frameTimes[index];
              console.log(`[DEBUG] Setting video time to ${targetTime.toFixed(2)}s (frame ${index + 1}/${frameTimes.length})`);
              
              // Set up a one-time timeupdate listener
              const handleTimeUpdate = () => {
                // Only capture if we're close to our target time
                if (Math.abs(video.currentTime - targetTime) < 0.1) {
                  video.removeEventListener('timeupdate', handleTimeUpdate);
                  
                  console.log(`[DEBUG] Capturing frame at ${video.currentTime.toFixed(2)}s`);
                  ctx.drawImage(video, 0, 0, width, height);
                  
                  // Add the frame to the GIF
                  gif.addFrame(canvas, {
                    copy: true,
                    delay: options.delay || 200,
                    dispose: 2
                  });
                  
                  capturedFrames++;
                  console.log(`[DEBUG] Frame ${index + 1} captured at ${video.currentTime.toFixed(2)}s`);
                  
                  // Pause and move to next frame
                  video.pause();
                  setTimeout(() => captureNextFrame(index + 1), 100);
                }
              };
              
              // Attach listener and set time
              video.addEventListener('timeupdate', handleTimeUpdate);
              video.currentTime = targetTime;
              
              // Set a timeout in case the timeupdate event doesn't fire properly
              setTimeout(() => {
                video.removeEventListener('timeupdate', handleTimeUpdate);
                
                // Force a capture anyway
                console.log(`[DEBUG] Timeout reached for frame ${index + 1}, capturing anyway at ${video.currentTime.toFixed(2)}s`);
                ctx.drawImage(video, 0, 0, width, height);
                
                // Add the frame to the GIF
                gif.addFrame(canvas, {
                  copy: true,
                  delay: options.delay || 200,
                  dispose: 2
                });
                
                capturedFrames++;
                
                // Move to next frame
                setTimeout(() => captureNextFrame(index + 1), 100);
              }, 1500);
            };
            
            // Alternative approach #2: If the video can play, use play + capture
            if (video.readyState >= 3) {
              console.log('[DEBUG] Video is ready, trying play-based capture approach');
              
              // Try playing the video and capturing frames during playback
              const playBasedCapture = async () => {
                try {
                  // Reset video
                  video.currentTime = 0;
                  video.muted = true;
                  
                  // Set up a listener for regular frame capture during playback
                  const interval = duration / framesToCapture;
                  let lastCaptureTime = -interval; // Ensure first frame gets captured
                  
                  const captureInterval = (e: Event) => {
                    // Only capture if enough time has passed since last capture
                    if (video.currentTime - lastCaptureTime >= interval) {
                      console.log(`[DEBUG] Play-based capture at ${video.currentTime.toFixed(2)}s`);
                      
                      ctx.drawImage(video, 0, 0, width, height);
                      gif.addFrame(canvas, {
                        copy: true,
                        delay: options.delay || 200,
                        dispose: 2
                      });
                      
                      lastCaptureTime = video.currentTime;
                      capturedFrames++;
                      
                      // If we have enough frames, stop
                      if (capturedFrames >= framesToCapture) {
                        video.removeEventListener('timeupdate', captureInterval);
                        video.pause();
                        console.log(`[DEBUG] Play-based capture complete with ${capturedFrames} frames`);
                        gif.render();
                      }
                    }
                  };
                  
                  // Listen for time updates for capturing
                  video.addEventListener('timeupdate', captureInterval);
                  
                  // Also set a listener for when playback ends
                  video.addEventListener('ended', () => {
                    video.removeEventListener('timeupdate', captureInterval);
                    console.log(`[DEBUG] Video playback ended with ${capturedFrames} frames captured`);
                    if (capturedFrames > 0) {
                      gif.render();
                    } else {
                      // If no frames captured during playback, fall back to sequential capture
                      console.log('[DEBUG] No frames captured during playback, falling back to sequential capture');
                      captureNextFrame(0);
                    }
                  });
                  
                  // Start playback
                  console.log('[DEBUG] Starting video playback for frame capture');
                  await video.play();
                  
                } catch (playError) {
                  console.error('[DEBUG] Error during play-based capture:', playError);
                  console.log('[DEBUG] Falling back to sequential capture');
                  captureNextFrame(0);
                }
              };
              
              // Try the play-based approach
              await playBasedCapture();
              
            } else {
              // If video isn't fully loaded, use the sequential approach
              console.log('[DEBUG] Video not fully loaded, using sequential frame capture');
              captureNextFrame(0);
            }
            
          } catch (error) {
            console.error('[DEBUG] Error in attemptCapture:', error);
            reject(error);
          }
        };
        
        // Start the process
        attemptCapture();
        
      } catch (error) {
        console.error('[DEBUG] Error in createGifFromVideo:', error);
        reject(error);
      }
    });
  }
};