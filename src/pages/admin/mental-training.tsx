/**
 * Admin Mental Training Page
 * 
 * Manage the mental exercise library:
 * - Seed default exercises
 * - Add/edit/delete exercises
 * - Configure exercise game settings
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Plus,
  Trash2,
  Edit2,
  Power,
  PowerOff,
  RefreshCw,
  Wind,
  Eye,
  Target,
  Star,
  Sparkles,
  Check,
  X,
  ChevronDown,
  Loader2,
  Database,
} from 'lucide-react';
import { useUser } from '../../hooks/useUser';
import {
  exerciseLibraryService,
  MentalExercise,
  ExerciseCategory,
  ExerciseDifficulty,
} from '../../api/firebase/mentaltraining';
import Head from 'next/head';

const AdminMentalTraining: React.FC = () => {
  const router = useRouter();
  const currentUser = useUser();
  
  const [exercises, setExercises] = useState<MentalExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | 'all'>('all');
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);

  // Load exercises
  useEffect(() => {
    loadExercises();
  }, []);

  const loadExercises = async () => {
    setLoading(true);
    try {
      const data = await exerciseLibraryService.getAll();
      setExercises(data);
    } catch (err) {
      console.error('Failed to load exercises:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSeedExercises = async () => {
    setSeeding(true);
    try {
      const result = await exerciseLibraryService.seedExercises();
      alert(`Successfully seeded ${result.created} exercises! (${result.skipped} already existed)`);
      await loadExercises();
    } catch (err) {
      console.error('Failed to seed:', err);
      alert('Failed to seed exercises. Check console for details.');
    } finally {
      setSeeding(false);
    }
  };

  const handleToggleActive = async (exercise: MentalExercise) => {
    try {
      if (exercise.isActive) {
        await exerciseLibraryService.deactivate(exercise.id);
      } else {
        await exerciseLibraryService.save({ ...exercise, isActive: true, updatedAt: Date.now() });
      }
      await loadExercises();
    } catch (err) {
      console.error('Failed to toggle exercise:', err);
    }
  };

  const handleDeleteExercise = async (exerciseId: string) => {
    if (!confirm('Are you sure you want to delete this exercise? This cannot be undone.')) {
      return;
    }
    
    try {
      await exerciseLibraryService.delete(exerciseId);
      await loadExercises();
    } catch (err) {
      console.error('Failed to delete exercise:', err);
      alert('Failed to delete exercise.');
    }
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

  const getCategoryColor = (category: ExerciseCategory) => {
    switch (category) {
      case ExerciseCategory.Breathing: return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
      case ExerciseCategory.Visualization: return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
      case ExerciseCategory.Focus: return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case ExerciseCategory.Mindset: return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case ExerciseCategory.Confidence: return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    }
  };

  const filteredExercises = selectedCategory === 'all'
    ? exercises
    : exercises.filter(e => e.category === selectedCategory);

  // Group by category
  const groupedExercises = filteredExercises.reduce((acc, ex) => {
    if (!acc[ex.category]) acc[ex.category] = [];
    acc[ex.category].push(ex);
    return acc;
  }, {} as Record<string, MentalExercise[]>);

  const stats = {
    total: exercises.length,
    active: exercises.filter(e => e.isActive).length,
    breathing: exercises.filter(e => e.category === ExerciseCategory.Breathing).length,
    visualization: exercises.filter(e => e.category === ExerciseCategory.Visualization).length,
    focus: exercises.filter(e => e.category === ExerciseCategory.Focus).length,
    mindset: exercises.filter(e => e.category === ExerciseCategory.Mindset).length,
    confidence: exercises.filter(e => e.category === ExerciseCategory.Confidence).length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center">
        <Head><title>Mental Training Admin | Pulse</title></Head>
        <Loader2 className="w-8 h-8 animate-spin text-[#E0FE10]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <Head><title>Mental Training Admin | Pulse</title></Head>
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Brain className="w-8 h-8 text-[#E0FE10]" />
              Mental Training Admin
            </h1>
            <p className="text-zinc-400 mt-1">
              Manage the mental exercise library and game configurations
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleSeedExercises}
              disabled={seeding}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {seeding ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Database className="w-5 h-5" />
              )}
              Seed Exercises
            </button>
            
            <button
              onClick={loadExercises}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3 mb-8">
          <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-center">
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-zinc-400">Total</p>
          </div>
          <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-center">
            <p className="text-2xl font-bold text-green-400">{stats.active}</p>
            <p className="text-xs text-zinc-400">Active</p>
          </div>
          <div className={`p-4 rounded-xl border text-center ${getCategoryColor(ExerciseCategory.Breathing)}`}>
            <p className="text-2xl font-bold">{stats.breathing}</p>
            <p className="text-xs opacity-80">Breath Work</p>
          </div>
          <div className={`p-4 rounded-xl border text-center ${getCategoryColor(ExerciseCategory.Visualization)}`}>
            <p className="text-2xl font-bold">{stats.visualization}</p>
            <p className="text-xs opacity-80">Visualization</p>
          </div>
          <div className={`p-4 rounded-xl border text-center ${getCategoryColor(ExerciseCategory.Focus)}`}>
            <p className="text-2xl font-bold">{stats.focus}</p>
            <p className="text-xs opacity-80">Focus</p>
          </div>
          <div className={`p-4 rounded-xl border text-center ${getCategoryColor(ExerciseCategory.Mindset)}`}>
            <p className="text-2xl font-bold">{stats.mindset}</p>
            <p className="text-xs opacity-80">Mindset</p>
          </div>
          <div className={`p-4 rounded-xl border text-center ${getCategoryColor(ExerciseCategory.Confidence)}`}>
            <p className="text-2xl font-bold">{stats.confidence}</p>
            <p className="text-xs opacity-80">Confidence</p>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedCategory === 'all'
                ? 'bg-[#E0FE10] text-black'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            All Categories
          </button>
          {Object.values(ExerciseCategory).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-[#E0FE10] text-black'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {getCategoryIcon(cat)}
              {cat === ExerciseCategory.Breathing ? 'Breath Work' : (cat.charAt(0).toUpperCase() + cat.slice(1))}
            </button>
          ))}
        </div>

        {/* Exercises */}
        {exercises.length === 0 ? (
          <div className="text-center py-20">
            <Database className="w-16 h-16 mx-auto mb-4 text-zinc-600" />
            <p className="text-xl text-white mb-2">No exercises in database</p>
            <p className="text-zinc-400 mb-6">
              Click "Seed Exercises" to add the default 17 mental training exercises.
            </p>
            <button
              onClick={handleSeedExercises}
              disabled={seeding}
              className="px-6 py-3 rounded-xl bg-[#E0FE10] text-black font-semibold hover:bg-[#c8e40e] disabled:opacity-50 transition-colors"
            >
              {seeding ? 'Seeding...' : 'Seed Exercise Library'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedExercises).map(([category, catExercises]) => (
              <div key={category}>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  {getCategoryIcon(category as ExerciseCategory)}
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                  <span className="text-sm font-normal text-zinc-500">({catExercises.length})</span>
                </h3>
                
                <div className="space-y-2">
                  {catExercises.map((exercise) => (
                    <motion.div
                      key={exercise.id}
                      layout
                      className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 overflow-hidden"
                    >
                      {/* Exercise Header */}
                      <div
                        onClick={() => setExpandedExercise(
                          expandedExercise === exercise.id ? null : exercise.id
                        )}
                        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-zinc-800/70 transition-colors"
                      >
                        <div className={`p-2.5 rounded-xl border ${getCategoryColor(exercise.category)}`}>
                          {getCategoryIcon(exercise.category)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white truncate">{exercise.name}</p>
                            {!exercise.isActive && (
                              <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-zinc-400 truncate">{exercise.description}</p>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-zinc-400">
                          <span>{exercise.durationMinutes} min</span>
                          <span>•</span>
                          <span className="capitalize">{exercise.difficulty}</span>
                        </div>
                        
                        <ChevronDown
                          className={`w-5 h-5 text-zinc-400 transition-transform ${
                            expandedExercise === exercise.id ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                      
                      {/* Expanded Details */}
                      <AnimatePresence>
                        {expandedExercise === exercise.id && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden border-t border-zinc-700/50"
                          >
                            <div className="p-4 bg-zinc-900/50">
                              {/* Benefits */}
                              <div className="mb-4">
                                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Benefits</p>
                                <div className="flex flex-wrap gap-2">
                                  {exercise.benefits.map((benefit, i) => (
                                    <span
                                      key={i}
                                      className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-300 text-sm"
                                    >
                                      {benefit}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              
                              {/* Best For */}
                              <div className="mb-4">
                                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Best For</p>
                                <div className="flex flex-wrap gap-2">
                                  {exercise.bestFor.map((use, i) => (
                                    <span
                                      key={i}
                                      className="px-2 py-1 rounded-lg bg-[#E0FE10]/10 text-[#E0FE10] text-sm"
                                    >
                                      {use}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              
                              {/* Game Config Preview */}
                              <div className="mb-4">
                                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
                                  Game Configuration
                                </p>
                                <pre className="p-3 rounded-lg bg-zinc-800 text-xs text-zinc-300 overflow-x-auto">
                                  {JSON.stringify(exercise.exerciseConfig, null, 2)}
                                </pre>
                              </div>
                              
                              {/* Actions */}
                              <div className="flex gap-2 pt-2 border-t border-zinc-800">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleActive(exercise);
                                  }}
                                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    exercise.isActive
                                      ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                      : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                                  }`}
                                >
                                  {exercise.isActive ? (
                                    <>
                                      <PowerOff className="w-4 h-4" />
                                      Deactivate
                                    </>
                                  ) : (
                                    <>
                                      <Power className="w-4 h-4" />
                                      Activate
                                    </>
                                  )}
                                </button>
                                
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteExercise(exercise.id);
                                  }}
                                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 text-sm font-medium transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMentalTraining;
