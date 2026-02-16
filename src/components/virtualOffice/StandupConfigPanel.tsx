import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
    X, Clock, Sun, Moon, Calendar, ToggleLeft, ToggleRight,
    Save, Users, Settings,
} from 'lucide-react';
import { db } from '../../api/firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

/* ─── Types ─────────────────────────────────────────── */

interface StandupSchedule {
    morningEnabled: boolean;
    morningHour: number;    // 0-23
    morningMinute: number;  // 0-59
    eveningEnabled: boolean;
    eveningHour: number;
    eveningMinute: number;
    moderator: string;
    agents: string[];
    maxDurationMinutes: number;
    lastUpdatedAt?: any;
}

const DEFAULT_CONFIG: StandupSchedule = {
    morningEnabled: true,
    morningHour: 9,
    morningMinute: 0,
    eveningEnabled: true,
    eveningHour: 21,
    eveningMinute: 0,
    moderator: 'nora',
    agents: ['nora', 'scout', 'solara', 'sage'],
    maxDurationMinutes: 20,
};

const CONFIG_DOC_PATH = 'standup-config/default';

interface StandupConfigPanelProps {
    onClose: () => void;
}

/* ─── Helpers ───────────────────────────────────────── */

const AGENT_COLORS: Record<string, string> = {
    nora: '#22c55e',
    scout: '#f59e0b',
    solara: '#f43f5e',
    sage: '#06b6d4',
};

const formatTime12 = (hour: number, minute: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const h = hour % 12 || 12;
    const m = minute.toString().padStart(2, '0');
    return `${h}:${m} ${period}`;
};

/* ─── Component ─────────────────────────────────────── */

