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
  const [progressPct, setProgressPct] = useState(0);
  const objectUrlRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isRecordingRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const hasReachedEndRef = useRef(false);
  
  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Clean up all recording-related resources
  const stopTrimming = useCallback(() => {
    console.log('[VideoTrimmer] Stopping trim process completely');
    
    // Stop the video
    if (videoRef.current) {
      videoRef.current.pause();
      // Remove the onseeked handler to prevent re-triggering
      videoRef.current.onseeked = null;
    }
    
    // Clear animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Mark recording as stopped
    isRecordingRef.current = false;
    hasReachedEndRef.current = true;
    setProgressPct(0);
    
    // Stop MediaRecorder if running
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Handle video time updates to loop the preview between start and end times
  // Only used for preview, not during trimming
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || isProcessing || isRecordingRef.current) return;

    if (video.currentTime >= endTime) {
      video.pause();
      video.currentTime = startTime;
      setIsPlaying(false);
    }
  }, [endTime, startTime, isProcessing]);

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
      
      // Ensure all recording resources are cleaned up
      stopTrimming();
    }
  }, [isOpen, stopTrimming]);

  // Set up time update handler to loop the preview between start and end times
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Only add the loop handler when we're not processing/trimming
    if (!isProcessing) {
      video.addEventListener('timeupdate', handleTimeUpdate);
      return () => video.removeEventListener('timeupdate', handleTimeUpdate);
    }
    
    return undefined;
  }, [handleTimeUpdate, isProcessing]);

  // Handler for the play button
  const handlePreviewPlay = () => {
    if (!videoRef.current || isProcessing) return;
    
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

    // Ensure any existing recording is stopped
    stopTrimming();
    
    // Reset flags for new recording
    isRecordingRef.current = false;
    hasReachedEndRef.current = false;
    chunksRef.current = [];

    console.log('[VideoTrimmer] Starting trim process', {
      startTime,
      endTime,
      duration: endTime - startTime,
      originalFileSize: file.size,
      originalFileName: file.name
    });

    setIsProcessing(true);
    setProgressPct(0);
    setError(null);

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
    // Use MP4 with H.264 codec for Safari compatibility
    let mimeType = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
    
    // Check if the browser supports MP4 recording
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      console.warn('[DEBUG] MP4 recording not supported, falling back to default format');
      // Fallback to a format that the browser supports
      const supportedTypes = [
        'video/mp4',
        'video/webm',
        'video/webm;codecs=h264',
        'video/x-matroska;codecs=avc1'
      ];
      
      const supportedType = supportedTypes.find(type => MediaRecorder.isTypeSupported(type));
      if (!supportedType) {
        throw new Error('No supported video recording format found');
      }
      console.log('[DEBUG] Using fallback format:', supportedType);
      mimeType = supportedType;
    }
    
    console.log('[DEBUG] Stream created, using mime type:', mimeType);

    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
        console.log('[VideoTrimmer] Received data chunk:', {
          chunkSize: e.data.size,
          totalChunks: chunksRef.current.length
        });
      }
    };

    mediaRecorder.onstop = async () => {
      console.log('[VideoTrimmer] MediaRecorder stopped, processing chunks', {
        numberOfChunks: chunksRef.current.length
      });

      // Process chunks if we have any, regardless of processing state
      if (chunksRef.current.length > 0) {
        try {
          // Combine chunks into a single file
          const blob = new Blob(chunksRef.current, { type: mimeType });
          // Always save the trimmed file with an .mp4 extension so downstream
          // uploaders and storage paths never use .webm in the name.
          const baseName = file.name?.replace(/\.[^/.]+$/, '') || 'trimmedFile';
          const trimmedFileName = `${baseName}.mp4`;
          const trimmedFile = new File([blob], trimmedFileName, { type: 'video/mp4' });

          console.log('[VideoTrimmer] Trim complete', {
            originalSize: file.size,
            trimmedSize: trimmedFile.size,
            compressionRatio: (trimmedFile.size / file.size * 100).toFixed(2) + '%'
          });

          // Add both legacy and expected metadata keys for downstream uploaders
          Object.defineProperties(trimmedFile, {
            trimStart: { value: startTime, enumerable: true },
            trimEnd: { value: endTime, enumerable: true },
            trimStartTime: { value: startTime, enumerable: true },
            trimEndTime: { value: endTime, enumerable: true },
            duration: { value: endTime - startTime, enumerable: true }
          });

          // Call onTrimComplete before cleaning up
          onTrimComplete(trimmedFile);
          
          // Clean up after successful processing
          setIsProcessing(false);
          stopTrimming();
          onClose();
        } catch (err) {
          console.error('[VideoTrimmer] Error creating final file:', err);
          setError('Failed to create trimmed video file.');
          setIsProcessing(false);
          stopTrimming();
        }
      } else {
        console.warn('[VideoTrimmer] No chunks to process');
        setIsProcessing(false);
        stopTrimming();
      }
    };

    mediaRecorder.onerror = (event) => {
      console.error('[VideoTrimmer] MediaRecorder error:', event);
      setError('An error occurred while processing the video');
      setIsProcessing(false);
      stopTrimming();
    };

    // Start drawing frames to the canvas
    console.log('[VideoTrimmer] Starting MediaRecorder');
    
    // Remove any existing timeupdate handler to avoid interfering with the recording
    videoRef.current.removeEventListener('timeupdate', handleTimeUpdate);
    
    // Seek to startTime
    videoRef.current.currentTime = startTime;
    
    // Once we've successfully sought to startTime, begin playback
    const seekHandler = () => {
      // Ensure we're not already recording and haven't finished
      if (isRecordingRef.current || hasReachedEndRef.current) {
        console.warn('[VideoTrimmer] Recording already in progress or completed, skipping');
        return;
      }

      console.log('[VideoTrimmer] Video seeked to start time, beginning playback');
      
      // Remove the seek handler immediately to prevent it from being called again
      videoRef.current!.onseeked = null;
      
      videoRef.current!.play().then(() => {
        // Double check recording state before starting
        if (isRecordingRef.current || hasReachedEndRef.current) {
          console.warn('[VideoTrimmer] Recording already in progress or completed, skipping');
          return;
        }

        isRecordingRef.current = true;
        // Start MediaRecorder after video playback begins
        mediaRecorder.start(100);
        const startTS = performance.now();
        let frameCount = 0;

        function drawFrame() {
          // Exit early if any required references are missing or recording has been stopped
          if (!videoRef.current || !mediaRecorderRef.current || !isRecordingRef.current || hasReachedEndRef.current) {
            return;
          }

          const currentTime = videoRef.current.currentTime;
          
          if (currentTime >= endTime) {
            const endTS = performance.now();
            console.log('[VideoTrimmer] Frame processing complete', {
              totalFrames: frameCount,
              processingTime: ((endTS - startTS) / 1000).toFixed(2) + 's',
              fps: (frameCount / ((endTS - startTS) / 1000)).toFixed(1)
            });
            
            // Complete the recording and clean up
            stopTrimming();
            return;
          }

          if (currentTime < endTime) {
            frameCount++;
            // Update progress roughly every few frames to limit re-renders
            if (frameCount % 6 === 0) {
              console.log('[VideoTrimmer] Processing frame', {
                currentTime: currentTime.toFixed(2),
                progress: ((currentTime - startTime) / (endTime - startTime) * 100).toFixed(1) + '%',
                frameCount
              });
              const pct = ((currentTime - startTime) / Math.max(0.001, (endTime - startTime))) * 100;
              setProgressPct(Math.max(0, Math.min(100, Math.round(pct))));
            }
            
            // Draw the current video frame to the canvas
            ctx!.clearRect(0, 0, canvas.width, canvas.height);
            ctx!.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            
            // Only schedule the next frame if we're still recording
            if (isRecordingRef.current && !hasReachedEndRef.current) {
              animationFrameRef.current = requestAnimationFrame(drawFrame);
            }
          }
        }
        
        // Start the frame drawing loop
        animationFrameRef.current = requestAnimationFrame(drawFrame);
      }).catch(error => {
        console.error('[VideoTrimmer] Error during playback:', error);
        setError('Failed to play video during processing. Please try again.');
        setIsProcessing(false);
        stopTrimming();
      });
    };
    
    // Set up the one-time seek handler
    videoRef.current.onseeked = seekHandler;
  };

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      stopTrimming();
      
      // Clean up the object URL
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [stopTrimming]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
      <div className="bg-zinc-900 w-full max-w-5xl rounded-xl p-6 max-h-[90vh] overflow-hidden">
        <h2 className="text-white text-xl font-bold mb-4">Trim Your Video</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500 rounded-lg">
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:space-x-8 h-[calc(90vh-4rem)]">
          {/* Video column */}
          <div className="md:w-1/2 flex items-center justify-center mb-4 md:mb-0">
            <video 
              ref={videoRef}
              controls
              className="w-full max-h-full rounded-lg object-contain"
              controlsList="nodownload nofullscreen"
            />
          </div>

          {/* Controls column */}
          <div className="md:w-1/2 flex flex-col">
            <div className="mb-4">
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
                    // When the clip is longer than 5s, enforce a 5s minimum length.
                    // For shorter clips, allow the full range to be trimmed.
                    max={duration > 5 ? Math.max(0, duration - 5) : duration}
                    step={0.1}
                    value={startTime}
                    onChange={(e) => {
                      const newStart = Number(e.target.value);
                      const minGap = duration > 5 ? 5 : 0;
                      setStartTime(Math.min(newStart, endTime - minGap));
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
                      const minGap = duration > 5 ? 5 : 0;
                      setEndTime(Math.max(newEnd, startTime + minGap));
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
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-zinc-400 mb-1">
                    <span>Processing...</span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-2">
                    <div
                      className="bg-[#E0FE10] h-2 rounded-full transition-all duration-200"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons pinned to bottom of controls column */}
            <div className="mt-auto flex space-x-3 pt-4 border-t border-zinc-800">
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="flex-1 bg-zinc-800 text-white py-3 rounded-lg hover:bg-zinc-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleTrim}
                // Allow any positive-length clip up to 30s. We only block zero/negative lengths.
                disabled={isProcessing || endTime <= startTime || endTime - startTime > 30}
                className="flex-1 bg-[#E0FE10] text-black py-3 rounded-lg hover:bg-[#c8e60e] disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : 'Save Trim'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};