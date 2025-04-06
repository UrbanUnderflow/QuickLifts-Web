import React, { useEffect, useRef, useState, useCallback } from 'react';

interface VideoTrimmerProps {
  isOpen: boolean;
  file: File | null;
  onClose: () => void;
  onTrimComplete: (trimmedFile: File) => void;
}

/**
 * A simplified video trimmer that doesn't require FFmpeg or cross-origin isolation.
 * Instead of actually trimming the video in the browser, it will:
 * 1. Allow users to select start and end times
 * 2. Return the original file with trim metadata attached to the name
 * 3. The actual trimming will need to be handled on the server/backend
 */
export const SimpleVideoTrimmer: React.FC<VideoTrimmerProps> = ({ 
  isOpen,
  file, 
  onClose,
  onTrimComplete 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle video time updates to loop the preview between start and end times
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.currentTime >= endTime) {
      video.pause();
      video.currentTime = startTime;
      setIsPlaying(false);
    }
  }, [endTime, startTime]);

  // Load the video and set up event listeners
  useEffect(() => {
    if (!file || !isOpen) return;
    
    console.log('[DEBUG] SimpleVideoTrimmer - Loading video file');
    
    if (videoRef.current && file) {
      setIsProcessing(true);
      
      try {
        objectUrlRef.current = URL.createObjectURL(file);
        videoRef.current.src = objectUrlRef.current;
        
        videoRef.current.addEventListener('loadedmetadata', () => {
          console.log('[DEBUG] Video metadata loaded');
          const videoDuration = videoRef.current?.duration || 0;
          setDuration(videoDuration);
          
          // Set the end time to either 30 seconds or the video duration, whichever is lower
          setEndTime(Math.min(videoDuration, 30));
          setIsProcessing(false);
        });
        
        videoRef.current.addEventListener('error', (e) => {
          console.error('[DEBUG] Video loading error:', e);
          setError('Failed to load video. Please try a different file format.');
          setIsProcessing(false);
        });
      } catch (error) {
        console.error('[DEBUG] Error setting up video:', error);
        setError('Error initializing video player');
        setIsProcessing(false);
      }
    }

    return () => {
      // Clean up the object URL when the component unmounts
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [file, isOpen]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setStartTime(0);
      setEndTime(0);
      setDuration(0);
      setIsPlaying(false);
      setError(null);
      
      // Clean up video
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
      }
      
      // Clean up object URL
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    }
  }, [isOpen]);

  // Set up time update handler to loop the preview between start and end times
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [handleTimeUpdate]);

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
        setError('Failed to play video. Please try again.');
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
    if (!file || !videoRef.current) {
      console.error('[VideoTrimmer] Cannot trim: missing file or video reference');
      return;
    }

    console.log('[VideoTrimmer] Starting trim process', {
      startTime,
      endTime,
      duration: endTime - startTime,
      originalFileSize: file.size,
      originalFileName: file.name
    });

    setIsProcessing(true);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('[VideoTrimmer] Failed to get canvas context');
      setIsProcessing(false);
      return;
    }

    // Set the canvas size to the video's intrinsic size
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    console.log('[VideoTrimmer] Canvas initialized', {
      width: canvas.width,
      height: canvas.height
    });
    
    // Prepare our capture stream and MediaRecorder
    const stream = canvas.captureStream(30);
    const mimeType = 'video/webm';
    console.log('[VideoTrimmer] Stream created, using mime type:', mimeType);

    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
        console.log('[VideoTrimmer] Received data chunk:', {
          chunkSize: e.data.size,
          totalChunks: chunks.length
        });
      }
    };

    mediaRecorder.onstop = async () => {
      console.log('[VideoTrimmer] MediaRecorder stopped, processing chunks', {
        numberOfChunks: chunks.length
      });

      // Combine chunks into a single file
      const blob = new Blob(chunks, { type: mimeType });
      const trimmedFile = new File([blob], 'trimmedFile.webm', { type: mimeType });

      console.log('[VideoTrimmer] Trim complete', {
        originalSize: file.size,
        trimmedSize: trimmedFile.size,
        compressionRatio: (trimmedFile.size / file.size * 100).toFixed(2) + '%'
      });

      // Add your start/end metadata
      Object.defineProperties(trimmedFile, {
        trimStart: { value: startTime, enumerable: true },
        trimEnd: { value: endTime, enumerable: true },
        duration: { value: endTime - startTime, enumerable: true }
      });

      // Reset video playback
      if (videoRef.current) {
        console.log('[VideoTrimmer] Resetting video player state');
        // Remove the existing timeupdate handler first
        videoRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        
        // Reset video to original file for preview
        if (objectUrlRef.current) {
          videoRef.current.src = objectUrlRef.current;
          videoRef.current.currentTime = startTime;
        }
      }

      setIsProcessing(false);
      console.log('[VideoTrimmer] Trim process completed successfully');
      onTrimComplete(trimmedFile);
      onClose();
    };

    mediaRecorder.onerror = (event) => {
      console.error('[VideoTrimmer] MediaRecorder error:', event);
      setError('An error occurred while processing the video');
      setIsProcessing(false);
    };

    // Start drawing frames to the canvas
    console.log('[VideoTrimmer] Starting MediaRecorder');
    
    // Seek to startTime
    videoRef.current.currentTime = startTime;
    
    // Once we've successfully sought to startTime, begin playback
    videoRef.current!.onseeked = () => {
      console.log('[VideoTrimmer] Video seeked to start time, beginning playback');
      videoRef.current!.play().then(() => {
        // Start MediaRecorder after video playback begins
        mediaRecorder.start(100);
        const startTS = performance.now();
        let frameCount = 0;
        function drawFrame() {
          if (videoRef.current!.currentTime < endTime) {
            frameCount++;
            if (frameCount % 30 === 0) { // Log every 30 frames
              console.log('[VideoTrimmer] Processing frame', {
                currentTime: videoRef.current!.currentTime.toFixed(2),
                progress: ((videoRef.current!.currentTime - startTime) / (endTime - startTime) * 100).toFixed(1) + '%',
                frameCount
              });
            }
            
            ctx!.clearRect(0, 0, canvas.width, canvas.height);
            ctx!.drawImage(videoRef.current!, 0, 0, canvas.width, canvas.height);
            requestAnimationFrame(drawFrame);
          } else {
            const endTS = performance.now();
            console.log('[VideoTrimmer] Frame processing complete', {
              totalFrames: frameCount,
              processingTime: ((endTS - startTS) / 1000).toFixed(2) + 's',
              fps: (frameCount / ((endTS - startTS) / 1000)).toFixed(1)
            });
            
            videoRef.current?.pause();
            mediaRecorder.stop();
          }
        }
        requestAnimationFrame(drawFrame);
      }).catch(error => {
        console.error('[VideoTrimmer] Error during playback:', error);
      });
    };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
      <div className="bg-zinc-900 w-full max-w-md rounded-xl p-6">
        <h2 className="text-white text-xl font-bold mb-4">Trim Your Video</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500 rounded-lg">
            <p className="text-red-500 text-sm">{error}</p>
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
                disabled={isProcessing}
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
                disabled={isProcessing}
              />
            </div>
          </div>
          
          {!isProcessing && (
            <div className="flex justify-center mb-4">
              <button
                onClick={isPlaying ? handlePreviewPause : handlePreviewPlay}
                className="bg-zinc-800 text-white py-2 px-4 rounded-lg hover:bg-zinc-700"
              >
                {isPlaying ? 'Pause Preview' : 'Preview Trim'}
              </button>
            </div>
          )}

          {isProcessing && (
            <div className="w-full bg-zinc-800 rounded-full h-2 mb-4">
              <div 
                className="bg-[#E0FE10] h-2 rounded-full transition-all duration-300 animate-pulse"
                style={{ width: '100%' }}
              />
            </div>
          )}
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 bg-zinc-800 text-white py-3 rounded-lg hover:bg-zinc-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleTrim}
            disabled={isProcessing || endTime - startTime < 5 || endTime - startTime > 30}
            className="flex-1 bg-[#E0FE10] text-black py-3 rounded-lg hover:bg-[#c8e60e] disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : 'Save Trim'}
          </button>
        </div>
      </div>
    </div>
  );
}; 