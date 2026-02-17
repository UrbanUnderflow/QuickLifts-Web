import React, { useState, useCallback, useRef, useEffect } from 'react';
import Head from 'next/head';
import { MarkdownRenderer } from '../../components/MarkdownRenderer';

/* ─────────────────────── types ─────────────────────── */

interface Artifact {
  id: string;
  title: string;
  category: Category;
  path: string;
  description: string;
  tags: string[];
  emoji: string;
  size?: string;
  status?: 'complete' | 'pending-recovery';
  completedAt?: string;
  taskRef?: string;
}

type Category =
  | 'deliverable'
  | 'persona'
  | 'research'
  | 'profile'
  | 'integration'
  | 'analysis'
  | 'config';

/* ─────────────────── artifact data ─────────────────── */

const CATEGORIES: Record<Category, { label: string; icon: string; color: string; gradient: string }> = {
  deliverable: {
    label: 'Research Output',
    icon: '📡',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #fbbf24 100%)',
  },
  persona: {
    label: 'Persona & Identity',
    icon: '🧬',
    color: '#a78bfa',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
  },
  research: {
    label: 'Field Research',
    icon: '🔬',
    color: '#34d399',
    gradient: 'linear-gradient(135deg, #059669 0%, #34d399 100%)',
  },
  profile: {
    label: 'Profile & Presence',
    icon: '🪪',
    color: '#60a5fa',
    gradient: 'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)',
  },
  integration: {
    label: 'Integration & Testing',
    icon: '🧪',
    color: '#fbbf24',
    gradient: 'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)',
  },
  analysis: {
    label: 'Analysis & Decisions',
    icon: '📊',
    color: '#f472b6',
    gradient: 'linear-gradient(135deg, #db2777 0%, #f472b6 100%)',
  },
  config: {
    label: 'Configuration',
    icon: '⚙️',
    color: '#38bdf8',
    gradient: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
  },
};

