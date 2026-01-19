/**
 * BaselineAssessmentModal
 * 
 * 5-minute mental training assessment for new athletes.
 * Determines initial MPR score and recommended pathway.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Brain,
  Zap,
  Target,
  Star,
  Heart,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import {
  BaselineAssessment,
  BiggestChallenge,
  MentalPathway,
} from '../../api/firebase/mentaltraining/types';
import { athleteProgressService } from '../../api/firebase/mentaltraining';

interface BaselineAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  athleteId: string;
  athleteName?: string;
  onComplete: (progress: any) => void;
}

interface Question {
  id: string;
  section: number;
  question: string;
  description?: string;
  type: 'single' | 'scale' | 'multi-scale';
  options?: { value: string; label: string; description?: string }[];
  scales?: { id: string; label: string }[];
}

const questions: Question[] = [
  // Section 1: Current Mental Training
  {
    id: 'mentalTrainingExperience',
    section: 1,
    question: 'What is your experience with mental training?',
    type: 'single',
    options: [
      { value: 'never', label: 'Never tried it', description: 'I haven\'t done any mental training' },
      { value: 'self_tried', label: 'Self-taught', description: 'I\'ve tried apps or books on my own' },
      { value: 'worked_with_professional', label: 'Worked with a professional', description: 'I\'ve worked with a sport psychologist or mental coach' },
      { value: 'consistent_6_months', label: 'Consistent practice (6+ months)', description: 'I\'ve practiced regularly for at least 6 months' },
    ],
  },
  {
    id: 'currentPracticeFrequency',
    section: 1,
    question: 'How often do you currently practice mental skills?',
    type: 'single',
    options: [
      { value: 'never', label: 'Never', description: 'I don\'t practice mental skills' },
      { value: 'occasionally_when_stressed', label: 'Occasionally when stressed', description: 'Only when I\'m feeling anxious or struggling' },
      { value: 'weekly', label: 'Weekly', description: 'At least once a week' },
      { value: 'daily', label: 'Daily', description: 'Part of my daily routine' },
    ],
  },
  // Section 2: Self-Assessment by Domain
  {
    id: 'domainRatings',
    section: 2,
    question: 'Rate yourself in each mental skill area',
    description: 'Be honest - this helps us customize your training',
    type: 'multi-scale',
    scales: [
      { id: 'arousalControlRating', label: 'Arousal Control (managing energy/anxiety)' },
      { id: 'focusRating', label: 'Focus (concentration during competition)' },
      { id: 'confidenceRating', label: 'Confidence (belief in abilities)' },
      { id: 'visualizationRating', label: 'Visualization (mental imagery)' },
      { id: 'resilienceRating', label: 'Resilience (bouncing back from setbacks)' },
    ],
  },
  // Section 3: Pressure Response
  {
    id: 'pressureResponse',
    section: 3,
    question: 'How do you typically perform under pressure?',
    type: 'single',
    options: [
      { value: 'freeze_perform_worse', label: 'I freeze or perform worse', description: 'Pressure causes me to underperform' },
      { value: 'anxious_push_through', label: 'Anxious but push through', description: 'I feel nervous but can usually manage' },
      { value: 'same_as_training', label: 'Same as training', description: 'My performance stays consistent' },
      { value: 'rise_to_occasion', label: 'Rise to the occasion', description: 'I perform better under pressure' },
    ],
  },
  {
    id: 'setbackRecovery',
    section: 3,
    question: 'How quickly do you recover from mistakes or setbacks?',
    type: 'single',
    options: [
      { value: 'dwell_for_days', label: 'Dwell for days', description: 'Mistakes stay with me for a long time' },
      { value: 'struggle_same_day', label: 'Struggle same day', description: 'It affects the rest of my performance that day' },
      { value: 'move_on_after_time', label: 'Move on after some time', description: 'Takes a few moments but I can refocus' },
      { value: 'let_go_immediately', label: 'Let go immediately', description: 'I can quickly move past mistakes' },
    ],
  },
  // Section 4: Goals
  {
    id: 'biggestChallenge',
    section: 4,
    question: 'What is your biggest mental challenge?',
    description: 'This determines your specialized training pathway',
    type: 'single',
    options: [
      { value: 'pre_competition_anxiety', label: 'Pre-competition anxiety', description: 'I get too nervous before competing' },
      { value: 'focus_during_competition', label: 'Focus during competition', description: 'My mind wanders during performance' },
      { value: 'confidence_in_abilities', label: 'Confidence in my abilities', description: 'I doubt myself or my preparation' },
      { value: 'bouncing_back_from_setbacks', label: 'Bouncing back from setbacks', description: 'Mistakes or losses affect me too much' },
      { value: 'performing_under_pressure', label: 'Performing under pressure', description: 'I underperform when it matters most' },
      { value: 'other', label: 'Other', description: 'Something else not listed' },
    ],
  },
];

const sectionTitles: Record<number, string> = {
  1: 'Current Experience',
  2: 'Self-Assessment',
  3: 'Pressure Response',
  4: 'Your Goals',
};

export const BaselineAssessmentModal: React.FC<BaselineAssessmentModalProps> = ({
  isOpen,
  onClose,
  athleteId,
  athleteName = 'Athlete',
  onComplete,
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({
    // Initialize scale ratings with defaults
    arousalControlRating: 3,
    focusRating: 3,
    confidenceRating: 3,
    visualizationRating: 3,
    resilienceRating: 3,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  const canProceed = () => {
    if (currentQuestion.type === 'multi-scale') {
      // All scales should have values (they start with defaults)
      return true;
    }
    return answers[currentQuestion.id] !== undefined;
  };

  const handleAnswer = (questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleNext = async () => {
    if (!canProceed()) return;

    if (isLastQuestion) {
      await handleSubmit();
    } else {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const assessment: Omit<BaselineAssessment, 'completedAt'> = {
        mentalTrainingExperience: answers.mentalTrainingExperience,
        currentPracticeFrequency: answers.currentPracticeFrequency,
        arousalControlRating: answers.arousalControlRating,
        focusRating: answers.focusRating,
        confidenceRating: answers.confidenceRating,
        visualizationRating: answers.visualizationRating,
        resilienceRating: answers.resilienceRating,
        pressureResponse: answers.pressureResponse,
        setbackRecovery: answers.setbackRecovery,
        biggestChallenge: answers.biggestChallenge,
        biggestChallengeOther: answers.biggestChallengeOther,
      };

      const progress = await athleteProgressService.saveBaselineAssessment(athleteId, assessment);
      onComplete(progress);
      onClose();
    } catch (err) {
      console.error('Error saving assessment:', err);
      setError('Failed to save assessment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-zinc-900 rounded-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E0FE10] to-[#a8c40a] flex items-center justify-center">
                <Brain className="w-5 h-5 text-black" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Mental Training Assessment</h2>
                <p className="text-sm text-zinc-400">~5 minutes • Personalize your training</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              animate={{ width: `${progress}%` }}
              className="h-full bg-gradient-to-r from-[#E0FE10] to-[#c8e40e]"
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-zinc-500">
            <span>Section {currentQuestion.section}: {sectionTitles[currentQuestion.section]}</span>
            <span>{currentQuestionIndex + 1} of {questions.length}</span>
          </div>
        </div>

        {/* Question Content */}
        <div className="p-6 min-h-[400px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h3 className="text-xl font-semibold text-white mb-2">
                {currentQuestion.question}
              </h3>
              {currentQuestion.description && (
                <p className="text-zinc-400 mb-6">{currentQuestion.description}</p>
              )}

              {/* Single Choice */}
              {currentQuestion.type === 'single' && currentQuestion.options && (
                <div className="space-y-3">
                  {currentQuestion.options.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleAnswer(currentQuestion.id, option.value)}
                      className={`w-full p-4 rounded-xl text-left transition-all ${
                        answers[currentQuestion.id] === option.value
                          ? 'bg-[#E0FE10]/10 border-2 border-[#E0FE10]'
                          : 'bg-zinc-800 border-2 border-transparent hover:bg-zinc-700'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            answers[currentQuestion.id] === option.value
                              ? 'border-[#E0FE10] bg-[#E0FE10]'
                              : 'border-zinc-600'
                          }`}
                        >
                          {answers[currentQuestion.id] === option.value && (
                            <CheckCircle className="w-3 h-3 text-black" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-white">{option.label}</p>
                          {option.description && (
                            <p className="text-sm text-zinc-400 mt-1">{option.description}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Multi-Scale (Domain Ratings) */}
              {currentQuestion.type === 'multi-scale' && currentQuestion.scales && (
                <div className="space-y-6">
                  {currentQuestion.scales.map((scale) => (
                    <div key={scale.id} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-white font-medium">{scale.label}</span>
                        <span className="text-[#E0FE10] font-bold">{answers[scale.id]}/5</span>
                      </div>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <button
                            key={value}
                            onClick={() => handleAnswer(scale.id, value)}
                            className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all ${
                              answers[scale.id] === value
                                ? 'bg-[#E0FE10] text-black'
                                : answers[scale.id] > value
                                ? 'bg-[#E0FE10]/30 text-white'
                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                            }`}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                      <div className="flex justify-between text-xs text-zinc-500">
                        <span>Needs work</span>
                        <span>Excellent</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Other text input for biggestChallenge */}
              {currentQuestion.id === 'biggestChallenge' && answers.biggestChallenge === 'other' && (
                <div className="mt-4">
                  <input
                    type="text"
                    placeholder="Describe your challenge..."
                    value={answers.biggestChallengeOther || ''}
                    onChange={(e) => handleAnswer('biggestChallengeOther', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-[#E0FE10] focus:outline-none"
                  />
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-800 flex justify-between">
          <button
            onClick={handleBack}
            disabled={currentQuestionIndex === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-zinc-400 hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <button
            onClick={handleNext}
            disabled={!canProceed() || submitting}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-semibold transition-colors ${
              canProceed() && !submitting
                ? 'bg-[#E0FE10] text-black hover:bg-[#c8e40e]'
                : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
            }`}
          >
            {submitting ? (
              'Saving...'
            ) : isLastQuestion ? (
              <>
                Complete
                <CheckCircle className="w-4 h-4" />
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default BaselineAssessmentModal;
