import React, { useEffect, useRef, useState } from 'react';

interface VideoTrimmerProps {
  file: File;
  onTrimComplete: (trimmedFile: File) => void;
  onCancel: () => void;
}

/**
 * A simplified video trimmer that doesn't require FFmpeg or cross-origin isolation.
 * Instead of actually trimming the video in the browser, it will:
 * 1. Allow users to select start and end times
 * 2. Return the original file with trim metadata attached to the name
 * 3. The actual trimming will need to be handled on the server/backend
 */
export const SimpleVideoTrimmer: React.FC<VideoTrimmerProps> = ({ 
  file, 
  onTrimComplete, 
  onCancel 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Load the video and set up event listeners
  useEffect(() => {
    console.log('[DEBUG] SimpleVideoTrimmer - Loading video file');
    
    if (videoRef.current && file) {
      setIsLoading(true);
      
      try {
        objectUrlRef.current = URL.createObjectURL(file);
        videoRef.current.src = objectUrlRef.current;
        
        videoRef.current.addEventListener('loadedmetadata', () => {
          console.log('[DEBUG] Video metadata loaded');
          const videoDuration = videoRef.current?.duration || 0;
          setDuration(videoDuration);
          
          // Set the end time to either 30 seconds or the video duration, whichever is lower
          setEndTime(Math.min(videoDuration, 30));
          setIsLoading(false);
        });
        
        videoRef.current.addEventListener('error', (e) => {
          console.error('[DEBUG] Video loading error:', e);
          setErrorMessage('Failed to load video. Please try a different file format.');
          setIsLoading(false);
        });
      } catch (error) {
        console.error('[DEBUG] Error setting up video:', error);
        setErrorMessage('Error initializing video player');
        setIsLoading(false);
      }
    }

    return () => {
      // Clean up the object URL when the component unmounts
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, [file]);

  // Set up time update handler to loop the preview between start and end times
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (video.currentTime >= endTime) {
        video.pause();
        video.currentTime = startTime;
        setIsPlaying(false);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [endTime, startTime]);

  // Handler for the play button
  const handlePreviewPlay = () => {
    if (!videoRef.current) return;
    
    videoRef.current.currentTime = startTime;
    videoRef.current.play()
      .then(() => {
        setIsPlaying(true);
      })
      .catch(error => {
        console.error('[DEBUG] Error playing video:', error);
        setErrorMessage('Failed to play video. Please try again.');
      });
  };
  
  // Handler for the pause button
  const handlePreviewPause = () => {
    if (!videoRef.current) return;
    
    videoRef.current.pause();
    setIsPlaying(false);
  };

  // Complete the trimming process
  const handleTrim = async () => {
    try {
      console.log('[DEBUG] Starting video trim process');
      setIsLoading(true);
      
      if (!videoRef.current) {
        throw new Error('Video element not initialized');
      }

      // Create a new video element for trimming to avoid conflicts with the display video
      const trimVideo = document.createElement('video');
      trimVideo.muted = true;
      
      // Create a new blob URL from the file
      const videoURL = URL.createObjectURL(file);
      trimVideo.src = videoURL;

      // Wait for video to be loaded
      await new Promise((resolve, reject) => {
        trimVideo.onloadeddata = resolve;
        trimVideo.onerror = reject;
        trimVideo.load();
      });

      console.log('[DEBUG] Trim video loaded:', {
        width: trimVideo.videoWidth,
        height: trimVideo.videoHeight,
        duration: trimVideo.duration
      });
      
      if (endTime - startTime < 5) {
        setErrorMessage('Selected clip must be at least 5 seconds long');
        setIsLoading(false);
        return;
      }
      
      if (endTime - startTime > 30) {
        setErrorMessage('Selected clip must be no longer than 30 seconds');
        setIsLoading(false);
        return;
      }

      console.log('[DEBUG] Creating canvas for frame capture');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      canvas.width = trimVideo.videoWidth;
      canvas.height = trimVideo.videoHeight;
      console.log('[DEBUG] Canvas created with dimensions:', {
        width: canvas.width,
        height: canvas.height
      });

      console.log('[DEBUG] Setting up MediaRecorder');
      const stream = canvas.captureStream();
      
      // Get a list of all supported MIME types
      const getSupportedMimeTypes = () => {
        const possibleTypes = [
          'video/mp4;codecs=h264',
          'video/mp4;codecs=avc1',
          'video/mp4',
          'video/webm;codecs=h264',
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm'
        ];
        
        return possibleTypes.filter(type => MediaRecorder.isTypeSupported(type));
      };
      
      const supportedTypes = getSupportedMimeTypes();
      console.log('[DEBUG] Supported video MIME types:', supportedTypes);
      
      // Always prefer MP4 format if available
      const mp4Types = supportedTypes.filter(type => type.includes('mp4'));
      const bestType = mp4Types.length > 0 ? mp4Types[0] : supportedTypes[0];
      
      console.log('[DEBUG] Selected best MIME type for recording:', bestType);
      
      let mediaRecorder;
      try {
        const options = {
          mimeType: bestType,
          videoBitsPerSecond: 8000000  // Increased to 8Mbps for higher quality
        };
        
        mediaRecorder = new MediaRecorder(stream, options);
        console.log('[DEBUG] MediaRecorder created with options:', options);
      } catch (error) {
        console.error('[DEBUG] Failed to create MediaRecorder with preferred type, trying fallback');
        
        // Fallback to any supported type
        try {
          mediaRecorder = new MediaRecorder(stream);
          console.log('[DEBUG] MediaRecorder created with default options');
        } catch (fallbackError) {
          console.error('[DEBUG] All MediaRecorder options failed:', fallbackError);
          throw new Error('Your browser does not support video recording.');
        }
      }

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        console.log('[DEBUG] Data chunk available, size:', e.data.size);
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      // Create a promise that resolves when recording is complete
      const recordingComplete = new Promise<File>((resolve, reject) => {
        mediaRecorder.onstart = () => {
          console.log('[DEBUG] MediaRecorder started');
        };

        mediaRecorder.onerror = (event) => {
          console.error('[DEBUG] MediaRecorder error:', event);
          reject(new Error('MediaRecorder error occurred'));
        };

        mediaRecorder.onstop = () => {
          console.log('[DEBUG] MediaRecorder stopped, creating final video');
          // Determine appropriate mime type based on what was actually recorded
          const mimeType = mediaRecorder.mimeType || 'video/mp4';
          const fileExtension = mimeType.includes('webm') ? 'webm' : 'mp4';
          
          const blob = new Blob(chunks, { type: mimeType });
          console.log('[DEBUG] Blob created, size:', blob.size, 'mime type:', mimeType);
          
          // Create the trimmed file with metadata
          const trimmedFile = new File([blob], `${file.name.replace(/\.[^/.]+$/, '')}_trimmed_${startTime}_${endTime}.${fileExtension}`, {
            type: mimeType
          });

          // Add trim metadata as properties
          Object.defineProperties(trimmedFile, {
            trimStart: { value: startTime, enumerable: true },
            trimEnd: { value: endTime, enumerable: true }
          });
          
          console.log('[DEBUG] Trim complete', {
            originalSize: file.size,
            trimmedSize: trimmedFile.size,
            duration: endTime - startTime,
            chunksCount: chunks.length,
            trimStart: startTime,
            trimEnd: endTime,
            filename: trimmedFile.name,
            mimeType: trimmedFile.type
          });

          // Clean up
          URL.revokeObjectURL(videoURL);
          
          resolve(trimmedFile);
        };
      });

      // Start recording process
      console.log('[DEBUG] Starting recording process');
      mediaRecorder.start(100); // Capture in smaller chunks for better quality (100ms)

      // Handle the frame capture process
      await new Promise<void>((resolve) => {
        // This function draws video frames to the canvas at high quality
        const captureFrame = () => {
          if (trimVideo.paused || trimVideo.ended) return;
          
          // Use better quality rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          // Draw the current frame
          ctx.drawImage(trimVideo, 0, 0, canvas.width, canvas.height);
          
          // Schedule the next frame capture using requestAnimationFrame
          // for smoother playback and more frames
          if (trimVideo.currentTime < endTime) {
            requestAnimationFrame(captureFrame);
          }
        };
        
        // Start playback and capture frames
        trimVideo.currentTime = startTime;
        trimVideo.play().then(() => {
          // Start capturing frames using animation frame for higher framerate
          requestAnimationFrame(captureFrame);
        });

        // Let the original timeupdate event still handle completion
        trimVideo.ontimeupdate = () => {
          if (trimVideo.currentTime >= endTime) {
            console.log('[DEBUG] Reached end time, stopping recording');
            trimVideo.pause();
            mediaRecorder.stop();
            trimVideo.ontimeupdate = null;
            resolve();
          }
        };
      });

      // Wait for the recording to complete and get the trimmed file
      const trimmedFile = await recordingComplete;
      console.log('[DEBUG] Calling onTrimComplete with file:', {
        name: trimmedFile.name,
        size: trimmedFile.size,
        type: trimmedFile.type,
        trimStart: (trimmedFile as any).trimStart,
        trimEnd: (trimmedFile as any).trimEnd
      });
      
      setIsLoading(false);
      onTrimComplete(trimmedFile);

    } catch (error) {
      console.error('[DEBUG] Error in handleTrim:', error);
      setErrorMessage('Failed to trim video: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900 w-full max-w-md rounded-xl p-6">
      <h2 className="text-white text-xl font-bold mb-4">Trim Your Video</h2>
      
      {errorMessage && (
        <div className="text-red-500 mb-4 text-sm p-2 bg-red-900/20 rounded-lg">
          {errorMessage}
        </div>
      )}
      
      <div className="mb-4">
        <video 
          ref={videoRef}
          controls
          className="w-full rounded-lg"
          controlsList="nodownload nofullscreen"
        />
      </div>
      
      <div className="mb-6">
        <div className="flex justify-between text-white text-sm mb-2">
          <span>Start: {formatTime(startTime)}</span>
          <span>Duration: {formatTime(endTime - startTime)}</span>
          <span>End: {formatTime(endTime)}</span>
        </div>
        
        <div className="space-y-4 mb-4">
          <div>
            <label className="block text-zinc-400 text-sm mb-1">Start Time:</label>
            <input 
              type="range"
              min={0}
              max={Math.max(0, duration - 5)} // Ensure at least 5 seconds for clip
              step={0.1}
              value={startTime}
              onChange={(e) => {
                const newStart = Number(e.target.value);
                setStartTime(Math.min(newStart, endTime - 5));
              }}
              className="w-full accent-[#E0FE10]"
            />
          </div>
          
          <div>
            <label className="block text-zinc-400 text-sm mb-1">End Time:</label>
            <input 
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={endTime}
              onChange={(e) => {
                const newEnd = Number(e.target.value);
                setEndTime(Math.max(newEnd, startTime + 5));
              }}
              className="w-full accent-[#E0FE10]"
            />
          </div>
        </div>
        
        <div className="flex space-x-2 justify-center mb-4">
          <button
            onClick={isPlaying ? handlePreviewPause : handlePreviewPlay}
            className="bg-zinc-800 text-white py-2 px-4 rounded-lg hover:bg-zinc-700"
          >
            {isPlaying ? 'Pause Preview' : 'Preview Trim'}
          </button>
        </div>
      </div>
      
      <div className="flex space-x-3">
        <button
          onClick={onCancel}
          className="flex-1 bg-zinc-800 text-white py-3 rounded-lg hover:bg-zinc-700"
        >
          Cancel
        </button>
        <button
          onClick={handleTrim}
          disabled={isLoading}
          className="flex-1 bg-[#E0FE10] text-black py-3 rounded-lg hover:bg-[#c8e60e] disabled:opacity-50"
        >
          {isLoading ? 'Processing...' : 'Save Trim'}
        </button>
      </div>
    </div>
  );
}; 