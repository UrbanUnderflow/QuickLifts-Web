/**
 * Mental Training Page (Athlete View)
 * 
 * Main page for athletes to:
 * - View assigned exercises
 * - Browse exercise library
 * - Track their progress
 * - Complete exercises
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Wind,
  Eye,
  Target,
  Star,
  Flame,
  Clock,
  CheckCircle,
  ChevronRight,
  Calendar,
  Filter,
  Award,
} from 'lucide-react';
import { useUser } from '../hooks/useUser';
import Head from 'next/head';
import SideNav from '../components/Navigation/SideNav';
import {
  exerciseLibraryService,
  assignmentService,
  completionService,
  MentalExercise,
  ExerciseAssignment,
  ExerciseCompletion,
  MentalTrainingStreak,
  ExerciseCategory,
  AssignmentStatus,
} from '../api/firebase/mentaltraining';
import { ExerciseCard, ExercisePlayer, MentalProgressCard } from '../components/mentaltraining';

type TabType = 'today' | 'library' | 'history';

const MentalTrainingPage: React.FC = () => {
  const currentUser = useUser();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('today');
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | 'all'>('all');

  // Data
  const [exercises, setExercises] = useState<MentalExercise[]>([]);
  const [assignments, setAssignments] = useState<ExerciseAssignment[]>([]);
  const [completions, setCompletions] = useState<ExerciseCompletion[]>([]);
  const [streak, setStreak] = useState<MentalTrainingStreak | null>(null);
  const [averageReadiness, setAverageReadiness] = useState<{ average: number; trend: 'up' | 'down' | 'stable' } | undefined>();

  // Exercise player
  const [selectedExercise, setSelectedExercise] = useState<MentalExercise | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | undefined>();

  // Load data
  useEffect(() => {
    const loadData = async () => {
      if (!currentUser?.id) return;

      setLoading(true);
      try {
        const [exerciseData, progressData] = await Promise.all([
          exerciseLibraryService.getAll(),
          completionService.getProgressSummary(currentUser.id),
        ]);

        setExercises(exerciseData);
        setStreak(progressData.streak);
        setCompletions(progressData.recentCompletions);
        setAverageReadiness(progressData.averageReadiness);

        // Load assignments separately
        const assignmentData = await assignmentService.getPendingForAthlete(currentUser.id);
        setAssignments(assignmentData);

      } catch (err) {
        console.error('Failed to load mental training data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser?.id]);

  // Filter exercises by category
  const filteredExercises = exercises.filter(
    ex => selectedCategory === 'all' || ex.category === selectedCategory
  );

  // Today's exercises (assigned + quick suggestions)
  const todaysExercises = assignments.filter(
    a => a.status === AssignmentStatus.Pending || a.status === AssignmentStatus.InProgress
  );

  const handleStartExercise = (exercise: MentalExercise, assignmentId?: string) => {
    setSelectedExercise(exercise);
    setSelectedAssignmentId(assignmentId);
  };

  const handleExerciseComplete = async (data: {
    durationSeconds: number;
    preExerciseMood?: number;
    postExerciseMood?: number;
    difficultyRating?: number;
    helpfulnessRating?: number;
    notes?: string;
  }) => {
    if (!selectedExercise || !currentUser?.id) return;

    try {
      await completionService.recordCompletion({
        userId: currentUser.id,
        exerciseId: selectedExercise.id,
        exerciseName: selectedExercise.name,
        exerciseCategory: selectedExercise.category,
        assignmentId: selectedAssignmentId,
        ...data,
      });

      // Refresh data
      const [newStreak, newCompletions] = await Promise.all([
        completionService.getStreak(currentUser.id),
        completionService.getCompletions(currentUser.id, 10),
      ]);

      setStreak(newStreak);
      setCompletions(newCompletions);

      // Remove from assignments if applicable
      if (selectedAssignmentId) {
        setAssignments(prev => prev.filter(a => a.id !== selectedAssignmentId));
      }

    } catch (err) {
      console.error('Failed to record completion:', err);
    }

    setSelectedExercise(null);
    setSelectedAssignmentId(undefined);
  };

  const getCategoryIcon = (category: ExerciseCategory) => {
    switch (category) {
      case ExerciseCategory.Breathing: return <Wind className="w-5 h-5" />;
      case ExerciseCategory.Visualization: return <Eye className="w-5 h-5" />;
      case ExerciseCategory.Focus: return <Target className="w-5 h-5" />;
      case ExerciseCategory.Mindset: return <Brain className="w-5 h-5" />;
      case ExerciseCategory.Confidence: return <Star className="w-5 h-5" />;
    }
  };

  const getCategoryLabel = (category: ExerciseCategory) => {
    switch (category) {
      case ExerciseCategory.Breathing:
        return 'Breath Work';
      default:
        return category.charAt(0).toUpperCase() + category.slice(1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0f]">
        <SideNav />
        <Head><title>Mental Training | Nora</title></Head>
        <div className="lg:pl-64 min-h-screen flex items-center justify-center">
          <div className="text-zinc-400">Loading your mental training...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d0f]">
      <SideNav />
      <Head><title>Mental Training | Nora</title></Head>

      <main className="lg:pl-64 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
              <Brain className="w-8 h-8 text-[#E0FE10]" />
              Mental Training
            </h1>
            <p className="text-zinc-400">
              Train your mind like you train your body
            </p>
          </div>

          {/* Progress Card */}
          {streak && (
            <div className="mb-8">
              <MentalProgressCard
                streak={streak}
                averageReadiness={averageReadiness}
                compact
              />
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-zinc-800 pb-3">
            {(['today', 'library', 'history'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? 'bg-[#E0FE10] text-black'
                    : 'text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                {tab === 'today' ? "Today's Training" : tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {activeTab === 'today' && (
              <motion.div
                key="today"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {/* Assigned Exercises */}
                {todaysExercises.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-[#E0FE10]" />
                      Assigned to You
                    </h2>
                    <div className="space-y-3">
                      {todaysExercises.map((assignment) => (
                        <div
                          key={assignment.id}
                          onClick={() => assignment.exercise && handleStartExercise(assignment.exercise, assignment.id)}
                          className="flex items-center gap-4 p-4 rounded-xl bg-zinc-800/50 border border-[#E0FE10]/30 cursor-pointer hover:border-[#E0FE10]/50 transition-colors"
                        >
                          <div className="p-3 rounded-xl bg-[#E0FE10]/10">
                            {assignment.exercise && getCategoryIcon(assignment.exercise.category)}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-white">
                              {assignment.exercise?.name || 'Exercise'}
                            </p>
                            <p className="text-sm text-zinc-400">
                              {assignment.assignedByName && `From ${assignment.assignedByName} • `}
                              {assignment.exercise?.durationMinutes} min
                            </p>
                            {assignment.reason && (
                              <p className="text-sm text-[#E0FE10] mt-1">
                                &ldquo;{assignment.reason}&rdquo;
                              </p>
                            )}
                          </div>
                          <ChevronRight className="w-5 h-5 text-zinc-500" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Start */}
                <div>
                  <h2 className="text-lg font-semibold text-white mb-4">
                    Quick Start
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {exercises.slice(0, 4).map((exercise) => (
                      <motion.div
                        key={exercise.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleStartExercise(exercise)}
                        className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50 cursor-pointer hover:border-zinc-600 transition-colors"
                      >
                        <div className="mb-3 text-zinc-400">
                          {getCategoryIcon(exercise.category)}
                        </div>
                        <p className="font-medium text-white text-sm mb-1">{exercise.name}</p>
                        <p className="text-xs text-zinc-500">{exercise.durationMinutes} min</p>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Empty state */}
                {todaysExercises.length === 0 && (
                  <div className="text-center py-12 mt-8">
                    <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                    <p className="text-white font-medium mb-2">All caught up!</p>
                    <p className="text-zinc-400">
                      No assigned exercises right now. Browse the library to train on your own.
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'library' && (
              <motion.div
                key="library"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {/* Category filter */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      selectedCategory === 'all'
                        ? 'bg-[#E0FE10] text-black'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    All
                  </button>
                  {Object.values(ExerciseCategory).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                        selectedCategory === cat
                          ? 'bg-[#E0FE10] text-black'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {getCategoryIcon(cat)}
                      <span>{getCategoryLabel(cat)}</span>
                    </button>
                  ))}
                </div>

                {/* Exercise grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredExercises.map((exercise) => (
                    <ExerciseCard
                      key={exercise.id}
                      exercise={exercise}
                      onClick={() => handleStartExercise(exercise)}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {completions.length === 0 ? (
                  <div className="text-center py-12">
                    <Award className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                    <p className="text-white font-medium mb-2">No exercises completed yet</p>
                    <p className="text-zinc-400">
                      Complete your first exercise to start building your history.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {completions.map((completion) => (
                      <div
                        key={completion.id}
                        className="flex items-center gap-4 p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50"
                      >
                        <div className="p-2.5 rounded-xl bg-green-500/10">
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-white">
                            {completion.exerciseName}
                          </p>
                          <p className="text-sm text-zinc-400">
                            {Math.round(completion.durationSeconds / 60)} min • {completion.exerciseCategory}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-zinc-400">
                            {new Date(completion.completedAt).toLocaleDateString()}
                          </p>
                          {completion.helpfulnessRating && (
                            <p className="text-xs text-zinc-500">
                              Rated {completion.helpfulnessRating}/5
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Exercise Player Modal */}
      <AnimatePresence>
        {selectedExercise && (
          <ExercisePlayer
            exercise={selectedExercise}
            assignmentId={selectedAssignmentId}
            onComplete={handleExerciseComplete}
            onClose={() => {
              setSelectedExercise(null);
              setSelectedAssignmentId(undefined);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default MentalTrainingPage;
