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

interface VideoSource {
  url?: string;
  file?: File | Blob;
}

const defaultOptions: GifGeneratorOptions = {
  width: 288,
  height: 512,
  numFrames: 125,
  quality: 3,
  delay: 0,
  repeat: 0,
  dither: true,
  workers: 4,
  maxDuration: 5
};

export const gifGenerator = {
  async generateAndUploadGif(
    videoSource: string | VideoSource,
    exerciseName: string,
    videoId: string,
    options: GifGeneratorOptions = defaultOptions
  ): Promise<string> {
    try {
      console.log('[DEBUG] Starting GIF generation');
      console.log('[DEBUG] Options:', JSON.stringify(options));

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
        const maxFrames = options.numFrames || 125; // Default to 125 frames
        const maxDuration = options.maxDuration || 5;
        
        console.log(`[DEBUG] Creating GIF: ${width}x${height}, capturing ${maxFrames} frames over ${maxDuration}s`);
        
        // Determine actual video duration (capped at maxDuration)
        const duration = Math.min(video.duration || 0, maxDuration);
        if (duration <= 0) {
          reject(new Error(`Invalid video duration: ${duration}`));
          return;
        }

        // Calculate exact frame timing
        const frameInterval = duration / maxFrames; // Time between frames in seconds
        console.log(`[DEBUG] Frame interval: ${(frameInterval * 1000).toFixed(2)}ms (${(1/frameInterval).toFixed(2)} fps)`);
        
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
          quality: options.quality || 5,
          width: width,
          height: height,
          workerScript: '/gifjs/gif.worker.js',
          repeat: options.repeat || 0,
          debug: true,
          dither: options.dither || true
        });
        
        gif.on('finished', (blob: Blob) => {
          console.log('[DEBUG] GIF creation finished, size:', blob.size);
          resolve(blob);
        });
        
        gif.on('progress', (progress: number) => {
          console.log('[DEBUG] GIF encoding progress:', Math.round(progress * 100), '%');
          const progressEvent = new CustomEvent('gif-encoding-progress', { 
            detail: { progress }
          });
          window.dispatchEvent(progressEvent);
        });

        // Frame capture using precise timing
        const frames: ImageData[] = [];
        let frameCount = 0;
        let startTime: number;

        const captureFrame = () => {
          const currentTime = (performance.now() - startTime) / 1000;
          
          if (currentTime <= maxDuration && frameCount < maxFrames) {
            // Set video to exact time we want to capture
            video.currentTime = currentTime;
            
            // Draw and capture frame
            ctx.drawImage(video, 0, 0, width, height);
            const imageData = ctx.getImageData(0, 0, width, height);
            frames.push(imageData);
            frameCount++;

            // Log progress
            console.log(`[DEBUG] Captured frame ${frameCount}/${maxFrames} at ${currentTime.toFixed(3)}s`);
            
            // Emit progress event
            const captureProgress = frameCount / maxFrames;
            const captureEvent = new CustomEvent('gif-frame-capture-progress', { 
              detail: { progress: captureProgress, frameCount, totalFrames: maxFrames }
            });
            window.dispatchEvent(captureEvent);

            // Schedule next frame capture
            setTimeout(captureFrame, frameInterval * 1000);
          } else {
            // We've captured all frames, process them
            console.log(`[DEBUG] Captured all ${frameCount} frames, processing...`);
            
            // Add all frames to the GIF
            frames.forEach((frameData, index) => {
              ctx.putImageData(frameData, 0, 0);
              gif.addFrame(canvas, {
                copy: true,
                delay: options.delay || 0,
                dispose: 2
              });
            });

            // Render the final GIF
            console.log('[DEBUG] Rendering final GIF...');
            gif.render();
          }
        };

        // Start capture process
        video.muted = true;
        startTime = performance.now();
        captureFrame();

      } catch (error) {
        console.error('[DEBUG] Error in createGifFromVideo:', error);
        reject(error);
      }
    });
  }
};