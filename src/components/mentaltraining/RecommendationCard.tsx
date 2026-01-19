/**
 * RecommendationCard
 * 
 * Displays Nora's exercise recommendation for a coach to review and act on.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  Check,
  X,
  Edit3,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Wind,
  Eye,
  Target,
  Star,
  Route,
} from 'lucide-react';
import {
  MentalRecommendation,
  RecommendationConfidence,
  MentalPathway,
  ExerciseCategory,
} from '../../api/firebase/mentaltraining/types';
import { athleteProgressService } from '../../api/firebase/mentaltraining';

interface RecommendationCardProps {
  recommendation: MentalRecommendation;
  athleteName?: string;
  onAccept: (recommendationId: string) => void;
  onModify: (recommendationId: string) => void;
  onDismiss: (recommendationId: string, reason: string) => void;
  loading?: boolean;
}

const getConfidenceColor = (confidence: RecommendationConfidence) => {
  switch (confidence) {
    case RecommendationConfidence.High:
      return 'text-green-400 bg-green-500/10 border-green-500/30';
    case RecommendationConfidence.Medium:
      return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    case RecommendationConfidence.Low:
      return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30';
  }
};

const getConfidenceText = (confidence: RecommendationConfidence) => {
  switch (confidence) {
    case RecommendationConfidence.High:
      return 'High Confidence';
    case RecommendationConfidence.Medium:
      return 'Medium Confidence';
    case RecommendationConfidence.Low:
      return 'Needs Review';
  }
};

const getCategoryIcon = (category?: ExerciseCategory) => {
  switch (category) {
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

const getCategoryColor = (category?: ExerciseCategory) => {
  switch (category) {
    case ExerciseCategory.Breathing:
      return 'from-cyan-500 to-cyan-600';
    case ExerciseCategory.Visualization:
      return 'from-purple-500 to-purple-600';
    case ExerciseCategory.Focus:
      return 'from-orange-500 to-orange-600';
    case ExerciseCategory.Mindset:
      return 'from-green-500 to-green-600';
    case ExerciseCategory.Confidence:
      return 'from-yellow-500 to-yellow-600';
    default:
      return 'from-zinc-500 to-zinc-600';
  }
};

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  athleteName = 'Athlete',
  onAccept,
  onModify,
  onDismiss,
  loading = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showDismissInput, setShowDismissInput] = useState(false);
  const [dismissReason, setDismissReason] = useState('');

  const pathwayName = athleteProgressService.getPathwayDisplayName(recommendation.pathway);
  const exercise = recommendation.exercise;

  const handleDismiss = () => {
    if (dismissReason.trim()) {
      onDismiss(recommendation.id, dismissReason);
      setShowDismissInput(false);
      setDismissReason('');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-zinc-800/50 border border-zinc-700/50 overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-zinc-700/30">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Nora Avatar */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E0FE10] to-[#a8c40a] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <div>
              <p className="font-medium text-white">Nora recommends for {athleteName}</p>
              <p className="text-sm text-zinc-400">
                {recommendation.pathway === MentalPathway.Foundation
                  ? 'Starting foundation training'
                  : `${pathwayName} • Step ${recommendation.pathwayStep}`}
              </p>
            </div>
          </div>

          {/* Confidence Badge */}
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getConfidenceColor(
              recommendation.confidence
            )}`}
          >
            {getConfidenceText(recommendation.confidence)}
          </span>
        </div>
      </div>

      {/* Exercise Info */}
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Exercise Icon */}
          <div
            className={`w-14 h-14 rounded-xl bg-gradient-to-br ${getCategoryColor(
              exercise?.category
            )} flex items-center justify-center text-white flex-shrink-0`}
          >
            {getCategoryIcon(exercise?.category)}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white">
              {exercise?.name || 'Exercise'}
            </h3>
            <p className="text-sm text-zinc-400 line-clamp-2 mt-1">
              {exercise?.description || 'Mental training exercise'}
            </p>

            {/* Duration and Difficulty */}
            {exercise && (
              <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                <span>{exercise.durationMinutes} min</span>
                <span>•</span>
                <span className="capitalize">{exercise.difficulty}</span>
                <span>•</span>
                <span className="capitalize">{exercise.category}</span>
              </div>
            )}
          </div>
        </div>

        {/* Reasoning (Expandable) */}
        <div className="mt-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <Route className="w-4 h-4" />
            <span>Why this exercise?</span>
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-3 p-3 rounded-xl bg-zinc-700/30 border border-zinc-700/50"
            >
              <p className="text-sm text-zinc-300 leading-relaxed">
                {recommendation.reason}
              </p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4">
        {showDismissInput ? (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Why are you dismissing this? (helps Nora learn)"
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-700/50 border border-zinc-600 text-white placeholder-zinc-500 text-sm focus:border-[#E0FE10] focus:outline-none"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDismissInput(false);
                  setDismissReason('');
                }}
                className="flex-1 px-4 py-2 rounded-xl bg-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDismiss}
                disabled={!dismissReason.trim()}
                className="flex-1 px-4 py-2 rounded-xl bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => onAccept(recommendation.id)}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#E0FE10] text-black font-medium hover:bg-[#c8e40e] transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              Assign Now
            </button>
            <button
              onClick={() => onModify(recommendation.id)}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-700 text-white font-medium hover:bg-zinc-600 transition-colors disabled:opacity-50"
            >
              <Edit3 className="w-4 h-4" />
              Modify
            </button>
            <button
              onClick={() => setShowDismissInput(true)}
              disabled={loading}
              className="flex items-center justify-center px-3 py-2.5 rounded-xl bg-zinc-700/50 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default RecommendationCard;
