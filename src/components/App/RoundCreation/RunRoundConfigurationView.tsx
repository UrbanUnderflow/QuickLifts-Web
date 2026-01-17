import React, { useState, useMemo } from 'react';
import { X, ChevronRight, ChevronLeft, Calendar, Target, Users, Lock, Globe } from 'lucide-react';
import { 
  RunRoundType, 
  RunRoundTypeInfo,
  RunRoundConfiguration,
  RaceDistancePreset,
  RaceDistancePresetInfo,
  RunLeaderboardMetric,
  RunLeaderboardMetricInfo,
  SweatlistType
} from '../../../api/firebase/workout/types';

interface RunRoundConfigurationViewProps {
  selectedTemplate: RunRoundType;
  onClose: () => void;
  onBack: () => void;
  onComplete: (config: {
    title: string;
    subtitle: string;
    startDate: Date;
    endDate: Date;
    privacy: SweatlistType;
    pin?: string;
    runRoundConfig: RunRoundConfiguration;
  }) => void;
}

const RunRoundConfigurationView: React.FC<RunRoundConfigurationViewProps> = ({
  selectedTemplate,
  onClose,
  onBack,
  onComplete
}) => {
  const templateInfo = RunRoundTypeInfo[selectedTemplate];
  const [color1, color2] = templateInfo.colors;

  // Basic round info
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [privacy, setPrivacy] = useState<SweatlistType>(SweatlistType.Together);
  const [pin, setPin] = useState('');

  // Run round specific config
  const [allowTreadmill, setAllowTreadmill] = useState(true);
  const [targetGoal, setTargetGoal] = useState<string>('');
  const [minimumRunForStreak, setMinimumRunForStreak] = useState<string>('1');
  const [raceDistancePreset, setRaceDistancePreset] = useState<RaceDistancePreset>(RaceDistancePreset.FiveK);
  const [customRaceDistance, setCustomRaceDistance] = useState<string>('');

  // Validation
  const isValid = useMemo(() => {
    if (!title.trim()) return false;
    if (!startDate || !endDate) return false;
    if (new Date(endDate) < new Date(startDate)) return false;
    
    if (selectedTemplate === RunRoundType.VirtualRace) {
      if (raceDistancePreset === RaceDistancePreset.Custom && !customRaceDistance) return false;
    }
    
    return true;
  }, [title, startDate, endDate, selectedTemplate, raceDistancePreset, customRaceDistance]);

  const handleSubmit = () => {
    if (!isValid) return;

    // Build configuration based on template type
    let runRoundConfig: RunRoundConfiguration;

    switch (selectedTemplate) {
      case RunRoundType.DistanceChallenge:
        runRoundConfig = RunRoundConfiguration.distanceChallenge({
          targetGoal: targetGoal ? parseFloat(targetGoal) : undefined,
          allowTreadmill
        });
        break;
      
      case RunRoundType.StreakChallenge:
        runRoundConfig = RunRoundConfiguration.streakChallenge({
          minimumRunForStreak: parseFloat(minimumRunForStreak) || 1.0,
          allowTreadmill
        });
        break;
      
      case RunRoundType.VirtualRace:
        runRoundConfig = RunRoundConfiguration.virtualRace({
          raceDistancePreset,
          customRaceDistance: raceDistancePreset === RaceDistancePreset.Custom 
            ? parseFloat(customRaceDistance) 
            : undefined,
          allowTreadmill
        });
        break;
      
      default:
        runRoundConfig = RunRoundConfiguration.freeform({ allowTreadmill });
    }

    onComplete({
      title: title.trim(),
      subtitle: subtitle.trim(),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      privacy,
      pin: privacy === SweatlistType.Locked ? pin : undefined,
      runRoundConfig
    });
  };

  // Render type-specific configuration
  const renderTypeSpecificConfig = () => {
    switch (selectedTemplate) {
      case RunRoundType.DistanceChallenge:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Target Goal (optional)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={targetGoal}
                  onChange={(e) => setTargetGoal(e.target.value)}
                  placeholder="e.g., 100"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-green-500"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">miles</span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Set a group goal for participants to collectively reach
              </p>
            </div>
          </div>
        );

      case RunRoundType.StreakChallenge:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Minimum Run for Streak
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  value={minimumRunForStreak}
                  onChange={(e) => setMinimumRunForStreak(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">miles</span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Participants must run at least this distance to count toward their streak
              </p>
            </div>
          </div>
        );

      case RunRoundType.VirtualRace:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Race Distance
              </label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(RaceDistancePresetInfo).map(([preset, info]) => (
                  <button
                    key={preset}
                    onClick={() => setRaceDistancePreset(preset as RaceDistancePreset)}
                    className={`
                      p-3 rounded-xl text-center transition-all
                      ${raceDistancePreset === preset
                        ? 'bg-blue-500/20 border-2 border-blue-500'
                        : 'bg-zinc-800 border-2 border-transparent hover:bg-zinc-700'
                      }
                    `}
                  >
                    <span className="text-white font-medium">{info.displayName}</span>
                    {info.distanceInMiles && (
                      <span className="text-xs text-zinc-400 block">{info.distanceInMiles} mi</span>
                    )}
                  </button>
                ))}
              </div>
              
              {raceDistancePreset === RaceDistancePreset.Custom && (
                <div className="mt-3 relative">
                  <input
                    type="number"
                    step="0.1"
                    value={customRaceDistance}
                    onChange={(e) => setCustomRaceDistance(e.target.value)}
                    placeholder="Enter distance"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">miles</span>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 sm:px-6">
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-none bg-zinc-900 min-h-screen sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-3xl">
        {/* Header */}
        <div className="p-6 pb-2">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-[#22C55E] hover:text-[#16A34A] transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="font-medium">Back</span>
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 transition-colors"
            >
              <X className="text-white" size={20} />
            </button>
          </div>

          <div className="mt-4 mb-2">
            <div className="flex items-center gap-3 mb-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${color1}, ${color2})` }}
              >
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/>
                </svg>
              </div>
              <div>
                <span 
                  className="text-sm font-medium px-2 py-1 rounded"
                  style={{ backgroundColor: `${color1}20`, color: color1 }}
                >
                  {templateInfo.displayName}
                </span>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white">
              Configure Your Round
            </h1>
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 p-6 pt-2 overflow-y-auto pb-32">
          <div className="space-y-6">
            {/* Basic Info Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                Basic Info
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Round Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`e.g., ${templateInfo.displayName} Week`}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Tell participants what this round is about"
                  rows={2}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-green-500 resize-none"
                />
              </div>
            </div>

            {/* Dates Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                Dates
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Start Date *
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-11 pr-4 py-3 text-white focus:outline-none focus:border-green-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    End Date *
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-11 pr-4 py-3 text-white focus:outline-none focus:border-green-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Run-specific Configuration */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                {templateInfo.displayName} Settings
              </h3>
              
              {renderTypeSpecificConfig()}

              {/* Allow Treadmill Toggle */}
              <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-xl">
                <div>
                  <span className="text-white font-medium">Allow Treadmill Runs</span>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {selectedTemplate === RunRoundType.VirtualRace 
                      ? "Disable for GPS accuracy in races"
                      : "Include indoor treadmill runs"}
                  </p>
                </div>
                <button
                  onClick={() => setAllowTreadmill(!allowTreadmill)}
                  className={`
                    w-12 h-7 rounded-full transition-colors relative
                    ${allowTreadmill ? 'bg-green-500' : 'bg-zinc-600'}
                  `}
                >
                  <div 
                    className={`
                      w-5 h-5 bg-white rounded-full absolute top-1 transition-transform
                      ${allowTreadmill ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>
            </div>

            {/* Privacy Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                Privacy
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPrivacy(SweatlistType.Together)}
                  className={`
                    p-4 rounded-xl text-left transition-all flex items-center gap-3
                    ${privacy === SweatlistType.Together
                      ? 'bg-green-500/20 border-2 border-green-500'
                      : 'bg-zinc-800 border-2 border-transparent hover:bg-zinc-700'
                    }
                  `}
                >
                  <Globe className="w-5 h-5 text-green-400" />
                  <div>
                    <span className="text-white font-medium block">Public</span>
                    <span className="text-xs text-zinc-500">Anyone can join</span>
                  </div>
                </button>
                <button
                  onClick={() => setPrivacy(SweatlistType.Locked)}
                  className={`
                    p-4 rounded-xl text-left transition-all flex items-center gap-3
                    ${privacy === SweatlistType.Locked
                      ? 'bg-orange-500/20 border-2 border-orange-500'
                      : 'bg-zinc-800 border-2 border-transparent hover:bg-zinc-700'
                    }
                  `}
                >
                  <Lock className="w-5 h-5 text-orange-400" />
                  <div>
                    <span className="text-white font-medium block">Private</span>
                    <span className="text-xs text-zinc-500">Requires PIN</span>
                  </div>
                </button>
              </div>

              {privacy === SweatlistType.Locked && (
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    PIN Code
                  </label>
                  <input
                    type="text"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Enter a 4-6 digit PIN"
                    maxLength={6}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Button */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-zinc-900 via-zinc-900 to-transparent">
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className={`
              w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2
              transition-all
              ${isValid
                ? 'text-black hover:opacity-90'
                : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
              }
            `}
            style={{
              backgroundColor: isValid ? color1 : undefined
            }}
          >
            <span>Create Run Round</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default RunRoundConfigurationView;
