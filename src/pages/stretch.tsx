import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeft, Play, Pause, SkipForward, ChevronRight, Clock, CheckCircle } from 'lucide-react';
import { 
  StretchBodyArea, 
  StretchBodyAreaInfo,
  StretchDurationPreset,
  StretchSummary,
  PulsePoints
} from '../api/firebase/workout/types';
import { useUser } from '../hooks/useUser';
import { v4 as uuidv4 } from 'uuid';

// Configuration step enum
enum StretchStep {
  BodyAreas = 'bodyAreas',
  Duration = 'duration',
  Active = 'active',
  Complete = 'complete'
}

// Sample stretches for each body area
const STRETCHES: Record<string, { name: string; duration: number; description: string }[]> = {
  [StretchBodyArea.Neck]: [
    { name: 'Neck Tilts', duration: 30, description: 'Tilt head side to side, holding each side' },
    { name: 'Neck Rotations', duration: 30, description: 'Slowly rotate head in circles' },
    { name: 'Forward Neck Stretch', duration: 30, description: 'Chin to chest, hold gently' },
  ],
  [StretchBodyArea.Shoulders]: [
    { name: 'Cross-Body Shoulder Stretch', duration: 30, description: 'Pull arm across body' },
    { name: 'Shoulder Rolls', duration: 30, description: 'Roll shoulders forward and backward' },
    { name: 'Arm Circles', duration: 30, description: 'Large circles with extended arms' },
  ],
  [StretchBodyArea.Arms]: [
    { name: 'Tricep Stretch', duration: 30, description: 'Reach behind head, pull elbow' },
    { name: 'Wrist Circles', duration: 20, description: 'Rotate wrists in both directions' },
    { name: 'Bicep Wall Stretch', duration: 30, description: 'Arm against wall, rotate away' },
  ],
  [StretchBodyArea.Chest]: [
    { name: 'Doorway Stretch', duration: 45, description: 'Arms on door frame, lean forward' },
    { name: 'Chest Opener', duration: 30, description: 'Clasp hands behind, lift chest' },
  ],
  [StretchBodyArea.UpperBack]: [
    { name: 'Cat-Cow Stretch', duration: 45, description: 'Alternate arching and rounding back' },
    { name: 'Thread the Needle', duration: 30, description: 'Rotate thoracic spine on all fours' },
    { name: 'Child\'s Pose', duration: 45, description: 'Sit back on heels, arms extended' },
  ],
  [StretchBodyArea.LowerBack]: [
    { name: 'Knee-to-Chest', duration: 30, description: 'Pull one or both knees to chest' },
    { name: 'Lying Spinal Twist', duration: 45, description: 'Knees to one side, look opposite' },
    { name: 'Pelvic Tilts', duration: 30, description: 'Flatten and arch lower back' },
  ],
  [StretchBodyArea.Hips]: [
    { name: 'Hip Flexor Stretch', duration: 45, description: 'Lunge position, push hips forward' },
    { name: 'Pigeon Pose', duration: 60, description: 'One leg forward, other extended back' },
    { name: 'Figure Four Stretch', duration: 45, description: 'Ankle on opposite knee, pull through' },
  ],
  [StretchBodyArea.Legs]: [
    { name: 'Standing Quad Stretch', duration: 30, description: 'Pull heel to glute, balance' },
    { name: 'Hamstring Stretch', duration: 45, description: 'Straighten leg, reach for toes' },
    { name: 'Calf Stretch', duration: 30, description: 'Push against wall, heel down' },
  ],
  [StretchBodyArea.FullBody]: [
    { name: 'Standing Forward Fold', duration: 45, description: 'Fold at hips, let head hang' },
    { name: 'World\'s Greatest Stretch', duration: 60, description: 'Lunge, rotate, reach up' },
    { name: 'Downward Dog', duration: 45, description: 'Inverted V, press heels down' },
    { name: 'Standing Side Stretch', duration: 30, description: 'Reach over, stretch side body' },
  ],
};

