/**
 * Exercise Instruction Card
 * 
 * Displayed in the Nora Chat when a user starts a writing-based exercise.
 * Shows the exercise prompts as instructions and guides the user to write
 * their responses directly in chat.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Brain, Wind, Eye, Target, Star, Sparkles, PenLine } from 'lucide-react';
import { MentalExercise, ExerciseCategory } from '../../api/firebase/mentaltraining/types';

interface ExerciseInstructionCardProps {
  exercise: MentalExercise;
  onDismiss?: () => void;
}

const getCategoryIcon = (category: ExerciseCategory) => {
  switch (category) {
    case ExerciseCategory.Breathing: return Wind;
    case ExerciseCategory.Visualization: return Eye;
    case ExerciseCategory.Focus: return Target;
    case ExerciseCategory.Mindset: return Brain;
    case ExerciseCategory.Confidence: return Star;
    default: return Brain;
  }
};

const getCategoryColor = (category: ExerciseCategory) => {
  switch (category) {
    case ExerciseCategory.Breathing: return { bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.3)', icon: '#06b6d4' };
    case ExerciseCategory.Visualization: return { bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.3)', icon: '#a855f7' };
    case ExerciseCategory.Focus: return { bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.3)', icon: '#f97316' };
    case ExerciseCategory.Mindset: return { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.3)', icon: '#22c55e' };
    case ExerciseCategory.Confidence: return { bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.3)', icon: '#eab308' };
    default: return { bg: 'rgba(113, 113, 122, 0.15)', border: 'rgba(113, 113, 122, 0.3)', icon: '#71717a' };
  }
};

export const ExerciseInstructionCard: React.FC<ExerciseInstructionCardProps> = ({
  exercise,
  onDismiss,
}) => {
  const CategoryIcon = getCategoryIcon(exercise.category);
  const colors = getCategoryColor(exercise.category);
  
  // Get prompts from exercise config
  const config = exercise.exerciseConfig.config as any;
  const prompts: string[] = Array.isArray(config?.prompts) ? config.prompts.filter(Boolean) : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      className="rounded-2xl overflow-hidden mb-4"
      style={{ 
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
      }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: colors.border }}
          >
            <CategoryIcon className="w-5 h-5" style={{ color: colors.icon }} />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-semibold text-lg">{exercise.name}</h3>
            <p className="text-zinc-400 text-sm">{exercise.description}</p>
          </div>
        </div>

        {/* Exercise Type Badge */}
        <div className="flex items-center gap-2 mb-4">
          <span 
            className="px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5"
            style={{ backgroundColor: colors.border, color: colors.icon }}
          >
            <PenLine className="w-3 h-3" />
            Writing Exercise
          </span>
          <span className="text-zinc-500 text-xs">
            ~{exercise.durationMinutes} min
          </span>
        </div>

        {/* Instructions/Prompts */}
        <div className="space-y-3 mb-4">
          <p className="text-zinc-300 text-sm font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: colors.icon }} />
            Work through each prompt below:
          </p>
          <div className="space-y-2">
            {prompts.map((prompt, index) => (
              <div 
                key={index}
                className="flex gap-3 p-3 rounded-xl bg-white/5 border border-white/10"
              >
                <span 
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ backgroundColor: colors.border, color: colors.icon }}
                >
                  {index + 1}
                </span>
                <p className="text-zinc-200 text-sm leading-relaxed">{prompt}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Call to Action */}
        <div className="p-3 rounded-xl bg-[#E0FE10]/10 border border-[#E0FE10]/20">
          <p className="text-[#E0FE10] text-sm font-medium">
            💡 Write your responses to me below. I'll guide you through each step and give you feedback as you go!
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default ExerciseInstructionCard;
