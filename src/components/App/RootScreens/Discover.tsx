import { useState, useEffect, useRef } from 'react';
import { Exercise } from '../../../types/Exercise';
import { exerciseService } from '../../../api/firebase/exercise';
import { GifImageViewer } from '../../../components/GifImageViewer';
import { useRouter } from 'next/router';

const Discover: React.FC = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  /**
   * Fetch a batch of exercises (paginated).
   */
  const fetchExercises = async (isLoadMore = false) => {
    try {
      if (isLoadMore) setLoadingMore(true);
      else setLoading(true);

      const { exercises: newExercises, lastVisible } =
        await exerciseService.fetchPaginatedExercises(lastDoc, 15);

      setExercises((prev) =>
        isLoadMore ? [...prev, ...newExercises] : newExercises
      );
      setLastDoc(lastVisible);
      setHasMore(newExercises.length > 0);
    } catch (error) {
      console.error('Error fetching exercises:', error);
    } finally {
      if (isLoadMore) setLoadingMore(false);
      else setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchExercises();
  }, []);

  // IntersectionObserver for "Load More"
  useEffect(() => {
    if (!loaderRef.current) return;

    const loaderObserver = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (firstEntry.isIntersecting && hasMore && !loadingMore) {
          fetchExercises(true);
        }
      },
      { threshold: 1.0 }
    );

    loaderObserver.observe(loaderRef.current);

    return () => loaderObserver.disconnect();
  }, [hasMore, loadingMore, lastDoc]);

  // IntersectionObserver for auto-playing videos
  useEffect(() => {
    const videoObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const videoEl = entry.target as HTMLVideoElement;
          // If user has manually paused, we won't force play it again (optional approach).
          // But if you want to force the video to play each time, remove the userPause check below.
          if (entry.isIntersecting && !videoEl.dataset.userPause) {
            videoEl.play().catch((err) => console.error('Video play error:', err));
          } else {
            // Pause video if it’s not in view or user tapped it once to pause
            videoEl.pause();
          }
        }
      },
      { threshold: 0.5 }
    );

    // Query all <video> elements with data-observe="true"
    const allVideos = document.querySelectorAll<HTMLVideoElement>(
      'video[data-observe="true"]'
    );

    allVideos.forEach((videoEl) => {
      videoObserver.observe(videoEl);
    });

    return () => {
      allVideos.forEach((videoEl) => videoObserver.unobserve(videoEl));
      videoObserver.disconnect();
    };
  }, [exercises]);

  /**
   * Tap handler for toggling play/pause on user click.
   */
  const handleVideoTap = (e: React.MouseEvent<HTMLVideoElement>) => {
    const videoEl = e.currentTarget;
    if (videoEl.paused) {
      // Clear the userPause data attribute, then play
      videoEl.removeAttribute('data-user-pause');
      videoEl.play().catch((err) => console.error('Video play error:', err));
    } else {
      // Mark that user paused it, so IntersectionObserver won't re-play
      videoEl.setAttribute('data-user-pause', 'true');
      videoEl.pause();
    }
  };

  const handleProfileClick = (username: string) => {
    if (username) {
      router.push(`/profile/${username}`);
    } else {
      console.error('Username is missing.');
    }
  };

  const handleVideoSelection = (exerciseIndex: number, videoIndex: number) => {
    setExercises((prev) =>
      prev.map((exercise, idx) =>
        idx === exerciseIndex
          ? {
              ...exercise,
              currentVideoPosition: videoIndex,
            }
          : exercise
      )
    );
  };

  if (loading && exercises.length === 0) {
    return <div className="text-white text-center">Loading exercises...</div>;
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      {exercises.map((exercise, exerciseIndex) => (
        <div
          key={exercise.id}
          className="bg-zinc-800 rounded-xl overflow-hidden mb-6"
        >
          <video
            data-observe="true" // We'll observe it for auto-play/pause
            src={exercise.videos[exercise.currentVideoPosition]?.videoURL}
            muted
            loop
            className="w-full aspect-square object-cover"
            onClick={handleVideoTap}
          />

          <div className="p-4">
            <div className="flex items-center gap-4 mb-3">
              <img
                src={
                  exercise.videos[exercise.currentVideoPosition]?.profileImage
                    .profileImageURL || '/default-profile.png'
                }
                alt={
                  exercise.videos[exercise.currentVideoPosition]?.username ||
                  'User'
                }
                className="w-8 h-8 rounded-full cursor-pointer"
                onClick={() =>
                  handleProfileClick(
                    exercise.videos[exercise.currentVideoPosition]?.username ||
                      ''
                  )
                }
              />
              <p
                className="text-white font-medium cursor-pointer"
                onClick={() =>
                  handleProfileClick(
                    exercise.videos[exercise.currentVideoPosition]?.username ||
                      ''
                  )
                }
              >
                {exercise.videos[exercise.currentVideoPosition]?.username ||
                  'Unknown User'}
              </p>
            </div>
            <p className="text-zinc-400 text-sm">{exercise.name}</p>
            <p className="text-zinc-500 text-xs mt-1">{exercise.description}</p>

            {/* Video Bubble GIF Previews */}
            <div className="flex items-center gap-2 mt-4">
              {exercise.videos.slice(0, 4).map((video, videoIndex) => (
                <GifImageViewer
                  key={video.id}
                  gifUrl={video.gifURL || '/default-gif.gif'}
                  alt={`Preview of ${exercise.name}`}
                  frameSize={{ width: 36, height: 36 }}
                  contentMode="cover"
                  className={`border-2 ${
                    exercise.currentVideoPosition === videoIndex
                      ? 'border-[#E0FE10]'
                      : 'border-zinc-500'
                  }`}
                  onClick={() => handleVideoSelection(exerciseIndex, videoIndex)}
                />
              ))}
              {exercise.videos.length > 4 && (
                <div
                  className="w-9 h-9 bg-gray-600 rounded-full flex items-center justify-center text-white text-sm"
                  onClick={() => console.log('More videos tapped')}
                >
                  +{exercise.videos.length - 4}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Loader Section */}
      {hasMore && (
        <div ref={loaderRef} className="text-center py-4">
          {loadingMore && (
            <div className="spinner border-t-transparent border-4 border-[#E0FE10] w-6 h-6 rounded-full animate-spin"></div>
          )}
        </div>
      )}
    </div>
  );
};

export default Discover;