const ARTIFACTS: Artifact[] = [
  // ── Persona & Identity ──
  {
    id: 'brainstorm-extract',
    title: 'Brainstorm — Source Extraction',
    category: 'persona',
    path: 'docs/sage/brainstorm-extract.md',
    description: 'Every description of Sage\'s role, tone, duties, and narrative cues from the Round Table brainstorm transcript.',
    tags: ['brainstorm', 'identity', 'naming'],
    emoji: '💡',
  },
  {
    id: 'persona-narrative',
    title: 'Persona Narrative & Creed',
    category: 'persona',
    path: 'docs/sage/persona.md',
    description: 'Sage\'s lantern-carrying field correspondent narrative plus the five living vows of the creed.',
    tags: ['creed', 'narrative', 'vows'],
    emoji: '📜',
  },
  {
    id: 'responsibilities',
    title: 'Core Responsibilities',
    category: 'persona',
    path: 'docs/sage/responsibilities.md',
    description: 'Three operating stages: Field Research, Pattern Synthesis, Feed + Report Delivery.',
    tags: ['duties', 'field-research', 'feed-delivery'],
    emoji: '📋',
  },
  {
    id: 'sage-persona-agent',
    title: 'Research Intelligence Envoy Persona',
    category: 'persona',
    path: 'docs/agents/sage-persona.md',
    description: 'Voice & creed guidelines, primary duties, operating constraints, and OpenClaw runner config stub.',
    tags: ['voice', 'constraints', 'openclaw'],
    emoji: '🎙️',
  },

  // ── Profile & Presence ──
  {
    id: 'sage-profile',
    title: 'Full Agent Profile',
    category: 'profile',
    path: 'docs/agents/sage-profile.md',
    description: 'Complete profile package — identity, creed, responsibilities, and presence configuration for virtual office + OpenClaw.',
    tags: ['profile', 'virtual-office', 'presence'],
    emoji: '🧬',
  },
  {
    id: 'sage-profile-vo',
    title: 'Virtual Office Profile Notes',
    category: 'profile',
    path: 'docs/sage/profile.md',
    description: 'How Sage renders in the Virtual Office — presence card, SAGE_PRESENCE fallback, AGENT_DUTIES wording.',
    tags: ['virtual-office', 'ui', 'fallback'],
    emoji: '🖥️',
  },
  {
    id: 'presence-card-structure',
    title: 'Presence Card Structure',
    category: 'profile',
    path: 'docs/sage/presence-card-structure.md',
    description: 'Layout sections, styling expectations, and Firestore data requirements to render Sage\'s hover panel.',
    tags: ['presence-card', 'layout', 'firestore'],
    emoji: '🃏',
  },
  {
    id: 'sage-profile-plan',
    title: 'Profile Implementation Plan',
    category: 'profile',
    path: 'docs/agents/sage-profile-plan.md',
    description: 'How AGENT_ROLES, AGENT_DUTIES, and AGENT_PROFILES work and what Sage\'s entries should contain.',
    tags: ['plan', 'implementation', 'data-structures'],
    emoji: '📐',
  },
  {
    id: 'sage-profile-notes',
    title: 'Presence Card Compatibility Notes',
    category: 'profile',
    path: 'docs/agents/sage-profile-notes.md',
    description: 'AGENT_PROFILES schema refresher and implications for wiring Sage\'s card to match Nora/Scout/Solara.',
    tags: ['schema', 'compatibility', 'card'],
    emoji: '📝',
  },

  // ── Field Research ──
  {
    id: 'intel-feed',
    title: 'Intel Feed Integration',
    category: 'research',
    path: 'docs/agents/sage-intel-feed.md',
    description: 'How Sage publishes research drops to the intel-feed Firestore collection — HTTP hook, payload schema, and field docs.',
    tags: ['intel-feed', 'firestore', 'api'],
    emoji: '📡',
  },

  // ── Integration & Testing ──
  {
    id: 'integration-checklist',
    title: 'Integration Verification Checklist',
    category: 'integration',
    path: 'docs/testing/sage-integration-checklist.md',
    description: 'UI presence, OpenClaw runner, and intel feed verification steps with sample run results.',
    tags: ['testing', 'checklist', 'verification'],
    emoji: '✅',
  },
  {
    id: 'virtual-office-verification',
    title: 'Virtual Office Verification Report',
    category: 'integration',
    path: 'docs/testing/sage-virtual-office-verification.md',
    description: 'Full UI rendering pass, intel feed confirmation, Feb 13 runner stall resolution, and Firestore presence check snippet.',
    tags: ['verification', 'runner-stall', 'debugging'],
    emoji: '🔍',
  },

  // ── Analysis & Decisions ──
  {
    id: 'config-status',
    title: 'Configuration Status Report',
    category: 'analysis',
    path: '.agent/analysis/sage-configuration-status.md',
    description: 'Comprehensive comparison of requested vs. actual Sage configuration across all data structures.',
    tags: ['status', 'comparison', 'data-structures'],
    emoji: '📊',
  },
  {
    id: 'presence-verification',
    title: 'Presence Card Verification Report',
    category: 'analysis',
    path: '.agent/analysis/sage-presence-verification.md',
    description: 'Step-by-step verification of all seven required data structures — DESK_POSITIONS through AGENT_PROFILES.',
    tags: ['verification', 'data-structures', 'agent-profiles'],
    emoji: '🔎',
  },
  {
    id: 'role-title-decision',
    title: 'Role Title Decision Record',
    category: 'analysis',
    path: '.agent/decisions/sage-role-title-decision.md',
    description: 'ADR: why "Research Intelligence Envoy" was kept over the original "Performance Research & Narrative" spec.',
    tags: ['adr', 'decision', 'role-title'],
    emoji: '⚖️',
  },
  {
    id: 'format-comparison',
    title: 'Format Comparison — Visual Reference',
    category: 'analysis',
    path: '.agent/sage-format-comparison.md',
    description: 'Side-by-side comparison of Sage\'s card format with Scout, Nora, and Solara — 100% match scorecard.',
    tags: ['format', 'comparison', 'scorecard'],
    emoji: '📐',
  },

  // ── Configuration ──
  {
    id: 'openclaw-config',
    title: 'OpenClaw Runner Config',
    category: 'config',
    path: '.agent/workflows/sage-openclaw-config.json',
    description: 'JSON configuration for the Sage OpenClaw agent — persona, creed, constraints, and intel feed schema.',
    tags: ['openclaw', 'json', 'runner'],
    emoji: '🔧',
  },
];

/* ────────────────── file content cache ────────────────── */
const fileContentCache: Record<string, string> = {};

async function fetchFileContent(path: string): Promise<string> {
  if (fileContentCache[path]) return fileContentCache[path];
  try {
    const res = await fetch(`/api/read-file?path=${encodeURIComponent(path)}`);
    if (res.ok) {
      const data = await res.json();
      const content = data.content ?? '(file not found)';
      fileContentCache[path] = content;
      return content;
    }
    return `⚠️ Could not load file.\n\nPath: ${path}`;
  } catch {
    return `📂 File path: ${path}\n\nOpen this file in your code editor to view its contents.`;
  }
}

/* ──────────── expandable artifact card ──────────── */

