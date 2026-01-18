/**
 * Assign Exercise Modal
 * 
 * Modal for coaches to assign mental exercises to their athletes.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Search,
  Check,
  Clock,
  Calendar,
  Repeat,
  Send,
  Wind,
  Eye,
  Target,
  Brain,
  Star,
  Users,
} from 'lucide-react';
import {
  MentalExercise,
  ExerciseCategory,
} from '../../api/firebase/mentaltraining/types';
import { exerciseLibraryService, assignmentService } from '../../api/firebase/mentaltraining';
import { ExerciseCard } from './ExerciseCard';

interface Athlete {
  id: string;
  displayName?: string;
  username?: string;
  profileImageURL?: string;
}

interface AssignExerciseModalProps {
  isOpen: boolean;
  onClose: () => void;
  athletes: Athlete[];
  coachId: string;
  coachName?: string;
  preSelectedAthleteId?: string;
  onAssignmentComplete?: () => void;
}

type Step = 'select-exercise' | 'select-athletes' | 'configure' | 'confirm';

export const AssignExerciseModal: React.FC<AssignExerciseModalProps> = ({
  isOpen,
  onClose,
  athletes,
  coachId,
  coachName,
  preSelectedAthleteId,
  onAssignmentComplete,
}) => {
  const [step, setStep] = useState<Step>('select-exercise');
  const [exercises, setExercises] = useState<MentalExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | 'all'>('all');
  
  // Selection state
  const [selectedExercise, setSelectedExercise] = useState<MentalExercise | null>(null);
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<string[]>(
    preSelectedAthleteId ? [preSelectedAthleteId] : []
  );
  
  // Configuration state
  const [scheduledTime, setScheduledTime] = useState<'morning' | 'pre-workout' | 'post-workout' | 'evening' | undefined>();
  const [dueDate, setDueDate] = useState<string>('');
  const [reason, setReason] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load exercises
  useEffect(() => {
    if (!isOpen) return;
    
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
    
    loadExercises();
  }, [isOpen]);

  // Filter exercises
  const filteredExercises = exercises.filter((ex) => {
    const matchesSearch = 
      ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || ex.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleAthleteSelection = (athleteId: string) => {
    setSelectedAthleteIds((prev) =>
      prev.includes(athleteId)
        ? prev.filter((id) => id !== athleteId)
        : [...prev, athleteId]
    );
  };

  const selectAllAthletes = () => {
    setSelectedAthleteIds(athletes.map((a) => a.id));
  };

  const deselectAllAthletes = () => {
    setSelectedAthleteIds([]);
  };

  const handleAssign = async () => {
    if (!selectedExercise || selectedAthleteIds.length === 0) return;
    
    setAssigning(true);
    setError(null);
    
    try {
      await assignmentService.bulkAssign({
        athleteUserIds: selectedAthleteIds,
        exerciseId: selectedExercise.id,
        coachId,
        coachName,
        reason: reason || undefined,
        dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
        scheduledTime,
      });
      
      onAssignmentComplete?.();
      onClose();
      
      // Reset state
      setStep('select-exercise');
      setSelectedExercise(null);
      setSelectedAthleteIds(preSelectedAthleteId ? [preSelectedAthleteId] : []);
      setScheduledTime(undefined);
      setDueDate('');
      setReason('');
      setIsRecurring(false);
    } catch (err: any) {
      setError(err.message || 'Failed to assign exercise');
    } finally {
      setAssigning(false);
    }
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

  const canProceed = () => {
    switch (step) {
      case 'select-exercise': return !!selectedExercise;
      case 'select-athletes': return selectedAthleteIds.length > 0;
      case 'configure': return true;
      case 'confirm': return true;
      default: return false;
    }
  };

  const nextStep = () => {
    switch (step) {
      case 'select-exercise': setStep('select-athletes'); break;
      case 'select-athletes': setStep('configure'); break;
      case 'configure': setStep('confirm'); break;
      case 'confirm': handleAssign(); break;
    }
  };

  const prevStep = () => {
    switch (step) {
      case 'select-athletes': setStep('select-exercise'); break;
      case 'configure': setStep('select-athletes'); break;
      case 'confirm': setStep('configure'); break;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl max-h-[90vh] bg-zinc-900 rounded-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-zinc-800">
            <div>
              <h2 className="text-xl font-bold text-white">Assign Mental Exercise</h2>
              <p className="text-sm text-zinc-400 mt-1">
                {step === 'select-exercise' && 'Choose an exercise to assign'}
                {step === 'select-athletes' && 'Select athletes'}
                {step === 'configure' && 'Configure assignment'}
                {step === 'confirm' && 'Review and confirm'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 px-6 py-3 border-b border-zinc-800">
            {['select-exercise', 'select-athletes', 'configure', 'confirm'].map((s, i) => (
              <React.Fragment key={s}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    step === s
                      ? 'bg-[#E0FE10] text-black'
                      : ['select-exercise', 'select-athletes', 'configure', 'confirm'].indexOf(step) > i
                      ? 'bg-green-500 text-white'
                      : 'bg-zinc-700 text-zinc-400'
                  }`}
                >
                  {['select-exercise', 'select-athletes', 'configure', 'confirm'].indexOf(step) > i ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < 3 && (
                  <div className={`flex-1 h-0.5 ${
                    ['select-exercise', 'select-athletes', 'configure', 'confirm'].indexOf(step) > i
                      ? 'bg-green-500'
                      : 'bg-zinc-700'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <AnimatePresence mode="wait">
              {/* Step 1: Select Exercise */}
              {step === 'select-exercise' && (
                <motion.div
                  key="select-exercise"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  {/* Search & Filter */}
                  <div className="flex gap-3 mb-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                      <input
                        type="text"
                        placeholder="Search exercises..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-[#E0FE10] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Category filter */}
                  <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
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
                        <span className="capitalize">{cat}</span>
                      </button>
                    ))}
                  </div>

                  {/* Exercise list */}
                  {loading ? (
                    <div className="text-center py-10 text-zinc-400">Loading exercises...</div>
                  ) : (
                    <div className="space-y-2">
                      {filteredExercises.map((ex) => (
                        <ExerciseCard
                          key={ex.id}
                          exercise={ex}
                          compact
                          isSelected={selectedExercise?.id === ex.id}
                          onClick={() => setSelectedExercise(ex)}
                        />
                      ))}
                      {filteredExercises.length === 0 && (
                        <div className="text-center py-10 text-zinc-400">No exercises found</div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 2: Select Athletes */}
              {step === 'select-athletes' && (
                <motion.div
                  key="select-athletes"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-zinc-400">
                      {selectedAthleteIds.length} of {athletes.length} selected
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={selectAllAthletes}
                        className="text-sm text-[#E0FE10] hover:underline"
                      >
                        Select All
                      </button>
                      <button
                        onClick={deselectAllAthletes}
                        className="text-sm text-zinc-400 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {athletes.map((athlete) => (
                      <div
                        key={athlete.id}
                        onClick={() => toggleAthleteSelection(athlete.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                          selectedAthleteIds.includes(athlete.id)
                            ? 'bg-[#E0FE10]/10 border-2 border-[#E0FE10]'
                            : 'bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                          selectedAthleteIds.includes(athlete.id)
                            ? 'bg-[#E0FE10]'
                            : 'bg-zinc-700'
                        }`}>
                          {selectedAthleteIds.includes(athlete.id) && (
                            <Check className="w-3 h-3 text-black" />
                          )}
                        </div>
                        
                        {athlete.profileImageURL ? (
                          <img
                            src={athlete.profileImageURL}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center">
                            <span className="text-white font-medium">
                              {(athlete.displayName || athlete.username || 'A')[0].toUpperCase()}
                            </span>
                          </div>
                        )}
                        
                        <div>
                          <p className="font-medium text-white">
                            {athlete.displayName || athlete.username || 'Unknown'}
                          </p>
                          {athlete.username && athlete.displayName && (
                            <p className="text-sm text-zinc-400">@{athlete.username}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 3: Configure */}
              {step === 'configure' && (
                <motion.div
                  key="configure"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* Scheduled time */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Best time to do this exercise
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['morning', 'pre-workout', 'post-workout', 'evening'] as const).map((time) => (
                        <button
                          key={time}
                          onClick={() => setScheduledTime(scheduledTime === time ? undefined : time)}
                          className={`p-3 rounded-xl text-sm font-medium capitalize transition-colors ${
                            scheduledTime === time
                              ? 'bg-[#E0FE10] text-black'
                              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                        >
                          {time.replace('-', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Due date */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Due date (optional)
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:border-[#E0FE10] focus:outline-none"
                    />
                  </div>

                  {/* Reason/Note */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">
                      Message to athlete (optional)
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g., 'This will help with the anxiety you mentioned...'"
                      rows={3}
                      className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-[#E0FE10] focus:outline-none resize-none"
                    />
                  </div>
                </motion.div>
              )}

              {/* Step 4: Confirm */}
              {step === 'confirm' && (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* Exercise summary */}
                  <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700">
                    <h3 className="text-sm font-medium text-zinc-400 mb-2">Exercise</h3>
                    <p className="text-lg font-semibold text-white">{selectedExercise?.name}</p>
                    <p className="text-sm text-zinc-400 mt-1">
                      {selectedExercise?.durationMinutes} min • {selectedExercise?.category}
                    </p>
                  </div>

                  {/* Athletes summary */}
                  <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700">
                    <h3 className="text-sm font-medium text-zinc-400 mb-2">
                      <Users className="w-4 h-4 inline mr-1" />
                      Athletes ({selectedAthleteIds.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedAthleteIds.map((id) => {
                        const athlete = athletes.find((a) => a.id === id);
                        return (
                          <span key={id} className="px-3 py-1 rounded-full bg-zinc-700 text-white text-sm">
                            {athlete?.displayName || athlete?.username || 'Unknown'}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Configuration summary */}
                  <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700">
                    <h3 className="text-sm font-medium text-zinc-400 mb-2">Configuration</h3>
                    <div className="space-y-1 text-sm">
                      {scheduledTime && (
                        <p className="text-white">
                          <Clock className="w-4 h-4 inline mr-1 text-zinc-400" />
                          Best time: <span className="capitalize">{scheduledTime.replace('-', ' ')}</span>
                        </p>
                      )}
                      {dueDate && (
                        <p className="text-white">
                          <Calendar className="w-4 h-4 inline mr-1 text-zinc-400" />
                          Due: {new Date(dueDate).toLocaleDateString()}
                        </p>
                      )}
                      {reason && (
                        <p className="text-white mt-2">
                          Message: "{reason}"
                        </p>
                      )}
                      {!scheduledTime && !dueDate && !reason && (
                        <p className="text-zinc-400">No additional configuration</p>
                      )}
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                      {error}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-zinc-800">
            <button
              onClick={step === 'select-exercise' ? onClose : prevStep}
              className="px-6 py-2.5 rounded-xl bg-zinc-800 text-white font-medium hover:bg-zinc-700 transition-colors"
            >
              {step === 'select-exercise' ? 'Cancel' : 'Back'}
            </button>
            
            <button
              onClick={nextStep}
              disabled={!canProceed() || assigning}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-colors ${
                canProceed() && !assigning
                  ? 'bg-[#E0FE10] text-black hover:bg-[#c8e40e]'
                  : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
              }`}
            >
              {step === 'confirm' ? (
                assigning ? (
                  'Assigning...'
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Assign Exercise
                  </>
                )
              ) : (
                'Continue'
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AssignExerciseModal;
