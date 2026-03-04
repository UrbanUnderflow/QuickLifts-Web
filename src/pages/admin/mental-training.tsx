/**
 * Admin Mental Training Page
 * 
 * Manage the mental exercise library:
 * - Seed default exercises
 * - Add/edit/delete exercises
 * - Configure exercise game settings
 * - Edit exercises inline and save directly to Firestore
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
  Save,
  AlertTriangle,
  Copy,
  Zap,
} from 'lucide-react';
import { useUser } from '../../hooks/useUser';
import {
  exerciseLibraryService,
  MentalExercise,
  ExerciseCategory,
  ExerciseDifficulty,
} from '../../api/firebase/mentaltraining';
import Head from 'next/head';

// ============================================================================
// EDIT MODAL
// ============================================================================

interface EditExerciseModalProps {
  exercise: MentalExercise;
  onClose: () => void;
  onSave: (updated: MentalExercise) => void;
  saving: boolean;
}

const EditExerciseModal: React.FC<EditExerciseModalProps> = ({
  exercise,
  onClose,
  onSave,
  saving,
}) => {
  const [form, setForm] = useState<MentalExercise>({ ...exercise });
  const [configJson, setConfigJson] = useState(
    JSON.stringify(exercise.exerciseConfig, null, 2)
  );
  const [configError, setConfigError] = useState<string | null>(null);
  const [benefitsText, setBenefitsText] = useState(exercise.benefits.join('\n'));
  const [bestForText, setBestForText] = useState(exercise.bestFor.join('\n'));
  const [activeTab, setActiveTab] = useState<'general' | 'content' | 'gameConfig'>('general');

  const handleConfigChange = (value: string) => {
    setConfigJson(value);
    try {
      JSON.parse(value);
      setConfigError(null);
    } catch (e: any) {
      setConfigError(e.message);
    }
  };

  const handleSave = () => {
    // Parse config JSON
    let parsedConfig;
    try {
      parsedConfig = JSON.parse(configJson);
    } catch (e: any) {
      setConfigError(e.message);
      return;
    }

    const updated: MentalExercise = {
      ...form,
      exerciseConfig: parsedConfig,
      benefits: benefitsText.split('\n').map(s => s.trim()).filter(Boolean),
      bestFor: bestForText.split('\n').map(s => s.trim()).filter(Boolean),
      updatedAt: Date.now(),
    };

    onSave(updated);
  };

  const tabs = [
    { id: 'general' as const, label: 'General' },
    { id: 'content' as const, label: 'Content & Science' },
    { id: 'gameConfig' as const, label: 'Game Config' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-[#111113] border border-zinc-700/60 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700/50">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-[#E0FE10]" />
              Edit Exercise
            </h2>
            <p className="text-sm text-zinc-400 mt-0.5">ID: {exercise.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 border-b border-zinc-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${activeTab === tab.id
                  ? 'bg-zinc-800 text-white border-b-2 border-[#E0FE10]'
                  : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* General Tab */}
          {activeTab === 'general' && (
            <>
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Exercise Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700 text-white focus:border-[#E0FE10] focus:ring-1 focus:ring-[#E0FE10]/30 outline-none transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700 text-white focus:border-[#E0FE10] focus:ring-1 focus:ring-[#E0FE10]/30 outline-none transition-colors resize-none"
                />
              </div>

              {/* Category + Difficulty + Duration Row */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value as ExerciseCategory })
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700 text-white focus:border-[#E0FE10] outline-none transition-colors"
                  >
                    {Object.values(ExerciseCategory).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Difficulty</label>
                  <select
                    value={form.difficulty}
                    onChange={(e) =>
                      setForm({ ...form, difficulty: e.target.value as ExerciseDifficulty })
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700 text-white focus:border-[#E0FE10] outline-none transition-colors"
                  >
                    {Object.values(ExerciseDifficulty).map((diff) => (
                      <option key={diff} value={diff}>
                        {diff.charAt(0).toUpperCase() + diff.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Duration (min)</label>
                  <input
                    type="number"
                    value={form.durationMinutes}
                    onChange={(e) =>
                      setForm({ ...form, durationMinutes: parseInt(e.target.value) || 1 })
                    }
                    min={1}
                    max={60}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700 text-white focus:border-[#E0FE10] outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Icon + Sort Order + Active */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Icon Name</label>
                  <input
                    type="text"
                    value={form.iconName}
                    onChange={(e) => setForm({ ...form, iconName: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700 text-white focus:border-[#E0FE10] outline-none transition-colors"
                    placeholder="e.g. zap, target, brain"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Sort Order</label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) =>
                      setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700 text-white focus:border-[#E0FE10] outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Status</label>
                  <button
                    onClick={() => setForm({ ...form, isActive: !form.isActive })}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-medium transition-colors ${form.isActive
                        ? 'bg-green-500/10 border-green-500/30 text-green-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-400'
                      }`}
                  >
                    {form.isActive ? (
                      <>
                        <Power className="w-4 h-4" /> Active
                      </>
                    ) : (
                      <>
                        <PowerOff className="w-4 h-4" /> Inactive
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Benefits */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Benefits <span className="text-zinc-500">(one per line)</span>
                </label>
                <textarea
                  value={benefitsText}
                  onChange={(e) => setBenefitsText(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700 text-white focus:border-[#E0FE10] focus:ring-1 focus:ring-[#E0FE10]/30 outline-none transition-colors resize-none font-mono text-sm"
                  placeholder="Faster mental recovery&#10;Disruption resilience&#10;Consistency under pressure"
                />
              </div>

              {/* Best For */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Best For <span className="text-zinc-500">(one per line)</span>
                </label>
                <textarea
                  value={bestForText}
                  onChange={(e) => setBestForText(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700 text-white focus:border-[#E0FE10] focus:ring-1 focus:ring-[#E0FE10]/30 outline-none transition-colors resize-none font-mono text-sm"
                  placeholder="mistake recovery&#10;pre-competition&#10;pressure performance"
                />
              </div>
            </>
          )}

          {/* Content & Science Tab */}
          {activeTab === 'content' && (
            <>
              {/* Origin */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Origin</label>
                <textarea
                  value={form.origin}
                  onChange={(e) => setForm({ ...form, origin: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700 text-white focus:border-[#E0FE10] focus:ring-1 focus:ring-[#E0FE10]/30 outline-none transition-colors resize-none text-sm"
                  placeholder="Who uses this technique and where it comes from..."
                />
              </div>

              {/* Neuroscience */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Neuroscience</label>
                <textarea
                  value={form.neuroscience}
                  onChange={(e) => setForm({ ...form, neuroscience: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700 text-white focus:border-[#E0FE10] focus:ring-1 focus:ring-[#E0FE10]/30 outline-none transition-colors resize-none text-sm"
                  placeholder="The science behind why this works..."
                />
              </div>

              {/* Overview Fields */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-zinc-300">Overview</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">When to use</label>
                    <input
                      type="text"
                      value={form.overview.when}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          overview: { ...form.overview, when: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-zinc-800/80 border border-zinc-700 text-white text-sm focus:border-[#E0FE10] outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Focus area</label>
                    <input
                      type="text"
                      value={form.overview.focus}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          overview: { ...form.overview, focus: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-zinc-800/80 border border-zinc-700 text-white text-sm focus:border-[#E0FE10] outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Time scale</label>
                    <input
                      type="text"
                      value={form.overview.timeScale}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          overview: { ...form.overview, timeScale: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-zinc-800/80 border border-zinc-700 text-white text-sm focus:border-[#E0FE10] outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Skill trained</label>
                    <input
                      type="text"
                      value={form.overview.skill}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          overview: { ...form.overview, skill: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-zinc-800/80 border border-zinc-700 text-white text-sm focus:border-[#E0FE10] outline-none transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Analogy</label>
                  <input
                    type="text"
                    value={form.overview.analogy}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        overview: { ...form.overview, analogy: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800/80 border border-zinc-700 text-white text-sm focus:border-[#E0FE10] outline-none transition-colors"
                  />
                </div>
              </div>
            </>
          )}

          {/* Game Config Tab */}
          {activeTab === 'gameConfig' && (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-zinc-300">
                    Exercise Configuration (JSON)
                  </label>
                  {configError && (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                      <AlertTriangle className="w-3 h-3" />
                      Invalid JSON
                    </span>
                  )}
                </div>
                <textarea
                  value={configJson}
                  onChange={(e) => handleConfigChange(e.target.value)}
                  rows={18}
                  spellCheck={false}
                  className={`w-full px-4 py-3 rounded-xl bg-zinc-900 border text-white font-mono text-sm leading-relaxed focus:ring-1 outline-none transition-colors resize-none ${configError
                      ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/30'
                      : 'border-zinc-700 focus:border-[#E0FE10] focus:ring-[#E0FE10]/30'
                    }`}
                />
                {configError && (
                  <p className="mt-2 text-sm text-red-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    {configError}
                  </p>
                )}
              </div>

              <div className="p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/30">
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
                  Quick Reference — Config Types
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                  <div>
                    <p className="text-zinc-300 font-medium">Focus types:</p>
                    <p>single_point, distraction, cue_word, body_scan, kill_switch</p>
                  </div>
                  <div>
                    <p className="text-zinc-300 font-medium">Breathing patterns:</p>
                    <p>box, physiological_sigh, 4-7-8, arousal_control, recovery</p>
                  </div>
                  <div>
                    <p className="text-zinc-300 font-medium">Mindset types:</p>
                    <p>reframe, growth_mindset, process_focus</p>
                  </div>
                  <div>
                    <p className="text-zinc-300 font-medium">Confidence types:</p>
                    <p>evidence_journal, inventory, power_pose, affirmations</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-700/50 bg-zinc-900/50">
          <p className="text-xs text-zinc-500">
            Last updated: {new Date(exercise.updatedAt).toLocaleString()}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !!configError}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#E0FE10] text-black font-semibold hover:bg-[#c8e40e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save to Firestore
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ============================================================================
// MAIN ADMIN PAGE
// ============================================================================

const AdminMentalTraining: React.FC = () => {
  const router = useRouter();
  const currentUser = useUser();

  const [exercises, setExercises] = useState<MentalExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | 'all'>('all');
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [editingExercise, setEditingExercise] = useState<MentalExercise | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Load exercises
  useEffect(() => {
    loadExercises();
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

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
      setToast({
        message: `Seeded ${result.created} new exercises (${result.skipped} already existed)`,
        type: 'success',
      });
      await loadExercises();
    } catch (err) {
      console.error('Failed to seed:', err);
      setToast({ message: 'Failed to seed exercises', type: 'error' });
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
      setToast({
        message: `${exercise.name} ${exercise.isActive ? 'deactivated' : 'activated'}`,
        type: 'success',
      });
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
      setToast({ message: 'Exercise deleted', type: 'success' });
    } catch (err) {
      console.error('Failed to delete exercise:', err);
      setToast({ message: 'Failed to delete exercise', type: 'error' });
    }
  };

  const handleSaveExercise = async (updated: MentalExercise) => {
    setSaving(true);
    try {
      await exerciseLibraryService.save(updated);
      await loadExercises();
      setEditingExercise(null);
      setToast({ message: `"${updated.name}" saved to Firestore`, type: 'success' });
    } catch (err) {
      console.error('Failed to save exercise:', err);
      setToast({ message: 'Failed to save exercise', type: 'error' });
    } finally {
      setSaving(false);
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
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${selectedCategory === 'all'
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
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${selectedCategory === cat
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
              Click &quot;Seed Exercises&quot; to add the default mental training exercises.
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
                            {(exercise.exerciseConfig.config as any)?.type === 'kill_switch' && (
                              <span className="px-2 py-0.5 rounded text-xs bg-[#E0FE10]/20 text-[#E0FE10] flex items-center gap-1">
                                <Zap className="w-3 h-3" /> Game
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
                          className={`w-5 h-5 text-zinc-400 transition-transform ${expandedExercise === exercise.id ? 'rotate-180' : ''
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
                                    setEditingExercise(exercise);
                                  }}
                                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E0FE10]/10 text-[#E0FE10] hover:bg-[#E0FE10]/20 text-sm font-medium transition-colors"
                                >
                                  <Edit2 className="w-4 h-4" />
                                  Edit & Save
                                </button>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleActive(exercise);
                                  }}
                                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${exercise.isActive
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

      {/* Edit Modal */}
      <AnimatePresence>
        {editingExercise && (
          <EditExerciseModal
            exercise={editingExercise}
            onClose={() => setEditingExercise(null)}
            onSave={handleSaveExercise}
            saving={saving}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className={`fixed bottom-6 right-6 z-[60] flex items-center gap-2 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium ${toast.type === 'success'
                ? 'bg-green-500/90 text-white'
                : 'bg-red-500/90 text-white'
              }`}
          >
            {toast.type === 'success' ? (
              <Check className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminMentalTraining;
