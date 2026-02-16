import React, { useEffect, useMemo, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
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
import { X, Send, ListFilter, AlertTriangle, Activity, Zap, Clock, Link2 } from 'lucide-react';

interface ProgressTimelinePanelProps {
  agents: AgentPresence[];
  onClose: () => void;
}

const beatLabels: Record<ProgressBeat, string> = {
  hypothesis: 'Hypothesis',
  'work-in-flight': 'Work in Flight',
  result: 'Result',
  block: 'Blocker',
  'signal-spike': 'Signal Spike',
};

const colorLabels: Record<ConfidenceColor, string> = {
  blue: 'Listening / Hypothesis',
  green: 'Momentum',
  yellow: 'Directional Friction',
  red: 'Hot / Stalled',
};

const outcomeBadges: Record<NudgeOutcome, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'badge badge-pending' },
  acknowledged: { label: 'Ack', className: 'badge badge-ack' },
  resolved: { label: 'Resolved', className: 'badge badge-resolved' },
};

const channelLabels: Record<NudgeChannel, string> = {
  automation: 'Auto',
  manual: 'Manual',
  system: 'System',
};

const stateLabel = (state: TimelineStateTag) =>
  state === 'signals' ? 'Signals (Listening)' : 'Meanings (Story)';

const ProgressTimelinePanel: React.FC<ProgressTimelinePanelProps> = ({ agents, onClose }) => {
  const [entries, setEntries] = useState<ProgressTimelineEntry[]>([]);
  const [snapshots, setSnapshots] = useState<HourlySnapshotEntry[]>([]);
  const [nudges, setNudges] = useState<NudgeLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // form fields
  const [agentId, setAgentId] = useState<string>('');
  const [objectiveCode, setObjectiveCode] = useState('');
  const [beat, setBeat] = useState<ProgressBeat>('hypothesis');
  const [headline, setHeadline] = useState('');
  const [lensTag, setLensTag] = useState('');
  const [confidenceColor, setConfidenceColor] = useState<ConfidenceColor>('blue');
  const [stateTag, setStateTag] = useState<TimelineStateTag>('signals');
  const [artifactType, setArtifactType] = useState<ArtifactType>('none');
  const [artifactText, setArtifactText] = useState('');
  const [artifactUrl, setArtifactUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!agentId && agents.length > 0) setAgentId(agents[0].id);
  }, [agents, agentId]);

  useEffect(() => {
    const unsubTimeline = progressTimelineService.listen((items) => {
      setEntries(items);
      setLoading(false);
    }, { limit: 200 });

    const unsubSnapshots = progressTimelineService.listenSnapshots((items) => {
      setSnapshots(items);
    }, { limit: 40 });

    const unsubNudges = nudgeLogService.listen((items) => {
      setNudges(items);
    }, { limit: 80 });

    return () => {
      unsubTimeline();
      unsubSnapshots();
      unsubNudges();
    };
  }, []);

  const selectedAgent = useMemo(() => agents.find((a) => a.id === agentId), [agents, agentId]);

  const resetForm = () => {
    setHeadline('');
    setObjectiveCode('');
    setBeat('work-in-flight');
    setLensTag('');
    setConfidenceColor('blue');
    setStateTag('signals');
    setArtifactType('none');
    setArtifactText('');
    setArtifactUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent) {
      setError('Select an agent before posting.');
      return;
    }
    if (!objectiveCode.trim() || !headline.trim()) {
      setError('Objective code and headline are required.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await progressTimelineService.publish({
        agentId: selectedAgent.id,
        agentName: selectedAgent.displayName,
        emoji: selectedAgent.emoji,
        objectiveCode: objectiveCode.trim(),
        beat,
        headline: headline.trim(),
        lensTag: lensTag.trim(),
        confidenceColor,
        stateTag,
        artifactType,
        artifactText: artifactType === 'text' ? artifactText.trim() : '',
        artifactUrl: artifactType === 'url' ? artifactUrl.trim() : '',
      });
      resetForm();
    } catch (err: any) {
      console.error('progress timeline publish error', err);
      setError(err?.message || 'Failed to publish entry.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderArtifact = (entry: ProgressTimelineEntry) => {
    if (entry.artifactType === 'text' && entry.artifactText) {
      return <div className="pt-artifact">{entry.artifactText}</div>;
    }
    if (entry.artifactType === 'url' && entry.artifactUrl) {
      return (
        <a className="pt-artifact-link" href={entry.artifactUrl} target="_blank" rel="noreferrer">
          <Link2 size={14} /> Artifact Link
        </a>
      );
    }
    return null;
  };

  const renderTimelineCard = (entry: ProgressTimelineEntry) => (
    <div key={entry.id} className={`pt-card color-${entry.confidenceColor}`}>
      <div className="pt-card-top">
        <div>
          <div className="pt-agent-name">{entry.agentName}</div>
          <div className="pt-meta-line">
            <span>{entry.emoji || '⚡️'} {entry.objectiveCode}</span>
            <span>· {formatDistanceToNow(entry.createdAt || new Date(), { addSuffix: true })}</span>
          </div>
        </div>
        <div className="pt-card-badges">
          <span className="pt-chip objective">{beatLabels[entry.beat]}</span>
          <span className={`state-tag state-${entry.stateTag}`}>{stateLabel(entry.stateTag || 'signals')}</span>
          {entry.lensTag && <span className="pt-chip lens">{entry.lensTag}</span>}
          <span className="pt-chip confidence">{colorLabels[entry.confidenceColor]}</span>
        </div>
      </div>
      <div className="pt-headline">{entry.headline}</div>
      {renderArtifact(entry)}
    </div>
  );

  const renderSnapshotCard = (snapshot: HourlySnapshotEntry) => (
    <div key={snapshot.id} className={`pt-snapshot-card color-${snapshot.color}`}>
      <div className="pt-snapshot-top">
        <div>
          <p>{snapshot.agentName}</p>
          <span>{snapshot.objectiveCode}</span>
        </div>
        <span className="state-tag state-small state-${snapshot.stateTag}`}>{stateLabel(snapshot.stateTag)}</span>
      </div>
      <div className="pt-snapshot-meta">
        <Clock size={12} />
        <span>{format(new Date(snapshot.hourIso), 'MMM d, HH:00')}</span>
      </div>
      <p className="pt-snapshot-note">{snapshot.note || 'No note logged'}</p>
    </div>
  );

  const renderNudgeCard = (entry: NudgeLogEntry) => (
    <div key={entry.id} className="pt-nudge-card">
      <div className="pt-nudge-header">
        <div>
          <p>{entry.agentName}</p>
          <span>{entry.objectiveCode}</span>
        </div>
        <div className="pt-card-badges">
          <span className={`state-tag state-${entry.lane}`}>{stateLabel(entry.lane)}</span>
          <span className="pt-chip objective">{channelLabels[entry.channel]}</span>
          <span className={outcomeBadges[entry.outcome].className}>{outcomeBadges[entry.outcome].label}</span>
        </div>
      </div>
      <p className="pt-nudge-message">{entry.message}</p>
      <div className="pt-nudge-meta">
        <span>{formatDistanceToNow(entry.createdAt || new Date(), { addSuffix: true })}</span>
        {entry.respondedAt && <span>· replied {formatDistanceToNow(entry.respondedAt, { addSuffix: true })}</span>}
      </div>
    </div>
  );

  return (
    <div className="pt-overlay">
      <div className="pt-panel">
        <div className="pt-header">
          <div>
            <p className="pt-pill">Progress Timeline</p>
            <h2>Heartbeat Proof of Work</h2>
            <p className="pt-subhead">Log beats, artifacts, hourly snapshots, and nudge history in one stream.</p>
          </div>
          <button className="pt-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="pt-body">
          <div className="pt-form-card">
            <div className="pt-form-header">
              <ListFilter size={16} />
              <span>Post a Beat</span>
            </div>
            <form onSubmit={handleSubmit} className="pt-form">
              <label>
                <span>Agent</span>
                <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>{agent.displayName}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Objective Code</span>
                <input
                  value={objectiveCode}
                  onChange={(e) => setObjectiveCode(e.target.value.toUpperCase())}
                  placeholder="CR-02-ActII"
                />
              </label>

              <div className="pt-grid">
                <label>
                  <span>Beat</span>
                  <select value={beat} onChange={(e) => setBeat(e.target.value as ProgressBeat)}>
                    {Object.entries(beatLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Confidence Color</span>
                  <select value={confidenceColor} onChange={(e) => setConfidenceColor(e.target.value as ConfidenceColor)}>
                    {Object.entries(colorLabels).map(([key, label]) => (
                      <option key={key} value={key}>{`${label} (${key})`}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>State</span>
                  <select value={stateTag} onChange={(e) => setStateTag(e.target.value as TimelineStateTag)}>
                    <option value="signals">Signals (listening mode)</option>
                    <option value="meanings">Meanings (story mode)</option>
                  </select>
                </label>
              </div>

              <label>
                <span>Lens Tag</span>
                <input value={lensTag} onChange={(e) => setLensTag(e.target.value)} placeholder="Delight Hunt" />
              </label>

              <label>
                <span>Headline</span>
                <textarea
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Coded 50 creator comments — energy trending 'spark'"
                  rows={3}
                />
              </label>

              <div className="pt-grid">
                <label>
                  <span>Artifact Type</span>
                  <select value={artifactType} onChange={(e) => setArtifactType(e.target.value as ArtifactType)}>
                    <option value="none">None</option>
                    <option value="text">Text Snippet</option>
                    <option value="url">URL</option>
                  </select>
                </label>
                {artifactType === 'text' && (
                  <label>
                    <span>Artifact Text</span>
                    <textarea value={artifactText} onChange={(e) => setArtifactText(e.target.value)} rows={2} />
                  </label>
                )}
                {artifactType === 'url' && (
                  <label>
                    <span>Artifact URL</span>
                    <input value={artifactUrl} onChange={(e) => setArtifactUrl(e.target.value)} placeholder="https://" />
                  </label>
                )}
              </div>

              {error && <div className="pt-error">{error}</div>}

              <button className="pt-submit" type="submit" disabled={isSaving}>
                <Send size={14} /> {isSaving ? 'Posting…' : 'Publish Beat'}
              </button>
            </form>
          </div>

          <div className="pt-feed-columns">
            <div className="pt-feed-column">
              <div className="pt-feed-header">
                <h3>Live Feed</h3>
                <p className="pt-muted">Three-beat stories with artifacts & color cues</p>
              </div>
              <div className="pt-feed-list">
                {loading ? (
                  <div className="pt-empty">Loading timeline…</div>
                ) : entries.length === 0 ? (
                  <div className="pt-empty">
                    <AlertTriangle size={18} />
                    <p>No beats have been posted yet today.</p>
                  </div>
                ) : (
                  entries.map(renderTimelineCard)
                )}
              </div>
            </div>

            <div className="pt-side-column">
              <div className="pt-side-card">
                <div className="pt-side-header">
                  <Activity size={16} />
                  <span>Hourly Snapshots</span>
                </div>
                <div className="pt-side-list">
                  {snapshots.length === 0 ? (
                    <p className="pt-muted">No hourly snapshots recorded yet.</p>
                  ) : (
                    snapshots.slice(0, 6).map(renderSnapshotCard)
                  )}
                </div>
              </div>

              <div className="pt-side-card">
                <div className="pt-side-header">
                  <Zap size={16} />
                  <span>Nudge Log</span>
                </div>
                <div className="pt-side-list">
                  {nudges.length === 0 ? (
                    <p className="pt-muted">No nudges issued yet.</p>
                  ) : (
                    nudges.slice(0, 8).map(renderNudgeCard)
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .pt-overlay {
          position: fixed;
          inset: 0;
          background: rgba(3,5,8,0.92);
          backdrop-filter: blur(6px);
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pt-panel {
          width: min(1200px, 95vw);
          height: min(90vh, 760px);
          background: #03070f;
          border: 1px solid rgba(59,130,246,0.2);
          border-radius: 24px;
          display: flex;
          flex-direction: column;
          color: white;
          box-shadow: 0 40px 80px rgba(0,0,0,0.5);
        }
        .pt-header {
          padding: 24px 28px 12px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          border-bottom: 1px solid rgba(59,130,246,0.1);
        }
        .pt-pill {
          font-size: 11px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #60a5fa;
          margin-bottom: 6px;
        }
        .pt-subhead { color: #94a3b8; font-size: 13px; margin-top: 6px; }
        .pt-close {
          background: rgba(15,23,42,0.7);
          border: 1px solid rgba(148,163,184,0.2);
          border-radius: 999px;
          width: 32px; height: 32px;
          color: #e2e8f0;
        }
        .pt-body { flex: 1; display: flex; gap: 20px; padding: 20px 28px 28px; overflow: hidden; }
        .pt-form-card {
          width: 340px;
          background: rgba(15,23,42,0.85);
          border: 1px solid rgba(59,130,246,0.3);
          border-radius: 16px;
          padding: 18px;
          display: flex;
          flex-direction: column;
        }
        .pt-form-header { font-size: 12px; color: #93c5fd; display: flex; align-items: center; gap: 6px; margin-bottom: 12px; }
        .pt-form { display: flex; flex-direction: column; gap: 12px; flex: 1; overflow-y: auto; }
        label { display: flex; flex-direction: column; gap: 6px; font-size: 11px; color: #cbd5f5; }
        input, select, textarea {
          background: rgba(7,11,18,0.8);
          border: 1px solid rgba(71,85,105,0.7);
          border-radius: 8px;
          padding: 8px;
          color: white;
          font-size: 13px;
        }
        textarea { resize: vertical; }
        .pt-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
        .pt-error { color: #fca5a5; font-size: 11px; }
        .pt-submit {
          margin-top: 4px;
          padding: 10px;
          background: linear-gradient(135deg, #3b82f6, #6366f1);
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
        }
        .pt-submit:disabled { opacity: 0.5; cursor: default; }
        .pt-feed-columns { flex: 1; display: flex; gap: 18px; overflow: hidden; }
        .pt-feed-column { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .pt-feed-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .pt-feed-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding-right: 6px; }
        .pt-side-column { width: 320px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; }
        .pt-side-card {
          background: rgba(15,23,42,0.75);
          border: 1px solid rgba(148,163,184,0.2);
          border-radius: 14px;
          padding: 14px;
        }
        .pt-side-header { display: flex; align-items: center; gap: 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #cbd5f5; margin-bottom: 10px; }
        .pt-side-list { display: flex; flex-direction: column; gap: 10px; }
        .pt-card {
          border: 1px solid rgba(148,163,184,0.2);
          border-radius: 16px;
          padding: 14px 16px;
          background: rgba(15,23,42,0.6);
        }
        .pt-card-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .pt-card-badges { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
        .pt-chip { font-size: 10px; padding: 2px 8px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.15); text-transform: uppercase; letter-spacing: 0.08em; }
        .pt-chip.objective { border-color: rgba(59,130,246,0.4); color: #60a5fa; }
        .pt-chip.lens { border-color: rgba(234,179,8,0.4); color: #facc15; }
        .pt-chip.confidence { border-color: rgba(148,163,184,0.3); color: #e2e8f0; }
        .pt-agent-name { font-size: 13px; font-weight: 700; }
        .pt-meta-line { font-size: 11px; color: #94a3b8; display: flex; gap: 8px; }
        .pt-headline { font-size: 15px; font-weight: 600; margin: 10px 0 8px; }
        .pt-artifact { font-size: 12px; color: #f1f5f9; background: rgba(15,118,110,0.2); border: 1px solid rgba(45,212,191,0.2); border-radius: 8px; padding: 8px; margin-top: 10px; }
        .pt-artifact-link { display: inline-flex; align-items: center; gap: 4px; margin-top: 10px; font-size: 12px; color: #38bdf8; }
        .pt-empty { text-align: center; padding: 40px; color: #94a3b8; border: 1px dashed rgba(148,163,184,0.4); border-radius: 14px; }
        .state-tag { font-size: 10px; padding: 2px 8px; border-radius: 999px; border: 1px solid rgba(148,163,184,0.3); text-transform: uppercase; letter-spacing: 0.08em; }
        .state-signals { color: #60a5fa; border-color: rgba(59,130,246,0.4); }
        .state-meanings { color: #f97316; border-color: rgba(249,115,22,0.4); }
        .state-small { font-size: 9px; padding: 1px 6px; }
        .color-blue { border-color: rgba(59,130,246,0.4); }
        .color-green { border-color: rgba(34,197,94,0.4); }
        .color-yellow { border-color: rgba(245,158,11,0.4); }
        .color-red { border-color: rgba(248,113,113,0.5); }
        .pt-snapshot-card {
          border: 1px solid rgba(148,163,184,0.2);
          border-radius: 12px;
          padding: 10px;
          background: rgba(15,23,42,0.6);
        }
        .pt-snapshot-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .pt-snapshot-top p { margin: 0; font-weight: 600; }
        .pt-snapshot-top span { font-size: 11px; color: #94a3b8; }
        .pt-snapshot-meta { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #cbd5f5; margin-bottom: 4px; }
        .pt-snapshot-note { font-size: 12px; color: #e2e8f0; margin: 0; }
        .pt-nudge-card {
          border: 1px solid rgba(234,179,8,0.2);
          border-radius: 12px;
          padding: 12px;
          background: rgba(67,56,202,0.15);
        }
        .pt-nudge-header { display: flex; justify-content: space-between; gap: 10px; }
        .pt-nudge-header p { margin: 0; font-weight: 600; }
        .pt-nudge-header span { font-size: 11px; color: #a5b4fc; }
        .pt-nudge-message { font-size: 12px; color: #e0e7ff; margin: 8px 0; }
        .pt-nudge-meta { font-size: 11px; color: #cbd5f5; display: flex; gap: 6px; }
        .pt-muted { font-size: 12px; color: #94a3b8; }
        .badge { font-size: 10px; padding: 2px 6px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.2); }
        .badge-pending { color: #fbbf24; border-color: rgba(251,191,36,0.5); }
        .badge-ack { color: #60a5fa; border-color: rgba(96,165,250,0.5); }
        .badge-resolved { color: #34d399; border-color: rgba(52,211,153,0.5); }
      `}</style>
    </div>
  );
};

export default ProgressTimelinePanel;
