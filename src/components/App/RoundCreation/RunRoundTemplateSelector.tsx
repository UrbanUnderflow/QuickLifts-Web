import React, { useState } from 'react';
import { X, Check, ChevronRight, Map, Flame, Flag, Clock, TrendingUp, Calendar } from 'lucide-react';
import { RunRoundType, RunRoundTypeInfo } from '../../../api/firebase/workout/types';

interface RunRoundTemplateSelectorProps {
  onClose: () => void;
  onBack: () => void;
  onSelectTemplate: (template: RunRoundType) => void;
}

// Icons for each run round type
const RunRoundTypeIcons: Record<RunRoundType, React.ReactNode> = {
  [RunRoundType.DistanceChallenge]: <Map className="w-7 h-7" />,
  [RunRoundType.VirtualRace]: <Flag className="w-7 h-7" />,
  [RunRoundType.StreakChallenge]: <Flame className="w-7 h-7" />,
  [RunRoundType.IntervalProgram]: (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 3v18M7 3v18M3 12h18" strokeLinecap="round"/>
    </svg>
  ),
  [RunRoundType.PaceImprovement]: <TrendingUp className="w-7 h-7" />,
  [RunRoundType.TrainingProgram]: <Calendar className="w-7 h-7" />,
  [RunRoundType.Freeform]: (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/>
    </svg>
  )
};

// MVP templates (available now)
const MVP_TEMPLATES: RunRoundType[] = [
  RunRoundType.DistanceChallenge,
  RunRoundType.StreakChallenge,
  RunRoundType.VirtualRace
];

// Coming soon templates
const COMING_SOON_TEMPLATES: RunRoundType[] = [
  RunRoundType.IntervalProgram,
  RunRoundType.PaceImprovement,
  RunRoundType.TrainingProgram
];

const RunRoundTemplateSelector: React.FC<RunRoundTemplateSelectorProps> = ({
  onClose,
  onBack,
  onSelectTemplate
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<RunRoundType | null>(null);

  const handleContinue = () => {
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate);
    }
  };

  const renderTemplateCard = (template: RunRoundType, isComingSoon: boolean = false) => {
    const info = RunRoundTypeInfo[template];
    const isSelected = selectedTemplate === template && !isComingSoon;
    const [color1, color2] = info.colors;

    return (
      <button
        key={template}
        onClick={() => !isComingSoon && setSelectedTemplate(template)}
        disabled={isComingSoon}
        className={`
          w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all
          ${isComingSoon 
            ? 'bg-zinc-800/30 cursor-not-allowed opacity-60' 
            : isSelected
              ? 'bg-zinc-800 ring-2'
              : 'bg-zinc-800/50 hover:bg-zinc-800'
          }
        `}
        style={{
          '--tw-ring-color': isSelected ? color1 : 'transparent'
        } as React.CSSProperties}
      >
        {/* Icon */}
        <div 
          className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ 
            background: isComingSoon 
              ? '#374151'
              : `linear-gradient(135deg, ${color1}, ${color2})`,
            color: 'white'
          }}
        >
          {RunRoundTypeIcons[template]}
        </div>

        {/* Text Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-semibold text-lg ${isComingSoon ? 'text-zinc-500' : 'text-white'}`}>
              {info.displayName}
            </span>
            {isComingSoon && (
              <span 
                className="text-xs font-medium px-2 py-0.5 rounded"
                style={{ 
                  backgroundColor: `${color1}20`,
                  color: color1
                }}
              >
                Soon
              </span>
            )}
          </div>
          <p className={`text-sm mt-1 ${isComingSoon ? 'text-zinc-600' : 'text-zinc-400'}`}>
            {info.description}
          </p>
        </div>

        {/* Selection Indicator */}
        {!isComingSoon && (
          <div 
            className={`
              w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
              ${isSelected ? '' : 'border-2 border-zinc-600'}
            `}
            style={{
              backgroundColor: isSelected ? color1 : 'transparent'
            }}
          >
            {isSelected && <Check className="w-4 h-4 text-white" />}
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 sm:px-6">
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-none bg-zinc-900 min-h-screen sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:rounded-3xl">
        {/* Header */}
        <div className="p-6 pb-2">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-[#22C55E] hover:text-[#16A34A] transition-colors"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
              <span className="font-medium">Back</span>
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 transition-colors"
            >
              <X className="text-white" size={20} />
            </button>
          </div>

          <div className="mt-6 mb-2">
            {/* Run Round Icon */}
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ 
                background: 'linear-gradient(135deg, #22C55E, #3B82F6)'
              }}
            >
              <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/>
              </svg>
            </div>
            
            <h1 className="text-3xl font-bold text-white">
              Start a Run Round
            </h1>
            <p className="mt-2 text-zinc-400 text-base">
              Choose a template to get your runners moving together
            </p>
          </div>
        </div>

        {/* Template Cards */}
        <div className="flex-1 p-6 pt-4 overflow-y-auto pb-32">
          {/* Available Templates */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">
              Choose Your Run Round
            </h2>
            <div className="space-y-3">
              {MVP_TEMPLATES.map(template => renderTemplateCard(template, false))}
            </div>
          </div>

          {/* Coming Soon Templates */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4">
              Coming Soon
            </h2>
            <div className="space-y-3">
              {COMING_SOON_TEMPLATES.map(template => renderTemplateCard(template, true))}
            </div>
          </div>
        </div>

        {/* Bottom Button */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-zinc-900 via-zinc-900 to-transparent">
          <button
            onClick={handleContinue}
            disabled={!selectedTemplate}
            className={`
              w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2
              transition-all
              ${selectedTemplate
                ? 'bg-[#22C55E] text-black hover:bg-[#16A34A]'
                : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
              }
            `}
          >
            <span>Continue</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default RunRoundTemplateSelector;
