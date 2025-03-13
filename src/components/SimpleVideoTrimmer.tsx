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
  const handleTrim = () => {
    try {
      console.log('[DEBUG] Preparing trimmed video metadata');
      setIsLoading(true);
      
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
      
      // Instead of actually trimming the video with FFmpeg, we're going
      // to return the original file with trim metadata in the filename
      // The actual trimming will need to be done on the server side
      console.log(`[DEBUG] Trim metadata: start=${startTime}, end=${endTime}`);
      
      // Create a new File object with the trim metadata in a format that
      // can be easily parsed by the server
      const fileExt = file.name.split('.').pop();
      const trimMetadata = `_trim_${startTime.toFixed(2)}_${endTime.toFixed(2)}`;
      
      const newFileName = file.name.replace(`.${fileExt}`, `${trimMetadata}.${fileExt}`);
      
      // Create a new File with the same content but different name
      const trimmedFile = new File([file], newFileName, { type: file.type });
      
      // Add custom properties to help with server-side processing
      // Note: These properties aren't standard File properties,
      // but they can be used by our application code
      (trimmedFile as any).trimStart = startTime;
      (trimmedFile as any).trimEnd = endTime;
      
      console.log('[DEBUG] Trim complete with metadata', {
        originalName: file.name,
        newName: newFileName,
        trimStart: startTime,
        trimEnd: endTime
      });
      
      // Call the onTrimComplete callback with our file
      onTrimComplete(trimmedFile);
    } catch (error) {
      console.error('[DEBUG] Error in handleTrim:', error);
      setErrorMessage('Failed to prepare video clip');
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