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
  skipFactor?: number;
}

interface VideoSource {
  url?: string;
  file?: File | Blob;
}

const defaultOptions: GifGeneratorOptions = {
  width: 240,
  height: 320,
  numFrames: 30,
  quality: 10,
  delay: 0,
  repeat: 0,
  dither: true,
  workers: 4,
  maxDuration: 3,
  skipFactor: 2
};

export const gifGenerator = {
  async generateAndUploadGif(
    videoSource: string | VideoSource,
    exerciseName: string,
    videoId: string,
    options: GifGeneratorOptions = {}
  ): Promise<string> {
    try {
      // ===== LOGGING START =====
      console.log('[DEBUG][FRAME_CALC] Starting GIF generation with default options:', JSON.stringify(defaultOptions));
      console.log('[DEBUG][FRAME_CALC] User-provided options:', JSON.stringify(options));
      // ===== LOGGING END =====
      
      // Merge with defaults to ensure all options are set
      const mergedOptions = { ...defaultOptions, ...options };
      
      // ===== LOGGING START =====
      console.log('[DEBUG][FRAME_CALC] Merged options:', JSON.stringify(mergedOptions));
      console.log('[DEBUG][FRAME_CALC] Target frame count from options:', mergedOptions.numFrames);
      // ===== LOGGING END =====

      // Create a video element
      const video = document.createElement('video');
      video.muted = true;
      video.autoplay = false;
      video.controls = false;
      video.preload = 'auto';
      video.playsInline = true;

      // Handle both string URLs and VideoSource objects
      const source = typeof videoSource === 'string' ? { url: videoSource } : videoSource;

      if (source.file) {
        // If we have a local file, use it directly
        console.log('[DEBUG] Using local video file');
        video.src = URL.createObjectURL(source.file);
      } else if (source.url) {
        // If we only have a URL, use it
        console.log('[DEBUG] Using video URL:', source.url);
        video.crossOrigin = 'anonymous';
        video.src = source.url;
      } else {
        throw new Error('No valid video source provided');
      }

      // Add event listeners before setting src
      video.addEventListener('error', (e) => {
        console.error('[DEBUG] Video error event:', e);
        if (video.error) {
          console.error('[DEBUG] Video error code:', video.error.code);
          console.error('[DEBUG] Video error message:', video.error.message);
        }
      });

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
          
          // ===== LOGGING START =====
          console.log('[DEBUG][FRAME_CALC] Video actual duration:', video.duration);
          // ===== LOGGING END =====
          
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
      const gifBlob = await this.createGifFromVideo(video, mergedOptions);
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

        // ===== LOGGING START =====
        console.log('[DEBUG][FRAME_CALC] Starting frame calculation process');
        console.log('[DEBUG][FRAME_CALC] Options received in createGifFromVideo:', JSON.stringify(options));
        // ===== LOGGING END =====

        // Extract dimensions from options or video
        const width = options.width || video.videoWidth || 240;
        const height = options.height || video.videoHeight || 320;
        
        // ===== LOGGING START =====
        console.log('[DEBUG][FRAME_CALC] Calculated dimensions - width:', width, 'height:', height);
        // ===== LOGGING END =====
        
        // Determine actual video duration (capped at maxDuration)
        const maxDuration = options.maxDuration || 3;
        const duration = Math.min(video.duration || 0, maxDuration);
        
        // ===== LOGGING START =====
        console.log('[DEBUG][FRAME_CALC] Max duration from options:', maxDuration);
        console.log('[DEBUG][FRAME_CALC] Actual video duration:', video.duration);
        console.log('[DEBUG][FRAME_CALC] Calculated capped duration:', duration);
        // ===== LOGGING END =====
        
        if (duration <= 0) {
          reject(new Error(`Invalid video duration: ${duration}`));
          return;
        }

        // Get frame count from options, with fallback
        const maxFrames = options.numFrames || 30;
        const skipFactor = options.skipFactor || 1;
        
        // ===== LOGGING START =====
        console.log('[DEBUG][FRAME_CALC] maxFrames from options:', maxFrames);
        console.log('[DEBUG][FRAME_CALC] skipFactor from options:', skipFactor);
        // ===== LOGGING END =====
        
        // Calculate frame interval
        const frameInterval = duration / maxFrames;
        
        // ===== LOGGING START =====
        console.log('[DEBUG][FRAME_CALC] Calculated frameInterval:', frameInterval, 'seconds');
        // ===== LOGGING END =====
        
        // Calculate actual number of frames
        const effectiveFrameCount = Math.ceil(maxFrames / skipFactor);
        
        // ===== LOGGING START =====
        console.log('[DEBUG][FRAME_CALC] Effective frame count after skipping:', effectiveFrameCount);
        console.log('[DEBUG][FRAME_CALC] Frame calculation summary:');
        console.log('[DEBUG][FRAME_CALC] - Source video duration:', video.duration, 'seconds');
        console.log('[DEBUG][FRAME_CALC] - Capped duration for GIF:', duration, 'seconds');
        console.log('[DEBUG][FRAME_CALC] - Configured max frames:', maxFrames);
        console.log('[DEBUG][FRAME_CALC] - Frame interval:', frameInterval, 'seconds');
        console.log('[DEBUG][FRAME_CALC] - Skip factor:', skipFactor);
        console.log('[DEBUG][FRAME_CALC] - Final frame count to capture:', effectiveFrameCount);
        // ===== LOGGING END =====

        // CHECK FOR HARDCODED VALUE
        console.log('[DEBUG][FRAME_CALC] CRITICAL CHECK - Looking for any signs of hardcoded 590 frames:');
        const sourceDivided = Math.ceil(video.duration / frameInterval);
        console.log('[DEBUG][FRAME_CALC] - If we used entire video duration:', sourceDivided, 'frames');
        
        // Try to derive the 590 frames somehow
        let possibleFrames = Math.ceil(video.duration * 60); // 60fps is a common frame rate
        console.log('[DEBUG][FRAME_CALC] - If video is captured at 60fps:', possibleFrames, 'frames');
        
        possibleFrames = Math.ceil(video.duration * 30); // 30fps is another common frame rate
        console.log('[DEBUG][FRAME_CALC] - If video is captured at 30fps:', possibleFrames, 'frames');
        
        // Try to look for hardcoded logic that might be using a constant
        console.log('[DEBUG][FRAME_CALC] - IMPORTANT: Is there any value close to 590 above?');
        
        console.log(`[DEBUG] Creating GIF: ${width}x${height}, capturing ${maxFrames} frames over ${duration}s with skip factor ${skipFactor}`);
        
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
          workers: options.workers || 4,
          quality: options.quality || 10,
          width: width,
          height: height,
          workerScript: '/gifjs/gif.worker.js',
          repeat: options.repeat || 0,
          debug: true,
          dither: options.dither !== false
        });
        
        // ===== LOGGING START =====
        console.log('[DEBUG][FRAME_CALC] GIF.js configuration:', {
          workers: options.workers || 4,
          quality: options.quality || 10,
          width,
          height,
          repeat: options.repeat || 0,
          dither: options.dither !== false
        });
        // ===== LOGGING END =====
        
        gif.on('finished', (blob: Blob) => {
          console.log('[DEBUG] GIF creation finished, size:', blob.size);
          resolve(blob);
        });
        
        gif.on('progress', (progress: number) => {
          console.log('[DEBUG] GIF encoding progress:', Math.round(progress * 100), '%');
          window.dispatchEvent(new CustomEvent('gif-encoding-progress', { 
            detail: { progress }
          }));
        });

        // Create precise timestamps to capture frames at
        const timestamps: number[] = [];
        for (let i = 0; i < maxFrames; i += skipFactor) {
          timestamps.push(i * frameInterval);
        }
        
        // ===== LOGGING START =====
        console.log('[DEBUG][FRAME_CALC] Generated timestamps for frame capture:', 
          timestamps.length <= 10 ? timestamps : 
          `${timestamps.slice(0, 5)} ... ${timestamps.slice(-5)} (total: ${timestamps.length})`);
        // ===== LOGGING END =====

        // Helper function to wait for video to finish seeking
        const seekVideoTime = (videoEl: HTMLVideoElement, time: number): Promise<void> => {
          return new Promise<void>((resolveSeek, rejectSeek) => {
            const timeoutId = setTimeout(() => {
              videoEl.removeEventListener('seeked', onSeeked);
              rejectSeek(new Error(`Seek timeout at ${time}s`));
            }, 1000); // 1 second timeout for seeking

            const onSeeked = () => {
              clearTimeout(timeoutId);
              videoEl.removeEventListener('seeked', onSeeked);
              resolveSeek();
            };
            
            videoEl.addEventListener('seeked', onSeeked);
            videoEl.currentTime = Math.min(time, duration);
          });
        };

        let totalFramesRecorded = 0;

        // Capture frames - using async IIFE
        (async () => {
          try {
            let capturedFrames = 0;
            
            console.log('[DEBUG][FRAME_CALC] Starting frame capture process for', timestamps.length, 'frames');
            
            for (let i = 0; i < timestamps.length; i++) {
              const timestamp = timestamps[i];
              
              try {
                // ===== LOGGING START =====
                console.log(`[DEBUG][FRAME_CALC] Seeking to timestamp ${i+1}/${timestamps.length}: ${timestamp.toFixed(2)}s`);
                // ===== LOGGING END =====
                
                // Seek to the precise time
                await seekVideoTime(video, timestamp);
                
                // Draw the frame
                ctx.clearRect(0, 0, width, height);
                ctx.drawImage(video, 0, 0, width, height);
                
                // Add frame to GIF
                gif.addFrame(canvas, {
                  copy: true,
                  delay: options.delay || 100,
                  dispose: 2
                });
                
                capturedFrames++;
                totalFramesRecorded = capturedFrames;
                
                console.log(`[DEBUG] Captured frame ${capturedFrames}/${timestamps.length} at ${timestamp.toFixed(2)}s`);
                
                window.dispatchEvent(new CustomEvent('gif-frame-capture-progress', { 
                  detail: { 
                    progress: capturedFrames / timestamps.length, 
                    frameCount: capturedFrames, 
                    totalFrames: timestamps.length 
                  } 
                }));
              } catch (seekError) {
                console.error(`[DEBUG] Error seeking to ${timestamp}s:`, seekError);
                // Continue with next frame instead of failing completely
                continue;
              }
            }
            
            // ===== LOGGING START =====
            console.log('[DEBUG][FRAME_CALC] Frame capture complete');
            console.log('[DEBUG][FRAME_CALC] - Frames requested in options:', maxFrames);
            console.log('[DEBUG][FRAME_CALC] - Timestamps generated:', timestamps.length);
            console.log('[DEBUG][FRAME_CALC] - Frames actually captured:', capturedFrames);
            // ===== LOGGING END =====
            
            console.log(`[DEBUG] Captured ${capturedFrames} frames. Rendering final GIF...`);
            gif.render();
          } catch (error) {
            console.error('[DEBUG] Error during frame capture:', error);
            
            // ===== LOGGING START =====
            console.error('[DEBUG][FRAME_CALC] Error occurred during frame capture. Total frames recorded:', totalFramesRecorded);
            // ===== LOGGING END =====
            
            reject(error);
          }
        })();
      } catch (error) {
        console.error('[DEBUG] Error in createGifFromVideo:', error);
        reject(error);
      }
    });
  }
};