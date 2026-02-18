import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  X, Clock, Activity, Calendar, ToggleLeft, ToggleRight,
  Users, Settings, Zap,
} from 'lucide-react';
import { db } from '../../api/firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

/* ─── Types ─────────────────────────────────────────── */

interface TelemetrySchedule {
  enabled: boolean;
  intervalMinutes: number; // 60 = every hour, 30 = every 30min, etc.
  moderator: string;
  agents: string[];
  maxDurationMinutes: number;
  lastUpdatedAt?: any;
}

const DEFAULT_CONFIG: TelemetrySchedule = {
  enabled: true,
  intervalMinutes: 60,
  moderator: 'nora',
  agents: ['nora', 'scout', 'solara', 'sage'],
  maxDurationMinutes: 10,
};

const CONFIG_DOC_PATH = 'standup-config/default';

const AGENT_MAP: Record<string, { color: string; emoji: string }> = {
  nora: { color: '#22c55e', emoji: '⚡' },
  scout: { color: '#f59e0b', emoji: '🕵️' },
  solara: { color: '#f43f5e', emoji: '❤️‍🔥' },
  sage: { color: '#06b6d4', emoji: '🧬' },
};

const INTERVAL_OPTIONS = [
  { value: 30, label: 'Every 30 min' },
  { value: 60, label: 'Every hour' },
  { value: 120, label: 'Every 2 hours' },
  { value: 180, label: 'Every 3 hours' },
];

interface StandupConfigPanelProps {
  onClose: () => void;
}

/* ─── Component ─────────────────────────────────────── */

