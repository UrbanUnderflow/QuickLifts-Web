import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeft, Play, Pause, Square, ChevronRight, Target, Clock, Flame, TrendingUp, CheckCircle, Camera } from 'lucide-react';
import { 
  FatBurnEquipment,
  FatBurnEquipmentInfo,
  FatBurnGoalType,
  FatBurnTimePreset,
  FatBurnTimePresetSeconds,
  FatBurnDistancePreset,
  FatBurnDistancePresetMiles,
  FatBurnFloorsPreset,
  FatBurnFloorsPresetCount,
  FatBurnConfiguration,
  FatBurnSummary,
  TreadmillMode,
  PulsePoints,
  CalorieDataSource
} from '../api/firebase/workout/types';
import { useUser } from '../hooks/useUser';
import { v4 as uuidv4 } from 'uuid';

// Configuration step enum
enum FatBurnStep {
  Equipment = 'equipment',
  TreadmillMode = 'treadmillMode',
  GoalType = 'goalType',
  GoalValue = 'goalValue',
  Active = 'active',
  Entry = 'entry',
  Complete = 'complete'
}

const FatBurnPage: React.FC = () => {
  const router = useRouter();
  const currentUser = useUser();
  
  // Configuration state
  const [currentStep, setCurrentStep] = useState<FatBurnStep>(FatBurnStep.Equipment);
  const [equipment, setEquipment] = useState<FatBurnEquipment | null>(null);
  const [treadmillMode, setTreadmillMode] = useState<TreadmillMode | null>(null);
  const [goalType, setGoalType] = useState<FatBurnGoalType | null>(null);
  const [timePreset, setTimePreset] = useState<FatBurnTimePreset | null>(null);
  const [distancePreset, setDistancePreset] = useState<FatBurnDistancePreset | null>(null);
  const [floorsPreset, setFloorsPreset] = useState<FatBurnFloorsPreset | null>(null);
  const [customValue, setCustomValue] = useState<string>('');
  
  // Active session state
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  // Manual entry state (after session)
  const [entryCalories, setEntryCalories] = useState<string>('');
  const [entryDistance, setEntryDistance] = useState<string>('');
  const [entryFloors, setEntryFloors] = useState<string>('');
  const [entrySteps, setEntrySteps] = useState<string>('');
  const [machineLevel, setMachineLevel] = useState<string>('');
  
  // Timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  // Fat Burn category color (Orange)
  const fatBurnColor = '#F97316';

  const handleBack = () => {
    switch (currentStep) {
      case FatBurnStep.Equipment:
        router.back();
        break;
      case FatBurnStep.TreadmillMode:
        setCurrentStep(FatBurnStep.Equipment);
        break;
      case FatBurnStep.GoalType:
        if (equipment === FatBurnEquipment.Treadmill) {
          setCurrentStep(FatBurnStep.TreadmillMode);
        } else {
          setCurrentStep(FatBurnStep.Equipment);
        }
        break;
      case FatBurnStep.GoalValue:
        setCurrentStep(FatBurnStep.GoalType);
        break;
      case FatBurnStep.Active:
        // Show confirmation before going back during active session
        break;
      case FatBurnStep.Entry:
        // Can't go back from entry
        break;
      case FatBurnStep.Complete:
        router.push('/');
        break;
    }
  };

  const handleEquipmentSelect = (eq: FatBurnEquipment) => {
    setEquipment(eq);
    if (eq === FatBurnEquipment.Treadmill) {
      setCurrentStep(FatBurnStep.TreadmillMode);
    } else {
      setCurrentStep(FatBurnStep.GoalType);
    }
  };

  const handleTreadmillModeSelect = (mode: TreadmillMode) => {
    setTreadmillMode(mode);
    setCurrentStep(FatBurnStep.GoalType);
  };

  const handleGoalTypeSelect = (type: FatBurnGoalType) => {
    setGoalType(type);
    if (type === FatBurnGoalType.FreeSession) {
      startSession();
    } else {
      setCurrentStep(FatBurnStep.GoalValue);
    }
  };

  const getAvailableGoalTypes = (): FatBurnGoalType[] => {
    const types = [FatBurnGoalType.FreeSession, FatBurnGoalType.TimeGoal];
    
    if (equipment === FatBurnEquipment.Treadmill || 
        equipment === FatBurnEquipment.Elliptical || 
        equipment === FatBurnEquipment.StationaryBike) {
      types.push(FatBurnGoalType.DistanceGoal);
    }
    
    if (equipment === FatBurnEquipment.Stairmaster) {
      types.push(FatBurnGoalType.FloorsGoal);
    }
    
    return types;
  };

  const startSession = () => {
    startTimeRef.current = new Date();
    setElapsedTime(0);
    setCurrentStep(FatBurnStep.Active);
  };

  // Timer effect
  useEffect(() => {
    if (currentStep === FatBurnStep.Active && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
        
        // Check time goal
        if (goalType === FatBurnGoalType.TimeGoal) {
          const targetSeconds = timePreset === FatBurnTimePreset.Custom 
            ? parseInt(customValue) * 60 
            : FatBurnTimePresetSeconds[timePreset!];
          
          if (targetSeconds && elapsedTime + 1 >= targetSeconds) {
            endSession();
          }
        }
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [currentStep, isPaused, elapsedTime, goalType, timePreset, customValue]);

  const endSession = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setCurrentStep(FatBurnStep.Entry);
  };

  const handleSaveSummary = async () => {
    if (!currentUser?.id || !equipment) {
      router.push('/');
      return;
    }

    const summary: FatBurnSummary = new FatBurnSummary({
      id: uuidv4(),
      userId: currentUser.id,
      equipment: equipment,
      goalType: goalType || FatBurnGoalType.FreeSession,
      title: `${equipment} Session`,
      machineLevel: machineLevel ? parseInt(machineLevel) : undefined,
      duration: elapsedTime,
      caloriesBurned: entryCalories ? parseInt(entryCalories) : Math.round(elapsedTime / 60 * 8),
      calorieSource: entryCalories ? CalorieDataSource.Manual : CalorieDataSource.Algorithm,
      distance: entryDistance ? parseFloat(entryDistance) : undefined,
      floorsClimbed: entryFloors ? parseInt(entryFloors) : undefined,
      totalSteps: entrySteps ? parseInt(entrySteps) : undefined,
      targetDuration: goalType === FatBurnGoalType.TimeGoal 
        ? (timePreset === FatBurnTimePreset.Custom ? parseInt(customValue) * 60 : FatBurnTimePresetSeconds[timePreset!] || undefined)
        : undefined,
      targetDistance: goalType === FatBurnGoalType.DistanceGoal
        ? (distancePreset === FatBurnDistancePreset.Custom ? parseFloat(customValue) : FatBurnDistancePresetMiles[distancePreset!] || undefined)
        : undefined,
      targetFloors: goalType === FatBurnGoalType.FloorsGoal
        ? (floorsPreset === FatBurnFloorsPreset.Custom ? parseInt(customValue) : FatBurnFloorsPresetCount[floorsPreset!] || undefined)
        : undefined,
      startTime: startTimeRef.current || new Date(),
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      pulsePoints: new PulsePoints({}),
      isCompleted: true,
      syncedToHealthKit: false
    });

    try {
      await fetch('/.netlify/functions/save-fatburn-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(summary.toDictionary())
      });
    } catch (e) {
      console.error('Failed to save fat burn summary:', e);
    }

    setCurrentStep(FatBurnStep.Complete);
  };

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderContent = () => {
    switch (currentStep) {
      case FatBurnStep.Equipment:
        return (
          <div className="space-y-4">
            <p className="text-zinc-400 mb-6">Select your cardio equipment</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.values(FatBurnEquipment).map(eq => {
                const info = FatBurnEquipmentInfo[eq];
                return (
                  <button
                    key={eq}
                    onClick={() => handleEquipmentSelect(eq)}
                    className={`
                      flex items-center gap-4 p-5 rounded-2xl text-left transition-all
                      ${equipment === eq 
                        ? 'bg-orange-500/20 border-2 border-orange-500' 
                        : 'bg-zinc-800/50 border-2 border-transparent hover:bg-zinc-800'
                      }
                    `}
                  >
                    <div 
                      className="w-14 h-14 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${info.color}20`, color: info.color }}
                    >
                      {getEquipmentIcon(eq)}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-white text-lg">{eq}</div>
                      <div className="text-sm text-zinc-400">{info.description}</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-zinc-500" />
                  </button>
                );
              })}
            </div>
          </div>
        );

      case FatBurnStep.TreadmillMode:
        return (
          <div className="space-y-4">
            <p className="text-zinc-400 mb-6">Running or walking?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <OptionCard
                icon={
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/>
                  </svg>
                }
                title="Run"
                subtitle="Running pace"
                isSelected={treadmillMode === TreadmillMode.Run}
                color={fatBurnColor}
                onClick={() => handleTreadmillModeSelect(TreadmillMode.Run)}
              />
              <OptionCard
                icon={
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/>
                  </svg>
                }
                title="Walk"
                subtitle="Walking pace"
                isSelected={treadmillMode === TreadmillMode.Walk}
                color={fatBurnColor}
                onClick={() => handleTreadmillModeSelect(TreadmillMode.Walk)}
              />
            </div>
          </div>
        );

      case FatBurnStep.GoalType:
        const availableGoals = getAvailableGoalTypes();
        return (
          <div className="space-y-4">
            <p className="text-zinc-400 mb-6">What&apos;s your goal?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {availableGoals.map(type => (
                <button
                  key={type}
                  onClick={() => handleGoalTypeSelect(type)}
                  className={`
                    flex items-center gap-4 p-5 rounded-2xl text-left transition-all
                    bg-zinc-800/50 border-2 border-transparent hover:bg-zinc-800
                  `}
                >
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${fatBurnColor}20`, color: fatBurnColor }}
                  >
                    {getGoalIcon(type)}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-white">{type}</div>
                    <div className="text-sm text-zinc-400">{getGoalDescription(type)}</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-500" />
                </button>
              ))}
            </div>
          </div>
        );

      case FatBurnStep.GoalValue:
        return (
          <div className="space-y-4">
            {goalType === FatBurnGoalType.TimeGoal && (
              <>
                <p className="text-zinc-400 mb-6">Set your time goal</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.values(FatBurnTimePreset).filter(p => p !== FatBurnTimePreset.Custom).map(preset => (
                    <button
                      key={preset}
                      onClick={() => {
                        setTimePreset(preset);
                        startSession();
                      }}
                      className="p-4 rounded-xl text-center bg-zinc-800/50 hover:bg-zinc-800"
                    >
                      <div className="text-xl font-bold" style={{ color: fatBurnColor }}>{preset}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-6">
                  <label className="text-sm text-zinc-400 mb-2 block">Custom (minutes)</label>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      value={customValue}
                      onChange={(e) => {
                        setCustomValue(e.target.value);
                        setTimePreset(FatBurnTimePreset.Custom);
                      }}
                      placeholder="e.g., 25"
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white"
                    />
                    <button
                      onClick={() => customValue && startSession()}
                      disabled={!customValue}
                      className="px-6 py-3 text-white rounded-xl font-semibold disabled:opacity-50"
                      style={{ backgroundColor: fatBurnColor }}
                    >
                      Start
                    </button>
                  </div>
                </div>
              </>
            )}

            {goalType === FatBurnGoalType.DistanceGoal && (
              <>
                <p className="text-zinc-400 mb-6">Set your distance goal</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.values(FatBurnDistancePreset).filter(p => p !== FatBurnDistancePreset.Custom).map(preset => (
                    <button
                      key={preset}
                      onClick={() => {
                        setDistancePreset(preset);
                        startSession();
                      }}
                      className="p-4 rounded-xl text-center bg-zinc-800/50 hover:bg-zinc-800"
                    >
                      <div className="text-xl font-bold" style={{ color: fatBurnColor }}>{preset}</div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {goalType === FatBurnGoalType.FloorsGoal && (
              <>
                <p className="text-zinc-400 mb-6">Set your floors goal</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.values(FatBurnFloorsPreset).filter(p => p !== FatBurnFloorsPreset.Custom).map(preset => (
                    <button
                      key={preset}
                      onClick={() => {
                        setFloorsPreset(preset);
                        startSession();
                      }}
                      className="p-4 rounded-xl text-center bg-zinc-800/50 hover:bg-zinc-800"
                    >
                      <div className="text-xl font-bold" style={{ color: fatBurnColor }}>{preset}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        );

      case FatBurnStep.Active:
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            {/* Equipment indicator */}
            <div className="text-center mb-6">
              <div className="text-5xl mb-2">{getEquipmentEmoji(equipment!)}</div>
              <div className="text-zinc-400">{equipment}</div>
            </div>

            {/* Timer */}
            <div className="text-8xl font-bold text-white font-mono mb-8">
              {formatTime(elapsedTime)}
            </div>

            {/* Status */}
            <div className="flex items-center gap-2 mb-8">
              <div 
                className={`w-3 h-3 rounded-full ${isPaused ? '' : 'animate-pulse'}`}
                style={{ backgroundColor: isPaused ? '#f97316' : fatBurnColor }}
              />
              <span className="text-zinc-400">{isPaused ? 'Paused' : 'In Progress'}</span>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-6">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ backgroundColor: fatBurnColor }}
              >
                {isPaused ? (
                  <Play className="w-10 h-10 text-white ml-1" fill="white" />
                ) : (
                  <Pause className="w-10 h-10 text-white" fill="white" />
                )}
              </button>
              <button
                onClick={endSession}
                className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center hover:bg-red-500/30"
              >
                <Square className="w-7 h-7 text-red-400" fill="currentColor" />
              </button>
            </div>
          </div>
        );

      case FatBurnStep.Entry:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="text-5xl mb-4">{getEquipmentEmoji(equipment!)}</div>
              <h2 className="text-2xl font-bold text-white">Session Complete!</h2>
              <p className="text-zinc-400">Duration: {formatTime(elapsedTime)}</p>
            </div>

            <div className="bg-zinc-800/50 rounded-2xl p-6 space-y-4">
              <h3 className="text-white font-semibold mb-4">Enter your results from the machine</h3>
              
              <InputField
                label="Calories burned"
                value={entryCalories}
                onChange={setEntryCalories}
                placeholder="e.g., 250"
                type="number"
                icon={<Flame className="w-5 h-5" />}
              />

              {(equipment === FatBurnEquipment.Treadmill || 
                equipment === FatBurnEquipment.Elliptical || 
                equipment === FatBurnEquipment.StationaryBike) && (
                <InputField
                  label="Distance (miles)"
                  value={entryDistance}
                  onChange={setEntryDistance}
                  placeholder="e.g., 2.5"
                  type="number"
                  icon={<Target className="w-5 h-5" />}
                />
              )}

              {equipment === FatBurnEquipment.Stairmaster && (
                <>
                  <InputField
                    label="Floors climbed"
                    value={entryFloors}
                    onChange={setEntryFloors}
                    placeholder="e.g., 50"
                    type="number"
                    icon={<TrendingUp className="w-5 h-5" />}
                  />
                  <InputField
                    label="Total steps"
                    value={entrySteps}
                    onChange={setEntrySteps}
                    placeholder="e.g., 2500"
                    type="number"
                    icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M10 3H14V5H10V3ZM10 7H14V9H10V7ZM10 11H14V13H10V11ZM10 15H14V17H10V15ZM10 19H14V21H10V19Z"/></svg>}
                  />
                </>
              )}

              <InputField
                label="Machine level (optional)"
                value={machineLevel}
                onChange={setMachineLevel}
                placeholder="e.g., 8"
                type="number"
                icon={<span className="text-sm font-bold">LV</span>}
              />
            </div>

            <button
              onClick={handleSaveSummary}
              className="w-full py-4 rounded-full font-bold text-lg text-white"
              style={{ backgroundColor: fatBurnColor }}
            >
              Save Session
            </button>
          </div>
        );

      case FatBurnStep.Complete:
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div 
              className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
              style={{ backgroundColor: `${fatBurnColor}20` }}
            >
              <CheckCircle className="w-12 h-12" style={{ color: fatBurnColor }} />
            </div>
            
            <h1 className="text-3xl font-bold text-white mb-2">Great Burn! 🔥</h1>
            <p className="text-zinc-400 mb-8">Your {equipment} session has been saved</p>

            <div className="bg-zinc-800/50 rounded-2xl p-6 w-full max-w-sm mb-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{formatTime(elapsedTime)}</div>
                  <div className="text-sm text-zinc-500">Duration</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {entryCalories || Math.round(elapsedTime / 60 * 8)}
                  </div>
                  <div className="text-sm text-zinc-500">Calories</div>
                </div>
              </div>
            </div>

            <button
              onClick={() => router.push('/')}
              className="w-full max-w-sm py-4 rounded-full font-bold text-lg text-white"
              style={{ backgroundColor: fatBurnColor }}
            >
              Done
            </button>
          </div>
        );
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case FatBurnStep.Equipment: return 'Choose Equipment';
      case FatBurnStep.TreadmillMode: return 'Treadmill Mode';
      case FatBurnStep.GoalType: return 'Set Your Goal';
      case FatBurnStep.GoalValue: return 'Goal Target';
      case FatBurnStep.Active: return equipment || 'Fat Burn';
      case FatBurnStep.Entry: return 'Log Results';
      case FatBurnStep.Complete: return 'Complete!';
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900">
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: fatBurnColor }}
        />
      </div>

      {/* Content */}
      <div className="relative max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        {currentStep !== FatBurnStep.Active && (
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

// Helper Components
interface OptionCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  isSelected: boolean;
  color: string;
  onClick: () => void;
}

const OptionCard: React.FC<OptionCardProps> = ({ icon, title, subtitle, isSelected, color, onClick }) => (
  <button
    onClick={onClick}
    className={`
      flex items-center gap-4 p-5 rounded-2xl text-left transition-all
      ${isSelected 
        ? 'bg-orange-500/20 border-2 border-orange-500' 
        : 'bg-zinc-800/50 border-2 border-transparent hover:bg-zinc-800'
      }
    `}
  >
    <div 
      className="w-14 h-14 rounded-xl flex items-center justify-center"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {icon}
    </div>
    <div className="flex-1">
      <div className="font-semibold text-white text-lg">{title}</div>
      <div className="text-sm text-zinc-400">{subtitle}</div>
    </div>
    <ChevronRight className="w-5 h-5 text-zinc-500" />
  </button>
);

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  icon?: React.ReactNode;
}

const InputField: React.FC<InputFieldProps> = ({ label, value, onChange, placeholder, type = 'text', icon }) => (
  <div>
    <label className="text-sm text-zinc-400 mb-2 block">{label}</label>
    <div className="relative">
      {icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
          {icon}
        </div>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 ${icon ? 'pl-12 pr-4' : 'px-4'}`}
      />
    </div>
  </div>
);

// Helper functions
const getEquipmentIcon = (equipment: FatBurnEquipment): React.ReactNode => {
  switch (equipment) {
    case FatBurnEquipment.Stairmaster:
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 19h4v-4H4v4zM10 15h4v-4h-4v4zM16 11h4V7h-4v4z"/>
        </svg>
      );
    case FatBurnEquipment.Elliptical:
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="6" r="2"/>
          <path d="M21 16v-2c-2.24 0-4.16-.96-5.6-2.68l-1.34-1.6c-.38-.46-.94-.72-1.54-.72h-1.04c-.6 0-1.16.26-1.54.72l-1.34 1.6C7.16 13.04 5.24 14 3 14v2c2.77 0 5.19-1.17 7-3.08V15l-4 3v2h8v-2l-4-3v-2.08c1.81 1.91 4.23 3.08 7 3.08z"/>
        </svg>
      );
    case FatBurnEquipment.Treadmill:
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/>
        </svg>
      );
    case FatBurnEquipment.StationaryBike:
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1.2-1.4.6L7.8 8.4c-.4.4-.6.9-.6 1.4 0 .6.2 1.1.6 1.4L11 14v5h2v-6.2l-2.2-2.3zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"/>
        </svg>
      );
    default:
      return <Flame className="w-8 h-8" />;
  }
};

