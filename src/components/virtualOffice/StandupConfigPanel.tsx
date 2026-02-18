import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  X, Clock, Sun, Moon, Calendar, ToggleLeft, ToggleRight,
  Users, Settings,
} from 'lucide-react';
import { db } from '../../api/firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

/* ─── Types ─────────────────────────────────────────── */

interface StandupSchedule {
  morningEnabled: boolean;
  morningHour: number;
  morningMinute: number;
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

const AGENT_MAP: Record<string, { color: string; emoji: string }> = {
  nora: { color: '#22c55e', emoji: '⚡' },
  scout: { color: '#f59e0b', emoji: '🕵️' },
  solara: { color: '#f43f5e', emoji: '❤️‍🔥' },
  sage: { color: '#06b6d4', emoji: '🧬' },
};

const formatTime12 = (hour: number, minute: number): string => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  const m = minute.toString().padStart(2, '0');
  return `${h}:${m} ${period}`;
};

interface StandupConfigPanelProps {
  onClose: () => void;
}

/* ─── Component ─────────────────────────────────────── */

export const StandupConfigPanel: React.FC<StandupConfigPanelProps> = ({ onClose }) => {
  const [config, setConfig] = useState<StandupSchedule>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

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

  const update = <K extends keyof StandupSchedule>(key: K, value: StandupSchedule[K]) => {
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

  const panel = (
    <div className="scp-overlay" onClick={onClose}>
      <div className="scp-panel" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="scp-header">
          <div className="scp-hdr-left">
            <div className="scp-hdr-icon">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="scp-hdr-title">Standup Schedule</h2>
              <p className="scp-hdr-sub">Daily meeting configuration</p>
            </div>
          </div>
          <button className="scp-close" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        {/* ── Body ── */}
        <div className="scp-body">
          {loading ? (
            <div className="scp-loading"><div className="scp-spinner" /><p>Loading config…</p></div>
          ) : (
            <>
              {/* ── Morning card ── */}
              <div className={`scp-card ${config.morningEnabled ? '' : 'scp-card-off'}`}>
                <div className="scp-card-row">
                  <div className="scp-card-left">
                    <div className="scp-card-icon scp-morning-icon"><Sun className="w-4 h-4" /></div>
                    <div>
                      <div className="scp-card-name">Morning Standup</div>
                      <div className="scp-card-time">{formatTime12(config.morningHour, config.morningMinute)} EST</div>
                    </div>
                  </div>
                  <button className="scp-toggle" onClick={() => update('morningEnabled', !config.morningEnabled)}>
                    {config.morningEnabled
                      ? <ToggleRight className="w-7 h-7" style={{ color: '#f59e0b' }} />
                      : <ToggleLeft className="w-7 h-7" style={{ color: '#3f3f46' }} />}
                  </button>
                </div>
                {config.morningEnabled && (
                  <div className="scp-time-row">
                    <div className="scp-time-field">
                      <span className="scp-time-label">Hour</span>
                      <select className="scp-sel" value={config.morningHour} onChange={e => update('morningHour', +e.target.value)}>
                        {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>)}
                      </select>
                    </div>
                    <span className="scp-colon">:</span>
                    <div className="scp-time-field">
                      <span className="scp-time-label">Min</span>
                      <select className="scp-sel" value={config.morningMinute} onChange={e => update('morningMinute', +e.target.value)}>
                        {[0, 15, 30, 45].map(m => <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Evening card ── */}
              <div className={`scp-card ${config.eveningEnabled ? '' : 'scp-card-off'}`}>
                <div className="scp-card-row">
                  <div className="scp-card-left">
                    <div className="scp-card-icon scp-evening-icon"><Moon className="w-4 h-4" /></div>
                    <div>
                      <div className="scp-card-name">Evening Standup</div>
                      <div className="scp-card-time">{formatTime12(config.eveningHour, config.eveningMinute)} EST</div>
                    </div>
                  </div>
                  <button className="scp-toggle" onClick={() => update('eveningEnabled', !config.eveningEnabled)}>
                    {config.eveningEnabled
                      ? <ToggleRight className="w-7 h-7" style={{ color: '#818cf8' }} />
                      : <ToggleLeft className="w-7 h-7" style={{ color: '#3f3f46' }} />}
                  </button>
                </div>
                {config.eveningEnabled && (
                  <div className="scp-time-row">
                    <div className="scp-time-field">
                      <span className="scp-time-label">Hour</span>
                      <select className="scp-sel" value={config.eveningHour} onChange={e => update('eveningHour', +e.target.value)}>
                        {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>)}
                      </select>
                    </div>
                    <span className="scp-colon">:</span>
                    <div className="scp-time-field">
                      <span className="scp-time-label">Min</span>
                      <select className="scp-sel" value={config.eveningMinute} onChange={e => update('eveningMinute', +e.target.value)}>
                        {[0, 15, 30, 45].map(m => <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Duration ── */}
              <div className="scp-section">
                <div className="scp-section-hdr"><Clock className="w-3.5 h-3.5" /> Max Duration</div>
                <div className="scp-dur-row">
                  <input
                    type="range" min={10} max={30} step={5}
                    value={config.maxDurationMinutes}
                    onChange={e => update('maxDurationMinutes', +e.target.value)}
                    className="scp-slider"
                  />
                  <div className="scp-dur-badge">{config.maxDurationMinutes} min</div>
                </div>
              </div>

              {/* ── Moderator ── */}
              <div className="scp-section">
                <div className="scp-section-hdr"><Settings className="w-3.5 h-3.5" /> Moderator</div>
                <div className="scp-chips">
                  {Object.entries(AGENT_MAP).map(([id, { color, emoji }]) => {
                    const active = config.moderator === id;
                    return (
                      <button
                        key={id}
                        className={`scp-chip ${active ? 'scp-chip-on' : ''}`}
                        style={active ? {
                          background: `${color}18`,
                          borderColor: `${color}55`,
                          color,
                        } : {}}
                        onClick={() => update('moderator', id)}
                      >
                        <span className="scp-chip-emoji">{emoji}</span>
                        {id.charAt(0).toUpperCase() + id.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Participants ── */}
              <div className="scp-section">
                <div className="scp-section-hdr"><Users className="w-3.5 h-3.5" /> Participants</div>
                <div className="scp-chips">
                  {Object.entries(AGENT_MAP).map(([id, { color, emoji }]) => {
                    const active = config.agents.includes(id);
                    return (
                      <button
                        key={id}
                        className={`scp-chip ${active ? 'scp-chip-on' : ''}`}
                        style={active ? {
                          background: `${color}18`,
                          borderColor: `${color}55`,
                          color,
                        } : {}}
                        onClick={() => toggleAgent(id)}
                      >
                        <span className="scp-chip-dot" style={{ background: active ? color : '#3f3f46' }} />
                        {id.charAt(0).toUpperCase() + id.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Next standup ── */}
              <div className="scp-next">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  Next:{' '}
                  {config.morningEnabled
                    ? `Morning at ${formatTime12(config.morningHour, config.morningMinute)}`
                    : config.eveningEnabled
                      ? `Evening at ${formatTime12(config.eveningHour, config.eveningMinute)}`
                      : 'None scheduled'}
                </span>
              </div>

              {/* ── Timezone indicator ── */}
              <div className="scp-tz-info">
                <span style={{ fontSize: 11, color: '#71717a' }}>
                  🌍 Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  {' '}({new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop()})
                </span>
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        {!loading && (
          <div className="scp-footer">
            <button className="scp-btn-cancel" onClick={onClose}>Cancel</button>
            <button
              className={`scp-btn-save ${saved ? 'scp-saved' : ''}`}
              onClick={handleSave}
              disabled={saving || !dirty}
            >
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        /* ── Overlay ── */
        .scp-overlay {
          position: fixed; inset: 0; z-index: 9998;
          display: flex; justify-content: flex-end;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(6px);
          animation: scpFade .2s ease-out;
        }
        @keyframes scpFade { from { opacity: 0 } }

        /* ── Panel ── */
        .scp-panel {
          width: 380px; max-width: 92vw; height: 100vh;
          background: #10101c;
          border-left: 1px solid rgba(255,255,255,0.06);
          display: flex; flex-direction: column;
          animation: scpSlide .28s cubic-bezier(.4,0,.2,1);
          box-shadow: -12px 0 48px rgba(0,0,0,0.5);
        }
        @keyframes scpSlide { from { transform: translateX(100%) } }

        /* ── Header ── */
        .scp-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 18px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .scp-hdr-left { display: flex; align-items: center; gap: 12px; }
        .scp-hdr-icon {
          width: 40px; height: 40px; border-radius: 12px;
          background: linear-gradient(135deg, #312e81, #1e1b4b);
          border: 1px solid rgba(129,140,248,0.2);
          display: flex; align-items: center; justify-content: center;
          color: #a5b4fc;
        }
        .scp-hdr-title { font-size: 16px; font-weight: 700; color: #f4f4f5; margin: 0; }
        .scp-hdr-sub { font-size: 11px; color: #71717a; margin: 2px 0 0; }
        .scp-close {
          width: 32px; height: 32px; border-radius: 8px;
          border: none; background: rgba(255,255,255,0.04);
          color: #71717a; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all .15s;
        }
        .scp-close:hover { background: rgba(255,255,255,0.08); color: #d4d4d8; }

        /* ── Body ── */
        .scp-body { flex: 1; overflow-y: auto; padding: 16px 18px; }

        .scp-loading {
          display: flex; flex-direction: column; align-items: center;
          padding: 60px 20px; color: #52525b; font-size: 13px;
        }
        .scp-spinner {
          width: 28px; height: 28px;
          border: 2px solid rgba(129,140,248,0.15);
          border-top-color: #818cf8;
          border-radius: 50%; animation: scpSpin .7s linear infinite;
          margin-bottom: 12px;
        }
        @keyframes scpSpin { to { transform: rotate(360deg) } }

        /* ── Schedule cards ── */
        .scp-card {
          border-radius: 14px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          padding: 16px;
          margin-bottom: 10px;
          transition: opacity .2s;
        }
        .scp-card-off { opacity: 0.4; }
        .scp-card-row {
          display: flex; align-items: center; justify-content: space-between;
        }
        .scp-card-left { display: flex; align-items: center; gap: 12px; }
        .scp-card-icon {
          width: 36px; height: 36px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .scp-morning-icon {
          background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.2);
          color: #fbbf24;
        }
        .scp-evening-icon {
          background: rgba(129,140,248,0.12); border: 1px solid rgba(129,140,248,0.2);
          color: #a5b4fc;
        }
        .scp-card-name { font-size: 14px; font-weight: 600; color: #e4e4e7; }
        .scp-card-time { font-size: 11px; color: #71717a; margin-top: 1px; }

        .scp-toggle {
          background: none; border: none; cursor: pointer;
          padding: 2px; border-radius: 6px; display: flex;
        }
        .scp-toggle:hover { background: rgba(255,255,255,0.04); }

        /* ── Time picker row ── */
        .scp-time-row {
          display: flex; align-items: flex-end; gap: 0;
          margin-top: 14px; padding-top: 14px;
          border-top: 1px solid rgba(255,255,255,0.04);
        }
        .scp-time-field { display: flex; flex-direction: column; gap: 5px; }
        .scp-time-label {
          font-size: 10px; font-weight: 600; color: #52525b;
          text-transform: uppercase; letter-spacing: .5px;
        }
        .scp-sel {
          appearance: none; -webkit-appearance: none;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 8px 14px;
          color: #e4e4e7; font-size: 18px; font-weight: 700;
          font-family: 'SF Mono', 'Menlo', monospace;
          cursor: pointer; outline: none;
          min-width: 72px; text-align: center;
          transition: border-color .15s;
        }
        .scp-sel:focus { border-color: rgba(129,140,248,0.5); }
        .scp-sel option { background: #1a1a2e; color: #e4e4e7; }
        .scp-colon {
          font-size: 22px; font-weight: 800; color: #3f3f46;
          padding: 0 6px 8px;
        }

        /* ── Sections ── */
        .scp-section {
          margin-top: 18px; padding-top: 18px;
          border-top: 1px solid rgba(255,255,255,0.04);
        }
        .scp-section-hdr {
          font-size: 10px; font-weight: 700; color: #71717a;
          text-transform: uppercase; letter-spacing: .6px;
          display: flex; align-items: center; gap: 6px;
          margin-bottom: 12px;
        }

        /* ── Duration slider ── */
        .scp-dur-row { display: flex; align-items: center; gap: 14px; }
        .scp-slider {
          flex: 1; -webkit-appearance: none;
          height: 5px; border-radius: 3px;
          background: linear-gradient(90deg, rgba(129,140,248,0.25), rgba(129,140,248,0.08));
          outline: none;
        }
        .scp-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px; height: 20px; border-radius: 50%;
          background: linear-gradient(135deg, #818cf8, #6366f1);
          cursor: pointer;
          box-shadow: 0 2px 10px rgba(99,102,241,0.4);
          border: 2px solid #10101c;
        }
        .scp-dur-badge {
          font-size: 15px; font-weight: 700; color: #a5b4fc;
          min-width: 55px; text-align: right;
          font-family: 'SF Mono', 'Menlo', monospace;
        }

        /* ── Chips (moderator + participants) ── */
        .scp-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .scp-chip {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 14px; border-radius: 20px;
          border: 1.5px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          color: #71717a;
          font-size: 12px; font-weight: 600;
          cursor: pointer; transition: all .15s;
        }
        .scp-chip:hover { border-color: rgba(255,255,255,0.15); color: #a1a1aa; }
        .scp-chip-on { font-weight: 700; }
        .scp-chip-emoji { font-size: 13px; }
        .scp-chip-dot {
          width: 7px; height: 7px; border-radius: 50%;
          transition: background .15s;
        }

        /* ── Next standup info ── */
        .scp-next {
          display: flex; align-items: center; gap: 8px;
          margin-top: 20px; padding: 12px 14px;
          border-radius: 10px;
          background: rgba(129,140,248,0.06);
          border: 1px solid rgba(129,140,248,0.1);
          color: #a1a1aa; font-size: 12px;
        }

        /* ── Timezone info ── */
        .scp-tz-info {
          margin-top: 8px; padding-left: 14px;
        }

        /* ── Footer ── */
        .scp-footer {
          display: flex; gap: 8px;
          padding: 14px 18px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .scp-btn-cancel {
          flex: 1; padding: 11px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.08);
          background: transparent;
          color: #71717a; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all .15s;
        }
        .scp-btn-cancel:hover { background: rgba(255,255,255,0.04); color: #a1a1aa; }
        .scp-btn-save {
          flex: 1; padding: 11px;
          border-radius: 10px; border: none;
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          color: #fff; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all .15s;
        }
        .scp-btn-save:disabled { opacity: 0.35; cursor: not-allowed; }
        .scp-btn-save:not(:disabled):hover {
          filter: brightness(1.15);
          box-shadow: 0 4px 16px rgba(99,102,241,0.35);
        }
        .scp-saved { background: linear-gradient(135deg, #22c55e, #16a34a) !important; }
      `}</style>
    </div>
  );

  return ReactDOM.createPortal(panel, document.body);
};
