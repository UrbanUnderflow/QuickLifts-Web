/**
 * Exercise Card Component
 * 
 * Displays a mental exercise in a card format for browsing and selection.
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  Wind,
  Eye,
  Target,
  Brain,
  Star,
  Clock,
  ChevronRight,
  Play,
} from 'lucide-react';
import { MentalExercise, ExerciseCategory } from '../../api/firebase/mentaltraining/types';

interface ExerciseCardProps {
  exercise: MentalExercise;
  onClick?: () => void;
  onAssign?: () => void;
  onPlay?: () => void;
  showAssignButton?: boolean;
  showPlayButton?: boolean;
  isSelected?: boolean;
  compact?: boolean;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exercise,
  onClick,
  onAssign,
  onPlay,
  showAssignButton = false,
  showPlayButton = true,
  isSelected = false,
  compact = false,
}) => {
  const getCategoryLabel = () => {
    switch (exercise.category) {
      case ExerciseCategory.Breathing:
        return 'Breath Work';
      default:
        return exercise.category;
    }
  };

  const getCategoryIcon = () => {
    switch (exercise.category) {
      case ExerciseCategory.Breathing:
        return <Wind className="w-5 h-5" />;
      case ExerciseCategory.Visualization:
        return <Eye className="w-5 h-5" />;
      case ExerciseCategory.Focus:
        return <Target className="w-5 h-5" />;
      case ExerciseCategory.Mindset:
        return <Brain className="w-5 h-5" />;
      case ExerciseCategory.Confidence:
        return <Star className="w-5 h-5" />;
      default:
        return <Brain className="w-5 h-5" />;
    }
  };

  const getCategoryColor = () => {
    switch (exercise.category) {
      case ExerciseCategory.Breathing:
        return { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' };
      case ExerciseCategory.Visualization:
        return { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' };
      case ExerciseCategory.Focus:
        return { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' };
      case ExerciseCategory.Mindset:
        return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' };
      case ExerciseCategory.Confidence:
        return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' };
      default:
        return { bg: 'bg-zinc-500/20', text: 'text-zinc-400', border: 'border-zinc-500/30' };
    }
  };

  const colors = getCategoryColor();

  if (compact) {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className={`
          flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all
          ${isSelected ? `${colors.border} border-2 ${colors.bg}` : 'bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600'}
        `}
      >
        <div className={`p-2 rounded-lg ${colors.bg} ${colors.text}`}>
          {getCategoryIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-white truncate">{exercise.name}</h3>
          <p className="text-sm text-zinc-400">{exercise.durationMinutes} min</p>
        </div>
        {showAssignButton && onAssign && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAssign();
            }}
            className="px-3 py-1 rounded-lg bg-[#E0FE10] text-black text-sm font-medium hover:bg-[#c8e40e] transition-colors"
          >
            Assign
          </button>
        )}
        {!showAssignButton && (
          <ChevronRight className="w-5 h-5 text-zinc-500" />
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-2xl cursor-pointer transition-all
        ${isSelected ? `ring-2 ring-[#E0FE10]` : 'hover:ring-1 hover:ring-zinc-600'}
        bg-gradient-to-b from-zinc-800/80 to-zinc-900/80
        border border-zinc-700/50
      `}
    >
      {/* Category color bar */}
      <div className={`h-1 ${colors.bg.replace('/20', '')}`} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className={`p-2.5 rounded-xl ${colors.bg} ${colors.text}`}>
            {getCategoryIcon()}
          </div>
          <div className="flex items-center gap-1 text-zinc-400 text-sm">
            <Clock className="w-4 h-4" />
            <span>{exercise.durationMinutes} min</span>
          </div>
        </div>

        {/* Title & Description */}
        <h3 className="font-semibold text-white mb-2">{exercise.name}</h3>
        <p className="text-sm text-zinc-400 line-clamp-2 mb-4">
          {exercise.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <span className={`px-2 py-0.5 rounded-full text-xs ${colors.bg} ${colors.text} capitalize`}>
            {getCategoryLabel()}
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-zinc-700/50 text-zinc-400 capitalize">
            {exercise.difficulty}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {showPlayButton && onPlay && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlay();
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-700/80 text-white font-semibold hover:bg-zinc-600 transition-colors border border-zinc-600"
            >
              <Play className="w-4 h-4" />
              Preview
            </button>
          )}
          {showAssignButton && onAssign ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAssign();
              }}
              className={`${showPlayButton && onPlay ? 'flex-1' : 'w-full'} py-2.5 rounded-xl bg-[#E0FE10] text-black font-semibold hover:bg-[#c8e40e] transition-colors`}
            >
              Assign to Athlete
            </button>
          ) : !showPlayButton && (
            <div className="flex items-center justify-between text-sm w-full">
              <span className="text-zinc-500">Click to start</span>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ExerciseCard;
