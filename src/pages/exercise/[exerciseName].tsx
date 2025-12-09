import React, { useState, useEffect, useRef } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { ChevronLeft, BarChart2, Plus, Download } from 'lucide-react';
import { Exercise } from '../../api/firebase/exercise';
import { User } from '../../api/firebase/user';

interface ExerciseViewProps {
  initialExerciseData: Exercise | null;
  error: string | null;
}

export default function ExerciseView({ initialExerciseData, error: serverError }: ExerciseViewProps) {
  const router = useRouter();
  const [exercise, setExercise] = useState<Exercise | null>(initialExerciseData);
  const [videoOwner, setVideoOwner] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(!initialExerciseData);
  const [error, setError] = useState<string | null>(serverError);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [showCaption, setShowCaption] = useState(false);

  const API_BASE_URL = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:8888/.netlify/functions'
    : 'https://fitwithpulse.ai/.netlify/functions';

  // Debug initial exercise data
  useEffect(() => {
    console.log('Initial Exercise Data:', initialExerciseData);
    if (initialExerciseData?.videos?.length) {
      console.log('Videos Array:', initialExerciseData.videos);
      console.log('First Video URL:', initialExerciseData.videos[0]?.videoURL);
    } else {
      console.log('No videos found in initial exercise data');
    }
  }, [initialExerciseData]);

  useEffect(() => {
    const fetchExerciseData = async () => {
      if (!router.query.exerciseName || initialExerciseData) return;

      try {
        setIsLoading(true);
        console.log('Fetching exercise data for:', router.query.exerciseName);
        const response = await fetch(
          `${API_BASE_URL}/get-exercise?name=${router.query.exerciseName}`
        );
        if (!response.ok) throw new Error('Exercise not found');
        
        const data = await response.json();
        console.log('Fetched Exercise Data:', data);
        
        if (data.success) {
          setExercise(data.exercise);
          console.log('Exercise videos:', data.exercise.videos);
          
          if (data.exercise.videos?.[0]?.userId) {
            console.log('Fetching user profile for video owner:', data.exercise.videos[0].userId);
            const userResponse = await fetch(
              `${API_BASE_URL}/get-user-profile?userId=${data.exercise.videos[0].userId}`
            );
            if (userResponse.ok) {
              const userData = await userResponse.json();
              console.log('User data for video owner:', userData);
              if (userData.success) {
                setVideoOwner(userData.user);
              }
            } else {
              console.log('Failed to fetch user profile:', await userResponse.text());
            }
          } else {
            console.log('No userId found for the first video');
          }
        } else {
          throw new Error(data.error || 'Failed to load exercise');
        }
      } catch (err) {
        console.error('Error fetching exercise:', err);
        setError(err instanceof Error ? err.message : 'Failed to load exercise');
      } finally {
        setIsLoading(false);
      }
    };

    fetchExerciseData();
  }, [router.query.exerciseName, initialExerciseData]);

  // Log current exercise state when it changes
  useEffect(() => {
    if (exercise) {
      console.log('Current exercise state:', exercise);
      console.log('Current video data:', exercise.videos?.[0]);
    }
  }, [exercise]);

  if (isLoading || error || !exercise) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-900">
        {isLoading ? 'Loading...' : 'Exercise not found'}
      </div>
    );
  }

  // Simple video player component
  const VideoPlayer = ({ videoURL, thumbnail, caption }: { videoURL: string, thumbnail?: string, caption?: string }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [videoError, setVideoError] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handlePlayPause = () => {
      if (videoRef.current) {
        if (isPlaying) {
          videoRef.current.pause();
        } else {
          videoRef.current.play().catch(err => {
            console.error('Failed to play video:', err);
            setVideoError(true);
          });
        }
        setIsPlaying(!isPlaying);
      }
    };

    const toggleMute = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (videoRef.current) {
        videoRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
      }
    };

    const toggleFullscreen = (e: React.MouseEvent) => {
      e.stopPropagation();
      
      if (!document.fullscreenElement) {
        containerRef.current?.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
        setIsFullscreen(true);
      } else {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    };

    useEffect(() => {
      // Auto-play when component mounts
      if (videoRef.current) {
        videoRef.current.play().catch(err => {
          console.error('Failed to auto-play video:', err);
          // Don't set error here, just let it be paused
          setIsPlaying(false);
        });
      }

      // Listen for fullscreen change
      const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
      };

      document.addEventListener('fullscreenchange', handleFullscreenChange);
      
      return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
      };
    }, []);

    if (videoError) {
      return (
        <div className="relative w-full h-full flex flex-col items-center justify-center">
          <div className="text-white mb-2">Failed to load video</div>
          <div className="flex gap-2">
            <button 
              onClick={() => window.open(videoURL, '_blank')}
              className="bg-blue-500 text-white px-4 py-2 rounded-md"
            >
              Open video in new tab
            </button>
            <button 
              onClick={() => setVideoError(false)}
              className="bg-gray-500 text-white px-4 py-2 rounded-md"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        className="relative flex h-full w-full items-center justify-center"
        onClick={handlePlayPause}
      >
        <video
          ref={videoRef}
          src={videoURL}
          poster={thumbnail || undefined}
          className="w-full max-w-3xl max-h-[calc(100vh-160px)] object-contain"
          loop
          muted={isMuted}
          playsInline
          onError={(e) => {
            console.error('Video error:', e);
            setVideoError(true);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        
        {caption && (
          <div className="pointer-events-none absolute bottom-6 left-0 right-0 flex justify-center px-4">
            <div className="inline-block max-w-xl rounded-2xl bg-black/75 px-4 py-3 text-sm text-white shadow-lg shadow-black/60">
              {caption}
            </div>
          </div>
        )}
        
        {/* Play/Pause overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {!isPlaying && (
            <div className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center pointer-events-auto cursor-pointer" onClick={handlePlayPause}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
        </div>
        
        {/* Video controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
          <div className="flex items-center justify-between">
            <button 
              className="pointer-events-auto p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
              onClick={toggleMute}
            >
              {isMuted ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M3.63 3.63a.996.996 0 000 1.41L7.29 8.7 7 9H4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71v-4.17l4.18 4.18c-.49.37-1.02.68-1.6.91-.36.15-.58.53-.58.92 0 .72.73 1.18 1.39.91.8-.33 1.55-.77 2.22-1.31l1.34 1.34a.996.996 0 101.41-1.41L5.05 3.63c-.39-.39-1.02-.39-1.42 0zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-3.83-2.4-7.11-5.78-8.4-.59-.23-1.22.23-1.22.86v.19c0 .38.25.71.61.85C17.18 6.54 19 9.06 19 12zm-8.71-6.29l-.17.17L12 7.76V6.41c0-.89-1.08-1.33-1.71-.7zM16.5 12A4.5 4.5 0 0014 7.97v1.79l2.48 2.48c.01-.08.02-.16.02-.24z"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
              )}
            </button>
            
            <button 
              className="pointer-events-auto p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Get the first video if available
  const hasVideos = exercise.videos && exercise.videos.length > 0;
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const selectedVideo = hasVideos ? exercise.videos[selectedVideoIndex] : null;

  // Function to switch between videos
  const switchVideo = (index: number) => {
    if (exercise.videos && index >= 0 && index < exercise.videos.length) {
      setSelectedVideoIndex(index);
      console.log(`Switching to video ${index}:`, exercise.videos[index]);
    }
  };

  // Add download handler function
  const handleDownload = async () => {
    if (!selectedVideo?.videoURL) return;
    
    try {
      const response = await fetch(selectedVideo.videoURL, {
        method: 'GET',
        headers: {
          'Content-Type': 'video/mp4',
        },
        mode: 'cors',
      });
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${exercise.name}-${selectedVideo.username || 'video'}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading video:', error);
      // Open in new tab as fallback if download fails
      window.open(selectedVideo.videoURL, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-900">
      {/* Back button */}
      <div className="absolute top-4 left-4 z-10">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
        >
          <ChevronLeft size={24} />
        </button>
      </div>

      {/* Download button */}
      {selectedVideo?.videoURL && (
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={handleDownload}
            className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
            title="Download video"
          >
            <Download size={24} />
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="relative h-full w-full flex flex-col">
        {/* Video container */}
        <div className="relative flex-1">
          {selectedVideo?.videoURL ? (
            <VideoPlayer 
              key={selectedVideo.id} // Force remount when video changes
              videoURL={selectedVideo.videoURL} 
              thumbnail={selectedVideo.thumbnail} 
              caption={selectedVideo.caption || exercise.description}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white">
              No video available for this exercise
            </div>
          )}
          
          {/* Video info overlay */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 pt-16">
            <h1 className="text-2xl font-bold text-white">{exercise.name}</h1>
            {selectedVideo?.username && (
              <div className="flex items-center mt-2">
                {selectedVideo.profileImage?.profileImageURL ? (
                  <img 
                    src={selectedVideo.profileImage.profileImageURL} 
                    alt={selectedVideo.username} 
                    className="w-6 h-6 rounded-full mr-2"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center mr-2">
                    <span className="text-xs text-white">{selectedVideo.username.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <span className="text-white text-sm">{selectedVideo.username}</span>
              </div>
            )}
          </div>
        </div>

        {/* Exercise details */}
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<ExerciseViewProps> = async (context) => {
    const { exerciseName } = context.params || {};
  
    if (!exerciseName || typeof exerciseName !== 'string') {
      return {
        redirect: {
          destination: '/',
          permanent: false,
        },
      };
    }
  
    try {
      const API_BASE_URL = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:8888/.netlify/functions'
        : 'https://fitwithpulse.ai/.netlify/functions';
  
      // Convert hyphens back to spaces and capitalize words for the query
      const formattedName = exerciseName
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
  
      console.log('SSR: Fetching exercise data for:', formattedName);
      const response = await fetch(`${API_BASE_URL}/get-exercise?name=${exerciseName}`);
      
      if (!response.ok) {
        console.error('SSR: Exercise fetch failed with status:', response.status);
        throw new Error('Exercise not found');
      }
  
      const data = await response.json();
      console.log('SSR: Exercise data received', {
        success: data.success,
        hasExercise: !!data.exercise,
        videoCount: data.exercise?.videos?.length || 0,
        firstVideoURL: data.exercise?.videos?.[0]?.videoURL || 'No video URL'
      });
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load exercise');
      }
  
      return {
        props: {
          initialExerciseData: data.exercise,
          error: null
        }
      };
    } catch (error) {
      console.error('Error in getServerSideProps:', error);
      return {
        props: {
          initialExerciseData: null,
          error: error instanceof Error ? error.message : 'Failed to load exercise'
        }
      };
    }
  };