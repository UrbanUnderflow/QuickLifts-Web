import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Pause, Play, Square, X, ChevronDown } from 'lucide-react';
import { 
  RunType, 
  RunLocation, 
  RunConfiguration,
  RunSummary,
  PulsePoints,
  DistancePresetMiles,
  TimePresetSeconds,
  CalorieDataSource
} from '../../api/firebase/workout/types';
import { useUser } from '../../hooks/useUser';
import { v4 as uuidv4 } from 'uuid';

// Run State
enum RunState {
  NotStarted = 'notStarted',
  Running = 'running',
  Paused = 'paused',
  Completed = 'completed'
}

// Interval Phase
enum IntervalPhase {
  Run = 'run',
  Walk = 'walk'
}

const ActiveRunPage: React.FC = () => {
  const router = useRouter();
  const currentUser = useUser();
  
  // Parse configuration from query
  const [config, setConfig] = useState<RunConfiguration | null>(null);
  
  // Run state
  const [runState, setRunState] = useState<RunState>(RunState.NotStarted);
  const [elapsedTime, setElapsedTime] = useState(0); // seconds
  const [distance, setDistance] = useState(0); // miles (manual entry for web)
  const [manualDistanceInput, setManualDistanceInput] = useState('');
  const [calories, setCalories] = useState(0);
  
  // Interval tracking
  const [currentPhase, setCurrentPhase] = useState<IntervalPhase>(IntervalPhase.Run);
  const [phaseTimeRemaining, setPhaseTimeRemaining] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  
  // Countdown
  const [showCountdown, setShowCountdown] = useState(true);
  const [countdownValue, setCountdownValue] = useState(3);
  
  // Modals
  const [showEndConfirmation, setShowEndConfirmation] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  
  // Timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  // Run category color (Blue)
  const runColor = '#3B82F6';

  // Parse config on mount
  useEffect(() => {
    if (router.query.config) {
      try {
        const parsed = JSON.parse(router.query.config as string);
        setConfig(parsed);
        
        // Initialize interval tracking if intervals mode
        if (parsed.runType === RunType.Intervals && parsed.intervalConfig) {
          setPhaseTimeRemaining(parsed.intervalConfig.runDurationSeconds);
        }
      } catch (e) {
        console.error('Failed to parse run config:', e);
        router.back();
      }
    }
  }, [router.query.config, router]);

  // Countdown effect
  useEffect(() => {
    if (showCountdown && countdownValue > 0) {
      const timeout = setTimeout(() => {
        setCountdownValue(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timeout);
    } else if (showCountdown && countdownValue === 0) {
      setShowCountdown(false);
      startRun();
    }
  }, [showCountdown, countdownValue]);

  // Timer effect
  useEffect(() => {
    if (runState === RunState.Running) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
        
        // Update calories estimate (rough: ~100 cal per 10 min running)
        setCalories(prev => {
          const newElapsed = elapsedTime + 1;
          return Math.round(newElapsed / 60 * 10); // ~10 cal/min
        });
        
        // Handle interval phase transitions
        if (config?.runType === RunType.Intervals && config.intervalConfig) {
          setPhaseTimeRemaining(prev => {
            if (prev <= 1) {
              // Switch phase
              if (currentPhase === IntervalPhase.Run) {
                setCurrentPhase(IntervalPhase.Walk);
                return config.intervalConfig!.walkDurationSeconds;
              } else {
                // End of walk phase - new round
                if (currentRound < config.intervalConfig!.numberOfRounds) {
                  setCurrentRound(r => r + 1);
                  setCurrentPhase(IntervalPhase.Run);
                  return config.intervalConfig!.runDurationSeconds;
                } else {
                  // Intervals complete
                  completeRun();
                  return 0;
                }
              }
            }
            return prev - 1;
          });
        }
        
        // Check time goal
        if (config?.runType === RunType.Time) {
          const targetSeconds = config.customDurationSeconds || 
            (config.timePreset ? TimePresetSeconds[config.timePreset] : null);
          if (targetSeconds && elapsedTime + 1 >= targetSeconds) {
            completeRun();
          }
        }
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [runState, elapsedTime, currentPhase, currentRound, config]);

  const startRun = () => {
    setRunState(RunState.Running);
    startTimeRef.current = new Date();
  };

  const pauseRun = () => {
    setRunState(RunState.Paused);
  };

  const resumeRun = () => {
    setRunState(RunState.Running);
  };

  const completeRun = useCallback(() => {
    setRunState(RunState.Completed);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Build run summary
    const summary: RunSummary = new RunSummary({
      id: uuidv4(),
      userId: currentUser?.id || '',
      runType: config?.runType || RunType.FreeRun,
      location: config?.location || RunLocation.Outdoor,
      title: `${config?.runType || 'Free'} Run`,
      distance: distance,
      duration: elapsedTime,
      averagePace: distance > 0 ? elapsedTime / 60 / distance : 0,
      caloriesBurned: calories,
      calorieSource: CalorieDataSource.Algorithm,
      targetDistance: config?.customDistanceMiles || 
        (config?.distancePreset ? DistancePresetMiles[config.distancePreset] : undefined),
      targetDuration: config?.customDurationSeconds ||
        (config?.timePreset ? TimePresetSeconds[config.timePreset] : undefined),
      intervalConfig: config?.intervalConfig,
      completedIntervals: config?.runType === RunType.Intervals ? currentRound : undefined,
      startTime: startTimeRef.current || new Date(),
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      pulsePoints: new PulsePoints({}),
      isCompleted: true
    });

    // Navigate to summary page with data
    router.push({
      pathname: '/run/summary',
      query: { summary: JSON.stringify(summary.toDictionary()) }
    });
  }, [config, currentUser, distance, elapsedTime, calories, currentRound, router]);

  const cancelRun = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    router.back();
  };

  // Format time as MM:SS or HH:MM:SS
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress for goal-based runs
  const calculateProgress = (): number => {
    if (!config) return 0;
    
    switch (config.runType) {
      case RunType.Distance:
        const targetDist = config.customDistanceMiles || 
          (config.distancePreset ? DistancePresetMiles[config.distancePreset] : null);
        return targetDist ? Math.min(distance / targetDist, 1) : 0;
      
      case RunType.Time:
        const targetTime = config.customDurationSeconds ||
          (config.timePreset ? TimePresetSeconds[config.timePreset] : null);
        return targetTime ? Math.min(elapsedTime / targetTime, 1) : 0;
      
      case RunType.Intervals:
        if (config.intervalConfig) {
          return (currentRound - 1 + (currentPhase === IntervalPhase.Walk ? 0.5 : 0)) / config.intervalConfig.numberOfRounds;
        }
        return 0;
      
      default:
        return 0;
    }
  };

  // Countdown overlay
  if (showCountdown) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div 
            className="text-9xl font-bold mb-4 animate-pulse"
            style={{ color: runColor }}
          >
            {countdownValue || 'GO!'}
          </div>
          <p className="text-zinc-400 text-xl">Get ready to run!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col">
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-3xl opacity-10"
          style={{ backgroundColor: runColor }}
        />
      </div>

      {/* Header */}
      <div className="relative p-4 flex items-center justify-between">
        <button
          onClick={() => setShowCancelConfirmation(true)}
          className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700"
        >
          <ChevronDown className="w-5 h-5 text-white" />
        </button>
        
        <div className="text-center">
          <div className="text-sm text-zinc-400">
            {config?.location === RunLocation.Outdoor ? '🌳 Outdoor' : '🏃 Treadmill'} • {config?.runType}
          </div>
        </div>
        
        <div className="w-10" /> {/* Spacer */}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 relative">
        {/* Time Display */}
        <div className="text-center mb-8">
          <div 
            className="text-7xl sm:text-8xl font-bold font-mono tracking-tight"
            style={{ color: 'white' }}
          >
            {formatTime(elapsedTime)}
          </div>
          
          {/* Status indicator */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <div 
              className={`w-3 h-3 rounded-full ${
                runState === RunState.Running ? 'animate-pulse' : ''
              }`}
              style={{ backgroundColor: runState === RunState.Running ? runColor : '#f97316' }}
            />
            <span className="text-zinc-400 font-medium">
              {runState === RunState.Running ? 'Running' : 'Paused'}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 w-full max-w-md mb-8">
          <StatBox label="Distance" value={`${distance.toFixed(2)}`} unit="mi" color={runColor} />
          <StatBox label="Pace" value={distance > 0 ? formatPace(elapsedTime / 60 / distance) : '--:--'} unit="/mi" color={runColor} />
          <StatBox label="Calories" value={calories.toString()} unit="cal" color={runColor} />
        </div>

        {/* Distance Input (for web - no GPS) */}
        <div className="w-full max-w-md mb-8">
          <label className="text-sm text-zinc-400 mb-2 block text-center">Enter distance manually</label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              value={manualDistanceInput}
              onChange={(e) => setManualDistanceInput(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-center text-xl font-mono focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => {
                const val = parseFloat(manualDistanceInput);
                if (!isNaN(val)) {
                  setDistance(val);
                }
              }}
              className="px-6 py-3 bg-zinc-700 text-white rounded-xl font-semibold hover:bg-zinc-600"
            >
              Set
            </button>
          </div>
        </div>

        {/* Progress Bar (for goal-based runs) */}
        {config?.runType !== RunType.FreeRun && (
          <div className="w-full max-w-md mb-8">
            <div className="flex justify-between text-sm text-zinc-400 mb-2">
              <span>{config?.runType === RunType.Intervals ? `Round ${currentRound}/${config?.intervalConfig?.numberOfRounds}` : 'Progress'}</span>
              <span>{Math.round(calculateProgress() * 100)}%</span>
            </div>
            <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${calculateProgress() * 100}%`,
                  backgroundColor: runColor 
                }}
              />
            </div>
          </div>
        )}

        {/* Interval Phase Indicator */}
        {config?.runType === RunType.Intervals && (
          <div className="text-center mb-8">
            <div 
              className="text-3xl font-bold mb-2"
              style={{ color: currentPhase === IntervalPhase.Run ? runColor : '#f97316' }}
            >
              {currentPhase === IntervalPhase.Run ? '🏃 RUN' : '🚶 WALK'}
            </div>
            <div className="text-5xl font-mono font-bold text-white">
              {formatTime(phaseTimeRemaining)}
            </div>
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="p-6 pb-10">
        <div className="flex items-center justify-center gap-6">
          {/* Cancel button */}
          <button
            onClick={() => setShowCancelConfirmation(true)}
            className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700"
          >
            <X className="w-7 h-7 text-zinc-400" />
          </button>

          {/* Play/Pause button */}
          <button
            onClick={runState === RunState.Running ? pauseRun : resumeRun}
            className="w-20 h-20 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
            style={{ backgroundColor: runColor }}
          >
            {runState === RunState.Running ? (
              <Pause className="w-10 h-10 text-white" fill="white" />
            ) : (
              <Play className="w-10 h-10 text-white ml-1" fill="white" />
            )}
          </button>

          {/* End button */}
          <button
            onClick={() => setShowEndConfirmation(true)}
            className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center hover:bg-red-500/30"
          >
            <Square className="w-7 h-7 text-red-400" fill="currentColor" />
          </button>
        </div>
      </div>

      {/* End Confirmation Modal */}
      {showEndConfirmation && (
        <ConfirmationModal
          title="End Run?"
          message="Are you sure you want to end this run? Your progress will be saved."
          confirmText="End Run"
          confirmColor="#3B82F6"
          onConfirm={completeRun}
          onCancel={() => setShowEndConfirmation(false)}
        />
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirmation && (
        <ConfirmationModal
          title="Cancel Run?"
          message="Are you sure you want to cancel? Your progress will be lost."
          confirmText="Cancel Run"
          confirmColor="#EF4444"
          onConfirm={cancelRun}
          onCancel={() => setShowCancelConfirmation(false)}
        />
      )}
    </div>
  );
};

// Stat Box Component
interface StatBoxProps {
  label: string;
  value: string;
  unit: string;
  color: string;
}

const StatBox: React.FC<StatBoxProps> = ({ label, value, unit, color }) => (
  <div className="bg-zinc-800/50 rounded-2xl p-4 text-center">
    <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">{label}</div>
    <div className="flex items-baseline justify-center gap-1">
      <span className="text-2xl font-bold text-white">{value}</span>
      <span className="text-sm text-zinc-400">{unit}</span>
    </div>
  </div>
);

// Format pace as MM:SS
const formatPace = (paceMinPerMile: number): string => {
  if (!isFinite(paceMinPerMile) || paceMinPerMile <= 0) return '--:--';
  const mins = Math.floor(paceMinPerMile);
  const secs = Math.round((paceMinPerMile - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Confirmation Modal Component
interface ConfirmationModalProps {
  title: string;
  message: string;
  confirmText: string;
  confirmColor: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  title,
  message,
  confirmText,
  confirmColor,
  onConfirm,
  onCancel
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
    <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full border border-zinc-800">
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-zinc-400 mb-6">{message}</p>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl bg-zinc-800 text-white font-semibold hover:bg-zinc-700"
        >
          Go Back
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-3 rounded-xl font-semibold text-white"
          style={{ backgroundColor: confirmColor }}
        >
          {confirmText}
        </button>
      </div>
    </div>
  </div>
);

export default ActiveRunPage;
