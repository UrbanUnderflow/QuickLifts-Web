import React, { useEffect, useMemo, useState } from 'react';
import { AgentPresence } from '../../api/firebase/presence/service';
import { progressTimelineService, ProgressTimelineEntry, ProgressBeat, ConfidenceColor, ArtifactType } from '../../api/firebase/progressTimeline/service';
import { X, Send, ListFilter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ProgressTimelinePanelProps {
  agents: AgentPresence[];
  onClose: () => void;
}

const beatLabels: Record<ProgressBeat, string> = {
  'hypothesis': 'Hypothesis',
  'work-in-flight': 'Work in Flight',
  'result': 'Result',
  'block': 'Blocker',
  'signal-spike': 'Signal Spike',
};

const colorLabels: Record<ConfidenceColor, string> = {
  blue: 'Listening / Hypothesis',
  green: 'Momentum',
  yellow: 'Directional Friction',
  red: 'Hot / Stalled',
};

export const ProgressTimelinePanel: React.FC<ProgressTimelinePanelProps> = ({ agents, onClose }) => {
  const [entries, setEntries] = useState<ProgressTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [agentId, setAgentId] = useState<string>('');
  const [objectiveCode, setObjectiveCode] = useState('');
  const [beat, setBeat] = useState<ProgressBeat>('hypothesis');
  const [headline, setHeadline] = useState('');
  const [lensTag, setLensTag] = useState('');
  const [confidenceColor, setConfidenceColor] = useState<ConfidenceColor>('blue');
  const [stateTag, setStateTag] = useState<'signals' | 'meanings'>('signals');
  const [artifactType, setArtifactType] = useState<ArtifactType>('none');
  const [artifactText, setArtifactText] = useState('');
  const [artifactUrl, setArtifactUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!agentId && agents.length > 0) {
      setAgentId(agents[0].id);
    }
  }, [agents, agentId]);

  useEffect(() => {
    const unsub = progressTimelineService.listen((items) => {
      setEntries(items);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const selectedAgent = useMemo(() => agents.find(a => a.id === agentId), [agents, agentId]);

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

  return (
    <div className="pt-overlay">
      <div className="pt-panel">
        <div className="pt-header">
          <div>
            <p className="pt-pill">Progress Timeline</p>
            <h2>Heartbeat Proof of Work</h2>
            <p className="pt-subhead">Log beats, artifacts, and nudges in one live stream.</p>
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
                  {agents.map(agent => (
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
                  <select value={stateTag} onChange={(e) => setStateTag(e.target.value as 'signals' | 'meanings')}>
                    <option value="signals">Signals (listening mode)</option>
                    <option value="meanings">Meanings (story mode)</option>
                  </select>
                </label>
              </div>

              <label>
                <span>Lens Tag</span>
                <input
                  value={lensTag}
                  onChange={(e) => setLensTag(e.target.value)}
                  placeholder="Delight Hunt"
                />
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
                    <input
                      value={artifactText}
                      onChange={(e) => setArtifactText(e.target.value)}
                      placeholder="Quote, metric, or proof snippet"
                    />
                  </label>
                )}
                {artifactType === 'url' && (
                  <label>
                    <span>Artifact URL</span>
                    <input
                      value={artifactUrl}
                      onChange={(e) => setArtifactUrl(e.target.value)}
                      placeholder="https://"
                    />
                  </label>
                )}
              </div>

              {error && <p className="pt-error">{error}</p>}

              <button type="submit" className="pt-submit" disabled={isSaving}>
                {isSaving ? <span>Posting…</span> : (<><Send size={14} /> Post beat</>)}
              </button>
            </form>
          </div>

          <div className="pt-feed">
            <div className="pt-feed-header">
              <h3>Live Feed</h3>
              {loading ? <span className="pt-muted">Loading…</span> : <span className="pt-muted">{entries.length} posts</span>}
            </div>
            <div className="pt-feed-list">
              {entries.map(entry => (
                <div key={entry.id} className={`pt-card color-${entry.confidenceColor}`}>
                  <div className="pt-card-top">
                    <div className="pt-card-badges">
                      <span className={`pt-chip beat-${entry.beat}`}>{beatLabels[entry.beat]}</span>
                      <span className="pt-chip objective">{entry.objectiveCode}</span>
                      {entry.lensTag && <span className="pt-chip lens">{entry.lensTag}</span>}
                    </div>
                    <span className="pt-time">
                      {entry.createdAt ? `${formatDistanceToNow(entry.createdAt, { addSuffix: true })}` : 'just now'}
                    </span>
                  </div>
                  <div className="pt-card-body">
                    <p className="pt-headline">{entry.headline}</p>
                    <div className="pt-meta">
                      <span>{entry.emoji || '⚡️'} {entry.agentName}</span>
                      <span className={`state-tag state-${entry.stateTag}`}>{entry.stateTag}</span>
                    </div>
                    {entry.artifactType === 'text' && entry.artifactText && (
                      <div className="pt-artifact">{entry.artifactText}</div>
                    )}
                    {entry.artifactType === 'url' && entry.artifactUrl && (
                      <a className="pt-artifact-link" href={entry.artifactUrl} target="_blank" rel="noreferrer">
                        View artifact ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {!loading && entries.length === 0 && (
                <div className="pt-empty">
                  <p>No beats logged yet. Post the first hypothesis to start the stream.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .pt-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.65);
          backdrop-filter: blur(6px);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pt-panel {
          width: 1100px;
          max-width: 95vw;
          height: 90vh;
          background: #070b12;
          border: 1px solid rgba(59,130,246,0.25);
          border-radius: 20px;
          box-shadow: 0 20px 80px rgba(0,0,0,0.6);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .pt-header {
          padding: 20px 28px;
          border-bottom: 1px solid rgba(59,130,246,0.2);
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }
        .pt-pill {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.3em;
          color: #60a5fa;
          margin-bottom: 6px;
        }
        .pt-header h2 { margin: 0; font-size: 24px; color: white; }
        .pt-subhead { margin: 4px 0 0; font-size: 12px; color: #94a3b8; }
        .pt-close {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #f8fafc;
          border-radius: 8px;
          padding: 8px;
          cursor: pointer;
        }
        .pt-body { flex: 1; display: flex; gap: 20px; padding: 20px 28px 28px; overflow: hidden; }
        .pt-form-card {
          width: 340px;
          background: rgba(15,23,42,0.8);
          border: 1px solid rgba(59,130,246,0.2);
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
        .pt-feed { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .pt-feed-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .pt-feed-header h3 { margin: 0; font-size: 16px; }
        .pt-muted { font-size: 12px; color: #94a3b8; }
        .pt-feed-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding-right: 6px; }
        .pt-card {
          border: 1px solid rgba(148,163,184,0.2);
          border-radius: 16px;
          padding: 14px 16px;
          background: rgba(15,23,42,0.6);
        }
        .pt-card-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .pt-card-badges { display: flex; flex-wrap: wrap; gap: 6px; }
        .pt-chip { font-size: 10px; padding: 2px 8px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.15); text-transform: uppercase; letter-spacing: 0.08em; }
        .pt-chip.objective { border-color: rgba(59,130,246,0.4); color: #60a5fa; }
        .pt-chip.lens { border-color: rgba(234,179,8,0.4); color: #facc15; }
        .pt-headline { font-size: 15px; font-weight: 600; margin: 10px 0 8px; }
        .pt-meta { font-size: 12px; color: #94a3b8; display: flex; justify-content: space-between; }
        .pt-artifact { font-size: 12px; color: #f1f5f9; background: rgba(15,118,110,0.2); border: 1px solid rgba(45,212,191,0.2); border-radius: 8px; padding: 8px; margin-top: 10px; }
        .pt-artifact-link { display: inline-flex; align-items: center; gap: 4px; margin-top: 10px; font-size: 12px; color: #38bdf8; }
        .pt-time { font-size: 11px; color: #cbd5f5; }
        .pt-empty { text-align: center; padding: 40px; color: #94a3b8; border: 1px dashed rgba(148,163,184,0.4); border-radius: 14px; }
        .state-tag { font-size: 10px; padding: 2px 8px; border-radius: 999px; border: 1px solid rgba(148,163,184,0.3); text-transform: uppercase; letter-spacing: 0.08em; }
        .state-signals { color: #60a5fa; border-color: rgba(59,130,246,0.4); }
        .state-meanings { color: #f97316; border-color: rgba(249,115,22,0.4); }
        .color-blue { border-color: rgba(59,130,246,0.3); }
        .color-green { border-color: rgba(34,197,94,0.3); }
        .color-yellow { border-color: rgba(245,158,11,0.3); }
        .color-red { border-color: rgba(248,113,113,0.3); }
      `}</style>
    </div>
  );
};

export default ProgressTimelinePanel;
