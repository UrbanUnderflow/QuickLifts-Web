import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeft, MapPin, Building2, Timer, Target, Repeat, Play, ChevronRight } from 'lucide-react';
import { 
  RunType, 
  RunLocation, 
  TreadmillMode,
  DistancePreset,
  TimePreset,
  DistancePresetMiles,
  TimePresetSeconds,
  RunConfiguration,
  IntervalConfiguration,
  IntervalConfigurationPresets
} from '../api/firebase/workout/types';
import { useUser } from '../hooks/useUser';

// Configuration step enum
enum ConfigStep {
  Location = 'location',
  RunType = 'runType',
  TreadmillMode = 'treadmillMode',
  DistanceGoal = 'distanceGoal',
  TimeGoal = 'timeGoal',
  IntervalConfig = 'intervalConfig',
  Ready = 'ready'
}

const RunPage: React.FC = () => {
  const router = useRouter();
  const currentUser = useUser();
  
  // Configuration state
  const [currentStep, setCurrentStep] = useState<ConfigStep>(ConfigStep.Location);
  const [location, setLocation] = useState<RunLocation | null>(null);
  const [runType, setRunType] = useState<RunType | null>(null);
  const [treadmillMode, setTreadmillMode] = useState<TreadmillMode | null>(null);
  const [distancePreset, setDistancePreset] = useState<DistancePreset | null>(null);
  const [customDistance, setCustomDistance] = useState<string>('');
  const [timePreset, setTimePreset] = useState<TimePreset | null>(null);
  const [customDuration, setCustomDuration] = useState<string>('');
  const [intervalConfig, setIntervalConfig] = useState<IntervalConfiguration | null>(null);

  // Run category color (Blue)
  const runColor = '#3B82F6';

  const runSessionStorageKey = useMemo(() => {
    const uid = currentUser?.id || 'anon';
    return `pulse:webRunActiveSession:${uid}`;
  }, [currentUser?.id]);

  const [resumeSession, setResumeSession] = useState<{
    status: 'running' | 'paused' | 'stopped';
    startTimeMs: number;
    elapsedSeconds?: number;
    config?: any;
  } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(runSessionStorageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved?.startTimeMs || !saved?.status) return;
      if (saved.status === 'running' || saved.status === 'paused') {
        setResumeSession(saved);
      }
    } catch (e) {
      // ignore
    }
  }, [runSessionStorageKey]);

  const handleResume = () => {
    if (!resumeSession) return;
    if (resumeSession.config) {
      router.push({
        pathname: '/run/active',
        query: { config: JSON.stringify(resumeSession.config) }
      });
      return;
    }
    // If config is missing, just send them into the normal run setup flow.
    setResumeSession(null);
  };

  const handleResetResume = () => {
    try {
      localStorage.removeItem(runSessionStorageKey);
    } catch (e) {
      // ignore
    }
    setResumeSession(null);
  };

  const handleBack = () => {
    switch (currentStep) {
      case ConfigStep.Location:
        router.back();
        break;
      case ConfigStep.TreadmillMode:
        setCurrentStep(ConfigStep.Location);
        break;
      case ConfigStep.RunType:
        if (location === RunLocation.Treadmill) {
          setCurrentStep(ConfigStep.TreadmillMode);
        } else {
          setCurrentStep(ConfigStep.Location);
        }
        break;
      case ConfigStep.DistanceGoal:
      case ConfigStep.TimeGoal:
      case ConfigStep.IntervalConfig:
        setCurrentStep(ConfigStep.RunType);
        break;
      case ConfigStep.Ready:
        if (runType === RunType.Distance) {
          setCurrentStep(ConfigStep.DistanceGoal);
        } else if (runType === RunType.Time) {
          setCurrentStep(ConfigStep.TimeGoal);
        } else if (runType === RunType.Intervals) {
          setCurrentStep(ConfigStep.IntervalConfig);
        } else {
          setCurrentStep(ConfigStep.RunType);
        }
        break;
    }
  };

  const handleLocationSelect = (loc: RunLocation) => {
    setLocation(loc);
    if (loc === RunLocation.Treadmill) {
      setCurrentStep(ConfigStep.TreadmillMode);
    } else {
      setCurrentStep(ConfigStep.RunType);
    }
  };

  const handleTreadmillModeSelect = (mode: TreadmillMode) => {
    setTreadmillMode(mode);
    setCurrentStep(ConfigStep.RunType);
  };

  const handleRunTypeSelect = (type: RunType) => {
    setRunType(type);
    switch (type) {
      case RunType.FreeRun:
        setCurrentStep(ConfigStep.Ready);
        break;
      case RunType.Distance:
        setCurrentStep(ConfigStep.DistanceGoal);
        break;
      case RunType.Time:
        setCurrentStep(ConfigStep.TimeGoal);
        break;
      case RunType.Intervals:
        setCurrentStep(ConfigStep.IntervalConfig);
        break;
    }
  };

  const handleDistanceSelect = (preset: DistancePreset) => {
    setDistancePreset(preset);
    if (preset !== DistancePreset.Custom) {
      setCurrentStep(ConfigStep.Ready);
    }
  };

  const handleTimeSelect = (preset: TimePreset) => {
    setTimePreset(preset);
    if (preset !== TimePreset.Custom) {
      setCurrentStep(ConfigStep.Ready);
    }
  };

  const handleIntervalSelect = (config: IntervalConfiguration) => {
    setIntervalConfig(config);
    setCurrentStep(ConfigStep.Ready);
  };

  const handleStartRun = () => {
    // Build configuration object
    const config: RunConfiguration = {
      runType: runType!,
      location: location!,
      treadmillMode: treadmillMode || undefined,
      distancePreset: distancePreset || undefined,
      customDistanceMiles: customDistance ? parseFloat(customDistance) : undefined,
      timePreset: timePreset || undefined,
      customDurationSeconds: customDuration ? parseInt(customDuration) * 60 : undefined,
      intervalConfig: intervalConfig || undefined,
    };
    
    // Navigate to active run with configuration
    router.push({
      pathname: '/run/active',
      query: { config: JSON.stringify(config) }
    });
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case ConfigStep.Location:
        return 'Where are you running?';
      case ConfigStep.TreadmillMode:
        return 'What mode?';
      case ConfigStep.RunType:
        return 'What type of run?';
      case ConfigStep.DistanceGoal:
        return 'Set your distance goal';
      case ConfigStep.TimeGoal:
        return 'Set your time goal';
      case ConfigStep.IntervalConfig:
        return 'Choose interval preset';
      case ConfigStep.Ready:
        return 'Ready to run?';
    }
  };

  const getStepSubtitle = () => {
    switch (currentStep) {
      case ConfigStep.Location:
        return 'Choose your running environment';
      case ConfigStep.TreadmillMode:
        return 'Running or walking pace';
      case ConfigStep.RunType:
        return 'Select your workout style';
      case ConfigStep.DistanceGoal:
        return 'Pick a target or enter custom';
      case ConfigStep.TimeGoal:
        return 'Pick a duration or enter custom';
      case ConfigStep.IntervalConfig:
        return 'Alternate between run and walk';
      case ConfigStep.Ready:
        return 'Review your run settings';
    }
  };

  // Render content based on current step
  const renderStepContent = () => {
    switch (currentStep) {
      case ConfigStep.Location:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <OptionCard
              icon={<MapPin className="w-8 h-8" />}
              title="Outdoor"
              subtitle="GPS tracking for accurate distance"
              isSelected={location === RunLocation.Outdoor}
              color={runColor}
              onClick={() => handleLocationSelect(RunLocation.Outdoor)}
            />
            <OptionCard
              icon={<Building2 className="w-8 h-8" />}
              title="Treadmill"
              subtitle="Indoor run without GPS"
              isSelected={location === RunLocation.Treadmill}
              color={runColor}
              onClick={() => handleLocationSelect(RunLocation.Treadmill)}
            />
          </div>
        );
      
      case ConfigStep.TreadmillMode:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <OptionCard
              icon={
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/>
                </svg>
              }
              title="Run"
              subtitle="Running pace on treadmill"
              isSelected={treadmillMode === TreadmillMode.Run}
              color={runColor}
              onClick={() => handleTreadmillModeSelect(TreadmillMode.Run)}
            />
            <OptionCard
              icon={
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/>
                </svg>
              }
              title="Walk"
              subtitle="Walking pace on treadmill"
              isSelected={treadmillMode === TreadmillMode.Walk}
              color={runColor}
              onClick={() => handleTreadmillModeSelect(TreadmillMode.Walk)}
            />
          </div>
        );
      
      case ConfigStep.RunType:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <OptionCard
              icon={
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/>
                </svg>
              }
              title="Free Run"
              subtitle="Just run — we'll track everything"
              isSelected={runType === RunType.FreeRun}
              color={runColor}
              onClick={() => handleRunTypeSelect(RunType.FreeRun)}
            />
            <OptionCard
              icon={<Target className="w-8 h-8" />}
              title="Distance Goal"
              subtitle="Set a target distance to hit"
              isSelected={runType === RunType.Distance}
              color={runColor}
              onClick={() => handleRunTypeSelect(RunType.Distance)}
            />
            <OptionCard
              icon={<Timer className="w-8 h-8" />}
              title="Time Goal"
              subtitle="Run for a set duration"
              isSelected={runType === RunType.Time}
              color={runColor}
              onClick={() => handleRunTypeSelect(RunType.Time)}
            />
            <OptionCard
              icon={<Repeat className="w-8 h-8" />}
              title="Intervals"
              subtitle="Alternate between run and walk"
              isSelected={runType === RunType.Intervals}
              color={runColor}
              onClick={() => handleRunTypeSelect(RunType.Intervals)}
            />
          </div>
        );
      
      case ConfigStep.DistanceGoal:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.values(DistancePreset).filter(p => p !== DistancePreset.Custom).map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleDistanceSelect(preset)}
                  className={`p-4 rounded-xl text-center transition-all ${
                    distancePreset === preset 
                      ? 'bg-blue-500/20 border-2 border-blue-500' 
                      : 'bg-zinc-800/50 border-2 border-transparent hover:bg-zinc-800'
                  }`}
                >
                  <div className="text-xl font-bold" style={{ color: runColor }}>{preset}</div>
                  {DistancePresetMiles[preset] && (
                    <div className="text-sm text-zinc-400">{DistancePresetMiles[preset]} mi</div>
                  )}
                </button>
              ))}
            </div>
            
            <div className="mt-6">
              <label className="text-sm text-zinc-400 mb-2 block">Or enter custom distance (miles)</label>
              <div className="flex gap-3">
                <input
                  type="number"
                  step="0.1"
                  value={customDistance}
                  onChange={(e) => {
                    setCustomDistance(e.target.value);
                    setDistancePreset(DistancePreset.Custom);
                  }}
                  placeholder="e.g., 2.5"
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => customDistance && setCurrentStep(ConfigStep.Ready)}
                  disabled={!customDistance}
                  className="px-6 py-3 bg-blue-500 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Set
                </button>
              </div>
            </div>
          </div>
        );
      
      case ConfigStep.TimeGoal:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.values(TimePreset).filter(p => p !== TimePreset.Custom).map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleTimeSelect(preset)}
                  className={`p-4 rounded-xl text-center transition-all ${
                    timePreset === preset 
                      ? 'bg-blue-500/20 border-2 border-blue-500' 
                      : 'bg-zinc-800/50 border-2 border-transparent hover:bg-zinc-800'
                  }`}
                >
                  <div className="text-xl font-bold" style={{ color: runColor }}>{preset}</div>
                </button>
              ))}
            </div>
            
            <div className="mt-6">
              <label className="text-sm text-zinc-400 mb-2 block">Or enter custom duration (minutes)</label>
              <div className="flex gap-3">
                <input
                  type="number"
                  value={customDuration}
                  onChange={(e) => {
                    setCustomDuration(e.target.value);
                    setTimePreset(TimePreset.Custom);
                  }}
                  placeholder="e.g., 25"
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => customDuration && setCurrentStep(ConfigStep.Ready)}
                  disabled={!customDuration}
                  className="px-6 py-3 bg-blue-500 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Set
                </button>
              </div>
            </div>
          </div>
        );
      
      case ConfigStep.IntervalConfig:
        return (
          <div className="space-y-4">
            <OptionCard
              icon={<span className="text-2xl font-bold">B</span>}
              title="Beginner"
              subtitle="1 min run, 1 min walk × 6 rounds (12 min)"
              isSelected={intervalConfig === IntervalConfigurationPresets.beginner}
              color={runColor}
              onClick={() => handleIntervalSelect(IntervalConfigurationPresets.beginner)}
            />
            <OptionCard
              icon={<span className="text-2xl font-bold">I</span>}
              title="Intermediate"
              subtitle="2 min run, 30 sec walk × 8 rounds (20 min)"
              isSelected={intervalConfig === IntervalConfigurationPresets.intermediate}
              color={runColor}
              onClick={() => handleIntervalSelect(IntervalConfigurationPresets.intermediate)}
            />
            <OptionCard
              icon={<span className="text-2xl font-bold">A</span>}
              title="Advanced"
              subtitle="3 min run, 30 sec walk × 10 rounds (35 min)"
              isSelected={intervalConfig === IntervalConfigurationPresets.advanced}
              color={runColor}
              onClick={() => handleIntervalSelect(IntervalConfigurationPresets.advanced)}
            />
          </div>
        );
      
      case ConfigStep.Ready:
        return (
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="bg-zinc-800/50 rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-white">Run Summary</h3>
              
              <div className="space-y-3">
                <SummaryRow 
                  label="Location" 
                  value={location === RunLocation.Outdoor ? '🌳 Outdoor' : '🏃 Treadmill'} 
                />
                {treadmillMode && (
                  <SummaryRow 
                    label="Mode" 
                    value={treadmillMode === TreadmillMode.Run ? '🏃 Running' : '🚶 Walking'} 
                  />
                )}
                <SummaryRow 
                  label="Type" 
                  value={runType || ''} 
                />
                {runType === RunType.Distance && (
                  <SummaryRow 
                    label="Target" 
                    value={distancePreset === DistancePreset.Custom 
                      ? `${customDistance} mi` 
                      : `${DistancePresetMiles[distancePreset!]} mi`
                    } 
                  />
                )}
                {runType === RunType.Time && (
                  <SummaryRow 
                    label="Duration" 
                    value={timePreset === TimePreset.Custom 
                      ? `${customDuration} min` 
                      : timePreset || ''
                    } 
                  />
                )}
                {runType === RunType.Intervals && intervalConfig && (
                  <SummaryRow 
                    label="Intervals" 
                    value={`${Math.floor(intervalConfig.runDurationSeconds / 60)}m run / ${intervalConfig.walkDurationSeconds}s walk × ${intervalConfig.numberOfRounds}`} 
                  />
                )}
              </div>
            </div>

            {/* Start Button */}
            <button
              onClick={handleStartRun}
              className="w-full py-4 rounded-full font-bold text-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ backgroundColor: runColor, color: 'white' }}
            >
              <Play className="w-6 h-6" fill="white" />
              Start Run
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900">
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: runColor }}
        />
      </div>

      {/* Content */}
      <div className="relative max-w-2xl mx-auto px-4 py-6">
        {/* Resume banner */}
        {resumeSession && (
          <div className="mb-6 bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Timer className="w-5 h-5 text-blue-300" />
              </div>
              <div>
                <div className="text-white font-semibold">Resume your run</div>
                <div className="text-zinc-400 text-sm">
                  We found an active run timer. Pick up where you left off.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetResume}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm font-semibold"
              >
                Reset
              </button>
              <button
                onClick={handleResume}
                className="px-4 py-2 rounded-xl font-bold text-black"
                style={{ backgroundColor: '#E0FE10' }}
              >
                Resume
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{getStepTitle()}</h1>
            <p className="text-zinc-400">{getStepSubtitle()}</p>
          </div>
        </div>

        {/* Step Content */}
        {renderStepContent()}
      </div>
    </div>
  );
};

// Reusable Option Card Component
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
        ? 'bg-blue-500/20 border-2' 
        : 'bg-zinc-800/50 border-2 border-transparent hover:bg-zinc-800'
      }
    `}
    style={{ borderColor: isSelected ? color : 'transparent' }}
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

// Summary Row Component
interface SummaryRowProps {
  label: string;
  value: string;
}

const SummaryRow: React.FC<SummaryRowProps> = ({ label, value }) => (
  <div className="flex justify-between items-center py-2 border-b border-zinc-700/50 last:border-0">
    <span className="text-zinc-400">{label}</span>
    <span className="text-white font-medium">{value}</span>
  </div>
);

export default RunPage;
