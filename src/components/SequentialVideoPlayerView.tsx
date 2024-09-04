import React, { useState, useEffect, useRef } from 'react';

interface SequentialVideoPlayerProps {
  videoURLs: string[];
  isMuted?: boolean;
  ratio?: 'cover' | 'contain';
}

const SequentialVideoPlayerView: React.FC<SequentialVideoPlayerProps> = ({ 
  videoURLs, 
  isMuted = true, 
  ratio = 'cover' 
}) => {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const playNextVideo = () => {
      setCurrentVideoIndex((prevIndex) => (prevIndex + 1) % videoURLs.length);
    };

    const handleCanPlay = () => {
      video.play().catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Error playing video:", error);
        }
      });
    };

    // Event listeners for video end and can play
    video.addEventListener('ended', playNextVideo);
    video.addEventListener('canplay', handleCanPlay);

    // Clean up event listeners on unmount
    return () => {
      video.removeEventListener('ended', playNextVideo);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [videoURLs, currentVideoIndex]); // add currentVideoIndex to dependency array

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      // Update video source and reset play state
      video.src = videoURLs[currentVideoIndex];
      video.load(); // Load the new video
    }
  }, [currentVideoIndex, videoURLs]); // Add videoURLs as a dependency

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        className={`absolute inset-0 w-full h-full ${ratio === 'cover' ? 'object-cover' : 'object-contain'}`}
        muted={isMuted}
        playsInline
        loop={false} // Change loop to false to avoid looping the same video
      />
    </div>
  );
};

export default SequentialVideoPlayerView;