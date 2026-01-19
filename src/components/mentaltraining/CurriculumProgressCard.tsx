/**
 * CurriculumProgressCard
 * 
 * Displays an athlete's curriculum assignment progress.
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  Clock,
  CheckCircle,
  AlertCircle,
  Flame,
  TrendingUp,
  Calendar,
  ChevronRight,
  Wind,
  Eye,
  Target,
  Star,
  Pause,
} from 'lucide-react';
import {
  CurriculumAssignment,
  CurriculumAssignmentStatus,
  ExerciseCategory,
  AthleteMentalProgress,
  MentalPathway,
} from '../../api/firebase/mentaltraining/types';
import { athleteProgressService } from '../../api/firebase/mentaltraining';

interface CurriculumProgressCardProps {
  assignment: CurriculumAssignment;
  athleteProgress?: AthleteMentalProgress;
  athleteName?: string;
  onClick?: () => void;
}

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

const getStatusInfo = (assignment: CurriculumAssignment) => {
  const { status, completionRate, currentDayNumber, targetDays } = assignment;

  switch (status) {
    case CurriculumAssignmentStatus.Active:
      if (completionRate >= 80) {
        return {
          icon: <TrendingUp className="w-4 h-4" />,
          text: 'On Track',
          color: 'text-green-400',
          bgColor: 'bg-green-500/10',
        };
      } else if (completionRate >= 50) {
        return {
          icon: <Clock className="w-4 h-4" />,
          text: 'In Progress',
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-500/10',
        };
      } else {
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          text: 'Needs Attention',
          color: 'text-orange-400',
          bgColor: 'bg-orange-500/10',
        };
      }
    case CurriculumAssignmentStatus.Extended:
      return {
        icon: <Clock className="w-4 h-4" />,
        text: 'Extended',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/10',
      };
    case CurriculumAssignmentStatus.Completed:
      return {
        icon: assignment.masteryAchieved ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />,
        text: assignment.masteryAchieved ? 'Mastered' : 'Completed',
        color: assignment.masteryAchieved ? 'text-green-400' : 'text-zinc-400',
        bgColor: assignment.masteryAchieved ? 'bg-green-500/10' : 'bg-zinc-500/10',
      };
    case CurriculumAssignmentStatus.Paused:
      return {
        icon: <Pause className="w-4 h-4" />,
        text: 'Paused',
        color: 'text-zinc-400',
        bgColor: 'bg-zinc-500/10',
      };
    default:
      return {
        icon: <Clock className="w-4 h-4" />,
        text: 'Unknown',
        color: 'text-zinc-400',
        bgColor: 'bg-zinc-500/10',
      };
  }
};

export const CurriculumProgressCard: React.FC<CurriculumProgressCardProps> = ({
  assignment,
  athleteProgress,
  athleteName = 'Athlete',
  onClick,
}) => {
  const statusInfo = getStatusInfo(assignment);
  const exercise = assignment.exercise;
  const pathwayName = athleteProgressService.getPathwayDisplayName(assignment.pathway);
  const mprInfo = athleteProgress 
    ? athleteProgressService.getMPRDescription(athleteProgress.mprScore)
    : null;

  // Calculate progress bar width
  const progressWidth = Math.min(100, assignment.completionRate);

  // Calculate days remaining
  const now = Date.now();
  const daysRemaining = Math.max(0, Math.ceil((assignment.endDate - now) / (1000 * 60 * 60 * 24)));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClick}
      className={`rounded-xl bg-zinc-800/50 border border-zinc-700/50 overflow-hidden ${
        onClick ? 'cursor-pointer hover:border-zinc-600 transition-colors' : ''
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-zinc-700/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Exercise Icon */}
            <div
              className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getCategoryColor(
                exercise?.category
              )} flex items-center justify-center text-white`}
            >
              {getCategoryIcon(exercise?.category)}
            </div>
            <div>
              <p className="font-medium text-white">{athleteName}</p>
              <p className="text-sm text-zinc-400">{exercise?.name || 'Exercise'}</p>
            </div>
          </div>

          {/* Status Badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${statusInfo.bgColor}`}>
            <span className={statusInfo.color}>{statusInfo.icon}</span>
            <span className={`text-xs font-medium ${statusInfo.color}`}>{statusInfo.text}</span>
          </div>
        </div>
      </div>

      {/* Progress Section */}
      <div className="p-4">
        {/* Day Progress */}
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-zinc-400">Day {assignment.currentDayNumber} of {assignment.targetDays}</span>
          <span className="text-white font-medium">{assignment.completionRate}% Complete</span>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-zinc-700/50 rounded-full overflow-hidden mb-4">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressWidth}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`h-full rounded-full ${
              assignment.completionRate >= 80
                ? 'bg-gradient-to-r from-green-500 to-green-400'
                : assignment.completionRate >= 50
                ? 'bg-gradient-to-r from-yellow-500 to-yellow-400'
                : 'bg-gradient-to-r from-orange-500 to-orange-400'
            }`}
          />
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-zinc-700/30">
            <div className="flex items-center justify-center gap-1 text-zinc-400 mb-1">
              <CheckCircle className="w-3.5 h-3.5" />
            </div>
            <p className="text-lg font-bold text-white">{assignment.completedDays}</p>
            <p className="text-xs text-zinc-500">Days Done</p>
          </div>

          <div className="text-center p-2 rounded-lg bg-zinc-700/30">
            <div className="flex items-center justify-center gap-1 text-zinc-400 mb-1">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <p className="text-lg font-bold text-white">{daysRemaining}</p>
            <p className="text-xs text-zinc-500">Days Left</p>
          </div>

          <div className="text-center p-2 rounded-lg bg-zinc-700/30">
            <div className="flex items-center justify-center gap-1 text-zinc-400 mb-1">
              <Flame className="w-3.5 h-3.5" />
            </div>
            <p className="text-lg font-bold text-white">{athleteProgress?.currentStreak || 0}</p>
            <p className="text-xs text-zinc-500">Streak</p>
          </div>
        </div>

        {/* Pathway Info */}
        {assignment.pathway !== MentalPathway.Foundation && (
          <div className="mt-3 pt-3 border-t border-zinc-700/30 flex items-center justify-between">
            <div className="text-sm">
              <span className="text-zinc-500">Pathway: </span>
              <span className="text-zinc-300">{pathwayName}</span>
              <span className="text-zinc-500"> • Step {assignment.pathwayStep}</span>
            </div>
            {mprInfo && (
              <div className="text-sm">
                <span className="text-zinc-500">MPR: </span>
                <span className="text-white font-medium">{athleteProgress?.mprScore}</span>
              </div>
            )}
          </div>
        )}

        {/* Coach Note */}
        {assignment.coachNote && (
          <div className="mt-3 pt-3 border-t border-zinc-700/30">
            <p className="text-xs text-zinc-500 mb-1">Coach Note</p>
            <p className="text-sm text-zinc-300 italic">"{assignment.coachNote}"</p>
          </div>
        )}
      </div>

      {/* Action Footer */}
      {onClick && (
        <div className="px-4 py-3 bg-zinc-700/20 border-t border-zinc-700/30 flex items-center justify-between">
          <span className="text-sm text-zinc-400">View Details</span>
          <ChevronRight className="w-4 h-4 text-zinc-500" />
        </div>
      )}
    </motion.div>
  );
};

export default CurriculumProgressCard;
