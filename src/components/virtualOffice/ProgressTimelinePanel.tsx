import React, { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { AgentPresence } from '../../api/firebase/presence/service';
import { progressTimelineService } from '../../api/firebase/progressTimeline/service';
import { nudgeLogService } from '../../api/firebase/nudgeLog/service';
import {
  ProgressTimelineEntry,
  ProgressBeat,
  ConfidenceColor,
  ArtifactType,
  TimelineStateTag,
  HourlySnapshotEntry,
  NudgeLogEntry,
  NudgeOutcome,
  NudgeChannel,
} from '../../api/firebase/progressTimeline/types';
import {
  X, Send, ChevronDown, ChevronUp,
  Lightbulb, Rocket, CheckCircle2, AlertTriangle, TrendingUp,
  Zap, Clock, Link2, MessageCircle, Activity,
} from 'lucide-react';

interface ProgressTimelinePanelProps {
  agents: AgentPresence[];
  onClose: () => void;
}

/* ── Constants ── */

const beatConfig: Record<ProgressBeat, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  hypothesis: { label: 'Hypothesis', icon: <Lightbulb size={14} />, color: '#60a5fa', bg: 'rgba(59,130,246,0.12)' },
  'work-in-flight': { label: 'Work in Flight', icon: <Rocket size={14} />, color: '#a78bfa', bg: 'rgba(139,92,246,0.12)' },
  result: { label: 'Result', icon: <CheckCircle2 size={14} />, color: '#34d399', bg: 'rgba(34,197,94,0.12)' },
  block: { label: 'Blocker', icon: <AlertTriangle size={14} />, color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  'signal-spike': { label: 'Signal Spike', icon: <TrendingUp size={14} />, color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
};

const colorConfig: Record<ConfidenceColor, { label: string; dot: string; border: string }> = {
  blue: { label: 'Listening', dot: '#3b82f6', border: 'rgba(59,130,246,0.35)' },
  green: { label: 'Momentum', dot: '#22c55e', border: 'rgba(34,197,94,0.35)' },
  yellow: { label: 'Friction', dot: '#eab308', border: 'rgba(234,179,8,0.35)' },
  red: { label: 'Stalled', dot: '#ef4444', border: 'rgba(239,68,68,0.35)' },
};

const agentAvatarColors: Record<string, string> = {
  nora: '#22c55e', scout: '#f59e0b', solara: '#f43f5e', sage: '#8b5cf6', antigravity: '#6366f1',
};

const channelLabels: Record<NudgeChannel, string> = {
  automation: 'Auto', manual: 'Manual', system: 'System',
};

const lensOptions = [
  'Delight Hunt', 'Friction Hunt', 'Partnership Leverage',
  'Retention Proof', 'Fundraising Story', 'Off-Cycle',
];

/* ── Feed item union ── */
type FeedItem =
  | { id: string; type: 'beat'; createdAt: number; payload: ProgressTimelineEntry }
  | { id: string; type: 'nudge'; createdAt: number; payload: NudgeLogEntry };

/* ── Active tab type ── */
type TabKey = 'feed' | 'snapshots';

/* ── Component ── */
const ProgressTimelinePanel: React.FC<ProgressTimelinePanelProps> = ({ agents, onClose }) => {
  const [entries, setEntries] = useState<ProgressTimelineEntry[]>([]);
  const [snapshots, setSnapshots] = useState<HourlySnapshotEntry[]>([]);
  const [nudges, setNudges] = useState<NudgeLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('feed');
  const [composerOpen, setComposerOpen] = useState(false);

  // Feed items
  const feedItems = useMemo<FeedItem[]>(() => {
    const beats: FeedItem[] = entries.map((e) => ({
      id: `beat-${e.id}`, type: 'beat', createdAt: e.createdAt?.getTime?.() || 0, payload: e,
    }));
    const nudgeItems: FeedItem[] = nudges.map((n) => ({
      id: `nudge-${n.id}`, type: 'nudge', createdAt: n.createdAt?.getTime?.() || 0, payload: n,
    }));
    return [...beats, ...nudgeItems].sort((a, b) => b.createdAt - a.createdAt);
  }, [entries, nudges]);

  // Composer state
  const [agentId, setAgentId] = useState<string>('');
  const [objectiveCode, setObjectiveCode] = useState('');
  const [beat, setBeat] = useState<ProgressBeat>('hypothesis');
  const [headline, setHeadline] = useState('');
  const [lensTag, setLensTag] = useState(lensOptions[0]);
  const [confidenceColor, setConfidenceColor] = useState<ConfidenceColor>('blue');
  const [stateTag, setStateTag] = useState<TimelineStateTag>('signals');
  const [artifactType, setArtifactType] = useState<ArtifactType>('none');
  const [artifactText, setArtifactText] = useState('');
  const [artifactUrl, setArtifactUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!agentId && agents.length > 0) setAgentId(agents[0].id); }, [agents, agentId]);

  useEffect(() => {
    const unsub1 = progressTimelineService.listen((items) => { setEntries(items); setLoading(false); }, { limit: 200 });
    const unsub2 = progressTimelineService.listenSnapshots((items) => setSnapshots(items), { limit: 40 });
    const unsub3 = nudgeLogService.listen((items) => setNudges(items), { limit: 80 });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  const selectedAgent = useMemo(() => agents.find((a) => a.id === agentId), [agents, agentId]);

  const resetForm = () => {
    setHeadline(''); setObjectiveCode(''); setBeat('work-in-flight');
    setLensTag(lensOptions[0]); setConfidenceColor('blue'); setStateTag('signals');
    setArtifactType('none'); setArtifactText(''); setArtifactUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent) { setError('Select an agent.'); return; }
    if (!objectiveCode.trim() || !headline.trim()) { setError('Objective code and headline required.'); return; }
    setIsSaving(true); setError(null);
    try {
      await progressTimelineService.publish({
        agentId: selectedAgent.id, agentName: selectedAgent.displayName, emoji: selectedAgent.emoji,
        objectiveCode: objectiveCode.trim(), beat, headline: headline.trim(), lensTag: lensTag.trim(),
        confidenceColor, stateTag, artifactType,
        artifactText: artifactType === 'text' ? artifactText.trim() : '',
        artifactUrl: artifactType === 'url' ? artifactUrl.trim() : '',
      });
      resetForm(); setComposerOpen(false);
    } catch (err: any) { setError(err?.message || 'Failed to publish.'); }
    finally { setIsSaving(false); }
  };

  /* ── Avatar helper ── */
  const AgentAvatar: React.FC<{ name: string; emoji?: string; id?: string; size?: number }> = ({ name, emoji, id, size = 36 }) => {
    const color = agentAvatarColors[id ?? name.toLowerCase()] || '#6366f1';
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: `linear-gradient(135deg, ${color}33, ${color}18)`,
        border: `2px solid ${color}66`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.45, fontWeight: 700,
      }}>
        {emoji || name.charAt(0).toUpperCase()}
      </div>
    );
  };

  /* ── Beat card (Twitter-style) ── */
  const renderBeatCard = (entry: ProgressTimelineEntry) => {
    const cfg = beatConfig[entry.beat];
    const cc = colorConfig[entry.confidenceColor];
    const timeAgo = formatDistanceToNow(entry.createdAt || new Date(), { addSuffix: true });
    return (
      <div key={entry.id} className="feed-card" style={{ borderLeft: `3px solid ${cc.dot}` }}>
        <div className="feed-card-row">
          <AgentAvatar name={entry.agentName} emoji={entry.emoji} id={entry.agentId} />
          <div className="feed-card-body">
            <div className="feed-card-header">
              <span className="feed-name">{entry.agentName}</span>
              <span className="feed-obj-code">{entry.objectiveCode}</span>
              <span className="feed-dot">·</span>
              <span className="feed-time">{timeAgo}</span>
            </div>
            <p className="feed-headline">{entry.headline}</p>
            {/* Artifact */}
            {entry.artifactType === 'text' && entry.artifactText && (
              <div className="feed-artifact">{entry.artifactText}</div>
            )}
            {entry.artifactType === 'url' && entry.artifactUrl && (
              <a className="feed-artifact-link" href={entry.artifactUrl} target="_blank" rel="noreferrer">
                <Link2 size={13} /> {entry.artifactUrl.replace(/^https?:\/\//, '').slice(0, 50)}
              </a>
            )}
            {/* Tags */}
            <div className="feed-tags">
              <span className="feed-tag" style={{ background: cfg.bg, color: cfg.color, borderColor: `${cfg.color}44` }}>
                {cfg.icon} {cfg.label}
              </span>
              {entry.lensTag && (
                <span className="feed-tag feed-tag-lens">{entry.lensTag}</span>
              )}
              <span className="feed-tag feed-tag-conf">
                <span className="conf-dot" style={{ background: cc.dot }} />
                {cc.label}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ── Nudge card ── */
  const renderNudgeCard = (entry: NudgeLogEntry) => {
    const timeAgo = formatDistanceToNow(entry.createdAt || new Date(), { addSuffix: true });
    const outcomeColors: Record<NudgeOutcome, string> = { pending: '#fbbf24', acknowledged: '#60a5fa', resolved: '#34d399' };
    return (
      <div key={entry.id} className="feed-card feed-nudge" style={{ borderLeft: '3px solid #a78bfa' }}>
        <div className="feed-card-row">
          <AgentAvatar name={entry.agentName} emoji={undefined} id={entry.agentId} />
          <div className="feed-card-body">
            <div className="feed-card-header">
              <span className="feed-name">{entry.agentName}</span>
              <span className="feed-nudge-badge">
                <Zap size={11} /> Nudge
              </span>
              <span className="feed-dot">·</span>
              <span className="feed-time">{timeAgo}</span>
            </div>
            <p className="feed-headline">{entry.message}</p>
            <div className="feed-tags">
              <span className="feed-tag" style={{ color: outcomeColors[entry.outcome], borderColor: `${outcomeColors[entry.outcome]}55` }}>
                {entry.outcome === 'resolved' ? <CheckCircle2 size={12} /> : entry.outcome === 'acknowledged' ? <MessageCircle size={12} /> : <Clock size={12} />}
                {entry.outcome.charAt(0).toUpperCase() + entry.outcome.slice(1)}
              </span>
              <span className="feed-tag feed-tag-lens">{channelLabels[entry.channel]}</span>
              {entry.respondedAt && (
                <span className="feed-tag feed-tag-resp">
                  Replied {formatDistanceToNow(entry.respondedAt, { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ── Snapshot card ── */
  const renderSnapshotCard = (s: HourlySnapshotEntry) => {
    const cc = colorConfig[s.color] || colorConfig.blue;
    return (
      <div key={s.id} className="snap-card" style={{ borderLeft: `3px solid ${cc.dot}` }}>
        <div className="snap-top">
          <AgentAvatar name={s.agentName} emoji={undefined} id={s.agentId} size={28} />
          <div>
            <span className="snap-name">{s.agentName}</span>
            <span className="snap-code">{s.objectiveCode}</span>
          </div>
          <span className="snap-time"><Clock size={11} /> {format(new Date(s.hourIso), 'MMM d, HH:mm')}</span>
        </div>
        <p className="snap-note">{s.note || 'No note logged'}</p>
      </div>
    );
  };

  return (
    <div className="tl-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tl-panel">
        {/* Header */}
        <div className="tl-header">
          <div>
            <h2 className="tl-title">Activity Feed</h2>
            <p className="tl-subtitle">Beats, nudges, and team progress — all in one stream</p>
          </div>
          <button className="tl-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="tl-tabs">
          <button
            className={`tl-tab ${activeTab === 'feed' ? 'active' : ''}`}
            onClick={() => setActiveTab('feed')}
          >
            <Activity size={14} /> Feed
            {feedItems.length > 0 && <span className="tl-tab-count">{feedItems.length}</span>}
          </button>
          <button
            className={`tl-tab ${activeTab === 'snapshots' ? 'active' : ''}`}
            onClick={() => setActiveTab('snapshots')}
          >
            <Clock size={14} /> Snapshots
            {snapshots.length > 0 && <span className="tl-tab-count">{snapshots.length}</span>}
          </button>
          <div style={{ flex: 1 }} />
          <button
            className={`tl-compose-toggle ${composerOpen ? 'open' : ''}`}
            onClick={() => setComposerOpen(!composerOpen)}
          >
            <Send size={14} /> Post Beat
            {composerOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Composer (collapsible) */}
        {composerOpen && (
          <div className="tl-composer">
            <form onSubmit={handleSubmit} className="tl-compose-form">
              <div className="tl-compose-top">
                {selectedAgent && (
                  <AgentAvatar name={selectedAgent.displayName} emoji={selectedAgent.emoji} id={selectedAgent.id} size={32} />
                )}
                <select className="tl-select-agent" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)}
                </select>
                <input
                  className="tl-input-obj"
                  value={objectiveCode}
                  onChange={(e) => setObjectiveCode(e.target.value.toUpperCase())}
                  placeholder="OBJ-CODE"
                />
              </div>
              <textarea
                className="tl-compose-input"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="What's happening? Describe the beat…"
                rows={2}
              />
              <div className="tl-compose-options">
                <div className="tl-option-group">
                  {(Object.keys(beatConfig) as ProgressBeat[]).map((b) => {
                    const cfg = beatConfig[b];
                    return (
                      <button key={b} type="button"
                        className={`tl-beat-chip ${beat === b ? 'active' : ''}`}
                        style={beat === b ? { background: cfg.bg, color: cfg.color, borderColor: `${cfg.color}66` } : {}}
                        onClick={() => setBeat(b)}
                      >
                        {cfg.icon} {cfg.label}
                      </button>
                    );
                  })}
                </div>
                <div className="tl-option-row">
                  <select value={confidenceColor} onChange={(e) => setConfidenceColor(e.target.value as ConfidenceColor)}>
                    {(Object.keys(colorConfig) as ConfidenceColor[]).map((c) => (
                      <option key={c} value={c}>{colorConfig[c].label}</option>
                    ))}
                  </select>
                  <select value={stateTag} onChange={(e) => setStateTag(e.target.value as TimelineStateTag)}>
                    <option value="signals">Signals</option>
                    <option value="meanings">Meanings</option>
                  </select>
                  <select value={lensTag} onChange={(e) => setLensTag(e.target.value)}>
                    {lensOptions.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              {error && <p className="tl-error">{error}</p>}
              <button className="tl-publish-btn" type="submit" disabled={isSaving}>
                <Send size={14} /> {isSaving ? 'Posting…' : 'Publish'}
              </button>
            </form>
          </div>
        )}

        {/* Content */}
        <div className="tl-content">
          {activeTab === 'feed' && (
            <div className="tl-feed">
              {loading ? (
                <div className="tl-empty">
                  <div className="tl-loading-dots"><span /><span /><span /></div>
                  <p>Loading feed…</p>
                </div>
              ) : feedItems.length === 0 ? (
                <div className="tl-empty">
                  <Activity size={32} style={{ opacity: 0.3 }} />
                  <p>No beats or nudges logged yet.</p>
                  <p className="tl-empty-sub">Post the first one using the button above.</p>
                </div>
              ) : (
                feedItems.map((item) =>
                  item.type === 'beat'
                    ? renderBeatCard(item.payload as ProgressTimelineEntry)
                    : renderNudgeCard(item.payload as NudgeLogEntry)
                )
              )}
            </div>
          )}

          {activeTab === 'snapshots' && (
            <div className="tl-feed">
              {snapshots.length === 0 ? (
                <div className="tl-empty">
                  <Clock size={32} style={{ opacity: 0.3 }} />
                  <p>No hourly snapshots recorded yet.</p>
                </div>
              ) : (
                snapshots.map(renderSnapshotCard)
              )}
            </div>
          )}
        </div>

      </div>

      <style jsx>{`
        /* ── Overlay ── */
        .tl-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.75);
          backdrop-filter: blur(12px);
          z-index: 2000;
          display: flex; align-items: center; justify-content: center;
          animation: tl-fade-in 0.2s ease-out;
        }
        @keyframes tl-fade-in { from { opacity: 0; } to { opacity: 1; } }

        /* ── Panel ── */
        .tl-panel {
          width: min(680px, 94vw);
          height: min(88vh, 820px);
          background: #0f1419;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          display: flex; flex-direction: column;
          color: #e7e9ea;
          box-shadow: 0 24px 80px rgba(0,0,0,0.6);
          overflow: hidden;
          animation: tl-slide-up 0.3s ease-out;
        }
        @keyframes tl-slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        /* ── Header ── */
        .tl-header {
          padding: 20px 24px 16px;
          display: flex; align-items: flex-start; justify-content: space-between;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .tl-title { font-size: 20px; font-weight: 700; margin: 0; letter-spacing: -0.02em; }
        .tl-subtitle { font-size: 13px; color: #71767b; margin: 4px 0 0; }
        .tl-close {
          width: 34px; height: 34px; border-radius: 50%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: #71767b; display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.15s;
        }
        .tl-close:hover { background: rgba(255,255,255,0.1); color: #e7e9ea; }

        /* ── Tabs ── */
        .tl-tabs {
          display: flex; align-items: center; gap: 2px;
          padding: 0 24px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .tl-tab {
          display: flex; align-items: center; gap: 6px;
          padding: 12px 16px; font-size: 13px; font-weight: 600;
          color: #71767b; background: none; border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer; transition: all 0.15s;
        }
        .tl-tab:hover { color: #e7e9ea; }
        .tl-tab.active { color: #1d9bf0; border-bottom-color: #1d9bf0; }
        .tl-tab-count {
          font-size: 11px; font-weight: 700; padding: 1px 6px;
          background: rgba(29,155,240,0.15); color: #1d9bf0;
          border-radius: 10px; min-width: 20px; text-align: center;
        }
        .tl-compose-toggle {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 14px; font-size: 13px; font-weight: 600;
          background: linear-gradient(135deg, #1d9bf0, #1a8cd8);
          color: white; border: none; border-radius: 20px;
          cursor: pointer; transition: all 0.2s;
          margin: 6px 0;
        }
        .tl-compose-toggle:hover { filter: brightness(1.1); transform: scale(1.02); }
        .tl-compose-toggle.open { background: rgba(255,255,255,0.08); color: #71767b; }

        /* ── Composer ── */
        .tl-composer {
          padding: 16px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.02);
          animation: tl-expand 0.2s ease-out;
        }
        @keyframes tl-expand { from { max-height: 0; opacity: 0; } to { max-height: 400px; opacity: 1; } }
        .tl-compose-form { display: flex; flex-direction: column; gap: 12px; }
        .tl-compose-top { display: flex; align-items: center; gap: 10px; }
        .tl-select-agent, .tl-input-obj {
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px; padding: 6px 10px; color: #e7e9ea; font-size: 13px;
        }
        .tl-select-agent { flex: 1; }
        .tl-input-obj { width: 120px; text-align: center; font-weight: 700; letter-spacing: 0.05em; }
        .tl-compose-input {
          width: 100%; background: transparent; border: none;
          color: #e7e9ea; font-size: 15px; resize: none;
          padding: 8px 0; outline: none;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          font-family: inherit;
        }
        .tl-compose-input::placeholder { color: #536471; }
        .tl-compose-options { display: flex; flex-direction: column; gap: 8px; }
        .tl-option-group { display: flex; flex-wrap: wrap; gap: 6px; }
        .tl-beat-chip {
          display: flex; align-items: center; gap: 4px;
          padding: 4px 10px; font-size: 11px; font-weight: 600;
          background: rgba(255,255,255,0.04); color: #71767b;
          border: 1px solid rgba(255,255,255,0.08); border-radius: 16px;
          cursor: pointer; transition: all 0.15s;
        }
        .tl-beat-chip:hover { border-color: rgba(255,255,255,0.2); color: #e7e9ea; }
        .tl-beat-chip.active { font-weight: 700; }
        .tl-option-row { display: flex; gap: 8px; }
        .tl-option-row select {
          flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px; padding: 6px 8px; color: #e7e9ea; font-size: 12px;
        }
        .tl-error { color: #f87171; font-size: 12px; margin: 0; }
        .tl-publish-btn {
          align-self: flex-end; display: flex; align-items: center; gap: 6px;
          padding: 8px 20px; font-size: 13px; font-weight: 700;
          background: linear-gradient(135deg, #1d9bf0, #1a8cd8);
          color: white; border: none; border-radius: 20px;
          cursor: pointer; transition: all 0.15s;
        }
        .tl-publish-btn:hover { filter: brightness(1.1); }
        .tl-publish-btn:disabled { opacity: 0.5; cursor: default; }

        /* ── Content ── */
        .tl-content { flex: 1; overflow-y: auto; }
        .tl-feed { display: flex; flex-direction: column; }

        /* ── Feed Card (Twitter-style) ── */
        .feed-card {
          padding: 16px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          transition: background 0.15s;
          border-left: 3px solid transparent;
        }
        .feed-card:hover { background: rgba(255,255,255,0.02); }
        .feed-card-row { display: flex; gap: 12px; }
        .feed-card-body { flex: 1; min-width: 0; }
        .feed-card-header {
          display: flex; align-items: center; gap: 6px;
          font-size: 13px; flex-wrap: wrap;
        }
        .feed-name { font-weight: 700; color: #e7e9ea; }
        .feed-obj-code { color: #1d9bf0; font-weight: 500; font-size: 12px; }
        .feed-dot { color: #536471; }
        .feed-time { color: #71767b; font-size: 12px; }
        .feed-headline {
          margin: 6px 0 0; font-size: 14px; line-height: 1.45;
          color: #e7e9ea; word-wrap: break-word;
        }
        .feed-artifact {
          margin-top: 10px; padding: 10px 12px;
          background: rgba(29,155,240,0.06);
          border: 1px solid rgba(29,155,240,0.15);
          border-radius: 12px; font-size: 13px; color: #d1d5db;
          line-height: 1.45;
        }
        .feed-artifact-link {
          display: inline-flex; align-items: center; gap: 5px;
          margin-top: 10px; font-size: 13px; color: #1d9bf0;
          text-decoration: none;
        }
        .feed-artifact-link:hover { text-decoration: underline; }
        .feed-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
        .feed-tag {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 10px; font-size: 11px; font-weight: 600;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px; color: #71767b;
        }
        .feed-tag-lens { color: #fbbf24; border-color: rgba(251,191,36,0.25); }
        .feed-tag-conf { display: inline-flex; align-items: center; gap: 5px; }
        .feed-tag-resp { color: #71767b; font-weight: 400; font-size: 11px; }
        .conf-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

        /* ── Nudge card accent ── */
        .feed-nudge { }
        .feed-nudge-badge {
          display: inline-flex; align-items: center; gap: 3px;
          font-size: 11px; font-weight: 700; color: #a78bfa;
          background: rgba(139,92,246,0.12); padding: 1px 8px;
          border-radius: 10px;
        }

        /* ── Snapshot card ── */
        .snap-card {
          padding: 14px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          border-left: 3px solid transparent;
          transition: background 0.15s;
        }
        .snap-card:hover { background: rgba(255,255,255,0.02); }
        .snap-top { display: flex; align-items: center; gap: 10px; }
        .snap-name { font-size: 13px; font-weight: 700; }
        .snap-code { font-size: 12px; color: #1d9bf0; margin-left: 6px; }
        .snap-time {
          margin-left: auto; display: flex; align-items: center; gap: 4px;
          font-size: 11px; color: #71767b;
        }
        .snap-note { font-size: 13px; color: #d1d5db; margin: 8px 0 0 38px; line-height: 1.4; }

        /* ── Empty state ── */
        .tl-empty {
          display: flex; flex-direction: column; align-items: center;
          padding: 60px 20px; color: #536471; gap: 8px;
        }
        .tl-empty p { margin: 0; font-size: 14px; }
        .tl-empty-sub { font-size: 12px; color: #71767b; }
        .tl-loading-dots { display: flex; gap: 6px; }
        .tl-loading-dots span {
          width: 8px; height: 8px; border-radius: 50%;
          background: #1d9bf0; animation: tl-pulse 1.2s ease-in-out infinite;
        }
        .tl-loading-dots span:nth-child(2) { animation-delay: 0.15s; }
        .tl-loading-dots span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes tl-pulse { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; } 40% { transform: scale(1); opacity: 1; } }

        /* ── Scrollbar ── */
        .tl-content::-webkit-scrollbar { width: 6px; }
        .tl-content::-webkit-scrollbar-track { background: transparent; }
        .tl-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
        .tl-content::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
      `}</style>
    </div>
  );
};

export default ProgressTimelinePanel;
