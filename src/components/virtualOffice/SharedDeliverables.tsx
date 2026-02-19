import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useRouter } from 'next/router';
import { X, Package, ExternalLink, FileText, ChevronRight, RefreshCw } from 'lucide-react';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../api/firebase/config';

/* ─── types ─── */
interface Deliverable {
  id: string;
  title: string;
  description: string;
  filename: string;
  filePath: string;
  emoji: string;
  tags: string[];
  status: string;
  completedAt?: string;
  taskRef?: string;
  agentId: string;
}

interface AgentInfo {
  id: string;
  displayName: string;
  emoji: string;
  color: string;
  deliverableDir?: string;
}

const AGENTS: AgentInfo[] = [
  { id: 'sage', displayName: 'Sage', emoji: '🧬', color: '#34d399', deliverableDir: 'docs/sage/deliverables' },
  { id: 'nora', displayName: 'Nora', emoji: '⚡', color: '#22c55e', deliverableDir: 'docs/agents/nora/deliverables' },
  { id: 'scout', displayName: 'Scout', emoji: '🕵️', color: '#f59e0b', deliverableDir: 'docs/agents/scout/deliverables' },
  { id: 'solara', displayName: 'Solara', emoji: '❤️‍🔥', color: '#f43f5e', deliverableDir: 'docs/agents/solara/deliverables' },
];

const ARTIFACT_EMOJI: Record<string, string> = {
  code: '💻',
  document: '📄',
  test: '🧪',
  config: '⚙️',
  research: '🔬',
};

const AGENT_ROUTE_ALIASES: Record<string, string> = {
  scouts: 'scout',
};