const StretchPage: React.FC = () => {
  const router = useRouter();
  const currentUser = useUser();
  
  // Configuration state
  const [currentStep, setCurrentStep] = useState<StretchStep>(StretchStep.BodyAreas);
  const [selectedAreas, setSelectedAreas] = useState<StretchBodyArea[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<StretchDurationPreset | null>(null);
  
  // Active stretch state
  const [stretchQueue, setStretchQueue] = useState<{ name: string; duration: number; description: string; area: string }[]>([]);
  const [currentStretchIndex, setCurrentStretchIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [totalElapsed, setTotalElapsed] = useState(0);
  
  // Timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  // Stretch category color (Purple)
  const stretchColor = '#A855F7';

  const handleBack = () => {
    switch (currentStep) {
      case StretchStep.BodyAreas:
        router.back();
        break;
      case StretchStep.Duration:
        setCurrentStep(StretchStep.BodyAreas);
        break;
      case StretchStep.Active:
        // Can't go back during active stretch
        break;
      case StretchStep.Complete:
        router.push('/');
        break;
    }
  };

  const toggleBodyArea = (area: StretchBodyArea) => {
    setSelectedAreas(prev => {
      if (prev.includes(area)) {
        return prev.filter(a => a !== area);
      }
      // Allow up to 3 areas or Full Body alone
      if (area === StretchBodyArea.FullBody) {
        return [StretchBodyArea.FullBody];
      }
      if (prev.includes(StretchBodyArea.FullBody)) {
        return [area];
      }
      if (prev.length < 3) {
        return [...prev, area];
      }
      return prev;
    });
  };

  const handleContinueTouration = () => {
    if (selectedAreas.length > 0) {
      setCurrentStep(StretchStep.Duration);
    }
  };

  const buildStretchQueue = () => {
    const queue: { name: string; duration: number; description: string; area: string }[] = [];
    
    // Get stretches for selected areas
    selectedAreas.forEach(area => {
      const areaStretches = STRETCHES[area] || [];
      areaStretches.forEach(stretch => {
        queue.push({ ...stretch, area });
      });
    });

    // Adjust durations to fit selected time
    const targetDuration = (selectedDuration || 10) * 60; // seconds
    let totalDuration = queue.reduce((sum, s) => sum + s.duration, 0);
    
    // Scale durations if needed
    if (totalDuration > 0) {
      const scale = Math.min(targetDuration / totalDuration, 2); // Don't extend more than 2x
      queue.forEach(stretch => {
        stretch.duration = Math.round(stretch.duration * scale);
      });
    }

    return queue;
  };

  const startStretchSession = () => {
    const queue = buildStretchQueue();
    setStretchQueue(queue);
    setCurrentStretchIndex(0);
    setTimeRemaining(queue[0]?.duration || 30);
    setTotalElapsed(0);
    startTimeRef.current = new Date();
    setCurrentStep(StretchStep.Active);
  };

  // Timer effect
  useEffect(() => {
    if (currentStep === StretchStep.Active && !isPaused && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Move to next stretch
            if (currentStretchIndex < stretchQueue.length - 1) {
              setCurrentStretchIndex(i => i + 1);
              return stretchQueue[currentStretchIndex + 1]?.duration || 30;
            } else {
              // Complete
              setCurrentStep(StretchStep.Complete);
              return 0;
            }
          }
          return prev - 1;
        });
        setTotalElapsed(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [currentStep, isPaused, timeRemaining, currentStretchIndex, stretchQueue]);

  const skipStretch = () => {
    if (currentStretchIndex < stretchQueue.length - 1) {
      setCurrentStretchIndex(i => i + 1);
      setTimeRemaining(stretchQueue[currentStretchIndex + 1]?.duration || 30);
    } else {
      setCurrentStep(StretchStep.Complete);
    }
  };

  const handleSaveSummary = async () => {
    if (!currentUser?.id) {
      router.push('/');
      return;
    }

    const summary: StretchSummary = new StretchSummary({
      id: uuidv4(),
      userId: currentUser.id,
      title: `${selectedAreas.length === 1 ? selectedAreas[0] : 'Multi-Area'} Stretch`,
      bodyAreas: selectedAreas,
      stretchCount: stretchQueue.length,
      duration: totalElapsed,
      caloriesBurned: Math.round(totalElapsed / 60 * 3), // ~3 cal/min for stretching
      startTime: startTimeRef.current || new Date(),
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      pulsePoints: new PulsePoints({}),
      isCompleted: true
    });

    try {
      await fetch('/.netlify/functions/save-stretch-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(summary.toDictionary())
      });
    } catch (e) {
      console.error('Failed to save stretch summary:', e);
    }

    router.push('/');
  };

  // Render content based on step
  const renderContent = () => {
    switch (currentStep) {
      case StretchStep.BodyAreas:
        return (
          <div className="space-y-4">
            <p className="text-zinc-400 mb-6">Select up to 3 areas to stretch, or choose Full Body</p>
            <div className="grid grid-cols-2 gap-3">
              {Object.values(StretchBodyArea).map(area => (
                <button
                  key={area}
                  onClick={() => toggleBodyArea(area)}
                  className={`
                    p-4 rounded-2xl text-left transition-all
                    ${selectedAreas.includes(area) 
                      ? 'bg-purple-500/20 border-2 border-purple-500' 
                      : 'bg-zinc-800/50 border-2 border-transparent hover:bg-zinc-800'
                    }
                  `}
                >
                  <div className="text-2xl mb-2">
                    {getAreaEmoji(area)}
                  </div>
                  <div className="font-semibold text-white">{area}</div>
                  <div className="text-xs text-zinc-500">{StretchBodyAreaInfo[area].bodyParts.length} stretches</div>
                </button>
              ))}
            </div>

            <button
              onClick={handleContinueTouration}
              disabled={selectedAreas.length === 0}
              className="w-full mt-6 py-4 rounded-full font-bold text-lg text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: stretchColor }}
            >
              Continue
            </button>
          </div>
        );

      case StretchStep.Duration:
        return (
          <div className="space-y-4">
            <p className="text-zinc-400 mb-6">How long do you want to stretch?</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.values(StretchDurationPreset).map(duration => (
                <button
                  key={duration}
                  onClick={() => setSelectedDuration(duration)}
                  className={`
                    p-6 rounded-2xl text-center transition-all
                    ${selectedDuration === duration 
                      ? 'bg-purple-500/20 border-2 border-purple-500' 
                      : 'bg-zinc-800/50 border-2 border-transparent hover:bg-zinc-800'
                    }
                  `}
                >
                  <div className="text-3xl font-bold" style={{ color: stretchColor }}>{duration}</div>
                  <div className="text-sm text-zinc-400">minutes</div>
                </button>
              ))}
            </div>

            <button
              onClick={startStretchSession}
              disabled={!selectedDuration}
              className="w-full mt-6 py-4 rounded-full font-bold text-lg text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ backgroundColor: stretchColor }}
            >
              <Play className="w-6 h-6" fill="white" />
              Start Stretching
            </button>
          </div>
        );

      case StretchStep.Active:
        const currentStretch = stretchQueue[currentStretchIndex];
        const progress = stretchQueue.length > 0 ? (currentStretchIndex + 1) / stretchQueue.length : 0;
        
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            {/* Progress */}
            <div className="w-full max-w-md mb-8">
              <div className="flex justify-between text-sm text-zinc-400 mb-2">
                <span>Stretch {currentStretchIndex + 1} of {stretchQueue.length}</span>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progress * 100}%`, backgroundColor: stretchColor }}
                />
              </div>
            </div>

            {/* Current Stretch */}
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">{getAreaEmoji(currentStretch?.area || '')}</div>
              <h2 className="text-2xl font-bold text-white mb-2">{currentStretch?.name}</h2>
              <p className="text-zinc-400">{currentStretch?.description}</p>
            </div>

            {/* Timer */}
            <div 
              className="w-40 h-40 rounded-full border-4 flex items-center justify-center mb-8"
              style={{ borderColor: stretchColor }}
            >
              <span className="text-5xl font-bold text-white font-mono">
                {timeRemaining}
              </span>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-6">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: stretchColor }}
              >
                {isPaused ? (
                  <Play className="w-8 h-8 text-white ml-1" fill="white" />
                ) : (
                  <Pause className="w-8 h-8 text-white" fill="white" />
                )}
              </button>
              <button
                onClick={skipStretch}
                className="w-14 h-14 rounded-full bg-zinc-700 flex items-center justify-center hover:bg-zinc-600"
              >
                <SkipForward className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>
        );

      case StretchStep.Complete:
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div 
              className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
              style={{ backgroundColor: `${stretchColor}20` }}
            >
              <CheckCircle className="w-12 h-12" style={{ color: stretchColor }} />
            </div>
            
            <h1 className="text-3xl font-bold text-white mb-2">Great Stretch! 🧘</h1>
            <p className="text-zinc-400 mb-8">You completed {stretchQueue.length} stretches</p>

            <div className="bg-zinc-800/50 rounded-2xl p-6 w-full max-w-sm mb-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {Math.floor(totalElapsed / 60)}:{(totalElapsed % 60).toString().padStart(2, '0')}
                  </div>
                  <div className="text-sm text-zinc-500">Duration</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    ~{Math.round(totalElapsed / 60 * 3)}
                  </div>
                  <div className="text-sm text-zinc-500">Calories</div>
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveSummary}
              className="w-full max-w-sm py-4 rounded-full font-bold text-lg text-white"
              style={{ backgroundColor: stretchColor }}
            >
              Save & Finish
            </button>
          </div>
        );
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case StretchStep.BodyAreas:
        return 'What areas need attention?';
      case StretchStep.Duration:
        return 'How long?';
      case StretchStep.Active:
        return 'Follow Along';
      case StretchStep.Complete:
        return 'Complete!';
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900">
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: stretchColor }}
        />
      </div>

      {/* Content */}
      <div className="relative max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        {currentStep !== StretchStep.Active && (
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={handleBack}
              className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">{getStepTitle()}</h1>
            </div>
          </div>
        )}

        {renderContent()}
      </div>
    </div>
  );
};

// Helper to get emoji for body area
const getAreaEmoji = (area: string): string => {
  switch (area) {
    case StretchBodyArea.Neck: return '🦒';
    case StretchBodyArea.Shoulders: return '💪';
    case StretchBodyArea.Arms: return '🙌';
    case StretchBodyArea.Chest: return '🫁';
    case StretchBodyArea.UpperBack: return '🔙';
    case StretchBodyArea.LowerBack: return '🏋️';
    case StretchBodyArea.Hips: return '🦵';
    case StretchBodyArea.Legs: return '🦿';
    case StretchBodyArea.FullBody: return '🧘';
    default: return '🙆';
  }
};

export default StretchPage;
