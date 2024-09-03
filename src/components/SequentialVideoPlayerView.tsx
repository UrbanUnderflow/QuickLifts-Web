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
      video.play().catch(error => {
        if (error.name !== "AbortError") {
          console.error("Error playing video:", error);
        }
      });
    };

    video.addEventListener('ended', playNextVideo);
    video.addEventListener('canplay', handleCanPlay);

    return () => {
      video.removeEventListener('ended', playNextVideo);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [videoURLs]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.load();
    }
  }, [currentVideoIndex]);

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        src={videoURLs[currentVideoIndex]}
        className={`absolute inset-0 w-full h-full ${ratio === 'cover' ? 'object-cover' : 'object-contain'}`}
        muted={isMuted}
        playsInline
        loop
      />
    </div>
  );
};

export default SequentialVideoPlayerView;