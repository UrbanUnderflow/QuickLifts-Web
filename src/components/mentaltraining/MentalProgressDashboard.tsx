/**
 * Mental Progress Dashboard
 * 
 * Comprehensive dashboard showing mental training progress including:
 * - Current streak and stats
 * - Mental readiness trend over time
 * - Category breakdown
 * - Recent completions
 * - Achievements
 */

import React, { useState, useEffect } from 'react';
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
  Calendar,
  CheckCircle,
  BarChart3,
} from 'lucide-react';
import {
  MentalTrainingStreak,
  ExerciseCompletion,
  MentalCheckIn,
  ExerciseCategory,
  completionService,
} from '../../api/firebase/mentaltraining';

interface MentalProgressDashboardProps {
  userId: string;
}

export const MentalProgressDashboard: React.FC<MentalProgressDashboardProps> = ({
  userId,
}) => {
  const [streak, setStreak] = useState<MentalTrainingStreak | null>(null);
  const [completions, setCompletions] = useState<ExerciseCompletion[]>([]);
  const [checkIns, setCheckIns] = useState<MentalCheckIn[]>([]);
  const [averageReadiness, setAverageReadiness] = useState<{
    average: number;
    trend: 'up' | 'down' | 'stable';
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [streakData, completionsData, avgReadiness] = await Promise.all([
          completionService.getStreak(userId),
          completionService.getCompletions(userId, 20),
          completionService.getAverageReadiness(userId, 7),
        ]);

        setStreak(streakData);
        setCompletions(completionsData);
        setAverageReadiness(avgReadiness);

        // Load recent check-ins
        const checkInsData = await completionService.getCheckIns(userId, 14);
        setCheckIns(checkInsData);
      } catch (err) {
        console.error('Failed to load progress data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userId]);

  const getCategoryIcon = (category: ExerciseCategory | string) => {
    switch (category) {
      case ExerciseCategory.Breathing:
      case 'breathing':
        return <Wind className="w-4 h-4" />;
      case ExerciseCategory.Visualization:
      case 'visualization':
        return <Eye className="w-4 h-4" />;
      case ExerciseCategory.Focus:
      case 'focus':
        return <Target className="w-4 h-4" />;
      case ExerciseCategory.Mindset:
      case 'mindset':
        return <Brain className="w-4 h-4" />;
      case ExerciseCategory.Confidence:
      case 'confidence':
        return <Star className="w-4 h-4" />;
      default:
        return <Brain className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category: ExerciseCategory | string) => {
    switch (category) {
      case ExerciseCategory.Breathing:
      case 'breathing':
        return 'text-cyan-400 bg-cyan-500/10';
      case ExerciseCategory.Visualization:
      case 'visualization':
        return 'text-purple-400 bg-purple-500/10';
      case ExerciseCategory.Focus:
      case 'focus':
        return 'text-amber-400 bg-amber-500/10';
      case ExerciseCategory.Mindset:
      case 'mindset':
        return 'text-emerald-400 bg-emerald-500/10';
      case ExerciseCategory.Confidence:
      case 'confidence':
        return 'text-yellow-400 bg-yellow-500/10';
      default:
        return 'text-zinc-400 bg-zinc-500/10';
    }
  };

  const getTrendIcon = () => {
    if (!averageReadiness) return null;
    switch (averageReadiness.trend) {
      case 'up':
        return <TrendingUp className="w-5 h-5 text-green-400" />;
      case 'down':
        return <TrendingDown className="w-5 h-5 text-red-400" />;
      default:
        return <Minus className="w-5 h-5 text-zinc-400" />;
    }
  };

  // Calculate category distribution for the bar chart
  const categoryDistribution = streak
    ? Object.entries(streak.categoryCompletions)
        .map(([category, count]) => ({
          category,
          count: count as number,
          percentage:
            streak.totalExercisesCompleted > 0
              ? Math.round(((count as number) / streak.totalExercisesCompleted) * 100)
              : 0,
        }))
        .sort((a, b) => b.count - a.count)
    : [];

  // Group completions by day for activity calendar
  const completionsByDay = completions.reduce((acc, c) => {
    const date = new Date(c.completedAt).toDateString();
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-zinc-400">Loading your progress...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Current Streak */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/20"
        >
          <div className="flex items-center gap-3 mb-3">
            <Flame
              className={`w-6 h-6 ${
                streak && streak.currentStreak > 0 ? 'text-orange-400' : 'text-zinc-500'
              }`}
            />
            <span className="text-sm text-zinc-400">Current Streak</span>
          </div>
          <p className="text-4xl font-bold text-white">{streak?.currentStreak || 0}</p>
          <p className="text-sm text-zinc-400 mt-1">
            Best: {streak?.longestStreak || 0} days
          </p>
        </motion.div>

        {/* Total Exercises */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/20"
        >
          <div className="flex items-center gap-3 mb-3">
            <Award className="w-6 h-6 text-purple-400" />
            <span className="text-sm text-zinc-400">Exercises Done</span>
          </div>
          <p className="text-4xl font-bold text-white">
            {streak?.totalExercisesCompleted || 0}
          </p>
          <p className="text-sm text-zinc-400 mt-1">
            {streak?.weeklyCompletions || 0} this week
          </p>
        </motion.div>

        {/* Total Time */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-5 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20"
        >
          <div className="flex items-center gap-3 mb-3">
            <Clock className="w-6 h-6 text-blue-400" />
            <span className="text-sm text-zinc-400">Time Trained</span>
          </div>
          <p className="text-4xl font-bold text-white">
            {streak?.totalMinutesTrained || 0}
            <span className="text-lg text-zinc-400 ml-1">min</span>
          </p>
          <p className="text-sm text-zinc-400 mt-1">
            {streak?.weeklyMinutes || 0} min this week
          </p>
        </motion.div>

        {/* Mental Readiness */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-5 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/20"
        >
          <div className="flex items-center gap-3 mb-3">
            <BarChart3 className="w-6 h-6 text-green-400" />
            <span className="text-sm text-zinc-400">Avg Readiness</span>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-4xl font-bold text-white">
              {averageReadiness?.average || '-'}
            </p>
            {getTrendIcon()}
          </div>
          <p className="text-sm text-zinc-400 mt-1">7-day average</p>
        </motion.div>
      </div>

      {/* Category Breakdown & Achievements */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-6 rounded-2xl bg-zinc-800/50 border border-zinc-700/50"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-[#E0FE10]" />
            Training Focus
          </h3>

          {categoryDistribution.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">
              Complete exercises to see your focus areas
            </div>
          ) : (
            <div className="space-y-3">
              {categoryDistribution.map(({ category, count, percentage }) => (
                <div key={category} className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${getCategoryColor(category)}`}>
                    {getCategoryIcon(category)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-white capitalize">{category}</span>
                      <span className="text-sm text-zinc-400">{count}</span>
                    </div>
                    <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.5, delay: 0.5 }}
                        className={`h-full rounded-full ${getCategoryColor(category).replace('bg-', 'bg-').replace('/10', '')}`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Achievements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="p-6 rounded-2xl bg-zinc-800/50 border border-zinc-700/50"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-[#E0FE10]" />
            Achievements ({streak?.achievements.length || 0})
          </h3>

          {!streak || streak.achievements.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">
              <Award className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Complete exercises to unlock achievements</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {streak.achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className="p-3 rounded-xl bg-[#E0FE10]/10 border border-[#E0FE10]/30"
                  title={achievement.description}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">🏆</span>
                    <span className="text-sm font-medium text-white truncate">
                      {achievement.name}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 line-clamp-2">
                    {achievement.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="p-6 rounded-2xl bg-zinc-800/50 border border-zinc-700/50"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#E0FE10]" />
          Recent Activity
        </h3>

        {completions.length === 0 ? (
          <div className="text-center py-8 text-zinc-400">
            No activity yet. Start your first exercise!
          </div>
        ) : (
          <div className="space-y-3">
            {completions.slice(0, 8).map((completion) => (
              <div
                key={completion.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/50"
              >
                <div className={`p-2 rounded-lg ${getCategoryColor(completion.exerciseCategory)}`}>
                  {getCategoryIcon(completion.exerciseCategory)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">
                    {completion.exerciseName}
                  </p>
                  <p className="text-sm text-zinc-400">
                    {Math.round(completion.durationSeconds / 60)} min
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-zinc-400">
                    {new Date(completion.completedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  {completion.helpfulnessRating && (
                    <div className="flex items-center justify-end gap-1 text-xs text-zinc-500">
                      <span>{completion.helpfulnessRating}/5</span>
                      <Star className="w-3 h-3" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default MentalProgressDashboard;
