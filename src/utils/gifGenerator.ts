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
  dither?: boolean;
  workers?: number;
  maxDuration?: number;
}

const defaultOptions: GifGeneratorOptions = {
  width: 680,
  height: 680,
  numFrames: 60,
  quality: 3,
  delay: 250,
  repeat: 0,
  maxDuration: 5
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
        const width = options.width || video.videoWidth || 512;
        const height = options.height || video.videoHeight || 512;
        const maxFrames = options.numFrames || 25;
        const maxDuration = options.maxDuration || 5;
        
        console.log(`[DEBUG] Creating GIF: ${width}x${height}, capturing just the first ${maxDuration}s of video at ${maxFrames/maxDuration}fps`);
        
        // Determine actual video duration (capped at maxDuration)
        const duration = Math.min(video.duration || 0, maxDuration);
        if (duration <= 0) {
          reject(new Error(`Invalid video duration: ${duration}`));
          return;
        }
        
        // Set frames per second based on numFrames and maxDuration
        const fps = maxFrames / maxDuration; // With 60 frames and 10 seconds, should be 6fps
        const framesNeeded = Math.floor(duration * fps);
        
        console.log(`[DEBUG] Video total duration: ${video.duration}s, capturing first ${duration}s at ${fps.toFixed(2)} fps (${framesNeeded} frames)`);
        
        // Create a canvas for frame capture
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Initialize gif.js with higher quality settings to match iOS
        const gif = new GIF({
          workers: options.workers || 4,
          quality: options.quality || 5,
          width: width,
          height: height,
          workerScript: '/gifjs/gif.worker.js',
          repeat: options.repeat || 0,
          debug: true,
          dither: options.dither || true
        });
        
        // Setup handlers
        gif.on('finished', (blob: Blob) => {
          console.log('[DEBUG] GIF creation finished, size:', blob.size);
          resolve(blob);
        });
        
        gif.on('progress', (progress: number) => {
          console.log('[DEBUG] GIF encoding progress:', Math.round(progress * 100), '%');
          
          // Emit a custom event with the progress information
          // This event can be listened to by other components
          const progressEvent = new CustomEvent('gif-encoding-progress', { 
            detail: { progress }
          });
          window.dispatchEvent(progressEvent);
        });
        
        // Track captured frames and play position
        let capturedFrames = 0;
        const framesToCapture = framesNeeded;
        
        // Calculate ideal frame interval for even distribution
        // With slow playback, we can capture frames more frequently
        const frameInterval = duration / Math.max(framesToCapture, 100);
        console.log(`[DEBUG] Frame interval: ${frameInterval.toFixed(3)}s, Target FPS: ${fps.toFixed(2)}, Effective capture rate: ${(1/frameInterval).toFixed(2)}`);
        
        // Note: delay is how long each frame displays (higher = slower animation)
        // 300ms delay = approx 3.3 frames per second playback
        console.log(`[DEBUG] GIF delay: ${options.delay || Math.round(1000 / fps)}ms (${1000/(options.delay || Math.round(1000 / fps))} FPS playback)`);
        console.log(`[DEBUG] Target frame count: ${framesToCapture}, with slow playback we should get more frames`);
        
        // Setup play-based frame capture
        const captureFramesWhilePlaying = () => {
          // Reset video to beginning
          video.currentTime = 0;
          console.log('[DEBUG] Reset video position to beginning');
          
          // Array to store captured frames
          const frames: ImageData[] = [];
          
          // Store the last time we captured a frame to ensure proper spacing
          let lastCaptureTime = -1;
          let firstFrameTime = -1;
          let frameCount = 0;
          
          // Function to add the collected frames to the GIF
          const processCollectedFrames = () => {
            console.log(`[DEBUG] Processing ${frames.length} collected frames`);
            if (frames.length === 0) {
              reject(new Error('No frames were captured'));
              return;
            }
            
            // Add all frames to the GIF
            for (const frameData of frames) {
              // Put image data back to canvas
              ctx.putImageData(frameData, 0, 0);
              
              // Add to GIF with the configured delay
              gif.addFrame(canvas, {
                copy: true,
                delay: options.delay || 100, // 100ms for smoother animation
                dispose: 2
              });
            }
            
            // Render the GIF
            console.log('[DEBUG] Rendering GIF with', frames.length, 'frames');
            gif.render();
          };
          
          // Function to capture a frame at the current time
          const captureCurrentFrame = () => {
            // Only capture if we've moved far enough from the last frame
            const currentTime = video.currentTime;
            
            // Stop capturing if we've reached the maxDuration
            if (currentTime > maxDuration) {
              console.log(`[DEBUG] Reached max duration of ${maxDuration}s, stopping capture`);
              video.pause();
              video.removeEventListener('timeupdate', onTimeUpdate);
              processCollectedFrames();
              return;
            }
            
            // Save the time of the first frame for reference
            if (firstFrameTime === -1 && currentTime > 0) {
              firstFrameTime = currentTime;
              console.log(`[DEBUG] First frame time: ${firstFrameTime.toFixed(3)}s`);
            }
            
            // Check if we should capture this frame
            if (lastCaptureTime === -1 || (currentTime - lastCaptureTime) >= frameInterval) {
              try {
                console.log(`[DEBUG] Capturing frame at ${currentTime.toFixed(3)}s (frame ${frameCount + 1})`);
                
                // Draw the current frame onto the canvas
                ctx.drawImage(video, 0, 0, width, height);
                
                // Get the image data to save it
                const imageData = ctx.getImageData(0, 0, width, height);
                frames.push(imageData);
                
                lastCaptureTime = currentTime;
                frameCount++;
                
                // Emit a custom event for frame capture progress
                const captureProgress = frameCount / framesToCapture;
                const captureEvent = new CustomEvent('gif-frame-capture-progress', { 
                  detail: { 
                    progress: captureProgress, 
                    frameCount, 
                    totalFrames: framesToCapture 
                  }
                });
                window.dispatchEvent(captureEvent);
                
                // Check if we have enough frames
                // Continue capturing frames until maxDuration even if we exceed the target
                if (frameCount >= framesToCapture && currentTime >= maxDuration) {
                  console.log(`[DEBUG] Captured ${frameCount} frames and reached max duration of ${maxDuration}s, stopping playback`);
                  
                  video.pause();
                  video.removeEventListener('timeupdate', onTimeUpdate);
                  
                  // Process all the frames we've collected
                  processCollectedFrames();
                }
              } catch (e) {
                console.error('[DEBUG] Error capturing frame:', e);
              }
            }
          };
          
          // Timeupdate event handler for capturing frames during playback
          const onTimeUpdate = () => {
            captureCurrentFrame();
          };
          
          // End of video handler
          const onEnded = () => {
            console.log('[DEBUG] Video playback ended');
            
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('ended', onEnded);
            
            if (frames.length > 0) {
              processCollectedFrames();
            } else {
              reject(new Error('No frames captured before video ended'));
            }
          };
          
          // Add event listeners
          video.addEventListener('timeupdate', onTimeUpdate);
          video.addEventListener('ended', onEnded);
          
          // Error handler
          video.addEventListener('error', (e) => {
            console.error('[DEBUG] Video error during playback:', e);
            reject(new Error(`Video playback error: ${video.error?.message || 'Unknown error'}`));
          });
          
          // Start playback
          console.log('[DEBUG] Starting video playback for frame capture');
          
          // Ensure it's ready with a volume and mute
          video.volume = 0;
          video.muted = true;
          
          // Use normal playback speed for natural motion
          video.playbackRate = 1.0;
          
          console.log('[DEBUG] Set playback rate to 1.0 (normal speed)')
          
          // Play the video to start capturing frames
          video.play().then(() => {
            console.log('[DEBUG] Video playback started successfully');
          }).catch(error => {
            console.error('[DEBUG] Error starting video playback:', error);
            reject(error);
          });
        };
        
        // Try the playback-based capture method
        captureFramesWhilePlaying();
        
      } catch (error) {
        console.error('[DEBUG] Error in createGifFromVideo:', error);
        reject(error);
      }
    });
  }
};