const getEquipmentEmoji = (equipment: FatBurnEquipment): string => {
  switch (equipment) {
    case FatBurnEquipment.Stairmaster: return '🪜';
    case FatBurnEquipment.Elliptical: return '🏃';
    case FatBurnEquipment.Treadmill: return '🏃‍♂️';
    case FatBurnEquipment.StationaryBike: return '🚴';
    default: return '🔥';
  }
};

const getGoalIcon = (goalType: FatBurnGoalType): React.ReactNode => {
  switch (goalType) {
    case FatBurnGoalType.FreeSession: return <Play className="w-6 h-6" />;
    case FatBurnGoalType.TimeGoal: return <Clock className="w-6 h-6" />;
    case FatBurnGoalType.DistanceGoal: return <Target className="w-6 h-6" />;
    case FatBurnGoalType.FloorsGoal: return <TrendingUp className="w-6 h-6" />;
    default: return <Flame className="w-6 h-6" />;
  }
};

const getGoalDescription = (goalType: FatBurnGoalType): string => {
  switch (goalType) {
    case FatBurnGoalType.FreeSession: return 'Just track time and enter results';
    case FatBurnGoalType.TimeGoal: return 'Set a target duration';
    case FatBurnGoalType.DistanceGoal: return 'Set a distance to hit';
    case FatBurnGoalType.FloorsGoal: return 'Set floors to climb';
    default: return '';
  }
};

export default FatBurnPage;
