import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Dumbbell, Play, Sparkles } from 'lucide-react';
import SequentialVideoPlayerView from '../../../components/SequentialVideoPlayerView';
import SweatListCardView from '../../../components/SweatListCardView';
import { workoutService } from '../../../api/firebase/workout/service';
import { ExerciseLog } from '../../../api/firebase/exercise/types';
import { Workout } from '../../../api/firebase/workout/types';
import { userService } from '../../../api/firebase/user/service';
import { RootState } from '../../../redux/store';
import { useDispatch } from 'react-redux';
import { setCurrentWorkout, setCurrentExerciseLogs } from '../../../redux/workoutSlice';

// Chromatic Glass color palette - subtle variant
const colors = {
  primary: '#E0FE10',
  primaryDim: 'rgba(224, 254, 16, 0.10)',
  primaryBorder: 'rgba(224, 254, 16, 0.25)',
  primaryGlow: 'rgba(224, 254, 16, 0.15)',
};

const WorkoutPreviewer: React.FC = () => {
  const router = useRouter();
  const { username, id } = router.query;

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const userId = useSelector((state: RootState) => state.user.currentUser?.id);
  const dispatch = useDispatch();

  useEffect(() => {
    if (!router.isReady || !username || !id) return;

    const fetchWorkoutByUsernameAndId = async () => {
      try {
        const user = await userService.getUserByUsername(username as string);
        
        if (!user) {
          setError("User not found");
          return;
        }

        const [fetchedWorkout, fetchedLogs] = await workoutService.fetchSavedWorkout(user.id, id as string);

        if (fetchedWorkout) {
          setWorkout(fetchedWorkout);
          setLogs(fetchedLogs || []);
        } else {
          setError("No workout data returned");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkoutByUsernameAndId();
  }, [router.isReady, username, id]);

  const handleStartWorkout = async () => {
    if (!workout || !logs.length) {
      setError("Unable to start workout - workout or logs missing");
      return;
    }

    try {
      if (userId) {
        const result = await workoutService.saveWorkoutSession({
          userId,
          workout,
          logs
        });

        const savedWorkout = result?.workout;
        const updatedLogsWithNewIds = result?.logs;

        if (savedWorkout && updatedLogsWithNewIds) {
          const plainWorkout = savedWorkout.toDictionary();
          const plainLogs = updatedLogsWithNewIds.map(log => log.toDictionary());

          dispatch(setCurrentWorkout(plainWorkout));
          dispatch(setCurrentExerciseLogs(plainLogs));

          router.push('/');
        } else {
          setError("Failed to save workout session");
        }
      } else {
        setError("User not authenticated");
      }
    } catch (err) {
      setError("Failed to start workout: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-10 h-10 rounded-full border-2 border-transparent"
            style={{ 
              borderTopColor: colors.primary,
              borderRightColor: `${colors.primary}40`
            }}
          />
          <p className="text-zinc-500 text-sm">Loading workout...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error || !workout) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-6">
        <div className="max-w-md w-full backdrop-blur-sm bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <span className="text-xl">⚠️</span>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Error Loading Workout</h2>
          <p className="text-zinc-400 text-sm mb-6">{error || "No workout data available"}</p>
          <button
            onClick={() => router.back()}
            className="px-5 py-2.5 rounded-xl bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const videoURLs = workout.exercises
    .filter(exerciseRef => exerciseRef.exercise.videos?.length > 0)
    .flatMap(exerciseRef => exerciseRef.exercise.videos.map(video => video.videoURL))
    .filter(url => url);

  const duration = Workout.estimatedDuration(workout.exercises);

  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      {/* Desktop: Side-by-side layout | Mobile: Stacked layout */}
      <div className="lg:flex lg:h-screen">
        
        {/* Left Panel - Hero/Video Section */}
        <div className="relative lg:w-1/2 xl:w-[55%] h-[45vh] lg:h-full">
          {/* Video Player */}
          <div className="absolute inset-0">
            <SequentialVideoPlayerView videoURLs={videoURLs} isMuted={true} ratio="cover" />
            
            {/* Overlays */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0b]/60 via-transparent to-[#0a0a0b] lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-[#0a0a0b]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0b] via-transparent to-transparent lg:hidden" />
          </div>

          {/* Back Button */}
          <button
            onClick={() => router.back()}
            className="absolute top-6 left-6 z-20 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center hover:bg-black/60 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>

          {/* AI Badge - Desktop: top right, Mobile: top right */}
          {workout.title?.toLowerCase().includes('ai') && (
            <div className="absolute top-6 right-6 z-20 lg:right-auto lg:left-20">
              <div 
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10"
              >
                <Sparkles className="w-3 h-3" style={{ color: colors.primary }} />
                <span className="text-[10px] font-semibold tracking-wider" style={{ color: colors.primary }}>
                  AI-POWERED
                </span>
              </div>
            </div>
          )}

          {/* Hero Content - Mobile only */}
          <div className="absolute bottom-0 left-0 right-0 p-6 z-10 lg:hidden">
            {/* Category Badge */}
            <div 
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-3 text-xs"
              style={{
                backgroundColor: colors.primaryDim,
                border: `1px solid ${colors.primaryBorder}`,
                color: colors.primary
              }}
            >
              <Dumbbell className="w-3 h-3" />
              <span className="font-medium">{workout.zone || 'Upper Body'}</span>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-white mb-3 leading-tight">
              {workout.title}
            </h1>

            {/* Stats Row */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: colors.primaryDim, border: `1px solid ${colors.primaryBorder}` }}
                >
                  <Dumbbell className="w-4 h-4" style={{ color: colors.primary }} />
                </div>
                <div>
                  <p className="text-white font-semibold">{logs.length}</p>
                  <p className="text-zinc-500 text-xs">Exercises</p>
                </div>
              </div>
              <div className="w-px h-8 bg-zinc-800" />
              <div className="flex items-center gap-2">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: colors.primaryDim, border: `1px solid ${colors.primaryBorder}` }}
                >
                  <Clock className="w-4 h-4" style={{ color: colors.primary }} />
                </div>
                <div>
                  <p className="text-white font-semibold">{duration}</p>
                  <p className="text-zinc-500 text-xs">Minutes</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Content Section */}
        <div className="relative lg:w-1/2 xl:w-[45%] lg:h-full lg:overflow-y-auto">
          {/* Desktop Header - Only visible on lg+ */}
          <div className="hidden lg:block sticky top-0 z-20 bg-[#0a0a0b] px-8 pt-8 pb-6">
            {/* Category Badge */}
            <div 
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-4 text-xs"
              style={{
                backgroundColor: colors.primaryDim,
                border: `1px solid ${colors.primaryBorder}`,
                color: colors.primary
              }}
            >
              <Dumbbell className="w-3 h-3" />
              <span className="font-medium">{workout.zone || 'Upper Body'}</span>
            </div>

            {/* Title */}
            <h1 className="text-3xl xl:text-4xl font-bold text-white mb-4 leading-tight">
              {workout.title}
            </h1>

            {/* Stats Row */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: colors.primaryDim, border: `1px solid ${colors.primaryBorder}` }}
                >
                  <Dumbbell className="w-5 h-5" style={{ color: colors.primary }} />
                </div>
                <div>
                  <p className="text-xl font-bold text-white">{logs.length}</p>
                  <p className="text-zinc-500 text-sm">Exercises</p>
                </div>
              </div>
              <div className="w-px h-12 bg-zinc-800" />
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: colors.primaryDim, border: `1px solid ${colors.primaryBorder}` }}
                >
                  <Clock className="w-5 h-5" style={{ color: colors.primary }} />
                </div>
                <div>
                  <p className="text-xl font-bold text-white">{duration}</p>
                  <p className="text-zinc-500 text-sm">Minutes</p>
                </div>
              </div>
            </div>
          </div>

          {/* Exercise List */}
          <div className="px-4 lg:px-8 pb-32 lg:pb-28 -mt-4 lg:mt-0">
            {/* Glass Card Container */}
            <div className="rounded-2xl overflow-hidden bg-zinc-900/60 border border-zinc-800/80">
              {/* Header */}
              <div className="px-5 py-4 border-b border-zinc-800/80 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Exercises</h2>
                <span className="text-xs text-zinc-500">{logs.length} moves</span>
              </div>

              {/* Exercise List */}
              <div className="px-5 py-2 divide-y divide-zinc-800/50">
                {logs.map((log, index) => (
                  <SweatListCardView
                    key={log.id}
                    log={log}
                    index={index}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Start Button - Fixed on mobile, sticky on desktop */}
          <div className="fixed lg:sticky bottom-0 left-0 right-0 lg:bottom-0 z-50 p-4 lg:p-6 bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b]/95 to-transparent lg:bg-[#0a0a0b] lg:border-t lg:border-zinc-800/50">
            <button
              onClick={handleStartWorkout}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ 
                backgroundColor: colors.primary,
                color: '#0a0a0b'
              }}
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Start Workout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Modal */}
      {error && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-6">
          <div className="max-w-sm w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Error</h2>
            <p className="text-zinc-400 text-sm mb-6">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="w-full py-3 rounded-xl font-medium text-sm transition-colors"
              style={{ backgroundColor: colors.primary, color: '#0a0a0b' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkoutPreviewer;
