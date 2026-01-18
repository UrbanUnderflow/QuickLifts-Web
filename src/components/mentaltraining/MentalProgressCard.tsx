/**
 * Mental Progress Card
 * 
 * Displays user's mental training progress including streaks, completions, and achievements.
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  Flame,
  Award,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Wind,
  Eye,
  Target,
  Star,
} from 'lucide-react';
import { MentalTrainingStreak, ExerciseCategory } from '../../api/firebase/mentaltraining/types';

interface MentalProgressCardProps {
  streak: MentalTrainingStreak;
  averageReadiness?: { average: number; trend: 'up' | 'down' | 'stable' };
  compact?: boolean;
}

export const MentalProgressCard: React.FC<MentalProgressCardProps> = ({
  streak,
  averageReadiness,
  compact = false,
}) => {
  const getCategoryIcon = (category: ExerciseCategory) => {
    switch (category) {
      case ExerciseCategory.Breathing: return <Wind className="w-4 h-4" />;
      case ExerciseCategory.Visualization: return <Eye className="w-4 h-4" />;
      case ExerciseCategory.Focus: return <Target className="w-4 h-4" />;
      case ExerciseCategory.Mindset: return <Brain className="w-4 h-4" />;
      case ExerciseCategory.Confidence: return <Star className="w-4 h-4" />;
    }
  };

  const getTrendIcon = () => {
    if (!averageReadiness) return null;
    switch (averageReadiness.trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'down': return <TrendingDown className="w-4 h-4 text-red-400" />;
      default: return <Minus className="w-4 h-4 text-zinc-400" />;
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
        {/* Streak */}
        <div className="flex items-center gap-2">
          <Flame className={`w-5 h-5 ${streak.currentStreak > 0 ? 'text-orange-400' : 'text-zinc-500'}`} />
          <div>
            <p className="text-xl font-bold text-white">{streak.currentStreak}</p>
            <p className="text-xs text-zinc-400">day streak</p>
          </div>
        </div>

        <div className="w-px h-10 bg-zinc-700" />

        {/* Total */}
        <div>
          <p className="text-xl font-bold text-white">{streak.totalExercisesCompleted}</p>
          <p className="text-xs text-zinc-400">exercises</p>
        </div>

        {averageReadiness && (
          <>
            <div className="w-px h-10 bg-zinc-700" />
            <div className="flex items-center gap-1">
              <p className="text-xl font-bold text-white">{averageReadiness.average}</p>
              {getTrendIcon()}
              <p className="text-xs text-zinc-400">readiness</p>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-b from-zinc-800/80 to-zinc-900/80 border border-zinc-700/50 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-zinc-700/50">
        <h3 className="text-lg font-semibold text-white mb-1">Mental Training Progress</h3>
        <p className="text-sm text-zinc-400">Your journey to mental mastery</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
        {/* Current Streak */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-center p-4 rounded-xl bg-orange-500/10 border border-orange-500/20"
        >
          <Flame className={`w-8 h-8 mx-auto mb-2 ${streak.currentStreak > 0 ? 'text-orange-400' : 'text-zinc-500'}`} />
          <p className="text-3xl font-bold text-white">{streak.currentStreak}</p>
          <p className="text-sm text-zinc-400">Day Streak</p>
        </motion.div>

        {/* Total Exercises */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center p-4 rounded-xl bg-purple-500/10 border border-purple-500/20"
        >
          <Award className="w-8 h-8 mx-auto mb-2 text-purple-400" />
          <p className="text-3xl font-bold text-white">{streak.totalExercisesCompleted}</p>
          <p className="text-sm text-zinc-400">Exercises Done</p>
        </motion.div>

        {/* Total Time */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center p-4 rounded-xl bg-blue-500/10 border border-blue-500/20"
        >
          <Clock className="w-8 h-8 mx-auto mb-2 text-blue-400" />
          <p className="text-3xl font-bold text-white">{streak.totalMinutesTrained}</p>
          <p className="text-sm text-zinc-400">Minutes Trained</p>
        </motion.div>

        {/* Longest Streak */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center p-4 rounded-xl bg-green-500/10 border border-green-500/20"
        >
          <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-400" />
          <p className="text-3xl font-bold text-white">{streak.longestStreak}</p>
          <p className="text-sm text-zinc-400">Best Streak</p>
        </motion.div>
      </div>

      {/* Category Breakdown */}
      {Object.keys(streak.categoryCompletions).length > 0 && (
        <div className="px-6 pb-6">
          <h4 className="text-sm font-medium text-zinc-400 mb-3">By Category</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(streak.categoryCompletions).map(([category, count]) => (
              <div
                key={category}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800"
              >
                <span className="text-zinc-400">
                  {getCategoryIcon(category as ExerciseCategory)}
                </span>
                <span className="text-sm text-white capitalize">{category}</span>
                <span className="text-sm text-zinc-400">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Achievements */}
      {streak.achievements.length > 0 && (
        <div className="px-6 pb-6">
          <h4 className="text-sm font-medium text-zinc-400 mb-3">
            Achievements ({streak.achievements.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {streak.achievements.slice(0, 6).map((achievement) => (
              <div
                key={achievement.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#E0FE10]/10 border border-[#E0FE10]/30"
                title={achievement.description}
              >
                <span className="text-[#E0FE10]">🏆</span>
                <span className="text-sm text-white">{achievement.name}</span>
              </div>
            ))}
            {streak.achievements.length > 6 && (
              <div className="flex items-center px-3 py-1.5 rounded-lg bg-zinc-800 text-sm text-zinc-400">
                +{streak.achievements.length - 6} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MentalProgressCard;
