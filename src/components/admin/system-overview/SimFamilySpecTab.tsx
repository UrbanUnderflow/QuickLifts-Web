import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ChevronRight, FileText, Volume2, StopCircle, ScanSearch, Shuffle, Timer } from 'lucide-react';
import KillSwitchSpecTab from './KillSwitchSpecTab';
import NoiseGateSpecTab from './NoiseGateSpecTab';
import BrakePointSpecTab from './BrakePointSpecTab';
import SignalWindowSpecTab from './SignalWindowSpecTab';
import SequenceShiftSpecTab from './SequenceShiftSpecTab';
import EnduranceLockSpecTab from './EnduranceLockSpecTab';

/* ---- FAMILY SPEC REGISTRY ---- */
interface FamilySpecEntry {
    id: string;
    label: string;
    subtitle: string;
    icon: React.ElementType;
    accent: string;
}

const FAMILY_SPECS: FamilySpecEntry[] = [
    {
        id: 'kill-switch',
        label: 'Reset',
        subtitle: 'Mental recovery sim — disruption, re-engagement, Recovery Time.',
        icon: Zap,
        accent: '#ef4444',
    },
    {
        id: 'noise-gate',
        label: 'Noise Gate',
        subtitle: 'Selective attention — hold focus on signal while noise competes.',
        icon: Volume2,
        accent: '#38bdf8',
    },
    {
        id: 'brake-point',
        label: 'Brake Point',
        subtitle: 'Response inhibition — cancel the wrong action before it executes.',
        icon: StopCircle,
        accent: '#ef4444',
    },
    {
        id: 'signal-window',
        label: 'Signal Window',
        subtitle: 'Cue discrimination — read the right signal in a shrinking window.',
        icon: ScanSearch,
        accent: '#facc15',
    },
    {
        id: 'sequence-shift',
        label: 'Sequence Shift',
        subtitle: 'Task-switching — maintain rules, detect changes, update in real time.',
        icon: Shuffle,
        accent: '#a78bfa',
    },
    {
        id: 'endurance-lock',
        label: 'Endurance Lock',
        subtitle: 'Cognitive fatigue — sustain mental performance under accumulated load.',
        icon: Timer,
        accent: '#f97316',
    },
];

/* ---- MAIN COMPONENT ---- */
const SimFamilySpecTab: React.FC = () => {
    const [activeSpecId, setActiveSpecId] = useState<string>(FAMILY_SPECS[0].id);

    const renderSpecContent = () => {
        switch (activeSpecId) {
            case 'kill-switch':
                return <KillSwitchSpecTab />;
            case 'noise-gate':
                return <NoiseGateSpecTab />;
            case 'brake-point':
                return <BrakePointSpecTab />;
            case 'signal-window':
                return <SignalWindowSpecTab />;
            case 'sequence-shift':
                return <SequenceShiftSpecTab />;
            case 'endurance-lock':
                return <EnduranceLockSpecTab />;
            default:
                return (
                    <div className="flex items-center justify-center h-40 text-zinc-500 text-sm">
                        Select a family spec to view.
                    </div>
                );
        }
    };

    return (
        <div className="space-y-5">
            {/* ---- HEADER ---- */}
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-purple-400" />
                    <p className="text-xs uppercase tracking-wide text-purple-400 font-semibold">
                        Pulse Check · Sim Family Specs
                    </p>
                </div>
                <h2 className="text-xl font-semibold text-white">Sim FamilySpec Library</h2>
                <p className="text-sm text-zinc-400 mt-1">
                    Complete specifications for each simulation family — game mechanics, scoring models, difficulty tiers, and measurement rules.
                </p>
            </div>

            {/* ---- SPEC SELECTOR CARDS ---- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {FAMILY_SPECS.map((spec) => {
                    const Icon = spec.icon;
                    const isActive = spec.id === activeSpecId;
                    return (
                        <button
                            key={spec.id}
                            onClick={() => setActiveSpecId(spec.id)}
                            className="group relative text-left rounded-xl border px-4 py-3 transition-all duration-200"
                            style={{
                                background: isActive
                                    ? `linear-gradient(135deg, ${spec.accent}18, ${spec.accent}08)`
                                    : 'rgba(255,255,255,0.02)',
                                borderColor: isActive ? `${spec.accent}50` : 'rgba(63,63,70,0.6)',
                                boxShadow: isActive ? `0 0 24px ${spec.accent}12` : 'none',
                            }}
                        >
                            <div className="flex items-center gap-2.5">
                                <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                    style={{
                                        background: isActive ? `${spec.accent}25` : 'rgba(255,255,255,0.05)',
                                    }}
                                >
                                    <Icon
                                        className="w-4 h-4"
                                        style={{ color: isActive ? spec.accent : '#a1a1aa' }}
                                    />
                                </div>
                                <div className="min-w-0">
                                    <p
                                        className="text-sm font-semibold truncate"
                                        style={{ color: isActive ? '#fff' : '#d4d4d8' }}
                                    >
                                        {spec.label}
                                    </p>
                                    <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
                                        {spec.subtitle}
                                    </p>
                                </div>
                                <ChevronRight
                                    className="w-4 h-4 ml-auto shrink-0 transition-transform group-hover:translate-x-0.5"
                                    style={{ color: isActive ? spec.accent : '#52525b' }}
                                />
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* ---- ACTIVE SPEC CONTENT ---- */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeSpecId}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                >
                    {renderSpecContent()}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default SimFamilySpecTab;