export const StandupConfigPanel: React.FC<StandupConfigPanelProps> = ({ onClose }) => {
  const [config, setConfig] = useState<TelemetrySchedule>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, CONFIG_DOC_PATH));
        if (snap.exists()) {
          const data = snap.data();
          // Migrate from old morning/evening format
          setConfig({
            enabled: data.enabled ?? data.morningEnabled ?? true,
            intervalMinutes: data.intervalMinutes ?? 60,
            moderator: data.moderator ?? 'nora',
            agents: data.agents ?? ['nora', 'scout', 'solara', 'sage'],
            maxDurationMinutes: data.maxDurationMinutes ?? 10,
          });
        }
      } catch (err) {
        console.error('Failed to load telemetry config:', err);
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
      console.error('Failed to save telemetry config:', err);
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof TelemetrySchedule>(key: K, value: TelemetrySchedule[K]) => {
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

  // Compute the next check time (upcoming hour boundary)
  const now = new Date();
  const nextCheckMinute = config.intervalMinutes;
  const nextCheck = new Date(now);
  if (nextCheckMinute === 60) {
    nextCheck.setHours(now.getHours() + 1, 0, 0, 0);
  } else if (nextCheckMinute === 30) {
    const nextHalf = now.getMinutes() < 30 ? 30 : 60;
    if (nextHalf === 60) {
      nextCheck.setHours(now.getHours() + 1, 0, 0, 0);
    } else {
      nextCheck.setMinutes(30, 0, 0);
    }
  } else {
    const intervalsToday = Math.ceil((now.getHours() * 60 + now.getMinutes()) / nextCheckMinute);
    const nextMinutes = intervalsToday * nextCheckMinute;
    nextCheck.setHours(Math.floor(nextMinutes / 60), nextMinutes % 60, 0, 0);
  }
  const nextCheckStr = nextCheck.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const panel = (
    <div className="scp-overlay" onClick={onClose}>
      <div className="scp-panel" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="scp-header">
          <div className="scp-hdr-left">
            <div className="scp-hdr-icon">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="scp-hdr-title">Telemetry Schedule</h2>
              <p className="scp-hdr-sub">Heartbeat Protocol · System health checks</p>
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
              {/* ── Enable/Disable ── */}
              <div className={`scp-card ${config.enabled ? '' : 'scp-card-off'}`}>
                <div className="scp-card-row">
                  <div className="scp-card-left">
                    <div className="scp-card-icon scp-telemetry-icon"><Zap className="w-4 h-4" /></div>
                    <div>
                      <div className="scp-card-name">Telemetry Checks</div>
                      <div className="scp-card-time">
                        {config.enabled
                          ? `Running ${INTERVAL_OPTIONS.find(o => o.value === config.intervalMinutes)?.label?.toLowerCase() || 'every hour'}`
                          : 'Disabled'}
                      </div>
                    </div>
                  </div>
                  <button className="scp-toggle" onClick={() => update('enabled', !config.enabled)}>
                    {config.enabled
                      ? <ToggleRight className="w-7 h-7" style={{ color: '#818cf8' }} />
                      : <ToggleLeft className="w-7 h-7" style={{ color: '#3f3f46' }} />}
                  </button>
                </div>
              </div>

              {/* ── Interval selector ── */}
              {config.enabled && (
                <div className="scp-section">
                  <div className="scp-section-hdr"><Clock className="w-3.5 h-3.5" /> Check Frequency</div>
                  <div className="scp-interval-grid">
                    {INTERVAL_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        className={`scp-interval-btn ${config.intervalMinutes === opt.value ? 'scp-interval-active' : ''}`}
                        onClick={() => update('intervalMinutes', opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="scp-section-desc">
                    System health, idle agent detection, and work assignment runs on this cadence.
                    Telemetry over ceremony.
                  </p>
                </div>
              )}

              {/* ── Duration ── */}
              <div className="scp-section">
                <div className="scp-section-hdr"><Clock className="w-3.5 h-3.5" /> Max Duration</div>
                <div className="scp-dur-row">
                  <input
                    type="range" min={5} max={20} step={5}
                    value={config.maxDurationMinutes}
                    onChange={e => update('maxDurationMinutes', +e.target.value)}
                    className="scp-slider"
                  />
                  <div className="scp-dur-badge">{config.maxDurationMinutes} min</div>
                </div>
              </div>

              {/* ── Moderator ── */}
              <div className="scp-section">
                <div className="scp-section-hdr"><Settings className="w-3.5 h-3.5" /> Check Lead</div>
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
                <div className="scp-section-hdr"><Users className="w-3.5 h-3.5" /> Agents Monitored</div>
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

              {/* ── Next check ── */}
              <div className="scp-next">
                <Activity className="w-3.5 h-3.5" />
                <span>
                  {config.enabled
                    ? `Next telemetry check: ${nextCheckStr}`
                    : 'Telemetry checks disabled'}
                </span>
              </div>

              {/* ── Protocol info ── */}
              <div className="scp-protocol-info">
                <div className="scp-protocol-title">⚡ Heartbeat Protocol</div>
                <p className="scp-protocol-desc">
                  Replaces traditional standups with continuous system monitoring.
                  Each check scans agent health, detects idle workers, and assigns
                  new Capsules from the backlog automatically.
                </p>
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
          color: #a1a1aa; cursor: pointer; display: flex;
          align-items: center; justify-content: center;
        }
        .scp-close:hover { background: rgba(255,255,255,0.08); }

        /* ── Body ── */
        .scp-body { flex: 1; overflow-y: auto; padding: 16px 18px; }
        .scp-loading {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 12px; height: 200px; color: #71717a;
        }
        .scp-spinner {
          width: 28px; height: 28px; border-radius: 50%;
          border: 2.5px solid rgba(255,255,255,0.06);
          border-top-color: #818cf8; animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg) } }

        /* ── Cards ── */
        .scp-card {
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px; padding: 14px 16px;
          background: rgba(255,255,255,0.02);
          margin-bottom: 16px;
          transition: all .2s;
        }
        .scp-card-off { opacity: 0.5; }
        .scp-card-row {
          display: flex; align-items: center; justify-content: space-between;
        }
        .scp-card-left { display: flex; align-items: center; gap: 12px; }
        .scp-card-icon {
          width: 36px; height: 36px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
        }
        .scp-telemetry-icon {
          background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1));
          border: 1px solid rgba(129,140,248,0.2);
          color: #818cf8;
        }
        .scp-card-name { font-size: 14px; font-weight: 600; color: #e4e4e7; }
        .scp-card-time { font-size: 11px; color: #71717a; margin-top: 1px; }
        .scp-toggle {
          background: none; border: none; cursor: pointer;
          display: flex; align-items: center; padding: 4px;
        }

        /* ── Sections ── */
        .scp-section { margin-bottom: 18px; }
        .scp-section-hdr {
          display: flex; align-items: center; gap: 6px;
          font-size: 11px; font-weight: 600; color: #a1a1aa;
          text-transform: uppercase; letter-spacing: 0.7px;
          margin-bottom: 10px;
        }
        .scp-section-desc {
          font-size: 11px; color: #52525b; margin: 8px 0 0;
          line-height: 1.5; font-style: italic;
        }

        /* ── Interval grid ── */
        .scp-interval-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
        }
        .scp-interval-btn {
          padding: 10px 12px; border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.02);
          color: #a1a1aa; font-size: 12px; font-weight: 500;
          cursor: pointer; transition: all .15s;
        }
        .scp-interval-btn:hover {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.1);
        }
        .scp-interval-active {
          background: rgba(99,102,241,0.12) !important;
          border-color: rgba(99,102,241,0.4) !important;
          color: #a5b4fc !important;
        }

        /* ── Duration ── */
        .scp-dur-row { display: flex; align-items: center; gap: 12px; }
        .scp-slider {
          flex: 1; -webkit-appearance: none; height: 4px;
          border-radius: 4px; background: rgba(255,255,255,0.06);
          outline: none;
        }
        .scp-slider::-webkit-slider-thumb {
          -webkit-appearance: none; width: 16px; height: 16px;
          border-radius: 50%; background: #818cf8; cursor: pointer;
          border: 2px solid #1e1b4b;
        }
        .scp-dur-badge {
          background: rgba(255,255,255,0.04); padding: 4px 10px;
          border-radius: 6px; font-size: 12px; font-weight: 600;
          color: #a5b4fc; min-width: 55px; text-align: center;
          border: 1px solid rgba(129,140,248,0.15);
        }

        /* ── Chips ── */
        .scp-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .scp-chip {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 14px; border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.02);
          color: #a1a1aa; font-size: 12px; font-weight: 500;
          cursor: pointer; transition: all .15s;
        }
        .scp-chip:hover { background: rgba(255,255,255,0.04); }
        .scp-chip-on { font-weight: 600; }
        .scp-chip-emoji { font-size: 14px; }
        .scp-chip-dot {
          width: 6px; height: 6px; border-radius: 50%; transition: background .2s;
        }

        /* ── Next check ── */
        .scp-next {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 14px; border-radius: 10px;
          background: rgba(99,102,241,0.06);
          border: 1px solid rgba(99,102,241,0.12);
          color: #a5b4fc; font-size: 12px; font-weight: 500;
          margin-bottom: 12px;
        }

        /* ── Protocol info ── */
        .scp-protocol-info {
          padding: 12px 14px; border-radius: 10px;
          background: rgba(139,92,246,0.06);
          border: 1px solid rgba(139,92,246,0.12);
          margin-bottom: 12px;
        }
        .scp-protocol-title {
          font-size: 12px; font-weight: 700; color: #c4b5fd;
          margin-bottom: 6px;
        }
        .scp-protocol-desc {
          font-size: 11px; color: #71717a; line-height: 1.6; margin: 0;
        }

        /* ── TZ ── */
        .scp-tz-info { padding: 4px 0 8px; text-align: center; }

        /* ── Footer ── */
        .scp-footer {
          display: flex; gap: 10px; padding: 14px 18px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .scp-btn-cancel {
          flex: 1; padding: 10px; border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.02);
          color: #a1a1aa; font-size: 13px; cursor: pointer;
        }
        .scp-btn-save {
          flex: 1; padding: 10px; border-radius: 10px;
          border: 1px solid rgba(99,102,241,0.3);
          background: linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15));
          color: #c7d2fe; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all .15s;
        }
        .scp-btn-save:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.25));
          border-color: rgba(99,102,241,0.5);
        }
        .scp-btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
        .scp-saved { border-color: rgba(34,197,94,0.4) !important; color: #86efac !important; }
      `}</style>
    </div>
  );

  return ReactDOM.createPortal(panel, document.body);
};