function ModalArtifactCard({ artifact, catColor }: { artifact: Artifact; catColor: string }) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (!expanded && !content) {
      setLoading(true);
      const c = await fetchFileContent(artifact.path);
      setContent(c);
      setLoading(false);
    }
    setExpanded(!expanded);
  };

  return (
    <div className={`modal-artifact-card ${expanded ? 'expanded' : ''}`}>
      <button
        id={`modal-card-${artifact.id}`}
        className="modal-card-header"
        onClick={handleToggle}
        style={{ '--mac-color': catColor } as React.CSSProperties}
      >
        <span className="mac-emoji">{artifact.emoji}</span>
        <div className="mac-body">
          <span className="mac-title">{artifact.title}</span>
          <span className="mac-desc">{artifact.description}</span>
          <div className="mac-tags">
            {artifact.tags.map((t) => (
              <span key={t} className="mac-tag">{t}</span>
            ))}
          </div>
        </div>
        <span className="mac-path">{artifact.path.split('/').pop()}</span>
        {artifact.status === 'pending-recovery' && (
          <span className="mac-status pending">⏳</span>
        )}
        <span className={`mac-chevron ${expanded ? 'open' : ''}`}>▸</span>
      </button>
      {expanded && (
        <div className="modal-card-content">
          {loading ? (
            <div className="mac-loading">
              <div className="spinner-sm" />
              <span>Loading…</span>
            </div>
          ) : (
            <MarkdownRenderer content={content} accentColor="#34d399" />
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────────── category modal ──────────────── */

function CategoryModal({
  category,
  onClose,
  artifacts: allArtifacts,
}: {
  category: Category;
  onClose: () => void;
  artifacts: Artifact[];
}) {
  const cat = CATEGORIES[category];
  const artifacts = allArtifacts.filter((a) => a.category === category);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="modal-container" style={{ '--modal-accent': cat.color } as React.CSSProperties}>
        {/* header */}
        <div className="modal-header" style={{ background: cat.gradient }}>
          <div className="mh-left">
            <span className="mh-icon">{cat.icon}</span>
            <div>
              <h2 className="mh-title">{cat.label}</h2>
              <span className="mh-count">{artifacts.length} artifact{artifacts.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <button id="close-category-modal" className="mh-close" onClick={onClose}>✕</button>
        </div>

        {/* body — list of expandable cards */}
        <div className="modal-body">
          {artifacts.length === 0 ? (
            <div className="modal-empty">
              <span className="modal-empty-icon">📭</span>
              <p>No artifacts in this category yet.</p>
            </div>
          ) : (
            artifacts.map((a) => (
              <ModalArtifactCard key={a.id} artifact={a} catColor={cat.color} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── main page ─────────────────── */

export default function SageDeliverablesPage() {
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [modalCategory, setModalCategory] = useState<Category | null>(null);
  const [allArtifacts, setAllArtifacts] = useState<Artifact[]>(ARTIFACTS);

  /* Load deliverables from manifest.json — poll every 30s for real-time updates */
  useEffect(() => {
    let cancelled = false;

    const loadManifest = async () => {
      try {
        const res = await fetch('/api/read-file?path=' + encodeURIComponent('docs/sage/deliverables/manifest.json'));
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const manifest = JSON.parse(data.content);
        if (!manifest.deliverables?.length) return;

        const dynamicArtifacts: Artifact[] = manifest.deliverables.map((d: any) => ({
          id: d.id,
          title: d.title,
          category: 'deliverable' as Category,
          path: `docs/sage/deliverables/${d.filename}`,
          description: d.description,
          tags: d.tags ?? [],
          emoji: d.emoji ?? '📡',
          status: d.status,
          completedAt: d.completedAt,
          taskRef: d.taskRef,
        }));

        // For any pending-recovery items, check if the file actually exists now
        const verified = await Promise.all(
          dynamicArtifacts.map(async (art) => {
            if (art.status !== 'pending-recovery') return art;
            try {
              const check = await fetch(`/api/read-file?path=${encodeURIComponent(art.path)}`);
              if (check.ok) return { ...art, status: 'complete' as const };
            } catch { /* still pending */ }
            return art;
          }),
        );

        if (!cancelled) {
          setAllArtifacts([...verified, ...ARTIFACTS]);
        }
      } catch {
        /* manifest not found — just use static artifacts */
      }
    };

    loadManifest();
    const interval = setInterval(loadManifest, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const filteredArtifacts = allArtifacts.filter((a) => {
    const matchesCategory = activeCategory === 'all' || a.category === activeCategory;
    const matchesSearch =
      searchQuery === '' ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const loadFile = useCallback(async (artifact: Artifact) => {
    setSelectedArtifact(artifact);
    setLoading(true);
    const c = await fetchFileContent(artifact.path);
    setFileContent(c);
    setLoading(false);
  }, []);

  const groupedArtifacts = filteredArtifacts.reduce<Record<Category, Artifact[]>>((acc, a) => {
    if (!acc[a.category]) acc[a.category] = [];
    acc[a.category].push(a);
    return acc;
  }, {} as Record<Category, Artifact[]>);

  return (
    <>
      <Head>
        <title>Sage 🧬 Deliverables — Pulse</title>
        <meta name="description" content="Browse all of Sage's research artifacts, code, analysis, and documentation." />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div id="sage-deliverables-root">
        {/* ──── sidebar ──── */}
        <aside id="sage-sidebar">
          <div className="sidebar-header">
            <div className="sage-logo">
              <span className="logo-emoji">🧬</span>
              <div>
                <h1>Sage</h1>
                <p className="subtitle">Research Intelligence Envoy</p>
              </div>
            </div>
            <p className="tagline">Field Notes → Patterns → Feed Drops</p>
          </div>

          <div className="search-container">
            <input
              id="artifact-search"
              type="text"
              placeholder="Search artifacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="search-icon">⌘K</span>
          </div>

          <nav className="category-nav">
            <button
              id="filter-all"
              className={`category-pill ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCategory('all')}
            >
              All <span className="count">{allArtifacts.length}</span>
            </button>
            {(Object.keys(CATEGORIES) as Category[]).map((cat) => {
              const count = allArtifacts.filter((a) => a.category === cat).length;
              return (
                <button
                  id={`filter-${cat}`}
                  key={cat}
                  className={`category-pill ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                  style={{ '--cat-color': CATEGORIES[cat].color } as React.CSSProperties}
                >
                  <span className="pill-icon">{CATEGORIES[cat].icon}</span>
                  {CATEGORIES[cat].label}
                  <span className="count">{count}</span>
                </button>
              );
            })}
          </nav>

          <div className="artifact-list">
            {Object.entries(groupedArtifacts).map(([cat, artifacts]) => (
              <div key={cat} className="artifact-group">
                <h3 className="group-title" style={{ color: CATEGORIES[cat as Category].color }}>
                  {CATEGORIES[cat as Category].icon} {CATEGORIES[cat as Category].label}
                </h3>
                {artifacts.map((a) => (
                  <button
                    id={`artifact-${a.id}`}
                    key={a.id}
                    className={`artifact-card ${selectedArtifact?.id === a.id ? 'selected' : ''} ${hoveredCard === a.id ? 'hovered' : ''}`}
                    onClick={() => loadFile(a)}
                    onMouseEnter={() => setHoveredCard(a.id)}
                    onMouseLeave={() => setHoveredCard(null)}
                  >
                    <span className="card-emoji">{a.emoji}</span>
                    <div className="card-body">
                      <span className="card-title">{a.title}</span>
                      <span className="card-desc">{a.description}</span>
                      <div className="card-tags">
                        {a.tags.map((t) => (
                          <span key={t} className="tag">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span
                      className="card-category-dot"
                      style={{ backgroundColor: CATEGORIES[a.category].color }}
                    />
                    {a.status === 'pending-recovery' && (
                      <span className="status-badge pending">⏳ pending</span>
                    )}
                  </button>
                ))}
              </div>
            ))}
            {filteredArtifacts.length === 0 && (
              <div className="empty-state">
                <span className="empty-icon">🔍</span>
                <p>No artifacts match your search.</p>
              </div>
            )}
          </div>

          <div className="sidebar-footer">
            <span className="footer-text">
              {allArtifacts.length} artifacts • Sage v1.0
            </span>
          </div>
        </aside>

        {/* ──── main content ──── */}
        <main id="sage-content">
          {!selectedArtifact ? (
            <div className="welcome-state">
              <div className="welcome-glow" />
              <span className="welcome-emoji">🧬</span>
              <h2>Sage&apos;s Deliverables</h2>
              <p>
                Click any category below to explore its artifacts,<br />
                or select an item from the sidebar.
              </p>
              <div className="stats-row">
                {(Object.keys(CATEGORIES) as Category[]).map((cat) => {
                  const count = allArtifacts.filter((a) => a.category === cat).length;
                  return (
                    <button
                      key={cat}
                      id={`stat-${cat}`}
                      className="stat-card"
                      onClick={() => setModalCategory(cat)}
                      style={{ '--stat-color': CATEGORIES[cat].color } as React.CSSProperties}
                    >
                      <span className="stat-icon">{CATEGORIES[cat].icon}</span>
                      <span className="stat-count">{count}</span>
                      <span className="stat-label">{CATEGORIES[cat].label}</span>
                      <span className="stat-tap-hint">tap to explore →</span>
                    </button>
                  );
                })}
              </div>
              <div className="creed-block">
                <h3>Creed</h3>
                <ol>
                  <li><strong>Illuminate, never interrogate.</strong> Carry a lantern, not a spotlight.</li>
                  <li><strong>Return with receipts.</strong> Every insight pairs a heartbeat with verifiable context.</li>
                  <li><strong>Stay on our side of the line.</strong> Internal-facing only.</li>
                  <li><strong>Name the signal, honor the story.</strong> Data → patterns, but people stay visible.</li>
                  <li><strong>Move with compass discipline.</strong> Every dispatch ties back to Pulse&apos;s values.</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="file-viewer">
              <div className="file-header">
                <button id="close-viewer" className="back-btn" onClick={() => { setSelectedArtifact(null); setFileContent(''); }}>
                  ← Back
                </button>
                <div className="file-meta">
                  <span className="file-emoji">{selectedArtifact.emoji}</span>
                  <div>
                    <h2>{selectedArtifact.title}</h2>
                    <span className="file-path">{selectedArtifact.path}</span>
                  </div>
                </div>
                <div
                  className="file-category-badge"
                  style={{ background: CATEGORIES[selectedArtifact.category].gradient }}
                >
                  {CATEGORIES[selectedArtifact.category].icon} {CATEGORIES[selectedArtifact.category].label}
                </div>
              </div>
              <div className="file-body">
                {loading ? (
                  <div className="loading-state">
                    <div className="spinner" />
                    <p>Loading artifact...</p>
                  </div>
                ) : (
                  <MarkdownRenderer content={fileContent} accentColor="#34d399" />
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ──── category modal ──── */}
      {modalCategory && (
        <CategoryModal
          category={modalCategory}
          onClose={() => setModalCategory(null)}
          artifacts={allArtifacts}
        />
      )}

      <style jsx global>{`
        /* ───────── reset & base ───────── */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { height: 100%; overflow: hidden; }
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #0a0b10; color: #e2e8f0; }

        /* ───────── layout ───────── */
        #sage-deliverables-root {
          display: flex; height: 100vh; width: 100vw;
        }

        /* ───────── sidebar ───────── */
        #sage-sidebar {
          width: 420px; min-width: 420px; height: 100vh;
          display: flex; flex-direction: column;
          background: linear-gradient(180deg, #0f1019 0%, #111827 40%, #0f1019 100%);
          border-right: 1px solid rgba(139, 92, 246, .15);
          overflow: hidden;
        }

        .sidebar-header {
          padding: 28px 24px 16px;
          border-bottom: 1px solid rgba(255,255,255,.06);
          background: linear-gradient(135deg, rgba(139,92,246,.06) 0%, rgba(59,130,246,.04) 100%);
        }
        .sage-logo {
          display: flex; align-items: center; gap: 14px;
        }
        .logo-emoji {
          font-size: 36px;
          filter: drop-shadow(0 0 12px rgba(139,92,246,.5));
          animation: pulse-glow 3s ease-in-out infinite;
        }
        @keyframes pulse-glow {
          0%, 100% { filter: drop-shadow(0 0 12px rgba(139,92,246,.5)); }
          50% { filter: drop-shadow(0 0 20px rgba(139,92,246,.8)); }
        }
        .sage-logo h1 {
          font-size: 24px; font-weight: 800;
          background: linear-gradient(135deg, #a78bfa 0%, #60a5fa 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          letter-spacing: -.5px;
        }
        .subtitle {
          font-size: 12px; color: #94a3b8; font-weight: 500; margin-top: 2px;
        }
        .tagline {
          font-size: 11px; color: #64748b; margin-top: 10px;
          font-family: 'JetBrains Mono', monospace;
          letter-spacing: .5px;
        }

        /* search */
        .search-container {
          padding: 12px 20px; position: relative;
        }
        .search-container input {
          width: 100%; padding: 10px 14px; border-radius: 10px;
          background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
          color: #e2e8f0; font-size: 13px; font-family: inherit;
          transition: all .2s;
        }
        .search-container input:focus {
          outline: none; border-color: rgba(139,92,246,.4);
          background: rgba(139,92,246,.06);
          box-shadow: 0 0 0 3px rgba(139,92,246,.1);
        }
        .search-container input::placeholder { color: #475569; }
        .search-icon {
          position: absolute; right: 32px; top: 50%; transform: translateY(-50%);
          font-size: 10px; color: #475569;
          background: rgba(255,255,255,.06); padding: 3px 6px; border-radius: 4px;
          font-family: 'JetBrains Mono', monospace;
        }

        /* category pills */
        .category-nav {
          display: flex; flex-wrap: wrap; gap: 6px;
          padding: 8px 20px 14px;
          border-bottom: 1px solid rgba(255,255,255,.04);
        }
        .category-pill {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 10px; border-radius: 8px;
          background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.06);
          color: #94a3b8; font-size: 11px; font-weight: 500;
          cursor: pointer; transition: all .2s; font-family: inherit;
        }
        .category-pill:hover {
          background: rgba(255,255,255,.08); color: #e2e8f0;
        }
        .category-pill.active {
          background: rgba(139,92,246,.15); border-color: rgba(139,92,246,.3);
          color: #a78bfa;
        }
        .category-pill .count {
          font-size: 10px; background: rgba(255,255,255,.06);
          padding: 1px 5px; border-radius: 4px; color: #64748b;
        }
        .category-pill.active .count {
          background: rgba(139,92,246,.2); color: #a78bfa;
        }
        .pill-icon { font-size: 12px; }

        /* artifact list */
        .artifact-list {
          flex: 1; overflow-y: auto; padding: 12px 16px;
          scrollbar-width: thin; scrollbar-color: rgba(139,92,246,.2) transparent;
        }
        .artifact-list::-webkit-scrollbar { width: 5px; }
        .artifact-list::-webkit-scrollbar-thumb { background: rgba(139,92,246,.2); border-radius: 4px; }

        .artifact-group { margin-bottom: 20px; }
        .group-title {
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 1px; margin-bottom: 8px; padding-left: 4px;
        }

        .artifact-card {
          display: flex; align-items: flex-start; gap: 10px;
          width: 100%; text-align: left; padding: 12px 14px;
          border-radius: 12px; cursor: pointer;
          background: rgba(255,255,255,.02); border: 1px solid rgba(255,255,255,.04);
          transition: all .25s cubic-bezier(.4,0,.2,1);
          margin-bottom: 6px; position: relative; font-family: inherit;
          color: inherit;
        }
        .artifact-card:hover, .artifact-card.hovered {
          background: rgba(139,92,246,.06);
          border-color: rgba(139,92,246,.2);
          transform: translateX(4px);
          box-shadow: 0 4px 20px rgba(139,92,246,.08);
        }
        .artifact-card.selected {
          background: rgba(139,92,246,.1);
          border-color: rgba(139,92,246,.35);
          box-shadow: 0 0 24px rgba(139,92,246,.1);
        }

        .card-emoji { font-size: 20px; flex-shrink: 0; margin-top: 2px; }
        .card-body { flex: 1; min-width: 0; }
        .card-title {
          font-size: 13px; font-weight: 600; color: #e2e8f0;
          display: block; margin-bottom: 3px;
        }
        .card-desc {
          font-size: 11px; color: #64748b; line-height: 1.4;
          display: -webkit-box; -webkit-line-clamp: 2;
          -webkit-box-orient: vertical; overflow: hidden;
        }
        .card-tags {
          display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;
        }
        .tag {
          font-size: 9px; font-weight: 500; color: #64748b;
          background: rgba(255,255,255,.04); padding: 2px 6px; border-radius: 4px;
          font-family: 'JetBrains Mono', monospace;
        }
        .card-category-dot {
          width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-top: 6px;
        }

        /* status badges */
        .status-badge {
          position: absolute; top: 6px; right: 6px;
          font-size: 8px; font-weight: 600; padding: 2px 6px; border-radius: 4px;
          font-family: 'JetBrains Mono', monospace;
        }
        .status-badge.pending {
          background: rgba(245,158,11,.15); color: #f59e0b;
          border: 1px solid rgba(245,158,11,.25);
        }
        .mac-status {
          flex-shrink: 0; font-size: 14px;
        }
        .mac-status.pending {
          animation: pulse-pending 2s ease-in-out infinite;
        }
        @keyframes pulse-pending {
          0%, 100% { opacity: .6; }
          50% { opacity: 1; }
        }

        .empty-state {
          text-align: center; padding: 48px 20px; color: #475569;
        }
        .empty-icon { font-size: 36px; display: block; margin-bottom: 12px; opacity: .5; }

        .sidebar-footer {
          padding: 12px 20px; border-top: 1px solid rgba(255,255,255,.04);
          text-align: center;
        }
        .footer-text {
          font-size: 10px; color: #334155;
          font-family: 'JetBrains Mono', monospace;
        }

        /* ───────── main content ───────── */
        #sage-content {
          flex: 1; height: 100vh; overflow-y: auto;
          background: #0a0b10;
        }

        /* welcome state */
        .welcome-state {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; min-height: 100vh;
          padding: 60px 40px; text-align: center; position: relative;
        }
        .welcome-glow {
          position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%);
          width: 500px; height: 500px; border-radius: 50%;
          background: radial-gradient(circle, rgba(139,92,246,.08) 0%, transparent 70%);
          pointer-events: none;
          animation: breathe 6s ease-in-out infinite;
        }
        @keyframes breathe {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: .6; }
          50% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
        }
        .welcome-emoji {
          font-size: 72px; margin-bottom: 20px; position: relative; z-index: 1;
          filter: drop-shadow(0 0 24px rgba(139,92,246,.4));
        }
        .welcome-state h2 {
          font-size: 32px; font-weight: 800; margin-bottom: 12px;
          background: linear-gradient(135deg, #c4b5fd 0%, #60a5fa 50%, #34d399 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          position: relative; z-index: 1;
        }
        .welcome-state > p {
          font-size: 14px; color: #64748b; line-height: 1.7; max-width: 420px;
          position: relative; z-index: 1;
        }

        /* stats row — now clickable */
        .stats-row {
          display: flex; flex-wrap: wrap; gap: 14px;
          margin-top: 40px; justify-content: center; position: relative; z-index: 1;
        }
        .stat-card {
          display: flex; flex-direction: column; align-items: center;
          gap: 4px; padding: 18px 20px 14px; border-radius: 14px;
          background: rgba(255,255,255,.03);
          border: 1px solid rgba(255,255,255,.06);
          min-width: 110px; transition: all .3s;
          cursor: pointer; position: relative; overflow: hidden;
          font-family: inherit; color: inherit;
        }
        .stat-card:hover {
          border-color: var(--stat-color);
          background: rgba(255,255,255,.05);
          transform: translateY(-4px);
          box-shadow: 0 8px 32px rgba(0,0,0,.4), 0 0 20px color-mix(in srgb, var(--stat-color) 15%, transparent);
        }
        .stat-card:active {
          transform: translateY(-1px);
        }
        .stat-icon { font-size: 22px; }
        .stat-count { font-size: 24px; font-weight: 800; color: #e2e8f0; }
        .stat-label { font-size: 10px; color: #64748b; font-weight: 500; text-align: center; }
        .stat-tap-hint {
          font-size: 9px; color: transparent; font-weight: 500;
          transition: all .3s; margin-top: 2px;
          font-family: 'JetBrains Mono', monospace;
        }
        .stat-card:hover .stat-tap-hint {
          color: var(--stat-color);
        }

        /* creed */
        .creed-block {
          margin-top: 40px; padding: 28px; border-radius: 16px;
          background: linear-gradient(135deg, rgba(139,92,246,.06) 0%, rgba(59,130,246,.03) 100%);
          border: 1px solid rgba(139,92,246,.12);
          max-width: 560px; text-align: left; position: relative; z-index: 1;
        }
        .creed-block h3 {
          font-size: 14px; font-weight: 700; color: #a78bfa; margin-bottom: 14px;
          letter-spacing: .5px;
        }
        .creed-block ol {
          list-style: none; counter-reset: creed; padding: 0;
        }
        .creed-block li {
          counter-increment: creed; position: relative;
          padding-left: 28px; margin-bottom: 10px;
          font-size: 13px; color: #94a3b8; line-height: 1.5;
        }
        .creed-block li::before {
          content: counter(creed); position: absolute; left: 0; top: 0;
          width: 18px; height: 18px; border-radius: 5px;
          background: rgba(139,92,246,.15); color: #a78bfa;
          font-size: 10px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }
        .creed-block li strong { color: #c4b5fd; }

        /* ───────── file viewer ───────── */
        .file-viewer {
          height: 100vh; display: flex; flex-direction: column;
        }
        .file-header {
          display: flex; align-items: center; gap: 16px;
          padding: 16px 28px;
          border-bottom: 1px solid rgba(255,255,255,.06);
          background: rgba(15,16,25,.95);
          backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          position: sticky; top: 0; z-index: 10;
        }
        .back-btn {
          padding: 7px 14px; border-radius: 8px;
          background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08);
          color: #94a3b8; font-size: 12px; font-weight: 500;
          cursor: pointer; transition: all .2s; font-family: inherit;
          white-space: nowrap;
        }
        .back-btn:hover {
          background: rgba(139,92,246,.1); border-color: rgba(139,92,246,.3);
          color: #a78bfa;
        }
        .file-meta {
          display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;
        }
        .file-emoji { font-size: 28px; flex-shrink: 0; }
        .file-meta h2 {
          font-size: 16px; font-weight: 700; color: #e2e8f0;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .file-path {
          font-size: 11px; color: #475569;
          font-family: 'JetBrains Mono', monospace;
        }
        .file-category-badge {
          padding: 5px 12px; border-radius: 8px;
          font-size: 11px; font-weight: 600; color: #fff;
          white-space: nowrap; flex-shrink: 0;
        }

        .file-body { flex: 1; overflow-y: auto; padding: 24px 32px; }

        .file-content {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px; line-height: 1.7; color: #cbd5e1;
          white-space: pre-wrap; word-break: break-word;
          background: rgba(255,255,255,.02);
          border: 1px solid rgba(255,255,255,.04);
          border-radius: 12px; padding: 24px;
          tab-size: 4;
        }

        .loading-state {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; height: 300px; color: #64748b;
        }
        .spinner {
          width: 32px; height: 32px; border: 3px solid rgba(139,92,246,.15);
          border-top-color: #a78bfa; border-radius: 50%;
          animation: spin .8s linear infinite; margin-bottom: 12px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ═══════════════ CATEGORY MODAL ═══════════════ */
        .modal-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0,0,0,.7);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          animation: fadeIn .2s ease-out;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .modal-container {
          width: 720px; max-width: 92vw; max-height: 85vh;
          display: flex; flex-direction: column;
          border-radius: 20px; overflow: hidden;
          background: #111827;
          border: 1px solid rgba(255,255,255,.08);
          box-shadow: 0 24px 80px rgba(0,0,0,.6), 0 0 40px color-mix(in srgb, var(--modal-accent) 10%, transparent);
          animation: slideUp .25s ease-out;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px) scale(.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* modal header */
        .modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 24px 28px; color: #fff;
        }
        .mh-left {
          display: flex; align-items: center; gap: 14px;
        }
        .mh-icon { font-size: 32px; }
        .mh-title { font-size: 20px; font-weight: 800; }
        .mh-count { font-size: 12px; opacity: .8; font-weight: 500; }
        .mh-close {
          width: 32px; height: 32px; border-radius: 8px;
          background: rgba(255,255,255,.15); border: none;
          color: #fff; font-size: 16px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all .2s;
        }
        .mh-close:hover { background: rgba(255,255,255,.25); }

        /* modal body */
        .modal-body {
          flex: 1; overflow-y: auto; padding: 16px 20px 24px;
          scrollbar-width: thin; scrollbar-color: rgba(139,92,246,.2) transparent;
        }
        .modal-body::-webkit-scrollbar { width: 5px; }
        .modal-body::-webkit-scrollbar-thumb { background: rgba(139,92,246,.2); border-radius: 4px; }

        .modal-empty {
          text-align: center; padding: 48px 20px; color: #475569;
        }
        .modal-empty-icon { font-size: 40px; display: block; margin-bottom: 12px; }

        /* modal artifact card */
        .modal-artifact-card {
          margin-bottom: 10px; border-radius: 14px;
          border: 1px solid rgba(255,255,255,.06);
          background: rgba(255,255,255,.02);
          overflow: hidden; transition: all .25s;
        }
        .modal-artifact-card:hover {
          border-color: rgba(255,255,255,.12);
          background: rgba(255,255,255,.04);
        }
        .modal-artifact-card.expanded {
          border-color: var(--mac-color, rgba(139,92,246,.3));
          box-shadow: 0 0 20px color-mix(in srgb, var(--mac-color, #a78bfa) 10%, transparent);
        }

        .modal-card-header {
          display: flex; align-items: flex-start; gap: 12px;
          width: 100%; text-align: left; padding: 16px 18px;
          cursor: pointer; background: none; border: none;
          color: inherit; font-family: inherit;
          transition: background .2s;
        }
        .modal-card-header:hover {
          background: rgba(255,255,255,.03);
        }
        .mac-emoji { font-size: 24px; flex-shrink: 0; margin-top: 1px; }
        .mac-body { flex: 1; min-width: 0; }
        .mac-title {
          font-size: 14px; font-weight: 600; color: #e2e8f0;
          display: block; margin-bottom: 4px;
        }
        .mac-desc {
          font-size: 12px; color: #64748b; line-height: 1.5;
          display: block;
        }
        .mac-tags {
          display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px;
        }
        .mac-tag {
          font-size: 10px; font-weight: 500; color: #64748b;
          background: rgba(255,255,255,.05); padding: 2px 8px; border-radius: 4px;
          font-family: 'JetBrains Mono', monospace;
        }
        .mac-path {
          font-size: 10px; color: #475569; flex-shrink: 0;
          font-family: 'JetBrains Mono', monospace;
          margin-top: 2px;
        }
        .mac-chevron {
          font-size: 14px; color: #475569; flex-shrink: 0;
          transition: transform .25s; margin-top: 4px;
        }
        .mac-chevron.open { transform: rotate(90deg); color: #a78bfa; }

        /* expanded content area */
        .modal-card-content {
          border-top: 1px solid rgba(255,255,255,.06);
          animation: expandIn .25s ease-out;
        }
        @keyframes expandIn {
          from { opacity: 0; max-height: 0; }
          to { opacity: 1; max-height: 2000px; }
        }
        .mac-loading {
          display: flex; align-items: center; gap: 10px;
          justify-content: center; padding: 24px; color: #64748b;
          font-size: 13px;
        }
        .spinner-sm {
          width: 18px; height: 18px; border: 2px solid rgba(139,92,246,.15);
          border-top-color: #a78bfa; border-radius: 50%;
          animation: spin .7s linear infinite;
        }
        .mac-file-content {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px; line-height: 1.65; color: #cbd5e1;
          white-space: pre-wrap; word-break: break-word;
          padding: 20px; margin: 0;
          max-height: 400px; overflow-y: auto;
          background: rgba(0,0,0,.2);
          scrollbar-width: thin; scrollbar-color: rgba(139,92,246,.2) transparent;
        }
        .mac-file-content::-webkit-scrollbar { width: 4px; }
        .mac-file-content::-webkit-scrollbar-thumb { background: rgba(139,92,246,.2); border-radius: 4px; }

        /* ───────── responsive ───────── */
        @media (max-width: 900px) {
          #sage-deliverables-root { flex-direction: column; }
          #sage-sidebar { width: 100%; min-width: unset; height: 50vh; border-right: none; border-bottom: 1px solid rgba(139,92,246,.15); }
          #sage-content { height: 50vh; }
          .modal-container { max-width: 96vw; max-height: 90vh; }
        }
      `}</style>
    </>
  );
}