const normalizeAgentKey = (value?: string) => (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const resolveAgentRouteId = (agentId?: string): string | null => {
  const normalized = normalizeAgentKey(agentId);
  if (!normalized) return null;
  const canonical = AGENT_ROUTE_ALIASES[normalized] || normalized;
  return AGENTS.some((agent) => agent.id === canonical) ? canonical : null;
};

/* ─── component ─── */
interface SharedDeliverablesProps {
  onClose: () => void;
}

export const SharedDeliverables: React.FC<SharedDeliverablesProps> = ({ onClose }) => {
  const router = useRouter();
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAgent, setFilterAgent] = useState<string | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileLoading, setFileLoading] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    const all: Deliverable[] = [];

    try {
      // Query Firestore agent-deliverables collection
      const q = query(
        collection(db, 'agent-deliverables'),
        orderBy('createdAt', 'desc'),
        limit(200),
      );
      const snap = await getDocs(q);

      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const filePath = data.filePath || '';
        const basename = filePath.split('/').pop() || data.title || 'untitled';

        all.push({
          id: docSnap.id,
          title: data.title || basename,
          description: data.description || `Task: ${data.taskName || 'Unknown'}`,
          filename: basename,
          filePath,
          emoji: ARTIFACT_EMOJI[data.artifactType] || '📄',
          tags: data.tags || [data.artifactType || 'document'].filter(Boolean),
          status: data.status || 'pending',
          completedAt: data.createdAt?.toDate?.()?.toISOString?.() || undefined,
          taskRef: data.taskName || data.taskId || undefined,
          agentId: data.agentId || 'unknown',
        });
      }
    } catch (err) {
      console.error('Failed to load deliverables from Firestore:', err);
    }

    setDeliverables(all);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const filtered = filterAgent === 'all'
    ? deliverables
    : deliverables.filter((d) => (resolveAgentRouteId(d.agentId) || d.agentId) === filterAgent);

  const getAgent = (id: string) => AGENTS.find((a) => a.id === (resolveAgentRouteId(id) || id)) || AGENTS[0];

  const getAgentRouteFromId = (agentId: string) => {
    const routeId = resolveAgentRouteId(agentId) || normalizeAgentKey(agentId);
    return AGENTS.find((agent) => agent.id === routeId) || AGENTS[0];
  };

  const handleExpand = async (d: Deliverable) => {
    if (expandedId === d.id) {
      setExpandedId(null);
      setFileContent('');
      return;
    }
    setExpandedId(d.id);
    setFileLoading(true);
    try {
      const agent = getAgent(d.agentId);
      const filePath = d.filePath?.trim();
      const deliverableDir = (agent?.deliverableDir || '').trim().replace(/\/+$/, '');
      const fullFilePath = filePath
        ? deliverableDir && !filePath.includes('/') && !filePath.startsWith('http://') && !filePath.startsWith('https://')
          ? `${deliverableDir}/${filePath}`
          : filePath
        : '';
      if (!d.filePath) {
        setFileContent('⚠️ No file path recorded for this deliverable.');
      } else {
        const res = await fetch(`/api/read-file?path=${encodeURIComponent(fullFilePath)}`);
        if (res.ok) {
          const data = await res.json();
          setFileContent(data.content || '(empty file)');
        } else {
          setFileContent(`⚠️ File not found: ${fullFilePath}`);
        }
      }
    } catch {
      setFileContent('Failed to load file content.');
    }
    setFileLoading(false);
  };

  const navigateToAgent = (agentId: string, filePath?: string, taskRef?: string) => {
    const agent = getAgentRouteFromId(agentId);
    const params = new URLSearchParams();
    if (filePath?.trim()) params.set('file', filePath.trim());
    if (taskRef?.trim()) {
      params.set('taskRef', taskRef.trim());
      params.set('taskId', taskRef.trim());
      params.set('objectiveCode', taskRef.trim());
    }
    onClose();
    router.push(`/admin/deliverables/${agent.id}${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const agentCounts = AGENTS.map((a) => ({
    ...a,
    count: deliverables.filter((d) => (resolveAgentRouteId(d.agentId) || normalizeAgentKey(d.agentId)) === a.id).length,
  }));

  const panel = (
    <div className="sd-overlay" onClick={onClose}>
      <div className="sd-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sd-header">
          <div className="sd-header-left">
            <div className="sd-header-icon">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="sd-title">Shared Deliverables</h2>
              <p className="sd-subtitle">
                {deliverables.length} deliverable{deliverables.length !== 1 ? 's' : ''} across {agentCounts.filter((a) => a.count > 0).length} agent{agentCounts.filter((a) => a.count > 0).length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="sd-header-actions">
            <button className="sd-icon-btn" onClick={loadAll} title="Refresh">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'sd-spinning' : ''}`} />
            </button>
            <button className="sd-close" onClick={onClose}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Agent filter pills */}
        <div className="sd-filters">
          <button
            className={`sd-filter-pill ${filterAgent === 'all' ? 'active' : ''}`}
            onClick={() => setFilterAgent('all')}
          >
            All <span className="sd-pill-count">{deliverables.length}</span>
          </button>
          {agentCounts.map((a) => (
            <button
              key={a.id}
              className={`sd-filter-pill ${filterAgent === a.id ? 'active' : ''}`}
              onClick={() => setFilterAgent(a.id)}
              style={{ '--pill-color': a.color } as React.CSSProperties}
            >
              <span className="sd-pill-emoji">{a.emoji}</span>
              {a.displayName}
              <span className="sd-pill-count">{a.count}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="sd-content">
          {loading && (
            <div className="sd-empty">
              <div className="sd-loader" />
              <p>Loading deliverables…</p>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="sd-empty">
              <Package className="w-10 h-10 sd-empty-icon" />
              <p className="sd-empty-title">No deliverables yet</p>
              <p className="sd-empty-desc">
                When agents complete research tasks, their deliverables will appear here.
              </p>
            </div>
          )}

          {!loading && filtered.map((d) => {
            const agent = getAgent(d.agentId);
            const isExpanded = expandedId === d.id;
            return (
              <div key={d.id} className={`sd-item ${isExpanded ? 'sd-item-expanded' : ''}`}>
                <div className="sd-item-header" onClick={() => handleExpand(d)}>
                  <span className="sd-item-emoji">{d.emoji}</span>
                  <div className="sd-item-info">
                    <span className="sd-item-title">{d.title}</span>
                    <span className="sd-item-desc">{d.description}</span>
                    <div className="sd-item-meta">
                      <span
                        className="sd-agent-badge"
                        style={{ borderColor: `${agent.color}40`, color: agent.color }}
                      >
                        {agent.emoji} {agent.displayName}
                      </span>
                      {d.status === 'pending-recovery' && (
                        <span className="sd-status-badge pending">⏳ pending</span>
                      )}
                      {d.status === 'complete' && (
                        <span className="sd-status-badge complete">✓ complete</span>
                      )}
                      {d.completedAt && (
                        <span className="sd-date">{new Date(d.completedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="sd-item-actions">
                    <button
                      className="sd-nav-btn"
                      onClick={(e) => { e.stopPropagation(); navigateToAgent(d.agentId, d.filePath, d.taskRef); }}
                      title={`Open ${agent.displayName}'s deliverables page`}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                    <span className={`sd-chevron ${isExpanded ? 'open' : ''}`}>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="sd-item-body">
                    {d.tags.length > 0 && (
                      <div className="sd-tags">
                        {d.tags.map((t) => (
                          <span key={t} className="sd-tag">{t}</span>
                        ))}
                      </div>
                    )}
                    <div className="sd-file-preview">
                      <div className="sd-file-header">
                        <FileText className="w-3 h-3" />
                        <span>{d.filename}</span>
                      </div>
                      {fileLoading ? (
                        <div className="sd-file-loading">
                          <div className="sd-loader-sm" />
                          <span>Loading…</span>
                        </div>
                      ) : (
                        <div className="sd-file-content-rendered">
                          <MarkdownRenderer content={fileContent} accentColor={agent.color} />
                        </div>
                      )}
                    </div>
                    <button
                      className="sd-open-page-btn"
                      onClick={() => navigateToAgent(d.agentId, d.filePath, d.taskRef)}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open {agent.displayName}&apos;s full deliverables page
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .sd-overlay {
          position: fixed; inset: 0; z-index: 9998;
          display: flex; justify-content: flex-end;
          background: rgba(0,0,0,0.45);
          backdrop-filter: blur(4px);
          animation: sdFade 0.2s ease-out;
        }
        @keyframes sdFade { from { opacity: 0; } to { opacity: 1; } }

        .sd-panel {
          width: 480px; max-width: 92vw; height: 100vh;
          background: linear-gradient(180deg, #111118 0%, #0d0d18 100%);
          border-left: 1px solid rgba(99,102,241,0.1);
          display: flex; flex-direction: column;
          animation: sdSlideIn 0.3s ease-out;
          box-shadow: -12px 0 48px rgba(0,0,0,0.5);
        }
        @keyframes sdSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        .sd-header {
          display: flex; align-items: center;
          justify-content: space-between;
          padding: 20px 20px 14px;
          border-bottom: 1px solid rgba(63,63,70,0.12);
        }
        .sd-header-left { display: flex; align-items: center; gap: 12px; }
        .sd-header-icon {
          width: 38px; height: 38px; border-radius: 10px;
          background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1));
          border: 1px solid rgba(99,102,241,0.15);
          display: flex; align-items: center; justify-content: center;
          color: #818cf8;
        }
        .sd-title { font-size: 15px; font-weight: 700; color: #e4e4e7; margin: 0; }
        .sd-subtitle { font-size: 11px; color: #71717a; margin: 2px 0 0; }
        .sd-header-actions { display: flex; align-items: center; gap: 4px; }
        .sd-icon-btn {
          width: 30px; height: 30px; border-radius: 8px;
          border: none; background: transparent; color: #71717a;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .sd-icon-btn:hover { background: rgba(255,255,255,0.06); color: #e4e4e7; }
        .sd-spinning { animation: sdSpin 0.8s linear infinite; }
        @keyframes sdSpin { to { transform: rotate(360deg); } }
        .sd-close {
          width: 30px; height: 30px; border-radius: 8px;
          border: none; background: transparent; color: #71717a;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
        }
        .sd-close:hover { background: rgba(255,255,255,0.06); color: #e4e4e7; }

        /* Filters */
        .sd-filters {
          display: flex; flex-wrap: wrap; gap: 6px;
          padding: 12px 20px;
          border-bottom: 1px solid rgba(63,63,70,0.1);
        }
        .sd-filter-pill {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 4px 10px; border-radius: 8px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          color: #94a3b8; font-size: 11px; font-weight: 500;
          cursor: pointer; transition: all 0.2s; font-family: inherit;
        }
        .sd-filter-pill:hover { background: rgba(255,255,255,0.06); }
        .sd-filter-pill.active {
          background: rgba(99,102,241,0.12);
          border-color: rgba(99,102,241,0.25);
          color: #a5b4fc;
        }
        .sd-pill-emoji { font-size: 12px; }
        .sd-pill-count {
          font-size: 10px; font-weight: 600; padding: 0 5px;
          background: rgba(255,255,255,0.06); border-radius: 4px;
          font-family: 'JetBrains Mono', monospace;
        }

        /* Content */
        .sd-content {
          flex: 1; overflow-y: auto; padding: 12px;
          scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.06) transparent;
        }

        .sd-empty {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 60px 20px; text-align: center;
        }
        .sd-empty-icon { color: #3f3f46; margin-bottom: 12px; }
        .sd-empty-title { font-size: 14px; font-weight: 600; color: #52525b; margin: 0; }
        .sd-empty-desc { font-size: 12px; color: #3f3f46; margin: 6px 0 0; max-width: 280px; }
        .sd-loader {
          width: 28px; height: 28px;
          border: 2px solid rgba(99,102,241,0.15);
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: sdSpin 0.8s linear infinite;
          margin-bottom: 12px;
        }

        /* Individual deliverable */
        .sd-item {
          border-radius: 12px;
          border: 1px solid rgba(63,63,70,0.1);
          background: rgba(255,255,255,0.01);
          margin-bottom: 8px;
          overflow: hidden;
          transition: all 0.2s;
        }
        .sd-item:hover { border-color: rgba(99,102,241,0.12); }
        .sd-item-expanded {
          border-color: rgba(99,102,241,0.2);
          background: rgba(99,102,241,0.02);
        }

        .sd-item-header {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 14px; cursor: pointer; user-select: none;
          transition: background 0.15s;
        }
        .sd-item-header:hover { background: rgba(255,255,255,0.02); }
        .sd-item-emoji { font-size: 22px; flex-shrink: 0; margin-top: 1px; }
        .sd-item-info { flex: 1; min-width: 0; }
        .sd-item-title {
          display: block; font-size: 13px; font-weight: 600; color: #e4e4e7;
        }
        .sd-item-desc {
          display: block; font-size: 11px; color: #71717a; line-height: 1.4;
          margin-top: 2px;
          display: -webkit-box; -webkit-line-clamp: 2;
          -webkit-box-orient: vertical; overflow: hidden;
        }
        .sd-item-meta {
          display: flex; align-items: center; gap: 8px;
          margin-top: 6px; flex-wrap: wrap;
        }
        .sd-agent-badge {
          padding: 1px 8px; border-radius: 12px;
          border: 1px solid; font-size: 10px; font-weight: 600;
        }
        .sd-status-badge {
          font-size: 9px; font-weight: 600; padding: 1px 6px;
          border-radius: 4px; font-family: 'JetBrains Mono', monospace;
        }
        .sd-status-badge.pending {
          background: rgba(245,158,11,0.12); color: #f59e0b;
          border: 1px solid rgba(245,158,11,0.2);
        }
        .sd-status-badge.complete {
          background: rgba(34,197,94,0.1); color: #22c55e;
          border: 1px solid rgba(34,197,94,0.2);
        }
        .sd-date {
          font-size: 10px; color: #52525b;
          font-family: 'JetBrains Mono', monospace;
        }
        .sd-item-actions {
          display: flex; align-items: center; gap: 4px;
          flex-shrink: 0; margin-top: 2px;
        }
        .sd-nav-btn {
          width: 26px; height: 26px; border-radius: 6px;
          border: 1px solid rgba(99,102,241,0.15);
          background: rgba(99,102,241,0.06); color: #818cf8;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .sd-nav-btn:hover {
          background: rgba(99,102,241,0.15);
          border-color: rgba(99,102,241,0.3);
          color: #a5b4fc;
        }
        .sd-chevron {
          color: #52525b; display: flex; align-items: center;
          transition: transform 0.2s;
        }
        .sd-chevron.open { transform: rotate(90deg); }

        /* Expanded body */
        .sd-item-body {
          padding: 0 14px 14px;
          border-top: 1px solid rgba(63,63,70,0.08);
          animation: sdExpand 0.2s ease-out;
        }
        @keyframes sdExpand {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .sd-tags {
          display: flex; flex-wrap: wrap; gap: 4px;
          padding: 10px 0 8px;
        }
        .sd-tag {
          font-size: 9px; padding: 2px 6px; border-radius: 4px;
          background: rgba(255,255,255,0.04); color: #71717a;
          font-family: 'JetBrains Mono', monospace;
        }
        .sd-file-preview {
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.04);
          background: rgba(0,0,0,0.2);
          overflow: hidden;
        }
        .sd-file-header {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 10px;
          background: rgba(255,255,255,0.02);
          border-bottom: 1px solid rgba(255,255,255,0.04);
          font-size: 10px; color: #52525b;
          font-family: 'JetBrains Mono', monospace;
        }
        .sd-file-content-rendered {
          max-height: 320px; overflow-y: auto;
          scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.06) transparent;
        }
        .sd-file-content-rendered :global(.md-rendered) {
          padding: 12px 14px;
          font-size: 12px;
        }
        .sd-file-loading {
          display: flex; align-items: center; gap: 8px;
          padding: 16px 10px; color: #71717a; font-size: 11px;
        }
        .sd-loader-sm {
          width: 14px; height: 14px;
          border: 2px solid rgba(99,102,241,0.15);
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: sdSpin 0.8s linear infinite;
        }
        .sd-open-page-btn {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          width: 100%; padding: 8px; margin-top: 10px;
          border-radius: 8px;
          border: 1px solid rgba(99,102,241,0.15);
          background: rgba(99,102,241,0.06);
          color: #818cf8; font-size: 11px; font-weight: 600;
          cursor: pointer; transition: all 0.2s; font-family: inherit;
        }
        .sd-open-page-btn:hover {
          background: rgba(99,102,241,0.12);
          border-color: rgba(99,102,241,0.3);
          box-shadow: 0 0 16px rgba(99,102,241,0.08);
        }
      `}</style>
    </div>
  );

  return ReactDOM.createPortal(panel, document.body);
};
