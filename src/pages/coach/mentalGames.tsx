/**
 * Coach Mental Training Page
 * 
 * Dashboard for coaches to manage mental training for their athletes.
 * - View connected athletes and their mental training progress
 * - Assign exercises to individuals or groups
 * - Track assignment completion rates
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import {
  Brain,
  Users,
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Wind,
  Eye,
  Target,
  Star,
  Flame,
  BarChart3,
} from 'lucide-react';
import { useUser } from '../../hooks/useUser';
import { coachService } from '../../api/firebase/coach';
import { CoachModel } from '../../types/Coach';
import {
  exerciseLibraryService,
  assignmentService,
  completionService,
  MentalExercise,
  ExerciseAssignment,
  ExerciseCategory,
  AssignmentStatus,
  MentalTrainingStreak,
} from '../../api/firebase/mentaltraining';
import CoachLayout from '../../components/CoachLayout';
import Head from 'next/head';
import { ExerciseCard, AssignExerciseModal, MentalProgressCard, ExercisePlayer } from '../../components/mentaltraining';

interface AthleteWithProgress {
  id: string;
  displayName?: string;
  username?: string;
  email?: string;
  profileImageURL?: string;
  streak?: MentalTrainingStreak;
  pendingAssignments: number;
  completedThisWeek: number;
}

const CoachMentalTraining: React.FC = () => {
  const router = useRouter();
  const currentUser = useUser();
  
  const [coachProfile, setCoachProfile] = useState<CoachModel | null>(null);
  const [athletes, setAthletes] = useState<AthleteWithProgress[]>([]);
  const [exercises, setExercises] = useState<MentalExercise[]>([]);
  const [recentAssignments, setRecentAssignments] = useState<ExerciseAssignment[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<'athletes' | 'exercises' | 'assignments'>('athletes');
  const [playingExercise, setPlayingExercise] = useState<MentalExercise | null>(null);

  // Load coach profile and data
  useEffect(() => {
    const loadData = async () => {
      if (!currentUser?.id) return;
      
      setLoading(true);
      try {
        // Get coach profile
        const profile = await coachService.getCoachProfile(currentUser.id);
        setCoachProfile(profile);

        if (profile) {
          // Get connected athletes
          const connectedAthletes = await coachService.getConnectedAthletes(profile.id);
          
          // Load progress for each athlete
          const athletesWithProgress: AthleteWithProgress[] = await Promise.all(
            connectedAthletes.map(async (athlete: any) => {
              try {
                const [streak, assignments] = await Promise.all([
                  completionService.getStreak(athlete.id),
                  assignmentService.getForAthleteByCoach(athlete.id, profile.id),
                ]);
                
                const pending = assignments.filter(
                  a => a.status === AssignmentStatus.Pending || a.status === AssignmentStatus.InProgress
                ).length;
                
                const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                const completedThisWeek = assignments.filter(
                  a => a.status === AssignmentStatus.Completed && a.completedAt && a.completedAt > weekAgo
                ).length;

                return {
                  id: athlete.id || athlete.userId,
                  displayName: athlete.displayName,
                  username: athlete.username,
                  email: athlete.email,
                  profileImageURL: athlete.profileImage?.profileImageURL || athlete.profileImageURL,
                  streak,
                  pendingAssignments: pending,
                  completedThisWeek,
                };
              } catch (err) {
                return {
                  id: athlete.id || athlete.userId,
                  displayName: athlete.displayName,
                  username: athlete.username,
                  email: athlete.email,
                  profileImageURL: athlete.profileImage?.profileImageURL || athlete.profileImageURL,
                  pendingAssignments: 0,
                  completedThisWeek: 0,
                };
              }
            })
          );
          
          setAthletes(athletesWithProgress);

          // Get recent assignments by this coach
          const assignments = await assignmentService.getByCoach(profile.id);
          setRecentAssignments(assignments.slice(0, 20));
        }

        // Load exercise library
        const exerciseData = await exerciseLibraryService.getAll();
        setExercises(exerciseData);

      } catch (err) {
        console.error('Failed to load coach data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser?.id]);

  // Filter athletes
  const filteredAthletes = athletes.filter(
    a =>
      (a.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.email?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Stats
  const totalAthletes = athletes.length;
  const totalPending = athletes.reduce((sum, a) => sum + a.pendingAssignments, 0);
  const totalCompletedThisWeek = athletes.reduce((sum, a) => sum + a.completedThisWeek, 0);
  const activeStreaks = athletes.filter(a => a.streak && a.streak.currentStreak > 0).length;

  const handleAssignToAthlete = (athleteId: string) => {
    setSelectedAthleteId(athleteId);
    setShowAssignModal(true);
  };

  const handleAssignToAll = () => {
    setSelectedAthleteId(undefined);
    setShowAssignModal(true);
  };

  const getCategoryIcon = (category: ExerciseCategory) => {
    switch (category) {
      case ExerciseCategory.Breathing: return <Wind className="w-4 h-4" />;
      case ExerciseCategory.Visualization: return <Eye className="w-4 h-4" />;
      case ExerciseCategory.Focus: return <Target className="w-4 h-4" />;
      case ExerciseCategory.Mindset: return <Brain className="w-4 h-4" />;
      case ExerciseCategory.Confidence: return <Star className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: AssignmentStatus) => {
    switch (status) {
      case AssignmentStatus.Completed: return 'text-green-400 bg-green-500/10';
      case AssignmentStatus.InProgress: return 'text-blue-400 bg-blue-500/10';
      case AssignmentStatus.Pending: return 'text-yellow-400 bg-yellow-500/10';
      case AssignmentStatus.Skipped: return 'text-zinc-400 bg-zinc-500/10';
      case AssignmentStatus.Expired: return 'text-red-400 bg-red-500/10';
      default: return 'text-zinc-400 bg-zinc-500/10';
    }
  };

  if (loading) {
    return (
      <CoachLayout>
        <Head><title>Mental Training | Coach Dashboard</title></Head>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-zinc-400">Loading mental training dashboard...</div>
        </div>
      </CoachLayout>
    );
  }

  return (
    <CoachLayout>
      <Head><title>Mental Training | Coach Dashboard</title></Head>
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Brain className="w-8 h-8 text-[#E0FE10]" />
              Mental Training
            </h1>
            <p className="text-zinc-400 mt-1">
              Help your athletes build mental strength with Nora
            </p>
          </div>
          
          <button
            onClick={handleAssignToAll}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#E0FE10] text-black font-semibold hover:bg-[#c8e40e] transition-colors"
          >
            <Plus className="w-5 h-5" />
            Assign Exercise
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-xl bg-zinc-800/50 border border-zinc-700/50"
          >
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-zinc-400">Athletes</span>
            </div>
            <p className="text-3xl font-bold text-white">{totalAthletes}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-5 rounded-xl bg-zinc-800/50 border border-zinc-700/50"
          >
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              <span className="text-sm text-zinc-400">Pending</span>
            </div>
            <p className="text-3xl font-bold text-white">{totalPending}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-5 rounded-xl bg-zinc-800/50 border border-zinc-700/50"
          >
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-sm text-zinc-400">Completed This Week</span>
            </div>
            <p className="text-3xl font-bold text-white">{totalCompletedThisWeek}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-5 rounded-xl bg-zinc-800/50 border border-zinc-700/50"
          >
            <div className="flex items-center gap-3 mb-2">
              <Flame className="w-5 h-5 text-orange-400" />
              <span className="text-sm text-zinc-400">Active Streaks</span>
            </div>
            <p className="text-3xl font-bold text-white">{activeStreaks}</p>
          </motion.div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-zinc-700/50 pb-2">
          {(['athletes', 'exercises', 'assignments'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'bg-[#E0FE10] text-black'
                  : 'text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'athletes' && (
          <div>
            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search athletes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-[#E0FE10] focus:outline-none"
              />
            </div>

            {/* Athletes List */}
            {filteredAthletes.length === 0 ? (
              <div className="text-center py-16 text-zinc-400">
                {athletes.length === 0 ? 'No athletes connected yet' : 'No athletes match your search'}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAthletes.map((athlete) => (
                  <motion.div
                    key={athlete.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-4 p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600 transition-colors"
                  >
                    {/* Avatar */}
                    {athlete.profileImageURL ? (
                      <img
                        src={athlete.profileImageURL}
                        alt=""
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center">
                        <span className="text-white font-medium text-lg">
                          {(athlete.displayName || athlete.username || 'A')[0].toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">
                        {athlete.displayName || athlete.username || 'Unknown'}
                      </p>
                      <div className="flex items-center gap-4 mt-1 text-sm">
                        {athlete.streak && athlete.streak.currentStreak > 0 && (
                          <span className="flex items-center gap-1 text-orange-400">
                            <Flame className="w-4 h-4" />
                            {athlete.streak.currentStreak} day streak
                          </span>
                        )}
                        {athlete.pendingAssignments > 0 && (
                          <span className="flex items-center gap-1 text-yellow-400">
                            <Clock className="w-4 h-4" />
                            {athlete.pendingAssignments} pending
                          </span>
                        )}
                        {athlete.completedThisWeek > 0 && (
                          <span className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="w-4 h-4" />
                            {athlete.completedThisWeek} this week
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <button
                      onClick={() => handleAssignToAthlete(athlete.id)}
                      className="px-4 py-2 rounded-lg bg-[#E0FE10] text-black font-medium hover:bg-[#c8e40e] transition-colors"
                    >
                      Assign
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'exercises' && (
          <div>
            <p className="text-zinc-400 mb-6">
              Browse the exercise library and assign exercises to your athletes.
            </p>
            
            {exercises.length === 0 ? (
              <div className="text-center py-16">
                <Brain className="w-16 h-16 mx-auto mb-4 text-zinc-600" />
                <p className="text-zinc-400 mb-6">
                  Exercise library is empty. Seed the default exercises to get started.
                </p>
                <button
                  onClick={async () => {
                    try {
                      const result = await exerciseLibraryService.seedExercises();
                      alert(`Seeded ${result.created} exercises! (${result.skipped} already existed)`);
                      // Reload exercises
                      const exerciseData = await exerciseLibraryService.getAll();
                      setExercises(exerciseData);
                    } catch (err) {
                      console.error('Failed to seed exercises:', err);
                      alert('Failed to seed exercises. Check console for details.');
                    }
                  }}
                  className="px-6 py-3 rounded-xl bg-[#E0FE10] text-black font-semibold hover:bg-[#c8e40e] transition-colors"
                >
                  Seed Exercise Library
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {exercises.map((exercise) => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    showAssignButton
                    showPlayButton
                    onPlay={() => setPlayingExercise(exercise)}
                    onAssign={() => {
                      setSelectedAthleteId(undefined);
                      setShowAssignModal(true);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'assignments' && (
          <div>
            <p className="text-zinc-400 mb-6">
              Recent exercise assignments you&apos;ve made.
            </p>
            
            {recentAssignments.length === 0 ? (
              <div className="text-center py-16 text-zinc-400">
                No assignments yet. Start by assigning an exercise to your athletes!
              </div>
            ) : (
              <div className="space-y-3">
                {recentAssignments.map((assignment) => {
                  const athlete = athletes.find(a => a.id === assignment.athleteUserId);
                  return (
                    <div
                      key={assignment.id}
                      className="flex items-center gap-4 p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50"
                    >
                      {/* Exercise icon */}
                      <div className="p-2.5 rounded-xl bg-zinc-700/50">
                        {assignment.exercise && getCategoryIcon(assignment.exercise.category)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white">
                          {assignment.exercise?.name || 'Unknown Exercise'}
                        </p>
                        <p className="text-sm text-zinc-400">
                          Assigned to {athlete?.displayName || athlete?.username || 'Unknown'}
                        </p>
                      </div>

                      {/* Status */}
                      <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(assignment.status)}`}>
                        {assignment.status.replace('_', ' ')}
                      </span>

                      {/* Date */}
                      <span className="text-sm text-zinc-500">
                        {new Date(assignment.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Assign Modal */}
      <AssignExerciseModal
        isOpen={showAssignModal}
        onClose={() => {
          setShowAssignModal(false);
          setSelectedAthleteId(undefined);
        }}
        athletes={athletes}
        coachId={coachProfile?.id || currentUser?.id || ''}
        coachName={currentUser?.displayName || currentUser?.username}
        preSelectedAthleteId={selectedAthleteId}
        onAssignmentComplete={() => {
          // Reload assignments
          if (coachProfile) {
            assignmentService.getByCoach(coachProfile.id).then(a => setRecentAssignments(a.slice(0, 20)));
          }
        }}
      />

      {/* Exercise Player (Preview Mode) */}
      {playingExercise && (
        <ExercisePlayer
          exercise={playingExercise}
          onClose={() => setPlayingExercise(null)}
          onComplete={(data) => {
            console.log('Exercise preview completed:', data);
            setPlayingExercise(null);
          }}
        />
      )}
    </CoachLayout>
  );
};

export default CoachMentalTraining;
