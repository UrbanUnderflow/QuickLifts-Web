import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeft, Share2, Trophy, Target, Clock, Flame, TrendingUp, CheckCircle, Star } from 'lucide-react';
import { RunSummary, RunType, WorkoutRating } from '../../api/firebase/workout/types';
import { useUser } from '../../hooks/useUser';
import confetti from 'canvas-confetti';

const RunSummaryPage: React.FC = () => {
  const router = useRouter();
  const currentUser = useUser();
  
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [selectedRating, setSelectedRating] = useState<WorkoutRating | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showContent, setShowContent] = useState(false);

  // Run category color (Blue)
  const runColor = '#3B82F6';

  // Parse summary from query
  useEffect(() => {
    if (router.query.summary) {
      try {
        const parsed = JSON.parse(router.query.summary as string);
        setSummary(new RunSummary(parsed));
        
        // Trigger confetti on goal achieved
        setTimeout(() => {
          setShowContent(true);
          if (parsed.goalAchieved || parsed.runType === RunType.FreeRun) {
            triggerConfetti();
          }
        }, 300);
      } catch (e) {
        console.error('Failed to parse run summary:', e);
      }
    }
  }, [router.query.summary]);

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: [runColor, '#E0FE10', '#A855F7', '#F97316']
    });
  };

  const handleRatingSelect = (rating: WorkoutRating) => {
    setSelectedRating(rating);
  };

  const handleSave = async () => {
    if (!summary || !currentUser?.id) return;
    
    setIsSaving(true);
    try {
      // Update rating on summary
      const updatedSummary = {
        ...summary.toDictionary(),
        workoutRating: selectedRating,
        userId: currentUser.id
      };

      // Save to Firestore via API
      const response = await fetch('/.netlify/functions/save-run-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSummary)
      });

      if (!response.ok) {
        throw new Error('Failed to save run summary');
      }

      // Navigate to home or history
      router.push('/');
    } catch (error) {
      console.error('Error saving run summary:', error);
      // Still navigate home even if save fails
      router.push('/');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    if (!summary) return;
    
    const shareText = `Just completed a ${summary.formattedDistance} run in ${summary.formattedDuration}! 🏃‍♂️💪`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Pulse Run Complete!',
          text: shareText,
          url: window.location.origin
        });
      } catch (e) {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareText);
    }
  };

  if (!summary) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="w-12 h-12 border-t-2 border-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900">
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-3xl opacity-15"
          style={{ backgroundColor: runColor }}
        />
      </div>

      {/* Content */}
      <div className={`relative max-w-lg mx-auto px-4 py-6 transition-all duration-500 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push('/')}
            className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          
          <button
            onClick={handleShare}
            className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700"
          >
            <Share2 className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Achievement Badge */}
        <div className="text-center mb-8">
          <div 
            className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4"
            style={{ backgroundColor: `${runColor}20` }}
          >
            {summary.goalAchieved ? (
              <Trophy className="w-10 h-10" style={{ color: runColor }} />
            ) : (
              <CheckCircle className="w-10 h-10" style={{ color: runColor }} />
            )}
          </div>
          
          <h1 className="text-3xl font-bold text-white mb-2">
            {summary.goalAchieved ? 'Goal Achieved! 🎉' : 'Run Complete!'}
          </h1>
          <p className="text-zinc-400">{summary.title}</p>
        </div>

        {/* Proof photo (optional) */}
        {summary.treadmillPhotoURL && (
          <div className="bg-zinc-800/50 rounded-2xl p-4 mb-6 border border-zinc-700/50">
            <div className="text-white font-semibold mb-2">Results Photo</div>
            <div className="rounded-xl overflow-hidden border border-zinc-700 bg-black">
              <img
                src={summary.treadmillPhotoURL}
                alt="Run results"
                className="w-full object-contain max-h-[420px]"
              />
            </div>
            <p className="text-zinc-400 text-xs mt-2">
              This photo is used to verify and extract your run stats.
            </p>
          </div>
        )}

        {/* Main Stats */}
        <div className="bg-zinc-800/50 rounded-3xl p-6 mb-6">
          {/* Primary stat - Distance or Time based on run type */}
          <div className="text-center mb-6 pb-6 border-b border-zinc-700/50">
            <div className="text-6xl font-bold text-white mb-2">
              {summary.formattedDistance}
            </div>
            <div className="text-zinc-400">Total Distance</div>
          </div>

          {/* Secondary stats grid */}
          <div className="grid grid-cols-3 gap-4">
            <StatItem 
              icon={<Clock className="w-5 h-5" />}
              label="Duration" 
              value={summary.formattedDuration}
              color={runColor}
            />
            <StatItem 
              icon={<TrendingUp className="w-5 h-5" />}
              label="Avg Pace" 
              value={summary.formattedPace}
              color={runColor}
            />
            <StatItem 
              icon={<Flame className="w-5 h-5" />}
              label="Calories" 
              value={`${summary.caloriesBurned}`}
              color={runColor}
            />
          </div>
        </div>

        {/* Goal Progress (if applicable) */}
        {summary.runType !== RunType.FreeRun && (
          <div className="bg-zinc-800/50 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <Target className="w-5 h-5" style={{ color: runColor }} />
              <span className="text-zinc-400">Goal Progress</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-white font-medium">
                {summary.runType === RunType.Distance && summary.targetDistance && (
                  <>{summary.distance.toFixed(2)} / {summary.targetDistance} mi</>
                )}
                {summary.runType === RunType.Time && summary.targetDuration && (
                  <>{Math.floor(summary.duration / 60)} / {Math.floor(summary.targetDuration / 60)} min</>
                )}
                {summary.runType === RunType.Intervals && summary.intervalConfig && (
                  <>{summary.completedIntervals} / {summary.intervalConfig.numberOfRounds} intervals</>
                )}
              </div>
              {summary.goalAchieved && (
                <span className="text-green-400 text-sm font-medium">✓ Complete</span>
              )}
            </div>
          </div>
        )}

        {/* Rating Section */}
        <div className="bg-zinc-800/50 rounded-2xl p-6 mb-6">
          <h3 className="text-white font-semibold mb-4 text-center">How did it feel?</h3>
          <div className="flex justify-center gap-4">
            <RatingButton
              icon="😓"
              label="Too Hard"
              rating={WorkoutRating.TooHard}
              isSelected={selectedRating === WorkoutRating.TooHard}
              onClick={() => handleRatingSelect(WorkoutRating.TooHard)}
            />
            <RatingButton
              icon="😊"
              label="Just Right"
              rating={WorkoutRating.JustRight}
              isSelected={selectedRating === WorkoutRating.JustRight}
              onClick={() => handleRatingSelect(WorkoutRating.JustRight)}
            />
            <RatingButton
              icon="💪"
              label="Too Easy"
              rating={WorkoutRating.TooEasy}
              isSelected={selectedRating === WorkoutRating.TooEasy}
              onClick={() => handleRatingSelect(WorkoutRating.TooEasy)}
            />
          </div>
        </div>

        {/* AI Insight (placeholder) */}
        {summary.aiInsight && (
          <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl p-6 mb-6 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-5 h-5 text-blue-400" />
              <span className="text-blue-400 font-medium">Pulse AI Insight</span>
            </div>
            <p className="text-zinc-300">{summary.aiInsight}</p>
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-4 rounded-full font-bold text-lg text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          style={{ backgroundColor: runColor }}
        >
          {isSaving ? 'Saving...' : 'Save Run'}
        </button>
      </div>
    </div>
  );
};

// Stat Item Component
interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}

const StatItem: React.FC<StatItemProps> = ({ icon, label, value, color }) => (
  <div className="text-center">
    <div 
      className="inline-flex items-center justify-center w-10 h-10 rounded-full mb-2"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {icon}
    </div>
    <div className="text-white font-semibold">{value}</div>
    <div className="text-xs text-zinc-500">{label}</div>
  </div>
);

// Rating Button Component
interface RatingButtonProps {
  icon: string;
  label: string;
  rating: WorkoutRating;
  isSelected: boolean;
  onClick: () => void;
}

const RatingButton: React.FC<RatingButtonProps> = ({ icon, label, isSelected, onClick }) => (
  <button
    onClick={onClick}
    className={`
      flex flex-col items-center p-4 rounded-xl transition-all
      ${isSelected 
        ? 'bg-blue-500/20 border-2 border-blue-500 scale-105' 
        : 'bg-zinc-700/50 border-2 border-transparent hover:bg-zinc-700'
      }
    `}
  >
    <span className="text-3xl mb-1">{icon}</span>
    <span className={`text-xs ${isSelected ? 'text-blue-400' : 'text-zinc-400'}`}>{label}</span>
  </button>
);

export default RunSummaryPage;