export const StandupConfigPanel: React.FC<StandupConfigPanelProps> = ({ onClose }) => {
    const [config, setConfig] = useState<StandupSchedule>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [dirty, setDirty] = useState(false);

    // Load config from Firestore
    useEffect(() => {
        (async () => {
            try {
                const snap = await getDoc(doc(db, CONFIG_DOC_PATH));
                if (snap.exists()) {
                    setConfig({ ...DEFAULT_CONFIG, ...snap.data() } as StandupSchedule);
                }
            } catch (err) {
                console.error('Failed to load standup config:', err);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // Save config to Firestore
    const handleSave = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, CONFIG_DOC_PATH), {
                ...config,
                lastUpdatedAt: serverTimestamp(),
            });
            setSaved(true);
            setDirty(false);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error('Failed to save standup config:', err);
        } finally {
            setSaving(false);
        }
    };

    const updateField = <K extends keyof StandupSchedule>(key: K, value: StandupSchedule[K]) => {
        setConfig(prev => ({ ...prev, [key]: value }));
        setDirty(true);
    };

    const toggleAgent = (agentId: string) => {
        setConfig(prev => {
            const agents = prev.agents.includes(agentId)
                ? prev.agents.filter(a => a !== agentId)
                : [...prev.agents, agentId];
            return { ...prev, agents };
        });
        setDirty(true);
    };

    /* ─── Time picker helper ──────────────────────────── */
    const TimeSelector: React.FC<{
        label: string;
        icon: React.ReactNode;
        enabled: boolean;
        onToggle: () => void;
        hour: number;
        minute: number;
        onHourChange: (h: number) => void;
        onMinuteChange: (m: number) => void;
        accent: string;
    }> = ({ label, icon, enabled, onToggle, hour, minute, onHourChange, onMinuteChange, accent }) => (
        <div className="sc-time-block" style={{ opacity: enabled ? 1 : 0.45 }}>
            <div className="sc-time-header">
                <div className="sc-time-label">
                    <div className="sc-time-icon" style={{ background: `${accent}15`, borderColor: `${accent}25`, color: accent }}>
                        {icon}
                    </div>
                    <div>
                        <span className="sc-time-name">{label}</span>
                        <span className="sc-time-preview">{formatTime12(hour, minute)} EST</span>
                    </div>
                </div>
                <button className="sc-toggle" onClick={onToggle} title={enabled ? 'Disable' : 'Enable'}>
                    {enabled
                        ? <ToggleRight className="w-6 h-6" style={{ color: accent }} />
                        : <ToggleLeft className="w-6 h-6" style={{ color: '#52525b' }} />}
                </button>
            </div>
            {enabled && (
                <div className="sc-time-inputs">
                    <div className="sc-input-group">
                        <label>Hour</label>
                        <select
                            value={hour}
                            onChange={e => onHourChange(parseInt(e.target.value))}
                            className="sc-select"
                        >
                            {Array.from({ length: 24 }, (_, i) => (
                                <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
                            ))}
                        </select>
                    </div>
                    <span className="sc-colon">:</span>
                    <div className="sc-input-group">
                        <label>Minute</label>
                        <select
                            value={minute}
                            onChange={e => onMinuteChange(parseInt(e.target.value))}
                            className="sc-select"
                        >
                            {[0, 15, 30, 45].map(m => (
                                <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}
        </div>
    );

    const panel = (
        <div className="sc-overlay" onClick={onClose}>
            <div className="sc-panel" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="sc-header">
                    <div className="sc-header-left">
                        <div className="sc-header-icon">
                            <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="sc-title">Standup Schedule</h2>
                            <p className="sc-subtitle">Daily meeting configuration</p>
                        </div>
                    </div>
                    <button className="sc-close" onClick={onClose}>
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="sc-content">
                    {loading ? (
                        <div className="sc-empty">
                            <div className="sc-loader" />
                            <p>Loading config...</p>
                        </div>
                    ) : (
                        <>
                            {/* Morning standup */}
                            <TimeSelector
                                label="Morning Standup"
                                icon={<Sun className="w-4 h-4" />}
                                enabled={config.morningEnabled}
                                onToggle={() => updateField('morningEnabled', !config.morningEnabled)}
                                hour={config.morningHour}
                                minute={config.morningMinute}
                                onHourChange={h => updateField('morningHour', h)}
                                onMinuteChange={m => updateField('morningMinute', m)}
                                accent="#f59e0b"
                            />

                            {/* Evening standup */}
                            <TimeSelector
                                label="Evening Standup"
                                icon={<Moon className="w-4 h-4" />}
                                enabled={config.eveningEnabled}
                                onToggle={() => updateField('eveningEnabled', !config.eveningEnabled)}
                                hour={config.eveningHour}
                                minute={config.eveningMinute}
                                onHourChange={h => updateField('eveningHour', h)}
                                onMinuteChange={m => updateField('eveningMinute', m)}
                                accent="#6366f1"
                            />

                            {/* Duration */}
                            <div className="sc-section">
                                <h4><Clock className="w-3.5 h-3.5" /> Max Duration</h4>
                                <div className="sc-duration-row">
                                    <input
                                        type="range"
                                        min={10}
                                        max={30}
                                        step={5}
                                        value={config.maxDurationMinutes}
                                        onChange={e => updateField('maxDurationMinutes', parseInt(e.target.value))}
                                        className="sc-slider"
                                    />
                                    <span className="sc-duration-value">{config.maxDurationMinutes} min</span>
                                </div>
                            </div>

                            {/* Moderator */}
                            <div className="sc-section">
                                <h4><Settings className="w-3.5 h-3.5" /> Moderator</h4>
                                <div className="sc-moderator-row">
                                    {['nora', 'scout', 'solara', 'sage'].map(a => (
                                        <button
                                            key={a}
                                            className={`sc-mod-btn ${config.moderator === a ? 'sc-mod-active' : ''}`}
                                            style={{
                                                borderColor: config.moderator === a ? AGENT_COLORS[a] : 'rgba(63,63,70,0.2)',
                                                color: config.moderator === a ? AGENT_COLORS[a] : '#71717a',
                                                background: config.moderator === a ? `${AGENT_COLORS[a]}12` : 'transparent',
                                            }}
                                            onClick={() => updateField('moderator', a)}
                                        >
                                            {a.charAt(0).toUpperCase() + a.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Participants */}
                            <div className="sc-section">
                                <h4><Users className="w-3.5 h-3.5" /> Participants</h4>
                                <div className="sc-participants">
                                    {['nora', 'scout', 'solara', 'sage'].map(a => {
                                        const active = config.agents.includes(a);
                                        return (
                                            <button
                                                key={a}
                                                className={`sc-agent-chip ${active ? 'sc-agent-active' : ''}`}
                                                onClick={() => toggleAgent(a)}
                                                style={{
                                                    borderColor: active ? `${AGENT_COLORS[a]}50` : 'rgba(63,63,70,0.2)',
                                                    color: active ? AGENT_COLORS[a] : '#52525b',
                                                    background: active ? `${AGENT_COLORS[a]}10` : 'transparent',
                                                }}
                                            >
                                                <span className="sc-agent-dot" style={{
                                                    background: active ? AGENT_COLORS[a] : '#3f3f46',
                                                }} />
                                                {a.charAt(0).toUpperCase() + a.slice(1)}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Next standup info */}
                            <div className="sc-next-standup">
                                <Clock className="w-3.5 h-3.5" />
                                <span>
                                    Next standup:{' '}
                                    {config.morningEnabled
                                        ? `Morning at ${formatTime12(config.morningHour, config.morningMinute)}`
                                        : config.eveningEnabled
                                            ? `Evening at ${formatTime12(config.eveningHour, config.eveningMinute)}`
                                            : 'None scheduled'}
                                </span>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                {!loading && (
                    <div className="sc-footer">
                        <button className="sc-cancel-btn" onClick={onClose}>Cancel</button>
                        <button
                            className={`sc-save-btn ${saved ? 'sc-save-success' : ''}`}
                            onClick={handleSave}
                            disabled={saving || !dirty}
                        >
                            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Changes'}
                        </button>
                    </div>
                )}
            </div>

            <style jsx>{`
        .sc-overlay {
          position: fixed;
          inset: 0;
          z-index: 9998;
          display: flex;
          justify-content: flex-end;
          background: rgba(0,0,0,0.4);
          backdrop-filter: blur(4px);
          animation: scFade 0.2s ease-out;
        }
        @keyframes scFade { from { opacity: 0; } to { opacity: 1; } }

        .sc-panel {
          width: 400px;
          max-width: 90vw;
          height: 100vh;
          background: linear-gradient(180deg, #1a1a2e 0%, #131325 100%);
          border-left: 1px solid rgba(139,92,246,0.1);
          display: flex;
          flex-direction: column;
          animation: scSlideIn 0.3s ease-out;
          box-shadow: -10px 0 40px rgba(0,0,0,0.4);
        }
        @keyframes scSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        .sc-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 20px 16px;
          border-bottom: 1px solid rgba(63,63,70,0.15);
        }
        .sc-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .sc-header-icon {
          width: 38px; height: 38px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(139,92,246,0.15), rgba(99,102,241,0.1));
          border: 1px solid rgba(139,92,246,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a78bfa;
        }
        .sc-title {
          font-size: 15px;
          font-weight: 700;
          color: #e4e4e7;
          margin: 0;
        }
        .sc-subtitle {
          font-size: 11px;
          color: #71717a;
          margin: 2px 0 0;
        }
        .sc-close {
          width: 30px; height: 30px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: #71717a;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sc-close:hover { background: rgba(255,255,255,0.06); color: #e4e4e7; }

        .sc-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .sc-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 60px 20px;
          color: #52525b;
          font-size: 13px;
        }
        .sc-loader {
          width: 28px; height: 28px;
          border: 2px solid rgba(139,92,246,0.15);
          border-top-color: #8b5cf6;
          border-radius: 50%;
          animation: scSpin 0.8s linear infinite;
          margin-bottom: 12px;
        }
        @keyframes scSpin { to { transform: rotate(360deg); } }

        /* Time block */
        .sc-time-block {
          border: 1px solid rgba(63,63,70,0.15);
          border-radius: 14px;
          padding: 16px;
          margin-bottom: 12px;
          background: rgba(255,255,255,0.015);
          transition: opacity 0.2s ease;
        }
        .sc-time-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .sc-time-label {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .sc-time-icon {
          width: 34px; height: 34px;
          border-radius: 9px;
          border: 1px solid;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sc-time-name {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #d4d4d8;
        }
        .sc-time-preview {
          display: block;
          font-size: 11px;
          color: #71717a;
          margin-top: 1px;
        }
        .sc-toggle {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
        }
        .sc-toggle:hover { background: rgba(255,255,255,0.05); }

        .sc-time-inputs {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid rgba(63,63,70,0.1);
        }
        .sc-input-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .sc-input-group label {
          font-size: 10px;
          font-weight: 600;
          color: #52525b;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .sc-select {
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(63,63,70,0.2);
          border-radius: 8px;
          padding: 6px 10px;
          color: #d4d4d8;
          font-size: 14px;
          font-weight: 600;
          font-family: 'Inter', monospace;
          cursor: pointer;
          outline: none;
          min-width: 70px;
        }
        .sc-select:focus { border-color: rgba(139,92,246,0.4); }
        .sc-select option { background: #1a1a2e; color: #d4d4d8; }
        .sc-colon {
          font-size: 18px;
          font-weight: 700;
          color: #52525b;
          padding-bottom: 6px;
        }

        /* Sections */
        .sc-section {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(63,63,70,0.1);
        }
        .sc-section h4 {
          font-size: 11px;
          font-weight: 700;
          color: #71717a;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin: 0 0 10px;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        /* Duration */
        .sc-duration-row {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .sc-slider {
          flex: 1;
          -webkit-appearance: none;
          height: 4px;
          border-radius: 2px;
          background: rgba(139,92,246,0.15);
          outline: none;
        }
        .sc-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(139,92,246,0.3);
        }
        .sc-duration-value {
          font-size: 14px;
          font-weight: 700;
          color: #a78bfa;
          min-width: 50px;
          text-align: right;
        }

        /* Moderator */
        .sc-moderator-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .sc-mod-btn {
          padding: 6px 14px;
          border-radius: 20px;
          border: 1.5px solid;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .sc-mod-btn:hover { filter: brightness(1.2); }

        /* Participants */
        .sc-participants {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .sc-agent-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 20px;
          border: 1.5px solid;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .sc-agent-chip:hover { filter: brightness(1.2); }
        .sc-agent-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
        }

        /* Next standup info */
        .sc-next-standup {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 20px;
          padding: 12px 14px;
          border-radius: 10px;
          background: rgba(139,92,246,0.06);
          border: 1px solid rgba(139,92,246,0.1);
          color: #a1a1aa;
          font-size: 12px;
        }

        /* Footer */
        .sc-footer {
          display: flex;
          gap: 8px;
          padding: 14px 16px;
          border-top: 1px solid rgba(63,63,70,0.15);
        }
        .sc-cancel-btn {
          flex: 1;
          padding: 10px;
          border-radius: 10px;
          border: 1px solid rgba(63,63,70,0.2);
          background: transparent;
          color: #71717a;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .sc-cancel-btn:hover { background: rgba(255,255,255,0.03); color: #a1a1aa; }
        .sc-save-btn {
          flex: 1;
          padding: 10px;
          border-radius: 10px;
          border: none;
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .sc-save-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .sc-save-btn:not(:disabled):hover {
          filter: brightness(1.1);
          box-shadow: 0 4px 12px rgba(139,92,246,0.3);
        }
        .sc-save-success {
          background: linear-gradient(135deg, #22c55e, #16a34a) !important;
        }
      `}</style>
        </div>
    );

    return ReactDOM.createPortal(panel, document.body);
};
