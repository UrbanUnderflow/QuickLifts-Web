// VideoTrimmer.tsx
import React, { useEffect, useRef, useState } from 'react';
// Use require for older FFmpeg version
// @ts-ignore
const { createFFmpeg, fetchFile } = require('@ffmpeg/ffmpeg');

interface VideoTrimmerProps {
  isOpen: boolean;
  file: File | null;
  onClose: () => void;
  onTrimComplete: (trimmedFile: File) => void;
}

interface TrimProgress {
  stage: 'preparing' | 'trimming' | 'finalizing';
  percent: number;
}

// Create FFmpeg instance outside component to reuse
// Using older version (0.8.3) that doesn't require cross-origin isolation
const ffmpeg = createFFmpeg({
  log: true,
});

// Track loading state globally
let ffmpegLoadingPromise: Promise<void> | null = null;

export const VideoTrimmer: React.FC<VideoTrimmerProps> = ({ 
  isOpen, 
  file, 
  onClose, 
  onTrimComplete 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<TrimProgress>({ stage: 'preparing', percent: 0 });
  const objectUrlRef = useRef<string | null>(null);
  const loggerRef = useRef<any>(null);

  useEffect(() => {
    // Set up logger only once to avoid re-renders
    if (!loggerRef.current) {
      loggerRef.current = ({ message }: { message: string }) => {
        // Look for progress indicators in the log messages
        const progressMatch = message.match(/time=(\d+):(\d+):(\d+)/);
        if (progressMatch) {
          const [, hours, minutes, seconds] = progressMatch;
          const totalSeconds = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
          // Convert to percentage based on trim duration
          const totalDuration = endTime - startTime;
          if (totalDuration > 0) {
            const percent = Math.min(100, Math.round((totalSeconds / totalDuration) * 100));
            setProgress({
              stage: 'trimming',
              percent
            });
          }
        }
      };
      ffmpeg.setLogger(loggerRef.current);
    }
  }, [endTime, startTime]);

  useEffect(() => {
    if (videoRef.current && file) {
      // Create object URL for video preview
      objectUrlRef.current = URL.createObjectURL(file);
      videoRef.current.src = objectUrlRef.current;

      // Set up video metadata listener
      videoRef.current.addEventListener('loadedmetadata', () => {
        const videoDuration = videoRef.current?.duration || 0;
        setDuration(videoDuration);
        // Set initial end time to either 30 seconds or video duration
        setEndTime(Math.min(videoDuration, 30));
      });
    }

    // Cleanup
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, [file]);

  // Handle video preview playback
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

  const handlePreviewPlay = () => {
    if (!videoRef.current) return;
    
    videoRef.current.currentTime = startTime;
    videoRef.current.play();
    setIsPlaying(true);
  };

  const handlePreviewPause = () => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);
  };

  const loadFFmpeg = async () => {
    try {
      setError(null);
      if (!ffmpegLoadingPromise) {
        ffmpegLoadingPromise = ffmpeg.load();
      }
      await ffmpegLoadingPromise;
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to load FFmpeg';
      setError(errorMessage);
      console.error('FFmpeg loading error:', error);
      return false;
    }
  };

  const handleTrim = async () => {
    if (!file || !videoRef.current) {
      setError('No video file selected');
      return;
    }

    if (endTime - startTime < 5 || endTime - startTime > 30) {
      setError('Video must be between 5 and 30 seconds');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      setProgress({ stage: 'preparing', percent: 0 });

      // Load FFmpeg
      console.log('Loading FFmpeg...');
      const ffmpegLoaded = await loadFFmpeg();
      if (!ffmpegLoaded) {
        throw new Error('Failed to load FFmpeg');
      }
      console.log('FFmpeg loaded successfully');

      // Write input file to FFmpeg's virtual filesystem
      setProgress({ stage: 'preparing', percent: 30 });
      console.log('Writing input file...');
      ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(file));
      setProgress({ stage: 'preparing', percent: 60 });

      // Run FFmpeg trim command
      console.log('Starting FFmpeg processing...');
      setProgress({ stage: 'trimming', percent: 0 });
      await ffmpeg.run(
        '-ss', startTime.toString(),
        '-t', (endTime - startTime).toString(),
        '-i', 'input.mp4',
        '-c', 'copy',
        'output.mp4'
      );
      console.log('FFmpeg processing complete');

      // Read the output file
      setProgress({ stage: 'finalizing', percent: 50 });
      console.log('Reading output file...');
      const data = ffmpeg.FS('readFile', 'output.mp4');

      // Clean up files
      ffmpeg.FS('unlink', 'input.mp4');
      ffmpeg.FS('unlink', 'output.mp4');

      // Create trimmed file with metadata
      const trimmedFile = new File([new Uint8Array(data.buffer)], 'trimmed.mp4', { 
        type: 'video/mp4' 
      });

      // Add trim metadata
      Object.defineProperties(trimmedFile, {
        trimStart: { value: startTime, enumerable: true },
        trimEnd: { value: endTime, enumerable: true }
      });

      console.log('Trim complete, providing file to parent component');
      setProgress({ stage: 'finalizing', percent: 100 });
      onTrimComplete(trimmedFile);
      onClose();
    } catch (error) {
      console.error('Video trimming failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to trim video');
    } finally {
      setIsProcessing(false);
    }
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
          
          <div className="space-y-4">
            <div>
              <label className="block text-zinc-400 text-sm mb-1">Start Time:</label>
              <input 
                type="range"
                min={0}
                max={Math.max(0, duration - 5)}
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
            <div className="flex justify-center mt-4">
              <button
                onClick={isPlaying ? handlePreviewPause : handlePreviewPlay}
                className="bg-zinc-800 text-white py-2 px-4 rounded-lg hover:bg-zinc-700"
              >
                {isPlaying ? 'Pause Preview' : 'Preview Trim'}
              </button>
            </div>
          )}

          {isProcessing && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-zinc-400 mb-2">
                <span>
                  {progress.stage === 'preparing' && 'Preparing...'}
                  {progress.stage === 'trimming' && 'Trimming...'}
                  {progress.stage === 'finalizing' && 'Finalizing...'}
                </span>
                <span>{progress.percent}%</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2">
                <div 
                  className="bg-[#E0FE10] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
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

// Helper function to format time as MM:SS
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};
