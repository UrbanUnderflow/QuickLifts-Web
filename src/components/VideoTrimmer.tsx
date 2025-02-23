// VideoTrimmer.tsx
import React, { useEffect, useRef, useState } from 'react';
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

interface BrowserSupport {
  mediaRecorder: boolean;
  captureStream: boolean;
}

interface VideoTrimmerProps {
  file: File;
  onTrimComplete: (trimmedFile: File) => void;
  onCancel: () => void;
}

export const VideoTrimmer: React.FC<VideoTrimmerProps> = ({ file, onTrimComplete, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [browserSupport, setBrowserSupport] = useState<BrowserSupport>({
    mediaRecorder: false,
    captureStream: false,
  });
  const [trimProgress, setTrimProgress] = useState(0);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setBrowserSupport({
      mediaRecorder: 'MediaRecorder' in window,
      captureStream: 'captureStream' in HTMLCanvasElement.prototype,
    });

    if (videoRef.current && file) {
      objectUrlRef.current = URL.createObjectURL(file);
      videoRef.current.src = objectUrlRef.current;

      videoRef.current.addEventListener('loadedmetadata', () => {
        const videoDuration = videoRef.current?.duration || 0;
        setDuration(videoDuration);
        // Set the end time to either 30 seconds or the video duration, whichever is lower
        setEndTime(Math.min(videoDuration, 30));
      });
    }

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, [file]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (video.currentTime >= endTime) {
        video.pause();
        video.currentTime = startTime;
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

    const checkTime = () => {
      if (videoRef.current && videoRef.current.currentTime >= endTime) {
        videoRef.current.pause();
        setIsPlaying(false);
        return;
      }
      requestAnimationFrame(checkTime);
    };
    checkTime();
  };

  const handleTrim = async () => {
    if (!videoRef.current) {
      alert('Video element not initialized');
      return;
    }

    if (endTime - startTime < 5 || endTime - startTime > 30) {
      alert('Video must be between 5 and 30 seconds');
      return;
    }

    try {
      setIsLoading(true);

      // Create FFmpeg instance
      const ffmpeg = createFFmpeg({
        log: true,
        corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
      });
      
      await ffmpeg.load();

      // Write the input file to FFmpeg's virtual filesystem
      await ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(file));

      // Run FFmpeg to trim the video
      await ffmpeg.run(
        '-ss', startTime.toString(),
        '-t', (endTime - startTime).toString(),
        '-i', 'input.mp4',
        '-c', 'copy',
        'output.mp4'
      );

      // Read the output file
      const data = await ffmpeg.FS('readFile', 'output.mp4');

      // Clean up files
      ffmpeg.FS('unlink', 'input.mp4');
      ffmpeg.FS('unlink', 'output.mp4');

      // Create a new File from the data
      const trimmedFile = new File([data], 'trimmed.mp4', { type: 'video/mp4' });

      onTrimComplete(trimmedFile);
    } catch (error) {
      console.error('Video trimming failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to trim video');
    } finally {
      setIsLoading(false);
      setTrimProgress(0);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
      <div className="bg-zinc-900 w-full max-w-md rounded-xl p-6">
        <h2 className="text-white text-xl font-bold mb-4">Trim Your Video</h2>
        
        {(!browserSupport.mediaRecorder || !browserSupport.captureStream) && (
          <div className="text-red-500 mb-4">
            Your browser doesn't support video trimming. Please use Chrome, Firefox, or Edge.
          </div>
        )}

        <div className="mb-4">
          <video 
            ref={videoRef}
            controls
            className="w-full rounded-lg"
            onPlay={handlePreviewPlay}
            onPause={() => setIsPlaying(false)}
          />
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-white text-sm mb-2">
            <span>Start: {formatTime(startTime)}</span>
            <span>Duration: {formatTime(endTime - startTime)}</span>
            <span>End: {formatTime(endTime)}</span>
          </div>
          
          <div className="relative mb-4">
            <input 
              type="range"
              min={0}
              max={duration}
              value={startTime}
              onChange={(e) => {
                const newStart = Number(e.target.value);
                setStartTime(Math.min(newStart, endTime - 5));
              }}
              className="w-full"
            />
            <input 
              type="range"
              min={0}
              max={duration}
              value={endTime}
              onChange={(e) => {
                const newEnd = Number(e.target.value);
                setEndTime(Math.max(newEnd, startTime + 5));
              }}
              className="w-full mt-2"
            />
          </div>

          {isLoading && (
            <div className="w-full bg-zinc-800 rounded-full h-2 mb-4">
              <div 
                className="bg-[#E0FE10] h-2 rounded-full transition-all duration-300"
                style={{ width: `${trimProgress}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex space-x-4">
          <button 
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 bg-zinc-800 text-white py-2 rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleTrim}
            disabled={
              isLoading || 
              endTime - startTime < 5 || 
              endTime - startTime > 30 ||
              !browserSupport.mediaRecorder || 
              !browserSupport.captureStream
            }
            className="flex-1 bg-[#E0FE10] text-black py-2 rounded-lg disabled:opacity-50"
          >
            {isLoading ? `Trimming... ${trimProgress}%` : 'Trim Video'}
          </button>
        </div>
      </div>
    </div>
  );
};
