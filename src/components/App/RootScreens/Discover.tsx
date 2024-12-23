import { useState, useEffect, useRef } from 'react';
import { Exercise } from '../../../types/Exercise';
import { exerciseService } from '../../../api/firebase/exercise';

const Discover: React.FC = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<HTMLVideoElement[]>([]);

  const fetchExercises = async (isLoadMore = false) => {
    try {
      if (isLoadMore) setLoadingMore(true);
      else setLoading(true);

      const { exercises: newExercises, lastVisible } = await exerciseService.fetchPaginatedExercises(
        lastDoc,
        15
      );

      setExercises((prev) => (isLoadMore ? [...prev, ...newExercises] : newExercises));
      setLastDoc(lastVisible);
      setHasMore(newExercises.length > 0);
    } catch (error) {
      console.error('Error fetching exercises:', error);
    } finally {
      if (isLoadMore) setLoadingMore(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    fetchExercises();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting) {
            video.play().catch((err) => console.error('Error playing video:', err));
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.5 } // Play when 50% of the video is visible
    );

    videoRefs.current.forEach((video) => {
      if (video) observer.observe(video);
    });

    return () => {
      videoRefs.current.forEach((video) => {
        if (video) observer.unobserve(video);
      });
    };
  }, [exercises]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchExercises(true);
        }
      },
      { threshold: 1 }
    );

    if (loaderRef.current) observer.observe(loaderRef.current);

    return () => {
      if (loaderRef.current) observer.unobserve(loaderRef.current);
    };
  }, [hasMore, loadingMore]);

  if (loading && !exercises.length) {
    return <div className="text-white text-center">Loading exercises...</div>;
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      {exercises.map((exercise, index) => (
        <div key={exercise.id} className="bg-zinc-800 rounded-xl overflow-hidden mb-6">
          <video
            ref={(el) => {
              if (el) videoRefs.current[index] = el;
            }}
            src={exercise.videos[0]?.videoURL}
            muted
            loop
            className="w-full aspect-square object-cover"
          />
          <div className="p-4">
            <div className="flex items-center gap-4 mb-3">
              <img
                src={exercise.videos[0]?.profileImage.profileImageURL || '/default-profile.png'}
                alt={exercise.videos[0]?.username || 'User'}
                className="w-8 h-8 rounded-full"
              />
              <p className="text-white font-medium">{exercise.videos[0]?.username || 'Unknown User'}</p>
            </div>
            <p className="text-zinc-400 text-sm">{exercise.name}</p>
            <p className="text-zinc-500 text-xs mt-1">{exercise.description}</p>
          </div>
        </div>
      ))}

      {/* Loader */}
      {hasMore && (
        <div ref={loaderRef} className="text-center py-4">
          {loadingMore && <div className="spinner border-t-transparent border-4 border-[#E0FE10] w-6 h-6 rounded-full animate-spin"></div>}
        </div>
      )}
    </div>
  );
};

export default Discover;